import React from 'react';
import { Tooltip } from '@shopify/polaris';

// Analytics metric tooltip, styled like Shopify Analytics: a dark card with the metric
// name in bold, a one-line description, and (optional) its formula in monospace —
// the metric in blue, its inputs in green, operators muted:
//   Average order value = (gross sales − discounts) / orders
// `help` may be a string or JSX (multi-line definitions); Polaris text inside it picks
// up the light colours from the overrides below. Use "−" (U+2212) for minus in formulas
// so hyphenated words ("B2B-priced") aren't split as operators.

const BG = '#1a1a1a';
// Scoped with :has() so only tooltips carrying a MetricTip turn dark — other Polaris
// tooltips in the app keep their default look. The tail SVG and the content box both
// paint with --p-color-bg-surface, so overriding it on the overlay recolours both.
const CSS = `
.Polaris-Tooltip-TooltipOverlay:has(.qs-metric-tip) {
  --p-color-bg-surface: ${BG};
  --p-color-text: #e3e3e3;
  --p-color-text-secondary: #b5b5b5;
  --p-color-tooltip-tail-up-border: ${BG};
  --p-color-tooltip-tail-down-border: ${BG};
}
.Polaris-Tooltip-TooltipOverlay:has(.qs-metric-tip)::before { box-shadow: none; }
.Polaris-Tooltip-TooltipOverlay:has(.qs-metric-tip),
.Polaris-Tooltip-TooltipOverlay:has(.qs-metric-tip) .Polaris-Tooltip-TooltipOverlay__Content { border-radius: 12px; }
.Polaris-Tooltip-TooltipOverlay:has(.qs-metric-tip) .Polaris-Tooltip-TooltipOverlay__Content { padding: 12px 14px; }
.qs-metric-tip { display: flex; flex-direction: column; gap: 2px; font-size: 13px; line-height: 20px; color: #e3e3e3; }
.qs-metric-tip__title { color: #fff; font-weight: 650; }
.qs-metric-tip__formula { margin-top: 8px; font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 12.5px; line-height: 19px; }
.qs-metric-tip__name { color: #a9c5ff; }
.qs-metric-tip__eq, .qs-metric-tip__op { color: #c7c7c7; }
.qs-metric-tip__in { color: #8ad48a; }
`;

// "Name = a − b / c" → name (blue) · "=" · inputs (green) split by operators (muted).
function Formula({ text }) {
  const at = text.indexOf(' = ');
  const name = at >= 0 ? text.slice(0, at) : null;
  const expr = at >= 0 ? text.slice(at + 3) : text;
  return (
    <div className="qs-metric-tip__formula">
      {name ? <><span className="qs-metric-tip__name">{name}</span><span className="qs-metric-tip__eq"> = </span></> : null}
      {expr.split(/([()+−×/])/).map((part, i) =>
        /^[()+−×/]$/.test(part)
          ? <span key={i} className="qs-metric-tip__op">{part}</span>
          : part ? <span key={i} className="qs-metric-tip__in">{part}</span> : null,
      )}
    </div>
  );
}

export function MetricTip({ title, help, formula }) {
  return (
    <div className="qs-metric-tip">
      <style>{CSS}</style>
      {title ? <div className="qs-metric-tip__title">{title}</div> : null}
      {help ? <div>{help}</div> : null}
      {formula ? <Formula text={formula} /> : null}
    </div>
  );
}

export function MetricTooltip({ title, help, formula, children, preferredPosition = 'above', width = 'wide' }) {
  return (
    <Tooltip content={<MetricTip title={title} help={help} formula={formula} />} preferredPosition={preferredPosition} width={width}>
      {children}
    </Tooltip>
  );
}
