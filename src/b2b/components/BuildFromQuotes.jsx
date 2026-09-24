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
} from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';
import { useStore, newBaseBuilder } from '../store.jsx';
import { companyBaseEntries, resolvedPriceFor } from '../pricing.js';
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

// Aggregate a company's Deal-Closed quotes into proposed base prices (spec §5.4).
// Most recent closed quote wins per SKU. Opens the modal.
export function openBuildFromQuotes(dispatch, company, db) {
  const closed = (db.quotes || []).filter((q) => q.company === company.id && q.status === 'Deal Closed');
  closed.sort((a, b) => (a.updated || a.created || '').localeCompare(b.updated || b.created || ''));
  const map = {};
  closed.forEach((q) =>
    (q.lines || []).forEach((l) => {
      if (l.quoted != null) map[l.sku] = { sku: l.sku, quoted: l.quoted, proposed: l.quoted, from: q.id };
    }),
  );
  const rows = Object.values(map);
  const bases = companyBaseEntries(company, db.policies);
  dispatch({ type: 'OPEN_BUILD_QUOTES', payload: { companyId: company.id, rows, dest: bases[0]?.id || '__new__' } });
}

// "Turn into pricing" from a single quote: seed rows from just its priced lines.
export function openBuildFromQuote(dispatch, company, db, quote) {
  const rows = (quote.lines || [])
    .filter((l) => l.quoted != null)
    .map((l) => ({ sku: l.sku, quoted: l.quoted, proposed: l.quoted, from: quote.id }));
  const bases = companyBaseEntries(company, db.policies);
  dispatch({ type: 'OPEN_BUILD_QUOTES', payload: { companyId: company.id, rows, dest: bases[0]?.id || '__new__' } });
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
  }, [!!state.buildQuotes, state.buildQuotes?.companyId]);
  if (!bq) return null;

  const company = state.db.companies.find((c) => c.id === bq.companyId);
  const bases = companyBaseEntries(company, state.db.policies);
  const products = state.db.products;
  const productOf = (sku) => products.find((p) => p.sku === sku);
  const skuTitle = (sku) => productOf(sku)?.title || sku;

  const patchRow = (sku, patch) => {
    const rows = bq.rows.map((r) => (r.sku === sku ? { ...r, ...patch } : r));
    dispatch({ type: 'BUILD_QUOTES_PATCH', patch: { rows } });
  };

  // "Create a new base pricing" is the FIRST dropdown option (not buried at the
  // bottom), so it's easy to find no matter how many pricings the company has.
  const destOptions = [
    { label: 'Create a new base pricing…', value: '__new__' },
    ...bases.map((e) => ({ label: e.policy.name, value: e.policy.id })),
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
      const builder = { ...newBaseBuilder(), name: `${company.name} from closed quotes`, variantAdjustments: adjustments, explicitEnabled: true };
      dispatch({ type: 'CLOSE_BUILD_QUOTES' });
      dispatch({ type: 'OPEN_EDITOR', policy: builder, context: { mode: 'add-base', companyId: company.id } });
    } else {
      dispatch({ type: 'APPLY_BUILD_QUOTES', companyId: company.id, dest: bq.dest, rows: chosen });
    }
  };

  // Estimated cost ≈ 60% of the quoted price (no real cost on the product);
  // margin tracks the editable base price, matching the Save-to-B2B modal.
  const rowMarkup = shown.map((r, i) => {
    const product = productOf(r.sku);
    const shopify = product?.list;
    const current = product ? resolvedPriceFor(company, product, state.db.policies) : null;
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
          >{`from #${r.from}`}</Link>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Modal
      open
      onClose={() => dispatch({ type: 'CLOSE_BUILD_QUOTES' })}
      title="Build pricing from closed quotes"
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
          {SHOW_DEV_TOOLS && (
            <DevTools on={!rfqInstalled} onToggle={() => dispatch({ type: 'SET_RFQ_INSTALLED', installed: !rfqInstalled })} />
          )}

          {!isEmpty && (
            <Text as="p" tone="subdued" variant="bodySm">
              Prices come from each product’s most recently closed quote. Tick the ones to include, edit the price, then add them to a base pricing.
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
                    tooltipContent: 'The price this company pays now, from its current B2B pricing. “—” means no B2B price is set yet.',
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

          {!isEmpty && (
            <>
              <Divider />
              <Select
                label="Add to this company’s pricing"
                options={destOptions}
                value={bq.dest}
                onChange={(v) => dispatch({ type: 'BUILD_QUOTES_PATCH', patch: { dest: v } })}
              />
            </>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// Dev-only strip (same pattern as Registrations / Analytics): preview the modal as a
// merchant who hasn't installed the RFQ app. The "no closed quotes" case needs no
// toggle — open it on a company without any.
function DevTools({ on, onToggle }) {
  return (
    <Box background="bg-surface-secondary" borderColor="border" borderWidth="025" borderRadius="200" padding="200">
      <InlineStack gap="200" blockAlign="center" wrap>
        <Badge tone="info">Dev</Badge>
        <Text as="span" variant="bodySm" tone="subdued">
          {on ? 'Previewing without the RFQ app installed.' : 'Preview the modal before the RFQ app is installed.'}
        </Text>
        <Button size="slim" pressed={on} onClick={onToggle}>
          {on ? 'Show installed' : 'Preview not installed'}
        </Button>
      </InlineStack>
    </Box>
  );
}
