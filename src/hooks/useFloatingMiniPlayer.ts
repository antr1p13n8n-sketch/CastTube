import { useCallback, useEffect, useRef, useState } from 'react';
import { Video } from '../types';
import { formatTime } from '../utils/format';
import { getPlaybackClockSnapshot, subscribePlaybackClock } from '../utils/playbackClock';
import { getActiveCssThemeColors, THEME_COLORS_CHANGED_EVENT } from '../utils/themeColors';

interface DocumentPictureInPictureAPI {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window?: Window | null;
}

interface UseFloatingMiniPlayerOptions {
  currentVideo: Video | null;
  isPlaying: boolean;
  hasNext: boolean;
  autoPopupOnMinimize?: boolean;
  autoClosePopupOnReturn?: boolean;
  onPlayPause: () => void;
  onSkipBack: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
  onNext: () => void;
}

export interface OpenFloatingPopupOptions {
  silent?: boolean;
  videoOverride?: Video;
  manual?: boolean;
}

export type FloatingPopupMode = 'document' | 'video' | 'inapp' | null;

interface PipVideoElement extends HTMLVideoElement {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
}

export function useFloatingMiniPlayer({
  currentVideo,
  isPlaying,
  hasNext,
  autoPopupOnMinimize = true,
  autoClosePopupOnReturn = false,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onNext,
}: UseFloatingMiniPlayerOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<FloatingPopupMode>(null);
  const [error, setError] = useState<string | null>(null);
  const [supportsAutoPip, setSupportsAutoPip] = useState(false);

  const pipWindowRef = useRef<Window | null>(null);
  const clockUnsubRef = useRef<(() => void) | null>(null);
  const videoPipStateRef = useRef<{
    videoEl: PipVideoElement | null;
    canvasEl: HTMLCanvasElement | null;
    drawInterval: ReturnType<typeof setInterval> | null;
    thumbImg: HTMLImageElement | null;
    thumbVideoId: string | null;
    cleanupListeners: (() => void) | null;
  }>({
    videoEl: null,
    canvasEl: null,
    drawInterval: null,
    thumbImg: null,
    thumbVideoId: null,
    cleanupListeners: null,
  });

  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const modeRef = useRef<FloatingPopupMode>(mode);
  modeRef.current = mode;
  const wasHiddenSinceOpenRef = useRef(false);
  const openedByMinimizeRef = useRef(false);
  const lastAutoTriggerAtRef = useRef(0);

  const propsRef = useRef({
    currentVideo,
    isPlaying,
    hasNext,
    autoPopupOnMinimize,
    autoClosePopupOnReturn,
    onPlayPause,
    onSkipBack,
    onSkipForward,
    onNext,
  });
  propsRef.current = {
    currentVideo,
    isPlaying,
    hasNext,
    autoPopupOnMinimize,
    autoClosePopupOnReturn,
    onPlayPause,
    onSkipBack,
    onSkipForward,
    onNext,
  };

  const isTopWindow = typeof window !== 'undefined' && window.self === window.top;
  const supportsDocumentPip =
    typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  const supportsVideoPip =
    typeof document !== 'undefined' &&
    Boolean(
      document.pictureInPictureEnabled ||
        (typeof HTMLVideoElement !== 'undefined' &&
          ('requestPictureInPicture' in HTMLVideoElement.prototype ||
            'webkitSetPresentationMode' in HTMLVideoElement.prototype))
    );
  const supportsCanvasCapture =
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';
  const canOpenOsPip = (supportsDocumentPip || (supportsVideoPip && supportsCanvasCapture)) && isTopWindow;
  const isSupported = true;

  const cleanupVideoPip = useCallback(() => {
    const vp = videoPipStateRef.current;
    if (vp.drawInterval) {
      clearInterval(vp.drawInterval);
      vp.drawInterval = null;
    }
    if (vp.cleanupListeners) {
      vp.cleanupListeners();
      vp.cleanupListeners = null;
    }
    if (typeof document !== 'undefined' && vp.videoEl && document.pictureInPictureElement === vp.videoEl) {
      try {
        void document.exitPictureInPicture().catch(() => {});
      } catch {
        // ignore
      }
    }
    if (vp.videoEl) {
      try {
        if (vp.videoEl.webkitPresentationMode === 'picture-in-picture') {
          vp.videoEl.webkitSetPresentationMode?.('inline');
        }
        vp.videoEl.pause();
        const srcObj = vp.videoEl.srcObject as MediaStream | null;
        if (srcObj) {
          srcObj.getTracks().forEach((t) => t.stop());
        }
        vp.videoEl.srcObject = null;
        vp.videoEl.remove();
      } catch {
        // ignore
      }
      vp.videoEl = null;
    }
    vp.canvasEl = null;
    vp.thumbImg = null;
    vp.thumbVideoId = null;
  }, []);

  const cleanupResources = useCallback(() => {
    if (clockUnsubRef.current) {
      clockUnsubRef.current();
      clockUnsubRef.current = null;
    }
    cleanupVideoPip();
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      try {
        pipWindowRef.current.close();
      } catch {
        // ignore
      }
    }
    pipWindowRef.current = null;
    setIsOpen(false);
    setMode(null);
    wasHiddenSinceOpenRef.current = false;
    openedByMinimizeRef.current = false;
  }, [cleanupVideoPip]);

  const renderDocumentPipContents = useCallback((win: Window) => {
    const doc = win.document;
    const { currentVideo: vid, isPlaying: playing, hasNext: nextAvail } = propsRef.current;

    const titleEl = doc.getElementById('ct-pip-title');
    const channelEl = doc.getElementById('ct-pip-channel');
    const thumbEl = doc.getElementById('ct-pip-thumb') as HTMLImageElement | null;
    const statusEl = doc.getElementById('ct-pip-status');
    const playBtn = doc.getElementById('ct-pip-play');
    const nextBtn = doc.getElementById('ct-pip-next') as HTMLButtonElement | null;

    if (titleEl) titleEl.textContent = vid?.title || 'Tidak ada audio aktif';
    if (channelEl) channelEl.textContent = vid?.channelTitle || 'CastTube';
    if (thumbEl && vid?.thumbnail && thumbEl.src !== vid.thumbnail) {
      thumbEl.src = vid.thumbnail;
      thumbEl.alt = vid.title;
    }
    if (statusEl) {
      statusEl.textContent = playing ? 'Audio Popup Aktif · Audio Saja' : 'Audio Dijeda · Audio Saja';
      statusEl.style.color = playing ? '#34d399' : '#94a3b8';
    }
    if (playBtn) {
      playBtn.textContent = playing ? 'Jeda' : 'Putar';
      playBtn.setAttribute('aria-label', playing ? 'Jeda' : 'Putar');
    }
    if (nextBtn) {
      nextBtn.disabled = !nextAvail;
      nextBtn.style.opacity = nextAvail ? '1' : '0.4';
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
    }
  }, [
    mode,
    currentVideo?.id,
    currentVideo?.title,
    isPlaying,
    hasNext,
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

  const drawAudioPipFrame = useCallback(() => {
    const vp = videoPipStateRef.current;
    const canvas = vp.canvasEl;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vid = propsRef.current.currentVideo;
    const playing = propsRef.current.isPlaying;
    const colors = getActiveCssThemeColors();
    const w = canvas.width;
    const h = canvas.height;

    if (vid && vp.thumbVideoId !== vid.id) {
      vp.thumbVideoId = vid.id;
      vp.thumbImg = null;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        if (videoPipStateRef.current.thumbVideoId === vid.id) {
          videoPipStateRef.current.thumbImg = img;
        }
      };
      img.src = `https://i.ytimg.com/vi/${encodeURIComponent(vid.id)}/mqdefault.jpg`;
    }

    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#090d1a');
    bgGrad.addColorStop(1, '#111827');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const orb1 = ctx.createRadialGradient(w * 0.15, h * 0.18, 10, w * 0.15, h * 0.18, w * 0.55);
    orb1.addColorStop(0, `${colors.startHex}44`);
    orb1.addColorStop(1, 'transparent');
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, w, h);

    const orb2 = ctx.createRadialGradient(w * 0.88, h * 0.82, 10, w * 0.88, h * 0.82, w * 0.55);
    orb2.addColorStop(0, `${colors.glowHex}3d`);
    orb2.addColorStop(1, 'transparent');
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, w, h);

    const barGrad = ctx.createLinearGradient(0, 0, w, 0);
    barGrad.addColorStop(0, colors.startHex);
    barGrad.addColorStop(0.5, colors.midHex);
    barGrad.addColorStop(1, colors.glowHex);
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, w, 6);

    const artX = 28;
    const artY = 44;
    const artW = 192;
    const artH = 144;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(artX, artY, artW, artH, 18);
    ctx.clip();
    if (vp.thumbImg && vp.thumbImg.complete && vp.thumbImg.naturalWidth > 0) {
      try {
        ctx.drawImage(vp.thumbImg, artX, artY, artW, artH);
      } catch {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(artX, artY, artW, artH);
      }
    } else {
      const artGrad = ctx.createLinearGradient(artX, artY, artX + artW, artY + artH);
      artGrad.addColorStop(0, colors.startHex);
      artGrad.addColorStop(1, colors.endHex);
      ctx.fillStyle = artGrad;
      ctx.fillRect(artX, artY, artW, artH);
    }
    ctx.restore();

    // Animated equalizer bars representing audio-only mode
    const eqCount = 14;
    const nowSec = Date.now() / 160;
    const eqStartX = 244;
    const eqBaseY = 236;
    for (let i = 0; i < eqCount; i++) {
      const amp = playing ? 0.35 + 0.65 * Math.abs(Math.sin(nowSec + i * 0.65)) : 0.18;
      const barH = Math.round(10 + amp * 34);
      const bx = eqStartX + i * 16;
      ctx.fillStyle = i % 2 === 0 ? colors.midHex : colors.glowHex;
      ctx.beginPath();
      ctx.roundRect(bx, eqBaseY - barH, 9, barH, 4);
      ctx.fill();
    }

    ctx.fillStyle = playing ? '#34d399' : '#94a3b8';
    ctx.font = '700 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(playing ? 'AUDIO POPUP AKTIF' : 'AUDIO DIJEDA', 244, 68);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    const rawTitle = vid?.title || 'CastTube';
    const words = rawTitle.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      if ((line1 + ' ' + word).trim().length <= 28 && !line2) {
        line1 = (line1 + ' ' + word).trim();
      } else if ((line2 + ' ' + word).trim().length <= 26) {
        line2 = (line2 + ' ' + word).trim();
      } else {
        line2 = line2 ? `${line2.replace(/\s+$/, '')}…` : `${line1}…`;
        break;
      }
    }
    ctx.fillText(line1, 244, 108);
    if (line2) {
      ctx.fillText(line2, 244, 138);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 17px system-ui, -apple-system, sans-serif';
    ctx.fillText((vid?.channelTitle || 'CastTube').slice(0, 34), 244, 174);

    const snap = getPlaybackClockSnapshot();
    const pct = snap.duration > 0 ? Math.min(1, Math.max(0, snap.currentTime / snap.duration)) : 0;
    const trackX = 28;
    const trackY = 288;
    const trackW = w - 56;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.beginPath();
    ctx.roundRect(trackX, trackY, trackW, 10, 5);
    ctx.fill();
    if (pct > 0) {
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(trackX, trackY, Math.max(12, trackW * pct), 10, 5);
      ctx.fill();
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 16px ui-monospace, monospace';
    ctx.fillText(`${formatTime(snap.currentTime)} / ${formatTime(snap.duration)}`, trackX, 326);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('CastTube Audio PiP', w - 196, 326);
  }, []);

  const openOsPipWindow = useCallback(
    async (options?: OpenFloatingPopupOptions): Promise<boolean> => {
      setError(null);
      if (options?.videoOverride) {
        propsRef.current.currentVideo = options.videoOverride;
      }
      if (!propsRef.current.currentVideo) {
        if (!options?.silent) {
          setError('Pilih atau putar audio terlebih dahulu untuk membuka jendela mengambang.');
        }
        return false;
      }

      // Desktop Document Picture-in-Picture (Audio-Only Controller Card)
      if (supportsDocumentPip && isTopWindow) {
        try {
          if (pipWindowRef.current && !pipWindowRef.current.closed) {
            if (!options?.silent) pipWindowRef.current.focus();
            renderDocumentPipContents(pipWindowRef.current);
            setIsOpen(true);
            setMode('document');
            return true;
          }
          cleanupResources();

          const api = (window as unknown as { documentPictureInPicture: DocumentPictureInPictureAPI })
            .documentPictureInPicture;
          const pipWin = await api.requestWindow({
            width: 392,
            height: 212,
          });
          pipWindowRef.current = pipWin;

          const doc = pipWin.document;
          doc.title = 'CastTube · Audio Popup';
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
              color: #f8fafc; padding: 14px; display: flex;
              flex-direction: column; justify-content: space-between; height: 100vh; overflow: hidden; gap: 10px;
            }
            .top { display: flex; gap: 12px; align-items: center; }
            .thumb { width: 64px; height: 64px; border-radius: 14px; object-fit: cover; background: #1e293b; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.14); }
            .meta { min-width: 0; flex: 1; }
            .status { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
            .title { font-size: 13px; font-weight: 700; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .channel { font-size: 11px; color: #94a3b8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .progress-wrap { margin-top: 2px; }
            .bar { width: 100%; height: 6px; border-radius: 999px; background: rgba(148,163,184,0.2); overflow: hidden; }
            .bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg, var(--ct-start), var(--ct-mid), var(--ct-end), var(--ct-glow)); transition: width 0.2s linear; }
            .time { margin-top: 5px; font-size: 11px; color: #cbd5e1; font-family: ui-monospace, monospace; display: flex; justify-content: space-between; }
            .controls { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
            button {
              border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 8px 10px; font-size: 11px; font-weight: 700;
              cursor: pointer; background: rgba(30,41,59,0.85); color: #e2e8f0; transition: transform 0.15s, background 0.15s; white-space: nowrap;
            }
            button:hover { background: rgba(51,65,85,0.95); }
            button.primary { background: linear-gradient(135deg, var(--ct-start), var(--ct-mid), var(--ct-end)); color: var(--ct-btn-text); flex: 1; border: 0; }
            button.primary:hover { filter: brightness(1.08); }
            button:disabled { cursor: not-allowed; }
          `;
          doc.head.appendChild(style);

          doc.body.innerHTML = `
            <div class="top">
              <img id="ct-pip-thumb" class="thumb" referrerpolicy="no-referrer" alt="" />
              <div class="meta">
                <div id="ct-pip-status" class="status"></div>
                <div id="ct-pip-title" class="title"></div>
                <div id="ct-pip-channel" class="channel"></div>
              </div>
            </div>
            <div class="progress-wrap">
              <div class="bar"><div id="ct-pip-bar-fill" class="bar-fill"></div></div>
              <div class="time">
                <span id="ct-pip-time">0:00 / 0:00</span>
                <span>Audio Saja</span>
              </div>
            </div>
            <div class="controls">
              <button id="ct-pip-back" type="button">-15d</button>
              <button id="ct-pip-play" class="primary" type="button">Putar</button>
              <button id="ct-pip-fwd" type="button">+30d</button>
              <button id="ct-pip-next" type="button">Lanjut</button>
            </div>
          `;

          doc.getElementById('ct-pip-back')?.addEventListener('click', () => propsRef.current.onSkipBack(15));
          doc.getElementById('ct-pip-play')?.addEventListener('click', () => propsRef.current.onPlayPause());
          doc.getElementById('ct-pip-fwd')?.addEventListener('click', () => propsRef.current.onSkipForward(30));
          doc.getElementById('ct-pip-next')?.addEventListener('click', () => propsRef.current.onNext());

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

      // Mobile/Desktop Visual Audio OS PiP via muted Canvas Stream (lightweight, zero MP4 download)
      if (supportsVideoPip && supportsCanvasCapture && isTopWindow) {
        try {
          cleanupResources();
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 360;
          const videoEl = document.createElement('video') as PipVideoElement;
          videoEl.muted = true;
          videoEl.playsInline = true;
          videoEl.autoplay = true;
          videoEl.setAttribute('playsinline', '');
          videoEl.setAttribute('webkit-playsinline', '');
          videoEl.style.position = 'fixed';
          videoEl.style.top = '-9999px';
          videoEl.style.left = '0';
          videoEl.style.width = '2px';
          videoEl.style.height = '2px';
          videoEl.style.opacity = '0.01';
          videoEl.style.pointerEvents = 'none';
          document.body.appendChild(videoEl);

          videoPipStateRef.current.canvasEl = canvas;
          videoPipStateRef.current.videoEl = videoEl;

          drawAudioPipFrame();
          const stream = canvas.captureStream(8);
          videoEl.srcObject = stream;
          videoPipStateRef.current.drawInterval = setInterval(drawAudioPipFrame, 160);

          await videoEl.play();

          let entered = false;
          if (
            typeof videoEl.requestPictureInPicture === 'function' &&
            document.pictureInPictureEnabled
          ) {
            await videoEl.requestPictureInPicture();
            entered = true;
          } else if (
            typeof videoEl.webkitSupportsPresentationMode === 'function' &&
            videoEl.webkitSupportsPresentationMode('picture-in-picture') &&
            typeof videoEl.webkitSetPresentationMode === 'function'
          ) {
            videoEl.webkitSetPresentationMode('picture-in-picture');
            entered = true;
          }

          if (entered) {
            const onLeavePip = () => {
              cleanupVideoPip();
              if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                setIsOpen(true);
                setMode('inapp');
              } else {
                setIsOpen(false);
                setMode(null);
              }
            };
            const onWebkitMode = () => {
              if (videoEl.webkitPresentationMode !== 'picture-in-picture') {
                onLeavePip();
              }
            };
            const onVideoPlay = () => {
              if (!propsRef.current.isPlaying) {
                propsRef.current.onPlayPause();
              }
            };
            const onVideoPause = () => {
              if (
                propsRef.current.isPlaying &&
                (document.pictureInPictureElement === videoEl ||
                  videoEl.webkitPresentationMode === 'picture-in-picture')
              ) {
                propsRef.current.onPlayPause();
              }
            };
            videoEl.addEventListener('leavepictureinpicture', onLeavePip);
            videoEl.addEventListener('webkitpresentationmodechanged', onWebkitMode);
            videoEl.addEventListener('play', onVideoPlay);
            videoEl.addEventListener('pause', onVideoPause);
            videoPipStateRef.current.cleanupListeners = () => {
              videoEl.removeEventListener('leavepictureinpicture', onLeavePip);
              videoEl.removeEventListener('webkitpresentationmodechanged', onWebkitMode);
              videoEl.removeEventListener('play', onVideoPlay);
              videoEl.removeEventListener('pause', onVideoPause);
            };

            setIsOpen(true);
            setMode('video');
            openedByMinimizeRef.current = false;
            wasHiddenSinceOpenRef.current =
              typeof document !== 'undefined' && document.visibilityState === 'hidden';
            return true;
          }
          cleanupResources();
        } catch {
          cleanupResources();
        }
      }

      // Always fall back seamlessly to Audio-Only In-App Floating Popup
      setIsOpen(true);
      setMode('inapp');
      return true;
    },
    [
      supportsDocumentPip,
      supportsVideoPip,
      supportsCanvasCapture,
      isTopWindow,
      cleanupResources,
      cleanupVideoPip,
      drawAudioPipFrame,
      renderDocumentPipContents,
    ]
  );

  const openPopup = useCallback(
    async (options?: OpenFloatingPopupOptions): Promise<boolean> => {
      setError(null);
      if (options?.videoOverride) {
        propsRef.current.currentVideo = options.videoOverride;
      }
      if (!propsRef.current.currentVideo) {
        if (!options?.silent) {
          setError('Putar audio atau episode terlebih dahulu sebelum membuka popup.');
        }
        return false;
      }

      const isMinimizeContext =
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden' &&
        !options?.manual;

      if ((modeRef.current === 'inapp' || modeRef.current === 'video') && isOpenRef.current) {
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

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      !(supportsDocumentPip || supportsVideoPip)
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
        if (supportsDocumentPip && isTopWindow) {
          void openOsPipWindow({ silent: true });
        } else {
          void openPopup({ silent: true });
        }
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
  }, [
    autoPopupOnMinimize,
    currentVideo?.id,
    isPlaying,
    isTopWindow,
    openOsPipWindow,
    openPopup,
    supportsDocumentPip,
    supportsVideoPip,
  ]);

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
    mode,
    error,
    openPopup,
    openOsPipWindow,
    closePopup,
    togglePopup,
  };
}
