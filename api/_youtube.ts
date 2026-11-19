import dns from 'node:dns';
import type { WebPoMinter } from 'bgutils-js/webpo';
import type { Innertube } from 'youtubei.js';

interface OAuth2ClientID {
  client_id: string;
  client_secret: string;
}

interface OAuth2Tokens {
  access_token: string;
  expiry_date: string;
  expires_in?: number;
  refresh_token: string;
  scope?: string;
  token_type?: string;
  client?: OAuth2ClientID;
}

interface DeviceAndUserCode {
  device_code: string;
  expires_in: number;
  interval: number;
  user_code: string;
  verification_url: string;
  error_code?: string;
}

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore in non-Node runtimes
}

export interface VercelReq {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
}

export interface VercelRes {
  status: (code: number) => VercelRes;
  json: (data: any) => void;
  setHeader: (name: string, value: string | string[]) => void;
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
  duration?: string;
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

export function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
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
    html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/i) ||
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/i) ||
    html.match(/feeds\/videos\.xml\?channel_id=(UC[a-zA-Z0-9_-]{22})/i) ||
    html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/i) ||
    html.match(/"externalChannelId":"(UC[a-zA-Z0-9_-]{22})"/i) ||
    html.match(/"ownerProfileUrl":"https?:\/\/www\.youtube\.com\/(?:@[^"]+|channel\/(UC[a-zA-Z0-9_-]{22}))"/i) ||
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

function unwrapYouTubeInputUrl(raw: string): string {
  const stripped = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const urlMatch = stripped.match(/https?:\/\/[^\s]+/i);
  const candidate = urlMatch
    ? urlMatch[0].replace(/[),.;!?'"\]]+$/g, '')
    : stripped;

  try {
    const u = new URL(candidate.startsWith('http') ? candidate : `https://${candidate}`);
    if (u.hostname.includes('google.') && (u.searchParams.get('q') || u.searchParams.get('url'))) {
      return u.searchParams.get('q') || u.searchParams.get('url') || stripped;
    }
    if (u.hostname.includes('youtube.com') && u.pathname === '/attribution_link' && u.searchParams.get('u')) {
      const inner = u.searchParams.get('u') || '';
      return inner.startsWith('http') ? inner : `https://www.youtube.com${inner.startsWith('/') ? '' : '/'}${inner}`;
    }
  } catch {
    // not a valid full URL, return original stripped input
  }
  return stripped;
}

export async function resolveYouTubeChannel(
  rawInput: string,
  depth = 0
): Promise<{ channelId: string; handle?: string; title?: string }> {
  if (depth > 2) {
    throw new Error('Channel YouTube tidak dapat diselesaikan.');
  }
  const cleaned = unwrapYouTubeInputUrl(rawInput);
  if (!cleaned) {
    throw new Error('Input link channel kosong.');
  }

  // 1. Direct Channel ID (UC...)
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(cleaned)) {
    return { channelId: cleaned };
  }

  // 2. URL with /channel/UC... or /feeds/videos.xml?channel_id=UC...
  const channelUrlMatch =
    cleaned.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/i) ||
    cleaned.match(/[?&]channel_id=(UC[a-zA-Z0-9_-]{22})/i);
  if (channelUrlMatch) {
    return { channelId: channelUrlMatch[1] };
  }

  // 3. Check preset channels first for instant match
  const lowerCleaned = cleaned.toLowerCase();
  for (const [id, data] of Object.entries(PRESET_CHANNELS)) {
    const idLower = id.toLowerCase();
    const handleLower = data.channel.handle?.toLowerCase();
    const escapedHandle = handleLower
      ? handleLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : '';
    const matchesHandle = Boolean(
      handleLower &&
        (lowerCleaned === handleLower ||
          new RegExp(`(?:^|/)${escapedHandle}(?:[/?#\\s]|$)`, 'i').test(cleaned))
    );
    if (
      lowerCleaned === idLower ||
      lowerCleaned.includes(`/channel/${idLower}`) ||
      matchesHandle
    ) {
      return { channelId: id, handle: data.channel.handle, title: data.channel.title };
    }
  }

  // 4. Video / Shorts / Live / Embed URL -> resolve via oEmbed, watch HTML, or InnerTube player
  const videoMatch = cleaned.match(
    /(?:[?&]v=|youtu\.be\/|youtube\.com\/(?:shorts|live|embed|v)\/)([a-zA-Z0-9_-]{11})/i
  );
  if (videoMatch) {
    const videoId = videoMatch[1];
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const oembedRes = await fetchWithTimeout(oembedUrl, {}, 6500);
      if (oembedRes.ok) {
        const oembed = (await oembedRes.json()) as { author_url?: string; author_name?: string };
        if (oembed.author_url) {
          const resolvedFromAuthor = await resolveYouTubeChannel(oembed.author_url, depth + 1);
          return {
            ...resolvedFromAuthor,
            title: resolvedFromAuthor.title || oembed.author_name,
          };
        }
      }
    } catch {
      // fallback to watch HTML / InnerTube
    }

    const [htmlOutcome, playerOutcome] = await Promise.allSettled([
      (async () => {
        const res = await fetchWithTimeout(`https://www.youtube.com/watch?v=${videoId}`, {}, 7500);
        if (!res.ok) return null;
        const html = await res.text();
        return extractChannelFromHtml(html);
      })(),
      (async () => {
        const res = await fetchWithTimeout(
          'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoId,
              context: {
                client: { clientName: 'ANDROID_VR', clientVersion: '1.60.19', hl: 'id', gl: 'ID' },
              },
            }),
          },
          6000
        );
        if (!res.ok) return null;
        const data = await safeResponseJson<any>(res);
        const cid = String(data?.videoDetails?.channelId || '').trim();
        if (!/^UC[a-zA-Z0-9_-]{22}$/.test(cid)) return null;
        return {
          channelId: cid,
          title: typeof data?.videoDetails?.author === 'string' ? data.videoDetails.author : undefined,
        };
      })(),
    ]);

    if (htmlOutcome.status === 'fulfilled' && htmlOutcome.value) {
      return htmlOutcome.value;
    }
    if (playerOutcome.status === 'fulfilled' && playerOutcome.value) {
      return playerOutcome.value;
    }
  }

  // 4b. Playlist URL -> resolve uploads playlist (UU...) or extract channel from playlist feed/HTML
  const playlistMatch = cleaned.match(/[?&]list=([a-zA-Z0-9_-]{10,})/i);
  if (playlistMatch) {
    const listId = playlistMatch[1];
    if (/^UU[a-zA-Z0-9_-]{22}$/.test(listId)) {
      return { channelId: `UC${listId.slice(2)}` };
    }
    try {
      const rssRes = await fetchWithTimeout(
        `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(listId)}`,
        {},
        6500
      );
      if (rssRes.ok) {
        const xml = await rssRes.text();
        const authorUriMatch = xml.match(/<author>[\s\S]*?<uri>https?:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})<\/uri>/i);
        const authorNameMatch = xml.match(/<author>[\s\S]*?<name>(.*?)<\/name>/i);
        if (authorUriMatch?.[1]) {
          return {
            channelId: authorUriMatch[1],
            title: authorNameMatch?.[1] ? decodeXml(authorNameMatch[1].trim()) : undefined,
          };
        }
      }
    } catch {
      // continue to playlist HTML
    }
    try {
      const plRes = await fetchWithTimeout(`https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`, {}, 7500);
      if (plRes.ok) {
        const extracted = await readChannelFromResponse(plRes);
        if (extracted) return extracted;
      }
    } catch {
      // ignore
    }
  }

  // 5. Handle (@username), /c/name, /user/name, or bare youtube.com/name
  let targetUrl = '';
  let handle: string | undefined;
  let fallbackSearchHint: string | undefined;

  const decodedForHandle = cleaned.replace(/%40/gi, '@');
  const handleUrlMatch = decodedForHandle.match(/youtube\.com\/(@[^/\s?#&]+)/i);
  const customUrlMatch = cleaned.match(/youtube\.com\/(c|user)\/([^/\s?#&]+)/i);
  const bareUrlMatch = cleaned.match(/youtube\.com\/([^/\s?#&]+)/i);

  if (handleUrlMatch) {
    handle = safeDecodeURIComponent(handleUrlMatch[1]);
    targetUrl = `https://www.youtube.com/${encodeURI(handle)}`;
    fallbackSearchHint = handle;
  } else if (customUrlMatch) {
    const kind = customUrlMatch[1].toLowerCase();
    const name = safeDecodeURIComponent(customUrlMatch[2]);
    targetUrl = `https://www.youtube.com/${kind}/${encodeURIComponent(name)}`;
    fallbackSearchHint = name;
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
  } else if (decodedForHandle.startsWith('@')) {
    handle = decodedForHandle.split(/[/?#\s]/)[0];
    targetUrl = `https://www.youtube.com/${encodeURI(handle)}`;
    fallbackSearchHint = handle;
  } else if (
    bareUrlMatch &&
    !['watch', 'shorts', 'live', 'playlist', 'results', 'feed', 'feeds', 'attribution_link', 'clip'].includes(
      bareUrlMatch[1].toLowerCase()
    )
  ) {
    const slug = safeDecodeURIComponent(bareUrlMatch[1]);
    targetUrl = `https://www.youtube.com/${encodeURIComponent(slug)}`;
    fallbackSearchHint = slug;
  } else if (!cleaned.includes('/') && !cleaned.includes('.')) {
    handle = `@${cleaned}`;
    targetUrl = `https://www.youtube.com/${encodeURI(handle)}`;
    fallbackSearchHint = cleaned;
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
      // fall through to InnerTube fallback
    }
  }

  // Fallback: try fast InnerTube channel search for plain names, handles, or custom slugs
  const innerTubeQuery = fallbackSearchHint?.trim() || (!cleaned.includes('/') && !cleaned.includes('.') ? cleaned : '');
  if (depth === 0 && innerTubeQuery) {
    try {
      const searched = await searchChannelsViaInnerTubeHttp(innerTubeQuery, true, 4000);
      if (searched.ok && searched.results.length > 0) {
        const normalizedTarget = innerTubeQuery.toLowerCase();
        const exactMatch = searched.results.find(
          (r) =>
            r.handle?.toLowerCase() === normalizedTarget ||
            r.handle?.toLowerCase() === `@${normalizedTarget.replace(/^@/, '')}` ||
            r.title.toLowerCase() === normalizedTarget.replace(/^@/, '')
        );
        const top = exactMatch || (handle ? undefined : searched.results[0]);
        if (top) {
          return {
            channelId: top.id,
            handle: top.handle || handle,
            title: top.title,
          };
        }
      }
    } catch {
      // fall through to clear error message
    }
  }

  throw new Error(
    `Tidak dapat menemukan Channel ID untuk input: "${rawInput}". Pastikan link video, channel, atau @handle YouTube valid.`
  );
}

function relativeTimeToIso(relText: string | undefined, fallbackOffsetIndex: number): string {
  const now = Date.now();
  if (!relText) {
    return new Date(now - (fallbackOffsetIndex + 16) * 86400_000).toISOString();
  }
  const lower = relText.toLowerCase().trim();
  if (
    lower.includes('baru saja') ||
    lower.includes('just now') ||
    lower.includes('moments ago') ||
    lower === 'live' ||
    lower.includes('live now') ||
    lower.includes('sedang berlangsung')
  ) {
    return new Date(now - fallbackOffsetIndex * 1000).toISOString();
  }
  const numMatch = lower.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1], 10) : 1;

  let ms = 86400_000 * (fallbackOffsetIndex + 16);
  if (lower.includes('detik') || lower.includes('dtk') || lower.includes('second') || /\bsec\b/.test(lower)) ms = num * 1000;
  else if (lower.includes('menit') || lower.includes('mnt') || lower.includes('minute') || /\bmin\b/.test(lower)) ms = num * 60_000;
  else if (lower.includes('jam') || lower.includes('hour') || /\bhr\b/.test(lower)) ms = num * 3600_000;
  else if (lower.includes('hari') || lower.includes('day')) ms = num * 86400_000;
  else if (lower.includes('minggu') || lower.includes('mgg') || lower.includes('week')) ms = num * 7 * 86400_000;
  else if (lower.includes('bulan') || lower.includes('bln') || lower.includes('month')) ms = num * 30 * 86400_000;
  else if (lower.includes('tahun') || lower.includes('thn') || lower.includes('year')) ms = num * 365 * 86400_000;

  return new Date(now - ms - fallbackOffsetIndex * 1000).toISOString();
}

function normalizeVideoDuration(raw?: string): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // YouTube sometimes formats duration with dots in Indonesian locale (e.g. "54.09" or "1.46.33")
  if (/^\d+(?:\.\d{2}){1,2}$/.test(trimmed)) {
    return trimmed.replace(/\./g, ':');
  }
  return trimmed;
}

function extractLockupDuration(lockup: any): string | undefined {
  const overlays = lockup?.contentImage?.thumbnailViewModel?.overlays;
  if (!Array.isArray(overlays)) return undefined;
  for (const overlay of overlays) {
    const badges = overlay?.thumbnailBottomOverlayViewModel?.badges;
    if (!Array.isArray(badges)) continue;
    for (const badge of badges) {
      const text = badge?.thumbnailBadgeViewModel?.text;
      const normalized = normalizeVideoDuration(text);
      if (normalized) return normalized;
    }
  }
  return undefined;
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

    const lockup = item?.richItemRenderer?.content?.lockupViewModel || item?.lockupViewModel;
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
      const duration = extractLockupDuration(lockup);

      videos.push({
        id: videoId,
        title,
        publishedAt: relativeTimeToIso(relText, startIndex + i),
        thumbnail,
        channelId,
        channelTitle,
        description: '',
        views: viewsText,
        ...(duration ? { duration } : {}),
      });
      continue;
    }

    const shorts = item?.richItemRenderer?.content?.shortsLockupViewModel || item?.shortsLockupViewModel;
    if (shorts) {
      const rawEntityId = typeof shorts.entityId === 'string' ? shorts.entityId : '';
      const videoId =
        shorts.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ||
        rawEntityId.replace(/^shorts-shelf-item-/, '');
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        const title =
          shorts.overlayMetadata?.primaryText?.content ||
          shorts.accessibilityText ||
          'YouTube Shorts';
        const viewsText = shorts.overlayMetadata?.secondaryText?.content;
        const thumbSources =
          shorts.thumbnailViewModel?.thumbnailViewModel?.image?.sources ||
          shorts.thumbnail?.sources ||
          [];
        const thumbnail =
          thumbSources[thumbSources.length - 1]?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        videos.push({
          id: videoId,
          title,
          publishedAt: relativeTimeToIso(undefined, startIndex + i + 30),
          thumbnail,
          channelId,
          channelTitle,
          description: '',
          views: viewsText,
          duration: 'Shorts',
        });
        continue;
      }
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
      const rawLength =
        vr.lengthText?.simpleText ||
        (Array.isArray(vr.thumbnailOverlays)
          ? vr.thumbnailOverlays.find((o: any) => o?.thumbnailOverlayTimeStatusRenderer)
              ?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText
          : undefined);
      const duration = normalizeVideoDuration(rawLength);

      videos.push({
        id: videoId,
        title,
        publishedAt: relativeTimeToIso(relText, startIndex + i),
        thumbnail,
        channelId,
        channelTitle,
        description: '',
        views: viewsText,
        ...(duration ? { duration } : {}),
      });
    }
  }

  return { videos, continuationToken };
}

function extractContinuationItemsFromBrowseJson(apiJson: any): any[] {
  const actions = Array.isArray(apiJson?.onResponseReceivedActions)
    ? apiJson.onResponseReceivedActions
    : [];
  for (const action of actions) {
    const items =
      action?.appendContinuationItemsAction?.continuationItems ||
      action?.reloadContinuationItemsCommand?.continuationItems;
    if (Array.isArray(items) && items.length > 0) {
      return items;
    }
  }
  return [];
}

export async function fetchChannelVideosByCursor(
  channelId: string,
  channelTitle: string,
  cursor: string,
  maxPages = 6,
  startIndex = 0
): Promise<{ videos: VideoItem[]; nextCursor: string | null; hasMore: boolean }> {
  const safeMaxPages = Math.min(10, Math.max(1, Math.floor(maxPages)));
  const allVideos: VideoItem[] = [];
  const seenIds = new Set<string>();
  let token: string | null = cursor?.trim() || null;
  let page = 0;

  while (token && page < safeMaxPages) {
    const apiRes = await fetchWithTimeout(
      'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: { clientName: 'WEB', clientVersion: '2.20250201.00.00', hl: 'id' },
          },
          continuation: token,
        }),
      },
      8000
    );
    if (!apiRes.ok) {
      if (page === 0) {
        throw new Error(`YouTube browse cursor returned HTTP ${apiRes.status}`);
      }
      break;
    }

    const apiJson = await apiRes.json();
    const contItems = extractContinuationItemsFromBrowseJson(apiJson);
    if (contItems.length === 0) {
      token = null;
      break;
    }

    const nextPage = parseBrowseVideoItems(
      contItems,
      channelId,
      channelTitle,
      Math.max(0, startIndex) + allVideos.length
    );

    for (const v of nextPage.videos) {
      if (!seenIds.has(v.id)) {
        seenIds.add(v.id);
        allVideos.push(v);
      }
    }

    token = nextPage.continuationToken;
    page++;
  }

  return {
    videos: allVideos,
    nextCursor: token,
    hasMore: Boolean(token),
  };
}

