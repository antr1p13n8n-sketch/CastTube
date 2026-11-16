import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Video } from '../types';
import { buildExtractorHeaders } from '../utils/extractorConfig';
import { parseJsonSafely } from '../utils/safeJson';

const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export interface NativeAudioHandle {
  unlock: () => void;
  seek: (seconds: number) => void;
}

interface NativeAudioPlayerProps {
  active: boolean;
  currentVideo: Video | null;
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
  onFallbackNeeded: (reason?: 'login_required' | 'live_stream' | 'unavailable') => void;
}

/**
 * Persistent HTML5 <audio> playback engine.
 * Keeping a single <audio> node mounted in the DOM and unlocking it inside user
 * gesture handlers preserves mobile background & lock-screen playback permissions
 * across track transitions and app minimization on Android Chrome, iOS Safari, Desktop, and PWAs.
 */
export const NativeAudioPlayer = forwardRef<NativeAudioHandle, NativeAudioPlayerProps>(
  function NativeAudioPlayer(
    {
      active,
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
    },
    ref
  ) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [retryAttempt, setRetryAttempt] = useState(0);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const switchGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSwitchingSrcRef = useRef(false);
    const appliedInitialSeekForIdRef = useRef<string | null>(null);
    const latestPosRef = useRef<number>(initialSeekSeconds || 0);

    const activeRef = useRef(active);
    activeRef.current = active;
    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;
    const videoIdRef = useRef<string | null>(currentVideo?.id || null);
    videoIdRef.current = currentVideo?.id || null;
    const retryAttemptRef = useRef(retryAttempt);
    retryAttemptRef.current = retryAttempt;
    const volumeRef = useRef(volume);
    volumeRef.current = volume;
    const isMutedRef = useRef(isMuted);
    isMutedRef.current = isMuted;
    const playbackRateRef = useRef(playbackRate);
    playbackRateRef.current = playbackRate;
    const initialSeekSecondsRef = useRef(initialSeekSeconds);
    initialSeekSecondsRef.current = initialSeekSeconds;
    const onSeekHandledRef = useRef(onSeekHandled);
    onSeekHandledRef.current = onSeekHandled;
    const onTimeUpdateRef = useRef(onTimeUpdate);
    onTimeUpdateRef.current = onTimeUpdate;
    const onStateChangeRef = useRef(onStateChange);
    onStateChangeRef.current = onStateChange;
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;
    const onFallbackNeededRef = useRef(onFallbackNeeded);
    onFallbackNeededRef.current = onFallbackNeeded;

    const streamUrl =
      active && currentVideo
        ? `/api/youtube/audio-stream?videoId=${encodeURIComponent(currentVideo.id)}${
            retryAttempt > 0 ? `&r=${retryAttempt}` : ''
          }`
        : undefined;

    useImperativeHandle(ref, () => ({
      unlock() {
        const audio = audioRef.current;
        if (!audio) return;
        try {
          audio.muted = isMuted;
          audio.volume = Math.max(0, Math.min(1, volume / 100));
          // Touching play() inside a synchronous user click primes mobile browsers
          // so subsequent async/background play() calls remain authorized.
          if (activeRef.current && audio.src) {
            if (audio.paused) {
              void audio.play().catch(() => {});
            }
          } else if (!audio.getAttribute('src')) {
            audio.src = SILENT_WAV_DATA_URI;
            void audio.play().catch(() => {});
          }
        } catch {
          // ignore
        }
      },
      seek(seconds: number) {
        const audio = audioRef.current;
        if (!audio || !Number.isFinite(seconds)) return;
        try {
          latestPosRef.current = Math.max(0, seconds);
          audio.currentTime = Math.max(0, seconds);
        } catch {
          // ignore if metadata not ready
        }
      },
    }));

    const applyInitialSetup = useCallback((audio: HTMLAudioElement) => {
      const vidId = videoIdRef.current;
      const targetResume =
        latestPosRef.current > 0 ? latestPosRef.current : initialSeekSecondsRef.current;
      if (
        vidId &&
        appliedInitialSeekForIdRef.current !== vidId &&
        targetResume > 0 &&
        Number.isFinite(targetResume)
      ) {
        try {
          if (audio.readyState >= 1) {
            appliedInitialSeekForIdRef.current = vidId;
            audio.currentTime = targetResume;
          }
        } catch {
          // ignore
        }
      }
      audio.muted = isMutedRef.current;
      audio.volume = Math.max(0, Math.min(1, volumeRef.current / 100));
      try {
        audio.playbackRate = playbackRateRef.current;
      } catch {
        // ignore
      }
    }, []);

    const handleStreamFailure = useCallback(() => {
      if (!activeRef.current || !videoIdRef.current) return;
      const failedVidId = videoIdRef.current;

      fetch(`/api/youtube/audio-stream?videoId=${encodeURIComponent(failedVidId)}&check=1`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          ...buildExtractorHeaders(),
        },
      })
        .then(async (r) => {
          if (!r.ok) return { available: false, status: 'unavailable' as const };
          const { data } = await parseJsonSafely<{ available?: boolean; status?: string }>(r);
          return data || { available: false, status: 'unavailable' as const };
        })
        .then((data) => {
          if (videoIdRef.current !== failedVidId || !activeRef.current) return;
          if (
            data?.available &&
            typeof navigator !== 'undefined' &&
            navigator.onLine &&
            retryAttemptRef.current < 2
          ) {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            appliedInitialSeekForIdRef.current = null;
            retryTimerRef.current = setTimeout(() => {
              setRetryAttempt((prev) => prev + 1);
            }, 700);
            return;
          }
          const nextStatus =
            data?.status === 'login_required' || data?.status === 'live_stream'
              ? data.status
              : 'unavailable';
          onFallbackNeededRef.current(nextStatus);
        })
        .catch(() => {
          if (videoIdRef.current === failedVidId && activeRef.current) {
            onFallbackNeededRef.current('unavailable');
          }
        });
    }, []);

    // Reset track-specific state when video changes
    useEffect(() => {
      setRetryAttempt(0);
      appliedInitialSeekForIdRef.current = null;
      latestPosRef.current = initialSeekSeconds || 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    }, [currentVideo?.id]);

    // Protect isPlaying against spurious browser `pause` events fired while swapping `src`
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      if (switchGuardTimerRef.current) {
        clearTimeout(switchGuardTimerRef.current);
        switchGuardTimerRef.current = null;
      }

      if (!active || !streamUrl) {
        isSwitchingSrcRef.current = false;
        appliedInitialSeekForIdRef.current = null;
        if (!audio.paused) audio.pause();
        if (audio.getAttribute('src')) {
          audio.removeAttribute('src');
          audio.load();
        }
        return;
      }

      isSwitchingSrcRef.current = true;
      switchGuardTimerRef.current = setTimeout(() => {
        isSwitchingSrcRef.current = false;
      }, 2500);

      return () => {
        if (switchGuardTimerRef.current) {
          clearTimeout(switchGuardTimerRef.current);
          switchGuardTimerRef.current = null;
        }
      };
    }, [active, streamUrl]);

    // Sync play / pause state cleanly
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio || !active || !currentVideo) return;

      if (isPlaying) {
        if (audio.paused) {
          audio.play().catch((err: unknown) => {
            const name = (err as { name?: string })?.name;
            if (name === 'NotAllowedError') {
              onStateChangeRef.current(false);
            } else if (name === 'NotSupportedError') {
              handleStreamFailure();
            }
          });
        }
      } else {
        isSwitchingSrcRef.current = false;
        if (!audio.paused) {
          audio.pause();
        }
      }
    }, [active, isPlaying, currentVideo?.id, retryAttempt, handleStreamFailure]);

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

    // Handle seek commands when active
    useEffect(() => {
      if (seekCommand === null || !active) return;
      const audio = audioRef.current;
      if (audio && Number.isFinite(seekCommand)) {
        try {
          latestPosRef.current = Math.max(0, seekCommand);
          audio.currentTime = Math.max(0, seekCommand);
        } catch {
          // ignore if metadata not yet loaded
        }
      }
      onSeekHandledRef.current();
    }, [seekCommand, active]);

    // Recover automatically if device reconnects to WiFi / 4G while minimized
    useEffect(() => {
      const handleOnline = () => {
        const audio = audioRef.current;
        if (
          audio &&
          activeRef.current &&
          isPlayingRef.current &&
          audio.paused &&
          !audio.ended
        ) {
          setRetryAttempt((prev) => (prev < 2 ? prev + 1 : prev));
        }
      };
      window.addEventListener('online', handleOnline);
      return () => window.removeEventListener('online', handleOnline);
    }, []);

    // Cleanup timers on unmount
    useEffect(() => {
      return () => {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        if (switchGuardTimerRef.current) clearTimeout(switchGuardTimerRef.current);
      };
    }, []);

    return (
      <audio
        ref={audioRef}
        src={streamUrl}
        preload={active ? 'auto' : 'none'}
        playsInline
        x-webkit-airplay="allow"
        onLoadedMetadata={(e) => {
          if (!activeRef.current) return;
          const audio = e.currentTarget;
          applyInitialSetup(audio);
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            onTimeUpdateRef.current(audio.currentTime || 0, audio.duration);
          }
          if (isPlayingRef.current && audio.paused) {
            audio.play().catch((err: unknown) => {
              const name = (err as { name?: string })?.name;
              if (name === 'NotAllowedError') {
                onStateChangeRef.current(false);
              } else if (name === 'NotSupportedError') {
                handleStreamFailure();
              }
            });
          }
        }}
        onCanPlay={(e) => {
          if (!activeRef.current) return;
          const audio = e.currentTarget;
          applyInitialSetup(audio);
          if (isPlayingRef.current && audio.paused) {
            audio.play().catch(() => {});
          }
        }}
        onPlaying={() => {
          isSwitchingSrcRef.current = false;
          if (!activeRef.current) return;
          onStateChangeRef.current(true);
        }}
        onTimeUpdate={(e) => {
          if (!activeRef.current) return;
          const audio = e.currentTarget;
          const cur = audio.currentTime || 0;
          if (cur > 0) latestPosRef.current = cur;
          const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
          onTimeUpdateRef.current(cur, dur);
        }}
        onPlay={() => {
          isSwitchingSrcRef.current = false;
          if (!activeRef.current) return;
          onStateChangeRef.current(true);
        }}
        onPause={(e) => {
          if (!activeRef.current || isSwitchingSrcRef.current) return;
          if (!e.currentTarget.ended) {
            onStateChangeRef.current(false);
          }
        }}
        onEnded={() => {
          if (!activeRef.current) return;
          isSwitchingSrcRef.current = true;
          onEndedRef.current();
        }}
        onError={handleStreamFailure}
        className="fixed opacity-0 pointer-events-none w-1 h-1 -z-50"
      />
    );
  }
);
