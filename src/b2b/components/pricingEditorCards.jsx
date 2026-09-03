import React, { useState, useMemo } from 'react';
import { Card, BlockStack, InlineGrid, InlineStack, TextField, Text, Box, Button, Select, ChoiceList, RadioButton, Divider, Icon, Badge } from '@shopify/polaris';
import { DeleteIcon, SearchIcon } from '@shopify/polaris-icons';
import { COLLECTIONS } from '../data/constants.js';
import { money } from '../format.js';
import { policyPriceBreakdown } from '../pricing.js';

// Cards used by the pricing editor: status/dates, product scope, quantity discount
// basis, and per-SKU price overrides. Split out of PricingEditor for readability.
export function ActiveDatesCard({ builder, patch }) {
  const dated = builder.validityType === 'dated';
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Active dates</Text>
        <BlockStack gap="150">
          <RadioButton label="Always on" checked={!dated} id="valid-evergreen" name="validity" onChange={() => patch({ validityType: 'evergreen' })} />
          <RadioButton label="Set a start / end date" checked={dated} id="valid-dated" name="validity" onChange={() => patch({ validityType: 'dated' })} />
        </BlockStack>
        {dated && (
          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
            <TextField label="Start date" type="date" value={builder.startDate || ''} onChange={(v) => patch({ startDate: v })} autoComplete="off" />
            <TextField label="End date" type="date" value={builder.endDate || ''} onChange={(v) => patch({ endDate: v })} autoComplete="off" />
          </InlineGrid>
        )}
      </BlockStack>
    </Card>
  );
}

// Which products this pricing covers (all / a collection / specific products).
export function ProductScopeCard({ builder, patch, products }) {
  const st = builder.scopeType || 'all';
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Products</Text>
        <Select
          label="Applies to"
          options={[
            { label: 'All products', value: 'all' },
            { label: 'A collection', value: 'collection' },
            { label: 'Specific products', value: 'products' },
          ]}
          value={st}
          onChange={(v) => patch({ scopeType: v })}
        />
        {st === 'collection' && (
          <Select
            label="Collection"
            options={Object.keys(COLLECTIONS).map((c) => ({ label: c, value: c }))}
            value={builder.collection && COLLECTIONS[builder.collection] ? builder.collection : Object.keys(COLLECTIONS)[0]}
            onChange={(v) => patch({ collection: v })}
          />
        )}
        {st === 'products' && (
          <ChoiceList
            allowMultiple
            title="Products"
            titleHidden
            choices={products.map((p) => ({ label: `${p.title} · ${money(p.list)}`, value: p.sku }))}
            selected={builder.selectedProducts || []}
            onChange={(v) => patch({ selectedProducts: v })}
          />
        )}
      </BlockStack>
    </Card>
  );
}

// Quantity discount basis: off the raw Shopify price, or off the base price.
export function VolumeBasisCard({ builder, patch }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">Discount basis</Text>
        <Select
          label="Take the volume discount off"
          options={[
            { label: 'The Shopify price', value: 'shopify' },
            { label: 'The company base price', value: 'base' },
          ]}
          value={builder.volumeBasis || 'shopify'}
          onChange={(v) => patch({ volumeBasis: v })}
        />
      </BlockStack>
    </Card>
  );
}

