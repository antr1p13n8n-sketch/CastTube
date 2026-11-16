import React, { useEffect, useRef, useCallback, useState } from 'react';
import { AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { PlayerMode, Video } from '../types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
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
  seekCommand: number | null;
  onSeekHandled: () => void;
  initialSeekSeconds?: number;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
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
  seekCommand,
  onSeekHandled,
  initialSeekSeconds = 0,
}) => {
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
  const [playerErrorCode, setPlayerErrorCode] = useState<string | number | null>(null);

  initialSeekSecondsRef.current = initialSeekSeconds;
  isPlayingRef.current = isPlaying;
  currentVideoRef.current = currentVideo;
  volumeRef.current = volume;
  isMutedRef.current = isMuted;
  playbackRateRef.current = playbackRate;

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
          onTimeUpdate(cur, dur);
        } catch {
          // player might be reloading
        }
      }
    }, 400);
  }, [onTimeUpdate]);

  const stopTimePolling = useCallback(() => {
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
  }, []);

  // Initialize YT Player API
  useEffect(() => {
    const initPlayer = () => {
      if (!window.YT || !window.YT.Player || playerRef.current) return;

      const initialVid = currentVideoRef.current;
      loadedVideoIdRef.current = initialVid ? initialVid.id : null;

      playerRef.current = new window.YT.Player('yt-embedded-instance', {
        height: '100%',
        width: '100%',
        host: 'https://www.youtube-nocookie.com',
        videoId: initialVid ? initialVid.id : '',
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 1,
          enablejsapi: 1,
          start: initialSeekSecondsRef.current > 0 ? Math.floor(initialSeekSecondsRef.current) : 0,
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

            const latestVid = currentVideoRef.current;
            const startSeconds = Math.floor(initialSeekSecondsRef.current || 0);
            if (latestVid && loadedVideoIdRef.current !== latestVid.id) {
              loadedVideoIdRef.current = latestVid.id;
              if (isPlayingRef.current) {
                event.target.loadVideoById?.({ videoId: latestVid.id, startSeconds });
                startTimePolling();
              } else {
                event.target.cueVideoById?.({ videoId: latestVid.id, startSeconds });
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
            if (isPlayingRef.current && latestVid) {
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
              onStateChange(true);
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
                      onStateChange(false);
                      stopTimePolling();
                    }
                  } catch {
                    onStateChange(false);
                    stopTimePolling();
                  }
                }, 700);
                return;
              }
              onStateChange(false);
              stopTimePolling();
            } else if (event.data === 0) {
              if (verifyPauseTimerRef.current) {
                clearTimeout(verifyPauseTimerRef.current);
                verifyPauseTimerRef.current = null;
              }
              onStateChange(false);
              stopTimePolling();
              onEnded();
            }
          },
          onError: (event: any) => {
            console.warn('YouTube Player error code:', event.data);
            setPlayerErrorCode(event.data ?? 'UNKNOWN');
            if (onError) onError(event.data);
          },
        },
      });
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
          if (onError) onError('API_BLOCKED');
        };
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        initPlayer();
      };
    }

    return () => {
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
    };
  }, []);

  // Handle video changes
  useEffect(() => {
    setPlayerErrorCode(null);
    if (!playerRef.current || !isReadyRef.current || !currentVideo) return;
    try {
      const currentUrl = playerRef.current.getVideoUrl ? playerRef.current.getVideoUrl() : '';
      if (loadedVideoIdRef.current !== currentVideo.id || !currentUrl.includes(currentVideo.id)) {
        loadedVideoIdRef.current = currentVideo.id;
        const startSeconds = Math.floor(initialSeekSecondsRef.current || 0);
        if (isPlayingRef.current) {
          playerRef.current.loadVideoById({
            videoId: currentVideo.id,
            startSeconds,
          });
          startTimePolling();
        } else {
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
              onStateChange(false);
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
  }, [onStateChange, stopTimePolling]);

  // Handle play / pause toggle (and verify mobile autoplay didn't silently stay unstarted/cued)
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current) return;
    let autoplayCheckTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      if (isPlaying) {
        playerRef.current.playVideo();
        startTimePolling();
        autoplayCheckTimer = setTimeout(() => {
          try {
            const state = playerRef.current?.getPlayerState?.();
            // Still unstarted (-1) or cued (5) -> mobile browser blocked programmatic iframe autoplay
            if (intendedPlayingRef.current && (state === -1 || state === 5)) {
              onStateChange(false);
              stopTimePolling();
            }
          } catch {
            // ignore
          }
        }, 2000);
      } else {
        playerRef.current.pauseVideo();
        stopTimePolling();
      }
    } catch {
      // ignore
    }
    return () => {
      if (autoplayCheckTimer) clearTimeout(autoplayCheckTimer);
    };
  }, [isPlaying, startTimePolling, stopTimePolling, onStateChange]);

  // Handle seek command
  useEffect(() => {
    if (seekCommand !== null && playerRef.current && isReadyRef.current) {
      try {
        playerRef.current.seekTo(seekCommand, true);
        onSeekHandled();
      } catch {
        onSeekHandled();
      }
    }
  }, [seekCommand, onSeekHandled]);

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

  const errorMessage =
    playerErrorCode === 101 || playerErrorCode === 150
      ? 'Pemilik video menonaktifkan pemutaran embed di luar YouTube.'
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
      <div id="yt-embedded-instance" className="w-full h-full" />
      {playerErrorCode !== null && currentVideo && isVisible && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/92 text-center text-white space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <div className="space-y-1 max-w-md">
            <p className="text-sm font-bold">Video Tidak Dapat Diputar Langsung</p>
            <p className="text-xs text-slate-300 leading-relaxed">{errorMessage}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {playerErrorCode !== 101 && playerErrorCode !== 150 && (
              <button
                type="button"
                onClick={handleRetryEmbed}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Muat Ulang</span>
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
};
