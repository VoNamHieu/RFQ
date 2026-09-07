import React, { useState } from 'react';
import { Modal, BlockStack, Badge, Text, Button } from '@shopify/polaris';
import { ViewIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { resolveDetail } from '../pricing.js';
import { money } from '../format.js';
import { PriceWhyContent } from './PricePreviewModal.jsx';
import { ProductPriceTable } from './ProductPriceTable.jsx';

const LAYER_TONE = { override: 'info', rule: undefined, shopify: undefined };
const BOARD_SORTS = [
  { label: 'Product A–Z', value: 'title-asc' },
  { label: 'Product Z–A', value: 'title-desc' },
  { label: 'Shopify price: low to high', value: 'shopify-asc' },
  { label: 'Shopify price: high to low', value: 'shopify-desc' },
  { label: 'Buyer pays: low to high', value: 'final-asc' },
  { label: 'Buyer pays: high to low', value: 'final-desc' },
  { label: 'Biggest discount', value: 'off-desc' },
];

// Resolved-prices board (spec §2.7): every in-scope product with the layer that
// decided its B2B price and the buyer-pays / off% columns, in the shared Shopify-
// picker layout (search + sort + thumbnail rows). Each row drills into a "Why this
// price" breakdown (same modal, view switches; Back returns to the board).
export function PriceBoard() {
  const { state, dispatch } = useStore();
  const [detailSku, setDetailSku] = useState(null);
  const [sort, setSort] = useState('title-asc');
  const pb = state.priceBoard;
  if (!pb) return null;
  const company = state.db.companies.find((c) => c.id === pb.companyId);
  const closeBoard = () => dispatch({ type: 'CLOSE_PRICE_BOARD' });
  const detailProduct = detailSku ? state.db.products.find((p) => p.sku === detailSku) : null;

  const q = (pb.search || '').trim().toLowerCase();
  const entries = state.db.products.map((p) => {
    const d = resolveDetail(company, p, state.db.policies);
    const off = p.list ? Math.round(((p.list - d.price) / p.list) * 100) : 0;
    return { p, d, off };
  });
  const filtered = q ? entries.filter((e) => e.p.title.toLowerCase().includes(q) || e.p.sku.toLowerCase().includes(q)) : entries;
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'title-desc': return b.p.title.localeCompare(a.p.title);
      case 'shopify-asc': return a.p.list - b.p.list;
      case 'shopify-desc': return b.p.list - a.p.list;
      case 'final-asc': return a.d.price - b.d.price;
      case 'final-desc': return b.d.price - a.d.price;
      case 'off-desc': return b.off - a.off;
      default: return a.p.title.localeCompare(b.p.title);
    }
  });

  const rows = sorted.map((e) => ({
    key: e.p.sku,
    title: e.p.title,
    subtitle: e.p.sku,
    cells: [
      <Text as="span" tone="subdued">{money(e.p.list)}</Text>,
      <Badge tone={LAYER_TONE[e.d.layer]}>{e.d.decidedBy}</Badge>,
      <Text as="span" fontWeight="medium">{money(e.d.price)}</Text>,
      <Text as="span">{e.off > 0 ? `${e.off}% off` : '—'}</Text>,
    ],
    action: <Button icon={ViewIcon} variant="tertiary" accessibilityLabel="Why this price" onClick={() => setDetailSku(e.p.sku)} />,
  }));

  return (
    <Modal
      open
      onClose={detailProduct ? () => setDetailSku(null) : closeBoard}
      title={detailProduct ? 'Why this price' : `Resolved prices · ${company?.name || ''}`}
      size={detailProduct ? undefined : 'large'}
      secondaryActions={[
        detailProduct
          ? { content: 'Back', onAction: () => setDetailSku(null) }
          : { content: 'Close', onAction: closeBoard },
      ]}
    >
      <Modal.Section>
        {detailProduct ? (
          <PriceWhyContent key={detailSku} company={company} location={null} policies={state.db.policies} product={detailProduct} />
        ) : (
          <BlockStack gap="300">
            <Text as="p" tone="subdued" variant="bodySm">
              What a buyer at this company pays for each product, and which pricing layer decided it.
            </Text>
            <ProductPriceTable
              search={pb.search || ''}
              onSearch={(v) => dispatch({ type: 'PRICE_BOARD_PATCH', patch: { search: v } })}
              sort={sort}
              onSort={setSort}
              sortOptions={BOARD_SORTS}
              columns={[
                { title: 'Shopify price', width: '96px', align: 'end' },
                { title: 'Decided by', width: '160px', align: 'start' },
                { title: 'Buyer pays', width: '96px', align: 'end' },
                { title: 'Off', width: '72px', align: 'end' },
              ]}
              rows={rows}
              emptyLabel={`No products match “${(pb.search || '').trim()}”.`}
            />
          </BlockStack>
        )}
      </Modal.Section>
    </Modal>
  );
}
