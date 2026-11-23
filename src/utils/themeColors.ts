import { PrimaryThemeConfig, PrimaryThemePresetId } from '../types';

export interface ThemePresetDefinition {
  id: Exclude<PrimaryThemePresetId, 'custom'>;
  name: string;
  description: string;
  startHex: string;
  midHex: string;
  endHex: string;
  glowHex: string;
}

export const THEME_PRESETS: ThemePresetDefinition[] = [
  {
    id: 'prism',
    name: 'Prisma Neon',
    description: 'Rose, fuchsia, dan indigo bawaan CastTube',
    startHex: '#f43f5e',
    midHex: '#d946ef',
    endHex: '#6366f1',
    glowHex: '#06b6d4',
  },
  {
    id: 'ocean',
    name: 'Samudra Biru',
    description: 'Cyan cerah, biru langit, dan cobalt modern',
    startHex: '#06b6d4',
    midHex: '#0ea5e9',
    endHex: '#2563eb',
    glowHex: '#10b981',
  },
  {
    id: 'sunset',
    name: 'Senja Hangat',
    description: 'Oranye koral, merah menyala, dan magenta',
    startHex: '#f97316',
    midHex: '#ef4444',
    endHex: '#db2777',
    glowHex: '#f59e0b',
  },
  {
    id: 'emerald',
    name: 'Zamrud Segar',
    description: 'Hijau zamrud, teal, dan aqua kontras tinggi',
    startHex: '#10b981',
    midHex: '#14b8a6',
    endHex: '#0284c7',
    glowHex: '#34d399',
  },
  {
    id: 'violet',
    name: 'Ungu Kosmik',
    description: 'Violet elektrik, lavender, dan nila dalam',
    startHex: '#c026d3',
    midHex: '#8b5cf6',
    endHex: '#4f46e5',
    glowHex: '#ec4899',
  },
  {
    id: 'amber',
    name: 'Emas Surya',
    description: 'Amber hangat, oranye terang, dan merah bata',
    startHex: '#f59e0b',
    midHex: '#ea580c',
    endHex: '#dc2626',
    glowHex: '#fbbf24',
  },
];

export const DEFAULT_PRIMARY_THEME: PrimaryThemeConfig = {
  presetId: 'prism',
  startHex: '#f43f5e',
  midHex: '#d946ef',
  endHex: '#6366f1',
  glowHex: '#06b6d4',
};

const STORAGE_KEY = 'casttube_primary_theme_v1';
export const THEME_COLORS_CHANGED_EVENT = 'casttube-theme-colors-changed';

