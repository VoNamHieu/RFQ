// B2B registrations — what buyers submitted through the storefront registration
// form (Wholesale B2B → Registrations). Fields mirror the form's default set:
// contact (first/last name, business email) + business (company name, country,
// Tax/VAT ID) + an optional message. `source` is where the form was placed.
//
// status: 'pending' → merchant approves (links to a Company — or, with no company
// name, a D2C customer) or declines. Approved rows carry `companyId` (D2C:
// `customerId`); decided rows carry `decidedAt`.

export const registrationSeed = [
  // Demo (D2C, already a customer): no company name, and the email is Lan Anh Home's —
  // already a D2C customer — so approving reuses that customer instead of creating one.
  {
    id: 'r110', status: 'pending', submittedAt: '2026-09-24', source: 'Registration page',
    firstName: 'Lan Anh', lastName: 'Nguyen', email: 'purchasing@lananhhome.vn',
    company: '', country: 'Vietnam', taxId: '',
    message: 'We already buy from you online. Please confirm our wholesale account for the new season.',
  },
  // Demo (D2C, company contact): no company name, but the email is Nguyen Hoa's at
  // Delta Mechanical — Merge keeps her there, or she leaves it as a D2C customer.
  {
    id: 'r111', status: 'pending', submittedAt: '2026-09-25', source: 'Registration page',
    firstName: 'Hoa', lastName: 'Nguyen', email: 'hoa@deltamechanical.vn',
    company: '', country: 'Vietnam', taxId: '',
    message: 'I have left Delta Mechanical and now run my own small shop. I would like to keep buying wholesale for myself.',
  },
  // Demo (D2C): no company name — approving makes Linh a Shopify customer in no company.
  {
    id: 'r109', status: 'pending', submittedAt: '2026-09-23', source: 'Registration page',
    firstName: 'Linh', lastName: 'Tran', email: 'linh.tran@gmail.com',
    company: '', country: 'Vietnam', taxId: '',
    message: 'I buy for my own small café and would like wholesale prices on sealant and filters.',
  },
  // Demo (case 1): same email, same company — Pham Duc is already an Ordering-only
  // contact at ABC Construction · Bac Ninh site; merging can update his role.
  {
    id: 'r108', status: 'pending', submittedAt: '2026-09-22', source: 'Account page',
    firstName: 'Duc', lastName: 'Pham', email: 'duc@abcconstruction.com',
    company: 'ABC Construction', country: 'Vietnam', taxId: '0101234567',
    message: 'I now manage purchasing for the Bac Ninh site and need to approve orders there.',
  },
  // Demo (case 2): the email is already a contact at ABC Construction, but the registration is
  // for a different company — the review asks whether to join ABC or create it as well.
  {
    id: 'r107', status: 'pending', submittedAt: '2026-09-21', source: 'Registration page',
    firstName: 'Ha', lastName: 'Le', email: 'ha@abcconstruction.com',
    company: 'Le Ha Interiors', country: 'Vietnam', taxId: 'VN0109988776',
    message: 'I also run a small interior fit-out studio and would like trade pricing for it.',
  },
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
