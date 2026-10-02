import React, { useState } from 'react';
import { Select, BlockStack, InlineStack, Box, Text, Badge, Divider, Button, Scrollable } from '@shopify/polaris';
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
    <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
            <BlockStack gap="050">
              <Text as="h2" variant="headingLg">{product.title}</Text>
              <Text as="span" tone="subdued" variant="bodySm">{product.sku}</Text>
            </BlockStack>
            {variants.length > 1 ? (
              <Box minWidth="200px">
                <Select
                  label="Variant"
                  labelHidden
                  options={variants.map((v) => ({ label: v.title, value: v.id }))}
                  value={variantId}
                  onChange={setVariantId}
                />
              </Box>
            ) : null}
          </InlineStack>

          {/* The discount attached to this product at this location */}
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">Applied pricing</Text>
            {applied ? (
              <Step entry={applied.entry} order={applied.order} status="applied" breakdown={applied.breakdown} variant={variant} />
            ) : (
              <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                <Text as="span" tone="subdued" variant="bodySm">No B2B pricing covers this product — buyers pay the Shopify list price.</Text>
              </Box>
            )}
          </BlockStack>

          {/* Other pricings that also cover this product but lost out — the
              "why isn't my pricing applied?" answer, with each would-be price. */}
          {covering.length ? (
            <BlockStack gap="200">
              <BlockStack gap="050">
                <Text as="h3" variant="headingSm">Also covers this product</Text>
                <Text as="span" tone="subdued" variant="bodySm">
                  {covering.length === 1 ? 'This pricing also covers' : 'These pricings also cover'} this product but{' '}
                  {covering.length === 1 ? "isn't" : "aren't"} applied
                  {winnerName ? ` — ${winnerName} has higher priority.` : '.'}
                </Text>
              </BlockStack>
              {showAll ? (
                <Scrollable shadow style={{ maxHeight: 300 }}>
                  <Box paddingInlineEnd="100" paddingBlockEnd="100">
                    <BlockStack gap="200">
                      {covering.map((t, i) => (
                        <Box key={i} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                          <InlineStack align="space-between" blockAlign="center" gap="200">
                            <BlockStack gap="050">
                              <Text as="span" variant="bodyMd" fontWeight="medium">{t.entry.policy.name}</Text>
                              <Text as="span" tone="subdued" variant="bodySm">
                                {coverReason(t.entry.policy)} · would price at {money(t.wouldBe)}
                              </Text>
                            </BlockStack>
                            <Badge>Not applied</Badge>
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  </Box>
                </Scrollable>
              ) : null}
              <InlineStack align="start">
                <Button variant="plain" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Hide' : `Show all ${covering.length}`}
                </Button>
              </InlineStack>
            </BlockStack>
          ) : null}
    </BlockStack>
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
    <Box
      padding="300"
      borderWidth="025"
      borderColor="border"
      borderRadius="200"
      background={applied ? 'bg-surface-secondary' : undefined}
    >
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="start" gap="200" wrap={false}>
          <InlineStack gap="150" blockAlign="center">
            {order != null ? (
              <Badge size="small">{`Priority ${order}`}</Badge>
            ) : (
              <Badge size="small" tone="info">Quantity</Badge>
            )}
            <BlockStack gap="0">
              <Text as="span" variant="bodyMd" fontWeight="medium">{p.name}</Text>
              <Text as="span" tone="subdued" variant="bodySm">
                {scopeLabel(p)}
                {entry.source === 'LOCATION' ? ' · Location override' : ''}
              </Text>
            </BlockStack>
          </InlineStack>
          <Badge tone={STATUS.tone}>{STATUS.label}</Badge>
        </InlineStack>

        {applied && breakdown ? (
          <Box paddingInlineStart="300">
            <BlockStack gap="100">
              <Line label="Shopify list price" value={money(breakdown.shopify)} />
              <Line label={deciderLabel} value={money(breakdown.final)} decider />
              <Divider />
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd" fontWeight="semibold">Buyer pays</Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold">{money(breakdown.final)}</Text>
              </InlineStack>
            </BlockStack>
          </Box>
        ) : status === 'unreached' ? (
          <Box paddingInlineStart="300">
            <Text as="span" tone="subdued" variant="bodySm">A higher-priority pricing already set the price.</Text>
          </Box>
        ) : null}
      </BlockStack>
    </Box>
  );
}

function Line({ label, value, dim, strike, decider }) {
  const deco = strike ? 'line-through' : undefined;
  return (
    <InlineStack align="space-between" blockAlign="center" gap="200">
      <InlineStack gap="150" blockAlign="center">
        <Text as="span" variant="bodySm" tone={dim ? 'subdued' : undefined} textDecorationLine={deco}>{label}</Text>
        {decider ? <Badge size="small">Applied</Badge> : null}
      </InlineStack>
      <Text as="span" variant="bodySm" tone={dim ? 'subdued' : undefined} textDecorationLine={deco}>{value}</Text>
    </InlineStack>
  );
}
