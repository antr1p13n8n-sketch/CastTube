import React, { useState, useEffect } from 'react';
import {
  X,
  Youtube,
  Plus,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Trash2,
} from 'lucide-react';
import { ChannelGroup } from '../types';

interface AddChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ChannelGroup[];
  onAddChannels: (inputs: string[], targetGroupId: string) => Promise<{ success: number; failed: number; lastError?: string }>;
  initialPastedText?: string;
}

// Helper to extract and clean YouTube URLs / handles from any text block
function parseAndFormatLinks(raw: string): string[] {
  if (!raw) return [];
  // Match YouTube URLs, handles, or UC channel IDs
  const lines = raw.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
  const results: string[] = [];

  for (const line of lines) {
    // If multiple URLs were on one line separated by spaces
    const parts = line.split(/\s+/);
    for (const part of parts) {
      const clean = part.trim();
      if (!clean) continue;
      // Strip common tracking query params
      try {
        if (clean.startsWith('http')) {
          const urlObj = new URL(clean);
          urlObj.searchParams.delete('si');
          urlObj.searchParams.delete('feature');
          urlObj.searchParams.delete('app');
          results.push(urlObj.toString());
          continue;
        }
      } catch {
        // Not a valid URL object, keep as is
      }
      results.push(clean);
    }
  }

  return results;
}

export const AddChannelModal: React.FC<AddChannelModalProps> = ({
  isOpen,
  onClose,
  groups,
  onAddChannels,
  initialPastedText = '',
}) => {
  const [inputText, setInputText] = useState(initialPastedText);
  const [selectedGroupId, setSelectedGroupId] = useState(
    groups.find((g) => g.id !== 'all')?.id || 'general'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasPasted, setHasPasted] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const validGroups = groups.filter((g) => g.id !== 'all');
    if (validGroups.length > 0 && !validGroups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(validGroups[0].id);
    }
  }, [groups, selectedGroupId]);

  useEffect(() => {
    if (initialPastedText) {
      const formatted = parseAndFormatLinks(initialPastedText);
      setInputText(formatted.length > 0 ? formatted.join('\n') : initialPastedText);
      setHasPasted(true);
      setTimeout(() => setHasPasted(false), 2500);
    }
  }, [initialPastedText]);

  if (!isOpen) return null;

  // Read directly from system clipboard
  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error('Clipboard API tidak didukung');
      }

      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setFeedback({
          type: 'error',
          message: 'Papan klip (clipboard) Anda kosong. Silakan salin link YouTube terlebih dahulu.',
        });
        return;
      }

      const formattedLinks = parseAndFormatLinks(text);
      const textToAdd = formattedLinks.length > 0 ? formattedLinks.join('\n') : text.trim();

      setInputText((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed}\n${textToAdd}` : textToAdd;
      });

      setHasPasted(true);
      setTimeout(() => setHasPasted(false), 2500);

      setFeedback({
        type: 'success',
        message: `${formattedLinks.length || 1} link berhasil ditempel dari clipboard!`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({
        type: 'error',
        message: 'Izin clipboard ditolak. Silakan gunakan tombol keyboard Ctrl+V (atau Cmd+V) / klik kanan lalu pilih Tempel.',
      });
    }
  };

  // Handle native paste event to auto-format multiple URLs
  const handleNativePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasteData = e.clipboardData.getData('text');
    if (pasteData) {
      const formatted = parseAndFormatLinks(pasteData);
      if (formatted.length > 1) {
        e.preventDefault();
        const textToAdd = formatted.join('\n');
        setInputText((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed}\n${textToAdd}` : textToAdd;
        });
        setHasPasted(true);
        setTimeout(() => setHasPasted(false), 2500);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Split by newlines, commas, or spaces
    const lines = inputText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (lines.length === 0) return;

    setIsLoading(true);
    setFeedback(null);

    try {
      const result = await onAddChannels(lines, selectedGroupId);
      if (result.success > 0) {
        setFeedback({
          type: 'success',
          message: `Berhasil menambahkan ${result.success} channel!${
            result.failed > 0 ? ` (${result.failed} gagal dimuat)` : ''
          }`,
        });
        setInputText('');
        setTimeout(() => {
          onClose();
          setFeedback(null);
        }, 1200);
      } else {
        setFeedback({
          type: 'error',
          message: result.lastError || 'Tidak dapat menemukan channel. Pastikan link atau handle benar.',
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal memproses channel.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPreset = (url: string) => {
    setInputText((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n${url}` : url;
    });
  };

  const presets = [
    { name: 'GadgetIn', url: 'https://www.youtube.com/@GadgetIn' },
    { name: 'MKBHD', url: 'https://www.youtube.com/@mkbhd' },
    { name: 'Deddy Corbuzier', url: 'https://www.youtube.com/@corbuzier' },
    { name: 'Kurzgesagt', url: 'https://www.youtube.com/@kurzgesagt' },
    { name: 'Lofi Girl', url: 'https://www.youtube.com/@LofiGirl' },
    { name: 'Veritasium', url: 'https://www.youtube.com/@veritasium' },
    { name: 'TED', url: 'https://www.youtube.com/@TED' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 text-left transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-600 text-white shadow-sm">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Tambah Channel YouTube
              </h2>
              <p className="text-xs text-slate-500">
                Tempel link channel satu per satu atau sekaligus
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Textarea for multiple links with Paste controls */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Link atau Handle YouTube:
              </label>

              {/* Paste & Clear action buttons */}
              <div className="flex items-center gap-2">
                {inputText && (
                  <button
                    type="button"
                    onClick={() => setInputText('')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                    title="Kosongkan teks"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus</span>
                  </button>
                )}

                {/* Primary Paste button */}
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    hasPasted
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                      : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200/80 dark:border-red-800/80'
                  }`}
                  title="Tempel link langsung dari papan klip (clipboard)"
                >
                  {hasPasted ? (
                    <>
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>Berhasil Ditempel!</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>Tempel dari Clipboard</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea
                rows={4}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={handleNativePaste}
                placeholder={`Klik tombol "Tempel dari Clipboard" di atas atau tekan Ctrl+V di sini.\n\nContoh yang didukung:\nhttps://www.youtube.com/@mkbhd\nhttps://www.youtube.com/@GadgetIn\n@corbuzier\nUCsXVk37bltHxD1rDPwtNM8Q`}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono focus:outline-hidden focus:ring-2 focus:ring-red-500 leading-relaxed"
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>Bisa paste URL video, URL channel, atau @handle.</span>
              <span className="font-mono">{inputText.trim() ? `${inputText.split(/[\n,]+/).filter(Boolean).length} link` : '0 link'}</span>
            </div>
          </div>

          {/* Group assignment dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Masukkan ke Dalam Grup:
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-red-500"
            >
              {groups
                .filter((g) => g.id !== 'all')
                .map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Quick Preset Channels */}
          <div className="pt-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Contoh Channel Populer (Klik untuk menambahkan):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => handleAddPreset(p.url)}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  + {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Submit & Cancel */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses Channel...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Tambahkan Channel</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
