export const shopifyCompanyDirectory = {
  // Hieu Sports Retail — company của requester ở case CHƯA CÀI APP (1051074 · Vo Hieu).
  // Hiện full Company Information như preview trước khi cài B2B; đây chính là data sẽ
  // prefill company setup sau khi cài. Chưa ở B2B, chưa recommendation/selector.
  hieuretail: {
    name: 'Hieu Sports Retail',
    shopifyId: '660512',
    inB2B: false,
    recommended: false,
    score: '',
    signals: [],
    locations: 1,
    locationList: ['Ho Chi Minh City'],
    buyers: 1,
    mainContact: 'Vo Hieu',
    contactEmail: 'hieuvu0106vn@gmail.com',
    locationSummary: 'Ho Chi Minh City'
  },
  // TEST MOCK — Wholesale B2B app CHƯA CÀI. Dùng để test luồng "chưa cài app":
  // banner trong modal "Add custom priced items" phải hiện "Install B2B app" thay vì
  // "Create pricing". `b2bAppInstalled: false` là cờ nhận biết (mặc định coi là đã cài).
  testnoapp: {
    name: 'Test Co (no B2B app)',
    shopifyId: '999001',
    inB2B: false,
    b2bAppInstalled: false,
    recommended: false,
    score: '',
    signals: [],
    locations: 1,
    buyers: 1,
    mainContact: 'Test User',
    contactEmail: 'test.noapp@example.com',
    locationSummary: 'Hanoi'
  },
  // ABC — đã ở B2B, multi-location. Company của Case 4 (1051080 · Mai).
  // mainContact John Nguyen là member sẵn có (không phải requester) — requester được
  // add khi link; buyers/locations của ABC giữ nguyên.
  abc: {
    name: 'ABC Construction',
    shopifyId: '123456',
    inB2B: true,
    recommended: true,
    score: '',
    signals: ['Matching email domain', 'Matching phone'],
    locations: 2,
    locationList: ['Hanoi', 'Bac Ninh site'],
    buyers: 3,
    mainContact: 'John Nguyen',
    contactEmail: 'john@abcconstruction.com',
    locationSummary: 'Hanoi and Bac Ninh site'
  },
  // Delta — đã ở B2B, single-location. Không quote nào dùng; chỉ còn là một option trong
  // company selector (khi merchant tự chọn/đổi company).
  delta: {
    name: 'Delta Mechanical',
    shopifyId: '223410',
    inB2B: true,
    recommended: true,
    score: '',
    signals: ['Matching email domain', 'Matching company name'],
    locations: 1,
    buyers: 2,
    mainContact: 'Nguyen Hoa',
    contactEmail: 'hoa@deltamechanical.vn',
    locationSummary: 'Ho Chi Minh City'
  },
  northstar: {
    name: 'NorthStar Industrial',
    shopifyId: '339102',
    recommended: false,
    score: '',
    signals: [],
    locations: 2,
    locationList: ['Da Nang', 'Hanoi'],
    buyers: 3,
    mainContact: 'Tran Bao',
    contactEmail: 'bao@northstar.vn',
    locationSummary: 'Da Nang and Hanoi',
    // Case 3 — NorthStar chưa ở B2B. Sync whole company mang 3 SPF member sẵn có (dưới).
    // Requester Pham Linh KHÔNG nằm trong list (chưa phải member) → được add qua bước
    // assign location. B2B app materialize 3 member này rồi thêm requester (xem injectRfqCompany).
    buyerList: [
      { name: 'Tran Bao', email: 'bao@northstar.vn', location: 'Da Nang' },
      { name: 'Le Quyen', email: 'quyen@northstar.vn', location: 'Hanoi' },
      { name: 'Vu Nam', email: 'nam@northstar.vn', location: 'Hanoi' }
    ]
  },
  apex: {
    name: 'Apex Tools Vietnam',
    shopifyId: '441807',
    recommended: false,
    score: '',
    signals: [],
    locations: 1,
    buyers: 1,
    mainContact: 'Le Quan',
    contactEmail: 'quan@apextools.vn',
    locationSummary: 'Ho Chi Minh City'
  },
  // Watson Co — chưa ở B2B, single-location. Company của Case 1 (1051077 · Watson James),
  // deterministic qua syncMode 'fixed' (hard-code, không recommendation/selector).
  watson: {
    name: 'Watson Co',
    shopifyId: '550901',
    recommended: true,
    score: '',
    signals: [],
    locations: 1,
    buyers: 1,
    mainContact: 'Watson James',
    contactEmail: 'watson.james@watsonco.com',
    locationSummary: 'Watson Co'
  },
  vinhphat: {
    name: 'Vinh Phat Trading',
    shopifyId: '661203',
    inB2B: true,
    recommended: false,
    score: '',
    signals: [],
    locations: 1,
    buyers: 1,
    mainContact: 'Bui Quang',
    contactEmail: 'quang@vinhphat.vn',
    locationSummary: 'Da Nang'
  },
  songhong: {
    name: 'Song Hong Interiors',
    shopifyId: '773401',
    inB2B: true,
    recommended: false,
    score: '',
    signals: [],
    locations: 1,
    buyers: 1,
    mainContact: 'Do Lan',
    contactEmail: 'lan@songhong.vn',
    locationSummary: 'Hanoi'
  }
};

// DEV/QA helper: which RFQ↔B2B sync scenario a quote exercises. Surfaced as a
// dev-mode badge in the submission list so QA can tell the scenarios apart.
// `tag` is the short badge label (state-based, no case numbers); `label` is the
// fuller description shown in the badge's tooltip.
export function syncCaseOf(quote) {
  if (!quote) return null;
  if (quote.state === 'uninstalled') return { tag: 'No install', label: 'B2B app not installed' };
  if (quote.state === 'linked') return { tag: 'Managed', label: 'Member · already in B2B (view only)' };
  const key = quote.fixedCompanyKey || quote.recommendedKey || quote.syncedCompanyKey || quote.previewCompanyKey;
  const inB2B = !!(key && shopifyCompanyDirectory[key]?.inB2B);
  if (quote.syncMode === 'fixed') return { tag: 'No sync', label: 'Member · company not in B2B' };
  return inB2B
    ? { tag: 'Add buyer', label: 'Independent · already in B2B' }
    : { tag: 'No sync', label: 'Independent · company not in B2B' };
}
