import { useEffect, useRef, useCallback } from "react";

import { cn } from "@/lib/utils";

/**
 * A waveform visualizer that renders based on a volume getter function.
 * This component shows real-time audio visualization using volume data
 * from the ElevenLabs conversation API.
 */
export function VolumeWaveform({
  getVolume,
  label,
  barWidth = 3,
  barGap = 2,
  barRadius = 1.5,
  barColor,
  baseBarHeight = 4,
  height = 48,
  historySize = 50,
  updateRate = 50,
  isActive = false,
  className,
  ...props
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const historyRef = useRef([]);
  const animationRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const gradientCacheRef = useRef(null);
  const lastWidthRef = useRef(0);

  const heightStyle = typeof height === "number" ? `${height}px` : height;

  // Handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      gradientCacheRef.current = null;
      lastWidthRef.current = rect.width;
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Get volume value safely
  const getVolumeValue = useCallback(() => {
    if (!isActive || !getVolume) return 0;
    try {
      const value = getVolume();
      return Math.min(1, Math.max(0, value || 0));
    } catch {
      return 0;
    }
  }, [getVolume, isActive]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId;

    const animate = (currentTime) => {
      const rect = canvas.getBoundingClientRect();

      // Update volume history
      if (currentTime - lastUpdateRef.current > updateRate) {
        lastUpdateRef.current = currentTime;

        const volume = getVolumeValue();
        historyRef.current.push(Math.max(0.05, volume));

        // Maintain history size
        while (historyRef.current.length > historySize) {
          historyRef.current.shift();
        }
      }

      // Clear and redraw
      ctx.clearRect(0, 0, rect.width, rect.height);

      const computedBarColor =
        barColor ||
        (() => {
          const style = getComputedStyle(canvas);
          return style.color || "#888";
        })();

      const step = barWidth + barGap;
      const barCount = Math.floor(rect.width / step);
      const centerY = rect.height / 2;
      const history = historyRef.current;

      // Draw bars from right to left (most recent on the right)
      for (let i = 0; i < barCount && i < history.length; i++) {
        const dataIndex = history.length - 1 - i;
        const value = history[dataIndex] || 0.05;
        const x = rect.width - (i + 1) * step;
        // Reduce sensitivity by scaling down the bar height multiplier
        const barHeight = Math.max(baseBarHeight, value * rect.height * 0.9);
        const y = centerY - barHeight / 2;

        ctx.fillStyle = computedBarColor;
        ctx.globalAlpha = 0.3 + value * 0.7;

        if (barRadius > 0) {
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, barRadius);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      }

      // Apply edge fading
      const fadeWidth = 24;
      if (fadeWidth > 0 && rect.width > 0) {
        if (!gradientCacheRef.current || lastWidthRef.current !== rect.width) {
          const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
          const fadePercent = Math.min(0.3, fadeWidth / rect.width);

          gradient.addColorStop(0, "rgba(255,255,255,1)");
          gradient.addColorStop(fadePercent, "rgba(255,255,255,0)");
          gradient.addColorStop(1 - fadePercent, "rgba(255,255,255,0)");
          gradient.addColorStop(1, "rgba(255,255,255,1)");

          gradientCacheRef.current = gradient;
          lastWidthRef.current = rect.width;
        }

        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = gradientCacheRef.current;
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [
    barWidth,
    barGap,
    barRadius,
    barColor,
    baseBarHeight,
    historySize,
    updateRate,
    getVolumeValue,
  ]);

  // Clear history when becoming inactive
  useEffect(() => {
    if (!isActive) {
      // Fade out the bars gradually
      const fadeOut = () => {
        if (historyRef.current.length > 0) {
          historyRef.current = historyRef.current
            .map((v) => v * 0.85)
            .filter((v) => v > 0.01);

          if (historyRef.current.length > 0) {
            requestAnimationFrame(fadeOut);
          }
        }
      };
      fadeOut();
    }
  }, [isActive]);

  return (
    <div className={cn("flex flex-col gap-1", className)} {...props}>
      {label && (
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>
      )}
      <div
        className="relative w-full"
        ref={containerRef}
        style={{ height: heightStyle }}
        aria-label={label || "Audio waveform"}
        role="img"
      >
        {!isActive && (
          <div className="border-muted-foreground/20 absolute top-1/2 right-0 left-0 -translate-y-1/2 border-t-2 border-dotted" />
        )}
        <canvas
          className="block h-full w-full"
          ref={canvasRef}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

