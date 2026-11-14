import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShieldAlert,
  KeyRound,
  Cookie,
  Server,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Unlink,
  Download,
} from 'lucide-react';
import { AudioExtractorConfig, Video } from '../types';
import {
  loadExtractorConfig,
  saveExtractorConfig,
  clearExtractorConfig,
  normalizeClientCookies,
} from '../utils/extractorConfig';

interface AudioExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingVideo: Video | null;
  onResolved: (config: AudioExtractorConfig, retryVideo: Video | null) => void;
}

type ModalTab = 'oauth' | 'cookies' | 'server';

export const AudioExtractorModal: React.FC<AudioExtractorModalProps> = ({
  isOpen,
  onClose,
  pendingVideo,
  onResolved,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('oauth');
  const [config, setConfig] = useState<AudioExtractorConfig>(() => loadExtractorConfig());

  // Device OAuth states
  const [deviceInfo, setDeviceInfo] = useState<{
    verificationUrl: string;
    userCode: string;
    deviceCode: string;
    interval: number;
    client: { client_id: string; client_secret: string };
  } | null>(null);
  const [isStartingDevice, setIsStartingDevice] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Manual cookies & extractor URL states
  const [cookiesInput, setCookiesInput] = useState('');
  const [extractorUrlInput, setExtractorUrlInput] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }
    const loaded = loadExtractorConfig();
    setConfig(loaded);
    setCookiesInput(loaded.cookies || '');
    setExtractorUrlInput(loaded.extractorUrl || '');
    setFeedback(null);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleStartDeviceAuth = async () => {
    stopPolling();
    setIsStartingDevice(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/youtube/extractor-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_device' }),
      });
      const data = await res.json();
      if (!res.ok || !data?.userCode) {
        throw new Error(data?.error || 'Gagal membuat kode verifikasi YouTube.');
      }

      setDeviceInfo({
        verificationUrl: data.verificationUrl || 'https://www.google.com/device',
        userCode: data.userCode,
        deviceCode: data.deviceCode,
        interval: Math.max(4, Number(data.interval || 5)),
        client: data.client,
      });

      const pollMs = Math.max(4000, Number(data.interval || 5) * 1000);
      pollTimerRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/youtube/extractor-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'poll_device',
              deviceCode: data.deviceCode,
              client: data.client,
            }),
          });
          const pollData = await pollRes.json();
          if (pollData?.status === 'authorized' && pollData.credentials) {
            stopPolling();
            const nextConfig: AudioExtractorConfig = {
              ...loadExtractorConfig(),
              oauthTokens: pollData.credentials,
            };
            saveExtractorConfig(nextConfig);
            setConfig(nextConfig);
            setDeviceInfo(null);
            setFeedback({
              type: 'success',
              message: 'Akun YouTube berhasil terhubung! Melanjutkan unduhan...',
            });
            setTimeout(() => {
              onResolved(nextConfig, pendingVideo);
              onClose();
            }, 650);
          } else if (pollData?.status === 'expired' || pollData?.status === 'denied') {
            stopPolling();
            setDeviceInfo(null);
            setFeedback({
              type: 'error',
              message: pollData.error || 'Otorisasi kedaluwarsa atau ditolak.',
            });
          }
        } catch {
          // keep polling on transient network glitch
        }
      }, pollMs);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal memulai tautan perangkat YouTube.',
      });
    } finally {
      setIsStartingDevice(false);
    }
  };

  const handleCopyCode = async () => {
    if (!deviceInfo?.userCode) return;
    try {
      await navigator.clipboard.writeText(deviceInfo.userCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSaveCookies = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeClientCookies(cookiesInput);
    if (!normalized) {
      setFeedback({
        type: 'error',
        message: 'Tempel isi cookies.txt atau header Cookie YouTube terlebih dahulu.',
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const testVideoId = pendingVideo?.id || 'hdMszZ2ah5Q';
      const res = await fetch('/api/youtube/extractor-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          cookies: normalized,
          verify: true,
          testVideoId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal menyimpan cookie YouTube.');
      }

      const nextConfig: AudioExtractorConfig = {
        ...loadExtractorConfig(),
        cookies: normalized,
      };
      saveExtractorConfig(nextConfig);
      setConfig(nextConfig);

      if (data?.verification && !data.verification.available) {
        setFeedback({
          type: 'error',
          message:
            data.verification.status === 'login_required'
              ? 'Cookie tersimpan, namun YouTube masih meminta verifikasi. Pastikan Anda mengambil cookie youtube.com dalam keadaan login.'
              : `Cookie tersimpan, namun uji stream belum tersedia (${data.verification.status}).`,
        });
        return;
      }

      setFeedback({
        type: 'success',
        message: 'Cookie YouTube aktif dan terverifikasi! Melanjutkan...',
      });
      setTimeout(() => {
        onResolved(nextConfig, pendingVideo);
        onClose();
      }, 650);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan cookie YouTube.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveServerUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = extractorUrlInput.trim().replace(/\/+$/, '');
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
      setFeedback({
        type: 'error',
        message: 'Masukkan URL server yang valid (diawali https:// atau http://).',
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const testVideoId = pendingVideo?.id || 'hdMszZ2ah5Q';
      const res = await fetch('/api/youtube/extractor-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          extractorUrl: cleanUrl,
          verify: true,
          testVideoId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal menyimpan URL ekstraktor.');
      }

      const nextConfig: AudioExtractorConfig = {
        ...loadExtractorConfig(),
        extractorUrl: cleanUrl,
      };
      saveExtractorConfig(nextConfig);
      setConfig(nextConfig);

      setFeedback({
        type: 'success',
        message: data?.verification?.available
          ? 'Server ekstraktor aktif dan berhasil mengurai audio!'
          : 'URL server ekstraktor tersimpan. Mencoba mengunduh ulang...',
      });
      setTimeout(() => {
        onResolved(nextConfig, pendingVideo);
        onClose();
      }, 650);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan URL ekstraktor.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnectAll = async () => {
    stopPolling();
    setDeviceInfo(null);
    clearExtractorConfig();
    setConfig({});
    setCookiesInput('');
    setExtractorUrlInput('');
    try {
      await fetch('/api/youtube/extractor-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
    } catch {
      // ignore
    }
    setFeedback({ type: 'success', message: 'Koneksi otorisasi ekstraktor dihapus.' });
  };

  const isConnected = Boolean(
    config.oauthTokens?.access_token || config.cookies || config.extractorUrl
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="extractor-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
        >
          <motion.div
            key="extractor-modal-card"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-left"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Atasi Pembatasan Download Audio YouTube
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Server cloud dibatasi YouTube (anti-bot). Hubungkan sesi sekali saja agar unduhan & audio latar belakang lancar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Pending Video Notice */}
              {pendingVideo && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70">
                  <Download className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Menunggu Unduhan
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {pendingVideo.title}
                    </div>
                  </div>
                </div>
              )}

              {/* Current Status Bar */}
              {isConnected && (
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold truncate">
                      Aktif:{' '}
                      {[
                        config.oauthTokens?.access_token && 'Akun YouTube (OAuth)',
                        config.cookies && 'Cookie YouTube',
                        config.extractorUrl && 'Server Ekstraktor',
                      ]
                        .filter(Boolean)
                        .join(' + ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectAll}
                    className="flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline shrink-0 cursor-pointer"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Putuskan</span>
                  </button>
                </div>
              )}

              {/* Method Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('oauth');
                    setFeedback(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'oauth'
                      ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Akun TV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('cookies');
                    setFeedback(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'cookies'
                      ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Cookie className="w-3.5 h-3.5" />
                  <span>Cookie</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('server');
                    setFeedback(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'server'
                      ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Server API</span>
                </button>
              </div>

              {/* Tab 1: YouTube TV Device OAuth */}
              {activeTab === 'oauth' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Cara tercepat tanpa ekstensi: hubungkan akun Google Anda memakai kode perangkat YouTube TV resmi.
                  </p>

                  {!deviceInfo ? (
                    <button
                      type="button"
                      onClick={handleStartDeviceAuth}
                      disabled={isStartingDevice}
                      className="w-full py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      {isStartingDevice ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Membuat Kode Verifikasi...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Dapatkan Kode Verifikasi YouTube</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-4 text-center">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Masukkan Kode Ini di Google Device
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-2xl font-extrabold tracking-widest text-slate-900 dark:text-white select-all">
                          {deviceInfo.userCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                          title="Salin kode"
                        >
                          {copiedCode ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <a
                        href={deviceInfo.verificationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Buka google.com/device & Izinkan</span>
                      </a>
                      <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                        <span>Menunggu konfirmasi otomatis...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Cookie Paste */}
              {activeTab === 'cookies' && (
                <form onSubmit={handleSaveCookies} className="space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Jika OAuth TV masih dibatasi atau Anda memakai akun khusus, tempel isi file{' '}
                    <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                      cookies.txt
                    </code>{' '}
                    (Netscape) atau header{' '}
                    <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                      Cookie
                    </code>{' '}
                    dari youtube.com yang sudah login.
                  </p>
                  <textarea
                    value={cookiesInput}
                    onChange={(e) => setCookiesInput(e.target.value)}
                    rows={5}
                    placeholder="Tempel isi cookies.txt atau string SAPISID=...; SID=...; HSID=... di sini"
                    className="w-full rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-3 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memverifikasi Cookie...</span>
                      </>
                    ) : (
                      <span>Simpan & Uji Cookie</span>
                    )}
                  </button>
                </form>
              )}

              {/* Tab 3: Custom Server API (Cobalt / Piped / Invidious) */}
              {activeTab === 'server' && (
                <form onSubmit={handleSaveServerUrl} className="space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Punya server <strong>Cobalt</strong>, <strong>Piped</strong>, atau{' '}
                    <strong>Invidious</strong> sendiri/pribadi? Masukkan base URL-nya agar unduhan audio melewati server tersebut.
                  </p>
                  <input
                    type="url"
                    value={extractorUrlInput}
                    onChange={(e) => setExtractorUrlInput(e.target.value)}
                    placeholder="https://cobalt-anda.domain.com"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menguji Server...</span>
                      </>
                    ) : (
                      <span>Simpan & Uji Server</span>
                    )}
                  </button>
                </form>
              )}

              {feedback && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl text-xs ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800/60'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{feedback.message}</span>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
