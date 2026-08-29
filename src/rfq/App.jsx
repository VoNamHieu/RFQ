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
  PageIcon,
  PlusIcon,
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
        { label: 'O:Request a Quote', icon: ClipboardIcon, selected: rfqActive, onClick: goList },
        { label: 'Wholesale B2B Solution', icon: StoreIcon, onClick: () => { window.location.href = withV('/b2b'); } },
      ],
    },
    {
      items: [
        { label: 'Submission list', icon: PageIcon, selected: state.view === 'submissionList' || state.view === 'quoteDetail', onClick: goList },
        { label: 'Create a quote', icon: PlusIcon, selected: state.view === 'createQuote', onClick: () => dispatch({ type: 'START_CREATE_QUOTE' }) },
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
