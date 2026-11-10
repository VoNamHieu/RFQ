import React, { useState, useEffect } from 'react';
import { useStore } from '../store.jsx';
import { policyStatus, policyUsage, policyUsageCount, companyBaseEntries, companyQuantityEntries, locationOnlyEntries, locationPricingEntries } from '../pricing.js';
import { Modal, IndexFiltersBar, useWcId } from '../../shared/wc.jsx';
import { isContractTerm } from '../agreements.js';
import { backActionFor, CdPageHead, StatusDot, CardFoot, rangeLabel } from '../components/companyLayout.jsx';
import basePricingArt from '../assets/base-pricing-empty.webp';
import quantityPricingArt from '../assets/quantity-pricing-empty.webp';

const AUDIENCE = [
  { id: 'all', label: 'All' },
  { id: 'b2b', label: 'Companies' },
  { id: 'd2c', label: 'Customers' },
];

const TYPE_CHOICES = [
  { label: 'All types', value: 'all' },
  { label: 'Base pricing', value: 'base' },
  { label: 'Quantity pricing', value: 'quantity' },
];
const STATUS_CHOICES = [
  { label: 'Any status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Inactive', value: 'inactive' },
];
const SORT_OPTIONS = [
  { label: 'Name', value: 'name', directionLabel: 'A–Z' },
  { label: 'Most assigned', value: 'assigned', directionLabel: 'Most first' },
];

const PAGE_SIZE = 10;

const PRICING_TYPES = [
  {
    kind: 'base',
    mode: 'add-base',
    image: basePricingArt,
    title: 'Base pricing',
    description: 'A price that covers the whole catalog, with optional rules and per-product overrides.',
  },
  {
    kind: 'quantity',
    mode: 'add-quantity',
    image: quantityPricingArt,
    title: 'Quantity pricing',
    description: 'Volume discounts that kick in above a quantity threshold, on selected products.',
  },
];

