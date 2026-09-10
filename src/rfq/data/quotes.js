export const quoteRecords = {
  // Install — QuoteSnap B2B app chưa được cài. Chỉ hiển thị CTA cài app; cài xong quay lại
  // resolve company. Không tạo/sync company ở bước này. (Không thuộc ma trận 4 case.)
  '1051074': {
    number: '1051074',
    title: 'Quote No.1051074',
    received: 'Received by Aug 05 2026, 11:10 AM',
    scenario: 'B2B app not installed',
    state: 'uninstalled',
    // Full Company Information preview ngay cả khi app chưa cài (không tạo/sync gì).
    previewCompanyKey: 'hieuretail',
    customer: {
      name: 'Vo Hieu',
      email: 'hieuvu0106vn@gmail.com',
      phone: '+84705439825',
      shipping: '128 Le Loi, District 1, Ho Chi Minh City, Vietnam',
      message: "The quote's special note"
    },
    product: {
      name: "Kids' Manchester City Home Jersey 2026/27 Long Sleeve With CHERKI 10 Printing",
      sku: '701242812-CHERKI',
      price: 81,
      quantity: 1
    },
    quoteCount: 1,
    lastActivity: 'Today'
  },

  // Case 1 — SPF Member + Company chưa có trong B2B app → sync whole Company.
  //   syncMode 'fixed': company hard-coded từ SPF (fixedCompanyKey: 'watson').
  '1051077': {
    number: '1051077',
    title: 'Quote No.1051077',
    received: 'Received by Aug 06 2026, 01:05 PM',
    scenario: 'Company not in QuoteSnap B2B',
    state: 'new',
    syncMode: 'fixed',
    fixedCompanyKey: 'watson',
    customer: {
      name: 'Watson James',
      email: 'watson.james@watsonco.com',
      phone: '+84911222333',
      shipping: '45 Kim Ma\nHa Noi\nVietnam',
      message: 'Use my company account for this quote.'
    },
    product: {
      name: 'Manchester City Premium Office Set',
      sku: 'MCFC-OFFICE-SET',
      price: 960,
      quantity: 1
    },
    quoteCount: 1,
    lastActivity: 'Today',
    syncedCompanyKey: null
  },

  // Case 4 — Independent requester + Company đã có trong B2B app → assign requester only.
  //   syncMode 'selector' + recommendedKey 'abc' (ABC đã ở B2B, multi-location).
  '1051080': {
    number: '1051080',
    title: 'Quote No.1051080',
    received: 'Received by Aug 07 2026, 02:30 PM',
    scenario: 'Company not in QuoteSnap B2B',
    state: 'new',
    syncMode: 'selector',
    recommendedKey: 'abc',
    customer: {
      name: 'Pham Thi Mai',
      email: 'mai@abcconstruction.com',
      phone: '+84902888444',
      shopifyId: 'gid://shopify/Customer/7801452111',
      shipping: '78 Ba Trieu\nHanoi\nVietnam',
      message: 'New buyer at our Hanoi office, need pricing for a bulk order.'
    },
    product: {
      name: 'Manchester City Heritage Scarf',
      sku: 'MCFC-HERITAGE-SCARF',
      price: 125,
      quantity: 1
    },
    quoteCount: 1,
    lastActivity: 'Today',
    syncedCompanyKey: null
  },

  // Case 3 — Independent requester + Company chưa có trong B2B app → sync whole Company,
  //   rồi assign requester. syncMode 'selector' + recommendedKey 'northstar' (chưa ở B2B).
  '1051081': {
    number: '1051081',
    title: 'Quote No.1051081',
    received: 'Received by Aug 07 2026, 04:00 PM',
    scenario: 'Company not in QuoteSnap B2B',
    state: 'new',
    syncMode: 'selector',
    recommendedKey: 'northstar',
    customer: {
      name: 'Pham Linh',
      email: 'linh@northstar.vn',
      phone: '+84905123123',
      shopifyId: 'gid://shopify/Customer/7801452122',
      shipping: '5 Bach Dang\nDa Nang\nVietnam',
      message: 'First order for our Da Nang site — please set up B2B.'
    },
    product: {
      name: 'Manchester City Heritage Scarf',
      sku: 'MCFC-HERITAGE-SCARF',
      price: 125,
      quantity: 1
    },
    quoteCount: 1,
    lastActivity: 'Today',
    syncedCompanyKey: null
  },

  // Case 2 — SPF Member + Company đã có trong B2B app → Full, chỉ View Company.
  //   state 'linked' (linkedCompanyKey: 'abc'); không sync/assign gì.
  '1051076': {
    number: '1051076',
    title: 'Quote No.1051076',
    received: 'Received by Aug 06 2026, 02:15 PM',
    scenario: 'Linked to B2B company',
    state: 'linked',
    customer: {
      name: 'Le Anh',
      email: 'leanh@abcconstruction.com',
      phone: '+84945550126',
      shipping: '88 Le Loi\nDa Nang\nVietnam',
      message: 'Please issue the quote under the existing company account.'
    },
    product: {
      name: 'Manchester City Team Training Jacket',
      sku: 'MCFC-TRAINING-JACKET',
      price: 1240,
      quantity: 1
    },
    quoteCount: 7,
    lastActivity: '2 hours ago',
    linkedCompanyKey: 'abc'
  },

  // D2C requester with a quote HISTORY — the same email (tran@stellardecor.vn)
  // across 1051090/91/92, none tied to a company yet. Syncing one offers to move
  // the whole history into B2B under the chosen company (the review-step checkbox).
  '1051090': {
    number: '1051090',
    title: 'Quote No.1051090',
    received: 'Received by Aug 08 2026, 09:20 AM',
    scenario: 'Direct customer — no company yet',
    state: 'new',
    syncMode: 'selector',
    customer: {
      name: 'Ngo Bao Tran',
      email: 'tran@stellardecor.vn',
      phone: '+84906778899',
      shipping: '22 Tran Hung Dao\nHo Chi Minh City\nVietnam',
      message: 'Reordering the XL filters we quoted last month.'
    },
    product: { name: 'Industrial filter, XL', sku: 'FIL-XL', price: 96, quantity: 20 },
    quoteCount: 3,
    lastActivity: 'Today',
    syncedCompanyKey: null
  },
  '1051091': {
    number: '1051091',
    title: 'Quote No.1051091',
    received: 'Received by Jul 24 2026, 03:10 PM',
    scenario: 'Direct customer — no company yet',
    state: 'new',
    syncMode: 'selector',
    customer: {
      name: 'Ngo Bao Tran',
      email: 'tran@stellardecor.vn',
      phone: '+84906778899',
      shipping: '22 Tran Hung Dao\nHo Chi Minh City\nVietnam',
      message: 'Hose order for the Q3 fit-out.'
    },
    product: { name: 'Reinforced hose, 12m', sku: 'HOS-12', price: 145, quantity: 8 },
    quoteCount: 3,
    lastActivity: 'Jul 24',
    syncedCompanyKey: null
  },
  '1051092': {
    number: '1051092',
    title: 'Quote No.1051092',
    received: 'Received by Jul 03 2026, 10:45 AM',
    scenario: 'Direct customer — no company yet',
    state: 'new',
    syncMode: 'selector',
    customer: {
      name: 'Ngo Bao Tran',
      email: 'tran@stellardecor.vn',
      phone: '+84906778899',
      shipping: '22 Tran Hung Dao\nHo Chi Minh City\nVietnam',
      message: 'Sealant cartridges, same as before.'
    },
    product: { name: 'Sealant cartridge 300ml', sku: 'SEA-30', price: 8, quantity: 120 },
    quoteCount: 3,
    lastActivity: 'Jul 3',
    syncedCompanyKey: null
  },

  // Second quote for Vo Hieu (same email as 1051074) — gives 'hieuvo' a history so
  // syncing this one offers to move the earlier quote into B2B under the company.
  '1051093': {
    number: '1051093',
    title: 'Quote No.1051093',
    received: 'Received by Aug 09 2026, 02:30 PM',
    scenario: 'Direct customer — no company yet',
    state: 'new',
    syncMode: 'selector',
    customer: {
      name: 'Vo Hieu',
      email: 'hieuvu0106vn@gmail.com',
      phone: '+84705439825',
      shipping: '128 Le Loi, District 1, Ho Chi Minh City, Vietnam',
      message: 'Second order — please set up B2B pricing for us.'
    },
    product: { name: 'Manchester City Team Training Jacket', sku: 'MCFC-TRAINING-JACKET', price: 1240, quantity: 2 },
    quoteCount: 2,
    lastActivity: 'Today',
    syncedCompanyKey: null
  }
};

export const DEFAULT_QUOTE_ID = '1051074';
