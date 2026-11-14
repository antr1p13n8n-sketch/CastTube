import { Readable } from 'stream';
import {
  resolveAudioStreamInfo,
  resolveAudioStreamUrl,
  invalidateAudioStreamCache,
  buildAudioDownloadFilename,
  buildContentDispositionHeader,
  extractAuthFromRequest,
  buildExtractorSetCookieHeader,
  VercelReq,
  VercelRes,
} from '../_youtube.js';

export default async function handler(req: VercelReq, res: VercelRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Range, Content-Type, X-YouTube-Cookies, X-YouTube-OAuth, X-Extractor-Url'
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Disposition, Content-Length, Content-Type, X-Suggested-Filename'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawId = req.query.videoId;
    const videoId = (Array.isArray(rawId) ? rawId[0] : rawId || '').trim();
    if (!videoId) {
      return res.status(400).json({ error: 'Parameter videoId diperlukan' });
    }

    const reqAny = req as unknown as {
      headers?: Record<string, string | string[] | undefined>;
      on?: (event: string, cb: () => void) => void;
    };
    const resAny = res as unknown as {
      writableEnded?: boolean;
      headersSent?: boolean;
    };

    const authConfig = extractAuthFromRequest(reqAny.headers);
    const resolution = await resolveAudioStreamInfo(videoId, authConfig);

    if (resolution.refreshedOAuth) {
      const proto = reqAny.headers?.['x-forwarded-proto'];
      const secure = (Array.isArray(proto) ? proto[0] : proto) === 'https';
      res.setHeader(
        'Set-Cookie',
        buildExtractorSetCookieHeader(
          { ...authConfig, oauthTokens: resolution.refreshedOAuth },
          secure
        )
      );
    }

    if (req.query.check === '1') {
      return res.status(200).json({
        available: Boolean(resolution.stream),
        status: resolution.status,
        reason: resolution.reason,
      });
    }
    let streamInfo = resolution.stream;
    if (!streamInfo) {
      return res.status(404).json({
        error: 'Audio stream tidak tersedia untuk video ini',
        status: resolution.status,
        reason: resolution.reason,
      });
    }

    const rangeHeader = reqAny.headers?.range;
    const rangeStr = rangeHeader
      ? Array.isArray(rangeHeader)
        ? rangeHeader[0]
        : rangeHeader
      : undefined;

    const fetchUpstream = async (info: NonNullable<typeof streamInfo>) => {
      const headers: Record<string, string> = {
        'User-Agent': info.userAgent,
        ...(info.extraHeaders || {}),
      };
      if (rangeStr) {
        headers['Range'] = rangeStr;
      }
      return fetch(info.url, { headers, redirect: 'follow' });
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
      return res.status(502).json({ error: `Upstream audio status ${upstream.status}` });
    }

    const resolvedMime = upstream.headers.get('content-type') || streamInfo.mimeType;
    res.status(upstream.status);
    res.setHeader('Content-Type', resolvedMime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');

    const dlFlag = Array.isArray(req.query.download) ? req.query.download[0] : req.query.download;
    if (dlFlag === '1' || dlFlag === 'true') {
      const rawTitle = Array.isArray(req.query.title) ? req.query.title[0] : req.query.title;
      const filename = buildAudioDownloadFilename(rawTitle, videoId, resolvedMime);
      res.setHeader('Content-Disposition', buildContentDispositionHeader(filename));
      res.setHeader('X-Suggested-Filename', encodeURIComponent(filename));
    }

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);

    if (req.method === 'HEAD') {
      return res.end();
    }

    if (!upstream.body) {
      return res.status(502).end();
    }

    const nodeStream = Readable.fromWeb(upstream.body as any);
    nodeStream.on('error', () => {
      if (!resAny.writableEnded) res.end();
    });
    reqAny.on?.('close', () => {
      nodeStream.destroy();
    });
    nodeStream.pipe(res as unknown as NodeJS.WritableStream);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memutar stream audio';
    const resAny = res as unknown as { headersSent?: boolean };
    if (!resAny.headersSent) {
      return res.status(500).json({ error: message });
    }
  }
}
