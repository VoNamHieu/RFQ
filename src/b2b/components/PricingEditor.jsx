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
            // The type is fixed by how the editor was opened (base vs quantity) —
            // no in-place switch, which is confusing mid-create. Just describe it.
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

          {/* Scheduling last, matching the god-file editor order. */}
          <ActiveDatesCard builder={builder} patch={patch} />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// Status + validity window.
