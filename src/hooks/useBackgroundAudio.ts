import { useEffect, useRef } from 'react';
import { Video } from '../types';
import { getPlaybackClockSnapshot, subscribePlaybackClock } from '../utils/playbackClock';

interface UseBackgroundAudioOptions {
  currentVideo: Video | null;
  isPlaying: boolean;
  playbackRate: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onVisibilityHiddenWhilePlaying?: () => void;
  onVisibilityVisible?: () => void;
}

/**
 * Registers Media Session metadata, lock-screen / OS notification controls,
 * throttled playback position state, and visibility lifecycle hooks.
 */
export function useBackgroundAudio({
  currentVideo,
  isPlaying,
  playbackRate,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onSkipBack,
  onSkipForward,
  onVisibilityHiddenWhilePlaying,
  onVisibilityVisible,
}: UseBackgroundAudioOptions) {
  const handlersRef = useRef({
    onPlay,
    onPause,
    onNext,
    onPrev,
    onSeek,
    onSkipBack,
    onSkipForward,
    onVisibilityHiddenWhilePlaying,
    onVisibilityVisible,
  });

  handlersRef.current = {
    onPlay,
    onPause,
    onNext,
    onPrev,
    onSeek,
    onSkipBack,
    onSkipForward,
    onVisibilityHiddenWhilePlaying,
    onVisibilityVisible,
  };

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  // 1. Media Session API metadata & action handlers
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
              src: `https://i.ytimg.com/vi/${currentVideo.id}/mqdefault.jpg`,
              sizes: '320x180',
              type: 'image/jpeg',
            },
            {
              src: currentVideo.thumbnail,
              sizes: '480x360',
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
      ['stop', () => handlersRef.current.onPause()],
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

  // 2. Keep Media Session playbackState & throttled position synced without App re-renders
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const pushPosition = () => {
      try {
        navigator.mediaSession.playbackState = isPlayingRef.current ? 'playing' : 'paused';
        const snap = getPlaybackClockSnapshot();
        if (
          typeof navigator.mediaSession.setPositionState === 'function' &&
          snap.duration > 0 &&
          Number.isFinite(snap.duration) &&
          snap.currentTime >= 0 &&
          snap.currentTime <= snap.duration
        ) {
          navigator.mediaSession.setPositionState({
            duration: snap.duration,
            playbackRate: playbackRateRef.current || 1,
            position: Math.min(snap.duration, Math.max(0, snap.currentTime)),
          });
        }
      } catch {
        // Ignore invalid position state
      }
    };

    pushPosition();
    let lastSyncMs = Date.now();
    const unsub = subscribePlaybackClock(() => {
      const now = Date.now();
      if (now - lastSyncMs >= 2000) {
        lastSyncMs = now;
        pushPosition();
      }
    });
    return unsub;
  }, [isPlaying, playbackRate, currentVideo?.id]);

  // 3. Re-assert Media Session & notify handler when app goes to background / returns
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.playbackState = isPlayingRef.current ? 'playing' : 'paused';
          } catch {
            // ignore
          }
        }
        if (isPlayingRef.current) {
          handlersRef.current.onVisibilityHiddenWhilePlaying?.();
        }
      } else {
        handlersRef.current.onVisibilityVisible?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
}
