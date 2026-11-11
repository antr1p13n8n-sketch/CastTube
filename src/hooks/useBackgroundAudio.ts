import { useEffect, useRef } from 'react';
import { Video } from '../types';

interface UseBackgroundAudioOptions {
  currentVideo: Video | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  disableKeepAlive?: boolean;
}

function createSilentWavUrl(durationSeconds = 3): string {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSeconds;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

/**
 * Keeps audio playback alive when the browser window is minimized or backgrounded:
 * 1. Registers Media Session metadata & lock-screen / OS media controls.
 * 2. Maintains a real 3-second silent HTML5 <audio> loop + Web Audio API keep-alive
 *    so mobile browsers (Android Chrome / iOS Safari) keep audio focus and do not freeze the tab.
 */
export function useBackgroundAudio({
  currentVideo,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onSkipBack,
  onSkipForward,
  disableKeepAlive = false,
}: UseBackgroundAudioOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const keepAliveStartedRef = useRef(false);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const silentAudioUrlRef = useRef<string | null>(null);

  const handlersRef = useRef({
    onPlay,
    onPause,
    onNext,
    onPrev,
    onSeek,
    onSkipBack,
    onSkipForward,
  });

  useEffect(() => {
    handlersRef.current = {
      onPlay,
      onPause,
      onNext,
      onPrev,
      onSeek,
      onSkipBack,
      onSkipForward,
    };
  }, [onPlay, onPause, onNext, onPrev, onSeek, onSkipBack, onSkipForward]);

  // 1. Real 3s silent HTML5 <audio> + Web Audio keep-alive while playing via iframe
  // (Skipped when NativeAudioPlayer is active so it doesn't steal MediaSession focus)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (disableKeepAlive) {
      if (silentAudioRef.current && !silentAudioRef.current.paused) {
        silentAudioRef.current.pause();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend().catch(() => {});
      }
      return;
    }

    if (!silentAudioRef.current) {
      try {
        const wavUrl = createSilentWavUrl(3);
        silentAudioUrlRef.current = wavUrl;
        const audio = new Audio(wavUrl);
        audio.loop = true;
        audio.volume = 0.5; // Samples are 0 (pure silence), non-zero volume prevents OS muting heuristic
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        silentAudioRef.current = audio;
      } catch {
        // ignore
      }
    }

    if (isPlaying) {
      silentAudioRef.current?.play().catch(() => {});
    } else {
      silentAudioRef.current?.pause();
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (isPlaying) {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;

        if (!keepAliveStartedRef.current && ctx) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          // Extremely low inaudible gain so browsers treat the tab as an active audio session
          gain.gain.value = 0.00001;
          osc.frequency.value = 1;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          keepAliveStartedRef.current = true;
        }

        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      } catch {
        // Ignore if AudioContext is blocked before user gesture
      }
    } else if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      audioCtxRef.current.suspend().catch(() => {});
    }
  }, [isPlaying, disableKeepAlive]);

  useEffect(() => {
    return () => {
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
        silentAudioRef.current.src = '';
        silentAudioRef.current = null;
      }
      if (silentAudioUrlRef.current) {
        URL.revokeObjectURL(silentAudioUrlRef.current);
        silentAudioUrlRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
        keepAliveStartedRef.current = false;
      }
    };
  }, []);

  // 2. Media Session API metadata & action handlers
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    if (currentVideo) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentVideo.title,
          artist: currentVideo.channelTitle,
          album: 'CastTube',
          artwork: [
            {
              src: currentVideo.thumbnail,
              sizes: '480x360',
              type: 'image/jpeg',
            },
            {
              src: `https://i.ytimg.com/vi/${currentVideo.id}/mqdefault.jpg`,
              sizes: '320x180',
              type: 'image/jpeg',
            },
          ],
        });
      } catch {
        // Ignore on browsers without MediaMetadata constructor
      }
    }

    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => handlersRef.current.onPlay()],
      ['pause', () => handlersRef.current.onPause()],
      ['previoustrack', () => handlersRef.current.onPrev()],
      ['nexttrack', () => handlersRef.current.onNext()],
      ['seekbackward', () => handlersRef.current.onSkipBack()],
      ['seekforward', () => handlersRef.current.onSkipForward()],
      [
        'seekto',
        (details) => {
          if (typeof details.seekTime === 'number') {
            handlersRef.current.onSeek(details.seekTime);
          }
        },
      ],
    ];

    for (const [action, handler] of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers don't support all action types
      }
    }
  }, [currentVideo?.id, currentVideo?.title, currentVideo?.channelTitle, currentVideo?.thumbnail]);

  // 3. Keep Media Session playbackState & position synced
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      if (
        typeof navigator.mediaSession.setPositionState === 'function' &&
        duration > 0 &&
        currentTime >= 0 &&
        currentTime <= duration
      ) {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: playbackRate || 1,
          position: currentTime,
        });
      }
    } catch {
      // Ignore invalid position state
    }
  }, [isPlaying, currentTime, duration, playbackRate]);
}
