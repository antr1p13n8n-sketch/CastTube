import React, { useEffect, useRef } from 'react';
import { VisualizerStyle } from '../types';
import { getActiveCssThemeColors, THEME_COLORS_CHANGED_EVENT } from '../utils/themeColors';

interface AudioVisualizerProps {
  isPlaying: boolean;
  isVisible?: boolean;
  style?: VisualizerStyle;
  playbackRate?: number;
  className?: string;
}

interface PaletteStops {
  startHex: string;
  midHex: string;
  endHex: string;
  glowHex: string;
}

interface GradientCacheEntry {
  key: string;
  grad: CanvasGradient;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = React.memo(({
  isPlaying,
  isVisible = true,
  style = 'wave',
  playbackRate = 1.0,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);
  const energyRef = useRef<number>(isPlaying ? 1 : 0.05);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const playbackRateRef = useRef<number>(playbackRate);
  const styleRef = useRef<VisualizerStyle>(style);
  const wakeLoopRef = useRef<(() => void) | null>(null);

  isPlayingRef.current = isPlaying;
  playbackRateRef.current = playbackRate;
  styleRef.current = style;

  useEffect(() => {
    wakeLoopRef.current?.();
  }, [isPlaying, style, playbackRate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let logicalWidth = 200;
    let logicalHeight = 80;
    let palette: PaletteStops = getActiveCssThemeColors();
    const gradCache = new Map<string, GradientCacheEntry>();

    const getCachedGradient = (
      slot: string,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      stops: string[]
    ): CanvasGradient => {
      const key = `${logicalWidth}x${logicalHeight}::${x0},${y0},${x1},${y1}::${stops.join(',')}`;
      const existing = gradCache.get(slot);
      if (existing && existing.key === key) {
        return existing.grad;
      }
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      const count = Math.max(stops.length - 1, 1);
      stops.forEach((color, idx) => grad.addColorStop(idx / count, color));
      gradCache.set(slot, { key, grad });
      return grad;
    };

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      logicalWidth = Math.max(rect.width, 200);
      logicalHeight = Math.max(rect.height, 48);
      const nextW = Math.round(logicalWidth * dpr);
      const nextH = Math.round(logicalHeight * dpr);
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
        gradCache.clear();
      }
    };

    resize();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(canvas);
    }
    window.addEventListener('resize', resize);

    let isDarkMode = document.documentElement.classList.contains('dark');
    const themeObserver = new MutationObserver(() => {
      isDarkMode = document.documentElement.classList.contains('dark');
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const handlePaletteChange = () => {
      palette = getActiveCssThemeColors();
      gradCache.clear();
      wakeLoopRef.current?.();
    };
    window.addEventListener(THEME_COLORS_CHANGED_EVENT, handlePaletteChange);

    let stopped = false;

    const render = () => {
      if (stopped) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        animFrameIdRef.current = null;
        return;
      }

      const width = logicalWidth;
      const height = logicalHeight;
      const activePlaying = isPlayingRef.current;
      const activeRate = playbackRateRef.current;
      const activeStyle = styleRef.current;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const targetEnergy = activePlaying ? 1 : 0.05;
      energyRef.current += (targetEnergy - energyRef.current) * 0.12;
      const energy = energyRef.current;

      phaseRef.current += 0.04 * (activePlaying ? activeRate : 0.15);
      const phase = phaseRef.current;

      if (activeStyle === 'wave') {
        renderWave(ctx, width, height, phase, energy, isDarkMode, palette, getCachedGradient);
      } else if (activeStyle === 'bars') {
        renderBars(ctx, width, height, phase, energy, palette, getCachedGradient);
      } else if (activeStyle === 'radar') {
        renderRadar(ctx, width, height, phase, energy, palette, getCachedGradient);
      } else {
        renderMinimal(ctx, width, height, phase, energy, palette, getCachedGradient);
      }

      ctx.restore();

      if (!activePlaying && energy <= 0.06) {
        animFrameIdRef.current = null;
        return;
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    const scheduleFrame = () => {
      if (stopped || animFrameIdRef.current !== null) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      animFrameIdRef.current = requestAnimationFrame(render);
    };
    wakeLoopRef.current = scheduleFrame;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (animFrameIdRef.current !== null) {
          cancelAnimationFrame(animFrameIdRef.current);
          animFrameIdRef.current = null;
        }
      } else {
        scheduleFrame();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    scheduleFrame();

    return () => {
      stopped = true;
      wakeLoopRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
      resizeObserver?.disconnect();
      themeObserver.disconnect();
      window.removeEventListener(THEME_COLORS_CHANGED_EVENT, handlePaletteChange);
      window.removeEventListener('resize', resize);
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isVisible]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block rounded-xl overflow-hidden pointer-events-none ${className}`}
    />
  );
});

type CachedGradientGetter = (
  slot: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: string[]
) => CanvasGradient;

function renderWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  energy: number,
  isDark: boolean,
  palette: PaletteStops,
  getGrad: CachedGradientGetter
) {
  const centerY = height / 2;
  const scaleFactor = Math.min(1, height / 90);
  const layers = [
    {
      slot: 'wave-0',
      freq: 0.02,
      speed: 1.0,
      baseAmp: 24 * scaleFactor,
      alpha: isDark ? 0.58 : 0.45,
      stops: [palette.glowHex, palette.endHex, palette.midHex],
      width: 2.0,
    },
    {
      slot: 'wave-1',
      freq: 0.035,
      speed: -0.8,
      baseAmp: 18 * scaleFactor,
      alpha: isDark ? 0.65 : 0.5,
      stops: [palette.startHex, palette.midHex, palette.glowHex],
      width: 2.4,
    },
    {
      slot: 'wave-2',
      freq: 0.015,
      speed: 1.4,
      baseAmp: 30 * scaleFactor,
      alpha: 1,
      stops: [palette.glowHex, palette.endHex, palette.midHex, palette.startHex],
      width: 2.8,
    },
  ];

  for (let l = 0; l < layers.length; l++) {
    const layer = layers[l];
    const amp = layer.baseAmp * energy;
    ctx.save();
    ctx.globalAlpha = layer.alpha;
    ctx.beginPath();
    ctx.lineWidth = layer.width;
    ctx.strokeStyle = getGrad(layer.slot, 0, 0, width, 0, layer.stops);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let x = 0; x <= width; x += 6) {
      const normalizedX = x / width;
      const envelope = Math.sin(normalizedX * Math.PI);
      const wave1 = Math.sin(x * layer.freq + phase * layer.speed);
      const wave2 = Math.cos(x * layer.freq * 1.8 - phase * 0.5);
      const y = centerY + (wave1 * 0.7 + wave2 * 0.3) * amp * envelope;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

function renderBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  energy: number,
  palette: PaletteStops,
  getGrad: CachedGradientGetter
) {
  const barCount = 36;
  const gap = 3;
  const totalGap = gap * (barCount - 1);
  const barWidth = Math.max((width - totalGap) / barCount, 2);
  const centerY = height / 2;
  const maxAmp = (height / 2) * 0.85;

  ctx.fillStyle = getGrad('bars', 0, 0, width, height, [
    palette.glowHex,
    palette.endHex,
    palette.midHex,
    palette.startHex,
  ]);

  for (let i = 0; i < barCount; i++) {
    const x = i * (barWidth + gap);
    const normalized = i / barCount;
    const bell = Math.sin(normalized * Math.PI);

    const val1 = Math.sin(i * 0.45 + phase * 1.5);
    const val2 = Math.cos(i * 0.75 - phase * 2);
    const rawVal = Math.abs(val1 * 0.6 + val2 * 0.4);
    const barHeight = Math.max(rawVal * maxAmp * energy * bell, 4);

    const top = centerY - barHeight;
    const h = barHeight * 2;
    const radius = Math.min(barWidth / 2, 4);

    ctx.beginPath();
    ctx.roundRect(x, top, barWidth, h, radius);
    ctx.fill();
  }
}

function renderRadar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  energy: number,
  palette: PaletteStops,
  getGrad: CachedGradientGetter
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const baseRadius = Math.min(width, height) * 0.28;
  const pointCount = 72;

  ctx.beginPath();
  for (let i = 0; i <= pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    const wave = Math.sin(angle * 7 + phase * 2) * Math.cos(angle * 3 - phase);
    const r = baseRadius + wave * (16 * energy);
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = getGrad(
    'radar',
    centerX - baseRadius,
    centerY - baseRadius,
    centerX + baseRadius,
    centerY + baseRadius,
    [palette.glowHex, palette.midHex, palette.startHex]
  );
  ctx.lineWidth = 3;
  ctx.stroke();

  const pulseR = baseRadius + 18 + Math.sin(phase * 2) * 6 * energy;
  ctx.save();
  ctx.globalAlpha = 0.36;
  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.max(pulseR, 10), 0, Math.PI * 2);
  ctx.strokeStyle = palette.midHex;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function renderMinimal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  energy: number,
  palette: PaletteStops,
  getGrad: CachedGradientGetter
) {
  const barCount = 12;
  const centerY = height / 2;
  const gap = 6;
  const barWidth = 6;
  const totalWidth = barCount * barWidth + (barCount - 1) * gap;
  const startX = (width - totalWidth) / 2;

  ctx.fillStyle = getGrad('minimal', startX, 0, startX + totalWidth, 0, [
    palette.glowHex,
    palette.endHex,
    palette.midHex,
    palette.startHex,
  ]);

  for (let i = 0; i < barCount; i++) {
    const x = startX + i * (barWidth + gap);
    const wave = Math.sin(i * 0.8 + phase * 2.2);
    const h = Math.max(Math.abs(wave) * 32 * energy, 6);
    const y = centerY - h / 2;

    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, h, 3);
    ctx.fill();
  }
}
