import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Search,
  Check,
  ExternalLink,
  RefreshCw,
  Play,
  Radio,
  ListPlus,
  Film,
  Link2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Channel,
  ChannelGroup,
  Video,
  YouTubeChannelSearchResult,
  YouTubeVideoSearchResult,
} from '../types';
import { parseJsonSafely, buildHttpErrorMessage } from '../utils/safeJson';

interface AddChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ChannelGroup[];
  existingChannelIds: string[];
  onAddChannels: (
    inputs: string[],
    targetGroupId: string,
    channelHints?: Record<string, Partial<Channel>>
  ) => Promise<{ success: number; failed: number; lastError?: string }>;
  onPlayVideo?: (video: Video) => void;
  onPlayAudio?: (video: Video) => void;
  onToggleQueue?: (video: Video) => void;
  queueIds?: string[];
  initialInput?: string;
}

// Helper to extract, unwrap, and clean YouTube URLs / handles from any text block (including mobile share text like "Title https://youtu.be/...")
function cleanYouTubeUrl(rawUrl: string): string {
  const trimmed = rawUrl.replace(/[),.;!?'"\]]+$/g, '').trim();
  try {
    let urlObj = new URL(trimmed);
    if (
      urlObj.hostname.includes('google.') &&
      (urlObj.searchParams.get('q') || urlObj.searchParams.get('url'))
    ) {
      const target = urlObj.searchParams.get('q') || urlObj.searchParams.get('url') || '';
      if (target) {
        urlObj = new URL(target.startsWith('http') ? target : `https://${target}`);
      }
    } else if (
      urlObj.hostname.includes('youtube.com') &&
      urlObj.pathname === '/attribution_link' &&
      urlObj.searchParams.get('u')
    ) {
      const inner = urlObj.searchParams.get('u') || '';
      const resolvedInner = inner.startsWith('http')
        ? inner
        : `https://www.youtube.com${inner.startsWith('/') ? '' : '/'}${inner}`;
      urlObj = new URL(resolvedInner);
    }
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      urlObj.protocol = 'https:';
      urlObj.searchParams.delete('si');
      urlObj.searchParams.delete('feature');
      urlObj.searchParams.delete('app');
      urlObj.searchParams.delete('pp');
      urlObj.searchParams.delete('ab_channel');
    }
    return urlObj.toString();
  } catch {
    return trimmed;
  }
}

export function isYouTubeLinkOrHandleToken(token: string): boolean {
  const clean = token.trim();
  if (!clean) return false;
  return (
    /^https?:\/\//i.test(clean) ||
    /(?:[a-z0-9-]+\.)?(?:youtube\.com|youtu\.be)\//i.test(clean) ||
    /^@[a-zA-Z0-9_.-]{2,}$/.test(clean) ||
    /^UC[a-zA-Z0-9_-]{22}$/.test(clean)
  );
}

