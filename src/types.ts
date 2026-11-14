export interface Channel {
  id: string; // YouTube Channel ID (UC...)
  title: string;
  handle?: string; // e.g. @mkbhd
  avatar?: string;
  description?: string;
  url: string;
  groupId: string; // ID of the group it belongs to
  addedAt: string;
  videoCount?: number;
}

export interface Video {
  id: string; // YouTube Video ID
  title: string;
  publishedAt: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  description: string;
  views?: string;
  duration?: string; // e.g. 14:20
}

export interface ChannelGroup {
  id: string;
  name: string;
  color?: string; // tailwind color token
  isDefault?: boolean;
}

export type PlayerMode = 'video' | 'audio';

export type NativeAudioStatus = 'checking' | 'available' | 'login_required' | 'live_stream' | 'unavailable';

export type VisualizerStyle = 'bars' | 'wave' | 'radar' | 'minimal';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface PlayerState {
  currentVideo: Video | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number; // 0 to 100
  isMuted: boolean;
  mode: PlayerMode;
  queue: Video[];
  sleepTimerMinutes: number | null; // null or minutes remaining
  sleepTimerExpiresAt: number | null; // timestamp ms
}

export interface PlaybackProgress {
  videoId: string;
  currentTime: number;
  duration: number;
  updatedAt: string;
}

export type PendingSyncTask =
  | { id: string; type: 'REFRESH_FEEDS'; createdAt: string }
  | { id: string; type: 'ADD_CHANNELS'; inputs: string[]; targetGroupId: string; createdAt: string };

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  videoIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface YouTubeChannelSearchResult {
  id: string;
  title: string;
  handle?: string;
  avatar: string;
  subscriberCount?: string;
  description?: string;
  url: string;
}

export interface YouTubeOAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: string;
  token_type?: string;
  scope?: string;
  client?: {
    client_id: string;
    client_secret: string;
  };
}

export interface AudioExtractorConfig {
  oauthTokens?: YouTubeOAuthTokens;
  cookies?: string;
  extractorUrl?: string;
  updatedAt?: string;
}
