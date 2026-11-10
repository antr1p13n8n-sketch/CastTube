export interface VercelReq {
  method?: string;
  body?: any;
  query: Record<string, string | string[] | undefined>;
}

export interface VercelRes {
  status: (code: number) => VercelRes;
  json: (data: any) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}

export interface VideoItem {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  description: string;
  views?: string;
  authorUri?: string;
}

export interface ChannelData {
  id: string;
  title: string;
  handle?: string;
  avatar?: string;
  description?: string;
  url: string;
}

export function decodeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

export function parseYouTubeRss(xmlText: string): { channel: ChannelData; videos: VideoItem[] } {
  const channelIdMatch = xmlText.match(/<yt:channelId>(.*?)<\/yt:channelId>/);
  const channelTitleMatch = xmlText.match(/<title>(.*?)<\/title>/);
  const authorNameMatch = xmlText.match(/<author>[\s\S]*?<name>(.*?)<\/name>/);
  const authorUriMatch = xmlText.match(/<author>[\s\S]*?<uri>(.*?)<\/uri>/);

  const channelId = channelIdMatch ? channelIdMatch[1].trim() : '';
  const channelTitle = authorNameMatch
    ? decodeXml(authorNameMatch[1].trim())
    : channelTitleMatch
    ? decodeXml(channelTitleMatch[1].trim())
    : 'YouTube Channel';

  const channel: ChannelData = {
    id: channelId,
    title: channelTitle,
    url: authorUriMatch ? authorUriMatch[1].trim() : `https://www.youtube.com/channel/${channelId}`,
    avatar: `https://avatar.vercel.sh/${channelId || channelTitle}?size=120`,
  };

  const videos: VideoItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xmlText)) !== null) {
    const entryXml = match[1];

    const videoIdMatch = entryXml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
    const titleMatch = entryXml.match(/<title>(.*?)<\/title>/);
    const publishedMatch = entryXml.match(/<published>(.*?)<\/published>/);
    const descMatch = entryXml.match(/<media:description>([\s\S]*?)<\/media:description>/);
    const viewsMatch = entryXml.match(/<media:statistics views="(\d+)"/);
    const mediaThumbMatch = entryXml.match(/<media:thumbnail url="(.*?)"/);

    const videoId = videoIdMatch ? videoIdMatch[1].trim() : '';
    if (!videoId) continue;

    const title = titleMatch ? decodeXml(titleMatch[1].trim()) : 'Untitled Video';
    const publishedAt = publishedMatch ? publishedMatch[1].trim() : new Date().toISOString();
    const description = descMatch ? decodeXml(descMatch[1].trim()) : '';
    const views = viewsMatch ? Number(viewsMatch[1]).toLocaleString('id-ID') : undefined;
    const thumbnail = mediaThumbMatch ? mediaThumbMatch[1] : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    videos.push({
      id: videoId,
      title,
      publishedAt,
      thumbnail,
      channelId,
      channelTitle,
      description,
      views,
    });
  }

  return { channel, videos };
}

