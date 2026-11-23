import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Radio,
  CheckCircle2,
  AlertCircle,
  PictureInPicture2,
  KeyRound,
  Smartphone,
  RotateCcw,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Minimize2,
  Cookie,
  Palette,
  Check,
} from 'lucide-react';
import {
  BackgroundAudioSettings,
  NativeAudioStatus,
  PrimaryThemeConfig,
  Video,
} from '../types';
import {
  loadExtractorConfig,
  ensureAutoYouTubeCookies,
  isAutoGuestCookies,
  isLoggedInYouTubeCookies,
} from '../utils/extractorConfig';
import {
  DEFAULT_PRIMARY_THEME,
  THEME_PRESETS,
  ThemePresetDefinition,
} from '../utils/themeColors';

export type SettingsModalTab = 'popup' | 'theme';

interface BackgroundAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsModalTab;
  primaryTheme: PrimaryThemeConfig;
  onPrimaryThemeChange: (next: PrimaryThemeConfig) => void;
  settings: BackgroundAudioSettings;
  onActivateNow: (next: BackgroundAudioSettings) => void;
  onDismissPrompt: (next: BackgroundAudioSettings) => void;
  currentVideo: Video | null;
  nativeAudioStatus: NativeAudioStatus;
  usingNativeAudio: boolean;
  isFloatingSupported: boolean;
  supportsAutoPip?: boolean;
  isFloatingOpen: boolean;
  floatingError: string | null;
  onToggleFloatingPopup: () => Promise<boolean>;
  onOpenExtractorAuth: () => void;
  onAutoCookieReady?: () => void;
}