async function fetchChannelTabFirstPage(
  channelId: string,
  tab: 'streams' | 'shorts',
  channelTitle: string,
  startIndexOffset = 0
): Promise<VideoItem[]> {
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/channel/${channelId}/${tab}`,
      {},
      9000
    );
    if (!res.ok) return [];
    const html = await res.text();
    const marker = 'var ytInitialData = ';
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) return [];
    const jsonStart = startIdx + marker.length;
    const endIdx = html.indexOf(';</script>', jsonStart);
    if (endIdx === -1) return [];

    const data = JSON.parse(html.slice(jsonStart, endIdx));
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    const selectedTab = tabs.find((t: any) => t.tabRenderer?.selected);
    const items = selectedTab?.tabRenderer?.content?.richGridRenderer?.contents || [];
    if (!Array.isArray(items) || items.length === 0) return [];

    const parsed = parseBrowseVideoItems(items, channelId, channelTitle, startIndexOffset);
    return parsed.videos;
  } catch {
    return [];
  }
}

async function fetchPaginatedChannelVideos(
  channelId: string,
  channelTitle: string,
  maxPages = 5
): Promise<{
  videos: VideoItem[];
  avatar?: string;
  resolvedTitle?: string;
  nextCursor: string | null;
}> {
  const allVideos: VideoItem[] = [];
  const seenIds = new Set<string>();
  let avatar: string | undefined;
  let resolvedTitle: string | undefined;
  let token: string | null = null;

  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/channel/${channelId}/videos`,
      {},
      10000
    );
    if (!res.ok) return { videos: allVideos, nextCursor: null };
    const html = await res.text();
    const marker = 'var ytInitialData = ';
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) return { videos: allVideos, nextCursor: null };
    const jsonStart = startIdx + marker.length;
    const endIdx = html.indexOf(';</script>', jsonStart);
    if (endIdx === -1) return { videos: allVideos, nextCursor: null };

    const data = JSON.parse(html.slice(jsonStart, endIdx));
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
    for (const v of firstPage.videos) {
      if (!seenIds.has(v.id)) {
        seenIds.add(v.id);
        allVideos.push(v);
      }
    }

    token = firstPage.continuationToken;
    let page = 1;
    while (token && page < maxPages) {
      const apiRes = await fetchWithTimeout(
        'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: {
              client: { clientName: 'WEB', clientVersion: '2.20250201.00.00', hl: 'id' },
            },
            continuation: token,
          }),
        },
        8000
      );
      if (!apiRes.ok) break;
      const apiJson = await apiRes.json();
      const contItems = extractContinuationItemsFromBrowseJson(apiJson);
      if (contItems.length === 0) {
        token = null;
        break;
      }

      const nextPage = parseBrowseVideoItems(
        contItems,
        channelId,
        effectiveTitle,
        allVideos.length
      );
      for (const v of nextPage.videos) {
        if (!seenIds.has(v.id)) {
          seenIds.add(v.id);
          allVideos.push(v);
        }
      }
      token = nextPage.continuationToken;
      page++;
    }
  } catch (err) {
    console.warn(`Pagination fetch skipped for ${channelId}:`, err);
  }

  return { videos: allVideos, avatar, resolvedTitle, nextCursor: token };
}

function pruneCacheMap<K, V extends { expiresAt: number }>(
  map: Map<K, V>,
  maxSize = 200
): void {
  const now = Date.now();
  for (const [k, v] of map) {
    if (v.expiresAt <= now) {
      map.delete(k);
    }
  }
  while (map.size > maxSize) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
  }
}

export interface ChannelFeedResult {
  channel: ChannelData;
  videos: VideoItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

const channelFeedCache = new Map<
  string,
  { data: ChannelFeedResult; expiresAt: number }
>();
const pendingFeedRequests = new Map<
  string,
  Promise<ChannelFeedResult>
>();

export async function fetchChannelRss(
  channelId: string,
  maxPages = 3,
  forceRefresh = false,
  includeAllTabs = false
): Promise<ChannelFeedResult> {
  const cacheKey = `${channelId}:${maxPages}:${includeAllTabs ? 'all' : 'videos'}`;
  if (!forceRefresh) {
    const cached = channelFeedCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const inFlight = pendingFeedRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const promise = (async (): Promise<ChannelFeedResult> => {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const placeholderTitle = `Channel ${channelId.slice(0, 8)}`;

    const [rssResult, browseResult, streamsResult, shortsResult] = await Promise.allSettled([
      (async () => {
        const res = await fetchWithTimeout(rssUrl, {}, 7000);
        if (res.ok) {
          const xml = await res.text();
          const parsed = parseYouTubeRss(xml);
          if (parsed.channel.id) return parsed;
        }
        return null;
      })(),
      fetchPaginatedChannelVideos(channelId, placeholderTitle, maxPages),
      includeAllTabs
        ? fetchChannelTabFirstPage(channelId, 'streams', placeholderTitle, 10)
        : Promise.resolve([] as VideoItem[]),
      includeAllTabs
        ? fetchChannelTabFirstPage(channelId, 'shorts', placeholderTitle, 25)
        : Promise.resolve([] as VideoItem[]),
    ]);

    const rssData = rssResult.status === 'fulfilled' ? rssResult.value : null;
    const browseData =
      browseResult.status === 'fulfilled'
        ? browseResult.value
        : { videos: [], nextCursor: null };
    const streamsVideos = streamsResult.status === 'fulfilled' ? streamsResult.value : [];
    const shortsVideos = shortsResult.status === 'fulfilled' ? shortsResult.value : [];

    if (
      rssData ||
      browseData.videos.length > 0 ||
      streamsVideos.length > 0 ||
      shortsVideos.length > 0
    ) {
      const baseChannel: ChannelData = rssData?.channel || {
        id: channelId,
        title: browseData.resolvedTitle || `Channel ${channelId.slice(0, 8)}...`,
        url: `https://www.youtube.com/channel/${channelId}`,
        avatar: browseData.avatar || `https://avatar.vercel.sh/${channelId}?size=120`,
      };
      if (browseData.avatar) baseChannel.avatar = browseData.avatar;
      if (
        browseData.resolvedTitle &&
        (!baseChannel.title || baseChannel.title.startsWith('Channel '))
      ) {
        baseChannel.title = browseData.resolvedTitle;
      }

      const mergedMap = new Map<string, VideoItem>();
      for (const v of rssData?.videos || []) {
        mergedMap.set(v.id, v);
      }

      const appendFromSource = (list: VideoItem[]) => {
        for (const v of list) {
          const existing = mergedMap.get(v.id);
          if (!existing) {
            mergedMap.set(v.id, { ...v, channelTitle: baseChannel.title });
          } else {
            // Enrich RSS entry with duration & view count discovered via browse
            if ((v.duration && !existing.duration) || (v.views && !existing.views)) {
              mergedMap.set(v.id, {
                ...existing,
                duration: existing.duration || v.duration,
                views: existing.views || v.views,
              });
            }
          }
        }
      };

      appendFromSource(browseData.videos);
      appendFromSource(streamsVideos);
      appendFromSource(shortsVideos);

      const nextCursor = browseData.nextCursor || null;
      const result: ChannelFeedResult = {
        channel: baseChannel,
        videos: Array.from(mergedMap.values()),
        nextCursor,
        hasMore: Boolean(nextCursor),
      };
      channelFeedCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + 3 * 60 * 1000,
      });
      pruneCacheMap(channelFeedCache, 150);
      return result;
    }

    if (PRESET_CHANNELS[channelId]) {
      return {
        ...PRESET_CHANNELS[channelId],
        nextCursor: null,
        hasMore: false,
      };
    }

    return {
      channel: {
        id: channelId,
        title: `Channel ${channelId.slice(0, 8)}...`,
        url: `https://www.youtube.com/channel/${channelId}`,
        avatar: `https://avatar.vercel.sh/${channelId}?size=120`,
      },
      videos: [],
      nextCursor: null,
      hasMore: false,
    };
  })().finally(() => {
    pendingFeedRequests.delete(cacheKey);
  });

  pendingFeedRequests.set(cacheKey, promise);
  return promise;
}

export async function fetchBatchChannelFeeds(
  rawChannelIds: string[],
  maxPages = 2,
  concurrency = 6,
  forceRefresh = false
): Promise<{ channels: Record<string, ChannelData>; videos: VideoItem[] }> {
  const uniqueIds = Array.from(
    new Set(
      rawChannelIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .slice(0, 20)
    )
  );

  const channels: Record<string, ChannelData> = {};
  const videoWithTs: Array<{ video: VideoItem; ts: number }> = [];
  let cursor = 0;
  const workerCount = Math.min(concurrency, uniqueIds.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < uniqueIds.length) {
        const idx = cursor++;
        const id = uniqueIds[idx];
        try {
          const { channel, videos } = await fetchChannelRss(id, maxPages, forceRefresh);
          channels[channel.id] = channel;
          for (const video of videos) {
            const parsed = Date.parse(video.publishedAt);
            videoWithTs.push({ video, ts: Number.isNaN(parsed) ? 0 : parsed });
          }
        } catch {
          // ignore individual channel feed failure
        }
      }
    })
  );

  videoWithTs.sort((a, b) => b.ts - a.ts);
  return {
    channels,
    videos: videoWithTs.map((item) => item.video),
  };
}

export type AudioStreamFailureReason = 'login_required' | 'live_stream' | 'unavailable';

