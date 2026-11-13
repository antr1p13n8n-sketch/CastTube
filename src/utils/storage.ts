import { Channel, ChannelGroup, Video, ThemeMode, PlaybackProgress, PendingSyncTask, PlayerMode, Playlist } from '../types';

export const INITIAL_GROUPS: ChannelGroup[] = [
  { id: 'all', name: 'Semua Channel', isDefault: true },
  { id: 'tech', name: 'Teknologi & Gadget' },
  { id: 'podcast', name: 'Podcast & Talkshow' },
  { id: 'education', name: 'Edukasi & Sains' },
  { id: 'music', name: 'Musik & Santai' },
  { id: 'general', name: 'Umum' },
];

const LEGACY_CHANNEL_MIGRATION: Record<
  string,
  { id: string; title: string; avatar: string }
> = {
  UCBJycsmduP41z98B13IFzBQ: {
    id: 'UCBJycsmduvYEL83R_U4JriQ',
    title: 'Marques Brownlee',
    avatar:
      'https://yt3.googleusercontent.com/qu4TmIaYUlS41-dJ9gZ7DUR3nilvmB5_11i6OKSdvNnBNiyOusZP1bMN6ICnuxtjFBb6ioKgRQ=s160-c-k-c0x00ffffff-no-rj',
  },
  UCb229Z4w_2d3U5L9_5oWk4Q: {
    id: 'UC1dI4tO13ApuSX0QeX8pHng',
    title: 'GadgetIn',
    avatar:
      'https://yt3.googleusercontent.com/ytc/AIdro_m_WWs--JDXUyiAFrM3BsWiBRvU0-gh-giMdaAHv4LCbyA=s160-c-k-c0x00ffffff-no-rj',
  },
  'UCx_tM26W-W13b5_yv_wA0mA': {
    id: 'UCYk4LJI0Pr6RBDWowMm-KUw',
    title: 'Deddy Corbuzier',
    avatar:
      'https://yt3.googleusercontent.com/7k4jFbchFagHe6tmcont-mHuOGQrUjnbyh482MwIEFrobjT-uGiMss4qbiTMV74vp8OE3SuY=s160-c-k-c0x00ffffff-no-rj',
  },
};

const REAL_AVATAR_BY_ID: Record<string, string> = {
  UCBJycsmduvYEL83R_U4JriQ:
    'https://yt3.googleusercontent.com/qu4TmIaYUlS41-dJ9gZ7DUR3nilvmB5_11i6OKSdvNnBNiyOusZP1bMN6ICnuxtjFBb6ioKgRQ=s160-c-k-c0x00ffffff-no-rj',
  UC1dI4tO13ApuSX0QeX8pHng:
    'https://yt3.googleusercontent.com/ytc/AIdro_m_WWs--JDXUyiAFrM3BsWiBRvU0-gh-giMdaAHv4LCbyA=s160-c-k-c0x00ffffff-no-rj',
  'UCYk4LJI0Pr6RBDWowMm-KUw':
    'https://yt3.googleusercontent.com/7k4jFbchFagHe6tmcont-mHuOGQrUjnbyh482MwIEFrobjT-uGiMss4qbiTMV74vp8OE3SuY=s160-c-k-c0x00ffffff-no-rj',
  UCsXVk37bltHxD1rDPwtNM8Q:
    'https://yt3.googleusercontent.com/ytc/AIdro_n1Ribd7LwdP_qKtqWL3ZDfIgv9M1d6g78VwpHGXVR2Ir4=s160-c-k-c0x00ffffff-no-rj',
  UCSJ4gkVC6NrvII8umztf0Ow:
    'https://yt3.googleusercontent.com/REcZL_LGu0DaDaC-G7VIbN0uE_5l-i_dw6ZvOETRnY3pRhUmfkOq6C1MLephPZkV4VSzQAhEi_4=s160-c-k-c0x00ffffff-no-rj',
};

