import { useState, useRef, useCallback, useEffect } from 'react';
import { Video } from '../types';

export type AudioDownloadStatus = 'preparing' | 'downloading' | 'completed' | 'error';

export interface AudioDownloadItem {
  status: AudioDownloadStatus;
  progress: number | null;
  loadedBytes: number;
  totalBytes: number;
  filename?: string;
  error?: string;
}

export interface AudioDownloadNotice {
  videoId: string;
  title: string;
  type: 'success' | 'error';
  message: string;
}

function getFallbackExtension(mimeType: string): string {
  const clean = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (clean.includes('webm')) return 'webm';
  if (clean.includes('ogg') || clean.includes('opus')) return 'ogg';
  if (clean.includes('mpeg') || clean.includes('mp3')) return 'mp3';
  if (clean === 'video/mp4') return 'mp4';
  return 'm4a';
}

function extractFilenameFromHeaders(
  res: Response,
  fallbackTitle: string,
  videoId: string,
  mimeType: string
): string {
  const suggested = res.headers.get('x-suggested-filename');
  if (suggested) {
    try {
      const decoded = decodeURIComponent(suggested).trim();
      if (decoded) return decoded;
    } catch {
      // ignore malformed header
    }
  }

  const disposition = res.headers.get('content-disposition') || '';
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      const decoded = decodeURIComponent(utf8Match[1]).trim();
      if (decoded) return decoded;
    } catch {
      // ignore
    }
  }
  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  const cleaned = fallbackTitle
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  const ext = getFallbackExtension(mimeType);
  return `${cleaned || `casttube-${videoId}`}.${ext}`;
}

export function useAudioDownload() {
  const [downloads, setDownloads] = useState<Record<string, AudioDownloadItem>>({});
  const [notice, setNotice] = useState<AudioDownloadNotice | null>(null);
  const controllersRef = useRef<Record<string, AbortController>>({});
  const resetTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((nextNotice: AudioDownloadNotice) => {
    setNotice(nextNotice);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
    }, 5500);
  }, []);

  const dismissNotice = useCallback(() => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    setNotice(null);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(controllersRef.current).forEach((ctrl) => ctrl.abort());
      Object.values(resetTimersRef.current).forEach((t) => clearTimeout(t));
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const clearDownloadState = useCallback((videoId: string) => {
    if (resetTimersRef.current[videoId]) {
      clearTimeout(resetTimersRef.current[videoId]);
      delete resetTimersRef.current[videoId];
    }
    setDownloads((prev) => {
      if (!prev[videoId]) return prev;
      const next = { ...prev };
      delete next[videoId];
      return next;
    });
  }, []);

  const startDownload = useCallback(
    async (video: Video) => {
      const videoId = video.id;

      // Clicking again while active cancels the in-flight download
      const existingController = controllersRef.current[videoId];
      if (existingController) {
        existingController.abort();
        delete controllersRef.current[videoId];
        clearDownloadState(videoId);
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const msg = 'Tidak dapat mengunduh audio saat offline.';
        setDownloads((prev) => ({
          ...prev,
          [videoId]: { status: 'error', progress: null, loadedBytes: 0, totalBytes: 0, error: msg },
        }));
        showNotice({ videoId, title: video.title, type: 'error', message: msg });
        return;
      }

      if (resetTimersRef.current[videoId]) {
        clearTimeout(resetTimersRef.current[videoId]);
        delete resetTimersRef.current[videoId];
      }

      const controller = new AbortController();
      controllersRef.current[videoId] = controller;

      setDownloads((prev) => ({
        ...prev,
        [videoId]: { status: 'preparing', progress: null, loadedBytes: 0, totalBytes: 0 },
      }));

      const rawLabel = video.channelTitle ? `${video.channelTitle} - ${video.title}` : video.title;

      try {
        const url = `/api/youtube/audio-stream?videoId=${encodeURIComponent(videoId)}&download=1&title=${encodeURIComponent(rawLabel)}`;
        const res = await fetch(url, { signal: controller.signal });

        if (!res.ok) {
          let errPayload: { error?: string; status?: string } = {};
          try {
            errPayload = await res.json();
          } catch {
            // ignore non-JSON error
          }

          let friendlyMsg = errPayload.error || 'Gagal mengunduh audio untuk video ini.';
          if (errPayload.status === 'live_stream') {
            friendlyMsg = 'Siaran Live tidak dapat diunduh sebagai file audio.';
          } else if (errPayload.status === 'login_required') {
            friendlyMsg = 'YouTube membatasi ekstraksi audio langsung untuk video ini.';
          }

          setDownloads((prev) => ({
            ...prev,
            [videoId]: {
              status: 'error',
              progress: null,
              loadedBytes: 0,
              totalBytes: 0,
              error: friendlyMsg,
            },
          }));
          showNotice({ videoId, title: video.title, type: 'error', message: friendlyMsg });
          return;
        }

        const contentType = res.headers.get('content-type') || 'audio/mp4';
        const totalBytes = Number(res.headers.get('content-length') || 0);
        const filename = extractFilenameFromHeaders(res, rawLabel, videoId, contentType);

        setDownloads((prev) => ({
          ...prev,
          [videoId]: {
            status: 'downloading',
            progress: totalBytes > 0 ? 0 : null,
            loadedBytes: 0,
            totalBytes,
            filename,
          },
        }));

        let blob: Blob;
        if (res.body && typeof res.body.getReader === 'function') {
          const reader = res.body.getReader();
          const chunks: BlobPart[] = [];
          let loadedBytes = 0;
          let lastEmit = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              loadedBytes += value.byteLength;
              const now = Date.now();
              if (now - lastEmit >= 120) {
                lastEmit = now;
                const progress =
                  totalBytes > 0 ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100)) : null;
                setDownloads((prev) => ({
                  ...prev,
                  [videoId]: {
                    status: 'downloading',
                    progress,
                    loadedBytes,
                    totalBytes,
                    filename,
                  },
                }));
              }
            }
          }

          blob = new Blob(chunks, { type: contentType.split(';')[0].trim() || 'audio/mp4' });
        } else {
          blob = await res.blob();
        }

        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);

        setDownloads((prev) => ({
          ...prev,
          [videoId]: {
            status: 'completed',
            progress: 100,
            loadedBytes: blob.size,
            totalBytes: totalBytes || blob.size,
            filename,
          },
        }));

        showNotice({
          videoId,
          title: video.title,
          type: 'success',
          message: `Audio berhasil diunduh: ${filename}`,
        });

        resetTimersRef.current[videoId] = setTimeout(() => {
          clearDownloadState(videoId);
        }, 5000);
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') {
          clearDownloadState(videoId);
          return;
        }
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Terjadi kesalahan saat mengunduh audio.';
        setDownloads((prev) => ({
          ...prev,
          [videoId]: {
            status: 'error',
            progress: null,
            loadedBytes: 0,
            totalBytes: 0,
            error: msg,
          },
        }));
        showNotice({ videoId, title: video.title, type: 'error', message: msg });
      } finally {
        delete controllersRef.current[videoId];
      }
    },
    [clearDownloadState, showNotice]
  );

  return {
    downloads,
    notice,
    startDownload,
    clearDownloadState,
    dismissNotice,
  };
}
