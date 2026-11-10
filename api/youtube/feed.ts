import { fetchChannelRss, VercelReq, VercelRes } from '../_youtube';

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawId = req.query.channelId;
    const channelId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!channelId) {
      return res.status(400).json({ error: 'Parameter channelId diperlukan' });
    }

    const data = await fetchChannelRss(channelId);
    return res.status(200).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mengambil feed channel';
    return res.status(500).json({ error: message });
  }
}
