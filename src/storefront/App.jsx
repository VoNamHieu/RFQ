import React, { useEffect } from 'react';
import { useStore } from './store.jsx';
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
    else window.location.href = '/b2b';
  };
  return (
    <button className="dev-switch" onClick={back} title="Back to the admin app UI">
      ← Back to app
    </button>
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
    </>
  );
}
