import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, RotateCw, SkipForward, Maximize2, Headphones, Tv, Radio, PictureInPicture2 } from 'lucide-react';
import { PlayerMode, Video } from '../types';
import { formatTime } from '../utils/format';
import { usePlaybackClock } from '../utils/playbackClock';

interface MiniPlayerBarProps {
  currentVideo: Video | null;
  isPlaying: boolean;
  mode: PlayerMode;
  usingNativeAudio?: boolean;
  hasNext?: boolean;
  onPlayPause: () => void;
  onSkipBack: (sec?: number) => void;
  onSkipForward: (sec?: number) => void;
  onNext?: () => void;
  onExpand: () => void;
  onToggleMode: () => void;
  onOpenBackgroundAudioPopup?: () => void;
  backgroundAudioActive?: boolean;
  isFloatingSupported?: boolean;
  isFloatingOpen?: boolean;
  onToggleFloatingPopup?: () => void;
}

const MiniPlayerTopProgress: React.FC<{ videoId: string }> = React.memo(({ videoId }) => {
  const clock = usePlaybackClock();
  const currentTime = clock.videoId === videoId ? clock.currentTime : 0;
  const duration = clock.videoId === videoId ? clock.duration : 0;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="w-full h-1 bg-slate-200/80 dark:bg-slate-800/80">
      <div
        className="h-full casttube-gradient-bar transition-[width] duration-200"
        style={{ width: `${progressPercent}%` }}
      />
    </div>
  );
});

const MiniPlayerTimeReadout: React.FC<{ videoId: string }> = React.memo(({ videoId }) => {
  const clock = usePlaybackClock();
  const currentTime = clock.videoId === videoId ? clock.currentTime : 0;
  const duration = clock.videoId === videoId ? clock.duration : 0;

  return (
    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
      {formatTime(currentTime)} / {formatTime(duration)}
    </span>
  );
});

