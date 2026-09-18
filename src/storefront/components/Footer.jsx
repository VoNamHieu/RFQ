import React from 'react';

// Dawn footer: newsletter + quick links + payment note. Static (prototype).
export function Footer() {
  return (
    <footer className="footer">
      <div className="page-width">
        <div className="footer__cols">
          <div>
            <h4>Subscribe to our emails</h4>
            <p className="footer__muted">Trade offers, new arrivals and bulk-pricing updates.</p>
            <form className="newsletter" onSubmit={(e) => e.preventDefault()}>
              <input className="input" type="email" placeholder="Email" aria-label="Email" />
              <button className="button button--secondary" type="submit">→</button>
            </form>
          </div>
          <div>
            <h4>Shop</h4>
            <ul className="footer__muted">
              <li><a href="#">All products</a></li>
              <li><a href="#">Filters & valves</a></li>
              <li><a href="#">Hoses & sealants</a></li>
              <li><a href="#">Request a quote</a></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul className="footer__muted">
              <li><a href="#">About us</a></li>
              <li><a href="#">Trade accounts</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Shipping & returns</a></li>
            </ul>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} 221 Baker. Powered by Shopify</span>
          <span>Visa · Mastercard · Amex · Shop Pay</span>
        </div>
      </div>
    </footer>
  );
}
