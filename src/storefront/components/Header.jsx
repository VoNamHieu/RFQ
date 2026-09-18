import React from 'react';
import { useStore } from '../store.jsx';
import { SearchIcon, AccountIcon, CartIcon } from './icons.jsx';

// Dawn header: logo left, nav centre, actions right (search / account / cart).
// The account action doubles as the guest→B2B "Log in" toggle so the demo can
// show both the D2C and the logged-in B2B experience.
export function Header() {
  const { state, dispatch } = useStore();
  const cartCount = state.cart.reduce((n, l) => n + l.qty, 0);
  const go = (view) => dispatch({ type: 'NAVIGATE', view });

  const onAccount = () => {
    if (state.session) go('account');
    else dispatch({ type: 'LOGIN' }); // demo: sign in as the B2B buyer, then...
  };

  return (
    <>
      <div className="announcement">Free shipping on orders over $250 · Trade & bulk pricing available</div>

      {state.session && (
        <div className="b2b-bar">
          <div className="page-width">
            <span>
              Shopping as <strong>{state.session.contact}</strong> · {state.session.companyName}
              {' — '}contract prices applied
            </span>
            <span className="b2b-tag badge badge--blue">{state.session.priceListName}</span>
          </div>
        </div>
      )}

      <header className="header">
        <div className="page-width">
          <div className="header__logo" onClick={() => go('home')}>221 Baker</div>
          <nav className="header__nav">
            <a onClick={() => go('home')}>Home</a>
            <a onClick={() => go('home')}>Catalog</a>
            <a onClick={() => go('home')}>About</a>
            <a onClick={() => go('home')}>Contact</a>
          </nav>
          <div className="header__actions">
            <button className="icon-btn" aria-label="Search"><SearchIcon /></button>
            <button className="icon-btn" aria-label="Account" onClick={onAccount}>
              <AccountIcon />
              <span className="hide-sm">{state.session ? 'Account' : 'Log in'}</span>
            </button>
            <button className="icon-btn" aria-label="Cart" onClick={() => dispatch({ type: 'TOGGLE_CART', open: true })}>
              <CartIcon />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