// Full-page "Select pricing type" step: pick a type card. Opened from the list's
// "Create pricing" action (then the editor), and from a company or location page's
// Add pricing ⊕ (then the pricing of that type to add); the back action returns.
export function PricingTypeChooser({ onBack, onPick, backLabel = 'Pricing settings', actionLabel = 'Create pricing' }) {
  // The company page's look: back on top, the title, then the two types as cards.
  return (
    <div className="cd-page">
      <CdPageHead title="Select pricing type" back={{ label: backLabel, onAction: onBack }} />
      <div className="cd-card-grid">
        {PRICING_TYPES.map((t) => (
          <div key={t.kind} className="cd-card">
            <div className="cd-card__body">
              <s-stack gap="base">
                <img src={t.image} alt="" style={{ display: 'block', height: 140, width: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }} />
                <div>
                  <h2 className="cd-section__title">{t.title}</h2>
                  <p className="cd-section__subtitle">{t.description}</p>
                </div>
                <s-stack direction="inline">
                  <s-button onClick={() => onPick(t.kind, t.mode)}>{actionLabel}</s-button>
                </s-stack>
              </s-stack>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PricingLibrary() {
  const { state, dispatch } = useStore();
  const [audience, setAudience] = useState('all');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  // App home's unassigned-pricing warning lands here filtered to Inactive.
  const [statusFilter, setStatusFilter] = useState(state.pricingStatus || 'all');
  // A company page's "View pricing library" lands here filtered to that company.
  const [companyFilter, setCompanyFilter] = useState(state.pricingCompany || 'all');
  // …and a location page's, to that location (`companyId::locationId`).
  const [locationFilter, setLocationFilter] = useState(state.pricingLocation || 'all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // App home's "Create pricing" lands here with the type chooser already open.
  const [chooserOpen, setChooserOpen] = useState(!!state.pricingChooser);
  const tipId = useWcId('pricing-row');
  useEffect(() => {
    if (state.pricingChooser || state.pricingStatus || state.pricingCompany || state.pricingLocation) {
      dispatch({ type: 'NAVIGATE', view: 'pricing', patch: { pricingChooser: false, pricingStatus: null, pricingCompany: null, pricingLocation: null } });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Jump back to the first page whenever the result set changes.
  useEffect(() => { setPage(0); }, [audience, search, kind, statusFilter, companyFilter, locationFilter, sort]);

  // "Create pricing" opens the type chooser first; picking a card opens the editor.
  if (chooserOpen) {
    return (
      <PricingTypeChooser
        onBack={() => setChooserOpen(false)}
        onPick={(kind, editorMode) => {
          setChooserOpen(false);
          dispatch({ type: 'OPEN_EDITOR', policy: null, kind, context: { mode: editorMode } });
        }}
      />
    );
  }

  const q = search.trim().toLowerCase();
  const statusOf = (p) => policyStatus(p, state.db);
  // The company filter: the pricing the company gets, on its own or on some of its
  // locations only (as its page's Pricing block lists it).
  const companies = state.db.companies || [];
  const filterCompany = companyFilter === 'all' ? null : companies.find((c) => c.id === companyFilter);
  const companyPolicyIds = filterCompany
    ? new Set(
        [
          ...companyBaseEntries(filterCompany, state.db.policies),
          ...companyQuantityEntries(filterCompany, state.db.policies),
          ...locationOnlyEntries(filterCompany, state.db.policies, 'base'),
          ...locationOnlyEntries(filterCompany, state.db.policies, 'quantity'),
        ].map((e) => e.policy.id),
      )
    : null;
  // The location filter: the pricing the location gets (its own list, or the company's
  // it follows), as its page's Pricing block lists it. With a company picked, only
  // that company's locations are offered.
  const locationChoices = companies
    .filter((c) => !filterCompany || c.id === filterCompany.id)
    .flatMap((c) =>
      (c.locations || [])
        .filter((l) => l.status !== 'Deleted')
        .map((l) => ({ label: filterCompany ? l.name : `${l.name} · ${c.name}`, value: `${c.id}::${l.id}`, company: c, location: l })),
    );
  const filterLocation = locationChoices.find((x) => x.value === locationFilter) || null;
  const locationPolicyIds = filterLocation
    ? (() => {
        const { bases, quantities } = locationPricingEntries(filterLocation.company, filterLocation.location, state.db.policies, { includeInactive: true });
        return new Set([...bases, ...quantities].map((e) => e.policy.id));
      })()
    : null;
  // A contract's own pricing is only in its contract (edited in the contract editor).
  let policies = state.db.policies.filter((p) => {
    if (isContractTerm(p)) return false;
    if (audience !== 'all' && p.audienceType !== audience) return false;
    if (kind !== 'all' && (p.priceKind === 'quantity' ? 'quantity' : 'base') !== kind) return false;
    if (statusFilter !== 'all' && statusOf(p).label.toLowerCase() !== statusFilter) return false;
    if (companyPolicyIds && !companyPolicyIds.has(p.id)) return false;
    if (locationPolicyIds && !locationPolicyIds.has(p.id)) return false;
    if (q && !p.name.toLowerCase().includes(q)) return false;
    return true;
  });
  policies = [...policies].sort((a, b) =>
    sort === 'assigned' ? policyUsageCount(b, state.db) - policyUsageCount(a, state.db) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name),
  );

  const total = policies.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const start = current * PAGE_SIZE;
  const pagePolicies = policies.slice(start, start + PAGE_SIZE);

  const openEditor = (p) => dispatch({ type: 'OPEN_EDITOR', policy: p, context: { mode: 'edit' } });

  // A row's own buttons (on / off, edit, delete) don't open it.
  const own = (e) => e.stopPropagation();
  const rows = pagePolicies.map((p) => {
    const st = statusOf(p);
    const isOff = p.status === 'Inactive';
    const id = `${tipId}-${p.id}`;
    return (
      // The row opens the editor; its name is the keyboard target (the click bubbles up).
      <tr key={p.id} className="cd-row-link" onClick={() => openEditor(p)}>
        <td>
          <button type="button" className="cd-link-button">
            {p.name}
          </button>
        </td>
        <td>{p.priceKind === 'quantity' ? 'Quantity pricing' : 'Base pricing'}</td>
        <td>{p.audienceType === 'b2b' ? 'Companies' : 'Customers'}</td>
        <td>
          <StatusDot tone={st.tone}>{st.label}</StatusDot>
        </td>
        <td className="cd-num">{p.priority ?? 0}</td>
        <td className="cd-actions cd-num" onClick={own}>
          <span className="cd-row-actions">
            <s-button
              icon={isOff ? 'toggle-off' : 'toggle-on'}
              variant="tertiary"
              accessibilityLabel={isOff ? 'Turn on' : 'Turn off'}
              interestFor={`${id}-toggle-tip`}
              onClick={() => dispatch({ type: 'TOGGLE_POLICY_STATUS', id: p.id })}
            />
            <s-tooltip id={`${id}-toggle-tip`}>{isOff ? 'Turn on' : 'Turn off'}</s-tooltip>
            <s-button
              icon="edit"
              variant="tertiary"
              accessibilityLabel="Edit pricing"
              interestFor={`${id}-edit-tip`}
              onClick={() => openEditor(p)}
            />
            <s-tooltip id={`${id}-edit-tip`}>Edit pricing</s-tooltip>
            <s-button
              icon="delete"
              variant="tertiary"
              tone="critical"
              accessibilityLabel="Delete pricing"
              interestFor={`${id}-delete-tip`}
              onClick={() => setConfirmDelete(p)}
            />
            <s-tooltip id={`${id}-delete-tip`}>Delete pricing</s-tooltip>
          </span>
        </td>
      </tr>
    );
  });

  const tabs = AUDIENCE.map((a) => ({ id: `aud-${a.id}`, content: a.label }));
  const selectedTab = Math.max(0, AUDIENCE.findIndex((a) => a.id === audience));

  // Opened from a company or location page: a back arrow there before the title.
  const back = backActionFor(state, dispatch, 'pricing');
  // The company page's look: a white page, the title with Create pricing, then the list
  // in a bordered card — tabs, search, filters and sort on top, a plain table, the pages.
  return (
    <div className="cd-page">
      <CdPageHead
        title="Pricing settings"
        back={back ? { label: state.backTo?.label || 'Back', onAction: back.onAction } : null}
        actions={
          <s-button variant="primary" onClick={() => setChooserOpen(true)}>
            Create pricing
          </s-button>
        }
      />

      <div className="cd-card">
        <div className="cd-card__filters">
          <IndexFiltersBar
            query={search}
            queryPlaceholder="Search pricing by name"
            onQueryChange={setSearch}
            tabs={tabs}
            selected={selectedTab}
            onSelect={(i) => setAudience(AUDIENCE[i].id)}
            sortOptions={SORT_OPTIONS}
            sortSelected={sort}
            onSort={setSort}
            filters={[
              { key: 'kind', label: 'Pricing type', choices: TYPE_CHOICES, value: kind, defaultValue: 'all' },
              { key: 'status', label: 'Status', choices: STATUS_CHOICES, value: statusFilter, defaultValue: 'all' },
              {
                key: 'company',
                label: 'Company',
                choices: [{ label: 'Any company', value: 'all' }, ...companies.map((c) => ({ label: c.name, value: c.id }))],
                value: companyFilter,
                defaultValue: 'all',
              },
              {
                key: 'location',
                label: 'Location',
                choices: [{ label: 'Any location', value: 'all' }, ...locationChoices.map(({ label, value }) => ({ label, value }))],
                value: filterLocation ? locationFilter : 'all',
                defaultValue: 'all',
              },
            ]}
            onFilterChange={(key, v) => {
              if (key === 'kind') setKind(v);
              else if (key === 'status') setStatusFilter(v);
              else if (key === 'location') setLocationFilter(v);
              else {
                setCompanyFilter(v);
                // A location of another company no longer fits.
                if (v !== 'all' && !locationFilter.startsWith(`${v}::`)) setLocationFilter('all');
              }
            }}
            onClearAll={() => {
              setKind('all');
              setStatusFilter('all');
              setCompanyFilter('all');
              setLocationFilter('all');
            }}
          />
        </div>
        {rows.length ? (
          <div className="cd-table-scroll">
            <table className="cd-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Pricing type</th>
                  <th>Assigned to</th>
                  <th>Status</th>
                  <th className="cd-num">Priority</th>
                  <th className="cd-actions">
                    <span className="cd-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        ) : (
          <div className="cd-card__empty">No pricing matches these filters.</div>
        )}
        <CardFoot current={current} count={pageCount} label={rangeLabel(start, pagePolicies.length, total)} onPage={setPage} />
      </div>

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} heading={`Delete ${confirmDelete.name}?`}>
          <s-paragraph>
            {`This deletes the pricing and unassigns it from ${policyUsage(confirmDelete, state.db)}. Buyers there fall back to their next pricing or the Shopify price.`}
          </s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              dispatch({ type: 'DELETE_POLICY', id: confirmDelete.id });
              setConfirmDelete(null);
            }}
          >
            Delete pricing
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmDelete(null)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </div>
  );
}
