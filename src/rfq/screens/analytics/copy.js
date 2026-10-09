// English copy for the Quote analytics screen, taken from the production locales:
// fe/rfq/public/locales/en/analytics.json (A), quoteList.json → profitLeak (PL),
// core.json → dateRangePicker (DRP) and translation.json → number_format.

// "{{name}}" interpolation (i18next style).
export const fmt = (template, vars = {}) =>
  String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));

export const A = {
  pageTitle: 'Quote analytics',
  overview: {
    totalQuoteValue: {
      title: 'Total quote value',
      tooltipTitle: 'Total quote value over time',
      tooltipContent: 'The cumulative value of all quotes issued',
    },
    totalQuotes: {
      title: 'Total quotes',
      tooltipTitle: 'Total quotes over time',
      tooltipContent: 'Total quotes that have been submitted from storefront and manually created',
    },
    totalQuotesRejected: {
      title: 'Total quotes rejected',
      tooltipTitle: 'Total quotes rejected',
      tooltipContent: 'Total quotes that have been rejected by customers',
    },
    totalQuotesConverted: {
      title: 'Total quotes converted',
      tooltipTitle: 'Total quotes converted over time',
      tooltipContent: 'Total quotes that have been converted to draft orders',
    },
    conversionRate: {
      title: 'Conversion rate',
      tooltipTitle: 'Conversion rate',
      line1: 'Percentage of quotes that result in a draft order',
      line2: 'Conversion rate = Total quotes converted / Total quotes',
    },
  },
  charts: {
    totalQuoteValueOverTime: {
      title: 'Total quote value over time',
      tooltipTitle: 'Total quote value over time',
      tooltipContent: 'The cumulative value of all quotes issued',
      legendName: 'Quotes value',
    },
    totalQuotesOverTime: {
      title: 'Total quotes over time',
      tooltipTitle: 'Total quotes over time',
      tooltipContent: 'Total quotes that have been submitted and created',
      legendName: 'Quotes',
    },
    conversionRateOverTime: {
      title: 'Conversion rate over time',
      tooltipTitle: 'Conversion rate over time',
      line1: 'Percentage of quotes that result in a draft order',
      line2: 'Conversion rate = Total quotes converted / Total cumulative quotes',
      legendName: 'Conversation rate',
    },
    totalButtonClicksOverTime: {
      title: 'Total quote button clicks over time',
      tooltipTitle: 'Total quote button clicks over time',
      tooltipContent: 'The cumulative number of times users clicked the quote button',
      legendName: 'Button clicks',
    },
    clickToQuoteRateOverTime: {
      title: 'Click-to-Quote rate over time',
      tooltipTitle: 'Click-to-Quote rate over time',
      tooltipContent: 'The percentage of users who click the quote button and then go on to submit a quote',
      legendName: 'Click-to-Quote rate',
    },
    topProductsClicked: {
      title: 'Top products clicked',
      tooltipTitle: 'Top products clicked',
      tooltipContent: 'The 10 products with the most quote button clicks on the storefront',
    },
    topProductsConverted: {
      title: 'Top products converted',
      tooltipTitle: 'Top products converted',
      tooltipContent: 'The 10 most frequently quoted products that resulted in draft orders',
    },
    topCustomersByTotalQuotes: {
      title: 'Top customers by total quotes',
      tooltipTitle: 'Top customers by total quotes',
      tooltipContent: 'Top 10 customers by total quotes submitted and created',
    },
  },
  common: {
    noDataForDateRange: 'No data for this date range',
    quotesCount: '{{count}} quotes',
    timesCount: '{{count}} times',
    clicksCount: '{{count}} clicks',
  },
  report: {
    create: 'Create report',
    manage: 'Manage report',
    manageTitle: 'Manage report',
    back: 'Back',
    send: 'Send',
    chatPlaceholder: 'What do you want to explore?',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    deleteReportTitle: 'Delete report',
    deleteReportBody: 'Are you sure you want to delete? This action cannot be undone.',
    deleteBulkBody: 'Are you sure you want to delete {{count}} reports? This action cannot be undone.',
    createdAt: 'Created at',
    columnName: 'Report name',
    actions: 'Actions',
    resourceSingular: 'report',
    resourcePlural: 'reports',
    emptyHeading: 'Manage your report',
    emptyBody: 'Build reports to keep track of your quote performance',
    dateRangeLabel: 'Created date',
    starting: 'Starting',
    ending: 'Ending',
    createdTimeLabel: 'Created time: {{timeLabel}}',
    startingDate: 'Starting {{date}}',
    endingDate: 'Ending {{date}}',
    clear: 'Clear',
    deleteSuccess: (n) => (n === 1 ? 'Report deleted' : `${n} reports deleted`),
    searchPlaceholder: 'Search reports',
    suggestions: {
      customersNotBought: 'Which customers quoted 3+ times but never bought?',
      clickedRarelyConverted: 'Which products are clicked but rarely converted?',
    },
    profitLeak: 'Profit leak report',
  },
};

export const PL = {
  tooltipLostProfitTitle: 'Lost profit',
  tooltipLostProfitContent:
    'How much profit is missing to bring every quote below the target margin up to that margin in the selected period',
  tooltipBelowMarginTitle: 'Quotes below target margin',
  tooltipBelowMarginContent: 'Quotes with a margin below the target, out of the quotes that have cost data to analyze',
  tooltipCoverageTitle: 'Cost data coverage',
  tooltipCoverageContent:
    'Quotes whose products have cost per item set in Shopify. Add cost to the remaining products to analyze every quote',
  tooltipOverTimeTitle: 'Lost profit over time',
  tooltipOverTimeContent: 'Lost profit grouped by day, or by week for longer date ranges',
  tooltipHighlightTitle: 'Lost profit (90 days)',
  tooltipHighlightContent:
    'Profit missed in the last 90 days from quotes sent below the target margin. Open the report for details',
  modalTitle: 'Profit leak report',
  columnQuote: 'Quote',
  columnDate: 'Date',
  columnCustomer: 'Customer',
  columnMargin: 'Margin',
  columnRevenue: 'Quote value',
  columnProfit: 'Actual profit',
  columnLostProfit: 'Lost profit',
  chartOverTime: 'Lost profit over time',
  chartByCustomer: 'Lost profit by customer',
  metricLostProfit: 'Lost profit',
  vsPrevious: '{{change}} vs previous period',
  metricBelowMargin: 'Quotes below {{margin}}% margin',
  metricBelowMarginHint: 'of quotes with cost data',
  metricCoverage: 'Cost data coverage',
  coverageHint: 'Add cost per item in Shopify to analyze the remaining quotes',
  coverageFullHint: 'All quotes in this period have cost data',
  quoteTableTitle: 'Quotes sent below target margin',
  chartByProduct: 'Lost profit by product',
  rankingCustomerDetail: '{{count}} quote(s) · {{amount}} lost profit',
  rankingProductDetail: '{{amount}} lost profit',
  noData: 'No data for this date range',
  highlightTitle: 'Lost profit (90 days)',
};

export const DRP = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 days',
  last30days: 'Last 30 days',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  last60days: 'Last 60 days',
  custom: 'Custom',
  since: 'Since',
  until: 'Until',
  cancel: 'Cancel',
  apply: 'Apply',
};

export const NUMBER_FORMAT = { thousand: '{{number}}K', million: '{{number}}M', billion: '{{number}}B', trillion: '{{number}}T' };
