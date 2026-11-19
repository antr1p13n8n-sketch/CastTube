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
} from 'lucide-react';
import { BackgroundAudioSettings, NativeAudioStatus, Video } from '../types';

interface BackgroundAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export const BackgroundAudioModal: React.FC<BackgroundAudioModalProps> = ({
  isOpen,
  onClose,
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
}) => {
  const [draft, setDraft] = useState<BackgroundAudioSettings>(settings);
  const [isTogglingPip, setIsTogglingPip] = useState(false);

  const supportsWakeLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...settings,
        enabled: true,
      });
    }
  }, [isOpen, settings]);

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
      promptDismissed: true,
      activatedAt: new Date().toISOString(),
    };
    onActivateNow(next);
    onClose();
  };

  const handleDeactivateOrDismiss = () => {
    const next: BackgroundAudioSettings = {
      ...draft,
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
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs"
        >
          <motion.div
            key="bg-audio-modal-card"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-left"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
                  <Radio className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Audio Latar &amp; Setting Otomatis Popup
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Atur popup mengambang otomatis dan audio latar belakang agar suara tetap berputar saat aplikasi diminimize atau dibuka kembali.
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

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Native Audio Readiness Diagnostic */}
              {currentVideo && (
                <div
                  className={`rounded-2xl p-3.5 border text-xs space-y-2.5 ${
                    usingNativeAudio
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                      : nativeAudioStatus === 'checking'
                      ? 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                      : 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {usingNativeAudio ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : nativeAudioStatus === 'checking' ? (
                      <Loader2 className="w-4 h-4 text-red-500 animate-spin shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1 leading-relaxed">
                      <div className="font-bold">
                        {usingNativeAudio
                          ? 'Mesin Audio Latar Siap Digunakan'
                          : nativeAudioStatus === 'checking'
                          ? 'Memeriksa Jalur Audio Latar Belakang...'
                          : nativeAudioStatus === 'live_stream'
                          ? 'Siaran Live Terdeteksi'
                          : 'Perlu Verifikasi Stream YouTube Sekali Saja'}
                      </div>
                      <p className="mt-0.5 opacity-90">
                        {usingNativeAudio
                          ? 'Audio native aktif untuk video ini dan akan tetap berbunyi saat aplikasi diminimize atau layar dikunci.'
                          : nativeAudioStatus === 'checking'
                          ? 'Menghubungkan jalur audio latar untuk "' + currentVideo.title + '".'
                          : nativeAudioStatus === 'live_stream'
                          ? 'Siaran langsung memakai pemutar YouTube. Buka Popup Mengambang (PiP) di bawah agar tetap aktif saat diminimize.'
                          : 'YouTube membatasi ekstraksi audio langsung dari server cloud. Hubungkan Akun TV atau Cookie YouTube sekali saja agar audio native berjalan mulus di latar belakang.'}
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
                        className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Hubungkan Akun TV / Cookie YouTube</span>
                      </button>
                    )}
                </div>
              )}

              {/* Section 1: Setting Otomatis Popup */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-red-500" />
                  <span>Setting Otomatis Popup</span>
                </div>

                {isFloatingSupported && (
                  <>
                    <label className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <PictureInPicture2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <div className="font-bold text-slate-900 dark:text-white">
                            Otomatis Popup Saat Minimize / Pindah Tab
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            {supportsAutoPip
                              ? 'Browser mendukung Automatic PiP: popup mengambang terbuka otomatis saat pindah tab atau minimize.'
                              : 'Mencoba membuka popup mengambang otomatis saat berpindah layar (jika diblokir browser, aktifkan opsi di bawah).'}
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={draft.autoPopupOnMinimize}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, autoPopupOnMinimize: e.target.checked }))
                        }
                        className="mt-1 h-4 w-4 accent-red-600 rounded cursor-pointer shrink-0"
                      />
                    </label>

                    <label className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Sparkles className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <div className="font-bold text-slate-900 dark:text-white">
                            Otomatis Buka Popup Saat Mulai Putar
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            Langsung memunculkan jendela popup mengambang setiap kali menekan Putar atau Mode Audio (bekerja di semua browser).
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={draft.autoPopupOnPlay}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, autoPopupOnPlay: e.target.checked }))
                        }
                        className="mt-1 h-4 w-4 accent-red-600 rounded cursor-pointer shrink-0"
                      />
                    </label>

                    <label className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Minimize2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <div className="font-bold text-slate-900 dark:text-white">
                            Tutup Popup Otomatis Saat Kembali
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            Menutup jendela mengambang secara otomatis ketika Anda membuka lagi layar CastTube.
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={draft.autoClosePopupOnReturn}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, autoClosePopupOnReturn: e.target.checked }))
                        }
                        className="mt-1 h-4 w-4 accent-red-600 rounded cursor-pointer shrink-0"
                      />
                    </label>
                  </>
                )}

                <label className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Radio className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">
                        Popup Pengingat Otomatis Saat Putar Audio
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Tampilkan panel pengaturan ini secara otomatis saat pertama kali memutar dalam mode audio.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.autoPromptActivation}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        autoPromptActivation: e.target.checked,
                        promptDismissed: e.target.checked ? false : prev.promptDismissed,
                      }))
                    }
                    className="mt-1 h-4 w-4 accent-red-600 rounded cursor-pointer shrink-0"
                  />
                </label>
              </div>

              {/* Section 2: Background Audio & Resume Settings */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 pt-1">
                  <Smartphone className="w-3.5 h-3.5 text-red-500" />
                  <span>Audio Latar Belakang &amp; Pemulihan</span>
                </div>

                <label className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Smartphone className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">
                        Otomatis Mode Audio Saat Minimize
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Saat Anda keluar ke Home atau pindah aplikasi, video otomatis beralih ke audio latar belakang.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.autoSwitchOnMinimize}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, autoSwitchOnMinimize: e.target.checked }))
                    }
                    className="mt-1 h-4 w-4 accent-red-600 rounded cursor-pointer shrink-0"
                  />
                </label>

                <label className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <RotateCcw className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">
                        Lanjutkan Otomatis Setelah App Ditutup
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Menyimpan detik terakhir saat tab/app ditutup sehingga pemutaran langsung siap dilanjutkan saat dibuka kembali.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.autoResumeOnReopen}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, autoResumeOnReopen: e.target.checked }))
                    }
                    className="mt-1 h-4 w-4 accent-red-600 rounded cursor-pointer shrink-0"
                  />
                </label>

                {supportsWakeLock && (
                  <label className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <ShieldCheck className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
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
                      className="mt-1 h-4 w-4 accent-red-600 rounded cursor-pointer shrink-0"
                    />
                  </label>
                )}
              </div>

              {/* Floating Picture-in-Picture Mini-Player Window */}
              {isFloatingSupported && (
                <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <PictureInPicture2 className="w-4 h-4 text-red-500 shrink-0" />
                        <span>Popup Pemutar Mengambang (PiP)</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Tampilkan jendela kontrol mini yang tetap mengambang saat browser diminimize atau pindah ke aplikasi lain.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTogglePip}
                      disabled={isTogglingPip || !currentVideo}
                      className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
                        isFloatingOpen
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      {isTogglingPip
                        ? 'Membuka...'
                        : isFloatingOpen
                        ? 'Tutup Popup'
                        : 'Buka Popup'}
                    </button>
                  </div>
                  {floatingError && (
                    <div className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                      {floatingError}
                    </div>
                  )}
                </div>
              )}

              {/* Honest Browser & OS Behavior Tip */}
              <div className="px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed space-y-1">
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  Tips agar audio tidak terputus di HP & Desktop:
                </div>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>
                    Gunakan tombol <strong>Minimize / Home</strong> untuk tetap mendengar suara di latar belakang atau kontrol notifikasi.
                  </li>
                  <li>
                    Jika aplikasi ditutup paksa (swipe dari Recent Apps), sistem OS menghentikan browser; CastTube akan menyimpan posisi detik terakhir untuk dilanjutkan otomatis saat dibuka kembali.
                  </li>
                </ul>
              </div>
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
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-600/20 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Simpan &amp; Aktifkan</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
