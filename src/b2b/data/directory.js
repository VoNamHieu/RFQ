// Demo representation of companies already present on the connected Shopify store.
// Extracted verbatim from rfq-x-b2b/b2b/index.html (shopifyCompanyDirectory).

export const shopifyCompanyDirectory = [
  {
    id: 'shp_c1', name: 'ABC Construction', status: 'Active', locations: [
      { id: 'shp_l1', name: 'Hanoi', terms: 'Net 30', ordering: 'Buys directly' },
      { id: 'shp_l2', name: 'Bac Ninh site', terms: 'Due on receipt', ordering: 'You approve first' }
    ], contacts: [
      { name: 'John Nguyen', email: 'john@abcconstruction.com', role: 'Location admin', access: 'Buys directly', location: 'Hanoi' },
      { name: 'Le Thu Ha', email: 'ha@abcconstruction.com', role: 'Ordering only', access: 'Buys directly', location: 'Hanoi' },
      { name: 'Pham Duc', email: 'duc@abcconstruction.com', role: 'Ordering only', access: 'You approve first', location: 'Bac Ninh site' }
    ]
  },
  {
    id: 'shp_c2', name: 'Vinh Phat Trading', status: 'Active', locations: [
      { id: 'shp_l3', name: 'Da Nang', terms: 'Net 15', ordering: 'Buys directly' }
    ], contacts: [{ name: 'Bui Quang', email: 'quang@vinhphat.vn', role: 'Location admin', access: 'Buys directly', location: 'Da Nang' }]
  },
  {
    id: 'shp_c3', name: 'Delta Mechanical', status: 'Active', locations: [
      { id: 'shp_l4', name: 'Ho Chi Minh City', terms: 'Not set', ordering: 'You approve first' }
    ], contacts: [{ name: 'Tran Minh', email: 'minh@deltamechanical.vn', role: 'Location admin', access: 'You approve first', location: 'Ho Chi Minh City' }]
  },
  {
    id: 'shp_c4', name: 'Song Hong Interiors', status: 'Active', locations: [
      { id: 'shp_l5', name: 'Hanoi', terms: 'Due on receipt', ordering: 'Buys directly' }
    ], contacts: [{ name: 'Do Lan', email: 'lan@songhong.vn', role: 'Location admin', access: 'Buys directly', location: 'Hanoi' }]
  },
  {
    id: 'shp_c5', name: 'Highland Fitout', status: 'Active', locations: [
      { id: 'shp_l6', name: 'Hai Phong', terms: 'Due on receipt', ordering: 'Buys directly' },
      { id: 'shp_l7', name: 'Quang Ninh project', terms: 'Due on receipt', ordering: 'You approve first' }
    ], contacts: [
      { name: 'Pham Vu', email: 'pham.vu@highlandfitout.vn', role: 'Location admin', access: 'Buys directly', location: 'Hai Phong' },
      { name: 'Nguyen Hai', email: 'hai@highlandfitout.vn', role: 'Ordering only', access: 'Buys directly', location: 'Hai Phong' },
      { name: 'Le Trang', email: 'trang@highlandfitout.vn', role: 'Ordering only', access: 'You approve first', location: 'Quang Ninh project' }
    ]
  },
  {
    id: 'shp_c6', name: 'North Hub Retail', status: 'Active', locations: [
      { id: 'shp_l8', name: 'Hanoi', terms: 'Net 15', ordering: 'Buys directly' },
      { id: 'shp_l9', name: 'Da Nang', terms: 'Net 15', ordering: 'Buys directly' },
      { id: 'shp_l10', name: 'Ho Chi Minh City', terms: 'Net 15', ordering: 'Buys directly' },
      { id: 'shp_l14', name: 'Hai Phong', terms: 'Net 15', ordering: 'You approve first' },
      { id: 'shp_l15', name: 'Can Tho', terms: 'Due on receipt', ordering: 'Buys directly' }
    ], contacts: [
      { name: 'Mai Linh', email: 'linh@northhub.vn', role: 'Location admin', access: 'Buys directly', location: 'Hanoi' },
      { name: 'Hoang Nam', email: 'nam@northhub.vn', role: 'Ordering only', access: 'Buys directly', location: 'Hanoi' },
      { name: 'Tran Bao', email: 'bao@northhub.vn', role: 'Location admin', access: 'Buys directly', location: 'Da Nang' },
      { name: 'Vu Ha', email: 'ha@northhub.vn', role: 'Location admin', access: 'Buys directly', location: 'Ho Chi Minh City' },
      { name: 'Dang Khoa', email: 'khoa@northhub.vn', role: 'Ordering only', access: 'Buys directly', location: 'Ho Chi Minh City' },
      { name: 'Ly Thu', email: 'thu@northhub.vn', role: 'Location admin', access: 'You approve first', location: 'Hai Phong' },
      { name: 'Bui Son', email: 'son@northhub.vn', role: 'Location admin', access: 'Buys directly', location: 'Can Tho' }
    ]
  },
  {
    id: 'shp_c7', name: 'Mekong Industrial Supply', status: 'Active', locations: [
      { id: 'shp_l11', name: 'Can Tho', terms: 'Net 30', ordering: 'Buys directly' }
    ], contacts: [{ name: 'Vo Minh', email: 'minh@mekongindustrial.vn', role: 'Location admin', access: 'Buys directly', location: 'Can Tho' }]
  },
  {
    id: 'shp_c8', name: 'Lotus Hotel Group', status: 'Active', locations: [
      { id: 'shp_l12', name: 'Head office', terms: 'Due on receipt', ordering: 'You approve first' },
      { id: 'shp_l13', name: 'Hoi An property', terms: 'Due on receipt', ordering: 'Buys directly' }
    ], contacts: [
      { name: 'Ngoc Anh', email: 'procurement@lotushotels.vn', role: 'Location admin', access: 'You approve first', location: 'Head office' },
      { name: 'Phan Yen', email: 'yen@lotushotels.vn', role: 'Ordering only', access: 'Buys directly', location: 'Hoi An property' }
    ]
  },
  // A few more, so the Add companies list is long enough to scroll.
  {
    id: 'shp_c9', name: 'Saigon Office Solutions', status: 'Active', locations: [
      { id: 'shp_l16', name: 'District 1', terms: 'Net 30', ordering: 'Buys directly' }
    ], contacts: [{ name: 'Tran Thu', email: 'thu@saigonoffice.vn', role: 'Location admin', access: 'Buys directly', location: 'District 1' }]
  },
  {
    id: 'shp_c10', name: 'Hai Au Logistics', status: 'Active', locations: [
      { id: 'shp_l17', name: 'Hai Phong port', terms: 'Net 30', ordering: 'Buys directly' },
      { id: 'shp_l18', name: 'Quang Ninh depot', terms: 'Net 15', ordering: 'You approve first' },
      { id: 'shp_l19', name: 'Hanoi office', terms: 'Net 30', ordering: 'Buys directly' }
    ], contacts: [
      { name: 'Dang Hai', email: 'hai@haiaulogistics.vn', role: 'Location admin', access: 'Buys directly', location: 'Hai Phong port' },
      { name: 'Ly Mai', email: 'mai@haiaulogistics.vn', role: 'Ordering only', access: 'You approve first', location: 'Quang Ninh depot' },
      { name: 'Ngo Tuan', email: 'tuan@haiaulogistics.vn', role: 'Ordering only', access: 'Buys directly', location: 'Hanoi office' }
    ]
  },
  {
    id: 'shp_c11', name: 'Thanh Cong Textiles', status: 'Active', locations: [
      { id: 'shp_l20', name: 'Nam Dinh mill', terms: 'Net 45', ordering: 'Buys directly' },
      { id: 'shp_l21', name: 'Ho Chi Minh showroom', terms: 'Due on receipt', ordering: 'Buys directly' }
    ], contacts: [
      { name: 'Hoang Lan', email: 'lan@thanhcongtextiles.vn', role: 'Location admin', access: 'Buys directly', location: 'Nam Dinh mill' },
      { name: 'Vu Khanh', email: 'khanh@thanhcongtextiles.vn', role: 'Ordering only', access: 'Buys directly', location: 'Ho Chi Minh showroom' }
    ]
  },
  {
    id: 'shp_c12', name: 'Blue Ocean Restaurants', status: 'Active', locations: [
      { id: 'shp_l22', name: 'Nha Trang', terms: 'Due on receipt', ordering: 'You approve first' },
      { id: 'shp_l23', name: 'Vung Tau', terms: 'Due on receipt', ordering: 'You approve first' }
    ], contacts: [{ name: 'Le Binh', email: 'binh@blueocean.vn', role: 'Location admin', access: 'You approve first', location: 'Nha Trang' }]
  },
  {
    id: 'shp_c13', name: 'Green Leaf Pharmacy', status: 'Active', locations: [
      { id: 'shp_l24', name: 'Hue', terms: 'Net 15', ordering: 'Buys directly' }
    ], contacts: [{ name: 'Cao Ha', email: 'ha@greenleaf.vn', role: 'Location admin', access: 'Buys directly', location: 'Hue' }]
  },
  {
    id: 'shp_c14', name: 'Dong A Electrical', status: 'Active', locations: [
      { id: 'shp_l25', name: 'Bien Hoa factory', terms: 'Net 30', ordering: 'Buys directly' },
      { id: 'shp_l26', name: 'Binh Duong warehouse', terms: 'Net 30', ordering: 'You approve first' }
    ], contacts: [
      { name: 'Truong Son', email: 'son@donga-electric.vn', role: 'Location admin', access: 'Buys directly', location: 'Bien Hoa factory' },
      { name: 'Ha Vy', email: 'vy@donga-electric.vn', role: 'Ordering only', access: 'You approve first', location: 'Binh Duong warehouse' },
      { name: 'Dinh Long', email: 'long@donga-electric.vn', role: 'Ordering only', access: 'Buys directly', location: 'Binh Duong warehouse' }
    ]
  }
];

// The directory as Shopify has it now: each company plus the locations created on
// it in Shopify since the app loaded (state.shopifyNewLocations, keyed by company id).
export const shopifyCompanies = (newLocations = {}) =>
  shopifyCompanyDirectory.map((s) => (newLocations[s.id]?.length ? { ...s, locations: [...(s.locations || []), ...newLocations[s.id]] } : s));
