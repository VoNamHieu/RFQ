import React from 'react';
import { Modal, BlockStack, InlineGrid, TextField, Card, Text, Box, Badge, InlineStack } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { RuleBuilderCard } from './RuleBuilderCard.jsx';
import { VolumeRangesCard } from './VolumeRangesCard.jsx';
import { DefaultPriceCard } from './DefaultPriceCard.jsx';
import { versionFlags } from '../../shared/versions.js';

// Fullscreen-ish base pricing editor (spec §2.6 baseEditor, focused on the
// signature Pricing-rules card). Open whenever state.builder is set.
export function PricingEditor() {
  const { state, dispatch } = useStore();
  const builder = state.builder;
  if (!builder) return null;

  const isNew = !builder.id;
  const isQuantity = builder.priceKind === 'quantity';
  const patch = (p) => dispatch({ type: 'BUILDER_PATCH', patch: p });

  return (
    <Modal
      open
      onClose={() => dispatch({ type: 'CLOSE_EDITOR' })}
      title={isNew ? 'Create base pricing' : `Edit pricing: ${builder.name}`}
      size="large"
      primaryAction={{
        content: isNew ? 'Create pricing' : 'Save and update accounts',
        onAction: () => dispatch({ type: 'SAVE_EDITOR' }),
      }}
      secondaryActions={[{ content: 'Cancel', onAction: () => dispatch({ type: 'CLOSE_EDITOR' }) }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Pricing details
              </Text>
              <InlineGrid columns={{ xs: 1, sm: '2fr 1fr' }} gap="300">
                <TextField
                  label="Name"
                  value={builder.name}
                  onChange={(v) => patch({ name: v })}
                  autoComplete="off"
                />
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
            <VolumeRangesCard />
          ) : (
            <>
              {!versionFlags().multiBase && <DefaultPriceCard />}
              <RuleBuilderCard />
            </>
          )}

          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Storefront appearance
              </Text>
              <Text as="p" tone="subdued" variant="bodySm">
                How this price shows on product and cart pages for B2B buyers.
              </Text>
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                <TextField
                  label="Display title"
                  value={builder.displayTitle ?? ''}
                  placeholder={builder.name}
                  onChange={(v) => patch({ displayTitle: v })}
                  autoComplete="off"
                />
                <TextField
                  label="Price badge"
                  value={builder.priceBadge ?? ''}
                  placeholder="B2B price"
                  onChange={(v) => patch({ priceBadge: v })}
                  autoComplete="off"
                />
              </InlineGrid>
              <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" tone="subdued" variant="bodySm">
                    Preview:
                  </Text>
                  <Text as="span" variant="bodyMd" fontWeight="medium">
                    {builder.displayTitle || builder.name}
                  </Text>
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
