import React, { useState } from 'react';
import {
  Page,
  Card,
  Layout,
  Text,
  BlockStack,
  InlineStack,
  Divider,
  Box,
  Button,
  ButtonGroup,
  TextField,
  Icon,
  Link,
  Collapsible,
  Popover,
  ActionList,
} from '@shopify/polaris';
import {
  MenuHorizontalIcon,
  DeleteIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PersonIcon,
  ProductIcon,
  PlusCircleIcon,
  PlusIcon,
  MagicIcon,
} from '@shopify/polaris-icons';
import { useStore, handoffToB2B, handoffCompanyToB2B, managedCompanyKeyForEmail } from '../store.jsx';
import { money, money2 } from '../utils.js';
import { shopifyCompanyDirectory } from '../data/companies.js';
import { RFQ_CATALOG, RFQ_CUSTOMERS } from '../data/catalog.js';
import { PickerModal } from '../components/PickerModal.jsx';
import { CatalogPickerModal } from '../components/CatalogPickerModal.jsx';
import { CustomItemModal } from '../components/CustomItemModal.jsx';
import { ProductPickerModal } from '../components/ProductPickerModal.jsx';
import { SaveToB2B } from '../components/SaveToB2B.jsx';
import { B2BRelationshipCard, SyncFlowModals, CreateCompanyModal, CompanyCreatedModal } from '../components/B2BRelationship.jsx';
import { versionFlags, activeVersion } from '../../shared/versions.js';

// Whole-store products, normalized for the shared ProductPickerModal (list price).
// Mirrors CreateQuote's STORE_PRODUCTS so the "Add product" picker is identical.
const STORE_PRODUCTS = RFQ_CATALOG.map((p) => ({
  sku: p.sku,
  title: p.title,
  stock: p.stock,
  variants: (p.variants || []).map((v) => ({ id: v.id, title: v.title, price: v.list, stock: v.stock })),
}));

function quoteCompanyKey(quote) {
  return (
    quote.linkedCompanyKey ||
    quote.fixedCompanyKey ||
    quote.syncedCompanyKey ||
    quote.recommendedKey ||
    quote.previewCompanyKey ||
    null
  );
}

// Small placeholder product thumbnail (no external image — CSP-safe).
function Thumb() {
  return (
    <Box background="bg-surface-secondary" borderRadius="200" borderWidth="025" borderColor="border" width="40px" minHeight="40px">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40 }}>
        <Icon source={ProductIcon} tone="subdued" />
      </div>
    </Box>
  );
}

