import { PRESET_CHANNELS, VercelReq, VercelRes } from '../_youtube';

export default function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const presets = Object.values(PRESET_CHANNELS).map((p) => ({
    channel: p.channel,
    videoCount: p.videos.length,
  }));

  return res.status(200).json({ presets });
}
