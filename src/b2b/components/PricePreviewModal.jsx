import React, { useState } from 'react';
import { money } from '../format.js';
import {
  locationPricingEntries,
  baseInScope,
  policyPriceBreakdown,
  productVariants,
  scopeLabel,
  ruleAdjustmentLabel,
  ruleTypeLabel,
  ruleValuesSummary,
} from '../pricing.js';

// The profile-level default adjustment as a short label ("12% off", "Set $75").
const defaultAdjLabel = (p) =>
  ruleAdjustmentLabel({ rule: p.pricingRule, valueType: p.valueType, value: p.value });

// Which layer inside one profile decided its price.
const layerOf = (bd) => (bd.override != null ? 'override' : bd.rule ? 'rule' : 'default');
const LAYER_LABEL = { override: 'Variant override', rule: 'Conditional rule', default: 'Default price' };

// How a pricing covers this product — an "All products" base covers it too, so it
// counts. Used to label each pricing in the "also covers this product" list.
function coverReason(policy) {
  if (!policy) return '';
  if (policy.priceKind === 'quantity') return 'Quantity pricing';
  const st = policy.scopeType;
  if (!st || st === 'all') return 'All products';
  if (st === 'products') return 'Scoped to this product';
  if (st === 'collection') return `In collection ${policy.collection || ''}`.trim();
  return scopeLabel(policy);
}

// Walk the location's assigned pricing in priority order; the first profile that
// covers this product sets the price. Returns each step (with status + the layer
// math for the winner), plus the final buyer price and discount vs list.
function resolveWalk(company, location, policies, product, variant) {
  const { bases, quantities } = locationPricingEntries(company, location, policies);
  let decided = false;
  const baseSteps = bases.map((entry, i) => {
    const covers = baseInScope(entry.policy, product.sku);
    let status;
    let breakdown = null;
    if (!decided && covers) {
      status = 'applied';
      breakdown = policyPriceBreakdown(entry.policy, product, variant);
      decided = true;
    } else if (!covers) {
      status = 'skipped';
    } else {
      status = 'unreached';
    }
    return { entry, order: i + 1, status, breakdown };
  });

  const qtySteps = quantities.map((entry) => {
    const bd = policyPriceBreakdown(entry.policy, product, variant);
    const covers = bd.inScope;
    let status;
    if (!decided && covers) {
      status = 'applied';
      decided = true;
    } else if (!covers) {
      status = 'skipped';
    } else {
      status = 'unreached';
    }
    return { entry, order: null, status, breakdown: status === 'applied' ? bd : null };
  });

  const steps = [...baseSteps, ...qtySteps];
  const applied = steps.find((s) => s.status === 'applied');
  const list = variant?.list != null ? variant.list : product?.list ?? 0;
  const finalPrice = applied ? applied.breakdown.final : list;
  const pctOff = list > 0 ? Math.round((1 - finalPrice / list) * 100) : 0;
  const assignedCount = bases.length + quantities.length;
  return { steps, applied, list, finalPrice, pctOff, assignedCount };
}

// ── Detail view: why this price (the resolution breakdown) ───────────────────
export function PriceWhyContent({ company, location, policies, product }) {
  const variants = productVariants(product);
  const [variantId, setVariantId] = useState(variants[0]?.id || '');
  const [showAll, setShowAll] = useState(false);
  const variant = variants.find((v) => v.id === variantId) || variants[0] || null;
  const { steps, applied } = resolveWalk(company, location, policies, product, variant);
  const winnerName = applied ? applied.entry.policy.name : null;
  // Every OTHER pricing that covers this product (an "All products" base covers it
  // too) but didn't apply — with the price it *would* charge, so a merchant can see
  // "I assigned this to the product, but it's getting a different price" and why.
  const covering = steps
    .filter((s) => s.status === 'unreached')
    .map((s) => ({
      entry: s.entry,
      wouldBe: policyPriceBreakdown(s.entry.policy, product, variant).final,
    }));

  return (
    <s-stack gap="base">
      <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small">
        <s-stack gap="small-500">
          <s-heading fontSize="large-200">{product.title}</s-heading>
          <s-text color="subdued" fontSize="small">
            {product.sku}
          </s-text>
        </s-stack>
        {variants.length > 1 ? (
          <div style={{ minWidth: 200 }}>
            <s-select label="Variant" labelAccessibilityVisibility="exclusive" value={variantId} onChange={(e) => setVariantId(e.currentTarget.value)}>
              {variants.map((v) => (
                <s-option key={v.id} value={v.id}>
                  {v.title}
                </s-option>
              ))}
            </s-select>
          </div>
        ) : null}
      </s-stack>

      {/* The discount attached to this product at this location */}
      <s-stack gap="small-200">
        <s-heading>Applied pricing</s-heading>
        {applied ? (
          <Step entry={applied.entry} order={applied.order} status="applied" breakdown={applied.breakdown} variant={variant} />
        ) : (
          <s-box padding="small" border="base" borderRadius="base">
            <s-text color="subdued" fontSize="small">
              No B2B pricing covers this product — buyers pay the Shopify list price.
            </s-text>
          </s-box>
        )}
      </s-stack>

      {/* Other pricings that also cover this product but lost out — the
          "why isn't my pricing applied?" answer, with each would-be price. */}
      {covering.length ? (
        <s-stack gap="small-200">
          <s-stack gap="small-500">
            <s-heading>Also covers this product</s-heading>
            <s-text color="subdued" fontSize="small">
              {covering.length === 1 ? 'This pricing also covers' : 'These pricings also cover'} this product but{' '}
              {covering.length === 1 ? "isn't" : "aren't"} applied
              {winnerName ? ` — ${winnerName} has higher priority.` : '.'}
            </s-text>
          </s-stack>
          {showAll ? (
            // Native scroller: s-scroll-box's maxBlockSize caps its outer box, not its scroll container.
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <s-box paddingInlineEnd="small-400" paddingBlockEnd="small-400">
                <s-stack gap="small-200">
                  {covering.map((t, i) => (
                    <s-box key={i} padding="small" border="base" borderRadius="base">
                      <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
                        <s-stack gap="small-500">
                          <s-text fontWeight="medium">{t.entry.policy.name}</s-text>
                          <s-text color="subdued" fontSize="small">
                            {coverReason(t.entry.policy)} · would price at {money(t.wouldBe)}
                          </s-text>
                        </s-stack>
                        <s-badge>Not applied</s-badge>
                      </s-grid>
                    </s-box>
                  ))}
                </s-stack>
              </s-box>
            </div>
          ) : null}
          <s-stack direction="inline">
            <s-link onClick={() => setShowAll((v) => !v)}>{showAll ? 'Hide' : `Show all ${covering.length}`}</s-link>
          </s-stack>
        </s-stack>
      ) : null}
    </s-stack>
  );
}

