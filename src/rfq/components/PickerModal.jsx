import React from 'react';
import { Modal, BlockStack, InlineStack, Box, Text, Button, Checkbox, TextField, IndexTable, Banner, List, Icon } from '@shopify/polaris';
import { ChevronRightIcon, ChevronDownIcon } from '@shopify/polaris-icons';
import { money } from '../utils.js';
import { RFQ_CATALOG, RFQ_PRICING_OPTIONS, RFQ_TEMPLATE_PRODUCTS } from '../data/catalog.js';

// The product picker for Create quote: a 2-step priced-template flow and a catalog
// browser, both with checkbox + editable price + qty. Multi-variant products are
// collapsible (caret) into indented variant sub-rows, so a variant can be picked
// and priced individually — matching the whole-store ProductPickerModal. Selection
// is keyed by VARIANT id (a single-variant product's variant id === its sku).
const catBySku = (sku) => RFQ_CATALOG.find((p) => p.sku === sku);

export function PickerModal({ picker, setPicker, customer, onAdd, onCreatePricing, appInstalled = true }) {
  const isCat = picker.mode === 'catalog';
  const templates = customer ? RFQ_PRICING_OPTIONS[customer.companyKey] || [] : [];

  // Template price prices the product line; each variant defaults to its own catalog
  // price, except the default variant (id === sku) which takes the template price.
  const defPrice = (p, v) => (v.id === p.sku ? p.defaultPrice : v.list ?? p.defaultPrice);
  const variantDefaults = (p, v) => ({ selected: false, price: defPrice(p, v), qty: 1 });
  const pickOf = (p, v) => picker.picks[v.id] || variantDefaults(p, v);

  const setPick = (vid, patch, defaults) => {
    setPicker((prev) => ({
      ...prev,
      picks: { ...prev.picks, [vid]: { ...(prev.picks[vid] || defaults), ...patch } },
    }));
  };
  const toggleExpand = (sku) =>
    setPicker((prev) => {
      const exp = new Set(prev.expanded || []);
      if (exp.has(sku)) exp.delete(sku);
      else exp.add(sku);
      return { ...prev, expanded: [...exp] };
    });

  // Source products (catalog browse or the chosen template), enriched with variants.
  const baseRows = isCat
    ? RFQ_CATALOG.map((p) => ({ sku: p.sku, title: p.title, price: p.list }))
    : picker.templateId
      ? (RFQ_TEMPLATE_PRODUCTS[picker.templateId] || []).map((t) => ({ sku: t.sku, title: catBySku(t.sku)?.title || t.sku, price: t.price }))
      : [];
  const listProducts = baseRows.map((r) => {
    const cat = catBySku(r.sku);
    const variants = cat?.variants?.length ? cat.variants : [{ id: r.sku, title: 'Default', list: r.price, stock: cat?.stock }];
    return { sku: r.sku, title: r.title, defaultPrice: r.price, stock: cat?.stock, variants };
  });

  const q = (picker.search || '').trim().toLowerCase();
  const filtered = q
    ? listProducts.filter((p) => [p.title, p.sku, ...p.variants.map((v) => `${v.title} ${v.id}`)].join(' ').toLowerCase().includes(q))
    : listProducts;
  const expanded = new Set(picker.expanded || []);

  const selectedCount = Object.values(picker.picks).filter((p) => p.selected).length;

  const toggleVariant = (p, v) => setPick(v.id, { selected: !pickOf(p, v).selected }, variantDefaults(p, v));
  const toggleProduct = (p) => {
    const all = p.variants.every((v) => picker.picks[v.id]?.selected);
    setPicker((prev) => {
      const picks = { ...prev.picks };
      p.variants.forEach((v) => {
        picks[v.id] = { ...(picks[v.id] || variantDefaults(p, v)), selected: !all };
      });
      return { ...prev, picks };
    });
  };

  const doAdd = () => {
    const additions = [];
    listProducts.forEach((p) => {
      const single = p.variants.length === 1 && p.variants[0].id === p.sku;
      p.variants.forEach((v) => {
        const pk = picker.picks[v.id];
        if (pk?.selected) {
          additions.push({
            sku: v.id,
            title: single ? p.title : `${p.title} — ${v.title}`,
            price: Number(pk.price ?? defPrice(p, v)),
            qty: Number(pk.qty ?? 1),
            priced: !isCat,
          });
        }
      });
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
            {/* Only meaningful when there's actually a pricing to choose — otherwise
                the banner below carries the "no pricing / not installed" message. */}
            {templates.length > 0 && (
              <Text as="p" tone="subdued" variant="bodySm">
                Choose a base pricing attached to {customer?.company} in the B2B app, then pick products.
              </Text>
            )}
            {templates.length === 0 ? (
              <Banner
                tone={appInstalled ? 'warning' : 'info'}
                title={
                  appInstalled
                    ? `${customer?.company || customer?.name || 'This customer'} has no B2B pricing yet`
                    : 'Win repeat orders with the Wholesale B2B app'
                }
                action={onCreatePricing ? { content: appInstalled ? 'Create pricing' : 'Install B2B app', onAction: onCreatePricing } : undefined}
              >
                {appInstalled ? (
                  <p>
                    No pricing has been created in the B2B app yet. Create a price so this customer gets the right price on this and future quotes — or use “Add product” instead.
                  </p>
                ) : (
                  <BlockStack gap="200">
                    <Text as="p">
                      Turn one-off buyers like {customer?.company || 'this one'} into managed B2B companies with their own contract pricing — so you stop re-quoting the same prices every time and win the reorders.
                    </Text>
                    <List>
                      <List.Item>Company accounts with multiple locations, buyers and roles</List.Item>
                      <List.Item>Wholesale &amp; contract pricing, quantity breaks and per-product price lists</List.Item>
                      <List.Item>Buyers reorder on their own at agreed prices, with full quote &amp; order history</List.Item>
                    </List>
                    <Text as="span" tone="subdued" variant="bodySm">
                      You can still quote now using “Add product”.
                    </Text>
                  </BlockStack>
                )}
              </Banner>
            ) : (
              templates.map((t) => (
                <Box key={t.id} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="medium">{t.name}</Text>
                      <Text as="span" tone="subdued" variant="bodySm">{`Priority ${t.priority}`}</Text>
                    </BlockStack>
                    <Button icon={ChevronRightIcon} variant="tertiary" accessibilityLabel={`Select ${t.name}`} onClick={() => setPicker({ ...picker, templateId: t.id })} />
                  </InlineStack>
                </Box>
              ))
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // Step 2 / catalog: product list. Multi-variant rows expand into variant sub-rows.
  const priceCell = (p, v, pk) =>
    isCat ? (
      <Text as="span">{money(v.list ?? p.defaultPrice)}</Text>
    ) : (
      <div style={{ width: 96 }}>
        <TextField
          label="Price"
          labelHidden
          type="number"
          min={0}
          prefix="$"
          value={String(pk.price ?? defPrice(p, v))}
          onChange={(val) => setPick(v.id, { price: Number(val) }, variantDefaults(p, v))}
          autoComplete="off"
        />
      </div>
    );
  const qtyCell = (p, v, pk) => (
    <div style={{ width: 72 }}>
      <TextField
        label="Qty"
        labelHidden
        type="number"
        min={1}
        value={String(pk.qty ?? 1)}
        onChange={(val) => setPick(v.id, { qty: Math.max(1, Number(val) || 1) }, variantDefaults(p, v))}
        autoComplete="off"
      />
    </div>
  );
  const priceRange = (p) => {
    const lo = Math.min(...p.variants.map((v) => v.list ?? p.defaultPrice));
    const hi = Math.max(...p.variants.map((v) => v.list ?? p.defaultPrice));
    return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
  };

  const rows = [];
  filtered.forEach((p) => {
    const multi = p.variants.length > 1;
    if (!multi) {
      const v = p.variants[0];
      const pk = pickOf(p, v);
      rows.push(
        <IndexTable.Row id={v.id} key={v.id} position={rows.length}>
          <IndexTable.Cell><Checkbox label="" labelHidden checked={pk.selected} onChange={() => toggleVariant(p, v)} /></IndexTable.Cell>
          <IndexTable.Cell>
            <BlockStack gap="050">
              <Text as="span" variant="bodyMd">{p.title}</Text>
              <Text as="span" tone="subdued" variant="bodySm">{p.sku}</Text>
            </BlockStack>
          </IndexTable.Cell>
          {isCat ? <IndexTable.Cell>{(p.stock ?? 0).toLocaleString('en-US')}</IndexTable.Cell> : null}
          <IndexTable.Cell>{priceCell(p, v, pk)}</IndexTable.Cell>
          <IndexTable.Cell>{qtyCell(p, v, pk)}</IndexTable.Cell>
        </IndexTable.Row>,
      );
      return;
    }
    const allSel = p.variants.every((v) => picker.picks[v.id]?.selected);
    const someSel = p.variants.some((v) => picker.picks[v.id]?.selected);
    const isExp = expanded.has(p.sku);
    rows.push(
      <IndexTable.Row id={p.sku} key={p.sku} position={rows.length}>
        <IndexTable.Cell><Checkbox label="" labelHidden checked={allSel ? true : someSel ? 'indeterminate' : false} onChange={() => toggleProduct(p)} /></IndexTable.Cell>
        <IndexTable.Cell>
          <button type="button" onClick={() => toggleExpand(p.sku)} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
            <InlineStack gap="100" blockAlign="center" wrap={false}>
              <span style={{ display: 'flex' }}><Icon source={isExp ? ChevronDownIcon : ChevronRightIcon} tone="subdued" /></span>
              <BlockStack gap="050">
                <Text as="span" variant="bodyMd">{p.title}</Text>
                <Text as="span" tone="subdued" variant="bodySm">{`${p.variants.length} variants`}</Text>
              </BlockStack>
            </InlineStack>
          </button>
        </IndexTable.Cell>
        {isCat ? <IndexTable.Cell>{(p.stock ?? 0).toLocaleString('en-US')}</IndexTable.Cell> : null}
        <IndexTable.Cell><Text as="span" tone="subdued">{priceRange(p)}</Text></IndexTable.Cell>
        <IndexTable.Cell> </IndexTable.Cell>
      </IndexTable.Row>,
    );
    if (isExp) {
      p.variants.forEach((v) => {
        const pk = pickOf(p, v);
        rows.push(
          <IndexTable.Row id={v.id} key={v.id} position={rows.length}>
            <IndexTable.Cell><Checkbox label="" labelHidden checked={pk.selected} onChange={() => toggleVariant(p, v)} /></IndexTable.Cell>
            <IndexTable.Cell>
              <div style={{ paddingInlineStart: 28 }}>
                <BlockStack gap="050">
                  <Text as="span" variant="bodyMd">{v.title}</Text>
                  <Text as="span" tone="subdued" variant="bodySm">{v.id}</Text>
                </BlockStack>
              </div>
            </IndexTable.Cell>
            {isCat ? <IndexTable.Cell>{((v.stock ?? p.stock) ?? 0).toLocaleString('en-US')}</IndexTable.Cell> : null}
            <IndexTable.Cell>{priceCell(p, v, pk)}</IndexTable.Cell>
            <IndexTable.Cell>{qtyCell(p, v, pk)}</IndexTable.Cell>
          </IndexTable.Row>,
        );
      });
    }
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
            placeholder="Search products or variants"
            value={picker.search}
            onChange={(v) => setPicker({ ...picker, search: v })}
            autoComplete="off"
          />
          <IndexTable
            resourceName={{ singular: 'product', plural: 'products' }}
            itemCount={rows.length}
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
