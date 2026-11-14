import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import zlib from 'node:zlib';
import {
  PRESET_CHANNELS,
  resolveYouTubeChannel,
  fetchChannelRss,
  fetchBatchChannelFeeds,
  resolveAudioStreamInfo,
  resolveAudioStreamUrl,
  invalidateAudioStreamCache,
  buildAudioDownloadFilename,
  buildContentDispositionHeader,
  extractAuthFromRequest,
  buildExtractorSetCookieHeader,
  normalizeYouTubeCookies,
  startYouTubeDeviceAuth,
  pollYouTubeDeviceAuth,
  refreshYouTubeOAuthTokens,
  ExtractorAuthConfig,
  YouTubeOAuthTokens,
  YouTubeOAuthClientIdentity,
  searchYouTubeChannels,
} from './api/_youtube';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));
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
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Range, Content-Type, X-YouTube-Cookies, X-YouTube-OAuth, X-Extractor-Url'
      );
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

  // Compress API JSON payloads >= 1KB using built-in gzip (skipping binary audio streaming)
  app.use('/api', (req, res, next) => {
    if (req.path === '/youtube/audio-stream' || req.method === 'HEAD') {
      next();
      return;
    }
    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    if (!acceptEncoding.includes('gzip')) {
      next();
      return;
    }
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.headersSent || res.getHeader('Content-Encoding')) {
        return originalJson(body);
      }
      const raw = JSON.stringify(body);
      if (Buffer.byteLength(raw) < 1024) {
        return originalJson(body);
      }
      zlib.gzip(Buffer.from(raw, 'utf8'), (err, compressed) => {
        if (err || res.headersSent) {
          originalJson(body);
          return;
        }
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Length', String(compressed.length));
        res.send(compressed);
      });
      return res;
    }) as typeof res.json;
    next();
  });

  // API: Get preset default channels
  app.get('/api/youtube/presets', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
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
      res.setHeader('Cache-Control', 'public, max-age=180, stale-while-revalidate=300');
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
      res.setHeader('Cache-Control', 'public, max-age=180, stale-while-revalidate=300');
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

      const payload = await fetchBatchChannelFeeds(channelIds, 2, 6);
      res.json(payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memproses batch feeds';
      res.status(500).json({ error: message });
    }
  });

  // API: Audio Extractor Auth & Config (YouTube TV OAuth / Cookies / Custom Extractor)
  app.get('/api/youtube/extractor-auth', (req: Request, res: Response) => {
    const auth = extractAuthFromRequest(req.headers);
    const hasEnvCookies = Boolean(normalizeYouTubeCookies(process.env.YOUTUBE_COOKIES));
    const hasEnvExtractor = Boolean(
      process.env.COBALT_API_URL?.trim() ||
        process.env.PIPED_API_URL?.trim() ||
        process.env.INVIDIOUS_API_URL?.trim()
    );
    const mode = auth.oauthTokens
      ? 'oauth'
      : auth.cookies
      ? 'cookies'
      : auth.extractorUrl
      ? 'custom_server'
      : hasEnvCookies || hasEnvExtractor
      ? 'env'
      : 'none';

    res.json({
      authenticated: mode !== 'none',
      mode,
      hasOAuth: Boolean(auth.oauthTokens?.access_token),
      hasCookies: Boolean(auth.cookies),
      extractorUrl: auth.extractorUrl || null,
      hasEnvFallback: hasEnvCookies || hasEnvExtractor,
    });
  });

  app.post('/api/youtube/extractor-auth', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, any>;
      const action = typeof body.action === 'string' ? body.action.trim() : '';
      const secure = req.headers['x-forwarded-proto'] === 'https' || req.secure;

      if (action === 'start_device') {
        const deviceData = await startYouTubeDeviceAuth();
        res.json(deviceData);
        return;
      }

      if (action === 'poll_device') {
        const deviceCode = typeof body.deviceCode === 'string' ? body.deviceCode.trim() : '';
        const client = body.client as YouTubeOAuthClientIdentity | undefined;
        if (!deviceCode) {
          res.status(400).json({ error: 'deviceCode diperlukan' });
          return;
        }
        const pollRes = await pollYouTubeDeviceAuth({ deviceCode, client });
        if (pollRes.status === 'authorized' && pollRes.credentials) {
          const existing = extractAuthFromRequest(req.headers);
          const nextConfig: ExtractorAuthConfig = {
            ...existing,
            oauthTokens: pollRes.credentials,
          };
          res.setHeader('Set-Cookie', buildExtractorSetCookieHeader(nextConfig, secure));
        }
        res.json(pollRes);
        return;
      }

      if (action === 'restore' || action === 'save_config') {
        const existing = extractAuthFromRequest(req.headers);
        let oauthTokens = body.oauthTokens as YouTubeOAuthTokens | undefined;
        if (oauthTokens === undefined && body.clearOAuth !== true) {
          oauthTokens = existing.oauthTokens;
        }

        if (oauthTokens?.refresh_token) {
          const expMs = new Date(oauthTokens.expiry_date || 0).getTime();
          if (!Number.isFinite(expMs) || Date.now() >= expMs - 60_000) {
            try {
              oauthTokens = await refreshYouTubeOAuthTokens(oauthTokens);
            } catch {
              // keep existing tokens if refresh fails temporarily
            }
          }
        }

        const rawCookies =
          typeof body.cookies === 'string'
            ? normalizeYouTubeCookies(body.cookies)
            : body.clearCookies === true
            ? undefined
            : existing.cookies;

        const rawExtractorUrl =
          typeof body.extractorUrl === 'string'
            ? body.extractorUrl.trim().replace(/\/+$/, '') || undefined
            : body.clearExtractorUrl === true
            ? undefined
            : existing.extractorUrl;

        if (rawExtractorUrl && !/^https?:\/\//i.test(rawExtractorUrl)) {
          res.status(400).json({
            error: 'URL server ekstraktor harus diawali http:// atau https://',
          });
          return;
        }

        const nextConfig: ExtractorAuthConfig = {
          oauthTokens: oauthTokens?.access_token ? oauthTokens : undefined,
          cookies: rawCookies || undefined,
          extractorUrl: rawExtractorUrl || undefined,
        };

        res.setHeader('Set-Cookie', buildExtractorSetCookieHeader(nextConfig, secure));

        const testVideoId = typeof body.testVideoId === 'string' ? body.testVideoId.trim() : '';
        let verification: { available: boolean; status: string; reason?: string } | undefined;
        if (body.verify && testVideoId) {
          invalidateAudioStreamCache(testVideoId);
          const resolved = await resolveAudioStreamInfo(testVideoId, nextConfig);
          if (resolved.refreshedOAuth) {
            nextConfig.oauthTokens = resolved.refreshedOAuth;
            res.setHeader('Set-Cookie', buildExtractorSetCookieHeader(nextConfig, secure));
          }
          verification = {
            available: Boolean(resolved.stream),
            status: resolved.status,
            reason: resolved.reason,
          };
        }

        res.json({
          ok: true,
          oauthTokens: nextConfig.oauthTokens,
          hasCookies: Boolean(nextConfig.cookies),
          extractorUrl: nextConfig.extractorUrl || null,
          verification,
        });
        return;
      }

      if (action === 'disconnect') {
        res.setHeader('Set-Cookie', buildExtractorSetCookieHeader(null, secure));
        res.json({ ok: true });
        return;
      }

      res.status(400).json({ error: 'Aksi extractor-auth tidak dikenal' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memproses otorisasi YouTube';
      res.status(500).json({ error: message });
    }
  });

  // API: Stream native audio directly (for mobile background / lock-screen playback & downloads)
  const handleAudioStream = async (req: Request, res: Response) => {
    try {
      const videoId = typeof req.query.videoId === 'string' ? req.query.videoId.trim() : '';
      if (!videoId) {
        res.status(400).json({ error: 'Parameter videoId diperlukan' });
        return;
      }

      const authConfig = extractAuthFromRequest(req.headers);
      const resolution = await resolveAudioStreamInfo(videoId, authConfig);

      if (resolution.refreshedOAuth) {
        const secure = req.headers['x-forwarded-proto'] === 'https' || req.secure;
        res.setHeader(
          'Set-Cookie',
          buildExtractorSetCookieHeader(
            { ...authConfig, oauthTokens: resolution.refreshedOAuth },
            secure
          )
        );
      }

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
          ...(info.extraHeaders || {}),
        };
        if (req.headers.range) {
          headers['Range'] = String(req.headers.range);
        }
        return fetch(info.url, {
          headers,
          redirect: 'follow',
          signal: controller.signal,
        });
      };

      let upstream = await fetchUpstream(streamInfo);
      if (upstream.status === 403 || upstream.status === 410) {
        invalidateAudioStreamCache(videoId);
        const refreshed = await resolveAudioStreamUrl(videoId, authConfig);
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
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '365d',
        immutable: true,
      })
    );
    app.use(
      express.static(distDir, {
        maxAge: '1h',
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
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
