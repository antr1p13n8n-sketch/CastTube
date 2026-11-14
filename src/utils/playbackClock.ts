import { useSyncExternalStore } from 'react';

export interface PlaybackClockSnapshot {
  videoId: string | null;
  currentTime: number;
  duration: number;
  revision: number;
}

let state: PlaybackClockSnapshot = {
  videoId: null,
  currentTime: 0,
  duration: 0,
  revision: 0,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getPlaybackClockSnapshot(): PlaybackClockSnapshot {
  return state;
}

export function subscribePlaybackClock(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setPlaybackClock(videoId: string | null, currentTime: number, duration?: number) {
  const nextTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;
  const nextDuration =
    typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? duration
      : state.videoId === videoId
      ? state.duration
      : 0;

  if (
    state.videoId === videoId &&
    Math.abs(state.currentTime - nextTime) < 0.15 &&
    Math.abs(state.duration - nextDuration) < 0.2
  ) {
    return;
  }

  state = {
    videoId,
    currentTime: nextTime,
    duration: nextDuration,
    revision: state.revision + 1,
  };
  emit();
}

export function resetPlaybackClock(videoId: string | null, currentTime = 0, duration = 0) {
  const nextTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;
  const nextDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  state = {
    videoId,
    currentTime: nextTime,
    duration: nextDuration,
    revision: state.revision + 1,
  };
  emit();
}

export function usePlaybackClock(): PlaybackClockSnapshot {
  return useSyncExternalStore(
    subscribePlaybackClock,
    getPlaybackClockSnapshot,
    getPlaybackClockSnapshot
  );
}
