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

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let palette: PaletteStops = getActiveCssThemeColors();

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(rect.width * dpr, 200);
      canvas.height = Math.max(rect.height * dpr, 80);
    };

    resize();
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
    };
    window.addEventListener(THEME_COLORS_CHANGED_EVENT, handlePaletteChange);

    let stopped = false;

    const render = () => {
      if (stopped) return;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Smooth energy transition
      const targetEnergy = isPlaying ? 1 : 0.05;
      energyRef.current += (targetEnergy - energyRef.current) * 0.1;
      const energy = energyRef.current;

      // Advance phase based on playbackRate
      phaseRef.current += 0.04 * (isPlaying ? playbackRate : 0.15);
      const phase = phaseRef.current;

      if (style === 'wave') {
        renderWave(ctx, width, height, phase, energy, isDarkMode, palette);
      } else if (style === 'bars') {
        renderBars(ctx, width, height, phase, energy, isDarkMode, palette);
      } else if (style === 'radar') {
        renderRadar(ctx, width, height, phase, energy, isDarkMode, palette);
      } else {
        renderMinimal(ctx, width, height, phase, energy, isDarkMode, palette);
      }

      ctx.restore();

      // Stop 60fps rAF completely once paused and settled to save CPU/battery
      if (!isPlaying && energy <= 0.06) {
        animFrameIdRef.current = null;
        return;
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      stopped = true;
      themeObserver.disconnect();
      window.removeEventListener(THEME_COLORS_CHANGED_EVENT, handlePaletteChange);
      window.removeEventListener('resize', resize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isPlaying, isVisible, style, playbackRate]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block rounded-xl overflow-hidden pointer-events-none ${className}`}
    />
  );
};

function createSpectrumGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: string[]
) {
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  const count = Math.max(stops.length - 1, 1);
  stops.forEach((color, idx) => grad.addColorStop(idx / count, color));
  return grad;
}

function renderWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  energy: number,
  isDark: boolean,
  palette: PaletteStops
) {
  const centerY = height / 2;
  const layers = [
    {
      freq: 0.02,
      speed: 1.0,
      baseAmp: 26,
      alpha: isDark ? 0.58 : 0.45,
      stops: [palette.glowHex, palette.endHex, palette.midHex],
      width: 2.2,
    },
    {
      freq: 0.035,
      speed: -0.8,
      baseAmp: 20,
      alpha: isDark ? 0.65 : 0.5,
      stops: [palette.startHex, palette.midHex, palette.glowHex],
      width: 2.6,
    },
    {
      freq: 0.015,
      speed: 1.4,
      baseAmp: 34,
      alpha: 1,
      stops: [palette.glowHex, palette.endHex, palette.midHex, palette.startHex],
      width: 3.2,
    },
  ];

  for (let l = 0; l < layers.length; l++) {
    const layer = layers[l];
    const amp = layer.baseAmp * energy;
    ctx.save();
    ctx.globalAlpha = layer.alpha;
    ctx.beginPath();
    ctx.lineWidth = layer.width;
    ctx.strokeStyle = createSpectrumGradient(ctx, 0, 0, width, 0, layer.stops);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let x = 0; x <= width; x += 5) {
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
  _isDark: boolean,
  palette: PaletteStops
) {
  const barCount = 36;
  const gap = 3;
  const totalGap = gap * (barCount - 1);
  const barWidth = Math.max((width - totalGap) / barCount, 2);
  const centerY = height / 2;
  const maxAmp = (height / 2) * 0.85;

  const gradient = createSpectrumGradient(ctx, 0, 0, width, height, [
    palette.glowHex,
    palette.endHex,
    palette.midHex,
    palette.startHex,
  ]);
  ctx.fillStyle = gradient;

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
  _isDark: boolean,
  palette: PaletteStops
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
  ctx.strokeStyle = createSpectrumGradient(
    ctx,
    centerX - baseRadius,
    centerY - baseRadius,
    centerX + baseRadius,
    centerY + baseRadius,
    [palette.glowHex, palette.midHex, palette.startHex]
  );
  ctx.lineWidth = 3;
  ctx.stroke();

  // Outer pulse ring
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
  _isDark: boolean,
  palette: PaletteStops
) {
  const barCount = 12;
  const centerY = height / 2;
  const gap = 6;
  const barWidth = 6;
  const totalWidth = barCount * barWidth + (barCount - 1) * gap;
  const startX = (width - totalWidth) / 2;

  ctx.fillStyle = createSpectrumGradient(ctx, startX, 0, startX + totalWidth, 0, [
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
