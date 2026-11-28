import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  Headphones,
  ExternalLink,
  SlidersHorizontal,
  LocateFixed,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { NativeAudioStatus, Video } from '../types';
import { formatTime } from '../utils/format';
import { usePlaybackClock } from '../utils/playbackClock';
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
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const isMobile = vw < 640;
  const defaultWidth = isMobile ? (compact ? 248 : 280) : compact ? 288 : 340;
  const width = el?.offsetWidth || Math.min(vw - 20, defaultWidth);
  const height = el?.offsetHeight || (compact ? 168 : isMobile ? 228 : 254);
  const topSafe = isMobile ? 112 : 76;
  const bottomSafe = 78;
  const minX = -Math.max(0, vw - width - 20);
  const maxX = 4;
  const minY = -Math.max(0, vh - height - topSafe - bottomSafe);
  const maxY = 8;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

interface FloatingInAppPopupProps {
  isOpen: boolean;
  openNonce?: number;
  isOsPipActive?: boolean;
  currentVideo: Video | null;
  isPlaying: boolean;
  usingNativeAudio: boolean;
  nativeAudioStatus?: NativeAudioStatus;
  playbackRate?: number;
  isMuted?: boolean;
  hasPrev?: boolean;
  hasNext: boolean;
  canOpenOsPip?: boolean;
  onOpenOsPip?: () => void;
  onOpenSettings?: () => void;
  onPlayPause: () => void;
  onSkipBack: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
  onSeek: (seconds: number) => void;
  onPrev?: () => void;
  onNext: () => void;
  onCycleSpeed?: () => void;
  onToggleMute?: () => void;
  onExpand: () => void;
  onClose: () => void;
}