// One row in the resolution walk: name + scope + a status pill, and — for the
// profile that actually set the price — the list→default→rule→override chain.
function Step({ entry, order, status, breakdown, variant }) {
  const p = entry.policy;
  const applied = status === 'applied';
  const STATUS = {
    applied: { label: 'Applied', tone: undefined },
    skipped: { label: 'Doesn’t cover this product', tone: undefined },
    unreached: { label: 'Not reached', tone: undefined },
  }[status];
  const layer = breakdown ? layerOf(breakdown) : null;
  const rule = breakdown && breakdown.rule ? p.conditionalRules[breakdown.rule.index] : null;
  // Just name what actually set the price — the matching rule, a variant override,
  // or the pricing's plain discount. No non-applied lines.
  const deciderLabel =
    layer === 'override'
      ? `Variant override · ${variant?.title || 'this variant'}`
      : layer === 'rule'
        ? `${ruleTypeLabel(rule)} “${ruleValuesSummary(rule)}” rule · ${ruleAdjustmentLabel(rule)}`
        : `${defaultAdjLabel(p)} discount`;

  return (
    <s-box padding="small" border="base" borderRadius="base" background={applied ? 'subdued' : undefined}>
      <s-stack gap="small-200">
        <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="start">
          <s-stack direction="inline" gap="small-300" alignItems="center">
            {order != null ? <s-badge>{`Priority ${order}`}</s-badge> : <s-badge tone="info">Quantity</s-badge>}
            <s-stack gap="none">
              <s-text fontWeight="medium">{p.name}</s-text>
              <s-text color="subdued" fontSize="small">
                {scopeLabel(p)}
                {entry.source === 'LOCATION' ? ' · Location override' : ''}
              </s-text>
            </s-stack>
          </s-stack>
          <s-badge tone={STATUS.tone}>{STATUS.label}</s-badge>
        </s-grid>

        {applied && breakdown ? (
          <s-box paddingInlineStart="small">
            <s-stack gap="small-400">
              <Line label="Shopify list price" value={money(breakdown.shopify)} />
              <Line label={deciderLabel} value={money(breakdown.final)} decider />
              <s-divider />
              <s-stack direction="inline" justifyContent="space-between">
                <s-text fontWeight="semibold">Buyer pays</s-text>
                <s-text fontWeight="semibold">{money(breakdown.final)}</s-text>
              </s-stack>
            </s-stack>
          </s-box>
        ) : status === 'unreached' ? (
          <s-box paddingInlineStart="small">
            <s-text color="subdued" fontSize="small">
              A higher-priority pricing already set the price.
            </s-text>
          </s-box>
        ) : null}
      </s-stack>
    </s-box>
  );
}

function Line({ label, value, dim, strike, decider }) {
  const color = dim ? 'subdued' : undefined;
  const deco = (text) => (strike ? <s>{text}</s> : text);
  return (
    <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small-200">
      <s-stack direction="inline" gap="small-300" alignItems="center">
        <s-text fontSize="small" color={color}>
          {deco(label)}
        </s-text>
        {decider ? <s-badge>Applied</s-badge> : null}
      </s-stack>
      <s-text fontSize="small" color={color}>
        {deco(value)}
      </s-text>
    </s-stack>
  );
}
