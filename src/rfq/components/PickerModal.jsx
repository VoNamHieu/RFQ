import React, { useState } from 'react';
import { Modal, BlockStack, InlineStack, Box, Text, Button, Checkbox, TextField, IndexTable, Banner } from '@shopify/polaris';
import { money } from '../utils.js';
import { RFQ_CATALOG, RFQ_PRICING_OPTIONS, RFQ_TEMPLATE_PRODUCTS } from '../data/catalog.js';

// The product picker for Create quote: a 2-step priced-template flow and a catalog
// browser, both with checkbox + editable price + qty. Split out of CreateQuote.jsx.
const catBySku = (sku) => RFQ_CATALOG.find((p) => p.sku === sku);

export function PickerModal({ picker, setPicker, customer, onAdd, onCreatePricing, appInstalled = true }) {
  const isCat = picker.mode === 'catalog';
  const templates = customer ? RFQ_PRICING_OPTIONS[customer.companyKey] || [] : [];

  const ensure = (sku, price, qty = 1) => {
    if (!picker.picks[sku]) {
      setPicker({ ...picker, picks: { ...picker.picks, [sku]: { selected: false, price, qty } } });
    }
  };
  const setPick = (sku, patch, price, qty = 1) => {
    setPicker((prev) => ({
      ...prev,
      picks: { ...prev.picks, [sku]: { ...(prev.picks[sku] || { selected: false, price, qty }), ...patch } },
    }));
  };

  const rowsSource = isCat
    ? RFQ_CATALOG.map((p) => ({ sku: p.sku, title: p.title, price: p.list, stock: p.stock }))
    : picker.templateId
      ? (RFQ_TEMPLATE_PRODUCTS[picker.templateId] || []).map((t) => ({
          sku: t.sku,
          title: catBySku(t.sku)?.title || t.sku,
          price: t.price,
        }))
      : [];

  const q = (picker.search || '').trim().toLowerCase();
  const filtered = q ? rowsSource.filter((r) => r.title.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)) : rowsSource;

  const selectedCount = Object.values(picker.picks).filter((p) => p.selected).length;

  const doAdd = () => {
    const additions = [];
    rowsSource.forEach((r) => {
      const p = picker.picks[r.sku];
      if (p?.selected) {
        additions.push({
          sku: r.sku,
          title: r.title,
          price: Number(p.price ?? r.price),
          qty: Number(p.qty ?? 1),
          priced: !isCat,
        });
      }
    });
    onAdd(additions);
  };

  // Step 1 of the priced flow: pick a base-price template.
  if (!isCat && !picker.templateId) {
    return (
      <Modal
        open
        onClose={() => setPicker(null)}
        title="Add custom priced items"
        secondaryActions={[{ content: 'Cancel', onAction: () => setPicker(null) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" tone="subdued" variant="bodySm">
              Choose a base pricing attached to {customer?.company} in the B2B app, then pick products.
            </Text>
            {templates.length === 0 ? (
              <Banner
                tone="warning"
                title={
                  appInstalled
                    ? `${customer?.company || customer?.name || 'This customer'} has no B2B pricing yet`
                    : 'Wholesale B2B app isn’t installed'
                }
                action={onCreatePricing ? { content: appInstalled ? 'Create pricing' : 'Install B2B app', onAction: onCreatePricing } : undefined}
              >
                <p>
                  {appInstalled
                    ? 'No pricing has been created in the B2B app yet. Create a price so this customer gets the right price on this and future quotes — or use “Add product” instead.'
                    : 'Install the Wholesale B2B app to set contract pricing for this customer. You can still quote using “Add product”.'}
                </p>
              </Banner>
            ) : (
              templates.map((t) => (
                <Box
                  key={t.id}
                  padding="300"
                  borderWidth="025"
                  borderColor="border"
                  borderRadius="200"
                >
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        {t.name}
                      </Text>
                      <Text as="span" tone="subdued" variant="bodySm">
                        {`Priority ${t.priority}`}
                      </Text>
                    </BlockStack>
                    <Button onClick={() => setPicker({ ...picker, templateId: t.id })}>Select</Button>
                  </InlineStack>
                </Box>
              ))
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // Step 2 / catalog: product list with checkbox + editable price.
  const rows = filtered.map((r, i) => {
    const pick = picker.picks[r.sku] || { selected: false, price: r.price, qty: 1 };
    return (
      <IndexTable.Row id={r.sku} key={r.sku} position={i}>
        <IndexTable.Cell>
          <Checkbox
            label=""
            labelHidden
            checked={pick.selected}
            onChange={(v) => setPick(r.sku, { selected: v }, r.price)}
          />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd">
              {r.title}
            </Text>
            <Text as="span" tone="subdued" variant="bodySm">
              {r.sku}
            </Text>
          </BlockStack>
        </IndexTable.Cell>
        {isCat ? (
          <IndexTable.Cell>{(r.stock ?? 0).toLocaleString('en-US')}</IndexTable.Cell>
        ) : null}
        <IndexTable.Cell>
          {isCat ? (
            <Text as="span">{money(r.price)}</Text>
          ) : (
            <div style={{ width: 96 }}>
              <TextField
                label="Price"
                labelHidden
                type="number"
                min={0}
                prefix="$"
                value={String(pick.price ?? r.price)}
                onChange={(v) => setPick(r.sku, { price: Number(v) }, r.price)}
                autoComplete="off"
              />
            </div>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ width: 72 }}>
            <TextField
              label="Qty"
              labelHidden
              type="number"
              min={1}
              value={String(pick.qty ?? 1)}
              onChange={(v) => setPick(r.sku, { qty: Math.max(1, Number(v) || 1) }, r.price)}
              autoComplete="off"
            />
          </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const headings = isCat
    ? [{ title: '' }, { title: 'Product' }, { title: 'Available' }, { title: 'Price' }, { title: 'Qty' }]
    : [{ title: '' }, { title: 'Product' }, { title: 'Price' }, { title: 'Qty' }];

  return (
    <Modal
      open
      onClose={() => setPicker(null)}
      title={isCat ? 'Select products' : 'Add custom priced items'}
      size="large"
      primaryAction={{ content: 'Add', onAction: doAdd, disabled: selectedCount === 0 }}
      secondaryActions={[
        !isCat && picker.templateId
          ? { content: '← Templates', onAction: () => setPicker({ ...picker, templateId: null }) }
          : { content: 'Cancel', onAction: () => setPicker(null) },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <TextField
            label="Search"
            labelHidden
            placeholder="Search products"
            value={picker.search}
            onChange={(v) => setPicker({ ...picker, search: v })}
            autoComplete="off"
          />
          <IndexTable
            resourceName={{ singular: 'product', plural: 'products' }}
            itemCount={filtered.length}
            selectable={false}
            headings={headings}
          >
            {rows}
          </IndexTable>
          <Text as="span" tone="subdued" variant="bodySm">
            {`${selectedCount}/500 variants selected`}
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
