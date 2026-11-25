import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Video } from '../types';
import { buildExtractorHeaders } from '../utils/extractorConfig';
import { parseJsonSafely } from '../utils/safeJson';
import { getPlaybackClockSnapshot } from '../utils/playbackClock';

const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export interface NativeAudioHandle {
  unlock: () => void;
  seek: (seconds: number) => void;
}

interface NativeAudioPlayerProps {
  active: boolean;
  keepAlivePrimed?: boolean;
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
      keepAlivePrimed = false,
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
    const audioCtxRef = useRef<AudioContext | null>(null);
    const [retryAttempt, setRetryAttempt] = useState(0);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const switchGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stallWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSwitchingSrcRef = useRef(false);
    const appliedInitialSeekForIdRef = useRef<string | null>(null);
    const latestPosRef = useRef<number>(initialSeekSeconds || 0);

    const activeRef = useRef(active);
    activeRef.current = active;
    const keepAlivePrimedRef = useRef(keepAlivePrimed);
    keepAlivePrimedRef.current = keepAlivePrimed;
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
        : keepAlivePrimed && currentVideo
        ? SILENT_WAV_DATA_URI
        : undefined;

    useImperativeHandle(ref, () => ({
      unlock() {
        const audio = audioRef.current;
        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            if (!audioCtxRef.current) {
              audioCtxRef.current = new AudioCtx();
            }
            if (audioCtxRef.current.state === 'suspended') {
              void audioCtxRef.current.resume().catch(() => {});
            }
          }
        } catch {
          // ignore AudioContext unavailable
        }
        if (!audio) return;
        try {
          audio.muted = isMuted;
          audio.volume = Math.max(0, Math.min(1, volume / 100));
          // Touching play() inside a synchronous user click primes mobile browsers
          // so subsequent async/background play() calls remain authorized.
          if (activeRef.current && audio.src && !audio.src.startsWith('data:')) {
            if (audio.paused) {
              void audio.play().catch(() => {});
            }
          } else {
            audio.loop = false;
            const currentAttr = audio.getAttribute('src');
            if (!currentAttr || currentAttr === SILENT_WAV_DATA_URI) {
              if (!currentAttr) {
                audio.src = SILENT_WAV_DATA_URI;
              }
              void audio.play().catch(() => {});
            }
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

    const applyPreservesPitch = useCallback((audio: HTMLAudioElement) => {
      try {
        const pitchAudio = audio as HTMLAudioElement & {
          preservesPitch?: boolean;
          webkitPreservesPitch?: boolean;
          mozPreservesPitch?: boolean;
        };
        if ('preservesPitch' in pitchAudio) pitchAudio.preservesPitch = true;
        if ('webkitPreservesPitch' in pitchAudio) pitchAudio.webkitPreservesPitch = true;
        if ('mozPreservesPitch' in pitchAudio) pitchAudio.mozPreservesPitch = true;
      } catch {
        // ignore
      }
    }, []);

    const clearStallWatchdog = useCallback(() => {
      if (stallWatchdogRef.current) {
        clearTimeout(stallWatchdogRef.current);
        stallWatchdogRef.current = null;
      }
    }, []);

    const applyInitialSetup = useCallback(
      (audio: HTMLAudioElement) => {
        const vidId = videoIdRef.current;
        const clockSnap = getPlaybackClockSnapshot();
        const clockResume =
          vidId && clockSnap.videoId === vidId && clockSnap.currentTime > 0
            ? clockSnap.currentTime
            : 0;
        const targetResume =
          latestPosRef.current > 0
            ? latestPosRef.current
            : clockResume > 0
            ? clockResume
            : initialSeekSecondsRef.current;
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
        applyPreservesPitch(audio);
        try {
          audio.playbackRate = playbackRateRef.current;
        } catch {
          // ignore
        }
      },
      [applyPreservesPitch]
    );

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

    const armStallWatchdog = useCallback(() => {
      clearStallWatchdog();
      if (!activeRef.current || !isPlayingRef.current) return;
      stallWatchdogRef.current = setTimeout(() => {
        stallWatchdogRef.current = null;
        const audio = audioRef.current;
        if (
          audio &&
          activeRef.current &&
          isPlayingRef.current &&
          !isSwitchingSrcRef.current &&
          !audio.ended &&
          !audio.paused &&
          audio.readyState < 3
        ) {
          handleStreamFailure();
        }
      }, 12000);
    }, [clearStallWatchdog, handleStreamFailure]);

    // Reset track-specific state when video changes
    useEffect(() => {
      setRetryAttempt(0);
      appliedInitialSeekForIdRef.current = null;
      latestPosRef.current = initialSeekSeconds || 0;
      clearStallWatchdog();
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    }, [currentVideo?.id, clearStallWatchdog]);

    // Protect isPlaying against spurious browser `pause` events fired while swapping `src`
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      if (switchGuardTimerRef.current) {
        clearTimeout(switchGuardTimerRef.current);
        switchGuardTimerRef.current = null;
      }

      if (!active && !keepAlivePrimed) {
        isSwitchingSrcRef.current = false;
        appliedInitialSeekForIdRef.current = null;
        latestPosRef.current = 0;
        audio.loop = false;
        const curSrc = audio.getAttribute('src');
        if (curSrc && curSrc !== SILENT_WAV_DATA_URI) {
          if (!audio.paused) audio.pause();
          // Keep tiny silent WAV src instead of removeAttribute('src')+load() so iOS/Android
          // preserves user-gesture activation on this <audio> node for seamless background handoff.
          audio.src = SILENT_WAV_DATA_URI;
        }
        return;
      }

      if (!active && keepAlivePrimed) {
        isSwitchingSrcRef.current = true;
        audio.loop = true;
        if (isPlayingRef.current && audio.paused && streamUrl) {
          void audio.play().catch(() => {});
        }
        return;
      }

      audio.loop = false;
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
    }, [active, keepAlivePrimed, streamUrl]);

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

    // Sync playback rate & pitch preservation
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      applyPreservesPitch(audio);
      try {
        audio.playbackRate = playbackRate;
      } catch {
        // ignore unsupported rate
      }
    }, [playbackRate, applyPreservesPitch]);

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
        clearStallWatchdog();
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        if (switchGuardTimerRef.current) clearTimeout(switchGuardTimerRef.current);
      };
    }, [clearStallWatchdog]);

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
          clearStallWatchdog();
          if (!activeRef.current) return;
          onStateChangeRef.current(true);
        }}
        onWaiting={() => {
          if (activeRef.current && isPlayingRef.current) {
            armStallWatchdog();
          }
        }}
        onStalled={() => {
          if (activeRef.current && isPlayingRef.current) {
            armStallWatchdog();
          }
        }}
        onTimeUpdate={(e) => {
          clearStallWatchdog();
          if (!activeRef.current) return;
          const audio = e.currentTarget;
          const cur = audio.currentTime || 0;
          if (cur > 0) latestPosRef.current = cur;
          const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
          onTimeUpdateRef.current(cur, dur);
        }}
        onPlay={() => {
          isSwitchingSrcRef.current = false;
          clearStallWatchdog();
          if (!activeRef.current) return;
          onStateChangeRef.current(true);
        }}
        onPause={(e) => {
          clearStallWatchdog();
          if (!activeRef.current || isSwitchingSrcRef.current) return;
          if (!e.currentTarget.ended) {
            onStateChangeRef.current(false);
          }
        }}
        onEnded={() => {
          clearStallWatchdog();
          if (!activeRef.current) return;
          isSwitchingSrcRef.current = true;
          onEndedRef.current();
        }}
        onError={() => {
          clearStallWatchdog();
          handleStreamFailure();
        }}
        className="fixed opacity-0 pointer-events-none w-1 h-1 -z-50"
      />
    );
  }
);
