import React from 'react';
import { useWcId } from '../../shared/wc.jsx';
import './MetricTooltip.css';

// Analytics metric tooltip, styled like Shopify Analytics: a dark card with the metric
// name in bold, a one-line description, and (optional) its formula in monospace — the
// metric in blue, its inputs in green, operators muted:
//   Average order value = (gross sales − discounts) / orders
// Rendered with Polaris web components (s-tooltip), which only display text, s-text and
// s-paragraph children. So `help` may be a string or JSX made of s-paragraph / s-text
// elements (fragments are fine) — other elements (div, span, s-stack) are not shown.
// The dark look comes from MetricTooltip.css. Use "−" (U+2212) for minus in formulas so
// hyphenated words ("B2B-priced") aren't split as operators.

// "Name = a − b / c" → name (blue) · "=" · inputs (green) split by operators (muted).
function Formula({ text }) {
  const at = text.indexOf(' = ');
  const name = at >= 0 ? text.slice(0, at) : null;
  const expr = at >= 0 ? text.slice(at + 3) : text;
  return (
    <s-paragraph className="qs-metric-tip__formula">
      {name ? (
        <>
          <s-text tone="info">{name}</s-text>
          <s-text color="subdued"> = </s-text>
        </>
      ) : null}
      {expr.split(/([()+−×/])/).map((part, i) =>
        /^[()+−×/]$/.test(part) ? (
          <s-text key={i} color="subdued">{part}</s-text>
        ) : part ? (
          <s-text key={i} tone="success">{part}</s-text>
        ) : null,
      )}
    </s-paragraph>
  );
}

export function MetricTip({ title, help, formula }) {
  return (
    <>
      {title ? <s-paragraph className="qs-metric-tip__title" fontWeight="semibold">{title}</s-paragraph> : null}
      {help ? (
        typeof help === 'string' || typeof help === 'number' ? (
          <s-paragraph className={formula ? undefined : 'qs-metric-tip__last'}>{help}</s-paragraph>
        ) : (
          help
        )
      ) : null}
      {formula ? <Formula text={formula} /> : null}
    </>
  );
}

// Hovering `children` shows the tooltip. `preferredPosition` / `width` are kept for API
// compatibility; s-tooltip positions and sizes itself.
// eslint-disable-next-line no-unused-vars
export function MetricTooltip({ title, help, formula, children, preferredPosition = 'above', width = 'wide' }) {
  const id = useWcId('metric-tip');
  return (
    <>
      <s-text interestFor={id}>{children}</s-text>
      <s-tooltip id={id} className="qs-metric-tooltip">
        <MetricTip title={title} help={help} formula={formula} />
      </s-tooltip>
    </>
  );
}
