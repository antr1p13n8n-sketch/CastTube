import { fetchChannelRss, VideoItem, ChannelData, VercelReq, VercelRes } from '../_youtube.js';

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

    const results = await Promise.allSettled(
      channelIds.slice(0, 20).map((id: string) => fetchChannelRss(id))
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

    allVideos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return res.status(200).json({
      channels,
      videos: allVideos,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memproses batch feeds';
    return res.status(500).json({ error: message });
  }
}
