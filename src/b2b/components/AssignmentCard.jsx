import React, { useState } from 'react';
import { Card, BlockStack, InlineStack, Box, Text, Button, ButtonGroup, Checkbox, RadioButton, TextField, Icon, Modal, Avatar, Tag } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';

// "Who this pricing serves" — a Company-based B2B / D2C Wholesale segmented
// switch. For B2B, a "Search companies" field opens a Select-companies modal where
// a company can be ticked whole or down to some of its locations; for D2C, a
// Customers card of targets (all / logged-in / non-logged-in / specific / tags).
// Writes builder.b2bCompanyIds / b2bLocationKeys and customerTarget /
// assignmentTargetIds; the store applies them to the db on save (see applyAssignment).
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
// a checkbox, avatar, primary contact + email, and location / contact counts. A
// ticked company with 2+ locations lists them underneath (all ticked) so the
// pricing can go to only some; ticking every location is the whole company.
function SelectCompaniesModal({ open, companies, tickedOf, onToggleCompany, onToggleLocation, onClose }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = query ? companies.filter((c) => `${c.name} ${c.contact} ${c.email}`.toLowerCase().includes(query)) : companies;
  return (
    <Modal open={open} onClose={onClose} title="Select companies and locations" primaryAction={{ content: 'Done', onAction: onClose }}>
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
              shown.map((c, i) => {
                const ticked = tickedOf(c);
                const all = c.locs.length ? ticked.length === c.locs.length : ticked.length > 0;
                return (
                <Box key={c.id} paddingBlock="300" borderBlockStartWidth={i === 0 ? '0' : '025'} borderColor="border">
                  <InlineStack gap="300" blockAlign="center" wrap={false}>
                    <Checkbox
                      checked={all ? true : ticked.length ? 'indeterminate' : false}
                      onChange={() => onToggleCompany(c)}
                      labelHidden
                      label={`Select ${c.name}`}
                    />
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
                  {/* Its locations, lined up with the text (checkbox 20 + gap 12 + avatar 32 + gap 12). */}
                  {ticked.length && c.locs.length > 1 ? (
                    <div style={{ paddingLeft: 76, paddingTop: 8 }}>
                      <BlockStack gap="100">
                        {c.locs.map((l) => (
                          <Checkbox
                            key={l.id}
                            label={l.name}
                            checked={ticked.includes(l.id)}
                            onChange={(on) => onToggleLocation(c, l.id, on)}
                          />
                        ))}
                      </BlockStack>
                    </div>
                  ) : null}
                </Box>
                );
              })
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
      : patch({ audienceType: 'd2c', b2bCompanyIds: [], b2bLocationKeys: [], customerTarget: target });
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
    locs: (c.locations || []).map((l) => ({ id: l.id, name: l.name })),
  }));
  const customers = (db.customers || []).map((cu) => ({ id: cu.id, title: cu.name, subtitle: cu.email }));
  const tags = (db.tagPricing || []).map((t) => ({ id: t.id, title: t.name }));

  // Company picks (every location) and location picks (`companyId::locationId`).
  const companyIds = builder.b2bCompanyIds || [];
  const locKeys = builder.b2bLocationKeys || [];
  const keyOf = (c, lid) => `${c.id}::${lid}`;
  // A company with no locations is ticked or not as a whole ('__company').
  const tickedOf = (c) => {
    if (!c.locs.length) return companyIds.includes(c.id) ? ['__company'] : [];
    return companyIds.includes(c.id) ? c.locs.map((l) => l.id) : c.locs.filter((l) => locKeys.includes(keyOf(c, l.id))).map((l) => l.id);
  };
  // Set a company's ticked locations: all → a company pick; some → location picks.
  const setTicked = (c, ids) => {
    const all = c.locs.length ? ids.length === c.locs.length : ids.length > 0;
    const others = locKeys.filter((k) => !k.startsWith(`${c.id}::`));
    patch({
      b2bCompanyIds: all ? [...new Set([...companyIds, c.id])] : companyIds.filter((x) => x !== c.id),
      b2bLocationKeys: all || !ids.length ? others : [...others, ...ids.map((lid) => keyOf(c, lid))],
    });
  };
  const toggleCompany = (c) =>
    setTicked(c, tickedOf(c).length ? [] : c.locs.length ? c.locs.map((l) => l.id) : ['__company']);
  const toggleLocation = (c, lid, on) => {
    const cur = tickedOf(c);
    setTicked(c, on ? [...new Set([...cur, lid])] : cur.filter((x) => x !== lid));
  };
  const selectedCompanies = companies.map((c) => ({ ...c, ticked: tickedOf(c) })).filter((c) => c.ticked.length);
  // Tag text: the company, or the company and its ticked locations.
  const tagLabel = (c) => {
    if (!c.locs.length || c.ticked.length === c.locs.length) return c.name;
    const names = c.locs.filter((l) => c.ticked.includes(l.id)).map((l) => l.name);
    return `${c.name} · ${names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')}`;
  };

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Who this pricing serves</Text>

        <ButtonGroup variant="segmented" fullWidth>
          <Button pressed={audience === 'b2b'} onClick={() => setSide('b2b')}>
            Company-based B2B
          </Button>
          <Button pressed={audience === 'd2c'} onClick={() => setSide('d2c')}>
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
                  <Tag key={c.id} onRemove={() => setTicked(c, [])}>{tagLabel(c)}</Tag>
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
        tickedOf={tickedOf}
        onToggleCompany={toggleCompany}
        onToggleLocation={toggleLocation}
        onClose={() => setCompanyModal(false)}
      />
    </Card>
  );
}
