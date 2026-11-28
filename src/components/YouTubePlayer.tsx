import React, { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { AlertCircle, ExternalLink, RefreshCw, ShieldCheck, Globe } from 'lucide-react';
import { PlayerMode, Video } from '../types';
import { getPlaybackClockSnapshot } from '../utils/playbackClock';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

type EmbedHost = 'https://www.youtube-nocookie.com' | 'https://www.youtube.com';

export interface YouTubePlayerHandle {
  playNow: (videoId?: string, startSeconds?: number) => void;
  pauseNow: () => void;
}

interface YouTubePlayerProps {
  currentVideo: Video | null;
  isPlaying: boolean;
  mode: PlayerMode;
  isVisible: boolean;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onStateChange: (isPlaying: boolean) => void;
  onEnded: () => void;
  onError?: (err: any) => void;
  onAutoplayBlocked?: () => void;
  onOpenExtractorAuth?: () => void;
  seekCommand: number | null;
  onSeekHandled: () => void;
  initialSeekSeconds?: number;
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    {
      currentVideo,
      isPlaying,
      isVisible,
      playbackRate,
      volume,
      isMuted,
      onTimeUpdate,
      onStateChange,
      onEnded,
      onError,
      onAutoplayBlocked,
      onOpenExtractorAuth,
      seekCommand,
      onSeekHandled,
      initialSeekSeconds = 0,
    },
    ref
  ) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const isReadyRef = useRef<boolean>(false);
  const timeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intendedPlayingRef = useRef<boolean>(isPlaying);
  const hiddenResumeCountRef = useRef<number>(0);
  const initialSeekSecondsRef = useRef<number>(initialSeekSeconds);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const currentVideoRef = useRef<Video | null>(currentVideo);
  const volumeRef = useRef<number>(volume);
  const isMutedRef = useRef<boolean>(isMuted);
  const playbackRateRef = useRef<number>(playbackRate);
  const loadedVideoIdRef = useRef<string | null>(currentVideo?.id || null);
  const skipNextPlayVideoRef = useRef<string | null>(null);
  const autoFallbackTriedRef = useRef<boolean>(false);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onStateChangeRef = useRef(onStateChange);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const onAutoplayBlockedRef = useRef(onAutoplayBlocked);
  const onSeekHandledRef = useRef(onSeekHandled);
  const pendingPlayRef = useRef<{ videoId: string; startSeconds: number } | null>(null);
  const [playerErrorCode, setPlayerErrorCode] = useState<string | number | null>(null);
  const [embedHost, setEmbedHost] = useState<EmbedHost>('https://www.youtube-nocookie.com');
  const embedHostRef = useRef<EmbedHost>(embedHost);
  embedHostRef.current = embedHost;

  initialSeekSecondsRef.current = initialSeekSeconds;
  isPlayingRef.current = isPlaying;
  currentVideoRef.current = currentVideo;
  volumeRef.current = volume;
  isMutedRef.current = isMuted;
  playbackRateRef.current = playbackRate;
  onTimeUpdateRef.current = onTimeUpdate;
  onStateChangeRef.current = onStateChange;
  onEndedRef.current = onEnded;
  onErrorRef.current = onError;
  onAutoplayBlockedRef.current = onAutoplayBlocked;
  onSeekHandledRef.current = onSeekHandled;

  useEffect(() => {
    intendedPlayingRef.current = isPlaying;
    if (isPlaying) {
      hiddenResumeCountRef.current = 0;
    }
  }, [isPlaying]);

  const startTimePolling = useCallback(() => {
    if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    timeIntervalRef.current = setInterval(() => {
      if (playerRef.current && isReadyRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const cur = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || 0;
          onTimeUpdateRef.current(cur, dur);
        } catch {
          // player might be reloading
        }
      }
    }, 400);
  }, []);

  const stopTimePolling = useCallback(() => {
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      playNow(videoId?: string, startSeconds?: number) {
        intendedPlayingRef.current = true;
        isPlayingRef.current = true;
        const targetId = videoId || currentVideoRef.current?.id;
        const player = playerRef.current;
        if (!player || !isReadyRef.current) {
          if (targetId) {
            pendingPlayRef.current = {
              videoId: targetId,
              startSeconds: Math.max(0, Math.floor(startSeconds || 0)),
            };
          }
          return;
        }
        if (!targetId) return;
        pendingPlayRef.current = null;
        try {
          if (!isMutedRef.current) {
            player.unMute?.();
            player.setVolume?.(volumeRef.current);
          }
          if (loadedVideoIdRef.current !== targetId) {
            loadedVideoIdRef.current = targetId;
            skipNextPlayVideoRef.current = targetId;
            player.loadVideoById?.({
              videoId: targetId,
              startSeconds: Math.max(0, Math.floor(startSeconds || 0)),
            });
          } else {
            skipNextPlayVideoRef.current = targetId;
            player.playVideo?.();
          }
          startTimePolling();
        } catch {
          // ignore if player is still initializing; onReady will play automatically
        }
      },
      pauseNow() {
        intendedPlayingRef.current = false;
        isPlayingRef.current = false;
        skipNextPlayVideoRef.current = null;
        pendingPlayRef.current = null;
        try {
          playerRef.current?.pauseVideo?.();
        } catch {
          // ignore
        }
        stopTimePolling();
      },
    }),
    [startTimePolling, stopTimePolling]
  );

  // Initialize YT Player API (re-creates cleanly when embedHost switches between nocookie and standard)
  useEffect(() => {
    let cancelled = false;

    const initPlayer = () => {
      if (cancelled || !window.YT || !window.YT.Player || playerRef.current || !containerRef.current) {
        return;
      }

      containerRef.current.innerHTML = '';
      const targetEl = document.createElement('div');
      targetEl.className = 'w-full h-full';
      containerRef.current.appendChild(targetEl);

      const initialVid = currentVideoRef.current;
      loadedVideoIdRef.current = initialVid ? initialVid.id : null;
      const clockSnap = getPlaybackClockSnapshot();
      const resumeSec =
        initialVid && clockSnap.videoId === initialVid.id && clockSnap.currentTime > 0
          ? Math.floor(clockSnap.currentTime)
          : Math.floor(initialSeekSecondsRef.current || 0);

      playerRef.current = new window.YT.Player(targetEl, {
        height: '100%',
        width: '100%',
        host: embedHost,
        videoId: initialVid ? initialVid.id : '',
        playerVars: {
          autoplay: isPlayingRef.current && initialVid ? 1 : 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 1,
          enablejsapi: 1,
          start: resumeSec,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            isReadyRef.current = true;
            try {
              const iframe = event.target.getIframe?.() as HTMLIFrameElement | undefined;
              if (iframe) {
                iframe.setAttribute(
                  'allow',
                  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                );
                iframe.setAttribute('playsinline', '1');
                iframe.referrerPolicy = 'strict-origin-when-cross-origin';
              }
            } catch {
              // ignore
            }
            if (isMutedRef.current) {
              event.target.mute?.();
            } else {
              event.target.unMute?.();
              event.target.setVolume?.(volumeRef.current);
            }
            event.target.setPlaybackRate?.(playbackRateRef.current);

            const pendingPlay = pendingPlayRef.current;
            pendingPlayRef.current = null;
            const latestVid = currentVideoRef.current;
            const targetPlayId = pendingPlay?.videoId || latestVid?.id || null;
            const snap = getPlaybackClockSnapshot();
            const clockSec =
              targetPlayId && snap.videoId === targetPlayId && snap.currentTime > 0
                ? Math.floor(snap.currentTime)
                : 0;
            const startSeconds = pendingPlay
              ? Math.max(clockSec, pendingPlay.startSeconds)
              : Math.max(clockSec, Math.floor(initialSeekSecondsRef.current || 0));

            if (targetPlayId && loadedVideoIdRef.current !== targetPlayId) {
              loadedVideoIdRef.current = targetPlayId;
              if (isPlayingRef.current) {
                event.target.loadVideoById?.({ videoId: targetPlayId, startSeconds });
                startTimePolling();
              } else {
                event.target.cueVideoById?.({ videoId: targetPlayId, startSeconds });
              }
              return;
            }

            if (startSeconds > 0) {
              try {
                event.target.seekTo?.(startSeconds, true);
              } catch {
                // ignore
              }
            }
            if (isPlayingRef.current && targetPlayId) {
              event.target.playVideo();
              startTimePolling();
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 video cued
            if (event.data === 1) {
              setPlayerErrorCode(null);
              hiddenResumeCountRef.current = 0;
              if (verifyPauseTimerRef.current) {
                clearTimeout(verifyPauseTimerRef.current);
                verifyPauseTimerRef.current = null;
              }
              onStateChangeRef.current(true);
              startTimePolling();
            } else if (event.data === 2) {
              // When minimized/backgrounded, retry at most 2 quick times.
              // If the browser/OS still blocks iframe audio, sync UI & notification to paused
              // so the user never sees a silent "playing" notification.
              if (
                typeof document !== 'undefined' &&
                document.visibilityState === 'hidden' &&
                intendedPlayingRef.current &&
                hiddenResumeCountRef.current < 2
              ) {
                hiddenResumeCountRef.current += 1;
                try {
                  playerRef.current?.playVideo?.();
                } catch {
                  // ignore
                }
                if (verifyPauseTimerRef.current) clearTimeout(verifyPauseTimerRef.current);
                verifyPauseTimerRef.current = setTimeout(() => {
                  try {
                    const state = playerRef.current?.getPlayerState?.();
                    if (state !== 1 && state !== 3) {
                      onStateChangeRef.current(false);
                      stopTimePolling();
                    }
                  } catch {
                    onStateChangeRef.current(false);
                    stopTimePolling();
                  }
                }, 700);
                return;
              }
              onStateChangeRef.current(false);
              stopTimePolling();
            } else if (event.data === 0) {
              if (verifyPauseTimerRef.current) {
                clearTimeout(verifyPauseTimerRef.current);
                verifyPauseTimerRef.current = null;
              }
              onStateChangeRef.current(false);
              stopTimePolling();
              onEndedRef.current();
            }
          },
          onError: (event: any) => {
            const code = event.data ?? 'UNKNOWN';
            console.warn('YouTube Player error code:', code, 'host:', embedHostRef.current);
            if (
              (code === 101 || code === 150 || code === 153 || code === 5 || code === 'API_BLOCKED') &&
              embedHostRef.current === 'https://www.youtube-nocookie.com' &&
              !autoFallbackTriedRef.current
            ) {
              autoFallbackTriedRef.current = true;
              setPlayerErrorCode(null);
              setEmbedHost('https://www.youtube.com');
              return;
            }
            setPlayerErrorCode(code);
            onErrorRef.current?.(event.data);
          },
        },
      });

      // Set Permissions-Policy & inline playback attributes immediately when YT creates the iframe DOM node
      // rather than waiting for onReady (mobile browsers evaluate allow="autoplay" when the iframe loads).
      try {
        const earlyIframe = playerRef.current?.getIframe?.() as HTMLIFrameElement | undefined;
        if (earlyIframe) {
          earlyIframe.setAttribute(
            'allow',
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
          );
          earlyIframe.setAttribute('playsinline', '1');
          earlyIframe.referrerPolicy = 'strict-origin-when-cross-origin';
        }
      } catch {
        // ignore if getIframe not ready yet; onReady applies them as well
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.getElementById('youtube-iframe-api-script');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        tag.onerror = () => {
          console.warn('YouTube IFrame API gagal dimuat.');
          setPlayerErrorCode('API_BLOCKED');
          onErrorRef.current?.('API_BLOCKED');
        };
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      if (window.YT && typeof window.YT.ready === 'function') {
        window.YT.ready(initPlayer);
      } else {
        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevReady) prevReady();
          initPlayer();
        };
      }
    }

    return () => {
      cancelled = true;
      stopTimePolling();
      if (verifyPauseTimerRef.current) {
        clearTimeout(verifyPauseTimerRef.current);
        verifyPauseTimerRef.current = null;
      }
      isReadyRef.current = false;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      playerRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [embedHost, startTimePolling, stopTimePolling]);

  // Handle video changes
  useEffect(() => {
    setPlayerErrorCode(null);
    autoFallbackTriedRef.current = false;
    if (!playerRef.current || !isReadyRef.current || !currentVideo) return;
    try {
      const currentUrl = playerRef.current.getVideoUrl ? playerRef.current.getVideoUrl() : '';
      if (loadedVideoIdRef.current !== currentVideo.id || !currentUrl.includes(currentVideo.id)) {
        loadedVideoIdRef.current = currentVideo.id;
        const snap = getPlaybackClockSnapshot();
        const clockSec =
          snap.videoId === currentVideo.id && snap.currentTime > 0 ? Math.floor(snap.currentTime) : 0;
        const startSeconds = Math.max(clockSec, Math.floor(initialSeekSecondsRef.current || 0));
        if (isPlayingRef.current) {
          skipNextPlayVideoRef.current = currentVideo.id;
          playerRef.current.loadVideoById({
            videoId: currentVideo.id,
            startSeconds,
          });
          startTimePolling();
        } else {
          skipNextPlayVideoRef.current = null;
          playerRef.current.cueVideoById({
            videoId: currentVideo.id,
            startSeconds,
          });
        }
      }
    } catch (e) {
      console.warn('Failed to switch video', e);
    }
  }, [currentVideo?.id, startTimePolling]);

  // Attempt brief resume when tab moves to background; sync to paused if OS blocks it
  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        hiddenResumeCountRef.current = 0;
        return;
      }

      if (
        document.visibilityState === 'hidden' &&
        intendedPlayingRef.current &&
        playerRef.current &&
        isReadyRef.current
      ) {
        const retryTimer = setTimeout(() => {
          try {
            const state = playerRef.current?.getPlayerState?.();
            if (state !== 1 && state !== 3 && intendedPlayingRef.current && hiddenResumeCountRef.current < 2) {
              hiddenResumeCountRef.current += 1;
              playerRef.current.playVideo();
            }
          } catch {
            // ignore
          }
        }, 180);

        const verifyTimer = setTimeout(() => {
          try {
            const state = playerRef.current?.getPlayerState?.();
            if (intendedPlayingRef.current && state !== 1 && state !== 3) {
              onStateChangeRef.current(false);
              stopTimePolling();
            }
          } catch {
            // ignore
          }
        }, 850);

        timers.push(retryTimer, verifyTimer);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      timers.forEach((t) => clearTimeout(t));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stopTimePolling]);

  // Handle play / pause toggle (and verify mobile autoplay didn't silently stay unstarted/cued)
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current) return;
    let autoplayCheckTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      if (isPlaying) {
        if (skipNextPlayVideoRef.current === currentVideoRef.current?.id) {
          skipNextPlayVideoRef.current = null;
        } else {
          playerRef.current.playVideo();
        }
        startTimePolling();
        autoplayCheckTimer = setTimeout(() => {
          try {
            const state = playerRef.current?.getPlayerState?.();
            // Still unstarted (-1) or cued (5) -> mobile browser blocked programmatic iframe autoplay
            if (intendedPlayingRef.current && (state === -1 || state === 5)) {
              onStateChangeRef.current(false);
              stopTimePolling();
              onAutoplayBlockedRef.current?.();
            }
          } catch {
            // ignore
          }
        }, 5200);
      } else {
        skipNextPlayVideoRef.current = null;
        playerRef.current.pauseVideo();
        stopTimePolling();
      }
    } catch {
      // ignore
    }
    return () => {
      if (autoplayCheckTimer) clearTimeout(autoplayCheckTimer);
    };
  }, [isPlaying, startTimePolling, stopTimePolling]);

  // Handle seek command
  useEffect(() => {
    if (seekCommand !== null && playerRef.current && isReadyRef.current) {
      try {
        playerRef.current.seekTo(seekCommand, true);
        onSeekHandledRef.current();
      } catch {
        onSeekHandledRef.current();
      }
    }
  }, [seekCommand]);

  // Handle volume / mute
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
      }
    } catch {
      // ignore
    }
  }, [volume, isMuted]);

  // Handle playback rate
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current) return;
    try {
      playerRef.current.setPlaybackRate(playbackRate);
    } catch {
      // ignore
    }
  }, [playbackRate]);

  const handleRetryEmbed = () => {
    setPlayerErrorCode(null);
    if (playerRef.current && isReadyRef.current && currentVideo) {
      try {
        playerRef.current.loadVideoById({
          videoId: currentVideo.id,
          startSeconds: Math.floor(initialSeekSecondsRef.current || 0),
        });
        startTimePolling();
      } catch {
        // ignore
      }
    }
  };

  const handleToggleEmbedHost = () => {
    setPlayerErrorCode(null);
    setEmbedHost((prev) =>
      prev === 'https://www.youtube-nocookie.com'
        ? 'https://www.youtube.com'
        : 'https://www.youtube-nocookie.com'
    );
  };

  const errorMessage =
    playerErrorCode === 101 || playerErrorCode === 150 || playerErrorCode === 153
      ? 'Pemilik video membatasi pemutaran embed langsung di luar YouTube.'
      : playerErrorCode === 100
      ? 'Video tidak ditemukan atau telah dihapus/diprivasikan.'
      : playerErrorCode === 'API_BLOCKED'
      ? 'Pemutar YouTube diblokir oleh ekstensi browser atau koneksi jaringan.'
      : 'Terjadi kendala saat memuat pemutar video YouTube.';

  return (
    <div
      className={
        isVisible
          ? 'w-full h-full relative bg-black aspect-video rounded-xl overflow-hidden shadow-2xl'
          : 'w-full h-full relative bg-black aspect-video overflow-hidden'
      }
    >
      <div ref={containerRef} className="w-full h-full" />
      {playerErrorCode !== null && currentVideo && isVisible && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/92 text-center text-white space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <div className="space-y-1 max-w-md">
            <p className="text-sm font-bold">Video Tidak Dapat Diputar Langsung</p>
            <p className="text-xs text-slate-300 leading-relaxed">{errorMessage}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {onOpenExtractorAuth && (
              <button
                type="button"
                onClick={onOpenExtractorAuth}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Putar via Audio Latar (Bypass Embed)</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleEmbedHost}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>
                {embedHost === 'https://www.youtube-nocookie.com'
                  ? 'Coba Host Standar'
                  : 'Coba Mode Privasi'}
              </span>
            </button>
            {playerErrorCode !== 101 && playerErrorCode !== 150 && (
              <button
                type="button"
                onClick={handleRetryEmbed}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang</span>
              </button>
            )}
            <a
              href={`https://www.youtube.com/watch?v=${currentVideo.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Tonton di YouTube</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
  }
);
