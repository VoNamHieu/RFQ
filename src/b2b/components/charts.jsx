import React, { useState, useRef, useLayoutEffect } from 'react';
import { Text, BlockStack, InlineStack } from '@shopify/polaris';
import { money } from '../format.js';

// Measure the container's rendered width so SVG charts draw at real pixels
// (fixed height, no proportional up-scaling) and stay responsive + crisp.
function useMeasure() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const BRAND = 'var(--p-color-bg-fill-brand)';
const TRACK = 'var(--p-color-bg-fill-tertiary, var(--p-color-bg-surface-secondary))';
const AXIS = 'var(--p-color-text-secondary)';
const GRID = 'var(--p-color-border)';
const COMPARE = 'var(--p-color-text-secondary)';

// Categorical palette for stacked segments / legends. Theme-aware Polaris tokens.
export const PALETTE = [
  'var(--p-color-bg-fill-brand)',
  'var(--p-color-bg-fill-info)',
  'var(--p-color-bg-fill-success)',
  'var(--p-color-bg-fill-warning)',
  'var(--p-color-bg-fill-magic)',
  'var(--p-color-bg-fill-caution)',
];

const fmt = (v, prefix = '$') => prefix + Math.round(v).toLocaleString('en-US');

// Sales-over-time line chart with area, dots, hover value label and an optional
// dashed "previous period" comparison series (legacy renderAnalytics trendSvg).
export function LineChart({ data, compare = null, height = 200, prefix = '$', label = 'Sales over time' }) {
  const [ref, measured] = useMeasure();
  const [hover, setHover] = useState(null);
  const hasCompare = Array.isArray(compare) && compare.length > 0;
  const w = Math.max(320, Math.round(measured || 640));
  const h = height;
  const pad = { t: 14, r: 16, b: 26, l: 48 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const compareVals = hasCompare ? data.map((_, i) => Number(compare[i]?.value ?? compare[i] ?? 0)) : [];
  const max = Math.max(1, ...data.map((d) => d.value), ...compareVals);
  const x = (i) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `${x(0)},${pad.t + ih} ${line} ${x(data.length - 1)},${pad.t + ih}`;
  const cline = hasCompare ? compareVals.map((v, i) => `${x(i)},${y(v)}`).join(' ') : '';
  const ticks = [0, 0.5, 1].map((f) => ({ v: max * f, yy: y(max * f) }));
  const active = hover != null ? data[hover] : null;

  return (
    <BlockStack gap="200">
      {hasCompare && (
        <InlineStack gap="300">
          <InlineStack gap="100" blockAlign="center">
            <span style={{ width: 14, height: 3, borderRadius: 2, background: BRAND, display: 'inline-block' }} />
            <Text as="span" variant="bodySm" tone="subdued">Selected period</Text>
          </InlineStack>
          <InlineStack gap="100" blockAlign="center">
            <span style={{ width: 14, height: 0, borderTop: `2px dashed ${COMPARE}`, display: 'inline-block' }} />
            <Text as="span" variant="bodySm" tone="subdued">Previous period</Text>
          </InlineStack>
        </InlineStack>
      )}
      <div ref={ref} style={{ width: '100%' }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} style={{ display: 'block', maxWidth: '100%' }}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={pad.l} x2={pad.l + iw} y1={t.yy} y2={t.yy} stroke={GRID} strokeWidth="1" />
              <text x={pad.l - 8} y={t.yy + 3} textAnchor="end" fontSize="10" fill={AXIS}>
                {prefix === '$' ? moneyShort(t.v) : Math.round(t.v)}
              </text>
            </g>
          ))}
          <polygon points={area} fill={BRAND} opacity="0.08" />
          {hasCompare && (
            <polyline points={cline} fill="none" stroke={COMPARE} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" opacity="0.75" />
          )}
          <polyline points={line} fill="none" stroke={BRAND} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {active && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={AXIS} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />}
          {hasCompare &&
            compareVals.map((v, i) => <circle key={`c${i}`} cx={x(i)} cy={y(v)} r={hover === i ? 4 : 3} fill="var(--p-color-bg-surface)" stroke={COMPARE} strokeWidth="1.5" />)}
          {data.map((d, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(d.value)} r={hover === i ? 5 : 3.5} fill={BRAND} stroke="var(--p-color-bg-surface)" strokeWidth="1.5" />
              <text x={x(i)} y={h - 8} textAnchor="middle" fontSize="10" fill={AXIS}>{d.label}</text>
              <rect
                x={x(i) - iw / (data.length * 2 || 1)}
                y={pad.t}
                width={Math.max(12, iw / (data.length || 1))}
                height={ih}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          ))}
          {active && (() => {
            const rows = [active.label, fmt(active.value, prefix)];
            if (hasCompare) rows.push(`prev ${fmt(compareVals[hover], prefix)}`);
            const tw = 104;
            const th = 12 + rows.length * 15;
            const cx = x(hover);
            const above = y(active.value) > th + 14;
            const ty = above ? y(active.value) - th - 12 : y(active.value) + 12;
            const tx = Math.min(Math.max(cx - tw / 2, 2), w - tw - 2);
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={tx} y={ty} width={tw} height={th} rx="6" fill="var(--p-color-bg-surface)" stroke={GRID} strokeWidth="1" />
                {rows.map((r, k) => (
                  <text key={k} x={tx + tw / 2} y={ty + 16 + k * 15} textAnchor="middle" fontSize={k === 1 ? '12' : '11'} fontWeight={k === 1 ? '600' : '400'} fill={k === 2 ? AXIS : 'var(--p-color-text)'}>{r}</text>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>
    </BlockStack>
  );
}

// Rich ranked bars (legacy .analytics-rank): name + optional sub, magnitude
// track, and a right-aligned value with an optional secondary caption. Bar width
// comes from an explicit `width` (0-100) when provided, else value / max.
export function RankBars({ rows, empty = 'No data in this filter.' }) {
  if (!rows || !rows.length) {
    return <Text as="p" tone="subdued" variant="bodySm">{empty}</Text>;
  }
  const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
  return (
    <BlockStack gap="300">
      {rows.map((r, i) => {
        const width = r.width != null ? r.width : ((Number(r.value) || 0) / max) * 100;
        return (
          <InlineStack key={r.key || r.name || i} gap="300" blockAlign="center" wrap={false}>
            <div style={{ flex: '1 1 42%', minWidth: 0 }}>
              <Text as="p" variant="bodySm" fontWeight="semibold" truncate>{r.name}</Text>
              {r.sub ? <Text as="p" variant="bodySm" tone="subdued" truncate>{r.sub}</Text> : null}
            </div>
            <div style={{ flex: '1 1 34%', height: 10, borderRadius: 5, background: TRACK, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(2, width)}%`, height: '100%', background: BRAND, borderRadius: 5 }} />
            </div>
            <div style={{ flex: '0 0 auto', textAlign: 'right', minWidth: 92 }}>
              <Text as="span" variant="bodySm" fontWeight="semibold">{r.valueLabel}</Text>
              {r.secondary ? <Text as="span" variant="bodySm" tone="subdued">{` ${r.secondary}`}</Text> : null}
            </div>
          </InlineStack>
        );
      })}
    </BlockStack>
  );
}

// Horizontal 100%-stacked bar with a colored legend (share % + value).
// segments: [{ name, value }]. Used for purchasing motion, purchase
// relationship, pricing provenance and new-vs-existing revenue.
export function StackedBar({ segments, format = money }) {
  const total = segments.reduce((a, s) => a + (Number(s.value) || 0), 0) || 1;
  return (
    <BlockStack gap="300">
      <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', background: TRACK }}>
        {segments.map((s, i) => (
          <div
            key={s.name}
            style={{ width: `${((Number(s.value) || 0) / total) * 100}%`, background: PALETTE[i % PALETTE.length], height: '100%' }}
            title={`${s.name}: ${format(s.value)}`}
          />
        ))}
      </div>
      <BlockStack gap="150">
        {segments.map((s, i) => (
          <InlineStack key={s.name} align="space-between" blockAlign="center" wrap={false}>
            <InlineStack gap="150" blockAlign="center">
              <span style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[i % PALETTE.length], display: 'inline-block' }} />
              <Text as="span" variant="bodySm">{s.name}</Text>
            </InlineStack>
            <Text as="span" variant="bodySm" fontWeight="medium">
              {`${Math.round(((Number(s.value) || 0) / total) * 100)}% · ${format(s.value)}`}
            </Text>
          </InlineStack>
        ))}
      </BlockStack>
    </BlockStack>
  );
}

// Multi-stage funnel (legacy .analytics-funnel-v2). Each stage carries a
// pre-formatted value string + optional note; the bar width is count / firstCount.
export function FunnelV2({ stages }) {
  const top = Math.max(1, Number(stages[0]?.count) || 1);
  return (
    <BlockStack gap="300">
      {stages.map((s, i) => {
        const width = (Number(s.count) || 0) / top * 100;
        return (
          <InlineStack key={s.name} gap="300" blockAlign="center" wrap={false}>
            <div style={{ flex: '0 0 34%', minWidth: 0 }}>
              <Text as="span" variant="bodySm" fontWeight="medium">{s.name}</Text>
            </div>
            <div style={{ flex: '1 1 auto', height: 16, borderRadius: 4, background: TRACK, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(2, width)}%`, height: '100%', background: BRAND, opacity: 1 - i * 0.14, borderRadius: 4 }} />
            </div>
            <div style={{ flex: '0 0 auto', textAlign: 'right', minWidth: 150 }}>
              <Text as="span" variant="bodySm" fontWeight="semibold">{s.value}</Text>
              {s.note ? <Text as="span" variant="bodySm" tone="subdued">{` ${s.note}`}</Text> : null}
            </div>
          </InlineStack>
        );
      })}
    </BlockStack>
  );
}

// Simple vertical bar chart (e.g. order volume per month) with top value labels.
export function VBarChart({ data, height = 200, prefix = '', label = 'Orders by period' }) {
  const [ref, measured] = useMeasure();
  const [hover, setHover] = useState(null);
  const w = Math.max(320, Math.round(measured || 640));
  const h = height;
  const pad = { t: 22, r: 12, b: 26, l: 34 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = iw / Math.max(1, data.length);
  const bw = Math.min(slot * 0.6, 56);
  const ticks = [0, 0.5, 1].map((f) => ({ v: max * f, yy: pad.t + ih - ih * f }));
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} style={{ display: 'block', maxWidth: '100%' }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + iw} y1={t.yy} y2={t.yy} stroke={GRID} />
            <text x={pad.l - 8} y={t.yy + 3} textAnchor="end" fontSize="10" fill={AXIS}>{prefix ? moneyShort(t.v) : Math.round(t.v)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const bh = (d.value / max) * ih;
          const bx = pad.l + i * slot + (slot - bw) / 2;
          const by = pad.t + ih - bh;
          const on = hover === i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={ih} fill="transparent" />
              <rect x={bx} y={by} width={bw} height={Math.max(2, bh)} rx="5" fill={BRAND} opacity={on ? 1 : 0.82} />
              <text x={bx + bw / 2} y={Math.max(14, by - 8)} textAnchor="middle" fontSize={on ? '12' : '11'} fontWeight="600" fill={on ? 'var(--p-color-text)' : AXIS}>
                {prefix ? fmt(d.value, prefix) : d.value}
              </text>
              <text x={bx + bw / 2} y={h - 8} textAnchor="middle" fontSize="10" fill={AXIS}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Order cadence timeline for a single company (legacy .order-timeline):
// a bar per completed order (height ∝ amount) with the gap since the prior order.
export function Timeline({ events, empty = 'No completed orders.' }) {
  if (!events || !events.length) {
    return <Text as="p" tone="subdued" variant="bodySm">{empty}</Text>;
  }
  const maxAmt = Math.max(1, ...events.map((e) => Number(e.amount) || 0));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
      {events.map((e, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 44 }}>
          <div style={{ height: 14, fontSize: 11, color: 'var(--p-color-text-secondary)' }}>{e.gapLabel || ''}</div>
          <div
            style={{ width: 26, height: Math.max(28, ((Number(e.amount) || 0) / maxAmt) * 150), background: BRAND, borderRadius: 5 }}
            title={e.valueLabel}
          />
          <Text as="span" variant="bodySm" fontWeight="medium">{e.valueLabel}</Text>
          <Text as="span" variant="bodySm" tone="subdued">{e.dateLabel}</Text>
        </div>
      ))}
    </div>
  );
}

// moneyShort: compact currency (e.g. $1.2m / $12k / $340) — matches legacy.
export function moneyShort(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}m`;
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}k`;
  return `$${Math.round(v)}`;
}
