import React, { useState, useCallback } from 'react';
import { Frame, Navigation, TopBar } from '@shopify/polaris';

// Shared simulated-Shopify-admin chrome: a Polaris Frame with a top bar and the
// left Navigation. `sections` is [{ title?, items:[{label, icon, badge, selected,
// disabled, onClick}] }] so each app (RFQ / B2B) supplies its own nav.
export function AdminFrame({ sections, children, searchPlaceholder = 'Search' }) {
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

  const topBar = (
    <TopBar
      showNavigationToggle
      userMenu={userMenu}
      searchField={searchField}
      onNavigationToggle={toggleMobileNav}
    />
  );

  const navigation = (
    <Navigation location="/">
      {sections.map((sec, i) => (
        <Navigation.Section
          key={i}
          title={sec.title}
          items={sec.items.map((it) => ({
            label: it.label,
            icon: it.icon,
            badge: it.badge,
            selected: it.selected,
            disabled: it.disabled,
            onClick: it.onClick,
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
