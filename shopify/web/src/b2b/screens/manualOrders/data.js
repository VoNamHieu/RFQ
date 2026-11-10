// Static demo data for the Manual Order list (production: features/ManualOrder).
// Rows follow the production list item shape (ManualOrderListItem). Customers
// are the B2B company contacts and wholesale customers already used in
// src/b2b/data/db.js. Pending orders have no Shopify draft order yet.

export const SHOP_DOMAIN = '221baker.myshopify.com';

export const PAGE_SIZE = 10;

export const ORDER_TABS = [
  { id: 'all', content: 'All' },
  { id: 'open', content: 'Open' },
  { id: 'completed', content: 'Completed' },
  { id: 'pending', content: 'Pending' },
];

export const MANUAL_ORDER_STATUS_LABEL = {
  pending: 'Pending',
  open: 'Open',
  completed: 'Completed',
};

export const MANUAL_ORDER_STATUS_BADGE_TONE = {
  pending: 'warning',
  open: 'neutral',
  completed: 'success',
};

export const EMPTY_STATE_IMAGE = 'https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png';
export const ORDER_HELP_URL = 'https://help.omegatheme.com/en/article/order/';

const draft = (n, gid) => ({ draft_order_id: `gid://shopify/DraftOrder/${gid}`, draft_order_name: `#D${n}` });
const noDraft = { draft_order_id: null, draft_order_name: null };

// Newest first, as the API returns them.
export const MANUAL_ORDERS = [
  { id: 31, status: 'open', ...draft(31, 1194820337941), shopify_order_number: null, customer_name: 'John Nguyen', customer_email: 'john@abcconstruction.com', created_at: '2026-10-02T09:14:00' },
  { id: 30, status: 'pending', ...noDraft, shopify_order_number: null, customer_name: 'Bui Quang', customer_email: 'quang@vinhphat.vn', created_at: '2026-09-30T15:40:00' },
  { id: 29, status: 'completed', ...draft(29, 1194761912597), shopify_order_number: '#1062', customer_name: 'Le Thu Ha', customer_email: 'ha@abcconstruction.com', created_at: '2026-09-24T11:02:00' },
  { id: 28, status: 'open', ...draft(28, 1194733076757), shopify_order_number: null, customer_name: 'Do Lan', customer_email: 'lan@songhong.vn', created_at: '2026-09-18T10:25:00' },
  { id: 27, status: 'completed', ...draft(27, 1194690805013), shopify_order_number: '#1059', customer_name: 'Pham Duc', customer_email: 'duc@abcconstruction.com', created_at: '2026-09-11T14:48:00' },
  { id: 26, status: 'open', ...draft(26, 1194655613205), shopify_order_number: null, customer_name: 'Le Van Tam', customer_email: 'tam@deltamech-dn.vn', created_at: '2026-09-05T08:31:00' },
  { id: 25, status: 'pending', ...noDraft, shopify_order_number: null, customer_name: 'Nguyen Hoa', customer_email: 'hoa@deltamechanical.vn', created_at: '2026-08-29T16:12:00' },
  { id: 24, status: 'completed', ...draft(24, 1194598072597), shopify_order_number: '#1055', customer_name: 'Bui Quang', customer_email: 'quang@vinhphat.vn', created_at: '2026-08-05T09:57:00' },
  { id: 23, status: 'open', ...draft(23, 1194561372437), shopify_order_number: null, customer_name: 'Tuan Hoang', customer_email: 'tuan@saigonbuildmart.vn', created_at: '2026-07-30T13:20:00' },
  { id: 22, status: 'completed', ...draft(22, 1194527162645), shopify_order_number: '#1044', customer_name: 'Le Thu Ha', customer_email: 'ha@abcconstruction.com', created_at: '2026-07-14T10:05:00' },
  { id: 21, status: 'completed', ...draft(21, 1194490953493), shopify_order_number: '#1042', customer_name: 'Lan Anh Home', customer_email: 'purchasing@lananhhome.vn', created_at: '2026-07-10T17:36:00' },
  { id: 20, status: 'open', ...draft(20, 1194453696789), shopify_order_number: null, customer_name: 'Minh Decor Studio', customer_email: 'buy@minhdecor.vn', created_at: '2026-07-06T11:44:00' },
  { id: 19, status: 'completed', ...draft(19, 1194415423765), shopify_order_number: '#1021', customer_name: 'Do Lan', customer_email: 'lan@songhong.vn', created_at: '2026-06-20T15:09:00' },
  { id: 18, status: 'completed', ...draft(18, 1194376560917), shopify_order_number: '#1028', customer_name: 'Pham Duc', customer_email: 'duc@abcconstruction.com', created_at: '2026-06-10T09:18:00' },
];
