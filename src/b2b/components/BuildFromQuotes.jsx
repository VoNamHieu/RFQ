import React from 'react';
import { useStore } from '../store.jsx';
import { quoteToBasePricing } from '../dbHelpers.js';
import { companyBaseEntries, resolvedPriceFor, hasOwnSlot, slotIds } from '../pricing.js';
import { money } from '../format.js';
import { withVersion } from '../../shared/versions.js';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { Modal, MenuButton, Tip } from '../../shared/wc.jsx';
import emptyStateArt from '../assets/empty-state.png';

// The RFQ app lives at the site root; its default view is the quotes submission
// list. Keep the ?v= version param so the switch stays on the same prototype.
const rfqSubmissionsUrl = () => withVersion('/');
// The RFQ app's Shopify App Store listing — where a merchant without it goes to install.
const RFQ_APP_STORE_URL = 'https://apps.shopify.com/request-for-quote-by-omega';

// Prototype: show the dev toggles in production too (flip to import.meta.env.DEV to hide in prod).
const SHOW_DEV_TOOLS = true;

// Sort options for the product list (mirrors the RFQ product-picker header).
const SORT_OPTIONS = [
  { label: 'Product A–Z', value: 'title-asc' },
  { label: 'Product Z–A', value: 'title-desc' },
  { label: 'Quoted: low to high', value: 'quoted-asc' },
  { label: 'Quoted: high to low', value: 'quoted-desc' },
];

// A company's Deal-Closed quotes — all, or only one location's (by name, as
// quotes store it).
const closedQuotesOf = (company, db, locationName) =>
  (db.quotes || []).filter(
    (q) => q.company === company.id && q.status === 'Deal Closed' && (!locationName || q.location === locationName),
  );

// Proposed base prices from closed quotes (spec §5.4): most recent closed quote
// wins per SKU.
function rowsFromQuotes(company, db, locationName) {
  const closed = closedQuotesOf(company, db, locationName);
  closed.sort((a, b) => (a.updated || a.created || '').localeCompare(b.updated || b.created || ''));
  const map = {};
  closed.forEach((q) =>
    (q.lines || []).forEach((l) => {
      if (l.quoted != null) map[l.sku] = { sku: l.sku, quoted: l.quoted, proposed: l.quoted, from: q.id, location: q.location };
    }),
  );
  return Object.values(map);
}

// Open from the company page: every location's closed quotes to start with; the
// merchant can narrow to one location ("Quotes from"). Adds to the company's first
// base pricing by default.
export function openBuildFromQuotes(dispatch, company, db) {
  const rows = rowsFromQuotes(company, db, null);
  dispatch({ type: 'OPEN_BUILD_QUOTES', payload: { companyId: company.id, rows, source: null, dest: companyBaseEntries(company, db.policies)[0]?.policy.id || '__new__' } });
}

// "Turn into pricing" from a single quote: just its priced lines; its location is
// the source (and the default location for a new pricing).
export function openBuildFromQuote(dispatch, company, db, quote) {
  const rows = (quote.lines || [])
    .filter((l) => l.quoted != null)
    .map((l) => ({ sku: l.sku, quoted: l.quoted, proposed: l.quoted, from: quote.id, location: quote.location }));
  dispatch({
    type: 'OPEN_BUILD_QUOTES',
    payload: { companyId: company.id, rows, quoteId: quote.id, source: quote.location || null, dest: companyBaseEntries(company, db.policies)[0]?.policy.id || '__new__' },
  });
}

