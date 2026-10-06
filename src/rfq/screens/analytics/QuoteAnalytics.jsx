import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store.jsx';
import './analytics.css';
import { A, PL } from './copy.js';
import { INITIAL_REPORTS } from './data.js';
import {
  TODAY,
  addDays,
  buildQuoteFacts,
  computeOverview,
  formatNumberToString,
  formatPP,
  leakSummary90,
  money,
  parseYmd,
} from './model.js';
import { DateRangePicker, buildRanges } from './DateRangePicker.jsx';
import { BarChart, LineChart } from './charts.jsx';
import { RankingList, ReportChatBar, TitleTooltip, TwoLines } from './parts.jsx';
import { ManageReports } from './ManageReports.jsx';
import { ProfitLeakReport } from './ProfitLeakReport.jsx';

// Rebuild of the production RFQ page pages/QuoteAnalytics (+ DataVisualize charts and
// rankings). "Manage report" (pages/AnalyticsReportManage) and "Profit leak report"
// (pages/ProfitLeakReport) are header actions — and the profit leak highlight card —
// on this page, so they're switchable views here. "Create report" / a report's own
// page are separate routes in production → toast.

const opensInFullApp = (name) => `Opens ${name} in the full app`;

// x-axis / tooltip label for a series key: "yyyy-MM-dd" → "Aug 9, 2026"; hourly keys
// ("yyyy-MM-dd HH:00") → "9:00" (production's isSingleDate formatter).
const dayLabel = (key) => {
  const d = parseYmd(String(key).slice(0, 10));
  return d ? formatPP(d) : String(key);
};
const timeAxisLabel = (isSingleDate) => (key) =>
  isSingleDate ? `${Number(String(key).slice(11, 13))}:00` : dayLabel(key);
const percent = (v) => `${v}%`;

// Overview KPI cards truncate their title (ellipsis wrapper); the profit leak
// highlight card renders a plain TitleTooltip, so `truncate` is off there.
function KpiCard({ title, tooltipTitle, tooltipContent, truncate = true, children }) {
  return (
    <s-section>
      <s-stack gap="small-200">
        <TitleTooltip title={title} tooltipTitle={tooltipTitle} tooltipContent={tooltipContent} truncate={truncate} />
        {children}
      </s-stack>
    </s-section>
  );
}

function ChartCard({ title, tooltipTitle, tooltipContent, value, children }) {
  return (
    <s-section>
      <s-stack gap="base">
        <s-stack gap="small-200">
          <TitleTooltip title={title} tooltipTitle={tooltipTitle} tooltipContent={tooltipContent} />
          <div className="qan-figure">{value}</div>
        </s-stack>
        {children}
      </s-stack>
    </s-section>
  );
}

function RankingCard({ title, tooltipTitle, tooltipContent, children }) {
  return (
    <s-section>
      <s-stack gap="base">
        <TitleTooltip title={title} tooltipTitle={tooltipTitle} tooltipContent={tooltipContent} />
        {children}
      </s-stack>
    </s-section>
  );
}

