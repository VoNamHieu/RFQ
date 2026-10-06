import React, { useLayoutEffect, useRef, useState } from 'react';

// SVG stand-ins for the polaris-viz LineChart / BarChart (same series, axes,
// labels, legend and hover tooltip). Data shape matches polaris-viz:
//   series = [{ name, data: [{ key, value }] }]
// xLabel(key) formats axis ticks, yLabel(value) formats the y axis, tooltipTitle(key)
// and tooltipValue(value) format the hover tooltip.

export const SERIES_COLOR = '#1F7AE0';
const PLOT_HEIGHT = 230;
const MARGIN = { top: 12, right: 12, bottom: 28 };
const AXIS_FONT = 11;

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Clean axis steps (1 / 2 / 2.5 / 5 × 10^n), like d3's nice().
function niceTicks(max, { integer = false, count = 4 } = {}) {
  const top0 = max > 0 ? max : integer ? 4 : 10;
  const raw = top0 / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  let step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
  if (integer) step = Math.max(1, Math.round(step));
  const top = Math.ceil(top0 / step - 1e-9) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { ticks, top };
}

const textWidth = (s) => String(s).length * 6.3;

function useChartGeometry({ series, xLabel, yLabel, integer, width }) {
  const points = series[0]?.data || [];
  const max = Math.max(0, ...series.flatMap((s) => s.data.map((d) => Number(d.value) || 0)));
  const { ticks, top } = niceTicks(max, { integer });
  const yTickLabels = ticks.map((t) => yLabel(t));
  const left = Math.ceil(Math.max(...yTickLabels.map(textWidth), 10)) + 12;
  const plotW = Math.max(40, width - left - MARGIN.right);
  const y = (v) => MARGIN.top + PLOT_HEIGHT - (top ? (v / top) * PLOT_HEIGHT : 0);
  const xLabels = points.map((p) => xLabel(p.key));
  const labelW = Math.max(...xLabels.map(textWidth), 20) + 16;
  const fits = Math.max(1, Math.floor(plotW / labelW));
  const stride = Math.max(1, Math.ceil(points.length / fits));
  return { points, ticks, yTickLabels, left, plotW, y, xLabels, stride };
}

