import { Readable } from 'stream';
import { resolveAudioStreamUrl, VercelReq, VercelRes } from '../_youtube.js';

export default async function handler(req: VercelReq, res: VercelRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawId = req.query.videoId;
    const videoId = (Array.isArray(rawId) ? rawId[0] : rawId || '').trim();
    if (!videoId) {
      return res.status(400).json({ error: 'Parameter videoId diperlukan' });
    }

    const streamInfo = await resolveAudioStreamUrl(videoId);
    if (req.query.check === '1') {
      return res.status(200).json({ available: Boolean(streamInfo) });
    }
    if (!streamInfo) {
      return res.status(404).json({ error: 'Audio stream tidak tersedia untuk video ini' });
    }

    const reqAny = req as unknown as {
      headers?: Record<string, string | string[] | undefined>;
      on?: (event: string, cb: () => void) => void;
    };
    const resAny = res as unknown as {
      writableEnded?: boolean;
      headersSent?: boolean;
    };

    const headers: Record<string, string> = {
      'User-Agent':
        'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    };
    const rangeHeader = reqAny.headers?.range;
    if (rangeHeader) {
      headers['Range'] = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader;
    }

    const upstream = await fetch(streamInfo.url, { headers });
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(502).json({ error: `Upstream audio status ${upstream.status}` });
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || streamInfo.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);

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
