import React, { useState } from 'react';
import { AdminFrame } from '../shared/AdminFrame.jsx';
import { Toast } from '../shared/wc.jsx';
import { activeVersion } from '../shared/versions.js';
import { useStore } from './store.jsx';

const withV = (path) => (activeVersion() === 'latest' ? path : `${path}?v=${activeVersion()}`);
import { SubmissionList } from './screens/SubmissionList.jsx';
import { QuoteDetail } from './screens/QuoteDetail.jsx';
import { CreateQuote } from './screens/CreateQuote.jsx';
import { QuoteSettings } from './screens/quoteSettings/QuoteSettings.jsx';
import { FormBuilder } from './screens/formBuilder/FormBuilder.jsx';
import { Configuration } from './screens/configuration/Configuration.jsx';
import { QuoteAnalytics } from './screens/analytics/QuoteAnalytics.jsx';
import { PricingPlan } from './screens/more/PricingPlan.jsx';
import { WhatsNew } from './screens/more/WhatsNew.jsx';

function CurrentView() {
  const { state } = useStore();
  switch (state.view) {
    case 'quoteDetail':
      return <QuoteDetail />;
    case 'createQuote':
      return <CreateQuote />;
    case 'quoteSettings':
      return <QuoteSettings />;
    case 'formBuilder':
      return <FormBuilder />;
    case 'configuration':
      return <Configuration section={state.configSection} />;
    case 'rfqAnalytics':
      return <QuoteAnalytics />;
    case 'pricingPlan':
      return <PricingPlan />;
    case 'whatsNew':
      return <WhatsNew />;
    case 'submissionList':
    default:
      return <SubmissionList />;
  }
}

export function App() {
  const { state, dispatch } = useStore();
  const goList = () => dispatch({ type: 'NAVIGATE', view: 'submissionList' });
  const rfqActive = ['submissionList', 'quoteDetail', 'createQuote'].includes(state.view);
  const go = (view, patch) => () => dispatch({ type: 'NAVIGATE', view, patch });
  // Like the admin, the app's later menu items sit behind "View more".
  const [moreOpen, setMoreOpen] = useState(() => ['pricingPlan', 'whatsNew'].includes(state.view));

  const sections = [
    {
      items: [
        { label: 'Home', icon: 'home', onClick: () => {} },
        { label: 'Orders', icon: 'order', badge: '16', onClick: () => {} },
        { label: 'Products', icon: 'product', onClick: () => {} },
        { label: 'Customers', icon: 'person', onClick: () => {} },
        { label: 'Discounts', icon: 'discount', onClick: () => {} },
        { label: 'Analytics', icon: 'chart-vertical', onClick: () => {} },
      ],
    },
    {
      title: 'Apps',
      items: [
        { label: 'Storefront', icon: 'view', url: '#/storefront', onClick: () => { window.location.href = '/storefront'; } },
        {
          label: 'O:Request a Quote',
          icon: 'clipboard',
          url: '#/rfq',
          onClick: goList,
          subNavigationItems: [
            { label: 'Quote settings', url: '#/rfq/quote-settings', matches: state.view === 'quoteSettings', onClick: go('quoteSettings') },
            { label: 'Quote form builder', url: '#/rfq/quote-form-builder', matches: state.view === 'formBuilder', onClick: go('formBuilder') },
            { label: 'Submission list', url: '#/rfq/submission-list', matches: rfqActive, onClick: goList },
            {
              label: 'Others',
              url: '#/rfq/others',
              matches: state.view === 'configuration' && state.configSection !== 'costManagement',
              onClick: go('configuration', { configSection: null }),
            },
            {
              label: 'Cost management',
              url: '#/rfq/cost-management',
              matches: state.view === 'configuration' && state.configSection === 'costManagement',
              onClick: go('configuration', { configSection: 'costManagement' }),
            },
            { label: 'Analytics', url: '#/rfq/analytics', matches: state.view === 'rfqAnalytics', onClick: go('rfqAnalytics') },
            ...(moreOpen
              ? [
                  { label: 'Pricing plan', url: '#/rfq/pricing-plan', matches: state.view === 'pricingPlan', onClick: go('pricingPlan') },
                  { label: "What's New", url: '#/rfq/whats-new', matches: state.view === 'whatsNew', onClick: go('whatsNew') },
                ]
              : []),
            { label: moreOpen ? 'View less' : 'View more', url: '#/rfq/view-more', matches: false, onClick: () => setMoreOpen((v) => !v) },
          ],
        },
        { label: 'Wholesale B2B Solution', icon: 'store', onClick: () => { window.location.href = withV('/b2b'); } },
      ],
    },
  ];

  return (
    <AdminFrame app="rfq" sections={sections} searchPlaceholder="Search quotes, customers and prices">
      <CurrentView />
      {state.toast && (
        <Toast content={state.toast} onDismiss={() => dispatch({ type: 'CLEAR_TOAST' })} />
      )}
    </AdminFrame>
  );
}