export const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'UCBJycsmduvYEL83R_U4JriQ',
    title: 'Marques Brownlee',
    handle: '@mkbhd',
    avatar: REAL_AVATAR_BY_ID['UCBJycsmduvYEL83R_U4JriQ'],
    description: 'MKBHD: Quality Tech Videos | YouTuber | Geek | Consumer Electronics | Tech Head | Internet Personality!',
    url: 'https://www.youtube.com/@mkbhd',
    groupId: 'tech',
    addedAt: '2026-11-01T10:00:00Z',
    videoCount: 15,
  },
  {
    id: 'UC1dI4tO13ApuSX0QeX8pHng',
    title: 'GadgetIn',
    handle: '@GadgetIn',
    avatar: REAL_AVATAR_BY_ID['UC1dI4tO13ApuSX0QeX8pHng'],
    description: 'Channel review gadget berbahasa Indonesia terlengkap dan terpercaya.',
    url: 'https://www.youtube.com/@GadgetIn',
    groupId: 'tech',
    addedAt: '2026-11-02T10:00:00Z',
    videoCount: 15,
  },
  {
    id: 'UCYk4LJI0Pr6RBDWowMm-KUw',
    title: 'Deddy Corbuzier',
    handle: '@corbuzier',
    avatar: REAL_AVATAR_BY_ID['UCYk4LJI0Pr6RBDWowMm-KUw'],
    description: 'CLOSETHEDOOR PODCAST.',
    url: 'https://www.youtube.com/@corbuzier',
    groupId: 'podcast',
    addedAt: '2026-11-03T10:00:00Z',
    videoCount: 15,
  },
  {
    id: 'UCsXVk37bltHxD1rDPwtNM8Q',
    title: 'Kurzgesagt – In a Nutshell',
    handle: '@kurzgesagt',
    avatar: REAL_AVATAR_BY_ID.UCsXVk37bltHxD1rDPwtNM8Q,
    description: 'Videos explaining things with optimistic nihilism.',
    url: 'https://www.youtube.com/@kurzgesagt',
    groupId: 'education',
    addedAt: '2026-11-04T10:00:00Z',
    videoCount: 15,
  },
  {
    id: 'UCSJ4gkVC6NrvII8umztf0Ow',
    title: 'Lofi Girl',
    handle: '@LofiGirl',
    avatar: REAL_AVATAR_BY_ID.UCSJ4gkVC6NrvII8umztf0Ow,
    description: 'Peaceful lofi hip hop radio - beats to relax/study to.',
    url: 'https://www.youtube.com/@LofiGirl',
    groupId: 'music',
    addedAt: '2026-11-05T10:00:00Z',
    videoCount: 15,
  },
];

export const INITIAL_VIDEOS: Video[] = [
  {
    id: 'i8nGN61QtYg',
    title: 'MAHFUD MD: GIBRAN HARUS MUNDUR‼️',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    thumbnail: 'https://i2.ytimg.com/vi/i8nGN61QtYg/hqdefault.jpg',
    channelId: 'UCYk4LJI0Pr6RBDWowMm-KUw',
    channelTitle: 'Deddy Corbuzier',
    description: 'Diskusi mendalam di Close The Door Podcast membahas perkembangan hukum dan kebijakan publik terkini.',
    views: '110.657',
  },
  {
    id: 'ELIwF3VFPyQ',
    title: 'Lagi lagi mendingin iPhone... Unboxing Xiaomi 18 PRO MAX!!!',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
    thumbnail: 'https://i2.ytimg.com/vi/ELIwF3VFPyQ/hqdefault.jpg',
    channelId: 'UC1dI4tO13ApuSX0QeX8pHng',
    channelTitle: 'GadgetIn',
    description: 'David GadgetIn mengupas tuntas desain, kamera, performa chipset, dan fitur smartphone flagship terbaru.',
    views: '1.568.300',
  },
  {
    id: 'hdMszZ2ah5Q',
    title: "Macbook PROLED Review: It's Not About That",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    thumbnail: 'https://i1.ytimg.com/vi/hdMszZ2ah5Q/hqdefault.jpg',
    channelId: 'UCBJycsmduvYEL83R_U4JriQ',
    channelTitle: 'Marques Brownlee',
    description: 'Deep dive into modern laptop display hardware and everyday creator performance.',
    views: '5.057.265',
  },
  {
    id: 'Y1vEGsnNYek',
    title: 'What Is Food Fortification?',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
    thumbnail: 'https://i2.ytimg.com/vi/Y1vEGsnNYek/hqdefault.jpg',
    channelId: 'UCsXVk37bltHxD1rDPwtNM8Q',
    channelTitle: 'Kurzgesagt – In a Nutshell',
    description: 'How enriching everyday staple foods transformed global public health.',
    views: '291.446',
  },
  {
    id: 'jfKfPfyJRdk',
    title: 'lofi hip hop radio 📚 - beats to relax/study to',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    channelId: 'UCSJ4gkVC6NrvII8umztf0Ow',
    channelTitle: 'Lofi Girl',
    description: '24/7 relaxing lofi beats to study, chill, focus, code or sleep peacefully without distraction.',
    views: 'Live',
    duration: 'Live Stream',
  },
  {
    id: '_x58r9TBois',
    title: 'Meta VR Glasses: What Vision Pro 2 COULD Have Been!',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
    thumbnail: 'https://i4.ytimg.com/vi/_x58r9TBois/hqdefault.jpg',
    channelId: 'UCBJycsmduvYEL83R_U4JriQ',
    channelTitle: 'Marques Brownlee',
    description: 'Hands-on with lightweight spatial computing and smart glasses hardware.',
    views: '7.251.665',
  },
  {
    id: 'y60ZgnnzkMw',
    title: 'Nothing yg harganya something 🙂',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 85).toISOString(),
    thumbnail: 'https://i2.ytimg.com/vi/y60ZgnnzkMw/hqdefault.jpg',
    channelId: 'UC1dI4tO13ApuSX0QeX8pHng',
    channelTitle: 'GadgetIn',
    description: 'Review jujur desain, kamera, performa, dan value-for-money untuk pengguna harian.',
    views: '635.756',
  },
];

