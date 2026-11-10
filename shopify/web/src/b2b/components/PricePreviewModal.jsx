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
import { CdSection, StatusDot } from './companyLayout.jsx';

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
    const covers = baseInScope(entry.policy, product);
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

  // The company and location pages' look: the product as a title, then sections titled
  // above bordered cards.
  return (
    <div className="cd-why">
      <div className="cd-why__head">
        <div>
          <h3 className="cd-why__title">{product.title}</h3>
          <span className="cd-sub">{product.sku}</span>
        </div>
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
      </div>

      {/* The discount attached to this product at this location */}
      <CdSection title="Applied pricing">
        {applied ? (
          <Step entry={applied.entry} order={applied.order} status="applied" breakdown={applied.breakdown} variant={variant} />
        ) : (
          <div className="cd-card">
            <div className="cd-card__empty">No B2B pricing covers this product — buyers pay the Shopify list price.</div>
          </div>
        )}
      </CdSection>

      {/* Other pricings that also cover this product but lost out — the
          "why isn't my pricing applied?" answer, with each would-be price. */}
      {covering.length ? (
        <CdSection
          title="Also covers this product"
          subtitle={`${covering.length === 1 ? 'This pricing also covers' : 'These pricings also cover'} this product but ${
            covering.length === 1 ? "isn't" : "aren't"
          } applied${winnerName ? ` — ${winnerName} has higher priority.` : '.'}`}
          controls={
            <button type="button" className="cd-text-link cd-text-link--body" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Hide' : `Show all ${covering.length}`}
            </button>
          }
        >
          {showAll ? (
            <div className="cd-card">
              <div className="cd-table-scroll cd-table-scroll--tall" style={{ maxHeight: 300 }}>
                <table className="cd-table cd-table--sticky">
                  <thead>
                    <tr>
                      <th>Pricing</th>
                      <th className="cd-num">Would price at</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {covering.map((t, i) => (
                      <tr key={i}>
                        <td>
                          <span className="cd-primary">{t.entry.policy.name}</span>
                          <span className="cd-sub">{coverReason(t.entry.policy)}</span>
                        </td>
                        <td className="cd-num cd-nowrap">{money(t.wouldBe)}</td>
                        <td>
                          <StatusDot>Not applied</StatusDot>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </CdSection>
      ) : null}
    </div>
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

  // A bordered card: the pricing (its priority, scope) and its status; for the one that
  // set the price, the list price, what decided it and what the buyer pays.
  return (
    <div className="cd-card">
      <div className="cd-why__step">
        <div>
          <span className="cd-primary">{p.name}</span>
          <span className="cd-sub">
            {[order != null ? `Priority ${order}` : 'Quantity pricing', scopeLabel(p), entry.source === 'LOCATION' ? 'Location override' : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        <StatusDot tone={applied ? 'success' : undefined}>{STATUS.label}</StatusDot>
      </div>

      {applied && breakdown ? (
        <div className="cd-why__lines">
          <Line label="Shopify list price" value={money(breakdown.shopify)} dim />
          <Line label={deciderLabel} value={money(breakdown.final)} />
          <div className="cd-why__total">
            <span>Buyer pays</span>
            <span>{money(breakdown.final)}</span>
          </div>
        </div>
      ) : status === 'unreached' ? (
        <div className="cd-why__lines">
          <p className="cd-note">A higher-priority pricing already set the price.</p>
        </div>
      ) : null}
    </div>
  );
}

function Line({ label, value, dim, strike }) {
  const deco = (text) => (strike ? <s>{text}</s> : text);
  return (
    <div className={`cd-why__line${dim ? ' cd-muted' : ''}`}>
      <span>{deco(label)}</span>
      <span className="cd-nowrap">{deco(value)}</span>
    </div>
  );
}
