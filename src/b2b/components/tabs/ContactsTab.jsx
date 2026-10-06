import React from 'react';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { useStore } from '../../store.jsx';

export function ContactsTab({ company }) {
  const { dispatch } = useStore();
  const contacts = company.contacts || [];

  if (contacts.length === 0) {
    return (
      <s-section>
        <EmptyBlock heading="No contacts yet">Company contacts will show up here.</EmptyBlock>
      </s-section>
    );
  }

  const rows = contacts.map((c, index) => (
    <s-table-row key={c.email || index}>
      <s-table-cell>
        <s-stack gap="small-500">
          <s-text fontWeight="semibold">{c.name}</s-text>
          <s-text color="subdued" fontSize="small">
            {c.email}
          </s-text>
        </s-stack>
      </s-table-cell>
      <s-table-cell>{c.role || '—'}</s-table-cell>
      <s-table-cell>{c.access || '—'}</s-table-cell>
      <s-table-cell>{c.locations || c.location || '—'}</s-table-cell>
    </s-table-row>
  ));

  return (
    <s-section padding="none">
      <s-box padding="small" paddingBlockEnd="small-200">
        <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small">
          <s-stack gap="small-500">
            <s-heading>Contacts</s-heading>
            <s-text color="subdued" fontSize="small">
              Managed on the Shopify company record
            </s-text>
          </s-stack>
          <s-button onClick={() => dispatch({ type: 'TOAST', message: 'Opens in Shopify' })}>Open in Shopify</s-button>
        </s-grid>
      </s-box>
      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="primary">Name</s-table-header>
          <s-table-header listSlot="labeled">Shopify role</s-table-header>
          <s-table-header listSlot="labeled">How they buy</s-table-header>
          <s-table-header listSlot="labeled">Location</s-table-header>
        </s-table-header-row>
        <s-table-body>{rows}</s-table-body>
      </s-table>
    </s-section>
  );
}
