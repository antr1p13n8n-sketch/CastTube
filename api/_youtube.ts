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

  const authorChannelMatch = authorUriMatch?.[1]?.match(/channel\/(UC[a-zA-Z0-9_-]{22})/i);
  const rawChannelId = channelIdMatch ? channelIdMatch[1].trim() : '';
  const channelId = authorChannelMatch
    ? authorChannelMatch[1]
    : rawChannelId && !rawChannelId.startsWith('UC') && rawChannelId.length === 22
    ? `UC${rawChannelId}`
    : rawChannelId;
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
  'UCBJycsmduvYEL83R_U4JriQ': {
    channel: {
      id: 'UCBJycsmduvYEL83R_U4JriQ',
      title: 'Marques Brownlee',
      handle: '@mkbhd',
      avatar: 'https://yt3.googleusercontent.com/qu4TmIaYUlS41-dJ9gZ7DUR3nilvmB5_11i6OKSdvNnBNiyOusZP1bMN6ICnuxtjFBb6ioKgRQ=s160-c-k-c0x00ffffff-no-rj',
      description: 'MKBHD: Quality Tech Videos | YouTuber | Geek | Consumer Electronics | Tech Head | Internet Personality!',
      url: 'https://www.youtube.com/@mkbhd',
    },
    videos: [
      {
        id: 'hdMszZ2ah5Q',
        title: "Macbook PROLED Review: It's Not About That",
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        thumbnail: 'https://i1.ytimg.com/vi/hdMszZ2ah5Q/hqdefault.jpg',
        channelId: 'UCBJycsmduvYEL83R_U4JriQ',
        channelTitle: 'Marques Brownlee',
        description: 'Deep dive into modern laptop display hardware and everyday creator workflows.',
        views: '5.057.265',
      },
      {
        id: '_x58r9TBois',
        title: 'Meta VR Glasses: What Vision Pro 2 COULD Have Been!',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        thumbnail: 'https://i4.ytimg.com/vi/_x58r9TBois/hqdefault.jpg',
        channelId: 'UCBJycsmduvYEL83R_U4JriQ',
        channelTitle: 'Marques Brownlee',
        description: 'Hands-on with lightweight spatial computing and smart glasses hardware.',
        views: '7.251.665',
      },
    ],
  },
  'UC1dI4tO13ApuSX0QeX8pHng': {
    channel: {
      id: 'UC1dI4tO13ApuSX0QeX8pHng',
      title: 'GadgetIn',
      handle: '@GadgetIn',
      avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_m_WWs--JDXUyiAFrM3BsWiBRvU0-gh-giMdaAHv4LCbyA=s160-c-k-c0x00ffffff-no-rj',
      description: 'Channel review gadget berbahasa Indonesia terlengkap dan terpercaya.',
      url: 'https://www.youtube.com/@GadgetIn',
    },
    videos: [
      {
        id: 'ELIwF3VFPyQ',
        title: 'Lagi lagi mendingin iPhone... Unboxing Xiaomi 18 PRO MAX!!!',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        thumbnail: 'https://i2.ytimg.com/vi/ELIwF3VFPyQ/hqdefault.jpg',
        channelId: 'UC1dI4tO13ApuSX0QeX8pHng',
        channelTitle: 'GadgetIn',
        description: 'Halo guys, David di sini dan kali ini kita unboxing dan bahas tuntas smartphone flagship terbaru.',
        views: '1.568.300',
      },
      {
        id: 'y60ZgnnzkMw',
        title: 'Nothing yg harganya something 🙂',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        thumbnail: 'https://i2.ytimg.com/vi/y60ZgnnzkMw/hqdefault.jpg',
        channelId: 'UC1dI4tO13ApuSX0QeX8pHng',
        channelTitle: 'GadgetIn',
        description: 'Review jujur desain, kamera, performa, dan value-for-money untuk pengguna harian.',
        views: '635.756',
      },
    ],
  },
  'UCYk4LJI0Pr6RBDWowMm-KUw': {
    channel: {
      id: 'UCYk4LJI0Pr6RBDWowMm-KUw',
      title: 'Deddy Corbuzier',
      handle: '@corbuzier',
      avatar: 'https://yt3.googleusercontent.com/7k4jFbchFagHe6tmcont-mHuOGQrUjnbyh482MwIEFrobjT-uGiMss4qbiTMV74vp8OE3SuY=s160-c-k-c0x00ffffff-no-rj',
      description: 'CLOSETHEDOOR PODCAST.',
      url: 'https://www.youtube.com/@corbuzier',
    },
    videos: [
      {
        id: 'i8nGN61QtYg',
        title: 'MAHFUD MD: GIBRAN HARUS MUNDUR‼️',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
        thumbnail: 'https://i2.ytimg.com/vi/i8nGN61QtYg/hqdefault.jpg',
        channelId: 'UCYk4LJI0Pr6RBDWowMm-KUw',
        channelTitle: 'Deddy Corbuzier',
        description: 'Obrolan mendalam Close The Door Podcast membahas isu terkini, hukum, dan tata negara.',
        views: '110.657',
      },
      {
        id: 'pKmc_uJ0LwI',
        title: 'WAPRES MUNDUR.. ADA YANG MENCOBA MAKAR⁉️MAHFUD MD BICARA‼️',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString(),
        thumbnail: 'https://i1.ytimg.com/vi/pKmc_uJ0LwI/hqdefault.jpg',
        channelId: 'UCYk4LJI0Pr6RBDWowMm-KUw',
        channelTitle: 'Deddy Corbuzier',
        description: 'Diskusi lengkap di Close The Door Podcast bersama Prof. Mahfud MD.',
        views: '4.095.207',
      },
    ],
  },
  'UCsXVk37bltHxD1rDPwtNM8Q': {
    channel: {
      id: 'UCsXVk37bltHxD1rDPwtNM8Q',
      title: 'Kurzgesagt – In a Nutshell',
      handle: '@kurzgesagt',
      avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_n1Ribd7LwdP_qKtqWL3ZDfIgv9M1d6g78VwpHGXVR2Ir4=s160-c-k-c0x00ffffff-no-rj',
      description: 'Videos explaining things with optimistic nihilism.',
      url: 'https://www.youtube.com/@kurzgesagt',
    },
    videos: [
      {
        id: 'Y1vEGsnNYek',
        title: 'What Is Food Fortification?',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
        thumbnail: 'https://i2.ytimg.com/vi/Y1vEGsnNYek/hqdefault.jpg',
        channelId: 'UCsXVk37bltHxD1rDPwtNM8Q',
        channelTitle: 'Kurzgesagt – In a Nutshell',
        description: 'How enriching everyday staple foods transformed global public health.',
        views: '291.446',
      },
      {
        id: 'fEjvSbI_PT4',
        title: 'Dying Is Complicated',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
        thumbnail: 'https://i3.ytimg.com/vi/fEjvSbI_PT4/hqdefault.jpg',
        channelId: 'UCsXVk37bltHxD1rDPwtNM8Q',
        channelTitle: 'Kurzgesagt – In a Nutshell',
        description: 'A scientific look at cellular biology and what happens when life fades.',
        views: '3.794.198',
      },
    ],
  },
  'UCSJ4gkVC6NrvII8umztf0Ow': {
    channel: {
      id: 'UCSJ4gkVC6NrvII8umztf0Ow',
      title: 'Lofi Girl',
      handle: '@LofiGirl',
      avatar: 'https://yt3.googleusercontent.com/REcZL_LGu0DaDaC-G7VIbN0uE_5l-i_dw6ZvOETRnY3pRhUmfkOq6C1MLephPZkV4VSzQAhEi_4=s160-c-k-c0x00ffffff-no-rj',
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
      {
        id: 'hCqTWYeahV8',
        title: '(the same people who say they failed a test but actually get a great grade.)',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        thumbnail: 'https://i1.ytimg.com/vi/hCqTWYeahV8/hqdefault.jpg',
        channelId: 'UCSJ4gkVC6NrvII8umztf0Ow',
        channelTitle: 'Lofi Girl',
        description: 'Relaxing study beats and chill vibes from Lofi Girl.',
        views: '33.817',
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

async function readChannelFromResponse(
  res: globalThis.Response
): Promise<{ channelId: string; title?: string; handle?: string } | null> {
  if (!res.body) {
    const html = await res.text();
    return extractChannelFromHtml(html);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  const maxBytes = 3_000_000;
  try {
    while (accumulated.length < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      const extracted = extractChannelFromHtml(accumulated);
      if (extracted) {
        await reader.cancel().catch(() => {});
        return extracted;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return extractChannelFromHtml(accumulated);
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
        const extracted = await readChannelFromResponse(res);
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

function relativeTimeToIso(relText: string | undefined, fallbackOffsetIndex: number): string {
  const now = Date.now();
  if (!relText) {
    return new Date(now - (fallbackOffsetIndex + 16) * 86400_000).toISOString();
  }
  const lower = relText.toLowerCase();
  const numMatch = lower.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1], 10) : 1;

  let ms = 86400_000 * (fallbackOffsetIndex + 16);
  if (lower.includes('detik') || lower.includes('second')) ms = num * 1000;
  else if (lower.includes('menit') || lower.includes('minute')) ms = num * 60_000;
  else if (lower.includes('jam') || lower.includes('hour')) ms = num * 3600_000;
  else if (lower.includes('hari') || lower.includes('day')) ms = num * 86400_000;
  else if (lower.includes('minggu') || lower.includes('week')) ms = num * 7 * 86400_000;
  else if (lower.includes('bulan') || lower.includes('month')) ms = num * 30 * 86400_000;
  else if (lower.includes('tahun') || lower.includes('year')) ms = num * 365 * 86400_000;

  return new Date(now - ms - fallbackOffsetIndex * 1000).toISOString();
}

function parseBrowseVideoItems(
  items: any[],
  channelId: string,
  channelTitle: string,
  startIndex: number
): { videos: VideoItem[]; continuationToken: string | null } {
  const videos: VideoItem[] = [];
  let continuationToken: string | null = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.continuationItemRenderer) {
      const token =
        item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (token) continuationToken = token;
      continue;
    }

    const lockup = item?.richItemRenderer?.content?.lockupViewModel;
    if (lockup && lockup.contentId) {
      const videoId = String(lockup.contentId);
      const title =
        lockup.metadata?.lockupMetadataViewModel?.title?.content || 'Untitled Video';
      const sources = lockup.contentImage?.thumbnailViewModel?.image?.sources || [];
      const thumbnail =
        sources[sources.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const rows =
        lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel
          ?.metadataRows || [];
      const parts = rows[0]?.metadataParts || [];
      const viewsText = parts[0]?.text?.content;
      const relText = parts[1]?.text?.content;

      videos.push({
        id: videoId,
        title,
        publishedAt: relativeTimeToIso(relText, startIndex + i),
        thumbnail,
        channelId,
        channelTitle,
        description: '',
        views: viewsText,
      });
      continue;
    }

    const vr = item?.richItemRenderer?.content?.videoRenderer || item?.gridVideoRenderer;
    if (vr && vr.videoId) {
      const videoId = String(vr.videoId);
      const title =
        vr.title?.runs?.[0]?.text || vr.title?.simpleText || 'Untitled Video';
      const thumbs = vr.thumbnail?.thumbnails || [];
      const thumbnail =
        thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const viewsText = vr.shortViewCountText?.simpleText || vr.viewCountText?.simpleText;
      const relText = vr.publishedTimeText?.simpleText;

      videos.push({
        id: videoId,
        title,
        publishedAt: relativeTimeToIso(relText, startIndex + i),
        thumbnail,
        channelId,
        channelTitle,
        description: '',
        views: viewsText,
      });
    }
  }

  return { videos, continuationToken };
}

async function fetchPaginatedChannelVideos(
  channelId: string,
  channelTitle: string,
  maxPages = 5
): Promise<{ videos: VideoItem[]; avatar?: string; resolvedTitle?: string }> {
  const allVideos: VideoItem[] = [];
  let avatar: string | undefined;
  let resolvedTitle: string | undefined;

  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/channel/${channelId}/videos`,
      {},
      10000
    );
    if (!res.ok) return { videos: allVideos };
    const html = await res.text();
    const match = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
    if (!match) return { videos: allVideos };

    const data = JSON.parse(match[1]);
    avatar = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.slice(-1)?.[0]?.url
      || data?.header?.c4TabbedHeaderRenderer?.avatar?.thumbnails?.slice(-1)?.[0]?.url;
    resolvedTitle =
      data?.metadata?.channelMetadataRenderer?.title ||
      data?.header?.pageHeaderRenderer?.pageTitle;

    const effectiveTitle = resolvedTitle || channelTitle;
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    const videosTab =
      tabs.find((t: any) => t.tabRenderer?.selected) ||
      tabs.find((t: any) => t.tabRenderer?.content?.richGridRenderer);
    const items = videosTab?.tabRenderer?.content?.richGridRenderer?.contents || [];

    const firstPage = parseBrowseVideoItems(items, channelId, effectiveTitle, 0);
    allVideos.push(...firstPage.videos);

    let token = firstPage.continuationToken;
    let page = 1;
    while (token && page < maxPages) {
      const apiRes = await fetchWithTimeout(
        'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: {
              client: { clientName: 'WEB', clientVersion: '2.20240501.00.00', hl: 'id' },
            },
            continuation: token,
          }),
        },
        7000
      );
      if (!apiRes.ok) break;
      const apiJson = await apiRes.json();
      const contItems =
        apiJson?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction
          ?.continuationItems || [];
      if (contItems.length === 0) break;

      const nextPage = parseBrowseVideoItems(
        contItems,
        channelId,
        effectiveTitle,
        allVideos.length
      );
      allVideos.push(...nextPage.videos);
      token = nextPage.continuationToken;
      page++;
    }
  } catch (err) {
    console.warn(`Pagination fetch skipped for ${channelId}:`, err);
  }

  return { videos: allVideos, avatar, resolvedTitle };
}

export async function fetchChannelRss(
  channelId: string
): Promise<{ channel: ChannelData; videos: VideoItem[] }> {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  const [rssResult, browseResult] = await Promise.allSettled([
    (async () => {
      const res = await fetchWithTimeout(rssUrl, {}, 8000);
      if (res.ok) {
        const xml = await res.text();
        const parsed = parseYouTubeRss(xml);
        if (parsed.channel.id) return parsed;
      }
      return null;
    })(),
    fetchPaginatedChannelVideos(channelId, `Channel ${channelId.slice(0, 8)}`, 5),
  ]);

  const rssData = rssResult.status === 'fulfilled' ? rssResult.value : null;
  const browseData =
    browseResult.status === 'fulfilled' ? browseResult.value : { videos: [] };

  if (rssData || browseData.videos.length > 0) {
    const baseChannel: ChannelData = rssData?.channel || {
      id: channelId,
      title: browseData.resolvedTitle || `Channel ${channelId.slice(0, 8)}...`,
      url: `https://www.youtube.com/channel/${channelId}`,
      avatar: browseData.avatar || `https://avatar.vercel.sh/${channelId}?size=120`,
    };
    if (browseData.avatar) baseChannel.avatar = browseData.avatar;
    if (browseData.resolvedTitle && (!baseChannel.title || baseChannel.title.startsWith('Channel '))) {
      baseChannel.title = browseData.resolvedTitle;
    }

    const mergedMap = new Map<string, VideoItem>();
    for (const v of rssData?.videos || []) {
      mergedMap.set(v.id, v);
    }
    for (const v of browseData.videos) {
      if (!mergedMap.has(v.id)) {
        mergedMap.set(v.id, { ...v, channelTitle: baseChannel.title });
      }
    }

    return {
      channel: baseChannel,
      videos: Array.from(mergedMap.values()),
    };
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

export type AudioStreamFailureReason = 'login_required' | 'live_stream' | 'unavailable';

export interface ResolvedAudioStream {
  url: string;
  mimeType: string;
  contentLength?: string;
  userAgent: string;
}

export interface AudioStreamResolution {
  stream: ResolvedAudioStream | null;
  status: 'available' | AudioStreamFailureReason;
  reason?: string;
}

const audioStreamCache = new Map<
  string,
  { resolution: AudioStreamResolution; expiresAt: number }
>();

export function invalidateAudioStreamCache(videoId: string): void {
  audioStreamCache.delete(videoId);
}

export function getAudioFileExtension(mimeType: string): string {
  const clean = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (clean.includes('webm')) return 'webm';
  if (clean.includes('ogg') || clean.includes('opus')) return 'ogg';
  if (clean.includes('mpeg') || clean.includes('mp3')) return 'mp3';
  if (clean === 'video/mp4') return 'mp4';
  return 'm4a';
}

export function buildAudioDownloadFilename(
  rawTitle: string | undefined,
  videoId: string,
  mimeType: string
): string {
  const ext = getAudioFileExtension(mimeType);
  const cleaned = (rawTitle || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  const baseName = cleaned || `casttube-${videoId}`;
  return `${baseName}.${ext}`;
}

export function buildContentDispositionHeader(filename: string): string {
  const asciiFallback =
    filename
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/["\\]/g, '')
      .replace(/\s+/g, '_')
      .trim() || 'audio.m4a';
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

const INNERTUBE_AUDIO_CLIENTS = [
  {
    userAgent:
      'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    client: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.60.19',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      osName: 'Android',
      osVersion: '12L',
      androidSdkVersion: 32,
    },
  },
  {
    userAgent: 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)',
    client: {
      clientName: 'IOS',
      clientVersion: '19.45.4',
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      osName: 'iPhone',
      osVersion: '18.1.0.22B83',
    },
  },
  {
    userAgent:
      'com.google.android.apps.youtube.music/7.29.52 (Linux; U; Android 14; en_US; Pixel 8) gzip',
    client: {
      clientName: 'ANDROID_MUSIC',
      clientVersion: '7.29.52',
      deviceMake: 'Google',
      deviceModel: 'Pixel 8',
      osName: 'Android',
      osVersion: '14',
      androidSdkVersion: 34,
    },
  },
];

async function tryExternalExtractor(videoId: string): Promise<ResolvedAudioStream | null> {
  const pipedBase = process.env.PIPED_API_URL?.trim().replace(/\/+$/, '');
  if (pipedBase) {
    try {
      const res = await fetchWithTimeout(`${pipedBase}/streams/${encodeURIComponent(videoId)}`, {}, 6000);
      if (res.ok) {
        const data = await res.json();
        const streams: any[] = Array.isArray(data?.audioStreams) ? data.audioStreams : [];
        const selected =
          streams.find((s) => typeof s?.url === 'string' && String(s.mimeType || '').includes('audio/mp4')) ||
          streams.find((s) => typeof s?.url === 'string' && String(s.mimeType || '').startsWith('audio/'));
        if (selected?.url) {
          return {
            url: String(selected.url),
            mimeType: String(selected.mimeType || 'audio/mp4').split(';')[0].trim(),
            contentLength: selected.contentLength ? String(selected.contentLength) : undefined,
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          };
        }
      }
    } catch {
      // continue
    }
  }

  const invidiousBase = process.env.INVIDIOUS_API_URL?.trim().replace(/\/+$/, '');
  if (invidiousBase) {
    try {
      const res = await fetchWithTimeout(
        `${invidiousBase}/api/v1/videos/${encodeURIComponent(videoId)}`,
        {},
        6000
      );
      if (res.ok) {
        const data = await res.json();
        const adaptive: any[] = Array.isArray(data?.adaptiveFormats) ? data.adaptiveFormats : [];
        const selected =
          adaptive.find((f) => typeof f?.url === 'string' && String(f.type || '').includes('audio/mp4')) ||
          adaptive.find((f) => typeof f?.url === 'string' && String(f.type || '').startsWith('audio/'));
        if (selected?.url) {
          return {
            url: String(selected.url),
            mimeType: String(selected.type || 'audio/mp4').split(';')[0].trim(),
            contentLength: selected.clen ? String(selected.clen) : undefined,
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          };
        }
      }
    } catch {
      // continue
    }
  }

  return null;
}

export async function resolveAudioStreamInfo(videoId: string): Promise<AudioStreamResolution> {
  if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
    return { stream: null, status: 'unavailable', reason: 'Video ID tidak valid' };
  }

  const cached = audioStreamCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.resolution;
  }

  const customCookies = process.env.YOUTUBE_COOKIES?.trim();
  let detectedStatus: AudioStreamFailureReason = 'unavailable';
  let detectedReason: string | undefined;

  for (const cfg of INNERTUBE_AUDIO_CLIENTS) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': cfg.userAgent,
      };
      if (customCookies) {
        headers['Cookie'] = customCookies;
      }

      const res = await fetchWithTimeout(
        'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            videoId,
            context: {
              client: cfg.client,
            },
            contentCheckOk: true,
            racyCheckOk: true,
          }),
        },
        7000
      );

      if (!res.ok) continue;
      const data = await res.json();
      const playStatus = data?.playabilityStatus?.status;
      const playReason = typeof data?.playabilityStatus?.reason === 'string' ? data.playabilityStatus.reason : undefined;

      if (playStatus !== 'OK') {
        if (playStatus === 'LOGIN_REQUIRED') {
          detectedStatus = 'login_required';
          detectedReason = playReason;
        } else if (
          data?.videoDetails?.isLiveContent ||
          (playReason && playReason.toLowerCase().includes('live stream'))
        ) {
          detectedStatus = 'live_stream';
          detectedReason = playReason;
        } else if (!detectedReason && playReason) {
          detectedReason = playReason;
        }
        continue;
      }

      const adaptiveFormats: any[] = data?.streamingData?.adaptiveFormats || [];
      const audioFormats = adaptiveFormats.filter(
        (f) => typeof f.mimeType === 'string' && f.mimeType.startsWith('audio/') && typeof f.url === 'string'
      );

      // Prefer audio/mp4 (AAC itag 140/139) for universal iOS Safari + Android Chrome compatibility
      let selected =
        audioFormats.find((f) => f.itag === 140) ||
        audioFormats.find((f) => f.itag === 139) ||
        audioFormats.find((f) => f.mimeType.startsWith('audio/mp4')) ||
        audioFormats.find((f) => f.itag === 251) ||
        audioFormats[0];

      // Fallback to progressive muxed MP4 stream (itag 18) if no standalone audio format exposes a direct URL
      if (!selected) {
        const muxedFormats: any[] = data?.streamingData?.formats || [];
        selected =
          muxedFormats.find((f) => f.itag === 18 && typeof f.url === 'string') ||
          muxedFormats.find((f) => typeof f.mimeType === 'string' && f.mimeType.startsWith('video/mp4') && typeof f.url === 'string');
      }

      if (!selected) {
        if (data?.videoDetails?.isLiveContent || data?.streamingData?.hlsManifestUrl) {
          detectedStatus = 'live_stream';
          detectedReason = 'Siaran Live memakai streaming HLS/IFrame';
        }
        continue;
      }

      const mimeType = String(selected.mimeType).split(';')[0].trim() || 'audio/mp4';
      const stream: ResolvedAudioStream = {
        url: selected.url as string,
        mimeType,
        contentLength: selected.contentLength ? String(selected.contentLength) : undefined,
        userAgent: cfg.userAgent,
      };

      const resolution: AudioStreamResolution = { stream, status: 'available' };
      audioStreamCache.set(videoId, {
        resolution,
        expiresAt: Date.now() + 30 * 60 * 1000,
      });
      return resolution;
    } catch {
      // try next client
    }
  }

  const external = await tryExternalExtractor(videoId);
  if (external) {
    const resolution: AudioStreamResolution = { stream: external, status: 'available' };
    audioStreamCache.set(videoId, {
      resolution,
      expiresAt: Date.now() + 25 * 60 * 1000,
    });
    return resolution;
  }

  const negativeResolution: AudioStreamResolution = {
    stream: null,
    status: detectedStatus,
    reason: detectedReason,
  };
  audioStreamCache.set(videoId, {
    resolution: negativeResolution,
    expiresAt: Date.now() + 3 * 60 * 1000,
  });
  return negativeResolution;
}

