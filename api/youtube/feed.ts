import {
  fetchChannelRss,
  fetchChannelVideosByCursor,
  VercelReq,
  VercelRes,
} from '../_youtube.js';

function getSingleQueryParam(val: string | string[] | undefined): string {
  return (Array.isArray(val) ? val[0] : val || '').trim();
}

export default async function handler(req: VercelReq, res: VercelRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const channelId = getSingleQueryParam(req.query.channelId);
    if (!channelId || !/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
      return res.status(400).json({ error: 'Parameter channelId YouTube tidak valid' });
    }

    const cursor = getSingleQueryParam(req.query.cursor);
    const rawPages = parseInt(getSingleQueryParam(req.query.pages), 10);
    const pages = Number.isFinite(rawPages) ? Math.min(10, Math.max(1, rawPages)) : undefined;

    if (cursor) {
      const rawStart = parseInt(getSingleQueryParam(req.query.startIndex), 10);
      const startIndex = Number.isFinite(rawStart) && rawStart >= 0 ? rawStart : 0;
      const channelTitle = getSingleQueryParam(req.query.channelTitle) || `Channel ${channelId.slice(0, 8)}`;
      const pageData = await fetchChannelVideosByCursor(
        channelId,
        channelTitle,
        cursor,
        pages ?? 6,
        startIndex
      );
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(pageData);
    }

    const forceVal = getSingleQueryParam(req.query.force);
    const forceRefresh = forceVal === '1' || forceVal === 'true';
    const includeTabsVal = getSingleQueryParam(req.query.includeAllTabs);
    const includeAllTabs = includeTabsVal === '1' || includeTabsVal === 'true';

    const data = await fetchChannelRss(channelId, pages ?? 5, forceRefresh, includeAllTabs);
    res.setHeader(
      'Cache-Control',
      forceRefresh ? 'no-store' : 'public, max-age=180, stale-while-revalidate=300'
    );
    return res.status(200).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mengambil feed channel';
    return res.status(502).json({ error: message });
  }
}
