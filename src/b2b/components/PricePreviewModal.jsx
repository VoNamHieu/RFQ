import React, { useState } from 'react';
import { Modal, Select, BlockStack, InlineStack, Box, Text, Badge, Divider, IndexTable, Button, TextField, Icon, Scrollable } from '@shopify/polaris';
import { SearchIcon, ViewIcon } from '@shopify/polaris-icons';
import { money } from '../format.js';
import {
  locationPricingEntries,
  baseInScope,
  policyPriceBreakdown,
  productVariants,
  defaultVariant,
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
  const { bases, quantity } = locationPricingEntries(company, location, policies);
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

  let qtyStep = null;
  if (quantity) {
    const bd = policyPriceBreakdown(quantity.policy, product, variant);
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
    qtyStep = { entry: quantity, order: null, status, breakdown: status === 'applied' ? bd : null };
  }

  const steps = [...baseSteps, ...(qtyStep ? [qtyStep] : [])];
  const applied = steps.find((s) => s.status === 'applied');
  const list = variant?.list != null ? variant.list : product?.list ?? 0;
  const finalPrice = applied ? applied.breakdown.final : list;
  const pctOff = list > 0 ? Math.round((1 - finalPrice / list) * 100) : 0;
  const assignedCount = bases.length + (quantity ? 1 : 0);
  return { steps, applied, list, finalPrice, pctOff, assignedCount };
}

// Discount vs list as a small badge.
function DiscountBadge({ pctOff }) {
  if (pctOff > 0) return <Badge size="small">{`${pctOff}% off`}</Badge>;
  if (pctOff < 0) return <Badge tone="warning" size="small">{`${-pctOff}% over`}</Badge>;
  return <Badge size="small">At list</Badge>;
}

// ── Modal 1: the product list ────────────────────────────────────────────────
export function PricePreviewModal({ company, location, db, onClose }) {
  const policies = db.policies;
  const products = db.products || [];
  const [detailSku, setDetailSku] = useState(null);
  const [query, setQuery] = useState('');
  const [sortIndex, setSortIndex] = useState(0);
  const [sortDir, setSortDir] = useState('ascending'); // 'ascending' | 'descending'

  // Resolve each product once, then search + sort the derived list.
  const entries = products.map((p) => {
    const v = defaultVariant(p);
    const { finalPrice, list, pctOff } = resolveWalk(company, location, policies, p, v);
    return { p, finalPrice, list, pctOff, nVariants: productVariants(p).length };
  });
  const q = query.trim().toLowerCase();
  const filtered = q
    ? entries.filter((e) => e.p.title.toLowerCase().includes(q) || e.p.sku.toLowerCase().includes(q))
    : entries;
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortIndex === 0) cmp = a.p.title.localeCompare(b.p.title);
    else if (sortIndex === 1) cmp = a.list - b.list;
    else if (sortIndex === 2) cmp = a.finalPrice - b.finalPrice;
    return sortDir === 'descending' ? -cmp : cmp;
  });

  const rows = sorted.map((e, i) => {
    const { p, finalPrice, list, pctOff, nVariants } = e;
    return (
      <IndexTable.Row id={p.sku} key={p.sku} position={i}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="medium">{p.title}</Text>
            <Text as="span" tone="subdued" variant="bodySm">
              {p.sku}{nVariants > 1 ? ` · ${nVariants} variants` : ''}
            </Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone="subdued" alignment="end">{money(list)}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="150" blockAlign="center" align="end">
            <Text as="span" variant="bodyMd" fontWeight="semibold">{money(finalPrice)}</Text>
            <DiscountBadge pctOff={pctOff} />
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack align="end">
            <Button icon={ViewIcon} variant="tertiary" accessibilityLabel="Why this price" onClick={() => setDetailSku(p.sku)} />
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const detailProduct = detailSku ? products.find((p) => p.sku === detailSku) : null;

  // One modal, two views: the product list, or — after "Why this price" — the
  // breakdown for a product (Back / X returns to the list). No stacked modals.
  return (
    <Modal
      open
      onClose={detailProduct ? () => setDetailSku(null) : onClose}
      title={detailProduct ? 'Why this price' : 'Preview price'}
      size={detailProduct ? undefined : 'large'}
      secondaryActions={[
        detailProduct
          ? { content: 'Back', onAction: () => setDetailSku(null) }
          : { content: 'Close', onAction: onClose },
      ]}
    >
      <Modal.Section>
        {detailProduct ? (
          <PriceWhyContent key={detailSku} company={company} location={location} policies={policies} product={detailProduct} />
        ) : (
          <BlockStack gap="300">
            <Text as="span" tone="subdued" variant="bodySm">
              What buyers at {location.name} pay. Prices shown for the default variant.
            </Text>
            <TextField
              label="Search products"
              labelHidden
              value={query}
              onChange={setQuery}
              placeholder="Search by product name or SKU"
              prefix={<Icon source={SearchIcon} tone="subdued" />}
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setQuery('')}
            />
            <IndexTable
              resourceName={{ singular: 'product', plural: 'products' }}
              itemCount={sorted.length}
              selectable={false}
              sortable={[true, true, true, false]}
              sortColumnIndex={sortIndex}
              sortDirection={sortDir}
              onSort={(index, direction) => {
                setSortIndex(index);
                setSortDir(direction);
              }}
              headings={[
                { title: 'Product' },
                { title: 'List', alignment: 'end' },
                { title: 'Buyer pays', alignment: 'end' },
                { title: '' },
              ]}
              emptyState={
                <Box padding="400">
                  <Text as="p" alignment="center" tone="subdued">No products match “{query}”.</Text>
                </Box>
              }
            >
              {rows}
            </IndexTable>
          </BlockStack>
        )}
      </Modal.Section>
    </Modal>
  );
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
