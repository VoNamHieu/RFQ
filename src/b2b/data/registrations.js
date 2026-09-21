// B2B registrations — what buyers submitted through the storefront registration
// form (Wholesale B2B → Registrations). Fields mirror the form's default set:
// contact (first/last name, business email) + business (company name, country,
// Tax/VAT ID) + an optional message. `source` is where the form was placed.
//
// status: 'pending' → merchant approves (links to a Company) or declines.
// Approved rows carry `companyId`; decided rows carry `decidedAt`.

export const registrationSeed = [
  {
    id: 'r106', status: 'pending', submittedAt: '2026-09-20', source: 'Account page',
    firstName: 'Thanh', lastName: 'Pham', email: 'thanh.pham@abcconstruction.com',
    company: 'ABC Construction', country: 'Vietnam', taxId: '0101234567',
    message: 'Site manager for the new Bac Ninh site. We need to order filters and valves directly instead of going through head office.',
  },
  {
    id: 'r105', status: 'pending', submittedAt: '2026-09-19', source: 'Registration page',
    firstName: 'Tuan', lastName: 'Hoang', email: 'tuan@saigonbuildmart.vn',
    company: 'Saigon Build Mart', country: 'Vietnam', taxId: 'VN0312456789',
    message: 'Hardware retailer with 3 stores in Ho Chi Minh City. Looking for trade pricing on sealants and hoses.',
  },
  {
    id: 'r104', status: 'pending', submittedAt: '2026-09-18', source: 'Product page',
    firstName: 'Mai', lastName: 'Nguyen', email: 'mai.nguyen.dm@gmail.com',
    company: 'Delta Mechanical', country: 'Vietnam', taxId: '',
    message: '',
  },
  {
    id: 'r103', status: 'pending', submittedAt: '2026-09-17', source: 'Registration page',
    firstName: 'Kenji', lastName: 'Sato', email: 'k.sato@pacifichvac.jp',
    company: 'Pacific HVAC Supply', country: 'Japan', taxId: 'T1234567890123',
    message: 'Distributor in Osaka evaluating 40 mm ball valves for a Q4 project, around 600 units.',
  },
  {
    id: 'r102', status: 'declined', submittedAt: '2026-09-10', decidedAt: '2026-09-11', source: 'Product page',
    firstName: 'Khoa', lastName: 'Le', email: 'deals@quickdeals.shop',
    company: 'Quick Deals Online', country: 'Vietnam', taxId: '',
    message: 'We resell on marketplaces.',
  },
  {
    id: 'r101', status: 'approved', submittedAt: '2026-09-01', decidedAt: '2026-09-02', source: 'Registration page',
    firstName: 'Lan', lastName: 'Do', email: 'lan@songhong.vn',
    company: 'Song Hong Interiors', country: 'Vietnam', taxId: 'VN0108765432',
    message: 'Interior fit-out company, we order fittings monthly.',
    companyId: 'c4',
  },
];
