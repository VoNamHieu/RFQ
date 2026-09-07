import React, { useState } from 'react';
import { Card, BlockStack, InlineStack, Box, Text, Button, ButtonGroup, Checkbox, RadioButton, TextField, Icon, Modal, Avatar, Tag } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';

// "Who this pricing serves" — a Company-based B2B / D2C Wholesale segmented
// switch. For B2B, a "Search companies" field opens a Select-companies modal; for
// D2C, a Customers card of targets (all / logged-in / non-logged-in / specific /
// tags). Writes builder.b2bCompanyIds and builder.customerTarget/assignmentTargetIds;
// the store applies them to the db on save (see applyAssignment).
const CUSTOMER_TARGETS = [
  ['all', 'All customers'],
  ['logged_in', 'Logged-in customers'],
  ['logged_out', 'Non logged-in customers'],
  ['specific', 'Specific customers'],
  ['tags', 'Customer tags'],
];

const initialsOf = (name) => (name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '?';

// Compact inline search + checkbox list for the D2C "Specific customers" /
// "Customer tags" targets.
function InlineCheckList({ items, selected, onToggle, searchable, placeholder, emptyLabel }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = query ? items.filter((it) => `${it.title} ${it.subtitle || ''}`.toLowerCase().includes(query)) : items;
  return (
    <BlockStack gap="150">
      {searchable ? (
        <TextField
          label="Search"
          labelHidden
          value={q}
          onChange={setQ}
          placeholder={placeholder || 'Search'}
          prefix={<Icon source={SearchIcon} tone="subdued" />}
          autoComplete="off"
          clearButton
          onClearButtonClick={() => setQ('')}
        />
      ) : null}
      <Box borderWidth="025" borderColor="border" borderRadius="200">
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {shown.length === 0 ? (
            <Box padding="300"><Text as="p" tone="subdued" alignment="center" variant="bodySm">{emptyLabel || 'Nothing to show'}</Text></Box>
          ) : (
            shown.map((it, i) => (
              <Box key={it.id} paddingInline="300" paddingBlock="200" borderBlockStartWidth={i === 0 ? '0' : '025'} borderColor="border">
                <Checkbox
                  checked={selected.includes(it.id)}
                  onChange={() => onToggle(it.id)}
                  label={it.subtitle ? `${it.title} · ${it.subtitle}` : it.title}
                />
              </Box>
            ))
          )}
        </div>
      </Box>
    </BlockStack>
  );
}

// The "Select companies" modal: a searchable list of Shopify companies, each with
// a checkbox, avatar, primary contact + email, and location / contact counts.
function SelectCompaniesModal({ open, companies, selected, onToggle, onClose }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = query ? companies.filter((c) => `${c.name} ${c.contact} ${c.email}`.toLowerCase().includes(query)) : companies;
  return (
    <Modal open={open} onClose={onClose} title="Select companies" primaryAction={{ content: 'Done', onAction: onClose }}>
      <Modal.Section>
        <BlockStack gap="300">
          <TextField
            label="Search"
            labelHidden
            value={q}
            onChange={setQ}
            placeholder="Search companies in Shopify"
            prefix={<Icon source={SearchIcon} tone="subdued" />}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setQ('')}
          />
          <BlockStack gap="0">
            {shown.length === 0 ? (
              <Box padding="400"><Text as="p" tone="subdued" alignment="center">No companies match that search.</Text></Box>
            ) : (
              shown.map((c, i) => (
                <Box key={c.id} paddingBlock="300" borderBlockStartWidth={i === 0 ? '0' : '025'} borderColor="border">
                  <InlineStack gap="300" blockAlign="center" wrap={false}>
                    <Checkbox checked={selected.includes(c.id)} onChange={() => onToggle(c.id)} labelHidden label={`Select ${c.name}`} />
                    <Avatar size="md" initials={initialsOf(c.name)} name={c.name} />
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">{c.name}</Text>
                      {c.contact || c.email ? (
                        <Text as="span" tone="subdued" variant="bodySm">{[c.contact, c.email].filter(Boolean).join(' · ')}</Text>
                      ) : null}
                      <Text as="span" tone="subdued" variant="bodySm">
                        {`${c.nLoc} location${c.nLoc === 1 ? '' : 's'} · ${c.nContacts} contact${c.nContacts === 1 ? '' : 's'}`}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>
              ))
            )}
          </BlockStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

export function AssignmentCard({ builder, patch, db, isNew }) {
  const audience = builder.audienceType === 'd2c' ? 'd2c' : 'b2b';
  const target = builder.customerTarget && builder.customerTarget !== 'none' ? builder.customerTarget : 'all';
  const [companyModal, setCompanyModal] = useState(false);

  const setSide = (side) =>
    side === 'b2b'
      ? patch({ audienceType: 'b2b', customerTarget: 'none', assignmentTargetIds: [] })
      : patch({ audienceType: 'd2c', b2bCompanyIds: [], customerTarget: target });
  const toggleId = (field, id) => {
    const cur = builder[field] || [];
    patch({ [field]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  const setTarget = (t) =>
    patch({ customerTarget: t, assignmentTargetIds: t === 'specific' || t === 'tags' ? builder.assignmentTargetIds || [] : [] });

  const companies = (db.companies || []).map((c) => ({
    id: c.id,
    name: c.name,
    contact: c.mainContact || c.contacts?.[0]?.name || '',
    email: c.contacts?.[0]?.email || '',
    nLoc: (c.locations || []).length,
    nContacts: (c.contacts || []).length,
  }));
  const customers = (db.customers || []).map((cu) => ({ id: cu.id, title: cu.name, subtitle: cu.email }));
  const tags = (db.tagPricing || []).map((t) => ({ id: t.id, title: t.name }));

  const selectedIds = builder.b2bCompanyIds || [];
  const selectedCompanies = companies.filter((c) => selectedIds.includes(c.id));

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Who this pricing serves</Text>

        <ButtonGroup variant="segmented" fullWidth>
          <Button pressed={audience === 'b2b'} disabled={!isNew && audience !== 'b2b'} onClick={() => setSide('b2b')}>
            Company-based B2B
          </Button>
          <Button pressed={audience === 'd2c'} disabled={!isNew && audience !== 'd2c'} onClick={() => setSide('d2c')}>
            D2C Wholesale
          </Button>
        </ButtonGroup>

        {audience === 'b2b' ? (
          <BlockStack gap="200">
            <Text as="span" tone="subdued" variant="bodySm">
              Only B2B companies get this pricing. Customers outside a company keep your Shopify prices.
            </Text>
            <Button icon={SearchIcon} textAlign="left" fullWidth onClick={() => setCompanyModal(true)}>
              Search companies
            </Button>
            {selectedCompanies.length ? (
              <InlineStack gap="150" wrap>
                {selectedCompanies.map((c) => (
                  <Tag key={c.id} onRemove={() => toggleId('b2bCompanyIds', c.id)}>{c.name}</Tag>
                ))}
              </InlineStack>
            ) : null}
          </BlockStack>
        ) : (
          <BlockStack gap="200">
            <Text as="span" tone="subdued" variant="bodySm">
              B2B buyers are priced through their Company, so they are never covered here.
            </Text>
            <Box borderWidth="025" borderColor="border" borderRadius="300" padding="400">
              <BlockStack gap="200">
                <Text as="h4" variant="headingSm">Customers</Text>
                <BlockStack gap="100">
                  {CUSTOMER_TARGETS.map(([val, label]) => (
                    <BlockStack key={val} gap="100">
                      <RadioButton label={label} checked={target === val} onChange={() => setTarget(val)} />
                      {val === 'specific' && target === 'specific' ? (
                        <Box paddingInlineStart="500">
                          <InlineCheckList
                            items={customers}
                            selected={builder.assignmentTargetIds || []}
                            onToggle={(id) => toggleId('assignmentTargetIds', id)}
                            searchable
                            placeholder="Search customers"
                            emptyLabel="No customers match that search."
                          />
                        </Box>
                      ) : null}
                      {val === 'tags' && target === 'tags' ? (
                        <Box paddingInlineStart="500">
                          <InlineCheckList
                            items={tags}
                            selected={builder.assignmentTargetIds || []}
                            onToggle={(id) => toggleId('assignmentTargetIds', id)}
                            emptyLabel="No customer tags yet."
                          />
                        </Box>
                      ) : null}
                    </BlockStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Box>
          </BlockStack>
        )}
      </BlockStack>

      <SelectCompaniesModal
        open={companyModal}
        companies={companies}
        selected={selectedIds}
        onToggle={(id) => toggleId('b2bCompanyIds', id)}
        onClose={() => setCompanyModal(false)}
      />
    </Card>
  );
}
