import React from 'react';
import { useWcId } from '../../../shared/wc.jsx';
import productImage from './assets/product_image.webp';
import storeBackground from './assets/store_background.webp';
import viewQuoteIcon from './assets/view_quote_icon.svg';
import viewHistoryIcon from './assets/view_history_quote_icon.svg';

// Live storefront previews shown in the right column — production
// ButtonSettings/ButtonSettingPreview.jsx, HidePrice/HidePricePreview.jsx,
// HideAddCart/HideAddCartPreview.jsx, QuoteForm/Preview/ViewQuoteButton/*.

const DESCRIPTION = 'Made from soft and cozy materials, this turtleneck will keep you warm and stylish on those chilly days.';

// constant/general.jsx valueDefaultStyles
const DEFAULTS = {
  border_radius: '4px',
  font_size: '14px',
  stroke_size: '0px',
  hover_border_radius: '4px',
  hover_font_size: '16px',
  hover_font_size_view_quote: '14px',
};
const dflt = (v, key) => (v === 'Default' ? DEFAULTS[key] : v);

export function buttonInlineStyle(st = {}, hovering, base, hoverFontKey = 'hover_font_size') {
  const s = {
    ...base,
    borderWidth: dflt(st.stroke_size, 'stroke_size'),
    borderStyle: 'solid',
    borderColor: Number(st.stroke_enable) ? st.stroke_color : 'transparent',
    borderRadius: dflt(st.border_radius, 'border_radius'),
    fontWeight: Number(st.text_bold) ? 900 : 500,
    fontStyle: Number(st.text_italic) ? 'italic' : 'normal',
    textDecoration: Number(st.text_underline) ? 'underline' : 'none',
    textAlign: st.text_align,
    boxShadow: Number(st.shadow_enable) ? 'rgba(0, 0, 0, 0.25) 0 4px 4px 0' : 'none',
  };
  if (!hovering || !Number(st.hover_enable)) {
    return { ...s, color: st.font_color, backgroundColor: st.bg_color, fontSize: dflt(st.font_size, 'font_size') };
  }
  return {
    ...s,
    color: st.hover_font_color,
    backgroundColor: st.hover_bg_color,
    borderWidth: dflt(st.hover_stroke_size, 'stroke_size'),
    borderColor: st.hover_stroke_color,
    borderRadius: dflt(st.hover_border_radius, 'hover_border_radius'),
    fontSize: dflt(st.hover_font_size, hoverFontKey),
  };
}

function PreviewHeading() {
  return <s-heading fontSize="large">Preview</s-heading>;
}

function ProductTitle() {
  return <s-heading fontSize="large-300">Women Turtleneck</s-heading>;
}

// ButtonSettingPreview caps the image at 75% width; the hide-price / hide-button
// previews show it at its natural size.
function ProductMedia({ fit = false }) {
  return (
    <div className={`qset-product__media${fit ? ' qset-product__media--fit' : ''}`}>
      <img src={productImage} alt="product image" />
    </div>
  );
}

const MinusSvg = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M5 10a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75Z" />
  </svg>
);
const PlusSvg = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M10.75 5.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
  </svg>
);

// ButtonSettingPreview.jsx — product page with the quote button at its position.
export function QuoteButtonPreview({ settings, hovering, onHover }) {
  const st = settings.custom_styles || {};
  const label = settings.translations?.find((t) => t.is_default)?.translations?.button_label || st.label;
  const pos = settings.position_button;
  const btn = !!Number(settings.show_on_product) && (
    <div className="qset-mt-3">
      <div
        className={`qset-rfq-btn${label ? '' : ' qset-rfq-btn--empty'}`}
        style={buttonInlineStyle(st, hovering, { minWidth: 'min(260px, 100%)', padding: '6px 16px', marginTop: 10 })}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
      >
        {label}
      </div>
    </div>
  );
  return (
    <div>
      <PreviewHeading />
      <div className="qset-product">
        <ProductMedia fit />
        <div className="qset-product__body">
          <ProductTitle />
          {pos === 'title' && btn}
          <div className="qset-mt-3">
            <s-heading fontSize="large-200">$1,725.00</s-heading>
          </div>
          {pos === 'price' && btn}
          <div className="qset-mt-3">
            <s-text>Quantity</s-text>
          </div>
          <div className="qset-qty" aria-hidden="true">
            <MinusSvg />
            <span>1</span>
            <PlusSvg />
          </div>
          <div className="qset-mt-5">
            <div className="qset-mt-3">
              <s-button inlineSize="fill">Add to cart</s-button>
            </div>
            {pos === 'auto' && btn}
            <div className="qset-mt-3 qset-mb-3">
              <s-button inlineSize="fill">Buy it now</s-button>
            </div>
            <s-paragraph>{DESCRIPTION}</s-paragraph>
            {pos === 'description' && btn}
          </div>
        </div>
      </div>
    </div>
  );
}

