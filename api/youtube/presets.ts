import { PRESET_CHANNELS, VercelReq, VercelRes } from '../_youtube.js';

export default function handler(req: VercelReq, res: VercelRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const presets = Object.values(PRESET_CHANNELS).map((p) => ({
    channel: p.channel,
    videoCount: p.videos.length,
  }));

  return res.status(200).json({ presets });
}