function Overview({ facts, range, onRangeChange, onManage, onProfitLeak, toast }) {
  const data = useMemo(() => computeOverview(facts, range.start, range.end), [facts, range]);
  const leak = useMemo(() => leakSummary90(facts), [facts]);
  const { isSingleDate } = data;
  const xLabel = timeAxisLabel(isSingleDate);

  const kpiConversion =
    data.totalQuotes === 0 ? 0 : `${((data.totalQuotesConverted / data.totalQuotes) * 100).toFixed(2)}%`;
  const chartConversion =
    data.totalQuotes === 0 ? '0%' : `${((data.totalQuotesConverted / data.totalQuotes) * 100).toFixed(2)}%`;

  const o = A.overview;
  const kpis = [
    { ...o.totalQuoteValue, value: money(data.totalQuoteValue) },
    { ...o.totalQuotes, value: data.totalQuotes },
    { ...o.totalQuotesRejected, value: data.totalQuotesRejected },
    { ...o.totalQuotesConverted, value: data.totalQuotesConverted },
    {
      ...o.conversionRate,
      tooltipContent: <TwoLines line1={o.conversionRate.line1} line2={o.conversionRate.line2} />,
      value: kpiConversion,
    },
  ];

  const openCreateReport = (question) =>
    toast(question ? `${opensInFullApp('Create report')}: “${question}”` : opensInFullApp('Create report'));
  const openProduct = (title) => toast(`Opens “${title}” on your online store`);
  const c = A.charts;

  return (
    <s-page heading={A.pageTitle}>
      <s-button slot="primary-action" variant="primary" onClick={() => openCreateReport()}>
        {A.report.create}
      </s-button>
      <s-button slot="secondary-actions" onClick={onManage}>
        {A.report.manage}
      </s-button>
      <s-button slot="secondary-actions" onClick={onProfitLeak}>
        {A.report.profitLeak}
      </s-button>

      <s-stack gap="base">
        <ReportChatBar onSubmit={openCreateReport} />

        <DateRangePicker
          startDate={range.start}
          endDate={range.end}
          onChange={(start, end) => onRangeChange({ start, end })}
          disableDatesAfter={TODAY}
          disableDatesBefore={addDays(TODAY, -61)}
        />

        <s-query-container>
          <s-grid
            gridTemplateColumns="@container (inline-size > 440px) 1fr 1fr 1fr, (inline-size > 860px) 1fr 1fr 1fr 1fr 1fr, 1fr 1fr"
            gap="base"
          >
            {kpis.map((k) => (
              <KpiCard key={k.title} title={k.title} tooltipTitle={k.tooltipTitle} tooltipContent={k.tooltipContent}>
                <s-text fontWeight="bold">{k.value}</s-text>
              </KpiCard>
            ))}
            {/* ProfitLeakHighlightCard variant="compact" */}
            <KpiCard
              title={PL.highlightTitle}
              tooltipTitle={PL.tooltipHighlightTitle}
              tooltipContent={PL.tooltipHighlightContent}
              truncate={false}
            >
              <div>
                <button type="button" className="qan-kpi-link" onClick={onProfitLeak}>
                  <span
                    className={`qan-kpi-link__value${leak.total_leak_amount > 0 ? '' : ' qan-kpi-link__value--success'}`}
                  >
                    {money(leak.total_leak_amount)}
                  </span>
                </button>
              </div>
            </KpiCard>
          </s-grid>
        </s-query-container>

        {/* Row 1: quote value & quote count · Row 2: button clicks & click-to-quote rate */}
        <s-query-container>
          <s-grid gridTemplateColumns="@container (inline-size > 860px) 1fr 1fr, 1fr" gap="base">
            <ChartCard
              title={c.totalQuoteValueOverTime.title}
              tooltipTitle={c.totalQuoteValueOverTime.tooltipTitle}
              tooltipContent={c.totalQuoteValueOverTime.tooltipContent}
              value={money(data.totalQuoteValue)}
            >
              <LineChart
                series={[{ name: c.totalQuoteValueOverTime.legendName, data: data.quotesValueOverTimes }]}
                xLabel={xLabel}
                yLabel={formatNumberToString}
                tooltipValue={money}
              />
            </ChartCard>
            <ChartCard
              title={c.totalQuotesOverTime.title}
              tooltipTitle={c.totalQuotesOverTime.tooltipTitle}
              tooltipContent={c.totalQuotesOverTime.tooltipContent}
              value={data.totalQuotes}
            >
              <LineChart
                series={[{ name: c.totalQuotesOverTime.legendName, data: data.quotesCountOverTimes }]}
                xLabel={xLabel}
                yLabel={formatNumberToString}
                integer
              />
            </ChartCard>
            <ChartCard
              title={c.totalButtonClicksOverTime.title}
              tooltipTitle={c.totalButtonClicksOverTime.tooltipTitle}
              tooltipContent={c.totalButtonClicksOverTime.tooltipContent}
              value={data.totalButtonClicks}
            >
              <BarChart
                series={[
                  {
                    name: c.totalButtonClicksOverTime.legendName,
                    data: data.buttonClicksDaily.map((it) => ({ key: it.date, value: it.count })),
                  },
                ]}
                xLabel={dayLabel}
                yLabel={formatNumberToString}
                integer
              />
            </ChartCard>
            <ChartCard
              title={c.clickToQuoteRateOverTime.title}
              tooltipTitle={c.clickToQuoteRateOverTime.tooltipTitle}
              tooltipContent={c.clickToQuoteRateOverTime.tooltipContent}
              value={`${data.clickToQuoteRate}%`}
            >
              <LineChart
                series={[
                  {
                    name: c.clickToQuoteRateOverTime.legendName,
                    data: data.clickToQuoteRateDaily.map((it) => ({ key: it.date, value: it.rate })),
                  },
                ]}
                xLabel={dayLabel}
                yLabel={percent}
              />
            </ChartCard>
          </s-grid>
        </s-query-container>

        {/* Row 3: top products clicked, top products converted, top customers */}
        <s-query-container>
          <s-grid gridTemplateColumns="@container (inline-size > 700px) 1fr 1fr 1fr, 1fr" gap="base">
            <RankingCard
              title={c.topProductsClicked.title}
              tooltipTitle={c.topProductsClicked.tooltipTitle}
              tooltipContent={c.topProductsClicked.tooltipContent}
            >
              <RankingList kind="clicked" items={data.topProductsClicked} onOpenProduct={openProduct} />
            </RankingCard>
            <RankingCard
              title={c.topProductsConverted.title}
              tooltipTitle={c.topProductsConverted.tooltipTitle}
              tooltipContent={c.topProductsConverted.tooltipContent}
            >
              <RankingList kind="converted" items={data.productRankings} onOpenProduct={openProduct} />
            </RankingCard>
            <RankingCard
              title={c.topCustomersByTotalQuotes.title}
              tooltipTitle={c.topCustomersByTotalQuotes.tooltipTitle}
              tooltipContent={c.topCustomersByTotalQuotes.tooltipContent}
            >
              <RankingList kind="customers" items={data.customerRankings} />
            </RankingCard>
          </s-grid>
        </s-query-container>

        {/* Conversion rate, full width */}
        <ChartCard
          title={c.conversionRateOverTime.title}
          tooltipTitle={c.conversionRateOverTime.tooltipTitle}
          tooltipContent={<TwoLines line1={c.conversionRateOverTime.line1} line2={c.conversionRateOverTime.line2} />}
          value={chartConversion}
        >
          <LineChart
            series={[{ name: c.conversionRateOverTime.legendName, data: data.conversionRateOverTimes }]}
            xLabel={xLabel}
            yLabel={percent}
          />
        </ChartCard>
      </s-stack>
    </s-page>
  );
}

