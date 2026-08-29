import React from 'react';
import {
  Modal,
  BlockStack,
  InlineStack,
  Box,
  Text,
  Select,
  TextField,
  Button,
  IndexTable,
  Link,
  Icon,
} from '@shopify/polaris';
import { XCircleIcon } from '@shopify/polaris-icons';
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
  const removeRow = (i) =>
    dispatch({ type: 'BUILD_QUOTES_PATCH', patch: { rows: bq.rows.filter((_, k) => k !== i) } });

  const destOptions = [
    ...bases.map((e) => ({ label: e.policy.name, value: e.policy.id })),
    { label: 'Create a new base pricing…', value: '__new__' },
  ];

  const onSave = () => {
    if (bq.dest === '__new__') {
      const adjustments = {};
      bq.rows
        .filter((r) => Number(r.proposed) > 0)
        .forEach((r) => {
          adjustments[r.sku] = { rule: 'set', valueType: 'amount', value: Number(r.proposed) };
        });
      const builder = { ...newBaseBuilder(), name: `${company.name} from closed quotes`, productAdjustments: adjustments, explicitEnabled: true };
      dispatch({ type: 'CLOSE_BUILD_QUOTES' });
      dispatch({ type: 'OPEN_EDITOR', policy: builder, context: { mode: 'add-base', companyId: company.id } });
    } else {
      dispatch({ type: 'APPLY_BUILD_QUOTES', companyId: company.id, dest: bq.dest, rows: bq.rows });
    }
  };

  const rows = bq.rows.map((r, i) => (
    <IndexTable.Row id={r.sku} key={r.sku} position={i}>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd" fontWeight="medium">
            {skuTitle(r.sku)}
          </Text>
          <Text as="span" tone="subdued" variant="bodySm">
            {r.sku}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>{shopifyPrice(r.sku) != null ? money(shopifyPrice(r.sku)) : '—'}</IndexTable.Cell>
      <IndexTable.Cell>{money(r.quoted)}</IndexTable.Cell>
      <IndexTable.Cell>
        <div style={{ width: 110 }}>
          <TextField
            label="Proposed"
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
        <Link onClick={() => dispatch({ type: 'TOAST', message: `Open quote #${r.from}` })}>{`from #${r.from}`}</Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button icon={XCircleIcon} variant="tertiary" tone="critical" accessibilityLabel="Remove row" onClick={() => removeRow(i)} />
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Modal
      open
      onClose={() => dispatch({ type: 'CLOSE_BUILD_QUOTES' })}
      title="Build pricing from closed quotes"
      size="large"
      primaryAction={{
        content: bq.dest === '__new__' ? 'Create base pricing' : 'Add to base pricing',
        onAction: onSave,
        disabled: !bq.rows.some((r) => Number(r.proposed) > 0),
      }}
      secondaryActions={[{ content: 'Cancel', onAction: () => dispatch({ type: 'CLOSE_BUILD_QUOTES' }) }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" tone="subdued" variant="bodySm">
            Prices come from each product’s most recently closed quote. Review, edit, then add them to a base pricing.
          </Text>
          <InlineStack gap="200" blockAlign="center">
            <Text as="span" variant="bodyMd">
              Add to
            </Text>
            <div style={{ minWidth: 260 }}>
              <Select
                labelHidden
                label="Add to"
                options={destOptions}
                value={bq.dest}
                onChange={(v) => dispatch({ type: 'BUILD_QUOTES_PATCH', patch: { dest: v } })}
              />
            </div>
          </InlineStack>
          <Box borderWidth="025" borderColor="border" borderRadius="200" overflowX="hidden">
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <IndexTable
                resourceName={{ singular: 'product', plural: 'products' }}
                itemCount={bq.rows.length}
                selectable={false}
                headings={[
                  { title: 'Product' },
                  { title: 'Shopify price' },
                  { title: 'Quoted price' },
                  { title: 'Proposed price' },
                  { title: 'Source' },
                  { title: '' },
                ]}
              >
                {rows}
              </IndexTable>
            </div>
          </Box>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
