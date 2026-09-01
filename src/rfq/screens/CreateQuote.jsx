import React, { useState } from 'react';
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Modal,
  TextField,
  Select,
  Button,
  ButtonGroup,
  Badge,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Divider,
  EmptyState,
  Checkbox,
  Icon,
} from '@shopify/polaris';
import { PlusIcon, XIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { money, subtotalOf } from '../utils.js';
import {
  RFQ_CATALOG,
  RFQ_TEMPLATE_PRODUCTS,
  RFQ_CUSTOMERS,
  RFQ_PRICING_OPTIONS,
} from '../data/catalog.js';
import { shopifyCompanyDirectory } from '../data/companies.js';

const catBySku = (sku) => RFQ_CATALOG.find((p) => p.sku === sku);
const lineTitle = (l) => l.title || catBySku(l.sku)?.title || l.sku;

function LockedCustomerCard({ customer }) {
  const co = shopifyCompanyDirectory[customer.companyKey];
  const isCompany = !!co?.inB2B;
  const shipLines = (customer.shipping || '').split('\n');
  return (
    <BlockStack gap="300">
      <BlockStack gap="050">
        <Text as="span" tone="subdued" variant="bodySm">
          Email address
        </Text>
        <Text as="span" variant="bodyMd">
          {customer.email}
        </Text>
      </BlockStack>
      <Divider />
      {isCompany ? (
        <BlockStack gap="300">
          <Field label="Contact person" value={customer.name} sub={customer.email} />
          <Field label="Company" value={customer.company} sub={String(co.shopifyId || '')} />
          <Field label="Shipping address" lines={shipLines} />
          <Field label="Billing address" lines={shipLines} />
        </BlockStack>
      ) : (
        <BlockStack gap="300">
          <Field label="Customer" value={customer.name} sub={customer.email} />
          <Field label="Shipping address" lines={shipLines} />
        </BlockStack>
      )}
    </BlockStack>
  );
}

function Field({ label, value, sub, lines }) {
  return (
    <BlockStack gap="050">
      <Text as="span" tone="subdued" variant="bodySm">
        {label}
      </Text>
      {lines ? (
        lines.map((l, i) => (
          <Text as="span" variant="bodyMd" key={i}>
            {l}
          </Text>
        ))
      ) : (
        <Text as="span" variant="bodyMd">
          {value}
        </Text>
      )}
      {sub ? (
        <Text as="span" tone="subdued" variant="bodySm">
          {sub}
        </Text>
      ) : null}
    </BlockStack>
  );
}

export function CreateQuote() {
  const { state, dispatch } = useStore();
  const cq = state.createQuote;
  const customer = RFQ_CUSTOMERS.find((c) => c.key === cq.customerKey) || null;
  const lines = cq.lines;
  const subtotal = subtotalOf(lines.map((l) => ({ price: l.price, qty: l.qty })));

  const [picker, setPicker] = useState(null); // {mode:'priced'|'catalog', templateId, picks:{}, search}

  const setLines = (next) => dispatch({ type: 'CQ_PATCH', patch: { lines: next } });
  const patchLine = (i, patch) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const removeLine = (i) => setLines(lines.filter((_, k) => k !== i));

  const mergeLines = (additions) => {
    const next = [...lines];
    additions.forEach((add) => {
      const j = add.sku ? next.findIndex((l) => l.sku === add.sku) : -1;
      // Re-adding an existing SKU accumulates quantity (legacy cqPushLine).
      if (j >= 0) next[j] = { ...next[j], qty: (Number(next[j].qty) || 0) + (Number(add.qty) || 1), price: add.price, priced: add.priced };
      else next.push(add);
    });
    setLines(next);
  };

  const pickCustomer = (key) => {
    const c = RFQ_CUSTOMERS.find((x) => x.key === key);
    dispatch({ type: 'CQ_PATCH', patch: { customerKey: key, message: c?.note || '' } });
  };

  // Drop blank/invalid lines and create from the rest (legacy filters invalid).
  const isValidLine = (l) => Number(l.price) >= 0 && Number(l.qty) > 0 && (!l.custom || (l.title || '').trim());
  const canCreate = !!customer && lines.some(isValidLine);

  const cqCreate = () => {
    if (!canCreate) return;
    const id = String(1052001 + state.cqSeq);
    const valid = lines.filter(isValidLine);
    const first = valid[0];
    const quote = {
      number: id,
      title: `Quote No.${id}`,
      scenario: 'Merchant created',
      received: 'Received by Aug 29 2026, 10:00 AM',
      dueDate: cq.dueDate || '',
      state: 'linked',
      linkedCompanyKey: customer.companyKey,
      amountOverride: subtotal,
      lines: valid.map((l) => ({
        title: lineTitle(l),
        sku: l.sku,
        price: Number(l.price),
        qty: Number(l.qty),
        priced: !!l.priced,
      })),
      product: { name: lineTitle(first), sku: first.sku, price: Number(first.price), quantity: Number(first.qty) },
      customer: { name: customer.name, email: customer.email, phone: customer.phone, shipping: customer.shipping, message: cq.message },
    };
    const meta = {
      status: 'New Received',
      progress: 'Created',
      assignee: 'Unassigned',
      b2b: !!shopifyCompanyDirectory[customer.companyKey]?.inB2B,
    };
    dispatch({ type: 'CREATE_QUOTE', id, quote, meta });
  };

  // ---- Line table ----
  const lineRows = lines.map((l, i) => (
    <IndexTable.Row id={String(i)} key={i} position={i}>
      <IndexTable.Cell>
        {l.custom ? (
          <TextField
            label="Item"
            labelHidden
            placeholder="Custom item name"
            value={l.title || ''}
            onChange={(v) => patchLine(i, { title: v })}
            autoComplete="off"
          />
        ) : (
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {lineTitle(l)}
            </Text>
            <InlineStack gap="100">
              {l.sku ? (
                <Text as="span" tone="subdued" variant="bodySm">
                  {l.sku}
                </Text>
              ) : null}
              {l.priced ? (
                <Text as="span" tone="subdued" variant="bodySm">
                  · B2B price
                </Text>
              ) : null}
            </InlineStack>
          </BlockStack>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div style={{ width: 96 }}>
          <TextField
            label="Price"
            labelHidden
            type="number"
            min={0}
            prefix="$"
            value={String(l.price ?? '')}
            onChange={(v) => patchLine(i, { price: Number(v) })}
            autoComplete="off"
          />
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div style={{ width: 72 }}>
          <TextField
            label="Qty"
            labelHidden
            type="number"
            min={1}
            value={String(l.qty ?? '')}
            onChange={(v) => patchLine(i, { qty: Number(v) })}
            autoComplete="off"
          />
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" alignment="end">
          {money((Number(l.price) || 0) * (Number(l.qty) || 0))}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button icon={XIcon} variant="tertiary" accessibilityLabel="Remove line" onClick={() => removeLine(i)} />
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      backAction={{ content: 'Submission list', onAction: () => dispatch({ type: 'NAVIGATE', view: 'submissionList' }) }}
      title="Create quote"
      primaryAction={{ content: 'Create quote', disabled: !canCreate, onAction: cqCreate }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Box padding="300">
              <InlineStack align="space-between" blockAlign="center" wrap>
                <Text as="h2" variant="headingSm">
                  Products
                </Text>
                <ButtonGroup>
                  <Button
                    variant="primary"
                    icon={PlusIcon}
                    disabled={!customer}
                    onClick={() => setPicker({ mode: 'priced', templateId: null, picks: {}, search: '' })}
                  >
                    Add custom priced items
                  </Button>
                  <Button onClick={() => setPicker({ mode: 'catalog', templateId: '__catalog__', picks: {}, search: '' })}>
                    Add product
                  </Button>
                  <Button
                    onClick={() => setLines([...lines, { custom: true, title: '', price: 0, qty: 1 }])}
                  >
                    Add custom item
                  </Button>
                </ButtonGroup>
              </InlineStack>
            </Box>
            {lines.length === 0 ? (
              <Box padding="400">
                <EmptyState heading="No products yet" image="">
                  <p>Add priced items from the company’s pricing, a product from the catalog, or a custom item.</p>
                </EmptyState>
              </Box>
            ) : (
              <>
                <IndexTable
                  resourceName={{ singular: 'line', plural: 'lines' }}
                  itemCount={lines.length}
                  selectable={false}
                  headings={[
                    { title: 'Product' },
                    { title: 'Price' },
                    { title: 'Qty' },
                    { title: 'Total', alignment: 'end' },
                    { title: '' },
                  ]}
                >
                  {lineRows}
                </IndexTable>
                <Box padding="300">
                  <InlineStack align="end" gap="200">
                    <Text as="span" tone="subdued">
                      Subtotal
                    </Text>
                    <Text as="span" fontWeight="semibold">
                      {money(subtotal)}
                    </Text>
                  </InlineStack>
                </Box>
              </>
            )}
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Customer
                </Text>
                {!customer ? (
                  <Select
                    label="Choose a customer"
                    labelHidden
                    placeholder="Select a customer…"
                    options={RFQ_CUSTOMERS.map((c) => ({ label: `${c.name} — ${c.company}`, value: c.key }))}
                    value=""
                    onChange={pickCustomer}
                  />
                ) : (
                  <>
                    <LockedCustomerCard customer={customer} />
                    <Divider />
                    <TextField
                      label="Message"
                      multiline={3}
                      value={cq.message}
                      onChange={(v) => dispatch({ type: 'CQ_PATCH', patch: { message: v } })}
                      autoComplete="off"
                    />
                  </>
                )}
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm">
                  Due date
                </Text>
                <TextField
                  label="Due date"
                  labelHidden
                  type="date"
                  value={cq.dueDate}
                  onChange={(v) => dispatch({ type: 'CQ_PATCH', patch: { dueDate: v } })}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      {picker && (
        <PickerModal
          picker={picker}
          setPicker={setPicker}
          customer={customer}
          onAdd={(additions) => {
            mergeLines(additions);
            setPicker(null);
          }}
        />
      )}
    </Page>
  );
}

// ---- Product pickers (priced templates 2-step, or catalog) ----
function PickerModal({ picker, setPicker, customer, onAdd }) {
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
          <BlockStack gap="200">
            <Text as="p" tone="subdued" variant="bodySm">
              Choose a base pricing attached to {customer?.company} in Shopify, then pick products.
            </Text>
            {templates.length === 0 ? (
              <Text as="p" tone="subdued">
                No base pricing attached to this company.
              </Text>
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
      </IndexTable.Row>
    );
  });

  const headings = isCat
    ? [{ title: '' }, { title: 'Product' }, { title: 'Available' }, { title: 'Price' }]
    : [{ title: '' }, { title: 'Product' }, { title: 'Price' }];

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
