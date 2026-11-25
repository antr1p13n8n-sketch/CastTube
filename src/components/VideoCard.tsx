import React from 'react';
import { motion } from 'motion/react';
import { Play, Headphones, Plus, Check, ExternalLink, ListPlus, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { Video, PlaybackProgress } from '../types';
import { formatRelativeTime, formatTime } from '../utils/format';
import { AudioDownloadItem } from '../hooks/useAudioDownload';

interface VideoCardProps {
  video: Video;
  index?: number;
  isCurrentlyPlaying: boolean;
  isInQueue: boolean;
  isPlayed?: boolean;
  progress?: PlaybackProgress;
  downloadState?: AudioDownloadItem;
  onPlayVideo: (video: Video) => void;
  onPlayAudio: (video: Video) => void;
  onToggleQueue: (video: Video) => void;
  onAddToPlaylist?: (video: Video) => void;
  onTogglePlayed?: (videoId: string) => void;
  onDownloadAudio?: (video: Video) => void;
}

export const VideoCard: React.FC<VideoCardProps> = React.memo(({
  video,
  index = 0,
  isCurrentlyPlaying,
  isInQueue,
  isPlayed = false,
  progress,
  downloadState,
  onPlayVideo,
  onPlayAudio,
  onToggleQueue,
  onAddToPlaylist,
  onTogglePlayed,
  onDownloadAudio,
}) => {
  const progressPct =
    progress && progress.duration > 0
      ? Math.min(100, Math.max(0, (progress.currentTime / progress.duration) * 100))
      : 0;
  const shouldStagger = index < 6;
  const cardClassName = `video-card-auto group relative flex flex-col rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border transition-[transform,colors,shadow] duration-200 overflow-hidden hover:-translate-y-0.5 ${
    isCurrentlyPlaying
      ? 'casttube-card-active'
      : 'border-slate-200/90 dark:border-slate-800/90 casttube-card-hover'
  }`;

  const cardInner = (
    <>
      {/* Thumbnail area with overlay controls */}
      <div
        onClick={() => onPlayVideo(video)}
        className="relative aspect-video w-full bg-slate-900 overflow-hidden cursor-pointer"
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          loading={index < 4 ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.dataset.fallbackApplied) {
              img.dataset.fallbackApplied = '1';
              img.src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
            }
          }}
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
            isPlayed ? 'opacity-70' : ''
          }`}
        />

        {/* Gradient shadow overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent pointer-events-none" />

        {/* Currently playing badge */}
        {isCurrentlyPlaying && (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md casttube-gradient-btn text-[10px] font-bold tracking-wide uppercase flex items-center gap-1.5">
            <span className="flex items-end gap-0.5 h-2.5" aria-hidden="true">
              <span
                className="w-0.5 h-full bg-current rounded-full opacity-80 ct-eq-bar"
                style={{ animationDuration: '0.85s' }}
              />
              <span
                className="w-0.5 h-full bg-current rounded-full ct-eq-bar"
                style={{ animationDuration: '0.7s', animationDelay: '0.15s' }}
              />
              <span
                className="w-0.5 h-full bg-current rounded-full opacity-85 ct-eq-bar"
                style={{ animationDuration: '1s', animationDelay: '0.3s' }}
              />
            </span>
            Sedang Diputar
          </div>
        )}

        {/* Played status badge */}
        {isPlayed && (
          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold tracking-wide shadow-sm flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Sudah Diputar</span>
          </div>
        )}

        {/* Hover quick play buttons in center (hover-capable screens only so touch taps open immediately) */}
        <div className="hidden sm:[@media(hover:hover)]:flex absolute inset-0 items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-slate-950/55 backdrop-blur-[2px]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlayVideo(video);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold casttube-gradient-btn hover:brightness-110 rounded-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            title="Putar Video"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Video</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlayAudio(video);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900/90 hover:bg-slate-800 border border-white/25 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            title="Dengarkan Audio Podcast"
          >
            <Headphones className="w-3.5 h-3.5 text-white" />
            <span>Audio</span>
          </button>
        </div>

        {/* Subtle mobile/tablet touch tap-to-play indicator */}
        <div className="flex sm:[@media(hover:hover)]:hidden absolute bottom-2 left-2 w-7 h-7 rounded-full casttube-gradient-btn items-center justify-center pointer-events-none">
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        </div>

        {/* Duration / Live info bottom right */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-slate-950/85 font-mono text-[10px] font-medium text-white tabular-nums">
            {video.duration}
          </div>
        )}

        {/* Saved Playback Progress Bar */}
        {progressPct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/45">
            <div
              className="h-full casttube-gradient-bar"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Video Content Metadata */}
      <div className="p-4 flex flex-col flex-1 justify-between text-left">
        <div>
          <h3
            onClick={() => onPlayVideo(video)}
            className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug cursor-pointer hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] transition-colors"
            title={video.title}
          >
            {video.title}
          </h3>

          {/* Clean unboxed metadata with dot separators */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold casttube-accent-secondary-text truncate max-w-[150px]">
              {video.channelTitle}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatRelativeTime(video.publishedAt)}</span>
            {video.views && (
              <>
                <span aria-hidden="true">·</span>
                <span>{video.views}</span>
              </>
            )}
            {progress && progress.currentTime > 5 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums casttube-accent-text font-medium">
                  Lanjut {formatTime(progress.currentTime)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPlayAudio(video)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold casttube-soft-surface casttube-accent-secondary-text border hover:brightness-95 dark:hover:brightness-110 rounded-lg transition-all active:scale-95 cursor-pointer"
              title="Dengarkan Mode Podcast"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Podcast</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleQueue(video)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95 cursor-pointer ${
                isInQueue
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/50'
                  : 'text-slate-700 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30 dark:hover:text-amber-300'
              }`}
              title={isInQueue ? 'Sudah di antrean' : 'Tambah ke antrean podcast'}
            >
              {isInQueue ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isInQueue ? 'Antrean' : '+ Antrean'}</span>
            </button>

            {onAddToPlaylist && (
              <button
                type="button"
                onClick={() => onAddToPlaylist(video)}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800 hover:text-[var(--ct-text-light)] dark:hover:text-[var(--ct-text-dark)] rounded-lg transition-all active:scale-95 cursor-pointer"
                title="Simpan ke Playlist"
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>Playlist</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onDownloadAudio && (
              <button
                type="button"
                onClick={() => onDownloadAudio(video)}
                className={`p-2 rounded-lg transition-all active:scale-90 cursor-pointer flex items-center gap-1 ${
                  downloadState?.status === 'completed'
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                    : downloadState?.status === 'preparing' || downloadState?.status === 'downloading'
                    ? 'casttube-soft-surface casttube-accent-text'
                    : 'text-slate-400 hover:text-[var(--ct-end-light)] dark:hover:text-[var(--ct-end-dark)] hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={
                  downloadState?.status === 'preparing' || downloadState?.status === 'downloading'
                    ? 'Klik untuk membatalkan unduhan'
                    : 'Unduh Audio'
                }
              >
                {downloadState?.status === 'preparing' || downloadState?.status === 'downloading' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {downloadState.progress !== null && (
                      <span className="text-[10px] font-mono font-bold tabular-nums">
                        {downloadState.progress}%
                      </span>
                    )}
                  </>
                ) : downloadState?.status === 'completed' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
            )}

            {onTogglePlayed && (
              <button
                type="button"
                onClick={() => onTogglePlayed(video.id)}
                className={`p-2 rounded-lg transition-all active:scale-90 cursor-pointer ${
                  isPlayed
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                    : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
                title={isPlayed ? 'Tandai belum diputar' : 'Tandai sudah diputar'}
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}

            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
              title="Buka langsung di YouTube"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </>
  );

  if (!shouldStagger) {
    return <div className={cardClassName}>{cardInner}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.16,
        delay: index * 0.015,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cardClassName}
    >
      {cardInner}
    </motion.div>
  );
});
