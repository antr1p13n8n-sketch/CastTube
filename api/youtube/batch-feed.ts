import { fetchBatchChannelFeeds, VercelReq, VercelRes } from '../_youtube.js';

export default async function handler(req: VercelReq, res: VercelRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const parsedBody =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { channelIds } = parsedBody;
    if (!Array.isArray(channelIds)) {
      return res.status(400).json({ error: 'channelIds harus berupa array string' });
    }

    const payload = await fetchBatchChannelFeeds(channelIds, 2, 6);
    return res.status(200).json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memproses batch feeds';
    return res.status(500).json({ error: message });
  }
}
