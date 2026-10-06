import React, { useMemo, useState } from 'react';
import { PL, fmt } from './copy.js';
import { TODAY, addDays, computeProfitLeak, endOfDay, formatMonthDay, formatPP, money, parseYmd } from './model.js';
import { PageHeader } from '../../../shared/wc.jsx';
import { DateRangePicker } from './DateRangePicker.jsx';
import { BarChart } from './charts.jsx';
import { CustomerAvatar, Pager, ResourceRows, Thumb, TitleTooltip } from './parts.jsx';

// pages/ProfitLeakReport: lost profit from quotes sent below the target margin —
// three metric cards, lost profit over time (daily, or weekly past 45 days), lost
// profit by customer / by product, and the quotes table. Unlocked (paid plan) variant.

const LIST_PAGE_SIZE = 10;

function paginate(items, requestedPage) {
  const pageCount = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  return {
    pageCount,
    currentPage,
    pagedItems: items.slice((currentPage - 1) * LIST_PAGE_SIZE, currentPage * LIST_PAGE_SIZE),
  };
}

// renderListPagination: Box paddingBlockStart 200 › centered Pagination "n / N".
function ListPagination({ paging, setPage }) {
  const { currentPage, pageCount } = paging;
  if (pageCount <= 1) return null;
  return (
    <s-box paddingBlockStart="small-200">
      <div className="qan-pager-row">
        <Pager
          hasPrevious={currentPage > 1}
          hasNext={currentPage < pageCount}
          onPrevious={() => setPage(currentPage - 1)}
          onNext={() => setPage(currentPage + 1)}
          label={`${currentPage} / ${pageCount}`}
        />
      </div>
    </s-box>
  );
}

function NoData() {
  return (
    <s-box paddingBlock="base">
      <div style={{ textAlign: 'center' }}>
        <s-text color="subdued">{PL.noData}</s-text>
      </div>
    </s-box>
  );
}

const signedMoney = (change) => `${change >= 0 ? '+' : '-'}${money(Math.abs(change))}`;

