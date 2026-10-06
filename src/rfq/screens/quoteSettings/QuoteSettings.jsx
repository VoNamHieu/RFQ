import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SaveBar, Tabs } from '../../../shared/wc.jsx';
import { useStore } from '../../store.jsx';
import { HELP_LINKS, INITIAL_SETTINGS, TABS, clone } from './data.js';
import { ConfirmLeaveModal, FooterHelp } from './parts.jsx';
import { QuoteButtonTab, validateQuoteButton } from './QuoteButtonTab.jsx';
import { HidePriceTab, validateHidePrice } from './HidePriceTab.jsx';
import { HideButtonsTab } from './HideButtonsTab.jsx';
import { HistoryTab, QuoteCartTab } from './WidgetTabs.jsx';
import { CheckoutPagePreview, CheckoutPageSettings } from './CheckoutTab.jsx';
import { HideButtonsPreview, HidePricePreview, HistoryPreview, QuoteButtonPreview, QuoteCartPreview } from './Previews.jsx';
import booknaticBanner from './assets/booknatic_cross_sell.jpg';
import './qset.css';

// Quote settings — rebuilt from the production app's pages/CollectQuotePage.jsx:
// a tab strip (Quote button, Hide price, Hide Add To Cart, Hide Buy Now, Quote
// cart widget, Quote history widget, Checkout page), the app-embed warning,
// each tab's settings cards on the left and a live storefront preview (plus
// the Booknatic cross-sell banner) on the right. Every tab keeps a draft of its
// settings; the contextual save bar saves or discards it, and leaving a tab or
// switching the store mode with unsaved changes asks for confirmation.
// The production child routes collect_quote/button_settings and /hide_price
// render the same ButtonSettings / HidePrice panels as the first two tabs.

// Saved settings outlive the screen (like the app's server state) for the
// rest of the session, so navigating away and back keeps them. So do the
// dismissals production keeps in sessionStorage / shop storage (cross-sell,
// Pareto, "All page" help, country banner); the app-embed warning and the
// checkout-extension banner are page state and come back on every visit.
const cache = { saved: null, mode: 'dtc', dismissed: { crossSell: false, pareto: false, allPagesHelp: false, country: false } };
const PAGE_BANNERS = { embed: true, checkout: true };

const savedFor = (saved, group, mode) => (group === 'checkout' ? saved.checkout : saved[group][mode]);

function validate(group, value) {
  switch (group) {
    case 'quoteButton':
      return validateQuoteButton(value);
    case 'hidePrice':
      return validateHidePrice(value);
    case 'quoteCart':
    case 'history':
      return String(value.custom_styles?.label || '').trim() ? null : { label: true };
    default:
      return null;
  }
}

// CollectQuote/BannerBooknaticCrossSell.jsx
function CrossSellBanner({ onDismiss, toast }) {
  return (
    <div className="qset-crosssell">
      <button type="button" className="qset-crosssell__image" onClick={() => toast('Opens Booknatic on the Shopify App Store')}>
        <img src={booknaticBanner} alt="Booknatic — Not just for sale, make it bookable" />
      </button>
      <div className="qset-crosssell__close">
        <s-button variant="tertiary" icon="x" accessibilityLabel="Dismiss" onClick={onDismiss} />
      </div>
    </div>
  );
}

