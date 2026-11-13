import React, { useEffect, useRef } from 'react';
import { Video } from '../types';

interface NativeAudioPlayerProps {
  currentVideo: Video;
  isPlaying: boolean;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  initialSeekSeconds?: number;
  seekCommand: number | null;
  onSeekHandled: () => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onStateChange: (isPlaying: boolean) => void;
  onEnded: () => void;
  onFallbackNeeded: () => void;
}

/**
 * Native HTML5 <audio> playback for "Mode Audio Saja".
 * Unlike a cross-origin YouTube <iframe> (<video>), a native <audio> element
 * continues playing seamlessly on Android Chrome, iOS Safari, Desktop, and PWAs
 * when the app is minimized, switched to another app, or when the phone screen is locked.
 */
export const NativeAudioPlayer: React.FC<NativeAudioPlayerProps> = ({
  currentVideo,
  isPlaying,
  playbackRate,
  volume,
  isMuted,
  initialSeekSeconds = 0,
  seekCommand,
  onSeekHandled,
  onTimeUpdate,
  onStateChange,
  onEnded,
  onFallbackNeeded,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const appliedInitialSeekForIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const streamUrl = `/api/youtube/audio-stream?videoId=${encodeURIComponent(currentVideo.id)}`;

  useEffect(() => {
    appliedInitialSeekForIdRef.current = null;
  }, [currentVideo.id]);

  // Sync play / pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      if (audio.paused) {
        audio.play().catch((err: unknown) => {
          const name = (err as { name?: string })?.name;
          if (name === 'NotAllowedError') {
            onStateChange(false);
          } else if (name === 'NotSupportedError') {
            onFallbackNeeded();
          }
        });
      }
    } else if (!audio.paused) {
      audio.pause();
    }
  }, [isPlaying, currentVideo.id, onStateChange, onFallbackNeeded]);

  // Sync volume & mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
    audio.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume, isMuted]);

  // Sync playback rate
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.playbackRate = playbackRate;
    } catch {
      // ignore unsupported rate
    }
  }, [playbackRate]);

  // Handle seek commands
  useEffect(() => {
    if (seekCommand === null) return;
    const audio = audioRef.current;
    if (audio && Number.isFinite(seekCommand)) {
      try {
        audio.currentTime = Math.max(0, seekCommand);
      } catch {
        // ignore if metadata not yet loaded
      }
    }
    onSeekHandled();
  }, [seekCommand, onSeekHandled]);

  const applyInitialSetup = (audio: HTMLAudioElement) => {
    if (
      appliedInitialSeekForIdRef.current !== currentVideo.id &&
      initialSeekSeconds > 0 &&
      Number.isFinite(initialSeekSeconds)
    ) {
      try {
        if (audio.readyState >= 1) {
          appliedInitialSeekForIdRef.current = currentVideo.id;
          audio.currentTime = initialSeekSeconds;
        }
      } catch {
        // ignore
      }
    }
    audio.muted = isMuted;
    audio.volume = Math.max(0, Math.min(1, volume / 100));
    try {
      audio.playbackRate = playbackRate;
    } catch {
      // ignore
    }
  };

  return (
    <audio
      ref={audioRef}
      src={streamUrl}
      preload="auto"
      playsInline
      onLoadedMetadata={(e) => {
        const audio = e.currentTarget;
        applyInitialSetup(audio);
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          onTimeUpdate(audio.currentTime || 0, audio.duration);
        }
        if (isPlayingRef.current && audio.paused) {
          audio.play().catch((err: unknown) => {
            const name = (err as { name?: string })?.name;
            if (name === 'NotAllowedError') {
              onStateChange(false);
            } else if (name === 'NotSupportedError') {
              onFallbackNeeded();
            }
          });
        }
      }}
      onCanPlay={(e) => {
        const audio = e.currentTarget;
        applyInitialSetup(audio);
        if (isPlayingRef.current && audio.paused) {
          audio.play().catch(() => {});
        }
      }}
      onTimeUpdate={(e) => {
        const audio = e.currentTarget;
        const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
        onTimeUpdate(audio.currentTime || 0, dur);
      }}
      onPlay={() => onStateChange(true)}
      onPause={(e) => {
        if (!e.currentTarget.ended) {
          onStateChange(false);
        }
      }}
      onEnded={() => {
        onStateChange(false);
        onEnded();
      }}
      onError={() => {
        onFallbackNeeded();
      }}
      className="fixed opacity-0 pointer-events-none w-1 h-1 -z-50"
    />
  );
};