// Left column: the editable Products card (spec §5.4 renderQuote).
function ProductsCard({ quote, lines, setLines, dispatch, showSavePrices, onSavePrices }) {
  const { state } = useStore();
  const setLine = (i, patch) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const removeLine = (i) => setLines(lines.filter((_, k) => k !== i));
  const [skuOpen, setSkuOpen] = useState(() => new Set());
  const toggleSku = (i) => setSkuOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  // ---- Add-product options ported from Create quote (states copied as-is) ----
  const [picker, setPicker] = useState(null); // {mode:'priced'|'catalog', templateId, picks:{}, search}
  const [catalogPicker, setCatalogPicker] = useState(false); // Shopify B2B catalog picker
  const [addMenu, setAddMenu] = useState(false); // "More actions" source menu
  const [storePicker, setStorePicker] = useState(false); // whole-store (Shopify) picker
  const [customItemOpen, setCustomItemOpen] = useState(false); // "Add custom item" dialog

  // The quote's customer/company, resolved to an RFQ customer so the pickers behave
  // exactly like Create quote (B2B pricing options, catalog, no-pricing handoff).
  const custEmail = quote?.customer?.email;
  const customer =
    RFQ_CUSTOMERS.find((c) => c.email === custEmail) ||
    RFQ_CUSTOMERS.find((c) => c.companyKey === quoteCompanyKey(quote)) ||
    null;
  const company = customer ? shopifyCompanyDirectory[customer.companyKey] : null;
  const companyInB2B = company?.inB2B === true; // already managed in the B2B app
  const isB2BCompany = !!company && company.inB2B !== false;
  const appInstalled = company ? company.b2bAppInstalled !== false : true;

  // Variants already on the quote, keyed by sku → which option added the line and its
  // price, so the pickers can mark "Added". One price per sku — the last pick wins.
  const quoteBySku = new Map(
    lines
      .filter((l) => l.sku)
      .map((l) => [l.sku, { source: l.source, sourceRef: l.sourceRef ?? null, sourceLabel: l.sourceLabel, price: l.price }]),
  );

  // Send the merchant to the B2B app to create pricing for this customer.
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

  // Apply a picker result: drop unticked lines, then apply picks. An override replaces a
  // line's price/source but keeps its quantity; a plain re-add accumulates quantity.
  const mergeLines = (additions, removals = []) => {
    const removeSet = new Set(removals);
    const next = lines.filter((l) => !removeSet.has(l.sku));
    additions.forEach((add) => {
      const { override, ...line } = add;
      const j = line.sku ? next.findIndex((l) => l.sku === line.sku) : -1;
      if (j >= 0 && override) next[j] = { ...next[j], ...line, qty: next[j].qty };
      else if (j >= 0) next[j] = { ...next[j], ...line, qty: (Number(next[j].qty) || 0) + (Number(line.qty) || 1) };
      else next.push(line);
    });
    setLines(next);
  };

  return (
    <>
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">Products</Text>
          <Button icon={MenuHorizontalIcon} variant="tertiary" accessibilityLabel="Product actions" onClick={() => dispatch({ type: 'TOAST', message: 'Product actions' })} />
        </InlineStack>

        <InlineStack align="end">
          <ButtonGroup>
            <Button
              icon={PlusIcon}
              disabled={!customer}
              onClick={() => setPicker({ mode: 'priced', templateId: null, picks: {}, search: '' })}
            >
              Add B2B price
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

        <InlineStack gap="300" blockAlign="center">
          <Box width="44%"><Text as="span" tone="subdued" variant="bodySm">Product</Text></Box>
          <Box width="16%"><Text as="span" tone="subdued" variant="bodySm">Quantity</Text></Box>
          <Box width="20%"><Text as="span" tone="subdued" variant="bodySm">Quoted Price</Text></Box>
          <Box width="12%"><Text as="span" tone="subdued" variant="bodySm">Total</Text></Box>
        </InlineStack>
        <Divider />

        <BlockStack gap="0">
          {lines.map((l, i) => {
            const price = Number(l.price) || 0;
            const qty = Number(l.qty ?? l.quantity ?? 1) || 0;
            return (
              <Box key={i} paddingBlock="150" borderBlockEndWidth="025" borderColor="border">
                <InlineStack gap="300" blockAlign="start" wrap={false}>
                  <Box width="44%">
                    <InlineStack gap="200" blockAlign="start" wrap={false}>
                      <Thumb />
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="medium">{l.title || 'Custom item'}</Text>
                        {l.sku ? <Text as="span" tone="subdued" variant="bodySm">{l.sku}</Text> : null}
                        <InlineStack gap="150" blockAlign="center">
                          <Text as="span" variant="bodyMd" tone="magic">{money(price)}</Text>
                          {l.compareAt && Number(l.compareAt) !== price ? (
                            <Text as="span" tone="subdued" variant="bodySm" textDecorationLine="line-through">{money(l.compareAt)}</Text>
                          ) : null}
                        </InlineStack>
                        {l.sku ? (
                          <InlineStack gap="050" blockAlign="center">
                            <Text as="span" tone="subdued" variant="bodySm">{`SKU: ${l.sku}`}</Text>
                            <Button variant="tertiary" disclosure={skuOpen.has(i) ? 'up' : 'down'} accessibilityLabel="Variant details" onClick={() => toggleSku(i)} />
                          </InlineStack>
                        ) : null}
                        <Collapsible id={`sku-${i}`} open={skuOpen.has(i)}>
                          <Text as="span" tone="subdued" variant="bodySm">Variant details for {l.sku}.</Text>
                        </Collapsible>
                        <Box>
                          <Button variant="plain" icon={PlusCircleIcon} onClick={() => dispatch({ type: 'TOAST', message: 'Add property' })}>
                            Add property
                          </Button>
                        </Box>
                      </BlockStack>
                    </InlineStack>
                  </Box>
                  <Box width="16%">
                    <TextField label="Quantity" labelHidden type="number" min={1} value={String(qty)} onChange={(v) => setLine(i, { qty: Math.max(1, Number(v) || 1) })} autoComplete="off" />
                  </Box>
                  <Box width="20%">
                    <TextField label="Quoted price" labelHidden type="number" min={0} prefix="$" value={String(price)} onChange={(v) => setLine(i, { price: Number(v) || 0 })} autoComplete="off" />
                  </Box>
                  <Box width="12%"><Text as="span" variant="bodyMd">{money(price * qty)}</Text></Box>
                  <Button icon={DeleteIcon} variant="tertiary" accessibilityLabel="Remove line" onClick={() => removeLine(i)} />
                </InlineStack>
              </Box>
            );
          })}
        </BlockStack>

        {showSavePrices && (
          <Box paddingBlockStart="200">
            <InlineStack align="end">
              <Button onClick={onSavePrices}>Save prices to B2B</Button>
            </InlineStack>
          </Box>
        )}
      </BlockStack>
    </Card>

    {picker && (
      <PickerModal
        picker={picker}
        setPicker={setPicker}
        customer={customer}
        appInstalled={appInstalled}
        onQuote={quoteBySku}
        onCreatePricing={goCreatePricing}
        onAdd={(additions, removals) => {
          mergeLines(additions, removals);
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
        onQuote={quoteBySku}
        onPickFromStore={() => {
          setCatalogPicker(false);
          setStorePicker(true);
        }}
        onCreateCatalog={() => window.open('https://admin.shopify.com/settings/markets', '_blank', 'noopener,noreferrer')}
        onClose={() => setCatalogPicker(false)}
        onAdd={(additions, removals) => {
          mergeLines(additions, removals);
          setCatalogPicker(false);
        }}
      />
    )}
    {storePicker && (
      <ProductPickerModal
        title="Add products"
        products={STORE_PRODUCTS}
        priceHeader="Price"
        onQuote={quoteBySku}
        option={{ source: 'store', sourceRef: null, label: 'Store list price' }}
        onClose={() => setStorePicker(false)}
        onAdd={(additions, removals) => {
          mergeLines(additions, removals);
          setStorePicker(false);
        }}
      />
    )}
    </>
  );
}

// Left column: Payment information with the add-discount/shipping/tax/deposit rows.
function PaymentCard({ subtotal, dispatch, onSendProposal }) {
  const AddRow = ({ label, value }) => (
    <InlineStack align="space-between" blockAlign="center">
      <Link onClick={() => dispatch({ type: 'TOAST', message: `${label} — demo only` })}>{label}</Link>
      <InlineStack gap="600" blockAlign="center">
        <Text as="span" tone="subdued" variant="bodySm">--</Text>
        <Box minWidth="72px">
          <Text as="span" alignment="end">{value}</Text>
        </Box>
      </InlineStack>
    </InlineStack>
  );
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingSm">Payment Information</Text>
        <Box borderColor="border" borderWidth="025" borderRadius="200" padding="300">
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="span" fontWeight="semibold">Subtotal</Text>
              <Text as="span" fontWeight="semibold">{money2(subtotal)}</Text>
            </InlineStack>
            <AddRow label="Add discount" value={`-${money2(0)}`} />
            <AddRow label="Add shipping" value={money2(0)} />
            <AddRow label="Add tax" value={money2(0)} />
            <AddRow label="Add deposit" value={money2(0)} />
            <Divider />
            <InlineStack align="space-between">
              <Text as="span" variant="bodyMd" fontWeight="semibold">Total</Text>
              <Text as="span" variant="bodyMd" fontWeight="semibold">{money2(subtotal)}</Text>
            </InlineStack>
          </BlockStack>
        </Box>
        <InlineStack align="end">
          <Button onClick={onSendProposal}>Send Proposal Email</Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

// Right column: Customer card (email + collapsible info + message).
function CustomerCard({ quote }) {
  const { state } = useStore();
  const [open, setOpen] = useState(true);
  const customer = quote.customer || {};
  // Fall back to the company this customer is already managed under (via another
  // quote), so their company shows consistently even on a not-yet-linked quote.
  const managedKey = managedCompanyKeyForEmail(state.quotes, customer.email);
  const companyKey = quoteCompanyKey(quote) || managedKey;
  const company = companyKey ? shopifyCompanyDirectory[companyKey] : null;
  // Once the customer is a managed B2B buyer, the panel reads as Company info.
  const isCompanyView = !!company && (quote.state === 'shopifySynced' || quote.state === 'linked' || !!managedKey);
  const shipLines = String(customer.shipping || 'Not provided').split('\n');

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">{isCompanyView ? 'Company' : 'Customer'}</Text>
          <Button icon={MenuHorizontalIcon} variant="tertiary" accessibilityLabel="Customer actions" />
        </InlineStack>

        <TextField label="Email address" value={customer.email || ''} disabled autoComplete="off" />

        <Box borderColor="border" borderWidth="025" borderRadius="200">
          <Box padding="300">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              style={{ all: 'unset', cursor: 'pointer', width: '100%' }}
            >
              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="headingSm">{isCompanyView ? 'Company Information' : 'Customer Information'}</Text>
                <Icon source={open ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
              </InlineStack>
            </button>
          </Box>
          <Collapsible id="customer-info" open={open}>
            <Box padding="300" paddingBlockStart="0">
              <BlockStack gap="300">
                {isCompanyView ? (
                  <>
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="medium">{company.name}</Text>
                      {company.shopifyId ? (
                        <Text as="span" tone="subdued" variant="bodySm">{`Shopify company ${company.shopifyId}`}</Text>
                      ) : null}
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text as="span" tone="subdued" variant="bodySm">Contact person</Text>
                      <Text as="span" variant="bodyMd">{customer.name}</Text>
                      <Text as="span" tone="subdued" variant="bodySm">{customer.email}</Text>
                    </BlockStack>
                  </>
                ) : (
                  <>
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="medium">{customer.name}</Text>
                      <Text as="span" tone="subdued" variant="bodySm">{customer.email}</Text>
                    </BlockStack>
                    {company ? (
                      <BlockStack gap="050">
                        <Text as="span" tone="subdued" variant="bodySm">Company</Text>
                        <Text as="span" variant="bodyMd">{company.name}</Text>
                      </BlockStack>
                    ) : null}
                  </>
                )}
                <BlockStack gap="050">
                  <Text as="span" tone="subdued" variant="bodySm">Shipping address</Text>
                  <BlockStack gap="0">
                    <Text as="span" variant="bodyMd">{customer.name}</Text>
                    {shipLines.map((line, i) => (
                      <Text as="span" key={i} variant="bodyMd">{line}</Text>
                    ))}
                  </BlockStack>
                </BlockStack>
              </BlockStack>
            </Box>
          </Collapsible>
        </Box>

        <BlockStack gap="100">
          <Text as="span" tone="subdued" variant="bodySm">Message</Text>
          <TextField label="Message" labelHidden multiline={3} value={customer.message || ''} readOnly autoComplete="off" />
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

function AiCard({ dispatch }) {
  return (
    <Card>
      <BlockStack gap="200">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'flex', flex: '0 0 auto' }}>
            <Icon source={MagicIcon} tone="magic" />
          </span>
          <Text as="h2" variant="headingSm">AI quote analysis</Text>
        </div>
        <Text as="p" tone="subdued" variant="bodySm">
          Analyze this quote with AI: customer history, margin and the safest price to offer.
        </Text>
        <Button fullWidth icon={MagicIcon} onClick={() => dispatch({ type: 'TOAST', message: 'Analyzing quote…' })}>
          Analyze quote
        </Button>
      </BlockStack>
    </Card>
  );
}

export function QuoteDetail() {
  const { state, dispatch } = useStore();
  const [saveOpen, setSaveOpen] = useState(false);
  const quote = state.quotes[state.currentQuoteId];
  const initialLines =
    quote && quote.lines && quote.lines.length
      ? quote.lines.map((l) => ({ ...l }))
      : quote
      ? [{ title: quote.product?.name, sku: quote.product?.sku, price: quote.product?.price, qty: quote.product?.quantity ?? 1 }]
      : [];
  const [lines, setLines] = useState(initialLines);
  if (!quote) return null;

  const isDealClosed = state.meta[state.currentQuoteId]?.status === 'Deal Closed' && versionFlags().priceCrossSync;
  const subtotal = lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty ?? l.quantity) || 0), 0);

  return (
    <>
      <Page
        backAction={{ content: 'Submission list', onAction: () => dispatch({ type: 'NAVIGATE', view: 'submissionList' }) }}
        title={`Quote No.${quote.number}`}
        subtitle={quote.received || undefined}
        primaryAction={{ content: 'Create draft order' }}
        secondaryActions={[
          { content: '', icon: PersonIcon, accessibilityLabel: 'Assign', onAction: () => {} },
          { content: 'Duplicate' },
          { content: 'More actions', disclosure: true },
        ]}
      >
        <Layout>
          <Layout.Section>
            <BlockStack gap="300">
              <ProductsCard
                quote={quote}
                lines={lines}
                setLines={setLines}
                dispatch={dispatch}
                showSavePrices={isDealClosed}
                onSavePrices={() => setSaveOpen(true)}
              />
              <PaymentCard
                subtotal={subtotal}
                dispatch={dispatch}
                onSendProposal={() => dispatch({ type: 'TOAST', message: 'Proposal email sent' })}
              />
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="300">
              <CustomerCard quote={quote} />
              <B2BRelationshipCard quote={quote} />
              <AiCard dispatch={dispatch} />
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>
      {saveOpen && (
        <SaveToB2B
          quote={quote}
          onClose={() => setSaveOpen(false)}
          onDone={(result) => {
            setSaveOpen(false);
            const transfer = result
              ? {
                  targetId: result.dest,
                  newName: result.dest === '__new__' ? result.newName || `Quote ${quote.number} prices` : '',
                  newPriority: result.newPriority ?? 1,
                  status: result.status || 'Active',
                }
              : null;
            handoffToB2B(state, quote.number, { pricingTransfer: transfer, lines: result?.lines });
          }}
        />
      )}
      <SyncFlowModals />
      <CreateCompanyModal />
      <CompanyCreatedModal />
    </>
  );
}
