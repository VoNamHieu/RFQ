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
  Checkbox,
  Icon,
  Popover,
  ActionList,
} from '@shopify/polaris';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { PlusIcon, XIcon, ChevronDownIcon, ChevronRightIcon } from '@shopify/polaris-icons';
import { useStore, handoffCompanyToB2B } from '../store.jsx';
import { activeVersion } from '../../shared/versions.js';
import { money, subtotalOf } from '../utils.js';
import {
  RFQ_CATALOG,
  RFQ_TEMPLATE_PRODUCTS,
  RFQ_CUSTOMERS,
  RFQ_PRICING_OPTIONS,
} from '../data/catalog.js';
import { shopifyCompanyDirectory } from '../data/companies.js';
import { PickerModal } from '../components/PickerModal.jsx';
import { CatalogPickerModal } from '../components/CatalogPickerModal.jsx';
import { CustomItemModal } from '../components/CustomItemModal.jsx';
import { ProductPickerModal } from '../components/ProductPickerModal.jsx';

const catBySku = (sku) => RFQ_CATALOG.find((p) => p.sku === sku);
const lineTitle = (l) => l.title || catBySku(l.sku)?.title || l.sku;

// Whole-store products, normalized for the shared ProductPickerModal (list price).
const STORE_PRODUCTS = RFQ_CATALOG.map((p) => ({
  sku: p.sku,
  title: p.title,
  stock: p.stock,
  variants: (p.variants || []).map((v) => ({ id: v.id, title: v.title, price: v.list, stock: v.stock })),
}));

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
  // Variants already on the quote — the pickers show these as "Added" (locked).
  const quoteVariantIds = new Set(lines.map((l) => l.sku).filter(Boolean));
  const subtotal = subtotalOf(lines.map((l) => ({ price: l.price, qty: l.qty })));

  // B2B pricing status for the selected company (mirrors the B2B app). If the
  // company has no base pricing, prompt the merchant to set it up in the B2B app.
  const company = customer ? shopifyCompanyDirectory[customer.companyKey] : null;
  const companyInB2B = company?.inB2B === true; // already managed in the B2B app
  // A real B2B company: managed in the app, or a Shopify company that can be
  // synced. inB2B === false explicitly marks a plain retail requester (e.g. Vo
  // Hieu / Hieu Sports Retail) — not B2B, so it isn't pushed into B2B setup.
  const isB2BCompany = !!company && company.inB2B !== false;
  const companyHasPricing = customer ? (RFQ_PRICING_OPTIONS[customer.companyKey] || []).length > 0 : true;
  // Whether the Wholesale B2B app is installed for this customer's company (mock
  // flag on the company; defaults to installed). Drives the modal's warning copy.
  const appInstalled = company ? company.b2bAppInstalled !== false : true;

  const [picker, setPicker] = useState(null); // {mode:'priced'|'catalog', templateId, picks:{}, search}
  const [changingCustomer, setChangingCustomer] = useState(false); // re-open the customer picker after selection
  const [pendingCustomerKey, setPendingCustomerKey] = useState(null); // confirm reset when switching company with lines
  const [catalogPicker, setCatalogPicker] = useState(false); // Shopify B2B catalog picker
  const [addMenu, setAddMenu] = useState(false); // "Add product" source menu (catalog / whole store)
  const [storePicker, setStorePicker] = useState(false); // whole-store (Shopify) picker
  const [customItemOpen, setCustomItemOpen] = useState(false); // "Add custom item" dialog
  const [expandedGroups, setExpandedGroups] = useState(() => new Set()); // expanded product groups (mix editing)
  const toggleGroupExpand = (sku) =>
    setExpandedGroups((s) => {
      const n = new Set(s);
      if (n.has(sku)) n.delete(sku);
      else n.add(sku);
      return n;
    });

  // Send the merchant to the B2B app to create pricing for this customer — shared
  // by the top banner and the "Add custom priced items" modal's no-pricing notice.
  const goCreatePricing = () => {
    if (!customer) return;
    if (isB2BCompany) {
      handoffCompanyToB2B(state, customer.companyKey, customer, { openPricing: true });
      return;
    }
    const v = activeVersion();
    const base = v === 'latest' ? '/b2b' : `/b2b?v=${v}`;
    window.location.href = `${base}#/b2b/pricing`;
  };

  const setLines = (next) => dispatch({ type: 'CQ_PATCH', patch: { lines: next } });
  const patchLine = (i, patch) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  // Bulk-set a field on every line index in a product group (the "group" edit).
  const patchGroup = (indices, patch) => {
    const set = new Set(indices);
    setLines(lines.map((l, k) => (set.has(k) ? { ...l, ...patch } : l)));
  };
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
    setChangingCustomer(false);
  };

  // Switching to a different company with products already added wipes the lines
  // (pricing is company-specific) — confirm first so it isn't a surprise.
  const requestPickCustomer = (key) => {
    if (customer && key !== customer.key && lines.length > 0) {
      setPendingCustomerKey(key);
      return;
    }
    pickCustomer(key);
  };

  const confirmChangeCustomer = () => {
    if (!pendingCustomerKey) return;
    setLines([]);
    pickCustomer(pendingCustomerKey);
    setPendingCustomerKey(null);
  };

  // Drop blank/invalid lines and create from the rest (legacy filters invalid).
  const isValidLine = (l) => Number(l.price) >= 0 && Number(l.qty) > 0 && (!l.custom || (l.title || '').trim());
  const canCreate = !!customer && lines.some(isValidLine);

  const cqCreate = ({ openSync = false } = {}) => {
    if (!canCreate) return;
    const id = String(1052001 + state.cqSeq);
    const valid = lines.filter(isValidLine);
    const first = valid[0];
    // A company already in the B2B app is linked (managed); one whose Wholesale B2B
    // app isn't installed gets the "uninstalled" (Install CTA) card; otherwise it's a
    // "new" relationship the merchant syncs from the quote detail's sync flow.
    const relState = companyInB2B ? 'linked' : appInstalled ? 'new' : 'uninstalled';
    const quote = {
      number: id,
      title: `Quote No.${id}`,
      scenario: relState === 'uninstalled' ? 'Merchant created — B2B app not installed' : 'Merchant created',
      received: 'Received by Aug 29 2026, 10:00 AM',
      dueDate: cq.dueDate || '',
      state: relState,
      ...(companyInB2B
        ? { linkedCompanyKey: customer.companyKey }
        : { fixedCompanyKey: customer.companyKey, syncMode: 'fixed' }),
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
      b2b: companyInB2B,
    };
    // openSync (only meaningful for a not-in-B2B company): create the quote, then
    // launch the Sync-to-B2B flow on it so the company is set up with location/role.
    dispatch({ type: 'CREATE_QUOTE', id, quote, meta, openSync: openSync && !companyInB2B && appInstalled });
  };

  // ---- Line table ----
  // A line's catalog product, for grouping variant lines under one product.
  const productOfVariant = (vid) =>
    RFQ_CATALOG.find((p) => (p.variants || []).some((v) => v.id === vid)) ||
    RFQ_CATALOG.find((p) => p.sku === vid) ||
    null;

  // Group lines by parent product so variants nest under a product header instead
  // of showing as flat rows. Custom / single-variant lines stand on their own.
  const lineGroups = [];
  const groupOf = {};
  lines.forEach((l, i) => {
    const product = l.custom ? null : productOfVariant(l.sku);
    const key = product ? `p:${product.sku}` : `l:${i}`;
    if (groupOf[key] == null) {
      groupOf[key] = lineGroups.length;
      lineGroups.push({ product, items: [] });
    }
    lineGroups[groupOf[key]].items.push({ l, i });
  });

  const productCell = (l, { title, subtitle, indent }) => (
    <div style={indent ? { paddingInlineStart: 28 } : undefined}>
      {l.custom ? (
        <BlockStack gap="050">
          <InlineStack gap="150" blockAlign="center" wrap={false}>
            <Text as="span" variant="bodyMd" fontWeight="medium">{title || 'Custom item'}</Text>
            <Badge size="small">Custom</Badge>
          </InlineStack>
          {l.physical ? (
            <Text as="span" tone="subdued" variant="bodySm">{`Physical${l.weight ? ` · ${l.weight} ${l.weightUnit}` : ''}`}</Text>
          ) : null}
        </BlockStack>
      ) : (
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd" fontWeight="medium">{title}</Text>
          <InlineStack gap="100">
            {subtitle ? <Text as="span" tone="subdued" variant="bodySm">{subtitle}</Text> : null}
            {l.priced ? <Text as="span" tone="subdued" variant="bodySm">· B2B price</Text> : null}
          </InlineStack>
        </BlockStack>
      )}
    </div>
  );

  // Price / Qty / Total / Remove cells for one editable line.
  const editCells = (l, i) => [
    <IndexTable.Cell key="price">
      <div style={{ width: 96 }}>
        <TextField label="Price" labelHidden type="number" min={0} prefix="$" value={String(l.price ?? '')} onChange={(v) => patchLine(i, { price: Number(v) })} autoComplete="off" />
      </div>
    </IndexTable.Cell>,
    <IndexTable.Cell key="qty">
      <div style={{ width: 72 }}>
        <TextField label="Qty" labelHidden type="number" min={1} value={String(l.qty ?? '')} onChange={(v) => patchLine(i, { qty: Number(v) })} autoComplete="off" />
      </div>
    </IndexTable.Cell>,
    <IndexTable.Cell key="total">
      <Text as="span" alignment="end">{money((Number(l.price) || 0) * (Number(l.qty) || 0))}</Text>
    </IndexTable.Cell>,
    <IndexTable.Cell key="remove">
      <Button icon={XIcon} variant="tertiary" accessibilityLabel="Remove line" onClick={() => removeLine(i)} />
    </IndexTable.Cell>,
  ];

  const lineRows = [];
  let rowPos = 0;
  lineGroups.forEach((g) => {
    const { product, items } = g;
    const isVariantGroup = product && (items.length > 1 || items[0].l.sku !== product.sku);
    if (!isVariantGroup) {
      const { l, i } = items[0];
      lineRows.push(
        <IndexTable.Row id={`l-${i}`} key={`l-${i}`} position={rowPos++}>
          <IndexTable.Cell>{productCell(l, { title: l.custom ? l.title || 'Custom item' : lineTitle(l), subtitle: l.sku })}</IndexTable.Cell>
          {editCells(l, i)}
        </IndexTable.Row>,
      );
      return;
    }
    // Collapsible product header. Its Price/Qty bulk-set every variant (the "group"
    // edit) and show "Mixed" when the variants differ; expand to edit each variant
    // (the "mix" edit) — mirroring the B2B product-override card.
    const groupTotal = items.reduce((s, it) => s + (Number(it.l.price) || 0) * (Number(it.l.qty) || 0), 0);
    const groupSkus = new Set(items.map((it) => it.l.sku));
    const indices = items.map((it) => it.i);
    const prices = items.map((it) => Number(it.l.price));
    const qtys = items.map((it) => Number(it.l.qty));
    const sameP = prices.every((x) => x === prices[0]);
    const sameQ = qtys.every((x) => x === qtys[0]);
    const isExp = expandedGroups.has(product.sku);
    lineRows.push(
      <IndexTable.Row id={`h-${product.sku}`} key={`h-${product.sku}`} position={rowPos++}>
        <IndexTable.Cell>
          <button type="button" onClick={() => toggleGroupExpand(product.sku)} style={{ all: 'unset', cursor: 'pointer', display: 'block', minWidth: 0 }}>
            <InlineStack gap="150" blockAlign="center" wrap={false}>
              <span style={{ display: 'flex' }}><Icon source={isExp ? ChevronDownIcon : ChevronRightIcon} tone="subdued" /></span>
              <BlockStack gap="050">
                <Text as="span" variant="bodyMd" fontWeight="semibold">{product.title}</Text>
                <Text as="span" tone="subdued" variant="bodySm">{`${items.length} variants${isExp ? '' : sameP ? '' : ' · Mixed prices'}`}</Text>
              </BlockStack>
            </InlineStack>
          </button>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ width: 96 }}>
            <TextField label="Group price" labelHidden type="number" min={0} prefix="$" value={sameP ? String(prices[0] ?? '') : ''} placeholder={sameP ? undefined : 'Mixed'} onChange={(v) => patchGroup(indices, { price: Number(v) })} autoComplete="off" />
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ width: 72 }}>
            <TextField label="Group qty" labelHidden type="number" min={1} value={sameQ ? String(qtys[0] ?? '') : ''} placeholder={sameQ ? undefined : 'Mixed'} onChange={(v) => patchGroup(indices, { qty: Number(v) })} autoComplete="off" />
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" alignment="end" fontWeight="medium">{money(groupTotal)}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button icon={XIcon} variant="tertiary" accessibilityLabel={`Remove all ${product.title} variants`} onClick={() => setLines(lines.filter((x) => !groupSkus.has(x.sku)))} />
        </IndexTable.Cell>
      </IndexTable.Row>,
    );
    // Indented variant sub-rows — only when expanded (the "mix" per-variant edit).
    if (isExp) {
      items.forEach(({ l, i }) => {
        const variant = product.variants?.find((v) => v.id === l.sku);
        const vTitle = variant?.title || (l.title || '').split(' — ').slice(1).join(' — ') || l.sku;
        lineRows.push(
          <IndexTable.Row id={`l-${i}`} key={`l-${i}`} position={rowPos++}>
            <IndexTable.Cell>{productCell(l, { title: vTitle, subtitle: l.sku, indent: true })}</IndexTable.Cell>
            {editCells(l, i)}
          </IndexTable.Row>,
        );
      });
    }
  });

  return (
    <Page
      fullWidth
      backAction={{ content: 'Submission list', onAction: () => dispatch({ type: 'NAVIGATE', view: 'submissionList' }) }}
      title="Create quote"
      primaryAction={{ content: 'Create quote', disabled: !canCreate, onAction: () => cqCreate() }}
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
                    icon={PlusIcon}
                    disabled={!customer}
                    onClick={() => setPicker({ mode: 'priced', templateId: null, picks: {}, search: '' })}
                  >
                    Add custom priced items
                  </Button>
                  {/* Add product = the whole Shopify store (list price), a direct button. */}
                  <Button onClick={() => setStorePicker(true)}>Add product</Button>
                  {/* Secondary sources grouped under "More actions". */}
                  <Popover
                    active={addMenu}
                    onClose={() => setAddMenu(false)}
                    preferredAlignment="left"
                    activator={
                      <Button disclosure onClick={() => setAddMenu((v) => !v)}>
                        More actions
                      </Button>
                    }
                  >
                    <ActionList
                      items={[
                        {
                          content: 'Add product from catalog',
                          helpText: 'The company’s Shopify catalog',
                          disabled: !customer,
                          onAction: () => {
                            setAddMenu(false);
                            setCatalogPicker(true);
                          },
                        },
                        {
                          content: 'Add custom item',
                          helpText: 'A free-form line with your own price',
                          onAction: () => {
                            setAddMenu(false);
                            setCustomItemOpen(true);
                          },
                        },
                      ]}
                    />
                  </Popover>
                </ButtonGroup>
              </InlineStack>
            </Box>
            {lines.length === 0 ? (
              <Box padding="400">
                <EmptyBlock heading="No products yet">
                  Add priced items from the company’s pricing, a product from the catalog, or a custom item.
                </EmptyBlock>
              </Box>
            ) : (
              <>
                <IndexTable
                  resourceName={{ singular: 'line', plural: 'lines' }}
                  itemCount={lineRows.length}
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
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">
                    Customer
                  </Text>
                  {customer &&
                    (changingCustomer ? (
                      <Button variant="plain" onClick={() => setChangingCustomer(false)}>
                        Cancel
                      </Button>
                    ) : (
                      <Button variant="plain" disabled={lines.length > 0} onClick={() => setChangingCustomer(true)}>
                        Change
                      </Button>
                    ))}
                </InlineStack>
                {!customer || changingCustomer ? (
                  <Select
                    label="Choose a customer"
                    labelHidden
                    placeholder="Select a customer…"
                    options={RFQ_CUSTOMERS.map((c) => ({ label: `${c.name} — ${c.company}`, value: c.key }))}
                    value={customer?.key || ''}
                    onChange={requestPickCustomer}
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
          appInstalled={appInstalled}
          onCreatePricing={goCreatePricing}
          onAdd={(additions) => {
            mergeLines(additions);
            setPicker(null);
          }}
        />
      )}
      <CustomItemModal
        open={customItemOpen}
        onClose={() => setCustomItemOpen(false)}
        onAdd={(line) => {
          setLines([...lines, line]);
          setCustomItemOpen(false);
        }}
      />
      {catalogPicker && (
        <CatalogPickerModal
          customer={customer}
          initialSelected={quoteVariantIds}
          onPickFromStore={() => {
            setCatalogPicker(false);
            setStorePicker(true);
          }}
          onCreateCatalog={() => window.open('https://admin.shopify.com/settings/markets', '_blank', 'noopener,noreferrer')}
          onClose={() => setCatalogPicker(false)}
          onAdd={(additions) => {
            mergeLines(additions);
            setCatalogPicker(false);
          }}
        />
      )}
      {storePicker && (
        <ProductPickerModal
          title="Add products"
          products={STORE_PRODUCTS}
          priceHeader="Price"
          initialSelected={quoteVariantIds}
          onClose={() => setStorePicker(false)}
          onAdd={(additions) => {
            mergeLines(additions);
            setStorePicker(false);
          }}
        />
      )}
      {pendingCustomerKey && (
        <Modal
          open
          onClose={() => setPendingCustomerKey(null)}
          title="Change company?"
          primaryAction={{ content: 'Change and clear items', destructive: true, onAction: confirmChangeCustomer }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setPendingCustomerKey(null) }]}
        >
          <Modal.Section>
            <Text as="p">
              Switching to {RFQ_CUSTOMERS.find((c) => c.key === pendingCustomerKey)?.company} will remove the{' '}
              {lines.length} product{lines.length === 1 ? '' : 's'} you’ve added, because pricing is specific to each
              company.
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}

// ---- Product pickers (priced templates 2-step, or catalog) ----
