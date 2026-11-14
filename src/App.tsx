import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import { User, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import {
  ensureUserProfile,
  updateThemeInFirestore,
  subscribeToUserGroups,
  subscribeToUserChannels,
  subscribeToUserVideos,
  seedInitialDataIfEmpty,
  createGroupInFirestore,
  renameGroupInFirestore,
  deleteGroupInFirestore,
  saveChannelInFirestore,
  changeChannelGroupInFirestore,
  deleteChannelInFirestore,
  saveVideosInFirestore,
  subscribeToUserPlaylists,
  createPlaylistInFirestore,
  updatePlaylistInFirestore,
  deletePlaylistInFirestore,
  subscribeToPlayedVideos,
  updatePlayedVideosInFirestore,
} from './services/firestoreService';
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
  loadPendingSyncQueue,
  savePendingSyncQueue,
  loadPlayerSessionState,
  savePlayerSessionState,
  loadPlaylists,
  savePlaylists,
  loadPlayedVideoIds,
  savePlayedVideoIds,
} from './utils/storage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useBackgroundAudio } from './hooks/useBackgroundAudio';
import { useAudioDownload } from './hooks/useAudioDownload';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { VideoCard } from './components/VideoCard';
import { PodcastPlayer } from './components/PodcastPlayer';
import { VideoPlayerView } from './components/VideoPlayerView';
import { MiniPlayerBar } from './components/MiniPlayerBar';
import { AddChannelModal } from './components/AddChannelModal';
import { GroupManagerModal } from './components/GroupManagerModal';
import { ChannelDrawer } from './components/ChannelDrawer';
import { PlaylistModal } from './components/PlaylistModal';
import { YouTubePlayer } from './components/YouTubePlayer';
import { NativeAudioPlayer, NativeAudioHandle } from './components/NativeAudioPlayer';

