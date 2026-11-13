import React from 'react';
import { motion } from 'motion/react';
import { Play, Headphones, Plus, Check, ExternalLink, ListPlus, CheckCircle2 } from 'lucide-react';
import { Video, PlaybackProgress } from '../types';
import { formatRelativeTime, formatTime } from '../utils/format';

interface VideoCardProps {
  video: Video;
  index?: number;
  isCurrentlyPlaying: boolean;
  isInQueue: boolean;
  isPlayed?: boolean;
  progress?: PlaybackProgress;
  onPlayVideo: (video: Video) => void;
  onPlayAudio: (video: Video) => void;
  onToggleQueue: (video: Video) => void;
  onAddToPlaylist?: (video: Video) => void;
  onTogglePlayed?: (videoId: string) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  index = 0,
  isCurrentlyPlaying,
  isInQueue,
  isPlayed = false,
  progress,
  onPlayVideo,
  onPlayAudio,
  onToggleQueue,
  onAddToPlaylist,
  onTogglePlayed,
}) => {
  const progressPct =
    progress && progress.duration > 0
      ? Math.min(100, Math.max(0, (progress.currentTime / progress.duration) * 100))
      : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.24,
        delay: Math.min(index, 11) * 0.024,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -4, transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] } }}
      className={`group relative flex flex-col rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 overflow-hidden hover:shadow-xl ${
        isCurrentlyPlaying
          ? 'border-red-500 ring-2 ring-red-500/20'
          : 'border-slate-200/90 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Thumbnail area with overlay controls */}
      <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
        <img
          src={video.thumbnail}
          alt={video.title}
          referrerPolicy="no-referrer"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.dataset.fallbackApplied) {
              img.dataset.fallbackApplied = '1';
              img.src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
            }
          }}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
            isPlayed ? 'opacity-70' : ''
          }`}
        />

        {/* Gradient shadow overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Currently playing badge */}
        {isCurrentlyPlaying && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold tracking-wide uppercase shadow-sm flex items-center gap-1.5"
          >
            <span className="flex items-end gap-0.5 h-2.5" aria-hidden="true">
              <motion.span
                animate={{ scaleY: [0.35, 1, 0.45, 0.9, 0.35] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                className="w-0.5 h-full bg-white rounded-full origin-bottom"
              />
              <motion.span
                animate={{ scaleY: [0.85, 0.35, 1, 0.5, 0.85] }}
                transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
                className="w-0.5 h-full bg-white rounded-full origin-bottom"
              />
              <motion.span
                animate={{ scaleY: [0.5, 0.95, 0.35, 0.8, 0.5] }}
                transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut' }}
                className="w-0.5 h-full bg-white rounded-full origin-bottom"
              />
            </span>
            Sedang Diputar
          </motion.div>
        )}

        {/* Played status badge */}
        {isPlayed && (
          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-bold tracking-wide shadow-sm flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Sudah Diputar</span>
          </div>
        )}

        {/* Hover quick play buttons in center */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40 backdrop-blur-[1px]">
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => onPlayVideo(video)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg cursor-pointer"
            title="Putar Video"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Video</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => onPlayAudio(video)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 rounded-xl shadow-lg cursor-pointer"
            title="Dengarkan Audio Podcast"
          >
            <Headphones className="w-3.5 h-3.5 text-red-600" />
            <span>Audio</span>
          </motion.button>
        </div>

        {/* Duration / Live info bottom right */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] font-medium text-white tabular-nums">
            {video.duration}
          </div>
        )}

        {/* Saved Playback Progress Bar */}
        {progressPct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
            <div
              className="h-full bg-red-600 transition-all duration-300"
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
            className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug cursor-pointer hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title={video.title}
          >
            {video.title}
          </h3>

          {/* Clean unboxed metadata with dot separators */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
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
                <span className="font-mono tabular-nums text-red-600 dark:text-red-400 font-medium">
                  Lanjut {formatTime(progress.currentTime)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => onPlayAudio(video)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
              title="Dengarkan Mode Podcast"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Podcast</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => onToggleQueue(video)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                isInQueue
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title={isInQueue ? 'Sudah di antrean' : 'Tambah ke antrean podcast'}
            >
              {isInQueue ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isInQueue ? 'Antrean' : '+ Antrean'}</span>
            </motion.button>

            {onAddToPlaylist && (
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => onAddToPlaylist(video)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                title="Simpan ke Playlist"
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>Playlist</span>
              </motion.button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onTogglePlayed && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => onTogglePlayed(video.id)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isPlayed
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                    : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={isPlayed ? 'Tandai belum diputar' : 'Tandai sudah diputar'}
              >
                <CheckCircle2 className="w-4 h-4" />
              </motion.button>
            )}

            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Buka langsung di YouTube"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
