import { AudioExtractorConfig } from '../types';

const EXTRACTOR_STORAGE_KEY = 'casttube_extractor_config_v1';

export function loadExtractorConfig(): AudioExtractorConfig {
  try {
    const raw = localStorage.getItem(EXTRACTOR_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AudioExtractorConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveExtractorConfig(config: AudioExtractorConfig): void {
  try {
    const hasValue = Boolean(
      config.oauthTokens?.access_token || config.cookies?.trim() || config.extractorUrl?.trim()
    );
    if (!hasValue) {
      localStorage.removeItem(EXTRACTOR_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      EXTRACTOR_STORAGE_KEY,
      JSON.stringify({
        ...config,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function clearExtractorConfig(): void {
  try {
    localStorage.removeItem(EXTRACTOR_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function normalizeClientCookies(rawInput: string | undefined): string {
  if (!rawInput) return '';
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  const lines = trimmed.split(/\r?\n/);
  const hasNetscape = lines.some((line) => {
    const l = line.trim();
    return l && !l.startsWith('#') && l.split('\t').length >= 7;
  });

  if (hasNetscape) {
    const pairs: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const l = line.trim();
      if (!l || l.startsWith('#')) continue;
      const cols = line.split('\t');
      if (cols.length < 7) continue;
      const domain = (cols[0] || '').toLowerCase();
      if (domain && !domain.includes('youtube.com') && !domain.includes('google.com')) continue;
      const name = (cols[5] || '').trim();
      const value = (cols[6] || '').trim();
      if (!name || !value || seen.has(name)) continue;
      seen.add(name);
      pairs.push(`${name}=${value}`);
    }
    return pairs.join('; ');
  }

  return trimmed
    .replace(/^cookie:\s*/i, '')
    .replace(/[\r\n]+/g, '; ')
    .trim();
}

export function buildExtractorHeaders(configOverride?: AudioExtractorConfig): Record<string, string> {
  const cfg = configOverride || loadExtractorConfig();
  const headers: Record<string, string> = {};

  if (cfg.oauthTokens?.access_token) {
    try {
      headers['X-YouTube-OAuth'] = toBase64Url(JSON.stringify(cfg.oauthTokens));
    } catch {
      // ignore
    }
  }

  if (cfg.cookies) {
    const normalized = normalizeClientCookies(cfg.cookies).replace(/[^\x20-\x7E]/g, '');
    if (normalized) {
      headers['X-YouTube-Cookies'] = normalized;
    }
  }

  if (cfg.extractorUrl) {
    const cleanUrl = cfg.extractorUrl.trim().replace(/\/+$/, '');
    if (/^https?:\/\//i.test(cleanUrl)) {
      headers['X-Extractor-Url'] = cleanUrl;
    }
  }

  return headers;
}

export async function syncExtractorConfigToServer(
  configOverride?: AudioExtractorConfig
): Promise<void> {
  const cfg = configOverride || loadExtractorConfig();
  if (!cfg.oauthTokens?.access_token && !cfg.cookies && !cfg.extractorUrl) return;

  try {
    const res = await fetch('/api/youtube/extractor-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'restore',
        oauthTokens: cfg.oauthTokens,
        cookies: cfg.cookies,
        extractorUrl: cfg.extractorUrl,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.oauthTokens && data.oauthTokens.access_token !== cfg.oauthTokens?.access_token) {
        saveExtractorConfig({
          ...cfg,
          oauthTokens: data.oauthTokens,
        });
      }
    }
  } catch {
    // non-fatal background sync
  }
}

export async function tryClientDirectExtractor(
  videoId: string,
  extractorUrl?: string,
  signal?: AbortSignal
): Promise<{ url: string; mimeType: string } | null> {
  const cleanBase = extractorUrl?.trim().replace(/\/+$/, '');
  if (!cleanBase || !/^https?:\/\//i.test(cleanBase)) return null;

  // 1. Try Cobalt API from browser IP
  try {
    const res = await fetch(`${cleanBase}/`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        downloadMode: 'audio',
        audioFormat: 'best',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if ((data?.status === 'tunnel' || data?.status === 'redirect') && typeof data?.url === 'string') {
        return { url: data.url, mimeType: 'audio/mp4' };
      }
    }
  } catch {
    // continue
  }

  // 2. Try Piped API from browser IP
  try {
    const res = await fetch(`${cleanBase}/streams/${encodeURIComponent(videoId)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const streams: Array<{ url?: string; mimeType?: string }> = Array.isArray(data?.audioStreams)
        ? data.audioStreams
        : [];
      const picked =
        streams.find((s) => s?.url && String(s.mimeType || '').includes('audio/mp4')) ||
        streams.find((s) => s?.url && String(s.mimeType || '').startsWith('audio/'));
      if (picked?.url) {
        return {
          url: picked.url,
          mimeType: String(picked.mimeType || 'audio/mp4').split(';')[0].trim(),
        };
      }
    }
  } catch {
    // continue
  }

  return null;
}
