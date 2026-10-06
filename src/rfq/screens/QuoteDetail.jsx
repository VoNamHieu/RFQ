import React, { useState } from 'react';
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
import { useWcId, PageHeader } from '../../shared/wc.jsx';

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
    <s-box background="subdued" borderRadius="base" border="base" inlineSize="40px" minBlockSize="40px">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40 }}>
        <s-icon type="product" color="subdued" />
      </div>
    </s-box>
  );
}

// "More actions" source menu (Polaris React Popover + ActionList with help text):
// each entry is a two-line clickable row that also closes the popover.
function MoreSourcesMenu({ items }) {
  const id = useWcId('more-sources');
  return (
    <>
      <s-button commandFor={id}>More actions</s-button>
      <s-popover id={id}>
        <s-box padding="small-300">
          <s-stack gap="none">
            {items.map((it) => (
              <s-clickable
                key={it.content}
                commandFor={id}
                command="--hide"
                disabled={it.disabled}
                paddingInline="small-200"
                paddingBlock="small-300"
                borderRadius="base"
                onClick={it.onAction}
              >
                <s-paragraph>{it.content}</s-paragraph>
                <s-paragraph color="subdued" fontSize="small">
                  {it.helpText}
                </s-paragraph>
              </s-clickable>
            ))}
          </s-stack>
        </s-box>
      </s-popover>
    </>
  );
}

