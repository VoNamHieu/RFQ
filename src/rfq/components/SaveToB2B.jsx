import React, { useState } from 'react';
import {
  Modal,
  BlockStack,
  InlineStack,
  Box,
  Text,
  Select,
  TextField,
  Banner,
  IndexTable,
  Badge,
} from '@shopify/polaris';
import { money, marginPct, costFallback } from '../utils.js';
import { RFQ_CATALOG, RFQ_PRICING_OPTIONS } from '../data/catalog.js';
import { versionFlags } from '../../shared/versions.js';

const catBySku = (sku) => RFQ_CATALOG.find((p) => p.sku === sku);

// "Save quoted prices to B2B" (spec §5.5): editable Quoted + Cost/Margin, a
// destination base, and the block-if-above-Shopify / warn-if-below-cost logic.
export function SaveToB2B({ quote, onClose, onDone }) {
  const companyKey = quote.linkedCompanyKey || quote.fixedCompanyKey || quote.recommendedKey;
  const bases = RFQ_PRICING_OPTIONS[companyKey] || [];

  const sourceLines =
    quote.lines && quote.lines.length
      ? quote.lines
      : [{ sku: quote.product?.sku, title: quote.product?.name, price: quote.product?.price, qty: quote.product?.quantity }];

  const [rows, setRows] = useState(
    sourceLines.map((l) => {
      const cat = catBySku(l.sku);
      const quoted = Number(l.price) || 0;
      return {
        sku: l.sku,
        title: l.title || cat?.title || l.sku,
        shopify: cat?.list ?? quoted,
        cost: costFallback(quoted),
        quoted,
      };
    }),
  );
  const [dest, setDest] = useState(bases[0]?.id || '__new__');
  const [phase, setPhase] = useState('edit');

  const anyOver = rows.some((r) => r.quoted > r.shopify);
  const anyBelowCost = rows.some((r) => r.quoted < r.cost);

  const setQuoted = (i, v) => setRows(rows.map((r, k) => (k === i ? { ...r, quoted: Number(v) } : r)));

  const destOptions = [
    ...bases.map((b) => ({ label: `${b.name} (${b.priority === 1 ? 'applied first' : 'fallback'})`, value: b.id })),
    { label: 'Create a new base pricing…', value: '__new__' },
  ];

  if (phase === 'done') {
    return (
      <Modal
        open
        onClose={onClose}
        title="Saved to B2B"
        primaryAction={{ content: 'Open in B2B app', onAction: onDone }}
        secondaryActions={[{ content: 'Close', onAction: onClose }]}
      >
        <Modal.Section>
          <BlockStack gap="200" inlineAlign="center">
            <Badge tone="success">Done</Badge>
            <Text as="p" alignment="center">
              These prices were added to {dest === '__new__' ? 'a new base pricing' : bases.find((b) => b.id === dest)?.name} for the company. Buyers now reorder at the agreed price.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Save quoted prices to B2B"
      size="large"
      primaryAction={{
        content: dest === '__new__' ? 'Create & assign' : 'Add prices',
        onAction: () => setPhase('done'),
        disabled: anyOver,
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" tone="subdued" variant="bodySm">
            {versionFlags().crossSyncScope === 'location'
              ? 'Applies to the location this quote came from — other locations keep their current pricing.'
              : 'Saves onto a company base pricing — every location using that base gets these prices right away.'}
          </Text>

          <Select
            label={versionFlags().crossSyncScope === 'location' ? "Add to this location’s pricing" : 'Add to base pricing'}
            options={destOptions}
            value={dest}
            onChange={setDest}
          />

          {anyOver && (
            <Banner tone="critical">B2B pricing can’t be higher than the Shopify price — lower them first.</Banner>
          )}
          {!anyOver && anyBelowCost && (
            <Banner tone="warning">Some prices are below cost — you’d sell at a loss.</Banner>
          )}

          <IndexTable
            resourceName={{ singular: 'product', plural: 'products' }}
            itemCount={rows.length}
            selectable={false}
            headings={[
              { title: 'Product' },
              { title: 'Shopify' },
              { title: 'Cost' },
              { title: 'Quoted' },
              { title: 'Margin' },
            ]}
          >
            {rows.map((r, i) => {
              const m = marginPct(r.quoted, r.cost);
              const belowCost = r.quoted < r.cost;
              const over = r.quoted > r.shopify;
              return (
                <IndexTable.Row id={r.sku || String(i)} key={i} position={i}>
                  <IndexTable.Cell>
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        {r.title}
                      </Text>
                      {r.sku ? (
                        <Text as="span" tone="subdued" variant="bodySm">
                          {r.sku}
                        </Text>
                      ) : null}
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{money(r.shopify)}</IndexTable.Cell>
                  <IndexTable.Cell>{money(r.cost)}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <div style={{ width: 96 }}>
                      <TextField
                        label="Quoted"
                        labelHidden
                        type="number"
                        min={0}
                        prefix="$"
                        value={String(r.quoted)}
                        onChange={(v) => setQuoted(i, v)}
                        error={over}
                        autoComplete="off"
                      />
                    </div>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone={belowCost ? 'critical' : undefined}>
                      {`${m}%${belowCost ? ' · below cost' : ''}`}
                    </Text>
                  </IndexTable.Cell>
                </IndexTable.Row>
              );
            })}
          </IndexTable>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
