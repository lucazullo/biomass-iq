"use client";

import { useMemo, useRef, useCallback } from "react";
import type { PropertyStatistics, AnalyticalBasis } from "@/lib/types";
import { formatBasis } from "@/lib/formatters";

interface RangeChartProps {
  statistics: PropertyStatistics[];
  title?: string;
}

function exportChartAsPng(containerEl: HTMLElement, filename: string) {
  // Collect all SVGs in the container
  const svgs = containerEl.querySelectorAll("svg");
  if (svgs.length === 0) return;

  // Create a single canvas combining all SVG sections
  const scale = 2; // retina quality
  const padding = 20;

  // Measure total height needed
  let totalHeight = padding;
  const sections: { svg: SVGSVGElement; y: number; width: number; height: number }[] = [];

  // Also capture text labels (titles, unit headers)
  const textEls = containerEl.querySelectorAll("h4, p.text-xs");

  for (const svg of svgs) {
    const rect = svg.getBoundingClientRect();
    sections.push({ svg, y: totalHeight, width: rect.width, height: rect.height });
    totalHeight += rect.height + 10;
  }
  totalHeight += padding + 40; // extra for legend

  const maxWidth = Math.max(...sections.map((s) => s.width), 600);
  const canvas = document.createElement("canvas");
  canvas.width = (maxWidth + padding * 2) * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);

  // Render each SVG to canvas sequentially
  let rendered = 0;
  const total = sections.length;

  const finalize = () => {
    // Draw legend at bottom
    const ly = totalHeight - 35;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    const cx = maxWidth / 2 + padding;

    // ±2 SD
    ctx.fillStyle = "#ccfbf1";
    ctx.fillRect(cx - 160, ly, 14, 14);
    ctx.strokeStyle = "#99f6e4";
    ctx.strokeRect(cx - 160, ly, 14, 14);
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "left";
    ctx.fillText("±2 SD", cx - 142, ly + 11);

    // ±1 SD
    ctx.fillStyle = "#5eead4";
    ctx.fillRect(cx - 80, ly, 14, 14);
    ctx.strokeStyle = "#14b8a6";
    ctx.strokeRect(cx - 80, ly, 14, 14);
    ctx.fillStyle = "#6b7280";
    ctx.fillText("±1 SD", cx - 62, ly + 11);

    // Mean
    ctx.beginPath();
    ctx.arc(cx + 7, ly + 7, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#1f2937";
    ctx.fill();
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Mean", cx + 16, ly + 11);

    // Min/Max
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = "#9ca3af";
    ctx.beginPath();
    ctx.moveTo(cx + 65, ly + 7);
    ctx.lineTo(cx + 85, ly + 7);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Min / Max", cx + 90, ly + 11);

    // Download
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  for (const section of sections) {
    // Clone and set explicit width/height so standalone rendering matches on-screen size
    const clone = section.svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(section.width));
    clone.setAttribute("height", String(section.height));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, section.y, section.width, section.height);
      URL.revokeObjectURL(url);
      rendered++;
      if (rendered === total) finalize();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rendered++;
      if (rendered === total) finalize();
    };
    img.src = url;
  }
}

const BASIS_COLORS: Record<string, { fill: string; stroke: string }> = {
  ar: { fill: "#fbbf24", stroke: "#d97706" },
  dry: { fill: "#5eead4", stroke: "#0d9488" },
  daf: { fill: "#a5b4fc", stroke: "#6366f1" },
  ash: { fill: "#fca5a5", stroke: "#dc2626" },
};

const DEFAULT_COLOR = { fill: "#94a3b8", stroke: "#64748b" };

const ROW_HEIGHT = 42;
const LABEL_WIDTH = 180;
const RIGHT_MARGIN = 55;
const LEFT_VAL_MARGIN = 30; // space for min value label
const TOP_PADDING = 30;
const BOTTOM_PADDING = 20;

