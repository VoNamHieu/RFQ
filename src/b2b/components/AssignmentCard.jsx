import React, { useState } from 'react';
import { Modal } from '../../shared/wc.jsx';

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
// "Customer tags" targets. `onSet(id, on)` ticks or unticks one item.
function InlineCheckList({ items, selected, onSet, searchable, placeholder, emptyLabel }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = query ? items.filter((it) => `${it.title} ${it.subtitle || ''}`.toLowerCase().includes(query)) : items;
  return (
    <s-stack gap="small-300">
      {searchable ? (
        <s-search-field
          label="Search"
          labelAccessibilityVisibility="exclusive"
          value={q}
          placeholder={placeholder || 'Search'}
          autocomplete="off"
          onInput={(e) => setQ(e.currentTarget.value)}
        />
      ) : null}
      <s-box border="base" borderRadius="base" overflow="hidden">
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {shown.length === 0 ? (
            <s-box padding="small">
              <div style={{ textAlign: 'center' }}>
                <s-text color="subdued" fontSize="small">
                  {emptyLabel || 'Nothing to show'}
                </s-text>
              </div>
            </s-box>
          ) : (
            shown.map((it, i) => (
              <React.Fragment key={it.id}>
                {i > 0 ? <s-divider /> : null}
                <s-box paddingInline="small" paddingBlock="small-200">
                  <s-checkbox
                    label={it.subtitle ? `${it.title} · ${it.subtitle}` : it.title}
                    checked={selected.includes(it.id)}
                    onChange={(e) => onSet(it.id, e.currentTarget.checked)}
                  />
                </s-box>
              </React.Fragment>
            ))
          )}
        </div>
      </s-box>
    </s-stack>
  );
}

// The "Select companies" modal: a searchable list of Shopify companies, each with
// a checkbox, avatar, primary contact + email, and location / contact counts. A
// ticked company with 2+ locations lists them underneath (all ticked) so the
// pricing can go to only some; ticking every location is the whole company. With
// `onApplyLaterChange`, a company picked on every location shows a checkbox for
// whether locations added later get it too (`applyLater`).
export function SelectCompaniesModal({ open, companies, tickedOf, onToggleCompany, onToggleLocation, onClose, applyLater = true, onApplyLaterChange }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = query ? companies.filter((c) => `${c.name} ${c.contact} ${c.email}`.toLowerCase().includes(query)) : companies;
  return (
    <Modal open={open} onClose={onClose} heading="Select companies and locations">
      <s-stack gap="small">
        <s-search-field
          label="Search"
          labelAccessibilityVisibility="exclusive"
          value={q}
          placeholder="Search companies in Shopify"
          autocomplete="off"
          onInput={(e) => setQ(e.currentTarget.value)}
        />
        <s-stack gap="none">
          {shown.length === 0 ? (
            <s-box padding="base">
              <div style={{ textAlign: 'center' }}>
                <s-text color="subdued">No companies match that search.</s-text>
              </div>
            </s-box>
          ) : (
            shown.map((c, i) => {
              const ticked = tickedOf(c);
              const all = c.locs.length ? ticked.length === c.locs.length : ticked.length > 0;
              return (
                <React.Fragment key={c.id}>
                  {i > 0 ? <s-divider /> : null}
                  <s-box paddingBlock="small">
                    <s-grid gridTemplateColumns="auto auto 1fr" gap="small" alignItems="center">
                      <s-checkbox
                        accessibilityLabel={`Select ${c.name}`}
                        checked={all}
                        indeterminate={!all && ticked.length > 0}
                        onChange={(e) => {
                          const want = e.currentTarget.checked;
                          if (want === all) return; // a repeat event for the same click
                          onToggleCompany(c);
                          // Clicking a partly ticked company clears it (as before), so untick the box.
                          if (want && ticked.length) e.currentTarget.checked = false;
                        }}
                      />
                      <s-avatar size="base" initials={initialsOf(c.name)} alt={c.name} />
                      <s-stack gap="small-500">
                        <s-text fontWeight="semibold">{c.name}</s-text>
                        {c.contact || c.email ? (
                          <s-text color="subdued" fontSize="small">
                            {[c.contact, c.email].filter(Boolean).join(' · ')}
                          </s-text>
                        ) : null}
                        <s-text color="subdued" fontSize="small">
                          {`${c.nLoc} location${c.nLoc === 1 ? '' : 's'} · ${c.nContacts} contact${c.nContacts === 1 ? '' : 's'}`}
                        </s-text>
                      </s-stack>
                    </s-grid>
                    {/* Its locations, lined up with the text (checkbox + gap + avatar + gap). */}
                    {ticked.length && c.locs.length > 1 ? (
                      <div style={{ paddingLeft: 68, paddingTop: 8 }}>
                        <s-stack gap="small-400">
                          {c.locs.map((l) => (
                            <s-checkbox
                              key={l.id}
                              label={l.name}
                              checked={ticked.includes(l.id)}
                              onChange={(e) => onToggleLocation(c, l.id, e.currentTarget.checked)}
                            />
                          ))}
                        </s-stack>
                      </div>
                    ) : null}
                  </s-box>
                </React.Fragment>
              );
            })
          )}
        </s-stack>
        {onApplyLaterChange && companies.some((c) => c.locs.length && tickedOf(c).length === c.locs.length) && (
          <>
            <s-divider />
            <s-checkbox
              label="Automatically apply this pricing to locations added later"
              details="This only applies to companies with “Automatically add new locations” turned on."
              checked={applyLater}
              onChange={(e) => onApplyLaterChange(e.currentTarget.checked)}
            />
          </>
        )}
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={onClose}>
        Done
      </s-button>
    </Modal>
  );
}