function Tooltip({ title, rows, x, y, containerWidth, kind }) {
  const width = 220;
  const flip = x + 16 + width > containerWidth;
  return (
    <div className="qan-chart-tooltip" style={{ left: flip ? Math.max(0, x - 16 - width) : x + 16, top: Math.max(0, y - 20), width }}>
      <div className="qan-chart-tooltip__title">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="qan-chart-tooltip__row">
          <span className={`qan-legend-key qan-legend-key--${kind}`} style={{ background: r.color }} />
          <span className="qan-chart-tooltip__name">{r.name}</span>
          <span className="qan-chart-tooltip__value">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ series, kind }) {
  return (
    <div className="qan-legend">
      {series.map((s) => (
        <span key={s.name} className="qan-legend__item">
          <span className={`qan-legend-key qan-legend-key--${kind}`} style={{ background: SERIES_COLOR }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

// Every `stride`-th x label; edge labels are kept inside the chart, and a label that
// would collide with the previous one is skipped (as polaris-viz does).
function xTicks(points, stride, xLabels, xPos, width) {
  const out = [];
  let lastRight = -Infinity;
  points.forEach((p, i) => {
    if (i % stride !== 0) return;
    const w = textWidth(xLabels[i]);
    const cx = xPos(i);
    let anchor = 'middle';
    let x = cx;
    let x1 = cx - w / 2;
    if (x1 < 0) {
      anchor = 'start';
      x = Math.max(0, cx - 4);
      x1 = x;
    } else if (cx + w / 2 > width) {
      anchor = 'end';
      x = Math.min(width, cx + 4);
      x1 = x - w;
    }
    if (x1 < lastRight + 10) return;
    lastRight = x1 + w;
    out.push({ i, x, anchor });
  });
  return out;
}

function Axes({ geometry, width, xPos }) {
  const { ticks, yTickLabels, y, left, xLabels, stride, points } = geometry;
  return (
    <g>
      {ticks.map((t, i) => (
        <g key={t}>
          <line x1={left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} className="qan-grid" />
          <text x={left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="qan-axis-label" fontSize={AXIS_FONT}>
            {yTickLabels[i]}
          </text>
        </g>
      ))}
      {xTicks(points, stride, xLabels, xPos, width).map((t) => (
        <text
          key={points[t.i].key}
          x={t.x}
          y={MARGIN.top + PLOT_HEIGHT + 18}
          textAnchor={t.anchor}
          className="qan-axis-label"
          fontSize={AXIS_FONT}
        >
          {xLabels[t.i]}
        </text>
      ))}
    </g>
  );
}

export function LineChart({
  series,
  xLabel = String,
  yLabel = String,
  tooltipTitle,
  tooltipValue,
  integer = false,
  showLegend = true,
  ariaLabel,
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const gradientId = useRef(`qan-grad-${Math.random().toString(36).slice(2, 9)}`).current;
  const geometry = useChartGeometry({ series, xLabel, yLabel, integer, width });
  const { points, left, plotW, y } = geometry;
  const n = points.length;
  const xPos = (i) => (n <= 1 ? left + plotW / 2 : left + (i / (n - 1)) * plotW);
  const baseline = MARGIN.top + PLOT_HEIGHT;
  const height = baseline + MARGIN.bottom;

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xPos(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = n > 1 ? `${path} L${xPos(n - 1).toFixed(1)},${baseline} L${xPos(0).toFixed(1)},${baseline} Z` : '';

  const onMove = (e) => {
    if (!n) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((mx - left) / plotW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const hp = hover != null ? points[hover] : null;
  return (
    <div className="qan-chart" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel || series.map((s) => s.name).join(', ')}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity="0.18" />
              <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity="0" />
            </linearGradient>
          </defs>
          <Axes geometry={geometry} width={width} xPos={xPos} />
          {area && <path d={area} fill={`url(#${gradientId})`} />}
          {n > 1 && <path d={path} fill="none" stroke={SERIES_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {n === 1 && <circle cx={xPos(0)} cy={y(points[0].value)} r="4" fill={SERIES_COLOR} />}
          {hp && (
            <g>
              <line x1={xPos(hover)} x2={xPos(hover)} y1={MARGIN.top} y2={baseline} className="qan-crosshair" />
              <circle cx={xPos(hover)} cy={y(hp.value)} r="5" fill={SERIES_COLOR} stroke="#fff" strokeWidth="2" />
            </g>
          )}
          <rect x={left} y={MARGIN.top} width={plotW} height={PLOT_HEIGHT} fill="transparent" />
        </svg>
      )}
      {hp && (
        <Tooltip
          kind="line"
          title={(tooltipTitle || xLabel)(hp.key)}
          rows={series.map((s) => ({ name: s.name, color: SERIES_COLOR, value: (tooltipValue || yLabel)(s.data[hover]?.value ?? 0) }))}
          x={xPos(hover)}
          y={y(hp.value)}
          containerWidth={width}
        />
      )}
      {showLegend && <Legend series={series} kind="line" />}
    </div>
  );
}

export function BarChart({
  series,
  xLabel = String,
  yLabel = String,
  tooltipTitle,
  tooltipValue,
  integer = false,
  showLegend = true,
  ariaLabel,
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const geometry = useChartGeometry({ series, xLabel, yLabel, integer, width });
  const { points, left, plotW, y } = geometry;
  const n = points.length;
  const band = n ? plotW / n : plotW;
  const barW = Math.max(2, Math.min(band * 0.62, 36));
  const xPos = (i) => left + band * i + band / 2;
  const baseline = MARGIN.top + PLOT_HEIGHT;
  const height = baseline + MARGIN.bottom;

  const barPath = (cx, top, w) => {
    const h = baseline - top;
    if (h <= 0) return '';
    const r = Math.min(4, w / 2, h);
    const x0 = cx - w / 2;
    return `M${x0},${baseline} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} L${x0 + w - r},${top} Q${x0 + w},${top} ${x0 + w},${top + r} L${x0 + w},${baseline} Z`;
  };

  const hp = hover != null ? points[hover] : null;
  return (
    <div className="qan-chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel || series.map((s) => s.name).join(', ')} onMouseLeave={() => setHover(null)}>
          <Axes geometry={geometry} width={width} xPos={xPos} />
          {points.map((p, i) => (
            <g key={p.key}>
              <path d={barPath(xPos(i), y(p.value), barW)} fill={SERIES_COLOR} opacity={hover == null || hover === i ? 1 : 0.45} />
              <rect
                x={left + band * i}
                y={MARGIN.top}
                width={band}
                height={PLOT_HEIGHT}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          ))}
        </svg>
      )}
      {hp && (
        <Tooltip
          kind="bar"
          title={(tooltipTitle || xLabel)(hp.key)}
          rows={series.map((s) => ({ name: s.name, color: SERIES_COLOR, value: (tooltipValue || yLabel)(s.data[hover]?.value ?? 0) }))}
          x={xPos(hover) + barW / 2 - 8}
          y={y(hp.value)}
          containerWidth={width}
        />
      )}
      {showLegend && <Legend series={series} kind="bar" />}
    </div>
  );
}