// Product / Quantity / Quoted Price / Total / remove — shared by the header and rows.
const LINE_COLUMNS = 'minmax(0, 44fr) minmax(0, 16fr) minmax(0, 20fr) minmax(0, 12fr) 32px';

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
    <s-section>
      <s-stack gap="small-200">
        <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
          <s-heading>Products</s-heading>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Product actions" onClick={() => dispatch({ type: 'TOAST', message: 'Product actions' })} />
        </s-grid>

        <s-stack direction="inline" gap="small-200" justifyContent="end">
          <s-button
            icon="plus"
            disabled={!customer}
            onClick={() => setPicker({ mode: 'priced', templateId: null, picks: {}, search: '' })}
          >
            Add B2B price
          </s-button>
          {/* Add product = the whole Shopify store (list price), a direct button. */}
          <s-button onClick={() => setStorePicker(true)}>Add product</s-button>
          {/* Secondary sources grouped under "More actions". */}
          <MoreSourcesMenu
            items={[
              {
                content: 'Add product from catalog',
                helpText: 'The company’s Shopify catalog',
                disabled: !customer,
                onAction: () => setCatalogPicker(true),
              },
              {
                content: 'Add custom item',
                helpText: 'A free-form line with your own price',
                onAction: () => setCustomItemOpen(true),
              },
            ]}
          />
        </s-stack>

        <s-grid gridTemplateColumns={LINE_COLUMNS} gap="small" alignItems="center">
          <s-text color="subdued" fontSize="small">Product</s-text>
          <s-text color="subdued" fontSize="small">Quantity</s-text>
          <s-text color="subdued" fontSize="small">Quoted Price</s-text>
          <s-text color="subdued" fontSize="small">Total</s-text>
        </s-grid>
        <s-divider />

        <s-stack gap="none">
          {lines.map((l, i) => {
            const price = Number(l.price) || 0;
            const qty = Number(l.qty ?? l.quantity ?? 1) || 0;
            return (
              <div key={i} style={{ paddingBlock: 6, borderBlockEnd: '1px solid var(--p-color-border)' }}>
                <s-grid gridTemplateColumns={LINE_COLUMNS} gap="small" alignItems="start">
                  <s-grid gridTemplateColumns="auto minmax(0, 1fr)" gap="small-200" alignItems="start">
                    <Thumb />
                    <s-stack gap="small-500">
                      <s-text fontWeight="medium">{l.title || 'Custom item'}</s-text>
                      {l.sku ? <s-text color="subdued" fontSize="small">{l.sku}</s-text> : null}
                      <s-stack direction="inline" gap="small-300" alignItems="center">
                        <s-text tone="info">{money(price)}</s-text>
                        {l.compareAt && Number(l.compareAt) !== price ? (
                          <s-text color="subdued" fontSize="small"><s>{money(l.compareAt)}</s></s-text>
                        ) : null}
                      </s-stack>
                      {l.sku ? (
                        <s-stack direction="inline" gap="small-500" alignItems="center">
                          <s-text color="subdued" fontSize="small">{`SKU: ${l.sku}`}</s-text>
                          <s-button variant="tertiary" icon={skuOpen.has(i) ? 'chevron-up' : 'chevron-down'} accessibilityLabel="Variant details" onClick={() => toggleSku(i)} />
                        </s-stack>
                      ) : null}
                      {skuOpen.has(i) ? (
                        <s-text color="subdued" fontSize="small">Variant details for {l.sku}.</s-text>
                      ) : null}
                      <div>
                        <s-button variant="tertiary" icon="plus-circle" onClick={() => dispatch({ type: 'TOAST', message: 'Add property' })}>
                          Add property
                        </s-button>
                      </div>
                    </s-stack>
                  </s-grid>
                  <s-number-field label="Quantity" labelAccessibilityVisibility="exclusive" inputMode="numeric" min={1} value={String(qty)} onInput={(e) => setLine(i, { qty: Math.max(1, Number(e.currentTarget.value) || 1) })} autocomplete="off" />
                  <s-number-field label="Quoted price" labelAccessibilityVisibility="exclusive" min={0} prefix="$" value={String(price)} onInput={(e) => setLine(i, { price: Number(e.currentTarget.value) || 0 })} autocomplete="off" />
                  <s-text>{money(price * qty)}</s-text>
                  <s-button icon="delete" variant="tertiary" accessibilityLabel="Remove line" onClick={() => removeLine(i)} />
                </s-grid>
              </div>
            );
          })}
        </s-stack>

        {showSavePrices && (
          <s-stack direction="inline" justifyContent="end" paddingBlockStart="small-200">
            <s-button onClick={onSavePrices}>Save prices to B2B</s-button>
          </s-stack>
        )}
      </s-stack>
    </s-section>

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
    <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
      <div>
        <s-link onClick={() => dispatch({ type: 'TOAST', message: 'Demo only' })}>{label}</s-link>
      </div>
      <s-stack direction="inline" gap="large-200" alignItems="center">
        <s-text color="subdued" fontSize="small">--</s-text>
        <div style={{ minWidth: 72, textAlign: 'end' }}>
          <s-text>{value}</s-text>
        </div>
      </s-stack>
    </s-grid>
  );
  return (
    <s-section heading="Payment Information">
      <s-stack gap="small-200">
        <s-box border="base" borderRadius="base" padding="small">
          <s-stack gap="small-200">
            <s-grid gridTemplateColumns="1fr auto" gap="small-200">
              <s-text fontWeight="semibold">Subtotal</s-text>
              <s-text fontWeight="semibold">{money2(subtotal)}</s-text>
            </s-grid>
            <AddRow label="Add discount" value={`-${money2(0)}`} />
            <AddRow label="Add shipping" value={money2(0)} />
            <AddRow label="Add tax" value={money2(0)} />
            <AddRow label="Add deposit" value={money2(0)} />
            <s-divider />
            <s-grid gridTemplateColumns="1fr auto" gap="small-200">
              <s-text fontWeight="semibold">Total</s-text>
              <s-text fontWeight="semibold">{money2(subtotal)}</s-text>
            </s-grid>
          </s-stack>
        </s-box>
        <s-stack direction="inline" justifyContent="end">
          <s-button onClick={onSendProposal}>Send Proposal Email</s-button>
        </s-stack>
      </s-stack>
    </s-section>
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
    <s-section>
      <s-stack gap="small-200">
        <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
          <s-heading>{isCompanyView ? 'Company' : 'Customer'}</s-heading>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Customer actions" />
        </s-grid>

        <s-text-field label="Email address" value={customer.email || ''} disabled autocomplete="off" />

        <s-box border="base" borderRadius="base">
          <s-clickable padding="small" borderRadius="base" onClick={() => setOpen((v) => !v)}>
            <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
              <s-text fontWeight="semibold">{isCompanyView ? 'Company Information' : 'Customer Information'}</s-text>
              <s-icon type={open ? 'chevron-up' : 'chevron-down'} color="subdued" />
            </s-grid>
          </s-clickable>
          {open ? (
            <s-box padding="small" paddingBlockStart="none">
              <s-stack gap="small">
                {isCompanyView ? (
                  <>
                    <s-stack gap="small-500">
                      <s-text fontWeight="medium">{company.name}</s-text>
                      {company.shopifyId ? (
                        <s-text color="subdued" fontSize="small">{`Shopify company ${company.shopifyId}`}</s-text>
                      ) : null}
                    </s-stack>
                    <s-stack gap="small-500">
                      <s-text color="subdued" fontSize="small">Contact person</s-text>
                      <s-text>{customer.name}</s-text>
                      <s-text color="subdued" fontSize="small">{customer.email}</s-text>
                    </s-stack>
                  </>
                ) : (
                  <>
                    <s-stack gap="small-500">
                      <s-text fontWeight="medium">{customer.name}</s-text>
                      <s-text color="subdued" fontSize="small">{customer.email}</s-text>
                    </s-stack>
                    {company ? (
                      <s-stack gap="small-500">
                        <s-text color="subdued" fontSize="small">Company</s-text>
                        <s-text>{company.name}</s-text>
                      </s-stack>
                    ) : null}
                  </>
                )}
                <s-stack gap="small-500">
                  <s-text color="subdued" fontSize="small">Shipping address</s-text>
                  <s-stack gap="none">
                    <s-text>{customer.name}</s-text>
                    {shipLines.map((line, i) => (
                      <s-text key={i}>{line}</s-text>
                    ))}
                  </s-stack>
                </s-stack>
              </s-stack>
            </s-box>
          ) : null}
        </s-box>

        <s-stack gap="small-400">
          <s-text color="subdued" fontSize="small">Message</s-text>
          <s-text-area label="Message" labelAccessibilityVisibility="exclusive" rows={3} value={customer.message || ''} readOnly autocomplete="off" />
        </s-stack>
      </s-stack>
    </s-section>
  );
}