export function QuoteSettings() {
  const { dispatch } = useStore();
  const toast = useCallback((message) => dispatch({ type: 'TOAST', message }), [dispatch]);

  const [saved, setSaved] = useState(() => cache.saved || clone(INITIAL_SETTINGS));
  const [mode, setMode] = useState(cache.mode);
  const [tabIndex, setTabIndex] = useState(0);
  const tab = TABS[tabIndex];
  const [draft, setDraft] = useState(() => clone(savedFor(saved, tab.group, mode)));
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState({});
  // { tabIndex } | { mode } | { stay: true } waiting for "Leave"
  const [pending, setPending] = useState(null);
  // Which dialog copy to show; kept while the dialog animates closed.
  const [leaveKind, setLeaveKind] = useState('page');
  const askLeave = (next) => {
    setLeaveKind(next.mode ? 'mode' : 'page');
    setPending(next);
  };
  const [banners, setBanners] = useState(() => ({
    ...PAGE_BANNERS,
    ...Object.fromEntries(Object.entries(cache.dismissed).map(([k, v]) => [k, !v])),
  }));
  const setBanner = (key, value) => {
    if (key in cache.dismissed) cache.dismissed[key] = !value;
    setBanners((b) => ({ ...b, [key]: value }));
  };

  // Hover look of the previewed button (production general.isEditingHoverStyle):
  // editing a hover style flashes it for 2s; hovering the preview shows it too.
  const [hoverName, setHoverName] = useState(false);
  const timers = useRef([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);
  const onHoverEdit = (name) => {
    clearTimers();
    timers.current.push(
      setTimeout(() => {
        setHoverName(name);
        timers.current.push(setTimeout(() => setHoverName(false), 2000));
      }, 200),
    );
  };
  const onPreviewHover = (status) => {
    clearTimers();
    timers.current.push(setTimeout(() => setHoverName(status), 200));
  };

  const current = savedFor(saved, tab.group, mode);
  const dirty = JSON.stringify(draft) !== JSON.stringify(current);

  const resetDraft = (group, m, src = saved) => {
    setDraft(clone(savedFor(src, group, m)));
    setTouched(false);
    setErrors({});
  };
  const applyTab = (i) => {
    setTabIndex(i);
    resetDraft(TABS[i].group, mode);
  };
  const applyMode = (m) => {
    setMode(m);
    cache.mode = m;
    resetDraft(tab.group, m);
  };
  const selectTab = (i) => {
    if (i === tabIndex) return;
    if (dirty) askLeave({ tabIndex: i });
    else applyTab(i);
  };
  // Text & translation: picking another language or opening "Multi languages"
  // while the save bar is open only shows the leave confirmation.
  const blockIfDirty = () => {
    if (!dirty) return false;
    askLeave({ stay: true });
    return true;
  };
  const changeMode = (m) => {
    if (m === mode) return;
    if (dirty) askLeave({ mode: m });
    else applyMode(m);
  };
  const leave = () => {
    if (pending?.tabIndex !== undefined) applyTab(pending.tabIndex);
    else if (pending?.mode) applyMode(pending.mode);
    setPending(null);
  };

  const handleChange = (next) => {
    setDraft(next);
    if (touched) setErrors(validate(tab.group, next) || {});
  };
  // Quote cart widget: editing the label / text style clears the "is required" error.
  const resetTouched = () => {
    setTouched(false);
    setErrors({});
  };

  const save = () => {
    const errs = validate(tab.group, draft);
    if (errs) {
      setTouched(true);
      setErrors(errs);
      return;
    }
    const next = clone(saved);
    if (tab.group === 'checkout') next.checkout = clone(draft);
    else next[tab.group][mode] = clone(draft);
    setSaved(next);
    cache.saved = next;
    setTouched(false);
    setErrors({});
    toast('Settings saved!');
  };
  const discard = () => resetDraft(tab.group, mode);

  const goQuoteForm = () => dispatch({ type: 'NAVIGATE', view: 'formBuilder' });

  const common = { mode, onModeChange: changeMode, isTouched: touched, errors, toast };
  let panel = null;
  let preview = null;
  switch (tab.id) {
    case 'quote-button':
      panel = (
        <QuoteButtonTab
          settings={draft}
          onChange={handleChange}
          {...common}
          goQuoteForm={goQuoteForm}
          onHoverEdit={onHoverEdit}
          paretoDismissed={!banners.pareto}
          onDismissPareto={() => setBanner('pareto', false)}
          blockIfDirty={blockIfDirty}
        />
      );
      preview = <QuoteButtonPreview settings={draft} hovering={!!hoverName} onHover={onPreviewHover} />;
      break;
    case 'hide-price':
      panel = <HidePriceTab settings={draft} onChange={handleChange} {...common} banners={banners} setBanner={setBanner} />;
      preview = <HidePricePreview settings={draft} />;
      break;
    case 'hide-add-cart':
    case 'hide-buy-now':
      panel = (
        <HideButtonsTab
          page={tab.id === 'hide-add-cart' ? 'hide_add_cart' : 'hide_buy_now'}
          settings={draft}
          onChange={handleChange}
          {...common}
        />
      );
      preview = <HideButtonsPreview settings={draft} />;
      break;
    case 'quote-cart':
      panel = <QuoteCartTab settings={draft} onChange={handleChange} {...common} onHoverEdit={onHoverEdit} onTextEdit={resetTouched} />;
      preview = <QuoteCartPreview settings={draft} hoverName={hoverName} onHover={onPreviewHover} />;
      break;
    case 'quote-history':
      panel = <HistoryTab settings={draft} onChange={handleChange} {...common} onHoverEdit={onHoverEdit} />;
      preview = <HistoryPreview settings={draft} quoteCart={saved.quoteCart[mode]} hoverName={hoverName} onHover={onPreviewHover} />;
      break;
    case 'quote-checkout':
    default:
      panel = (
        <CheckoutPageSettings
          enabled={!!draft.enabled}
          onChange={(enabled) => handleChange({ ...draft, enabled })}
          showBanner={banners.checkout}
          onDismissBanner={() => setBanner('checkout', false)}
          toast={toast}
        />
      );
      preview = <CheckoutPagePreview enabled={!!draft.enabled} />;
      break;
  }

  return (
    <div className="qset">
      <s-page heading="Quote settings">
        <div className="qset-tabs">
          <Tabs tabs={TABS} selected={tabIndex} onSelect={selectTab} />
        </div>
        <s-box paddingBlockStart="base">
          {banners.embed && (
            <s-box paddingBlockEnd="base">
              <s-banner tone="warning" heading="Action required" dismissible onDismiss={() => setBanner('embed', false)}>
                <s-paragraph>
                  In order for <s-text fontWeight="bold">Quote Snap</s-text> to work on your storefront, go to your online store editor and activate the{' '}
                  <s-text fontWeight="bold">Quote Snap</s-text> app embed
                </s-paragraph>
                <s-button slot="secondary-actions" onClick={() => toast('Opens the theme editor to activate the Quote Snap app embed')}>
                  Activate now
                </s-button>
              </s-banner>
            </s-box>
          )}
          <s-query-container>
            <s-grid gridTemplateColumns={'@container (inline-size > 740px) "minmax(0, 2fr) minmax(0, 1fr)", "minmax(0, 1fr)"'} gap="base">
              <s-box paddingBlockStart="small-200">
                <div className="qset-panel" key={`${tab.id}-${mode}`}>{panel}</div>
              </s-box>
              <div className="qset-aside">
                <s-box paddingBlockStart="small-200">
                  <s-section>{preview}</s-section>
                  {banners.crossSell && (
                    <s-box paddingBlockStart="base">
                      <CrossSellBanner onDismiss={() => setBanner('crossSell', false)} toast={toast} />
                    </s-box>
                  )}
                </s-box>
              </div>
            </s-grid>
          </s-query-container>
        </s-box>
        <FooterHelp text="collect quote" link={HELP_LINKS[tab.id]} />
      </s-page>
      {dirty && <SaveBar onSave={save} onDiscard={discard} />}
      <ConfirmLeaveModal open={!!pending} kind={leaveKind} onClose={() => setPending(null)} onLeave={leave} />
    </div>
  );
}
