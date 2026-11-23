import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeAudioStatus, Video } from '../types';
import { formatTime } from '../utils/format';
import {
  getPlaybackClockSnapshot,
  setPlaybackClock,
  subscribePlaybackClock,
} from '../utils/playbackClock';
import {
  getActiveCssThemeColors,
  THEME_COLORS_CHANGED_EVENT,
} from '../utils/themeColors';

interface DocumentPictureInPictureAPI {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window?: Window | null;
}

interface UseFloatingMiniPlayerOptions {
  currentVideo: Video | null;
  isPlaying: boolean;
  playbackRate?: number;
  volume?: number;
  isMuted?: boolean;
  usingNativeAudio: boolean;
  nativeAudioStatus?: NativeAudioStatus;
  hasNext: boolean;
  autoPopupOnMinimize?: boolean;
  autoClosePopupOnReturn?: boolean;
  onPlayPause: () => void;
  onSkipBack: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
  onNext: () => void;
  onOpenExtractorAuth?: () => void;
  onEmbedStateChange?: (playing: boolean) => void;
}

export interface OpenFloatingPopupOptions {
  silent?: boolean;
  videoOverride?: Video;
  manual?: boolean;
}

export type FloatingPopupMode = 'document' | 'video' | 'inapp' | null;

export function useFloatingMiniPlayer({
  currentVideo,
  isPlaying,
  playbackRate = 1,
  volume = 85,
  isMuted = false,
  usingNativeAudio,
  nativeAudioStatus = 'checking',
  hasNext,
  autoPopupOnMinimize = true,
  autoClosePopupOnReturn = true,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onNext,
  onOpenExtractorAuth,
  onEmbedStateChange,
}: UseFloatingMiniPlayerOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<FloatingPopupMode>(null);
  const [error, setError] = useState<string | null>(null);
  const [supportsAutoPip, setSupportsAutoPip] = useState(false);
  const [pipEmbedHost, setPipEmbedHost] = useState<'nocookie' | 'standard'>('nocookie');

  const pipWindowRef = useRef<Window | null>(null);
  const handshakeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockUnsubRef = useRef<(() => void) | null>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const modeRef = useRef<FloatingPopupMode>(mode);
  modeRef.current = mode;
  const wasHiddenSinceOpenRef = useRef(false);
  const openedByMinimizeRef = useRef(false);
  const lastAutoTriggerAtRef = useRef(0);
  const loadedEmbedKeyRef = useRef<string | null>(null);
  const iframeReportedStateRef = useRef<{ videoId: string | null; playing: boolean | null }>({
    videoId: null,
    playing: null,
  });

  const propsRef = useRef({
    currentVideo,
    isPlaying,
    playbackRate,
    volume,
    isMuted,
    usingNativeAudio,
    nativeAudioStatus,
    hasNext,
    autoPopupOnMinimize,
    autoClosePopupOnReturn,
    pipEmbedHost,
    onPlayPause,
    onSkipBack,
    onSkipForward,
    onNext,
    onOpenExtractorAuth,
    onEmbedStateChange,
  });
  propsRef.current = {
    currentVideo,
    isPlaying,
    playbackRate,
    volume,
    isMuted,
    usingNativeAudio,
    nativeAudioStatus,
    hasNext,
    autoPopupOnMinimize,
    autoClosePopupOnReturn,
    pipEmbedHost,
    onPlayPause,
    onSkipBack,
    onSkipForward,
    onNext,
    onOpenExtractorAuth,
    onEmbedStateChange,
  };

  const isTopWindow = typeof window !== 'undefined' && window.self === window.top;
  const supportsDocumentPip =
    typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  const canOpenOsPip = supportsDocumentPip && isTopWindow;
  // Universal popup support: always enabled via unrestricted interactive FloatingInAppPopup
  const isSupported = true;

  const isPopupEmbedActive = Boolean(
    isOpen && (mode === 'document' || mode === 'inapp') && !usingNativeAudio && currentVideo
  );

  const cleanupResources = useCallback(() => {
    if (clockUnsubRef.current) {
      clockUnsubRef.current();
      clockUnsubRef.current = null;
    }
    if (handshakeTimerRef.current) {
      clearInterval(handshakeTimerRef.current);
      handshakeTimerRef.current = null;
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      try {
        pipWindowRef.current.close();
      } catch {
        // ignore
      }
    }
    pipWindowRef.current = null;
    loadedEmbedKeyRef.current = null;

    setIsOpen(false);
    setMode(null);
    wasHiddenSinceOpenRef.current = false;
    openedByMinimizeRef.current = false;
  }, []);

  const renderDocumentPipContents = useCallback((win: Window) => {
    const doc = win.document;
    const {
      currentVideo: vid,
      isPlaying: playing,
      usingNativeAudio: native,
      hasNext: nextAvail,
      pipEmbedHost: hostMode,
    } = propsRef.current;

    const useEmbed = Boolean(vid && !native);
    const headerRow = doc.getElementById('ct-pip-top');
    const embedWrap = doc.getElementById('ct-pip-embed-wrap');
    const embedFrame = doc.getElementById('ct-pip-iframe') as HTMLIFrameElement | null;
    const progressWrap = doc.getElementById('ct-pip-progress-wrap');
    const audioControls = doc.getElementById('ct-pip-audio-controls');
    const embedControls = doc.getElementById('ct-pip-embed-controls');
    const hostBtn = doc.getElementById('ct-pip-host-btn');

    const titleEl = doc.getElementById('ct-pip-title');
    const channelEl = doc.getElementById('ct-pip-channel');
    const thumbEl = doc.getElementById('ct-pip-thumb') as HTMLImageElement | null;
    const statusEl = doc.getElementById('ct-pip-status');
    const playBtn = doc.getElementById('ct-pip-play');
    const nextBtn = doc.getElementById('ct-pip-next') as HTMLButtonElement | null;
    const embedNextBtn = doc.getElementById('ct-pip-embed-next') as HTMLButtonElement | null;

    if (titleEl) titleEl.textContent = vid?.title || 'Tidak ada video aktif';
    if (channelEl) channelEl.textContent = vid?.channelTitle || 'CastTube';
    if (thumbEl && vid?.thumbnail && thumbEl.src !== vid.thumbnail) {
      thumbEl.src = vid.thumbnail;
      thumbEl.alt = vid.title;
    }
    if (statusEl) {
      statusEl.textContent = native
        ? 'Audio Latar Aktif · Otomatis'
        : 'Popup YouTube Aktif · Bebas Pembatasan';
      statusEl.style.color = native ? '#34d399' : '#38bdf8';
    }
    if (playBtn) {
      playBtn.textContent = playing ? 'Jeda' : 'Putar';
      playBtn.setAttribute('aria-label', playing ? 'Jeda' : 'Putar');
    }
    if (nextBtn) {
      nextBtn.disabled = !nextAvail;
      nextBtn.style.opacity = nextAvail ? '1' : '0.4';
    }
    if (embedNextBtn) {
      embedNextBtn.disabled = !nextAvail;
      embedNextBtn.style.opacity = nextAvail ? '1' : '0.4';
    }

    if (embedWrap && embedFrame) {
      if (useEmbed && vid) {
        if (headerRow) headerRow.style.display = 'none';
        if (progressWrap) progressWrap.style.display = 'none';
        if (audioControls) audioControls.style.display = 'none';
        if (embedControls) embedControls.style.display = 'flex';
        embedWrap.style.display = 'block';

        const snap = getPlaybackClockSnapshot();
        const startSec =
          snap.videoId === vid.id && snap.currentTime > 1 ? Math.floor(snap.currentTime) : 0;
        const hostBase =
          hostMode === 'standard'
            ? 'https://www.youtube.com'
            : 'https://www.youtube-nocookie.com';
        const embedKey = `${vid.id}::${hostMode}`;
        if (loadedEmbedKeyRef.current !== embedKey) {
          loadedEmbedKeyRef.current = embedKey;
          iframeReportedStateRef.current = { videoId: vid.id, playing: playing };
          embedFrame.src = `${hostBase}/embed/${encodeURIComponent(
            vid.id
          )}?autoplay=${playing ? '1' : '0'}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&start=${startSec}&origin=${encodeURIComponent(
            window.location.origin
          )}`;
        } else if (
          iframeReportedStateRef.current.videoId === vid.id &&
          iframeReportedStateRef.current.playing !== playing
        ) {
          iframeReportedStateRef.current.playing = playing;
          try {
            embedFrame.contentWindow?.postMessage(
              JSON.stringify({
                event: 'command',
                func: playing ? 'playVideo' : 'pauseVideo',
                args: [],
              }),
              '*'
            );
          } catch {
            // ignore postMessage failure
          }
        }
        if (hostBtn) {
          hostBtn.textContent = hostMode === 'nocookie' ? 'Host Standar' : 'Host Privasi';
        }
      } else {
        embedWrap.style.display = 'none';
        if (embedControls) embedControls.style.display = 'none';
        if (headerRow) headerRow.style.display = 'flex';
        if (progressWrap) progressWrap.style.display = 'block';
        if (audioControls) audioControls.style.display = 'flex';
        if (embedFrame.src) {
          loadedEmbedKeyRef.current = null;
          iframeReportedStateRef.current = { videoId: null, playing: null };
          embedFrame.src = 'about:blank';
        }
      }
    }

    const snap = getPlaybackClockSnapshot();
    const timeEl = doc.getElementById('ct-pip-time');
    const barFillEl = doc.getElementById('ct-pip-bar-fill');
    if (timeEl) {
      timeEl.textContent = `${formatTime(snap.currentTime)} / ${formatTime(snap.duration)}`;
    }
    if (barFillEl) {
      const pct =
        snap.duration > 0
          ? Math.min(100, Math.max(0, (snap.currentTime / snap.duration) * 100))
          : 0;
      barFillEl.style.width = `${pct}%`;
    }
  }, []);

  useEffect(() => {
    if (mode === 'document' && pipWindowRef.current && !pipWindowRef.current.closed) {
      renderDocumentPipContents(pipWindowRef.current);
      const embedFrame = pipWindowRef.current.document.getElementById(
        'ct-pip-iframe'
      ) as HTMLIFrameElement | null;
      if (embedFrame?.contentWindow && !usingNativeAudio) {
        const sendCmd = (func: string, args: unknown[] = []) => {
          try {
            embedFrame.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func, args }),
              '*'
            );
          } catch {
            // ignore
          }
        };
        sendCmd('setPlaybackRate', [playbackRate]);
        if (isMuted) {
          sendCmd('mute');
        } else {
          sendCmd('unMute');
          sendCmd('setVolume', [volume]);
        }
      }
    }
  }, [
    mode,
    currentVideo?.id,
    currentVideo?.title,
    isPlaying,
    playbackRate,
    volume,
    isMuted,
    usingNativeAudio,
    nativeAudioStatus,
    hasNext,
    pipEmbedHost,
    renderDocumentPipContents,
  ]);

  useEffect(() => {
    const syncPipTheme = () => {
      const pipWin = pipWindowRef.current;
      if (!pipWin || pipWin.closed) return;
      const colors = getActiveCssThemeColors();
      const rootStyle = pipWin.document.documentElement.style;
      rootStyle.setProperty('--ct-start', colors.startHex);
      rootStyle.setProperty('--ct-mid', colors.midHex);
      rootStyle.setProperty('--ct-end', colors.endHex);
      rootStyle.setProperty('--ct-glow', colors.glowHex);
      rootStyle.setProperty('--ct-btn-text', colors.btnText);
    };
    window.addEventListener(THEME_COLORS_CHANGED_EVENT, syncPipTheme);
    return () => {
      window.removeEventListener(THEME_COLORS_CHANGED_EVENT, syncPipTheme);
      cleanupResources();
    };
  }, [cleanupResources]);

  const openOsPipWindow = useCallback(
    async (options?: OpenFloatingPopupOptions): Promise<boolean> => {
      setError(null);
      if (options?.videoOverride) {
        propsRef.current.currentVideo = options.videoOverride;
      }
      if (!propsRef.current.currentVideo) {
        if (!options?.silent) {
          setError('Pilih atau putar video terlebih dahulu untuk membuka jendela PiP.');
        }
        return false;
      }

      if (canOpenOsPip) {
        try {
          if (pipWindowRef.current && !pipWindowRef.current.closed) {
            if (!options?.silent) pipWindowRef.current.focus();
            renderDocumentPipContents(pipWindowRef.current);
            setIsOpen(true);
            setMode('document');
            return true;
          }
          cleanupResources();

          const needsEmbed = !propsRef.current.usingNativeAudio;
          const api = (window as unknown as { documentPictureInPicture: DocumentPictureInPictureAPI })
            .documentPictureInPicture;
          const pipWin = await api.requestWindow({
            width: 400,
            height: needsEmbed ? 316 : 228,
          });
          pipWindowRef.current = pipWin;
          loadedEmbedKeyRef.current = null;

          const doc = pipWin.document;
          doc.title = 'CastTube · Pemutar Mengambang';
          const themeColors = getActiveCssThemeColors();
          const pipRootStyle = doc.documentElement.style;
          pipRootStyle.setProperty('--ct-start', themeColors.startHex);
          pipRootStyle.setProperty('--ct-mid', themeColors.midHex);
          pipRootStyle.setProperty('--ct-end', themeColors.endHex);
          pipRootStyle.setProperty('--ct-glow', themeColors.glowHex);
          pipRootStyle.setProperty('--ct-btn-text', themeColors.btnText);
          const style = doc.createElement('style');
          style.textContent = `
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
            body {
              background: radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--ct-start) 26%, transparent), transparent 55%),
                          radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--ct-glow) 24%, transparent), transparent 55%),
                          #090d1a;
              color: #f8fafc; padding: 12px; display: flex;
              flex-direction: column; justify-content: space-between; height: 100vh; overflow: hidden; gap: 10px;
            }
            .top { display: flex; gap: 12px; align-items: center; }
            .thumb { width: 72px; height: 54px; border-radius: 12px; object-fit: cover; background: #1e293b; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.12); }
            .meta { min-width: 0; flex: 1; }
            .status { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
            .title { font-size: 13px; font-weight: 700; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .channel { font-size: 11px; color: #94a3b8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .embed-wrap {
              display: none; position: relative; width: 100%; flex: 1; min-height: 180px;
              border-radius: 14px; overflow: hidden; background: #000; border: 1px solid color-mix(in srgb, var(--ct-mid) 45%, transparent);
            }
            .embed-wrap iframe { width: 100%; height: 100%; border: 0; }
            .progress-wrap { margin-top: 4px; }
            .bar { width: 100%; height: 6px; border-radius: 999px; background: rgba(148,163,184,0.2); overflow: hidden; }
            .bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg, var(--ct-start), var(--ct-mid), var(--ct-end), var(--ct-glow)); transition: width 0.2s linear; }
            .time { margin-top: 5px; font-size: 11px; color: #cbd5e1; font-family: ui-monospace, monospace; display: flex; justify-content: space-between; }
            .controls { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
            .embed-controls { display: none; align-items: center; justify-content: space-between; gap: 6px; }
            button {
              border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 8px 10px; font-size: 11px; font-weight: 700;
              cursor: pointer; background: rgba(30,41,59,0.85); color: #e2e8f0; transition: transform 0.15s, background 0.15s; white-space: nowrap;
            }
            button:hover { background: rgba(51,65,85,0.95); }
            button.primary { background: linear-gradient(135deg, var(--ct-start), var(--ct-mid), var(--ct-end)); color: var(--ct-btn-text); flex: 1; border: 0; }
            button.primary:hover { filter: brightness(1.08); }
            button.cyan { background: linear-gradient(135deg, var(--ct-end), var(--ct-glow)); color: var(--ct-btn-text); border: 0; }
            button:disabled { cursor: not-allowed; }
          `;
          doc.head.appendChild(style);

          doc.body.innerHTML = `
            <div id="ct-pip-top" class="top">
              <img id="ct-pip-thumb" class="thumb" referrerpolicy="no-referrer" alt="" />
              <div class="meta">
                <div id="ct-pip-status" class="status"></div>
                <div id="ct-pip-title" class="title"></div>
                <div id="ct-pip-channel" class="channel"></div>
              </div>
            </div>
            <div id="ct-pip-embed-wrap" class="embed-wrap">
              <iframe
                id="ct-pip-iframe"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
              ></iframe>
            </div>
            <div id="ct-pip-progress-wrap" class="progress-wrap">
              <div class="bar"><div id="ct-pip-bar-fill" class="bar-fill"></div></div>
              <div class="time">
                <span id="ct-pip-time">0:00 / 0:00</span>
                <span>Popup Otomatis Aktif</span>
              </div>
            </div>
            <div id="ct-pip-audio-controls" class="controls">
              <button id="ct-pip-back" type="button">-15d</button>
              <button id="ct-pip-play" class="primary" type="button">Putar</button>
              <button id="ct-pip-fwd" type="button">+30d</button>
              <button id="ct-pip-next" type="button">Lanjut</button>
            </div>
            <div id="ct-pip-embed-controls" class="embed-controls">
              <button id="ct-pip-host-btn" class="cyan" type="button">Ganti Server</button>
              <button id="ct-pip-embed-next" type="button">Lanjut</button>
            </div>
          `;

          doc.getElementById('ct-pip-back')?.addEventListener('click', () => propsRef.current.onSkipBack(15));
          doc.getElementById('ct-pip-play')?.addEventListener('click', () => propsRef.current.onPlayPause());
          doc.getElementById('ct-pip-fwd')?.addEventListener('click', () => propsRef.current.onSkipForward(30));
          doc.getElementById('ct-pip-next')?.addEventListener('click', () => propsRef.current.onNext());
          doc.getElementById('ct-pip-embed-next')?.addEventListener('click', () => propsRef.current.onNext());
          doc.getElementById('ct-pip-host-btn')?.addEventListener('click', () => {
            setPipEmbedHost((prev) => (prev === 'nocookie' ? 'standard' : 'nocookie'));
          });

          const iframeEl = doc.getElementById('ct-pip-iframe') as HTMLIFrameElement | null;
          let gotHandshake = false;
          const sendHandshake = () => {
            try {
              iframeEl?.contentWindow?.postMessage(
                JSON.stringify({ event: 'listening', id: 1 }),
                '*'
              );
            } catch {
              // ignore
            }
          };
          iframeEl?.addEventListener('load', () => {
            gotHandshake = false;
            sendHandshake();
            if (handshakeTimerRef.current) clearInterval(handshakeTimerRef.current);
            let tries = 0;
            handshakeTimerRef.current = setInterval(() => {
              tries += 1;
              if (gotHandshake || tries >= 14 || !pipWindowRef.current || pipWindowRef.current.closed) {
                if (handshakeTimerRef.current) {
                  clearInterval(handshakeTimerRef.current);
                  handshakeTimerRef.current = null;
                }
                return;
              }
              sendHandshake();
            }, 350);
          });

          const handlePipMessage = (ev: MessageEvent) => {
            if (
              typeof ev.origin === 'string' &&
              !ev.origin.includes('youtube.com') &&
              !ev.origin.includes('youtube-nocookie.com')
            ) {
              return;
            }
            try {
              const payload = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
              if (payload?.event === 'onReady' || payload?.event === 'infoDelivery') {
                if (!gotHandshake) {
                  gotHandshake = true;
                  try {
                    const sendCmd = (func: string, args: unknown[] = []) => {
                      iframeEl?.contentWindow?.postMessage(
                        JSON.stringify({ event: 'command', func, args }),
                        '*'
                      );
                    };
                    sendCmd('setPlaybackRate', [propsRef.current.playbackRate]);
                    if (propsRef.current.isMuted) {
                      sendCmd('mute');
                    } else {
                      sendCmd('unMute');
                      sendCmd('setVolume', [propsRef.current.volume]);
                    }
                  } catch {
                    // ignore
                  }
                }
              }
              if (payload?.event === 'infoDelivery' && payload?.info) {
                const vid = propsRef.current.currentVideo;
                const cur = typeof payload.info.currentTime === 'number' ? payload.info.currentTime : undefined;
                const dur = typeof payload.info.duration === 'number' ? payload.info.duration : undefined;
                if (vid && (cur !== undefined || dur !== undefined)) {
                  setPlaybackClock(vid.id, cur ?? getPlaybackClockSnapshot().currentTime, dur);
                }
                if (typeof payload.info.playerState === 'number') {
                  if (payload.info.playerState === 1) {
                    iframeReportedStateRef.current = { videoId: vid?.id || null, playing: true };
                    if (!propsRef.current.isPlaying) {
                      propsRef.current.onEmbedStateChange?.(true);
                    }
                  } else if (payload.info.playerState === 2) {
                    iframeReportedStateRef.current = { videoId: vid?.id || null, playing: false };
                    if (propsRef.current.isPlaying) {
                      propsRef.current.onEmbedStateChange?.(false);
                    }
                  } else if (payload.info.playerState === 0) {
                    propsRef.current.onNext();
                  }
                }
              } else if (payload?.event === 'onStateChange' && typeof payload?.info === 'number') {
                const vid = propsRef.current.currentVideo;
                if (payload.info === 1) {
                  iframeReportedStateRef.current = { videoId: vid?.id || null, playing: true };
                  if (!propsRef.current.isPlaying) {
                    propsRef.current.onEmbedStateChange?.(true);
                  }
                } else if (payload.info === 2) {
                  iframeReportedStateRef.current = { videoId: vid?.id || null, playing: false };
                  if (propsRef.current.isPlaying) {
                    propsRef.current.onEmbedStateChange?.(false);
                  }
                } else if (payload.info === 0) {
                  propsRef.current.onNext();
                }
              } else if (
                payload?.event === 'onError' &&
                (payload?.info === 101 || payload?.info === 150 || payload?.info === 153)
              ) {
                setPipEmbedHost((prev) => (prev === 'nocookie' ? 'standard' : prev));
              }
            } catch {
              // ignore non-JSON postMessage
            }
          };
          pipWin.addEventListener('message', handlePipMessage);

          renderDocumentPipContents(pipWin);
          clockUnsubRef.current = subscribePlaybackClock(() => {
            const snap = getPlaybackClockSnapshot();
            const timeEl = doc.getElementById('ct-pip-time');
            const barFillEl = doc.getElementById('ct-pip-bar-fill');
            if (timeEl) {
              timeEl.textContent = `${formatTime(snap.currentTime)} / ${formatTime(snap.duration)}`;
            }
            if (barFillEl) {
              const pct =
                snap.duration > 0
                  ? Math.min(100, Math.max(0, (snap.currentTime / snap.duration) * 100))
                  : 0;
              barFillEl.style.width = `${pct}%`;
            }
          });

          pipWin.addEventListener('pagehide', () => {
            pipWin.removeEventListener('message', handlePipMessage);
            cleanupResources();
          });

          setIsOpen(true);
          setMode('document');
          openedByMinimizeRef.current = false;
          wasHiddenSinceOpenRef.current =
            typeof document !== 'undefined' && document.visibilityState === 'hidden';
          return true;
        } catch {
          cleanupResources();
        }
      }

      // Always fall back seamlessly to unrestricted interactive In-App Popup
      setIsOpen(true);
      setMode('inapp');
      return true;
    },
    [canOpenOsPip, cleanupResources, renderDocumentPipContents]
  );

  // Guaranteed Universal Floating In-App Popup (zero user-activation / about:blank / popup-blocker restrictions)
  const openPopup = useCallback(
    async (options?: OpenFloatingPopupOptions): Promise<boolean> => {
      setError(null);
      if (options?.videoOverride) {
        propsRef.current.currentVideo = options.videoOverride;
      }
      if (!propsRef.current.currentVideo) {
        if (!options?.silent) {
          setError('Putar video atau podcast terlebih dahulu sebelum membuka popup.');
        }
        return false;
      }

      const isMinimizeContext =
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden' &&
        !options?.manual;

      if (modeRef.current === 'inapp' && isOpenRef.current) {
        if (options?.manual) {
          openedByMinimizeRef.current = false;
        }
        return true;
      }

      if (modeRef.current === 'document' && isOpenRef.current && pipWindowRef.current && !pipWindowRef.current.closed) {
        if (!options?.silent) pipWindowRef.current.focus();
        renderDocumentPipContents(pipWindowRef.current);
        return true;
      }

      cleanupResources();
      setIsOpen(true);
      setMode('inapp');
      openedByMinimizeRef.current = isMinimizeContext;
      wasHiddenSinceOpenRef.current = isMinimizeContext;
      return true;
    },
    [cleanupResources, renderDocumentPipContents]
  );

  const closePopup = useCallback(() => {
    cleanupResources();
  }, [cleanupResources]);

  const togglePopup = useCallback(async () => {
    if (isOpenRef.current) {
      closePopup();
      return false;
    }
    return openPopup({ manual: true });
  }, [closePopup, openPopup]);

  const togglePipEmbedHost = useCallback(() => {
    setPipEmbedHost((prev) => (prev === 'nocookie' ? 'standard' : 'nocookie'));
  }, []);

  const fallbackToStandardEmbedHost = useCallback(() => {
    setPipEmbedHost((prev) => (prev === 'nocookie' ? 'standard' : prev));
  }, []);

  // Register Chrome Automatic Picture-in-Picture (`enterpictureinpicture`) when enabled
  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      !supportsDocumentPip
    ) {
      setSupportsAutoPip(true);
      return;
    }

    const mediaSession = navigator.mediaSession as MediaSession & {
      setActionHandler: (action: string, handler: (() => void) | null) => void;
    };

    if (!autoPopupOnMinimize || !currentVideo || !isPlaying) {
      try {
        mediaSession.setActionHandler('enterpictureinpicture', null);
      } catch {
        // ignore if unsupported
      }
      setSupportsAutoPip(true);
      return;
    }

    try {
      mediaSession.setActionHandler('enterpictureinpicture', () => {
        lastAutoTriggerAtRef.current = Date.now();
        void openPopup({ silent: true });
      });
      setSupportsAutoPip(true);
    } catch {
      setSupportsAutoPip(true);
    }

    return () => {
      try {
        mediaSession.setActionHandler('enterpictureinpicture', null);
      } catch {
        // ignore
      }
    };
  }, [autoPopupOnMinimize, currentVideo?.id, isPlaying, openPopup, supportsDocumentPip]);

  // Auto-open on minimize (without restriction) and clean auto-close on return only when triggered by minimize
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (isOpenRef.current) {
          wasHiddenSinceOpenRef.current = true;
          return;
        }
        if (
          propsRef.current.autoPopupOnMinimize &&
          propsRef.current.isPlaying &&
          propsRef.current.currentVideo
        ) {
          fallbackTimer = setTimeout(() => {
            if (
              document.visibilityState === 'hidden' &&
              !isOpenRef.current &&
              Date.now() - lastAutoTriggerAtRef.current > 300
            ) {
              void openPopup({ silent: true });
            }
          }, 60);
        }
      } else {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        if (
          propsRef.current.autoClosePopupOnReturn &&
          isOpenRef.current &&
          wasHiddenSinceOpenRef.current &&
          openedByMinimizeRef.current
        ) {
          cleanupResources();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [openPopup, cleanupResources]);

  return {
    isSupported,
    supportsAutoPip,
    canOpenOsPip,
    isOpen,
    isPopupEmbedActive,
    mode,
    pipEmbedHost,
    togglePipEmbedHost,
    fallbackToStandardEmbedHost,
    error,
    openPopup,
    openOsPipWindow,
    closePopup,
    togglePopup,
  };
}