function AiCard({ dispatch }) {
  return (
    <s-section>
      <s-stack gap="small-200">
        <s-stack direction="inline" gap="small-300" alignItems="center">
          <s-icon type="magic" tone="info" />
          <s-heading>AI quote analysis</s-heading>
        </s-stack>
        <s-paragraph color="subdued" fontSize="small">
          Analyze this quote with AI: customer history, margin and the safest price to offer.
        </s-paragraph>
        <s-button inlineSize="fill" icon="magic" onClick={() => dispatch({ type: 'TOAST', message: 'Analyzing quote…' })}>
          Analyze quote
        </s-button>
      </s-stack>
    </s-section>
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
      <PageHeader
        backAction={{ content: 'Submission list', onAction: () => dispatch({ type: 'NAVIGATE', view: 'submissionList' }) }}
        heading={`Quote No.${quote.number}`}
        subtitle={quote.received || undefined}
        primaryAction={{ content: 'Create draft order' }}
        secondaryActions={[
          { content: '', icon: 'person', accessibilityLabel: 'Assign', onAction: () => {} },
          { content: 'Duplicate' },
          { content: 'More actions' },
        ]}
      />
      <s-page>
        <s-stack gap="small">
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
        </s-stack>

        <s-stack slot="aside" gap="small">
          <CustomerCard quote={quote} />
          <B2BRelationshipCard quote={quote} />
          <AiCard dispatch={dispatch} />
        </s-stack>
      </s-page>
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
