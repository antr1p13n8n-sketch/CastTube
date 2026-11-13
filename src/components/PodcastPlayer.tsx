import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Clock,
  Tv,
  ListMusic,
  Radio,
  ExternalLink,
  Sliders,
  Moon,
} from 'lucide-react';
import { Video, VisualizerStyle } from '../types';
import { formatTime, formatRelativeTime } from '../utils/format';
import { AudioVisualizer } from './AudioVisualizer';

interface PodcastPlayerProps {
  currentVideo: Video;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  sleepTimerMinutes: number | null;
  sleepTimerExpiresAt: number | null;
  queue: Video[];
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onSkipBack: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onSpeedChange: (speed: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onSwitchToVideo: () => void;
  onSetSleepTimer: (minutes: number | null) => void;
  onPlayQueueItem: (video: Video) => void;
  onRemoveFromQueue: (videoId: string) => void;
  usingNativeAudio?: boolean;
}

export const PodcastPlayer: React.FC<PodcastPlayerProps> = ({
  currentVideo,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  volume,
  isMuted,
  sleepTimerMinutes,
  sleepTimerExpiresAt,
  queue,
  onPlayPause,
  onSeek,
  onSkipBack,
  onSkipForward,
  onNext,
  onPrev,
  onSpeedChange,
  onVolumeChange,
  onToggleMute,
  onSwitchToVideo,
  onSetSleepTimer,
  onPlayQueueItem,
  onRemoveFromQueue,
  usingNativeAudio = false,
}) => {
  const [visualizerStyle, setVisualizerStyle] = useState<VisualizerStyle>('bars');
  const [showQueue, setShowQueue] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [isHoveringArt, setIsHoveringArt] = useState(false);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Calculate sleep timer countdown
  const getSleepCountdown = () => {
    if (!sleepTimerExpiresAt) return null;
    const remainingMs = sleepTimerExpiresAt - Date.now();
    if (remainingMs <= 0) return '00:00';
    const totalSecs = Math.floor(remainingMs / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const sleepOptions: { label: string; value: number | null }[] = [
    { label: 'Nonaktif', value: null },
    { label: '15 Menit', value: 15 },
    { label: '30 Menit', value: 30 },
    { label: '45 Menit', value: 45 },
    { label: '60 Menit', value: 60 },
  ];

  return (
    <div className="relative w-full max-w-4xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 md:p-8 transition-colors duration-200">
      {/* Background ambient lighting */}
      <div
        className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-25 dark:opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #ef4444 0%, #f97316 70%, transparent 100%)',
        }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-3xl opacity-20 dark:opacity-15 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #6366f1 0%, #a855f7 70%, transparent 100%)',
        }}
      />

      {/* Top Header inside Player: Mode Switcher & Actions */}
      <div className="relative z-10 flex items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white uppercase tracking-wider">
              Mode Audio Saja (Podcast)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {usingNativeAudio
                ? 'Mesin Audio Native aktif · Terus berputar saat diminimize atau layar terkunci'
                : 'Memutar via Pemutar YouTube · Ikuti kebijakan latar belakang browser'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Switch to video button */}
          <button
            onClick={onSwitchToVideo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Beralih ke Pemutar Video"
          >
            <Tv className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="hidden sm:inline">Mode Video</span>
          </button>

          {/* Toggle Queue */}
          <button
            onClick={() => setShowQueue(!showQueue)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              showQueue
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Daftar Antrean"
          >
            <ListMusic className="w-4 h-4" />
            <span className="hidden sm:inline">Antrean ({queue.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 py-8 items-center">
        {/* Left column: Episode Artwork & Visualizer */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div
            className="relative group w-56 h-56 sm:w-64 sm:h-64 rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer"
            onMouseEnter={() => setIsHoveringArt(true)}
            onMouseLeave={() => setIsHoveringArt(false)}
            onClick={onPlayPause}
          >
            <img
              src={currentVideo.thumbnail}
              alt={currentVideo.title}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover transition-transform duration-700 ${
                isPlaying ? 'scale-105' : 'scale-100'
              }`}
            />
            {/* Dark vinyl overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            {/* Play/Pause overlay icon on hover */}
            <div
              className={`absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
                isHoveringArt ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
              </div>
            </div>

            {/* Live Visualizer badge bottom */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/90 font-medium">
              <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[11px]">
                {isPlaying ? 'Sedang Memutar' : 'Jeda'}
              </span>
              <a
                href={`https://www.youtube.com/watch?v=${currentVideo.id}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-colors"
                title="Buka di YouTube"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Visualizer Style Switcher */}
          <div className="mt-4 flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
              <Sliders className="w-3 h-3" />
              Visual:
            </span>
            {(['bars', 'wave', 'radar', 'minimal'] as VisualizerStyle[]).map((vStyle) => (
              <button
                key={vStyle}
                onClick={() => setVisualizerStyle(vStyle)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer capitalize ${
                  visualizerStyle === vStyle
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {vStyle === 'bars'
                  ? 'Spektrum'
                  : vStyle === 'wave'
                  ? 'Gelombang'
                  : vStyle === 'radar'
                  ? 'Radar'
                  : 'Minimal'}
              </button>
            ))}
          </div>
        </div>

        {/* Right column: Audio Visualizer Screen, Titles & Controls */}
        <div className="md:col-span-7 flex flex-col justify-center">
          {/* Audio Visualizer Canvas Container */}
          <div className="relative w-full h-24 mb-4 rounded-2xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-inner flex items-center justify-center">
            <AudioVisualizer
              isPlaying={isPlaying}
              style={visualizerStyle}
              playbackRate={playbackRate}
            />
          </div>

          {/* Video / Episode Info */}
          <div className="space-y-1.5 mb-6 text-left">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight">
              {currentVideo.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {currentVideo.channelTitle}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTime(currentVideo.publishedAt)}</span>
              {currentVideo.views && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{currentVideo.views} tayangan</span>
                </>
              )}
            </div>
          </div>

          {/* Scrubber Progress Bar */}
          <div className="space-y-2 mb-6">
            <div className="relative w-full flex items-center group">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-600 focus:outline-hidden"
                style={{
                  background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${progressPercent}%, var(--tw-slate-800, #cbd5e1) ${progressPercent}%, var(--tw-slate-800, #cbd5e1) 100%)`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Primary Controls Row */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Previous track */}
            <button
              onClick={onPrev}
              className="p-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Episode Sebelumnya"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Skip Back 15s */}
            <button
              onClick={() => onSkipBack(15)}
              className="relative p-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
              title="Mundur 15 Detik"
            >
              <RotateCcw className="w-6 h-6" />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold font-mono group-hover:scale-105 transition-transform">
                15
              </span>
            </button>

            {/* Big Main Play/Pause Button */}
            <button
              onClick={onPlayPause}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all cursor-pointer"
              title={isPlaying ? 'Jeda' : 'Putar'}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7" />
              ) : (
                <Play className="w-7 h-7 ml-0.5" />
              )}
            </button>

            {/* Skip Forward 30s */}
            <button
              onClick={() => onSkipForward(30)}
              className="relative p-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
              title="Maju 30 Detik"
            >
              <RotateCw className="w-6 h-6" />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold font-mono group-hover:scale-105 transition-transform">
                30
              </span>
            </button>

            {/* Next track */}
            <button
              onClick={onNext}
              className="p-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Episode Berikutnya"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Secondary Controls Bar: Speed, Volume, Sleep Timer */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
            {/* Playback speed selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Kecepatan:</span>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                {speedOptions.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => onSpeedChange(speed)}
                    className={`px-2 py-0.5 font-mono text-[11px] rounded transition-colors cursor-pointer ${
                      playbackRate === speed
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Volume slider & Sleep Timer */}
            <div className="flex items-center gap-4">
              {/* Sleep timer dropdown trigger */}
              <div className="relative">
                <button
                  onClick={() => setShowSleepMenu(!showSleepMenu)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    sleepTimerExpiresAt
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Pengatur Waktu Tidur"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>
                    {sleepTimerExpiresAt
                      ? `Tidur: ${getSleepCountdown()}`
                      : 'Waktu Tidur'}
                  </span>
                </button>

                {showSleepMenu && (
                  <div className="absolute right-0 bottom-full mb-2 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-30">
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">
                      Waktu Berhenti:
                    </div>
                    {sleepOptions.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => {
                          onSetSleepTimer(opt.value);
                          setShowSleepMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer ${
                          sleepTimerMinutes === opt.value
                            ? 'text-red-600 dark:text-red-400 font-bold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onToggleMute}
                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  title={isMuted ? 'Bunyikan' : 'Bisukan'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-red-500" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="w-16 sm:w-20 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-600 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Queue Drawer overlay (when open) */}
      {showQueue && (
        <div className="relative z-20 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-left">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Antrean Berikutnya ({queue.length})
            </h3>
            <button
              onClick={() => setShowQueue(false)}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Tutup Antrean
            </button>
          </div>

          {queue.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              Belum ada video dalam antrean. Klik tombol "+" pada kartu video untuk menambahkan.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {queue.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div
                    className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                    onClick={() => onPlayQueueItem(item)}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-12 h-8 rounded-md object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.channelTitle}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveFromQueue(item.id)}
                    className="text-xs text-slate-400 hover:text-red-500 p-1 cursor-pointer shrink-0"
                    title="Hapus dari antrean"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
