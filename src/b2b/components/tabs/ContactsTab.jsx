import React from 'react';
import { Card, IndexTable, Text, BlockStack, Box, InlineStack, Button } from '@shopify/polaris';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { useStore } from '../../store.jsx';

export function ContactsTab({ company }) {
  const { dispatch } = useStore();
  const contacts = company.contacts || [];

  if (contacts.length === 0) {
    return (
      <Card>
        <EmptyBlock heading="No contacts yet">Company contacts will show up here.</EmptyBlock>
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
      <Box padding="300" paddingBlockEnd="200">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="050">
            <Text as="h2" variant="headingSm">Contacts</Text>
            <Text as="span" tone="subdued" variant="bodySm">Managed on the Shopify company record</Text>
          </BlockStack>
          <Button onClick={() => dispatch({ type: 'TOAST', message: 'Opens the Shopify company record' })}>Open in Shopify</Button>
        </InlineStack>
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
