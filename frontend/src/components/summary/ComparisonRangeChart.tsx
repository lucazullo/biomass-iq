"use client";

import { useMemo, useRef, useCallback } from "react";
import type { Summary, PropertyStatistics } from "@/lib/types";
import { formatBasis } from "@/lib/formatters";
import { SUBSTANCE_COLORS } from "./ComparisonStats";

interface ComparisonRow {
  property_code: string;
  display_name: string;
  unit: string;
  basis: string;
  perSubstance: Record<string, PropertyStatistics | null>;
}

interface ComparisonRangeChartProps {
  summaries: Summary[];
  rows: ComparisonRow[];
  title?: string;
}

const SUBSTANCE_ROW_HEIGHT = 22;
const PROPERTY_GAP = 12;
const LABEL_WIDTH = 200;
const RIGHT_MARGIN = 55;
const LEFT_VAL_MARGIN = 30;
const TOP_PADDING = 35;
const BOTTOM_PADDING = 20;

function exportChartAsPng(containerEl: HTMLElement, filename: string) {
  const svgs = containerEl.querySelectorAll("svg");
  if (svgs.length === 0) return;
  const scale = 2;
  const padding = 20;
  let totalHeight = padding;
  const sections: { svg: SVGSVGElement; y: number; width: number; height: number }[] = [];
  for (const svg of svgs) {
    const rect = svg.getBoundingClientRect();
    sections.push({ svg, y: totalHeight, width: rect.width, height: rect.height });
    totalHeight += rect.height + 10;
  }
  totalHeight += padding;
  const maxWidth = Math.max(...sections.map((s) => s.width), 700);
  const canvas = document.createElement("canvas");
  canvas.width = (maxWidth + padding * 2) * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
  let rendered = 0;
  const finalize = () => {
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  for (const section of sections) {
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
      if (rendered === sections.length) finalize();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rendered++;
      if (rendered === sections.length) finalize();
    };
    img.src = url;
  }
}