export async function resolveAudioStreamUrl(
  videoId: string
): Promise<ResolvedAudioStream | null> {
  const result = await resolveAudioStreamInfo(videoId);
  return result.stream;
}

export interface ChannelSearchResult {
  id: string;
  title: string;
  handle?: string;
  avatar: string;
  subscriberCount?: string;
  description?: string;
  url: string;
}

export async function searchYouTubeChannels(queryText: string): Promise<ChannelSearchResult[]> {
  const cleaned = queryText.trim();
  if (!cleaned) return [];

  const res = await fetchWithTimeout(
    'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'id,en-US,en;q=0.9',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240501.00.00',
            hl: 'id',
            gl: 'ID',
          },
        },
        query: cleaned,
        params: 'EgIQAg==', // Filter strictly to Channels
      }),
    },
    10000
  );

  if (!res.ok) {
    throw new Error(`YouTube search merespons status ${res.status}`);
  }

  const data = await res.json();
  const sections =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
      ?.contents || [];

  const results: ChannelSearchResult[] = [];
  const seenIds = new Set<string>();

  for (const section of sections) {
    const items = section?.itemSectionRenderer?.contents || [];
    for (const item of items) {
      const cr = item?.channelRenderer;
      if (!cr || !cr.channelId || seenIds.has(cr.channelId)) continue;
      seenIds.add(cr.channelId);

      const channelId = String(cr.channelId);
      const title =
        cr.title?.simpleText ||
        cr.title?.runs?.map((r: any) => r.text).join('') ||
        'YouTube Channel';

      const subText: string | undefined =
        cr.subscriberCountText?.simpleText ||
        cr.subscriberCountText?.runs?.map((r: any) => r.text).join('');
      const vidText: string | undefined =
        cr.videoCountText?.simpleText ||
        cr.videoCountText?.runs?.map((r: any) => r.text).join('');
      const canonicalBaseUrl: string | undefined =
        cr.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl;

      let handle: string | undefined;
      let subscriberCount: string | undefined;

      if (subText && subText.trim().startsWith('@')) {
        handle = subText.trim();
        subscriberCount = vidText?.trim();
      } else {
        subscriberCount = subText?.trim() || vidText?.trim();
        if (canonicalBaseUrl && canonicalBaseUrl.startsWith('/@')) {
          handle = canonicalBaseUrl.slice(1);
        }
      }

      const rawThumb = cr.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || '';
      const avatar = rawThumb
        ? rawThumb.startsWith('//')
          ? `https:${rawThumb}`
          : rawThumb
        : `https://avatar.vercel.sh/${channelId}?size=120`;

      const description = cr.descriptionSnippet?.runs
        ? cr.descriptionSnippet.runs.map((r: any) => r.text).join('').trim()
        : undefined;

      const url = canonicalBaseUrl
        ? `https://www.youtube.com${canonicalBaseUrl}`
        : `https://www.youtube.com/channel/${channelId}`;

      results.push({
        id: channelId,
        title,
        handle,
        avatar,
        subscriberCount,
        description,
        url,
      });

      if (results.length >= 20) break;
    }
    if (results.length >= 20) break;
  }

  return results;
}