const STORAGE_KEYS = {
  GROUPS: 'casttube_groups_v1',
  CHANNELS: 'casttube_channels_v1',
  VIDEOS: 'casttube_videos_v1',
  THEME: 'casttube_theme_v1',
  FAVORITES: 'casttube_favorites_v1',
  PROGRESS: 'casttube_playback_progress_v1',
  LAST_VIDEO: 'casttube_last_video_v1',
  PENDING_SYNC: 'casttube_pending_sync_v1',
  PLAYER_SESSION: 'casttube_player_session_v1',
  PLAYLISTS: 'casttube_playlists_v1',
  PLAYED_VIDEOS: 'casttube_played_videos_v1',
};

export function loadGroups(): ChannelGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GROUPS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error reading groups from storage', e);
  }
  return INITIAL_GROUPS;
}

export function saveGroups(groups: ChannelGroup[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
  } catch (e) {
    console.error('Failed to save groups', e);
  }
}

export function loadChannels(): Channel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHANNELS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const seen = new Set<string>();
        const migrated: Channel[] = [];
        for (const ch of parsed as Channel[]) {
          if (!ch || typeof ch.id !== 'string') continue;
          const leg = LEGACY_CHANNEL_MIGRATION[ch.id];
          const nextId = leg ? leg.id : ch.id;
          if (seen.has(nextId)) continue;
          seen.add(nextId);
          migrated.push({
            ...ch,
            id: nextId,
            title: leg ? leg.title : ch.title,
            avatar: REAL_AVATAR_BY_ID[nextId] || leg?.avatar || ch.avatar,
          });
        }
        return migrated;
      }
    }
  } catch (e) {
    console.warn('Error reading channels from storage', e);
  }
  return INITIAL_CHANNELS;
}

export function saveChannels(channels: Channel[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(channels));
  } catch (e) {
    console.error('Failed to save channels', e);
  }
}

export function loadVideos(): Video[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VIDEOS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return (parsed as Video[]).map((v) => {
          const leg = LEGACY_CHANNEL_MIGRATION[v.channelId];
          return leg ? { ...v, channelId: leg.id, channelTitle: leg.title } : v;
        });
      }
    }
  } catch (e) {
    console.warn('Error reading videos from storage', e);
  }
  return INITIAL_VIDEOS;
}

export function saveVideos(videos: Video[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.VIDEOS, JSON.stringify(videos));
  } catch (e) {
    console.error('Failed to save videos', e);
  }
}

export function loadThemePreference(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode;
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  } catch {
    // fallback
  }
  return 'system';
}

export function saveThemePreference(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, mode);
  } catch {
    // ignore
  }
}

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function saveFavorites(favs: string[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
  } catch {
    // ignore
  }
}

export function loadPlaybackProgressMap(): Record<string, PlaybackProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveVideoPlaybackProgress(
  videoId: string,
  currentTime: number,
  duration: number
): Record<string, PlaybackProgress> {
  const map = loadPlaybackProgressMap();
  if (videoId && currentTime >= 0) {
    map[videoId] = {
      videoId,
      currentTime,
      duration,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(map));
    } catch {
      // ignore quota error
    }
  }
  return map;
}

export function loadLastVideoId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_VIDEO);
  } catch {
    return null;
  }
}

export function saveLastVideoId(videoId: string | null) {
  try {
    if (videoId) {
      localStorage.setItem(STORAGE_KEYS.LAST_VIDEO, videoId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.LAST_VIDEO);
    }
  } catch {
    // ignore
  }
}

export function loadPendingSyncQueue(): PendingSyncTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function savePendingSyncQueue(tasks: PendingSyncTask[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(tasks));
  } catch {
    // ignore
  }
}

export interface PlayerSessionState {
  playerMode: PlayerMode;
  activeTab: 'feed' | 'player';
  wasPlaying: boolean;
}

export function loadPlayerSessionState(): PlayerSessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLAYER_SESSION);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          playerMode: parsed.playerMode === 'video' ? 'video' : 'audio',
          activeTab: parsed.activeTab === 'player' ? 'player' : 'feed',
          wasPlaying: Boolean(parsed.wasPlaying),
        };
      }
    }
  } catch {
    // ignore
  }
  return { playerMode: 'audio', activeTab: 'feed', wasPlaying: false };
}

export function savePlayerSessionState(state: PlayerSessionState) {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYER_SESSION, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function savePlaylists(playlists: Playlist[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
  } catch {
    // ignore
  }
}

export function loadPlayedVideoIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLAYED_VIDEOS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function savePlayedVideoIds(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYED_VIDEOS, JSON.stringify(ids));
  } catch {
    // ignore
  }
}
