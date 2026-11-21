import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Edit2, Trash2, Check, Folder, Layers } from 'lucide-react';
import { Channel, ChannelGroup } from '../types';

interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ChannelGroup[];
  channels: Channel[];
  onAddGroup: (name: string) => void;
  onRenameGroup: (id: string, newName: string) => void;
  onDeleteGroup: (id: string) => void;
}

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  isOpen,
  onClose,
  groups,
  channels,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setEditingGroupId(null);
      setConfirmingDeleteId(null);
    }
  }, [isOpen]);

  const handleStartRename = (group: ChannelGroup) => {
    setConfirmingDeleteId(null);
    setEditingGroupId(group.id);
    setEditName(group.name);
  };

  const handleSaveRename = (groupId: string) => {
    if (editName.trim()) {
      onRenameGroup(groupId, editName.trim());
    }
    setEditingGroupId(null);
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    onAddGroup(newGroupName.trim());
    setNewGroupName('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="group-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
        >
          <motion.div
            key="group-modal-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-5 sm:p-7 text-left transition-colors duration-200"
          >
        <div className="absolute top-0 inset-x-0 h-[3px] casttube-gradient-bar" />
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-indigo-600 text-white shadow-md shadow-fuchsia-500/25 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                Kelola Pengelompokan Channel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Buat grup baru, ganti nama grup, atau sesuaikan kategori
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create New Group Form */}
        <form onSubmit={handleCreateGroup} className="mt-4 sm:mt-5 flex gap-2 shrink-0">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Nama grup baru (misal: Berita, Gaming)..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-fuchsia-500"
            />
          </div>
          <button
            type="submit"
            disabled={!newGroupName.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-600 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-fuchsia-500/25 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah</span>
          </button>
        </form>

        {/* Existing Groups List */}
        <div className="mt-5 flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Daftar Grup ({groups.length})
          </div>

          {groups.map((group) => {
            const channelCount = group.id === 'all'
              ? channels.length
              : channels.filter((c) => c.groupId === group.id).length;
            const isEditing = editingGroupId === group.id;
            const isConfirmingDelete = confirmingDeleteId === group.id;

            return (
              <div
                key={group.id}
                className="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 hover:border-fuchsia-300 dark:hover:border-fuchsia-700/60 transition-all"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />

                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(group.id);
                          if (e.key === 'Escape') setEditingGroupId(null);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 border border-fuchsia-500 text-slate-900 dark:text-white w-full focus:outline-hidden"
                      />
                      <button
                        onClick={() => handleSaveRename(group.id)}
                        className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shrink-0"
                        title="Simpan Nama Baru"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {group.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isConfirmingDelete
                          ? 'Pindahkan channel ke "Umum" & hapus grup ini?'
                          : `${channelCount} channel terdaftar`}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions: Rename & Delete */}
                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    {isConfirmingDelete ? (
                      <>
                        <button
                          onClick={() => {
                            onDeleteGroup(group.id);
                            setConfirmingDeleteId(null);
                          }}
                          className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-gradient-to-r from-rose-500 to-red-600 text-white hover:brightness-110 cursor-pointer"
                        >
                          Hapus
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartRename(group)}
                          className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                          title="Ganti Nama Grup"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {group.id !== 'all' && group.id !== 'general' && (
                          <button
                            onClick={() => setConfirmingDeleteId(group.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Hapus Grup"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Selesai
          </motion.button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
