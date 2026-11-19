import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeAudioStatus, Video } from '../types';
import { formatTime } from '../utils/format';
import {
  getPlaybackClockSnapshot,
  setPlaybackClock,
  subscribePlaybackClock,
} from '../utils/playbackClock';

interface DocumentPictureInPictureAPI {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window?: Window | null;
}

interface UseFloatingMiniPlayerOptions {
  currentVideo: Video | null;
  isPlaying: boolean;
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
}

export type FloatingPopupMode = 'document' | 'video' | null;

function renderCanvasCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  video: Video | null,
  isPlaying: boolean,
  usingNativeAudio: boolean,
  nativeAudioStatus: NativeAudioStatus,
  currentTime: number,
  duration: number
) {
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.55, '#1e293b');
  grad.addColorStop(1, '#450a0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.85,
    height * 0.2,
    10,
    width * 0.85,
    height * 0.2,
    180
  );
  glow.addColorStop(0, 'rgba(220, 38, 38, 0.35)');
  glow.addColorStop(1, 'rgba(220, 38, 38, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.roundRect(24, 22, 12, 12, 6);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('CastTube', 44, 33);

  ctx.fillStyle = usingNativeAudio ? '#34d399' : '#fbbf24';
  ctx.font = '600 12px system-ui, -apple-system, sans-serif';
  const statusLabel = usingNativeAudio
    ? isPlaying
      ? 'Audio Latar Aktif'
      : 'Dijeda'
    : nativeAudioStatus === 'login_required'
    ? 'Perlu Akun TV / Cookie'
    : nativeAudioStatus === 'live_stream'
    ? 'Siaran Live'
    : 'Pemutar YouTube';
  ctx.fillText(statusLabel, width - ctx.measureText(statusLabel).width - 24, 33);

  const title = video?.title || 'Tidak ada pemutaran';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  const maxWidth = width - 48;

  for (const w of words) {
    const test = currentLine ? `${currentLine} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = w;
      if (lines.length === 2) break;
    } else {
      currentLine = test;
    }
  }
  if (lines.length < 2 && currentLine) {
    lines.push(currentLine);
  }
  if (lines.length === 2 && words.length > 0 && lines.join(' ').length < title.length) {
    lines[1] = `${lines[1].slice(0, Math.max(0, lines[1].length - 3))}...`;
  }

  lines.forEach((line, idx) => {
    ctx.fillText(line, 24, 92 + idx * 28);
  });

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(video?.channelTitle || 'CastTube Audio', 24, 158);

  const baseEqY = 205;
  const phase = Date.now() / 160;
  for (let b = 0; b < 5; b++) {
    const h = isPlaying ? 8 + Math.abs(Math.sin(phase + b * 0.9)) * 18 : 6;
    ctx.fillStyle = b % 2 === 0 ? '#ef4444' : '#f87171';
    ctx.beginPath();
    ctx.roundRect(24 + b * 9, baseEqY - h, 5, h, 2);
    ctx.fill();
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  const timeText = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  ctx.fillText(timeText, width - ctx.measureText(timeText).width - 24, 204);

  const barY = 226;
  const barW = width - 48;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.beginPath();
  ctx.roundRect(24, barY, barW, 6, 3);
  ctx.fill();

  const pct = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  if (pct > 0) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(24, barY, Math.max(8, barW * pct), 6, 3);
    ctx.fill();
  }
}

export function useFloatingMiniPlayer({
  currentVideo,
  isPlaying,
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
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockUnsubRef = useRef<(() => void) | null>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const wasHiddenSinceOpenRef = useRef(false);
  const lastAutoTriggerAtRef = useRef(0);
  const loadedEmbedKeyRef = useRef<string | null>(null);
  const iframeReportedStateRef = useRef<{ videoId: string | null; playing: boolean | null }>({
    videoId: null,
    playing: null,
  });

  const propsRef = useRef({
    currentVideo,
    isPlaying,
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

  const supportsDocumentPip =
    typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  const supportsVideoPip =
    typeof document !== 'undefined' &&
    Boolean(document.pictureInPictureEnabled) &&
    typeof HTMLVideoElement !== 'undefined' &&
    'requestPictureInPicture' in HTMLVideoElement.prototype;
  const isSupported = supportsDocumentPip || supportsVideoPip;

  const isPopupEmbedActive = Boolean(
    isOpen && mode === 'document' && !usingNativeAudio && currentVideo
  );

  const cleanupResources = useCallback(() => {
    if (clockUnsubRef.current) {
      clockUnsubRef.current();
      clockUnsubRef.current = null;
    }
    if (canvasTimerRef.current) {
      clearInterval(canvasTimerRef.current);
      canvasTimerRef.current = null;
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

    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      try {
        void document.exitPictureInPicture().catch(() => {});
      } catch {
        // ignore
      }
    }
    if (pipVideoRef.current) {
      const stream = pipVideoRef.current.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      pipVideoRef.current.srcObject = null;
      pipVideoRef.current.remove();
      pipVideoRef.current = null;
    }
    setIsOpen(false);
    setMode(null);
    wasHiddenSinceOpenRef.current = false;
  }, []);

  const renderDocumentPipContents = useCallback((win: Window) => {
    const doc = win.document;
    const {
      currentVideo: vid,
      isPlaying: playing,
      usingNativeAudio: native,
      nativeAudioStatus: status,
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
    const authBtn = doc.getElementById('ct-pip-auth-btn');

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
        ? 'Audio Latar Aktif'
        : 'Pemutar YouTube Mengambang (Bypass Pembatasan)';
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
        const startSec = snap.videoId === vid.id && snap.currentTime > 1 ? Math.floor(snap.currentTime) : 0;
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
        if (authBtn) {
          authBtn.style.display = status === 'live_stream' ? 'none' : 'inline-flex';
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
    }
  }, [
    mode,
    currentVideo?.id,
    currentVideo?.title,
    isPlaying,
    usingNativeAudio,
    nativeAudioStatus,
    hasNext,
    pipEmbedHost,
    renderDocumentPipContents,
  ]);

  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  const openPopup = useCallback(
    async (options?: OpenFloatingPopupOptions): Promise<boolean> => {
      const silent = Boolean(options?.silent);
      if (!silent) setError(null);
      if (options?.videoOverride) {
        propsRef.current.currentVideo = options.videoOverride;
      }
      if (!propsRef.current.currentVideo) {
        if (!silent) {
          setError('Putar video atau podcast terlebih dahulu sebelum membuka popup mengambang.');
        }
        return false;
      }

      // 1. Desktop Document Picture-in-Picture (interactive controller OR live YouTube embed when restricted)
      if (supportsDocumentPip) {
        try {
          if (pipWindowRef.current && !pipWindowRef.current.closed) {
            if (!silent) pipWindowRef.current.focus();
            renderDocumentPipContents(pipWindowRef.current);
            return true;
          }
          cleanupResources();

          const needsEmbed = !propsRef.current.usingNativeAudio;
          const api = (window as unknown as { documentPictureInPicture: DocumentPictureInPictureAPI })
            .documentPictureInPicture;
          const pipWin = await api.requestWindow({
            width: 396,
            height: needsEmbed ? 310 : 224,
          });
          pipWindowRef.current = pipWin;
          loadedEmbedKeyRef.current = null;

          const doc = pipWin.document;
          doc.title = 'CastTube · Pemutar Mengambang';
          const style = doc.createElement('style');
          style.textContent = `
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
            body {
              background: #0f172a; color: #f8fafc; padding: 12px; display: flex;
              flex-direction: column; justify-content: space-between; height: 100vh; overflow: hidden; gap: 10px;
            }
            .top { display: flex; gap: 12px; align-items: center; }
            .thumb { width: 72px; height: 54px; border-radius: 10px; object-fit: cover; background: #1e293b; flex-shrink: 0; }
            .meta { min-width: 0; flex: 1; }
            .status { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
            .title { font-size: 13px; font-weight: 700; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .channel { font-size: 11px; color: #94a3b8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .embed-wrap {
              display: none; position: relative; width: 100%; flex: 1; min-height: 180px;
              border-radius: 12px; overflow: hidden; background: #000; border: 1px solid #1e293b;
            }
            .embed-wrap iframe { width: 100%; height: 100%; border: 0; }
            .progress-wrap { margin-top: 4px; }
            .bar { width: 100%; height: 5px; border-radius: 999px; background: #1e293b; overflow: hidden; }
            .bar-fill { height: 100%; width: 0%; background: #dc2626; transition: width 0.2s linear; }
            .time { margin-top: 5px; font-size: 11px; color: #94a3b8; font-family: ui-monospace, monospace; display: flex; justify-content: space-between; }
            .controls { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
            .embed-controls { display: none; align-items: center; justify-content: space-between; gap: 6px; }
            button {
              border: 0; border-radius: 10px; padding: 8px 10px; font-size: 11px; font-weight: 700;
              cursor: pointer; background: #1e293b; color: #e2e8f0; transition: background 0.15s; white-space: nowrap;
            }
            button:hover { background: #334155; }
            button.primary { background: #dc2626; color: #fff; flex: 1; }
            button.primary:hover { background: #b91c1c; }
            button.amber { background: #d97706; color: #fff; }
            button.amber:hover { background: #b45309; }
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
                <span>Tetap aktif saat minimize</span>
              </div>
            </div>
            <div id="ct-pip-audio-controls" class="controls">
              <button id="ct-pip-back" type="button">-15d</button>
              <button id="ct-pip-play" class="primary" type="button">Putar</button>
              <button id="ct-pip-fwd" type="button">+30d</button>
              <button id="ct-pip-next" type="button">Lanjut</button>
            </div>
            <div id="ct-pip-embed-controls" class="embed-controls">
              <button id="ct-pip-host-btn" type="button">Host Standar</button>
              <button id="ct-pip-auth-btn" class="amber" type="button">Atasi Pembatasan</button>
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
          doc.getElementById('ct-pip-auth-btn')?.addEventListener('click', () => {
            try {
              window.focus();
            } catch {
              // ignore
            }
            propsRef.current.onOpenExtractorAuth?.();
          });

          const iframeEl = doc.getElementById('ct-pip-iframe') as HTMLIFrameElement | null;
          iframeEl?.addEventListener('load', () => {
            try {
              iframeEl.contentWindow?.postMessage(
                JSON.stringify({ event: 'listening', id: 1 }),
                '*'
              );
            } catch {
              // ignore
            }
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
              } else if (payload?.event === 'onError' && (payload?.info === 101 || payload?.info === 150 || payload?.info === 153)) {
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
          wasHiddenSinceOpenRef.current =
            typeof document !== 'undefined' && document.visibilityState === 'hidden';
          return true;
        } catch (err) {
          cleanupResources();
          if (!supportsVideoPip) {
            if (!silent) {
              setError(
                err instanceof Error
                  ? err.message
                  : 'Browser memblokir jendela popup Picture-in-Picture.'
              );
            }
            return false;
          }
        }
      }

      // 2. Mobile / Chrome Video Picture-in-Picture fallback via untainted offscreen canvas stream
      if (supportsVideoPip) {
        try {
          cleanupResources();
          const canvas = document.createElement('canvas');
          canvas.width = 480;
          canvas.height = 270;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas tidak didukung di browser ini.');

          const drawNow = () => {
            const snap = getPlaybackClockSnapshot();
            renderCanvasCard(
              ctx,
              canvas.width,
              canvas.height,
              propsRef.current.currentVideo,
              propsRef.current.isPlaying,
              propsRef.current.usingNativeAudio,
              propsRef.current.nativeAudioStatus,
              snap.currentTime,
              snap.duration
            );
          };
          drawNow();

          const stream = canvas.captureStream(4);
          const videoEl = document.createElement('video');
          videoEl.muted = true;
          videoEl.playsInline = true;
          videoEl.autoplay = true;
          videoEl.srcObject = stream;
          videoEl.className = 'fixed opacity-0 pointer-events-none w-px h-px -z-50';
          document.body.appendChild(videoEl);
          pipVideoRef.current = videoEl;

          await videoEl.play();
          await videoEl.requestPictureInPicture();

          canvasTimerRef.current = setInterval(drawNow, 500);
          videoEl.addEventListener('leavepictureinpicture', () => {
            cleanupResources();
          });

          setIsOpen(true);
          setMode('video');
          wasHiddenSinceOpenRef.current =
            typeof document !== 'undefined' && document.visibilityState === 'hidden';
          return true;
        } catch (err) {
          cleanupResources();
          if (!silent) {
            setError(
              err instanceof Error
                ? err.message
                : 'Mode Picture-in-Picture belum didukung atau diblokir oleh browser ini.'
            );
          }
          return false;
        }
      }

      if (!silent) {
        setError('Browser ini belum mendukung jendela popup mengambang (Picture-in-Picture).');
      }
      return false;
    },
    [cleanupResources, renderDocumentPipContents, supportsDocumentPip, supportsVideoPip]
  );

  const closePopup = useCallback(() => {
    cleanupResources();
  }, [cleanupResources]);

  const togglePopup = useCallback(async () => {
    if (isOpen) {
      closePopup();
      return false;
    }
    return openPopup();
  }, [isOpen, closePopup, openPopup]);

  // Register Chrome Automatic Picture-in-Picture (`enterpictureinpicture`) when enabled
  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      !isSupported
    ) {
      setSupportsAutoPip(false);
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
      return;
    }

    try {
      mediaSession.setActionHandler('enterpictureinpicture', () => {
        lastAutoTriggerAtRef.current = Date.now();
        void openPopup({ silent: true });
      });
      setSupportsAutoPip(true);
    } catch {
      setSupportsAutoPip(false);
    }

    return () => {
      try {
        mediaSession.setActionHandler('enterpictureinpicture', null);
      } catch {
        // ignore
      }
    };
  }, [autoPopupOnMinimize, currentVideo?.id, isPlaying, isSupported, openPopup]);

  // Auto-open fallback on minimize (if browser allows) and auto-close on return
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
          propsRef.current.currentVideo &&
          isSupported
        ) {
          fallbackTimer = setTimeout(() => {
            if (
              document.visibilityState === 'hidden' &&
              !isOpenRef.current &&
              Date.now() - lastAutoTriggerAtRef.current > 400
            ) {
              void openPopup({ silent: true });
            }
          }, 90);
        }
      } else {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        if (
          propsRef.current.autoClosePopupOnReturn &&
          isOpenRef.current &&
          wasHiddenSinceOpenRef.current
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
  }, [isSupported, openPopup, cleanupResources]);

  return {
    isSupported,
    supportsAutoPip,
    isOpen,
    isPopupEmbedActive,
    mode,
    error,
    openPopup,
    closePopup,
    togglePopup,
  };
}