export function QuoteAnalytics() {
  const { state, dispatch } = useStore();
  const [view, setView] = useState('overview'); // 'overview' | 'manage' | 'profitLeak'
  // The selected range lives in the quoteAnalytic slice in production, so it survives
  // a trip to Manage report / Profit leak report and back. Default: Last 7 days.
  const [range, setRange] = useState(() => {
    const last7 = buildRanges(TODAY)[2];
    return { start: last7.since, end: last7.until };
  });
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const facts = useMemo(() => buildQuoteFacts(state), [state]);
  const toast = (message) => dispatch({ type: 'TOAST', message });

  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      /* ignore */
    }
  }, [view]);

  let body;
  if (view === 'manage') {
    body = (
      <ManageReports
        reports={reports}
        setReports={setReports}
        onBack={() => setView('overview')}
        onCreate={() => toast(opensInFullApp('Create report'))}
        onOpenReport={(report) => toast(opensInFullApp(`“${report.name}”`))}
        toast={toast}
      />
    );
  } else if (view === 'profitLeak') {
    body = (
      <ProfitLeakReport
        facts={facts}
        onBack={() => setView('overview')}
        onOpenQuote={(id) => (state.quotes[id] ? dispatch({ type: 'OPEN_QUOTE', id }) : toast(`Opens quote #${id} in the full app`))}
        onOpenProduct={(title) => toast(`Opens “${title}” on your online store`)}
      />
    );
  } else {
    body = (
      <Overview
        facts={facts}
        range={range}
        onRangeChange={setRange}
        onManage={() => setView('manage')}
        onProfitLeak={() => setView('profitLeak')}
        toast={toast}
      />
    );
  }
  return <div className="qan-root">{body}</div>;
}
