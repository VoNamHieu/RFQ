import React, { useState } from 'react';
import { Card, IndexTable, Badge, Text, BlockStack, Box, InlineStack, Button, Modal, TextField, Select, Tooltip, Checkbox } from '@shopify/polaris';
import { PlusIcon } from '@shopify/polaris-icons';
import { useStore } from '../../store.jsx';
import { locationPricingEntries } from '../../pricing.js';

const PAYMENT_TERMS = ['No payment terms', 'Due on receipt', 'Net 15', 'Net 30', 'Net 60'];

export function LocationsTab({ company }) {
  const { state, dispatch } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const locations = company.locations || [];

  const rows = locations.map((l, index) => {
    const buyers = typeof l.buyers === 'number' ? l.buyers : (company.contacts || []).filter((c) => c.locations === l.name).length;
    const { bases, quantities } = locationPricingEntries(company, l, state.db.policies);
    const names = [...bases, ...quantities].map((e) => e.policy.name);
    return (
      <IndexTable.Row
        id={l.id || String(index)}
        key={l.id || index}
        position={index}
        onClick={() => dispatch({ type: 'OPEN_LOCATION', companyId: company.id, locationId: l.id })}
      >
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {l.name}
            </Text>
            {l.address ? (
              <Text as="span" tone="subdued" variant="bodySm">
                {l.address}
              </Text>
            ) : null}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{l.terms || l.paymentTerms || '—'}</IndexTable.Cell>
        <IndexTable.Cell>{l.ordering || (l.purchasingMode === 'REQUIRE_APPROVAL' ? 'You approve first' : 'Buys directly')}</IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="050">
            {names.length ? (
              <InlineStack gap="100" blockAlign="center">
                <Text as="span" variant="bodySm">{names.slice(0, 3).join(', ')}</Text>
                {names.length > 3 ? (
                  <Tooltip content={names.slice(3).join(', ')}>
                    <Badge size="small">{`+${names.length - 3}`}</Badge>
                  </Tooltip>
                ) : null}
              </InlineStack>
            ) : (
              <Text as="span" variant="bodySm">Not set</Text>
            )}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{buyers}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="success">{l.status || 'Active'}</Badge>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Card padding="0">
      <Box padding="300" paddingBlockEnd="0">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">
            Locations
          </Text>
          <Button icon={PlusIcon} variant="tertiary" onClick={() => setAddOpen(true)}>
            Add location
          </Button>
        </InlineStack>
        <Box paddingBlock="200">
          <Checkbox
            label="Automatically add new locations"
            helpText="Locations added to this company in Shopify are added here too and use the company's pricing."
            checked={!!company.autoAddLocations}
            onChange={(on) => dispatch({ type: 'SET_AUTO_ADD_LOCATIONS', companyId: company.id, on })}
          />
        </Box>
      </Box>
      <IndexTable
        resourceName={{ singular: 'location', plural: 'locations' }}
        itemCount={locations.length}
        selectable={false}
        headings={[
          { title: 'Location' },
          { title: 'Payment terms' },
          { title: 'Purchasing' },
          { title: 'Pricing' },
          { title: 'Buyers' },
          { title: 'Status' },
        ]}
      >
        {rows}
      </IndexTable>
      {addOpen && <AddLocationModal company={company} onClose={() => setAddOpen(false)} dispatch={dispatch} />}
    </Card>
  );
}

function AddLocationModal({ company, onClose, dispatch }) {
  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('No payment terms');
  const [purchasingMode, setPurchasingMode] = useState('DIRECT');
  return (
    <Modal
      open
      onClose={onClose}
      title={`Add a location to ${company.name}`}
      primaryAction={{
        content: 'Add location',
        disabled: !name.trim(),
        onAction: () => {
          dispatch({ type: 'ADD_LOCATION', companyId: company.id, name: name.trim(), externalId: externalId.trim(), paymentTerms, purchasingMode });
          onClose();
        },
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <TextField label="Location name" value={name} onChange={setName} autoComplete="off" />
          <TextField label="Location ID" placeholder="Optional external ID" value={externalId} onChange={setExternalId} autoComplete="off" />
          <Select label="Payment terms" options={PAYMENT_TERMS.map((t) => ({ label: t, value: t }))} value={paymentTerms} onChange={setPaymentTerms} />
          <Select
            label="Order submission"
            options={[
              { label: 'Automatically submit orders', value: 'DIRECT' },
              { label: 'Submit as drafts for review', value: 'REQUIRE_APPROVAL' },
            ]}
            value={purchasingMode}
            onChange={setPurchasingMode}
          />
          <Text as="p" tone="subdued" variant="bodySm">The new location uses the company pricing. You can add its own pricing later from the location page.</Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
