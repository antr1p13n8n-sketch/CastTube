import React from 'react';
import { X, ExternalLink, Trash2, Youtube, Folder } from 'lucide-react';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl p-6 flex flex-col text-left transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-600 text-white">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Daftar Channel Langganan
              </h2>
              <p className="text-xs text-slate-500">
                {channels.length} channel dalam database Anda
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

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {channels.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Belum ada channel yang ditambahkan. Gunakan tombol "Tambah Channel" untuk menambahkan.
            </div>
          ) : (
            channels.map((channel) => {
              const isConfirming = confirmDeleteId === channel.id;

              return (
                <div
                  key={channel.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2.5 transition-all"
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
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate hover:text-red-600 transition-colors">
                          {channel.title}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {channel.handle || channel.id}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1">
                          <span className="text-[11px] font-semibold text-red-700 dark:text-red-300">
                            Hapus?
                          </span>
                          <button
                            onClick={() => {
                              onDeleteChannel(channel.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-0.5 text-[11px] font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
                          >
                            Ya
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 text-[11px] font-medium rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
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
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                            title="Buka Channel di YouTube"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => setConfirmDeleteId(channel.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            title="Hapus Channel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Group Selector for this channel */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px]">
                    <span className="text-slate-500 flex items-center gap-1 font-medium">
                      <Folder className="w-3 h-3 text-red-500" />
                      Grup:
                    </span>
                    <select
                      value={channel.groupId}
                      onChange={(e) => onChangeChannelGroup(channel.id, e.target.value)}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-[11px] focus:outline-hidden"
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
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
