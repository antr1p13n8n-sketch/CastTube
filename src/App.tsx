import { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue, lazy, Suspense } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import {
  Folder,
  Radio,
  Tv,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Sparkles,
  Clipboard,
  Trash2,
  Check,
  AlertCircle,
  X,
  Download,
  Loader2,
  Play,
  Plus,
} from 'lucide-react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

type FirestoreServiceModule = typeof import('./services/firestoreService');
let firestoreServicePromise: Promise<FirestoreServiceModule> | null = null;
function loadFirestoreService(): Promise<FirestoreServiceModule> {
  if (!firestoreServicePromise) {
    firestoreServicePromise = import('./services/firestoreService');
  }
  return firestoreServicePromise;
}
import {
  Channel,
  ChannelGroup,
  Video,
  PlayerMode,
  NativeAudioStatus,
  ThemeMode,
  PlaybackProgress,
  PendingSyncTask,
  Playlist,
  BackgroundAudioSettings,
} from './types';
import {
  loadGroups,
  saveGroups,
  loadChannels,
  saveChannels,
  loadVideos,
  saveVideos,
  loadThemePreference,
  saveThemePreference,
  loadPlaybackProgressMap,
  saveVideoPlaybackProgress,
  loadLastVideoId,
  saveLastVideoId,
  loadLastVideo,
  saveLastVideo,
  loadPendingSyncQueue,
  savePendingSyncQueue,
  loadPlayerSessionState,
  savePlayerSessionState,
  loadPlaylists,
  savePlaylists,
  loadPlayedVideoIds,
  savePlayedVideoIds,
  loadLastFeedSyncAt,
  saveLastFeedSyncAt,
  loadBackgroundAudioSettings,
  saveBackgroundAudioSettings,
} from './utils/storage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useBackgroundAudio } from './hooks/useBackgroundAudio';
import { useFloatingMiniPlayer } from './hooks/useFloatingMiniPlayer';
import { useAudioDownload } from './hooks/useAudioDownload';
import {
  buildExtractorHeaders,
  syncExtractorConfigToServer,
  ensureAutoYouTubeCookies,
} from './utils/extractorConfig';
import { parseJsonSafely, buildHttpErrorMessage } from './utils/safeJson';
import {
  getPlaybackClockSnapshot,
  resetPlaybackClock,
  setPlaybackClock,
} from './utils/playbackClock';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { VideoCard } from './components/VideoCard';
import { PodcastPlayer } from './components/PodcastPlayer';
import { VideoPlayerView } from './components/VideoPlayerView';
import { MiniPlayerBar } from './components/MiniPlayerBar';
import { YouTubePlayer } from './components/YouTubePlayer';
import { NativeAudioPlayer, NativeAudioHandle } from './components/NativeAudioPlayer';

const AddChannelModal = lazy(() =>
  import('./components/AddChannelModal').then((m) => ({ default: m.AddChannelModal }))
);
const GroupManagerModal = lazy(() =>
  import('./components/GroupManagerModal').then((m) => ({ default: m.GroupManagerModal }))
);
const ChannelDrawer = lazy(() =>
  import('./components/ChannelDrawer').then((m) => ({ default: m.ChannelDrawer }))
);
const PlaylistModal = lazy(() =>
  import('./components/PlaylistModal').then((m) => ({ default: m.PlaylistModal }))
);
const AudioExtractorModal = lazy(() =>
  import('./components/AudioExtractorModal').then((m) => ({ default: m.AudioExtractorModal }))
);
const BackgroundAudioModal = lazy(() =>
  import('./components/BackgroundAudioModal').then((m) => ({ default: m.BackgroundAudioModal }))
);

const FEED_PAGE_SIZE = 36;

