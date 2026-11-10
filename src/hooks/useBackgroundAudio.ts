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
}

/**
 * Keeps audio playback alive when the browser window is minimized or backgrounded:
 * 1. Registers Media Session metadata & lock-screen / OS media controls.
 * 2. Maintains an inaudible Web Audio API keep-alive context while playing so
 *    browsers do not freeze background timers or suspend the tab.
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
}: UseBackgroundAudioOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const keepAliveStartedRef = useRef(false);

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

  // 1. Inaudible Web Audio keep-alive while playing
  useEffect(() => {
    if (typeof window === 'undefined') return;
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
  }, [isPlaying]);

  useEffect(() => {
    return () => {
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
