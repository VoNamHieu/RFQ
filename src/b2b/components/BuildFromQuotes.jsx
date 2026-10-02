import React from 'react';
import {
  Modal,
  BlockStack,
  InlineStack,
  Box,
  Text,
  Select,
  TextField,
  IndexTable,
  Divider,
  Link,
  Icon,
  Badge,
  Button,
  Banner,
  Popover,
  ActionList,
} from '@shopify/polaris';
import { SearchIcon, LocationIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { quoteToBasePricing } from '../dbHelpers.js';
import { companyBaseEntries, resolvedPriceFor, hasOwnSlot, slotIds } from '../pricing.js';
import { money } from '../format.js';
import { activeVersion } from '../../shared/versions.js';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import emptyStateArt from '../assets/empty-state.png';

// The RFQ app lives at the site root; its default view is the quotes submission
// list. Keep the ?v= version param so the switch stays on the same prototype.
const rfqSubmissionsUrl = () => (activeVersion() === 'latest' ? '/' : `/?v=${activeVersion()}`);
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
  const [sourceOpen, setSourceOpen] = React.useState(false);
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

  const onSelectionChange = (selectionType, isSelecting, selection) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const apply = (sku) => (isSelecting ? next.add(sku) : next.delete(sku));
      if (selectionType === 'single') {
        apply(selection);
      } else if (selectionType === 'range' && Array.isArray(selection)) {
        const [s, e] = selection;
        for (let k = s; k <= e; k += 1) if (shown[k]) apply(shown[k].sku);
      } else {
        // 'page' | 'all'
        shown.forEach((r) => apply(r.sku));
      }
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
  const rowMarkup = shown.map((r, i) => {
    const product = productOf(r.sku);
    const shopify = product?.list;
    const current = product ? resolvedPriceFor(company, product, state.db.policies, undefined, sourceLoc) : null;
    const cost = Math.round((Number(r.quoted) || 0) * 0.6);
    const proposed = Number(r.proposed) || 0;
    const margin = proposed ? Math.round(((proposed - cost) / proposed) * 100) : 0;
    const belowCost = proposed > 0 && proposed < cost;
    return (
      <IndexTable.Row id={r.sku} key={r.sku} position={i} selected={selected.has(r.sku)}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="medium">{skuTitle(r.sku)}</Text>
            <Text as="span" tone="subdued" variant="bodySm">{r.sku}</Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{shopify != null ? money(shopify) : '—'}</IndexTable.Cell>
        <IndexTable.Cell><Text as="span" fontWeight="semibold">{money(r.quoted)}</Text></IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone={current == null ? 'subdued' : undefined}>{current != null ? money(current) : '—'}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ width: 110 }}>
            <TextField
              label="Price to save"
              labelHidden
              type="number"
              min={0}
              prefix="$"
              value={String(r.proposed ?? '')}
              onChange={(v) => patchRow(r.sku, { proposed: Number(v) })}
              autoComplete="off"
            />
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone={belowCost ? 'critical' : undefined}>{`${margin}%${belowCost ? ' · below cost' : ''}`}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Link
            onClick={() => {
              // Close this modal and open the source quote in the B2B app.
              dispatch({ type: 'CLOSE_BUILD_QUOTES' });
              dispatch({ type: 'OPEN_QUOTE', id: r.from });
            }}
          >{`from #${r.from}${!bq.source && locations.length > 1 && r.location ? ` · ${r.location}` : ''}`}</Link>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Modal
      open
      onClose={() => dispatch({ type: 'CLOSE_BUILD_QUOTES' })}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          Build pricing from closed quotes
          {SHOW_DEV_TOOLS ? (
            <DevToggle on={!rfqInstalled} onToggle={() => dispatch({ type: 'SET_RFQ_INSTALLED', installed: !rfqInstalled })} />
          ) : null}
        </span>
      }
      size="large"
      primaryAction={{
        content: bq.dest === '__new__' ? 'Create base pricing' : 'Add prices',
        onAction: onSave,
        disabled: !canSave,
      }}
      secondaryActions={[{ content: 'Cancel', onAction: () => dispatch({ type: 'CLOSE_BUILD_QUOTES' }) }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {/* "Quotes from" — a small filter pill (secondary slim button, icon + chevron,
              like the Analytics date pickers); the menu lists every location with its
              closed-quote count. */}
          {pickSource && rfqInstalled ? (
            <BlockStack gap="100">
              <Text as="span" variant="bodyMd">Quotes from</Text>
              <InlineStack>
                <Popover
                  active={sourceOpen}
                  onClose={() => setSourceOpen(false)}
                  activator={
                    <Button size="slim" icon={LocationIcon} disclosure onClick={() => setSourceOpen((v) => !v)}>
                      {`${bq.source || 'All locations'} (${closedQuotesOf(company, state.db, bq.source).length})`}
                    </Button>
                  }
                >
                  <ActionList
                    actionRole="menuitemradio"
                    items={[
                      { content: `All locations (${closedQuotesOf(company, state.db, null).length})`, active: !bq.source, onAction: () => { setSourceOpen(false); setSource(''); } },
                      ...locations.map((l) => ({
                        content: `${l.name} (${closedQuotesOf(company, state.db, l.name).length})`,
                        active: bq.source === l.name,
                        onAction: () => { setSourceOpen(false); setSource(l.name); },
                      })),
                    ]}
                  />
                </Popover>
              </InlineStack>
            </BlockStack>
          ) : null}

          {!isEmpty && (
            <Text as="p" tone="subdued" variant="bodySm">
              {bq.quoteId
                ? `Prices from quote #${bq.quoteId}${bq.source ? ` (${bq.source})` : ''}. Tick the ones to include, edit the price, then add them to a base pricing.`
                : `Prices come from each product’s most recently closed quote${bq.source ? ` at ${bq.source}` : ''}. Tick the ones to include, edit the price, then add them to a base pricing.`}
            </Text>
          )}

          {!isEmpty && (
            <InlineStack gap="200" blockAlign="center" wrap={false}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TextField
                  label="Search products"
                  labelHidden
                  value={query}
                  onChange={setQuery}
                  prefix={<Icon source={SearchIcon} tone="subdued" />}
                  placeholder="Search by product or SKU"
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setQuery('')}
                />
              </div>
              <div style={{ width: 200, flex: '0 0 auto' }}>
                <Select label="Sort by" labelHidden options={SORT_OPTIONS} value={sort} onChange={setSort} />
              </div>
            </InlineStack>
          )}

          <Box borderWidth="025" borderColor="border" borderRadius="200" overflowX="hidden">
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <IndexTable
                resourceName={{ singular: 'product', plural: 'products' }}
                itemCount={shown.length}
                selectable={!isEmpty}
                selectedItemsCount={allShownSelected ? 'All' : selectedShown}
                onSelectionChange={onSelectionChange}
                emptyState={
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
                }
                headings={[
                  { title: 'Product' },
                  { title: 'Shopify' },
                  { title: 'Quoted' },
                  {
                    title: 'Current',
                    tooltipContent: `The price ${sourceLoc ? sourceLoc.name : 'this company'} pays now, from its current B2B pricing. “—” means no B2B price is set yet.`,
                  },
                  {
                    title: 'Price to save',
                    tooltipContent: 'Saved as this product’s base price in the selected pricing. Defaults to the quoted price — edit if needed.',
                  },
                  { title: 'Margin' },
                  { title: 'Source' },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            </div>
          </Box>

          {!isEmpty && selectedCount === 0 && (
            <Text as="p" tone="critical" variant="bodySm">
              Select at least one product to build pricing.
            </Text>
          )}



          {/* Where the prices go: an existing pricing (updated wherever it's assigned)
              or a new one — its locations are picked in the pricing editor. */}
          {!isEmpty && (
            <>
              <Divider />
              <Select
                label="Add to"
                options={destOptions}
                value={bq.dest}
                onChange={(v) => patchBq({ dest: v })}
                helpText={!otherCompanies.length ? destHint : undefined}
              />
              {otherCompanies.length ? (
                <Banner tone="warning">
                  {`“${destPolicy.name}” is also assigned to ${otherCompanies.length} other compan${otherCompanies.length === 1 ? 'y' : 'ies'}, so they’ll get these quote prices too. To use them only for ${company.name} or its location, pick a pricing assigned only to it, or create a new one.`}
                </Banner>
              ) : null}
            </>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// Dev-only toggle in the modal header: preview the modal as a merchant who hasn't
// installed the RFQ app. The "no closed quotes" case needs no toggle — open it on a
// company without any.
function DevToggle({ on, onToggle }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 'normal' }}>
      <Badge tone="info">Dev</Badge>
      <Button size="micro" pressed={on} onClick={onToggle}>
        {on ? 'Show installed' : 'Preview not installed'}
      </Button>
    </span>
  );
}
