import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  render(<s-button>Request a quote</s-button>, document.body);
};