// Company and location picks for a "Select companies and locations" modal: a
// company pick covers every location (including ones added later); location
// picks are `companyId::locationId` keys. Shared by pricing assignment and order
// limits. `onChange({ companyIds, locationKeys })` gets the new picks.
export function companyPicks(db, companyIds, locationKeys, onChange) {
  const companies = (db.companies || []).map((c) => ({
    id: c.id,
    name: c.name,
    contact: c.mainContact || c.contacts?.[0]?.name || '',
    email: c.contacts?.[0]?.email || '',
    nLoc: (c.locations || []).length,
    nContacts: (c.contacts || []).length,
    locs: (c.locations || []).map((l) => ({ id: l.id, name: l.name })),
  }));
  const keyOf = (c, lid) => `${c.id}::${lid}`;
  // A company with no locations is ticked or not as a whole ('__company').
  const tickedOf = (c) => {
    if (!c.locs.length) return companyIds.includes(c.id) ? ['__company'] : [];
    return companyIds.includes(c.id) ? c.locs.map((l) => l.id) : c.locs.filter((l) => locationKeys.includes(keyOf(c, l.id))).map((l) => l.id);
  };
  // Set a company's ticked locations: all → a company pick; some → location picks.
  const setTicked = (c, ids) => {
    const all = c.locs.length ? ids.length === c.locs.length : ids.length > 0;
    const others = locationKeys.filter((k) => !k.startsWith(`${c.id}::`));
    onChange({
      companyIds: all ? [...new Set([...companyIds, c.id])] : companyIds.filter((x) => x !== c.id),
      locationKeys: all || !ids.length ? others : [...others, ...ids.map((lid) => keyOf(c, lid))],
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
  return { companies, tickedOf, setTicked, toggleCompany, toggleLocation, selectedCompanies, tagLabel };
}

export function AssignmentCard({ builder, patch, db, isNew, footer = null }) {
  const audience = builder.audienceType === 'd2c' ? 'd2c' : 'b2b';
  const target = builder.customerTarget && builder.customerTarget !== 'none' ? builder.customerTarget : 'all';
  const [companyModal, setCompanyModal] = useState(false);


  const setSide = (side) =>
    side === 'b2b'
      ? patch({ audienceType: 'b2b', customerTarget: 'none', assignmentTargetIds: [] })
      : patch({ audienceType: 'd2c', b2bCompanyIds: [], b2bLocationKeys: [], customerTarget: target });
  // Tick (on) or untick one id in a list field — repeat events leave it as is.
  const setId = (field, id, on) => {
    const cur = builder[field] || [];
    patch({ [field]: on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id) });
  };
  const setTarget = (t) =>
    patch({ customerTarget: t, assignmentTargetIds: t === 'specific' || t === 'tags' ? builder.assignmentTargetIds || [] : [] });

  const customers = (db.customers || []).map((cu) => ({ id: cu.id, title: cu.name, subtitle: cu.email }));
  const tags = (db.tagPricing || []).map((t) => ({ id: t.id, title: t.name }));

  const { companies, tickedOf, setTicked, toggleCompany, toggleLocation, selectedCompanies, tagLabel } = companyPicks(
    db,
    builder.b2bCompanyIds || [],
    builder.b2bLocationKeys || [],
    ({ companyIds, locationKeys }) => patch({ b2bCompanyIds: companyIds, b2bLocationKeys: locationKeys }),
  );

  // Segmented audience switch, full width with equal halves (see .wc-segmented).
  const side = (value, label) => (
    <button type="button" className="wc-plain-button wc-segmented__item" aria-pressed={audience === value} onClick={() => setSide(value)}>
      {label}
    </button>
  );

  return (
    <s-section heading="Who this pricing serves">
      <s-stack gap="small">
        <div className="wc-segmented" role="group" aria-label="Who this pricing serves">
          {side('b2b', 'Company-based B2B')}
          {side('d2c', 'D2C Wholesale')}
        </div>

        {audience === 'b2b' ? (
          <s-stack gap="small-200">
            <s-text color="subdued" fontSize="small">
              Only B2B companies get this pricing. Customers outside a company keep your Shopify prices.
            </s-text>
            {/* Opens on click / Enter, not on focus: closing the modal hands focus
                back to this field, which would reopen it. */}
            <s-search-field
              label="Search companies"
              labelAccessibilityVisibility="exclusive"
              placeholder="Search companies"
              value=""
              onClick={() => setCompanyModal(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setCompanyModal(true);
              }}
            />
            {selectedCompanies.length ? (
              <s-stack direction="inline" gap="small-300">
                {selectedCompanies.map((c) => (
                  <s-clickable-chip key={c.id} removable accessibilityLabel={`Remove ${tagLabel(c)}`} onRemove={() => setTicked(c, [])}>
                    {tagLabel(c)}
                  </s-clickable-chip>
                ))}
              </s-stack>
            ) : null}
            {footer}
          </s-stack>
        ) : (
          <s-stack gap="small-200">
            <s-text color="subdued" fontSize="small">
              B2B buyers are priced through their Company, so they are never covered here.
            </s-text>
            <s-box border="base" borderRadius="base" padding="base">
              <s-stack gap="small-200">
                <s-heading>Customers</s-heading>
                <s-choice-list
                  label="Customers"
                  labelAccessibilityVisibility="exclusive"
                  name="assignment-customer-target"
                  onChange={(e) => {
                    if (e.target !== e.currentTarget) return;
                    const next = e.currentTarget.values?.[0];
                    if (next) setTarget(next);
                  }}
                >
                  {CUSTOMER_TARGETS.map(([val, label]) => (
                    <s-choice key={val} value={val} selected={target === val}>
                      {label}
                    </s-choice>
                  ))}
                </s-choice-list>
                {target === 'specific' ? (
                  <s-box paddingInlineStart="large">
                    <InlineCheckList
                      items={customers}
                      selected={builder.assignmentTargetIds || []}
                      onSet={(id, on) => setId('assignmentTargetIds', id, on)}
                      searchable
                      placeholder="Search customers"
                      emptyLabel="No customers match that search."
                    />
                  </s-box>
                ) : null}
                {target === 'tags' ? (
                  <s-box paddingInlineStart="large">
                    <InlineCheckList
                      items={tags}
                      selected={builder.assignmentTargetIds || []}
                      onSet={(id, on) => setId('assignmentTargetIds', id, on)}
                      emptyLabel="No customer tags yet."
                    />
                  </s-box>
                ) : null}
              </s-stack>
            </s-box>
          </s-stack>
        )}
      </s-stack>

      <SelectCompaniesModal
        open={companyModal}
        companies={companies}
        tickedOf={tickedOf}
        onToggleCompany={toggleCompany}
        onToggleLocation={toggleLocation}
        onClose={() => setCompanyModal(false)}
        applyLater={builder.b2bApplyLater === true}
        onApplyLaterChange={(on) => patch({ b2bApplyLater: on })}
      />
    </s-section>
  );
}
