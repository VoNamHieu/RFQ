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
  Select,
  ChoiceList,
  RadioButton,
  Banner,
  Divider,
  Tabs,
} from '@shopify/polaris';
import { DeleteIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { RuleBuilderCard } from './RuleBuilderCard.jsx';
import { VolumeRangesCard } from './VolumeRangesCard.jsx';
import { DefaultPriceCard } from './DefaultPriceCard.jsx';
import { versionFlags } from '../../shared/versions.js';
import { COLLECTIONS } from '../data/constants.js';
import { money } from '../format.js';
import { ActiveDatesCard, ProductScopeCard, VolumeBasisCard, ProductOverridesCard } from './pricingEditorCards.jsx';
import { policyUsageCount, companyBaseEntries, companyQuantityPolicy, policyPriceBreakdown, scopeLabel, kindOf } from '../pricing.js';

// Fullscreen-ish pricing editor (spec §2.6). Open whenever state.builder is set.
export function PricingEditor() {
  const { state, dispatch } = useStore();
  const [forkConfirm, setForkConfirm] = useState(false);
  const builder = state.builder;
  if (!builder) return null;

  const isNew = !builder.id;
  const isQuantity = builder.priceKind === 'quantity';
  const patch = (p) => dispatch({ type: 'BUILDER_PATCH', patch: p });
  // The editor has two tabs, like the god file: Settings (the pricing config) and
  // Appearance (how it shows on the storefront).
  const pricingTab = state.pricingBuilderTab === 'appearance' ? 'appearance' : 'settings';
  const kindWord = isQuantity ? 'quantity pricing' : 'base pricing';

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

          {/* Two tabs, like the god file: Settings (the pricing config) and
              Appearance (how it shows on the storefront). */}
          <Tabs
            tabs={[
              { id: 'settings', content: 'Settings' },
              { id: 'appearance', content: 'Appearance' },
            ]}
            selected={pricingTab === 'appearance' ? 1 : 0}
            onSelect={(i) => dispatch({ type: 'SET_BUILDER_TAB', tab: i === 1 ? 'appearance' : 'settings' })}
          />

          {pricingTab === 'settings' ? (
            <BlockStack gap="400">
              {isNew && (
                // The type is fixed by how the editor was opened (base vs quantity)
                // — no in-place switch, which is confusing mid-create. Just describe it.
                <Card>
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingSm">{isQuantity ? 'Quantity pricing' : 'Base pricing'}</Text>
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
                    <TextField
                      label="Name"
                      value={builder.name}
                      onChange={(v) => patch({ name: v })}
                      maxLength={255}
                      showCharacterCount
                      autoComplete="off"
                    />
                    <TextField
                      label="Priority (0–99)"
                      type="number"
                      min={0}
                      max={99}
                      value={String(builder.priority ?? '')}
                      onChange={(v) => patch({ priority: Number(v) })}
                      helpText="Lower number applies first; the rest are fallbacks. Company/Location and customer/tag precedence isn’t replaced by this."
                      autoComplete="off"
                    />
                  </InlineGrid>
                </BlockStack>
              </Card>

              {isQuantity ? (
                <>
                  <VolumeRangesCard />
                  <ProductScopeCard builder={builder} patch={patch} products={state.db.products} />
                  <VolumeBasisCard builder={builder} patch={patch} />
                </>
              ) : (
                <>
                  {/* In the multi-base model, product scope lives in the Pricing rules
                      below (each rule targets all products, or a collection/vendor/tag),
                      so a standalone "Applies to" card just duplicates it. Only the
                      legacy single-base model needs the explicit scope + default price. */}
                  {!versionFlags().multiBase && <ProductScopeCard builder={builder} patch={patch} products={state.db.products} />}
                  {!versionFlags().multiBase && <DefaultPriceCard />}
                  <RuleBuilderCard />
                  <ProductOverridesCard builder={builder} patch={patch} products={state.db.products} />
                </>
              )}

              {/* How the price resolves — base only (a volume price has no single
                  buyer-pays number), matching the god-file resolutionPreview. */}
              {!isQuantity && <ResolutionCard builder={builder} products={state.db.products} />}
              <SummaryCard builder={builder} isQuantity={isQuantity} />

              {/* Scheduling last, matching the god-file editor order. */}
              <ActiveDatesCard builder={builder} patch={patch} />
            </BlockStack>
          ) : (
            <AppearanceTab builder={builder} patch={patch} kindWord={kindWord} product={state.db.products[0]} />
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// "How the price resolves" (god-file resolutionPreview): for a sample in-scope
// product, Shopify price → default adjustment → matching rule → explicit price →
// what the buyer pays. Base pricing only.
function ResolutionCard({ builder, products }) {
  const product = products.find((p) => policyPriceBreakdown(builder, p)?.inScope) || products[0];
  const bd = product ? policyPriceBreakdown(builder, product) : null;
  if (!bd) return null;
  const Row = ({ label, value, strong, active }) => (
    <InlineStack align="space-between" blockAlign="center">
      <Text as="span" tone={active || strong ? undefined : 'subdued'} variant="bodySm" fontWeight={strong ? 'semibold' : undefined}>
        {label}
      </Text>
      <Text as="span" variant="bodyMd" fontWeight={strong ? 'semibold' : undefined}>
        {value}
      </Text>
    </InlineStack>
  );
  const overridden = bd.override != null;
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">How the price resolves</Text>
        <Text as="p" tone="subdued" variant="bodySm">{product.title}</Text>
        <BlockStack gap="150">
          <Row label="Shopify price" value={money(bd.shopify)} />
          <Row label="Default adjustment" value={money(bd.defaultPrice)} active={!overridden && !bd.rule} />
          {bd.rule ? <Row label={`Rule ${bd.rule.index + 1}`} value={money(bd.rule.price)} active={!overridden} /> : null}
          {overridden ? <Row label="Explicit price" value={money(bd.override)} active /> : null}
          <Divider />
          <Row label="Buyer pays" value={money(bd.final)} strong />
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

// Settings summary (god-file asideSummary): an at-a-glance recap.
function SummaryCard({ builder, isQuantity }) {
  const items = [
    ['Type', isQuantity ? 'Quantity pricing' : 'Base pricing'],
    ['Products', scopeLabel(builder)],
    ['Priority', String(builder.priority ?? 0)],
    ['Status', builder.status || 'Active'],
  ];
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">Settings summary</Text>
        <BlockStack gap="150">
          {items.map(([k, v]) => (
            <InlineStack key={k} align="space-between" blockAlign="center">
              <Text as="span" tone="subdued" variant="bodySm">
                {k}
              </Text>
              <Text as="span" variant="bodyMd" fontWeight="medium">
                {v}
              </Text>
            </InlineStack>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

// The Appearance tab (god-file appearanceEditor): how the price shows on the
// storefront, plus a live product preview. Does not affect price calculation.
function AppearanceTab({ builder, patch, kindWord, product }) {
  const list = product?.list ?? 62;
  const now = Math.round(list * 0.85 * 100) / 100; // illustrative preview discount
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Appearance</Text>
        <Text as="p" tone="subdued" variant="bodySm">
          {`How this ${kindWord} is presented on the storefront. It does not change price calculation or assignment.`}
        </Text>
        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
          <TextField label="Display title" value={builder.displayTitle ?? ''} placeholder={builder.name} onChange={(v) => patch({ displayTitle: v })} autoComplete="off" />
          <TextField label="Price badge" value={builder.priceBadge ?? ''} placeholder="B2B price" onChange={(v) => patch({ priceBadge: v })} autoComplete="off" />
        </InlineGrid>
        <Box borderWidth="025" borderColor="border" borderRadius="200" padding="300">
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <Box background="bg-surface-secondary" borderRadius="200" minHeight="48px" width="48px">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48 }}>
                <Text as="span" tone="subdued">▣</Text>
              </div>
            </Box>
            <div style={{ flex: 1, minWidth: 0 }}>
              <BlockStack gap="050">
                <Text as="span" variant="bodyMd" fontWeight="medium">{product?.title || 'Sample product'}</Text>
                <InlineStack gap="150" blockAlign="center">
                  <Text as="span" tone="subdued" variant="bodySm">{builder.displayTitle || builder.name}</Text>
                  <Badge tone="info">{builder.priceBadge || 'B2B price'}</Badge>
                </InlineStack>
              </BlockStack>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>
                <Text as="span" tone="subdued" variant="bodySm" textDecorationLine="line-through">{money(list)}</Text>
              </div>
              <Text as="span" variant="headingMd">{money(now)}</Text>
            </div>
          </InlineStack>
        </Box>
      </BlockStack>
    </Card>
  );
}

// Status + validity window.
