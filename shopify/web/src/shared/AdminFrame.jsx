import React, { useEffect, useRef, useState } from 'react';
import { VersionSwitcher } from './VersionSwitcher.jsx';

// Shared simulated-Shopify-admin chrome: a top bar and the left navigation
// around the app's s-page. Inside the real admin, App Bridge renders this
// chrome; outside it (this prototype) the app draws it with plain HTML.
// `sections` is [{ title?, items:[{label, icon, badge, selected, matches,
// disabled, onClick, subNavigationItems}] }] so each app (RFQ / B2B) supplies
// its own nav; `icon` is a Polaris icon name (e.g. 'home'). `app`
// ('rfq'|'b2b') adds the version switcher to the top bar.
export function AdminFrame({ sections, children, searchPlaceholder = 'Search', app, bare = false }) {
  const [navOpen, setNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const userRef = useRef(null);

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const close = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setUserMenuOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  const go = (onClick) => () => {
    setNavOpen(false);
    onClick?.();
  };

  // Embedded (docked in the storefront): the page alone, no top bar or nav.
  if (bare) {
    return (
      <div className="wc-frame">
        <main className="wc-main wc-main--bare">{children}</main>
      </div>
    );
  }

  return (
    <div className="wc-frame" data-nav-open={navOpen}>
      <header className="wc-topbar">
        <div className="wc-topbar__start">
          <button
            type="button"
            className="wc-plain-button wc-topbar__toggle"
            aria-label="Toggle menu"
            onClick={() => setNavOpen((v) => !v)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 5.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5h-12.5a.75.75 0 0 1-.75-.75Zm0 4.25a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5h-12.5a.75.75 0 0 1-.75-.75Zm.75 3.5a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5h-12.5Z" />
            </svg>
          </button>
          {app ? (
            <div className="wc-topbar__switcher">
              <VersionSwitcher app={app} />
            </div>
          ) : null}
        </div>

        <label className="wc-topbar-search">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M12.323 13.383a5.5 5.5 0 1 1 1.06-1.06l2.897 2.897a.75.75 0 1 1-1.06 1.06l-2.897-2.897Zm.677-4.383a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
          </svg>
          <input
            type="search"
            aria-label="Search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </label>

        <div className="wc-topbar__end">
          <div className="wc-user" ref={userRef}>
            <button
              type="button"
              className="wc-plain-button wc-user__button"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen((v) => !v)}
            >
              <span className="wc-user__text">
                <span className="wc-user__name">Charles N</span>
                <span className="wc-user__detail">QuoteSnap</span>
              </span>
              <span className="wc-user__initials" aria-hidden="true">
                CN
              </span>
            </button>
            {userMenuOpen ? (
              <div className="wc-user__menu" role="menu">
                <button type="button" role="menuitem" className="wc-plain-button" onClick={() => setUserMenuOpen(false)}>
                  Back to Shopify
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <nav className="wc-nav" aria-label="Main">
        {sections.map((sec, i) => (
          <div className="wc-nav__section" key={i}>
            {sec.title ? <div className="wc-nav__title">{sec.title}</div> : null}
            {sec.items.map((it) => {
              const subs = it.subNavigationItems || [];
              const current = !!it.selected || !!it.matches || subs.some((s) => s.matches);
              return (
                <div key={it.label}>
                  <button
                    type="button"
                    className="wc-plain-button wc-nav__item"
                    aria-current={current ? 'page' : undefined}
                    disabled={it.disabled}
                    onClick={go(it.onClick)}
                  >
                    {it.icon ? <s-icon type={it.icon} /> : null}
                    <span className="wc-nav__label">{it.label}</span>
                    {it.badge ? <span className="wc-nav__badge">{it.badge}</span> : null}
                  </button>
                  {subs.length > 0 ? (
                    <div className="wc-nav__sub">
                      {subs.map((s) => (
                        <button
                          type="button"
                          key={s.label}
                          className="wc-plain-button wc-nav__subitem"
                          aria-current={s.matches ? 'page' : undefined}
                          disabled={s.disabled}
                          onClick={go(s.onClick)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="wc-nav-backdrop" onClick={() => setNavOpen(false)} />

      <main className="wc-main">{children}</main>
    </div>
  );
}
