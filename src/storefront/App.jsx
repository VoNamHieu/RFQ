import React, { useEffect } from 'react';
import { useStore } from './store.jsx';
import { Header } from './components/Header.jsx';
import { Footer } from './components/Footer.jsx';
import { CartDrawer } from './components/CartDrawer.jsx';
import { QuoteRequestModal } from './components/QuoteRequestModal.jsx';
import { Home } from './screens/Home.jsx';
import { Product } from './screens/Product.jsx';
import { Account } from './screens/Account.jsx';

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
    </>
  );
}
