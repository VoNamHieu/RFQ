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
  TextField,
  Icon,
  Link,
  Collapsible,
} from '@shopify/polaris';
import {
  MenuHorizontalIcon,
  DeleteIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PersonIcon,
  ProductIcon,
  PlusCircleIcon,
  MagicIcon,
} from '@shopify/polaris-icons';
import { useStore, handoffToB2B } from '../store.jsx';
import { money, money2 } from '../utils.js';
import { shopifyCompanyDirectory } from '../data/companies.js';
import { SaveToB2B } from '../components/SaveToB2B.jsx';
import { B2BRelationshipCard, SyncFlowModals, CreateCompanyModal } from '../components/B2BRelationship.jsx';
import { versionFlags } from '../../shared/versions.js';

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
    <Box background="bg-surface-secondary" borderRadius="200" borderWidth="025" borderColor="border" width="48px" minHeight="48px">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48 }}>
        <Icon source={ProductIcon} tone="subdued" />
      </div>
    </Box>
  );
}

// Left column: the editable Products card (spec §5.4 renderQuote).
function ProductsCard({ lines, setLines, dispatch }) {
  const setLine = (i, patch) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const removeLine = (i) => setLines(lines.filter((_, k) => k !== i));
  const [skuOpen, setSkuOpen] = useState(() => new Set());
  const toggleSku = (i) => setSkuOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">Products</Text>
          <Button icon={MenuHorizontalIcon} variant="tertiary" accessibilityLabel="Product actions" onClick={() => dispatch({ type: 'TOAST', message: 'Product actions' })} />
        </InlineStack>

        <TextField
          label="Search product"
          labelHidden
          value=""
          onChange={() => {}}
          prefix={<Icon source={SearchIcon} tone="subdued" />}
          placeholder="Search product"
          autoComplete="off"
        />

        <Box>
          <InlineStack gap="400" blockAlign="center">
            <Box width="46%"><Text as="span" tone="subdued" variant="bodySm">Product</Text></Box>
            <Box width="16%"><Text as="span" tone="subdued" variant="bodySm">Quantity</Text></Box>
            <Box width="20%"><Text as="span" tone="subdued" variant="bodySm">Quoted Price</Text></Box>
            <Box width="12%"><Text as="span" tone="subdued" variant="bodySm">Total</Text></Box>
          </InlineStack>
        </Box>
        <Divider />

        {lines.map((l, i) => {
          const price = Number(l.price) || 0;
          const qty = Number(l.qty ?? l.quantity ?? 1) || 0;
          return (
            <BlockStack gap="200" key={i}>
              <InlineStack gap="400" blockAlign="start" wrap={false}>
                <Box width="46%">
                  <InlineStack gap="300" blockAlign="start" wrap={false}>
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
                        <>
                          <Button variant="tertiary" disclosure={skuOpen.has(i) ? 'up' : 'down'} onClick={() => toggleSku(i)} textAlign="left">
                            {`SKU: ${l.sku}`}
                          </Button>
                          <Collapsible id={`sku-${i}`} open={skuOpen.has(i)}>
                            <Text as="span" tone="subdued" variant="bodySm">Variant details for {l.sku}.</Text>
                          </Collapsible>
                        </>
                      ) : null}
                      <Link onClick={() => dispatch({ type: 'TOAST', message: 'Add property' })}>
                        <InlineStack gap="100" blockAlign="center">
                          <Icon source={PlusCircleIcon} />
                          <span>Add property</span>
                        </InlineStack>
                      </Link>
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
              <Divider />
            </BlockStack>
          );
        })}
      </BlockStack>
    </Card>
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
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">Payment Information</Text>
        <Box borderColor="border" borderWidth="025" borderRadius="200" padding="400">
          <BlockStack gap="300">
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
  const [open, setOpen] = useState(true);
  const customer = quote.customer || {};
  const companyKey = quoteCompanyKey(quote);
  const company = companyKey ? shopifyCompanyDirectory[companyKey] : null;
  const shipLines = String(customer.shipping || 'Not provided').split('\n');

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">Customer</Text>
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
                <Text as="span" variant="headingSm">Customer Information</Text>
                <Icon source={open ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
              </InlineStack>
            </button>
          </Box>
          <Collapsible id="customer-info" open={open}>
            <Box padding="300" paddingBlockStart="0">
              <BlockStack gap="300">
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
      <BlockStack gap="300">
        <InlineStack gap="150" blockAlign="center">
          <Icon source={MagicIcon} tone="magic" />
          <Text as="h2" variant="headingSm">AI quote analysis</Text>
        </InlineStack>
        <Text as="p" tone="subdued" variant="bodySm">
          Analyze this quote with AI: customer history, margin and the safest price to offer.
        </Text>
        <Button variant="primary" icon={MagicIcon} onClick={() => dispatch({ type: 'TOAST', message: 'Analyzing quote…' })}>
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
        fullWidth
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
            <BlockStack gap="400">
              <ProductsCard lines={lines} setLines={setLines} dispatch={dispatch} />
              {isDealClosed && (
                <InlineStack>
                  <Button variant="primary" onClick={() => setSaveOpen(true)}>Save prices to B2B</Button>
                </InlineStack>
              )}
              <PaymentCard
                subtotal={subtotal}
                dispatch={dispatch}
                onSendProposal={() => dispatch({ type: 'TOAST', message: 'Proposal email sent' })}
              />
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <CustomerCard quote={quote} />
              <AiCard dispatch={dispatch} />
              <B2BRelationshipCard quote={quote} />
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
              ? { targetId: result.dest, newName: result.dest === '__new__' ? `Quote ${quote.number} prices` : '', newPriority: 1 }
              : null;
            handoffToB2B(state, quote.number, { pricingTransfer: transfer, lines: result?.lines });
          }}
        />
      )}
      <SyncFlowModals />
      <CreateCompanyModal />
    </>
  );
}
