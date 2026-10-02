import React from 'react';
import { ChoiceList, Box, BlockStack, Checkbox, Divider, Text } from '@shopify/polaris';

// Which of a company's locations get a pricing: all of them (company pricing —
// locations added later get it too) or only some. `locationIds` null = all; an
// array = the picked ones. Shared by the Assign modal and the pricing editor.
export function LocationScopePicker({ company, locationIds, onChange, title = 'Apply to', titleHidden = false }) {
  const locations = company?.locations || [];
  const some = Array.isArray(locationIds);
  const picked = some ? locationIds : [];
  const toggle = (id, on) => onChange(on ? [...new Set([...picked, id])] : picked.filter((x) => x !== id));

  const list = (
    <BlockStack gap="150">
      <Box borderWidth="025" borderColor="border" borderRadius="200" overflowX="hidden" overflowY="hidden">
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {locations.map((l, i) => (
            <React.Fragment key={l.id}>
              {i > 0 ? <Divider /> : null}
              <Box paddingInline="300" paddingBlock="200">
                <Checkbox label={l.name} checked={picked.includes(l.id)} onChange={(on) => toggle(l.id, on)} />
              </Box>
            </React.Fragment>
          ))}
        </div>
      </Box>
      <Text as="p" tone="subdued" variant="bodySm">
        {picked.length
          ? `${picked.length} of ${locations.length} selected. They get their own pricing, starting from the company’s, so later company changes won’t reach them.`
          : 'Pick the locations that get this pricing.'}
      </Text>
    </BlockStack>
  );

  return (
    <ChoiceList
      title={title}
      titleHidden={titleHidden}
      selected={[some ? 'some' : 'all']}
      onChange={([v]) => onChange(v === 'some' ? picked : null)}
      choices={[
        { label: 'All locations', value: 'all', helpText: 'Company pricing. Locations added later get it too.' },
        { label: 'Specific locations', value: 'some', renderChildren: (isSelected) => (isSelected ? list : null) },
      ]}
    />
  );
}
