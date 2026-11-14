import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, RotateCw, Maximize2, Headphones, Tv } from 'lucide-react';
import { PlayerMode, Video } from '../types';
import { formatTime } from '../utils/format';

interface MiniPlayerBarProps {
  currentVideo: Video | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  mode: PlayerMode;
  usingNativeAudio?: boolean;
  onPlayPause: () => void;
  onSkipBack: (sec?: number) => void;
  onSkipForward: (sec?: number) => void;
  onExpand: () => void;
  onToggleMode: () => void;
}

export const MiniPlayerBar: React.FC<MiniPlayerBarProps> = React.memo(({
  currentVideo,
  isPlaying,
  currentTime,
  duration,
  mode,
  usingNativeAudio = false,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onExpand,
  onToggleMode,
}) => {
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <AnimatePresence>
      {currentVideo && (
        <motion.div
          key="mini-player-bar"
          initial={{ y: 84, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 84, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-2xl transition-colors duration-200"
        >
          {/* Top thin progress bar */}
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-red-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
            {/* Left: Thumbnail & Title */}
            <motion.div
              whileTap={{ scale: 0.99 }}
              className="flex items-center gap-3 min-w-0 cursor-pointer flex-1 sm:flex-initial max-w-sm sm:max-w-md group"
              onClick={onExpand}
            >
              <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-slate-800 shrink-0 shadow-xs">
                <img
                  src={currentVideo.thumbnail}
                  alt={currentVideo.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                    <span className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
                      <motion.span
                        animate={{ scaleY: [0.35, 1, 0.45, 0.9, 0.35] }}
                        transition={{ duration: 0.85, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-0.5 h-full bg-red-400 rounded-full origin-bottom"
                      />
                      <motion.span
                        animate={{ scaleY: [0.9, 0.35, 1, 0.5, 0.9] }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-0.5 h-full bg-white rounded-full origin-bottom"
                      />
                      <motion.span
                        animate={{ scaleY: [0.5, 0.95, 0.35, 0.8, 0.5] }}
                        transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-0.5 h-full bg-red-400 rounded-full origin-bottom"
                      />
                    </span>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  {currentVideo.title}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                  <span className="truncate">{currentVideo.channelTitle}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-slate-400 shrink-0">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  {mode === 'audio' && (
                    <span
                      className={`hidden md:inline-block text-[10px] font-semibold ${
                        usingNativeAudio
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      · {usingNativeAudio ? 'Latar Aktif' : 'IFrame'}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Center: Playback Controls */}
            <div className="flex items-center gap-1 sm:gap-4 shrink-0">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => onSkipBack(15)}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                title="Mundur 15 detik"
              >
                <RotateCcw className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.9 }}
                onClick={onPlayPause}
                className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
                title={isPlaying ? 'Jeda' : 'Putar'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => onSkipForward(30)}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                title="Maju 30 detik"
              >
                <RotateCw className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Right: Mode indicator & Expand button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onToggleMode}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title={mode === 'audio' ? 'Beralih ke Video' : 'Beralih ke Audio Saja'}
              >
                {mode === 'audio' ? (
                  <>
                    <Headphones
                      className={`w-3.5 h-3.5 ${
                        usingNativeAudio ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    />
                    <span className="hidden sm:inline">Audio Saja</span>
                  </>
                ) : (
                  <>
                    <Tv className="w-3.5 h-3.5 text-red-500" />
                    <span className="hidden sm:inline">Video</span>
                  </>
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onExpand}
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Buka Pemutar Penuh"
              >
                <Maximize2 className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
