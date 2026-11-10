import React from 'react';
import { Play, Headphones, Plus, Check, ExternalLink } from 'lucide-react';
import { Video } from '../types';
import { formatRelativeTime } from '../utils/format';

interface VideoCardProps {
  video: Video;
  isCurrentlyPlaying: boolean;
  isInQueue: boolean;
  onPlayVideo: (video: Video) => void;
  onPlayAudio: (video: Video) => void;
  onToggleQueue: (video: Video) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isCurrentlyPlaying,
  isInQueue,
  onPlayVideo,
  onPlayAudio,
  onToggleQueue,
}) => {
  return (
    <div
      className={`group relative flex flex-col rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 overflow-hidden hover:shadow-lg ${
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
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient shadow overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Currently playing badge */}
        {isCurrentlyPlaying && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold tracking-wide uppercase shadow-sm flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            Sedang Diputar
          </div>
        )}

        {/* Hover quick play buttons in center */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[1px]">
          <button
            onClick={() => onPlayVideo(video)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg transition-transform hover:scale-105 cursor-pointer"
            title="Putar Video"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Video</span>
          </button>
          <button
            onClick={() => onPlayAudio(video)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 rounded-xl shadow-lg transition-transform hover:scale-105 cursor-pointer"
            title="Dengarkan Audio Podcast"
          >
            <Headphones className="w-3.5 h-3.5 text-red-600" />
            <span>Audio</span>
          </button>
        </div>

        {/* Duration / Live info bottom right */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] font-medium text-white tabular-nums">
            {video.duration}
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
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPlayAudio(video)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
              title="Dengarkan Mode Podcast"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Podcast</span>
            </button>

            <button
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
            </button>
          </div>

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
  );
};
