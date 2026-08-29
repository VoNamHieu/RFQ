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
} from '@shopify/polaris-icons';
import { AdminFrame } from '../shared/AdminFrame.jsx';
import { useStore } from './store.jsx';
import { CompaniesList } from './screens/CompaniesList.jsx';
import { CompanyDetail } from './screens/CompanyDetail.jsx';
import { PricingLibrary } from './screens/PricingLibrary.jsx';
import { Analytics } from './screens/Analytics.jsx';
import { Settings } from './screens/Settings.jsx';
import { PricingEditor } from './components/PricingEditor.jsx';
import { BuildFromQuotes } from './components/BuildFromQuotes.jsx';

function CurrentView() {
  const { state } = useStore();
  switch (state.view) {
    case 'company':
      return <CompanyDetail />;
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
      title: 'Wholesale B2B Solution',
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
    <AdminFrame sections={sections} searchPlaceholder="Search customers, prices and issues">
      <CurrentView />
      <PricingEditor />
      <BuildFromQuotes />
      {state.toast && <Toast content={state.toast} onDismiss={() => dispatch({ type: 'CLEAR_TOAST' })} />}
    </AdminFrame>
  );
}