export function BuildFromQuotes() {
  const { state, dispatch } = useStore();
  const bq = state.buildQuotes;
  // Which products are ticked (included in the pricing) — seeded to all rows, and
  // reset whenever a new build session opens. Search/sort reset alongside it.
  const [selected, setSelected] = React.useState(() => new Set());
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState('title-asc');
  React.useEffect(() => {
    setSelected(new Set((state.buildQuotes?.rows || []).map((r) => r.sku)));
    setQuery('');
    setSort('title-asc');
  }, [!!state.buildQuotes, state.buildQuotes?.companyId, state.buildQuotes?.source]);
  if (!bq) return null;

  const company = state.db.companies.find((c) => c.id === bq.companyId);
  const locations = company?.locations || [];
  const patchBq = (patch) => dispatch({ type: 'BUILD_QUOTES_PATCH', patch });
  // "Quotes from": all locations, or one — picking one rebuilds the rows from its
  // quotes (and the Current column shows what it pays). Fixed from a single quote.
  const sourceLoc = bq.source ? locations.find((l) => l.name === bq.source) || null : null;
  const pickSource = locations.length > 1 && !bq.quoteId;
  const setSource = (name) => {
    const loc = locations.find((l) => l.name === name) || null;
    patchBq({ source: loc ? loc.name : null, rows: rowsFromQuotes(company, state.db, loc ? loc.name : null) });
  };
  // "Add to": an existing pricing used by this company (updated wherever it's
  // assigned), or a new one — created in the pricing editor, whose "Who this
  // pricing serves" picks the company's locations (seeded with the source location).
  const isNew = bq.dest === '__new__';
  const scopeIds = sourceLoc && locations.length > 1 ? [sourceLoc.id] : null;
  const products = state.db.products;
  const productOf = (sku) => products.find((p) => p.sku === sku);
  const skuTitle = (sku) => productOf(sku)?.title || sku;

  const patchRow = (sku, patch) => {
    const rows = bq.rows.map((r) => (r.sku === sku ? { ...r, ...patch } : r));
    dispatch({ type: 'BUILD_QUOTES_PATCH', patch: { rows } });
  };

  // Base pricings this company uses — its own, then any a location keeps on its
  // own list (those labelled with the location). "Create a new base pricing" is
  // the FIRST option so it's easy to find however many pricings there are.
  const destPolicy = !isNew ? state.db.policies.find((p) => p.id === bq.dest) || null : null;
  // Other companies using the chosen pricing (on their company list or a location's
  // own) — the quote prices would reach them too, so that's worth a warning; within
  // this company a hint under the field is enough.
  // Where a pricing is assigned, per company: on the company (all its locations)
  // and/or on some locations' own lists.
  const assignmentsOf = (pid) =>
    state.db.companies
      .map((c) => ({
        company: c,
        onCompany: slotIds(c, 'base').includes(pid),
        locations: (c.locations || []).filter((l) => hasOwnSlot(l, 'base') && slotIds(l, 'base').includes(pid)),
      }))
      .filter((a) => a.onCompany || a.locations.length);
  const otherCompanies = destPolicy ? assignmentsOf(destPolicy.id).filter((a) => a.company.id !== company.id).map((a) => a.company) : [];
  // This company's locations that get the chosen pricing (their own list, or the
  // company's when they follow it) — named in the hint under "Add to".
  const gettingIt = destPolicy
    ? locations.filter((l) => (hasOwnSlot(l, 'base') ? slotIds(l, 'base') : slotIds(company, 'base')).includes(destPolicy.id))
    : [];
  const joinNames = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
  const destHint = !destPolicy
    ? undefined
    : locations.length > 1 && gettingIt.length === locations.length
      ? `Adds these prices to ${destPolicy.name}, so every location of ${company.name} gets them.`
      : gettingIt.length
        ? `Adds these prices to ${destPolicy.name}, so ${joinNames(gettingIt.map((l) => l.name))} ${gettingIt.length === 1 ? 'gets' : 'get'} them.`
        : `Adds these prices to ${destPolicy.name}.`;
  const companyPricings = [];
  const addUse = (policy, where) => {
    const hit = companyPricings.find((x) => x.policy.id === policy.id);
    if (hit) hit.where.add(where);
    else companyPricings.push({ policy, where: new Set([where]) });
  };
  companyBaseEntries(company, state.db.policies).forEach((e) => addUse(e.policy, 'company'));
  locations.forEach((l) => hasOwnSlot(l, 'base') && companyBaseEntries(l, state.db.policies).forEach((e) => addUse(e.policy, l.name)));
  // Each option names who it's assigned to: "Multiple companies" (2+ companies, even
  // if one has it on a single location); a single location → "Location · Company";
  // otherwise the company.
  const assignedLabel = (pid) => {
    const as = assignmentsOf(pid);
    if (as.length > 1) return 'Multiple companies';
    const a = as[0];
    if (!a) return company.name;
    return !a.onCompany && a.locations.length === 1 ? `${a.locations[0].name} · ${a.company.name}` : a.company.name;
  };
  const destOptions = [
    { label: 'Create a new base pricing…', value: '__new__' },
    ...companyPricings.map(({ policy }) => ({ label: `${policy.name} · ${assignedLabel(policy.id)}`, value: policy.id })),
  ];
  // Closed quotes come from the RFQ app; without it there is nothing to build from.
  const rfqInstalled = !!state.db.rfqAppInstalled;
  const isEmpty = !rfqInstalled || bq.rows.length === 0;

  // Search + sort the rows for display. Selection is keyed by SKU so it survives
  // filtering/re-ordering.
  const q = query.trim().toLowerCase();
  const filtered = q
    ? bq.rows.filter((r) => `${skuTitle(r.sku)} ${r.sku}`.toLowerCase().includes(q))
    : bq.rows;
  const shown = !rfqInstalled ? [] : [...filtered].sort((a, b) => {
    switch (sort) {
      case 'title-desc': return skuTitle(b.sku).localeCompare(skuTitle(a.sku));
      case 'quoted-asc': return (Number(a.quoted) || 0) - (Number(b.quoted) || 0);
      case 'quoted-desc': return (Number(b.quoted) || 0) - (Number(a.quoted) || 0);
      default: return skuTitle(a.sku).localeCompare(skuTitle(b.sku));
    }
  });

  const selectedCount = bq.rows.filter((r) => selected.has(r.sku)).length;
  const selectedShown = shown.filter((r) => selected.has(r.sku)).length;
  const allShownSelected = shown.length > 0 && selectedShown === shown.length;
  const canSave = bq.rows.some((r) => selected.has(r.sku) && Number(r.proposed) > 0);

  // Leading checkbox column (Polaris React's IndexTable selection): the header box
  // ticks / clears every shown row, a row's box sets that row. Both set the state
  // from the box's checked value, so a repeated change event is harmless.
  const setShownSelected = (on) => {
    setSelected((prev) => {
      const next = new Set(prev);
      shown.forEach((r) => (on ? next.add(r.sku) : next.delete(r.sku)));
      return next;
    });
  };
  const setRowSelected = (sku, on) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(sku);
      else next.delete(sku);
      return next;
    });
  };

  const onSave = () => {
    const chosen = bq.rows.filter((r) => selected.has(r.sku) && Number(r.proposed) > 0);
    if (bq.dest === '__new__') {
      const adjustments = {};
      chosen.forEach((r) => {
        adjustments[r.sku] = { rule: 'set', valueType: 'amount', value: Number(r.proposed) };
      });
      const only = Array.isArray(scopeIds) && scopeIds.length === 1 ? locations.find((l) => l.id === scopeIds[0]) : null;
      // Same shape as the RFQ handoff's quote pricing: scoped to the quoted products
      // at priority 1, so it wins for those products (a scoped pricing beats an
      // all-products one on a tie) and leaves every other product to existing pricing.
      const builder = quoteToBasePricing(`${company.name}${only ? ` · ${only.name}` : ''} from closed quotes`, 1, adjustments);
      // The editor's "Who this pricing serves" shows the company's locations, set
      // to the ones picked here.
      dispatch({ type: 'CLOSE_BUILD_QUOTES' });
      dispatch({ type: 'OPEN_EDITOR', policy: builder, context: { mode: 'add-base', companyId: company.id, locationIds: scopeIds } });
    } else {
      // Adds into the chosen pricing as is — everywhere it's assigned (see the note).
      dispatch({ type: 'APPLY_BUILD_QUOTES', companyId: company.id, dest: bq.dest, rows: chosen, updateShared: true });
    }
  };

  // Estimated cost ≈ 60% of the quoted price (no real cost on the product);
  // margin tracks the editable base price, matching the Save-to-B2B modal.
  const rowMarkup = shown.map((r) => {
    const product = productOf(r.sku);
    const shopify = product?.list;
    const current = product ? resolvedPriceFor(company, product, state.db.policies, undefined, sourceLoc) : null;
    const cost = Math.round((Number(r.quoted) || 0) * 0.6);
    const proposed = Number(r.proposed) || 0;
    const margin = proposed ? Math.round(((proposed - cost) / proposed) * 100) : 0;
    const belowCost = proposed > 0 && proposed < cost;
    return (
      <s-table-row key={r.sku}>
        <s-table-cell>
          <s-checkbox
            accessibilityLabel={`Select ${skuTitle(r.sku)}`}
            checked={selected.has(r.sku)}
            onChange={(e) => setRowSelected(r.sku, e.currentTarget.checked)}
          />
        </s-table-cell>
        <s-table-cell>
          <s-stack gap="small-500">
            <s-text fontWeight="medium">{skuTitle(r.sku)}</s-text>
            <s-text color="subdued" fontSize="small">{r.sku}</s-text>
          </s-stack>
        </s-table-cell>
        <s-table-cell>{shopify != null ? money(shopify) : '—'}</s-table-cell>
        <s-table-cell><s-text fontWeight="semibold">{money(r.quoted)}</s-text></s-table-cell>
        <s-table-cell>
          <s-text color={current == null ? 'subdued' : undefined}>{current != null ? money(current) : '—'}</s-text>
        </s-table-cell>
        <s-table-cell>
          <div style={{ width: 110 }}>
            <s-number-field
              label="Price to save"
              labelAccessibilityVisibility="exclusive"
              min={0}
              prefix="$"
              value={String(r.proposed ?? '')}
              onInput={(e) => patchRow(r.sku, { proposed: Number(e.currentTarget.value) })}
              autocomplete="off"
            />
          </div>
        </s-table-cell>
        <s-table-cell>
          <s-text tone={belowCost ? 'critical' : undefined}>{`${margin}%${belowCost ? ' · below cost' : ''}`}</s-text>
        </s-table-cell>
        <s-table-cell>
          <s-link
            onClick={() => {
              // Close this modal and open the source quote in the B2B app.
              dispatch({ type: 'CLOSE_BUILD_QUOTES' });
              dispatch({ type: 'OPEN_QUOTE', id: r.from });
            }}
          >{`from #${r.from}${!bq.source && locations.length > 1 && r.location ? ` · ${r.location}` : ''}`}</s-link>
        </s-table-cell>
      </s-table-row>
    );
  });

  // "Quotes from" menu: every location with its closed-quote count (the button
  // shows the current one).
  const sourceItems = [
    { content: `All locations (${closedQuotesOf(company, state.db, null).length})`, onAction: () => setSource('') },
    ...locations.map((l) => ({
      content: `${l.name} (${closedQuotesOf(company, state.db, l.name).length})`,
      onAction: () => setSource(l.name),
    })),
  ];

  return (
    <Modal onClose={() => dispatch({ type: 'CLOSE_BUILD_QUOTES' })} heading="Build pricing from closed quotes" size="large">
      <s-stack gap="small">
        {/* The dev toggle sat next to the title; s-modal's heading is text only. */}
        {SHOW_DEV_TOOLS ? (
          <DevToggle on={!rfqInstalled} onToggle={() => dispatch({ type: 'SET_RFQ_INSTALLED', installed: !rfqInstalled })} />
        ) : null}

        {/* "Quotes from" — a small filter pill (secondary button, icon + chevron,
            like the Analytics date pickers); the menu lists every location with its
            closed-quote count. */}
        {pickSource && rfqInstalled ? (
          <s-stack gap="small-400">
            <s-text>Quotes from</s-text>
            <s-stack direction="inline">
              <MenuButton icon="location" items={sourceItems}>
                {`${bq.source || 'All locations'} (${closedQuotesOf(company, state.db, bq.source).length})`}
              </MenuButton>
            </s-stack>
          </s-stack>
        ) : null}

        {!isEmpty && (
          <s-paragraph color="subdued" fontSize="small">
            {bq.quoteId
              ? `Prices from quote #${bq.quoteId}${bq.source ? ` (${bq.source})` : ''}. Tick the ones to include, edit the price, then add them to a base pricing.`
              : `Prices come from each product’s most recently closed quote${bq.source ? ` at ${bq.source}` : ''}. Tick the ones to include, edit the price, then add them to a base pricing.`}
          </s-paragraph>
        )}

        {!isEmpty && (
          <s-grid gridTemplateColumns="minmax(0, 1fr) 200px" gap="small-200" alignItems="center">
            <s-search-field
              label="Search products"
              labelAccessibilityVisibility="exclusive"
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search by product or SKU"
              autocomplete="off"
            />
            <s-select label="Sort by" labelAccessibilityVisibility="exclusive" value={sort} onChange={(e) => setSort(e.currentTarget.value)}>
              {SORT_OPTIONS.map((o) => (
                <s-option key={o.value} value={o.value}>{o.label}</s-option>
              ))}
            </s-select>
          </s-grid>
        )}

        <s-box border="base" borderRadius="base" overflow="hidden">
          {/* No rows to show (none from closed quotes, the RFQ app missing, or a search
              that matches nothing): the table's empty state. */}
          {shown.length === 0 ? (
            rfqInstalled ? (
              <EmptyBlock
                image={emptyStateArt}
                imageAlt=""
                heading="No products to add"
                action={{ content: 'Open RFQ app', onAction: () => { window.location.href = rfqSubmissionsUrl(); } }}
              >
                No products from closed quotes are available for this company. Check your quote statuses in the RFQ app.
              </EmptyBlock>
            ) : (
              <EmptyBlock
                image={emptyStateArt}
                imageAlt=""
                heading="Install O:Request a Quote"
                action={{ content: 'Install app', onAction: () => window.open(RFQ_APP_STORE_URL, '_blank', 'noopener') }}
              >
                Closed quotes come from the O:Request a Quote app. Install it to collect quote requests and turn agreed prices into B2B pricing.
              </EmptyBlock>
            )
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <s-table>
                <s-table-header-row>
                  <s-table-header listSlot="inline">
                    <s-checkbox
                      accessibilityLabel="Select all shown products"
                      checked={allShownSelected}
                      indeterminate={selectedShown > 0 && !allShownSelected}
                      onChange={(e) => setShownSelected(e.currentTarget.checked)}
                    />
                  </s-table-header>
                  <s-table-header listSlot="primary">
                    {selectedShown ? `${selectedShown} selected` : 'Product'}
                  </s-table-header>
                  <s-table-header listSlot="labeled" format="currency">Shopify</s-table-header>
                  <s-table-header listSlot="labeled" format="currency">Quoted</s-table-header>
                  <s-table-header listSlot="labeled" format="currency">
                    <Tip content={`The price ${sourceLoc ? sourceLoc.name : 'this company'} pays now, from its current B2B pricing. “—” means no B2B price is set yet.`}>
                      Current
                    </Tip>
                  </s-table-header>
                  <s-table-header listSlot="labeled">
                    <Tip content="Saved as this product’s base price in the selected pricing. Defaults to the quoted price — edit if needed.">
                      Price to save
                    </Tip>
                  </s-table-header>
                  <s-table-header listSlot="labeled" format="numeric">Margin</s-table-header>
                  <s-table-header listSlot="labeled">Source</s-table-header>
                </s-table-header-row>
                <s-table-body>{rowMarkup}</s-table-body>
              </s-table>
            </div>
          )}
        </s-box>

        {!isEmpty && selectedCount === 0 && (
          <s-paragraph tone="critical" fontSize="small">
            Select at least one product to build pricing.
          </s-paragraph>
        )}

        {/* Where the prices go: an existing pricing (updated wherever it's assigned)
            or a new one — its locations are picked in the pricing editor. */}
        {!isEmpty && (
          <>
            <s-divider />
            <s-select
              label="Add to"
              value={bq.dest}
              onChange={(e) => patchBq({ dest: e.currentTarget.value })}
              details={!otherCompanies.length ? destHint : undefined}
            >
              {destOptions.map((o) => (
                <s-option key={o.value} value={o.value}>{o.label}</s-option>
              ))}
            </s-select>
            {otherCompanies.length ? (
              <s-banner tone="warning">
                {`“${destPolicy.name}” is also assigned to ${otherCompanies.length} other compan${otherCompanies.length === 1 ? 'y' : 'ies'}, so they’ll get these quote prices too. To use them only for ${company.name} or its location, pick a pricing assigned only to it, or create a new one.`}
              </s-banner>
            ) : null}
          </>
        )}
      </s-stack>
      <s-button slot="primary-action" variant="primary" disabled={!canSave} onClick={onSave}>
        {bq.dest === '__new__' ? 'Create base pricing' : 'Add prices'}
      </s-button>
      <s-button slot="secondary-actions" onClick={() => dispatch({ type: 'CLOSE_BUILD_QUOTES' })}>
        Cancel
      </s-button>
    </Modal>
  );
}

// Dev-only toggle in the modal header: preview the modal as a merchant who hasn't
// installed the RFQ app. The "no closed quotes" case needs no toggle — open it on a
// company without any.
function DevToggle({ on, onToggle }) {
  return (
    <s-stack direction="inline" gap="small-300" alignItems="center">
      <s-badge tone="info">Dev</s-badge>
      <s-press-button pressed={on} onClick={onToggle}>
        {on ? 'Show installed' : 'Preview not installed'}
      </s-press-button>
    </s-stack>
  );
}
