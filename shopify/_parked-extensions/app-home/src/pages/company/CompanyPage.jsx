import {useState} from 'preact/hooks';
import {useLocation} from 'preact-iso';
import company from './companyData.js';

// The B2B app prototype's Company page (rfq-x-b2b-ui, Current version), rebuilt with
// the Polaris web components an App Home extension can render, to preview it in
// Shopify admin. Extensions can't take custom HTML or CSS, so the mockup's look is
// approximated: titles above the cards, two-line cells, a footer row in the card,
// statuses as a dot and a word, a flat side column split by dividers. Data is a
// snapshot (companyData.js); links to the app's other screens don't go anywhere here.

// quote.status → its dot's tone (none = grey).
const QUOTE_TONE = {
  'New Received': 'caution',
  Updated: 'info',
  'Deal Closed': 'success',
  'Deal Rejected': 'critical',
};
// order.status → its dot's tone (none = grey).
const ORDER_TONE = {
  Fulfilled: 'success',
  Paid: 'success',
  'Needs review': 'warning',
  'Invoice sent': 'info',
  Blocked: 'critical',
  Cancelled: 'critical',
  'Draft order': 'info',
  Unfulfilled: 'caution',
  Declined: 'critical',
};
// The Quotes status select; `status: null` means "All".
const QUOTE_FILTERS = [
  {id: 'all', content: 'All', status: null},
  {id: 'new', content: 'New received', status: 'New Received'},
  {id: 'read', content: 'Read', status: 'Read'},
  {id: 'closed', content: 'Deal closed', status: 'Deal Closed'},
  {id: 'rejected', content: 'Deal rejected', status: 'Deal Rejected'},
  {id: 'trashed', content: 'Trashed', status: 'Trashed'},
];
// "Waiting on a price": open quotes with at least one unpriced line. On the full page
// only, as a choice in its select (the card's banner button opens the page on it).
const isWaiting = (q) => !['Deal Closed', 'Deal Rejected', 'Trashed'].includes(q.status) && q.unpriced;
const FULL_QUOTE_FILTERS = [QUOTE_FILTERS[0], {id: 'waiting', content: 'Waiting on a price', match: isWaiting}, ...QUOTE_FILTERS.slice(1)];
const inFilter = (f, q) => (f.match ? f.match(q) : !f.status || q.status === f.status);
const PRICING_TYPES = [
  {id: 'base', content: 'Base pricing'},
  {id: 'quantity', content: 'Quantity pricing'},
];
// Rows per page: 5 in a card, 50 on its full page (View all).
const PAGE_SIZE = 5;
const FULL_PAGE_SIZE = 50;
// Pricing chips shown before "+N more".
const PRICING_SHOWN = 4;