export default function App() {
  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Theme State (System, Dark, Light)
  const [themePreference, setThemePreference] = useState<ThemeMode>(loadThemePreference);

  // Core Data States
  const [groups, setGroups] = useState<ChannelGroup[]>(loadGroups);
  const [channels, setChannels] = useState<Channel[]>(loadChannels);
  const [videos, setVideos] = useState<Video[]>(loadVideos);
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists);
  const [playedVideoIds, setPlayedVideoIds] = useState<string[]>(loadPlayedVideoIds);

  const latestStateRef = useRef({
    groups,
    channels,
    videos,
    themePreference,
  });
  latestStateRef.current = {
    groups,
    channels,
    videos,
    themePreference,
  };

  // Active Filter States
  const [activeGroupId, setActiveGroupId] = useState<string>('all');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [activeTab, setActiveTab] = useState<'feed' | 'player'>(() => loadPlayerSessionState().activeTab);

  // Connectivity & Background Sync States
  const isOnline = useOnlineStatus();
  const [pendingSyncQueue, setPendingSyncQueue] = useState<PendingSyncTask[]>(loadPendingSyncQueue);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState<boolean>(false);

  // Audio Download Manager
  const {
    downloads: audioDownloads,
    notice: downloadNotice,
    startDownload: handleDownloadAudio,
    dismissNotice: dismissDownloadNotice,
  } = useAudioDownload();

  // Playback Progress Persistence Map
  const [playbackProgressMap, setPlaybackProgressMap] = useState<Record<string, PlaybackProgress>>(
    loadPlaybackProgressMap
  );
  const lastSavedProgressTimeRef = useRef<number>(0);

  // Player States (Restores last played video and saved progress offline/online)
  const [currentVideo, setCurrentVideo] = useState<Video | null>(() => {
    const v = loadVideos();
    const lastId = loadLastVideoId();
    if (lastId) {
      const found = v.find((item) => item.id === lastId);
      if (found) return found;
    }
    return v.length > 0 ? v[0] : null;
  });
  const [playerMode, setPlayerMode] = useState<PlayerMode>(() => loadPlayerSessionState().playerMode);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(() => {
    const v = loadVideos();
    const lastId = loadLastVideoId() || (v.length > 0 ? v[0].id : null);
    if (!lastId) return 0;
    const map = loadPlaybackProgressMap();
    return map[lastId]?.currentTime || 0;
  });
  const [duration, setDuration] = useState<number>(() => {
    const v = loadVideos();
    const lastId = loadLastVideoId() || (v.length > 0 ? v[0].id : null);
    if (!lastId) return 0;
    const map = loadPlaybackProgressMap();
    return map[lastId]?.duration || 0;
  });
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [queue, setQueue] = useState<Video[]>(() => {
    const v = loadVideos();
    return v.length > 1 ? v.slice(1, 6) : [];
  });
  const [seekCommand, setSeekCommand] = useState<number | null>(null);
  const [audioStatusMap, setAudioStatusMap] = useState<Record<string, NativeAudioStatus>>({});
  const nativeAudioRef = useRef<NativeAudioHandle | null>(null);
  const autoSwitchedToAudioRef = useRef<boolean>(false);
  const probedAudioIdsRef = useRef<Set<string>>(new Set());

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

  // Probe stream availability for currentVideo regardless of mode so switching or minimizing is instant
  useEffect(() => {
    if (!currentVideo) return;
    const videoId = currentVideo.id;
    if (probedAudioIdsRef.current.has(videoId)) return;
    probedAudioIdsRef.current.add(videoId);

    let cancelled = false;
    fetch(`/api/youtube/audio-stream?videoId=${encodeURIComponent(videoId)}&check=1`)
      .then((res) => (res.ok ? res.json() : { available: false, status: 'unavailable' }))
      .then((data) => {
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
  }, [currentVideo?.id]);

  useEffect(() => {
    // When switching between Native <audio> and YouTube IFrame, keep playback timestamp synced
    if (prevUseNativeAudioRef.current !== useNativeAudio && currentTime > 0) {
      setSeekCommand(currentTime);
    }
    prevUseNativeAudioRef.current = useNativeAudio;
  }, [useNativeAudio, currentTime]);

  // Sleep Timer States
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerExpiresAt, setSleepTimerExpiresAt] = useState<number | null>(null);

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addModalTab, setAddModalTab] = useState<'search' | 'paste'>('search');
  const [addModalSearchQuery, setAddModalSearchQuery] = useState<string>('');
  const [pastedLinkForModal, setPastedLinkForModal] = useState<string>('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [isChannelDrawerOpen, setIsChannelDrawerOpen] = useState<boolean>(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState<boolean>(false);
  const [videoToAddToPlaylist, setVideoToAddToPlaylist] = useState<Video | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const openSearchChannelModal = (initialQuery = '') => {
    setPastedLinkForModal('');
    setAddModalTab('search');
    setAddModalSearchQuery(initialQuery);
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
      // ignore clipboard permission error and open modal
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

  const handleThemeChange = (newTheme: ThemeMode) => {
    setThemePreference(newTheme);
    saveThemePreference(newTheme);
    if (user) {
      updateThemeInFirestore(user.uid, newTheme).catch(console.error);
    }
  };

  // 1b. Firebase Auth & Real-Time Firestore Sync
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);

      if (firebaseUser) {
        try {
          const { groups: curGroups, channels: curChannels, videos: curVideos, themePreference: curTheme } =
            latestStateRef.current;
          await ensureUserProfile(firebaseUser, curTheme);
          await seedInitialDataIfEmpty(firebaseUser.uid, curGroups, curChannels, curVideos);
        } catch (err) {
          console.error('Gagal sinkronisasi awal Firebase:', err);
        }
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubGroups = subscribeToUserGroups(user.uid, (cloudGroups) => {
      if (cloudGroups.length > 0) {
        setGroups(cloudGroups);
      }
    });

    const unsubChannels = subscribeToUserChannels(user.uid, (cloudChannels) => {
      setChannels(cloudChannels);
    });

    const unsubVideos = subscribeToUserVideos(user.uid, (cloudVideos) => {
      setVideos(cloudVideos);
    });

    const unsubPlaylists = subscribeToUserPlaylists(user.uid, (cloudPlaylists) => {
      setPlaylists(cloudPlaylists);
    });

    const unsubPlayed = subscribeToPlayedVideos(user.uid, (cloudPlayedIds) => {
      setPlayedVideoIds(cloudPlayedIds);
    });

    return () => {
      unsubGroups();
      unsubChannels();
      unsubVideos();
      unsubPlaylists();
      unsubPlayed();
    };
  }, [user?.uid]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          console.warn('Gagal masuk dengan metode redirect:', redirectErr);
        }
      }
      console.warn('Gagal masuk dengan Google:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Gagal keluar dari akun Google:', error);
    }
  };

  // 2. Persistence sync (LocalStorage fallback)
  useEffect(() => {
    saveGroups(groups);
  }, [groups]);

  useEffect(() => {
    saveChannels(channels);
  }, [channels]);

  useEffect(() => {
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

  const handleSetSleepTimer = (minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    if (minutes === null) {
      setSleepTimerExpiresAt(null);
    } else {
      setSleepTimerExpiresAt(Date.now() + minutes * 60 * 1000);
    }
  };

  // 4. Playback Controls
  const selectVideoForPlayback = useCallback(
    (video: Video, mode?: PlayerMode, autoPlay = true) => {
      const saved = playbackProgressMap[video.id];
      const resumeTime = saved?.currentTime && saved.currentTime > 0 ? saved.currentTime : 0;
      const savedDur = saved?.duration && saved.duration > 0 ? saved.duration : 0;

      lastSavedProgressTimeRef.current = resumeTime;
      setSeekCommand(null);
      setCurrentTime(resumeTime);
      setDuration(savedDur);
      setCurrentVideo(video);
      if (mode) setPlayerMode(mode);
      setIsPlaying(autoPlay);
    },
    [playbackProgressMap]
  );

  const handlePlayPause = () => {
    if (!isPlaying) {
      nativeAudioRef.current?.unlock();
    }
    setIsPlaying((prev) => !prev);
  };

  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
    setSeekCommand(seconds);
  };

  const handleSkipBack = (secs: number = 15) => {
    const target = Math.max(0, currentTime - secs);
    handleSeek(target);
  };

  const handleSkipForward = (secs: number = 30) => {
    const target = Math.min(duration || Infinity, currentTime + secs);
    handleSeek(target);
  };

  const handlePlayVideo = (video: Video, mode: PlayerMode = 'video') => {
    nativeAudioRef.current?.unlock();
    autoSwitchedToAudioRef.current = false;
    selectVideoForPlayback(video, mode, true);
    setActiveTab('player');
  };

  const handleNextTrack = useCallback(() => {
    setQueue((prevQueue) => {
      if (prevQueue.length === 0) return prevQueue;
      const [nextVid, ...rest] = prevQueue;
      selectVideoForPlayback(nextVid, undefined, true);
      return rest;
    });
  }, [selectVideoForPlayback]);

  const handlePrevTrack = () => {
    handleSeek(0);
  };

  const handleToggleQueue = (video: Video) => {
    setQueue((prev) => {
      const exists = prev.some((v) => v.id === video.id);
      if (exists) {
        return prev.filter((v) => v.id !== video.id);
      } else {
        return [...prev, video];
      }
    });
  };

  const handleRemoveFromQueue = (videoId: string) => {
    setQueue((prev) => prev.filter((v) => v.id !== videoId));
  };

  // 5. Group Management (Create, Rename, Delete)
  const handleAddGroup = (name: string) => {
    const newId = `group_${Date.now()}`;
    const newGroup: ChannelGroup = {
      id: newId,
      name,
    };
    setGroups((prev) => [...prev, newGroup]);
    if (user) {
      createGroupInFirestore(user.uid, newGroup).catch(console.error);
    }
  };

  const handleRenameGroup = (groupId: string, newName: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name: newName } : g))
    );
    if (user) {
      renameGroupInFirestore(user.uid, groupId, newName).catch(console.error);
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
      deleteGroupInFirestore(user.uid, groupId, channelsInGroup).catch(console.error);
    }
  };

  // 6. Channel Management
  const handleDeleteChannel = (channelId: string) => {
    const videoIdsToDelete = videos.filter((v) => v.channelId === channelId).map((v) => v.id);
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    setVideos((prev) => prev.filter((v) => v.channelId !== channelId));
    setQueue((prev) => prev.filter((v) => v.channelId !== channelId));
    if (selectedChannelId === channelId) {
      setSelectedChannelId(null);
    }
    if (currentVideo?.channelId === channelId) {
      setIsPlaying(false);
      setCurrentVideo(null);
      setCurrentTime(0);
      setDuration(0);
    }
    if (user) {
      deleteChannelInFirestore(user.uid, channelId, videoIdsToDelete).catch(console.error);
    }
  };

  const handleChangeChannelGroup = (channelId: string, newGroupId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, groupId: newGroupId } : c))
    );
    if (user) {
      changeChannelGroupInFirestore(user.uid, channelId, newGroupId).catch(console.error);
    }
  };

  // Persist pending sync queue
  useEffect(() => {
    savePendingSyncQueue(pendingSyncQueue);
  }, [pendingSyncQueue]);

  // Persist last active video ID
  useEffect(() => {
    saveLastVideoId(currentVideo?.id || null);
  }, [currentVideo?.id]);

  // Save playback progress helper
  const persistProgress = useCallback(
    (videoId: string, time: number, dur: number) => {
      if (!videoId || time < 0) return;
      const updated = saveVideoPlaybackProgress(videoId, time, dur);
      setPlaybackProgressMap(updated);
    },
    []
  );

  // 7. Add Multiple Channels (queues for background sync if offline)
  const handleAddChannels = async (
    inputs: string[],
    targetGroupId: string
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

    for (const input of inputs) {
      try {
        const res = await fetch('/api/youtube/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.channel && data.channel.id) {
            const ch = data.channel;
            const channelObj: Channel = {
              id: ch.id,
              title: ch.title || 'YouTube Channel',
              handle: ch.handle,
              avatar: ch.avatar,
              description: ch.description,
              url: ch.url,
              groupId: targetGroupId,
              addedAt: new Date().toISOString(),
              videoCount: data.videos?.length || 0,
            };

            if (!channels.some((c) => c.id === ch.id) && !newChannels.some((c) => c.id === ch.id)) {
              newChannels.push(channelObj);
            }

            if (Array.isArray(data.videos)) {
              data.videos.forEach((v: Video) => {
                if (!videos.some((existing) => existing.id === v.id) && !newVideos.some((nv) => nv.id === v.id)) {
                  newVideos.push(v);
                }
              });
            }
            success++;
          } else {
            failed++;
          }
        } else {
          try {
            const errData = await res.json();
            if (errData?.error) lastError = errData.error;
          } catch {
            lastError = `Gagal menghubungi server (HTTP ${res.status}).`;
          }
          failed++;
        }
      } catch (err) {
        if (err instanceof Error) lastError = err.message;
        failed++;
      }
    }

    if (newChannels.length > 0) {
      setChannels((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const unique = newChannels.filter((c) => !existingIds.has(c.id));
        return unique.length > 0 ? [...unique, ...prev] : prev;
      });
      if (user) {
        Promise.all(newChannels.map((ch) => saveChannelInFirestore(user.uid, ch))).catch(console.error);
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
        saveVideosInFirestore(user.uid, newVideos).catch(console.error);
      }
      if (!currentVideo && newVideos.length > 0) {
        selectVideoForPlayback(newVideos[0], playerMode, false);
      }
    }

    return { success, failed, lastError };
  };

  // 8. Refresh Feeds from Server (queues for background sync if offline)
  const handleRefreshFeeds = async () => {
    if (channels.length === 0) return;

    if (!navigator.onLine) {
      setPendingSyncQueue((prev) => {
        if (prev.some((t) => t.type === 'REFRESH_FEEDS')) return prev;
        return [
          ...prev,
          { id: `sync_${Date.now()}`, type: 'REFRESH_FEEDS', createdAt: new Date().toISOString() },
        ];
      });
      return;
    }

    setIsRefreshing(true);
    try {
      const channelIds = channels.map((c) => c.id);
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelIds: chunk }),
          })
        )
      );

      let anyOk = false;
      for (const res of responses) {
        if (!res.ok) continue;
        anyOk = true;
        const data = await res.json();
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

      if (Object.keys(fetchedChannelsMap).length > 0) {
        setChannels((prev) => {
          const updatedList: Channel[] = [];
          const nextChannels = prev.map((ch) => {
            const fresh = fetchedChannelsMap[ch.id];
            if (!fresh) return ch;
            const mergedCh: Channel = {
              ...ch,
              title: fresh.title || ch.title,
              handle: fresh.handle || ch.handle,
              avatar: fresh.avatar || ch.avatar,
              url: fresh.url || ch.url,
              videoCount: fresh.videoCount ?? ch.videoCount,
            };
            if (
              mergedCh.title !== ch.title ||
              mergedCh.avatar !== ch.avatar ||
              mergedCh.handle !== ch.handle
            ) {
              updatedList.push(mergedCh);
            }
            return mergedCh;
          });
          if (user && updatedList.length > 0) {
            updatedList.forEach((ch) => {
              saveChannelInFirestore(user.uid, ch).catch(console.error);
            });
          }
          return nextChannels;
        });
      }

      if (fetchedVideos.length > 0) {
        setVideos((prev) => {
          const existingMap = new Map(prev.map((v) => [v.id, v]));
          fetchedVideos.forEach((v) => existingMap.set(v.id, v));
          const merged = Array.from(existingMap.values());
          merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
          return merged;
        });
        if (user) {
          saveVideosInFirestore(user.uid, fetchedVideos).catch(console.error);
        }
      }
    } catch (e) {
      console.warn('Gagal memuat ulang feed, menjadwalkan sinkronisasi latar belakang:', e);
      setPendingSyncQueue((prev) => {
        if (prev.some((t) => t.type === 'REFRESH_FEEDS')) return prev;
        return [
          ...prev,
          { id: `sync_${Date.now()}`, type: 'REFRESH_FEEDS', createdAt: new Date().toISOString() },
        ];
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const syncHandlersRef = useRef({ handleRefreshFeeds, handleAddChannels });
  syncHandlersRef.current = { handleRefreshFeeds, handleAddChannels };

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
      if (currentVideo && currentTime > 0) {
        saveVideoPlaybackProgress(currentVideo.id, currentTime, duration);
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
  }, [playerMode, activeTab, isPlaying, currentVideo?.id, currentTime, duration]);

  // Persist playlists & played videos locally
  useEffect(() => {
    savePlaylists(playlists);
  }, [playlists]);

  useEffect(() => {
    savePlayedVideoIds(playedVideoIds);
  }, [playedVideoIds]);

  const handleTogglePlayed = useCallback(
    (videoId: string) => {
      setPlayedVideoIds((prev) => {
        const exists = prev.includes(videoId);
        const next = exists ? prev.filter((id) => id !== videoId) : [videoId, ...prev];
        if (user) {
          updatePlayedVideosInFirestore(user.uid, next).catch(console.error);
        }
        return next;
      });
    },
    [user]
  );

  const handleMarkAsPlayed = useCallback(
    (videoId: string) => {
      setPlayedVideoIds((prev) => {
        if (prev.includes(videoId)) return prev;
        const next = [videoId, ...prev];
        if (user) {
          updatePlayedVideosInFirestore(user.uid, next).catch(console.error);
        }
        return next;
      });
    },
    [user]
  );

  const handleCreatePlaylist = (name: string, description: string, initialVideoIds: string[]) => {
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
      createPlaylistInFirestore(user.uid, newPlaylist).catch(console.error);
    }
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
      updatePlaylistInFirestore(user.uid, playlistId, updates).catch(console.error);
    }
  };

  const handleDeletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
    if (user) {
      deletePlaylistInFirestore(user.uid, playlistId).catch(console.error);
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
  };

  // Background audio & Media Session API (keeps audio playing when minimized or screen-locked)
  useBackgroundAudio({
    currentVideo,
    isPlaying,
    currentTime,
    duration,
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
      if (playerMode === 'video' && currentAudioStatus === 'available') {
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
      if (useNativeAudio || isCheckingNativeAudio || !currentVideo) return;
      setCurrentTime(cur);
      if (dur > 0) setDuration(dur);
      if (Math.abs(cur - lastSavedProgressTimeRef.current) >= 2) {
        lastSavedProgressTimeRef.current = cur;
        persistProgress(currentVideo.id, cur, dur);
      }
    },
    [currentVideo?.id, persistProgress, useNativeAudio, isCheckingNativeAudio]
  );

  const handleYouTubeStateChange = useCallback(
    (playing: boolean) => {
      if (useNativeAudio || isCheckingNativeAudio) return;
      setIsPlaying(playing);
    },
    [useNativeAudio, isCheckingNativeAudio]
  );

  const handleYouTubeEnded = useCallback(() => {
    if (useNativeAudio || isCheckingNativeAudio) return;
    if (currentVideo) {
      handleMarkAsPlayed(currentVideo.id);
    }
    handleNextTrack();
  }, [currentVideo?.id, handleMarkAsPlayed, handleNextTrack, useNativeAudio, isCheckingNativeAudio]);

  // 9. Filter and Sort Videos
  const filteredVideos = useMemo(() => {
    let result = [...videos];

    // Filter by Group
    if (activeGroupId !== 'all') {
      const channelIdsInGroup = new Set(
        channels.filter((c) => c.groupId === activeGroupId).map((c) => c.id)
      );
      result = result.filter((v) => channelIdsInGroup.has(v.channelId));
    }

    // Filter by specific selected channel
    if (selectedChannelId) {
      result = result.filter((v) => v.channelId === selectedChannelId);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.channelTitle.toLowerCase().includes(q) ||
          (v.description && v.description.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    } else if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [videos, channels, activeGroupId, selectedChannelId, searchQuery, sortBy]);

  const activeGroupChannels = useMemo(() => {
    if (activeGroupId === 'all') return channels;
    return channels.filter((c) => c.groupId === activeGroupId);
  }, [channels, activeGroupId]);

  const activeGroup = groups.find((g) => g.id === activeGroupId) || groups[0];
  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-red-500 selection:text-white transition-colors duration-200 pb-28">
      {/* Top Bar Header */}
      <Header
        theme={themePreference}
        onThemeChange={handleThemeChange}
        onOpenAddModal={() => openSearchChannelModal('')}
        onOpenGroupModal={() => setIsGroupModalOpen(true)}
        onOpenChannelDrawer={() => setIsChannelDrawerOpen(true)}
        onOpenPlaylistModal={() => {
          setVideoToAddToPlaylist(null);
          setIsPlaylistModalOpen(true);
        }}
        playlistCount={playlists.length}
        playerMode={playerMode}
        onTogglePlayerMode={() => {
          autoSwitchedToAudioRef.current = false;
          if (playerMode === 'video') nativeAudioRef.current?.unlock();
          setPlayerMode(playerMode === 'video' ? 'audio' : 'video');
        }}
        activeFilterGroup={activeGroupId}
        onSelectGroup={setActiveGroupId}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        authLoading={authLoading}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
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
                currentTime={currentTime}
                duration={duration}
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
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
                onSkipBack={handleSkipBack}
                onSkipForward={handleSkipForward}
                onNext={handleNextTrack}
                onPrev={handlePrevTrack}
                onSpeedChange={setPlaybackRate}
                onVolumeChange={setVolume}
                onToggleMute={() => setIsMuted(!isMuted)}
                onSwitchToVideo={() => {
                  autoSwitchedToAudioRef.current = false;
                  setPlayerMode('video');
                }}
                onSetSleepTimer={handleSetSleepTimer}
                onPlayQueueItem={(v) => handlePlayVideo(v, 'audio')}
                onRemoveFromQueue={handleRemoveFromQueue}
              />
            </motion.div>

            {/* 2. Video Player View (Hosts the actual YouTube iframe without unmounting) */}
            <div
              className={
                activeTab === 'player' && playerMode === 'video'
                  ? 'block'
                  : isPlaying && !useNativeAudio && !isCheckingNativeAudio
                  ? 'fixed bottom-24 right-3 w-44 sm:w-64 aspect-video rounded-2xl overflow-hidden shadow-2xl border border-slate-300 dark:border-slate-700 z-40 bg-black transition-all'
                  : 'fixed bottom-24 right-3 w-44 aspect-video pointer-events-none opacity-0 -z-50 overflow-hidden'
              }
            >
              <VideoPlayerView
                currentVideo={currentVideo}
                queue={queue}
                isMiniPiP={!(activeTab === 'player' && playerMode === 'video')}
                onExpandPiP={() => {
                  autoSwitchedToAudioRef.current = false;
                  setPlayerMode('video');
                  setActiveTab('player');
                }}
                onSwitchToAudio={() => {
                  autoSwitchedToAudioRef.current = false;
                  nativeAudioRef.current?.unlock();
                  setPlayerMode('audio');
                }}
                onPlayVideo={(v) => handlePlayVideo(v, 'video')}
                onRemoveFromQueue={handleRemoveFromQueue}
                downloadState={audioDownloads[currentVideo.id]}
                onDownloadAudio={handleDownloadAudio}
                playerSlot={
                  <YouTubePlayer
                    currentVideo={currentVideo}
                    isPlaying={useNativeAudio || isCheckingNativeAudio ? false : isPlaying}
                    mode={playerMode}
                    isVisible={activeTab === 'player' && playerMode === 'video'}
                    playbackRate={playbackRate}
                    volume={volume}
                    isMuted={isMuted}
                    initialSeekSeconds={
                      currentTime > 0
                        ? currentTime
                        : playbackProgressMap[currentVideo.id]?.currentTime || 0
                    }
                    onTimeUpdate={handleYouTubeTimeUpdate}
                    onStateChange={handleYouTubeStateChange}
                    onEnded={handleYouTubeEnded}
                    seekCommand={useNativeAudio || isCheckingNativeAudio ? null : seekCommand}
                    onSeekHandled={() => setSeekCommand(null)}
                  />
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
                const count =
                  group.id === 'all'
                    ? channels.length
                    : channels.filter((c) => c.groupId === group.id).length;

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
                onClick={() => openSearchChannelModal(searchQuery.trim())}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Cari dan tambahkan channel baru langsung dari YouTube"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari Channel YouTube</span>
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

          {/* Channel List Inside Group (shown when group has > 1 channel) */}
          <AnimatePresence initial={false}>
            {activeGroupChannels.length > 1 && (
              <motion.div
                key={`group-strip-${activeGroupId}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">
                  <span className="flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-red-500" />
                    <span>
                      Channel dalam Grup "{groups.find((g) => g.id === activeGroupId)?.name || 'Semua'}" ({activeGroupChannels.length})
                    </span>
                  </span>
                  {selectedChannelId && (
                    <button
                      onClick={() => setSelectedChannelId(null)}
                      className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                    >
                      Tampilkan Semua
                    </button>
                  )}
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
                    const chVideoCount = videos.filter((v) => v.channelId === ch.id).length;

                    return (
                      <motion.div
                        key={ch.id}
                        whileHover={{ y: -1 }}
                        className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors border ${
                          isSelected
                            ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-200/70 dark:border-slate-700/70 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <button
                          onClick={() => setSelectedChannelId(isSelected ? null : ch.id)}
                          className="flex items-center gap-2 cursor-pointer"
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
                          <span className="max-w-[160px] truncate">{ch.title}</span>
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
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-100/70 dark:hover:text-red-400 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                          title={`Hapus channel ${ch.title}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search, Filter & Channel Focus Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari judul video atau nama channel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-7 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => openSearchChannelModal(searchQuery.trim())}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200/80 dark:border-red-800/60 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  title={`Cari channel "${searchQuery.trim()}" di YouTube`}
                >
                  Cari di YouTube
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
                  className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300"
                >
                  <span className="font-semibold">Fokus Channel: {selectedChannel.title}</span>
                  <button
                    onClick={() => setChannelToDelete(selectedChannel)}
                    className="p-0.5 rounded hover:bg-red-200/60 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 cursor-pointer"
                    title="Hapus channel ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSelectedChannelId(null)}
                    className="font-bold hover:text-red-900 dark:hover:text-white cursor-pointer"
                    title="Hapus filter channel"
                  >
                    ×
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400">Urutkan:</span>
              <select
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
        </section>

        {/* Video Grid Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {selectedChannel ? `Video dari ${selectedChannel.title}` : `Video: ${activeGroup.name}`}
              </h2>
              <span className="text-xs text-slate-500 font-medium">
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
                  onClick={() => openSearchChannelModal(searchQuery.trim())}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
                >
                  {searchQuery.trim() ? `Cari "${searchQuery.trim()}" di YouTube` : 'Cari Channel YouTube'}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVideos.map((video, idx) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  index={idx}
                  isCurrentlyPlaying={currentVideo?.id === video.id && isPlaying}
                  isInQueue={queue.some((q) => q.id === video.id)}
                  isPlayed={playedVideoIds.includes(video.id)}
                  progress={playbackProgressMap[video.id]}
                  downloadState={audioDownloads[video.id]}
                  onPlayVideo={(v) => handlePlayVideo(v, 'video')}
                  onPlayAudio={(v) => handlePlayVideo(v, 'audio')}
                  onToggleQueue={handleToggleQueue}
                  onTogglePlayed={handleTogglePlayed}
                  onDownloadAudio={handleDownloadAudio}
                  onAddToPlaylist={(v) => {
                    setVideoToAddToPlaylist(v);
                    setIsPlaylistModalOpen(true);
                  }}
                />
              ))}
            </div>
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
        currentVideo={currentVideo}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        volume={volume}
        isMuted={isMuted}
        initialSeekSeconds={
          currentTime > 0
            ? currentTime
            : currentVideo
            ? playbackProgressMap[currentVideo.id]?.currentTime || 0
            : 0
        }
        seekCommand={useNativeAudio ? seekCommand : null}
        onSeekHandled={() => setSeekCommand(null)}
        onTimeUpdate={(cur, dur) => {
          if (!currentVideo) return;
          setCurrentTime(cur);
          if (dur > 0) setDuration(dur);
          if (Math.abs(cur - lastSavedProgressTimeRef.current) >= 2) {
            lastSavedProgressTimeRef.current = cur;
            persistProgress(currentVideo.id, cur, dur);
          }
        }}
        onStateChange={(playing) => setIsPlaying(playing)}
        onEnded={() => {
          if (currentVideo) {
            handleMarkAsPlayed(currentVideo.id);
          }
          handleNextTrack();
        }}
        onFallbackNeeded={(reason = 'unavailable') => {
          if (!currentVideo) return;
          const vidId = currentVideo.id;
          setAudioStatusMap((prev) => ({ ...prev, [vidId]: reason }));
        }}
      />

      {/* Sticky Mini Player Bar (when playing and scrolled or on feed tab) */}
      <MiniPlayerBar
        currentVideo={currentVideo}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        mode={playerMode}
        usingNativeAudio={useNativeAudio}
        onPlayPause={handlePlayPause}
        onSkipBack={handleSkipBack}
        onSkipForward={handleSkipForward}
        onExpand={() => setActiveTab('player')}
        onToggleMode={() => {
          autoSwitchedToAudioRef.current = false;
          if (playerMode === 'video') nativeAudioRef.current?.unlock();
          setPlayerMode(playerMode === 'video' ? 'audio' : 'video');
        }}
      />

      {/* Modals & Drawers */}
      <AddChannelModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setPastedLinkForModal('');
          setAddModalSearchQuery('');
        }}
        groups={groups}
        existingChannelIds={channels.map((c) => c.id)}
        onAddChannels={handleAddChannels}
        initialPastedText={pastedLinkForModal}
        initialTab={addModalTab}
        initialSearchQuery={addModalSearchQuery}
      />

      <GroupManagerModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        groups={groups}
        channels={channels}
        onAddGroup={handleAddGroup}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={handleDeleteGroup}
      />

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

      {/* Audio Download Status Toast */}
      <AnimatePresence>
        {downloadNotice && (
          <motion.div
            key={`dl-notice-${downloadNotice.videoId}-${downloadNotice.type}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md pointer-events-auto"
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
              </div>
              <button
                type="button"
                onClick={dismissDownloadNotice}
                className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                title="Tutup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
