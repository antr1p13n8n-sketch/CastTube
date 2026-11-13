import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Search,
  Check,
  ExternalLink,
} from 'lucide-react';
import { ChannelGroup, YouTubeChannelSearchResult } from '../types';

interface AddChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ChannelGroup[];
  existingChannelIds: string[];
  onAddChannels: (
    inputs: string[],
    targetGroupId: string
  ) => Promise<{ success: number; failed: number; lastError?: string }>;
  initialPastedText?: string;
  initialTab?: 'search' | 'paste';
  initialSearchQuery?: string;
}

// Helper to extract and clean YouTube URLs / handles from any text block
function parseAndFormatLinks(raw: string): string[] {
  if (!raw) return [];
  const lines = raw
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const results: string[] = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    for (const part of parts) {
      const clean = part.trim();
      if (!clean) continue;
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
        // Keep as-is
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
  existingChannelIds,
  onAddChannels,
  initialPastedText = '',
  initialTab = 'search',
  initialSearchQuery = '',
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'paste'>(initialTab);
  const [inputText, setInputText] = useState(initialPastedText);
  const [selectedGroupId, setSelectedGroupId] = useState(
    groups.find((g) => g.id !== 'all')?.id || 'general'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasPasted, setHasPasted] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // YouTube Channel Search states
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [searchResults, setSearchResults] = useState<YouTubeChannelSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingChannelId, setAddingChannelId] = useState<string | null>(null);
  const [addedInSession, setAddedInSession] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const validGroups = groups.filter((g) => g.id !== 'all');
    if (validGroups.length > 0 && !validGroups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(validGroups[0].id);
    }
  }, [groups, selectedGroupId]);

  const executeYouTubeSearch = useCallback(async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/youtube/search-channels?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal mencari channel di YouTube.');
      }
      setSearchResults(Array.isArray(data.channels) ? data.channels : []);
    } catch (err: unknown) {
      setSearchResults([]);
      setSearchError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat mencari channel YouTube.'
      );
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setFeedback(null);
    setAddedInSession({});
    if (initialPastedText) {
      setActiveTab('paste');
      const formatted = parseAndFormatLinks(initialPastedText);
      setInputText(formatted.length > 0 ? formatted.join('\n') : initialPastedText);
      setHasPasted(true);
      setTimeout(() => setHasPasted(false), 2500);
    } else {
      setActiveTab(initialTab);
      if (initialSearchQuery.trim()) {
        setSearchQuery(initialSearchQuery);
        executeYouTubeSearch(initialSearchQuery);
      }
    }
  }, [isOpen, initialPastedText, initialTab, initialSearchQuery, executeYouTubeSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeYouTubeSearch(searchQuery);
  };

  const handleAddFromSearch = async (item: YouTubeChannelSearchResult) => {
    if (addingChannelId) return;
    setAddingChannelId(item.id);
    setFeedback(null);
    try {
      const result = await onAddChannels([item.id], selectedGroupId);
      if (result.success > 0) {
        setAddedInSession((prev) => ({ ...prev, [item.id]: true }));
        setFeedback({
          type: 'success',
          message: `Channel "${item.title}" berhasil ditambahkan ke grup.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: result.lastError || `Gagal menambahkan channel "${item.title}".`,
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menambahkan channel.',
      });
    } finally {
      setAddingChannelId(null);
    }
  };

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
          message:
            'Papan klip (clipboard) Anda kosong. Silakan salin link YouTube terlebih dahulu.',
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
        message:
          'Izin clipboard ditolak. Silakan gunakan tombol keyboard Ctrl+V (atau Cmd+V) / klik kanan lalu pilih Tempel.',
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
          message:
            result.lastError ||
            'Tidak dapat menemukan channel. Pastikan link atau handle benar.',
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

  const searchTopics = [
    'Podcast Indonesia',
    'Gadget & Teknologi',
    'Berita & Diskusi',
    'Edukasi Sains',
    'Musik Lofi Santai',
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-channel-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <motion.div
            key="add-channel-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-left transition-colors duration-200"
          >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-600 text-white shadow-sm">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Cari & Tambah Channel YouTube
              </h2>
              <p className="text-xs text-slate-500">
                Cari langsung dari YouTube atau tempel URL / @handle channel
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

        {/* Mode Tabs & Group Selector */}
        <div className="px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-slate-950/30">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => {
                setActiveTab('search');
                setFeedback(null);
              }}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'search'
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {activeTab === 'search' && (
                <motion.span
                  layoutId="addModalModeTab"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded-lg bg-white dark:bg-slate-700 shadow-xs"
                />
              )}
              <Search className="relative z-10 w-3.5 h-3.5 text-red-500" />
              <span className="relative z-10">Cari Channel YouTube</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('paste');
                setFeedback(null);
              }}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'paste'
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {activeTab === 'paste' && (
                <motion.span
                  layoutId="addModalModeTab"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded-lg bg-white dark:bg-slate-700 shadow-xs"
                />
              )}
              <Clipboard className="relative z-10 w-3.5 h-3.5 text-red-500" />
              <span className="relative z-10">Tempel Link / Handle</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
              Grup Tujuan:
            </span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-red-500 cursor-pointer"
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
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'search' ? (
            <>
              {/* YouTube Channel Search Input */}
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik nama channel YouTube (misal: Raditya Dika, GadgetIn, Deddy Corbuzier)..."
                    autoFocus
                    className="w-full pl-10 pr-8 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-colors cursor-pointer shrink-0"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mencari...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Cari</span>
                    </>
                  )}
                </button>
              </form>

              {/* Quick Topic Suggestions */}
              {!hasSearched && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Topik populer untuk dicari:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {searchTopics.map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => {
                          setSearchQuery(topic);
                          executeYouTubeSearch(topic);
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
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

              {/* Search Error */}
              {searchError && (
                <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Search Results */}
              {isSearching ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                  <span>Mencari channel di YouTube...</span>
                </div>
              ) : hasSearched && searchResults.length === 0 && !searchError ? (
                <div className="py-10 text-center text-xs text-slate-500 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  Tidak ada channel ditemukan untuk "{searchQuery}". Coba kata kunci atau @handle lain.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {searchResults.map((item, idx) => {
                    const isAlreadyAdded =
                      existingChannelIds.includes(item.id) || Boolean(addedInSession[item.id]);
                    const isAddingThis = addingChannelId === item.id;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: Math.min(idx, 10) * 0.025,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        whileHover={{ y: -2 }}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <img
                            src={item.avatar || `https://avatar.vercel.sh/${item.id}?size=100`}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const img = e.currentTarget;
                              const fallback = `https://avatar.vercel.sh/${item.id}?size=100`;
                              if (img.src !== fallback) img.src = fallback;
                            }}
                            className="w-12 h-12 rounded-full object-cover shrink-0 bg-slate-200 dark:bg-slate-700"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                {item.title}
                              </h3>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-red-500 shrink-0"
                                title="Lihat di YouTube"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {item.handle && <span className="truncate">{item.handle}</span>}
                              {item.handle && item.subscriberCount && (
                                <span aria-hidden="true">·</span>
                              )}
                              {item.subscriberCount && <span>{item.subscriberCount}</span>}
                            </div>

                            {item.description && (
                              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="button"
                          disabled={isAlreadyAdded || Boolean(addingChannelId)}
                          onClick={() => handleAddFromSearch(item)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            isAlreadyAdded
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-default'
                              : 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50'
                          }`}
                        >
                          {isAddingThis ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Memuat...</span>
                            </>
                          ) : isAlreadyAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Terdaftar</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tambah</span>
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Link atau Handle YouTube:
                  </label>

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

                <textarea
                  rows={4}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onPaste={handleNativePaste}
                  placeholder={`Klik tombol "Tempel dari Clipboard" di atas atau tekan Ctrl+V di sini.\n\nContoh yang didukung:\nhttps://www.youtube.com/@mkbhd\nhttps://www.youtube.com/@GadgetIn\n@corbuzier\nUCsXVk37bltHxD1rDPwtNM8Q`}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono focus:outline-hidden focus:ring-2 focus:ring-red-500 leading-relaxed"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Bisa paste URL video, URL channel, atau @handle.</span>
                  <span className="font-mono tabular-nums">
                    {inputText.trim()
                      ? `${inputText.split(/[\n,]+/).filter(Boolean).length} link`
                      : '0 link'}
                  </span>
                </div>
              </div>

              {/* Quick Preset Channels */}
              <div className="pt-1">
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
          )}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