const money = (value) => {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
};
// "Jul 14, 2026" from "2026-07-14" or "2026-07-14 15:53:51".
const cdDate = (value) => {
  if (!value) return '';
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function CompanyPage() {
  const [autoAdd, setAutoAdd] = useState(company.autoAddLocations);
  const locationCount = company.locations.length;
  const contactCount = company.contacts.length;

  return (
    <s-page heading={company.name} inlineSize="base">
      <s-link slot="breadcrumb-actions" href="shopify://admin/companies">
        Companies
      </s-link>
      <s-button slot="secondary-actions" onClick={() => setAutoAdd(!autoAdd)}>
        {`Auto-add locations: ${autoAdd ? 'On' : 'Off'}`}
      </s-button>
      <s-button slot="secondary-actions" tone="critical" commandFor="delete-company" command="--show">
        Delete
      </s-button>

      <s-stack gap="large-200">
        {/* Subtitle, then the overview's numbers flat on the page; View analytics by its title. */}
        <s-stack gap="base">
          <s-text color="subdued">
            {`${company.source ? `From ${company.source}` : 'Active'} · ${plural(locationCount, 'location')}`}
          </s-text>
          <s-stack gap="small-200">
            <CardTitle title="Company overview">
              <s-link>View analytics</s-link>
            </CardTitle>
            <s-grid gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap="base">
              <Stat label="Sales" value={money(company.totalSales)} note="All-time from this company" />
              <Stat label="Orders" value={String(company.orderCount)} note="Placed by its buyers" />
              <Stat label="Quotes" value={String(company.quoteCount)} note="RFQ requests from here" />
            </s-grid>
          </s-stack>
        </s-stack>
        <LocationsCard />
        <OrdersCard />
        <QuotesCard />
      </s-stack>

      {/* Side column: flat blocks split by dividers. */}
      <s-stack slot="aside" gap="large-200">
        <SideBlock title="General">
          <SideRow label="Name">{company.name}</SideRow>
          <SideRow label="Main contact">{company.mainContact || '—'}</SideRow>
          <SideRow label="Source">{company.source || '—'}</SideRow>
        </SideBlock>
        <ContactsBlock />
        <PricingBlock />
      </s-stack>

      <s-modal id="delete-company" heading={`Delete ${company.name}?`}>
        <s-paragraph>
          {`This removes ${company.name} from the B2B app — its ${plural(locationCount, 'location')}, ${plural(contactCount, 'contact')}${
            company.assignedCount ? `, and unassigns ${plural(company.assignedCount, 'pricing profile')}` : ''
          }. The Shopify company record is not affected.`}
        </s-paragraph>
        <s-button slot="primary-action" variant="primary" tone="critical" commandFor="delete-company" command="--hide">
          Delete company
        </s-button>
        <s-button slot="secondary-actions" commandFor="delete-company" command="--hide">
          Cancel
        </s-button>
      </s-modal>
    </s-page>
  );
}

// Quotes / Orders on a page of their own (the cards' View all), back to the company.
export function CompanyQuotesPage() {
  return (
    <s-page heading="Quotes" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/company">
        {company.name}
      </s-link>
      <QuotesCard full />
    </s-page>
  );
}

export function CompanyOrdersPage() {
  return (
    <s-page heading="Orders" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/company">
        {company.name}
      </s-link>
      <OrdersCard full />
    </s-page>
  );
}

// One of the overview’s numbers, in a grey tile of equal width, with the prototype's
// type: a small grey label, the number large and semibold, then a small grey note.
// (s-heading ignored its fontSize here, so the number is an s-number.)
function Stat({label, value, note}) {
  return (
    <s-box background="subdued" borderRadius="large" padding="base">
      <s-stack gap="small-500">
        <s-text color="subdued" fontSize="small-100">
          {label}
        </s-text>
        <s-number fontSize="large-100" fontWeight="semibold">
          {value}
        </s-number>
        <s-text color="subdued" fontSize="small-100">
          {note}
        </s-text>
      </s-stack>
    </s-box>
  );
}

// A main-column card's title row: heading on the left, its control on the right.
function CardTitle({title, children}) {
  return (
    <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="center">
      <s-heading>{title}</s-heading>
      {children}
    </s-grid>
  );
}

// A blue (info) banner between a card's title and the card, with an arrow button that
// opens the list it's about (`href` none leaves the button out). Above the card, not in
// it: inside, the table's grey heading row would butt against it.
function CardBanner({children, href, label}) {
  return (
    <s-banner tone="info">
      {/* Top-aligned, so the text sits on the line of the banner's own icon (centred on the
          taller button, it dropped below it). */}
      <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="start">
        <s-text>{children}</s-text>
        {href ? <s-button icon="arrow-right" accessibilityLabel={label} href={href} /> : null}
      </s-grid>
    </s-banner>
  );
}

// A status as a coloured dot and its name. The dot is a drawn 8px circle: Polaris's
// only dot icon (bullet) is 4px at its largest size, and text tones are dark shades
// (a "●" reads black).
const DOT_COLOR = {
  caution: '#b28400',
  warning: '#e08b00',
  info: '#2c6ecb',
  success: '#29845a',
  critical: '#e22c38',
  neutral: '#8a8a8a',
};
const DOT_SRC = Object.fromEntries(
  Object.entries(DOT_COLOR).map(([tone, fill]) => [
    tone,
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="${fill}"/></svg>`,
    )}`,
  ]),
);
function StatusDot({tone, children}) {
  return (
    <s-stack direction="inline" gap="small-200" alignItems="center">
      <s-image src={DOT_SRC[tone] || DOT_SRC.neutral} alt="" accessibilityRole="presentation" inlineSize="auto" />
      <s-text>{children}</s-text>
    </s-stack>
  );
}

// The card's footer row: the pager (more than one page).
function CardFoot({current, count, label, onPage}) {
  if (count <= 1) return null;
  return (
    <>
      <s-divider />
      <s-box paddingInline="base" paddingBlock="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-button
            icon="chevron-left"
            variant="tertiary"
            accessibilityLabel="Previous page"
            disabled={current === 0}
            onClick={() => onPage(current - 1)}
          />
          <s-text color="subdued">{label}</s-text>
          <s-button
            icon="chevron-right"
            variant="tertiary"
            accessibilityLabel="Next page"
            disabled={current >= count - 1}
            onClick={() => onPage(current + 1)}
          />
        </s-stack>
      </s-box>
    </>
  );
}

// View all, by a card's title: the expand icon, "View all" on hover; it opens the card
// on a page of its own.
function ExpandButton({id, href}) {
  return (
    <>
      <s-button icon="maximize" variant="tertiary" accessibilityLabel="View all" interestFor={`${id}-tip`} href={href} />
      <s-tooltip id={`${id}-tip`}>View all</s-tooltip>
    </>
  );
}

// One page of rows: the rows, the page shown, the page count and "1–5 of 7".
function paged(rows, page, size) {
  const count = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, count - 1);
  const start = current * size;
  const pageRows = rows.slice(start, start + size);
  const label = rows.length ? `${start + 1}–${start + pageRows.length} of ${rows.length}` : '0 of 0';
  return {pageRows, current, count, label};
}