export interface ResolvedAudioStream {
  url: string;
  mimeType: string;
  contentLength?: string;
  userAgent: string;
  extraHeaders?: Record<string, string>;
}

export interface AudioStreamResolution {
  stream: ResolvedAudioStream | null;
  status: 'available' | AudioStreamFailureReason;
  reason?: string;
  refreshedOAuth?: YouTubeOAuthTokens;
}

export interface YouTubeOAuthClientIdentity {
  client_id: string;
  client_secret: string;
}

export interface YouTubeOAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: string;
  token_type?: string;
  scope?: string;
  client?: YouTubeOAuthClientIdentity;
}

export interface ExtractorAuthConfig {
  oauthTokens?: YouTubeOAuthTokens;
  cookies?: string;
  extractorUrl?: string;
}

export const EXTRACTOR_COOKIE_NAME = 'ct_yt_extract';

const audioStreamCache = new Map<
  string,
  { resolution: AudioStreamResolution; expiresAt: number }
>();
const pendingAudioResolutions = new Map<string, Promise<AudioStreamResolution>>();

function buildAuthCacheKey(auth?: ExtractorAuthConfig): string {
  if (!auth) return 'anon';
  const parts: string[] = [];
  if (auth.oauthTokens?.access_token) {
    parts.push(`oauth:${auth.oauthTokens.access_token.slice(-10)}`);
  }
  if (auth.cookies) {
    parts.push(`ck:${auth.cookies.length}:${auth.cookies.slice(0, 12)}`);
  }
  if (auth.extractorUrl) {
    parts.push(`ext:${auth.extractorUrl}`);
  }
  return parts.length > 0 ? parts.join('|') : 'anon';
}

export function invalidateAudioStreamCache(videoId: string): void {
  for (const key of audioStreamCache.keys()) {
    if (key === videoId || key.startsWith(`${videoId}::`)) {
      audioStreamCache.delete(key);
    }
  }
}

export function normalizeYouTubeCookies(rawInput: string | undefined): string {
  if (!rawInput) return '';
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  // Detect Netscape cookies.txt format (lines with tab-separated 7 columns)
  const lines = trimmed.split(/\r?\n/);
  const hasNetscapeLines = lines.some((line) => {
    const l = line.trim();
    return l && !l.startsWith('#') && l.split('\t').length >= 7;
  });

  if (hasNetscapeLines) {
    const pairs: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const l = line.trim();
      if (!l || l.startsWith('#')) continue;
      const cols = line.split('\t');
      if (cols.length < 7) continue;
      const domain = (cols[0] || '').toLowerCase();
      if (domain && !domain.includes('youtube.com') && !domain.includes('google.com')) {
        continue;
      }
      const name = (cols[5] || '').trim();
      const value = (cols[6] || '').trim();
      if (!name || !value || seen.has(name)) continue;
      seen.add(name);
      pairs.push(`${name}=${value}`);
    }
    return pairs.join('; ');
  }

  return trimmed
    .replace(/^cookie:\s*/i, '')
    .replace(/[\r\n]+/g, '; ')
    .trim();
}

export function parseCookiesHeaderMap(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

export function encodeExtractorCookieValue(config: ExtractorAuthConfig): string {
  return Buffer.from(JSON.stringify(config), 'utf8').toString('base64url');
}

export function decodeExtractorCookieValue(raw: string | undefined): ExtractorAuthConfig | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as ExtractorAuthConfig;
    if (parsed && typeof parsed === 'object') {
      return {
        oauthTokens: parsed.oauthTokens,
        cookies: parsed.cookies ? normalizeYouTubeCookies(parsed.cookies) : undefined,
        extractorUrl: parsed.extractorUrl?.trim().replace(/\/+$/, '') || undefined,
      };
    }
  } catch {
    // ignore malformed cookie
  }
  return null;
}

export function buildExtractorSetCookieHeader(
  config: ExtractorAuthConfig | null,
  isSecure = false
): string {
  const baseAttrs = `Path=/api/youtube; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`;
  if (!config || (!config.oauthTokens && !config.cookies && !config.extractorUrl)) {
    return `${EXTRACTOR_COOKIE_NAME}=; Max-Age=0; ${baseAttrs}`;
  }
  const encoded = encodeExtractorCookieValue(config);
  // Keep cookie safe under browser 4KB limit; large cookies stay in localStorage + X-YouTube-Cookies header
  if (encoded.length > 3600 && config.cookies) {
    const compact: ExtractorAuthConfig = {
      oauthTokens: config.oauthTokens,
      extractorUrl: config.extractorUrl,
    };
    const compactEncoded = encodeExtractorCookieValue(compact);
    return `${EXTRACTOR_COOKIE_NAME}=${compactEncoded}; Max-Age=${60 * 60 * 24 * 30}; ${baseAttrs}`;
  }
  return `${EXTRACTOR_COOKIE_NAME}=${encoded}; Max-Age=${60 * 60 * 24 * 30}; ${baseAttrs}`;
}

export function extractAuthFromRequest(
  headers?: Record<string, string | string[] | undefined>
): ExtractorAuthConfig {
  const getHeader = (name: string): string | undefined => {
    if (!headers) return undefined;
    const raw = headers[name] ?? headers[name.toLowerCase()];
    const str = Array.isArray(raw) ? raw[0] : raw;
    return typeof str === 'string' && str.trim() ? str.trim() : undefined;
  };

  const cookieMap = parseCookiesHeaderMap(getHeader('cookie'));
  const fromCookie = decodeExtractorCookieValue(cookieMap[EXTRACTOR_COOKIE_NAME]) || {};

  let oauthTokens = fromCookie.oauthTokens;
  const headerOAuth = getHeader('x-youtube-oauth');
  if (headerOAuth) {
    try {
      const decoded = JSON.parse(Buffer.from(headerOAuth, 'base64url').toString('utf8'));
      if (decoded?.access_token) oauthTokens = decoded;
    } catch {
      try {
        const direct = JSON.parse(headerOAuth);
        if (direct?.access_token) oauthTokens = direct;
      } catch {
        // ignore invalid oauth header
      }
    }
  }

  const headerCookies = normalizeYouTubeCookies(getHeader('x-youtube-cookies'));
  const cookies = headerCookies || fromCookie.cookies;

  const headerExtractorUrl = getHeader('x-extractor-url')?.replace(/\/+$/, '');
  const extractorUrl = headerExtractorUrl || fromCookie.extractorUrl;

  return {
    oauthTokens,
    cookies: cookies || undefined,
    extractorUrl: extractorUrl || undefined,
  };
}

let cachedInnertubeBase: { yt: Innertube; expiresAt: number } | null = null;
let pendingInnertubeBasePromise: Promise<Innertube> | null = null;

async function loadInnertubeClass() {
  const mod = await import('youtubei.js');
  return mod.Innertube;
}

function invalidateSharedInnertubeBase(): void {
  cachedInnertubeBase = null;
}

async function getSharedInnertubeBase(): Promise<Innertube> {
  if (cachedInnertubeBase && cachedInnertubeBase.expiresAt > Date.now()) {
    return cachedInnertubeBase.yt;
  }
  if (pendingInnertubeBasePromise) {
    return pendingInnertubeBasePromise;
  }
  pendingInnertubeBasePromise = loadInnertubeClass()
    .then((InnertubeCls) => InnertubeCls.create({ retrieve_player: false }))
    .then((yt) => {
      cachedInnertubeBase = { yt, expiresAt: Date.now() + 30 * 60 * 1000 };
      return yt;
    })
    .finally(() => {
      pendingInnertubeBasePromise = null;
    });
  return pendingInnertubeBasePromise;
}

const cachedInnertubePlayers = new Map<string, { yt: Innertube; expiresAt: number }>();

async function getCachedInnertubePlayer(options: {
  oauthTokens?: YouTubeOAuthTokens;
  cookies?: string;
  poToken?: string;
  visitorData?: string;
  generateSessionLocally: boolean;
}): Promise<Innertube> {
  const oauthKey = options.oauthTokens?.access_token
    ? `oa:${options.oauthTokens.access_token.slice(-14)}`
    : 'nooa';
  const key = `${oauthKey}|${options.cookies ? `ck:${options.cookies.length}:${options.cookies.slice(0, 12)}` : 'nock'}|${options.poToken ? options.poToken.slice(0, 16) : 'nopo'}|${options.visitorData ? options.visitorData.slice(0, 16) : 'novd'}|${options.generateSessionLocally ? '1' : '0'}`;
  const cached = cachedInnertubePlayers.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.yt;
  }
  const InnertubeCls = await loadInnertubeClass();
  const yt = await InnertubeCls.create({
    cookie: options.cookies || undefined,
    po_token: options.poToken || undefined,
    visitor_data: options.visitorData || undefined,
    generate_session_locally: options.generateSessionLocally,
  });
  if (options.oauthTokens) {
    await yt.session.signIn(options.oauthTokens as unknown as OAuth2Tokens);
  }
  cachedInnertubePlayers.set(key, {
    yt,
    expiresAt: Date.now() + 20 * 60 * 1000,
  });
  pruneCacheMap(cachedInnertubePlayers, 12);
  return yt;
}

async function safeResponseJson<T = Record<string, any>>(res: globalThis.Response): Promise<T | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

let cachedTvClientIdentity: { identity: OAuth2ClientID; expiresAt: number } | null = null;

async function getYouTubeTvClientIdentity(): Promise<OAuth2ClientID> {
  if (cachedTvClientIdentity && cachedTvClientIdentity.expiresAt > Date.now()) {
    return cachedTvClientIdentity.identity;
  }
  const yt = await getSharedInnertubeBase();
  const oauth = (yt.session as unknown as { oauth: { getClientID: () => Promise<OAuth2ClientID> } }).oauth;
  const identity = await oauth.getClientID();
  cachedTvClientIdentity = {
    identity,
    expiresAt: Date.now() + 12 * 60 * 60 * 1000,
  };
  return identity;
}

export async function startYouTubeDeviceAuth(): Promise<{
  verificationUrl: string;
  userCode: string;
  deviceCode: string;
  expiresIn: number;
  interval: number;
  client: YouTubeOAuthClientIdentity;
}> {
  const InnertubeCls = await loadInnertubeClass();
  const yt = await InnertubeCls.create({ retrieve_player: false });
  const client = await getYouTubeTvClientIdentity();
  const oauth = (
    yt.session as unknown as {
      oauth: {
        client_id?: OAuth2ClientID;
        getDeviceAndUserCode: () => Promise<DeviceAndUserCode>;
      };
    }
  ).oauth;
  oauth.client_id = client;
  const codeData = await oauth.getDeviceAndUserCode();
  if (!codeData?.user_code || !codeData?.device_code) {
    throw new Error('YouTube tidak mengembalikan kode verifikasi perangkat.');
  }
  return {
    verificationUrl: codeData.verification_url || 'https://www.google.com/device',
    userCode: codeData.user_code,
    deviceCode: codeData.device_code,
    expiresIn: codeData.expires_in || 1800,
    interval: codeData.interval || 5,
    client,
  };
}

export async function pollYouTubeDeviceAuth(params: {
  deviceCode: string;
  client?: YouTubeOAuthClientIdentity;
}): Promise<{
  status: 'pending' | 'authorized' | 'expired' | 'denied';
  credentials?: YouTubeOAuthTokens;
  error?: string;
}> {
  const client = params.client?.client_id && params.client?.client_secret
    ? params.client
    : await getYouTubeTvClientIdentity();

  const res = await fetchWithTimeout(
    'https://www.youtube.com/o/oauth2/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: client.client_id,
        client_secret: client.client_secret,
        code: params.deviceCode,
        grant_type: 'http://oauth.net/grant_type/device/1.0',
      }),
    },
    10000
  );

  const data = await safeResponseJson<Record<string, any>>(res);
  if (!data) {
    return { status: 'pending' };
  }
  if (data.error) {
    if (data.error === 'authorization_pending' || data.error === 'slow_down') {
      return { status: 'pending' };
    }
    if (data.error === 'expired_token') {
      return { status: 'expired', error: 'Kode verifikasi kedaluwarsa. Buat kode baru.' };
    }
    if (data.error === 'access_denied') {
      return { status: 'denied', error: 'Otorisasi ditolak oleh pengguna.' };
    }
    return { status: 'denied', error: String(data.error_description || data.error) };
  }

  if (!data.access_token || !data.refresh_token) {
    return { status: 'pending' };
  }

  const expiresIn = Number(data.expires_in || 3600);
  const credentials: YouTubeOAuthTokens = {
    access_token: String(data.access_token),
    refresh_token: String(data.refresh_token),
    expiry_date: new Date(Date.now() + expiresIn * 1000).toISOString(),
    token_type: data.token_type ? String(data.token_type) : 'Bearer',
    scope: data.scope ? String(data.scope) : undefined,
    client,
  };

  return { status: 'authorized', credentials };
}

export async function refreshYouTubeOAuthTokens(
  tokens: YouTubeOAuthTokens
): Promise<YouTubeOAuthTokens> {
  const client = tokens.client?.client_id && tokens.client?.client_secret
    ? tokens.client
    : await getYouTubeTvClientIdentity();

  const res = await fetchWithTimeout(
    'https://www.youtube.com/o/oauth2/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: client.client_id,
        client_secret: client.client_secret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    },
    10000
  );

  if (!res.ok) {
    throw new Error(`Gagal memperbarui token YouTube (${res.status})`);
  }
  const data = await safeResponseJson<Record<string, any>>(res);
  if (!data?.access_token) {
    throw new Error(String(data?.error_description || data?.error || 'Token refresh gagal'));
  }
  const expiresIn = Number(data.expires_in || 3600);
  return {
    ...tokens,
    access_token: String(data.access_token),
    expiry_date: new Date(Date.now() + expiresIn * 1000).toISOString(),
    client,
  };
}

