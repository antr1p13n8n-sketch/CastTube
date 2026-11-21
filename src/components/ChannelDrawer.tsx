import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Trash2, Youtube, Folder, Search } from 'lucide-react';
import { Channel, ChannelGroup } from '../types';

interface ChannelDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  groups: ChannelGroup[];
  onDeleteChannel: (channelId: string) => void;
  onChangeChannelGroup: (channelId: string, newGroupId: string) => void;
  onSelectChannelFilter: (channelId: string) => void;
}

export const ChannelDrawer: React.FC<ChannelDrawerProps> = ({
  isOpen,
  onClose,
  channels,
  groups,
  onDeleteChannel,
  onChangeChannelGroup,
  onSelectChannelFilter,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [filterQuery, setFilterQuery] = React.useState<string>('');

  React.useEffect(() => {
    if (!isOpen) {
      setConfirmDeleteId(null);
      setFilterQuery('');
    }
  }, [isOpen]);

  const filteredChannels = React.useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.handle && c.handle.toLowerCase().includes(q)) ||
        c.id.toLowerCase().includes(q)
    );
  }, [channels, filterQuery]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="channel-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm"
        >
          <motion.div
            key="channel-drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md h-[100dvh] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-fuchsia-200/70 dark:border-fuchsia-900/40 shadow-2xl p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col text-left transition-colors duration-200"
          >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500 via-fuchsia-500 to-indigo-600 text-white shadow-md shadow-fuchsia-500/25 shrink-0">
              <Youtube className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                Daftar Channel Langganan
              </h2>
              <p className="text-xs text-slate-500">
                {channels.length} channel dalam database Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter box when user has > 4 channels */}
        {channels.length > 4 && (
          <div className="pt-3 pb-1 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Cari channel langganan..."
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-fuchsia-500"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  aria-label="Hapus filter channel"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {channels.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Belum ada channel yang ditambahkan. Gunakan tombol "Cari &amp; Tambah" untuk menambahkan.
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Tidak ada channel yang cocok dengan "{filterQuery}".
            </div>
          ) : (
            filteredChannels.map((channel, idx) => {
              const isConfirming = confirmDeleteId === channel.id;

              return (
                <motion.div
                  key={channel.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx, 10) * 0.025, ease: [0.16, 1, 0.3, 1] }}
                  className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 hover:border-fuchsia-300 dark:hover:border-fuchsia-700/60 space-y-2.5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                      onClick={() => {
                        onSelectChannelFilter(channel.id);
                        onClose();
                      }}
                      title="Klik untuk memfilter video channel ini"
                    >
                      <img
                        src={channel.avatar || `https://avatar.vercel.sh/${channel.id}?size=100`}
                        alt={channel.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget;
                          const fallback = `https://avatar.vercel.sh/${channel.id}?size=100`;
                          if (img.src !== fallback) img.src = fallback;
                        }}
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-fuchsia-300/60 dark:border-fuchsia-700/60"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate hover:text-fuchsia-600 dark:hover:text-fuchsia-400 transition-colors">
                          {channel.title}
                        </div>
                        <div className="text-[11px] text-indigo-600 dark:text-cyan-400 truncate">
                          {channel.handle || channel.id}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg px-2 py-1">
                          <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                            Hapus?
                          </span>
                            <button
                              onClick={() => {
                                onDeleteChannel(channel.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold rounded bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                            >
                              Ya
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <>
                            <a
                              href={channel.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-300 transition-colors"
                              title="Buka Channel di YouTube"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => setConfirmDeleteId(channel.id)}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Hapus Channel"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Group Selector for this channel */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-xs">
                      <span className="text-slate-500 flex items-center gap-1 font-medium">
                        <Folder className="w-3.5 h-3.5 text-amber-500" />
                        Grup:
                      </span>
                      <select
                        value={channel.groupId}
                        onChange={(e) => onChangeChannelGroup(channel.id, e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-fuchsia-500"
                      >
                      {groups
                        .filter((g) => g.id !== 'all')
                        .map((grp) => (
                          <option key={grp.id} value={grp.id}>
                            {grp.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </motion.button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
