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
}) => {
  const playerRef = useRef<any>(null);
  const isReadyRef = useRef<boolean>(false);
  const timeIntervalRef = useRef<any>(null);

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
        videoId: currentVideo ? currentVideo.id : '',
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            isReadyRef.current = true;
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
              onStateChange(true);
              startTimePolling();
            } else if (event.data === 2) {
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
        playerRef.current.loadVideoById({
          videoId: currentVideo.id,
          startSeconds: 0,
        });
        if (isPlaying) {
          playerRef.current.playVideo();
          startTimePolling();
        }
      }
    } catch (e) {
      console.warn('Failed to switch video', e);
    }
  }, [currentVideo?.id]);

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
          : 'fixed -left-[9999px] -top-[9999px] w-1 h-1 opacity-0 pointer-events-none'
      }
      aria-hidden={!isVisible}
    >
      <div id="yt-embedded-instance" className="w-full h-full" />
    </div>
  );
};
