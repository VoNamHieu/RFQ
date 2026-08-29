import React from 'react';
import { Toast } from '@shopify/polaris';
import {
  HomeIcon,
  OrderIcon,
  ProductIcon,
  PersonIcon,
  DiscountIcon,
  ChartVerticalIcon,
  ClipboardIcon,
  StoreIcon,
  AutomationIcon,
} from '@shopify/polaris-icons';
import { AdminFrame } from '../shared/AdminFrame.jsx';
import { activeVersion } from '../shared/versions.js';
import { useStore } from './store.jsx';

const withV = (path) => (activeVersion() === 'latest' ? path : `${path}?v=${activeVersion()}`);
import { SubmissionList } from './screens/SubmissionList.jsx';
import { QuoteDetail } from './screens/QuoteDetail.jsx';
import { CreateQuote } from './screens/CreateQuote.jsx';

function CurrentView() {
  const { state } = useStore();
  switch (state.view) {
    case 'quoteDetail':
      return <QuoteDetail />;
    case 'createQuote':
      return <CreateQuote />;
    case 'submissionList':
    default:
      return <SubmissionList />;
  }
}

export function App() {
  const { state, dispatch } = useStore();
  const goList = () => dispatch({ type: 'NAVIGATE', view: 'submissionList' });
  const rfqActive = ['submissionList', 'quoteDetail', 'createQuote'].includes(state.view);

  const sections = [
    {
      items: [
        { label: 'Home', icon: HomeIcon, onClick: () => {} },
        { label: 'Orders', icon: OrderIcon, badge: '16', onClick: () => {} },
        { label: 'Products', icon: ProductIcon, onClick: () => {} },
        { label: 'Customers', icon: PersonIcon, onClick: () => {} },
        { label: 'Discounts', icon: DiscountIcon, onClick: () => {} },
        { label: 'Analytics', icon: ChartVerticalIcon, onClick: () => {} },
      ],
    },
    {
      title: 'Apps',
      items: [
        { label: 'Flow', icon: AutomationIcon, url: '#/flow', onClick: () => {} },
        {
          label: 'O:Request a Quote',
          icon: ClipboardIcon,
          url: '#/rfq',
          onClick: goList,
          subNavigationItems: [
            { label: 'Quote settings', url: '#/rfq/quote-settings', matches: false, onClick: () => {} },
            { label: 'Quote form builder', url: '#/rfq/quote-form-builder', matches: false, onClick: () => {} },
            { label: 'Submission list', url: '#/rfq/submission-list', matches: rfqActive, onClick: goList },
            { label: 'Others', url: '#/rfq/others', matches: false, onClick: () => {} },
            { label: 'Cost management', url: '#/rfq/cost-management', matches: false, onClick: () => {} },
            { label: 'Analytics', url: '#/rfq/analytics', matches: false, onClick: () => {} },
            { label: 'View more', url: '#/rfq/view-more', matches: false, onClick: () => {} },
          ],
        },
        { label: 'Wholesale B2B Solution', icon: StoreIcon, onClick: () => { window.location.href = withV('/b2b'); } },
      ],
    },
  ];

  return (
    <AdminFrame app="rfq" location="#/rfq/submission-list" sections={sections} searchPlaceholder="Search quotes, customers and prices">
      <CurrentView />
      {state.toast && (
        <Toast content={state.toast} onDismiss={() => dispatch({ type: 'CLEAR_TOAST' })} />
      )}
    </AdminFrame>
  );
}
