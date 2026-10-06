import React, { useState } from 'react';
import { useWcId } from '../../../shared/wc.jsx';
import { A, fmt } from './copy.js';
import logoApp from './assets/logo_app.webp';

// components/TooltipCard + TitleTooltip: a bold metric title with a dotted underline;
// hovering it shows the tooltip card (bold title + description). s-tooltip renders
// s-paragraph / s-text children, so `content` may be a string or s-paragraph JSX.
// (s-tooltip only accepts s-text / s-paragraph children, so the card's 4px BlockStack
// gap between title and description can't be reproduced.)
export function TooltipCard({ title, content }) {
  return (
    <>
      <s-paragraph fontWeight="bold">{title}</s-paragraph>
      {typeof content === 'string' ? <s-paragraph>{content}</s-paragraph> : content}
    </>
  );
}

export function TitleTooltip({ title, tooltipTitle, tooltipContent, truncate = false }) {
  const id = useWcId('qan-tip');
  return (
    <div className={truncate ? 'qan-ellipsis' : undefined}>
      <s-text interestFor={id} fontWeight="bold">
        <span className="qan-underline">{title}</span>
      </s-text>
      <s-tooltip id={id}>
        <TooltipCard title={tooltipTitle} content={tooltipContent} />
      </s-tooltip>
    </div>
  );
}

// Two-line tooltip body (conversion rate): the definition + the subdued formula.
export function TwoLines({ line1, line2 }) {
  return (
    <>
      <s-paragraph>{line1}</s-paragraph>
      <s-paragraph color="subdued">{line2}</s-paragraph>
    </>
  );
}

// components/ReportChatBar (the TextField has no form/onSubmit in production, so only
// the send button or a suggestion submits — Enter does nothing).
const SUGGESTIONS = [A.report.suggestions.customersNotBought, A.report.suggestions.clickedRarelyConverted];

export function ReportChatBar({ onSubmit }) {
  const [question, setQuestion] = useState('');
  const canSend = question.trim().length > 0;
  const submit = (value) => {
    const text = (value ?? question).trim();
    if (!text) return;
    onSubmit(text);
    setQuestion('');
  };
  return (
    <s-stack gap="small">
      <s-section>
        <div className="qan-chat">
          <img src={logoApp} alt="QuoteSnap" width={28} height={28} className="qan-chat__logo" />
          <input
            className="qan-chat__input"
            type="text"
            aria-label={A.report.chatPlaceholder}
            placeholder={A.report.chatPlaceholder}
            value={question}
            autoComplete="off"
            onChange={(e) => setQuestion(e.target.value)}
          />
          <s-button icon="arrow-up" accessibilityLabel={A.report.send} disabled={!canSend} onClick={() => submit()} />
        </div>
      </s-section>
      <div className="qan-suggestions">
        {SUGGESTIONS.map((text) => (
          <button key={text} type="button" className="qan-suggestion" onClick={() => submit(text)}>
            <MagicIcon />
            {text}
          </button>
        ))}
      </div>
    </s-stack>
  );
}

