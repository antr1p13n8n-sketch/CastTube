import React, { useEffect, useRef } from 'react';
import { VisualizerStyle } from '../types';

interface AudioVisualizerProps {
  isPlaying: boolean;
  isVisible?: boolean;
  style?: VisualizerStyle;
  playbackRate?: number;
  className?: string;
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

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(rect.width * dpr, 200);
      canvas.height = Math.max(rect.height * dpr, 80);
    };

    resize();
    window.addEventListener('resize', resize);

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

      const isDarkMode = document.documentElement.classList.contains('dark');

      if (style === 'wave') {
        renderWave(ctx, width, height, phase, energy, isDarkMode);
      } else if (style === 'bars') {
        renderBars(ctx, width, height, phase, energy, isDarkMode);
      } else if (style === 'radar') {
        renderRadar(ctx, width, height, phase, energy, isDarkMode);
      } else {
        renderMinimal(ctx, width, height, phase, energy, isDarkMode);
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

function renderWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  energy: number,
  isDark: boolean
) {
  const centerY = height / 2;
  const layers = [
    { freq: 0.02, speed: 1.0, amp: 26 * energy, color: isDark ? 'rgba(239, 68, 68, 0.45)' : 'rgba(220, 38, 38, 0.35)', width: 2 },
    { freq: 0.035, speed: -0.8, amp: 20 * energy, color: isDark ? 'rgba(249, 115, 22, 0.6)' : 'rgba(234, 88, 12, 0.5)', width: 2.5 },
    { freq: 0.015, speed: 1.4, amp: 34 * energy, color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.85)', width: 3 },
  ];

  layers.forEach((layer) => {
    ctx.beginPath();
    ctx.lineWidth = layer.width;
    ctx.strokeStyle = layer.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let x = 0; x <= width; x += 4) {
      // Envelope so waves taper cleanly at left and right edges
      const normalizedX = x / width;
      const envelope = Math.sin(normalizedX * Math.PI);
      const wave1 = Math.sin(x * layer.freq + phase * layer.speed);
      const wave2 = Math.cos(x * layer.freq * 1.8 - phase * 0.5);
      const y = centerY + (wave1 * 0.7 + wave2 * 0.3) * layer.amp * envelope;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  });
}

function renderBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  energy: number,
  isDark: boolean
) {
  const barCount = 36;
  const gap = 3;
  const totalGap = gap * (barCount - 1);
  const barWidth = Math.max((width - totalGap) / barCount, 2);
  const centerY = height / 2;
  const maxAmp = (height / 2) * 0.85;

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (isDark) {
    gradient.addColorStop(0, '#f87171');
    gradient.addColorStop(0.5, '#ef4444');
    gradient.addColorStop(1, '#b91c1c');
  } else {
    gradient.addColorStop(0, '#ef4444');
    gradient.addColorStop(0.5, '#dc2626');
    gradient.addColorStop(1, '#991b1b');
  }
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
  isDark: boolean
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
  ctx.strokeStyle = isDark ? '#ef4444' : '#dc2626';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Outer pulse ring
  const pulseR = baseRadius + 18 + (Math.sin(phase * 2) * 6 * energy);
  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.max(pulseR, 10), 0, Math.PI * 2);
  ctx.strokeStyle = isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function renderMinimal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  energy: number,
  isDark: boolean
) {
  const barCount = 12;
  const centerY = height / 2;
  const gap = 6;
  const barWidth = 6;
  const totalWidth = barCount * barWidth + (barCount - 1) * gap;
  const startX = (width - totalWidth) / 2;

  for (let i = 0; i < barCount; i++) {
    const x = startX + i * (barWidth + gap);
    const wave = Math.sin(i * 0.8 + phase * 2.2);
    const h = Math.max(Math.abs(wave) * 32 * energy, 6);
    const y = centerY - h / 2;

    ctx.fillStyle = isDark ? '#f87171' : '#dc2626';
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, h, 3);
    ctx.fill();
  }
}