interface BotGuardPoSession {
  poToken: string;
  visitorData: string;
  minter: WebPoMinter;
  expiresAt: number;
}

let cachedBotGuardPo: BotGuardPoSession | null = null;
let pendingBotGuardPromise: Promise<BotGuardPoSession | null> | null = null;

async function getOrCreateBotGuardSession(): Promise<BotGuardPoSession | null> {
  if (cachedBotGuardPo && cachedBotGuardPo.expiresAt > Date.now()) {
    return cachedBotGuardPo;
  }
  if (pendingBotGuardPromise) {
    return pendingBotGuardPromise;
  }

  pendingBotGuardPromise = (async () => {
    try {
      const [{ JSDOM }, { BotGuardClient, getChallenge }, { WebPoMinter }] = await Promise.all([
        import('jsdom'),
        import('bgutils-js/botguard'),
        import('bgutils-js/webpo'),
      ]);

      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'https://www.youtube.com/',
        referrer: 'https://www.youtube.com/',
        runScripts: 'dangerously',
      });

      const g = globalThis as Record<string, any>;
      if (!g.window) g.window = dom.window;
      if (!g.document) g.document = dom.window.document;

      const yt = await getSharedInnertubeBase();
      const visitorData = yt.session.context.client.visitorData || '';
      const requestKey = 'O43z0dpjhgX20SCx4KAo';

      const challenge = await getChallenge({
        requestKey,
        fetchFunction: fetch,
        useYouTubeAPI: true,
      });

      const script =
        challenge?.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
      if (script) {
        const fn = new Function(script);
        fn();
      }

      const bgClient = await BotGuardClient.create({
        globalObject: globalThis,
        globalName: challenge.globalName,
        program: challenge.program,
      });

      const webPoSignalOutput: any[] = [];
      const botguardResponse = await bgClient.snapshot({ webPoSignalOutput });

      const jnnRes = await fetchWithTimeout(
        'https://jnn-pa.googleapis.com/$rpc/google.internal.waa.v1.Waa/GenerateIT',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json+protobuf',
            'x-goog-api-key': 'AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw',
            'x-user-agent': 'grpc-web-javascript/0.1',
          },
          body: JSON.stringify([requestKey, botguardResponse]),
        },
        7000
      );

      if (!jnnRes.ok) return null;
      const jnnArr = (await jnnRes.json()) as unknown[];
      const integrityToken = typeof jnnArr?.[0] === 'string' ? jnnArr[0] : '';
      if (!integrityToken) return null;

      const minter = await WebPoMinter.create(
        {
          integrityToken,
          estimatedTtlSecs: typeof jnnArr?.[1] === 'number' ? jnnArr[1] : undefined,
        },
        webPoSignalOutput
      );

      const poToken = await minter.mintAsWebsafeString(visitorData);
      cachedBotGuardPo = {
        poToken,
        visitorData,
        minter,
        expiresAt: Date.now() + 3 * 60 * 60 * 1000,
      };
      return cachedBotGuardPo;
    } catch {
      return null;
    } finally {
      pendingBotGuardPromise = null;
    }
  })();

  return pendingBotGuardPromise;
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
    userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    client: {
      clientName: 'IOS',
      clientVersion: '20.10.4',
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      osName: 'iPhone',
      osVersion: '18.3.2.22D82',
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

const DEFAULT_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

async function resolveFromExternalEndpoint(
  baseUrl: string,
  videoId: string
): Promise<ResolvedAudioStream | null> {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  if (!cleanBase || !/^https?:\/\//i.test(cleanBase)) return null;

  const tryPiped = async (): Promise<ResolvedAudioStream> => {
    const res = await fetchWithTimeout(
      `${cleanBase}/streams/${encodeURIComponent(videoId)}`,
      { headers: { Accept: 'application/json' } },
      5500
    );
    if (!res.ok) throw new Error('piped_not_ok');
    const data = await safeResponseJson<any>(res);
    const streams: any[] = Array.isArray(data?.audioStreams) ? data.audioStreams : [];
    const selected =
      streams.find((s) => typeof s?.url === 'string' && String(s.mimeType || '').includes('audio/mp4')) ||
      streams.find((s) => typeof s?.url === 'string' && String(s.mimeType || '').startsWith('audio/'));
    if (!selected?.url) throw new Error('piped_empty');
    return {
      url: String(selected.url),
      mimeType: String(selected.mimeType || 'audio/mp4').split(';')[0].trim(),
      contentLength: selected.contentLength ? String(selected.contentLength) : undefined,
      userAgent: DEFAULT_BROWSER_UA,
    };
  };

  const tryInvidious = async (): Promise<ResolvedAudioStream> => {
    const res = await fetchWithTimeout(
      `${cleanBase}/api/v1/videos/${encodeURIComponent(videoId)}`,
      { headers: { Accept: 'application/json' } },
      5500
    );
    if (!res.ok) throw new Error('invidious_not_ok');
    const data = await safeResponseJson<any>(res);
    const adaptive: any[] = Array.isArray(data?.adaptiveFormats) ? data.adaptiveFormats : [];
    const selected =
      adaptive.find((f) => typeof f?.url === 'string' && String(f.type || '').includes('audio/mp4')) ||
      adaptive.find((f) => typeof f?.url === 'string' && String(f.type || '').startsWith('audio/'));
    if (!selected?.url) throw new Error('invidious_empty');
    return {
      url: String(selected.url),
      mimeType: String(selected.type || 'audio/mp4').split(';')[0].trim(),
      contentLength: selected.clen ? String(selected.clen) : undefined,
      userAgent: DEFAULT_BROWSER_UA,
    };
  };

  const tryCobalt = async (): Promise<ResolvedAudioStream> => {
    const res = await fetchWithTimeout(
      `${cleanBase}/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: 'audio',
          audioFormat: 'best',
        }),
      },
      6500
    );
    if (!res.ok) throw new Error('cobalt_not_ok');
    const data = await safeResponseJson<Record<string, any>>(res);
    if (!data || (data.status !== 'tunnel' && data.status !== 'redirect') || typeof data.url !== 'string') {
      throw new Error('cobalt_empty');
    }
    return {
      url: data.url,
      mimeType: 'audio/mp4',
      userAgent: DEFAULT_BROWSER_UA,
    };
  };

  try {
    return await Promise.any([tryPiped(), tryInvidious(), tryCobalt()]);
  } catch {
    return null;
  }
}

async function tryExternalExtractor(
  videoId: string,
  customExtractorUrl?: string
): Promise<ResolvedAudioStream | null> {
  const candidates = [
    customExtractorUrl,
    process.env.COBALT_API_URL,
    process.env.PIPED_API_URL,
    process.env.INVIDIOUS_API_URL,
  ]
    .map((u) => (typeof u === 'string' ? u.trim().replace(/\/+$/, '') : ''))
    .filter(Boolean);

  if (candidates.length === 0) return null;

  try {
    return await Promise.any(
      candidates.map(async (base) => {
        const resolved = await resolveFromExternalEndpoint(base, videoId);
        if (!resolved) throw new Error('no_stream');
        return resolved;
      })
    );
  } catch {
    return null;
  }
}

async function resolveViaYouTubeJs(
  videoId: string,
  options: {
    oauthTokens?: YouTubeOAuthTokens;
    cookies?: string;
    poToken?: string;
    visitorData?: string;
  }
): Promise<{
  stream: ResolvedAudioStream | null;
  status: 'available' | AudioStreamFailureReason;
  reason?: string;
  refreshedOAuth?: YouTubeOAuthTokens;
}> {
  let detectedStatus: AudioStreamFailureReason = 'unavailable';
  let detectedReason: string | undefined;
  let activeOAuth = options.oauthTokens;
  let refreshedOAuth: YouTubeOAuthTokens | undefined;

  if (activeOAuth) {
    const expMs = new Date(activeOAuth.expiry_date || 0).getTime();
    if (!Number.isFinite(expMs) || Date.now() >= expMs - 60_000) {
      try {
        activeOAuth = await refreshYouTubeOAuthTokens(activeOAuth);
        refreshedOAuth = activeOAuth;
      } catch {
        // continue with existing token and let YouTube reject if invalid
      }
    }
  }

  try {
    const yt = await getCachedInnertubePlayer({
      oauthTokens: activeOAuth,
      cookies: options.cookies,
      poToken: options.poToken,
      visitorData: options.visitorData,
      generateSessionLocally: !activeOAuth && !options.cookies,
    });

    const clientsToTry: Array<'TV' | 'ANDROID_VR' | 'IOS' | 'MWEB' | 'WEB'> = activeOAuth
      ? ['TV', 'ANDROID_VR', 'IOS', 'WEB']
      : options.cookies
      ? ['MWEB', 'WEB', 'TV', 'IOS', 'ANDROID_VR']
      : ['MWEB', 'ANDROID_VR', 'IOS', 'WEB'];

    for (const client of clientsToTry) {
      try {
        const info = await yt.getBasicInfo(videoId, { client });
        const playStatus = info.playability_status?.status;
        const playReason = info.playability_status?.reason;

        if (playStatus !== 'OK') {
          if (playStatus === 'LOGIN_REQUIRED') {
            detectedStatus = 'login_required';
            detectedReason = playReason;
          } else if (
            info.basic_info?.is_live ||
            (playReason && playReason.toLowerCase().includes('live stream'))
          ) {
            detectedStatus = 'live_stream';
            detectedReason = playReason;
          } else if (!detectedReason && playReason) {
            detectedReason = playReason;
          }
          continue;
        }

        const adaptiveFormats = info.streaming_data?.adaptive_formats || [];
        const audioFormats = adaptiveFormats.filter((f) =>
          String(f.mime_type || '').startsWith('audio/')
        );

        let selected: any =
          audioFormats.find((f) => f.itag === 140) ||
          audioFormats.find((f) => f.itag === 139) ||
          audioFormats.find((f) => String(f.mime_type || '').includes('audio/mp4')) ||
          audioFormats.find((f) => f.itag === 251) ||
          audioFormats[0];

        if (!selected) {
          const muxed = info.streaming_data?.formats || [];
          selected =
            muxed.find((f) => f.itag === 18) ||
            muxed.find((f) => String(f.mime_type || '').startsWith('video/mp4'));
        }

        if (!selected) {
          if (info.basic_info?.is_live || info.streaming_data?.hls_manifest_url) {
            detectedStatus = 'live_stream';
            detectedReason = 'Siaran Live memakai streaming HLS/IFrame';
          }
          continue;
        }

        const decipheredUrl = await selected.decipher(yt.session.player);
        if (!decipheredUrl) continue;

        const mimeType = String(selected.mime_type || 'audio/mp4').split(';')[0].trim();
        return {
          stream: {
            url: decipheredUrl,
            mimeType,
            contentLength: selected.content_length ? String(selected.content_length) : undefined,
            userAgent: yt.session.context.client.userAgent || DEFAULT_BROWSER_UA,
          },
          status: 'available',
          refreshedOAuth,
        };
      } catch {
        // try next client
      }
    }
  } catch (err: unknown) {
    detectedReason = err instanceof Error ? err.message : detectedReason;
  }

  return {
    stream: null,
    status: detectedStatus,
    reason: detectedReason,
    refreshedOAuth,
  };
}

export async function resolveAudioStreamInfo(
  videoId: string,
  authConfig?: ExtractorAuthConfig
): Promise<AudioStreamResolution> {
  if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
    return { stream: null, status: 'unavailable', reason: 'Video ID tidak valid' };
  }

  const effectiveCookies =
    normalizeYouTubeCookies(authConfig?.cookies) ||
    normalizeYouTubeCookies(process.env.YOUTUBE_COOKIES);
  const effectiveAuth: ExtractorAuthConfig = {
    oauthTokens: authConfig?.oauthTokens,
    cookies: effectiveCookies || undefined,
    extractorUrl: authConfig?.extractorUrl,
  };

  const cacheKey = `${videoId}::${buildAuthCacheKey(effectiveAuth)}`;
  const cached = audioStreamCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.resolution;
  }

  const inFlight = pendingAudioResolutions.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const work = (async (): Promise<AudioStreamResolution> => {
    let detectedStatus: AudioStreamFailureReason = 'unavailable';
    let detectedReason: string | undefined;
    let refreshedOAuth: YouTubeOAuthTokens | undefined;

    const cacheAndReturn = (resolution: AudioStreamResolution, ttlMs: number): AudioStreamResolution => {
      audioStreamCache.set(cacheKey, { resolution, expiresAt: Date.now() + ttlMs });
      pruneCacheMap(audioStreamCache, 250);
      return resolution;
    };

    // 1. User-configured external extractor first if custom URL explicitly set
    if (effectiveAuth.extractorUrl) {
      const customStream = await resolveFromExternalEndpoint(effectiveAuth.extractorUrl, videoId);
      if (customStream) {
        return cacheAndReturn({ stream: customStream, status: 'available' }, 25 * 60 * 1000);
      }
    }

    // 2. If authenticated via YouTube TV OAuth or YouTube Cookies, run youtubei.js authenticated session
    if (effectiveAuth.oauthTokens || effectiveAuth.cookies) {
      const authRes = await resolveViaYouTubeJs(videoId, {
        oauthTokens: effectiveAuth.oauthTokens,
        cookies: effectiveAuth.cookies,
      });
      if (authRes.refreshedOAuth) refreshedOAuth = authRes.refreshedOAuth;
      if (authRes.stream) {
        return cacheAndReturn(
          { stream: authRes.stream, status: 'available', refreshedOAuth },
          30 * 60 * 1000
        );
      }
      if (authRes.status !== 'available') {
        detectedStatus = authRes.status;
      }
      detectedReason = authRes.reason;
    }

    // 3. Fast parallel direct InnerTube audio clients (ANDROID_VR, IOS, ANDROID_MUSIC)
    const clientAttempts = INNERTUBE_AUDIO_CLIENTS.map(async (cfg): Promise<{
      stream: ResolvedAudioStream | null;
      status: AudioStreamFailureReason;
      reason?: string;
    }> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': cfg.userAgent,
        };
        if (effectiveAuth.cookies) {
          headers['Cookie'] = effectiveAuth.cookies;
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
          5500
        );

        if (!res.ok) return { stream: null, status: 'unavailable' };
        const data = await safeResponseJson<any>(res);
        if (!data) return { stream: null, status: 'unavailable' };
        const playStatus = data?.playabilityStatus?.status;
        const playReason =
          typeof data?.playabilityStatus?.reason === 'string'
            ? data.playabilityStatus.reason
            : undefined;

        if (playStatus !== 'OK') {
          if (playStatus === 'LOGIN_REQUIRED') {
            return { stream: null, status: 'login_required', reason: playReason };
          }
          if (
            data?.videoDetails?.isLiveContent ||
            (playReason && playReason.toLowerCase().includes('live stream'))
          ) {
            return { stream: null, status: 'live_stream', reason: playReason };
          }
          return { stream: null, status: 'unavailable', reason: playReason };
        }

        const adaptiveFormats: any[] = data?.streamingData?.adaptiveFormats || [];
        const audioFormats = adaptiveFormats.filter(
          (f) => typeof f.mimeType === 'string' && f.mimeType.startsWith('audio/') && typeof f.url === 'string'
        );

        let selected =
          audioFormats.find((f) => f.itag === 140) ||
          audioFormats.find((f) => f.itag === 139) ||
          audioFormats.find((f) => f.mimeType.startsWith('audio/mp4')) ||
          audioFormats.find((f) => f.itag === 251) ||
          audioFormats[0];

        if (!selected) {
          const muxedFormats: any[] = data?.streamingData?.formats || [];
          selected =
            muxedFormats.find((f) => f.itag === 18 && typeof f.url === 'string') ||
            muxedFormats.find(
              (f) => typeof f.mimeType === 'string' && f.mimeType.startsWith('video/mp4') && typeof f.url === 'string'
            );
        }

        if (!selected) {
          if (data?.videoDetails?.isLiveContent || data?.streamingData?.hlsManifestUrl) {
            return {
              stream: null,
              status: 'live_stream',
              reason: 'Siaran Live memakai streaming HLS/IFrame',
            };
          }
          return { stream: null, status: 'unavailable' };
        }

        const mimeType = String(selected.mimeType).split(';')[0].trim() || 'audio/mp4';
        return {
          stream: {
            url: selected.url as string,
            mimeType,
            contentLength: selected.contentLength ? String(selected.contentLength) : undefined,
            userAgent: cfg.userAgent,
          },
          status: 'unavailable',
        };
      } catch {
        return { stream: null, status: 'unavailable' };
      }
    });

    // Resolve immediately as soon as any client yields a playable audio stream; otherwise collect statuses
    const fastWinner = await new Promise<ResolvedAudioStream | null>((resolve) => {
      let settledCount = 0;
      let resolved = false;
      for (const p of clientAttempts) {
        p.then((attempt) => {
          if (resolved) return;
          if (attempt.stream) {
            resolved = true;
            resolve(attempt.stream);
            return;
          }
          if (attempt.status === 'live_stream') {
            detectedStatus = 'live_stream';
            detectedReason = attempt.reason || detectedReason;
          } else if (attempt.status === 'login_required' && detectedStatus !== 'live_stream') {
            detectedStatus = 'login_required';
            detectedReason = attempt.reason || detectedReason;
          } else if (!detectedReason && attempt.reason) {
            detectedReason = attempt.reason;
          }
          settledCount += 1;
          if (settledCount >= clientAttempts.length) {
            resolved = true;
            resolve(null);
          }
        });
      }
    });

    if (fastWinner) {
      return cacheAndReturn(
        { stream: fastWinner, status: 'available', refreshedOAuth },
        30 * 60 * 1000
      );
    }

    // 4. BotGuard PoToken + signatureCipher deciphering via youtubei.js
    if (detectedStatus !== 'live_stream') {
      const bgSession = await getOrCreateBotGuardSession();
      let contentPoToken = bgSession?.poToken;
      if (bgSession?.minter) {
        try {
          contentPoToken = await bgSession.minter.mintAsWebsafeString(videoId);
        } catch {
          // fallback to session poToken
        }
      }
      const ytRes = await resolveViaYouTubeJs(videoId, {
        cookies: detectedStatus === 'login_required' ? undefined : effectiveAuth.cookies,
        poToken: contentPoToken,
        visitorData: bgSession?.visitorData,
      });
      if (ytRes.stream) {
        return cacheAndReturn(
          { stream: ytRes.stream, status: 'available', refreshedOAuth },
          25 * 60 * 1000
        );
      }
      if (ytRes.status !== 'unavailable' && ytRes.status !== 'available') {
        detectedStatus = ytRes.status;
        detectedReason = ytRes.reason || detectedReason;
      }
    }

    // 5. Fallback to configured environment external extractors (Cobalt / Piped / Invidious)
    const external = await tryExternalExtractor(videoId, effectiveAuth.extractorUrl);
    if (external) {
      return cacheAndReturn(
        { stream: external, status: 'available', refreshedOAuth },
        25 * 60 * 1000
      );
    }

    return cacheAndReturn(
      {
        stream: null,
        status: detectedStatus,
        reason: detectedReason,
        refreshedOAuth,
      },
      2 * 60 * 1000
    );
  })().finally(() => {
    pendingAudioResolutions.delete(cacheKey);
  });

  pendingAudioResolutions.set(cacheKey, work);
  return work;
}

export async function resolveAudioStreamUrl(
  videoId: string,
  authConfig?: ExtractorAuthConfig
): Promise<ResolvedAudioStream | null> {
  const result = await resolveAudioStreamInfo(videoId, authConfig);
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

export interface VideoSearchResult extends VideoItem {
  channelAvatar?: string;
  channelHandle?: string;
  channelUrl?: string;
  publishedText?: string;
}

const VALID_CHANNEL_ID_RE = /^UC[a-zA-Z0-9_-]{22}$/;
const VALID_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const channelSearchCache = new Map<
  string,
  { results: ChannelSearchResult[]; expiresAt: number }
>();
const pendingChannelSearches = new Map<string, Promise<ChannelSearchResult[]>>();

const videoSearchCache = new Map<
  string,
  { results: VideoSearchResult[]; expiresAt: number }
>();
const pendingVideoSearches = new Map<string, Promise<VideoSearchResult[]>>();

function extractYtText(val: any): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val.trim() || undefined;
  if (typeof val.simpleText === 'string') return val.simpleText.trim() || undefined;
  if (Array.isArray(val.runs)) {
    const joined = val.runs
      .map((r: any) => (typeof r?.text === 'string' ? r.text : ''))
      .join('')
      .trim();
    return joined || undefined;
  }
  if (typeof val.content === 'string') return val.content.trim() || undefined;
  return undefined;
}

function normalizeYtAvatar(rawUrl: string | undefined, channelId: string): string {
  const clean = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!clean) return `https://avatar.vercel.sh/${channelId}?size=120`;
  if (clean.startsWith('//')) return `https:${clean}`;
  if (clean.startsWith('/')) return `https://www.youtube.com${clean}`;
  return clean;
}

function isValidYouTubeChannelId(id: string | undefined): id is string {
  return typeof id === 'string' && VALID_CHANNEL_ID_RE.test(id.trim());
}

function collectChannelRenderers(
  node: any,
  results: ChannelSearchResult[],
  seenIds: Set<string>,
  depth = 0
): void {
  if (!node || typeof node !== 'object' || depth > 16 || results.length >= 20) return;

  if (Array.isArray(node)) {
    for (const item of node) {
      if (results.length >= 20) break;
      collectChannelRenderers(item, results, seenIds, depth + 1);
    }
    return;
  }

  const cr =
    node.channelRenderer ||
    node.gridChannelRenderer ||
    node.compactChannelRenderer ||
    node.channelCardRenderer ||
    node.topicChannelDetailsRenderer;
  if (cr && typeof cr === 'object') {
    const channelId = String(
      cr.channelId || cr.navigationEndpoint?.browseEndpoint?.browseId || ''
    ).trim();
    if (isValidYouTubeChannelId(channelId) && !seenIds.has(channelId)) {
      seenIds.add(channelId);

      const title = extractYtText(cr.title) || 'YouTube Channel';
      const subText = extractYtText(cr.subscriberCountText);
      const vidText = extractYtText(cr.videoCountText);
      const canonicalBaseUrl: string | undefined =
        cr.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl;

      let handle: string | undefined;
      let subscriberCount: string | undefined;

      if (subText && subText.startsWith('@')) {
        handle = subText;
        subscriberCount = vidText;
      } else {
        subscriberCount = subText || vidText;
        if (canonicalBaseUrl && canonicalBaseUrl.startsWith('/@')) {
          handle = canonicalBaseUrl.slice(1);
        }
      }

      const thumbs = cr.thumbnail?.thumbnails || cr.avatar?.thumbnails;
      const rawThumb =
        Array.isArray(thumbs) && thumbs.length > 0
          ? String(thumbs[thumbs.length - 1]?.url || '')
          : '';

      const description = extractYtText(cr.descriptionSnippet || cr.subtitle);
      const url = canonicalBaseUrl
        ? `https://www.youtube.com${canonicalBaseUrl}`
        : `https://www.youtube.com/channel/${channelId}`;

      results.push({
        id: channelId,
        title,
        handle,
        avatar: normalizeYtAvatar(rawThumb, channelId),
        subscriberCount,
        description,
        url,
      });
    }
    return;
  }

  for (const key of Object.keys(node)) {
    if (results.length >= 20) break;
    const val = node[key];
    if (val && typeof val === 'object') {
      collectChannelRenderers(val, results, seenIds, depth + 1);
    }
  }
}

function collectAuthorChannelsFromVideos(
  node: any,
  results: ChannelSearchResult[],
  seenIds: Set<string>,
  depth = 0
): void {
  if (!node || typeof node !== 'object' || depth > 14 || results.length >= 15) return;

  if (Array.isArray(node)) {
    for (const item of node) {
      if (results.length >= 15) break;
      collectAuthorChannelsFromVideos(item, results, seenIds, depth + 1);
    }
    return;
  }

  const vr = node.videoRenderer || node.gridVideoRenderer || node.compactVideoRenderer;
  if (vr && typeof vr === 'object') {
    const ownerRun =
      vr.ownerText?.runs?.[0] ||
      vr.longBylineText?.runs?.[0] ||
      vr.shortBylineText?.runs?.[0];
    const browseEp =
      ownerRun?.navigationEndpoint?.browseEndpoint ||
      vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.navigationEndpoint
        ?.browseEndpoint;
    const channelId = String(browseEp?.browseId || '').trim();
    if (isValidYouTubeChannelId(channelId) && !seenIds.has(channelId)) {
      seenIds.add(channelId);
      const canonicalBaseUrl: string | undefined = browseEp?.canonicalBaseUrl;
      const handle =
        canonicalBaseUrl && canonicalBaseUrl.startsWith('/@')
          ? canonicalBaseUrl.slice(1)
          : undefined;
      const thumbs =
        vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail
          ?.thumbnails;
      const rawThumb =
        Array.isArray(thumbs) && thumbs.length > 0
          ? String(thumbs[thumbs.length - 1]?.url || '')
          : '';
      const title =
        (typeof ownerRun?.text === 'string' && ownerRun.text.trim()) || 'YouTube Channel';
      const url = canonicalBaseUrl
        ? `https://www.youtube.com${canonicalBaseUrl}`
        : `https://www.youtube.com/channel/${channelId}`;

      results.push({
        id: channelId,
        title,
        handle,
        avatar: normalizeYtAvatar(rawThumb, channelId),
        url,
      });
    }
    return;
  }

  for (const key of Object.keys(node)) {
    if (results.length >= 15) break;
    const val = node[key];
    if (val && typeof val === 'object') {
      collectAuthorChannelsFromVideos(val, results, seenIds, depth + 1);
    }
  }
}

function extractYtInitialDataJson(html: string): any | null {
  const markers = ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = '];
  for (const marker of markers) {
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) continue;
    const jsonStart = startIdx + marker.length;
    const endIdx = html.indexOf(';</script>', jsonStart);
    const semiIdx = endIdx !== -1 ? endIdx : html.indexOf(';\n', jsonStart);
    if (semiIdx === -1) continue;
    try {
      return JSON.parse(html.slice(jsonStart, semiIdx));
    } catch {
      // try next marker
    }
  }
  return null;
}

async function searchChannelsViaInnerTubeHttp(
  searchTerm: string,
  onlyChannels: boolean,
  timeoutMs = 4800
): Promise<{ ok: boolean; results: ChannelSearchResult[]; error?: Error }> {
  const clients = [
    {
      clientName: 'WEB',
      clientVersion: '2.20250201.00.00',
      clientHeaderId: '1',
      origin: 'https://www.youtube.com',
    },
    {
      clientName: 'MWEB',
      clientVersion: '2.20250201.00.00',
      clientHeaderId: '2',
      origin: 'https://m.youtube.com',
    },
  ];

  let lastErr: Error | undefined;
  for (const cfg of clients) {
    try {
      const bodyPayload: Record<string, unknown> = {
        context: {
          client: {
            clientName: cfg.clientName,
            clientVersion: cfg.clientVersion,
            hl: 'id',
            gl: 'ID',
          },
        },
        query: searchTerm,
      };
      if (onlyChannels) {
        bodyPayload.params = 'EgIQAg==';
      }

      const res = await fetchWithTimeout(
        'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Language': 'id,en-US,en;q=0.9',
            Origin: cfg.origin,
            Referer: `${cfg.origin}/`,
            'X-YouTube-Client-Name': cfg.clientHeaderId,
            'X-YouTube-Client-Version': cfg.clientVersion,
          },
          body: JSON.stringify(bodyPayload),
        },
        timeoutMs
      );

      if (!res.ok) {
        lastErr = new Error(`YouTube search merespons status ${res.status}`);
        continue;
      }

      const data = await safeResponseJson<any>(res);
      if (!data || data.error) {
        lastErr = new Error(
          data?.error?.message
            ? String(data.error.message)
            : 'Respons pencarian YouTube tidak valid'
        );
        continue;
      }

      const found: ChannelSearchResult[] = [];
      const seen = new Set<string>();
      collectChannelRenderers(data?.contents ?? data, found, seen);
      if (!onlyChannels && found.length === 0) {
        collectAuthorChannelsFromVideos(data?.contents ?? data, found, seen);
      }

      return { ok: true, results: found };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error('Gagal menghubungi YouTube search');
    }
  }

  return {
    ok: false,
    results: [],
    error: lastErr || new Error('Gagal menghubungi YouTube search'),
  };
}

async function searchChannelsViaInnertubeLib(
  searchTerm: string,
  timeoutMs = 5000
): Promise<{ ok: boolean; results: ChannelSearchResult[]; error?: Error }> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const yt = await getSharedInnertubeBase();
    const search = await Promise.race([
      yt.search(searchTerm, { type: 'channel' }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Batas waktu pencarian Innertube tercapai')), timeoutMs);
      }),
    ]);

    const ytResults = Array.isArray((search as any)?.results) ? (search as any).results : [];
    const found: ChannelSearchResult[] = [];
    const seen = new Set<string>();

    for (const item of ytResults) {
      if (found.length >= 20) break;
      const channelId = String(
        item?.id || item?.author?.id || item?.endpoint?.payload?.browseId || ''
      ).trim();
      if (!isValidYouTubeChannelId(channelId) || seen.has(channelId)) continue;
      seen.add(channelId);

      const canonicalBaseUrl: string | undefined =
        item?.author?.endpoint?.payload?.canonicalBaseUrl ||
        item?.endpoint?.payload?.canonicalBaseUrl;
      const subText = item?.subscriber_count?.text
        ? String(item.subscriber_count.text).trim()
        : undefined;
      const vidText = item?.video_count?.text ? String(item.video_count.text).trim() : undefined;

      let handle: string | undefined;
      let subscriberCount: string | undefined;
      if (subText && subText.startsWith('@')) {
        handle = subText;
        subscriberCount = vidText;
      } else {
        subscriberCount = subText || vidText;
        if (canonicalBaseUrl && canonicalBaseUrl.startsWith('/@')) {
          handle = canonicalBaseUrl.slice(1);
        }
      }

      const thumbs = item?.author?.thumbnails || item?.thumbnails;
      const rawThumb = Array.isArray(thumbs) && thumbs.length > 0 ? String(thumbs[0]?.url || '') : '';
      const title = String(item?.author?.name || item?.title?.text || 'YouTube Channel').trim();
      const description = item?.description_snippet?.text
        ? String(item.description_snippet.text).trim()
        : undefined;
      const url = canonicalBaseUrl
        ? `https://www.youtube.com${canonicalBaseUrl}`
        : `https://www.youtube.com/channel/${channelId}`;

      found.push({
        id: channelId,
        title,
        handle,
        avatar: normalizeYtAvatar(rawThumb, channelId),
        subscriberCount,
        description,
        url,
      });
    }

    return { ok: true, results: found };
  } catch (err) {
    invalidateSharedInnertubeBase();
    return {
      ok: false,
      results: [],
      error: err instanceof Error ? err : new Error('Gagal mencari channel via Innertube'),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function searchChannelsViaHtmlPage(
  searchTerm: string,
  timeoutMs = 5500
): Promise<{ ok: boolean; results: ChannelSearchResult[]; error?: Error }> {
  try {
    const htmlRes = await fetchWithTimeout(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}&sp=EgIQAg%3D%3D`,
      {},
      timeoutMs
    );
    if (!htmlRes.ok) {
      return {
        ok: false,
        results: [],
        error: new Error(`Halaman pencarian YouTube merespons ${htmlRes.status}`),
      };
    }
    const html = await htmlRes.text();
    const data = extractYtInitialDataJson(html);
    if (!data) {
      return { ok: false, results: [], error: new Error('Data pencarian YouTube tidak ditemukan') };
    }
    const found: ChannelSearchResult[] = [];
    const seen = new Set<string>();
    collectChannelRenderers(data?.contents ?? data, found, seen);
    if (found.length === 0) {
      collectAuthorChannelsFromVideos(data?.contents ?? data, found, seen);
    }
    return { ok: true, results: found };
  } catch (err) {
    return {
      ok: false,
      results: [],
      error: err instanceof Error ? err : new Error('Gagal membuka halaman pencarian YouTube'),
    };
  }
}

async function searchChannelsViaExternalMirror(
  searchTerm: string
): Promise<ChannelSearchResult[]> {
  const pipedBase = process.env.PIPED_API_URL?.trim().replace(/\/+$/, '');
  const invidiousBase = process.env.INVIDIOUS_API_URL?.trim().replace(/\/+$/, '');
  if (!pipedBase && !invidiousBase) return [];

  const attempts: Promise<ChannelSearchResult[]>[] = [];
  if (invidiousBase) {
    attempts.push(
      (async () => {
        const res = await fetchWithTimeout(
          `${invidiousBase}/api/v1/search?q=${encodeURIComponent(searchTerm)}&type=channel`,
          { headers: { Accept: 'application/json' } },
          4500
        );
        if (!res.ok) return [];
        const items = await safeResponseJson<any[]>(res);
        if (!Array.isArray(items)) return [];
        const out: ChannelSearchResult[] = [];
        for (const it of items.slice(0, 15)) {
          const cid = String(it?.authorId || '').trim();
          if (!isValidYouTubeChannelId(cid)) continue;
          const thumbs = Array.isArray(it?.authorThumbnails) ? it.authorThumbnails : [];
          const rawThumb = thumbs.length > 0 ? String(thumbs[thumbs.length - 1]?.url || '') : '';
          out.push({
            id: cid,
            title: String(it?.author || 'YouTube Channel'),
            avatar: normalizeYtAvatar(rawThumb, cid),
            subscriberCount:
              typeof it?.subCount === 'number'
                ? `${it.subCount.toLocaleString('id-ID')} subscriber`
                : undefined,
            description: it?.description ? String(it.description) : undefined,
            url: `https://www.youtube.com/channel/${cid}`,
          });
        }
        return out;
      })()
    );
  }

  if (pipedBase) {
    attempts.push(
      (async () => {
        const res = await fetchWithTimeout(
          `${pipedBase}/search?q=${encodeURIComponent(searchTerm)}&filter=channels`,
          { headers: { Accept: 'application/json' } },
          4500
        );
        if (!res.ok) return [];
        const data = await safeResponseJson<{ items?: any[] }>(res);
        const items = Array.isArray(data?.items) ? data.items : [];
        const out: ChannelSearchResult[] = [];
        for (const it of items.slice(0, 15)) {
          const urlPath = String(it?.url || '');
          const match = urlPath.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
          const cid = match?.[1] || '';
          if (!isValidYouTubeChannelId(cid)) continue;
          out.push({
            id: cid,
            title: String(it?.name || 'YouTube Channel'),
            avatar: normalizeYtAvatar(it?.thumbnail, cid),
            subscriberCount:
              typeof it?.subscribers === 'number' && it.subscribers >= 0
                ? `${it.subscribers.toLocaleString('id-ID')} subscriber`
                : undefined,
            description: it?.description ? String(it.description) : undefined,
            url: `https://www.youtube.com/channel/${cid}`,
          });
        }
        return out;
      })()
    );
  }

  const settled = await Promise.allSettled(attempts);
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value.length > 0) return s.value;
  }
  return [];
}

