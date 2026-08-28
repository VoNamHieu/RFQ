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

function CurrentView() {
  const { state } = useStore();
  switch (state.view) {
    case 'company':
      return <CompanyDetail />;
    case 'customers':
    default:
      return <CompaniesList />;
  }
}

export function App() {
  const { state, dispatch } = useStore();
  const soon = (label) => () => dispatch({ type: 'TOAST', message: `${label} — migrating next` });
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
          onClick: soon('Pricing library'),
        },
        { label: 'Analytics', icon: ChartVerticalIcon, selected: state.view === 'analytics', onClick: soon('Analytics') },
        { label: 'Manual Order', icon: OrderIcon, onClick: () => {} },
        { label: 'Discount', icon: DiscountIcon, onClick: () => {} },
        { label: 'Others', icon: MenuHorizontalIcon, onClick: () => {} },
        { label: 'Settings', icon: SettingsIcon, selected: state.view === 'settings', onClick: soon('Settings') },
      ],
    },
  ];

  return (
    <AdminFrame sections={sections} searchPlaceholder="Search customers, prices and issues">
      <CurrentView />
      {state.toast && <Toast content={state.toast} onDismiss={() => dispatch({ type: 'CLEAR_TOAST' })} />}
    </AdminFrame>
  );
}
