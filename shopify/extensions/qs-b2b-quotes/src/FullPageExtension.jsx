import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useMemo, useState} from 'preact/hooks';
import {acceptQuote, loadQuotes, sendCounter} from './api.js';

export default async () => {
  render(<QuotesPage />, document.body);
};

const STATUS_GROUP = {
  Quoted: 'action',
  'Counter sent': 'progress',
  Pending: 'progress',
  Accepted: 'closed',
  Closed: 'closed',
};

function money(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat(undefined, {style: 'currency', currency: 'USD'}).format(value);
}

function toneFor(status) {
  if (status === 'Accepted' || status === 'Closed') return 'success';
  if (status === 'Quoted') return 'info';
  if (status === 'Pending' || status === 'Counter sent') return 'warning';
  return 'neutral';
}

// The B2B Portal deep-links here with ?quote=<id> or ?filter=<group>.
function entryParams() {
  try {
    const url = shopify.navigation.currentEntry?.url;
    return url ? new URL(url, 'https://shopify.com').searchParams : new URLSearchParams();
  } catch {
    return new URLSearchParams();
  }
}

function QuotesPage() {
  const purchasingCompany = shopify.authenticatedAccount.purchasingCompany.value;
  const company = purchasingCompany?.company;
  const location = purchasingCompany?.location;
  const context = {companyId: company?.id, locationId: location?.id};

  const [params] = useState(entryParams);
  const [quotes, setQuotes] = useState([]);
  const [filter, setFilter] = useState(() => (
    Object.values(STATUS_GROUP).includes(params.get('filter')) ? params.get('filter') : 'all'
  ));
  const [selectedId, setSelectedId] = useState(() => params.get('quote'));
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadQuotes(context)
      .then((items) => active && setQuotes(items))
      .catch((err) => active && setError(err.message || 'Unable to load quotes.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [company?.id, location?.id]);

  const selected = quotes.find((quote) => quote.id === selectedId) || null;
  const filtered = useMemo(() => quotes.filter((quote) => {
    if (filter === 'all') return true;
    return STATUS_GROUP[quote.status] === filter;
  }), [quotes, filter]);

  const subheading = company
    ? `${company.name}${location?.name ? ` · ${location.name}` : ''}`
    : 'Your requests and negotiated offers';

  function patchQuote(id, patch) {
    setQuotes((items) => items.map((quote) => quote.id === id ? {...quote, ...patch} : quote));
  }

  async function onAccept() {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const patch = await acceptQuote(selected.id, context);
      patchQuote(selected.id, patch);
    } catch (err) {
      setError(err.message || 'Unable to accept this quote.');
    } finally {
      setSaving(false);
    }
  }

  async function onCounter() {
    if (!selected || !counterPrice || Number(counterPrice) <= 0) return;
    setSaving(true);
    setError('');
    try {
      const patch = await sendCounter(selected.id, counterPrice, context);
      patchQuote(selected.id, patch);
      setCounterOpen(false);
      setCounterPrice('');
    } catch (err) {
      setError(err.message || 'Unable to send the counter offer.');
    } finally {
      setSaving(false);
    }
  }

  if (selected) {
    return (
      <s-page key="detail" heading={`Quote ${selected.id}`} subheading={subheading}>
        <s-button slot="primary-action" onClick={() => { setSelectedId(null); setCounterOpen(false); }}>
          Back to quotes
        </s-button>

        <s-stack direction="block" gap="base">
          {error ? <s-banner tone="critical">{error}</s-banner> : null}
          {selected.savedToPricing ? (
            <s-banner tone="success" heading="Price available for future orders">
              Your company can reuse the agreed price without requesting another quote.
            </s-banner>
          ) : null}

          <s-section>
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-heading>{selected.id}</s-heading>
                <s-badge tone={toneFor(selected.status)}>{selected.status}</s-badge>
              </s-stack>
              <s-text>{selected.date}</s-text>
              {selected.message ? <s-text>{selected.message}</s-text> : null}
            </s-stack>
          </s-section>

          <s-section>
            <s-stack direction="block" gap="base">
              <s-heading>Products</s-heading>
              {selected.lines.map((line) => (
                <s-stack key={line.sku} direction="block" gap="small">
                  <s-text type="strong">{line.title}</s-text>
                  <s-text>{line.quantity} units · {line.sku}</s-text>
                  <s-text>{line.unitPrice == null ? 'Waiting for seller price' : `${money(line.unitPrice)} each`}</s-text>
                  {line.listPrice && line.unitPrice ? <s-text>Store price: {money(line.listPrice)}</s-text> : null}
                  <s-divider />
                </s-stack>
              ))}
              {selected.total != null ? <s-heading>Total {money(selected.total)}</s-heading> : null}
            </s-stack>
          </s-section>

          {selected.status === 'Quoted' ? (
            <s-section>
              <s-stack direction="block" gap="base">
                <s-heading>Respond to offer</s-heading>
                <s-stack direction="inline" gap="base">
                  <s-button variant="primary" loading={saving} onClick={onAccept}>Accept offer</s-button>
                  <s-button onClick={() => setCounterOpen((value) => !value)}>Send counter offer</s-button>
                </s-stack>
                {counterOpen ? (
                  <s-stack direction="block" gap="base">
                    <s-text-field
                      label="Counter offer per unit (USD)"
                      value={counterPrice}
                      onInput={(event) => setCounterPrice(event.target.value)}
                    />
                    <s-button variant="primary" loading={saving} onClick={onCounter}>Send counter</s-button>
                  </s-stack>
                ) : null}
              </s-stack>
            </s-section>
          ) : null}
        </s-stack>
      </s-page>
    );
  }

  return (
    <s-page key="list" heading="Quotes" subheading={subheading}>
      <s-button slot="breadcrumb-actions" accessibilityLabel="Back to B2B Portal" onClick={() => shopify.navigation.navigate('extension:qs-b2b-portal')}>
        B2B Portal
      </s-button>
      <s-button slot="secondary-actions" onClick={() => shopify.navigation.navigate('shopify:customer-account/orders')}>
        View orders
      </s-button>

      <s-stack direction="block" gap="base">
        {error ? <s-banner tone="critical">{error}</s-banner> : null}

        {!company ? (
          <s-banner tone="info" heading="No business purchasing context">
            Quotes are available here, but company-specific filtering becomes available after the customer is linked to a Shopify Company location.
          </s-banner>
        ) : null}

        <s-select label="Show quotes" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <s-option value="all">All</s-option>
          <s-option value="action">Needs your action</s-option>
          <s-option value="progress">In progress</s-option>
          <s-option value="closed">Accepted / closed</s-option>
        </s-select>

        {loading ? <s-spinner accessibilityLabel="Loading quotes" /> : null}

        {!loading && filtered.length === 0 ? (
          <s-section>
            <s-stack direction="block" gap="base">
              <s-heading>No quotes here</s-heading>
              <s-text>Quote requests matching this filter will appear here.</s-text>
            </s-stack>
          </s-section>
        ) : null}

        {filtered.map((quote) => (
          <s-section key={quote.id}>
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-heading>{quote.id}</s-heading>
                <s-badge tone={toneFor(quote.status)}>{quote.status}</s-badge>
              </s-stack>
              <s-text>{quote.lines.map((line) => `${line.title} ×${line.quantity}`).join(', ')}</s-text>
              <s-text>{quote.date}{quote.total != null ? ` · ${money(quote.total)}` : ''}</s-text>
              {quote.savedToPricing ? <s-text>Agreed price is available for future orders.</s-text> : null}
              <s-button onClick={() => setSelectedId(quote.id)}>View quote</s-button>
            </s-stack>
          </s-section>
        ))}
      </s-stack>
    </s-page>
  );
}