function searchLocalPresetChannels(queryText: string): ChannelSearchResult[] {
  const q = queryText.toLowerCase().trim();
  if (!q) return [];
  const matches: ChannelSearchResult[] = [];
  for (const entry of Object.values(PRESET_CHANNELS)) {
    const ch = entry.channel;
    const hay = `${ch.title} ${ch.handle || ''} ${ch.description || ''}`.toLowerCase();
    if (hay.includes(q)) {
      matches.push({
        id: ch.id,
        title: ch.title,
        handle: ch.handle,
        avatar: ch.avatar || `https://avatar.vercel.sh/${ch.id}?size=120`,
        description: ch.description,
        url: ch.url,
      });
    }
  }
  return matches;
}

export async function searchYouTubeChannels(queryText: string): Promise<ChannelSearchResult[]> {
  const cleaned = queryText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!cleaned) return [];

  const cacheKey = cleaned.toLowerCase();
  const cached = channelSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && cached.results.length > 0) {
    return cached.results;
  }

  const inFlight = pendingChannelSearches.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async (): Promise<ChannelSearchResult[]> => {
    const deadlineAt = Date.now() + 8500;
    const budgetMs = (preferredMs: number) =>
      Math.max(1000, Math.min(preferredMs, deadlineAt - Date.now()));

    const results: ChannelSearchResult[] = [];
    const seenIds = new Set<string>();
    let lastError: Error | null = null;
    let hadSuccessfulFetch = false;

    const pushUnique = (items: ChannelSearchResult[]) => {
      for (const item of items) {
        if (!isValidYouTubeChannelId(item.id) || seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        results.push(item);
        if (results.length >= 20) break;
      }
    };

    const isDirectChannelId = VALID_CHANNEL_ID_RE.test(cleaned);
    const isYouTubeUrl = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)?(?:youtube\.com|youtu\.be)\//i.test(cleaned);
    const isSingleHandle = /^@[a-zA-Z0-9_.-]{2,}$/.test(cleaned);

    // Exact Channel ID or YouTube URL: resolve directly
    if (isDirectChannelId || isYouTubeUrl) {
      try {
        const resolved = await resolveYouTubeChannel(cleaned);
        const feed = await fetchChannelRss(resolved.channelId, 1);
        hadSuccessfulFetch = true;
        if (feed.channel?.id) {
          pushUnique([
            {
              id: feed.channel.id,
              title: feed.channel.title || resolved.title || 'YouTube Channel',
              handle: feed.channel.handle || resolved.handle,
              avatar: feed.channel.avatar || `https://avatar.vercel.sh/${feed.channel.id}?size=120`,
              description: feed.channel.description,
              url: feed.channel.url || `https://www.youtube.com/channel/${feed.channel.id}`,
            },
          ]);
        }
        if (results.length > 0) {
          channelSearchCache.set(cacheKey, {
            results,
            expiresAt: Date.now() + 5 * 60 * 1000,
          });
          pruneCacheMap(channelSearchCache, 120);
          return results;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : lastError;
      }
    }

    let searchTerm = isSingleHandle ? cleaned.slice(1) : cleaned;
    if (isYouTubeUrl) {
      const handleMatch = cleaned.replace(/%40/gi, '@').match(/youtube\.com\/(@[^/\s?#&]+)/i);
      const customMatch = cleaned.match(/youtube\.com\/(?:c|user)\/([^/\s?#&]+)/i);
      const slug = handleMatch?.[1] || customMatch?.[1];
      if (slug) {
        searchTerm = safeDecodeURIComponent(slug.replace(/^@/, ''));
      }
    }

    const directHandlePromise: Promise<ChannelSearchResult | null> = isSingleHandle
      ? (async () => {
          try {
            const resolved = await resolveYouTubeChannel(cleaned);
            const preset = PRESET_CHANNELS[resolved.channelId]?.channel;
            return {
              id: resolved.channelId,
              title: resolved.title || preset?.title || cleaned,
              handle: resolved.handle || cleaned,
              avatar:
                preset?.avatar || `https://avatar.vercel.sh/${resolved.channelId}?size=120`,
              description: preset?.description,
              url: `https://www.youtube.com/channel/${resolved.channelId}`,
            };
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null);

    // Tier 1: Direct InnerTube channel-filtered HTTP search (fast, parallel with @handle resolution if needed)
    const [tier1, directHandleResult] = await Promise.all([
      searchChannelsViaInnerTubeHttp(searchTerm, true, budgetMs(4200)),
      directHandlePromise,
    ]);

    if (directHandleResult) {
      hadSuccessfulFetch = true;
      pushUnique([directHandleResult]);
    }
    if (tier1.ok) {
      hadSuccessfulFetch = true;
      pushUnique(tier1.results);
    } else if (tier1.error) {
      lastError = tier1.error;
    }

    // Tier 2 + Tier 3 in parallel when Tier 1 returned no channels and budget remains
    if (results.length === 0 && deadlineAt - Date.now() > 900) {
      const [tier2, tier3] = await Promise.all([
        searchChannelsViaInnertubeLib(searchTerm, budgetMs(4000)),
        searchChannelsViaHtmlPage(searchTerm, budgetMs(4200)),
      ]);

      if (tier2.ok) {
        hadSuccessfulFetch = true;
        pushUnique(tier2.results);
      } else if (tier2.error) {
        lastError = tier2.error;
      }

      if (tier3.ok) {
        hadSuccessfulFetch = true;
        pushUnique(tier3.results);
      } else if (tier3.error) {
        lastError = tier3.error;
      }
    }

    // Tier 4: Unfiltered YouTube search (extracts channel cards + video author channels) & external mirror
    if (results.length === 0 && deadlineAt - Date.now() > 900) {
      const [unfiltered, external] = await Promise.all([
        searchChannelsViaInnerTubeHttp(searchTerm, false, budgetMs(3200)),
        searchChannelsViaExternalMirror(searchTerm),
      ]);
      if (unfiltered.ok) {
        hadSuccessfulFetch = true;
        pushUnique(unfiltered.results);
      } else if (unfiltered.error) {
        lastError = unfiltered.error;
      }
      if (external.length > 0) {
        hadSuccessfulFetch = true;
        pushUnique(external);
      }
    }

    // Tier 5: Single-word handle probe (e.g. "gadgetin" -> @gadgetin) + local presets fallback
    if (
      results.length === 0 &&
      !isSingleHandle &&
      !searchTerm.includes(' ') &&
      searchTerm.length >= 3 &&
      deadlineAt - Date.now() > 1000
    ) {
      try {
        const resolved = await resolveYouTubeChannel(`@${searchTerm}`);
        const feed = await fetchChannelRss(resolved.channelId, 1);
        hadSuccessfulFetch = true;
        if (feed.channel?.id) {
          pushUnique([
            {
              id: feed.channel.id,
              title: feed.channel.title || resolved.title || searchTerm,
              handle: feed.channel.handle || resolved.handle || `@${searchTerm}`,
              avatar: feed.channel.avatar || `https://avatar.vercel.sh/${feed.channel.id}?size=120`,
              description: feed.channel.description,
              url: feed.channel.url || `https://www.youtube.com/channel/${feed.channel.id}`,
            },
          ]);
        }
      } catch {
        // ignore handle probe miss
      }
    }

    if (results.length === 0) {
      const localMatches = searchLocalPresetChannels(searchTerm);
      if (localMatches.length > 0) {
        hadSuccessfulFetch = true;
        pushUnique(localMatches);
      }
    }

    if (results.length === 0 && !hadSuccessfulFetch && lastError) {
      throw lastError;
    }

    if (results.length > 0) {
      channelSearchCache.set(cacheKey, {
        results,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      pruneCacheMap(channelSearchCache, 120);
    }

    return results;
  })().finally(() => {
    pendingChannelSearches.delete(cacheKey);
  });

  pendingChannelSearches.set(cacheKey, promise);
  return promise;
}

function normalizeThumbnailUrl(rawUrl: string | undefined, videoId: string): string {
  const clean = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!clean) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  if (clean.startsWith('//')) return `https:${clean}`;
  if (clean.startsWith('/')) return `https://www.youtube.com${clean}`;
  return clean;
}

function extractDirectVideoIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (VALID_VIDEO_ID_RE.test(trimmed)) return trimmed;
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})(?:[&#\s]|$)/);
  if (watchMatch?.[1]) return watchMatch[1];
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})(?:[/?#\s]|$)/i);
  if (shortMatch?.[1]) return shortMatch[1];
  const pathMatch = trimmed.match(/youtube\.com\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]{11})(?:[/?#\s]|$)/i);
  if (pathMatch?.[1]) return pathMatch[1];
  return null;
}

function collectVideoRenderers(
  node: any,
  results: VideoSearchResult[],
  seenIds: Set<string>,
  idxRef: { current: number },
  depth = 0
): void {
  if (!node || typeof node !== 'object' || depth > 18 || results.length >= 24) return;

  if (Array.isArray(node)) {
    for (const item of node) {
      if (results.length >= 24) break;
      collectVideoRenderers(item, results, seenIds, idxRef, depth + 1);
    }
    return;
  }

  const vr = node.videoRenderer || node.compactVideoRenderer || node.gridVideoRenderer;
  if (vr && typeof vr === 'object') {
    const videoId = String(vr.videoId || vr.navigationEndpoint?.watchEndpoint?.videoId || '').trim();
    if (VALID_VIDEO_ID_RE.test(videoId) && !seenIds.has(videoId)) {
      seenIds.add(videoId);
      const idx = idxRef.current++;
      const title = extractYtText(vr.title) || 'Untitled Video';
      const thumbs = vr.thumbnail?.thumbnails;
      const rawThumb =
        Array.isArray(thumbs) && thumbs.length > 0
          ? String(thumbs[thumbs.length - 1]?.url || '')
          : '';

      const ownerRun =
        vr.ownerText?.runs?.[0] ||
        vr.longBylineText?.runs?.[0] ||
        vr.shortBylineText?.runs?.[0];
      const browseEp =
        ownerRun?.navigationEndpoint?.browseEndpoint ||
        vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.navigationEndpoint
          ?.browseEndpoint;
      const rawChannelId = String(browseEp?.browseId || '').trim();
      const channelId = isValidYouTubeChannelId(rawChannelId) ? rawChannelId : '';
      const canonicalBaseUrl: string | undefined = browseEp?.canonicalBaseUrl;
      const channelHandle =
        canonicalBaseUrl && canonicalBaseUrl.startsWith('/@')
          ? canonicalBaseUrl.slice(1)
          : undefined;
      const channelUrl = canonicalBaseUrl
        ? `https://www.youtube.com${canonicalBaseUrl}`
        : channelId
        ? `https://www.youtube.com/channel/${channelId}`
        : undefined;
      const channelTitle =
        (typeof ownerRun?.text === 'string' && ownerRun.text.trim()) ||
        extractYtText(vr.ownerText || vr.longBylineText || vr.shortBylineText) ||
        'YouTube';
      const avatarThumbs =
        vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail
          ?.thumbnails;
      const rawAvatar =
        Array.isArray(avatarThumbs) && avatarThumbs.length > 0
          ? String(avatarThumbs[avatarThumbs.length - 1]?.url || '')
          : '';

      const publishedText = extractYtText(vr.publishedTimeText);
      const viewsText = extractYtText(vr.shortViewCountText || vr.viewCountText);
      const descText =
        extractYtText(vr.detailedMetadataSnippets?.[0]?.snippetText || vr.descriptionSnippet) || '';

      let duration = normalizeVideoDuration(extractYtText(vr.lengthText));
      if (!duration && Array.isArray(vr.thumbnailOverlays)) {
        for (const ov of vr.thumbnailOverlays) {
          const ts = ov?.thumbnailOverlayTimeStatusRenderer;
          const badgeTxt = extractYtText(ts?.text);
          if (badgeTxt) {
            duration = ts?.style === 'LIVE' ? 'LIVE' : normalizeVideoDuration(badgeTxt);
            break;
          }
        }
      }

      results.push({
        id: videoId,
        title,
        publishedAt: relativeTimeToIso(publishedText, idx),
        ...(publishedText ? { publishedText } : {}),
        thumbnail: normalizeThumbnailUrl(rawThumb, videoId),
        channelId,
        channelTitle,
        ...(channelAvatarOrFallback(rawAvatar, channelId)),
        ...(channelHandle ? { channelHandle } : {}),
        ...(channelUrl ? { channelUrl } : {}),
        description: descText,
        ...(viewsText ? { views: viewsText } : {}),
        ...(duration ? { duration } : {}),
      });
    }
    return;
  }

  const lockup = node.lockupViewModel;
  if (lockup && typeof lockup === 'object') {
    const videoId = String(
      lockup.contentId || lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId || ''
    ).trim();
    if (VALID_VIDEO_ID_RE.test(videoId) && !seenIds.has(videoId)) {
      seenIds.add(videoId);
      const idx = idxRef.current++;
      const title = lockup.metadata?.lockupMetadataViewModel?.title?.content || 'Untitled Video';
      const sources = lockup.contentImage?.thumbnailViewModel?.image?.sources || [];
      const rawThumb =
        Array.isArray(sources) && sources.length > 0
          ? String(sources[sources.length - 1]?.url || '')
          : '';
      const rows =
        lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel
          ?.metadataRows || [];
      const row0Parts = rows[0]?.metadataParts || [];
      const row1Parts = rows[1]?.metadataParts || [];
      const channelTitle = String(row0Parts[0]?.text?.content || 'YouTube').trim();
      const viewsText = row1Parts[0]?.text?.content
        ? String(row1Parts[0].text.content).trim()
        : undefined;
      const publishedText = row1Parts[1]?.text?.content
        ? String(row1Parts[1].text.content).trim()
        : undefined;
      const duration = extractLockupDuration(lockup);

      const channelEp =
        lockup.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.rendererContext
          ?.commandContext?.onTap?.innertubeCommand?.browseEndpoint;
      const rawChannelId = String(channelEp?.browseId || '').trim();
      const channelId = isValidYouTubeChannelId(rawChannelId) ? rawChannelId : '';
      const avatarSources =
        lockup.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.avatar
          ?.avatarViewModel?.image?.sources || [];
      const rawAvatar =
        Array.isArray(avatarSources) && avatarSources.length > 0
          ? String(avatarSources[avatarSources.length - 1]?.url || '')
          : '';

      results.push({
        id: videoId,
        title,
        publishedAt: relativeTimeToIso(publishedText, idx),
        ...(publishedText ? { publishedText } : {}),
        thumbnail: normalizeThumbnailUrl(rawThumb, videoId),
        channelId,
        channelTitle,
        ...(channelAvatarOrFallback(rawAvatar, channelId)),
        description: '',
        ...(viewsText ? { views: viewsText } : {}),
        ...(duration ? { duration } : {}),
      });
    }
    return;
  }

  for (const key of Object.keys(node)) {
    if (results.length >= 24) break;
    const val = node[key];
    if (val && typeof val === 'object') {
      collectVideoRenderers(val, results, seenIds, idxRef, depth + 1);
    }
  }
}

function channelAvatarOrFallback(
  rawAvatar: string,
  channelId: string
): { channelAvatar?: string } {
  if (rawAvatar) {
    return { channelAvatar: normalizeYtAvatar(rawAvatar, channelId || 'yt') };
  }
  if (channelId) {
    return { channelAvatar: `https://avatar.vercel.sh/${channelId}?size=96` };
  }
  return {};
}

async function searchVideosViaInnerTubeHttp(
  searchTerm: string,
  timeoutMs = 5000
): Promise<{ ok: boolean; results: VideoSearchResult[]; error?: Error }> {
  const clients = [
    {
      clientName: 'WEB',
      clientVersion: '2.20250201.00.00',
      clientHeaderId: '1',
      origin: 'https://www.youtube.com',
    },
    {
      clientName: 'MWEB',
      clientVersion: '2.20250201.00.00',
      clientHeaderId: '2',
      origin: 'https://m.youtube.com',
    },
  ];

  let lastErr: Error | undefined;
  for (const cfg of clients) {
    try {
      const res = await fetchWithTimeout(
        'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Language': 'id,en-US,en;q=0.9',
            Origin: cfg.origin,
            Referer: `${cfg.origin}/`,
            'X-YouTube-Client-Name': cfg.clientHeaderId,
            'X-YouTube-Client-Version': cfg.clientVersion,
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: cfg.clientName,
                clientVersion: cfg.clientVersion,
                hl: 'id',
                gl: 'ID',
              },
            },
            query: searchTerm,
            params: 'EgIQAQ==',
          }),
        },
        timeoutMs
      );

      if (!res.ok) {
        lastErr = new Error(`YouTube video search merespons status ${res.status}`);
        continue;
      }

      const data = await safeResponseJson<any>(res);
      if (!data || data.error) {
        lastErr = new Error(
          data?.error?.message
            ? String(data.error.message)
            : 'Respons pencarian video YouTube tidak valid'
        );
        continue;
      }

      const found: VideoSearchResult[] = [];
      const seen = new Set<string>();
      collectVideoRenderers(data?.contents ?? data, found, seen, { current: 0 });
      return { ok: true, results: found };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error('Gagal menghubungi pencarian video YouTube');
    }
  }

  return {
    ok: false,
    results: [],
    error: lastErr || new Error('Gagal menghubungi pencarian video YouTube'),
  };
}

async function searchVideosViaInnertubeLib(
  searchTerm: string,
  timeoutMs = 5000
): Promise<{ ok: boolean; results: VideoSearchResult[]; error?: Error }> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const yt = await getSharedInnertubeBase();
    const search = await Promise.race([
      yt.search(searchTerm, { type: 'video' }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Batas waktu pencarian video Innertube tercapai')),
          timeoutMs
        );
      }),
    ]);

    const ytResults = Array.isArray((search as any)?.results) ? (search as any).results : [];
    const found: VideoSearchResult[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < ytResults.length && found.length < 24; i++) {
      const item = ytResults[i];
      const videoId = String(item?.video_id || item?.id || '').trim();
      if (!VALID_VIDEO_ID_RE.test(videoId) || seen.has(videoId)) continue;
      seen.add(videoId);

      const title = String(item?.title?.text || item?.title?.toString?.() || 'Untitled Video').trim();
      const rawChannelId = String(item?.author?.id || '').trim();
      const channelId = isValidYouTubeChannelId(rawChannelId) ? rawChannelId : '';
      const channelTitle = String(item?.author?.name || 'YouTube').trim();
      const authorThumb = Array.isArray(item?.author?.thumbnails)
        ? String(item.author.thumbnails[0]?.url || '')
        : '';
      const thumbs = Array.isArray(item?.thumbnails) ? item.thumbnails : [];
      const rawThumb = thumbs.length > 0 ? String(thumbs[0]?.url || '') : '';
      const publishedText = item?.published?.text ? String(item.published.text).trim() : undefined;
      const views =
        item?.short_view_count?.text || item?.view_count?.text
          ? String(item?.short_view_count?.text || item?.view_count?.text).trim()
          : undefined;
      const duration = normalizeVideoDuration(
        item?.duration?.text ? String(item.duration.text) : undefined
      );
      const description = item?.description_snippet?.text
        ? String(item.description_snippet.text).trim()
        : '';

      found.push({
        id: videoId,
        title,
        publishedAt: relativeTimeToIso(publishedText, i),
        ...(publishedText ? { publishedText } : {}),
        thumbnail: normalizeThumbnailUrl(rawThumb, videoId),
        channelId,
        channelTitle,
        ...channelAvatarOrFallback(authorThumb, channelId),
        description,
        ...(views ? { views } : {}),
        ...(duration ? { duration } : {}),
      });
    }

    return { ok: true, results: found };
  } catch (err) {
    invalidateSharedInnertubeBase();
    return {
      ok: false,
      results: [],
      error: err instanceof Error ? err : new Error('Gagal mencari video via Innertube'),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function searchVideosViaHtmlPage(
  searchTerm: string,
  timeoutMs = 5500
): Promise<{ ok: boolean; results: VideoSearchResult[]; error?: Error }> {
  try {
    const htmlRes = await fetchWithTimeout(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}&sp=EgIQAQ%3D%3D`,
      {},
      timeoutMs
    );
    if (!htmlRes.ok) {
      return {
        ok: false,
        results: [],
        error: new Error(`Halaman pencarian video YouTube merespons ${htmlRes.status}`),
      };
    }
    const html = await htmlRes.text();
    const data = extractYtInitialDataJson(html);
    if (!data) {
      return {
        ok: false,
        results: [],
        error: new Error('Data hasil pencarian video YouTube tidak ditemukan'),
      };
    }
    const found: VideoSearchResult[] = [];
    const seen = new Set<string>();
    collectVideoRenderers(data?.contents ?? data, found, seen, { current: 0 });
    return { ok: true, results: found };
  } catch (err) {
    return {
      ok: false,
      results: [],
      error: err instanceof Error ? err : new Error('Gagal membuka halaman pencarian video YouTube'),
    };
  }
}

async function searchVideosViaExternalMirror(searchTerm: string): Promise<VideoSearchResult[]> {
  const pipedBase = process.env.PIPED_API_URL?.trim().replace(/\/+$/, '');
  const invidiousBase = process.env.INVIDIOUS_API_URL?.trim().replace(/\/+$/, '');
  if (!pipedBase && !invidiousBase) return [];

  const attempts: Promise<VideoSearchResult[]>[] = [];
  if (invidiousBase) {
    attempts.push(
      (async () => {
        const res = await fetchWithTimeout(
          `${invidiousBase}/api/v1/search?q=${encodeURIComponent(searchTerm)}&type=video`,
          { headers: { Accept: 'application/json' } },
          4500
        );
        if (!res.ok) return [];
        const items = await safeResponseJson<any[]>(res);
        if (!Array.isArray(items)) return [];
        const out: VideoSearchResult[] = [];
        for (let i = 0; i < items.length && out.length < 20; i++) {
          const it = items[i];
          const vid = String(it?.videoId || '').trim();
          if (!VALID_VIDEO_ID_RE.test(vid)) continue;
          const cid = isValidYouTubeChannelId(it?.authorId) ? String(it.authorId).trim() : '';
          const thumbs = Array.isArray(it?.videoThumbnails) ? it.videoThumbnails : [];
          const rawThumb = thumbs.length > 0 ? String(thumbs[0]?.url || '') : '';
          const publishedText = it?.publishedText ? String(it.publishedText) : undefined;
          const lenSec = typeof it?.lengthSeconds === 'number' ? it.lengthSeconds : 0;
          const duration =
            lenSec > 0
              ? `${Math.floor(lenSec / 60)}:${String(lenSec % 60).padStart(2, '0')}`
              : it?.liveNow
              ? 'LIVE'
              : undefined;
          out.push({
            id: vid,
            title: String(it?.title || 'Untitled Video'),
            publishedAt:
              typeof it?.published === 'number' && it.published > 0
                ? new Date(it.published * 1000).toISOString()
                : relativeTimeToIso(publishedText, i),
            ...(publishedText ? { publishedText } : {}),
            thumbnail: normalizeThumbnailUrl(rawThumb, vid),
            channelId: cid,
            channelTitle: String(it?.author || 'YouTube'),
            description: String(it?.description || ''),
            ...(typeof it?.viewCount === 'number'
              ? { views: `${it.viewCount.toLocaleString('id-ID')} x ditonton` }
              : {}),
            ...(duration ? { duration } : {}),
          });
        }
        return out;
      })()
    );
  }

  if (pipedBase) {
    attempts.push(
      (async () => {
        const res = await fetchWithTimeout(
          `${pipedBase}/search?q=${encodeURIComponent(searchTerm)}&filter=videos`,
          { headers: { Accept: 'application/json' } },
          4500
        );
        if (!res.ok) return [];
        const data = await safeResponseJson<{ items?: any[] }>(res);
        const items = Array.isArray(data?.items) ? data.items : [];
        const out: VideoSearchResult[] = [];
        for (let i = 0; i < items.length && out.length < 20; i++) {
          const it = items[i];
          const vidMatch = String(it?.url || '').match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          const vid = vidMatch?.[1] || '';
          if (!VALID_VIDEO_ID_RE.test(vid)) continue;
          const chMatch = String(it?.uploaderUrl || '').match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
          const cid = chMatch?.[1] || '';
          const publishedText = it?.uploadedDate ? String(it.uploadedDate) : undefined;
          const lenSec = typeof it?.duration === 'number' ? it.duration : 0;
          const duration =
            lenSec > 0
              ? `${Math.floor(lenSec / 60)}:${String(lenSec % 60).padStart(2, '0')}`
              : undefined;
          out.push({
            id: vid,
            title: String(it?.title || 'Untitled Video'),
            publishedAt:
              typeof it?.uploaded === 'number' && it.uploaded > 0
                ? new Date(it.uploaded).toISOString()
                : relativeTimeToIso(publishedText, i),
            ...(publishedText ? { publishedText } : {}),
            thumbnail: normalizeThumbnailUrl(it?.thumbnail, vid),
            channelId: cid,
            channelTitle: String(it?.uploaderName || 'YouTube'),
            ...(it?.uploaderAvatar ? { channelAvatar: String(it.uploaderAvatar) } : {}),
            description: String(it?.shortDescription || ''),
            ...(typeof it?.views === 'number'
              ? { views: `${it.views.toLocaleString('id-ID')} x ditonton` }
              : {}),
            ...(duration ? { duration } : {}),
          });
        }
        return out;
      })()
    );
  }

  const settled = await Promise.allSettled(attempts);
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value.length > 0) return s.value;
  }
  return [];
}

function searchLocalPresetVideos(queryText: string): VideoSearchResult[] {
  const q = queryText.toLowerCase().trim();
  if (!q) return [];
  const matches: VideoSearchResult[] = [];
  for (const entry of Object.values(PRESET_CHANNELS)) {
    for (const v of entry.videos) {
      const hay = `${v.title} ${v.channelTitle} ${v.description || ''}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          ...v,
          channelAvatar: entry.channel.avatar,
          channelHandle: entry.channel.handle,
          channelUrl: entry.channel.url,
        });
      }
    }
  }
  return matches;
}

