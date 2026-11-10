import React, { useState } from 'react';
import { useStore } from '../../store.jsx';
import { SideBlock, SideRow } from '../companyLayout.jsx';
import { SummaryHoverCard } from '../SummaryHoverCard.jsx';

// Contact chips shown before "+N more" (as a location's buyers).
const CONTACTS_SHOWN = 4;
// Its hover card is wider than the others: each "Location · Role" fits on one line.
const CONTACT_CARD_WIDTH = 380;

// The company's contacts, one per person (listed once per location they buy for).
function people(contacts) {
  const byKey = new Map();
  contacts.forEach((c) => {
    const key = c.email || c.name;
    const p = byKey.get(key) || { name: c.name, email: c.email, role: c.role, access: c.access, at: [] };
    const where = c.locations || c.location;
    if (where) p.at.push(`${where} · ${c.role || 'Ordering only'}`);
    byKey.set(key, p);
  });
  return [...byKey.values()];
}

// A contact chip's hover card: email, where they buy (with their role there) and how
// they order (its badge is the role).
const contactSummaryItems = (p) => [
  ['email', 'Email', p.email || '—'],
  ['location', 'Locations', p.at.length ? p.at : 'No location'],
  ['cart', 'Ordering', p.access || 'Buys directly'],
];

// A company's Contacts block: chips together, like a location's buyers — hover shows the
// role, email, locations and how they order. Contacts are managed on the Shopify company
// record (no remove here).
export function ContactsTab({ company }) {
  const { dispatch } = useStore();
  const [all, setAll] = useState(false);
  const contacts = people(company.contacts || []);
  const shown = all ? contacts : contacts.slice(0, CONTACTS_SHOWN);

  return (
    <SideBlock
      title={`Contacts${contacts.length ? ` (${contacts.length})` : ''}`}
      actions={<s-button onClick={() => dispatch({ type: 'TOAST', message: 'Opens in Shopify' })}>Open in Shopify</s-button>}
      info="Managed on the Shopify company record."
    >
      <SideRow>
        {contacts.length ? (
          <s-stack direction="inline" gap="small-300" alignItems="center">
            {shown.map((p, i) => (
              <span key={p.email || i} className="cd-chip cd-chip--plain">
                <SummaryHoverCard title={p.name} status={p.role || 'Ordering only'} width={CONTACT_CARD_WIDTH} items={() => contactSummaryItems(p)}>
                  <span className="cd-chip__label" tabIndex={0}>
                    {p.name}
                  </span>
                </SummaryHoverCard>
              </span>
            ))}
            {!all && contacts.length > CONTACTS_SHOWN ? (
              <s-clickable-chip accessibilityLabel={`Show ${contacts.length - CONTACTS_SHOWN} more`} onClick={() => setAll(true)}>
                {`+${contacts.length - CONTACTS_SHOWN} more`}
              </s-clickable-chip>
            ) : null}
            {all && contacts.length > CONTACTS_SHOWN ? <s-link onClick={() => setAll(false)}>Show less</s-link> : null}
          </s-stack>
        ) : (
          <span className="cd-sub">No contacts yet. Company contacts will show up here.</span>
        )}
      </SideRow>
    </SideBlock>
  );
}
