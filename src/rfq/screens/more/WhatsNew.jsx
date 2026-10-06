import React, { useMemo, useState } from 'react';
import { Tabs } from '../../../shared/wc.jsx';
import { useStore } from '../../store.jsx';
import { CATEGORY_LABELS, CATEGORY_ORDER, CHANGELOG_ENTRIES } from './data.js';
import { LOGOS } from './shared.jsx';
import './more.css';

// Rebuilt from the production app's pages/WhatsNew/index.jsx (+ constant/changelog.js,
// assets/styles/_whatsNew.scss): a searchable, category-filtered changelog timeline.

const ENTRIES_PER_PAGE = 5;

// Polaris ExternalIcon. Production renders it in a plain Button, where the icon takes the link
// colour (s-icon keeps the base icon colour), so it is drawn inline with currentColor.
function ExternalIcon() {
  return (
    <svg className="more-wn-help__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M11.75 3.5a.75.75 0 0 0 0 1.5h2.19l-4.97 4.97a.75.75 0 1 0 1.06 1.06l4.97-4.97v2.19a.75.75 0 0 0 1.5 0v-4a.75.75 0 0 0-.75-.75h-4Z" />
      <path d="M15 10.967a.75.75 0 0 0-1.5 0v2.783c0 .69-.56 1.25-1.25 1.25h-6c-.69 0-1.25-.56-1.25-1.25v-6c0-.69.56-1.25 1.25-1.25h2.783a.75.75 0 0 0 0-1.5h-2.783a2.75 2.75 0 0 0-2.75 2.75v6a2.75 2.75 0 0 0 2.75 2.75h6a2.75 2.75 0 0 0 2.75-2.75v-2.783Z" />
    </svg>
  );
}

const formatDate = (isoDate) => {
  try {
    return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${isoDate}T00:00:00`));
  } catch {
    return isoDate;
  }
};

export function WhatsNew() {
  const { dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const tabs = useMemo(() => {
    const present = CATEGORY_ORDER.filter((category) => CHANGELOG_ENTRIES.some((entry) => entry.category === category));
    return [{ id: 'all', content: CATEGORY_LABELS.all }, ...present.map((category) => ({ id: category, content: CATEGORY_LABELS[category] }))];
  }, []);

  const handleSearch = (value) => {
    setQuery(value);
    setCurrentPage(1);
  };

  const handleTabChange = (index) => {
    setSelectedTab(index);
    setCurrentPage(1);
  };

  const activeCategory = tabs[selectedTab]?.id ?? 'all';
  const normalizedQuery = query.trim().toLowerCase();
  const filteredEntries = CHANGELOG_ENTRIES.filter((entry) => {
    if (activeCategory !== 'all' && entry.category !== activeCategory) return false;
    if (!normalizedQuery) return true;
    return `${entry.title} ${entry.description}`.toLowerCase().includes(normalizedQuery);
  });

  // Clamp the page so a shrinking result set never lands on an empty page.
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / ENTRIES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedEntries = filteredEntries.slice((safePage - 1) * ENTRIES_PER_PAGE, safePage * ENTRIES_PER_PAGE);

  const handleSettingClick = (cta) => {
    if (cta.view) dispatch({ type: 'NAVIGATE', view: cta.view, patch: cta.patch });
    else dispatch({ type: 'TOAST', message: cta.toast });
  };

  return (
    <s-page heading="What's New">
      {/* Page subtitle (bodySm, secondary) */}
      <div className="more-wn-subtitle">
        <s-text fontSize="small" color="subdued">
          The latest features and improvements in QuoteSnap.
        </s-text>
      </div>
      <s-stack gap="small">

        <s-search-field
          label="Search updates"
          labelAccessibilityVisibility="exclusive"
          placeholder="Search updates"
          autocomplete="off"
          value={query}
          onInput={(e) => handleSearch(e.currentTarget.value)}
        />

        <div className="more-wn-tabs">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} />
        </div>

        {filteredEntries.length === 0 ? (
          <div className="more-wn-empty">
            <s-text color="subdued">No updates match your search.</s-text>
          </div>
        ) : (
          <div className="more-wn more-wn-list">
            {pagedEntries.map((entry, index) => {
              const isLast = index === pagedEntries.length - 1;
              const isLatest = entry.id === CHANGELOG_ENTRIES[0].id;
              return (
                <div className="more-wn-item" key={entry.id}>
                  <div className="more-wn-rail">
                    <span className={`more-wn-marker${isLatest ? ' more-wn-marker--latest' : ''}`}>
                      {entry.logo ? <img src={LOGOS[entry.logo]} alt="" /> : <s-icon type={entry.icon} />}
                    </span>
                    {!isLast && <span className="more-wn-line" />}
                  </div>
                  <div className="more-wn-card">
                    <s-stack gap="small-300">
                      <s-stack gap="small-500">
                        <span className="more-wn-date">{formatDate(entry.date)}</span>
                        <div className="more-wn-title">
                          <s-heading>{entry.title}</s-heading>
                          {entry.isNew && <s-badge tone="info">New</s-badge>}
                        </div>
                      </s-stack>
                      <s-paragraph fontSize="small" color="subdued" lineClamp={2}>
                        {entry.description}
                      </s-paragraph>
                      <s-stack direction="inline" gap="small" alignItems="center">
                        <s-button variant="primary" onClick={() => handleSettingClick(entry.cta)}>
                          {entry.cta.label}
                        </s-button>
                        <s-link href={entry.helpUrl} target="_blank">
                          <span className="more-wn-help">
                            <ExternalIcon />
                            Help docs
                          </span>
                        </s-link>
                      </s-stack>
                    </s-stack>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Polaris Pagination: the label sits 12px from each arrow and is subdued unless both arrows are active. */}
        {totalPages > 1 && (
          <s-stack direction="inline" gap="small" alignItems="center" justifyContent="center">
            <s-button
              icon="chevron-left"
              accessibilityLabel="Previous"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
            />
            <s-text color={safePage > 1 && safePage < totalPages ? undefined : 'subdued'}>{`${safePage} / ${totalPages}`}</s-text>
            <s-button
              icon="chevron-right"
              accessibilityLabel="Next"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            />
          </s-stack>
        )}
      </s-stack>
    </s-page>
  );
}