export function normalizeHex(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
    return cleaned.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = cleaned[1];
    const g = cleaned[2];
    const b = cleaned[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const norm = normalizeHex(hex, '#d946ef');
  return {
    r: parseInt(norm.slice(1, 3), 16),
    g: parseInt(norm.slice(3, 5), 16),
    b: parseInt(norm.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeLuminance({ r, g, b }: RGB): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function mixRgb(a: RGB, b: RGB, ratio: number): RGB {
  return {
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
  };
}

// Derive WCAG AA readable text variant against light (#ffffff) or dark (#0f172a) surfaces
function deriveReadableAccent(hex: string, surface: 'light' | 'dark'): string {
  const base = hexToRgb(hex);
  const targetLum = relativeLuminance(base);

  if (surface === 'light') {
    // Contrast >= 4.5:1 against white requires relative luminance <= ~0.183
    if (targetLum <= 0.175) return rgbToHex(base);
    const darkAnchor: RGB = { r: 15, g: 23, b: 42 };
    let lo = 0;
    let hi = 1;
    let best = base;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const candidate = mixRgb(base, darkAnchor, mid);
      if (relativeLuminance(candidate) <= 0.175) {
        best = candidate;
        hi = mid;
      } else {
        lo = mid;
      }
    }
    return rgbToHex(best);
  }

  // Dark surface (#0f172a has luminance ~0.017) -> >= 4.5:1 contrast requires lum >= 0.25
  if (targetLum >= 0.32) return rgbToHex(base);
  const whiteAnchor: RGB = { r: 248, g: 250, b: 252 };
  let lo = 0;
  let hi = 1;
  let best = base;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const candidate = mixRgb(base, whiteAnchor, mid);
    if (relativeLuminance(candidate) >= 0.34) {
      best = candidate;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return rgbToHex(best);
}

function deriveButtonTextContrast(startHex: string, midHex: string, endHex: string): string {
  const avgLum =
    (relativeLuminance(hexToRgb(startHex)) +
      relativeLuminance(hexToRgb(midHex)) +
      relativeLuminance(hexToRgb(endHex))) /
    3;
  // White has contrast >= 4.5:1 when background luminance <= ~0.18, and >= 3:1 (large/bold UI) <= ~0.35
  return avgLum > 0.36 ? '#0f172a' : '#ffffff';
}

export function loadPrimaryThemeConfig(): PrimaryThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PrimaryThemeConfig>;
      if (parsed && typeof parsed === 'object') {
        const presetMatch = THEME_PRESETS.find((p) => p.id === parsed.presetId);
        if (presetMatch && parsed.presetId !== 'custom') {
          return {
            presetId: presetMatch.id,
            startHex: presetMatch.startHex,
            midHex: presetMatch.midHex,
            endHex: presetMatch.endHex,
            glowHex: presetMatch.glowHex,
          };
        }
        return {
          presetId: 'custom',
          startHex: normalizeHex(parsed.startHex, DEFAULT_PRIMARY_THEME.startHex),
          midHex: normalizeHex(parsed.midHex, DEFAULT_PRIMARY_THEME.midHex),
          endHex: normalizeHex(parsed.endHex, DEFAULT_PRIMARY_THEME.endHex),
          glowHex: normalizeHex(parsed.glowHex, DEFAULT_PRIMARY_THEME.glowHex),
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_PRIMARY_THEME;
}

export function savePrimaryThemeConfig(config: PrimaryThemeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}

export function applyPrimaryThemeColors(config: PrimaryThemeConfig): void {
  if (typeof document === 'undefined') return;
  const startHex = normalizeHex(config.startHex, DEFAULT_PRIMARY_THEME.startHex);
  const midHex = normalizeHex(config.midHex, DEFAULT_PRIMARY_THEME.midHex);
  const endHex = normalizeHex(config.endHex, DEFAULT_PRIMARY_THEME.endHex);
  const glowHex = normalizeHex(config.glowHex, startHex);

  const root = document.documentElement;
  const s = root.style;

  s.setProperty('--ct-start', startHex);
  s.setProperty('--ct-mid', midHex);
  s.setProperty('--ct-end', endHex);
  s.setProperty('--ct-glow', glowHex);
  s.setProperty('--ct-btn-text', deriveButtonTextContrast(startHex, midHex, endHex));

  s.setProperty('--ct-text-light', deriveReadableAccent(midHex, 'light'));
  s.setProperty('--ct-text-dark', deriveReadableAccent(midHex, 'dark'));
  s.setProperty('--ct-end-light', deriveReadableAccent(endHex, 'light'));
  s.setProperty('--ct-end-dark', deriveReadableAccent(glowHex, 'dark'));

  s.setProperty('--ct-shadow', rgba(midHex, 0.28));
  s.setProperty('--ct-border-light', rgba(midHex, 0.34));
  s.setProperty('--ct-border-dark', rgba(midHex, 0.44));

  s.setProperty('--ct-soft-from', rgba(startHex, 0.1));
  s.setProperty('--ct-soft-mid', rgba(midHex, 0.09));
  s.setProperty('--ct-soft-to', rgba(endHex, 0.1));
  s.setProperty('--ct-soft-from-dark', rgba(startHex, 0.19));
  s.setProperty('--ct-soft-mid-dark', rgba(midHex, 0.17));
  s.setProperty('--ct-soft-to-dark', rgba(endHex, 0.2));

  s.setProperty('--ct-blob-1-light', rgba(startHex, 0.11));
  s.setProperty('--ct-blob-2-light', rgba(glowHex, 0.11));
  s.setProperty('--ct-blob-3-light', rgba(endHex, 0.09));
  s.setProperty('--ct-blob-4-light', rgba(midHex, 0.08));

  s.setProperty('--ct-blob-1-dark', rgba(startHex, 0.16));
  s.setProperty('--ct-blob-2-dark', rgba(glowHex, 0.14));
  s.setProperty('--ct-blob-3-dark', rgba(endHex, 0.16));
  s.setProperty('--ct-blob-4-dark', rgba(midHex, 0.11));

  s.setProperty('--ct-scroll-start', rgba(startHex, 0.48));
  s.setProperty('--ct-scroll-end', rgba(endHex, 0.48));
  s.setProperty('--ct-scroll-start-hover', rgba(startHex, 0.78));
  s.setProperty('--ct-scroll-end-hover', rgba(endHex, 0.78));

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', midHex);
  }

  window.dispatchEvent(
    new CustomEvent(THEME_COLORS_CHANGED_EVENT, {
      detail: {
        presetId: config.presetId,
        startHex,
        midHex,
        endHex,
        glowHex,
      },
    })
  );
}

export function getActiveCssThemeColors(): {
  startHex: string;
  midHex: string;
  endHex: string;
  glowHex: string;
  btnText: string;
} {
  if (typeof window === 'undefined') {
    return {
      startHex: DEFAULT_PRIMARY_THEME.startHex,
      midHex: DEFAULT_PRIMARY_THEME.midHex,
      endHex: DEFAULT_PRIMARY_THEME.endHex,
      glowHex: DEFAULT_PRIMARY_THEME.glowHex,
      btnText: '#ffffff',
    };
  }
  const cs = getComputedStyle(document.documentElement);
  return {
    startHex: cs.getPropertyValue('--ct-start').trim() || DEFAULT_PRIMARY_THEME.startHex,
    midHex: cs.getPropertyValue('--ct-mid').trim() || DEFAULT_PRIMARY_THEME.midHex,
    endHex: cs.getPropertyValue('--ct-end').trim() || DEFAULT_PRIMARY_THEME.endHex,
    glowHex: cs.getPropertyValue('--ct-glow').trim() || DEFAULT_PRIMARY_THEME.glowHex,
    btnText: cs.getPropertyValue('--ct-btn-text').trim() || '#ffffff',
  };
}
