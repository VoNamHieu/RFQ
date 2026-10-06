import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';

// Small React helpers around Polaris web components (s-*) for the cases the
// components don't cover declaratively: a modal driven by React state, ids for
// commandFor / interestFor, and app-owned widgets the admin normally provides
// (tabs, toast, contextual save bar). Everything else uses s-* tags directly.

// Tone names coming from data (written for Polaris React) mapped to the tones
// Polaris web components accept: auto | neutral | info | success | caution |
// warning | critical. Use for s-badge / s-banner / s-text / s-icon tone props.
export function wcTone(tone) {
  switch (tone) {
    case 'attention':
    case 'caution':
      return 'caution';
    case 'new':
    case 'magic':
    case 'info':
    case 'info-strong':
      return 'info';
    case 'success':
    case 'success-strong':
    case 'complete':
      return 'success';
    case 'warning':
    case 'warning-strong':
      return 'warning';
    case 'critical':
    case 'critical-strong':
      return 'critical';
    case 'read-only':
    case 'enabled':
    case 'base':
    case 'neutral':
      return 'neutral';
    default:
      return undefined;
  }
}

// A unique id that is safe to use in commandFor / interestFor (React's useId
// contains characters that are awkward in id lookups).
export function useWcId(prefix = 'wc') {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

// s-modal opened and closed by React state: `open` shows/hides the overlay, and
// `onClose` runs only when the merchant dismisses it (close button, Escape,
// backdrop) — not when the app closes it by flipping `open` or unmounting it.
// Put actions in the slots: <s-button slot="primary-action"> and
// <s-button slot="secondary-actions">.
export function Modal({ open = true, onClose, heading, size, padding, children }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const quiet = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (open) {
      quiet.current = false;
      // Wait a frame so a freshly mounted modal is ready for keyboard dismissal.
      const raf = requestAnimationFrame(() => el.showOverlay?.());
      return () => cancelAnimationFrame(raf);
    }
    quiet.current = true;
    el.hideOverlay?.();
    return undefined;
  }, [open]);

  // Unmounting while open still fires `hide`; that close came from the app.
  useLayoutEffect(
    () => () => {
      quiet.current = true;
    },
    [],
  );

  const handleHide = () => {
    if (quiet.current) {
      quiet.current = false;
      return;
    }
    onCloseRef.current?.();
  };

  return (
    <s-modal ref={ref} heading={heading} size={size} padding={padding} onHide={handleHide}>
      {children}
    </s-modal>
  );
}

// Tooltip around arbitrary inline content (a badge, a value). For an s-button,
// s-link or s-icon, put interestFor={id} on it directly instead.
export function Tip({ content, children }) {
  const id = useWcId('tip');
  if (!content) return children;
  return (
    <>
      <s-text interestFor={id}>{children}</s-text>
      <s-tooltip id={id}>{content}</s-tooltip>
    </>
  );
}

// A button that opens an s-menu of actions (Polaris React Popover + ActionList).
// items: [{ content, icon, destructive, disabled, onAction }] (falsy items skipped).
export function MenuButton({ items, children, icon, variant, tone, disabled, accessibilityLabel, slot }) {
  const id = useWcId('menu');
  return (
    <>
      <s-button
        slot={slot}
        commandFor={id}
        icon={icon}
        variant={variant}
        tone={tone}
        disabled={disabled}
        // A label on a button with visible text would replace that text for
        // assistive tech; only icon-only triggers need one.
        accessibilityLabel={children ? undefined : accessibilityLabel}
      >
        {children}
      </s-button>
      <s-menu id={id} accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : 'Actions')}>
        {items.filter(Boolean).map((it, i) => (
          <s-button
            key={i}
            icon={it.icon}
            tone={it.destructive ? 'critical' : undefined}
            disabled={it.disabled}
            onClick={it.onAction}
          >
            {it.content}
          </s-button>
        ))}
      </s-menu>
    </>
  );
}

