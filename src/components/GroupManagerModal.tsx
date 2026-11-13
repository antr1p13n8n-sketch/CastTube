import React, { useState } from 'react';
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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 text-left transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Kelola Pengelompokan Channel
              </h2>
              <p className="text-xs text-slate-500">
                Buat grup baru, ganti nama grup, atau sesuaikan kategori
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

        {/* Create New Group Form */}
        <form onSubmit={handleCreateGroup} className="mt-5 flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Nama grup baru (misal: Berita & Politik, Gaming)..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500"
            />
          </div>
          <button
            type="submit"
            disabled={!newGroupName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah</span>
          </button>
        </form>

        {/* Existing Groups List */}
        <div className="mt-6 space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
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
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Folder className="w-4 h-4 text-red-500 shrink-0" />

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
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 border border-red-500 text-slate-900 dark:text-white w-full focus:outline-hidden"
                      />
                      <button
                        onClick={() => handleSaveRename(group.id)}
                        className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shrink-0"
                        title="Simpan Nama Baru"
                      >
                        <Check className="w-3.5 h-3.5" />
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
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                        >
                          Hapus
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartRename(group)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Ganti Nama Grup"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {group.id !== 'all' && group.id !== 'general' && (
                          <button
                            onClick={() => setConfirmingDeleteId(group.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
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
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
