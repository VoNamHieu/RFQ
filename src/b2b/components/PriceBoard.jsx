import React from 'react';
import { Modal, BlockStack, TextField, IndexTable, Badge, Text, Box, InlineStack } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { resolveDetail } from '../pricing.js';
import { money } from '../format.js';

const LAYER_TONE = { override: 'info', rule: 'success', shopify: undefined };

// Resolved-prices board (spec §2.7): every in-scope product with the layer that
// decided its B2B price and the buyer-pays / off% columns.
export function PriceBoard() {
  const { state, dispatch } = useStore();
  const pb = state.priceBoard;
  if (!pb) return null;
  const company = state.db.companies.find((c) => c.id === pb.companyId);
  const q = (pb.search || '').trim().toLowerCase();
  const products = state.db.products.filter(
    (p) => !q || p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
  );

  const rows = products.map((p, i) => {
    const d = resolveDetail(company, p, state.db.policies);
    const off = p.list ? Math.round(((p.list - d.price) / p.list) * 100) : 0;
    return (
      <IndexTable.Row id={p.sku} key={p.sku} position={i}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {p.title}
            </Text>
            <Text as="span" tone="subdued" variant="bodySm">
              {p.sku}
            </Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{money(p.list)}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={LAYER_TONE[d.layer]}>{d.decidedBy}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" fontWeight="medium">
            {money(d.price)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone={off > 0 ? 'success' : undefined}>
            {off > 0 ? `${off}% off` : '—'}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Modal
      open
      onClose={() => dispatch({ type: 'CLOSE_PRICE_BOARD' })}
      title={`Resolved prices · ${company?.name || ''}`}
      size="large"
      secondaryActions={[{ content: 'Close', onAction: () => dispatch({ type: 'CLOSE_PRICE_BOARD' }) }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" tone="subdued" variant="bodySm">
            What a buyer at this company pays for each product, and which pricing layer decided it.
          </Text>
          <TextField
            label="Search"
            labelHidden
            placeholder="Search products"
            value={pb.search}
            onChange={(v) => dispatch({ type: 'PRICE_BOARD_PATCH', patch: { search: v } })}
            autoComplete="off"
          />
          <IndexTable
            resourceName={{ singular: 'product', plural: 'products' }}
            itemCount={products.length}
            selectable={false}
            headings={[
              { title: 'Product' },
              { title: 'Shopify price' },
              { title: 'Decided by' },
              { title: 'Buyer pays' },
              { title: 'Off' },
            ]}
          >
            {rows}
          </IndexTable>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
