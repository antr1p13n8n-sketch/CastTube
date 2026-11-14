import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import {
  PRESET_CHANNELS,
  resolveYouTubeChannel,
  fetchChannelRss,
  resolveAudioStreamInfo,
  resolveAudioStreamUrl,
  invalidateAudioStreamCache,
  buildAudioDownloadFilename,
  buildContentDispositionHeader,
  searchYouTubeChannels,
  VideoItem,
  ChannelData,
} from './api/_youtube';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Permissions-Policy',
      'autoplay=(self "https://www.youtube.com" "https://www.youtube-nocookie.com"), encrypted-media=(self "https://www.youtube.com" "https://www.youtube-nocookie.com"), picture-in-picture=(self "https://www.youtube.com" "https://www.youtube-nocookie.com"), clipboard-read=(self), clipboard-write=(self)'
    );
    if (req.path.startsWith('/api/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Disposition, Content-Length, Content-Type, X-Suggested-Filename'
      );
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  // API: Get preset default channels
  app.get('/api/youtube/presets', (_req: Request, res: Response) => {
    const presets = Object.values(PRESET_CHANNELS).map((p) => ({
      channel: p.channel,
      videoCount: p.videos.length,
    }));
    res.json({ presets });
  });

  // API: Resolve input and return channel data + all fetched videos
  app.post('/api/youtube/resolve', async (req: Request, res: Response) => {
    try {
      const { input } = req.body;
      if (!input || typeof input !== 'string') {
        res.status(400).json({ error: 'Parameter input harus berupa URL atau handle YouTube' });
        return;
      }

      const { channelId, handle, title: resolvedTitle } = await resolveYouTubeChannel(input);
      const data = await fetchChannelRss(channelId);

      if (handle && !data.channel.handle) {
        data.channel.handle = handle;
      }
      if (resolvedTitle && (!data.channel.title || data.channel.title === 'YouTube Channel')) {
        data.channel.title = resolvedTitle;
      }

      res.json(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses channel';
      res.status(400).json({ error: message });
    }
  });

  // API: Search YouTube channels by keyword
  app.get('/api/youtube/search-channels', async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (!q) {
        res.status(400).json({ error: 'Parameter pencarian q diperlukan' });
        return;
      }
      const channels = await searchYouTubeChannels(q);
      res.json({ channels });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mencari channel YouTube';
      res.status(500).json({ error: message });
    }
  });

  // API: Fetch single channel feed
  app.get('/api/youtube/feed', async (req: Request, res: Response) => {
    try {
      const channelId = req.query.channelId as string;
      if (!channelId) {
        res.status(400).json({ error: 'Parameter channelId diperlukan' });
        return;
      }
      const data = await fetchChannelRss(channelId);
      res.json(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengambil feed channel';
      res.status(500).json({ error: message });
    }
  });

  // API: Batch fetch multiple channels feeds
  app.post('/api/youtube/batch-feed', async (req: Request, res: Response) => {
    try {
      const { channelIds } = req.body;
      if (!Array.isArray(channelIds)) {
        res.status(400).json({ error: 'channelIds harus berupa array string' });
        return;
      }

      const results = await Promise.allSettled(
        channelIds.slice(0, 20).map((id) => fetchChannelRss(id, 2))
      );

      const allVideos: VideoItem[] = [];
      const channels: Record<string, ChannelData> = {};

      results.forEach((resItem) => {
        if (resItem.status === 'fulfilled' && resItem.value) {
          const { channel, videos } = resItem.value;
          channels[channel.id] = channel;
          allVideos.push(...videos);
        }
      });

      // Sort newest to oldest
      allVideos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      res.json({
        channels,
        videos: allVideos,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memproses batch feeds';
      res.status(500).json({ error: message });
    }
  });

  // API: Stream native audio directly (for mobile background / lock-screen playback)
  const handleAudioStream = async (req: Request, res: Response) => {
    try {
      const videoId = typeof req.query.videoId === 'string' ? req.query.videoId.trim() : '';
      if (!videoId) {
        res.status(400).json({ error: 'Parameter videoId diperlukan' });
        return;
      }

      const resolution = await resolveAudioStreamInfo(videoId);
      if (req.query.check === '1') {
        res.status(200).json({
          available: Boolean(resolution.stream),
          status: resolution.status,
          reason: resolution.reason,
        });
        return;
      }
      let streamInfo = resolution.stream;
      if (!streamInfo) {
        res.status(404).json({
          error: 'Audio stream tidak tersedia untuk video ini',
          status: resolution.status,
          reason: resolution.reason,
        });
        return;
      }

      const controller = new AbortController();
      req.on('close', () => controller.abort());

      const fetchUpstream = async (info: NonNullable<typeof streamInfo>) => {
        const headers: Record<string, string> = {
          'User-Agent': info.userAgent,
        };
        if (req.headers.range) {
          headers['Range'] = String(req.headers.range);
        }
        return fetch(info.url, {
          headers,
          signal: controller.signal,
        });
      };

      let upstream = await fetchUpstream(streamInfo);
      if (upstream.status === 403 || upstream.status === 410) {
        invalidateAudioStreamCache(videoId);
        const refreshed = await resolveAudioStreamUrl(videoId);
        if (refreshed) {
          streamInfo = refreshed;
          upstream = await fetchUpstream(refreshed);
        }
      }

      if (!upstream.ok && upstream.status !== 206) {
        res.status(502).json({ error: `Upstream audio status ${upstream.status}` });
        return;
      }

      const resolvedMime = upstream.headers.get('content-type') || streamInfo.mimeType;
      res.status(upstream.status);
      res.setHeader('Content-Type', resolvedMime);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-store');

      if (req.query.download === '1' || req.query.download === 'true') {
        const rawTitle = typeof req.query.title === 'string' ? req.query.title : undefined;
        const filename = buildAudioDownloadFilename(rawTitle, videoId, resolvedMime);
        res.setHeader('Content-Disposition', buildContentDispositionHeader(filename));
        res.setHeader('X-Suggested-Filename', encodeURIComponent(filename));
      }

      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      if (!upstream.body) {
        res.status(502).end();
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as any);
      nodeStream.on('error', () => {
        if (!res.writableEnded) res.end();
      });
      nodeStream.pipe(res);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Gagal memutar stream audio';
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      }
    }
  };

  app.get('/api/youtube/audio-stream', handleAudioStream);
  app.head('/api/youtube/audio-stream', handleAudioStream);

  // Setup Vite middlewares for dev or static files for prod
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.get('/@vite/client', (_req: Request, res: Response) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) { return url; }
export class ErrorOverlay {}
`);
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CastTube server active on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server start error:', err);
  process.exit(1);
});
