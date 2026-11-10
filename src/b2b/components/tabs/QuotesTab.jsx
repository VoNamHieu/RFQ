import React from 'react';
import { useStore } from '../../store.jsx';
import { QuoteAppCrossSell, noQuotesFromRfqApp } from '../QuoteAppCrossSell.jsx';
import { withVersion } from '../../../shared/versions.js';
import quotesArt from '../../assets/quotes-empty.webp';
import { DevStrip } from '../../../shared/DevStrip.jsx';
import { CdSection, StatusDot, CardBanner, CardFoot, ExpandButton, rangeLabel, cdDate, backTo } from '../companyLayout.jsx';

// quote.status → its dot's tone (undefined = neutral grey).
export const QUOTE_STATUS_TONE = {
  'New Received': 'attention',
  Read: undefined,
  Updated: 'info',
  'Deal Closed': 'success',
  'Deal Rejected': 'critical',
  Trashed: undefined,
};

// A status select filters the company's quotes; `status: null` means "All".
const SUB_TABS = [
  { id: 'all', content: 'All', status: null },
  { id: 'new', content: 'New received', status: 'New Received' },
  { id: 'read', content: 'Read', status: 'Read' },
  { id: 'closed', content: 'Deal closed', status: 'Deal Closed' },
  { id: 'rejected', content: 'Deal rejected', status: 'Deal Rejected' },
  { id: 'trashed', content: 'Trashed', status: 'Trashed' },
];
// "Waiting on a price": open quotes with at least one unpriced line. On the full page
// only, as a choice in its select (the card's banner button opens the page on it).
const isWaiting = (q) => !['Deal Closed', 'Deal Rejected', 'Trashed'].includes(q.status) && (q.lines || []).some((l) => l.quoted == null);
const WAITING_TAB = { id: 'waiting', content: 'Waiting on a price', match: isWaiting };
const FULL_SUB_TABS = [SUB_TABS[0], WAITING_TAB, ...SUB_TABS.slice(1)];
const inTab = (t, q) => (t.match ? t.match(q) : !t.status || q.status === t.status);

// The card shows the first 5 (no pages; View all opens the rest), as the Orders card;
// its full page (View all) 50 a page.
const PAGE_SIZE = 5;
const FULL_PAGE_SIZE = 50;
// Prototype: the empty card's dev strip (RFQ app installed / not) shows in production too.
const SHOW_DEV_TOOLS = true;
// The card's "waiting on a price" banner closed with ✕ (by company or location: the
// quotes waiting then) stays closed until the page reloads — unless another quote is
// waiting there. As the Orders card's review banner.
const closedWaiting = new Map();

