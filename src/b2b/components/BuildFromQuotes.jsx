import React from 'react';
import {
  Modal,
  BlockStack,
  Box,
  Text,
  Select,
  TextField,
  IndexTable,
  Divider,
} from '@shopify/polaris';
import { useStore, newBaseBuilder } from '../store.jsx';
import { companyBaseEntries } from '../pricing.js';
import { money } from '../format.js';

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
  if (!bq) return null;

  const company = state.db.companies.find((c) => c.id === bq.companyId);
  const bases = companyBaseEntries(company, state.db.policies);
  const products = state.db.products;
  const skuTitle = (sku) => products.find((p) => p.sku === sku)?.title || sku;
  const shopifyPrice = (sku) => products.find((p) => p.sku === sku)?.list;

  const patchRow = (i, patch) => {
    const rows = bq.rows.map((r, k) => (k === i ? { ...r, ...patch } : r));
    dispatch({ type: 'BUILD_QUOTES_PATCH', patch: { rows } });
  };
  // "Create a new base pricing" is the FIRST dropdown option (not buried at the
  // bottom), so it's easy to find no matter how many pricings the company has.
  const destOptions = [
    { label: 'Create a new base pricing…', value: '__new__' },
    ...bases.map((e) => ({ label: e.policy.name, value: e.policy.id })),
  ];
  const hasProposed = bq.rows.some((r) => Number(r.proposed) > 0);

  const onSave = () => {
    if (bq.dest === '__new__') {
      const adjustments = {};
      bq.rows
        .filter((r) => Number(r.proposed) > 0)
        .forEach((r) => {
          adjustments[r.sku] = { rule: 'set', valueType: 'amount', value: Number(r.proposed) };
        });
      const builder = { ...newBaseBuilder(), name: `${company.name} from closed quotes`, variantAdjustments: adjustments, explicitEnabled: true };
      dispatch({ type: 'CLOSE_BUILD_QUOTES' });
      dispatch({ type: 'OPEN_EDITOR', policy: builder, context: { mode: 'add-base', companyId: company.id } });
    } else {
      dispatch({ type: 'APPLY_BUILD_QUOTES', companyId: company.id, dest: bq.dest, rows: bq.rows });
    }
  };

  // Estimated cost ≈ 60% of the quoted price (no real cost on the product);
  // margin tracks the editable base price, matching the Save-to-B2B modal.
  const rows = bq.rows.map((r, i) => {
    const shopify = shopifyPrice(r.sku);
    const cost = Math.round((Number(r.quoted) || 0) * 0.6);
    const proposed = Number(r.proposed) || 0;
    const margin = proposed ? Math.round(((proposed - cost) / proposed) * 100) : 0;
    const belowCost = proposed > 0 && proposed < cost;
    return (
      <IndexTable.Row id={r.sku} key={r.sku} position={i}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="medium">{skuTitle(r.sku)}</Text>
            <Text as="span" tone="subdued" variant="bodySm">{r.sku}</Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{shopify != null ? money(shopify) : '—'}</IndexTable.Cell>
        <IndexTable.Cell>{money(cost)}</IndexTable.Cell>
        <IndexTable.Cell><Text as="span" fontWeight="semibold">{money(r.quoted)}</Text></IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ width: 110 }}>
            <TextField
              label="Price to save"
              labelHidden
              type="number"
              min={0}
              prefix="$"
              value={String(r.proposed ?? '')}
              onChange={(v) => patchRow(i, { proposed: Number(v) })}
              autoComplete="off"
            />
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone={belowCost ? 'critical' : undefined}>{`${margin}%${belowCost ? ' · below cost' : ''}`}</Text>
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
        disabled: !hasProposed,
      }}
      secondaryActions={[{ content: 'Cancel', onAction: () => dispatch({ type: 'CLOSE_BUILD_QUOTES' }) }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" tone="subdued" variant="bodySm">
            Prices come from each product’s most recently closed quote. Review, edit, then add them to a base pricing.
          </Text>
          <Box borderWidth="025" borderColor="border" borderRadius="200" overflowX="hidden">
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <IndexTable
                resourceName={{ singular: 'product', plural: 'products' }}
                itemCount={bq.rows.length}
                selectable={false}
                headings={[
                  { title: 'Product' },
                  { title: 'Shopify' },
                  { title: 'Cost' },
                  { title: 'Quoted' },
                  {
                    title: 'Price to save',
                    tooltipContent: 'Saved as this product’s base price in the selected pricing. Defaults to the quoted price — edit if needed.',
                  },
                  { title: 'Margin' },
                ]}
              >
                {rows}
              </IndexTable>
            </div>
          </Box>
          <Divider />
          <Select
            label="Add to this company’s pricing"
            options={destOptions}
            value={bq.dest}
            onChange={(v) => dispatch({ type: 'BUILD_QUOTES_PATCH', patch: { dest: v } })}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