// Per-SKU exact price overrides (legacy explicitPriceCard).
export function ProductOverridesCard({ builder, patch, products }) {
  const overrides = builder.productAdjustments || {};
  const skus = Object.keys(overrides);
  const remaining = products.filter((p) => !overrides[p.sku]);
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState(null);

  // Search among the not-yet-overridden products, filtering by name / SKU /
  // vendor and capping the list so a large catalog stays fast and bounded.
  const MAX_RESULTS = 50;
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const base = q ? remaining.filter((p) => [p.title, p.sku, p.vendor].filter(Boolean).join(' ').toLowerCase().includes(q)) : [];
    return { list: base.slice(0, MAX_RESULTS), total: base.length };
  }, [q, remaining]);

  const setPrice = (sku, value) => patch({ productAdjustments: { ...overrides, [sku]: { rule: 'set', valueType: 'amount', value: Number(value) || 0 } } });
  const remove = (sku) => {
    const next = { ...overrides };
    delete next[sku];
    patch({ productAdjustments: next });
  };
  const prod = (sku) => products.find((p) => p.sku === sku);
  const subline = (p) => [p.sku, p.list != null ? money(p.list) : null, p.vendor].filter(Boolean).join(' · ');
  // What the product would resolve to from the rules/default WITHOUT this override,
  // so "which wins" is readable on the row (god-file explicitPriceCard default column).
  const defaultOf = (sku) => {
    const p = prod(sku);
    if (!p) return null;
    const bd = policyPriceBreakdown({ ...builder, productAdjustments: {} }, p);
    return bd && bd.inScope ? bd.final : null;
  };
  // Click-to-add: prefill the row with the product's list price, editable inline.
  const addProduct = (sku) => {
    const p = prod(sku);
    setPrice(sku, p?.list ?? 0);
  };

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="200" blockAlign="center">
          <Text as="h3" variant="headingSm">Product price overrides</Text>
          {skus.length > 0 ? <Badge>{`${skus.length} product${skus.length === 1 ? '' : 's'}`}</Badge> : null}
        </InlineStack>
        <Text as="p" tone="subdued" variant="bodySm">Set an exact price for specific products. Overrides win over rules and the default.</Text>

        {skus.length > 0 && (
          <Box borderWidth="025" borderColor="border" borderRadius="200">
            {skus.map((sku, i) => {
              const p = prod(sku);
              return (
                <Box key={sku} padding="300" borderBlockStartWidth={i === 0 ? '0' : '025'} borderColor="border">
                  <InlineStack gap="300" blockAlign="center" wrap={false}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <BlockStack gap="0">
                        <Text as="span" variant="bodyMd" truncate>{p?.title || sku}</Text>
                        <Text as="span" tone="subdued" variant="bodySm">{p ? subline(p) : sku}</Text>
                      </BlockStack>
                    </div>
                    <div style={{ width: 96, textAlign: 'right' }}>
                      <Text as="span" tone="subdued" variant="bodySm">
                        {(() => {
                          const d = defaultOf(sku);
                          return d != null ? `Default ${money(d)}` : '';
                        })()}
                      </Text>
                    </div>
                    <div style={{ width: 128 }}>
                      <TextField label="Price" labelHidden type="number" prefix="$" min={0} value={String(overrides[sku].value ?? '')} onChange={(v) => setPrice(sku, v)} autoComplete="off" />
                    </div>
                    <Button icon={DeleteIcon} tone="critical" variant="tertiary" accessibilityLabel={`Remove ${p?.title || sku}`} onClick={() => remove(sku)} />
                  </InlineStack>
                </Box>
              );
            })}
          </Box>
        )}

        {remaining.length > 0 && (
          <BlockStack gap="150">
            <TextField
              label="Add products"
              value={query}
              onChange={setQuery}
              prefix={<Icon source={SearchIcon} tone="subdued" />}
              placeholder="Search products by name or SKU"
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setQuery('')}
            />
            {q !== '' && (
              <Box borderWidth="025" borderColor="border" borderRadius="200">
                {matches.list.length > 0 ? (
                  <div style={{ maxHeight: 264, overflowY: 'auto' }}>
                    {matches.list.map((p, i) => (
                      <button
                        key={p.sku}
                        type="button"
                        onClick={() => addProduct(p.sku)}
                        onMouseEnter={() => setHovered(p.sku)}
                        onMouseLeave={() => setHovered((h) => (h === p.sku ? null : h))}
                        style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box' }}
                      >
                        <Box
                          paddingBlock="150"
                          paddingInline="300"
                          borderBlockStartWidth={i === 0 ? '0' : '025'}
                          borderColor="border"
                          background={hovered === p.sku ? 'bg-surface-hover' : undefined}
                        >
                          <InlineStack align="space-between" blockAlign="center" wrap={false} gap="300">
                            <BlockStack gap="0">
                              <Text as="span" variant="bodyMd">{p.title}</Text>
                              <Text as="span" tone="subdued" variant="bodySm">{subline(p)}</Text>
                            </BlockStack>
                            <Text as="span" tone={hovered === p.sku ? 'magic' : 'subdued'} variant="bodySm" fontWeight="medium">
                              Add
                            </Text>
                          </InlineStack>
                        </Box>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Box padding="300">
                    <Text as="span" tone="subdued" variant="bodySm">No products match “{query.trim()}”.</Text>
                  </Box>
                )}
                {matches.total > matches.list.length && (
                  <Box padding="200" borderBlockStartWidth="025" borderColor="border" background="bg-surface-secondary">
                    <Text as="span" tone="subdued" variant="bodySm">{`Showing first ${matches.list.length} of ${matches.total} — keep typing to narrow it down.`}</Text>
                  </Box>
                )}
              </Box>
            )}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