export function ComparisonRangeChart({ summaries, rows, title }: ComparisonRangeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(() => {
    if (!containerRef.current) return;
    exportChartAsPng(
      containerRef.current,
      `biomassiq_comparison_chart_${new Date().toISOString().slice(0, 10)}.png`,
    );
  }, []);

  // Filter rows that have at least 2 substances with data
  const usableRows = useMemo(() => {
    return rows.filter((row) => {
      const withData = summaries.filter((s) => {
        const stat = row.perSubstance[s.substance_id];
        return stat?.mean != null && stat.count >= 1;
      });
      return withData.length >= 1;
    });
  }, [rows, summaries]);

  // Group by unit
  const byUnit = useMemo(() => {
    const groups: Record<string, ComparisonRow[]> = {};
    for (const r of usableRows) {
      const key = r.unit || "unitless";
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return groups;
  }, [usableRows]);

  if (usableRows.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 py-6">
        No comparable data — need properties with values in at least one substance.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6 bg-white">
      <div className="flex items-center justify-between">
        {title && <h4 className="text-sm font-semibold text-gray-700">{title}</h4>}
        <button
          onClick={handleExport}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
          title="Export chart as PNG"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export PNG
        </button>
      </div>

      {Object.entries(byUnit).map(([unit, data]) => (
        <UnitGroup key={unit} unit={unit} rows={data} summaries={summaries} />
      ))}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-gray-700 font-medium pt-2 border-t border-gray-200">
        {summaries.map((s, i) => (
          <span key={s.substance_id} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm border"
              style={{
                backgroundColor: SUBSTANCE_COLORS[i % SUBSTANCE_COLORS.length].fill,
                borderColor: SUBSTANCE_COLORS[i % SUBSTANCE_COLORS.length].stroke,
              }}
            />
            <span className="truncate max-w-[140px]">{s.substance_name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function UnitGroup({ unit, rows, summaries }: { unit: string; rows: ComparisonRow[]; summaries: Summary[] }) {
  // Compute shared scale across all values in this unit group
  const allValues: number[] = [];
  for (const r of rows) {
    for (const s of summaries) {
      const st = r.perSubstance[s.substance_id];
      if (!st) continue;
      if (st.min != null) allValues.push(st.min);
      if (st.max != null) allValues.push(st.max);
      if (st.mean != null && st.std != null) {
        allValues.push(st.mean - 2 * st.std);
        allValues.push(st.mean + 2 * st.std);
      }
    }
  }
  const scaleMin = Math.min(...allValues);
  const scaleMax = Math.max(...allValues);
  const range = scaleMax - scaleMin || 1;
  const padding = range * 0.08;
  const domainMin = scaleMin - padding;
  const domainMax = scaleMax + padding;

  // Compute total height: each row has (num substances with data) sub-rows + gap + label
  const rowSizes = rows.map((r) => {
    const withData = summaries.filter((s) => {
      const stat = r.perSubstance[s.substance_id];
      return stat?.mean != null && stat.count >= 1;
    });
    return { count: withData.length, substances: withData };
  });

  const totalRowsHeight = rowSizes.reduce((sum, rs) => sum + rs.count * SUBSTANCE_ROW_HEIGHT + PROPERTY_GAP + 18, 0);
  const svgHeight = TOP_PADDING + totalRowsHeight + BOTTOM_PADDING;

  const viewWidth = 800;
  const toX = (val: number) => {
    const plotStart = LABEL_WIDTH + LEFT_VAL_MARGIN;
    const plotWidth = viewWidth - plotStart - RIGHT_MARGIN;
    return plotStart + ((val - domainMin) / (domainMax - domainMin)) * plotWidth;
  };

  const tickCount = 5;
  const step = (domainMax - domainMin) / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(step) || 1)));
  const niceStep = Math.ceil(step / magnitude) * magnitude;
  const tickStart = Math.ceil(domainMin / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = tickStart; v <= domainMax; v += niceStep) {
    ticks.push(Math.round(v * 1000) / 1000);
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-1">Unit: {unit}</p>
      <svg
        viewBox={`0 0 ${viewWidth} ${svgHeight}`}
        className="w-full"
      >
        {/* Axis ticks and grid */}
        {ticks.map((tick) => {
          const x = toX(tick);
          return (
            <g key={tick}>
              <line
                x1={x} y1={TOP_PADDING - 5}
                x2={x} y2={svgHeight - BOTTOM_PADDING}
                stroke="#9ca3af" strokeWidth={0.75} strokeDasharray="2,3"
              />
              <text x={x} y={TOP_PADDING - 10} textAnchor="middle" fontSize={10} fill="#374151" fontWeight={500}>
                {tick}
              </text>
            </g>
          );
        })}

        {/* Top axis line */}
        <line
          x1={LABEL_WIDTH + LEFT_VAL_MARGIN} y1={TOP_PADDING - 5}
          x2={viewWidth - RIGHT_MARGIN} y2={TOP_PADDING - 5}
          stroke="#4b5563" strokeWidth={1.25}
        />

        {/* Render each property as a group with substance sub-rows */}
        {(() => {
          let currentY = TOP_PADDING + 5;
          return rows.map((row) => {
            const withData = summaries
              .map((s, i) => ({ s, i, stat: row.perSubstance[s.substance_id] }))
              .filter((x) => x.stat?.mean != null && x.stat.count >= 1);
            const blockHeight = withData.length * SUBSTANCE_ROW_HEIGHT + 18;
            const startY = currentY;
            currentY += blockHeight + PROPERTY_GAP;

            return (
              <g key={`${row.property_code}-${row.basis}`}>
                {/* Property label and basis */}
                <text
                  x={LABEL_WIDTH - 8} y={startY + 10}
                  textAnchor="end" fontSize={12} fill="#1f2937" fontWeight={600}
                >
                  {row.display_name}
                </text>
                <text
                  x={LABEL_WIDTH - 8} y={startY + 22}
                  textAnchor="end" fontSize={9} fill="#6b7280"
                >
                  {formatBasis(row.basis as "ar" | "dry" | "daf")}
                </text>

                {/* Separator line between property groups */}
                <line
                  x1={0} y1={startY - 6}
                  x2={viewWidth} y2={startY - 6}
                  stroke="#f3f4f6" strokeWidth={1}
                />

                {/* Each substance gets its own row */}
                {withData.map((entry, idx) => {
                  const stat = entry.stat!;
                  const y = startY + 18 + idx * SUBSTANCE_ROW_HEIGHT + SUBSTANCE_ROW_HEIGHT / 2;
                  const colors = SUBSTANCE_COLORS[entry.i % SUBSTANCE_COLORS.length];
                  const mean = stat.mean!;
                  const std = stat.std ?? 0;
                  const min = stat.min ?? mean - 2 * std;
                  const max = stat.max ?? mean + 2 * std;
                  const xMin = toX(min);
                  const xMax = toX(max);
                  const xLo2 = toX(mean - 2 * std);
                  const xHi2 = toX(mean + 2 * std);
                  const xLo1 = toX(mean - std);
                  const xHi1 = toX(mean + std);
                  const xMean = toX(mean);

                  return (
                    <g key={entry.s.substance_id}>
                      {/* Substance label (small) */}
                      <text
                        x={LABEL_WIDTH + LEFT_VAL_MARGIN - 10} y={y + 3}
                        textAnchor="end" fontSize={9} fill={colors.stroke} fontWeight={500}
                      >
                        n={stat.count}
                      </text>

                      {/* Min/Max whisker */}
                      <line
                        x1={xMin} y1={y} x2={xMax} y2={y}
                        stroke={colors.stroke} strokeWidth={1} strokeDasharray="3,2" opacity={0.8}
                      />
                      <line x1={xMin} y1={y - 4} x2={xMin} y2={y + 4} stroke={colors.stroke} strokeWidth={1.25} />
                      <line x1={xMax} y1={y - 4} x2={xMax} y2={y + 4} stroke={colors.stroke} strokeWidth={1.25} />

                      {/* ±2 SD */}
                      {std > 0 && (
                        <rect
                          x={xLo2} y={y - 7}
                          width={Math.max(0, xHi2 - xLo2)} height={14}
                          fill={colors.fill} opacity={0.25} rx={2}
                        />
                      )}
                      {/* ±1 SD */}
                      {std > 0 && (
                        <rect
                          x={xLo1} y={y - 4}
                          width={Math.max(0, xHi1 - xLo1)} height={8}
                          fill={colors.fill} opacity={0.7} rx={2}
                        />
                      )}

                      {/* Mean dot */}
                      <circle cx={xMean} cy={y} r={3.5} fill={colors.stroke} stroke="white" strokeWidth={1.2} />

                      {/* Mean value above */}
                      <text
                        x={xMean} y={y - 8}
                        fontSize={9} fill={colors.stroke} fontWeight={600}
                        textAnchor="middle"
                      >
                        {mean.toFixed(2)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          });
        })()}

        {/* Bottom axis line */}
        <line
          x1={LABEL_WIDTH + LEFT_VAL_MARGIN} y1={svgHeight - BOTTOM_PADDING}
          x2={viewWidth - RIGHT_MARGIN} y2={svgHeight - BOTTOM_PADDING}
          stroke="#4b5563" strokeWidth={1.25}
        />
      </svg>
    </div>
  );
}
