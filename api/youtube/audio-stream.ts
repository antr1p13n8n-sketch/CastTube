import { Readable } from 'stream';
import {
  resolveAudioStreamInfo,
  resolveAudioStreamUrl,
  invalidateAudioStreamCache,
  STREAM_CHUNK_BYTES,
  parseIncomingByteRange,
  parseTotalBytesFromContentRange,
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
    'Content-Disposition, Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Suggested-Filename'
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

    const rawMedia = req.query.media;
    const mediaParam = Array.isArray(rawMedia) ? rawMedia[0] : rawMedia;
    const mediaType: 'audio' | 'video' = mediaParam === 'video' ? 'video' : 'audio';

    const reqAny = req as unknown as {
      headers?: Record<string, string | string[] | undefined>;
      on?: (event: string, cb: () => void) => void;
    };
    const resAny = res as unknown as {
      writableEnded?: boolean;
      headersSent?: boolean;
    };

    const authConfig = extractAuthFromRequest(reqAny.headers);
    let resolution;
    try {
      resolution = await resolveAudioStreamInfo(videoId, authConfig, { media: mediaType });
    } catch (resolveErr: unknown) {
      if (req.query.check === '1') {
        return res.status(200).json({
          available: false,
          status: 'unavailable',
          reason: resolveErr instanceof Error ? resolveErr.message : 'Gagal memeriksa stream',
          media: mediaType,
        });
      }
      return res.status(502).json({
        error: 'Gagal menghubungi sumber audio YouTube',
        status: 'unavailable',
      });
    }

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
        media: mediaType,
      });
    }
    let streamInfo = resolution.stream;
    if (!streamInfo || !/^https?:\/\//i.test(streamInfo.url)) {
      return res.status(404).json({
        error:
          mediaType === 'video'
            ? 'Video stream tidak tersedia untuk video ini'
            : 'Audio stream tidak tersedia untuk video ini',
        status: resolution.status,
        reason: resolution.reason,
      });
    }

    const rangeHeader = reqAny.headers?.range;
    const incomingRange = rangeHeader
      ? (Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader).trim() || undefined
      : undefined;
    const rangePlan = parseIncomingByteRange(
      incomingRange,
      req.method === 'HEAD' && !incomingRange ? 2 : STREAM_CHUNK_BYTES
    );

    const controller = new AbortController();
    reqAny.on?.('close', () => controller.abort());

    const fetchChunkWithRange = async (info: NonNullable<typeof streamInfo>, rangeStr: string) => {
      const headers: Record<string, string> = {
        'User-Agent': info.userAgent,
        Range: rangeStr,
        ...(info.extraHeaders || {}),
      };
      return fetch(info.url, { headers, redirect: 'follow', signal: controller.signal });
    };

    let upstream: globalThis.Response;
    try {
      upstream = await fetchChunkWithRange(streamInfo, rangePlan.upstreamRangeHeader);
      if (upstream.status === 403 || upstream.status === 410) {
        void upstream.body?.cancel().catch(() => {});
        invalidateAudioStreamCache(videoId);
        const refreshed = await resolveAudioStreamUrl(videoId, authConfig, { media: mediaType });
        if (refreshed && /^https?:\/\//i.test(refreshed.url)) {
          streamInfo = refreshed;
          upstream = await fetchChunkWithRange(refreshed, rangePlan.upstreamRangeHeader);
        }
      }
    } catch (fetchErr: unknown) {
      if ((fetchErr as { name?: string })?.name === 'AbortError') return;
      return res.status(502).json({ error: 'Gagal menghubungi upstream audio YouTube' });
    }

    if (upstream.status === 416) {
      void upstream.body?.cancel().catch(() => {});
      const cr = upstream.headers.get('content-range');
      if (cr) res.setHeader('Content-Range', cr);
      return res.status(416).end();
    }

    if (!upstream.ok && upstream.status !== 206) {
      void upstream.body?.cancel().catch(() => {});
      return res.status(502).json({ error: `Upstream media status ${upstream.status}` });
    }

    const upstreamType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const resolvedMime =
      upstreamType.startsWith('audio/') || upstreamType.startsWith('video/')
        ? upstreamType
        : streamInfo.mimeType;

    const knownTotalBytes =
      parseTotalBytesFromContentRange(upstream.headers.get('content-range')) ??
      (streamInfo.contentLength && Number.isFinite(Number(streamInfo.contentLength))
        ? Number(streamInfo.contentLength)
        : null);

    res.setHeader('Content-Type', resolvedMime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');

    const dlFlag = Array.isArray(req.query.download) ? req.query.download[0] : req.query.download;
    if (dlFlag === '1' || dlFlag === 'true') {
      const rawTitle = Array.isArray(req.query.title) ? req.query.title[0] : req.query.title;
      const filename = buildAudioDownloadFilename(rawTitle, videoId, resolvedMime);
      res.setHeader('Content-Disposition', buildContentDispositionHeader(filename));
      res.setHeader('X-Suggested-Filename', encodeURIComponent(filename));
    }

    if (req.method === 'HEAD') {
      void upstream.body?.cancel().catch(() => {});
      if (incomingRange && knownTotalBytes !== null) {
        const effectiveEnd = Math.min(rangePlan.boundedEnd, Math.max(0, knownTotalBytes - 1));
        const partLen = Math.max(0, effectiveEnd - rangePlan.start + 1);
        res.status(206);
        res.setHeader('Content-Range', `bytes ${rangePlan.start}-${effectiveEnd}/${knownTotalBytes}`);
        res.setHeader('Content-Length', String(partLen));
      } else {
        res.status(200);
        if (knownTotalBytes !== null) {
          res.setHeader('Content-Length', String(knownTotalBytes));
        }
      }
      return res.end();
    }

    if (!upstream.body) {
      return res.status(502).json({ error: 'Stream media kosong dari upstream' });
    }

    if (incomingRange) {
      res.status(upstream.status);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);

      const nodeStream = Readable.fromWeb(upstream.body as any);
      nodeStream.on('error', () => {
        if (!resAny.writableEnded) res.end();
      });
      reqAny.on?.('close', () => {
        nodeStream.destroy();
      });
      nodeStream.pipe(res as unknown as NodeJS.WritableStream);
      return;
    }

    res.status(200);
    if (knownTotalBytes !== null) {
      res.setHeader('Content-Length', String(knownTotalBytes));
    } else {
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
    }

    async function* streamBoundedChunks() {
      const firstChunkLen = Number(upstream.headers.get('content-length') || 0);
      const firstReader = upstream.body!.getReader();
      let bytesReadFirst = 0;
      try {
        while (!controller.signal.aborted) {
          const { done, value } = await firstReader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            bytesReadFirst += value.byteLength;
            yield value;
          }
        }
      } finally {
        firstReader.releaseLock();
      }

      if (controller.signal.aborted || upstream.status !== 206 || knownTotalBytes === null) {
        return;
      }

      let offset = bytesReadFirst > 0 ? bytesReadFirst : firstChunkLen;
      while (offset < knownTotalBytes && !controller.signal.aborted) {
        const nextEnd = Math.min(offset + STREAM_CHUNK_BYTES - 1, knownTotalBytes - 1);
        const nextRange = `bytes=${offset}-${nextEnd}`;
        let nextRes = await fetchChunkWithRange(streamInfo!, nextRange);
        if (nextRes.status === 403 || nextRes.status === 410) {
          void nextRes.body?.cancel().catch(() => {});
          invalidateAudioStreamCache(videoId);
          const refreshed = await resolveAudioStreamUrl(videoId, authConfig, { media: mediaType });
          if (refreshed && /^https?:\/\//i.test(refreshed.url)) {
            streamInfo = refreshed;
            nextRes = await fetchChunkWithRange(refreshed, nextRange);
          }
        }
        if ((!nextRes.ok && nextRes.status !== 206) || !nextRes.body) {
          void nextRes.body?.cancel().catch(() => {});
          break;
        }
        const reader = nextRes.body.getReader();
        let chunkBytes = 0;
        try {
          while (!controller.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value && value.byteLength > 0) {
              chunkBytes += value.byteLength;
              yield value;
            }
          }
        } finally {
          reader.releaseLock();
        }
        if (chunkBytes <= 0) break;
        offset += chunkBytes;
      }
    }

    const stitchedStream = Readable.from(streamBoundedChunks());
    stitchedStream.on('error', () => {
      if (!resAny.writableEnded) res.end();
    });
    reqAny.on?.('close', () => {
      controller.abort();
      stitchedStream.destroy();
    });
    stitchedStream.pipe(res as unknown as NodeJS.WritableStream);
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === 'AbortError') return;
    const message = err instanceof Error ? err.message : 'Gagal memutar stream media';
    const resAny = res as unknown as { headersSent?: boolean };
    if (!resAny.headersSent) {
      return res.status(502).json({ error: message });
    }
  }
}