export const MiniPlayerBar: React.FC<MiniPlayerBarProps> = React.memo(({
  currentVideo,
  isPlaying,
  mode,
  usingNativeAudio = false,
  hasNext = false,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onNext,
  onExpand,
  onToggleMode,
  onOpenBackgroundAudioPopup,
  backgroundAudioActive = false,
  isFloatingSupported = false,
  isFloatingOpen = false,
  onToggleFloatingPopup,
}) => {
  return (
    <AnimatePresence>
      {currentVideo && (
        <motion.div
          key="mini-player-bar"
          initial={{ y: 84, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 84, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t casttube-accent-border shadow-2xl shadow-indigo-950/15 transition-colors duration-200 pb-[env(safe-area-inset-bottom)]"
        >
          {/* Top thin progress bar isolated from full-bar re-renders */}
          <MiniPlayerTopProgress videoId={currentVideo.id} />

          <div className="max-w-7xl mx-auto px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Thumbnail & Title */}
            <div
              className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer flex-1 sm:flex-initial max-w-sm sm:max-w-md group active:scale-[0.99] transition-transform"
              onClick={onExpand}
            >
              <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-slate-800 shrink-0 shadow-sm ring-1 ring-[var(--ct-border-light)] dark:ring-[var(--ct-border-dark)]">
                <img
                  src={currentVideo.thumbnail}
                  alt={currentVideo.title}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                    <span className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
                      <motion.span
                        animate={{ scaleY: [0.35, 1, 0.45, 0.9, 0.35] }}
                        transition={{ duration: 0.85, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-0.5 h-full rounded-full origin-bottom"
                        style={{ backgroundColor: 'var(--ct-glow)' }}
                      />
                      <motion.span
                        animate={{ scaleY: [0.9, 0.35, 1, 0.5, 0.9] }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-0.5 h-full rounded-full origin-bottom"
                        style={{ backgroundColor: 'var(--ct-mid)' }}
                      />
                      <motion.span
                        animate={{ scaleY: [0.5, 0.95, 0.35, 0.8, 0.5] }}
                        transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-0.5 h-full rounded-full origin-bottom"
                        style={{ backgroundColor: 'var(--ct-start)' }}
                      />
                    </span>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  {currentVideo.title}
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 sm:gap-1.5">
                  <span className="truncate font-medium casttube-accent-secondary-text">{currentVideo.channelTitle}</span>
                  <span aria-hidden="true">·</span>
                  <MiniPlayerTimeReadout videoId={currentVideo.id} />
                  {mode === 'audio' && (
                    <span
                      className={`hidden md:inline-block text-[10px] font-semibold ${
                        usingNativeAudio
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'casttube-accent-secondary-text'
                      }`}
                    >
                      · {usingNativeAudio ? 'Latar Aktif' : 'IFrame'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Center: Playback Controls */}
            <div className="flex items-center gap-0.5 sm:gap-2.5 shrink-0">
              <button
                onClick={() => onSkipBack(15)}
                className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:text-[var(--ct-end-light)] dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors active:scale-90 cursor-pointer"
                title="Mundur 15 detik"
                aria-label="Mundur 15 detik"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={onPlayPause}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full casttube-gradient-btn hover:brightness-110 flex items-center justify-center transition-transform hover:scale-105 active:scale-90 cursor-pointer"
                title={isPlaying ? 'Jeda' : 'Putar'}
                aria-label={isPlaying ? 'Jeda' : 'Putar'}
              >
                {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />}
              </button>

              <button
                onClick={() => onSkipForward(30)}
                className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:text-[var(--ct-end-light)] dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors active:scale-90 cursor-pointer"
                title="Maju 30 detik"
                aria-label="Maju 30 detik"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {hasNext && onNext && (
                <button
                  onClick={onNext}
                  className="flex p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors active:scale-90 cursor-pointer"
                  title="Putar Episode Berikutnya"
                  aria-label="Putar Episode Berikutnya"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Right: Background Audio Popup, Mode indicator & Expand button */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {onOpenBackgroundAudioPopup && (
                <button
                  onClick={onOpenBackgroundAudioPopup}
                  className={`flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-semibold rounded-lg transition-colors active:scale-95 cursor-pointer ${
                    backgroundAudioActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-700/40'
                      : 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title="Popup Audio Latar Belakang (Otomatis Aktif)"
                  aria-label="Popup Audio Latar Belakang"
                >
                  <Radio className={`w-3.5 h-3.5 ${backgroundAudioActive ? 'text-emerald-500' : 'casttube-accent-icon'}`} />
                  <span className="hidden lg:inline">Latar</span>
                </button>
              )}

              {isFloatingSupported && onToggleFloatingPopup && (
                <button
                  onClick={onToggleFloatingPopup}
                  className={`flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-90 cursor-pointer ${
                    isFloatingOpen
                      ? 'casttube-gradient-btn'
                      : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:text-[var(--ct-end-light)] dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-200/80 dark:hover:bg-slate-700'
                  }`}
                  title={isFloatingOpen ? 'Tutup Popup Mengambang' : 'Buka Popup Mengambang'}
                  aria-label={isFloatingOpen ? 'Tutup Popup Mengambang' : 'Buka Popup Mengambang'}
                >
                  <PictureInPicture2 className="w-4 h-4" />
                  <span className="hidden md:inline">{isFloatingOpen ? 'Popup Aktif' : 'Popup'}</span>
                </button>
              )}

              <button
                onClick={onToggleMode}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded-lg transition-colors active:scale-95 cursor-pointer"
                title={mode === 'audio' ? 'Beralih ke Video' : 'Beralih ke Audio Saja'}
                aria-label={mode === 'audio' ? 'Beralih ke Video' : 'Beralih ke Audio Saja'}
              >
                {mode === 'audio' ? (
                  <>
                    <Headphones
                      className={`w-3.5 h-3.5 ${
                        usingNativeAudio ? 'text-emerald-500' : 'casttube-accent-secondary-text'
                      }`}
                    />
                    <span className="hidden sm:inline">Audio Saja</span>
                  </>
                ) : (
                  <>
                    <Tv className="w-3.5 h-3.5 casttube-accent-icon" />
                    <span className="hidden sm:inline">Video</span>
                  </>
                )}
              </button>

              <button
                onClick={onExpand}
                className="p-1.5 sm:p-2 text-slate-500 hover:text-[var(--ct-text-light)] dark:text-slate-400 dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors active:scale-90 cursor-pointer"
                title="Buka Pemutar Penuh"
                aria-label="Buka Pemutar Penuh"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
