import React from 'react';
import { Modal, BlockStack, InlineGrid, TextField, Card, Text, Box } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { RuleBuilderCard } from './RuleBuilderCard.jsx';

// Fullscreen-ish base pricing editor (spec §2.6 baseEditor, focused on the
// signature Pricing-rules card). Open whenever state.builder is set.
export function PricingEditor() {
  const { state, dispatch } = useStore();
  const builder = state.builder;
  if (!builder) return null;

  const isNew = !builder.id;
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

          <RuleBuilderCard />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
