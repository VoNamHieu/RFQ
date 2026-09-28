import React from 'react';
import { Modal, BlockStack, InlineStack, Box, Text, TextField, Divider, Banner, Icon, Avatar, Badge, Checkbox } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/directory.js';

// Add a Shopify company to B2B — one screen: pick a company, tick which of its
// locations come with it (all by default), then Add. Contacts come with their
// location. A company added with only some locations stays listed ("Added") so
// the rest can be added later. Pricing isn't set here: adding lands on the
// company's Pricing tab, and a location's own pricing is set from its page.

// Two-letter monogram for the company avatar (e.g. "Watson Co" → "Wa").
const initialsOf = (name) => {
  const clean = (name || '').trim();
  return clean ? clean[0].toUpperCase() + (clean[1] || '').toLowerCase() : '?';
};

export function AddCompanyWizard() {
  const { state, dispatch } = useStore();
  const ac = state.addCompany;
  if (!ac) return null;
  const patch = (p) => dispatch({ type: 'ADD_COMPANY_PATCH', patch: p });
  const close = () => dispatch({ type: 'CLOSE_ADD_COMPANY' });

  // Each Shopify company with the locations not in the app yet (matched by id or
  // name — seeded companies carry no Shopify id). Fully added ones are hidden.
  const rows = Object.values(shopifyCompanyDirectory).map((shp) => {
    const linked = state.db.companies.find((c) => c.shopifyCompanyId === shp.id || c.name === shp.name) || null;
    const has = (l) => (linked?.locations || []).some((x) => x.id === l.id || x.name === l.name);
    return { shp, linked, remaining: (shp.locations || []).filter((l) => !has(l)) };
  });
  const available = rows.filter((r) => !r.linked || r.remaining.length > 0);
  const isEmpty = available.length === 0;
  const hiddenCount = rows.length - available.length;
  const chosen = available.find((r) => r.shp.id === ac.shopifyId) || null;
  const picked = chosen ? (ac.locationIds || []).filter((id) => chosen.remaining.some((l) => l.id === id)) : [];
  const toggleLocation = (id, on) => patch({ locationIds: on ? [...new Set([...picked, id])] : picked.filter((x) => x !== id) });

  const q = (ac.search || '').trim().toLowerCase();
  const filtered = q
    ? available.filter(({ shp }) =>
        [shp.name, ...(shp.locations || []).map((l) => l.name), ...(shp.contacts || []).map((c) => c.email)]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : available;

  const primaryLabel = chosen?.linked ? `Add ${picked.length} location${picked.length === 1 ? '' : 's'}` : 'Add company';

  return (
    <Modal
      open
      onClose={close}
      title="Add company from Shopify"
      primaryAction={{ content: primaryLabel, onAction: () => dispatch({ type: 'ADD_COMPANY_CONFIRM' }), disabled: !chosen || picked.length === 0 }}
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
                <Text as="span" tone="subdued" variant="bodySm">
                  {`Showing ${filtered.length} ${filtered.length === 1 ? 'company' : 'companies'}`}
                </Text>
              </Box>
              <Divider />
              {filtered.length === 0 ? (
                <Box paddingBlockStart="300">
                  <Text as="p" tone="subdued">No Shopify company matches your search.</Text>
                </Box>
              ) : (
                filtered.map(({ shp, linked, remaining }, idx) => {
                  const sel = chosen?.shp.id === shp.id;
                  const main = (shp.contacts || [])[0] || null;
                  const nLoc = (shp.locations || []).length;
                  const nCon = (shp.contacts || []).length;
                  return (
                    <React.Fragment key={shp.id}>
                      {idx > 0 ? <Divider /> : null}
                      <button
                        type="button"
                        onClick={() => patch(sel ? {} : { shopifyId: shp.id, locationIds: remaining.map((l) => l.id) })}
                        style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                      >
                        <Box paddingBlock="300">
                          <InlineStack gap="300" blockAlign="center" wrap={false}>
                            <Radio checked={sel} />
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
                      </button>
                      {/* Its locations to add (all ticked), lined up with the row's
                          text (radio 18 + gap 12 + avatar 32 + gap 12). */}
                      {sel && (remaining.length > 1 || linked) ? (
                        <div style={{ paddingLeft: 74, paddingBottom: 12 }}>
                          <Box borderWidth="025" borderColor="border" borderRadius="200">
                            {remaining.map((l, i) => (
                              <React.Fragment key={l.id}>
                                {i > 0 ? <Divider /> : null}
                                <Box paddingInline="300" paddingBlock="200">
                                  <Checkbox label={l.name} checked={picked.includes(l.id)} onChange={(on) => toggleLocation(l.id, on)} />
                                </Box>
                              </React.Fragment>
                            ))}
                          </Box>
                          {picked.length === 0 ? (
                            <Box paddingBlockStart="100">
                              <Text as="p" tone="critical" variant="bodySm">Select at least one location.</Text>
                            </Box>
                          ) : null}
                        </div>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
              <Divider />
            </div>
            <Text as="p" tone="subdued" variant="bodySm">
              {chosen?.linked
                ? `Adds the ticked locations, and their contacts, to ${chosen.shp.name}.`
                : 'The company comes with the ticked locations and their contacts. You set its pricing next.'}
            </Text>
          </BlockStack>
        )}
      </Modal.Section>
    </Modal>
  );
}

// Visual-only radio dot for the company rows (the row's <button> owns the click).
function Radio({ checked }) {
  const color = checked ? 'var(--p-color-input-border-active, #303030)' : 'var(--p-color-input-border, #8a8a8a)';
  return (
    <span
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        flex: '0 0 auto',
        boxSizing: 'border-box',
        borderRadius: '50%',
        border: `2px solid ${color}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} /> : null}
    </span>
  );
}
