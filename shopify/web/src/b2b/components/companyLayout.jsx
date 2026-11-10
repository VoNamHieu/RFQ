import React from 'react';
import { Tip } from '../../shared/wc.jsx';
import './companyLayout.css';

// The company page's look, after the merchant's mockup: a section's title (and its
// filter) above a bordered card, plain tables with two-line cells, a pager row in the
// card, statuses as a dot and a word, and a flat side column split by hairlines.

// A main-column section: title (and subtitle) on the left, its controls on the right,
// then its card.
export function CdSection({ title, subtitle, info, controls, children }) {
  return (
    <section>
      <div className="cd-section__head">
        <div>
          <div className="cd-side-block__title">
            <h2 className="cd-section__title">{title}</h2>
            {info ? (
              <Tip content={info}>
                <s-icon type="info" color="subdued" />
              </Tip>
            ) : null}
          </div>
          {subtitle ? <p className="cd-section__subtitle">{subtitle}</p> : null}
        </div>
        {controls ? <div className="cd-section__controls">{controls}</div> : null}
      </div>
      {children}
    </section>
  );
}

// A list page's top, in the company page's look: when it was opened from another page,
// the way back there (a round arrow and that page's name); then the title (and a grey
// line under it) with its actions on the right; then `below` (e.g. tabs).
// `back`: { label, onAction }. `actionsOnTop`: the actions sit on the back's row, as on
// the company and order pages (the pricing editor: Cancel and Save).
export function CdPageHead({ title, subtitle, back, actions, actionsOnTop = false, below }) {
  const actionsBox = actions ? <div className="cd-list-head__actions">{actions}</div> : null;
  return (
    <>
      {back ? (
        <div className="cd-topbar">
          <button type="button" className="cd-back" onClick={back.onAction}>
            <span className="cd-back__circle">
              <s-icon type="chevron-left" />
            </span>
            {back.label}
          </button>
          {actionsOnTop ? actionsBox : null}
        </div>
      ) : null}
      <div className="cd-list-head">
        <div>
          <h1 className="cd-title">{title}</h1>
          {subtitle ? <p className="cd-subtitle">{subtitle}</p> : null}
        </div>
        {back && actionsOnTop ? null : actionsBox}
      </div>
      {below}
    </>
  );
}

// A status as a coloured dot and its name. tone: attention, info, success, warning,
// critical; none = neutral grey.
export function StatusDot({ tone, children }) {
  return (
    <span className="cd-status">
      <span className={`cd-dot cd-dot--${tone || 'neutral'}`} aria-hidden="true" />
      {children}
    </span>
  );
}

// A blue (info) note between a section's title and its card, with an arrow button that
// opens the list it's about; `action` null leaves the button out. Drawn to match the
// banner Shopify admin renders (filled light blue, blue "i", grey arrow button): the
// CDN's s-banner draws an older, white one.
// `onDismiss`: an ✕ that closes it, last on its row. `textAction`: the action as a button
// with its label (Shopify's banner) instead of the arrow — the review banners, by their ✕,
// so the two don't read as alike. `tone="warning"`: the orange one, with a "!".
export function CardBanner({ children, action, onDismiss, tone, textAction = false }) {
  const warning = tone === 'warning';
  return (
    <div className={`cd-banner${warning ? ' cd-banner--warning' : ''}`} role="status">
      <svg className="cd-banner__icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <circle cx="10" cy="10" r="7" fill="currentColor" />
        {warning ? (
          <>
            <rect x="9.25" y="6" width="1.5" height="5" rx="0.75" fill="#fff" />
            <circle cx="10" cy="13" r="1" fill="#fff" />
          </>
        ) : (
          <>
            <circle cx="10" cy="7" r="1" fill="#fff" />
            <rect x="9.25" y="9" width="1.5" height="5" rx="0.75" fill="#fff" />
          </>
        )}
      </svg>
      <span className="cd-banner__text">{children}</span>
      {action && textAction ? (
        <s-button onClick={action.onAction}>{action.label}</s-button>
      ) : action ? (
        <button type="button" className="cd-banner__action" aria-label={action.label} onClick={action.onAction}>
          <s-icon type="arrow-right" />
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" className="cd-banner__dismiss" aria-label="Dismiss" onClick={onDismiss}>
          <s-icon type="x" size="small" />
        </button>
      ) : null}
    </div>
  );
}

