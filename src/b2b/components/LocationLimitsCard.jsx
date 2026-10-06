import React, { useState } from 'react';
import { Card, BlockStack, InlineStack, Text, Button, Badge, Divider, Popover, ActionList } from '@shopify/polaris';
import { PlusIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitKey, locationLimits } from '../limits.js';

const LEVEL_LABEL = { location: 'This location', company: 'Company', store: 'Store-wide' };

// A location's order limits: every active limit that reaches it (its own, its
// company's, store-wide), most specific first. A rule that a more specific limit
// replaces here is struck through and names the limit that wins.
export function LocationLimitsCard({ company, location }) {
  const { state, dispatch } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const rows = locationLimits(state.db, company.id, location.id);
  // The editor opens in Order limits and comes back here on save or cancel.
  const returnTo = { view: 'location', selectedCompany: company.id, selectedLocation: location.id };
  const add = (kind) => {
    setAddOpen(false);
    dispatch({
      type: 'OPEN_LIMIT_EDITOR',
      kind,
      preset: { name: `${location.name} ${LIMIT_KINDS[kind].label.toLowerCase()}`, storeWide: false, locationKeys: [limitKey(company.id, location.id)] },
      returnTo,
    });
  };

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">Order limits</Text>
          <Popover
            active={addOpen}
            onClose={() => setAddOpen(false)}
            activator={<Button size="micro" icon={PlusIcon} onClick={() => setAddOpen((o) => !o)}>Add limit</Button>}
          >
            <ActionList
              items={Object.entries(LIMIT_KINDS).map(([kind, k]) => ({ content: k.label, helpText: k.description, onAction: () => add(kind) }))}
            />
          </Popover>
        </InlineStack>

        {rows.length ? (
          rows.map(({ limit, level, rules }, i) => (
            <React.Fragment key={limit.id}>
              {i > 0 && <Divider />}
              <BlockStack gap="100">
                <InlineStack align="space-between" blockAlign="start" gap="200" wrap={false}>
                  <Button variant="plain" textAlign="left" onClick={() => dispatch({ type: 'OPEN_LIMIT_EDITOR', limit, returnTo })}>
                    {limit.name}
                  </Button>
                  <Badge tone={level === 'location' ? 'info' : undefined}>{LEVEL_LABEL[level]}</Badge>
                </InlineStack>
                {rules.map((r) =>
                  r.replacedBy ? (
                    <BlockStack key={r.text} gap="0">
                      <Text as="p" variant="bodySm" tone="subdued"><s>{r.text}</s></Text>
                      <Text as="p" variant="bodySm" tone="subdued">{`Replaced here by ${r.replacedBy.name}`}</Text>
                    </BlockStack>
                  ) : (
                    <Text key={r.text} as="p" variant="bodySm">{r.text}</Text>
                  ),
                )}
              </BlockStack>
            </React.Fragment>
          ))
        ) : (
          <Text as="p" tone="subdued" variant="bodySm">No order limits. Buyers here can check out any amount.</Text>
        )}

        <InlineStack>
          <Button variant="plain" onClick={() => dispatch({ type: 'NAVIGATE', view: 'limits' })}>Manage all order limits</Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