export const BackgroundAudioModal: React.FC<BackgroundAudioModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'popup',
  primaryTheme,
  onPrimaryThemeChange,
  settings,
  onActivateNow,
  onDismissPrompt,
  currentVideo,
  nativeAudioStatus,
  usingNativeAudio,
  isFloatingSupported,
  supportsAutoPip = false,
  isFloatingOpen,
  floatingError,
  onToggleFloatingPopup,
  onOpenExtractorAuth,
  onAutoCookieReady,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsModalTab>(initialTab);
  const [draft, setDraft] = useState<BackgroundAudioSettings>(settings);
  const [isTogglingPip, setIsTogglingPip] = useState(false);
  const [isSettingCookie, setIsSettingCookie] = useState(false);
  const [cookieStatus, setCookieStatus] = useState<'none' | 'auto' | 'account'>('none');
  const [cookieNote, setCookieNote] = useState<string | null>(null);

  const supportsWakeLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialTab);
      setDraft({
        ...settings,
        enabled: true,
      });
      const cfg = loadExtractorConfig();
      if (isLoggedInYouTubeCookies(cfg.cookies)) {
        setCookieStatus('account');
      } else if (isAutoGuestCookies(cfg.cookies)) {
        setCookieStatus('auto');
      } else {
        setCookieStatus('none');
      }
      setCookieNote(null);
    }
  }, [isOpen, settings, initialTab]);

  const handleSelectPreset = (preset: ThemePresetDefinition) => {
    onPrimaryThemeChange({
      presetId: preset.id,
      startHex: preset.startHex,
      midHex: preset.midHex,
      endHex: preset.endHex,
      glowHex: preset.glowHex,
    });
  };

  const handleUpdateCustomColor = (
    field: 'startHex' | 'midHex' | 'endHex' | 'glowHex',
    hex: string
  ) => {
    onPrimaryThemeChange({
      ...primaryTheme,
      presetId: 'custom',
      [field]: hex.toLowerCase(),
    });
  };

  const handleAutoCookieAndPopup = async () => {
    setIsSettingCookie(true);
    setCookieNote(null);
    try {
      const res = await ensureAutoYouTubeCookies({
        force: true,
        verify: Boolean(currentVideo?.id),
        testVideoId: currentVideo?.id,
      });
      if (!res.config.cookies) {
        setCookieNote('Gagal mengambil cookie YouTube. Periksa koneksi lalu coba lagi.');
        return;
      }
      setCookieStatus(isLoggedInYouTubeCookies(res.config.cookies) ? 'account' : 'auto');
      setDraft((prev) => ({
        ...prev,
        enabled: true,
        autoPopupOnMinimize: true,
        autoPopupOnPlay: true,
        autoClosePopupOnReturn: true,
        autoPromptActivation: false,
      }));
      setCookieNote('Cookie YouTube otomatis terpasang & Setting Otomatis Popup aktif.');
      onAutoCookieReady?.();
    } finally {
      setIsSettingCookie(false);
    }
  };

  const handleTogglePip = async () => {
    setIsTogglingPip(true);
    try {
      await onToggleFloatingPopup();
    } finally {
      setIsTogglingPip(false);
    }
  };

  const handleConfirmActivate = () => {
    const next: BackgroundAudioSettings = {
      ...draft,
      enabled: true,
      autoSwitchOnMinimize: true,
      autoResumeOnReopen: true,
      autoPopupOnMinimize: true,
      autoPopupOnPlay: true,
      autoPromptActivation: false,
      promptDismissed: true,
      activatedAt: new Date().toISOString(),
    };
    onActivateNow(next);
    onClose();
  };

  const handleDeactivateOrDismiss = () => {
    const next: BackgroundAudioSettings = {
      ...draft,
      enabled: true,
      autoSwitchOnMinimize: true,
      autoResumeOnReopen: true,
      autoPopupOnMinimize: true,
      autoPopupOnPlay: true,
      autoPromptActivation: false,
      promptDismissed: true,
    };
    onDismissPrompt(next);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="bg-audio-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={handleDeactivateOrDismiss}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm"
        >
          <motion.div
            key="bg-audio-modal-card"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border casttube-accent-border shadow-2xl overflow-hidden text-left"
          >
            <div className="h-1 w-full casttube-gradient-bar shrink-0" />
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl casttube-soft-surface border casttube-accent-icon shrink-0">
                  {activeSection === 'theme' ? (
                    <Palette className="w-5 h-5" />
                  ) : (
                    <Radio className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {activeSection === 'theme'
                      ? 'Setelan Warna Tema Utama'
                      : 'Setelan Popup, Audio & Tema'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {activeSection === 'theme'
                      ? 'Pilih palet warna utama atau atur gradasi kustom Anda secara langsung di seluruh aplikasi.'
                      : 'Pengaturan popup otomatis tanpa batas, cookie YouTube, dan kustomisasi warna tema.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDeactivateOrDismiss}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Tutup"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section Switcher Tabs */}
            <div className="px-4 sm:px-6 pt-3 pb-1 shrink-0">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90">
                <button
                  type="button"
                  onClick={() => setActiveSection('theme')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSection === 'theme'
                      ? 'casttube-gradient-btn'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Warna Tema Utama</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('popup')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSection === 'popup'
                      ? 'casttube-gradient-btn'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Popup &amp; Audio Latar</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
              {activeSection === 'theme' ? (
                <>
                  {/* Live Theme Preview Card */}
                  <div className="rounded-2xl p-4 border casttube-soft-surface space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider casttube-accent-text">
                        Pratinjau Tema Aktif
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {primaryTheme.presetId === 'custom'
                          ? 'Kustom'
                          : THEME_PRESETS.find((p) => p.id === primaryTheme.presetId)?.name || 'Prisma Neon'}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full casttube-gradient-bar" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-extrabold casttube-gradient-text">
                        CastTube Modern Gradient
                      </span>
                      <span className="px-3 py-1 rounded-xl text-xs font-bold casttube-gradient-btn">
                        Tombol Utama
                      </span>
                    </div>
                  </div>

                  {/* Curated Presets Grid */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Palet Warna Siap Pakai
                      </span>
                      {primaryTheme.presetId !== 'prism' && (
                        <button
                          type="button"
                          onClick={() => onPrimaryThemeChange(DEFAULT_PRIMARY_THEME)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold casttube-accent-text hover:underline cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Default</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {THEME_PRESETS.map((preset) => {
                        const isSelected = primaryTheme.presetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleSelectPreset(preset)}
                            className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'casttube-card-active bg-slate-50/95 dark:bg-slate-800/90'
                                : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div
                              className="w-10 h-10 rounded-xl shrink-0 shadow-sm flex items-center justify-center text-white"
                              style={{
                                backgroundImage: `linear-gradient(135deg, ${preset.startHex} 0%, ${preset.midHex} 52%, ${preset.endHex} 100%)`,
                              }}
                            >
                              {isSelected && <Check className="w-4 h-4 drop-shadow" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span className="truncate">{preset.name}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5 line-clamp-2">
                                {preset.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Hex Color Pickers */}
                  <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/65 border border-slate-200/80 dark:border-slate-700/70 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          Warna Gradasi Kustom
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Sesuaikan tiap titik warna sesuai selera Anda — otomatis tersimpan.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPrimaryThemeChange(DEFAULT_PRIMARY_THEME)}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                      >
                        Default
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(
                        [
                          { key: 'startHex', label: 'Awal' },
                          { key: 'midHex', label: 'Utama' },
                          { key: 'endHex', label: 'Akhir' },
                          { key: 'glowHex', label: 'Kilau' },
                        ] as const
                      ).map((item) => {
                        const val = primaryTheme[item.key];
                        return (
                          <label
                            key={item.key}
                            className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/70 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                          >
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              {item.label}
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={val}
                                onChange={(e) => handleUpdateCustomColor(item.key, e.target.value)}
                                aria-label={`Pilih warna ${item.label}`}
                                className="w-7 h-7 rounded-lg border-0 bg-transparent p-0 cursor-pointer shrink-0"
                              />
                              <span className="text-[11px] font-mono tabular-nums uppercase text-slate-700 dark:text-slate-200 truncate">
                                {val}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Positive Always-On Unrestricted Popup Banner */}
                  <div className="rounded-2xl p-3.5 border border-emerald-300/70 dark:border-emerald-700/50 bg-gradient-to-r from-emerald-50/90 via-cyan-50/85 to-indigo-50/90 dark:from-emerald-950/35 dark:via-cyan-950/30 dark:to-indigo-950/35 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Popup Mengambang Otomatis Aktif (Tanpa Pembatasan)</span>
                    </div>
                    <p className="text-emerald-900/80 dark:text-emerald-200/85 leading-relaxed">
                      Jendela popup pemutar langsung aktif saat Anda memutar video/audio atau berpindah layar, baik di browser desktop, HP, maupun mode preview.
                    </p>
                  </div>

                  {/* Current track audio engine info */}
                  {currentVideo && (
                    <div
                      className={`rounded-2xl p-3.5 border text-xs space-y-2.5 ${
                        usingNativeAudio
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                          : nativeAudioStatus === 'checking'
                          ? 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                          : 'casttube-soft-surface text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {usingNativeAudio ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : nativeAudioStatus === 'checking' ? (
                          <Loader2 className="w-4 h-4 casttube-accent-icon animate-spin shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 casttube-accent-icon shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1 leading-relaxed">
                          <div className="font-bold">
                            {usingNativeAudio
                              ? 'Mesin Audio Native Aktif'
                              : nativeAudioStatus === 'checking'
                              ? 'Menghubungkan Jalur Audio...'
                              : nativeAudioStatus === 'live_stream'
                              ? 'Siaran Live Aktif di Popup Mengambang'
                              : 'Berjalan di Pemutar YouTube + Popup Mengambang'}
                          </div>
                          <p className="mt-0.5 opacity-90">
                            {usingNativeAudio
                              ? 'Audio native aktif untuk video ini dan tetap berbunyi saat aplikasi diminimize atau layar dikunci.'
                              : nativeAudioStatus === 'checking'
                              ? 'Menghubungkan jalur audio untuk "' + currentVideo.title + '".'
                              : nativeAudioStatus === 'live_stream'
                              ? 'Siaran langsung tetap berjalan lancar melalui jendela popup mengambang CastTube.'
                              : 'Popup mengambang otomatis memakai pemutar YouTube langsung agar video/audio tetap aktif tanpa batas. Untuk video khusus akun / audio native di layar terkunci, hubungkan Cookie / Akun TV (opsional).'}
                          </p>
                        </div>
                      </div>

                      {!usingNativeAudio &&
                        nativeAudioStatus !== 'checking' &&
                        nativeAudioStatus !== 'live_stream' && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenExtractorAuth();
                            }}
                            className="w-full py-2 px-3 rounded-xl casttube-gradient-btn hover:brightness-110 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Hubungkan Akun TV / Cookie (Opsional)</span>
                          </button>
                        )}
                    </div>
                  )}

                  {/* Section 0: Cookie YouTube Otomatis */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Cookie className="w-4 h-4 casttube-accent-icon shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            Cookie YouTube Otomatis
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {cookieStatus === 'account'
                              ? 'Cookie akun YouTube aktif'
                              : cookieStatus === 'auto'
                              ? 'Cookie sesi otomatis aktif untuk pemutar & popup'
                              : 'Sesi otomatis siap diaktifkan'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleAutoCookieAndPopup()}
                        disabled={isSettingCookie}
                        className="px-3 py-1.5 rounded-xl casttube-gradient-btn hover:brightness-110 text-[11px] font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all disabled:opacity-60 cursor-pointer"
                      >
                        {isSettingCookie ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Memproses...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{cookieStatus === 'none' ? 'Set Cookie Otomatis' : 'Segarkan Cookie'}</span>
                          </>
                        )}
                      </button>
                    </div>
                    {cookieNote && (
                      <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        {cookieNote}
                      </div>
                    )}
                  </div>

                  {/* Section 1: Setting Otomatis Popup */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <SlidersHorizontal className="w-3.5 h-3.5 casttube-accent-icon" />
                        <span>Setting Otomatis Popup</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                        Aktif Otomatis
                      </span>
                    </div>

                    {isFloatingSupported && (
                      <>
                        <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-emerald-200/80 dark:border-emerald-800/40">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <PictureInPicture2 className="w-4 h-4 casttube-accent-icon shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <div className="font-bold text-slate-900 dark:text-white">
                                Otomatis Popup Saat Minimize / Pindah Tab
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                {supportsAutoPip
                                  ? 'Otomatis aktif: popup mengambang langsung muncul saat pindah tab, minimize, atau menjelajahi Beranda.'
                                  : 'Popup mengambang universal aktif otomatis di semua perangkat tanpa pembatasan.'}
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Otomatis</span>
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-emerald-200/80 dark:border-emerald-800/40">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Sparkles className="w-4 h-4 casttube-accent-icon shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <div className="font-bold text-slate-900 dark:text-white">
                                Otomatis Buka Popup Saat Mulai Putar
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                Selalu mengaktifkan jendela popup mengambang saat memutar audio/podcast atau menavigasi daftar video.
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Otomatis</span>
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-emerald-200/80 dark:border-emerald-800/40">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Radio className="w-4 h-4 casttube-accent-icon shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <div className="font-bold text-slate-900 dark:text-white">
                                Bebas Pembatasan &amp; Tanpa Dialog Konfirmasi
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                Cookie tamu YouTube, fallback host pemutar, dan kontrol geser popup disetel otomatis tanpa blokir.
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Otomatis</span>
                          </span>
                        </div>

                        <label className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Minimize2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <div className="font-bold text-slate-900 dark:text-white">
                                Tutup Popup Saat Kembali ke Aplikasi
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                Opsional: tutup otomatis hanya jika popup dipicu saat aplikasi diminimize.
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={draft.autoClosePopupOnReturn}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, autoClosePopupOnReturn: e.target.checked }))
                            }
                            className="mt-1 h-4 w-4 casttube-range-accent rounded cursor-pointer shrink-0"
                          />
                        </label>
                      </>
                    )}
                  </div>

                  {/* Section 2: Background Audio & Resume Settings */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 pt-1">
                      <Smartphone className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Audio Latar Belakang &amp; Pemulihan</span>
                    </div>

                    <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-emerald-200/80 dark:border-emerald-800/40">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Smartphone className="w-4 h-4 casttube-accent-icon shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <div className="font-bold text-slate-900 dark:text-white">
                            Otomatis Mode Audio &amp; Lanjutkan Terakhir
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            Saat pindah layar atau membuka ulang CastTube, audio latar dan detik terakhir disiapkan otomatis.
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Otomatis</span>
                      </span>
                    </div>

                    {supportsWakeLock && (
                      <label className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <div className="font-bold text-slate-900 dark:text-white">
                              Jaga Sesi Tetap Bangun (Wake Lock)
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                              Mencegah perangkat masuk mode tidur saat pemutar sedang aktif di layar.
                            </div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={draft.keepScreenAwake}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, keepScreenAwake: e.target.checked }))
                          }
                          className="mt-1 h-4 w-4 casttube-range-accent rounded cursor-pointer shrink-0"
                        />
                      </label>
                    )}
                  </div>

                  {/* Floating Picture-in-Picture Mini-Player Window */}
                  {isFloatingSupported && (
                    <div className="p-3.5 rounded-2xl casttube-soft-surface border space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <PictureInPicture2 className="w-4 h-4 casttube-accent-icon shrink-0" />
                            <span>Popup Pemutar Mengambang</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                            Aktifkan popup sekarang tanpa pembatasan dan bebas geser ke sudut mana pun.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleTogglePip}
                          disabled={isTogglingPip}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer disabled:opacity-50 ${
                            isFloatingOpen
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              : 'casttube-gradient-btn hover:brightness-110'
                          }`}
                        >
                          {isTogglingPip
                            ? 'Membuka...'
                            : isFloatingOpen
                            ? 'Tutup Popup'
                            : 'Aktifkan Popup'}
                        </button>
                      </div>
                      {floatingError && (
                        <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                          {floatingError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Helpful Tip */}
                  <div className="px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed space-y-1">
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      Tips memaksimalkan Popup &amp; Audio Latar:
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>
                        Popup mengambang otomatis terbuka saat memutar atau menjelajahi video lain dan dapat digeser bebas ke pojok mana pun.
                      </li>
                      <li>
                        Posisi detik terakhir tersimpan otomatis sehingga Anda selalu siap melanjutkan episode kapan pun kembali.
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0 bg-slate-50/70 dark:bg-slate-900">
              <button
                type="button"
                onClick={handleDeactivateOrDismiss}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleConfirmActivate}
                className="px-4 py-2 rounded-xl text-xs font-bold casttube-gradient-btn hover:brightness-110 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {activeSection === 'theme' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Terapkan Tema</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5" />
                    <span>Simpan &amp; Aktifkan</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