export default function App() {
  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Theme State (System, Dark, Light)
  const [themePreference, setThemePreference] = useState<ThemeMode>(loadThemePreference);

  // Single-pass initial localStorage hydration to avoid repeated JSON.parse on startup
  const initialBootRef = useRef<{
    videos: Video[];
    progressMap: Record<string, PlaybackProgress>;
    lastVideoId: string | null;
    session: ReturnType<typeof loadPlayerSessionState>;
    bgAudio: BackgroundAudioSettings;
    initialVideo: Video | null;
    initialTime: number;
    initialDuration: number;
  } | null>(null);
  if (!initialBootRef.current) {
    const bootVideos = loadVideos();
    const bootProgress = loadPlaybackProgressMap();
    const bootLastId = loadLastVideoId();
    const bootLastVideoData = loadLastVideo();
    const bootSession = loadPlayerSessionState();
    const bootBgAudio = loadBackgroundAudioSettings();
    const bootVideo =
      (bootLastId ? bootVideos.find((item) => item.id === bootLastId) : undefined) ||
      (bootLastId && bootLastVideoData?.id === bootLastId ? bootLastVideoData : undefined) ||
      bootLastVideoData ||
      (bootVideos.length > 0 ? bootVideos[0] : null);
    const initialTime = bootVideo ? bootProgress[bootVideo.id]?.currentTime || 0 : 0;
    const initialDuration = bootVideo ? bootProgress[bootVideo.id]?.duration || 0 : 0;
    resetPlaybackClock(bootVideo?.id || null, initialTime, initialDuration);
    initialBootRef.current = {
      videos: bootVideos,
      progressMap: bootProgress,
      lastVideoId: bootLastId,
      session: bootSession,
      bgAudio: bootBgAudio,
      initialVideo: bootVideo,
      initialTime,
      initialDuration,
    };
  }
  const boot = initialBootRef.current;

  // Core Data States
  const [groups, setGroups] = useState<ChannelGroup[]>(loadGroups);
  const [channels, setChannels] = useState<Channel[]>(loadChannels);
  const [videos, setVideos] = useState<Video[]>(boot.videos);
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists);
  const [playedVideoIds, setPlayedVideoIds] = useState<string[]>(loadPlayedVideoIds);

  const latestStateRef = useRef({
    groups,
    channels,
    videos,
    playedVideoIds,
    themePreference,
  });
  latestStateRef.current = {
    groups,
    channels,
    videos,
    playedVideoIds,
    themePreference,
  };

  // Active Filter States
  const [activeGroupId, setActiveGroupId] = useState<string>('all');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [playStatusFilter, setPlayStatusFilter] = useState<'all' | 'unplayed' | 'played'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [visibleCount, setVisibleCount] = useState<number>(FEED_PAGE_SIZE);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'player'>(boot.session.activeTab);

  // Connectivity & Background Sync States
  const isOnline = useOnlineStatus();
  const [pendingSyncQueue, setPendingSyncQueue] = useState<PendingSyncTask[]>(loadPendingSyncQueue);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState<boolean>(false);
  const [isAutoCheckingGroup, setIsAutoCheckingGroup] = useState<boolean>(false);
  const [lastSyncedTimeLabel, setLastSyncedTimeLabel] = useState<string | null>(null);
  const [feedUpdateNotice, setFeedUpdateNotice] = useState<{
    count: number;
    groupName: string;
    channelNames: string[];
  } | null>(null);
  const feedUpdateNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGroupSyncAtRef = useRef<Map<string, number>>(new Map());
  const syncInFlightRef = useRef<boolean>(false);
  const activeSyncGroupIdRef = useRef<string | null>(null);
  const queuedSilentGroupIdRef = useRef<string | null>(null);
  const activeSyncPromiseRef = useRef<Promise<void> | null>(null);

  // Full channel catalog progressive loading states
  const [channelCatalogMap, setChannelCatalogMap] = useState<
    Record<
      string,
      {
        loading: boolean;
        loadedCount: number;
        hasMore: boolean;
        nextCursor: string | null;
        fullyLoaded: boolean;
        error?: string;
      }
    >
  >({});
  const channelCatalogMapRef = useRef(channelCatalogMap);
  channelCatalogMapRef.current = channelCatalogMap;
  const channelLoadAbortRef = useRef<AbortController | null>(null);
  const activeChannelLoadIdRef = useRef<string | null>(null);

  // Audio Extractor & Background Audio Activation States
  const [isExtractorModalOpen, setIsExtractorModalOpen] = useState<boolean>(false);
  const [hasOpenedExtractorModal, setHasOpenedExtractorModal] = useState<boolean>(false);
  const [pendingExtractorVideo, setPendingExtractorVideo] = useState<Video | null>(null);
  const [extractorIntent, setExtractorIntent] = useState<'download' | 'playback'>('download');
  const [extractorVersion, setExtractorVersion] = useState<number>(0);

  const [bgAudioSettings, setBgAudioSettings] = useState<BackgroundAudioSettings>(boot.bgAudio);
  const bgAudioSettingsRef = useRef(bgAudioSettings);
  bgAudioSettingsRef.current = bgAudioSettings;
  const [isBgAudioModalOpen, setIsBgAudioModalOpen] = useState<boolean>(false);
  const [hasOpenedBgAudioModal, setHasOpenedBgAudioModal] = useState<boolean>(false);
  const [bgAudioNotice, setBgAudioNotice] = useState<string | null>(null);
  const bgAudioNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingReopenResume, setPendingReopenResume] = useState<Video | null>(() =>
    boot.session.wasPlaying &&
    boot.bgAudio.enabled &&
    boot.bgAudio.autoResumeOnReopen &&
    boot.initialVideo
      ? boot.initialVideo
      : null
  );

  // Audio Download Manager
  const handleDownloadRestrictionBlocked = useCallback((blockedVideo: Video) => {
    setPendingExtractorVideo(blockedVideo);
    setExtractorIntent('download');
    setHasOpenedExtractorModal(true);
    setIsExtractorModalOpen(true);
  }, []);

  const {
    downloads: audioDownloads,
    notice: downloadNotice,
    startDownload: handleDownloadAudio,
    saveOrShareDownload: handleSaveOrShareDownload,
    dismissNotice: dismissDownloadNotice,
  } = useAudioDownload({
    onRestrictionBlocked: handleDownloadRestrictionBlocked,
  });

  // Playback Progress Persistence Map
  const [playbackProgressMap, setPlaybackProgressMap] = useState<Record<string, PlaybackProgress>>(
    boot.progressMap
  );
  const lastSavedProgressTimeRef = useRef<number>(0);

  // Player States (Restores last played video and saved progress offline/online)
  const [currentVideo, setCurrentVideo] = useState<Video | null>(boot.initialVideo);
  const [playerMode, setPlayerMode] = useState<PlayerMode>(boot.session.playerMode);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [queue, setQueue] = useState<Video[]>(() =>
    boot.videos.length > 1 ? boot.videos.slice(1, 6) : []
  );
  const [seekCommand, setSeekCommand] = useState<number | null>(null);
  const [audioStatusMap, setAudioStatusMap] = useState<Record<string, NativeAudioStatus>>({});
  const nativeAudioRef = useRef<NativeAudioHandle | null>(null);
  const autoSwitchedToAudioRef = useRef<boolean>(false);
  const probedAudioIdsRef = useRef<Set<string>>(new Set());
  const [hasActivatedYouTube, setHasActivatedYouTube] = useState<boolean>(false);
  const [subscribingChannelId, setSubscribingChannelId] = useState<string | null>(null);
  const trackHistoryRef = useRef<Video[]>([]);
  const currentVideoRef = useRef<Video | null>(currentVideo);
  currentVideoRef.current = currentVideo;

  const currentAudioStatus: NativeAudioStatus = currentVideo
    ? audioStatusMap[currentVideo.id] || 'checking'
    : 'unavailable';

  const isCheckingNativeAudio = Boolean(
    currentVideo && playerMode === 'audio' && currentAudioStatus === 'checking'
  );

  const useNativeAudio = Boolean(
    currentVideo &&
      playerMode === 'audio' &&
      currentAudioStatus === 'available'
  );
  const prevUseNativeAudioRef = useRef<boolean>(useNativeAudio);

  // Probe stream availability only when user opens player or starts playback (avoids startup latency)
  useEffect(() => {
    if (!currentVideo || (activeTab !== 'player' && !isPlaying)) return;
    const videoId = currentVideo.id;
    if (probedAudioIdsRef.current.has(videoId)) return;
    probedAudioIdsRef.current.add(videoId);

    let cancelled = false;
    ensureAutoYouTubeCookies()
      .then(() => syncExtractorConfigToServer())
      .catch(() => {})
      .then(() => {
        if (cancelled) return null;
        return fetch(`/api/youtube/audio-stream?videoId=${encodeURIComponent(videoId)}&check=1`, {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            ...buildExtractorHeaders(),
          },
        });
      })
      .then(async (res) => {
        if (!res) return null;
        if (!res.ok) return { available: false, status: 'unavailable' };
        const { data } = await parseJsonSafely<{ available?: boolean; status?: string }>(res);
        return data || { available: false, status: 'unavailable' };
      })
      .then((data) => {
        if (!data) {
          probedAudioIdsRef.current.delete(videoId);
          return;
        }
        if (!cancelled) {
          const resolvedStatus: NativeAudioStatus = data?.available
            ? 'available'
            : data?.status === 'login_required' || data?.status === 'live_stream'
            ? data.status
            : 'unavailable';
          setAudioStatusMap((prev) => ({
            ...prev,
            [videoId]: resolvedStatus,
          }));
        } else {
          probedAudioIdsRef.current.delete(videoId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAudioStatusMap((prev) => ({
            ...prev,
            [videoId]: 'unavailable',
          }));
        } else {
          probedAudioIdsRef.current.delete(videoId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentVideo?.id, activeTab, isPlaying, extractorVersion]);

  // Pre-probe next queued track so background audio transitions don't stall waiting for a fresh check
  useEffect(() => {
    const nextQueued = queue[0];
    if (!nextQueued || !isPlaying || !bgAudioSettings.enabled || playerMode !== 'audio') return;
    const nextId = nextQueued.id;
    if (probedAudioIdsRef.current.has(nextId)) return;
    probedAudioIdsRef.current.add(nextId);

    let cancelled = false;
    fetch(`/api/youtube/audio-stream?videoId=${encodeURIComponent(nextId)}&check=1`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...buildExtractorHeaders(),
      },
    })
      .then(async (res) => {
        if (!res.ok) return { available: false, status: 'unavailable' };
        const { data } = await parseJsonSafely<{ available?: boolean; status?: string }>(res);
        return data || { available: false, status: 'unavailable' };
      })
      .then((data) => {
        if (cancelled) {
          probedAudioIdsRef.current.delete(nextId);
          return;
        }
        const resolvedStatus: NativeAudioStatus = data?.available
          ? 'available'
          : data?.status === 'login_required' || data?.status === 'live_stream'
          ? data.status
          : 'unavailable';
        setAudioStatusMap((prev) => ({
          ...prev,
          [nextId]: resolvedStatus,
        }));
      })
      .catch(() => {
        probedAudioIdsRef.current.delete(nextId);
      });

    return () => {
      cancelled = true;
    };
  }, [queue[0]?.id, isPlaying, bgAudioSettings.enabled, playerMode, extractorVersion]);

  useEffect(() => {
    let active = true;
    void ensureAutoYouTubeCookies()
      .then((res) => {
        if (!active) return;
        if (res.autoGenerated) {
          probedAudioIdsRef.current.clear();
          setAudioStatusMap({});
          setExtractorVersion((v) => v + 1);
        } else {
          return syncExtractorConfigToServer();
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // When switching between Native <audio> and YouTube IFrame, keep playback timestamp synced
    if (prevUseNativeAudioRef.current !== useNativeAudio) {
      const snap = getPlaybackClockSnapshot();
      if (snap.currentTime > 0) {
        setSeekCommand(snap.currentTime);
      }
    }
    prevUseNativeAudioRef.current = useNativeAudio;
  }, [useNativeAudio]);

  // Defer heavy YouTube IFrame API & embed initialization until video mode or fallback actually needs it
  useEffect(() => {
    if (hasActivatedYouTube || !currentVideo) return;
    const needsYouTubeNow =
      (playerMode === 'video' && (activeTab === 'player' || isPlaying)) ||
      (isPlaying && !useNativeAudio && !isCheckingNativeAudio);
    if (needsYouTubeNow) {
      setHasActivatedYouTube(true);
    }
  }, [
    hasActivatedYouTube,
    currentVideo,
    playerMode,
    activeTab,
    isPlaying,
    useNativeAudio,
    isCheckingNativeAudio,
  ]);

  // Sleep Timer States
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerExpiresAt, setSleepTimerExpiresAt] = useState<number | null>(null);

  // Modals & Drawers (track first-open so lazy bundles aren't downloaded until requested)
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [hasOpenedAddModal, setHasOpenedAddModal] = useState<boolean>(false);
  const [addModalTab, setAddModalTab] = useState<'video' | 'search' | 'paste'>('search');
  const [addModalSearchQuery, setAddModalSearchQuery] = useState<string>('');
  const [pastedLinkForModal, setPastedLinkForModal] = useState<string>('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [hasOpenedGroupModal, setHasOpenedGroupModal] = useState<boolean>(false);
  const [isChannelDrawerOpen, setIsChannelDrawerOpen] = useState<boolean>(false);
  const [hasOpenedChannelDrawer, setHasOpenedChannelDrawer] = useState<boolean>(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState<boolean>(false);
  const [hasOpenedPlaylistModal, setHasOpenedPlaylistModal] = useState<boolean>(false);
  const [videoToAddToPlaylist, setVideoToAddToPlaylist] = useState<Video | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (isAddModalOpen) setHasOpenedAddModal(true);
  }, [isAddModalOpen]);
  useEffect(() => {
    if (isGroupModalOpen) setHasOpenedGroupModal(true);
  }, [isGroupModalOpen]);
  useEffect(() => {
    if (isChannelDrawerOpen) setHasOpenedChannelDrawer(true);
  }, [isChannelDrawerOpen]);
  useEffect(() => {
    if (isPlaylistModalOpen) setHasOpenedPlaylistModal(true);
  }, [isPlaylistModalOpen]);
  useEffect(() => {
    if (isExtractorModalOpen) setHasOpenedExtractorModal(true);
  }, [isExtractorModalOpen]);
  useEffect(() => {
    if (isBgAudioModalOpen) setHasOpenedBgAudioModal(true);
  }, [isBgAudioModalOpen]);
  useEffect(() => {
    saveBackgroundAudioSettings(bgAudioSettings);
  }, [bgAudioSettings]);
  useEffect(() => {
    if (isPlaying) {
      setPendingReopenResume(null);
    }
  }, [isPlaying]);

  // Screen Wake Lock when background audio wake-lock option is active and playing
  useEffect(() => {
    if (
      !bgAudioSettings.enabled ||
      !bgAudioSettings.keepScreenAwake ||
      !isPlaying ||
      typeof navigator === 'undefined' ||
      !('wakeLock' in navigator)
    ) {
      return;
    }

    let sentinel: { release: () => Promise<void> } | null = null;
    let released = false;
    const requestLock = async () => {
      if (released || document.visibilityState !== 'visible') return;
      try {
        const api = (
          navigator as unknown as {
            wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
          }
        ).wakeLock;
        if (api) {
          sentinel = await api.request('screen');
        }
      } catch {
        // Ignore if battery saver or OS rejects wake lock
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestLock();
      }
    };
    void requestLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (sentinel) {
        void sentinel.release().catch(() => {});
      }
    };
  }, [bgAudioSettings.enabled, bgAudioSettings.keepScreenAwake, isPlaying]);

  const handleAutoCookieReady = useCallback(() => {
    probedAudioIdsRef.current.clear();
    setAudioStatusMap({});
    setExtractorVersion((v) => v + 1);
  }, []);

  const handleExtractorResolved = useCallback(
    (_cfg: unknown, retryVideo: Video | null) => {
      probedAudioIdsRef.current.clear();
      setAudioStatusMap({});
      setExtractorVersion((v) => v + 1);
      setPendingExtractorVideo(null);
      setBgAudioSettings((prev) => ({
        ...prev,
        enabled: true,
        autoPopupOnMinimize: true,
        autoPopupOnPlay: true,
        autoClosePopupOnReturn: true,
        autoPromptActivation: false,
        promptDismissed: true,
        activatedAt: prev.activatedAt || new Date().toISOString(),
      }));
      void syncExtractorConfigToServer();
      if (retryVideo && extractorIntent === 'download') {
        void handleDownloadAudio(retryVideo);
      }
    },
    [handleDownloadAudio, extractorIntent]
  );

  const openSearchChannelModal = (initialQuery = '') => {
    const trimmed = initialQuery.trim();
    if (/(?:https?:\/\/)?(?:[a-z0-9-]+\.)?(?:youtube\.com|youtu\.be)\//i.test(trimmed)) {
      setAddModalTab('paste');
      setAddModalSearchQuery('');
      setPastedLinkForModal(trimmed);
      setIsAddModalOpen(true);
      return;
    }
    setPastedLinkForModal('');
    setAddModalTab('search');
    setAddModalSearchQuery(trimmed);
    setIsAddModalOpen(true);
  };

  const openSearchVideoModal = (initialQuery = '') => {
    const trimmed = initialQuery.trim();
    if (/^@[a-zA-Z0-9_.-]{2,}$/.test(trimmed) || /^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
      setPastedLinkForModal('');
      setAddModalTab('search');
      setAddModalSearchQuery(trimmed);
      setIsAddModalOpen(true);
      return;
    }
    setPastedLinkForModal('');
    setAddModalTab('video');
    setAddModalSearchQuery(trimmed);
    setIsAddModalOpen(true);
  };

  // Quick Paste & Open Add Modal
  const handleQuickPasteAndOpen = async () => {
    setAddModalTab('paste');
    setAddModalSearchQuery('');
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setPastedLinkForModal(text.trim());
          setIsAddModalOpen(true);
          return;
        }
      }
    } catch {
      // ignore clipboard permission error and open modal with focused textarea
    }
    setPastedLinkForModal('');
    setIsAddModalOpen(true);
  };

  // 1. Automatic Dark Mode according to system or user choice
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      let isDark = false;
      if (themePreference === 'system') {
        isDark = mediaQuery.matches;
      } else {
        isDark = themePreference === 'dark';
      }

      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    const listener = () => {
      if (themePreference === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [themePreference]);

  const handleThemeChange = useCallback(
    (newTheme: ThemeMode) => {
      setThemePreference(newTheme);
      saveThemePreference(newTheme);
      if (user) {
        loadFirestoreService()
          .then((fs) => fs.updateThemeInFirestore(user.uid, newTheme))
          .catch(console.error);
      }
    },
    [user]
  );

  // 1b. Firebase Auth & Lazy Real-Time Firestore Sync (wait until initial seeding finishes before subscribing)
  const [cloudReadyUid, setCloudReadyUid] = useState<string | null>(null);

  useEffect(() => {
    getRedirectResult(auth).catch((error: unknown) => {
      const code = (error as { code?: string })?.code;
      if (!code || code === 'auth/no-auth-event') return;
      console.warn('Gagal menyelesaikan login redirect Google:', error);
      if (code === 'auth/unauthorized-domain') {
        setAuthNotice(
          'Domain belum terdaftar di Firebase Auth. Sinkronisasi cloud dinonaktifkan sementara (data lokal tetap aman).'
        );
      } else {
        setAuthNotice(
          'Login Google di browser HP diblokir cookie/privasi. Coba izinkan cookie pihak ketiga atau buka di Chrome/Safari utama (data lokal tetap aman).'
        );
      }
    });

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);

      if (!firebaseUser) {
        setCloudReadyUid(null);
        return;
      }

      try {
        const fs = await loadFirestoreService();
        await fs.testFirestoreConnection();
        const {
          groups: curGroups,
          channels: curChannels,
          videos: curVideos,
          themePreference: curTheme,
        } = latestStateRef.current;
        await fs.ensureUserProfile(firebaseUser, curTheme);
        await fs.seedInitialDataIfEmpty(firebaseUser.uid, curGroups, curChannels, curVideos);
        setCloudReadyUid(firebaseUser.uid);
      } catch (err) {
        console.error('Gagal sinkronisasi awal Firebase:', err);
        setAuthNotice(
          'Sinkronisasi cloud Firebase gagal terhubung sementara. Data lokal Anda tetap aman.'
        );
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user || cloudReadyUid !== user.uid) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    const handleCloudError = () => {
      setAuthNotice(
        'Koneksi sinkronisasi cloud terganggu sementara. Perubahan tetap tersimpan secara lokal.'
      );
    };

    loadFirestoreService()
      .then((fs) => {
        if (cancelled) return;
        unsubs.push(
          fs.subscribeToUserGroups(
            user.uid,
            (cloudGroups) => {
              if (cloudGroups.length > 0) {
                setGroups(cloudGroups);
              }
            },
            handleCloudError
          ),
          fs.subscribeToUserChannels(
            user.uid,
            (cloudChannels) => {
              setChannels(cloudChannels);
            },
            handleCloudError
          ),
          fs.subscribeToUserVideos(
            user.uid,
            (cloudVideos) => {
              setVideos((prev) => {
                if (prev.length === 0) return cloudVideos;
                const map = new Map(prev.map((v) => [v.id, v]));
                for (const cv of cloudVideos) {
                  const existing = map.get(cv.id);
                  map.set(
                    cv.id,
                    existing
                      ? {
                          ...existing,
                          ...cv,
                          duration: existing.duration || cv.duration,
                          views: existing.views || cv.views,
                        }
                      : cv
                  );
                }
                return Array.from(map.values()).sort(
                  (a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)
                );
              });
            },
            handleCloudError
          ),
          fs.subscribeToUserPlaylists(
            user.uid,
            (cloudPlaylists) => {
              setPlaylists(cloudPlaylists);
            },
            handleCloudError
          ),
          fs.subscribeToPlayedVideos(
            user.uid,
            (cloudPlayedIds) => {
              setPlayedVideoIds(cloudPlayedIds);
            },
            handleCloudError
          )
        );
      })
      .catch(console.error);

    return () => {
      cancelled = true;
      unsubs.forEach((fn) => fn());
    };
  }, [user?.uid, cloudReadyUid]);

  const handleSignIn = useCallback(async () => {
    setAuthNotice(null);
    const inIframe = typeof window !== 'undefined' && window.self !== window.top;
    const isStandalonePwa =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as { standalone?: boolean }).standalone === true);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        (isStandalonePwa && code === 'auth/popup-closed-by-user')
      ) {
        if (!inIframe) {
          try {
            await signInWithRedirect(auth, googleProvider);
            return;
          } catch (redirectErr) {
            console.warn('Gagal masuk dengan metode redirect:', redirectErr);
          }
        }
        setAuthNotice(
          'Pop-up login diblokir oleh browser atau mode preview. Izinkan pop-up atau buka aplikasi di tab baru untuk sinkronisasi Google (data lokal tetap tersimpan aman).'
        );
        return;
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      if (code === 'auth/unauthorized-domain') {
        setAuthNotice(
          'Domain belum diotorisasi untuk login Google. Data lokal tetap tersimpan aman di perangkat Anda.'
        );
        return;
      }
      if (code === 'auth/network-request-failed') {
        setAuthNotice(
          'Koneksi internet terputus saat login Google. Periksa jaringan lalu coba lagi.'
        );
        return;
      }
      console.warn('Gagal masuk dengan Google:', error);
      setAuthNotice(
        'Gagal masuk dengan Google. Periksa koneksi atau buka di tab browser penuh (data lokal tetap tersimpan aman).'
      );
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Gagal keluar dari akun Google:', error);
    }
  }, []);

  // 2. Persistence sync (LocalStorage fallback - skip redundant initial mount write)
  const didMountPersistRef = useRef(false);
  useEffect(() => {
    if (!didMountPersistRef.current) return;
    saveGroups(groups);
  }, [groups]);

  useEffect(() => {
    if (!didMountPersistRef.current) return;
    saveChannels(channels);
  }, [channels]);

  useEffect(() => {
    if (!didMountPersistRef.current) {
      didMountPersistRef.current = true;
      return;
    }
    saveVideos(videos);
  }, [videos]);

  // 3. Sleep timer countdown
  useEffect(() => {
    if (!sleepTimerExpiresAt) return;

    const interval = setInterval(() => {
      if (Date.now() >= sleepTimerExpiresAt) {
        setIsPlaying(false);
        setSleepTimerMinutes(null);
        setSleepTimerExpiresAt(null);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerExpiresAt]);

  const handleSetSleepTimer = useCallback((minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    if (minutes === null) {
      setSleepTimerExpiresAt(null);
    } else {
      setSleepTimerExpiresAt(Date.now() + minutes * 60 * 1000);
    }
  }, []);

  const currentVideoIdRef = useRef<string | null>(currentVideo?.id || null);
  currentVideoIdRef.current = currentVideo?.id || null;
  const playbackProgressMapRef = useRef(playbackProgressMap);
  playbackProgressMapRef.current = playbackProgressMap;

  // 4. Playback Controls
  const selectVideoForPlayback = useCallback(
    (
      video: Video,
      mode?: PlayerMode,
      autoPlay = true,
      options?: { recordHistory?: boolean }
    ) => {
      const prev = currentVideoRef.current;
      if (options?.recordHistory !== false && prev && prev.id !== video.id) {
        const nextHist = trackHistoryRef.current.filter((item) => item.id !== prev.id);
        nextHist.push(prev);
        if (nextHist.length > 25) {
          nextHist.splice(0, nextHist.length - 25);
        }
        trackHistoryRef.current = nextHist;
      }

      const saved = playbackProgressMapRef.current[video.id];
      const resumeTime = saved?.currentTime && saved.currentTime > 0 ? saved.currentTime : 0;
      const savedDur = saved?.duration && saved.duration > 0 ? saved.duration : 0;

      lastSavedProgressTimeRef.current = resumeTime;
      setSeekCommand(null);
      resetPlaybackClock(video.id, resumeTime, savedDur);
      setCurrentVideo(video);
      if (mode) setPlayerMode(mode);
      setIsPlaying(autoPlay);
    },
    []
  );

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const handlePlayPause = useCallback(() => {
    const willPlay = !isPlayingRef.current;
    if (willPlay) {
      nativeAudioRef.current?.unlock();
      if (
        bgAudioSettingsRef.current.enabled &&
        bgAudioSettingsRef.current.autoPopupOnPlay &&
        !floatingMiniPlayerRef.current.isOpen
      ) {
        void floatingMiniPlayerRef.current.openPopup({ silent: true });
      }
    }
    setIsPlaying(willPlay);
  }, []);

  const handleSeek = useCallback((seconds: number) => {
    setPlaybackClock(currentVideoIdRef.current, seconds);
    setSeekCommand(seconds);
  }, []);

  const handleSkipBack = useCallback(
    (secs: number = 15) => {
      const snap = getPlaybackClockSnapshot();
      const target = Math.max(0, snap.currentTime - secs);
      handleSeek(target);
    },
    [handleSeek]
  );

  const handleSkipForward = useCallback(
    (secs: number = 30) => {
      const snap = getPlaybackClockSnapshot();
      const target = Math.min(snap.duration || Infinity, snap.currentTime + secs);
      handleSeek(target);
    },
    [handleSeek]
  );

  const handlePlayVideo = useCallback(
    (video: Video, mode: PlayerMode = 'video') => {
      nativeAudioRef.current?.unlock();
      autoSwitchedToAudioRef.current = false;
      selectVideoForPlayback(video, mode, true);
      setActiveTab('player');
      if (
        mode === 'audio' &&
        bgAudioSettingsRef.current.autoPromptActivation &&
        !bgAudioSettingsRef.current.activatedAt &&
        !bgAudioSettingsRef.current.promptDismissed
      ) {
        setHasOpenedBgAudioModal(true);
        setIsBgAudioModalOpen(true);
      } else if (
        bgAudioSettingsRef.current.enabled &&
        bgAudioSettingsRef.current.autoPopupOnPlay
      ) {
        void floatingMiniPlayerRef.current.openPopup({ silent: true, videoOverride: video });
      }
    },
    [selectVideoForPlayback]
  );

  const handlePlayVideoCard = useCallback(
    (video: Video) => handlePlayVideo(video, 'video'),
    [handlePlayVideo]
  );

  const handlePlayAudioCard = useCallback(
    (video: Video) => handlePlayVideo(video, 'audio'),
    [handlePlayVideo]
  );

  const handleNextTrack = useCallback(() => {
    setQueue((prevQueue) => {
      if (prevQueue.length === 0) return prevQueue;
      const [nextVid, ...rest] = prevQueue;
      selectVideoForPlayback(nextVid, undefined, true);
      return rest;
    });
  }, [selectVideoForPlayback]);

  const handlePrevTrack = useCallback(() => {
    const snap = getPlaybackClockSnapshot();
    if (snap.currentTime <= 5 && trackHistoryRef.current.length > 0) {
      const prevVideo = trackHistoryRef.current[trackHistoryRef.current.length - 1];
      trackHistoryRef.current = trackHistoryRef.current.slice(0, -1);
      if (prevVideo) {
        selectVideoForPlayback(prevVideo, undefined, true, { recordHistory: false });
        return;
      }
    }
    handleSeek(0);
  }, [handleSeek, selectVideoForPlayback]);

  const openAudioExtractorRef = useRef<() => void>(() => {});
  const handlePopupEmbedStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const floatingMiniPlayer = useFloatingMiniPlayer({
    currentVideo,
    isPlaying,
    usingNativeAudio: useNativeAudio,
    nativeAudioStatus: currentAudioStatus,
    hasNext: queue.length > 0,
    autoPopupOnMinimize: bgAudioSettings.enabled && bgAudioSettings.autoPopupOnMinimize,
    autoClosePopupOnReturn: bgAudioSettings.autoClosePopupOnReturn,
    onPlayPause: handlePlayPause,
    onSkipBack: handleSkipBack,
    onSkipForward: handleSkipForward,
    onNext: handleNextTrack,
    onOpenExtractorAuth: () => openAudioExtractorRef.current(),
    onEmbedStateChange: handlePopupEmbedStateChange,
  });
  const floatingMiniPlayerRef = useRef(floatingMiniPlayer);
  floatingMiniPlayerRef.current = floatingMiniPlayer;
  const isPopupEmbedActive = floatingMiniPlayer.isPopupEmbedActive;

  const prevPopupEmbedActiveRef = useRef(isPopupEmbedActive);
  useEffect(() => {
    if (prevPopupEmbedActiveRef.current && !isPopupEmbedActive) {
      const snap = getPlaybackClockSnapshot();
      if (snap.currentTime > 0) {
        setSeekCommand(snap.currentTime);
      }
    }
    prevPopupEmbedActiveRef.current = isPopupEmbedActive;
  }, [isPopupEmbedActive]);

  const handleToggleQueue = useCallback((video: Video) => {
    setQueue((prev) => {
      const exists = prev.some((v) => v.id === video.id);
      if (exists) {
        return prev.filter((v) => v.id !== video.id);
      } else {
        return [...prev, video];
      }
    });
  }, []);

  const handleRemoveFromQueue = useCallback((videoId: string) => {
    setQueue((prev) => prev.filter((v) => v.id !== videoId));
  }, []);

  const handleMoveQueueItem = useCallback((index: number, direction: -1 | 1) => {
    setQueue((prev) => {
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }, []);

  const handleClearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const handleAddToPlaylistCard = useCallback(
    (video: Video) => {
      if (!latestStateRef.current.videos.some((v) => v.id === video.id)) {
        setVideos((prev) => (prev.some((v) => v.id === video.id) ? prev : [video, ...prev]));
        if (user) {
          loadFirestoreService()
            .then((fs) => fs.saveVideosInFirestore(user.uid, [video]))
            .catch(console.error);
        }
      }
      setVideoToAddToPlaylist(video);
      setIsPlaylistModalOpen(true);
    },
    [user]
  );

  // 5. Group Management (Create, Rename, Delete)
  const handleAddGroup = (name: string) => {
    const newId = `group_${Date.now()}`;
    const newGroup: ChannelGroup = {
      id: newId,
      name,
    };
    setGroups((prev) => [...prev, newGroup]);
    if (user) {
      loadFirestoreService()
        .then((fs) => fs.createGroupInFirestore(user.uid, newGroup))
        .catch(console.error);
    }
  };

  const handleRenameGroup = (groupId: string, newName: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name: newName } : g))
    );
    if (user) {
      loadFirestoreService()
        .then((fs) => fs.renameGroupInFirestore(user.uid, groupId, newName))
        .catch(console.error);
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    const channelsInGroup = channels.filter((c) => c.groupId === groupId);
    setChannels((prev) =>
      prev.map((c) => (c.groupId === groupId ? { ...c, groupId: 'general' } : c))
    );
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (activeGroupId === groupId) {
      setActiveGroupId('all');
    }
    if (user) {
      loadFirestoreService()
        .then((fs) => fs.deleteGroupInFirestore(user.uid, groupId, channelsInGroup))
        .catch(console.error);
    }
  };

  // 6. Channel Management
  const handleDeleteChannel = (channelId: string) => {
    const videoIdsToDelete = videos.filter((v) => v.channelId === channelId).map((v) => v.id);
    const deleteSet = new Set(videoIdsToDelete);
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    setVideos((prev) => prev.filter((v) => v.channelId !== channelId));
    setQueue((prev) => prev.filter((v) => v.channelId !== channelId));
    if (deleteSet.size > 0) {
      const currentPlayed = latestStateRef.current.playedVideoIds;
      const filtered = currentPlayed.filter((id) => !deleteSet.has(id));
      if (filtered.length !== currentPlayed.length) {
        setPlayedVideoIds(filtered);
        if (user) {
          loadFirestoreService()
            .then((fs) => fs.updatePlayedVideosInFirestore(user.uid, filtered))
            .catch(console.error);
        }
      }
    }
    if (activeChannelLoadIdRef.current === channelId) {
      channelLoadAbortRef.current?.abort();
      channelLoadAbortRef.current = null;
      activeChannelLoadIdRef.current = null;
    }
    setChannelCatalogMap((prev) => {
      if (!(channelId in prev)) return prev;
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
    if (selectedChannelId === channelId) {
      setSelectedChannelId(null);
    }
    if (currentVideo?.channelId === channelId) {
      setIsPlaying(false);
      setCurrentVideo(null);
      resetPlaybackClock(null, 0, 0);
    }
    if (user) {
      loadFirestoreService()
        .then((fs) => fs.deleteChannelInFirestore(user.uid, channelId, videoIdsToDelete))
        .catch(console.error);
    }
  };

  const handleChangeChannelGroup = (channelId: string, newGroupId: string) => {
    lastGroupSyncAtRef.current.delete(newGroupId);
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, groupId: newGroupId } : c))
    );
    if (user) {
      loadFirestoreService()
        .then((fs) => fs.changeChannelGroupInFirestore(user.uid, channelId, newGroupId))
        .catch(console.error);
    }
    if (activeGroupId === newGroupId && navigator.onLine) {
      setTimeout(() => {
        void syncHandlersRef.current.syncChannelFeeds({
          groupId: newGroupId,
          silent: true,
          force: true,
        });
      }, 200);
    }
  };

  // Persist pending sync queue
  useEffect(() => {
    savePendingSyncQueue(pendingSyncQueue);
  }, [pendingSyncQueue]);

  // Persist last active video ID & object fallback
  useEffect(() => {
    saveLastVideoId(currentVideo?.id || null);
    saveLastVideo(currentVideo || null);
  }, [currentVideo]);

  // Save playback progress helper
  const persistProgress = useCallback(
    (videoId: string, time: number, dur: number) => {
      if (!videoId || time < 0) return;
      const updated = saveVideoPlaybackProgress(videoId, time, dur);
      setPlaybackProgressMap(updated);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (feedUpdateNoticeTimerRef.current) {
        clearTimeout(feedUpdateNoticeTimerRef.current);
      }
      if (bgAudioNoticeTimerRef.current) {
        clearTimeout(bgAudioNoticeTimerRef.current);
      }
    };
  }, []);

  const showFeedUpdateNotice = useCallback(
    (count: number, groupName: string, channelNames: string[]) => {
      setFeedUpdateNotice({ count, groupName, channelNames });
      if (feedUpdateNoticeTimerRef.current) {
        clearTimeout(feedUpdateNoticeTimerRef.current);
      }
      feedUpdateNoticeTimerRef.current = setTimeout(() => {
        setFeedUpdateNotice(null);
      }, 7000);
    },
    []
  );

  // 7. Add Multiple Channels (queues for background sync if offline)
  const handleAddChannels = async (
    inputs: string[],
    targetGroupId: string,
    channelHints?: Record<string, Partial<Channel>>
  ): Promise<{ success: number; failed: number; lastError?: string }> => {
    if (!navigator.onLine) {
      const task: PendingSyncTask = {
        id: `sync_${Date.now()}`,
        type: 'ADD_CHANNELS',
        inputs,
        targetGroupId,
        createdAt: new Date().toISOString(),
      };
      setPendingSyncQueue((prev) => [...prev, task]);
      return { success: inputs.length, failed: 0 };
    }

    let success = 0;
    let failed = 0;
    let lastError: string | undefined;

    const newChannels: Channel[] = [];
    const newVideos: Video[] = [];

    const resolveResults = await Promise.all(
      inputs.map(async (input) => {
        const hint = channelHints?.[input];
        try {
          const res = await fetch('/api/youtube/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ input }),
          });
          const { data, rawText } = await parseJsonSafely<any>(res);
          if (res.ok && data && data.channel?.id) {
            return { ok: true as const, input, data };
          }
          // If resolve fails for a valid UC channel ID obtained from search, fall back to feed endpoint or search hint
          if (hint?.id && /^UC[a-zA-Z0-9_-]{22}$/.test(hint.id)) {
            try {
              const feedRes = await fetch(
                `/api/youtube/feed?channelId=${encodeURIComponent(hint.id)}`,
                { headers: { Accept: 'application/json' } }
              );
              const { data: feedData } = await parseJsonSafely<any>(feedRes);
              if (feedRes.ok && feedData?.channel?.id) {
                return { ok: true as const, input, data: feedData };
              }
            } catch {
              // continue to local hint fallback
            }
            return {
              ok: true as const,
              input,
              data: {
                channel: {
                  id: hint.id,
                  title: hint.title || 'YouTube Channel',
                  handle: hint.handle,
                  avatar: hint.avatar,
                  description: hint.description,
                  url: hint.url || `https://www.youtube.com/channel/${hint.id}`,
                },
                videos: [],
              },
              needsFeedRefresh: true,
            };
          }
          return {
            ok: false as const,
            error: buildHttpErrorMessage(res, data, rawText, 'Gagal memproses channel'),
          };
        } catch (err) {
          if (hint?.id && /^UC[a-zA-Z0-9_-]{22}$/.test(hint.id)) {
            return {
              ok: true as const,
              input,
              data: {
                channel: {
                  id: hint.id,
                  title: hint.title || 'YouTube Channel',
                  handle: hint.handle,
                  avatar: hint.avatar,
                  description: hint.description,
                  url: hint.url || `https://www.youtube.com/channel/${hint.id}`,
                },
                videos: [],
              },
              needsFeedRefresh: true,
            };
          }
          return {
            ok: false as const,
            error: err instanceof Error ? err.message : 'Gagal menghubungi server.',
          };
        }
      })
    );

    const existingChannelIds = new Set(channels.map((c) => c.id));
    const existingVideoIds = new Set(videos.map((v) => v.id));
    let anyNeedsFeedRefresh = false;

    for (const item of resolveResults) {
      if (!item.ok) {
        if (item.error) lastError = item.error;
        failed++;
        continue;
      }
      if ('needsFeedRefresh' in item && item.needsFeedRefresh) {
        anyNeedsFeedRefresh = true;
      }
      const data = item.data;
      if (data?.channel && data.channel.id) {
        const ch = data.channel;
        const hint = channelHints?.[ch.id] || channelHints?.[item.input];
        const isPlaceholderTitle = !ch.title || ch.title.startsWith('Channel UC') || ch.title === 'YouTube Channel';
        const isPlaceholderAvatar = !ch.avatar || String(ch.avatar).includes('avatar.vercel.sh');
        const resolvedTitle =
          (!isPlaceholderTitle ? ch.title : hint?.title) || ch.title || 'YouTube Channel';
        const channelObj: Channel = {
          id: ch.id,
          title: resolvedTitle,
          handle: ch.handle || hint?.handle,
          avatar: (!isPlaceholderAvatar ? ch.avatar : hint?.avatar) || ch.avatar || hint?.avatar,
          description: ch.description || hint?.description,
          url: ch.url || hint?.url || `https://www.youtube.com/channel/${ch.id}`,
          groupId: targetGroupId,
          addedAt: new Date().toISOString(),
          videoCount: data.videos?.length || 0,
        };

        if (!existingChannelIds.has(ch.id)) {
          existingChannelIds.add(ch.id);
          newChannels.push(channelObj);
        }

        if (Array.isArray(data.videos)) {
          for (const v of data.videos as Video[]) {
            if (!existingVideoIds.has(v.id)) {
              existingVideoIds.add(v.id);
              newVideos.push(v);
            }
          }
        }
        success++;
      } else {
        failed++;
      }
    }

    if (newChannels.length > 0) {
      // Mark target group so switching to it or auto-sync keeps fresh data
      lastGroupSyncAtRef.current.set(targetGroupId, Date.now());
      setChannels((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const unique = newChannels.filter((c) => !existingIds.has(c.id));
        return unique.length > 0 ? [...unique, ...prev] : prev;
      });
      if (user) {
        loadFirestoreService()
          .then((fs) => Promise.all(newChannels.map((ch) => fs.saveChannelInFirestore(user.uid, ch))))
          .catch(console.error);
      }
    }

    if (newVideos.length > 0) {
      setVideos((prev) => {
        const map = new Map(prev.map((v) => [v.id, v]));
        for (const v of newVideos) {
          if (!map.has(v.id)) map.set(v.id, v);
        }
        const combined = Array.from(map.values());
        combined.sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        return combined;
      });
      if (user) {
        loadFirestoreService()
          .then((fs) => fs.saveVideosInFirestore(user.uid, newVideos))
          .catch(console.error);
      }
      if (!currentVideo && newVideos.length > 0) {
        selectVideoForPlayback(newVideos[0], playerMode, false);
      }
    }

    if (anyNeedsFeedRefresh) {
      setPendingSyncQueue((prev) => {
        if (prev.some((t) => t.type === 'REFRESH_FEEDS')) return prev;
        return [
          ...prev,
          { id: `sync_${Date.now()}`, type: 'REFRESH_FEEDS', createdAt: new Date().toISOString() },
        ];
      });
    }

    return { success, failed, lastError };
  };

  // 8. Refresh Feeds from Server (supports all channels or a specific group, plus silent background auto-updates)
  const syncChannelFeeds = async (options?: {
    groupId?: string;
    silent?: boolean;
    force?: boolean;
  }) => {
    const targetGroupId = options?.groupId || 'all';
    const silent = Boolean(options?.silent);
    const force = Boolean(options?.force);

    const currentChannels = latestStateRef.current.channels;
    const targetChannels =
      targetGroupId !== 'all'
        ? currentChannels.filter((c) => c.groupId === targetGroupId)
        : currentChannels;

    if (targetChannels.length === 0) return;

    if (!navigator.onLine) {
      if (!silent) {
        setPendingSyncQueue((prev) => {
          if (prev.some((t) => t.type === 'REFRESH_FEEDS')) return prev;
          return [
            ...prev,
            { id: `sync_${Date.now()}`, type: 'REFRESH_FEEDS', createdAt: new Date().toISOString() },
          ];
        });
      }
      return;
    }

    if (syncInFlightRef.current) {
      if (!silent && activeSyncPromiseRef.current) {
        try {
          await activeSyncPromiseRef.current;
        } catch {
          // ignore prior sync failure and proceed with manual refresh
        }
        if (syncInFlightRef.current) return;
      } else {
        if (
          activeSyncGroupIdRef.current !== 'all' &&
          activeSyncGroupIdRef.current !== targetGroupId
        ) {
          queuedSilentGroupIdRef.current = targetGroupId;
        }
        return;
      }
    }

    syncInFlightRef.current = true;
    activeSyncGroupIdRef.current = targetGroupId;

    if (silent) {
      setIsAutoCheckingGroup(true);
    } else {
      setIsRefreshing(true);
    }

    const runSync = async () => {
      try {
      const channelIds = targetChannels.map((c) => c.id);
      const chunks: string[][] = [];
      for (let i = 0; i < channelIds.length; i += 20) {
        chunks.push(channelIds.slice(i, i + 20));
      }

      const fetchedVideos: Video[] = [];
      const fetchedChannelsMap: Record<string, Partial<Channel>> = {};

      const responses = await Promise.all(
        chunks.map((chunk) =>
          fetch('/api/youtube/batch-feed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ channelIds: chunk, force }),
          })
        )
      );

      let anyOk = false;
      for (const res of responses) {
        if (!res.ok) continue;
        const { data } = await parseJsonSafely<any>(res);
        if (!data) continue;
        anyOk = true;
        if (Array.isArray(data.videos)) {
          fetchedVideos.push(...data.videos);
        }
        if (data.channels && typeof data.channels === 'object') {
          Object.assign(fetchedChannelsMap, data.channels);
        }
      }

      if (!anyOk) {
        throw new Error('Semua permintaan batch feed gagal');
      }

      const now = Date.now();
      setLastSyncedTimeLabel(
        new Date(now).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      );
      if (targetGroupId === 'all') {
        saveLastFeedSyncAt(now);
        lastGroupSyncAtRef.current.set('all', now);
        for (const ch of targetChannels) {
          lastGroupSyncAtRef.current.set(ch.groupId, now);
        }
      } else {
        lastGroupSyncAtRef.current.set(targetGroupId, now);
      }

      // Compute brand-new videos vs existing state before merging (preserving exact RSS timestamps/descriptions)
      const existingVideosMap = new Map(latestStateRef.current.videos.map((v) => [v.id, v]));
      const dedupedFetchedMap = new Map<string, Video>();
      for (const v of fetchedVideos) {
        if (v && v.id) dedupedFetchedMap.set(v.id, v);
      }
      const uniqueFetched = Array.from(dedupedFetchedMap.values());
      const brandNewVideos = uniqueFetched
        .filter((v) => !existingVideosMap.has(v.id))
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      const mergedMap = new Map(existingVideosMap);
      for (const fresh of uniqueFetched) {
        const prev = mergedMap.get(fresh.id);
        if (!prev) {
          mergedMap.set(fresh.id, fresh);
        } else {
          mergedMap.set(fresh.id, {
            ...prev,
            ...fresh,
            description: fresh.description || prev.description,
            views: fresh.views || prev.views,
            publishedAt: prev.description && !fresh.description ? prev.publishedAt : fresh.publishedAt,
          });
        }
      }
      const mergedVideosList = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      const countByChannel = new Map<string, number>();
      for (const v of mergedVideosList) {
        countByChannel.set(v.channelId, (countByChannel.get(v.channelId) || 0) + 1);
      }

      if (Object.keys(fetchedChannelsMap).length > 0 || countByChannel.size > 0) {
        const updatedList: Channel[] = [];
        setChannels((prev) =>
          prev.map((ch) => {
            const fresh = fetchedChannelsMap[ch.id];
            const nextCount = countByChannel.get(ch.id) ?? ch.videoCount;
            if (!fresh && nextCount === ch.videoCount) return ch;
            return {
              ...ch,
              title: fresh?.title || ch.title,
              handle: fresh?.handle || ch.handle,
              avatar: fresh?.avatar || ch.avatar,
              url: fresh?.url || ch.url,
              videoCount: nextCount,
            };
          })
        );
        for (const ch of latestStateRef.current.channels) {
          const fresh = fetchedChannelsMap[ch.id];
          const nextCount = countByChannel.get(ch.id) ?? ch.videoCount;
          if (!fresh && nextCount === ch.videoCount) continue;
          const mergedCh: Channel = {
            ...ch,
            title: fresh?.title || ch.title,
            handle: fresh?.handle || ch.handle,
            avatar: fresh?.avatar || ch.avatar,
            url: fresh?.url || ch.url,
            videoCount: nextCount,
          };
          if (
            mergedCh.title !== ch.title ||
            mergedCh.avatar !== ch.avatar ||
            mergedCh.handle !== ch.handle ||
            mergedCh.videoCount !== ch.videoCount
          ) {
            updatedList.push(mergedCh);
          }
        }
        if (user && updatedList.length > 0) {
          loadFirestoreService()
            .then((fs) => Promise.all(updatedList.map((ch) => fs.saveChannelInFirestore(user.uid, ch))))
            .catch(console.error);
        }
      }

      if (uniqueFetched.length > 0) {
        setVideos(mergedVideosList);
        if (user) {
          // Prioritize brand-new videos first so Firestore never cuts off newly uploaded items
          const sortedFetched = [
            ...brandNewVideos,
            ...uniqueFetched
              .filter((v) => existingVideosMap.has(v.id))
              .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
          ];
          loadFirestoreService()
            .then((fs) => fs.saveVideosInFirestore(user.uid, sortedFetched))
            .catch(console.error);
        }
      }

      if (brandNewVideos.length > 0) {
        let resolvedGroupId = targetGroupId;
        if (targetGroupId === 'all') {
          const updatedGroupIds = new Set(
            brandNewVideos
              .map((v) => currentChannels.find((c) => c.id === v.channelId)?.groupId)
              .filter((gid): gid is string => Boolean(gid))
          );
          if (updatedGroupIds.size === 1) {
            resolvedGroupId = Array.from(updatedGroupIds)[0];
          }
        }
        const groupLabel =
          latestStateRef.current.groups.find((g) => g.id === resolvedGroupId)?.name || 'Semua Channel';
        const channelNames = Array.from(new Set(brandNewVideos.map((v) => v.channelTitle))).slice(0, 3);
        showFeedUpdateNotice(brandNewVideos.length, groupLabel, channelNames);
      }
    } catch (e) {
      if (!silent) {
        console.warn('Gagal memuat ulang feed, menjadwalkan sinkronisasi latar belakang:', e);
        setPendingSyncQueue((prev) => {
          if (prev.some((t) => t.type === 'REFRESH_FEEDS')) return prev;
          return [
            ...prev,
            { id: `sync_${Date.now()}`, type: 'REFRESH_FEEDS', createdAt: new Date().toISOString() },
          ];
        });
      }
      } finally {
        syncInFlightRef.current = false;
        activeSyncGroupIdRef.current = null;
        activeSyncPromiseRef.current = null;
        if (silent) {
          setIsAutoCheckingGroup(false);
        } else {
          setIsRefreshing(false);
        }
        const queuedGroupId = queuedSilentGroupIdRef.current;
        if (queuedGroupId && navigator.onLine) {
          queuedSilentGroupIdRef.current = null;
          setTimeout(() => {
            void syncHandlersRef.current.syncChannelFeeds({
              groupId: queuedGroupId,
              silent: true,
              force: true,
            });
          }, 120);
        }
      }
    };

    const syncPromise = runSync();
    activeSyncPromiseRef.current = syncPromise;
    await syncPromise;
  };

  const handleRefreshFeeds = () => syncChannelFeeds({ groupId: 'all', silent: false, force: true });

  const syncHandlersRef = useRef({ handleRefreshFeeds, syncChannelFeeds, handleAddChannels });
  syncHandlersRef.current = { handleRefreshFeeds, syncChannelFeeds, handleAddChannels };

  const mergeChannelVideosIntoState = useCallback(
    (channelId: string, incomingVideos: Video[], channelMeta?: Partial<Channel>) => {
      let totalForChannel = 0;
      if (incomingVideos.length > 0) {
        setVideos((prev) => {
          const map = new Map(prev.map((v) => [v.id, v]));
          for (const fresh of incomingVideos) {
            if (!fresh || !fresh.id) continue;
            const existing = map.get(fresh.id);
            if (!existing) {
              map.set(fresh.id, fresh);
            } else {
              map.set(fresh.id, {
                ...existing,
                ...fresh,
                description: fresh.description || existing.description,
                views: fresh.views || existing.views,
                duration: fresh.duration || existing.duration,
                publishedAt:
                  existing.description && !fresh.description
                    ? existing.publishedAt
                    : fresh.publishedAt,
              });
            }
          }
          const combined = Array.from(map.values()).sort(
            (a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)
          );
          for (const v of combined) {
            if (v.channelId === channelId) totalForChannel++;
          }
          return combined;
        });
      }

      if (channelMeta || totalForChannel > 0) {
        setChannels((prev) =>
          prev.map((ch) => {
            if (ch.id !== channelId) return ch;
            return {
              ...ch,
              title: channelMeta?.title || ch.title,
              handle: channelMeta?.handle || ch.handle,
              avatar: channelMeta?.avatar || ch.avatar,
              url: channelMeta?.url || ch.url,
              videoCount: Math.max(ch.videoCount || 0, totalForChannel),
            };
          })
        );
      }
    },
    []
  );

  const stopChannelAllVideos = useCallback(() => {
    const activeId = activeChannelLoadIdRef.current;
    channelLoadAbortRef.current?.abort();
    channelLoadAbortRef.current = null;
    activeChannelLoadIdRef.current = null;
    if (activeId) {
      setChannelCatalogMap((prev) => {
        const cur = prev[activeId];
        if (!cur) return prev;
        return {
          ...prev,
          [activeId]: { ...cur, loading: false },
        };
      });
    }
  }, []);

  const loadChannelAllVideos = useCallback(
    async (channelId: string, opts?: { force?: boolean; resume?: boolean }) => {
      if (!channelId || !navigator.onLine) return;

      channelLoadAbortRef.current?.abort();
      const controller = new AbortController();
      channelLoadAbortRef.current = controller;
      activeChannelLoadIdRef.current = channelId;

      const existingState = channelCatalogMapRef.current[channelId];
      const existingVideosForChannel = latestStateRef.current.videos.filter(
        (v) => v.channelId === channelId
      );
      const loadedIds = new Set<string>(existingVideosForChannel.map((v) => v.id));
      const targetChannel = latestStateRef.current.channels.find((c) => c.id === channelId);
      let channelTitle = targetChannel?.title || `Channel ${channelId.slice(0, 8)}`;

      let cursor: string | null =
        opts?.resume && !opts?.force && existingState?.nextCursor ? existingState.nextCursor : null;

      setChannelCatalogMap((prev) => ({
        ...prev,
        [channelId]: {
          loading: true,
          loadedCount: loadedIds.size,
          hasMore: existingState?.hasMore ?? true,
          nextCursor: cursor,
          fullyLoaded: false,
          error: undefined,
        },
      }));

      try {
        // Step 1: Initial multi-page fetch across Videos + Streams + Shorts tabs
        if (!cursor) {
          const res = await fetch(
            `/api/youtube/feed?channelId=${encodeURIComponent(channelId)}&pages=5&includeAllTabs=1&force=1`,
            { signal: controller.signal, headers: { Accept: 'application/json' } }
          );
          const { data, rawText } = await parseJsonSafely<{
            channel?: Partial<Channel>;
            videos?: Video[];
            nextCursor?: string | null;
            hasMore?: boolean;
            error?: string;
          }>(res);

          if (!res.ok || !data) {
            throw new Error(
              buildHttpErrorMessage(res, data, rawText, 'Gagal memuat daftar video channel')
            );
          }

          if (controller.signal.aborted) return;

          if (data.channel?.title) {
            channelTitle = data.channel.title;
          }
          const initialVideos = Array.isArray(data.videos) ? data.videos : [];
          for (const v of initialVideos) {
            if (v?.id) loadedIds.add(v.id);
          }
          mergeChannelVideosIntoState(channelId, initialVideos, data.channel);
          cursor = data.nextCursor || null;

          setChannelCatalogMap((prev) => ({
            ...prev,
            [channelId]: {
              loading: Boolean(cursor),
              loadedCount: loadedIds.size,
              hasMore: Boolean(cursor),
              nextCursor: cursor,
              fullyLoaded: !cursor,
              error: undefined,
            },
          }));
        }

        // Step 2: Sequentially stream remaining continuation pages until entire channel archive is loaded
        let batchCount = 0;
        const MAX_CURSOR_BATCHES = 50; // up to ~9,000 videos safely
        while (cursor && batchCount < MAX_CURSOR_BATCHES && !controller.signal.aborted) {
          const pageRes = await fetch(
            `/api/youtube/feed?channelId=${encodeURIComponent(channelId)}&cursor=${encodeURIComponent(
              cursor
            )}&pages=6&startIndex=${loadedIds.size}&channelTitle=${encodeURIComponent(channelTitle)}`,
            { signal: controller.signal, headers: { Accept: 'application/json' } }
          );
          const { data: pageData, rawText } = await parseJsonSafely<{
            videos?: Video[];
            nextCursor?: string | null;
            hasMore?: boolean;
            error?: string;
          }>(pageRes);

          if (!pageRes.ok || !pageData) {
            throw new Error(
              buildHttpErrorMessage(pageRes, pageData, rawText, 'Gagal melanjutkan pemuatan video')
            );
          }

          if (controller.signal.aborted) return;

          const chunkVideos = Array.isArray(pageData.videos) ? pageData.videos : [];
          let newlyAddedInBatch = 0;
          for (const v of chunkVideos) {
            if (v?.id && !loadedIds.has(v.id)) {
              loadedIds.add(v.id);
              newlyAddedInBatch++;
            }
          }
          if (chunkVideos.length > 0) {
            mergeChannelVideosIntoState(channelId, chunkVideos);
          }

          const nextToken = pageData.nextCursor || null;
          // Stop cleanly if YouTube stops returning any videos or repeats the exact same cursor
          if (!nextToken || nextToken === cursor || (chunkVideos.length === 0 && newlyAddedInBatch === 0)) {
            cursor = null;
          } else {
            cursor = nextToken;
          }
          batchCount++;

          setChannelCatalogMap((prev) => ({
            ...prev,
            [channelId]: {
              loading: Boolean(cursor) && batchCount < MAX_CURSOR_BATCHES,
              loadedCount: loadedIds.size,
              hasMore: Boolean(cursor),
              nextCursor: cursor,
              fullyLoaded: !cursor,
              error: undefined,
            },
          }));
        }

        if (!controller.signal.aborted) {
          setChannelCatalogMap((prev) => ({
            ...prev,
            [channelId]: {
              loading: false,
              loadedCount: loadedIds.size,
              hasMore: Boolean(cursor),
              nextCursor: cursor,
              fullyLoaded: !cursor,
              error: undefined,
            },
          }));
        }
      } catch (err) {
        if (controller.signal.aborted) {
          setChannelCatalogMap((prev) => {
            const cur = prev[channelId];
            if (!cur) return prev;
            return {
              ...prev,
              [channelId]: { ...cur, loading: false },
            };
          });
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Gagal memuat semua video channel dari YouTube';
        setChannelCatalogMap((prev) => ({
          ...prev,
          [channelId]: {
            loading: false,
            loadedCount: loadedIds.size,
            hasMore: Boolean(cursor),
            nextCursor: cursor,
            fullyLoaded: false,
            error: message,
          },
        }));
      } finally {
        if (activeChannelLoadIdRef.current === channelId) {
          activeChannelLoadIdRef.current = null;
          channelLoadAbortRef.current = null;
        }
      }
    },
    [mergeChannelVideosIntoState]
  );

  // Automatically fetch full channel video catalog whenever a specific channel is focused
  useEffect(() => {
    if (!selectedChannelId) {
      if (channelLoadAbortRef.current) {
        stopChannelAllVideos();
      }
      return;
    }
    if (!isOnline) return;

    const currentState = channelCatalogMapRef.current[selectedChannelId];
    if (currentState?.fullyLoaded || currentState?.loading) return;

    const timer = setTimeout(() => {
      void loadChannelAllVideos(
        selectedChannelId,
        currentState?.nextCursor ? { resume: true } : undefined
      );
    }, 120);

    return () => clearTimeout(timer);
  }, [selectedChannelId, isOnline, loadChannelAllVideos, stopChannelAllVideos]);

  useEffect(() => {
    return () => {
      channelLoadAbortRef.current?.abort();
    };
  }, []);

  // Silent non-blocking startup & cloud-hydration auto-refresh when feed cache is older than 30 seconds
  const didAutoSyncOnBootRef = useRef(false);
  const lastCloudSyncUidRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOnline || channels.length === 0) return;

    const isCloudHydratedNewUser =
      Boolean(cloudReadyUid) && lastCloudSyncUidRef.current !== cloudReadyUid;
    if (didAutoSyncOnBootRef.current && !isCloudHydratedNewUser) return;

    didAutoSyncOnBootRef.current = true;
    if (cloudReadyUid) {
      lastCloudSyncUidRef.current = cloudReadyUid;
    }

    const lastSyncAt = loadLastFeedSyncAt();
    const isStale = isCloudHydratedNewUser || Date.now() - lastSyncAt > 30 * 1000;
    if (!isStale) return;

    const timer = setTimeout(() => {
      void syncHandlersRef.current.syncChannelFeeds({ groupId: 'all', silent: true, force: true });
    }, isCloudHydratedNewUser ? 900 : 450);
    return () => clearTimeout(timer);
  }, [isOnline, channels.length, cloudReadyUid]);

  // Automatic update when switching to a group that hasn't been checked in the last 20 seconds
  useEffect(() => {
    if (!isOnline || activeGroupId === 'all') return;
    const channelsInGroup = latestStateRef.current.channels.filter(
      (c) => c.groupId === activeGroupId
    );
    if (channelsInGroup.length === 0) return;

    const lastGroupCheck = lastGroupSyncAtRef.current.get(activeGroupId) || 0;
    if (Date.now() - lastGroupCheck < 20 * 1000) return;

    const timer = setTimeout(() => {
      void syncHandlersRef.current.syncChannelFeeds({
        groupId: activeGroupId,
        silent: true,
        force: true,
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [activeGroupId, isOnline, channels.length]);

  // Periodic background auto-update (every 60s while visible) & on tab visibility / focus / pageshow / online return
  useEffect(() => {
    if (!isOnline || channels.length === 0) return;

    const checkAndSyncIfDue = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const lastAll = lastGroupSyncAtRef.current.get('all') || loadLastFeedSyncAt();
      const targetGroup =
        activeGroupId !== 'all' &&
        Date.now() - (lastGroupSyncAtRef.current.get(activeGroupId) || 0) >= 25 * 1000
          ? activeGroupId
          : Date.now() - lastAll >= 55 * 1000
          ? 'all'
          : null;
      if (targetGroup) {
        void syncHandlersRef.current.syncChannelFeeds({
          groupId: targetGroup,
          silent: true,
          force: true,
        });
      }
    };

    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void syncHandlersRef.current.syncChannelFeeds({
        groupId: 'all',
        silent: true,
        force: true,
      });
    }, 60 * 1000);

    document.addEventListener('visibilitychange', checkAndSyncIfDue);
    window.addEventListener('focus', checkAndSyncIfDue);
    window.addEventListener('pageshow', checkAndSyncIfDue);
    window.addEventListener('online', checkAndSyncIfDue);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', checkAndSyncIfDue);
      window.removeEventListener('focus', checkAndSyncIfDue);
      window.removeEventListener('pageshow', checkAndSyncIfDue);
      window.removeEventListener('online', checkAndSyncIfDue);
    };
  }, [isOnline, channels.length, activeGroupId]);

  // Background Sync Processor: automatically runs when connection returns
  useEffect(() => {
    if (!isOnline || pendingSyncQueue.length === 0 || isBackgroundSyncing) return;

    let cancelled = false;
    const processQueue = async () => {
      setIsBackgroundSyncing(true);
      const tasks = [...pendingSyncQueue];
      const remaining: PendingSyncTask[] = [];

      for (const task of tasks) {
        if (cancelled) break;
        try {
          if (task.type === 'REFRESH_FEEDS') {
            await syncHandlersRef.current.handleRefreshFeeds();
          } else if (task.type === 'ADD_CHANNELS') {
            await syncHandlersRef.current.handleAddChannels(task.inputs, task.targetGroupId);
          }
        } catch {
          remaining.push(task);
        }
      }

      if (!cancelled) {
        setPendingSyncQueue(remaining);
        setIsBackgroundSyncing(false);
      }
    };

    processQueue();
    return () => {
      cancelled = true;
    };
  }, [isOnline, pendingSyncQueue.length, isBackgroundSyncing]);

  // Persist player session & progress immediately when app is minimized or closed
  useEffect(() => {
    savePlayerSessionState({
      playerMode,
      activeTab,
      wasPlaying: isPlaying,
    });
  }, [playerMode, activeTab, isPlaying]);

  useEffect(() => {
    const flushOnExit = () => {
      savePlayerSessionState({
        playerMode,
        activeTab,
        wasPlaying: isPlaying,
      });
      const snap = getPlaybackClockSnapshot();
      if (snap.videoId && snap.currentTime > 0) {
        saveVideoPlaybackProgress(snap.videoId, snap.currentTime, snap.duration);
      }
    };
    const handleVisibilityFlush = () => {
      if (document.visibilityState === 'hidden') {
        flushOnExit();
      }
    };
    window.addEventListener('pagehide', flushOnExit);
    window.addEventListener('beforeunload', flushOnExit);
    document.addEventListener('visibilitychange', handleVisibilityFlush);
    return () => {
      window.removeEventListener('pagehide', flushOnExit);
      window.removeEventListener('beforeunload', flushOnExit);
      document.removeEventListener('visibilitychange', handleVisibilityFlush);
    };
  }, [playerMode, activeTab, isPlaying]);

  // Persist playlists & played videos locally
  useEffect(() => {
    savePlaylists(playlists);
  }, [playlists]);

  useEffect(() => {
    savePlayedVideoIds(playedVideoIds);
  }, [playedVideoIds]);

  const handleTogglePlayed = useCallback(
    (videoId: string) => {
      const prev = latestStateRef.current.playedVideoIds;
      const exists = prev.includes(videoId);
      const next = exists ? prev.filter((id) => id !== videoId) : [videoId, ...prev];
      setPlayedVideoIds(next);
      if (user) {
        loadFirestoreService()
          .then((fs) => fs.updatePlayedVideosInFirestore(user.uid, next))
          .catch(console.error);
      }
    },
    [user]
  );

  const handleMarkAsPlayed = useCallback(
    (videoId: string) => {
      const prev = latestStateRef.current.playedVideoIds;
      if (prev.includes(videoId)) return;
      const next = [videoId, ...prev];
      setPlayedVideoIds(next);
      if (user) {
        loadFirestoreService()
          .then((fs) => fs.updatePlayedVideosInFirestore(user.uid, next))
          .catch(console.error);
      }
    },
    [user]
  );

  const handleCreatePlaylist = (name: string, description: string, initialVideoIds: string[]): Playlist => {
    const now = new Date().toISOString();
    const newPlaylist: Playlist = {
      id: `pl_${Date.now()}`,
      name,
      description,
      videoIds: initialVideoIds,
      createdAt: now,
      updatedAt: now,
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);
    if (user) {
      loadFirestoreService()
        .then((fs) => fs.createPlaylistInFirestore(user.uid, newPlaylist))
        .catch(console.error);
    }
    return newPlaylist;
  };

  const handleUpdatePlaylist = (
    playlistId: string,
    updates: { name?: string; description?: string; videoIds?: string[] }
  ) => {
    const now = new Date().toISOString();
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? {
              ...pl,
              ...updates,
              updatedAt: now,
            }
          : pl
      )
    );
    if (user) {
      loadFirestoreService()
        .then((fs) => fs.updatePlaylistInFirestore(user.uid, playlistId, updates))
        .catch(console.error);
    }
  };

  const handleDeletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
    if (user) {
      loadFirestoreService()
        .then((fs) => fs.deletePlaylistInFirestore(user.uid, playlistId))
        .catch(console.error);
    }
  };

  const handlePlayPlaylist = (orderedVideos: Video[], mode: PlayerMode) => {
    if (orderedVideos.length === 0) return;
    nativeAudioRef.current?.unlock();
    autoSwitchedToAudioRef.current = false;
    const [first, ...rest] = orderedVideos;
    setQueue(rest);
    selectVideoForPlayback(first, mode, true);
    setActiveTab('player');
    saveLastVideoId(first.id);
    if (
      mode === 'audio' &&
      bgAudioSettingsRef.current.autoPromptActivation &&
      !bgAudioSettingsRef.current.activatedAt &&
      !bgAudioSettingsRef.current.promptDismissed
    ) {
      setHasOpenedBgAudioModal(true);
      setIsBgAudioModalOpen(true);
    } else if (bgAudioSettingsRef.current.enabled && bgAudioSettingsRef.current.autoPopupOnPlay) {
      void floatingMiniPlayerRef.current.openPopup({ silent: true, videoOverride: first });
    }
  };

  // Background audio & Media Session API (keeps audio playing when minimized or screen-locked)
  useBackgroundAudio({
    currentVideo,
    isPlaying,
    playbackRate,
    onPlay: () => {
      nativeAudioRef.current?.unlock();
      setIsPlaying(true);
    },
    onPause: () => setIsPlaying(false),
    onNext: handleNextTrack,
    onPrev: handlePrevTrack,
    onSeek: handleSeek,
    onSkipBack: handleSkipBack,
    onSkipForward: handleSkipForward,
    onVisibilityHiddenWhilePlaying: () => {
      if (
        bgAudioSettingsRef.current.enabled &&
        bgAudioSettingsRef.current.autoSwitchOnMinimize &&
        playerMode === 'video' &&
        currentAudioStatus === 'available'
      ) {
        autoSwitchedToAudioRef.current = true;
        setPlayerMode('audio');
      }
    },
    onVisibilityVisible: () => {
      if (autoSwitchedToAudioRef.current) {
        autoSwitchedToAudioRef.current = false;
        setPlayerMode('video');
      }
    },
  });

  const handleYouTubeTimeUpdate = useCallback(
    (cur: number, dur: number) => {
      if (useNativeAudio || isCheckingNativeAudio || isPopupEmbedActive || !currentVideoIdRef.current)
        return;
      const vid = currentVideoIdRef.current;
      setPlaybackClock(vid, cur, dur);
      if (Math.abs(cur - lastSavedProgressTimeRef.current) >= 10) {
        lastSavedProgressTimeRef.current = cur;
        persistProgress(vid, cur, dur);
      }
    },
    [persistProgress, useNativeAudio, isCheckingNativeAudio, isPopupEmbedActive]
  );

  const handleYouTubeStateChange = useCallback(
    (playing: boolean) => {
      if (useNativeAudio || isCheckingNativeAudio || isPopupEmbedActive) return;
      setIsPlaying(playing);
    },
    [useNativeAudio, isCheckingNativeAudio, isPopupEmbedActive]
  );

  const handleYouTubeEnded = useCallback(() => {
    if (useNativeAudio || isCheckingNativeAudio || isPopupEmbedActive) return;
    if (currentVideoIdRef.current) {
      handleMarkAsPlayed(currentVideoIdRef.current);
    }
    handleNextTrack();
  }, [
    handleMarkAsPlayed,
    handleNextTrack,
    useNativeAudio,
    isCheckingNativeAudio,
    isPopupEmbedActive,
  ]);

  const handleNativeTimeUpdate = useCallback(
    (cur: number, dur: number) => {
      const vid = currentVideoIdRef.current;
      if (!vid) return;
      setPlaybackClock(vid, cur, dur);
      if (Math.abs(cur - lastSavedProgressTimeRef.current) >= 10) {
        lastSavedProgressTimeRef.current = cur;
        persistProgress(vid, cur, dur);
      }
    },
    [persistProgress]
  );

  const handleNativeEnded = useCallback(() => {
    if (currentVideoIdRef.current) {
      handleMarkAsPlayed(currentVideoIdRef.current);
    }
    handleNextTrack();
  }, [handleMarkAsPlayed, handleNextTrack]);

  const handleNativeFallbackNeeded = useCallback(
    (reason: 'login_required' | 'live_stream' | 'unavailable' = 'unavailable') => {
      const vidId = currentVideoIdRef.current;
      if (!vidId) return;
      setAudioStatusMap((prev) => ({ ...prev, [vidId]: reason }));
    },
    []
  );

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Precompute group channel counts and channel video counts in O(N) instead of O(N*M) per render
  const groupChannelCounts = useMemo(() => {
    const map = new Map<string, number>();
    map.set('all', channels.length);
    for (const c of channels) {
      map.set(c.groupId, (map.get(c.groupId) || 0) + 1);
    }
    return map;
  }, [channels]);

  const channelVideoCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of videos) {
      map.set(v.channelId, (map.get(v.channelId) || 0) + 1);
    }
    return map;
  }, [videos]);

  const queueIdSet = useMemo(() => new Set(queue.map((q) => q.id)), [queue]);
  const playedIdSet = useMemo(() => new Set(playedVideoIds), [playedVideoIds]);

  // 9. Filter and Sort Videos
  const filteredVideos = useMemo(() => {
    let channelIdsInGroup: Set<string> | null = null;
    if (activeGroupId !== 'all') {
      channelIdsInGroup = new Set(
        channels.filter((c) => c.groupId === activeGroupId).map((c) => c.id)
      );
    }
    const q = deferredSearchQuery.trim().toLowerCase();

    const result = videos.filter((v) => {
      if (channelIdsInGroup && !channelIdsInGroup.has(v.channelId)) return false;
      if (selectedChannelId && v.channelId !== selectedChannelId) return false;
      if (playStatusFilter === 'unplayed' && playedIdSet.has(v.id)) return false;
      if (playStatusFilter === 'played' && !playedIdSet.has(v.id)) return false;
      if (
        q &&
        !v.title.toLowerCase().includes(q) &&
        !v.channelTitle.toLowerCase().includes(q) &&
        !(v.description && v.description.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });

    // Sort with precomputed timestamps for fast O(N log N)
    if (sortBy === 'newest' || sortBy === 'oldest') {
      const timeById = new Map<string, number>();
      for (const v of result) {
        timeById.set(v.id, Date.parse(v.publishedAt) || 0);
      }
      result.sort((a, b) =>
        sortBy === 'newest'
          ? (timeById.get(b.id) || 0) - (timeById.get(a.id) || 0)
          : (timeById.get(a.id) || 0) - (timeById.get(b.id) || 0)
      );
    } else if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [
    videos,
    channels,
    activeGroupId,
    selectedChannelId,
    playStatusFilter,
    playedIdSet,
    deferredSearchQuery,
    sortBy,
  ]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(FEED_PAGE_SIZE);
  }, [activeGroupId, selectedChannelId, playStatusFilter, deferredSearchQuery, sortBy]);

  const visibleVideos = useMemo(
    () => filteredVideos.slice(0, visibleCount),
    [filteredVideos, visibleCount]
  );
  const hasMoreVideos = visibleCount < filteredVideos.length;

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMoreVideos || activeTab !== 'feed') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(filteredVideos.length, prev + FEED_PAGE_SIZE));
        }
      },
      { rootMargin: '320px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreVideos, filteredVideos.length, activeTab]);

  const existingChannelIds = useMemo(() => channels.map((c) => c.id), [channels]);

  const activeGroupChannels = useMemo(() => {
    if (activeGroupId === 'all') return channels;
    return channels.filter((c) => c.groupId === activeGroupId);
  }, [channels, activeGroupId]);

  const activeGroup = groups.find((g) => g.id === activeGroupId) || groups[0];
  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  const handleOpenAddFromHeader = useCallback(() => openSearchChannelModal(''), []);
  const handleOpenGroupFromHeader = useCallback(() => setIsGroupModalOpen(true), []);
  const handleOpenDrawerFromHeader = useCallback(() => setIsChannelDrawerOpen(true), []);
  const handleOpenPlaylistFromHeader = useCallback(() => {
    setVideoToAddToPlaylist(null);
    setIsPlaylistModalOpen(true);
  }, []);
  const showBgAudioNotice = useCallback((msg: string) => {
    setBgAudioNotice(msg);
    if (bgAudioNoticeTimerRef.current) {
      clearTimeout(bgAudioNoticeTimerRef.current);
    }
    bgAudioNoticeTimerRef.current = setTimeout(() => {
      setBgAudioNotice(null);
    }, 4500);
  }, []);

  const handleOpenBackgroundAudioPopup = useCallback(() => {
    nativeAudioRef.current?.unlock();
    setHasOpenedBgAudioModal(true);
    setIsBgAudioModalOpen(true);
  }, []);

  const handleQuickSubscribeFromPlayer = useCallback(
    async (video: Video) => {
      if (!video.channelId || subscribingChannelId) return;
      if (latestStateRef.current.channels.some((c) => c.id === video.channelId)) return;
      const targetGroup = activeGroupId !== 'all' ? activeGroupId : 'general';
      setSubscribingChannelId(video.channelId);
      try {
        const result = await syncHandlersRef.current.handleAddChannels(
          [video.channelId],
          targetGroup,
          {
            [video.channelId]: {
              id: video.channelId,
              title: video.channelTitle,
              url: `https://www.youtube.com/channel/${video.channelId}`,
            },
          }
        );
        if (result.success > 0) {
          showBgAudioNotice(`Channel "${video.channelTitle}" berhasil ditambahkan ke langganan.`);
        } else {
          showBgAudioNotice(result.lastError || `Gagal menambahkan "${video.channelTitle}".`);
        }
      } finally {
        setSubscribingChannelId(null);
      }
    },
    [activeGroupId, showBgAudioNotice, subscribingChannelId]
  );

  const handleActivateBgAudio = useCallback(
    (next: BackgroundAudioSettings) => {
      nativeAudioRef.current?.unlock();
      setBgAudioSettings(next);
      setPendingReopenResume(null);
      if (
        next.enabled &&
        next.autoPopupOnPlay &&
        currentVideo &&
        isPlayingRef.current &&
        !floatingMiniPlayerRef.current.isOpen
      ) {
        void floatingMiniPlayerRef.current.openPopup({ silent: true });
      }
      showBgAudioNotice('Setting otomatis popup & audio latar belakang aktif.');
    },
    [showBgAudioNotice, currentVideo]
  );

  const handleDismissBgAudio = useCallback((next: BackgroundAudioSettings) => {
    setBgAudioSettings(next);
  }, []);

  const handleResumeLastPlayback = useCallback(() => {
    if (!pendingReopenResume) return;
    const target = pendingReopenResume;
    setPendingReopenResume(null);
    handlePlayVideo(target, playerMode);
  }, [pendingReopenResume, handlePlayVideo, playerMode]);

  const handleTogglePlayerModeFromHeader = useCallback(() => {
    autoSwitchedToAudioRef.current = false;
    setPlayerMode((prev) => {
      if (prev === 'video') {
        nativeAudioRef.current?.unlock();
        if (
          bgAudioSettingsRef.current.autoPromptActivation &&
          !bgAudioSettingsRef.current.activatedAt &&
          !bgAudioSettingsRef.current.promptDismissed
        ) {
          setHasOpenedBgAudioModal(true);
          setIsBgAudioModalOpen(true);
        } else if (
          bgAudioSettingsRef.current.enabled &&
          bgAudioSettingsRef.current.autoPopupOnPlay &&
          isPlayingRef.current &&
          !floatingMiniPlayerRef.current.isOpen
        ) {
          void floatingMiniPlayerRef.current.openPopup({ silent: true });
        }
      }
      return prev === 'video' ? 'audio' : 'video';
    });
  }, []);
  const handleToggleMute = useCallback(() => setIsMuted((prev) => !prev), []);
  const handleSwitchToVideoMode = useCallback(() => {
    autoSwitchedToAudioRef.current = false;
    setPlayerMode('video');
  }, []);
  const handleSwitchToAudioMode = useCallback(() => {
    autoSwitchedToAudioRef.current = false;
    nativeAudioRef.current?.unlock();
    setPlayerMode('audio');
    if (
      bgAudioSettingsRef.current.autoPromptActivation &&
      !bgAudioSettingsRef.current.activatedAt &&
      !bgAudioSettingsRef.current.promptDismissed
    ) {
      setHasOpenedBgAudioModal(true);
      setIsBgAudioModalOpen(true);
    } else if (
      bgAudioSettingsRef.current.enabled &&
      bgAudioSettingsRef.current.autoPopupOnPlay &&
      isPlayingRef.current &&
      !floatingMiniPlayerRef.current.isOpen
    ) {
      void floatingMiniPlayerRef.current.openPopup({ silent: true });
    }
  }, []);
  const handleExpandPiP = useCallback(() => {
    autoSwitchedToAudioRef.current = false;
    setPlayerMode('video');
    setActiveTab('player');
  }, []);
  const handlePlayVideoQueueItem = useCallback(
    (v: Video) => handlePlayVideo(v, 'video'),
    [handlePlayVideo]
  );
  const handlePlayAudioQueueItem = useCallback(
    (v: Video) => handlePlayVideo(v, 'audio'),
    [handlePlayVideo]
  );
  const handleOpenAudioExtractorSettings = useCallback(() => {
    setPendingExtractorVideo(currentVideo);
    setExtractorIntent('playback');
    setHasOpenedExtractorModal(true);
    setIsExtractorModalOpen(true);
  }, [currentVideo]);
  openAudioExtractorRef.current = handleOpenAudioExtractorSettings;
  const handleSeekHandled = useCallback(() => setSeekCommand(null), []);
  const handleExpandPlayerTab = useCallback(() => setActiveTab('player'), []);

  // Lock resume seek timestamp per active track so 10s progress saves don't churn player props
  const initialSeekForCurrentVideo = useMemo(
    () => (currentVideo ? playbackProgressMapRef.current[currentVideo.id]?.currentTime || 0 : 0),
    [currentVideo?.id]
  );

  // Global keyboard shortcuts (Escape to close modals, Space to play/pause, / to search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (channelToDelete) {
          setChannelToDelete(null);
          return;
        }
        if (isBgAudioModalOpen) {
          setIsBgAudioModalOpen(false);
          return;
        }
        if (isExtractorModalOpen) {
          setIsExtractorModalOpen(false);
          return;
        }
        if (isPlaylistModalOpen) {
          setIsPlaylistModalOpen(false);
          setVideoToAddToPlaylist(null);
          return;
        }
        if (isChannelDrawerOpen) {
          setIsChannelDrawerOpen(false);
          return;
        }
        if (isGroupModalOpen) {
          setIsGroupModalOpen(false);
          return;
        }
        if (isAddModalOpen) {
          setIsAddModalOpen(false);
          setPastedLinkForModal('');
          setAddModalSearchQuery('');
          return;
        }
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        tag === 'A' ||
        Boolean(target?.isContentEditable);
      if (isEditable || e.metaKey || e.ctrlKey || e.altKey) return;

      const anyModalOpen =
        Boolean(channelToDelete) ||
        isBgAudioModalOpen ||
        isExtractorModalOpen ||
        isPlaylistModalOpen ||
        isChannelDrawerOpen ||
        isGroupModalOpen ||
        isAddModalOpen;
      if (anyModalOpen) return;

      if (e.code === 'Space' && currentVideo) {
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === '/' && activeTab === 'feed') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    channelToDelete,
    isBgAudioModalOpen,
    isExtractorModalOpen,
    isPlaylistModalOpen,
    isChannelDrawerOpen,
    isGroupModalOpen,
    isAddModalOpen,
    currentVideo,
    activeTab,
    handlePlayPause,
  ]);

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-red-500 selection:text-white transition-colors duration-200 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      {/* Top Bar Header */}
      <Header
        theme={themePreference}
        onThemeChange={handleThemeChange}
        onOpenAddModal={handleOpenAddFromHeader}
        onOpenGroupModal={handleOpenGroupFromHeader}
        onOpenChannelDrawer={handleOpenDrawerFromHeader}
        onOpenPlaylistModal={handleOpenPlaylistFromHeader}
        playlistCount={playlists.length}
        playerMode={playerMode}
        onTogglePlayerMode={handleTogglePlayerModeFromHeader}
        activeFilterGroup={activeGroupId}
        onSelectGroup={setActiveGroupId}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        authLoading={authLoading}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onOpenBackgroundAudioPopup={handleOpenBackgroundAudioPopup}
        backgroundAudioEnabled={bgAudioSettings.enabled}
      />

      {/* Offline & Background Sync Status Banner */}
      <OfflineBanner
        isOnline={isOnline}
        isSyncing={isBackgroundSyncing}
        pendingCount={pendingSyncQueue.length}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex-1 pt-6 sm:pt-8">
        {/* Active Player View (Podcast Audio or Video) */}
        {currentVideo && (
          <section className="mb-10">
            {/* 1. Podcast Player View */}
            <motion.div
              initial={false}
              animate={{
                opacity: activeTab === 'player' && playerMode === 'audio' ? 1 : 0,
                y: activeTab === 'player' && playerMode === 'audio' ? 0 : 8,
                scale: activeTab === 'player' && playerMode === 'audio' ? 1 : 0.985,
              }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={activeTab === 'player' && playerMode === 'audio' ? 'block' : 'hidden'}
            >
              <PodcastPlayer
                currentVideo={currentVideo}
                isPlaying={isPlaying}
                isVisible={activeTab === 'player' && playerMode === 'audio'}
                playbackRate={playbackRate}
                volume={volume}
                isMuted={isMuted}
                sleepTimerMinutes={sleepTimerMinutes}
                sleepTimerExpiresAt={sleepTimerExpiresAt}
                queue={queue}
                usingNativeAudio={useNativeAudio}
                nativeAudioStatus={currentAudioStatus}
                downloadState={audioDownloads[currentVideo.id]}
                onDownloadAudio={handleDownloadAudio}
                onOpenAudioExtractorSettings={handleOpenAudioExtractorSettings}
                backgroundAudioEnabled={bgAudioSettings.enabled}
                onOpenBackgroundAudioPopup={handleOpenBackgroundAudioPopup}
                isFloatingSupported={floatingMiniPlayer.isSupported}
                isFloatingOpen={floatingMiniPlayer.isOpen}
                onToggleFloatingPopup={floatingMiniPlayer.togglePopup}
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
                onSkipBack={handleSkipBack}
                onSkipForward={handleSkipForward}
                onNext={handleNextTrack}
                onPrev={handlePrevTrack}
                onSpeedChange={setPlaybackRate}
                onVolumeChange={setVolume}
                onToggleMute={handleToggleMute}
                onSwitchToVideo={handleSwitchToVideoMode}
                onSetSleepTimer={handleSetSleepTimer}
                onPlayQueueItem={handlePlayAudioQueueItem}
                onRemoveFromQueue={handleRemoveFromQueue}
                onMoveQueueItem={handleMoveQueueItem}
                onClearQueue={handleClearQueue}
                onAddToPlaylist={handleAddToPlaylistCard}
                isPlayed={playedIdSet.has(currentVideo.id)}
                onTogglePlayed={handleTogglePlayed}
                isChannelSubscribed={existingChannelIds.includes(currentVideo.channelId)}
                isSubscribingChannel={subscribingChannelId === currentVideo.channelId}
                onSubscribeChannel={handleQuickSubscribeFromPlayer}
              />
            </motion.div>

            {/* 2. Video Player View (Hosts the actual YouTube iframe without unmounting once activated) */}
            <div
              className={
                activeTab === 'player' && playerMode === 'video'
                  ? 'block'
                  : isPlaying && !useNativeAudio && !isCheckingNativeAudio && !isPopupEmbedActive
                  ? 'fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 w-44 sm:w-64 aspect-video rounded-2xl overflow-hidden shadow-2xl border border-slate-300 dark:border-slate-700 z-40 bg-black transition-all'
                  : 'fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 w-44 aspect-video pointer-events-none opacity-0 -z-50 overflow-hidden'
              }
            >
              <VideoPlayerView
                currentVideo={currentVideo}
                queue={queue}
                isMiniPiP={!(activeTab === 'player' && playerMode === 'video')}
                onExpandPiP={handleExpandPiP}
                onSwitchToAudio={handleSwitchToAudioMode}
                onPlayVideo={handlePlayVideoQueueItem}
                onRemoveFromQueue={handleRemoveFromQueue}
                onMoveQueueItem={handleMoveQueueItem}
                onClearQueue={handleClearQueue}
                downloadState={audioDownloads[currentVideo.id]}
                onDownloadAudio={handleDownloadAudio}
                backgroundAudioEnabled={bgAudioSettings.enabled}
                onOpenBackgroundAudioPopup={handleOpenBackgroundAudioPopup}
                isFloatingSupported={floatingMiniPlayer.isSupported}
                isFloatingOpen={floatingMiniPlayer.isOpen}
                onToggleFloatingPopup={floatingMiniPlayer.togglePopup}
                onAddToPlaylist={handleAddToPlaylistCard}
                isPlayed={playedIdSet.has(currentVideo.id)}
                onTogglePlayed={handleTogglePlayed}
                isChannelSubscribed={existingChannelIds.includes(currentVideo.channelId)}
                isSubscribingChannel={subscribingChannelId === currentVideo.channelId}
                onSubscribeChannel={handleQuickSubscribeFromPlayer}
                playerSlot={
                  hasActivatedYouTube ? (
                    <YouTubePlayer
                      currentVideo={currentVideo}
                      isPlaying={
                        useNativeAudio || isCheckingNativeAudio || isPopupEmbedActive
                          ? false
                          : isPlaying
                      }
                      mode={playerMode}
                      isVisible={activeTab === 'player' && playerMode === 'video'}
                      playbackRate={playbackRate}
                      volume={volume}
                      isMuted={isMuted}
                      initialSeekSeconds={initialSeekForCurrentVideo}
                      onTimeUpdate={handleYouTubeTimeUpdate}
                      onStateChange={handleYouTubeStateChange}
                      onEnded={handleYouTubeEnded}
                      onOpenExtractorAuth={handleOpenAudioExtractorSettings}
                      seekCommand={
                        useNativeAudio || isCheckingNativeAudio || isPopupEmbedActive
                          ? null
                          : seekCommand
                      }
                      onSeekHandled={handleSeekHandled}
                    />
                  ) : null
                }
              />
            </div>
          </section>
        )}

        {/* Group Navigation Bar & Filter Strip */}
        <section className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Group Tabs (Segmented interactive buttons) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {groups.map((group) => {
                const isActive = activeGroupId === group.id && !selectedChannelId;
                const count = groupChannelCounts.get(group.id) || 0;

                return (
                  <motion.button
                    key={group.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setActiveGroupId(group.id);
                      setSelectedChannelId(null);
                    }}
                    className={`relative flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-white'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="activeGroupIndicator"
                        transition={{ type: 'spring', stiffness: 480, damping: 35 }}
                        className="absolute inset-0 rounded-xl bg-red-600 shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{group.name}</span>
                    <span
                      className={`relative z-10 text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </motion.button>
                );
              })}

              {/* Quick Manage Groups button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsGroupModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white bg-transparent rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
                title="Kelola & Ganti Nama Grup"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Atur Grup</span>
              </motion.button>
            </div>

            {/* Quick Actions & Refresh */}
            <div className="flex flex-wrap items-center gap-2">
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => openSearchVideoModal(searchQuery.trim())}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Cari judul video langsung di YouTube dan putar"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari Video YouTube</span>
              </motion.button>

              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => openSearchChannelModal(searchQuery.trim())}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Cari dan tambahkan channel baru langsung dari YouTube"
              >
                <Plus className="w-3.5 h-3.5 text-red-500" />
                <span>Cari Channel</span>
              </motion.button>

              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleQuickPasteAndOpen}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Tempel link YouTube langsung dari clipboard"
              >
                <Clipboard className="w-3.5 h-3.5 text-red-500" />
                <span>Tempel Link</span>
              </motion.button>

              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleRefreshFeeds}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Perbarui Video Terbaru dari YouTube"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-red-500' : ''}`} />
                <span>{isRefreshing ? 'Memperbarui...' : 'Sinkron Feed'}</span>
              </motion.button>
            </div>
          </div>

          {/* Channel List Inside Group (shown when group has multiple channels or specific group selected) */}
          <AnimatePresence initial={false}>
            {(activeGroupChannels.length > 1 ||
              (activeGroupId !== 'all' && activeGroupChannels.length > 0)) && (
              <motion.div
                key={`group-strip-${activeGroupId}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1 gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Folder className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="truncate">
                      Channel dalam Grup "{groups.find((g) => g.id === activeGroupId)?.name || 'Semua'}" ({activeGroupChannels.length})
                    </span>
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    {isAutoCheckingGroup || isRefreshing ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Memeriksa video baru...</span>
                      </span>
                    ) : (
                      <span className="hidden sm:inline text-[11px] text-slate-400 font-medium">
                        {lastSyncedTimeLabel
                          ? `Auto-update aktif · ${lastSyncedTimeLabel}`
                          : 'Auto-update aktif'}
                      </span>
                    )}
                    {selectedChannelId && (
                      <button
                        onClick={() => setSelectedChannelId(null)}
                        className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                      >
                        Tampilkan Semua
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setSelectedChannelId(null)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      !selectedChannelId
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Semua ({activeGroupChannels.length})
                  </motion.button>

                  {activeGroupChannels.map((ch) => {
                    const isSelected = selectedChannelId === ch.id;
                    const chVideoCount = channelVideoCounts.get(ch.id) || 0;

                    return (
                      <motion.div
                        key={ch.id}
                        whileHover={{ y: -1 }}
                        className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors border ${
                          isSelected
                            ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-200/70 dark:border-slate-700/70 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <button
                          onClick={() => setSelectedChannelId(isSelected ? null : ch.id)}
                          className="flex items-center gap-2 py-0.5 cursor-pointer"
                        >
                          <img
                            src={ch.avatar || `https://avatar.vercel.sh/${ch.id}?size=64`}
                            alt={ch.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const img = e.currentTarget;
                              const fallback = `https://avatar.vercel.sh/${ch.id}?size=64`;
                              if (img.src !== fallback) img.src = fallback;
                            }}
                            className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                          />
                          <span className="max-w-[140px] sm:max-w-[160px] truncate">{ch.title}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                              isSelected
                                ? 'bg-red-200/70 dark:bg-red-900/70 text-red-800 dark:text-red-200'
                                : 'bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {chVideoCount}
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChannelToDelete(ch);
                          }}
                          className="p-1.5 ml-0.5 pl-2 border-l border-slate-200/70 dark:border-slate-700/70 rounded-r-lg text-slate-400 hover:text-red-600 hover:bg-red-100/70 dark:hover:text-red-400 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                          title={`Hapus channel ${ch.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search, Filter & Channel Focus Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Cari judul video, nama channel, atau tempel link..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    if (
                      pasted &&
                      /(?:https?:\/\/)?(?:[a-z0-9-]+\.)?(?:youtube\.com|youtu\.be)\//i.test(pasted)
                    ) {
                      e.preventDefault();
                      openSearchChannelModal(pasted.trim());
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      const trimmed = searchQuery.trim();
                      const isLinkOrHandle =
                        /(?:https?:\/\/)?(?:[a-z0-9-]+\.)?(?:youtube\.com|youtu\.be)\//i.test(
                          trimmed
                        ) ||
                        /^@[a-zA-Z0-9_.-]{2,}$/.test(trimmed) ||
                        /^UC[a-zA-Z0-9_-]{22}$/.test(trimmed);
                      if (isLinkOrHandle) {
                        e.preventDefault();
                        openSearchChannelModal(trimmed);
                      } else if (filteredVideos.length === 0) {
                        e.preventDefault();
                        openSearchVideoModal(trimmed);
                      }
                    }
                  }}
                  className="w-full pl-9 pr-10 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                    aria-label="Hapus pencarian"
                  >
                    ×
                  </button>
                )}
              </div>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => openSearchVideoModal(searchQuery.trim())}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200/80 dark:border-red-800/60 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  title={`Cari judul video "${searchQuery.trim()}" di YouTube`}
                >
                  Cari Video di YouTube
                </button>
              )}
            </div>

            {/* Selected Channel Focus Tag */}
            <AnimatePresence>
              {selectedChannel && (
                <motion.div
                  key={`focus-${selectedChannel.id}`}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300"
                >
                  <span className="font-semibold truncate">Fokus Channel: {selectedChannel.title}</span>
                  <button
                    onClick={() => setChannelToDelete(selectedChannel)}
                    className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg hover:bg-red-200/60 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 cursor-pointer shrink-0"
                    title="Hapus channel ini"
                    aria-label="Hapus channel ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSelectedChannelId(null)}
                    className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg font-bold hover:text-red-900 dark:hover:text-white hover:bg-red-200/60 dark:hover:bg-red-900/50 cursor-pointer shrink-0"
                    title="Hapus filter channel"
                    aria-label="Hapus filter channel"
                  >
                    ×
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Unplayed Filter & Sort Controls */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                {(
                  [
                    { id: 'all', label: 'Semua' },
                    { id: 'unplayed', label: 'Belum Diputar' },
                    { id: 'played', label: 'Sudah Diputar' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPlayStatusFilter(opt.id)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      playStatusFilter === opt.id
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-400 hidden sm:inline">Urutkan:</span>
                <select
                  aria-label="Urutkan video"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
                >
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                  <option value="title">Judul (A-Z)</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Video Grid Section */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {selectedChannel ? `Video dari ${selectedChannel.title}` : `Video: ${activeGroup.name}`}
              </h2>
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                ({filteredVideos.length} video tersedia)
              </span>
            </div>

            {activeTab !== 'player' && currentVideo && (
              <button
                onClick={() => setActiveTab('player')}
                className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {playerMode === 'audio' ? <Radio className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
                <span>Buka Pemutar Sekarang</span>
              </button>
            )}
          </div>

          {/* Focused Channel Full Catalog Status Bar */}
          {selectedChannel && (() => {
            const catalogState = channelCatalogMap[selectedChannel.id];
            const totalForSelected = channelVideoCounts.get(selectedChannel.id) || 0;
            const loadedLabelCount = Math.max(totalForSelected, catalogState?.loadedCount || 0);

            return (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {catalogState?.loading ? (
                    <>
                      <Loader2 className="w-4 h-4 text-red-600 animate-spin shrink-0" />
                      <span className="text-slate-700 dark:text-slate-200 font-medium">
                        Memuat semua video dari {selectedChannel.title}...{' '}
                        <strong className="tabular-nums text-slate-900 dark:text-white">
                          ({loadedLabelCount} video dimuat)
                        </strong>
                      </span>
                    </>
                  ) : catalogState?.error ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-amber-700 dark:text-amber-300 font-medium">
                        {catalogState.error} ({loadedLabelCount} video dimuat)
                      </span>
                    </>
                  ) : catalogState?.fullyLoaded ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        Semua <strong className="tabular-nums text-slate-900 dark:text-white">{totalForSelected}</strong> video dari channel ini ditampilkan
                      </span>
                    </>
                  ) : catalogState?.hasMore ? (
                    <>
                      <RefreshCw className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {loadedLabelCount} video dimuat (masih tersedia lebih banyak di YouTube)
                      </span>
                    </>
                  ) : (
                    <>
                      <Tv className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        Menampilkan {totalForSelected} video dari {selectedChannel.title}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {catalogState?.loading ? (
                    <button
                      type="button"
                      onClick={stopChannelAllVideos}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      Hentikan
                    </button>
                  ) : (
                    <>
                      {catalogState?.hasMore && (
                        <button
                          type="button"
                          onClick={() => void loadChannelAllVideos(selectedChannel.id, { resume: true })}
                          disabled={!isOnline}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white transition-colors cursor-pointer"
                        >
                          Lanjutkan Muat
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void loadChannelAllVideos(selectedChannel.id, { force: true })}
                        disabled={!isOnline}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>
                          {catalogState?.fullyLoaded ? 'Muat Ulang Semua' : 'Muat Semua Video'}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {filteredVideos.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Tidak ada video ditemukan
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? `Tidak ada video yang cocok dengan kata kunci "${searchQuery}". Coba kata kunci lain.`
                  : 'Belum ada video pada grup ini. Tambahkan channel baru atau sinkronkan feed.'}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => openSearchVideoModal(searchQuery.trim())}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
                >
                  {searchQuery.trim()
                    ? `Cari Video "${searchQuery.trim()}" di YouTube`
                    : 'Cari Video YouTube'}
                </button>
                <button
                  onClick={() => openSearchChannelModal(searchQuery.trim())}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cari Channel
                </button>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Hapus Pencarian
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {visibleVideos.map((video, idx) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    index={idx}
                    isCurrentlyPlaying={currentVideo?.id === video.id && isPlaying}
                    isInQueue={queueIdSet.has(video.id)}
                    isPlayed={playedIdSet.has(video.id)}
                    progress={playbackProgressMap[video.id]}
                    downloadState={audioDownloads[video.id]}
                    onPlayVideo={handlePlayVideoCard}
                    onPlayAudio={handlePlayAudioCard}
                    onToggleQueue={handleToggleQueue}
                    onTogglePlayed={handleTogglePlayed}
                    onDownloadAudio={handleDownloadAudio}
                    onAddToPlaylist={handleAddToPlaylistCard}
                  />
                ))}
              </div>

              {hasMoreVideos && (
                <div ref={loadMoreSentinelRef} className="pt-4 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((prev) => Math.min(filteredVideos.length, prev + FEED_PAGE_SIZE))
                    }
                    className="px-5 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xs transition-colors cursor-pointer"
                  >
                    Muat Lebih Banyak ({filteredVideos.length - visibleCount} video tersisa)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleCount(filteredVideos.length)}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 transition-colors cursor-pointer"
                  >
                    Tampilkan Semua ({filteredVideos.length})
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Feature Explanatory Banner */}
        <section className="mt-16 p-6 sm:p-8 rounded-3xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="flex gap-3">
              <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-600 shrink-0 h-fit">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Mode Podcast & Visualizer
                </h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Putar audio tanpa boros layar, dilengkapi tombol lompat -15s/+30s, kontrol tempo 0.75x–2.0x, dan visualizer spektrum real-time.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-600 shrink-0 h-fit">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Pengelompokan Channel Fleksibel
                </h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Bebas buat folder baru, ganti nama grup kapan saja, dan kelola channel langganan sesuai topik minat Anda.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-600 shrink-0 h-fit">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Mode Gelap Otomatis
                </h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Menyesuaikan preferensi sistem operasi secara instan, serta opsi manual untuk beralih antara Terang dan Gelap.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Persistent Native HTML5 <audio> Engine (always mounted to retain mobile/PWA user-gesture audio unlock) */}
      <NativeAudioPlayer
        ref={nativeAudioRef}
        active={useNativeAudio}
        keepAlivePrimed={Boolean(
          currentVideo &&
            playerMode === 'audio' &&
            bgAudioSettings.enabled &&
            isPlaying &&
            currentAudioStatus === 'checking'
        )}
        currentVideo={currentVideo}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        volume={volume}
        isMuted={isMuted}
        initialSeekSeconds={initialSeekForCurrentVideo}
        seekCommand={useNativeAudio ? seekCommand : null}
        onSeekHandled={handleSeekHandled}
        onTimeUpdate={handleNativeTimeUpdate}
        onStateChange={setIsPlaying}
        onEnded={handleNativeEnded}
        onFallbackNeeded={handleNativeFallbackNeeded}
      />

      {/* Sticky Mini Player Bar (when playing and scrolled or on feed tab) */}
      <MiniPlayerBar
        currentVideo={currentVideo}
        isPlaying={isPlaying}
        mode={playerMode}
        usingNativeAudio={useNativeAudio}
        hasNext={queue.length > 0}
        onPlayPause={handlePlayPause}
        onSkipBack={handleSkipBack}
        onSkipForward={handleSkipForward}
        onNext={handleNextTrack}
        onExpand={handleExpandPlayerTab}
        onToggleMode={handleTogglePlayerModeFromHeader}
        onOpenBackgroundAudioPopup={handleOpenBackgroundAudioPopup}
        backgroundAudioActive={bgAudioSettings.enabled && useNativeAudio}
        isFloatingSupported={floatingMiniPlayer.isSupported}
        isFloatingOpen={floatingMiniPlayer.isOpen}
        onToggleFloatingPopup={floatingMiniPlayer.togglePopup}
      />

      {/* Lazy-Loaded Modals & Drawers */}
      <Suspense fallback={null}>
        {hasOpenedAddModal && (
          <AddChannelModal
            isOpen={isAddModalOpen}
            onClose={() => {
              setIsAddModalOpen(false);
              setPastedLinkForModal('');
              setAddModalSearchQuery('');
            }}
            groups={groups}
            existingChannelIds={existingChannelIds}
            onAddChannels={handleAddChannels}
            onPlayVideo={handlePlayVideoCard}
            onPlayAudio={handlePlayAudioCard}
            onToggleQueue={handleToggleQueue}
            queueIds={queue.map((q) => q.id)}
            initialPastedText={pastedLinkForModal}
            initialTab={addModalTab}
            initialSearchQuery={addModalSearchQuery}
          />
        )}

        {hasOpenedGroupModal && (
          <GroupManagerModal
            isOpen={isGroupModalOpen}
            onClose={() => setIsGroupModalOpen(false)}
            groups={groups}
            channels={channels}
            onAddGroup={handleAddGroup}
            onRenameGroup={handleRenameGroup}
            onDeleteGroup={handleDeleteGroup}
          />
        )}

        {hasOpenedChannelDrawer && (
          <ChannelDrawer
            isOpen={isChannelDrawerOpen}
            onClose={() => setIsChannelDrawerOpen(false)}
            channels={channels}
            groups={groups}
            onDeleteChannel={handleDeleteChannel}
            onChangeChannelGroup={handleChangeChannelGroup}
            onSelectChannelFilter={(chId) => {
              setSelectedChannelId(chId);
              setActiveGroupId('all');
            }}
          />
        )}

        {hasOpenedPlaylistModal && (
          <PlaylistModal
            isOpen={isPlaylistModalOpen}
            onClose={() => {
              setIsPlaylistModalOpen(false);
              setVideoToAddToPlaylist(null);
            }}
            playlists={playlists}
            videos={videos}
            initialVideoToAdd={videoToAddToPlaylist}
            onCreatePlaylist={handleCreatePlaylist}
            onUpdatePlaylist={handleUpdatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onPlayPlaylist={handlePlayPlaylist}
          />
        )}

        {hasOpenedExtractorModal && (
          <AudioExtractorModal
            isOpen={isExtractorModalOpen}
            onClose={() => setIsExtractorModalOpen(false)}
            pendingVideo={pendingExtractorVideo}
            intent={extractorIntent}
            onResolved={handleExtractorResolved}
          />
        )}

        {hasOpenedBgAudioModal && (
          <BackgroundAudioModal
            isOpen={isBgAudioModalOpen}
            onClose={() => setIsBgAudioModalOpen(false)}
            settings={bgAudioSettings}
            onActivateNow={handleActivateBgAudio}
            onDismissPrompt={handleDismissBgAudio}
            currentVideo={currentVideo}
            nativeAudioStatus={currentAudioStatus}
            usingNativeAudio={useNativeAudio}
            isFloatingSupported={floatingMiniPlayer.isSupported}
            supportsAutoPip={floatingMiniPlayer.supportsAutoPip}
            isFloatingOpen={floatingMiniPlayer.isOpen}
            floatingError={floatingMiniPlayer.error}
            onToggleFloatingPopup={floatingMiniPlayer.togglePopup}
            onOpenExtractorAuth={handleOpenAudioExtractorSettings}
            onAutoCookieReady={handleAutoCookieReady}
          />
        )}
      </Suspense>

      {/* Delete Channel Confirmation Modal */}
      <AnimatePresence>
        {channelToDelete && (
          <motion.div
            key="delete-channel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setChannelToDelete(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          >
            <motion.div
              key="delete-channel-dialog"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 440, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <img
                  src={channelToDelete.avatar || `https://avatar.vercel.sh/${channelToDelete.id}?size=100`}
                  alt={channelToDelete.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const img = e.currentTarget;
                    const fallback = `https://avatar.vercel.sh/${channelToDelete.id}?size=100`;
                    if (img.src !== fallback) img.src = fallback;
                  }}
                  className="w-11 h-11 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    Hapus Channel?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {channelToDelete.title}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Channel ini beserta semua daftar videonya akan dihapus dari koleksi Anda. Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setChannelToDelete(null)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Batal
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    handleDeleteChannel(channelToDelete.id);
                    setChannelToDelete(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Channel</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Stacked Bottom Notifications (never overlap each other on mobile HP) */}
      <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md flex flex-col-reverse gap-2 pointer-events-none">
        <AnimatePresence>
          {downloadNotice && (
            <motion.div
              key={`dl-notice-${downloadNotice.videoId}-${downloadNotice.type}`}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto"
            >
              <div
                className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md text-xs ${
                  downloadNotice.type === 'success'
                    ? 'bg-emerald-950/90 border-emerald-700/80 text-emerald-50'
                    : 'bg-red-950/90 border-red-700/80 text-red-50'
                }`}
              >
                {downloadNotice.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-bold truncate">{downloadNotice.title}</div>
                  <div className="opacity-90 break-words">{downloadNotice.message}</div>
                  {downloadNotice.type === 'success' && downloadNotice.hasLocalFile && (
                    <button
                      type="button"
                      onClick={() => void handleSaveOrShareDownload(downloadNotice.videoId)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-emerald-800 font-bold text-[11px] hover:bg-emerald-50 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Simpan / Bagikan File</span>
                    </button>
                  )}
                  {downloadNotice.requiresAuth && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetVideo =
                          videos.find((v) => v.id === downloadNotice.videoId) ||
                          (currentVideo?.id === downloadNotice.videoId ? currentVideo : null);
                        setPendingExtractorVideo(targetVideo);
                        setExtractorIntent('download');
                        setHasOpenedExtractorModal(true);
                        setIsExtractorModalOpen(true);
                        dismissDownloadNotice();
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-white text-red-700 font-bold text-[11px] hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Atasi Pembatasan YouTube
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={dismissDownloadNotice}
                  className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                  title="Tutup"
                  aria-label="Tutup pemberitahuan unduhan"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {feedUpdateNotice && (
            <motion.div
              key="feed-update-toast"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto"
            >
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md text-xs bg-emerald-950/95 border-emerald-700/80 text-emerald-50">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-bold">
                    {feedUpdateNotice.count} video baru di {feedUpdateNotice.groupName}
                  </div>
                  {feedUpdateNotice.channelNames.length > 0 && (
                    <div className="opacity-85 truncate">
                      Dari {feedUpdateNotice.channelNames.join(', ')}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setFeedUpdateNotice(null)}
                  className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                  title="Tutup"
                  aria-label="Tutup pemberitahuan pembaruan"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {pendingReopenResume && (
            <motion.div
              key="reopen-resume-toast"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto"
            >
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md text-xs bg-slate-900/95 border-slate-700/80 text-white">
                <Radio className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-bold">Lanjutkan Pemutaran Terakhir?</div>
                  <div className="opacity-85 truncate">{pendingReopenResume.title}</div>
                  <button
                    type="button"
                    onClick={handleResumeLastPlayback}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Lanjutkan Audio</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingReopenResume(null)}
                  className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                  title="Tutup"
                  aria-label="Tutup pemberitahuan lanjutkan pemutaran"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {bgAudioNotice && (
            <motion.div
              key="bg-audio-notice-toast"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto"
            >
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md text-xs bg-emerald-950/95 border-emerald-700/80 text-emerald-50">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 text-left leading-relaxed">{bgAudioNotice}</div>
                <button
                  type="button"
                  onClick={() => setBgAudioNotice(null)}
                  className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                  title="Tutup"
                  aria-label="Tutup pemberitahuan audio latar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {authNotice && (
            <motion.div
              key="auth-notice-toast"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto"
            >
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md text-xs bg-amber-950/95 border-amber-700/80 text-amber-50">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 text-left leading-relaxed">{authNotice}</div>
                <button
                  type="button"
                  onClick={() => setAuthNotice(null)}
                  className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                  title="Tutup"
                  aria-label="Tutup pemberitahuan akun"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </MotionConfig>
  );
}