const PopupProgressSection: React.FC<{
  videoId: string;
  onSeek: (sec: number) => void;
}> = React.memo(function PopupProgressSection({ videoId, onSeek }) {
  const clock = usePlaybackClock();
  const currentTime = clock.videoId === videoId ? clock.currentTime : 0;
  const duration = clock.videoId === videoId ? clock.duration : 0;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const scrubTimeRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    scrubTimeRef.current = null;
    activePointerIdRef.current = null;
    setScrubTime(null);
  }, [videoId]);

  const computeTimeAtClientX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const displayedTime = scrubTime !== null ? scrubTime : currentTime;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (displayedTime / duration) * 100)) : 0;
  const isScrubbing = scrubTime !== null;

  return (
    <div className="space-y-0.5 select-none" data-no-drag="true">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Posisi pemutaran audio"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration || 0)}
        aria-valuenow={Math.round(displayedTime)}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (duration <= 0) return;
          activePointerIdRef.current = e.pointerId;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          const nextSec = computeTimeAtClientX(e.clientX);
          scrubTimeRef.current = nextSec;
          setScrubTime(nextSec);
        }}
        onPointerMove={(e) => {
          if (activePointerIdRef.current !== e.pointerId) return;
          const nextSec = computeTimeAtClientX(e.clientX);
          scrubTimeRef.current = nextSec;
          setScrubTime(nextSec);
        }}
        onPointerUp={(e) => {
          if (activePointerIdRef.current !== e.pointerId) return;
          activePointerIdRef.current = null;
          const commitTime = computeTimeAtClientX(e.clientX);
          scrubTimeRef.current = null;
          setScrubTime(null);
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          onSeek(commitTime);
        }}
        onPointerCancel={() => {
          activePointerIdRef.current = null;
          scrubTimeRef.current = null;
          setScrubTime(null);
        }}
        onKeyDown={(e) => {
          if (duration <= 0) return;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSeek(Math.max(0, currentTime - 10));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSeek(Math.min(duration, currentTime + 10));
          }
        }}
        className="group w-full h-7 flex items-center cursor-pointer touch-none relative"
        title="Geser atau ketuk untuk melompat posisi audio"
      >
        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
          <div
            className={`h-full rounded-full casttube-gradient-bar ${
              isScrubbing ? 'transition-none brightness-110' : 'transition-[width] duration-150 group-hover:brightness-110'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {duration > 0 && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-100 shadow-md ring-2 ring-[var(--ct-mid)] pointer-events-none transition-transform duration-100 ${
              isScrubbing ? 'scale-110 opacity-100' : 'scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100'
            }`}
            style={{ left: `${pct}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
        <span className={isScrubbing ? 'font-bold casttube-accent-text' : ''}>
          {formatTime(displayedTime)}
        </span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
});

export const FloatingInAppPopup: React.FC<FloatingInAppPopupProps> = React.memo(({
  isOpen,
  openNonce = 0,
  isOsPipActive = false,
  currentVideo,
  isPlaying,
  usingNativeAudio,
  nativeAudioStatus = 'checking',
  playbackRate = 1,
  isMuted = false,
  hasPrev = false,
  hasNext,
  canOpenOsPip = false,
  onOpenOsPip,
  onOpenSettings,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onSeek,
  onPrev,
  onNext,
  onCycleSpeed,
  onToggleMute,
  onExpand,
  onClose,
}) => {
  const [compact, setCompact] = useState<boolean>(readSavedCompact);
  const [touchCloseState, setTouchCloseState] = useState<'idle' | 'pressing' | 'closed'>('idle');
  const initialPos = useRef<SavedPopupPos>(readSavedPopupPos());
  const dragX = useMotionValue(initialPos.current.x);
  const dragY = useMotionValue(initialPos.current.y);
  const [isDisplaced, setIsDisplaced] = useState(
    () => Math.abs(initialPos.current.x) > 8 || Math.abs(initialPos.current.y) > 8
  );

  const dragControls = useDragControls();
  const viewportBoundsRef = useRef<HTMLDivElement | null>(null);
  const popupContainerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const touchCloseSessionRef = useRef<{
    action: 'close';
    identifier: number | null;
    startX: number;
    startY: number;
  } | null>(null);
  const closeHandledAtRef = useRef<number>(0);

  // Reset internal touch-close state synchronously before paint whenever popup opens/closes/re-triggers
  useLayoutEffect(() => {
    setTouchCloseState('idle');
    touchCloseSessionRef.current = null;
  }, [isOpen, openNonce, currentVideo?.id]);

  const triggerCloseAction = useCallback(() => {
    const now = Date.now();
    if (now - closeHandledAtRef.current < 450) {
      return;
    }
    closeHandledAtRef.current = now;
    touchCloseSessionRef.current = null;
    setTouchCloseState('closed');
    onClose();
  }, [onClose]);

  const beginCloseTouchSession = useCallback(
    (touch: { identifier?: number; clientX?: number; clientY?: number } | undefined) => {
      touchCloseSessionRef.current = {
        action: 'close',
        identifier: typeof touch?.identifier === 'number' ? touch.identifier : null,
        startX: typeof touch?.clientX === 'number' ? touch.clientX : 0,
        startY: typeof touch?.clientY === 'number' ? touch.clientY : 0,
      };
      setTouchCloseState('pressing');
    },
    []
  );

  const resolveCloseTouchEnd = useCallback(
    (
      changedTouches: {
        length: number;
        [index: number]: { identifier?: number; clientX?: number; clientY?: number } | undefined;
      } | null
    ): boolean => {
      const session = touchCloseSessionRef.current;
      if (!session || session.action !== 'close') return false;

      let matchedTouch: { identifier?: number; clientX?: number; clientY?: number } | undefined;
      if (changedTouches && changedTouches.length > 0) {
        if (session.identifier !== null) {
          for (let i = 0; i < changedTouches.length; i++) {
            if (changedTouches[i]?.identifier === session.identifier) {
              matchedTouch = changedTouches[i];
              break;
            }
          }
        }
        if (!matchedTouch) {
          matchedTouch = changedTouches[0];
        }
      }

      const endX = typeof matchedTouch?.clientX === 'number' ? matchedTouch.clientX : session.startX;
      const endY = typeof matchedTouch?.clientY === 'number' ? matchedTouch.clientY : session.startY;
      const dist = Math.hypot(endX - session.startX, endY - session.startY);

      const btnRect = closeButtonRef.current?.getBoundingClientRect();
      const insideExpandedBtn =
        Boolean(btnRect) &&
        endX >= (btnRect?.left ?? 0) - 12 &&
        endX <= (btnRect?.right ?? 0) + 12 &&
        endY >= (btnRect?.top ?? 0) - 12 &&
        endY <= (btnRect?.bottom ?? 0) + 12;

      touchCloseSessionRef.current = null;
      if (dist <= 28 || insideExpandedBtn) {
        triggerCloseAction();
        return true;
      }
      setTouchCloseState('idle');
      return false;
    },
    [triggerCloseAction]
  );

  // Attach native non-passive touchstart/touchend listeners on the popup container
  // so mobile browsers never swallow or delay the close action during touch-to-click transitions.
  useEffect(() => {
    const hasVideo = Boolean(currentVideo);
    const popupEl = popupContainerRef.current;
    const closeBtn = closeButtonRef.current;
    if (!isOpen || !hasVideo || !popupEl) return;

    const handleNativeTouchStart = (ev: TouchEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target?.closest('[data-close-action="true"]') || (closeBtn && closeBtn.contains(target))) {
        beginCloseTouchSession(ev.changedTouches[0] || ev.touches[0]);
      }
    };

    const handleNativeTouchEnd = (ev: TouchEvent) => {
      const target = ev.target as HTMLElement | null;
      const targetedCloseBtn = Boolean(
        target?.closest('[data-close-action="true"]') || (closeBtn && closeBtn.contains(target))
      );
      if (touchCloseSessionRef.current?.action === 'close' || targetedCloseBtn) {
        if (!touchCloseSessionRef.current) {
          beginCloseTouchSession(ev.changedTouches[0]);
        }
        const closed = resolveCloseTouchEnd(ev.changedTouches);
        if (closed && ev.cancelable) {
          ev.preventDefault();
        }
      }
    };

    const handleNativeTouchCancel = () => {
      if (touchCloseSessionRef.current) {
        touchCloseSessionRef.current = null;
        setTouchCloseState('idle');
      }
    };

    popupEl.addEventListener('touchstart', handleNativeTouchStart, { passive: true });
    popupEl.addEventListener('touchend', handleNativeTouchEnd, { passive: false });
    popupEl.addEventListener('touchcancel', handleNativeTouchCancel, { passive: true });

    return () => {
      popupEl.removeEventListener('touchstart', handleNativeTouchStart);
      popupEl.removeEventListener('touchend', handleNativeTouchEnd);
      popupEl.removeEventListener('touchcancel', handleNativeTouchCancel);
    };
  }, [isOpen, currentVideo, beginCloseTouchSession, resolveCloseTouchEnd]);

  // Persist compact preference
  useEffect(() => {
    try {
      localStorage.setItem(POPUP_COMPACT_KEY, compact ? '1' : '0');
    } catch {
      // ignore
    }
  }, [compact]);

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
    const frame = requestAnimationFrame(() => clampCurrentPosition(false));
    const onResize = () => clampCurrentPosition(true);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, [isOpen, compact, clampCurrentPosition]);

  const handleResetPosition = () => {
    animate(dragX, 0, { type: 'spring', stiffness: 420, damping: 32 });
    animate(dragY, 0, { type: 'spring', stiffness: 420, damping: 32 });
    setIsDisplaced(false);
    savePopupPos({ x: 0, y: 0 });
  };

  const audioStatusLabel = usingNativeAudio
    ? 'Audio Latar Aktif'
    : nativeAudioStatus === 'checking'
    ? 'Menghubungkan Audio...'
    : nativeAudioStatus === 'live_stream'
    ? 'Siaran Langsung · Audio'
    : 'Audio Popup Aktif';

  return (
    <>
      <div
        ref={viewportBoundsRef}
        className="fixed top-2 left-2 right-2 bottom-[calc(4.9rem+env(safe-area-inset-bottom))] pointer-events-none z-[45]"
        aria-hidden="true"
      />
      <AnimatePresence>
        {isOpen && touchCloseState !== 'closed' && currentVideo && (
          <motion.div
            ref={popupContainerRef}
            key="floating-inapp-popup"
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragConstraints={viewportBoundsRef}
            dragElastic={0.05}
            onPointerDown={(e) => {
              const target = e.target as HTMLElement | null;
              if (target?.closest('button, a, input, [data-no-drag="true"]')) return;
              dragControls.start(e);
            }}
            onTouchStart={(e) => {
              const target = e.target as HTMLElement | null;
              if (target?.closest('[data-close-action="true"]')) {
                beginCloseTouchSession(e.changedTouches[0] || e.touches[0]);
              }
            }}
            onTouchEnd={(e) => {
              if (touchCloseSessionRef.current?.action === 'close') {
                resolveCloseTouchEnd(e.changedTouches);
              }
            }}
            onTouchCancel={() => {
              if (touchCloseSessionRef.current) {
                touchCloseSessionRef.current = null;
                setTouchCloseState('idle');
              }
            }}
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
            animate={{ opacity: isOsPipActive ? 0 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={`fixed right-2.5 sm:right-5 bottom-[calc(5.1rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[45] rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border casttube-accent-border shadow-2xl overflow-hidden text-left transition-[width] duration-200 touch-none ${
              isOsPipActive ? 'pointer-events-none' : ''
            } ${
              compact
                ? 'w-[min(calc(100vw-1.25rem),248px)] sm:w-[288px]'
                : 'w-[min(calc(100vw-1.25rem),284px)] sm:w-[340px]'
            }`}
          >
            {/* Top Rainbow Hairline */}
            <div className="h-1 w-full casttube-gradient-bar" />

            {/* Drag Header Bar */}
            <div
              onDoubleClick={handleResetPosition}
              className="flex items-center justify-between gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 casttube-soft-surface border-b border-slate-200/70 dark:border-slate-800/80 cursor-grab active:cursor-grabbing select-none touch-none"
              title="Geser bebas · Ketuk dua kali untuk kembalikan posisi"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <GripHorizontal className="w-4 h-4 casttube-accent-icon shrink-0" />
                <span className="text-[11px] font-extrabold tracking-tight casttube-gradient-text truncate">
                  {compact ? 'Audio Mini' : 'Audio Popup'}
                </span>
              </div>

              <div
                data-no-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center gap-0.5 shrink-0"
              >
                {isDisplaced && (
                  <button
                    type="button"
                    onClick={handleResetPosition}
                    className="min-w-[34px] min-h-[34px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center rounded-lg text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
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
                    className="min-w-[34px] min-h-[34px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center rounded-lg text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                    title="Lepas ke Jendela Audio Mengambang OS"
                    aria-label="Lepas ke Jendela Audio Mengambang OS"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="min-w-[34px] min-h-[34px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[var(--ct-text-light)] dark:text-slate-400 dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                    title="Setelan Popup Audio"
                    aria-label="Setelan Popup Audio"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCompact((v) => !v)}
                  className="min-w-[34px] min-h-[34px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[var(--ct-end-light)] dark:text-slate-400 dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                  title={compact ? 'Tampilkan Visualizer Audio' : 'Perkecil Popup Audio'}
                  aria-label={compact ? 'Perluas popup audio' : 'Perkecil popup audio'}
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onExpand}
                  className="min-w-[34px] min-h-[34px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[var(--ct-text-light)] dark:text-slate-400 dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                  title="Buka Pemutar Penuh"
                  aria-label="Buka Pemutar Penuh"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  ref={closeButtonRef}
                  type="button"
                  data-close-action="true"
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    beginCloseTouchSession(e.changedTouches[0] || e.touches[0]);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    if (!touchCloseSessionRef.current) {
                      beginCloseTouchSession(e.changedTouches[0]);
                    }
                    resolveCloseTouchEnd(e.changedTouches);
                  }}
                  onTouchCancel={(e) => {
                    e.stopPropagation();
                    touchCloseSessionRef.current = null;
                    setTouchCloseState('idle');
                  }}
                  onClick={triggerCloseAction}
                  className={`min-w-[34px] min-h-[34px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center rounded-lg transition-colors cursor-pointer touch-manipulation ${
                    touchCloseState === 'pressing'
                      ? 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 scale-95'
                      : 'text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  }`}
                  title={isPlaying ? 'Tutup Popup (Audio Tetap Jalan)' : 'Tutup Popup'}
                  aria-label="Tutup Popup"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Pure Audio-Only Stage */}
            <div className="p-2.5 sm:p-3.5 space-y-2 sm:space-y-2.5">
              <div className="flex items-center gap-3">
                <div
                  data-no-drag="true"
                  onClick={onExpand}
                  className={`relative rounded-2xl overflow-hidden bg-slate-900 shrink-0 cursor-pointer ring-2 ring-[var(--ct-border-light)] dark:ring-[var(--ct-border-dark)] ${
                    compact ? 'w-11 h-11' : 'w-14 h-14'
                  }`}
                  title="Buka Pemutar Penuh"
                >
                  <img
                    src={currentVideo.thumbnail}
                    alt={currentVideo.title}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                      <span className="flex items-end gap-0.5 h-4" aria-hidden="true">
                        <span
                          className="w-0.5 h-full rounded-full ct-eq-bar"
                          style={{ backgroundColor: 'var(--ct-glow)', animationDuration: '0.85s' }}
                        />
                        <span
                          className="w-0.5 h-full rounded-full ct-eq-bar"
                          style={{
                            backgroundColor: 'var(--ct-mid)',
                            animationDuration: '0.7s',
                            animationDelay: '0.15s',
                          }}
                        />
                        <span
                          className="w-0.5 h-full rounded-full ct-eq-bar"
                          style={{
                            backgroundColor: 'var(--ct-start)',
                            animationDuration: '1s',
                            animationDelay: '0.3s',
                          }}
                        />
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
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                      {audioStatusLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Compact Visualizer strip (paused cleanly in compact/background) */}
              {!compact && (
                <div className="h-11 rounded-2xl casttube-soft-surface border casttube-accent-border overflow-hidden px-1">
                  <AudioVisualizer
                    isPlaying={isPlaying}
                    isVisible={isOpen && !compact}
                    playbackRate={playbackRate}
                    style="wave"
                  />
                </div>
              )}

              {/* Seekable Audio Progress Bar */}
              <PopupProgressSection videoId={currentVideo.id} onSeek={onSeek} />

              {/* Bottom Audio Control Row */}
              <div
                data-no-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center justify-between gap-1 pt-0.5"
              >
                <div className="flex items-center gap-0.5">
                  {hasPrev && onPrev && (
                    <button
                      type="button"
                      onClick={onPrev}
                      className="min-w-[36px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                      title="Sebelumnya / Ulangi"
                      aria-label="Sebelumnya"
                    >
                      <SkipBack className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onSkipBack(15)}
                    className="min-w-[36px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-end-light)] dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                    title="Mundur 15 detik"
                    aria-label="Mundur 15 detik"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={onPlayPause}
                    className="w-10 h-10 sm:w-9 sm:h-9 mx-0.5 rounded-xl casttube-gradient-btn flex items-center justify-center hover:brightness-110 active:scale-95 transition-all cursor-pointer touch-manipulation"
                    title={isPlaying ? 'Jeda' : 'Putar'}
                    aria-label={isPlaying ? 'Jeda' : 'Putar'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSkipForward(30)}
                    className="min-w-[36px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-end-light)] dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                    title="Maju 30 detik"
                    aria-label="Maju 30 detik"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {hasNext && (
                    <button
                      type="button"
                      onClick={onNext}
                      className="min-w-[36px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                      title="Episode Berikutnya"
                      aria-label="Episode Berikutnya"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {onToggleMute && (
                    <button
                      type="button"
                      onClick={onToggleMute}
                      className="min-w-[34px] min-h-[34px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] transition-colors cursor-pointer touch-manipulation"
                      title={isMuted ? 'Nyalakan Suara' : 'Bisukan Audio'}
                      aria-label={isMuted ? 'Nyalakan Suara' : 'Bisukan Audio'}
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {onCycleSpeed && (
                    <button
                      type="button"
                      onClick={onCycleSpeed}
                      className="min-h-[34px] sm:min-h-[30px] px-2.5 sm:px-2 py-1 rounded-xl text-[10px] font-extrabold font-mono tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] transition-colors cursor-pointer touch-manipulation"
                      title="Ubah kecepatan putar"
                      aria-label={`Kecepatan ${playbackRate}x`}
                    >
                      {playbackRate}x
                    </button>
                  )}

                  <span
                    className="hidden sm:inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold casttube-soft-surface casttube-accent-secondary-text border"
                    title="Mode Popup Khusus Audio"
                  >
                    <Headphones className="w-3 h-3 casttube-accent-icon" />
                    <span>Audio</span>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