// Polaris MagicIcon / ImageIcon (polaris-icons paths) drawn inline — they sit inside
// native elements.
function MagicIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5.702 4.253a.625.625 0 0 1 1.096 0l.196.358c.207.378.517.688.895.895l.358.196a.625.625 0 0 1 0 1.097l-.358.196a2.25 2.25 0 0 0-.895.894l-.196.359a.625.625 0 0 1-1.096 0l-.196-.359a2.25 2.25 0 0 0-.895-.894l-.358-.196a.625.625 0 0 1 0-1.097l.358-.196a2.25 2.25 0 0 0 .895-.895l.196-.358Z" />
      <path
        fillRule="evenodd"
        d="M12.948 7.89c-.18-1.167-1.852-1.19-2.064-.029l-.03.164a3.756 3.756 0 0 1-3.088 3.031c-1.15.189-1.173 1.833-.03 2.054l.105.02a3.824 3.824 0 0 1 3.029 3.029l.032.165c.233 1.208 1.963 1.208 2.196 0l.025-.129a3.836 3.836 0 0 1 3.077-3.045c1.184-.216 1.12-1.928-.071-2.107a3.789 3.789 0 0 1-3.18-3.154Zm-.944 6.887a5.34 5.34 0 0 1 2.542-2.647 5.305 5.305 0 0 1-2.628-2.548 5.262 5.262 0 0 1-2.488 2.508 5.329 5.329 0 0 1 2.574 2.687Z"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      <path
        fillRule="evenodd"
        d="M9.018 3.5h1.964c.813 0 1.469 0 2 .043.546.045 1.026.14 1.47.366a3.75 3.75 0 0 1 1.64 1.639c.226.444.32.924.365 1.47.043.531.043 1.187.043 2v1.964c0 .813 0 1.469-.043 2-.045.546-.14 1.026-.366 1.47a3.75 3.75 0 0 1-1.639 1.64c-.444.226-.924.32-1.47.365-.531.043-1.187.043-2 .043h-1.964c-.813 0-1.469 0-2-.043-.546-.045-1.026-.14-1.47-.366a3.75 3.75 0 0 1-1.64-1.639c-.226-.444-.32-.924-.365-1.47-.043-.531-.043-1.187-.043-2v-1.964c0-.813 0-1.469.043-2 .045-.546.14-1.026.366-1.47a3.75 3.75 0 0 1 1.639-1.64c.444-.226.924-.32 1.47-.365.531-.043 1.187-.043 2-.043Zm-1.877 1.538c-.454.037-.715.107-.912.207a2.25 2.25 0 0 0-.984.984c-.1.197-.17.458-.207.912-.037.462-.038 1.057-.038 1.909v1.428l.723-.867a1.75 1.75 0 0 1 2.582-.117l2.695 2.695 1.18-1.18a1.75 1.75 0 0 1 2.604.145l.216.27v-2.374c0-.852 0-1.447-.038-1.91-.037-.453-.107-.714-.207-.911a2.25 2.25 0 0 0-.984-.984c-.197-.1-.458-.17-.912-.207-.462-.037-1.056-.038-1.909-.038h-1.9c-.852 0-1.447 0-1.91.038Zm-2.103 7.821a7.12 7.12 0 0 1-.006-.08.746.746 0 0 0 .044-.049l1.8-2.159a.25.25 0 0 1 .368-.016l3.226 3.225a.75.75 0 0 0 1.06 0l1.71-1.71a.25.25 0 0 1 .372.021l1.213 1.516c-.021.06-.045.114-.07.165-.216.423-.56.767-.984.983-.197.1-.458.17-.912.207-.462.037-1.056.038-1.909.038h-1.9c-.852 0-1.447 0-1.91-.038-.453-.037-.714-.107-.911-.207a2.25 2.25 0 0 1-.984-.984c-.1-.197-.17-.458-.207-.912Z"
      />
    </svg>
  );
}

// Polaris Avatar with `customer`: the person outline on the neutral avatar fill (no
// per-name colour), 8px radius. size "xl" = 40px (Top customers), "lg" = 32px (leak).
export function CustomerAvatar({ name, size = 'xl' }) {
  const strokeWidth = size === 'xl' ? 2 : 2.5;
  return (
    <span className={`qan-avatar qan-avatar--${size}`} role="img" aria-label={name}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          d="M25.5 13.5C25.5 16.5376 23.0376 19 20 19C16.9624 19 14.5 16.5376 14.5 13.5C14.5 10.4624 16.9624 8 20 8C23.0376 8 25.5 10.4624 25.5 13.5Z"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.3433 29.682L9.47 31.254C9.03481 32.0373 9.60125 33 10.4974 33H29.5026C30.3988 33 30.9652 32.0373 30.53 31.254L29.6567 29.682C27.7084 26.175 24.0119 24 20 24C15.9882 24 12.2916 26.175 10.3433 29.682Z"
        />
      </svg>
    </span>
  );
}