// Tab strip (Polaris web components have no tabs component).
// tabs: [{ id, content, badge? }] or strings; selected: index; onSelect(index).
export function Tabs({ tabs, selected, onSelect, flush = false }) {
  return (
    <div className={`wc-tabs${flush ? ' wc-tabs--flush' : ''}`} role="tablist">
      {tabs.map((t, i) => {
        const tab = typeof t === 'string' ? { id: t, content: t } : t;
        return (
          <button
            key={tab.id ?? i}
            type="button"
            role="tab"
            aria-selected={i === selected}
            className="wc-plain-button wc-tab"
            onClick={() => onSelect?.(i)}
          >
            {tab.content}
            {tab.badge != null && tab.badge !== '' ? <span className="wc-tab__badge">{tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// The search / view tabs / sort bar that sits in an s-table's `filters` slot
// (Polaris React IndexFilters). Pass `slot="filters"` when it is a direct child
// of s-table. Extra filter controls (s-select …) go in `children`.
//   tabs: [{ id, content }] | strings, selected: index, onSelect(index)
//   sortOptions: [{ label, value, directionLabel }], sortSelected: value, onSort(value)
export function IndexFiltersBar({
  slot,
  query = '',
  onQueryChange,
  queryPlaceholder = 'Search',
  tabs,
  selected = 0,
  onSelect,
  sortOptions,
  sortSelected,
  onSort,
  children,
}) {
  const sortId = useWcId('sort');
  const hasSort = sortOptions && sortOptions.length > 0;
  return (
    <div slot={slot} className="wc-index-filters">
      {tabs && tabs.length > 0 ? <Tabs tabs={tabs} selected={selected} onSelect={onSelect} flush /> : null}
      <s-grid gridTemplateColumns={hasSort ? '1fr auto' : '1fr'} gap="small-200" alignItems="center">
        <s-search-field
          label="Search"
          labelAccessibilityVisibility="exclusive"
          placeholder={queryPlaceholder}
          value={query}
          onInput={(e) => onQueryChange?.(e.currentTarget.value)}
        />
        {hasSort ? (
          <>
            <s-button icon="sort" commandFor={sortId} accessibilityLabel="Sort" />
            <s-popover id={sortId}>
              <s-box padding="small">
                <s-choice-list
                  label="Sort by"
                  name={sortId}
                  onChange={(e) => {
                    const next = e.currentTarget.values?.[0];
                    if (next && next !== sortSelected) onSort?.(next);
                  }}
                >
                  {sortOptions.map((o) => (
                    <s-choice key={o.value} value={o.value} selected={o.value === sortSelected}>
                      {o.directionLabel ? `${o.label} · ${o.directionLabel}` : o.label}
                    </s-choice>
                  ))}
                </s-choice-list>
              </s-box>
            </s-popover>
          </>
        ) : null}
      </s-grid>
      {children}
    </div>
  );
}

// Toast (App Bridge's shopify.toast inside the admin). Auto-dismisses.
export function Toast({ content, onDismiss, duration = 5000 }) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  useEffect(() => {
    const t = setTimeout(() => onDismissRef.current?.(), duration);
    return () => clearTimeout(t);
  }, [content, duration]);
  return (
    <div className="wc-toast" role="status" aria-live="polite">
      <span>{content}</span>
      <button type="button" className="wc-plain-button" aria-label="Dismiss" onClick={() => onDismissRef.current?.()}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M13.97 15.03a.75.75 0 1 0 1.06-1.06l-3.97-3.97 3.97-3.97a.75.75 0 0 0-1.06-1.06l-3.97 3.97-3.97-3.97a.75.75 0 0 0-1.06 1.06l3.97 3.97-3.97 3.97a.75.75 0 1 0 1.06 1.06l3.97-3.97 3.97 3.97Z" />
        </svg>
      </button>
    </div>
  );
}

// Page header with a back arrow (Polaris React Page `backAction`). Outside the
// admin, s-page only renders back navigation as text breadcrumbs ("Companies ›"),
// so pages that go back render this right above an s-page that has no heading:
//   <PageHeader heading="ABC" backAction={{ content: 'Companies', onAction }} />
//   <s-page inlineSize="large">…</s-page>
// `inlineSize` must match the s-page's so the header lines up with its content.
// Actions use Polaris React's Page shapes:
//   primaryAction    { content, onAction, disabled, loading, destructive }
//   secondaryActions [{ content, onAction, icon, disabled, loading, destructive }]
//   actionGroups     [{ title, actions: [{ content, onAction, icon, destructive, disabled }] }]
// `titleMetadata` sits next to the title (badges); `subtitle` goes under it.
export function PageHeader({
  heading,
  backAction,
  titleMetadata,
  subtitle,
  primaryAction,
  secondaryActions = [],
  actionGroups = [],
  inlineSize = 'base',
}) {
  const secondary = secondaryActions.filter(Boolean);
  const groups = actionGroups.filter(Boolean);
  const hasActions = !!primaryAction || secondary.length > 0 || groups.length > 0;
  return (
    <div className={`wc-page-header wc-page-header--${inlineSize}`}>
      <div className="wc-page-header__row">
        {backAction ? (
          <s-button
            variant="tertiary"
            icon="arrow-left"
            accessibilityLabel={backAction.content || 'Back'}
            onClick={backAction.onAction}
          />
        ) : null}
        <div className="wc-page-header__titles">
          <div className="wc-page-header__title-row">
            <h1 className="wc-page-header__title">{heading}</h1>
            {titleMetadata ? <span className="wc-page-header__meta">{titleMetadata}</span> : null}
          </div>
          {subtitle ? <div className="wc-page-header__subtitle">{subtitle}</div> : null}
        </div>
        {hasActions ? (
          <div className="wc-page-header__actions">
            {secondary.map((a, i) => (
              <HeaderButton key={`s${i}`} action={a} />
            ))}
            {groups.map((g, i) => (
              // Same grey "on page" look as s-page's own header buttons.
              <span key={`g${i}`} className="wc-page-header__fill">
                <MenuButton variant="tertiary" items={g.actions}>
                  {g.title}
                </MenuButton>
              </span>
            ))}
            {primaryAction ? (
              <s-button
                variant="primary"
                tone={primaryAction.destructive ? 'critical' : undefined}
                disabled={primaryAction.disabled}
                loading={primaryAction.loading}
                onClick={primaryAction.onAction}
              >
                {primaryAction.content}
              </s-button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// A page-header secondary action. s-page draws neutral header buttons grey on the
// page background and critical ones as outlined red; s-button alone can't, so a
// neutral one is a tertiary button on an app-owned grey fill.
function HeaderButton({ action }) {
  if (action.destructive) {
    return (
      <s-button tone="critical" icon={action.icon} disabled={action.disabled} loading={action.loading} onClick={action.onAction}>
        {action.content}
      </s-button>
    );
  }
  return (
    <span className={`wc-page-header__fill${action.disabled ? ' is-disabled' : ''}`}>
      <s-button
        variant="tertiary"
        icon={action.icon}
        disabled={action.disabled}
        loading={action.loading}
        accessibilityLabel={action.accessibilityLabel}
        onClick={action.onAction}
      >
        {action.content}
      </s-button>
    </span>
  );
}

// Contextual save bar (App Bridge's save bar inside the admin): covers the top
// bar while there are unsaved changes.
export function SaveBar({ message = 'Unsaved changes', onSave, onDiscard, saveLabel = 'Save', discardLabel = 'Discard', saveDisabled }) {
  return (
    <div className="wc-savebar" role="region" aria-label={message}>
      <span>{message}</span>
      <div className="wc-savebar__actions">
        {onDiscard ? (
          <button type="button" className="wc-plain-button wc-savebar__discard" onClick={onDiscard}>
            {discardLabel}
          </button>
        ) : null}
        {onSave ? (
          <button type="button" className="wc-plain-button wc-savebar__save" onClick={onSave} disabled={saveDisabled}>
            {saveLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