export function ProfitLeakReport({ facts, onBack, onOpenQuote, onOpenProduct }) {
  // Production default: the last 90 days ending now.
  const [range, setRange] = useState(() => ({ start: addDays(TODAY, -89), end: endOfDay(TODAY) }));
  const [quotePage, setQuotePage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const report = useMemo(() => computeProfitLeak(facts, range.start, range.end), [facts, range]);

  const totalLeak = report.total_leak_amount;
  const change = totalLeak - report.previous_total_leak_amount;
  const analyzed = report.quote_count_analyzed;
  const total = report.quote_count_total;
  const isFullCoverage = total > 0 && analyzed === total;

  // Dates show the year when the window spans two years ("MMM d" otherwise).
  const crossYear = range.start.getFullYear() !== range.end.getFullYear();
  const reportDate = (d, withYear = false) => (withYear || crossYear ? formatPP(d) : formatMonthDay(d));
  const bucketLabel = (key) =>
    String(key)
      .split('|')
      .map((s) => reportDate(parseYmd(s)))
      .join(' – ');

  const customers = paginate(report.customers, customerPage);
  const products = paginate(report.products, productPage);
  const quotes = paginate(report.quotes, quotePage);

  return (
    <>
      {/* Page backAction with no content → ← arrow (accessibility label "Back"). */}
      <PageHeader heading={PL.modalTitle} backAction={{ content: 'Back', onAction: onBack }} />
      <s-page>
        <s-stack gap="base">
          <DateRangePicker
            startDate={range.start}
            endDate={range.end}
            onChange={(start, end) => {
              setRange({ start, end });
              setQuotePage(1);
              setCustomerPage(1);
              setProductPage(1);
            }}
            disableDatesAfter={TODAY}
            disableDatesBefore={addDays(TODAY, -365)}
          />

          <s-query-container>
            <s-grid gridTemplateColumns="@container (inline-size > 440px) 1fr 1fr 1fr, 1fr" gap="base">
              <s-section>
                <s-stack gap="small-400">
                  <TitleTooltip
                    title={PL.metricLostProfit}
                    tooltipTitle={PL.tooltipLostProfitTitle}
                    tooltipContent={PL.tooltipLostProfitContent}
                  />
                  {/* With leaking quotes: one gap-0 block per currency (critical); none → $0.00 (success). */}
                  {totalLeak > 0 ? (
                    <s-stack gap="none">
                      <div className="qan-figure qan-figure--xl qan-figure--critical">{money(totalLeak)}</div>
                      <s-paragraph color="subdued" fontSize="small">
                        {fmt(PL.vsPrevious, { change: signedMoney(change) })}
                      </s-paragraph>
                    </s-stack>
                  ) : (
                    <>
                      <div className="qan-figure qan-figure--xl qan-figure--success">{money(0)}</div>
                      <s-paragraph color="subdued" fontSize="small">
                        {fmt(PL.vsPrevious, { change: signedMoney(change) })}
                      </s-paragraph>
                    </>
                  )}
                </s-stack>
              </s-section>
              <s-section>
                <s-stack gap="small-400">
                  <TitleTooltip
                    title={fmt(PL.metricBelowMargin, { margin: report.target_margin_percent })}
                    tooltipTitle={PL.tooltipBelowMarginTitle}
                    tooltipContent={PL.tooltipBelowMarginContent}
                  />
                  <div className="qan-figure qan-figure--xl">{`${report.below_target_quote_count} / ${analyzed}`}</div>
                  <s-paragraph color="subdued" fontSize="small">
                    {PL.metricBelowMarginHint}
                  </s-paragraph>
                </s-stack>
              </s-section>
              <s-section>
                <s-stack gap="small-400">
                  <TitleTooltip
                    title={PL.metricCoverage}
                    tooltipTitle={PL.tooltipCoverageTitle}
                    tooltipContent={PL.tooltipCoverageContent}
                  />
                  <div
                    className={`qan-figure qan-figure--xl${isFullCoverage ? '' : ' qan-figure--caution'}`}
                  >{`${analyzed} / ${total}`}</div>
                  <s-paragraph color="subdued" fontSize="small">
                    {isFullCoverage ? PL.coverageFullHint : PL.coverageHint}
                  </s-paragraph>
                </s-stack>
              </s-section>
            </s-grid>
          </s-query-container>

          <s-section>
            <TitleTooltip
              title={PL.chartOverTime}
              tooltipTitle={PL.tooltipOverTimeTitle}
              tooltipContent={PL.tooltipOverTimeContent}
            />
            <s-box paddingBlockStart="small-200">
              <BarChart
                series={[{ name: PL.columnLostProfit, data: report.series }]}
                xLabel={bucketLabel}
                yLabel={money}
                showLegend={false}
              />
            </s-box>
          </s-section>

          <s-query-container>
            <s-grid gridTemplateColumns="@container (inline-size > 720px) 1fr 1fr, 1fr" gap="base">
              <s-section>
                <s-heading>{PL.chartByCustomer}</s-heading>
                {customers.pagedItems.length === 0 ? (
                  <NoData />
                ) : (
                  <ResourceRows
                    items={customers.pagedItems}
                    getKey={(c) => c.email}
                    renderMedia={(c) => <CustomerAvatar name={c.email} size="lg" />}
                    renderTitle={(c) => c.email}
                    renderMeta={(c) => (
                      <div className="qan-row__meta qan-row__meta--subdued">
                        {fmt(PL.rankingCustomerDetail, { count: c.quote_count, amount: money(c.leak_amount) })}
                      </div>
                    )}
                  />
                )}
                <ListPagination paging={customers} setPage={setCustomerPage} />
              </s-section>
              <s-section>
                <s-heading>{PL.chartByProduct}</s-heading>
                {products.pagedItems.length === 0 ? (
                  <NoData />
                ) : (
                  <ResourceRows
                    items={products.pagedItems}
                    getKey={(p) => p.title}
                    renderMedia={(p) => <Thumb src={p.image} alt={p.title} size="small" />}
                    renderTitle={(p) =>
                      p.handle ? (
                        // Link url=…/products/{handle} external removeUnderline › bold Text
                        <button type="button" className="qan-product-link" onClick={() => onOpenProduct(p.title)}>
                          {p.title}
                        </button>
                      ) : (
                        p.title
                      )
                    }
                    renderMeta={(p) => (
                      <div className="qan-row__meta qan-row__meta--subdued">
                        {fmt(PL.rankingProductDetail, { amount: money(p.leak_amount) })}
                      </div>
                    )}
                  />
                )}
                <ListPagination paging={products} setPage={setProductPage} />
              </s-section>
            </s-grid>
          </s-query-container>

          <s-section>
            <s-heading>{PL.quoteTableTitle}</s-heading>
            {report.quotes.length === 0 ? (
              <NoData />
            ) : (
              <s-box paddingBlockStart="small-200">
                <s-table>
                  <s-table-header-row>
                    <s-table-header listSlot="primary">
                      <span className="qan-nowrap">{PL.columnQuote}</span>
                    </s-table-header>
                    <s-table-header listSlot="labeled">
                      <span className="qan-nowrap">{PL.columnDate}</span>
                    </s-table-header>
                    <s-table-header listSlot="labeled">
                      <span className="qan-nowrap">{PL.columnCustomer}</span>
                    </s-table-header>
                    <s-table-header listSlot="secondary">
                      <span className="qan-nowrap">{PL.columnMargin}</span>
                    </s-table-header>
                    <s-table-header listSlot="labeled" format="currency">
                      <span className="qan-nowrap">{PL.columnRevenue}</span>
                    </s-table-header>
                    <s-table-header listSlot="labeled" format="currency">
                      <span className="qan-nowrap">{PL.columnProfit}</span>
                    </s-table-header>
                    <s-table-header listSlot="labeled" format="currency">
                      <span className="qan-nowrap">{PL.columnLostProfit}</span>
                    </s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {quotes.pagedItems.map((q) => (
                      <s-table-row key={q.quote_id}>
                        <s-table-cell>
                          <s-link onClick={() => onOpenQuote(q.quote_id)}>{`#${q.quote_id}`}</s-link>
                        </s-table-cell>
                        <s-table-cell>
                          <span className="qan-nowrap">{reportDate(q.createdAt, true)}</span>
                        </s-table-cell>
                        <s-table-cell>
                          <span className="qan-nowrap">{q.email}</span>
                        </s-table-cell>
                        <s-table-cell>
                          <s-badge
                            tone={q.margin_percent < 0 ? 'critical' : 'warning'}
                          >{`${q.margin_percent}%`}</s-badge>
                        </s-table-cell>
                        <s-table-cell>
                          <span className="qan-nowrap">{money(q.quote_value)}</span>
                        </s-table-cell>
                        <s-table-cell>
                          <span className="qan-nowrap">
                            <s-text tone={q.profit < 0 ? 'critical' : undefined}>{money(q.profit)}</s-text>
                          </span>
                        </s-table-cell>
                        <s-table-cell>
                          <span className="qan-nowrap">{money(q.leak_amount)}</span>
                        </s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>
                <ListPagination paging={quotes} setPage={setQuotePage} />
              </s-box>
            )}
          </s-section>
        </s-stack>
      </s-page>
    </>
  );
}