export async function searchYouTubeVideos(queryText: string): Promise<VideoSearchResult[]> {
  const cleaned = queryText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!cleaned) return [];

  const cacheKey = cleaned.toLowerCase();
  const cached = videoSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && cached.results.length > 0) {
    return cached.results;
  }

  const inFlight = pendingVideoSearches.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async (): Promise<VideoSearchResult[]> => {
    const deadlineAt = Date.now() + 8500;
    const budgetMs = (preferredMs: number) =>
      Math.max(1000, Math.min(preferredMs, deadlineAt - Date.now()));

    const results: VideoSearchResult[] = [];
    const seenIds = new Set<string>();
    let lastError: Error | null = null;
    let hadSuccessfulFetch = false;

    const pushUnique = (items: VideoSearchResult[]) => {
      for (const item of items) {
        if (!VALID_VIDEO_ID_RE.test(item.id) || seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        results.push(item);
        if (results.length >= 24) break;
      }
    };

    // If user pasted a YouTube video link or video ID directly, fetch its exact metadata via oEmbed + channel resolution
    const directVideoId = extractDirectVideoIdFromInput(cleaned);
    let searchTerm = cleaned;
    if (directVideoId) {
      try {
        const [oembedRes, resolvedCh] = await Promise.allSettled([
          fetchWithTimeout(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(
              `https://www.youtube.com/watch?v=${directVideoId}`
            )}&format=json`,
            { headers: { Accept: 'application/json' } },
            3500
          ),
          resolveYouTubeChannel(`https://www.youtube.com/watch?v=${directVideoId}`),
        ]);

        let title = '';
        let authorName = 'YouTube';
        let authorUrl: string | undefined;
        let thumbUrl = `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`;

        if (oembedRes.status === 'fulfilled' && oembedRes.value.ok) {
          const oe = await safeResponseJson<any>(oembedRes.value);
          if (oe?.title) title = String(oe.title).trim();
          if (oe?.author_name) authorName = String(oe.author_name).trim();
          if (oe?.author_url) authorUrl = String(oe.author_url).trim();
          if (oe?.thumbnail_url) thumbUrl = String(oe.thumbnail_url).trim();
        }

        const resolvedChannelId =
          resolvedCh.status === 'fulfilled' ? resolvedCh.value.channelId : '';
        const resolvedTitle =
          resolvedCh.status === 'fulfilled' && resolvedCh.value.title
            ? resolvedCh.value.title
            : authorName;

        if (title) {
          hadSuccessfulFetch = true;
          searchTerm = title;
          pushUnique([
            {
              id: directVideoId,
              title,
              publishedAt: new Date().toISOString(),
              thumbnail: normalizeThumbnailUrl(thumbUrl, directVideoId),
              channelId: resolvedChannelId,
              channelTitle: resolvedTitle,
              ...(authorUrl ? { channelUrl: authorUrl } : {}),
              ...channelAvatarOrFallback('', resolvedChannelId),
              description: '',
            },
          ]);
        }
      } catch {
        // continue with regular search
      }
    }

    // Tier 1: Direct InnerTube HTTP video-filtered search
    const tier1 = await searchVideosViaInnerTubeHttp(searchTerm, budgetMs(4500));
    if (tier1.ok) {
      hadSuccessfulFetch = true;
      pushUnique(tier1.results);
    } else if (tier1.error) {
      lastError = tier1.error;
    }

    // Tier 2 + Tier 3 in parallel if Tier 1 returned no videos and time budget allows
    if (results.length === 0 && deadlineAt - Date.now() > 900) {
      const [tier2, tier3] = await Promise.all([
        searchVideosViaInnertubeLib(searchTerm, budgetMs(4000)),
        searchVideosViaHtmlPage(searchTerm, budgetMs(4200)),
      ]);

      if (tier2.ok) {
        hadSuccessfulFetch = true;
        pushUnique(tier2.results);
      } else if (tier2.error) {
        lastError = tier2.error;
      }

      if (tier3.ok) {
        hadSuccessfulFetch = true;
        pushUnique(tier3.results);
      } else if (tier3.error) {
        lastError = tier3.error;
      }
    }

    // Tier 4: External mirror fallback (Invidious / Piped) + local preset videos
    if (results.length === 0 && deadlineAt - Date.now() > 900) {
      const external = await searchVideosViaExternalMirror(searchTerm);
      if (external.length > 0) {
        hadSuccessfulFetch = true;
        pushUnique(external);
      }
    }

    if (results.length === 0) {
      const localMatches = searchLocalPresetVideos(searchTerm);
      if (localMatches.length > 0) {
        hadSuccessfulFetch = true;
        pushUnique(localMatches);
      }
    }

    if (results.length === 0 && !hadSuccessfulFetch && lastError) {
      throw lastError;
    }

    if (results.length > 0) {
      videoSearchCache.set(cacheKey, {
        results,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      pruneCacheMap(videoSearchCache, 120);
    }

    return results;
  })().finally(() => {
    pendingVideoSearches.delete(cacheKey);
  });

  pendingVideoSearches.set(cacheKey, promise);
  return promise;
}