// HidePricePreview.jsx — what replaces the price for the chosen option.
export function HidePricePreview({ settings }) {
  const { to_see_price: mode, hide_price_full_text_login: fullText = '', hide_price_login_url: url, hide_price_text_login: linkText } = settings;
  let loginContent = fullText;
  if (linkText && fullText && fullText.includes(linkText)) {
    const i = fullText.indexOf(linkText);
    loginContent = (
      <>
        {fullText.slice(0, i)}
        <a className="qset-login-link" href={url || '#'} onClick={(e) => e.preventDefault()}>
          {linkText}
        </a>
        {fullText.slice(i + linkText.length)}
      </>
    );
  }
  return (
    <div>
      <PreviewHeading />
      <div className="qset-product">
        <ProductMedia />
        <div className="qset-product__body">
          <ProductTitle />
          <div className="qset-mt-3">
            <div className="qset-mt-3">
              {mode === 4 && <s-heading fontSize="large-200">$1,725.00</s-heading>}
              {mode === 1 && <s-paragraph fontSize="large">{settings.hide_price_show_text}</s-paragraph>}
              {mode === 2 && <s-paragraph>{loginContent}</s-paragraph>}
              {mode === 3 && (
                <div>
                  <s-paragraph>Enter pass to see price</s-paragraph>
                  <div style={{ width: '75%' }}>
                    <s-text-field label="Password" labelAccessibilityVisibility="exclusive" placeholder="Enter pass to see price" />
                  </div>
                </div>
              )}
            </div>
            <div className="qset-mt-3">
              <s-paragraph>{DESCRIPTION}</s-paragraph>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// HideAddCartPreview.jsx — Add to cart / Buy it now as currently hidden or shown.
export function HideButtonsPreview({ settings }) {
  const { hide_add_cart, hide_buy_now } = settings;
  return (
    <div>
      <PreviewHeading />
      <div className="qset-product">
        <ProductMedia />
        <div className="qset-product__body">
          <ProductTitle />
          <div className="qset-mt-3">
            <s-box paddingBlockEnd="small-200">{!hide_add_cart?.hide && <s-button inlineSize="fill">Add to cart</s-button>}</s-box>
            {!hide_buy_now?.hide && <s-button inlineSize="fill">Buy it now</s-button>}
          </div>
          <div className="qset-mt-3">
            <s-paragraph>{DESCRIPTION}</s-paragraph>
          </div>
        </div>
      </div>
    </div>
  );
}

function widgetButtonStyle(st, side, marginTop, hovering, { minWidth, maxWidth }) {
  return buttonInlineStyle(
    st,
    hovering,
    {
      minWidth,
      maxWidth,
      transform: side === 'right' ? 'rotate(-90deg)' : 'rotate(90deg)',
      transformOrigin: side === 'right' ? 'right bottom' : 'left bottom',
      left: side === 'right' ? 'unset' : 0,
      right: side === 'right' ? 0 : 'unset',
      top: `calc(${marginTop?.amount ?? 0}${marginTop?.unit === 'px' ? 'px' : '%'} - 35px)`,
    },
    'hover_font_size_view_quote',
  );
}

function WidgetIcon({ src, tip, right }) {
  const id = useWcId('qset-widget');
  return (
    <div className="qset-widget-icon" style={{ right }}>
      <s-clickable interestFor={id} accessibilityLabel={tip}>
        <img src={src} alt={tip} />
      </s-clickable>
      <s-tooltip id={id}>{tip}</s-tooltip>
    </div>
  );
}

// PreviewViewQuote.jsx — storefront with the floating "View quote" widget.
export function QuoteCartPreview({ settings, hoverName, onHover }) {
  const { side, margin_top } = settings.view_quote_position || {};
  const st = settings.custom_styles || {};
  return (
    <div className="qset-store" style={{ backgroundImage: `url(${storeBackground})` }}>
      {!!Number(settings.show_view_button) &&
        (side !== 'next_cart' ? (
          <div
            className="qset-widget-btn"
            style={widgetButtonStyle(st, side, margin_top, hoverName === 'view-quote', { minWidth: 160, maxWidth: 200 })}
            onMouseEnter={() => onHover('view-quote')}
            onMouseLeave={() => onHover(false)}
          >
            {st.label}
          </div>
        ) : (
          <WidgetIcon src={viewQuoteIcon} tip="View quote" right={185} />
        ))}
    </div>
  );
}

// PreviewHistoryQuote.jsx — same storefront with the quote history widget.
export function HistoryPreview({ settings, quoteCart, hoverName, onHover }) {
  const { side, margin_top } = settings.view_history_quote_position || {};
  const st = settings.custom_styles || {};
  const cartNextToIcon = !!Number(quoteCart?.show_view_button) && quoteCart?.view_quote_position?.side === 'next_cart';
  return (
    <div className="qset-store" style={{ backgroundImage: `url(${storeBackground})` }}>
      {!!Number(settings.show_history_quotes_button) &&
        (side !== 'next_cart' ? (
          <div
            className="qset-widget-btn"
            style={widgetButtonStyle(st, side, margin_top, hoverName === 'view-history-quote', { minWidth: 200, maxWidth: 240 })}
            onMouseEnter={() => onHover('view-history-quote')}
            onMouseLeave={() => onHover(false)}
          >
            {st.label}
          </div>
        ) : (
          <WidgetIcon src={viewHistoryIcon} tip="View quote history" right={cartNextToIcon ? 225 : 185} />
        ))}
    </div>
  );
}
