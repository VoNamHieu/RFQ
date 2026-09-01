import React, { useState } from 'react';
import {
  Modal,
  BlockStack,
  InlineGrid,
  InlineStack,
  TextField,
  Card,
  Text,
  Box,
  Badge,
  Button,
  ButtonGroup,
  Select,
  ChoiceList,
  RadioButton,
  Banner,
  Divider,
} from '@shopify/polaris';
import { DeleteIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { RuleBuilderCard } from './RuleBuilderCard.jsx';
import { VolumeRangesCard } from './VolumeRangesCard.jsx';
import { DefaultPriceCard } from './DefaultPriceCard.jsx';
import { versionFlags } from '../../shared/versions.js';
import { COLLECTIONS } from '../data/constants.js';
import { money } from '../format.js';
import { policyUsageCount, companyBaseEntries, companyQuantityPolicy } from '../pricing.js';

// Fullscreen-ish pricing editor (spec §2.6). Open whenever state.builder is set.
export function PricingEditor() {
  const { state, dispatch } = useStore();
  const [forkConfirm, setForkConfirm] = useState(false);
  const builder = state.builder;
  if (!builder) return null;

  const isNew = !builder.id;
  const isQuantity = builder.priceKind === 'quantity';
  const patch = (p) => dispatch({ type: 'BUILDER_PATCH', patch: p });

  // Is this an edit of a profile SHARED beyond the company we opened it from?
  const scopeCompany = state.editorContext?.companyId
    ? state.db.companies.find((c) => c.id === state.editorContext.companyId)
    : null;
  const usesHere =
    scopeCompany &&
    (companyBaseEntries(scopeCompany, state.db.policies).some((e) => e.policy.id === builder.id) ||
      companyQuantityPolicy(scopeCompany, state.db.policies)?.id === builder.id);
  const sharedCount = !isNew ? policyUsageCount({ id: builder.id }, state.db) - (usesHere ? 1 : 0) : 0;
  const sharedElsewhere = !isNew && scopeCompany && sharedCount > 0;

  const onSave = () => {
    if (sharedElsewhere) setForkConfirm(true);
    else dispatch({ type: 'SAVE_EDITOR' });
  };

  return (
    <Modal
      open
      onClose={() => dispatch({ type: 'CLOSE_EDITOR' })}
      title={isNew ? `Create ${isQuantity ? 'quantity' : 'base'} pricing` : `Edit pricing: ${builder.name}`}
      size="large"
      primaryAction={{
        content: isNew ? 'Create pricing' : 'Save',
        onAction: onSave,
      }}
      secondaryActions={[{ content: 'Cancel', onAction: () => dispatch({ type: 'CLOSE_EDITOR' }) }]}
    >
      {forkConfirm && (
        <Modal
          open
          onClose={() => setForkConfirm(false)}
          title="This pricing is shared"
          primaryAction={{
            content: `Save a copy for ${scopeCompany.name}`,
            onAction: () => {
              setForkConfirm(false);
              dispatch({ type: 'SAVE_EDITOR' }); // default path forks for this company
            },
          }}
          secondaryActions={[
            {
              content: `Apply to all ${sharedCount + 1}`,
              onAction: () => {
                setForkConfirm(false);
                dispatch({ type: 'SAVE_EDITOR', applyToAll: true });
              },
            },
            { content: 'Cancel', onAction: () => setForkConfirm(false) },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              “{builder.name}” is assigned to {sharedCount} other {sharedCount === 1 ? 'account' : 'accounts'}. Saving a copy
              changes the price only for {scopeCompany.name}; the others keep the original. Choose “Apply to all” to change
              it everywhere it’s assigned.
            </Text>
          </Modal.Section>
        </Modal>
      )}
      <Modal.Section>
        <BlockStack gap="400">
          {sharedElsewhere && (
            <Banner tone="info">
              {`This pricing is also assigned to ${sharedCount} other ${sharedCount === 1 ? 'account' : 'accounts'}. Saving will offer to fork a copy for ${scopeCompany.name} or apply to all.`}
            </Banner>
          )}
          {isNew && (
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Pricing type</Text>
                <ButtonGroup variant="segmented">
                  <Button pressed={!isQuantity} onClick={() => dispatch({ type: 'SWITCH_KIND', kind: 'base' })}>Base pricing</Button>
                  <Button pressed={isQuantity} onClick={() => dispatch({ type: 'SWITCH_KIND', kind: 'quantity' })}>Quantity pricing</Button>
                </ButtonGroup>
                <Text as="p" tone="subdued" variant="bodySm">
                  {isQuantity
                    ? 'Volume discounts that kick in above a quantity threshold, on selected products.'
                    : 'A price that covers the whole catalog, with optional rules and per-product overrides.'}
                </Text>
              </BlockStack>
            </Card>
          )}

          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">Pricing details</Text>
              <InlineGrid columns={{ xs: 1, sm: '2fr 1fr' }} gap="300">
                <TextField label="Name" value={builder.name} onChange={(v) => patch({ name: v })} autoComplete="off" />
                <TextField
                  label="Priority"
                  type="number"
                  min={0}
                  value={String(builder.priority ?? '')}
                  onChange={(v) => patch({ priority: Number(v) })}
                  helpText="Lower number applies first; the rest are fallbacks."
                  autoComplete="off"
                />
              </InlineGrid>
            </BlockStack>
          </Card>

          <ActiveDatesCard builder={builder} patch={patch} />

          {isQuantity ? (
            <>
              <ProductScopeCard builder={builder} patch={patch} products={state.db.products} />
              <VolumeRangesCard />
              <VolumeBasisCard builder={builder} patch={patch} />
            </>
          ) : (
            <>
              <ProductScopeCard builder={builder} patch={patch} products={state.db.products} />
              {!versionFlags().multiBase && <DefaultPriceCard />}
              <RuleBuilderCard />
              <ProductOverridesCard builder={builder} patch={patch} products={state.db.products} />
            </>
          )}

          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">Storefront appearance</Text>
              <Text as="p" tone="subdued" variant="bodySm">How this price shows on product and cart pages for B2B buyers.</Text>
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                <TextField label="Display title" value={builder.displayTitle ?? ''} placeholder={builder.name} onChange={(v) => patch({ displayTitle: v })} autoComplete="off" />
                <TextField label="Price badge" value={builder.priceBadge ?? ''} placeholder="B2B price" onChange={(v) => patch({ priceBadge: v })} autoComplete="off" />
              </InlineGrid>
              <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" tone="subdued" variant="bodySm">Preview:</Text>
                  <Text as="span" variant="bodyMd" fontWeight="medium">{builder.displayTitle || builder.name}</Text>
                  <Badge tone="info">{builder.priceBadge || 'B2B price'}</Badge>
                </InlineStack>
              </Box>
            </BlockStack>
          </Card>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// Status + validity window.
function ActiveDatesCard({ builder, patch }) {
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
function ProductScopeCard({ builder, patch, products }) {
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
function VolumeBasisCard({ builder, patch }) {
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
function ProductOverridesCard({ builder, patch, products }) {
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
