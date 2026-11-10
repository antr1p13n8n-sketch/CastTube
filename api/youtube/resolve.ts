import { resolveYouTubeChannel, fetchChannelRss, VercelReq, VercelRes } from '../_youtube.js';

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
    const { input } = parsedBody;
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Parameter input harus berupa URL atau handle YouTube' });
    }

    const { channelId, handle, title: resolvedTitle } = await resolveYouTubeChannel(input);
    const data = await fetchChannelRss(channelId);

    if (handle && !data.channel.handle) {
      data.channel.handle = handle;
    }
    if (resolvedTitle && (!data.channel.title || data.channel.title === 'YouTube Channel')) {
      data.channel.title = resolvedTitle;
    }

    return res.status(200).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses channel';
    return res.status(400).json({ error: message });
  }
}
