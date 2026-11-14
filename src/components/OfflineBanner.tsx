import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineBannerProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = React.memo(({
  isOnline,
  isSyncing,
  pendingCount,
}) => {
  if (isOnline && !isSyncing && pendingCount === 0) {
    return null;
  }

  if (!isOnline) {
    return (
      <div className="w-full bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800/60 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Mode Offline</strong> — Menampilkan daftar video tersimpan & progres pemutaran lokal.
              {pendingCount > 0 && ` (${pendingCount} tugas menunggu sinkronisasi)`}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/60 px-4 py-2 text-xs text-emerald-900 dark:text-emerald-200">
      <div className="max-w-7xl mx-auto flex items-center gap-2">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>Koneksi kembali pulih — menyinkronkan {pendingCount} pembaruan di latar belakang...</span>
      </div>
    </div>
  );
});
