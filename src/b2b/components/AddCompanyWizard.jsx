import React from 'react';
import { Modal, BlockStack, InlineStack, Box, Text, TextField, Divider, Banner, Icon, Avatar, Badge, Checkbox, RadioButton } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { shopifyCompanies } from '../data/directory.js';

// Add Shopify companies to B2B — one screen: tick one or more companies, then Add.
// The very first time (no company in the app yet) it picks just one, which lands
// on its Pricing tab to set up; after that several can be added at once. Each
// comes with all its locations, and contacts come with their location. A
// company added before with only some locations stays listed ("Added") so the
// rest can be added. "Automatically add new locations" makes locations created
// on the ticked companies in Shopify later join them too.

// Two-letter monogram for the company avatar (e.g. "Watson Co" → "Wa").
const initialsOf = (name) => {
  const clean = (name || '').trim();
  return clean ? clean[0].toUpperCase() + (clean[1] || '').toLowerCase() : '?';
};

// Keeps a click on a company row's checkbox/radio from also toggling the row.
const stop = (e) => e.stopPropagation();

export function AddCompanyWizard() {
  const { state, dispatch } = useStore();
  const ac = state.addCompany;
  if (!ac) return null;
  const patch = (p) => dispatch({ type: 'ADD_COMPANY_PATCH', patch: p });
  const close = () => dispatch({ type: 'CLOSE_ADD_COMPANY' });

  // Each Shopify company with the locations not in the app yet (matched by id or
  // name — seeded companies carry no Shopify id). Fully added ones are hidden.
  const rows = shopifyCompanies(state.shopifyNewLocations).map((shp) => {
    const linked = state.db.companies.find((c) => c.shopifyCompanyId === shp.id || c.name === shp.name) || null;
    const has = (l) => (linked?.locations || []).some((x) => x.id === l.id || x.name === l.name);
    return { shp, linked, remaining: (shp.locations || []).filter((l) => !has(l)) };
  });
  const available = rows.filter((r) => !r.linked || r.remaining.length > 0);
  const isEmpty = available.length === 0;
  const hiddenCount = rows.length - available.length;

  // Ticked companies (Shopify ids). First company: one only (radio).
  const single = state.db.companies.length === 0;
  const selected = ac.selected || [];
  const isSel = (r) => selected.includes(r.shp.id);
  const withAll = (list) => [...new Set([...selected, ...list.map((r) => r.shp.id)])];
  const withoutAll = (list) => selected.filter((id) => !list.some((r) => r.shp.id === id));
  const toggleCompany = (r) => patch({ selected: single ? [r.shp.id] : isSel(r) ? withoutAll([r]) : withAll([r]) });
  const chosen = available.filter(isSel);
  const nSel = chosen.length;

  const q = (ac.search || '').trim().toLowerCase();
  const filtered = q
    ? available.filter(({ shp }) =>
        [shp.name, ...(shp.locations || []).map((l) => l.name), ...(shp.contacts || []).map((c) => c.email)]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : available;
  const allFilteredSel = filtered.length > 0 && filtered.every(isSel);
  const someFilteredSel = filtered.some(isSel);
  const toggleAllCompanies = () => patch({ selected: allFilteredSel ? withoutAll(filtered) : withAll(filtered) });

  // Only adding locations to companies already in the app → count locations.
  const nLocs = chosen.reduce((n, r) => n + r.remaining.length, 0);
  const primaryLabel =
    nSel > 0 && chosen.every((r) => r.linked)
      ? `Add ${nLocs} location${nLocs === 1 ? '' : 's'}`
      : nSel > 1
        ? `Add ${nSel} companies`
        : 'Add company';

  return (
    <Modal
      open
      onClose={close}
      title={single ? 'Add company from Shopify' : 'Add companies from Shopify'}
      primaryAction={{ content: primaryLabel, onAction: () => dispatch({ type: 'ADD_COMPANY_CONFIRM' }), disabled: nSel === 0 }}
      secondaryActions={[{ content: 'Cancel', onAction: close }]}
    >
      <Modal.Section>
        {isEmpty ? (
          <Banner tone="info">Every Shopify company is already in the B2B app.</Banner>
        ) : (
          <BlockStack gap="400">
            {hiddenCount > 0 ? (
              <Banner tone="info">
                {`${hiddenCount} ${hiddenCount === 1 ? 'company' : 'companies'} already added ${hiddenCount === 1 ? 'is' : 'are'} hidden.`}
              </Banner>
            ) : null}
            <TextField
              label="Search"
              labelHidden
              placeholder="Search by company name"
              value={ac.search || ''}
              onChange={(v) => patch({ search: v })}
              prefix={<Icon source={SearchIcon} tone="subdued" />}
              autoComplete="off"
            />
            <div>
              <Box paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center">
                  {single ? null : filtered.length > 0 ? (
                    <Checkbox
                      label={nSel > 0 ? `${nSel} selected` : 'Select all'}
                      checked={allFilteredSel ? true : someFilteredSel ? 'indeterminate' : false}
                      onChange={toggleAllCompanies}
                    />
                  ) : (
                    <span />
                  )}
                  <Text as="span" tone="subdued" variant="bodySm">
                    {`Showing ${filtered.length} ${filtered.length === 1 ? 'company' : 'companies'}`}
                  </Text>
                </InlineStack>
              </Box>
              <Divider />
              {/* Only the list scrolls, so search, Select all and the auto-add
                  option below stay in view however many companies there are. It
                  shrinks on short screens: the rest of the modal takes ~480px. */}
              <div style={{ maxHeight: 'max(160px, min(360px, calc(100vh - 480px)))', overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                  <Box paddingBlockStart="300">
                    <Text as="p" tone="subdued">No Shopify company matches your search.</Text>
                  </Box>
                ) : (
                  filtered.map((r, idx) => {
                    const { shp, linked, remaining } = r;
                    const sel = isSel(r);
                    const main = (shp.contacts || [])[0] || null;
                    const nLoc = (shp.locations || []).length;
                    const nCon = (shp.contacts || []).length;
                    return (
                      <React.Fragment key={shp.id}>
                        {idx > 0 ? <Divider /> : null}
                        {/* The whole row picks the company. */}
                        <div onClick={() => toggleCompany(r)} style={{ cursor: 'pointer' }}>
                          <Box paddingBlock="300">
                            <InlineStack gap="300" blockAlign="center" wrap={false}>
                              <span onClick={stop}>
                                {single ? (
                                  <RadioButton label={`Select ${shp.name}`} labelHidden name="add-company" checked={sel} onChange={() => toggleCompany(r)} />
                                ) : (
                                  <Checkbox label={`Select ${shp.name}`} labelHidden checked={sel} onChange={() => toggleCompany(r)} />
                                )}
                              </span>
                              <Avatar size="md" initials={initialsOf(shp.name)} name={shp.name} />
                              <BlockStack gap="050">
                                <InlineStack gap="200" blockAlign="center">
                                  <Text as="span" variant="bodyMd" fontWeight="semibold">{shp.name}</Text>
                                  {linked ? <Badge>Added</Badge> : null}
                                </InlineStack>
                                {main ? (
                                  <Text as="span" tone="subdued" variant="bodySm">{`${main.name} · ${main.email}`}</Text>
                                ) : null}
                                <Text as="span" tone="subdued" variant="bodySm">
                                  {linked
                                    ? `${remaining.length} of ${nLoc} locations not added yet`
                                    : `${nLoc} location${nLoc === 1 ? '' : 's'} · ${nCon} contact${nCon === 1 ? '' : 's'}`}
                                </Text>
                              </BlockStack>
                            </InlineStack>
                          </Box>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
              <Divider />
            </div>
            <Checkbox
              label="Automatically add new locations"
              helpText="When a selected company gets a new location in Shopify, it's added here too and uses the company's pricing."
              checked={!!ac.autoAddLocations}
              onChange={(on) => patch({ autoAddLocations: on })}
            />
            <Text as="p" tone="subdued" variant="bodySm">
              {nSel > 1
                ? 'Each company comes with all its locations and their contacts. Set pricing from each company’s page.'
                : chosen[0]?.linked
                  ? `Adds the remaining locations, and their contacts, to ${chosen[0].shp.name}.`
                  : 'The company comes with all its locations and their contacts. You set its pricing next.'}
            </Text>
          </BlockStack>
        )}
      </Modal.Section>
    </Modal>
  );
}