// Each location with its buyers, orders, all-time revenue and last purchase (its
// orders, as the overview's Sales counts them).
function LocationsCard() {
  const ordersAt = (l) => company.orders.filter((o) => o.location === l.name);
  return (
    <s-stack gap="small-200">
      <CardTitle title={`Locations (${company.locations.length})`}>
        <s-button>Add location</s-button>
      </CardTitle>
      <s-section padding="none">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Location</s-table-header>
            <s-table-header listSlot="labeled" format="numeric">
              Buyers
            </s-table-header>
            <s-table-header listSlot="labeled" format="numeric">
              Orders
            </s-table-header>
            <s-table-header listSlot="labeled" format="currency">
              All-time revenue
            </s-table-header>
            <s-table-header listSlot="labeled">Last purchase</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {company.locations.map((l) => {
              const orders = ordersAt(l);
              const revenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
              const last = orders.reduce((latest, o) => (o.date && String(o.date) > latest ? String(o.date) : latest), '');
              return (
                <s-table-row key={l.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-text type="strong">{l.name}</s-text>
                      {l.deleted ? <s-badge tone="critical">Deleted</s-badge> : null}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{l.buyers}</s-table-cell>
                  <s-table-cell>{orders.length}</s-table-cell>
                  <s-table-cell>{money(revenue)}</s-table-cell>
                  <s-table-cell>{last ? cdDate(last) : '—'}</s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>
      </s-section>
    </s-stack>
  );
}

// The Quotes card: View all (the expand icon) and a status select by the title; the
// quotes, a page at a time. `full`: on its own page, 50 rows a page, no View all; opened from the
// banner's button (?filter=waiting) it shows the quotes waiting on a price.
function QuotesCard({full = false}) {
  const {query} = useLocation();
  const filters = full ? FULL_QUOTE_FILTERS : QUOTE_FILTERS;
  const [filter, setFilter] = useState(full && query?.filter === 'waiting' ? 'waiting' : 'all');
  const [page, setPage] = useState(0);
  const quotes = company.quotes;
  const active = filters.find((f) => f.id === filter) || filters[0];
  const shown = quotes.filter((q) => inFilter(active, q));
  const waiting = quotes.filter(isWaiting).length;
  const {pageRows, current, count, label} = paged(shown, page, full ? FULL_PAGE_SIZE : PAGE_SIZE);

  return (
    <s-stack gap="small-200">
      <CardTitle title="Quotes">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          {full ? null : <ExpandButton id="quotes-view-all" href="/company/quotes" />}
          <s-box minInlineSize="180px">
            <s-select
              label="Status"
              labelAccessibilityVisibility="exclusive"
              value={active.id}
              onChange={(e) => {
                setFilter(e.currentTarget.value);
                setPage(0);
              }}
            >
              {filters.map((f) => (
                <s-option key={f.id} value={f.id}>
                  {`${f.content} (${quotes.filter((q) => inFilter(f, q)).length})`}
                </s-option>
              ))}
            </s-select>
          </s-box>
        </s-stack>
      </CardTitle>
      {waiting > 0 ? (
        <CardBanner href={full ? null : '/company/quotes?filter=waiting'} label="View quotes waiting on a price">
          {`${plural(waiting, 'quote')} waiting on a price. Price them in the RFQ app to move them forward.`}
        </CardBanner>
      ) : null}
      <s-section padding="none">
        {shown.length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Quote ID</s-table-header>
              <s-table-header listSlot="labeled">Customer</s-table-header>
              <s-table-header listSlot="secondary">Status</s-table-header>
              <s-table-header listSlot="labeled">Lead score</s-table-header>
              <s-table-header listSlot="labeled">Assignee</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {pageRows.map((q) => (
                <s-table-row key={q.id}>
                  <s-table-cell>
                    <s-stack gap="small-500">
                      <s-text type="strong">{q.id}</s-text>
                      <s-text color="subdued">{cdDate(q.created) || '—'}</s-text>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack gap="small-500">
                      <s-text>{q.buyer}</s-text>
                      {q.email ? <s-text color="subdued">{q.email}</s-text> : null}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <StatusDot tone={QUOTE_TONE[q.status]}>{q.status}</StatusDot>
                  </s-table-cell>
                  <s-table-cell>{q.leadScore != null ? String(q.leadScore) : '—'}</s-table-cell>
                  <s-table-cell>{q.assignee || '—'}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-box padding="large">
            <s-stack alignItems="center">
              <s-text color="subdued">No quotes in this view.</s-text>
            </s-stack>
          </s-box>
        )}
        <CardFoot current={current} count={count} label={label} onPage={setPage} />
      </s-section>
    </s-stack>
  );
}

// The Orders card: a location select by the title (more than one location); the
// orders, newest first, a page at a time; View all (the expand icon) by the title.
// `full`: on its own page, 50 rows a page, no View all.
function OrdersCard({full = false}) {
  const [loc, setLoc] = useState('all');
  const [page, setPage] = useState(0);
  const allOrders = company.orders;
  const orders = (loc === 'all' ? allOrders : allOrders.filter((o) => o.location === loc))
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const locationNames = [...new Set(allOrders.map((o) => o.location).filter(Boolean))];
  const {pageRows, current, count, label} = paged(orders, page, full ? FULL_PAGE_SIZE : PAGE_SIZE);

  return (
    <s-stack gap="small-200">
      <CardTitle title={`Orders${loc === 'all' ? '' : ` · ${loc}`} (${orders.length})`}>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          {full ? null : <ExpandButton id="orders-view-all" href="/company/orders" />}
          {locationNames.length > 1 ? (
            <s-box minInlineSize="180px">
              <s-select
                label="Location"
                labelAccessibilityVisibility="exclusive"
                value={loc}
                onChange={(e) => {
                  setLoc(e.currentTarget.value);
                  setPage(0);
                }}
              >
                <s-option value="all">All locations</s-option>
                {locationNames.map((n) => (
                  <s-option key={n} value={n}>
                    {n}
                  </s-option>
                ))}
              </s-select>
            </s-box>
          ) : null}
        </s-stack>
      </CardTitle>
      <s-section padding="none">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Order</s-table-header>
            <s-table-header listSlot="labeled">Buyer</s-table-header>
            <s-table-header listSlot="labeled" format="currency">
              Total
            </s-table-header>
            <s-table-header listSlot="secondary">Status</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {pageRows.map((o) => (
              <s-table-row key={o.id}>
                <s-table-cell>
                  <s-stack gap="small-500">
                    <s-text type="strong">{o.id}</s-text>
                    {o.date || o.po ? <s-text color="subdued">{[cdDate(o.date), o.po].filter(Boolean).join(' · ')}</s-text> : null}
                  </s-stack>
                </s-table-cell>
                <s-table-cell>
                  <s-stack gap="small-500">
                    <s-text>{o.buyer || '—'}</s-text>
                    {o.location ? <s-text color="subdued">{o.location}</s-text> : null}
                  </s-stack>
                </s-table-cell>
                <s-table-cell>{money(o.amount)}</s-table-cell>
                <s-table-cell>
                  <StatusDot tone={ORDER_TONE[o.status]}>{o.status}</StatusDot>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
        <CardFoot current={current} count={count} label={label} onPage={setPage} />
      </s-section>
    </s-stack>
  );
}

// A side-column block: title (and its actions), an optional note, then rows.
function SideBlock({title, actions, note, children}) {
  return (
    <s-stack gap="small-200">
      <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
        <s-heading>{title}</s-heading>
        {actions || null}
      </s-grid>
      {note ? <s-text color="subdued">{note}</s-text> : null}
      <s-stack gap="none">{children}</s-stack>
    </s-stack>
  );
}

// One row of a side block: a grey label over its value, a divider under it.
function SideRow({label, children}) {
  return (
    <>
      <s-box paddingBlock="small-100">
        <s-stack gap="small-500">
          {label ? <s-text color="subdued">{label}</s-text> : null}
          {children}
        </s-stack>
      </s-box>
      <s-divider />
    </>
  );
}

// Contacts: names, with their Shopify role and how they buy on hover, and their
// location under each. Managed on the Shopify company record.
function ContactsBlock() {
  const contacts = company.contacts;
  return (
    <SideBlock
      title={`Contacts${contacts.length ? ` (${contacts.length})` : ''}`}
      actions={<s-button onClick={() => shopify.toast.show('Opens in Shopify')}>Open in Shopify</s-button>}
      note="Managed on the Shopify company record."
    >
      {contacts.map((c, i) => {
        const tip = [c.role, c.access].filter(Boolean).join(' · ') || c.email;
        return (
          <SideRow key={c.email || i}>
            <s-text interestFor={`contact-tip-${i}`}>{c.name}</s-text>
            <s-tooltip id={`contact-tip-${i}`}>{tip}</s-tooltip>
            <s-text color="subdued">{c.locations || '—'}</s-text>
          </SideRow>
        );
      })}
    </SideBlock>
  );
}

// A pricing's summary card, as the prototype's hover card: its name and status, then
// its settings (type, products, calculation, who it serves and is assigned to,
// priority, dates), each with its icon.
const SUMMARY_STATUS_TONE = {Active: 'success', Scheduled: 'info', Upcoming: 'info'};
function PricingSummary({id, pricing}) {
  return (
    <s-popover id={id} inlineSize="300px">
      <s-box padding="base">
        <s-stack gap="small">
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
            <s-text type="strong">{pricing.name}</s-text>
            <s-badge tone={SUMMARY_STATUS_TONE[pricing.status] || 'neutral'}>{pricing.status}</s-badge>
          </s-grid>
          <s-divider />
          <s-stack gap="small-300">
            {(pricing.summary || []).map(([icon, label, value]) => (
              <s-grid key={label} gridTemplateColumns="auto 88px minmax(0, 1fr)" gap="small-200" alignItems="start">
                <s-icon type={icon} color="subdued" />
                <s-text color="subdued">{`${label}:`}</s-text>
                <s-text>{value}</s-text>
              </s-grid>
            ))}
          </s-stack>
        </s-stack>
      </s-box>
    </s-popover>
  );
}

// Pricing: a type select over its names (a few, then "+N more"), green when Active,
// grey otherwise (as badges: chips come in neither colour), each with its summary card
// on hover; ⊕ adds base or quantity pricing.
function PricingBlock() {
  const [type, setType] = useState('base');
  const [all, setAll] = useState(false);
  const typeChips = company.pricing[type] || [];
  const shownChips = all ? typeChips : typeChips.slice(0, PRICING_SHOWN);
  const more = typeChips.length - shownChips.length;

  return (
    <SideBlock
      title="Pricing"
      actions={<s-link>View pricing library</s-link>}
    >
      <SideRow>
        <s-stack gap="small">
          <s-select
            label="Pricing type"
            labelAccessibilityVisibility="exclusive"
            value={type}
            onChange={(e) => {
              setType(e.currentTarget.value);
              setAll(false);
            }}
          >
            {PRICING_TYPES.map((t) => (
              <s-option key={t.id} value={t.id}>
                {t.content}
              </s-option>
            ))}
          </s-select>
          <s-stack direction="inline" gap="small-300" alignItems="center">
            {/* Hovering a name opens its summary, as the prototype's hover card. Wrapped in
                text: s-clickable takes a whole line (the names stacked), and a link draws its
                blue focus ring once the summary closes. */}
            {shownChips.map((p, i) => (
              <s-text key={p.name} interestFor={`pricing-summary-${type}-${i}`}>
                {p.status === 'Active' ? (
                  <s-badge tone="success">{p.name}</s-badge>
                ) : (
                  <s-badge tone="neutral">{`${p.name} · ${p.status}`}</s-badge>
                )}
              </s-text>
            ))}
            {more > 0 ? (
              <s-clickable-chip accessibilityLabel={`Show ${more} more`} onClick={() => setAll(true)}>
                {`+${more} more`}
              </s-clickable-chip>
            ) : null}
            {all && typeChips.length > PRICING_SHOWN ? <s-link onClick={() => setAll(false)}>Show less</s-link> : null}
            <s-button icon="plus-circle" variant="tertiary" accessibilityLabel="Add pricing" commandFor="add-pricing-menu" />
            <s-menu id="add-pricing-menu" accessibilityLabel="Add pricing">
              <s-button>Base pricing</s-button>
              <s-button>Quantity pricing</s-button>
            </s-menu>
          </s-stack>
          {/* The summaries, after the row (hidden until opened). */}
          {shownChips.map((p, i) => (
            <PricingSummary key={p.name} id={`pricing-summary-${type}-${i}`} pricing={p} />
          ))}
        </s-stack>
      </SideRow>
    </SideBlock>
  );
}
