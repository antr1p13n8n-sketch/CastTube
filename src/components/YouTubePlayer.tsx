import React, { useEffect, useRef, useCallback } from 'react';
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
  seekCommand: number | null; // Triggered when user scrubs or skips
  onSeekHandled: () => void;
  initialSeekSeconds?: number;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  currentVideo,
  isPlaying,
  mode,
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
  const timeIntervalRef = useRef<any>(null);
  const intendedPlayingRef = useRef<boolean>(isPlaying);
  const hiddenResumeCountRef = useRef<number>(0);

  useEffect(() => {
    intendedPlayingRef.current = isPlaying;
    if (isPlaying) {
      hiddenResumeCountRef.current = 0;
    }
  }, [isPlaying]);

  // Poll current time when playing
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
      if (!window.YT || !window.YT.Player) return;

      if (playerRef.current) {
        return;
      }

      playerRef.current = new window.YT.Player('yt-embedded-instance', {
        height: '100%',
        width: '100%',
        host: 'https://www.youtube-nocookie.com',
        videoId: currentVideo ? currentVideo.id : '',
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 1,
          enablejsapi: 1,
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
            event.target.setVolume(isMuted ? 0 : volume);
            event.target.setPlaybackRate(playbackRate);
            if (isPlaying && currentVideo) {
              event.target.playVideo();
              startTimePolling();
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 video cued
            if (event.data === 1) {
              hiddenResumeCountRef.current = 0;
              onStateChange(true);
              startTimePolling();
            } else if (event.data === 2) {
              // On desktop/compatible browsers, try resuming briefly when minimized.
              // If the mobile OS still forces pause after 3 attempts, sync state to paused
              // so the notification does not falsely appear "playing" with no sound.
              if (
                typeof document !== 'undefined' &&
                document.visibilityState === 'hidden' &&
                intendedPlayingRef.current &&
                hiddenResumeCountRef.current < 3
              ) {
                hiddenResumeCountRef.current += 1;
                try {
                  playerRef.current?.playVideo?.();
                } catch {
                  // ignore
                }
                setTimeout(() => {
                  if (
                    playerRef.current &&
                    isReadyRef.current &&
                    intendedPlayingRef.current &&
                    document.visibilityState === 'hidden'
                  ) {
                    try {
                      if (playerRef.current.getPlayerState?.() !== 1) {
                        onStateChange(false);
                        stopTimePolling();
                      }
                    } catch {
                      // ignore
                    }
                  }
                }, 600);
                return;
              }
              onStateChange(false);
              stopTimePolling();
            } else if (event.data === 0) {
              onStateChange(false);
              stopTimePolling();
              onEnded();
            }
          },
          onError: (event: any) => {
            console.warn('YouTube Player error code:', event.data);
            if (onError) onError(event.data);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Load script if not already added
      const existingScript = document.getElementById('youtube-iframe-api-script');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        tag.onerror = () => {
          console.warn('YouTube IFrame API gagal dimuat (mungkin diblokir oleh ekstensi atau jaringan).');
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
    };
  }, []);

  // Handle video changes
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current || !currentVideo) return;
    try {
      const currentUrl = playerRef.current.getVideoUrl ? playerRef.current.getVideoUrl() : '';
      if (!currentUrl.includes(currentVideo.id)) {
        if (isPlaying) {
          playerRef.current.loadVideoById({
            videoId: currentVideo.id,
            startSeconds: Math.floor(initialSeekSeconds || 0),
          });
          startTimePolling();
        } else {
          playerRef.current.cueVideoById({
            videoId: currentVideo.id,
            startSeconds: Math.floor(initialSeekSeconds || 0),
          });
        }
      }
    } catch (e) {
      console.warn('Failed to switch video', e);
    }
  }, [currentVideo?.id]);

  // Keep playing when window is minimized / tab goes to background
  useEffect(() => {
    const resumeIfNeeded = () => {
      if (
        document.visibilityState === 'hidden' &&
        intendedPlayingRef.current &&
        playerRef.current &&
        isReadyRef.current
      ) {
        try {
          const state = playerRef.current?.getPlayerState?.();
          if (state !== 1 && state !== 3 && intendedPlayingRef.current) {
            playerRef.current.playVideo();
          }
        } catch {
          // ignore
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && intendedPlayingRef.current) {
        [50, 250, 600, 1200].forEach((delay) => {
          setTimeout(resumeIfNeeded, delay);
        });
      }
    };

    const keepAliveTimer = setInterval(resumeIfNeeded, 1000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(keepAliveTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle play / pause toggle
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.playVideo();
        startTimePolling();
      } else {
        playerRef.current.pauseVideo();
        stopTimePolling();
      }
    } catch {
      // ignore
    }
  }, [isPlaying, startTimePolling, stopTimePolling]);

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

  return (
    <div
      className={
        isVisible
          ? 'w-full h-full relative bg-black aspect-video rounded-xl overflow-hidden shadow-2xl'
          : 'w-full h-full relative bg-black aspect-video overflow-hidden'
      }
    >
      <div id="yt-embedded-instance" className="w-full h-full" />
    </div>
  );
};
