import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ListMusic,
  Plus,
  Play,
  Headphones,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Search,
  Check,
  Edit2,
} from 'lucide-react';
import { Playlist, Video, PlayerMode } from '../types';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: Playlist[];
  videos: Video[];
  initialVideoToAdd?: Video | null;
  onCreatePlaylist: (name: string, description: string, initialVideoIds: string[]) => void;
  onUpdatePlaylist: (
    playlistId: string,
    updates: { name?: string; description?: string; videoIds?: string[] }
  ) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onPlayPlaylist: (orderedVideos: Video[], mode: PlayerMode) => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  onClose,
  playlists,
  videos,
  initialVideoToAdd = null,
  onCreatePlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onPlayPlaylist,
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [editingName, setEditingName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const [pickerSearch, setPickerSearch] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (playlists.length > 0 && (!selectedPlaylistId || !playlists.some((p) => p.id === selectedPlaylistId))) {
      setSelectedPlaylistId(playlists[0].id);
    }
    if (playlists.length === 0) {
      setIsCreating(true);
    }
  }, [isOpen, playlists, selectedPlaylistId]);

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId]
  );

  const videoMap = useMemo(() => {
    const map = new Map<string, Video>();
    for (const v of videos) map.set(v.id, v);
    return map;
  }, [videos]);

  const orderedPlaylistVideos = useMemo(() => {
    if (!activePlaylist) return [];
    return activePlaylist.videoIds
      .map((id) => videoMap.get(id))
      .filter((v): v is Video => Boolean(v));
  }, [activePlaylist, videoMap]);

  const filteredPickerVideos = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    const list = q
      ? videos.filter(
          (v) =>
            v.title.toLowerCase().includes(q) ||
            v.channelTitle.toLowerCase().includes(q)
        )
      : videos;
    return list.slice(0, 30);
  }, [videos, pickerSearch]);

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    const initialIds = initialVideoToAdd ? [initialVideoToAdd.id] : [];
    onCreatePlaylist(trimmed, newDescription.trim(), initialIds);
    setNewName('');
    setNewDescription('');
    setIsCreating(false);
  };

  const handleToggleVideoInPlaylist = (playlist: Playlist, videoId: string) => {
    const exists = playlist.videoIds.includes(videoId);
    const nextIds = exists
      ? playlist.videoIds.filter((id) => id !== videoId)
      : [...playlist.videoIds, videoId];
    onUpdatePlaylist(playlist.id, { videoIds: nextIds });
  };

  const handleMoveVideo = (index: number, direction: -1 | 1) => {
    if (!activePlaylist) return;
    const target = index + direction;
    if (target < 0 || target >= activePlaylist.videoIds.length) return;
    const nextIds = [...activePlaylist.videoIds];
    const [moved] = nextIds.splice(index, 1);
    nextIds.splice(target, 0, moved);
    onUpdatePlaylist(activePlaylist.id, { videoIds: nextIds });
  };

  const handleDropReorder = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex || !activePlaylist) {
      setDragIndex(null);
      return;
    }
    const nextIds = [...activePlaylist.videoIds];
    const [moved] = nextIds.splice(dragIndex, 1);
    nextIds.splice(dropIndex, 0, moved);
    onUpdatePlaylist(activePlaylist.id, { videoIds: nextIds });
    setDragIndex(null);
  };

  const handleSaveRename = () => {
    if (!activePlaylist) return;
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== activePlaylist.name) {
      onUpdatePlaylist(activePlaylist.id, { name: trimmed });
    }
    setIsRenaming(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-left transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-600 text-white shadow-sm">
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Playlist Kurasi Lintas Channel
              </h2>
              <p className="text-xs text-slate-500">
                Susun urutan video dari berbagai channel & sinkron otomatis ke Firestore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Add-To-Playlist Banner if opened from a VideoCard */}
        {initialVideoToAdd && (
          <div className="px-6 py-3 bg-red-50/80 dark:bg-red-950/30 border-b border-red-200/70 dark:border-red-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={initialVideoToAdd.thumbnail}
                alt={initialVideoToAdd.title}
                referrerPolicy="no-referrer"
                className="w-12 h-8 rounded-lg object-cover shrink-0"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-red-600 dark:text-red-400">
                  Tambahkan ke Playlist:
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {initialVideoToAdd.title}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {playlists.map((pl) => {
                const added = pl.videoIds.includes(initialVideoToAdd.id);
                return (
                  <button
                    key={pl.id}
                    onClick={() => handleToggleVideoInPlaylist(pl, initialVideoToAdd.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      added
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-red-400'
                    }`}
                  >
                    {added ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    <span>{pl.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 min-h-0">
          {/* Left Column: Playlists List & Create Form */}
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 p-4 space-y-3 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Daftar Playlist ({playlists.length})
              </span>
              <button
                onClick={() => setIsCreating((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Baru</span>
              </button>
            </div>

            {isCreating && (
              <form
                onSubmit={handleCreateSubmit}
                className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs"
              >
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nama playlist (misal: Podcast Pagi)..."
                  maxLength={100}
                  required
                  autoFocus
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Deskripsi singkat (opsional)..."
                  maxLength={500}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!newName.trim()}
                    className="px-3 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    Buat Playlist
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1.5">
              {playlists.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Belum ada playlist. Buat playlist pertama Anda di atas.
                </div>
              ) : (
                playlists.map((pl) => {
                  const isActive = pl.id === activePlaylist?.id;
                  return (
                    <button
                      key={pl.id}
                      onClick={() => {
                        setSelectedPlaylistId(pl.id);
                        setIsRenaming(false);
                      }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-white dark:bg-slate-800 border-red-400 dark:border-red-700 shadow-xs'
                          : 'bg-transparent border-transparent hover:bg-white/70 dark:hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {pl.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                          {pl.videoIds.length} video
                        </span>
                      </div>
                      {pl.description && (
                        <p className="mt-1 text-[11px] text-slate-500 truncate">{pl.description}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Playlist Editor & Video Picker */}
          <div className="md:col-span-8 p-5 space-y-5 overflow-y-auto">
            {!activePlaylist ? (
              <div className="py-16 text-center text-xs text-slate-400">
                Pilih atau buat playlist untuk mulai menyusun daftar video dari berbagai channel.
              </div>
            ) : (
              <>
                {/* Playlist Header & Play Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="min-w-0 flex-1">
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                          autoFocus
                          className="px-2.5 py-1 text-sm font-bold rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-red-500"
                        />
                        <button
                          onClick={handleSaveRename}
                          className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 rounded-lg cursor-pointer"
                        >
                          Simpan
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                          {activePlaylist.name}
                        </h3>
                        <button
                          onClick={() => {
                            setEditingName(activePlaylist.name);
                            setIsRenaming(true);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                          title="Ganti nama playlist"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            onDeletePlaylist(activePlaylist.id);
                            setSelectedPlaylistId(null);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Hapus playlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">
                      {orderedPlaylistVideos.length} video · Seret atau gunakan panah untuk mengubah urutan
                    </p>
                  </div>

                  {orderedPlaylistVideos.length > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          onPlayPlaylist(orderedPlaylistVideos, 'audio');
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        <Headphones className="w-3.5 h-3.5" />
                        <span>Putar Podcast</span>
                      </button>
                      <button
                        onClick={() => {
                          onPlayPlaylist(orderedPlaylistVideos, 'video');
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Putar Video</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Ordered Video List (Drag & Drop + Up/Down) */}
                <div className="space-y-2">
                  {orderedPlaylistVideos.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                      Playlist ini masih kosong. Pilih video dari daftar di bawah untuk menambahkannya.
                    </div>
                  ) : (
                    orderedPlaylistVideos.map((vid, idx) => (
                      <div
                        key={vid.id}
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDropReorder(idx)}
                        className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                          dragIndex === idx
                            ? 'opacity-50 border-red-400 bg-red-50/40 dark:bg-red-950/20'
                            : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800'
                        }`}
                      >
                        <div className="cursor-grab text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 w-5 text-center shrink-0">
                          {idx + 1}
                        </span>
                        <img
                          src={vid.thumbnail}
                          alt={vid.title}
                          referrerPolicy="no-referrer"
                          className="w-16 h-10 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {vid.title}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{vid.channelTitle}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleMoveVideo(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Pindah ke atas"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveVideo(idx, 1)}
                            disabled={idx === orderedPlaylistVideos.length - 1}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Pindah ke bawah"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleVideoInPlaylist(activePlaylist, vid.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Hapus dari playlist"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Videos from Any Channel */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Tambah Video dari Semua Channel
                    </span>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="Cari judul atau channel..."
                        className="w-full pl-8 pr-3 py-1 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {filteredPickerVideos.map((vid) => {
                      const inPlaylist = activePlaylist.videoIds.includes(vid.id);
                      return (
                        <button
                          key={vid.id}
                          type="button"
                          onClick={() => handleToggleVideoInPlaylist(activePlaylist, vid.id)}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                            inPlaylist
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                              : 'bg-white dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-red-300'
                          }`}
                        >
                          <img
                            src={vid.thumbnail}
                            alt={vid.title}
                            referrerPolicy="no-referrer"
                            className="w-14 h-9 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                              {vid.title}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">{vid.channelTitle}</div>
                          </div>
                          <div
                            className={`p-1 rounded-lg shrink-0 ${
                              inPlaylist
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                            }`}
                          >
                            {inPlaylist ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