export function RangeChart({ statistics, title }: RangeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(() => {
    if (!containerRef.current) return;
    const filename = `biomassiq_chart_${new Date().toISOString().slice(0, 10)}.png`;
    exportChartAsPng(containerRef.current, filename);
  }, []);

  // Filter to stats with mean and std
  const chartData = useMemo(() => {
    return statistics
      .filter((s) => s.mean != null && s.count >= 2)
      .map((s) => {
        const mean = s.mean!;
        const std = s.std ?? 0;
        const min = s.min ?? mean - 2 * std;
        const max = s.max ?? mean + 2 * std;
        return {
          ...s,
          mean,
          std,
          min,
          max,
          lo2: mean - 2 * std,
          hi2: mean + 2 * std,
          lo1: mean - 1 * std,
          hi1: mean + 1 * std,
        };
      });
  }, [statistics]);

  // Group by unit so properties with different units get separate scales
  const byUnit = useMemo(() => {
    const groups: Record<string, typeof chartData> = {};
    for (const d of chartData) {
      const key = d.unit || "unitless";
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }
    return groups;
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 py-6">
        Not enough data to chart (need at least mean and 2+ observations).
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6 bg-white">
      <div className="flex items-center justify-between">
        {title && <h4 className="text-sm font-semibold text-gray-700">{title}</h4>}
        <button
          onClick={handleExport}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 print:hidden"
          title="Export chart as PNG"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export PNG
        </button>
      </div>
      {Object.entries(byUnit).map(([unit, data]) => (
        <UnitGroup key={unit} unit={unit} data={data} />
      ))}
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-gray-700 font-medium pt-2 border-t border-gray-200">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-teal-200 border border-teal-400" />
          ±2 SD
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-teal-400 border border-teal-600" />
          ±1 SD
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-700" />
          Mean
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0 border-t border-gray-400 border-dashed" />
          Min / Max
        </span>
      </div>
    </div>
  );
}

interface ChartRow {
  property_code: string;
  display_name: string;
  unit: string;
  basis: string;
  count: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  lo2: number;
  hi2: number;
  lo1: number;
  hi1: number;
  includes_derived: boolean;
}

function UnitGroup({ unit, data }: { unit: string; data: ChartRow[] }) {
  // Compute shared scale across all properties in this unit group
  const allValues = data.flatMap((d) => [d.min, d.max, d.lo2, d.hi2]);
  const scaleMin = Math.min(...allValues);
  const scaleMax = Math.max(...allValues);
  const range = scaleMax - scaleMin || 1;
  const padding = range * 0.08;
  const domainMin = scaleMin - padding;
  const domainMax = scaleMax + padding;

  const svgHeight = TOP_PADDING + data.length * ROW_HEIGHT + BOTTOM_PADDING;

  const toX = (val: number, width: number) => {
    const plotStart = LABEL_WIDTH + LEFT_VAL_MARGIN;
    const plotWidth = width - plotStart - RIGHT_MARGIN;
    return plotStart + ((val - domainMin) / (domainMax - domainMin)) * plotWidth;
  };

  // Generate nice axis ticks
  const ticks = useMemo(() => {
    const tickCount = 5;
    const step = (domainMax - domainMin) / tickCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
    const niceStep = Math.ceil(step / magnitude) * magnitude;
    const start = Math.ceil(domainMin / niceStep) * niceStep;
    const result: number[] = [];
    for (let v = start; v <= domainMax; v += niceStep) {
      result.push(Math.round(v * 1000) / 1000);
    }
    return result;
  }, [domainMin, domainMax]);

  // Use viewBox for responsiveness
  const viewWidth = 700;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-1">Unit: {unit}</p>
      <svg
        viewBox={`0 0 ${viewWidth} ${svgHeight}`}
        className="w-full"
        style={{ maxHeight: Math.max(svgHeight, 100) }}
      >
        {/* Axis ticks and grid */}
        {ticks.map((tick) => {
          const x = toX(tick, viewWidth);
          return (
            <g key={tick}>
              <line
                x1={x} y1={TOP_PADDING - 5}
                x2={x} y2={svgHeight - BOTTOM_PADDING}
                stroke="#9ca3af" strokeWidth={0.75} strokeDasharray="2,3"
              />
              <text
                x={x} y={TOP_PADDING - 10}
                textAnchor="middle" fontSize={10} fill="#374151" fontWeight={500}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Data rows */}
        {data.map((d, i) => {
          const y = TOP_PADDING + i * ROW_HEIGHT + ROW_HEIGHT / 2;
          const colors = BASIS_COLORS[d.basis] || DEFAULT_COLOR;

          const xMin = toX(d.min, viewWidth);
          const xMax = toX(d.max, viewWidth);
          const xLo2 = toX(d.lo2, viewWidth);
          const xHi2 = toX(d.hi2, viewWidth);
          const xLo1 = toX(d.lo1, viewWidth);
          const xHi1 = toX(d.hi1, viewWidth);
          const xMean = toX(d.mean, viewWidth);

          const barH2 = 14; // ±2 SD bar height
          const barH1 = 8;  // ±1 SD bar height

          return (
            <g key={`${d.property_code}-${d.basis}`}>
              {/* Row background on hover */}
              <rect
                x={0} y={y - ROW_HEIGHT / 2}
                width={viewWidth} height={ROW_HEIGHT}
                fill="transparent"
                className="hover:fill-gray-50/80"
              />

              {/* Label */}
              <text
                x={LABEL_WIDTH - 8} y={y + 1}
                textAnchor="end" fontSize={11} fill="#1f2937"
                fontWeight={600}
              >
                {d.display_name}
              </text>
              <text
                x={LABEL_WIDTH - 8} y={y + 12}
                textAnchor="end" fontSize={9} fill="#374151" fontWeight={500}
              >
                {formatBasis(d.basis as AnalyticalBasis)} · n={d.count}
              </text>

              {/* Min-Max whisker line */}
              <line
                x1={xMin} y1={y}
                x2={xMax} y2={y}
                stroke="#4b5563" strokeWidth={1.25} strokeDasharray="3,2"
              />
              {/* Min tick */}
              <line x1={xMin} y1={y - 5} x2={xMin} y2={y + 5} stroke="#4b5563" strokeWidth={1.5} />
              {/* Max tick */}
              <line x1={xMax} y1={y - 5} x2={xMax} y2={y + 5} stroke="#4b5563" strokeWidth={1.5} />

              {/* ±2 SD range */}
              <rect
                x={xLo2} y={y - barH2 / 2}
                width={Math.max(0, xHi2 - xLo2)} height={barH2}
                fill={colors.fill} opacity={0.3}
                rx={2}
              />

              {/* ±1 SD range */}
              <rect
                x={xLo1} y={y - barH1 / 2}
                width={Math.max(0, xHi1 - xLo1)} height={barH1}
                fill={colors.fill} opacity={0.7}
                rx={2}
              />

              {/* Mean dot */}
              <circle
                cx={xMean} cy={y} r={4}
                fill="#1f2937" stroke="white" strokeWidth={1.5}
              />

              {/* Mean value above dot */}
              <text
                x={xMean} y={y - 7}
                fontSize={9} fill="#1f2937" fontWeight={600}
                textAnchor="middle"
              >
                {d.mean.toFixed(1)}
              </text>

              {/* Min value label (left of min tick) */}
              <text
                x={xMin - 6} y={y + 3}
                fontSize={9} fill="#374151" fontWeight={500}
                textAnchor="end"
              >
                {d.min.toFixed(1)}
              </text>

              {/* Max value label (right of max tick) */}
              <text
                x={xMax + 6} y={y + 3}
                fontSize={9} fill="#374151" fontWeight={500}
              >
                {d.max.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Bottom axis line */}
        <line
          x1={LABEL_WIDTH + LEFT_VAL_MARGIN} y1={svgHeight - BOTTOM_PADDING}
          x2={viewWidth - RIGHT_MARGIN} y2={svgHeight - BOTTOM_PADDING}
          stroke="#4b5563" strokeWidth={1.25}
        />
        {/* Top axis line */}
        <line
          x1={LABEL_WIDTH + LEFT_VAL_MARGIN} y1={TOP_PADDING - 5}
          x2={viewWidth - RIGHT_MARGIN} y2={TOP_PADDING - 5}
          stroke="#4b5563" strokeWidth={1.25}
        />
      </svg>
    </div>
  );
}