// Polaris Thumbnail (medium 60px / small 40px) with the ImageIcon fallback.
export function Thumb({ src, alt, size = 'medium' }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`qan-thumb${size === 'small' ? ' qan-thumb--small' : ''}`}>
      {src && !broken ? <img src={src} alt={alt} onError={() => setBroken(true)} /> : <ImageIcon />}
    </div>
  );
}

// ResourceList stand-in: 12px-padded items separated by hairlines. Every Polaris
// ResourceItem is interactive (hover fill, pointer); rows with onItemClick are buttons.
export function ResourceRows({ items, renderMedia, renderTitle, renderMeta, onItemClick, getKey }) {
  return (
    <ul className="qan-list">
      {items.map((item) => {
        const body = (
          <>
            {renderMedia(item)}
            <div>
              <div className="qan-row__title">{renderTitle(item)}</div>
              {renderMeta(item)}
            </div>
          </>
        );
        return (
          <li key={getKey(item)} className="qan-list__item">
            {onItemClick ? (
              <button type="button" className="qan-row" onClick={() => onItemClick(item)}>
                {body}
              </button>
            ) : (
              <div className="qan-row">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Polaris Pagination: previous / optional label / next as one segmented group; the
// label is subdued while either end is reached.
export function Pager({ hasPrevious, hasNext, onPrevious, onNext, label }) {
  return (
    <nav className="qan-pager" aria-label="Pagination">
      <s-button icon="chevron-left" accessibilityLabel="Previous" disabled={!hasPrevious} onClick={onPrevious} />
      {label ? (
        <span className="qan-pager__label" aria-live="polite">
          <s-text color={hasPrevious && hasNext ? undefined : 'subdued'}>{label}</s-text>
        </span>
      ) : null}
      <s-button icon="chevron-right" accessibilityLabel="Next" disabled={!hasNext} onClick={onNext} />
    </nav>
  );
}

// DataVisualize/Rankings/*: fixed 230px scroll area, "No data" centered when empty.
export function RankingList({ items, kind, onOpenProduct }) {
  const top = items.slice(0, 10);
  return (
    <div className="qan-ranking" role="listbox">
      {top.length === 0 ? (
        <div className="qan-ranking__empty">
          <s-text color="subdued">{A.common.noDataForDateRange}</s-text>
        </div>
      ) : kind === 'customers' ? (
        <ResourceRows
          items={top}
          getKey={(c) => c.customerEmail}
          renderMedia={(c) => <CustomerAvatar name={c.customerName} size="xl" />}
          renderTitle={(c) => c.customerEmail}
          renderMeta={(c) => <div className="qan-row__meta">{fmt(A.common.quotesCount, { count: c.quotedQuantity })}</div>}
        />
      ) : kind === 'clicked' ? (
        <ResourceRows
          items={top}
          getKey={(p) => String(p.product_id)}
          onItemClick={(p) => onOpenProduct(p.product_title)}
          renderMedia={(p) => <Thumb src={p.product_image} alt={p.product_title} />}
          renderTitle={(p) => p.product_title}
          renderMeta={(p) => <div className="qan-row__meta">{fmt(A.common.clicksCount, { count: p.clicks })}</div>}
        />
      ) : (
        <ResourceRows
          items={top}
          getKey={(p) => String(p.productId)}
          onItemClick={(p) => onOpenProduct(p.productTitle)}
          renderMedia={(p) => <Thumb src={p.productImage} alt={p.productTitle} />}
          renderTitle={(p) => p.productTitle}
          renderMeta={(p) => <div className="qan-row__meta">{fmt(A.common.timesCount, { count: p.quotedQuantity })}</div>}
        />
      )}
    </div>
  );
}

export const initialsOf = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
