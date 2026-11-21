import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipForward,
  Maximize2,
  X,
  Minimize2,
  GripHorizontal,
  Radio,
  Tv,
  Headphones,
  RefreshCw,
} from 'lucide-react';
import { PlayerMode, Video } from '../types';
import { formatTime } from '../utils/format';
import {
  getPlaybackClockSnapshot,
  setPlaybackClock,
  usePlaybackClock,
} from '../utils/playbackClock';
import { AudioVisualizer } from './AudioVisualizer';

interface FloatingInAppPopupProps {
  isOpen: boolean;
  currentVideo: Video | null;
  isPlaying: boolean;
  playerMode: PlayerMode;
  usingNativeAudio: boolean;
  hasNext: boolean;
  embedHost: 'nocookie' | 'standard';
  onToggleEmbedHost: () => void;
  onFallbackStandardHost: () => void;
  onPlayPause: () => void;
  onSkipBack: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
  onSeek: (seconds: number) => void;
  onNext: () => void;
  onToggleMode: () => void;
  onExpand: () => void;
  onClose: () => void;
  onEmbedStateChange: (playing: boolean) => void;
}

const PopupProgressSection: React.FC<{
  videoId: string;
  onSeek: (sec: number) => void;
}> = React.memo(({ videoId, onSeek }) => {
  const clock = usePlaybackClock();
  const currentTime = clock.videoId === videoId ? clock.currentTime : 0;
  const duration = clock.videoId === videoId ? clock.duration : 0;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div
        onClick={(e) => {
          if (duration <= 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          onSeek(ratio * duration);
        }}
        className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden cursor-pointer"
        title="Ketuk untuk melompat posisi"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-cyan-500 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
});

export const FloatingInAppPopup: React.FC<FloatingInAppPopupProps> = ({
  isOpen,
  currentVideo,
  isPlaying,
  playerMode,
  usingNativeAudio,
  hasNext,
  embedHost,
  onToggleEmbedHost,
  onFallbackStandardHost,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onSeek,
  onNext,
  onToggleMode,
  onExpand,
  onClose,
  onEmbedStateChange,
}) => {
  const [compact, setCompact] = useState(false);
  const dragControls = useDragControls();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeStateRef = useRef<{ videoId: string | null; playing: boolean | null }>({
    videoId: null,
    playing: null,
  });

  const propsRef = useRef({
    currentVideo,
    isPlaying,
    onNext,
    onEmbedStateChange,
    onFallbackStandardHost,
  });
  propsRef.current = {
    currentVideo,
    isPlaying,
    onNext,
    onEmbedStateChange,
    onFallbackStandardHost,
  };

  const useEmbed = Boolean(isOpen && currentVideo && !usingNativeAudio);
  const initialEmbedPlayRef = useRef(isPlaying);
  initialEmbedPlayRef.current = isPlaying;

  const embedSrc = React.useMemo(() => {
    if (!useEmbed || !currentVideo) return '';
    const snap = getPlaybackClockSnapshot();
    const startSec =
      snap.videoId === currentVideo.id && snap.currentTime > 1
        ? Math.floor(snap.currentTime)
        : 0;
    const hostBase =
      embedHost === 'standard'
        ? 'https://www.youtube.com'
        : 'https://www.youtube-nocookie.com';
    return `${hostBase}/embed/${encodeURIComponent(
      currentVideo.id
    )}?autoplay=${initialEmbedPlayRef.current ? '1' : '0'}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&start=${startSec}&origin=${encodeURIComponent(
      window.location.origin
    )}`;
  }, [useEmbed, currentVideo?.id, embedHost]);

  const embedKey = currentVideo ? `${currentVideo.id}::${embedHost}` : '';

  const sendEmbedCommand = (func: string, args: unknown[] = []) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          event: 'command',
          func,
          args,
        }),
        '*'
      );
    } catch {
      // ignore postMessage restrictions
    }
  };

  // Sync play/pause commands into the popup iframe without reloading it
  useEffect(() => {
    if (!useEmbed || !currentVideo || !iframeRef.current) return;
    if (iframeStateRef.current.videoId !== currentVideo.id) {
      iframeStateRef.current = { videoId: currentVideo.id, playing: isPlaying };
      return;
    }
    if (iframeStateRef.current.playing === isPlaying) return;
    iframeStateRef.current.playing = isPlaying;
    sendEmbedCommand(isPlaying ? 'playVideo' : 'pauseVideo');
  }, [useEmbed, currentVideo?.id, isPlaying]);

  // Listen to YouTube postMessage events from popup embed
  useEffect(() => {
    if (!useEmbed) return;
    const handleMessage = (ev: MessageEvent) => {
      if (
        typeof ev.origin === 'string' &&
        !ev.origin.includes('youtube.com') &&
        !ev.origin.includes('youtube-nocookie.com')
      ) {
        return;
      }
      if (iframeRef.current?.contentWindow && ev.source !== iframeRef.current.contentWindow) {
        return;
      }
      try {
        const payload = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        const vid = propsRef.current.currentVideo;
        if (payload?.event === 'infoDelivery' && payload?.info) {
          const cur =
            typeof payload.info.currentTime === 'number' ? payload.info.currentTime : undefined;
          const dur =
            typeof payload.info.duration === 'number' ? payload.info.duration : undefined;
          if (vid && (cur !== undefined || dur !== undefined)) {
            setPlaybackClock(vid.id, cur ?? getPlaybackClockSnapshot().currentTime, dur);
          }
          if (typeof payload.info.playerState === 'number') {
            if (payload.info.playerState === 1) {
              iframeStateRef.current = { videoId: vid?.id || null, playing: true };
              if (!propsRef.current.isPlaying) {
                propsRef.current.onEmbedStateChange(true);
              }
            } else if (payload.info.playerState === 2) {
              iframeStateRef.current = { videoId: vid?.id || null, playing: false };
              if (propsRef.current.isPlaying) {
                propsRef.current.onEmbedStateChange(false);
              }
            } else if (payload.info.playerState === 0) {
              propsRef.current.onNext();
            }
          }
        } else if (payload?.event === 'onStateChange' && typeof payload?.info === 'number') {
          if (payload.info === 1) {
            iframeStateRef.current = { videoId: vid?.id || null, playing: true };
            if (!propsRef.current.isPlaying) {
              propsRef.current.onEmbedStateChange(true);
            }
          } else if (payload.info === 2) {
            iframeStateRef.current = { videoId: vid?.id || null, playing: false };
            if (propsRef.current.isPlaying) {
              propsRef.current.onEmbedStateChange(false);
            }
          } else if (payload.info === 0) {
            propsRef.current.onNext();
          }
        } else if (
          payload?.event === 'onError' &&
          (payload?.info === 101 || payload?.info === 150 || payload?.info === 153)
        ) {
          propsRef.current.onFallbackStandardHost();
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [useEmbed]);

  return (
    <AnimatePresence>
      {isOpen && currentVideo && (
        <motion.div
          key="floating-inapp-popup"
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className={`fixed right-3 sm:right-5 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-fuchsia-200/80 dark:border-fuchsia-500/35 shadow-2xl shadow-fuchsia-500/15 overflow-hidden text-left transition-[width] duration-200 ${
            compact ? 'w-[min(calc(100vw-1.5rem),296px)]' : 'w-[min(calc(100vw-1.5rem),352px)]'
          }`}
        >
          {/* Top Rainbow Hairline */}
          <div className="h-1 w-full casttube-gradient-bar" />

          {/* Drag Header Bar */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-gradient-to-r from-rose-500/8 via-fuchsia-500/8 to-cyan-500/8 border-b border-slate-200/70 dark:border-slate-800/80 cursor-grab active:cursor-grabbing select-none touch-none"
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripHorizontal className="w-4 h-4 text-fuchsia-500 shrink-0" />
              <span className="text-[11px] font-extrabold tracking-tight bg-gradient-to-r from-rose-600 via-fuchsia-600 to-indigo-600 dark:from-rose-400 dark:via-fuchsia-400 dark:to-cyan-400 bg-clip-text text-transparent truncate">
                Popup Aktif · Geser Bebas
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setCompact((v) => !v)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={compact ? 'Tampilkan Video / Visualizer' : 'Perkecil Tampilan Popup'}
                aria-label={compact ? 'Tampilkan penuh popup' : 'Perkecil popup'}
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onExpand}
                className="p-1.5 rounded-lg text-slate-500 hover:text-fuchsia-600 dark:text-slate-400 dark:hover:text-fuchsia-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Buka Pemutar Penuh"
                aria-label="Buka Pemutar Penuh"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Tutup Popup"
                aria-label="Tutup Popup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Media Stage */}
          <div className="p-3.5 space-y-3">
            {useEmbed && !compact ? (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800 shadow-inner">
                <iframe
                  key={embedKey}
                  ref={iframeRef}
                  src={embedSrc}
                  title={currentVideo.title}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  onLoad={() => {
                    iframeStateRef.current = { videoId: currentVideo.id, playing: isPlaying };
                    try {
                      iframeRef.current?.contentWindow?.postMessage(
                        JSON.stringify({ event: 'listening', id: 1 }),
                        '*'
                      );
                    } catch {
                      // ignore
                    }
                  }}
                  className="w-full h-full border-0"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div
                  onClick={onExpand}
                  className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-900 shrink-0 cursor-pointer ring-2 ring-fuchsia-500/30"
                >
                  <img
                    src={currentVideo.thumbnail}
                    alt={currentVideo.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {!compact && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-center p-1">
                      <span className="text-[9px] font-bold text-white uppercase tracking-wider">
                        {usingNativeAudio ? 'Audio' : 'Video'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                    {currentVideo.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                    <span className="truncate">{currentVideo.channelTitle}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {usingNativeAudio ? 'Latar Aktif' : 'Siap'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Compact Visualizer strip when using native audio */}
            {!compact && usingNativeAudio && (
              <div className="h-12 rounded-2xl bg-gradient-to-r from-rose-500/8 via-fuchsia-500/10 to-cyan-500/10 dark:from-slate-950 dark:via-indigo-950/60 dark:to-slate-950 border border-fuchsia-200/60 dark:border-fuchsia-500/20 overflow-hidden px-1">
                <AudioVisualizer
                  isPlaying={isPlaying}
                  isVisible={isOpen && usingNativeAudio && !compact}
                  style="wave"
                />
              </div>
            )}

            {/* Progress Bar (always shown for native audio or compact embed) */}
            {(usingNativeAudio || compact) && (
              <PopupProgressSection
                videoId={currentVideo.id}
                onSeek={(sec) => {
                  if (useEmbed) {
                    sendEmbedCommand('seekTo', [sec, true]);
                  }
                  onSeek(sec);
                }}
              />
            )}

            {/* Video Title in Embed Mode */}
            {useEmbed && !compact && (
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                  {currentVideo.title}
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="truncate">{currentVideo.channelTitle}</span>
                  <button
                    type="button"
                    onClick={onToggleEmbedHost}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-cyan-400 hover:underline shrink-0 cursor-pointer"
                    title="Ganti server pemutar embed YouTube jika video diblokir"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{embedHost === 'nocookie' ? 'Server Standar' : 'Server Privasi'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Control Row */}
            <div className="flex items-center justify-between gap-1.5 pt-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (useEmbed) {
                      const snap = getPlaybackClockSnapshot();
                      sendEmbedCommand('seekTo', [Math.max(0, snap.currentTime - 15), true]);
                    }
                    onSkipBack(15);
                  }}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-cyan-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Mundur 15 detik"
                  aria-label="Mundur 15 detik"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onPlayPause}
                  className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-fuchsia-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-fuchsia-500/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                  title={isPlaying ? 'Jeda' : 'Putar'}
                  aria-label={isPlaying ? 'Jeda' : 'Putar'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (useEmbed) {
                      const snap = getPlaybackClockSnapshot();
                      const nextT = Math.min(snap.duration || Infinity, snap.currentTime + 30);
                      sendEmbedCommand('seekTo', [nextT, true]);
                    }
                    onSkipForward(30);
                  }}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-cyan-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Maju 30 detik"
                  aria-label="Maju 30 detik"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                {hasNext && (
                  <button
                    type="button"
                    onClick={onNext}
                    className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Episode Berikutnya"
                    aria-label="Episode Berikutnya"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onToggleMode}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-950/60 dark:to-cyan-950/60 text-indigo-700 dark:text-cyan-300 border border-indigo-200/70 dark:border-cyan-500/30 hover:brightness-105 transition-all cursor-pointer"
                title={playerMode === 'audio' ? 'Tampilkan Video' : 'Pindah ke Mode Audio'}
              >
                {playerMode === 'audio' ? (
                  <>
                    <Headphones className="w-3.5 h-3.5 text-fuchsia-500" />
                    <span>Audio</span>
                  </>
                ) : (
                  <>
                    {usingNativeAudio ? (
                      <Radio className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Tv className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span>Video</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
