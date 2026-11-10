// Shared line-level pricing attribution — the ONE engine used by BOTH the global Analytics
// Pricing tab (§6) and Company Analytics. Company Analytics only adds company scope; it must NOT
// define its own pricing rules. Snapshot semantics are documented in PRICING-METRICS.md §0:
// each line carries the pricing-engine output BEFORE override (resolved*) and the price actually
// applied at creation (*AtCreation). Grouping is two merchant-facing buckets: B2B pricing / Other.
export const B2B_SOURCES = ['Company price', 'Location price', 'Previous agreement'];

// Per-line snapshot at order creation. `productCost(sku)` → unit cost (number) or null.
export function lineSnapshot(order, item, productCost) {
  const qty = Number(item.qty) || 0;
  const c = productCost(item.sku); // costAtCreation
  const resolvedIsB2B = B2B_SOURCES.includes(order.pricingSource);
  const resolvedPricingId = resolvedIsB2B && order.pricing && order.pricing !== 'None' ? order.pricing : null;
  const wasPriceOverridden = !!item.overridden;
  const isB2B = resolvedIsB2B && !wasPriceOverridden; // pricingSourceAtCreation is B2B
  const lineValue = Number(item.revenue) || 0; // appliedUnitPriceAtCreation × qty
  return {
    order, sku: item.sku, qty, wasPriceOverridden,
    resolvedIsB2B, resolvedPricingSource: resolvedIsB2B ? 'B2B pricing' : 'Other pricing', resolvedPricingId,
    isB2B, group: isB2B ? 'B2B pricing' : 'Other pricing',
    pricingId: isB2B ? resolvedPricingId : null,
    lineValue,
    resolvedLineValue: resolvedIsB2B ? (wasPriceOverridden ? null : lineValue) : null,
    lineCost: c === null ? null : c * qty, // costAtCreation × qty (null when cost unknown)
  };
}

// Attributed lines for a set of orders (each order must carry `items`). An order with no captured
// line items falls back to one synthetic line at the order amount / order source.
export function buildAttributedLines(orders, productCost) {
  return orders.flatMap((o) => {
    const items = o.items || [];
    if (!items.length) return [lineSnapshot(o, { sku: null, qty: 0, revenue: o.amount, overridden: false }, productCost)];
    return items.map((it) => lineSnapshot(o, it, productCost));
  });
}

// Per named B2B pricing PROFILE rows (Pricing performance, §6.4). Named profiles only — no "Other"
// row. Order value = Σ applied line value; GP/margin on costed lines; vs-Shopify = resolved price
// vs Shopify list; orders/companies = distinct counts. Sorted by gross profit desc.
export function pricingProfileRows(attributedLines, productBySku) {
  const map = new Map();
  attributedLines.forEach((s) => {
    if (!s.pricingId) return;
    const cur = map.get(s.pricingId) || { name: s.pricingId, sub: s.group, value: 0, resolvedValue: 0, reference: 0, cost: 0, costedValue: 0, costedN: 0, orderIds: new Set(), companies: new Set() };
    cur.value += s.lineValue;
    if (s.resolvedLineValue !== null) cur.resolvedValue += s.resolvedLineValue;
    cur.reference += (Number(productBySku(s.sku)?.list) || 0) * s.qty;
    if (s.lineCost !== null) { cur.cost += s.lineCost; cur.costedValue += s.lineValue; cur.costedN += 1; }
    cur.orderIds.add(s.order.id);
    cur.companies.add(s.order.companyId);
    map.set(s.pricingId, cur);
  });
  return [...map.values()].map((x) => {
    const gp = x.costedN ? x.costedValue - x.cost : null;
    return {
      name: x.name, sub: x.sub, value: x.value, reference: x.reference,
      orders: x.orderIds.size, companies: x.companies.size, gp,
      margin: x.costedN && x.costedValue ? (gp / x.costedValue) * 100 : null,
      delta: x.resolvedValue - x.reference,
      deltaPct: x.reference ? ((x.resolvedValue - x.reference) / x.reference) * 100 : null,
    };
  }).sort((a, b) => (b.gp ?? -Infinity) - (a.gp ?? -Infinity));
}

// Whole-set economics for a group filter (used by §6.1 applied margin & adoption). Returns
// { value, gp, costedValue, margin, coverage } computed at the applied creation price.
export function appliedEconomics(attributedLines, filter = () => true) {
  let value = 0; let gp = 0; let costedValue = 0;
  attributedLines.forEach((s) => {
    if (!filter(s)) return;
    value += s.lineValue;
    if (s.lineCost !== null) { gp += s.lineValue - s.lineCost; costedValue += s.lineValue; }
  });
  return { value, gp: costedValue ? gp : null, costedValue, margin: costedValue ? (gp / costedValue) * 100 : null };
}
