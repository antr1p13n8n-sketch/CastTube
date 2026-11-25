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
import { NativeAudioStatus, PlayerMode, Video } from '../types';
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
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const isMobile = vw < 640;
  const defaultWidth = isMobile ? (compact ? 256 : 288) : compact ? 296 : 352;
  const width = el?.offsetWidth || Math.min(vw - 20, defaultWidth);
  const height = el?.offsetHeight || (compact ? 176 : isMobile ? 295 : 355);
  // Reserve top space for sticky Header and bottom space for MiniPlayerBar
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
  isOsPipActive?: boolean;
  currentVideo: Video | null;
  isPlaying: boolean;
  playerMode: PlayerMode;
  usingNativeAudio: boolean;
  nativeAudioStatus?: NativeAudioStatus;
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
  onRegisterVideoEl?: (el: HTMLVideoElement | null) => void;
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
  isOsPipActive = false,
  currentVideo,
  isPlaying,
  playerMode,
  usingNativeAudio,
  nativeAudioStatus = 'checking',
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
  onRegisterVideoEl,
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
  const [needsDirectTap, setNeedsDirectTap] = useState<boolean>(false);
  const [nativeVideoFailed, setNativeVideoFailed] = useState<boolean>(false);
  const [preferEmbed, setPreferEmbed] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState(0);
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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const appliedNativeSeekForIdRef = useRef<string | null>(null);
  const isSwitchingNativeRef = useRef<boolean>(false);
  const handshakeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoplayWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embedReadyRef = useRef(false);
  const suppressSeekEchoRef = useRef<number | null>(null);
  const iframeStateRef = useRef<{ videoId: string | null; playing: boolean | null }>({
    videoId: null,
    playing: null,
  });

  const propsRef = useRef({
    currentVideo,
    isPlaying,
    isOsPipActive,
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
    isOsPipActive,
    playbackRate,
    volume,
    isMuted,
    embedHost,
    onNext,
    onEmbedStateChange,
    onFallbackStandardHost,
  };

  const canTryNativeVideo = Boolean(
    isOpen &&
      currentVideo &&
      !usingNativeAudio &&
      nativeAudioStatus !== 'live_stream' &&
      nativeAudioStatus !== 'login_required' &&
      !nativeVideoFailed &&
      !preferEmbed
  );
  const useNativeMp4Video = canTryNativeVideo;
  const useEmbed = Boolean(isOpen && currentVideo && !usingNativeAudio && !useNativeMp4Video);
  const initialEmbedPlayRef = useRef(isPlaying);
  initialEmbedPlayRef.current = isPlaying;

  const setNativeVideoNode = useCallback(
    (el: HTMLVideoElement | null) => {
      nativeVideoRef.current = el;
      onRegisterVideoEl?.(el);
    },
    [onRegisterVideoEl]
  );

  useEffect(() => {
    setNativeVideoFailed(false);
    setPreferEmbed(false);
    appliedNativeSeekForIdRef.current = null;
  }, [currentVideo?.id]);

  // Reset internal touch-close state whenever popup opens/closes cleanly
  useEffect(() => {
    setTouchCloseState('idle');
    touchCloseSessionRef.current = null;
  }, [isOpen]);

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

  // Attach native non-passive touchstart/touchend listeners on the close button & popup container
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

  // Clamp saved position on open / compact change / window or visualViewport resize
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
    const vv = window.visualViewport;
    vv?.addEventListener('resize', handleResize);
    vv?.addEventListener('scroll', handleResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      vv?.removeEventListener('resize', handleResize);
      vv?.removeEventListener('scroll', handleResize);
    };
  }, [isOpen, compact, clampCurrentPosition]);

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

  const clearAutoplayWatchdog = useCallback(() => {
    if (autoplayWatchdogRef.current) {
      clearTimeout(autoplayWatchdogRef.current);
      autoplayWatchdogRef.current = null;
    }
  }, []);

  const armAutoplayWatchdog = useCallback(() => {
    clearAutoplayWatchdog();
    if (!useEmbed || !propsRef.current.isPlaying) return;
    autoplayWatchdogRef.current = setTimeout(() => {
      if (!propsRef.current.isPlaying) return;
      if (iframeStateRef.current.playing !== true) {
        setNeedsDirectTap(true);
      }
    }, 2000);
  }, [clearAutoplayWatchdog, useEmbed]);

  useEffect(() => {
    setEmbedErrorCode(null);
    setNeedsDirectTap(false);
    embedReadyRef.current = false;
    return () => {
      clearHandshakeTimer();
      clearAutoplayWatchdog();
    };
  }, [currentVideo?.id, embedHost, useEmbed, reloadNonce, clearHandshakeTimer, clearAutoplayWatchdog]);

  // Sync reactive state into Native MP4 <video> element when active
  useEffect(() => {
    const vidEl = nativeVideoRef.current;
    if (!useNativeMp4Video || !vidEl || !currentVideo) return;
    vidEl.muted = isMuted;
    vidEl.volume = Math.max(0, Math.min(1, volume / 100));
    try {
      const pitchVid = vidEl as HTMLVideoElement & {
        preservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };
      if ('preservesPitch' in pitchVid) pitchVid.preservesPitch = true;
      if ('webkitPreservesPitch' in pitchVid) pitchVid.webkitPreservesPitch = true;
      vidEl.playbackRate = playbackRate;
    } catch {
      // ignore
    }
  }, [useNativeMp4Video, currentVideo?.id, volume, isMuted, playbackRate]);

  useEffect(() => {
    const vidEl = nativeVideoRef.current;
    if (!useNativeMp4Video || !vidEl || !currentVideo) return;
    if (isPlaying) {
      if (vidEl.paused) {
        vidEl
          .play()
          .then(() => {
            setNeedsDirectTap(false);
          })
          .catch((err: unknown) => {
            const name = (err as { name?: string })?.name;
            if (name === 'NotAllowedError') {
              setNeedsDirectTap(true);
            }
          });
      } else {
        setNeedsDirectTap(false);
      }
    } else {
      setNeedsDirectTap(false);
      if (!vidEl.paused) {
        isSwitchingNativeRef.current = true;
        vidEl.pause();
        setTimeout(() => {
          isSwitchingNativeRef.current = false;
        }, 120);
      }
    }
  }, [useNativeMp4Video, currentVideo?.id, isPlaying]);

  // Sync play/pause commands into the popup iframe without reloading it
  useEffect(() => {
    if (!useEmbed || !currentVideo || !iframeRef.current) return;
    if (!isPlaying) {
      setNeedsDirectTap(false);
      clearAutoplayWatchdog();
    } else {
      armAutoplayWatchdog();
    }
    if (iframeStateRef.current.videoId !== currentVideo.id) {
      iframeStateRef.current = { videoId: currentVideo.id, playing: isPlaying };
      return;
    }
    if (iframeStateRef.current.playing === isPlaying) return;
    iframeStateRef.current.playing = isPlaying;
    sendEmbedCommand(isPlaying ? 'playVideo' : 'pauseVideo');
  }, [
    useEmbed,
    currentVideo?.id,
    isPlaying,
    sendEmbedCommand,
    armAutoplayWatchdog,
    clearAutoplayWatchdog,
  ]);

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
    if (!useEmbed && !useNativeMp4Video) return;
    const echoed =
      suppressSeekEchoRef.current !== null &&
      Math.abs(suppressSeekEchoRef.current - seekCommand) < 0.25;
    suppressSeekEchoRef.current = null;
    if (!echoed) {
      if (useNativeMp4Video && nativeVideoRef.current) {
        try {
          nativeVideoRef.current.currentTime = Math.max(0, seekCommand);
        } catch {
          // ignore
        }
      } else if (useEmbed) {
        sendEmbedCommand('seekTo', [seekCommand, true]);
      }
    }
    onSeekHandled?.();
  }, [seekCommand, useEmbed, useNativeMp4Video, sendEmbedCommand, onSeekHandled]);

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
            if (payload.info.playerState === 1 || payload.info.playerState === 3) {
              setNeedsDirectTap(false);
              clearAutoplayWatchdog();
            }
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
          if (payload.info === 1 || payload.info === 3) {
            setNeedsDirectTap(false);
            clearAutoplayWatchdog();
          }
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
    if (useNativeMp4Video && nativeVideoRef.current) {
      suppressSeekEchoRef.current = targetSec;
      try {
        nativeVideoRef.current.currentTime = Math.max(0, targetSec);
      } catch {
        // ignore
      }
    } else if (useEmbed) {
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
            className={`fixed right-2.5 sm:right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border casttube-accent-border shadow-2xl overflow-hidden text-left transition-[width] duration-200 ${
              isOsPipActive ? 'pointer-events-none' : ''
            } ${
              compact
                ? 'w-[min(calc(100vw-1.25rem),256px)] sm:w-[296px]'
                : 'w-[min(calc(100vw-1.25rem),288px)] sm:w-[352px]'
            }`}
          >
            {/* Top Rainbow Hairline */}
            <div className="h-1 w-full casttube-gradient-bar" />

            {/* Drag Header Bar (touch-safe: button clicks never start drag) */}
            <div
              onPointerDown={(e) => {
                const target = e.target as HTMLElement | null;
                if (target?.closest('button, a, input, [data-no-drag="true"]')) return;
                dragControls.start(e);
              }}
              onDoubleClick={handleResetPosition}
              className="flex items-center justify-between gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 casttube-soft-surface border-b border-slate-200/70 dark:border-slate-800/80 cursor-grab active:cursor-grabbing select-none touch-none"
              title="Geser bebas · Ketuk dua kali untuk kembalikan posisi"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <GripHorizontal className="w-4 h-4 casttube-accent-icon shrink-0" />
                <span className="text-[11px] font-extrabold tracking-tight casttube-gradient-text truncate">
                  {compact ? 'Popup Mini' : 'Popup · Geser'}
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
                    className="min-w-[34px] min-h-[34px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[var(--ct-text-light)] dark:text-slate-400 dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                    title="Setelan Popup & Cookie Otomatis"
                    aria-label="Setelan Popup"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCompact((v) => !v)}
                  className="min-w-[34px] min-h-[34px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[var(--ct-end-light)] dark:text-slate-400 dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                  title={compact ? 'Perbesar Video Popup' : 'Perkecil Tampilan Popup'}
                  aria-label={compact ? 'Tampilkan penuh popup' : 'Perkecil popup'}
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

            {/* Media Stage */}
            <div className="p-2.5 sm:p-3.5 space-y-2 sm:space-y-2.5">
              {useNativeMp4Video ? (
                <div className={compact ? 'flex items-center gap-2.5' : 'space-y-2'}>
                  {/* Single Persistent Native MP4 <video> (supports direct mobile OS Picture-in-Picture & uninterrupted background resume) */}
                  <div
                    onClick={() => {
                      const v = nativeVideoRef.current;
                      if (needsDirectTap && v) {
                        v.play()
                          .then(() => {
                            setNeedsDirectTap(false);
                            onEmbedStateChange(true);
                          })
                          .catch(() => {});
                        return;
                      }
                      onPlayPause();
                    }}
                    className={
                      compact
                        ? 'relative w-20 h-[45px] rounded-xl overflow-hidden bg-black shrink-0 ring-1 ring-[var(--ct-border-light)] dark:ring-[var(--ct-border-dark)] cursor-pointer'
                        : 'relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800 shadow-inner cursor-pointer'
                    }
                  >
                    <video
                      key={`mp4-${currentVideo.id}`}
                      ref={setNativeVideoNode}
                      src={`/api/youtube/audio-stream?videoId=${encodeURIComponent(
                        currentVideo.id
                      )}&media=video`}
                      poster={currentVideo.thumbnail}
                      playsInline
                      preload="auto"
                      muted={isMuted}
                      onLoadedMetadata={(e) => {
                        const vidEl = e.currentTarget;
                        const snap = getPlaybackClockSnapshot();
                        if (
                          appliedNativeSeekForIdRef.current !== currentVideo.id &&
                          snap.videoId === currentVideo.id &&
                          snap.currentTime > 0.5
                        ) {
                          appliedNativeSeekForIdRef.current = currentVideo.id;
                          try {
                            vidEl.currentTime = snap.currentTime;
                          } catch {
                            // ignore
                          }
                        }
                        vidEl.muted = propsRef.current.isMuted;
                        vidEl.volume = Math.max(0, Math.min(1, propsRef.current.volume / 100));
                        try {
                          vidEl.playbackRate = propsRef.current.playbackRate;
                        } catch {
                          // ignore
                        }
                        if (propsRef.current.isPlaying && vidEl.paused) {
                          vidEl
                            .play()
                            .then(() => setNeedsDirectTap(false))
                            .catch((err: unknown) => {
                              const name = (err as { name?: string })?.name;
                              if (name === 'NotAllowedError') {
                                setNeedsDirectTap(true);
                              }
                            });
                        }
                      }}
                      onTimeUpdate={(e) => {
                        const vidEl = e.currentTarget;
                        setPlaybackClock(
                          currentVideo.id,
                          vidEl.currentTime || 0,
                          Number.isFinite(vidEl.duration) ? vidEl.duration : 0
                        );
                      }}
                      onPlay={() => {
                        setNeedsDirectTap(false);
                        if (!propsRef.current.isPlaying) {
                          propsRef.current.onEmbedStateChange(true);
                        }
                      }}
                      onPause={(e) => {
                        if (isSwitchingNativeRef.current || e.currentTarget.ended) return;
                        if (propsRef.current.isPlaying) {
                          propsRef.current.onEmbedStateChange(false);
                        }
                      }}
                      onEnded={() => {
                        propsRef.current.onNext();
                      }}
                      onError={() => {
                        setNativeVideoFailed(true);
                      }}
                      className="w-full h-full object-cover"
                    />

                    {!compact && needsDirectTap && (
                      <div className="absolute inset-0 bg-slate-950/45 flex items-center justify-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full casttube-gradient-btn text-[11px] font-bold shadow-lg">
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Ketuk untuk Putar di HP</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {compact ? (
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                        {currentVideo.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                        <span className="truncate">{currentVideo.channelTitle}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Siap PiP
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {currentVideo.title}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="truncate">{currentVideo.channelTitle}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canOpenOsPip && onOpenOsPip && (
                            <button
                              type="button"
                              onClick={onOpenOsPip}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg casttube-gradient-btn text-[10px] font-bold hover:brightness-110 transition-all cursor-pointer"
                              title="Lepas video ke Layar HP Mengambang (tampil di atas WhatsApp / aplikasi lain)"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>PiP HP</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPreferEmbed(true)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold casttube-accent-secondary-text hover:underline shrink-0 cursor-pointer"
                            title="Ganti ke mode Embed YouTube"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Embed YT</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : useEmbed ? (
                <div className={compact ? 'flex items-center gap-2.5' : 'space-y-2'}>
                  {/* Single Persistent Iframe (never unmounts when toggling compact vs expanded!) */}
                  <div
                    className={
                      compact
                        ? 'relative w-20 h-[45px] rounded-xl overflow-hidden bg-black shrink-0 ring-1 ring-[var(--ct-border-light)] dark:ring-[var(--ct-border-dark)]'
                        : 'relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800 shadow-inner'
                    }
                  >
                    <iframe
                      key={embedKey}
                      ref={iframeRef}
                      src={embedSrc}
                      title={currentVideo.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                      onLoad={() => {
                        iframeStateRef.current = { videoId: currentVideo.id, playing: null };
                        startHandshakeRetries();
                        if (propsRef.current.isPlaying) {
                          armAutoplayWatchdog();
                        }
                      }}
                      className="w-full h-full border-0"
                    />

                    {!compact && needsDirectTap && embedErrorCode === null && (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-sm border border-white/15 text-[10px] font-bold text-white shadow-lg">
                          <Play className="w-3 h-3 fill-current" />
                          <span>Ketuk video sekali untuk putar di HP</span>
                        </div>
                      </div>
                    )}

                    {!compact && embedErrorCode !== null && (
                      <div className="absolute inset-0 bg-slate-950/92 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-400" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-white">
                            Video embed dibatasi (Kode {embedErrorCode})
                          </p>
                          <p className="text-[11px] text-slate-300 leading-snug">
                            Muat ulang, pindah ke Mode Audio Latar, atau buka YouTube.
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

                  {/* Metadata & Server Toggle beside/below single iframe */}
                  {compact ? (
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                        {currentVideo.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                        <span className="truncate">{currentVideo.channelTitle}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Popup Aktif
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {currentVideo.title}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="truncate">{currentVideo.channelTitle}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {preferEmbed && !nativeVideoFailed && nativeAudioStatus !== 'live_stream' && (
                            <button
                              type="button"
                              onClick={() => setPreferEmbed(false)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                              title="Kembali ke Mode Video PiP Native"
                            >
                              <span>Mode PiP</span>
                            </button>
                          )}
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
                      className="min-w-[34px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
                      if (useNativeMp4Video && nativeVideoRef.current) {
                        suppressSeekEchoRef.current = target;
                        try {
                          nativeVideoRef.current.currentTime = target;
                        } catch {
                          // ignore
                        }
                      } else if (useEmbed) {
                        suppressSeekEchoRef.current = target;
                        sendEmbedCommand('seekTo', [target, true]);
                      }
                      onSkipBack(15);
                    }}
                    className="min-w-[34px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-end-light)] dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Mundur 15 detik"
                    aria-label="Mundur 15 detik"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (useNativeMp4Video && nativeVideoRef.current && !isPlaying) {
                        void nativeVideoRef.current.play().catch(() => {});
                      } else if (
                        useEmbed &&
                        !isPlaying &&
                        iframeStateRef.current.playing !== true
                      ) {
                        sendEmbedCommand('playVideo');
                        armAutoplayWatchdog();
                      }
                      onPlayPause();
                    }}
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
                      if (useNativeMp4Video && nativeVideoRef.current) {
                        suppressSeekEchoRef.current = nextT;
                        try {
                          nativeVideoRef.current.currentTime = nextT;
                        } catch {
                          // ignore
                        }
                      } else if (useEmbed) {
                        suppressSeekEchoRef.current = nextT;
                        sendEmbedCommand('seekTo', [nextT, true]);
                      }
                      onSkipForward(30);
                    }}
                    className="min-w-[34px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-end-light)] dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Maju 30 detik"
                    aria-label="Maju 30 detik"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {hasNext && (
                    <button
                      type="button"
                      onClick={onNext}
                      className="min-w-[34px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
