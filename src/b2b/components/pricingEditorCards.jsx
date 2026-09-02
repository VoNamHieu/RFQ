import React, { useState } from 'react';
import { Card, BlockStack, InlineGrid, InlineStack, TextField, Text, Box, Button, Select, ChoiceList, RadioButton, Divider } from '@shopify/polaris';
import { DeleteIcon } from '@shopify/polaris-icons';
import { COLLECTIONS } from '../data/constants.js';
import { money } from '../format.js';

// Cards used by the pricing editor: status/dates, product scope, quantity discount
// basis, and per-SKU price overrides. Split out of PricingEditor for readability.
export function ActiveDatesCard({ builder, patch }) {
  const dated = builder.validityType === 'dated';
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Status &amp; active dates</Text>
        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
          <Select
            label="Status"
            options={[
              { label: 'Active', value: 'Active' },
              { label: 'Inactive (turned off)', value: 'Inactive' },
              { label: 'Scheduled', value: 'Scheduled' },
            ]}
            value={builder.status || 'Active'}
            onChange={(v) => patch({ status: v })}
          />
        </InlineGrid>
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
  const [addSku, setAddSku] = useState(remaining[0]?.sku || '');
  const [addPrice, setAddPrice] = useState('');

  const setPrice = (sku, value) => patch({ productAdjustments: { ...overrides, [sku]: { rule: 'set', valueType: 'amount', value: Number(value) || 0 } } });
  const remove = (sku) => {
    const next = { ...overrides };
    delete next[sku];
    patch({ productAdjustments: next });
  };
  const add = () => {
    if (!addSku) return;
    setPrice(addSku, addPrice);
    const nextRemaining = products.filter((p) => p.sku !== addSku && !overrides[p.sku]);
    setAddSku(nextRemaining[0]?.sku || '');
    setAddPrice('');
  };
  const titleOf = (sku) => products.find((p) => p.sku === sku)?.title || sku;

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Product price overrides</Text>
        <Text as="p" tone="subdued" variant="bodySm">Set an exact price for specific products. Overrides win over rules and the default.</Text>
        {skus.length > 0 && (
          <BlockStack gap="200">
            {skus.map((sku) => (
              <InlineStack key={sku} gap="200" blockAlign="end" wrap={false}>
                <div style={{ flex: 1 }}>
                  <Text as="span" variant="bodyMd">{titleOf(sku)}</Text>
                  <Text as="span" tone="subdued" variant="bodySm">{` · ${sku}`}</Text>
                </div>
                <div style={{ width: 120 }}>
                  <TextField label="Price" labelHidden type="number" prefix="$" min={0} value={String(overrides[sku].value ?? '')} onChange={(v) => setPrice(sku, v)} autoComplete="off" />
                </div>
                <Button icon={DeleteIcon} tone="critical" variant="tertiary" accessibilityLabel="Remove override" onClick={() => remove(sku)} />
              </InlineStack>
            ))}
          </BlockStack>
        )}
        {remaining.length > 0 && (
          <>
            <Divider />
            <InlineStack gap="200" blockAlign="end" wrap={false}>
              <div style={{ flex: 1 }}>
                <Select label="Add a product" options={remaining.map((p) => ({ label: p.title, value: p.sku }))} value={addSku} onChange={setAddSku} />
              </div>
              <div style={{ width: 120 }}>
                <TextField label="Price" type="number" prefix="$" min={0} value={addPrice} onChange={setAddPrice} autoComplete="off" />
              </div>
              <Button onClick={add} disabled={!addSku || addPrice === ''}>Add</Button>
            </InlineStack>
          </>
        )}
      </BlockStack>
    </Card>
  );
}