// The card's footer row: the pager (when there's more than one page).
export function CardFoot({ current, count, label, onPage }) {
  if (count <= 1) return null;
  return (
    <div className="cd-card__foot">
      <div className="cd-pager">
        <s-button icon="chevron-left" variant="tertiary" accessibilityLabel="Previous page" disabled={current === 0} onClick={() => onPage(current - 1)} />
        <span>{label}</span>
        <s-button icon="chevron-right" variant="tertiary" accessibilityLabel="Next page" disabled={current >= count - 1} onClick={() => onPage(current + 1)} />
      </div>
    </div>
  );
}

// View all, by a section's title: the expand icon, "View all" on hover; it opens the
// section on a page of its own.
export function ExpandButton({ id, onAction }) {
  return (
    <>
      <s-button icon="maximize" variant="tertiary" accessibilityLabel="View all" interestFor={`${id}-tip`} onClick={onAction} />
      <s-tooltip id={`${id}-tip`}>View all</s-tooltip>
    </>
  );
}

// "1–5 of 7" for a pager.
export const rangeLabel = (start, shown, total) => (total ? `${start + 1}–${start + shown} of ${total}` : '0 of 0');

// How to read the Pricing, Contract and Order limits blocks: an info icon by their
// title shows it on hover.
export const BLOCK_HELP = {
  pricing:
    'Green names are active; grey ones aren’t, with their status after the name. Hover a name to see its settings; click it to open the pricing.',
  contract: 'Hover a contract number to see its overview; click it to open the contract.',
  limits:
    'Green names are active; grey ones aren’t, with their status after the name. Hover a name to see its settings; click it to open the limit.',
};

// A side-column block: title (with an info icon whose tooltip says how to read it, when
// `info` is set, and its actions) over rows split by hairlines.
export function SideBlock({ title, info, actions, note, children }) {
  return (
    <section>
      <div className="cd-side-block__head">
        <div className="cd-side-block__title">
          <h2 className="cd-section__title">{title}</h2>
          {info ? (
            <Tip content={info}>
              <s-icon type="info" color="subdued" />
            </Tip>
          ) : null}
        </div>
        {actions ? <div className="cd-side-block__actions">{actions}</div> : null}
      </div>
      {note ? <p className="cd-side-block__note">{note}</p> : null}
      {children}
    </section>
  );
}

// One row of a side block: a small grey label over its value.
export function SideRow({ label, children }) {
  return (
    <div className="cd-row">
      {label ? <div className="cd-row__label">{label}</div> : null}
      <div className="cd-row__value">{children}</div>
    </div>
  );
}

// "Jul 14, 2026" from "2026-07-14" or "2026-07-14 15:53:51".
export function cdDate(value) {
  if (!value) return '';
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Back from a list opened by a "View …" link ───────────────────────────────
// A company or location page's "View pricing library", "View all order limits" and
// "View all contracts" open their list (`to`: its view) with a way back here: the
// list shows a back arrow before its title (backActionFor), as Shopify admin does.
// A company page comes back as it was: its tab or page (Orders' full page), that page's
// location and status filters, and its own way back. `label` names it (default: the
// company's or location's name).
export const backTo = (state, to, company, location = null, label = null) => ({
  from: to,
  label: label || (location ? location.name : company.name),
  view: location ? 'location' : 'company',
  patch: location
    ? { selectedCompany: company.id, selectedLocation: location.id }
    : {
        selectedCompany: company.id,
        companyTab: state.companyTab,
        ordersLocation: state.ordersLocation,
        companyListFilter: state.companyListFilter,
        backTo: state.backTo || null,
      },
});
// The list's back action, or null when it wasn't opened from a company or location page.
export function backActionFor(state, dispatch, view) {
  const b = state.backTo;
  if (!b || b.from !== view) return null;
  return { content: `Back to ${b.label}`, onAction: () => dispatch({ type: 'NAVIGATE', view: b.view, patch: { backTo: null, ...b.patch } }) };
}
