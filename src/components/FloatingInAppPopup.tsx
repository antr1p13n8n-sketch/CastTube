import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useDragControls,
  useMotionValue,
  animate,
} from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Maximize2,
  X,
  Minimize2,
  GripHorizontal,
  Radio,
  Tv,
  Headphones,
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
  AlertCircle,
  LocateFixed,
} from 'lucide-react';
import { PlayerMode, Video } from '../types';
import { formatTime } from '../utils/format';
import {
  getPlaybackClockSnapshot,
  setPlaybackClock,
  usePlaybackClock,
} from '../utils/playbackClock';
import { AudioVisualizer } from './AudioVisualizer';

const POPUP_COMPACT_KEY = 'casttube_popup_compact_v1';
const POPUP_POS_KEY = 'casttube_popup_pos_v1';

interface SavedPopupPos {
  x: number;
  y: number;
}

function readSavedCompact(): boolean {
  try {
    return localStorage.getItem(POPUP_COMPACT_KEY) === '1';
  } catch {
    return false;
  }
}

function readSavedPopupPos(): SavedPopupPos {
  try {
    const raw = localStorage.getItem(POPUP_POS_KEY);
    if (!raw) return { x: 0, y: 0 };
    const parsed = JSON.parse(raw) as Partial<SavedPopupPos>;
    if (
      typeof parsed.x === 'number' &&
      Number.isFinite(parsed.x) &&
      typeof parsed.y === 'number' &&
      Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // ignore storage errors
  }
  return { x: 0, y: 0 };
}

function savePopupPos(pos: SavedPopupPos) {
  try {
    if (Math.abs(pos.x) < 2 && Math.abs(pos.y) < 2) {
      localStorage.removeItem(POPUP_POS_KEY);
    } else {
      localStorage.setItem(
        POPUP_POS_KEY,
        JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y) })
      );
    }
  } catch {
    // ignore storage errors
  }
}

