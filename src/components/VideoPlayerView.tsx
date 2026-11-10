import React, { useState } from 'react';
import {
  Headphones,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Share2,
  Check,
  ListMusic,
} from 'lucide-react';
import { Video } from '../types';
import { formatRelativeTime } from '../utils/format';

interface VideoPlayerViewProps {
  currentVideo: Video;
  queue: Video[];
  onSwitchToAudio: () => void;
  onPlayVideo: (video: Video) => void;
  onRemoveFromQueue: (videoId: string) => void;
  playerSlot?: React.ReactNode;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  currentVideo,
  queue,
  onSwitchToAudio,
  onPlayVideo,
  onRemoveFromQueue,
  playerSlot,
}) => {
  const [descExpanded, setDescExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

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
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-4 sm:p-6 md:p-8 transition-colors duration-200">
      {/* Top action strip */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
            Mode Video Aktif
          </span>
          <span className="text-xs text-slate-400">· 1080p HD Ready</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSwitchToAudio}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-sm transition-all cursor-pointer"
            title="Dengarkan sebagai podcast dengan visualizer frekuensi"
          >
            <Headphones className="w-4 h-4 animate-pulse" />
            <span>Mode Audio Saja (Podcast)</span>
          </button>
        </div>
      </div>

      {/* Main Video Presentation Grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left / Main column: Video Container & Metadata */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* 16:9 Video Player Container */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-lg">
            {playerSlot}
          </div>

          {/* Video Title & Actions */}
          <div className="text-left space-y-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              {currentVideo.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {currentVideo.channelTitle}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatRelativeTime(currentVideo.publishedAt)}
                    {currentVideo.views && ` · ${currentVideo.views} views`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Salin Link Video"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin' : 'Bagikan'}</span>
                </button>

                <a
                  href={`https://www.youtube.com/watch?v=${currentVideo.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>YouTube</span>
                </a>
              </div>
            </div>

            {/* Description accordion */}
            {currentVideo.description && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-700 dark:text-slate-300">
                <p className={`${descExpanded ? '' : 'line-clamp-2'} whitespace-pre-line leading-relaxed`}>
                  {currentVideo.description}
                </p>
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
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
          <div className="flex items-center gap-2 mb-3">
            <ListMusic className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Video Berikutnya ({queue.length})
            </h3>
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

                  <button
                    onClick={() => onRemoveFromQueue(item.id)}
                    className="text-xs text-slate-400 hover:text-red-500 p-1 cursor-pointer shrink-0"
                    title="Hapus dari antrean"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
