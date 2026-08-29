import React, { useState, useCallback } from 'react';
import { Frame, Navigation, TopBar } from '@shopify/polaris';
import { VersionSwitcher } from './VersionSwitcher.jsx';

// Shared simulated-Shopify-admin chrome: a Polaris Frame with a top bar and the
// left Navigation. `sections` is [{ title?, items:[{label, icon, badge, selected,
// disabled, onClick, subNavigationItems}] }] so each app (RFQ / B2B) supplies its
// own nav. `app` ('rfq'|'b2b') adds the version switcher to the top bar.
export function AdminFrame({ sections, children, searchPlaceholder = 'Search', app, location }) {
  const [mobileNavActive, setMobileNavActive] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const toggleMobileNav = useCallback(() => setMobileNavActive((v) => !v), []);

  const userMenu = (
    <TopBar.UserMenu
      name="Charles N"
      detail="QuoteSnap"
      initials="CN"
      open={userMenuOpen}
      onToggle={() => setUserMenuOpen((v) => !v)}
      actions={[{ items: [{ content: 'Back to Shopify' }] }]}
    />
  );

  const searchField = (
    <TopBar.SearchField
      value={searchValue}
      placeholder={searchPlaceholder}
      onChange={setSearchValue}
    />
  );

  // Version switcher on the LEFT (TopBar contextControl slot).
  const contextControl = app ? (
    <div style={{ minWidth: 170, maxWidth: 240, paddingInline: 12, display: 'flex', alignItems: 'center', height: '100%' }}>
      <VersionSwitcher app={app} />
    </div>
  ) : undefined;

  const topBar = (
    <TopBar
      showNavigationToggle
      userMenu={userMenu}
      searchField={searchField}
      contextControl={contextControl}
      onNavigationToggle={toggleMobileNav}
    />
  );

  const navigation = (
    <Navigation location={location || '/'}>
      {sections.map((sec, i) => (
        <Navigation.Section
          key={i}
          title={sec.title}
          items={sec.items.map((it) => ({
            label: it.label,
            icon: it.icon,
            badge: it.badge,
            url: it.url,
            selected: it.selected,
            disabled: it.disabled,
            onClick: it.onClick,
            subNavigationItems: it.subNavigationItems,
          }))}
        />
      ))}
    </Navigation>
  );

  return (
    <Frame
      topBar={topBar}
      navigation={navigation}
      showMobileNavigation={mobileNavActive}
      onNavigationDismiss={() => setMobileNavActive(false)}
    >
      {children}
    </Frame>
  );
}
