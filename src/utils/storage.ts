import { Channel, ChannelGroup, Video, ThemeMode, PlaybackProgress, PendingSyncTask, PlayerMode, Playlist } from '../types';

export const INITIAL_GROUPS: ChannelGroup[] = [
  { id: 'all', name: 'Semua Channel', isDefault: true },
  { id: 'tech', name: 'Teknologi & Gadget' },
  { id: 'podcast', name: 'Podcast & Talkshow' },
  { id: 'education', name: 'Edukasi & Sains' },
  { id: 'music', name: 'Musik & Santai' },
  { id: 'general', name: 'Umum' },
];

export const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'UCBJycsmduP41z98B13IFzBQ',
    title: 'Marques Brownlee (MKBHD)',
    handle: '@mkbhd',
    avatar: 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDyj-kOTuxnRghHoDZFi5TaPh-rSYWh7IG=s176-c-k-c0x00ffffff-no-rj',
    description: 'Quality Tech Videos | YouTuber | Geek',
    url: 'https://www.youtube.com/@mkbhd',
    groupId: 'tech',
    addedAt: '2026-11-01T10:00:00Z',
    videoCount: 15,
  },
  {
    id: 'UCb229Z4w_2d3U5L9_5oWk4Q',
    title: 'GadgetIn',
    handle: '@GadgetIn',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_k6T6L7H_bB35T7z3YvP3L_qf9f6p3j0f2Z0Y4_=s176-c-k-c0x00ffffff-no-rj',
    description: 'Channel review gadget berbahasa Indonesia terlengkap dan terpercaya.',
    url: 'https://www.youtube.com/@GadgetIn',
    groupId: 'tech',
    addedAt: '2026-11-02T10:00:00Z',
    videoCount: 12,
  },
  {
    id: 'UCx_tM26W-W13b5_yv_wA0mA',
    title: 'Deddy Corbuzier (Close The Door)',
    handle: '@corbuzier',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_nFmH-Qz8c-6J9f3e4o5y8x1q2w3e4r5t6y7u8i=s176-c-k-c0x00ffffff-no-rj',
    description: 'Podcast Nomor 1 di Indonesia. Close The Door.',
    url: 'https://www.youtube.com/@corbuzier',
    groupId: 'podcast',
    addedAt: '2026-11-03T10:00:00Z',
    videoCount: 10,
  },
  {
    id: 'UCsXVk37bltHxD1rDPwtNM8Q',
    title: 'Kurzgesagt – In a Nutshell',
    handle: '@kurzgesagt',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_k6Z4s3e2w1q0p9o8i7u6y5t4r3e2w1q0p9o8i7=s176-c-k-c0x00ffffff-no-rj',
    description: 'Videos explaining things with optimistic nihilism.',
    url: 'https://www.youtube.com/@kurzgesagt',
    groupId: 'education',
    addedAt: '2026-11-04T10:00:00Z',
    videoCount: 8,
  },
  {
    id: 'UCSJ4gkVC6NrvII8umztf0Ow',
    title: 'Lofi Girl',
    handle: '@LofiGirl',
    avatar: 'https://yt3.googleusercontent.com/u5jSuhq12XF8F98_j87s=s176-c-k-c0x00ffffff-no-rj',
    description: 'Peaceful lofi hip hop radio - beats to relax/study to.',
    url: 'https://www.youtube.com/@LofiGirl',
    groupId: 'music',
    addedAt: '2026-11-05T10:00:00Z',
    videoCount: 6,
  },
];

export const INITIAL_VIDEOS: Video[] = [
  {
    id: '3JZ_D3ELwOQ',
    title: 'PODCAST: Masa Depan Artificial Intelligence & Tantangan Manusia Modern',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    thumbnail: 'https://i.ytimg.com/vi/3JZ_D3ELwOQ/hqdefault.jpg',
    channelId: 'UCx_tM26W-W13b5_yv_wA0mA',
    channelTitle: 'Deddy Corbuzier (Close The Door)',
    description: 'Diskusi mendalam bersama praktisi AI terkemuka tentang pergeseran industri kerja dan etika mesin pintar.',
    views: '2.140.000',
    duration: '1:12:40',
  },
  {
    id: 'fJ9rUzIMcZQ',
    title: 'Review Smartphone Flagship Terbaru Tahun Ini: Beneran Gila!',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
    thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg',
    channelId: 'UCb229Z4w_2d3U5L9_5oWk4Q',
    channelTitle: 'GadgetIn',
    description: 'David GadgetIn mengupas tuntas peningkatan kamera, performa chipset, dan daya tahan baterai ponsel unggulan.',
    views: '985.200',
    duration: '16:25',
  },
  {
    id: 'L_LUpnjgPso',
    title: 'M4 Mac Mini Review: Apple Did The Impossible!',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    thumbnail: 'https://i.ytimg.com/vi/L_LUpnjgPso/hqdefault.jpg',
    channelId: 'UCBJycsmduP41z98B13IFzBQ',
    channelTitle: 'Marques Brownlee (MKBHD)',
    description: 'The redesigned M4 Mac mini is tiny, powerful, and remarkably cheap. Has Apple made the ultimate desktop value?',
    views: '3.890.000',
    duration: '14:18',
  },
  {
    id: 'h6fcK_fRYaI',
    title: 'What If We Detonated All Nuclear Bombs at Once?',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
    thumbnail: 'https://i.ytimg.com/vi/h6fcK_fRYaI/hqdefault.jpg',
    channelId: 'UCsXVk37bltHxD1rDPwtNM8Q',
    channelTitle: 'Kurzgesagt – In a Nutshell',
    description: 'If you gathered all ~15,000 nuclear weapons on Earth and detonated them in one spot, what happens to atmosphere and crust?',
    views: '8.400.000',
    duration: '11:08',
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
    id: 'dQw4w9WgXcQ',
    title: 'The Real Truth About Modern Smartphone Batteries',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
    thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    channelId: 'UCBJycsmduP41z98B13IFzBQ',
    channelTitle: 'Marques Brownlee (MKBHD)',
    description: 'Deep dive into why phone batteries degrade and the actual science behind fast charging cycles.',
    views: '1.240.000',
    duration: '18:42',
  },
  {
    id: 'kJQP7kiw5Fk',
    title: 'Beli Mystery Box Elektronik 10 Juta: Dapet Apa Aja?',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 85).toISOString(),
    thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
    channelId: 'UCb229Z4w_2d3U5L9_5oWk4Q',
    channelTitle: 'GadgetIn',
    description: 'Eksperimen belanja seru membuka kotak misteri belanja online dengan nominal fantastis.',
    views: '1.450.000',
    duration: '21:05',
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
    if (raw) {
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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
