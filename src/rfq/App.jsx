import React from 'react';
import { Frame, Toast } from '@shopify/polaris';
import { useStore } from './store.jsx';
import { SubmissionList } from './screens/SubmissionList.jsx';
import { QuoteDetail } from './screens/QuoteDetail.jsx';

function CurrentView() {
  const { state } = useStore();
  switch (state.view) {
    case 'quoteDetail':
      return <QuoteDetail />;
    case 'submissionList':
    default:
      return <SubmissionList />;
  }
}

export function App() {
  const { state, dispatch } = useStore();
  return (
    <Frame>
      <CurrentView />
      {state.toast && (
        <Toast content={state.toast} onDismiss={() => dispatch({ type: 'CLEAR_TOAST' })} />
      )}
    </Frame>
  );
}
