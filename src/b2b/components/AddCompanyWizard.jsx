import React from 'react';
import { Modal } from '../../shared/wc.jsx';
import { useStore } from '../store.jsx';
import { shopifyCompanies } from '../data/directory.js';

// Add Shopify companies to B2B — one screen: tick one or more companies, then Add.
// The very first time (no company in the app yet) it picks just one; after that
// several can be added at once. Either way it ends on the company list, the added
// ones first. Each comes with all its locations, and contacts come with their
// location. A company added before with only some locations stays listed
// ("Added") so the rest can be added. "Automatically add new locations" (ticked
// by default) makes locations created on the ticked companies in Shopify later
// join them too.

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

  // Only adding locations to companies already in the app → count locations.
  const nLocs = chosen.reduce((n, r) => n + r.remaining.length, 0);
  const primaryLabel =
    nSel > 0 && chosen.every((r) => r.linked)
      ? `Add ${nLocs} location${nLocs === 1 ? '' : 's'}`
      : nSel > 1
        ? `Add ${nSel} companies`
        : 'Add company';

  return (
    <Modal onClose={close} heading={single ? 'Add company from Shopify' : 'Add companies from Shopify'}>
      {isEmpty ? (
        <s-banner tone="info">Every Shopify company is already in the B2B app.</s-banner>
      ) : (
        <s-stack gap="base">
          {hiddenCount > 0 ? (
            <s-banner tone="info">
              {`${hiddenCount} ${hiddenCount === 1 ? 'company' : 'companies'} already added ${hiddenCount === 1 ? 'is' : 'are'} hidden.`}
            </s-banner>
          ) : null}
          <s-search-field
            label="Search"
            labelAccessibilityVisibility="exclusive"
            placeholder="Search by company name"
            value={ac.search || ''}
            onInput={(e) => patch({ search: e.currentTarget.value })}
            autocomplete="off"
          />
          <div>
            <s-box paddingBlockEnd="small-200">
              <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small" alignItems="center">
                {single || filtered.length === 0 ? (
                  <span />
                ) : (
                  <s-checkbox
                    label={nSel > 0 ? `${nSel} selected` : 'Select all'}
                    checked={allFilteredSel}
                    indeterminate={someFilteredSel && !allFilteredSel}
                    onChange={(e) => patch({ selected: e.currentTarget.checked ? withAll(filtered) : withoutAll(filtered) })}
                  />
                )}
                <s-text color="subdued" fontSize="small">
                  {`Showing ${filtered.length} ${filtered.length === 1 ? 'company' : 'companies'}`}
                </s-text>
              </s-grid>
            </s-box>
            <s-divider />
            {/* Only the list scrolls, so search, Select all and the auto-add
                option below stay in view however many companies there are. It
                shrinks on short screens: the rest of the modal takes ~480px. */}
            <div style={{ maxHeight: 'max(160px, min(360px, calc(100vh - 480px)))', overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <s-box paddingBlockStart="small">
                  <s-paragraph color="subdued">No Shopify company matches your search.</s-paragraph>
                </s-box>
              ) : (
                filtered.map((r, idx) => {
                  const { shp, linked, remaining } = r;
                  const sel = isSel(r);
                  const main = (shp.contacts || [])[0] || null;
                  const nLoc = (shp.locations || []).length;
                  const nCon = (shp.contacts || []).length;
                  return (
                    <React.Fragment key={shp.id}>
                      {idx > 0 ? <s-divider /> : null}
                      {/* The whole row picks the company. */}
                      <button
                        type="button"
                        aria-pressed={sel}
                        aria-label={`Select ${shp.name}`}
                        onClick={() => toggleCompany(r)}
                        style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                      >
                        <s-box paddingBlock="small">
                          <s-grid gridTemplateColumns="auto auto minmax(0, 1fr)" gap="small" alignItems="center">
                            {single ? <Radio checked={sel} /> : <CheckMark checked={sel} />}
                            <s-avatar size="base" initials={initialsOf(shp.name)} alt={shp.name} />
                            <s-stack gap="small-500">
                              <s-stack direction="inline" gap="small-200" alignItems="center">
                                <s-text fontWeight="semibold">{shp.name}</s-text>
                                {linked ? <s-badge>Added</s-badge> : null}
                              </s-stack>
                              {main ? (
                                <s-paragraph color="subdued" fontSize="small">{`${main.name} · ${main.email}`}</s-paragraph>
                              ) : null}
                              <s-paragraph color="subdued" fontSize="small">
                                {linked
                                  ? `${remaining.length} of ${nLoc} locations not added yet`
                                  : `${nLoc} location${nLoc === 1 ? '' : 's'} · ${nCon} contact${nCon === 1 ? '' : 's'}`}
                              </s-paragraph>
                            </s-stack>
                          </s-grid>
                        </s-box>
                      </button>
                    </React.Fragment>
                  );
                })
              )}
            </div>
            <s-divider />
          </div>
          <s-checkbox
            label="Automatically add new locations"
            details="When a selected company gets a new location in Shopify, it's added here too and uses the company's pricing."
            checked={!!ac.autoAddLocations}
            onChange={(e) => patch({ autoAddLocations: e.currentTarget.checked })}
          />
          <s-paragraph color="subdued" fontSize="small">
            {nSel > 1
              ? 'Each company comes with all its locations and their contacts. Set pricing from each company’s page.'
              : chosen[0]?.linked
                ? `Adds the remaining locations, and their contacts, to ${chosen[0].shp.name}.`
                : 'The company comes with all its locations and their contacts.'}
          </s-paragraph>
        </s-stack>
      )}
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={nSel === 0}
        onClick={() => dispatch({ type: 'ADD_COMPANY_CONFIRM' })}
      >
        {primaryLabel}
      </s-button>
      <s-button slot="secondary-actions" onClick={close}>
        Cancel
      </s-button>
    </Modal>
  );
}

const inputBorder = (checked) => (checked ? 'var(--p-color-input-border-active, #303030)' : 'var(--p-color-input-border, #8a8a8a)');

// Visual-only radio dot for the company rows (the row's <button> owns the click).
function Radio({ checked }) {
  const color = inputBorder(checked);
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

// Visual-only checkbox for the company rows when several can be picked.
function CheckMark({ checked }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        flex: '0 0 auto',
        boxSizing: 'border-box',
        borderRadius: 4,
        border: checked ? 'none' : `2px solid ${inputBorder(false)}`,
        background: checked ? inputBorder(true) : 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? (
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <path fill="#fff" d="M14.03 6.97a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06l1.97 1.97 4.47-4.47a.75.75 0 0 1 1.06 0Z" />
        </svg>
      ) : null}
    </span>
  );
}
