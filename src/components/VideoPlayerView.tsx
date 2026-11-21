import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Headphones,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Share2,
  Check,
  ListMusic,
  Maximize2,
  Download,
  Loader2,
  PictureInPicture2,
  Radio,
  ListPlus,
  CheckCircle2,
  Plus,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Video } from '../types';
import { formatRelativeTime, formatBytes } from '../utils/format';
import { AudioDownloadItem } from '../hooks/useAudioDownload';

interface VideoPlayerViewProps {
  currentVideo: Video;
  queue: Video[];
  onSwitchToAudio: () => void;
  onPlayVideo: (video: Video) => void;
  onRemoveFromQueue: (videoId: string) => void;
  onMoveQueueItem?: (index: number, direction: -1 | 1) => void;
  onClearQueue?: () => void;
  playerSlot?: React.ReactNode;
  isMiniPiP?: boolean;
  onExpandPiP?: () => void;
  downloadState?: AudioDownloadItem;
  onDownloadAudio?: (video: Video) => void;
  backgroundAudioEnabled?: boolean;
  onOpenBackgroundAudioPopup?: () => void;
  isFloatingSupported?: boolean;
  isFloatingOpen?: boolean;
  movedToPopup?: boolean;
  onToggleFloatingPopup?: () => void;
  onAddToPlaylist?: (video: Video) => void;
  isPlayed?: boolean;
  onTogglePlayed?: (videoId: string) => void;
  isChannelSubscribed?: boolean;
  isSubscribingChannel?: boolean;
  onSubscribeChannel?: (video: Video) => void;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = React.memo(({
  currentVideo,
  queue,
  onSwitchToAudio,
  onPlayVideo,
  onRemoveFromQueue,
  onMoveQueueItem,
  onClearQueue,
  playerSlot,
  isMiniPiP = false,
  onExpandPiP,
  downloadState,
  onDownloadAudio,
  backgroundAudioEnabled = false,
  onOpenBackgroundAudioPopup,
  isFloatingSupported = false,
  isFloatingOpen = false,
  movedToPopup = false,
  onToggleFloatingPopup,
  onAddToPlaylist,
  isPlayed = false,
  onTogglePlayed,
  isChannelSubscribed = true,
  isSubscribingChannel = false,
  onSubscribeChannel,
}) => {
  const [descExpanded, setDescExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleShare = async () => {
    const shareUrl = `https://www.youtube.com/watch?v=${currentVideo.id}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        // ignore if blocked
      }
    }
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  if (isMiniPiP) {
    return (
      <div className="relative w-full h-full group bg-black overflow-hidden rounded-2xl">
        {playerSlot}
        <button
          type="button"
          onClick={onExpandPiP}
          className="hidden sm:[@media(hover:hover)]:flex absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 items-center justify-center gap-1.5 text-white text-xs font-semibold transition-opacity cursor-pointer z-10"
          title="Perbesar Pemutar Video"
        >
          <Maximize2 className="w-4 h-4" />
          <span>Buka Video Penuh</span>
        </button>
        <button
          type="button"
          onClick={onExpandPiP}
          className="flex sm:[@media(hover:hover)]:hidden absolute top-1.5 right-1.5 p-2 rounded-lg bg-black/75 text-white shadow-md backdrop-blur-xs z-20 active:scale-90 transition-transform cursor-pointer"
          title="Perbesar Pemutar Video"
          aria-label="Perbesar Pemutar Video"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl shadow-indigo-950/10 overflow-hidden p-4 sm:p-6 md:p-8 transition-colors duration-200">
      {/* Top action strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent">
            Mode Video Aktif
          </span>
          <span className="text-xs text-slate-400">· 1080p HD Ready</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenBackgroundAudioPopup && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onOpenBackgroundAudioPopup}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                backgroundAudioEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                  : 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="Pengaturan Popup Otomatis & Audio Latar"
            >
              <Radio className="w-3.5 h-3.5 text-fuchsia-500" />
              <span>Audio Latar</span>
            </motion.button>
          )}

          {isFloatingSupported && onToggleFloatingPopup && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onToggleFloatingPopup}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                isFloatingOpen
                  ? 'bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 text-white shadow-md shadow-fuchsia-500/25'
                  : 'text-indigo-700 dark:text-cyan-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
              }`}
              title={isFloatingOpen ? 'Tutup Popup Mengambang' : 'Buka Popup Mengambang'}
            >
              <PictureInPicture2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isFloatingOpen ? 'Tutup Popup' : 'Popup'}</span>
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSwitchToAudio}
            className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-600 hover:brightness-110 rounded-xl shadow-md shadow-fuchsia-500/25 transition-all cursor-pointer"
            title="Dengarkan sebagai podcast dengan visualizer frekuensi"
          >
            <Headphones className="w-4 h-4 animate-pulse" />
            <span>Mode Audio Saja (Podcast)</span>
          </motion.button>
        </div>
      </div>

      {/* Main Video Presentation Grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left / Main column: Video Container & Metadata */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* 16:9 Video Player Container */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-xl ring-1 ring-fuchsia-500/25">
            {playerSlot}
            {movedToPopup && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-5 text-center bg-slate-950/85 backdrop-blur-md">
                <img
                  src={currentVideo.thumbnail}
                  alt={currentVideo.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                />
                <div className="relative z-10 max-w-sm space-y-3">
                  <div className="w-12 h-12 rounded-2xl mx-auto bg-gradient-to-tr from-rose-500 via-fuchsia-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
                    <PictureInPicture2 className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-white">
                    Sedang Diputar di Popup Mengambang
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Video berjalan aktif di jendela popup yang bebas digeser saat Anda menelusuri daftar video.
                  </p>
                  {onToggleFloatingPopup && (
                    <button
                      type="button"
                      onClick={onToggleFloatingPopup}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 hover:brightness-110 shadow-md shadow-fuchsia-500/25 transition-all cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Kembalikan ke Pemutar Utama</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Video Title & Actions */}
          <div className="text-left space-y-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              {currentVideo.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-indigo-700 dark:text-cyan-300">
                      {currentVideo.channelTitle}
                    </span>
                    {!isChannelSubscribed && onSubscribeChannel && currentVideo.channelId && (
                      <button
                        type="button"
                        disabled={isSubscribingChannel}
                        onClick={() => onSubscribeChannel(currentVideo)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-rose-500 to-fuchsia-600 text-white hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                        title="Tambahkan channel ini ke langganan Anda"
                      >
                        {isSubscribingChannel ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                        <span>Ikuti Channel</span>
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {formatRelativeTime(currentVideo.publishedAt)}
                    {currentVideo.views && ` · ${currentVideo.views} views`}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onAddToPlaylist && (
                  <button
                    type="button"
                    onClick={() => onAddToPlaylist(currentVideo)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-50 dark:bg-fuchsia-950/40 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/50 rounded-lg transition-colors cursor-pointer"
                    title="Simpan ke Playlist"
                  >
                    <ListPlus className="w-3.5 h-3.5" />
                    <span>Playlist</span>
                  </button>
                )}

                {onTogglePlayed && (
                  <button
                    type="button"
                    onClick={() => onTogglePlayed(currentVideo.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      isPlayed
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    title={isPlayed ? 'Sudah Diputar' : 'Tandai Sudah Diputar'}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isPlayed ? 'Sudah Diputar' : 'Tandai Diputar'}</span>
                  </button>
                )}

                {onDownloadAudio && (
                  <button
                    onClick={() => onDownloadAudio(currentVideo)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      downloadState?.status === 'completed'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : downloadState?.status === 'preparing' || downloadState?.status === 'downloading'
                        ? 'bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-600 dark:text-fuchsia-400'
                        : 'text-indigo-700 dark:text-cyan-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                    }`}
                    title={
                      downloadState?.status === 'downloading' || downloadState?.status === 'preparing'
                        ? 'Klik untuk membatalkan unduhan'
                        : 'Unduh Audio Offline'
                    }
                  >
                    {downloadState?.status === 'preparing' || downloadState?.status === 'downloading' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="tabular-nums">
                          {downloadState.progress !== null
                            ? `${downloadState.progress}%`
                            : downloadState.loadedBytes > 0
                            ? formatBytes(downloadState.loadedBytes)
                            : 'Menyiapkan...'}
                        </span>
                      </>
                    ) : downloadState?.status === 'completed' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Tersimpan</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh Audio</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Salin Link Video"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5 text-amber-500" />}
                  <span>{copied ? 'Tersalin' : 'Bagikan'}</span>
                </button>

                <a
                  href={`https://www.youtube.com/watch?v=${currentVideo.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>YouTube</span>
                </a>
              </div>
            </div>

            {/* Description accordion */}
            {currentVideo.description && (
              <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 text-xs text-slate-700 dark:text-slate-300">
                <p className={`${descExpanded ? '' : 'line-clamp-2'} whitespace-pre-line leading-relaxed`}>
                  {currentVideo.description}
                </p>
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="mt-2 text-xs font-semibold text-indigo-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {descExpanded ? (
                    <>
                      <span>Sembunyikan</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Lihat Selengkapnya</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Next Up Playlist Queue */}
        <div className="lg:col-span-4 flex flex-col text-left">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-fuchsia-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Video Berikutnya ({queue.length})
              </h3>
            </div>
            {queue.length > 0 && onClearQueue && (
              <button
                type="button"
                onClick={onClearQueue}
                className="text-xs font-semibold text-red-500 hover:text-red-600 cursor-pointer"
              >
                Bersihkan
              </button>
            )}
          </div>

          <div className="flex-1 max-h-[500px] overflow-y-auto space-y-2 pr-1">
            {queue.length === 0 ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                Antrean kosong. Tambahkan video lain dari daftar video di bawah untuk memutar secara berurutan.
              </div>
            ) : (
              queue.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="group flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                    onClick={() => onPlayVideo(item)}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-16 h-10 rounded-lg object-cover shrink-0 group-hover:opacity-90 transition-opacity"
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

                  <div className="flex items-center gap-0.5 shrink-0">
                    {onMoveQueueItem && (
                      <>
                        <button
                          type="button"
                          onClick={() => onMoveQueueItem(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                          title="Naikkan urutan"
                          aria-label="Naikkan urutan"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveQueueItem(idx, 1)}
                          disabled={idx === queue.length - 1}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                          title="Turunkan urutan"
                          aria-label="Turunkan urutan"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onRemoveFromQueue(item.id)}
                      className="text-sm text-slate-400 hover:text-red-500 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg cursor-pointer"
                      title="Hapus dari antrean"
                      aria-label="Hapus dari antrean"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
