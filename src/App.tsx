import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
} from './services/firestoreService';
import {
  Channel,
  ChannelGroup,
  Video,
  PlayerMode,
  ThemeMode,
  PlaybackProgress,
  PendingSyncTask,
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
} from './utils/storage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { VideoCard } from './components/VideoCard';
import { PodcastPlayer } from './components/PodcastPlayer';
import { VideoPlayerView } from './components/VideoPlayerView';
import { MiniPlayerBar } from './components/MiniPlayerBar';
import { AddChannelModal } from './components/AddChannelModal';
import { GroupManagerModal } from './components/GroupManagerModal';
import { ChannelDrawer } from './components/ChannelDrawer';
import { YouTubePlayer } from './components/YouTubePlayer';

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

  // Active Filter States
  const [activeGroupId, setActiveGroupId] = useState<string>('all');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [activeTab, setActiveTab] = useState<'feed' | 'player'>('feed');

  // Connectivity & Background Sync States
  const isOnline = useOnlineStatus();
  const [pendingSyncQueue, setPendingSyncQueue] = useState<PendingSyncTask[]>(loadPendingSyncQueue);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState<boolean>(false);

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
  const [playerMode, setPlayerMode] = useState<PlayerMode>('audio');
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

  // Sleep Timer States
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerExpiresAt, setSleepTimerExpiresAt] = useState<number | null>(null);

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [pastedLinkForModal, setPastedLinkForModal] = useState<string>('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [isChannelDrawerOpen, setIsChannelDrawerOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Quick Paste & Open Add Modal
  const handleQuickPasteAndOpen = async () => {
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
          await ensureUserProfile(firebaseUser, themePreference);
          await seedInitialDataIfEmpty(firebaseUser.uid, groups, channels, videos);
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

    return () => {
      unsubGroups();
      unsubChannels();
      unsubVideos();
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
  const handlePlayPause = () => {
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
    setCurrentVideo(video);
    setPlayerMode(mode);
    setIsPlaying(true);
    setActiveTab('player');
  };

  const handleNextTrack = () => {
    if (queue.length > 0) {
      const nextVid = queue[0];
      setQueue((prev) => prev.slice(1));
      setCurrentVideo(nextVid);
      setIsPlaying(true);
    }
  };

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
    if (selectedChannelId === channelId) {
      setSelectedChannelId(null);
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
      setChannels((prev) => [...newChannels, ...prev]);
      if (user) {
        Promise.all(newChannels.map((ch) => saveChannelInFirestore(user.uid, ch))).catch(console.error);
      }
    }

    if (newVideos.length > 0) {
      setVideos((prev) => {
        const combined = [...newVideos, ...prev];
        combined.sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        return combined;
      });
      if (user) {
        saveVideosInFirestore(user.uid, newVideos).catch(console.error);
      }
      if (!currentVideo && newVideos.length > 0) {
        setCurrentVideo(newVideos[0]);
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
      const res = await fetch('/api/youtube/batch-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelIds }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.videos) && data.videos.length > 0) {
          const existingMap = new Map(videos.map((v) => [v.id, v]));
          data.videos.forEach((v: Video) => existingMap.set(v.id, v));
          const merged = Array.from(existingMap.values());
          merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
          setVideos(merged);
          if (user) {
            saveVideosInFirestore(user.uid, data.videos).catch(console.error);
          }
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
            await handleRefreshFeeds();
          } else if (task.type === 'ADD_CHANNELS') {
            await handleAddChannels(task.inputs, task.targetGroupId);
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
  }, [isOnline, pendingSyncQueue.length]);

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

  const activeGroup = groups.find((g) => g.id === activeGroupId) || groups[0];
  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-red-500 selection:text-white transition-colors duration-200 pb-28">
      {/* Top Bar Header */}
      <Header
        theme={themePreference}
        onThemeChange={handleThemeChange}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenGroupModal={() => setIsGroupModalOpen(true)}
        onOpenChannelDrawer={() => setIsChannelDrawerOpen(true)}
        playerMode={playerMode}
        onTogglePlayerMode={() => setPlayerMode(playerMode === 'video' ? 'audio' : 'video')}
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
            <div className={activeTab === 'player' && playerMode === 'audio' ? 'block' : 'hidden'}>
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
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
                onSkipBack={handleSkipBack}
                onSkipForward={handleSkipForward}
                onNext={handleNextTrack}
                onPrev={handlePrevTrack}
                onSpeedChange={setPlaybackRate}
                onVolumeChange={setVolume}
                onToggleMute={() => setIsMuted(!isMuted)}
                onSwitchToVideo={() => setPlayerMode('video')}
                onSetSleepTimer={handleSetSleepTimer}
                onPlayQueueItem={(v) => handlePlayVideo(v, 'audio')}
                onRemoveFromQueue={handleRemoveFromQueue}
              />
            </div>

            {/* 2. Video Player View (Hosts the actual YouTube iframe without unmounting) */}
            <div
              className={
                activeTab === 'player' && playerMode === 'video'
                  ? 'block'
                  : 'fixed -left-[9999px] -top-[9999px] w-1 h-1 opacity-0 pointer-events-none'
              }
              aria-hidden={!(activeTab === 'player' && playerMode === 'video')}
            >
              <VideoPlayerView
                currentVideo={currentVideo}
                queue={queue}
                onSwitchToAudio={() => setPlayerMode('audio')}
                onPlayVideo={(v) => handlePlayVideo(v, 'video')}
                onRemoveFromQueue={handleRemoveFromQueue}
                playerSlot={
                  <YouTubePlayer
                    currentVideo={currentVideo}
                    isPlaying={isPlaying}
                    mode={playerMode}
                    isVisible={activeTab === 'player' && playerMode === 'video'}
                    playbackRate={playbackRate}
                    volume={volume}
                    isMuted={isMuted}
                    initialSeekSeconds={playbackProgressMap[currentVideo.id]?.currentTime || 0}
                    onTimeUpdate={useCallback(
                      (cur, dur) => {
                        setCurrentTime(cur);
                        if (dur > 0) setDuration(dur);
                        if (Math.abs(cur - lastSavedProgressTimeRef.current) >= 2) {
                          lastSavedProgressTimeRef.current = cur;
                          persistProgress(currentVideo.id, cur, dur);
                        }
                      },
                      [currentVideo.id, persistProgress]
                    )}
                    onStateChange={useCallback((playing) => {
                      setIsPlaying(playing);
                    }, [])}
                    onEnded={useCallback(() => {
                      handleNextTrack();
                    }, [queue])}
                    seekCommand={seekCommand}
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
                  <button
                    key={group.id}
                    onClick={() => {
                      setActiveGroupId(group.id);
                      setSelectedChannelId(null);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <span>{group.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}

              {/* Quick Manage Groups button */}
              <button
                onClick={() => setIsGroupModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white bg-transparent rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
                title="Kelola & Ganti Nama Grup"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Atur Grup</span>
              </button>
            </div>

            {/* Quick Actions & Refresh */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleQuickPasteAndOpen}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer"
                title="Tempel link YouTube langsung dari clipboard"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Tempel Link</span>
              </button>

              <button
                onClick={handleRefreshFeeds}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Perbarui Video Terbaru dari YouTube"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-red-500' : ''}`} />
                <span>{isRefreshing ? 'Memperbarui...' : 'Sinkron Feed'}</span>
              </button>
            </div>
          </div>

          {/* Search, Filter & Channel Focus Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari judul video atau nama channel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  ×
                </button>
              )}
            </div>

            {/* Selected Channel Focus Tag */}
            {selectedChannel && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300">
                <span className="font-semibold">Fokus Channel: {selectedChannel.title}</span>
                <button
                  onClick={() => setSelectedChannelId(null)}
                  className="font-bold hover:text-red-900 dark:hover:text-white"
                  title="Hapus filter channel"
                >
                  ×
                </button>
              </div>
            )}

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
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
                >
                  Tambah Channel
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
              {filteredVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  isCurrentlyPlaying={currentVideo?.id === video.id && isPlaying}
                  isInQueue={queue.some((q) => q.id === video.id)}
                  progress={playbackProgressMap[video.id]}
                  onPlayVideo={(v) => handlePlayVideo(v, 'video')}
                  onPlayAudio={(v) => handlePlayVideo(v, 'audio')}
                  onToggleQueue={handleToggleQueue}
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

      {/* Sticky Mini Player Bar (when playing and scrolled or on feed tab) */}
      <MiniPlayerBar
        currentVideo={currentVideo}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        mode={playerMode}
        onPlayPause={handlePlayPause}
        onSkipBack={handleSkipBack}
        onSkipForward={handleSkipForward}
        onExpand={() => setActiveTab('player')}
        onToggleMode={() => setPlayerMode(playerMode === 'video' ? 'audio' : 'video')}
      />

      {/* Modals & Drawers */}
      <AddChannelModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setPastedLinkForModal('');
        }}
        groups={groups}
        onAddChannels={handleAddChannels}
        initialPastedText={pastedLinkForModal}
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
    </div>
  );
}