function clampPopupOffset(
  x: number,
  y: number,
  compact: boolean,
  el: HTMLElement | null
): SavedPopupPos {
  if (typeof window === 'undefined') return { x, y };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = el?.offsetWidth || (compact ? 296 : 352);
  const height = el?.offsetHeight || (compact ? 190 : 360);
  // Popup default anchor is bottom-right (~right: 16px, bottom: 92px)
  const minX = -Math.max(0, vw - width - 20);
  const maxX = 8;
  const minY = -Math.max(0, vh - height - 104);
  const maxY = 56;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

interface FloatingInAppPopupProps {
  isOpen: boolean;
  currentVideo: Video | null;
  isPlaying: boolean;
  playerMode: PlayerMode;
  usingNativeAudio: boolean;
  playbackRate?: number;
  volume?: number;
  isMuted?: boolean;
  seekCommand?: number | null;
  onSeekHandled?: () => void;
  hasPrev?: boolean;
  hasNext: boolean;
  embedHost: 'nocookie' | 'standard';
  canOpenOsPip?: boolean;
  onOpenOsPip?: () => void;
  onOpenSettings?: () => void;
  onOpenExtractorAuth?: () => void;
  onToggleEmbedHost: () => void;
  onFallbackStandardHost: () => void;
  onPlayPause: () => void;
  onSkipBack: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
  onSeek: (seconds: number) => void;
  onPrev?: () => void;
  onNext: () => void;
  onCycleSpeed?: () => void;
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
        className="group w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden cursor-pointer relative"
        title="Ketuk atau geser untuk melompat posisi"
      >
        <div
          className="h-full rounded-full casttube-gradient-bar transition-[width] duration-150 group-hover:brightness-110"
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
  playbackRate = 1,
  volume = 85,
  isMuted = false,
  seekCommand = null,
  onSeekHandled,
  hasPrev = false,
  hasNext,
  embedHost,
  canOpenOsPip = false,
  onOpenOsPip,
  onOpenSettings,
  onOpenExtractorAuth,
  onToggleEmbedHost,
  onFallbackStandardHost,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onSeek,
  onPrev,
  onNext,
  onCycleSpeed,
  onToggleMode,
  onExpand,
  onClose,
  onEmbedStateChange,
}) => {
  const [compact, setCompact] = useState<boolean>(readSavedCompact);
  const [embedErrorCode, setEmbedErrorCode] = useState<number | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const initialPos = useRef<SavedPopupPos>(readSavedPopupPos());
  const dragX = useMotionValue(initialPos.current.x);
  const dragY = useMotionValue(initialPos.current.y);
  const [isDisplaced, setIsDisplaced] = useState(
    () => Math.abs(initialPos.current.x) > 8 || Math.abs(initialPos.current.y) > 8
  );

  const dragControls = useDragControls();
  const viewportBoundsRef = useRef<HTMLDivElement | null>(null);
  const popupContainerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const handshakeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const embedReadyRef = useRef(false);
  const suppressSeekEchoRef = useRef<number | null>(null);
  const iframeStateRef = useRef<{ videoId: string | null; playing: boolean | null }>({
    videoId: null,
    playing: null,
  });

  const propsRef = useRef({
    currentVideo,
    isPlaying,
    playbackRate,
    volume,
    isMuted,
    embedHost,
    onNext,
    onEmbedStateChange,
    onFallbackStandardHost,
  });
  propsRef.current = {
    currentVideo,
    isPlaying,
    playbackRate,
    volume,
    isMuted,
    embedHost,
    onNext,
    onEmbedStateChange,
    onFallbackStandardHost,
  };

  const useEmbed = Boolean(isOpen && currentVideo && !usingNativeAudio);
  const initialEmbedPlayRef = useRef(isPlaying);
  initialEmbedPlayRef.current = isPlaying;

  // Persist compact preference
  useEffect(() => {
    try {
      localStorage.setItem(POPUP_COMPACT_KEY, compact ? '1' : '0');
    } catch {
      // ignore
    }
  }, [compact]);

  // Clamp saved position on open / compact change / window resize
  const clampCurrentPosition = useCallback(
    (persist = true) => {
      const clamped = clampPopupOffset(
        dragX.get(),
        dragY.get(),
        compact,
        popupContainerRef.current
      );
      dragX.set(clamped.x);
      dragY.set(clamped.y);
      setIsDisplaced(Math.abs(clamped.x) > 8 || Math.abs(clamped.y) > 8);
      if (persist) savePopupPos(clamped);
    },
    [compact, dragX, dragY]
  );

  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => clampCurrentPosition(false));
    const handleResize = () => clampCurrentPosition(true);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isOpen, clampCurrentPosition]);

  const handleResetPosition = useCallback(() => {
    animate(dragX, 0, { type: 'spring', stiffness: 420, damping: 32 });
    animate(dragY, 0, { type: 'spring', stiffness: 420, damping: 32 });
    setIsDisplaced(false);
    savePopupPos({ x: 0, y: 0 });
  }, [dragX, dragY]);

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
  }, [useEmbed, currentVideo?.id, embedHost, reloadNonce]);

  const embedKey = currentVideo ? `${currentVideo.id}::${embedHost}::${reloadNonce}` : '';

  const clearHandshakeTimer = useCallback(() => {
    if (handshakeTimerRef.current) {
      clearInterval(handshakeTimerRef.current);
      handshakeTimerRef.current = null;
    }
  }, []);

  const sendEmbedCommand = useCallback((func: string, args: unknown[] = []) => {
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
  }, []);

  const sendListeningHandshake = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1 }),
        '*'
      );
    } catch {
      // ignore postMessage restrictions
    }
  }, []);

  const startHandshakeRetries = useCallback(() => {
    clearHandshakeTimer();
    embedReadyRef.current = false;
    sendListeningHandshake();
    let attempts = 0;
    handshakeTimerRef.current = setInterval(() => {
      attempts += 1;
      if (embedReadyRef.current || attempts >= 16) {
        clearHandshakeTimer();
        return;
      }
      sendListeningHandshake();
    }, 350);
  }, [clearHandshakeTimer, sendListeningHandshake]);

  useEffect(() => {
    setEmbedErrorCode(null);
    embedReadyRef.current = false;
    return () => clearHandshakeTimer();
  }, [currentVideo?.id, embedHost, useEmbed, reloadNonce, clearHandshakeTimer]);

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
  }, [useEmbed, currentVideo?.id, isPlaying, sendEmbedCommand]);

  // Sync playbackRate reactively into the popup iframe
  useEffect(() => {
    if (!useEmbed || !embedReadyRef.current) return;
    sendEmbedCommand('setPlaybackRate', [playbackRate]);
  }, [useEmbed, playbackRate, sendEmbedCommand]);

  // Sync mute & volume reactively into the popup iframe
  useEffect(() => {
    if (!useEmbed || !embedReadyRef.current) return;
    sendEmbedCommand(isMuted ? 'mute' : 'unMute');
    if (!isMuted) {
      sendEmbedCommand('setVolume', [Math.min(100, Math.max(0, Math.round(volume)))]);
    }
  }, [useEmbed, volume, isMuted, sendEmbedCommand]);

  // Handle external seekCommand (e.g. MediaSession / keyboard shortcut / main bar seek)
  useEffect(() => {
    if (seekCommand === null) return;
    if (!useEmbed) return;
    const echoed =
      suppressSeekEchoRef.current !== null &&
      Math.abs(suppressSeekEchoRef.current - seekCommand) < 0.25;
    suppressSeekEchoRef.current = null;
    if (!echoed) {
      sendEmbedCommand('seekTo', [seekCommand, true]);
    }
    onSeekHandled?.();
  }, [seekCommand, useEmbed, sendEmbedCommand, onSeekHandled]);

  // Listen to YouTube postMessage events from popup embed
  useEffect(() => {
    if (!useEmbed) return;
    const applyInitialSettingsToEmbed = () => {
      const p = propsRef.current;
      sendEmbedCommand('setPlaybackRate', [p.playbackRate]);
      sendEmbedCommand(p.isMuted ? 'mute' : 'unMute');
      if (!p.isMuted) {
        sendEmbedCommand('setVolume', [Math.min(100, Math.max(0, Math.round(p.volume)))]);
      }
    };

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

        if (payload?.event === 'onReady') {
          if (!embedReadyRef.current) {
            embedReadyRef.current = true;
            clearHandshakeTimer();
            applyInitialSettingsToEmbed();
            if (propsRef.current.isPlaying) {
              sendEmbedCommand('playVideo');
            }
          }
          return;
        }

        if (payload?.event === 'infoDelivery' && payload?.info) {
          if (!embedReadyRef.current) {
            embedReadyRef.current = true;
            clearHandshakeTimer();
            applyInitialSettingsToEmbed();
          }
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
        } else if (payload?.event === 'onError' && typeof payload?.info === 'number') {
          const code = payload.info;
          if (
            propsRef.current.embedHost === 'nocookie' &&
            (code === 101 || code === 150 || code === 153)
          ) {
            propsRef.current.onFallbackStandardHost();
          } else if (code === 100 || code === 101 || code === 150 || code === 153 || code === 2) {
            setEmbedErrorCode(code);
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [useEmbed, clearHandshakeTimer, sendEmbedCommand]);

  const directSeekAndNotify = (targetSec: number) => {
    if (useEmbed) {
      suppressSeekEchoRef.current = targetSec;
      sendEmbedCommand('seekTo', [targetSec, true]);
    }
    onSeek(targetSec);
  };

  return (
    <>
      <div
        ref={viewportBoundsRef}
        className="fixed inset-2 pointer-events-none z-40"
        aria-hidden="true"
      />
      <AnimatePresence>
        {isOpen && currentVideo && (
          <motion.div
            ref={popupContainerRef}
            key="floating-inapp-popup"
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragConstraints={viewportBoundsRef}
            dragElastic={0.05}
            onDragEnd={() => {
              const clamped = clampPopupOffset(
                dragX.get(),
                dragY.get(),
                compact,
                popupContainerRef.current
              );
              dragX.set(clamped.x);
              dragY.set(clamped.y);
              setIsDisplaced(Math.abs(clamped.x) > 8 || Math.abs(clamped.y) > 8);
              savePopupPos(clamped);
            }}
            style={{ x: dragX, y: dragY }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={`fixed right-3 sm:right-5 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border casttube-accent-border shadow-2xl overflow-hidden text-left transition-[width] duration-200 ${
              compact ? 'w-[min(calc(100vw-1.5rem),296px)]' : 'w-[min(calc(100vw-1.5rem),352px)]'
            }`}
          >
            {/* Top Rainbow Hairline */}
            <div className="h-1 w-full casttube-gradient-bar" />

            {/* Drag Header Bar */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              onDoubleClick={handleResetPosition}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 casttube-soft-surface border-b border-slate-200/70 dark:border-slate-800/80 cursor-grab active:cursor-grabbing select-none touch-none"
              title="Geser bebas · Ketuk dua kali untuk kembalikan posisi"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripHorizontal className="w-4 h-4 casttube-accent-icon shrink-0" />
                <span className="text-[11px] font-extrabold tracking-tight casttube-gradient-text truncate">
                  Popup Aktif · Geser Bebas
                </span>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                {isDisplaced && (
                  <button
                    type="button"
                    onClick={handleResetPosition}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Kembalikan Posisi Awal Popup"
                    aria-label="Kembalikan Posisi Awal Popup"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                  </button>
                )}
                {canOpenOsPip && onOpenOsPip && (
                  <button
                    type="button"
                    onClick={onOpenOsPip}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Lepas ke Jendela OS Mengambang (PiP)"
                    aria-label="Lepas ke Jendela OS Mengambang"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--ct-text-light)] dark:text-slate-400 dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Setelan Popup & Cookie Otomatis"
                    aria-label="Setelan Popup"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCompact((v) => !v)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--ct-end-light)] dark:text-slate-400 dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={compact ? 'Tampilkan Video / Visualizer' : 'Perkecil Tampilan Popup'}
                  aria-label={compact ? 'Tampilkan penuh popup' : 'Perkecil popup'}
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onExpand}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--ct-text-light)] dark:text-slate-400 dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
            <div className="p-3.5 space-y-2.5">
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
                      startHandshakeRetries();
                    }}
                    className="w-full h-full border-0"
                  />

                  {embedErrorCode !== null && (
                    <div className="absolute inset-0 bg-slate-950/92 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center gap-2.5">
                      <AlertCircle className="w-6 h-6 text-amber-400" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white">
                          Video embed dibatasi (Kode {embedErrorCode})
                        </p>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Coba muat ulang, pindah ke Mode Audio Latar, atau buka langsung di YouTube.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEmbedErrorCode(null);
                            setReloadNonce((n) => n + 1);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Coba Ulang
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (playerMode !== 'audio') {
                              onToggleMode();
                            } else if (onOpenExtractorAuth) {
                              onOpenExtractorAuth();
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-xl casttube-gradient-btn text-[11px] font-bold hover:brightness-110 transition-all cursor-pointer"
                        >
                          Audio Latar
                        </button>
                        <a
                          href={`https://www.youtube.com/watch?v=${encodeURIComponent(currentVideo.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-[11px] font-bold transition-colors"
                        >
                          Buka YouTube
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    onClick={onExpand}
                    className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-900 shrink-0 cursor-pointer ring-2 ring-[var(--ct-border-light)] dark:ring-[var(--ct-border-dark)]"
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
                        {usingNativeAudio ? 'Latar Aktif' : 'Popup Aktif'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Compact mode still keeps a hidden iframe mounted when using embed so audio continues smoothly */}
              {useEmbed && compact && (
                <iframe
                  key={embedKey}
                  ref={iframeRef}
                  src={embedSrc}
                  title={currentVideo.title}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={() => {
                    iframeStateRef.current = { videoId: currentVideo.id, playing: isPlaying };
                    startHandshakeRetries();
                  }}
                  className="sr-only w-px h-px opacity-0 pointer-events-none"
                />
              )}

              {/* Compact Visualizer strip when using native audio */}
              {!compact && usingNativeAudio && (
                <div className="h-12 rounded-2xl casttube-soft-surface border casttube-accent-border overflow-hidden px-1">
                  <AudioVisualizer
                    isPlaying={isPlaying}
                    isVisible={isOpen && usingNativeAudio && !compact}
                    style="wave"
                  />
                </div>
              )}

              {/* Video Title in Expanded Embed Mode */}
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
                      className="inline-flex items-center gap-1 text-[10px] font-semibold casttube-accent-secondary-text hover:underline shrink-0 cursor-pointer"
                      title="Ganti server pemutar embed YouTube jika video diblokir"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{embedHost === 'nocookie' ? 'Server Standar' : 'Server Privasi'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Always-available Seekable Progress Bar */}
              <PopupProgressSection
                videoId={currentVideo.id}
                onSeek={directSeekAndNotify}
              />

              {/* Bottom Control Row */}
              <div className="flex items-center justify-between gap-1 pt-0.5">
                <div className="flex items-center gap-0.5">
                  {hasPrev && onPrev && (
                    <button
                      type="button"
                      onClick={onPrev}
                      className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Sebelumnya / Ulangi"
                      aria-label="Sebelumnya"
                    >
                      <SkipBack className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const snap = getPlaybackClockSnapshot();
                      const target = Math.max(0, snap.currentTime - 15);
                      if (useEmbed) {
                        suppressSeekEchoRef.current = target;
                        sendEmbedCommand('seekTo', [target, true]);
                      }
                      onSkipBack(15);
                    }}
                    className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-end-light)] dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Mundur 15 detik"
                    aria-label="Mundur 15 detik"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={onPlayPause}
                    className="w-9 h-9 mx-0.5 rounded-xl casttube-gradient-btn flex items-center justify-center hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    title={isPlaying ? 'Jeda' : 'Putar'}
                    aria-label={isPlaying ? 'Jeda' : 'Putar'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const snap = getPlaybackClockSnapshot();
                      const nextT = Math.min(snap.duration || Infinity, snap.currentTime + 30);
                      if (useEmbed) {
                        suppressSeekEchoRef.current = nextT;
                        sendEmbedCommand('seekTo', [nextT, true]);
                      }
                      onSkipForward(30);
                    }}
                    className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-end-light)] dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Maju 30 detik"
                    aria-label="Maju 30 detik"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {hasNext && (
                    <button
                      type="button"
                      onClick={onNext}
                      className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Episode Berikutnya"
                      aria-label="Episode Berikutnya"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {onCycleSpeed && (
                    <button
                      type="button"
                      onClick={onCycleSpeed}
                      className="px-2 py-1.5 rounded-xl text-[10px] font-extrabold font-mono tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] transition-colors cursor-pointer"
                      title="Ubah kecepatan putar"
                      aria-label={`Kecepatan ${playbackRate}x`}
                    >
                      {playbackRate}x
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onToggleMode}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold casttube-soft-surface casttube-accent-secondary-text border hover:brightness-105 transition-all cursor-pointer"
                    title={playerMode === 'audio' ? 'Tampilkan Video' : 'Pindah ke Mode Audio'}
                  >
                    {playerMode === 'audio' ? (
                      <>
                        <Headphones className="w-3.5 h-3.5 casttube-accent-icon" />
                        <span>Audio</span>
                      </>
                    ) : (
                      <>
                        {usingNativeAudio ? (
                          <Radio className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Tv className="w-3.5 h-3.5 casttube-accent-icon" />
                        )}
                        <span>Video</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