export const PRESET_CHANNELS: Record<string, { channel: ChannelData; videos: VideoItem[] }> = {
  'UCBJycsmduP41z98B13IFzBQ': {
    channel: {
      id: 'UCBJycsmduP41z98B13IFzBQ',
      title: 'Marques Brownlee (MKBHD)',
      handle: '@mkbhd',
      avatar: 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDyj-kOTuxnRghHoDZFi5TaPh-rSYWh7IG=s176-c-k-c0x00ffffff-no-rj',
      description: 'Quality Tech Videos | YouTuber | Geek',
      url: 'https://www.youtube.com/@mkbhd',
    },
    videos: [
      {
        id: 'dQw4w9WgXcQ',
        title: 'The Real Truth About Modern Smartphone Batteries',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        channelId: 'UCBJycsmduP41z98B13IFzBQ',
        channelTitle: 'Marques Brownlee (MKBHD)',
        description: 'Deep dive into why phone batteries degrade and the actual science behind fast charging.',
        views: '1.240.000',
      },
      {
        id: 'L_LUpnjgPso',
        title: 'M4 Mac Mini Review: Apple Did The Impossible!',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        thumbnail: 'https://i.ytimg.com/vi/L_LUpnjgPso/hqdefault.jpg',
        channelId: 'UCBJycsmduP41z98B13IFzBQ',
        channelTitle: 'Marques Brownlee (MKBHD)',
        description: 'The redesigned M4 Mac mini is tiny, powerful, and remarkably cheap.',
        views: '3.890.000',
      },
    ],
  },
  'UCb229Z4w_2d3U5L9_5oWk4Q': {
    channel: {
      id: 'UCb229Z4w_2d3U5L9_5oWk4Q',
      title: 'GadgetIn',
      handle: '@GadgetIn',
      avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_k6T6L7H_bB35T7z3YvP3L_qf9f6p3j0f2Z0Y4_=s176-c-k-c0x00ffffff-no-rj',
      description: 'Channel review gadget berbahasa Indonesia terlengkap dan terpercaya.',
      url: 'https://www.youtube.com/@GadgetIn',
    },
    videos: [
      {
        id: 'fJ9rUzIMcZQ',
        title: 'Review Smartphone Flagship Terbaru Tahun Ini: Beneran Gila!',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg',
        channelId: 'UCb229Z4w_2d3U5L9_5oWk4Q',
        channelTitle: 'GadgetIn',
        description: 'Halo guys, David di sini dan kali ini kita kedatangan hp yang bikin penasaran banget.',
        views: '980.500',
      },
      {
        id: 'kJQP7kiw5Fk',
        title: 'Beli Mystery Box Elektronik 10 Juta: Dapet Apa Aja?',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
        channelId: 'UCb229Z4w_2d3U5L9_5oWk4Q',
        channelTitle: 'GadgetIn',
        description: 'Iseng beli mystery box dari e-commerce ternama seharga 10 juta rupiah.',
        views: '1.450.000',
      },
    ],
  },
  'UCx_tM26W-W13b5_yv_wA0mA': {
    channel: {
      id: 'UCx_tM26W-W13b5_yv_wA0mA',
      title: 'Deddy Corbuzier (Close The Door)',
      handle: '@corbuzier',
      avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_nFmH-Qz8c-6J9f3e4o5y8x1q2w3e4r5t6y7u8i=s176-c-k-c0x00ffffff-no-rj',
      description: 'Podcast Nomor 1 di Indonesia. Close The Door.',
      url: 'https://www.youtube.com/@corbuzier',
    },
    videos: [
      {
        id: '3JZ_D3ELwOQ',
        title: 'PODCAST: Bongkar Rahasia Sukses & Masa Depan Kecerdasan Buatan',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
        thumbnail: 'https://i.ytimg.com/vi/3JZ_D3ELwOQ/hqdefault.jpg',
        channelId: 'UCx_tM26W-W13b5_yv_wA0mA',
        channelTitle: 'Deddy Corbuzier (Close The Door)',
        description: 'Obrolan santai tapi berbobot tentang masa depan teknologi, bisnis, dan mindset.',
        views: '2.100.000',
      },
    ],
  },
  'UCsXVk37bltHxD1rDPwtNM8Q': {
    channel: {
      id: 'UCsXVk37bltHxD1rDPwtNM8Q',
      title: 'Kurzgesagt – In a Nutshell',
      handle: '@kurzgesagt',
      avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_k6Z4s3e2w1q0p9o8i7u6y5t4r3e2w1q0p9o8i7=s176-c-k-c0x00ffffff-no-rj',
      description: 'Videos explaining things with optimistic nihilism.',
      url: 'https://www.youtube.com/@kurzgesagt',
    },
    videos: [
      {
        id: 'h6fcK_fRYaI',
        title: 'What If We Detonated All Nuclear Bombs at Once?',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
        thumbnail: 'https://i.ytimg.com/vi/h6fcK_fRYaI/hqdefault.jpg',
        channelId: 'UCsXVk37bltHxD1rDPwtNM8Q',
        channelTitle: 'Kurzgesagt – In a Nutshell',
        description: 'If you gathered all ~15,000 nuclear weapons on Earth and detonated them in one spot, what happens?',
        views: '8.400.000',
      },
    ],
  },
  'UCSJ4gkVC6NrvII8umztf0Ow': {
    channel: {
      id: 'UCSJ4gkVC6NrvII8umztf0Ow',
      title: 'Lofi Girl',
      handle: '@LofiGirl',
      avatar: 'https://yt3.googleusercontent.com/u5jSuhq12XF8F98_j87s=s176-c-k-c0x00ffffff-no-rj',
      description: 'Peaceful lofi hip hop radio - beats to relax/study to.',
      url: 'https://www.youtube.com/@LofiGirl',
    },
    videos: [
      {
        id: 'jfKfPfyJRdk',
        title: 'lofi hip hop radio 📚 - beats to relax/study to',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
        channelId: 'UCSJ4gkVC6NrvII8umztf0Ow',
        channelTitle: 'Lofi Girl',
        description: '24/7 relaxing lofi beats to study, chill, focus, code or sleep.',
        views: 'Live',
      },
    ],
  },
};

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 12000
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id,en-US,en;q=0.9',
        Cookie: 'SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; CONSENT=YES+cb.20210328-17-p0.en+FX+667',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function extractChannelFromHtml(html: string): { channelId: string; title?: string; handle?: string } | null {
  const idMatch =
    html.match(/<meta itemprop="identifier" content="(UC[a-zA-Z0-9_-]{22})"/i) ||
    html.match(/<meta itemprop="channelId" content="(UC[a-zA-Z0-9_-]{22})"/i) ||
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/i) ||
    html.match(/feeds\/videos\.xml\?channel_id=(UC[a-zA-Z0-9_-]{22})/i) ||
    html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/i) ||
    html.match(/"browseId":"(UC[a-zA-Z0-9_-]{22})"/i) ||
    html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/i);

  if (!idMatch || !idMatch[1]) return null;

  const titleMatch =
    html.match(/<meta property="og:title" content="(.*?)"/i) ||
    html.match(/<title>(.*?) - YouTube<\/title>/i);

  const handleMatch = html.match(/https:\/\/www\.youtube\.com\/(@[a-zA-Z0-9_.-]+)/i);

  return {
    channelId: idMatch[1],
    title: titleMatch ? decodeXml(titleMatch[1]) : undefined,
    handle: handleMatch ? handleMatch[1] : undefined,
  };
}