// The company page's Quotes section: the title with View all (the expand icon) and a
// status select, then a card with the quotes, a page at a time. `full`: the same section on its
// own page (View all opens it), at full width, without View all. `location`: the same card on
// a location's page, its quotes only (newest first); View all and the banner open the
// company's Quotes page on this location, back to it. The full page alone has a Location
// select (when the quotes come from more than one).
export function QuotesTab({ company, location = null, full = false }) {
  const { state, dispatch } = useStore();
  const tabs = full ? FULL_SUB_TABS : SUB_TABS;
  const [selected, setSelected] = React.useState(full && state.companyListFilter === 'waiting' ? 'waiting' : 'all');
  const [page, setPage] = React.useState(0);
  // Opened from a location (its ⤢ or banner; back goes to it): the full page stays on that
  // location — its Location select shows it, locked.
  const lockedLoc = full && state.backTo?.view === 'location' && state.quotesLocation && state.quotesLocation !== 'all' ? state.quotesLocation : null;
  const [pickedLoc, setLoc] = React.useState(full ? state.quotesLocation || 'all' : 'all');
  const loc = lockedLoc || pickedLoc;
  // Dev: the card with no quotes yet ('empty') or before the RFQ app is installed
  // ('notInstalled') — the company's quotes and the app's state stay as they are.
  const [devPreview, setDevPreview] = React.useState(null);
  const [, setWaitingClosed] = React.useState(0);

  const realQuotes = location
    ? (state.db.quotes || [])
        .filter((q) => q.company === company.id && q.location === location.name)
        .sort((a, b) => String(b.created).localeCompare(String(a.created)))
    : (state.db.quotes || []).filter((q) => q.company === company.id);
  const companyQuotes = devPreview ? [] : realQuotes;
  const rfqInstalled = devPreview === 'notInstalled' ? false : !!state.db.rfqAppInstalled;
  // On the card (company or location): Preview empty while it has quotes, Preview not
  // installed while the app is; one at a time, a note only while previewing.
  const canPreviewEmpty = realQuotes.length > 0;
  const canPreviewNotInstalled = !!state.db.rfqAppInstalled;
  const devButton = (id, label) => (
    <s-press-button pressed={devPreview === id} onClick={() => setDevPreview(devPreview === id ? null : id)}>
      {devPreview === id ? 'Show data' : label}
    </s-press-button>
  );
  const devStrip =
    SHOW_DEV_TOOLS && !full && (canPreviewEmpty || canPreviewNotInstalled) ? (
      <DevStrip id="quotes-empty-states" spaced>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone="info">Dev</s-badge>
          {devPreview === 'empty' ? (
            <s-text fontSize="small" color="subdued">
              {`Previewing the empty state — this ${location ? 'location' : 'company'}’s quotes still exist.`}
            </s-text>
          ) : devPreview === 'notInstalled' ? (
            <s-text fontSize="small" color="subdued">
              Previewing the O:Request a Quote app not installed — the card offers Install app instead.
            </s-text>
          ) : null}
          {canPreviewEmpty ? devButton('empty', 'Preview empty') : null}
          {canPreviewNotInstalled ? devButton('notInstalled', 'Preview not installed') : null}
        </s-stack>
      </DevStrip>
    ) : null;
  // The company's Quotes page (View all), on `filter`: from a location, with a way back to it.
  const openFull = (filter) =>
    location
      ? dispatch({ type: 'OPEN_COMPANY', id: company.id, tab: 'quotes-all', filter, quotesLocation: location.name, backTo: backTo(state, 'quotes-all', company, location) })
      : dispatch({ type: 'SET_COMPANY_TAB', tab: 'quotes-all', filter });

  if (companyQuotes.length === 0) {
    return (
      <CdSection title="Quotes">
        {devStrip}
        <div className="cd-card">
          {/* No quotes anywhere in the store → cross-sell the RFQ app instead (and while
              previewing the app not installed). */}
          {devPreview === 'notInstalled' || noQuotesFromRfqApp(state.db) ? (
            <div className="cd-card__body">
              <QuoteAppCrossSell installed={rfqInstalled} />
            </div>
          ) : (
            // The art (at the empty states' size, as Locations' and Orders'), then Create
            // quote: opens the RFQ app, where quotes are made.
            <div className="cd-card__empty">
              <s-stack gap="small-200" alignItems="center">
                <img
                  src={quotesArt}
                  alt="A quote sheet"
                  style={{ display: 'block', height: 140, width: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }}
                />
                <span>{`No quotes from this ${location ? 'location' : 'company'} yet.`}</span>
                <s-button
                  variant="primary"
                  onClick={() => {
                    window.location.href = withVersion('/');
                  }}
                >
                  Create quote
                </s-button>
              </s-stack>
            </div>
          )}
        </div>
      </CdSection>
    );
  }

  // The full page's Location select: the locations its quotes come from.
  const locationNames = full ? [...new Set(companyQuotes.map((q) => q.location).filter(Boolean))] : [];
  const shownLoc = locationNames.includes(loc) ? loc : 'all';
  const atLocation = shownLoc === 'all' ? companyQuotes : companyQuotes.filter((q) => q.location === shownLoc);

  // Per-choice counts drive the select's labels.
  const subTabs = tabs.map((t) => ({ id: t.id, content: `${t.content} (${atLocation.filter((q) => inTab(t, q)).length})` }));

  const waiting = atLocation.filter(isWaiting).length;
  const waitingKey = `${company.id}::${location ? location.id : 'all'}`;
  const waitingIds = atLocation.filter(isWaiting).map((q) => q.id).join(',');
  const waitingClosed = !full && closedWaiting.get(waitingKey) === waitingIds;
  const closeWaiting = () => {
    closedWaiting.set(waitingKey, waitingIds);
    setWaitingClosed((n) => n + 1);
  };

  const activeTab = tabs.find((t) => t.id === selected) || tabs[0];
  const shown = atLocation.filter((q) => inTab(activeTab, q));

  const pageSize = full ? FULL_PAGE_SIZE : PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;
  const pageQuotes = shown.slice(start, start + pageSize);

  // The row opens the quote; its number is the keyboard target (the click bubbles up).
  const rows = pageQuotes.map((q) => (
    <tr key={q.id} className="cd-row-link" onClick={() => dispatch({ type: 'OPEN_QUOTE', id: q.id })}>
      <td>
        <button type="button" className="cd-link-button">{q.id}</button>
        <span className="cd-sub">{cdDate(q.created) || '—'}</span>
      </td>
      <td>
        {q.buyer}
        {q.email ? <span className="cd-sub">{q.email}</span> : null}
      </td>
      <td>
        <StatusDot tone={QUOTE_STATUS_TONE[q.status]}>{q.status}</StatusDot>
      </td>
      <td>{q.leadScore != null ? q.leadScore : '—'}</td>
      <td>{q.assignee || '—'}</td>
    </tr>
  ));

  return (
    <CdSection
      title="Quotes"
      controls={
        <>
          {full ? null : <ExpandButton id={location ? 'location-quotes-view-all' : 'company-quotes-view-all'} onAction={() => openFull()} />}
          <div style={{ minWidth: 180 }}>
            <s-select
              label="Status"
              labelAccessibilityVisibility="exclusive"
              value={activeTab.id}
              onChange={(e) => {
                setSelected(e.currentTarget.value);
                setPage(0);
              }}
            >
              {subTabs.map((t) => (
                <s-option key={t.id} value={t.id}>
                  {t.content}
                </s-option>
              ))}
            </s-select>
          </div>
          {locationNames.length > 1 ? (
            <div style={{ minWidth: 180 }}>
              <s-select
                label="Location"
                labelAccessibilityVisibility="exclusive"
                value={shownLoc}
                disabled={!!lockedLoc}
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
            </div>
          ) : null}
        </>
      }
    >
      {devStrip}
      {waiting > 0 && !waitingClosed && (
        <CardBanner
          action={
            full
              ? null
              : {
                  label: 'View quotes waiting on a price',
                  onAction: () => openFull('waiting'),
                }
          }
          onDismiss={full ? undefined : closeWaiting}
        >
          {`${waiting} quote${waiting === 1 ? '' : 's'} waiting on a price. Price them in the RFQ app to move them forward.`}
        </CardBanner>
      )}
      <div className="cd-card">
        {shown.length ? (
          <div className="cd-table-scroll">
            <table className="cd-table">
              <thead>
                <tr>
                  <th>Quote ID</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Lead score</th>
                  <th>Assignee</th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        ) : (
          <div className="cd-card__empty">No quotes in this view.</div>
        )}
        {full ? <CardFoot current={current} count={pageCount} label={rangeLabel(start, pageQuotes.length, shown.length)} onPage={setPage} /> : null}
      </div>
    </CdSection>
  );
}
