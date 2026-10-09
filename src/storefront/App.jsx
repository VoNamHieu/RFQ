import React, { useEffect, useState } from 'react';
import { useStore } from './store.jsx';
import { withVersion, versionFlags, activeVersion, DEFAULT_VERSION } from '../shared/versions.js';
import { Header } from './components/Header.jsx';
import { Footer } from './components/Footer.jsx';
import { CartDrawer } from './components/CartDrawer.jsx';
import { QuoteRequestModal } from './components/QuoteRequestModal.jsx';
import { Home } from './screens/Home.jsx';
import { Product } from './screens/Product.jsx';
import { Account } from './screens/Account.jsx';
import { BusinessAccount } from './screens/BusinessAccount.jsx';

function CurrentView() {
  const { state } = useStore();
  switch (state.view) {
    case 'product': return <Product />;
    case 'home':
    default: return <Home />;
  }
}

function Toast() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2600);
    return () => clearTimeout(t);
  }, [state.toast, dispatch]);
  if (!state.toast) return null;
  return <div className="toast">{state.toast}</div>;
}

// Prototype-only affordance: jump from the customer storefront back to the admin
// app UI. Returns to whichever app opened the storefront (its URL is the
// referrer, since in-storefront navigation is state-only), else the B2B app.
function AppSwitch() {
  const back = () => {
    const ref = document.referrer;
    const cameFromApp = ref && ref.includes(window.location.host) && !ref.includes('/storefront');
    if (cameFromApp) window.history.back();
    else window.location.href = withVersion('/b2b');
  };
  return (
    <button className="dev-switch" onClick={back} title="Back to the admin app UI">
      ← Back to app
    </button>
  );
}

// Prototype-only: the B2B app's Order limits screen docked over the storefront
// (Upcoming, where order limits exist). A change there saves the limits the cart
// checks against, so it shows here right away. Opened once, the app stays loaded
// while the dock is hidden, so its open editor isn't lost.
function adminUrl() {
  const dev = window.location.pathname.startsWith('/src/');
  const params = new URLSearchParams({ embed: 'limits' });
  if (activeVersion() !== DEFAULT_VERSION) params.set('v', activeVersion());
  return `${dev ? '/src/b2b/index.html' : '/b2b/'}?${params}`;
}
function AdminDock() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!versionFlags().orderLimits) return null;
  return (
    <>
      {!open && (
        <button className="dev-switch dev-switch--end" onClick={() => { setOpen(true); setLoaded(true); }} title="Edit order limits in the B2B app">
          Order limits
        </button>
      )}
      {loaded && (
        <div className={`admin-dock${state.cartOpen ? ' admin-dock--beside-cart' : ''}`} hidden={!open}>
          <div className="admin-dock__head">
            <span>Order limits · B2B app</span>
            <button className="admin-dock__close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <iframe title="Order limits" src={adminUrl()} />
        </div>
      )}
    </>
  );
}

export function App() {
  const { state } = useStore();
  // Scroll to top on page change (a router would do this for us).
  useEffect(() => { window.scrollTo({ top: 0 }); }, [state.view, state.currentSku]);

  // The account view is its own portal (own header + nav), like Shopify's new
  // customer accounts — it doesn't use the shopping header/footer/cart.
  if (state.view === 'account') {
    return (
      <>
        <Account />
        <QuoteRequestModal />
        <Toast />
        <AppSwitch />
      </>
    );
  }

  // "Apply for a business account" is a standalone auth/account-style page (its
  // own minimal header + centred card), the same portal world as the account.
  if (state.view === 'register') {
    return (
      <>
        <BusinessAccount />
        <Toast />
        <AppSwitch />
      </>
    );
  }

  return (
    <>
      <Header />
      <main><CurrentView /></main>
      <Footer />
      <CartDrawer />
      <QuoteRequestModal />
      <Toast />
      <AppSwitch />
      <AdminDock />
    </>
  );
}
