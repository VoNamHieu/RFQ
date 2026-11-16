import React, { useEffect, useState } from 'react';
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
// `onApplyLaterChange`, a checkbox says whether locations added later get it too
// (`applyLater`) at the companies picked (`laterLabel` / `laterDetails`: its text).
// `single`: one company only (a contract) —
// each company has a radio button instead, and picking one replaces the one before.
// With `needsLocation` (order limits), a company with no locations can't be picked.
export function SelectCompaniesModal({
  open,
  companies,
  tickedOf,
  onToggleCompany,
  onToggleLocation,
  onClose,
  applyLater = true,
  onApplyLaterChange,
  laterLabel = 'Automatically apply this pricing to locations added later',
  laterDetails = '',
  single = false,
  needsLocation = false,
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = query ? companies.filter((c) => `${c.name} ${c.contact} ${c.email}`.toLowerCase().includes(query)) : companies;
  return (
    <Modal open={open} onClose={onClose} heading={single ? 'Select company and locations' : 'Select companies and locations'}>
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
                      {single ? (
                        // Its own one-choice list (so the locations can sit under it), kept
                        // in step by remounting when it's picked or not.
                        <s-choice-list
                          key={`${c.id}-${ticked.length > 0}`}
                          label={`Select ${c.name}`}
                          labelAccessibilityVisibility="exclusive"
                          name={`select-company-${c.id}`}
                          onChange={(e) => {
                            if (e.currentTarget.values?.[0] === c.id && !ticked.length) onToggleCompany(c);
                          }}
                        >
                          <s-choice value={c.id} selected={ticked.length > 0} accessibilityLabel={`Select ${c.name}`} />
                        </s-choice-list>
                      ) : (
                        <s-checkbox
                          accessibilityLabel={`Select ${c.name}`}
                          checked={all}
                          indeterminate={!all && ticked.length > 0}
                          disabled={needsLocation && !c.locs.length}
                          onChange={(e) => {
                            const want = e.currentTarget.checked;
                            if (want === all) return; // a repeat event for the same click
                            onToggleCompany(c);
                            // Clicking a partly ticked company clears it (as before), so untick the box.
                            if (want && ticked.length) e.currentTarget.checked = false;
                          }}
                        />
                      )}
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
        {onApplyLaterChange && (
          // Pinned to the bottom of the modal, always in view; the list scrolls under it.
          <div className="qs-modal-pinned-foot">
            <s-checkbox
              label={laterLabel}
              details={laterDetails || undefined}
              checked={applyLater}
              onChange={(e) => onApplyLaterChange(e.currentTarget.checked)}
            />
          </div>
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
  const setTicked = (c, picked) => {
    const ids = [...new Set(picked)];
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

// The D2C "Customers" box: all / logged-in / non-logged-in customers, or specific
// customers or customer tags picked from a list. Shared by the pricing and order
// limit editors; `onSetId(id, on)` ticks or unticks one customer or tag.
export function CustomerTargetsBox({ db, target, ids, onTarget, onSetId, onSetIds, name = 'assignment-customer-target' }) {
  const customers = (db.customers || []).map((cu) => ({ id: cu.id, title: cu.name, subtitle: cu.email }));
  // Specific customers: a "Search customers" field opens the Select specific customers
  // modal; the ones picked show as chips under it (× takes one off).
  const [customerModal, setCustomerModal] = useState(false);
  const picked = customers.filter((cu) => ids.includes(cu.id));
  const tags = (db.tagPricing || []).map((t) => ({ id: t.id, title: t.name }));
  return (
    <s-box border="base" borderRadius="base" padding="base">
      <s-stack gap="small-200">
        <s-heading>Customers</s-heading>
        <s-choice-list
          label="Customers"
          labelAccessibilityVisibility="exclusive"
          name={name}
          onChange={(e) => {
            if (e.target !== e.currentTarget) return;
            const next = e.currentTarget.values?.[0];
            if (next) onTarget(next);
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
            <s-stack gap="small-200">
              {/* Opens on click / Enter, not on focus: closing the modal hands focus
                  back to this field, which would reopen it. */}
              <s-search-field
                label="Search customers"
                labelAccessibilityVisibility="exclusive"
                placeholder="Search customers"
                value=""
                onClick={() => setCustomerModal(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setCustomerModal(true);
                }}
              />
              {picked.length ? (
                <s-stack direction="inline" gap="small-300">
                  {picked.map((cu) => (
                    <s-clickable-chip key={cu.id} removable accessibilityLabel={`Remove ${cu.title}`} onRemove={() => onSetId(cu.id, false)}>
                      {cu.title}
                    </s-clickable-chip>
                  ))}
                </s-stack>
              ) : null}
            </s-stack>
          </s-box>
        ) : null}
        {target === 'tags' ? (
          <s-box paddingInlineStart="large">
            <InlineCheckList
              items={tags}
              selected={ids}
              onSet={onSetId}
              emptyLabel="No customer tags yet."
            />
          </s-box>
        ) : null}
      </s-stack>
      <SelectCustomersModal
        open={customerModal}
        customers={customers}
        selected={target === 'specific' ? ids : []}
        onClose={() => setCustomerModal(false)}
        onDone={(next) => {
          setCustomerModal(false);
          onSetIds(next);
        }}
      />
    </s-box>
  );
}

// "Select specific customers": search, a "Selecting N customers" box that ticks the
// page, then the customers ten a page (checkbox, avatar, "email - name") with a
// pager. Ticks are kept in the modal until Done; Cancel drops them.
const CUSTOMERS_PER_PAGE = 10;
function SelectCustomersModal({ open, customers, selected, onClose, onDone }) {
  const [draft, setDraft] = useState(selected);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  // Each opening starts from what's picked now.
  useEffect(() => {
    if (open) {
      setDraft(selected);
      setQ('');
      setPage(0);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = q.trim().toLowerCase();
  const shown = query ? customers.filter((cu) => `${cu.subtitle || ''} ${cu.title}`.toLowerCase().includes(query)) : customers;
  const count = Math.max(1, Math.ceil(shown.length / CUSTOMERS_PER_PAGE));
  const current = Math.min(page, count - 1);
  const rows = shown.slice(current * CUSTOMERS_PER_PAGE, (current + 1) * CUSTOMERS_PER_PAGE);
  const allOnPage = rows.length > 0 && rows.every((cu) => draft.includes(cu.id));
  const someOnPage = rows.some((cu) => draft.includes(cu.id));
  const set = (list, on) =>
    setDraft((cur) => (on ? [...new Set([...cur, ...list.map((cu) => cu.id)])] : cur.filter((id) => !list.some((cu) => cu.id === id))));

  return (
    <Modal open={open} onClose={onClose} heading="Select specific customers">
      <s-stack gap="none">
        <s-box padding="small" background="subdued">
          <s-search-field
            label="Search customers"
            labelAccessibilityVisibility="exclusive"
            placeholder="Search customers"
            value={q}
            autocomplete="off"
            onInput={(e) => {
              setQ(e.currentTarget.value);
              setPage(0);
            }}
          />
        </s-box>
        <s-box paddingInline="small" paddingBlock="small-200" background="subdued">
          <s-checkbox
            label={`Selecting ${draft.length} customer${draft.length === 1 ? '' : 's'}`}
            checked={allOnPage}
            indeterminate={!allOnPage && someOnPage}
            disabled={!rows.length}
            onChange={(e) => set(rows, e.currentTarget.checked)}
          />
        </s-box>
        <s-divider />
        {rows.length === 0 ? (
          <s-box padding="base">
            <div style={{ textAlign: 'center' }}>
              <s-text color="subdued">No customers match that search.</s-text>
            </div>
          </s-box>
        ) : (
          rows.map((cu, i) => (
            <React.Fragment key={cu.id}>
              {i > 0 ? <s-divider /> : null}
              <s-box paddingInline="small" paddingBlock="small-200">
                <s-grid gridTemplateColumns="auto auto minmax(0, 1fr)" gap="small" alignItems="center">
                  <s-checkbox
                    accessibilityLabel={`Select ${cu.title}`}
                    checked={draft.includes(cu.id)}
                    onChange={(e) => set([cu], e.currentTarget.checked)}
                  />
                  <s-avatar size="small" initials={initialsOf(cu.title).toUpperCase()} alt={cu.title} />
                  <s-text>{cu.subtitle ? `${cu.subtitle} - ${cu.title}` : cu.title}</s-text>
                </s-grid>
              </s-box>
            </React.Fragment>
          ))
        )}
        <s-divider />
        <s-box paddingBlockStart="small">
          <s-button-group gap="none" accessibilityLabel="Pagination">
            <s-button slot="secondary-actions" icon="chevron-left" accessibilityLabel="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} />
            <s-button slot="secondary-actions" icon="chevron-right" accessibilityLabel="Next page" disabled={current >= count - 1} onClick={() => setPage(current + 1)} />
          </s-button-group>
        </s-box>
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={() => onDone(draft)}>
        Done
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
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
            <CustomerTargetsBox
              db={db}
              target={target}
              ids={builder.assignmentTargetIds || []}
              onTarget={setTarget}
              onSetId={(id, on) => setId('assignmentTargetIds', id, on)}
              onSetIds={(list) => patch({ assignmentTargetIds: list })}
            />
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
