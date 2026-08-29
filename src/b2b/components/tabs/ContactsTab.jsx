import React from 'react';
import { Card, IndexTable, Text, BlockStack, Box, EmptyState } from '@shopify/polaris';

export function ContactsTab({ company }) {
  const contacts = company.contacts || [];

  if (contacts.length === 0) {
    return (
      <Card>
        <EmptyState heading="No contacts yet" image="">
          <p>Company contacts will show up here.</p>
        </EmptyState>
      </Card>
    );
  }

  const rows = contacts.map((c, index) => (
    <IndexTable.Row id={c.email || String(index)} key={c.email || index} position={index}>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {c.name}
          </Text>
          <Text as="span" tone="subdued" variant="bodySm">
            {c.email}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>{c.role || '—'}</IndexTable.Cell>
      <IndexTable.Cell>{c.access || '—'}</IndexTable.Cell>
      <IndexTable.Cell>{c.locations || c.location || '—'}</IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card padding="0">
      <Box padding="300" paddingBlockEnd="0">
        <Text as="h2" variant="headingSm">
          Contacts
        </Text>
      </Box>
      <IndexTable
        resourceName={{ singular: 'contact', plural: 'contacts' }}
        itemCount={contacts.length}
        selectable={false}
        headings={[
          { title: 'Name' },
          { title: 'Shopify role' },
          { title: 'How they buy' },
          { title: 'Location' },
        ]}
      >
        {rows}
      </IndexTable>
    </Card>
  );
}