export function parseAndFormatLinks(raw: string): string[] {
  if (!raw) return [];
  const normalizedRaw = raw.replace(/[\u200B-\u200D\uFEFF]/g, '');
  const results: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (item: string) => {
    const clean = item.trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    results.push(clean);
  };

  let remainder = normalizedRaw;

  // 1. Extract all full URLs anywhere in pasted/shared text
  const urlMatches = remainder.match(/https?:\/\/[^\s,]+/gi);
  if (urlMatches) {
    for (const u of urlMatches) {
      pushUnique(cleanYouTubeUrl(u));
      remainder = remainder.replace(u, ' ');
    }
  }

  // 2. Extract bare youtube.com / youtu.be URLs without scheme (e.g. m.youtube.com/@mkbhd)
  const bareDomainMatches = remainder.match(/(?:[a-z0-9-]+\.)?(?:youtube\.com|youtu\.be)\/[^\s,]+/gi);
  if (bareDomainMatches) {
    for (const u of bareDomainMatches) {
      pushUnique(cleanYouTubeUrl(`https://${u}`));
      remainder = remainder.replace(u, ' ');
    }
  }

  // 3. Extract standalone @handles or UC channel IDs outside URLs
  const handleOrIdMatches = remainder.match(
    /(?:^|[\s,;])(@[a-zA-Z0-9_.-]{2,}|UC[a-zA-Z0-9_-]{22})(?=$|[\s,/?#])/g
  );
  if (handleOrIdMatches) {
    for (const token of handleOrIdMatches) {
      pushUnique(token.replace(/^[\s,;]+/, '').trim());
    }
  }

  // If real links/handles/IDs were extracted, ignore surrounding Share Sheet title text
  if (results.length > 0) {
    return results;
  }

  // 4. Plain channel names (line/comma separated)
  const lines = normalizedRaw
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    pushUnique(line);
  }

  return results;
}

function extractDirectLinksOnly(raw: string): string[] {
  const candidates = parseAndFormatLinks(raw);
  return candidates.filter((item) => isYouTubeLinkOrHandleToken(item));
}

export const AddChannelModal: React.FC<AddChannelModalProps> = ({
  isOpen,
  onClose,
  groups,
  existingChannelIds,
  onAddChannels,
  onPlayVideo,
  onPlayAudio,
  onToggleQueue,
  queueIds = [],
  initialInput = '',
}) => {
  const [unifiedInput, setUnifiedInput] = useState(initialInput);
  const [selectedGroupId, setSelectedGroupId] = useState(
    groups.find((g) => g.id !== 'all')?.id || 'general'
  );
  const [isAddingLinks, setIsAddingLinks] = useState(false);
  const [hasPasted, setHasPasted] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Unified YouTube search states (Channel + Video in parallel)
  const [channelResults, setChannelResults] = useState<YouTubeChannelSearchResult[]>([]);
  const [videoResults, setVideoResults] = useState<YouTubeVideoSearchResult[]>([]);
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingChannelId, setAddingChannelId] = useState<string | null>(null);
  const [addedInSession, setAddedInSession] = useState<Record<string, boolean>>({});

  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const searchAbortRef = React.useRef<AbortController | null>(null);
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExecutedQueryRef = React.useRef<string>('');
  const pastedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const detectedDirectLinks = useMemo(
    () => extractDirectLinksOnly(unifiedInput),
    [unifiedInput]
  );
  const isDirectLinkMode = detectedDirectLinks.length > 0;
  const isMultiLineInput = unifiedInput.includes('\n') || unifiedInput.length > 72;

  const clearModalTimers = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    if (pastedTimerRef.current) {
      clearTimeout(pastedTimerRef.current);
      pastedTimerRef.current = null;
    }
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearModalTimers();
  }, [clearModalTimers]);

  useEffect(() => {
    const validGroups = groups.filter((g) => g.id !== 'all');
    if (validGroups.length > 0 && !validGroups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(validGroups[0].id);
    }
  }, [groups, selectedGroupId]);

  const executeUnifiedSearch = useCallback(async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setChannelResults([]);
      setVideoResults([]);
      setHasSearched(true);
      setIsSearching(false);
      setSearchError('Anda sedang offline. Hubungkan internet untuk mencari di YouTube.');
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    lastExecutedQueryRef.current = trimmed;

    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 15000);

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setShowAllChannels(false);

    try {
      const fetchJson = async <T,>(url: string, fallbackErr: string): Promise<T> => {
        const res = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const { data, rawText } = await parseJsonSafely<T & { error?: string }>(res);
        if (!res.ok || !data) {
          throw new Error(buildHttpErrorMessage(res, data, rawText, fallbackErr));
        }
        return data;
      };

      const [videosOutcome, channelsOutcome] = await Promise.allSettled([
        fetchJson<{ videos?: YouTubeVideoSearchResult[] }>(
          `/api/youtube/search-videos?q=${encodeURIComponent(trimmed)}`,
          'Gagal mencari video di YouTube'
        ),
        fetchJson<{ channels?: YouTubeChannelSearchResult[] }>(
          `/api/youtube/search-channels?q=${encodeURIComponent(trimmed)}`,
          'Gagal mencari channel di YouTube'
        ),
      ]);

      if (searchAbortRef.current !== controller) return;

      const nextVideos =
        videosOutcome.status === 'fulfilled' && Array.isArray(videosOutcome.value.videos)
          ? videosOutcome.value.videos
          : null;
      const nextChannels =
        channelsOutcome.status === 'fulfilled' && Array.isArray(channelsOutcome.value.channels)
          ? channelsOutcome.value.channels
          : null;

      if (nextVideos === null && nextChannels === null) {
        const errReason =
          videosOutcome.status === 'rejected'
            ? videosOutcome.reason
            : channelsOutcome.status === 'rejected'
            ? channelsOutcome.reason
            : null;
        if ((errReason as { name?: string })?.name === 'AbortError') {
          if (didTimeout) {
            setVideoResults([]);
            setChannelResults([]);
            setSearchError('Pencarian YouTube melebihi batas waktu. Silakan klik Coba Lagi.');
          }
          return;
        }
        setVideoResults([]);
        setChannelResults([]);
        setSearchError(
          errReason instanceof Error
            ? errReason.message
            : 'Terjadi kesalahan saat mencari di YouTube.'
        );
        return;
      }

      setVideoResults(nextVideos || []);
      setChannelResults(nextChannels || []);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') {
        if (didTimeout && searchAbortRef.current === controller) {
          setVideoResults([]);
          setChannelResults([]);
          setSearchError('Pencarian YouTube melebihi batas waktu. Silakan klik Coba Lagi.');
        }
        return;
      }
      if (searchAbortRef.current === controller) {
        setVideoResults([]);
        setChannelResults([]);
        setSearchError(
          err instanceof Error ? err.message : 'Terjadi kesalahan saat mencari di YouTube.'
        );
      }
    } finally {
      clearTimeout(timeoutId);
      if (searchAbortRef.current === controller) {
        setIsSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      searchAbortRef.current?.abort();
      lastExecutedQueryRef.current = '';
      clearModalTimers();
      return;
    }

    clearModalTimers();
    setFeedback(null);
    setSearchError(null);
    setAddedInSession({});
    setShowAllChannels(false);
    lastExecutedQueryRef.current = '';

    const cleanInit = initialInput.trim();
    if (cleanInit) {
      const direct = extractDirectLinksOnly(cleanInit);
      if (direct.length > 0) {
        setUnifiedInput(direct.join('\n'));
        setHasPasted(true);
        pastedTimerRef.current = setTimeout(() => setHasPasted(false), 2500);
        setChannelResults([]);
        setVideoResults([]);
        setHasSearched(false);
      } else {
        setUnifiedInput(cleanInit);
        void executeUnifiedSearch(cleanInit);
      }
    } else {
      setUnifiedInput('');
      setChannelResults([]);
      setVideoResults([]);
      setHasSearched(false);
    }

    const focusTimer = setTimeout(() => {
      if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches) {
        inputRef.current?.focus();
      }
    }, 100);
    return () => clearTimeout(focusTimer);
  }, [isOpen, initialInput, executeUnifiedSearch, clearModalTimers]);

  // Debounced auto-search when typing >= 2 characters and NOT entering direct links
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = unifiedInput.trim();
    if (!trimmed || isDirectLinkMode) {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      return;
    }

    if (trimmed.length < 2 || trimmed === lastExecutedQueryRef.current) return;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      void executeUnifiedSearch(trimmed);
    }, 580);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [isOpen, unifiedInput, isDirectLinkMode, executeUnifiedSearch]);

  const handleSubmitLinks = async (linksToAdd?: string[]) => {
    const items = linksToAdd && linksToAdd.length > 0 ? linksToAdd : parseAndFormatLinks(unifiedInput);
    if (items.length === 0) return;

    setIsAddingLinks(true);
    setFeedback(null);

    try {
      const result = await onAddChannels(items, selectedGroupId);
      if (result.success > 0) {
        setFeedback({
          type: 'success',
          message: `Berhasil menambahkan ${result.success} channel!${
            result.failed > 0 ? ` (${result.failed} gagal dimuat)` : ''
          }`,
        });
        setUnifiedInput('');
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
          onClose();
          setFeedback(null);
        }, 1050);
      } else {
        setFeedback({
          type: 'error',
          message:
            result.lastError ||
            'Tidak dapat menemukan channel dari link tersebut. Pastikan URL atau @handle benar.',
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menambahkan channel.',
      });
    } finally {
      setIsAddingLinks(false);
    }
  };

  const handleUnifiedSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = unifiedInput.trim();
    if (!trimmed) return;

    if (isDirectLinkMode) {
      void handleSubmitLinks(detectedDirectLinks);
    } else {
      void executeUnifiedSearch(trimmed);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error('Clipboard API tidak didukung');
      }

      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        inputRef.current?.focus();
        setFeedback({
          type: 'info',
          message:
            'Papan klip kosong. Salin link atau judul YouTube terlebih dahulu, atau ketik langsung di atas.',
        });
        return;
      }

      const directLinks = extractDirectLinksOnly(text);
      if (directLinks.length > 0) {
        setUnifiedInput((prev) => {
          const prevLinks = extractDirectLinksOnly(prev);
          const merged = Array.from(new Set([...prevLinks, ...directLinks]));
          return merged.join('\n');
        });
        setHasPasted(true);
        if (pastedTimerRef.current) clearTimeout(pastedTimerRef.current);
        pastedTimerRef.current = setTimeout(() => setHasPasted(false), 2500);
        setFeedback({
          type: 'success',
          message: `${directLinks.length} link YouTube berhasil ditempel! Klik "Tambahkan" untuk memuat channel.`,
        });
      } else {
        const cleanQuery = text.trim();
        setUnifiedInput(cleanQuery);
        setHasPasted(true);
        if (pastedTimerRef.current) clearTimeout(pastedTimerRef.current);
        pastedTimerRef.current = setTimeout(() => setHasPasted(false), 2500);
        void executeUnifiedSearch(cleanQuery);
      }

      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3200);
    } catch {
      inputRef.current?.focus();
      setFeedback({
        type: 'info',
        message:
          'Browser membatasi baca clipboard otomatis. Ketuk kotak input lalu pilih Tempel / Paste (atau Ctrl+V).',
      });
    }
  };

  const handleNativePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    const directLinks = extractDirectLinksOnly(pasteData);
    if (directLinks.length > 0) {
      e.preventDefault();
      setUnifiedInput((prev) => {
        const prevLinks = prev.trim() ? extractDirectLinksOnly(prev) : [];
        const merged = Array.from(new Set([...prevLinks, ...directLinks]));
        return merged.join('\n');
      });
      setHasPasted(true);
      if (pastedTimerRef.current) clearTimeout(pastedTimerRef.current);
      pastedTimerRef.current = setTimeout(() => setHasPasted(false), 2500);
      setFeedback({
        type: 'success',
        message: `${directLinks.length} link YouTube terdeteksi! Klik "Tambahkan" untuk memuat channel.`,
      });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleAddFromSearch = async (item: YouTubeChannelSearchResult) => {
    if (addingChannelId) return;
    setAddingChannelId(item.id);
    setFeedback(null);
    try {
      const result = await onAddChannels([item.id], selectedGroupId, {
        [item.id]: {
          id: item.id,
          title: item.title,
          handle: item.handle,
          avatar: item.avatar,
          description: item.description,
          url: item.url,
        },
      });
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

  const handleAddChannelFromVideo = async (item: YouTubeVideoSearchResult) => {
    if (addingChannelId || !item.channelId) return;
    setAddingChannelId(item.channelId);
    setFeedback(null);
    try {
      const result = await onAddChannels([item.channelId], selectedGroupId, {
        [item.channelId]: {
          id: item.channelId,
          title: item.channelTitle,
          handle: item.channelHandle,
          avatar: item.channelAvatar,
          url: item.channelUrl || `https://www.youtube.com/channel/${item.channelId}`,
        },
      });
      if (result.success > 0) {
        setAddedInSession((prev) => ({ ...prev, [item.channelId]: true }));
        setFeedback({
          type: 'success',
          message: `Channel "${item.channelTitle}" berhasil ditambahkan ke grup.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: result.lastError || `Gagal menambahkan channel "${item.channelTitle}".`,
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

  const handleClearInput = () => {
    searchAbortRef.current?.abort();
    lastExecutedQueryRef.current = '';
    setUnifiedInput('');
    setSearchError(null);
    setFeedback(null);
    setChannelResults([]);
    setVideoResults([]);
    setHasSearched(false);
    setIsSearching(false);
    setShowAllChannels(false);
    inputRef.current?.focus();
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

  const popularTopics = [
    'Podcast Indonesia',
    'Review Gadget Terbaru',
    'Lofi Study Music',
    'Edukasi Sains',
    'Talkshow & Diskusi',
  ];

  const visibleChannelResults = showAllChannels ? channelResults : channelResults.slice(0, 4);

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
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
        >
          <motion.div
            key="add-channel-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden text-left transition-colors duration-200"
          >
            <div className="h-[3px] w-full casttube-gradient-bar shrink-0" />
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-indigo-600 text-white shadow-md shadow-fuchsia-500/25 shrink-0">
                  <Youtube className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                    Cari Video, Channel &amp; Tempel Link
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Satu kolom untuk cari judul video, cari channel, atau tempel URL / @handle
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Unified Search + Link Input & Group Bar */}
            <div className="px-4 sm:px-6 pt-3.5 sm:pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 space-y-2.5 shrink-0 bg-gradient-to-b from-indigo-50/50 via-fuchsia-50/30 to-white dark:from-indigo-950/20 dark:via-fuchsia-950/10 dark:to-slate-900">
              <form onSubmit={handleUnifiedSubmit} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 min-w-0">
                  {isDirectLinkMode ? (
                    <Link2 className="w-4 h-4 absolute left-3.5 top-3 text-fuchsia-500 pointer-events-none" />
                  ) : (
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-indigo-400 pointer-events-none" />
                  )}
                  <textarea
                    ref={inputRef}
                    rows={isMultiLineInput ? 3 : 1}
                    value={unifiedInput}
                    onPaste={handleNativePaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleUnifiedSubmit();
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUnifiedInput(val);
                      if (searchError) setSearchError(null);
                      if (!val.trim()) {
                        searchAbortRef.current?.abort();
                        lastExecutedQueryRef.current = '';
                        setHasSearched(false);
                        setChannelResults([]);
                        setVideoResults([]);
                        setIsSearching(false);
                      }
                    }}
                    placeholder="Ketik judul video, nama channel, @handle, atau tempel link YouTube..."
                    className={`w-full pl-10 ${
                      unifiedInput ? 'pr-9' : 'pr-3.5'
                    } py-2.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-fuchsia-500 resize-none leading-relaxed ${
                      isDirectLinkMode ? 'font-mono' : ''
                    }`}
                  />
                  {unifiedInput && (
                    <button
                      type="button"
                      onClick={handleClearInput}
                      className="absolute right-1.5 top-1.5 p-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      aria-label="Kosongkan input"
                      title="Kosongkan"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handlePasteFromClipboard()}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer shrink-0 ${
                      hasPasted
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-fuchsia-300 dark:hover:border-fuchsia-700'
                    }`}
                    title="Tempel link atau kata kunci dari clipboard"
                  >
                    {hasPasted ? (
                      <>
                        <ClipboardCheck className="w-4 h-4" />
                        <span>Tertempel</span>
                      </>
                    ) : (
                      <>
                        <Clipboard className="w-4 h-4 text-fuchsia-500" />
                        <span>Tempel</span>
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={isSearching || isAddingLinks || !unifiedInput.trim()}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-600 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-fuchsia-500/25 transition-all cursor-pointer shrink-0"
                  >
                    {isAddingLinks || isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isAddingLinks ? 'Menambahkan...' : 'Mencari...'}</span>
                      </>
                    ) : isDirectLinkMode ? (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Tambahkan</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Cari</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  {isDirectLinkMode
                    ? `Terdeteksi ${detectedDirectLinks.length} link/handle YouTube siap ditambahkan`
                    : 'Pencarian otomatis menampilkan video & channel sekaligus'}
                </span>

                <div className="flex items-center gap-2">
                  <span className="font-semibold whitespace-nowrap">Grup Tujuan:</span>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="px-2.5 py-1 text-xs font-medium rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-fuchsia-500 cursor-pointer"
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
            </div>

            {/* Scrollable Unified Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Direct Link Preview Action Banner when links or @handles are in the box */}
              {isDirectLinkMode && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-50/90 via-rose-50/75 to-indigo-50/90 dark:from-fuchsia-950/30 dark:via-rose-950/20 dark:to-indigo-950/30 border border-fuchsia-200/80 dark:border-fuchsia-800/50 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                      <Link2 className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400 shrink-0" />
                      <span>
                        {detectedDirectLinks.length} Link / Handle YouTube Siap Ditambahkan
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {detectedDirectLinks.length === 1 && (
                        <button
                          type="button"
                          onClick={() => void executeUnifiedSearch(detectedDirectLinks[0])}
                          disabled={isSearching || isAddingLinks}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-fuchsia-400 hover:text-fuchsia-600 dark:hover:text-fuchsia-300 transition-colors cursor-pointer"
                        >
                          Cari Terkait
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleSubmitLinks(detectedDirectLinks)}
                        disabled={isAddingLinks}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-600 hover:brightness-110 text-white shadow-sm shadow-fuchsia-500/25 transition-all disabled:opacity-60 cursor-pointer"
                      >
                        {isAddingLinks ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>Tambahkan ke Grup</span>
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 space-y-1 max-h-24 overflow-y-auto">
                    {detectedDirectLinks.map((link) => (
                      <div key={link} className="truncate">
                        {link}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback Banner */}
              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : feedback.type === 'info'
                      ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
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
                <div className="p-3.5 rounded-xl text-xs bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{searchError}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    <button
                      type="button"
                      onClick={() => void executeUnifiedSearch(unifiedInput)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Coba Lagi</span>
                    </button>
                    {unifiedInput.trim() && (
                      <button
                        type="button"
                        onClick={() => void handleSubmitLinks([unifiedInput.trim()])}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-semibold text-[11px] hover:bg-red-100/60 cursor-pointer transition-colors"
                      >
                        Coba Tambah Langsung
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isSearching ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-fuchsia-500" />
                  <span>Mencari video &amp; channel di YouTube...</span>
                </div>
              ) : hasSearched &&
                channelResults.length === 0 &&
                videoResults.length === 0 &&
                !searchError ? (
                <div className="py-10 px-4 text-center text-xs text-slate-500 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                  <div>
                    Tidak ada video atau channel ditemukan untuk "{unifiedInput.trim()}". Coba kata
                    kunci lain atau tempel link YouTube langsung.
                  </div>
                  {unifiedInput.trim() && (
                    <button
                      type="button"
                      onClick={() => void handleSubmitLinks([unifiedInput.trim()])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:bg-fuchsia-50 hover:text-fuchsia-600 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Coba Tambah sebagai Channel</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Unified Results: Channels + Videos */}
                  {hasSearched ? (
                    <div className="space-y-5">
                      {/* Channel Results Section */}
                      {channelResults.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                              <Youtube className="w-4 h-4 text-rose-500" />
                              <span>Channel YouTube ({channelResults.length})</span>
                            </div>
                            {channelResults.length > 4 && (
                              <button
                                type="button"
                                onClick={() => setShowAllChannels((prev) => !prev)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-fuchsia-600 dark:text-fuchsia-400 hover:underline cursor-pointer"
                              >
                                <span>
                                  {showAllChannels
                                    ? 'Tampilkan lebih sedikit'
                                    : `Lihat semua (${channelResults.length})`}
                                </span>
                                {showAllChannels ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>

                          <div className="space-y-2">
                            {visibleChannelResults.map((item, idx) => {
                              const isAlreadyAdded =
                                existingChannelIds.includes(item.id) ||
                                Boolean(addedInSession[item.id]);
                              const isAddingThis = addingChannelId === item.id;

                              return (
                                <motion.div
                                  key={item.id}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{
                                    duration: 0.18,
                                    delay: Math.min(idx, 6) * 0.02,
                                    ease: [0.16, 1, 0.3, 1],
                                  }}
                                  className="flex items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                                    <img
                                      src={
                                        item.avatar ||
                                        `https://avatar.vercel.sh/${item.id}?size=100`
                                      }
                                      alt={item.title}
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        const img = e.currentTarget;
                                        const fallback = `https://avatar.vercel.sh/${item.id}?size=100`;
                                        if (img.src !== fallback) img.src = fallback;
                                      }}
                                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover shrink-0 bg-slate-200 dark:bg-slate-700"
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
                                          className="p-1 -m-0.5 rounded-lg text-slate-400 hover:text-red-500 shrink-0"
                                          title="Lihat di YouTube"
                                          aria-label="Lihat di YouTube"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                        {item.handle && (
                                          <span className="truncate">{item.handle}</span>
                                        )}
                                        {item.handle && item.subscriberCount && (
                                          <span aria-hidden="true">·</span>
                                        )}
                                        {item.subscriberCount && (
                                          <span>{item.subscriberCount}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <motion.button
                                    whileTap={{ scale: 0.94 }}
                                    type="button"
                                    disabled={isAlreadyAdded || Boolean(addingChannelId)}
                                    onClick={() => void handleAddFromSearch(item)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                                      isAlreadyAdded
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-default'
                                        : 'bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-600 hover:brightness-110 text-white shadow-sm shadow-fuchsia-500/20 disabled:opacity-50'
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
                        </div>
                      )}

                      {/* Video Results Section */}
                      {videoResults.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                            <Film className="w-4 h-4 text-indigo-500" />
                            <span>Video YouTube ({videoResults.length})</span>
                          </div>

                          <div className="space-y-2.5">
                            {videoResults.map((video, idx) => {
                              const isChannelAdded =
                                Boolean(video.channelId) &&
                                (existingChannelIds.includes(video.channelId) ||
                                  Boolean(addedInSession[video.channelId]));
                              const isAddingChannel =
                                Boolean(video.channelId) && addingChannelId === video.channelId;
                              const isInQueue = queueIds.includes(video.id);

                              return (
                                <motion.div
                                  key={video.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{
                                    duration: 0.2,
                                    delay: Math.min(idx, 10) * 0.02,
                                    ease: [0.16, 1, 0.3, 1],
                                  }}
                                  className="flex flex-col sm:flex-row gap-3 p-2.5 sm:p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                                >
                                  {/* Thumbnail */}
                                  <div
                                    onClick={() => {
                                      if (onPlayVideo) {
                                        onPlayVideo(video);
                                        onClose();
                                      }
                                    }}
                                    className="relative w-full sm:w-40 aspect-video rounded-xl overflow-hidden bg-slate-900 shrink-0 cursor-pointer group"
                                  >
                                    <img
                                      src={video.thumbnail}
                                      alt={video.title}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    {video.duration && (
                                      <span
                                        className={`absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                          video.duration === 'LIVE'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-black/80 text-white'
                                        }`}
                                      >
                                        {video.duration}
                                      </span>
                                    )}
                                  </div>

                                  {/* Metadata & Actions */}
                                  <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
                                    <div className="space-y-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                                          {video.title}
                                        </h3>
                                        <a
                                          href={`https://www.youtube.com/watch?v=${video.id}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="p-1.5 -m-1 rounded-lg text-slate-400 hover:text-red-500 shrink-0"
                                          title="Buka di YouTube"
                                          aria-label="Buka di YouTube"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
                                          {video.channelTitle}
                                        </span>
                                        {video.views && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span>{video.views}</span>
                                          </>
                                        )}
                                        {video.publishedText && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span>{video.publishedText}</span>
                                          </>
                                        )}
                                      </div>

                                      {video.description && (
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                          {video.description}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                      {onPlayVideo && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onPlayVideo(video);
                                            onClose();
                                          }}
                                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:brightness-110 text-white shadow-sm transition-all cursor-pointer"
                                        >
                                          <Play className="w-3 h-3" />
                                          <span>Putar Video</span>
                                        </button>
                                      )}
                                      {onPlayAudio && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onPlayAudio(video);
                                            onClose();
                                          }}
                                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:brightness-110 text-white shadow-sm transition-all cursor-pointer"
                                        >
                                          <Radio className="w-3 h-3" />
                                          <span>Audio</span>
                                        </button>
                                      )}
                                      {onToggleQueue && (
                                        <button
                                          type="button"
                                          onClick={() => onToggleQueue(video)}
                                          className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-xl transition-colors cursor-pointer ${
                                            isInQueue
                                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                              : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
                                          }`}
                                        >
                                          {isInQueue ? (
                                            <>
                                              <Check className="w-3 h-3" />
                                              <span>Di Antrean</span>
                                            </>
                                          ) : (
                                            <>
                                              <ListPlus className="w-3 h-3" />
                                              <span>Antrean</span>
                                            </>
                                          )}
                                        </button>
                                      )}
                                      {video.channelId && (
                                        <button
                                          type="button"
                                          disabled={isChannelAdded || Boolean(addingChannelId)}
                                          onClick={() => void handleAddChannelFromVideo(video)}
                                          className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-xl transition-colors cursor-pointer ${
                                            isChannelAdded
                                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-default'
                                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-red-400 hover:text-red-600 disabled:opacity-50'
                                          }`}
                                        >
                                          {isAddingChannel ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : isChannelAdded ? (
                                            <Check className="w-3 h-3" />
                                          ) : (
                                            <Plus className="w-3 h-3" />
                                          )}
                                          <span>{isChannelAdded ? 'Terdaftar' : 'Channel'}</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Initial Suggestions (Topics + Preset Channels) */
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-slate-500">
                          Topik populer untuk mencari video &amp; channel:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {popularTopics.map((topic, i) => {
                            const chipColors = [
                              'bg-rose-50 dark:bg-rose-950/35 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60 hover:bg-rose-100',
                              'bg-indigo-50 dark:bg-indigo-950/35 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60 hover:bg-indigo-100',
                              'bg-cyan-50 dark:bg-cyan-950/35 text-cyan-700 dark:text-cyan-300 border-cyan-200/80 dark:border-cyan-800/60 hover:bg-cyan-100',
                              'bg-fuchsia-50 dark:bg-fuchsia-950/35 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200/80 dark:border-fuchsia-800/60 hover:bg-fuchsia-100',
                              'bg-amber-50 dark:bg-amber-950/35 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100',
                            ];
                            return (
                              <button
                                key={topic}
                                type="button"
                                onClick={() => {
                                  setUnifiedInput(topic);
                                  void executeUnifiedSearch(topic);
                                }}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${chipColors[i % chipColors.length]}`}
                              >
                                {topic}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Channel Populer (Klik untuk menempel link ke daftar tambah):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {presets.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() =>
                                setUnifiedInput((prev) => {
                                  const existing = extractDirectLinksOnly(prev);
                                  const merged = Array.from(new Set([...existing, p.url]));
                                  return merged.join('\n');
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:hover:bg-fuchsia-950/40 dark:hover:text-fuchsia-300 border border-transparent hover:border-fuchsia-200 dark:hover:border-fuchsia-800/60 rounded-lg transition-colors cursor-pointer"
                            >
                              + {p.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-fuchsia-50/50 to-cyan-50/70 dark:from-indigo-950/25 dark:via-fuchsia-950/20 dark:to-cyan-950/25 border border-indigo-200/70 dark:border-indigo-800/50 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        Tips: Anda bisa mengetik kata kunci apa saja, menempel banyak link sekaligus (URL video, Shorts, Playlist, link channel), atau memasukkan <span className="font-mono font-semibold text-fuchsia-600 dark:text-fuchsia-400">@handle</span> YouTube langsung di satu kolom atas.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
