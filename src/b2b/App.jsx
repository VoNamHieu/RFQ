import React from 'react';
import { Toast } from '@shopify/polaris';
import {
  HomeIcon,
  OrderIcon,
  ProductIcon,
  PersonIcon,
  DiscountIcon,
  ChartVerticalIcon,
  StoreIcon,
  PriceListIcon,
  MenuHorizontalIcon,
  SettingsIcon,
  ClipboardIcon,
} from '@shopify/polaris-icons';
import { AdminFrame } from '../shared/AdminFrame.jsx';
import { useStore } from './store.jsx';
import { CompaniesList } from './screens/CompaniesList.jsx';
import { CompanyDetail } from './screens/CompanyDetail.jsx';
import { QuoteDetail } from './screens/QuoteDetail.jsx';
import { LocationDetail } from './screens/LocationDetail.jsx';
import { PricingLibrary } from './screens/PricingLibrary.jsx';
import { Analytics } from './screens/Analytics.jsx';
import { Settings } from './screens/Settings.jsx';
import { PricingEditor } from './components/PricingEditor.jsx';
import { BuildFromQuotes } from './components/BuildFromQuotes.jsx';
import { PriceBoard } from './components/PriceBoard.jsx';
import { AssignModal } from './components/AssignModal.jsx';
import { AddCompanyWizard } from './components/AddCompanyWizard.jsx';

function CurrentView() {
  const { state } = useStore();
  switch (state.view) {
    case 'company':
      return <CompanyDetail />;
    case 'quote':
      return <QuoteDetail />;
    case 'location':
      return <LocationDetail />;
    case 'pricing':
      return <PricingLibrary />;
    case 'analytics':
      return <Analytics />;
    case 'settings':
      return <Settings />;
    case 'customers':
    default:
      return <CompaniesList />;
  }
}

export function App() {
  const { state, dispatch } = useStore();
  const companyActive = ['customers', 'company', 'quote', 'location'].includes(state.view);
  const b2bActive = [...['customers', 'company', 'quote', 'location'], 'pricing', 'analytics', 'settings'].includes(state.view);

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
        { label: 'O:Request a Quote', icon: ClipboardIcon, onClick: () => { window.location.href = '/'; } },
        { label: 'Wholesale B2B Solution', icon: StoreIcon, selected: b2bActive, onClick: () => dispatch({ type: 'NAVIGATE', view: 'customers' }) },
      ],
    },
    {
      items: [
        {
          label: 'B2B Company',
          icon: StoreIcon,
          selected: companyActive,
          badge: String(state.db.companies.length),
          onClick: () => dispatch({ type: 'NAVIGATE', view: 'customers' }),
        },
        {
          label: 'Pricing',
          icon: PriceListIcon,
          selected: state.view === 'pricing',
          badge: String(state.db.policies.length),
          onClick: () => dispatch({ type: 'NAVIGATE', view: 'pricing' }),
        },
        { label: 'Analytics', icon: ChartVerticalIcon, selected: state.view === 'analytics', onClick: () => dispatch({ type: 'NAVIGATE', view: 'analytics' }) },
        { label: 'Manual Order', icon: OrderIcon, onClick: () => {} },
        { label: 'Discount', icon: DiscountIcon, onClick: () => {} },
        { label: 'Others', icon: MenuHorizontalIcon, onClick: () => {} },
        { label: 'Settings', icon: SettingsIcon, selected: state.view === 'settings', onClick: () => dispatch({ type: 'NAVIGATE', view: 'settings' }) },
      ],
    },
  ];

  return (
    <AdminFrame app="b2b" sections={sections} searchPlaceholder="Search customers, prices and issues">
      <CurrentView />
      <PricingEditor />
      <BuildFromQuotes />
      <PriceBoard />
      <AssignModal />
      <AddCompanyWizard />
      {state.toast && <Toast content={state.toast} onDismiss={() => dispatch({ type: 'CLEAR_TOAST' })} />}
    </AdminFrame>
  );
}