export async function resolveYouTubeChannel(
  rawInput: string
): Promise<{ channelId: string; handle?: string; title?: string }> {
  const cleaned = rawInput.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!cleaned) {
    throw new Error('Input link channel kosong.');
  }

  // 1. Direct Channel ID (UC...)
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(cleaned)) {
    return { channelId: cleaned };
  }

  // 2. URL with /channel/UC...
  const channelUrlMatch = cleaned.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/i);
  if (channelUrlMatch) {
    return { channelId: channelUrlMatch[1] };
  }

  // 3. Check preset channels first for instant match
  for (const [id, data] of Object.entries(PRESET_CHANNELS)) {
    if (
      cleaned.toLowerCase().includes(id.toLowerCase()) ||
      (data.channel.handle && cleaned.toLowerCase().includes(data.channel.handle.toLowerCase()))
    ) {
      return { channelId: id, handle: data.channel.handle, title: data.channel.title };
    }
  }

  // 4. Video / Shorts / Live URL -> resolve via oEmbed or watch page
  const videoMatch = cleaned.match(
    /(?:watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i
  );
  if (videoMatch) {
    const videoId = videoMatch[1];
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const oembedRes = await fetchWithTimeout(oembedUrl, {}, 8000);
      if (oembedRes.ok) {
        const oembed = (await oembedRes.json()) as { author_url?: string; author_name?: string };
        if (oembed.author_url) {
          const resolvedFromAuthor = await resolveYouTubeChannel(oembed.author_url);
          return {
            ...resolvedFromAuthor,
            title: resolvedFromAuthor.title || oembed.author_name,
          };
        }
      }
    } catch {
      // fallback to watch HTML
    }

    try {
      const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const res = await fetchWithTimeout(videoPageUrl);
      if (res.ok) {
        const html = await res.text();
        const extracted = extractChannelFromHtml(html);
        if (extracted) return extracted;
      }
    } catch {
      // continue
    }
  }

  // 5. Handle (@username), /c/name, /user/name, or bare youtube.com/name
  let targetUrl = '';
  let handle: string | undefined;

  const handleUrlMatch = cleaned.match(/youtube\.com\/(@[^/\s?#&]+)/i);
  const customUrlMatch = cleaned.match(/youtube\.com\/(c|user)\/([^/\s?#&]+)/i);
  const bareUrlMatch = cleaned.match(/youtube\.com\/([^/\s?#&]+)/i);

  if (handleUrlMatch) {
    handle = decodeURIComponent(handleUrlMatch[1]);
    targetUrl = `https://www.youtube.com/${handle}`;
  } else if (customUrlMatch) {
    const kind = customUrlMatch[1].toLowerCase();
    const name = decodeURIComponent(customUrlMatch[2]);
    targetUrl = `https://www.youtube.com/${kind}/${name}`;
    if (kind === 'user') {
      try {
        const rssRes = await fetchWithTimeout(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(name)}`, {}, 8000);
        if (rssRes.ok) {
          const xml = await rssRes.text();
          const parsed = parseYouTubeRss(xml);
          if (parsed.channel.id) {
            return { channelId: parsed.channel.id, title: parsed.channel.title };
          }
        }
      } catch {
        // fallback to HTML fetch
      }
    }
  } else if (cleaned.startsWith('@')) {
    handle = cleaned.split(/[/?#\s]/)[0];
    targetUrl = `https://www.youtube.com/${handle}`;
  } else if (bareUrlMatch && !['watch', 'shorts', 'live', 'playlist', 'results', 'feed'].includes(bareUrlMatch[1].toLowerCase())) {
    const slug = decodeURIComponent(bareUrlMatch[1]);
    targetUrl = `https://www.youtube.com/${slug}`;
  } else if (!cleaned.includes('/') && !cleaned.includes('.')) {
    handle = `@${cleaned}`;
    targetUrl = `https://www.youtube.com/${handle}`;
  }

  if (targetUrl) {
    try {
      const res = await fetchWithTimeout(targetUrl);
      if (res.ok) {
        const html = await res.text();
        const extracted = extractChannelFromHtml(html);
        if (extracted) {
          return {
            channelId: extracted.channelId,
            handle: handle || extracted.handle,
            title: extracted.title,
          };
        }
      }
    } catch {
      // ignore and throw clear message below
    }
  }

  throw new Error(
    `Tidak dapat menemukan Channel ID untuk input: "${rawInput}". Pastikan link channel valid (contoh: https://www.youtube.com/@username atau https://www.youtube.com/channel/UC...).`
  );
}

export async function fetchChannelRss(
  channelId: string
): Promise<{ channel: ChannelData; videos: VideoItem[] }> {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  try {
    const res = await fetchWithTimeout(rssUrl, {}, 8000);
    if (res.ok) {
      const xml = await res.text();
      const parsed = parseYouTubeRss(xml);
      if (parsed.channel.id) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`Gagal fetch RSS dari YouTube untuk channelId ${channelId}:`, err);
  }

  if (PRESET_CHANNELS[channelId]) {
    return PRESET_CHANNELS[channelId];
  }

  return {
    channel: {
      id: channelId,
      title: `Channel ${channelId.slice(0, 8)}...`,
      url: `https://www.youtube.com/channel/${channelId}`,
      avatar: `https://avatar.vercel.sh/${channelId}?size=120`,
    },
    videos: [],
  };
}
