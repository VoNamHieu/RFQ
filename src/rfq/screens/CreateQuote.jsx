import React, { useState } from 'react';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { Modal, useWcId, PageHeader } from '../../shared/wc.jsx';
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
    <s-stack gap="small">
      <s-stack gap="small-500">
        <s-text color="subdued" fontSize="small">
          Email address
        </s-text>
        <s-text>{customer.email}</s-text>
      </s-stack>
      <s-divider />
      {isCompany ? (
        <s-stack gap="small">
          <Field label="Contact person" value={customer.name} sub={customer.email} />
          <Field label="Company" value={customer.company} sub={String(co.shopifyId || '')} />
          <Field label="Shipping address" lines={shipLines} />
          <Field label="Billing address" lines={shipLines} />
        </s-stack>
      ) : (
        <s-stack gap="small">
          <Field label="Customer" value={customer.name} sub={customer.email} />
          <Field label="Shipping address" lines={shipLines} />
        </s-stack>
      )}
    </s-stack>
  );
}

function Field({ label, value, sub, lines }) {
  return (
    <s-stack gap="small-500">
      <s-text color="subdued" fontSize="small">
        {label}
      </s-text>
      {lines ? lines.map((l, i) => <s-text key={i}>{l}</s-text>) : <s-text>{value}</s-text>}
      {sub ? (
        <s-text color="subdued" fontSize="small">
          {sub}
        </s-text>
      ) : null}
    </s-stack>
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

export function CreateQuote() {
  const { state, dispatch } = useStore();
  const cq = state.createQuote;
  const customer = RFQ_CUSTOMERS.find((c) => c.key === cq.customerKey) || null;
  const lines = cq.lines;
  // Variants already on the quote, keyed by sku → which option (source) added the line
  // and its price. The pickers use this to mark "Added": ticked + removable for their
  // own option, an unticked info badge for a line another option added (re-ticking it
  // overrides that line's price). One price per sku — the last pick wins.
  const quoteBySku = new Map(
    lines
      .filter((l) => l.sku)
      .map((l) => [l.sku, { source: l.source, sourceRef: l.sourceRef ?? null, sourceLabel: l.sourceLabel, price: l.price }]),
  );
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

  // Apply a picker result: drop any lines the user unticked (removals), then apply the
  // picks. An override (a line re-ticked from another option) replaces that line's
  // price/source but keeps its quantity — one price per sku, the last pick wins. A plain
  // re-add of the same sku accumulates quantity (legacy cqPushLine).
  const mergeLines = (additions, removals = []) => {
    const removeSet = new Set(removals);
    const next = lines.filter((l) => !removeSet.has(l.sku));
    additions.forEach((add) => {
      const { override, ...line } = add;
      const j = line.sku ? next.findIndex((l) => l.sku === line.sku) : -1;
      if (j >= 0 && override) next[j] = { ...next[j], ...line, qty: next[j].qty }; // new price over old, keep qty
      else if (j >= 0) next[j] = { ...next[j], ...line, qty: (Number(next[j].qty) || 0) + (Number(line.qty) || 1) };
      else next.push(line);
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
        <s-stack gap="small-500">
          <s-stack direction="inline" gap="small-300" alignItems="center">
            <s-text fontWeight="medium">{title || 'Custom item'}</s-text>
            <s-badge>Custom</s-badge>
          </s-stack>
          {l.physical ? (
            <s-text color="subdued" fontSize="small">{`Physical${l.weight ? ` · ${l.weight} ${l.weightUnit}` : ''}`}</s-text>
          ) : null}
        </s-stack>
      ) : (
        <s-stack gap="small-500">
          <s-text fontWeight="medium">{title}</s-text>
          <s-stack direction="inline" gap="small-400">
            {subtitle ? <s-text color="subdued" fontSize="small">{subtitle}</s-text> : null}
            {l.priced ? <s-text color="subdued" fontSize="small">· B2B price</s-text> : null}
          </s-stack>
        </s-stack>
      )}
    </div>
  );

  // Price / Qty / Total / Remove cells for one editable line.
  const editCells = (l, i) => [
    <s-table-cell key="price">
      <div style={{ width: 96 }}>
        <s-number-field label="Price" labelAccessibilityVisibility="exclusive" min={0} prefix="$" value={String(l.price ?? '')} onInput={(e) => patchLine(i, { price: Number(e.currentTarget.value) })} autocomplete="off" />
      </div>
    </s-table-cell>,
    <s-table-cell key="qty">
      <div style={{ width: 72 }}>
        <s-number-field label="Qty" labelAccessibilityVisibility="exclusive" inputMode="numeric" min={1} value={String(l.qty ?? '')} onInput={(e) => patchLine(i, { qty: Number(e.currentTarget.value) })} autocomplete="off" />
      </div>
    </s-table-cell>,
    <s-table-cell key="total">
      <s-text>{money((Number(l.price) || 0) * (Number(l.qty) || 0))}</s-text>
    </s-table-cell>,
    <s-table-cell key="remove">
      <s-button icon="x" variant="tertiary" accessibilityLabel="Remove line" onClick={() => removeLine(i)} />
    </s-table-cell>,
  ];

  const lineRows = [];
  lineGroups.forEach((g) => {
    const { product, items } = g;
    const isVariantGroup = product && (items.length > 1 || items[0].l.sku !== product.sku);
    if (!isVariantGroup) {
      const { l, i } = items[0];
      lineRows.push(
        <s-table-row key={`l-${i}`}>
          <s-table-cell>{productCell(l, { title: l.custom ? l.title || 'Custom item' : lineTitle(l), subtitle: l.sku })}</s-table-cell>
          {editCells(l, i)}
        </s-table-row>,
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
      <s-table-row key={`h-${product.sku}`}>
        <s-table-cell>
          <s-clickable onClick={() => toggleGroupExpand(product.sku)} borderRadius="base">
            <s-grid gridTemplateColumns="auto minmax(0, 1fr)" gap="small-300" alignItems="center">
              <s-icon type={isExp ? 'chevron-down' : 'chevron-right'} color="subdued" />
              <s-stack gap="small-500">
                <s-text fontWeight="semibold">{product.title}</s-text>
                <s-text color="subdued" fontSize="small">{`${items.length} variants${isExp ? '' : sameP ? '' : ' · Mixed prices'}`}</s-text>
              </s-stack>
            </s-grid>
          </s-clickable>
        </s-table-cell>
        <s-table-cell>
          <div style={{ width: 96 }}>
            <s-number-field label="Group price" labelAccessibilityVisibility="exclusive" min={0} prefix="$" value={sameP ? String(prices[0] ?? '') : ''} placeholder={sameP ? undefined : 'Mixed'} onInput={(e) => patchGroup(indices, { price: Number(e.currentTarget.value) })} autocomplete="off" />
          </div>
        </s-table-cell>
        <s-table-cell>
          <div style={{ width: 72 }}>
            <s-number-field label="Group qty" labelAccessibilityVisibility="exclusive" inputMode="numeric" min={1} value={sameQ ? String(qtys[0] ?? '') : ''} placeholder={sameQ ? undefined : 'Mixed'} onInput={(e) => patchGroup(indices, { qty: Number(e.currentTarget.value) })} autocomplete="off" />
          </div>
        </s-table-cell>
        <s-table-cell>
          <s-text fontWeight="medium">{money(groupTotal)}</s-text>
        </s-table-cell>
        <s-table-cell>
          <s-button icon="x" variant="tertiary" accessibilityLabel={`Remove all ${product.title} variants`} onClick={() => setLines(lines.filter((x) => !groupSkus.has(x.sku)))} />
        </s-table-cell>
      </s-table-row>,
    );
    // Indented variant sub-rows — only when expanded (the "mix" per-variant edit).
    if (isExp) {
      items.forEach(({ l, i }) => {
        const variant = product.variants?.find((v) => v.id === l.sku);
        const vTitle = variant?.title || (l.title || '').split(' — ').slice(1).join(' — ') || l.sku;
        lineRows.push(
          <s-table-row key={`l-${i}`}>
            <s-table-cell>{productCell(l, { title: vTitle, subtitle: l.sku, indent: true })}</s-table-cell>
            {editCells(l, i)}
          </s-table-row>,
        );
      });
    }
  });

  return (
    <>
    <PageHeader
      backAction={{ content: 'Submission list', onAction: () => dispatch({ type: 'NAVIGATE', view: 'submissionList' }) }}
      heading="Create quote"
      primaryAction={{ content: 'Create quote', disabled: !canCreate, onAction: () => cqCreate() }}
    />
    <s-page>
      <s-section padding="none">
        <s-box padding="small">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small-200">
            <s-heading>Products</s-heading>
            <s-stack direction="inline" gap="small-200">
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
          </s-stack>
        </s-box>
        {lines.length === 0 ? (
          <s-box padding="base">
            <EmptyBlock heading="No products yet">
              Add priced items from the company’s pricing, a product from the catalog, or a custom item.
            </EmptyBlock>
          </s-box>
        ) : (
          <>
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Product</s-table-header>
                <s-table-header listSlot="labeled">Price</s-table-header>
                <s-table-header listSlot="labeled">Qty</s-table-header>
                <s-table-header listSlot="labeled" format="currency">
                  Total
                </s-table-header>
                <s-table-header listSlot="inline" />
              </s-table-header-row>
              <s-table-body>{lineRows}</s-table-body>
            </s-table>
            <s-box padding="small">
              <s-stack direction="inline" justifyContent="end" gap="small-200">
                <s-text color="subdued">Subtotal</s-text>
                <s-text fontWeight="semibold">{money(subtotal)}</s-text>
              </s-stack>
            </s-box>
          </>
        )}
      </s-section>

      <s-stack slot="aside" gap="base">
        <s-section>
          <s-stack gap="small">
            <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
              <s-heading>Customer</s-heading>
              {customer &&
                (changingCustomer ? (
                  <s-button variant="tertiary" onClick={() => setChangingCustomer(false)}>
                    Cancel
                  </s-button>
                ) : (
                  <s-button variant="tertiary" disabled={lines.length > 0} onClick={() => setChangingCustomer(true)}>
                    Change
                  </s-button>
                ))}
            </s-grid>
            {!customer || changingCustomer ? (
              <s-select
                // Re-mount when a company switch is pending/cancelled so the field
                // shows the current customer again (it was a controlled Select).
                key={`customer-${pendingCustomerKey || ''}`}
                label="Choose a customer"
                labelAccessibilityVisibility="exclusive"
                placeholder="Select a customer…"
                value={customer?.key || ''}
                onChange={(e) => {
                  const key = e.currentTarget.value;
                  if (key) requestPickCustomer(key);
                }}
              >
                {RFQ_CUSTOMERS.map((c) => (
                  <s-option key={c.key} value={c.key}>{`${c.name} — ${c.company}`}</s-option>
                ))}
              </s-select>
            ) : (
              <>
                <LockedCustomerCard customer={customer} />
                <s-divider />
                <s-text-area
                  label="Message"
                  rows={3}
                  value={cq.message}
                  onInput={(e) => dispatch({ type: 'CQ_PATCH', patch: { message: e.currentTarget.value } })}
                  autocomplete="off"
                />
              </>
            )}
          </s-stack>
        </s-section>
        <s-section heading="Due date">
          <s-date-field
            label="Due date"
            labelAccessibilityVisibility="exclusive"
            value={cq.dueDate}
            onInput={(e) => dispatch({ type: 'CQ_PATCH', patch: { dueDate: e.currentTarget.value } })}
            onChange={(e) => dispatch({ type: 'CQ_PATCH', patch: { dueDate: e.currentTarget.value } })}
            autocomplete="off"
          />
        </s-section>
      </s-stack>

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
      {pendingCustomerKey && (
        <Modal onClose={() => setPendingCustomerKey(null)} heading="Change company?">
          <s-paragraph>
            Switching to {RFQ_CUSTOMERS.find((c) => c.key === pendingCustomerKey)?.company} will remove the{' '}
            {lines.length} product{lines.length === 1 ? '' : 's'} you’ve added, because pricing is specific to each
            company.
          </s-paragraph>
          <s-button slot="primary-action" variant="primary" tone="critical" onClick={confirmChangeCustomer}>
            Change and clear items
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setPendingCustomerKey(null)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-page>
    </>
  );
}

// ---- Product pickers (priced templates 2-step, or catalog) ----
