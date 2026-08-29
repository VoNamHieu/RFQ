import React, { useState } from 'react';
import { Text, BlockStack, InlineStack } from '@shopify/polaris';

const BRAND = 'var(--p-color-bg-fill-brand)';
const TRACK = 'var(--p-color-bg-fill-tertiary, var(--p-color-bg-surface-secondary))';
const AXIS = 'var(--p-color-text-secondary)';
const GRID = 'var(--p-color-border)';

const fmt = (v, prefix = '$') =>
  prefix + Math.round(v).toLocaleString('en-US');

// Sales-over-time line chart with area, dots, and a hover value label.
export function LineChart({ data, height = 220, prefix = '$' }) {
  const [hover, setHover] = useState(null);
  const w = 640;
  const h = height;
  const pad = { t: 20, r: 20, b: 30, l: 52 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `${x(0)},${pad.t + ih} ${line} ${x(data.length - 1)},${pad.t + ih}`;
  const ticks = [0, 0.5, 1].map((f) => ({ v: max * f, yy: y(max * f) }));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Sales over time" style={{ display: 'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={pad.l + iw} y1={t.yy} y2={t.yy} stroke={GRID} strokeWidth="1" />
          <text x={pad.l - 8} y={t.yy + 3} textAnchor="end" fontSize="10" fill={AXIS}>
            {fmt(t.v, prefix)}
          </text>
        </g>
      ))}
      <polygon points={area} fill={BRAND} opacity="0.08" />
      <polyline points={line} fill="none" stroke={BRAND} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          <rect
            x={x(i) - iw / (data.length * 2 || 1)}
            y={pad.t}
            width={Math.max(12, iw / (data.length || 1))}
            height={ih}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
          <circle cx={x(i)} cy={y(d.value)} r={hover === i ? 5 : 3} fill={BRAND} stroke="var(--p-color-bg-surface)" strokeWidth="1.5" />
          <text x={x(i)} y={h - 10} textAnchor="middle" fontSize="10" fill={AXIS}>
            {d.label}
          </text>
          {hover === i && (
            <text x={x(i)} y={y(d.value) - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--p-color-text)">
              {fmt(d.value, prefix)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// Horizontal magnitude bars with direct labels + values (rounded ends).
export function HBarChart({ rows, prefix = '$' }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <BlockStack gap="200">
      {rows.map((r) => (
        <BlockStack gap="100" key={r.label}>
          <InlineStack align="space-between">
            <Text as="span" variant="bodySm">
              {r.label}
            </Text>
            <Text as="span" variant="bodySm" fontWeight="medium">
              {fmt(r.value, prefix)}
            </Text>
          </InlineStack>
          <div style={{ height: 10, borderRadius: 5, background: TRACK, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, height: '100%', background: BRAND, borderRadius: 5 }} />
          </div>
        </BlockStack>
      ))}
    </BlockStack>
  );
}

// Conversion funnel: decreasing stages with count + % of the first stage.
export function Funnel({ stages }) {
  const top = Math.max(1, stages[0]?.value || 1);
  return (
    <BlockStack gap="150">
      {stages.map((s, i) => {
        const pct = Math.round((s.value / top) * 100);
        const shade = 1 - i * (0.6 / Math.max(1, stages.length - 1));
        return (
          <div key={s.label}>
            <InlineStack align="space-between">
              <Text as="span" variant="bodySm">
                {s.label}
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                {`${s.value} · ${pct}%`}
              </Text>
            </InlineStack>
            <div style={{ height: 16, borderRadius: 4, background: TRACK, overflow: 'hidden', marginTop: 4 }}>
              <div style={{ width: `${Math.max(3, pct)}%`, height: '100%', background: BRAND, opacity: shade, borderRadius: 4 }} />
            </div>
          </div>
        );
      })}
    </BlockStack>
  );
}

// Simple vertical bar chart (e.g. orders per period).
export function VBarChart({ data, height = 200, prefix = '' }) {
  const [hover, setHover] = useState(null);
  const w = 640;
  const h = height;
  const pad = { t: 20, r: 16, b: 30, l: 40 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (iw / data.length) * 0.6;
  const gap = (iw / data.length) * 0.4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Orders by period" style={{ display: 'block' }}>
      <line x1={pad.l} x2={pad.l + iw} y1={pad.t + ih} y2={pad.t + ih} stroke={GRID} />
      {data.map((d, i) => {
        const bh = (d.value / max) * ih;
        const bx = pad.l + i * (bw + gap) + gap / 2;
        const by = pad.t + ih - bh;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={bx} y={by} width={bw} height={bh} rx="4" fill={BRAND} opacity={hover === i ? 1 : 0.85} />
            <text x={bx + bw / 2} y={h - 10} textAnchor="middle" fontSize="10" fill={AXIS}>
              {d.label}
            </text>
            {hover === i && (
              <text x={bx + bw / 2} y={by - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--p-color-text)">
                {fmt(d.value, prefix)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
