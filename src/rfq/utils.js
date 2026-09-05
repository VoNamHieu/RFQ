// Formatting + small math helpers ported from the RFQ god file (§8 of the spec).

// money(): whole numbers show no decimals ("$81"), fractional show 2dp ("$81.50").
export function money(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

// money2(): always 2dp with a leading "$" (the old cqMoney / submission-amount format).
export function money2(value) {
  return (
    '$' +
    Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export const subtotalOf = (lines) =>
  (lines || []).reduce((sum, l) => sum + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);

// Amount shown for a quote row: an explicit override wins, else product price × qty.
export function quoteAmount(quote) {
  if (quote == null) return 0;
  if (quote.amountOverride != null) return quote.amountOverride;
  const p = quote.product || {};
  return (Number(p.price) || 0) * (Number(p.quantity) || 1);
}

// Margin math (Save-quoted-prices modal).
export const marginPct = (quoted, cost) =>
  quoted ? Math.round(((quoted - cost) / quoted) * 100) : 0;
export const discountPct = (list, quoted) =>
  list ? Math.round(((list - quoted) / list) * 100) : 0;
// Estimated unit cost when a real cost isn't known (≈60% of price).
export const estimatedCost = (price) => Math.round((Number(price) || 0) * 0.6);

export const COUNTRY_NAMES = {
  VN: 'Vietnam',
  US: 'United States',
  GB: 'United Kingdom',
  SG: 'Singapore',
  AU: 'Australia',
};
