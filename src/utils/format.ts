export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const paddedMins = mins.toString().padStart(2, '0');
  const paddedSecs = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }
  return `${paddedMins}:${paddedSecs}`;
}

const relativeTimeCache = new Map<string, { label: string; bucket: number }>();

export function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const nowMs = Date.now();
  const bucket = Math.floor(nowMs / 30_000);
  const cached = relativeTimeCache.get(dateString);
  if (cached && cached.bucket === bucket) {
    return cached.label;
  }

  const parsedMs = Date.parse(dateString);
  if (Number.isNaN(parsedMs)) return '';

  const diffMs = nowMs - parsedMs;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  let label: string;
  if (diffSecs < 60) label = 'Baru saja';
  else if (diffMins < 60) label = `${diffMins} menit lalu`;
  else if (diffHours < 24) label = `${diffHours} jam lalu`;
  else if (diffDays === 1) label = 'Kemarin';
  else if (diffDays < 7) label = `${diffDays} hari lalu`;
  else if (diffWeeks < 4) label = `${diffWeeks} minggu lalu`;
  else if (diffMonths < 12) label = `${diffMonths} bulan lalu`;
  else {
    label = new Date(parsedMs).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  if (relativeTimeCache.size > 600) {
    relativeTimeCache.clear();
  }
  relativeTimeCache.set(dateString, { label, bucket });
  return label;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
