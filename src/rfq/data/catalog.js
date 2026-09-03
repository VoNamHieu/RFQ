// Shares the b2b product/variant shape (see b2b/data/db.js): the first variant is
// the default and its id === the sku, so a quote line (product-level) maps to the
// default variant when its prices sync into a B2B variant-level base pricing.
export const RFQ_CATALOG = [
  {sku:'FIL-STD', title:'Industrial filter, standard', list:62, stock:1200, variants:[{id:'FIL-STD', title:'Standard', list:62}]},
  {sku:'FIL-XL',  title:'Industrial filter, XL',       list:96, stock:840, variants:[{id:'FIL-XL', title:'Standard', list:96},{id:'FIL-XL-HD', title:'Heavy-duty', list:118}]},
  {sku:'SEA-30',  title:'Sealant cartridge 300ml',     list:8, stock:2600, variants:[{id:'SEA-30', title:'300 ml', list:8}]},
  {sku:'HOS-12',  title:'Reinforced hose, 12m',        list:145, stock:210, variants:[{id:'HOS-12', title:'12 m', list:145},{id:'HOS-12-18M', title:'18 m', list:205},{id:'HOS-12-24M', title:'24 m', list:265}]},
  {sku:'VLV-40',  title:'Ball valve 40mm',             list:52, stock:670, variants:[{id:'VLV-40', title:'40 mm', list:52}]},
  {sku:'MCFC-TRAINING-JACKET', title:'Manchester City Team Training Jacket', list:1240, stock:120, variants:[{id:'MCFC-TRAINING-JACKET', title:'M', list:1240},{id:'MCFC-JACKET-L', title:'L', list:1240},{id:'MCFC-JACKET-XL', title:'XL', list:1290}]}
];

/* Sản phẩm + giá B2B theo TỪNG base price template (id khớp RFQ_PRICING_OPTIONS). */
export const RFQ_TEMPLATE_PRODUCTS = {
  p1: [{sku:'FIL-STD',price:45},{sku:'SEA-30',price:5.9},{sku:'FIL-XL',price:70},{sku:'VLV-40',price:39}],
  p8: [{sku:'HOS-12',price:118},{sku:'MCFC-TRAINING-JACKET',price:980},{sku:'FIL-STD',price:48}]
};

export const RFQ_CUST_ADDR = { hieuretail:'Ha Noi\nHa Noi 100000\nVietnam', abc:'12 Hai Ba Trung, Hoan Kiem\nHa Noi 100000\nVietnam', delta:'88 Nguyen Van Linh, Dist 7\nHo Chi Minh City 700000\nVietnam' };

/* Statically resolved from shopifyCompanyDirectory (all 8 keys have a mainContact,
   so none are filtered out). shipping = mainContact + '\n' + (RFQ_CUST_ADDR[key]
   || locationSummary + '\nVietnam'). */
export const RFQ_CUSTOMERS = [
  { key:'hieuretail', name:'Vo Hieu',      email:'hieuvu0106vn@gmail.com',       companyKey:'hieuretail', company:'Hieu Sports Retail',   shipping:'Vo Hieu\nHa Noi\nHa Noi 100000\nVietnam',                                     note:"The quote's special note" },
  { key:'abc',        name:'John Nguyen',  email:'john@abcconstruction.com',     companyKey:'abc',        company:'ABC Construction',     shipping:'John Nguyen\n12 Hai Ba Trung, Hoan Kiem\nHa Noi 100000\nVietnam',             note:"The quote's special note" },
  { key:'delta',      name:'Nguyen Hoa',   email:'hoa@deltamechanical.vn',       companyKey:'delta',      company:'Delta Mechanical',     shipping:'Nguyen Hoa\n88 Nguyen Van Linh, Dist 7\nHo Chi Minh City 700000\nVietnam',   note:"The quote's special note" },
  { key:'northstar',  name:'Tran Bao',     email:'bao@northstar.vn',             companyKey:'northstar',  company:'NorthStar Industrial', shipping:'Tran Bao\nDa Nang and Hanoi\nVietnam',                                        note:"The quote's special note" },
  { key:'apex',       name:'Le Quan',      email:'quan@apextools.vn',            companyKey:'apex',       company:'Apex Tools Vietnam',   shipping:'Le Quan\nHo Chi Minh City\nVietnam',                                          note:"The quote's special note" },
  { key:'watson',     name:'Watson James', email:'watson.james@watsonco.com',    companyKey:'watson',     company:'Watson Co',            shipping:'Watson James\nWatson Co\nVietnam',                                            note:"The quote's special note" },
  { key:'vinhphat',   name:'Bui Quang',    email:'quang@vinhphat.vn',            companyKey:'vinhphat',   company:'Vinh Phat Trading',    shipping:'Bui Quang\nDa Nang\nVietnam',                                                 note:"The quote's special note" },
  { key:'songhong',   name:'Do Lan',       email:'lan@songhong.vn',              companyKey:'songhong',   company:'Song Hong Interiors',  shipping:'Do Lan\nHanoi\nVietnam',                                                      note:"The quote's special note" }
];

/* Existing B2B base pricings per company — a snapshot mirroring the B2B app so
   the merchant can select or create the destination on the RFQ side. Ids match
   the B2B app's policy ids. */
export const RFQ_PRICING_OPTIONS = {
  abc:      [{id:'p1', name:'Distributor Tier 2', priority:1}, {id:'p8', name:'Contract Base', priority:2}],
  vinhphat: [{id:'p1', name:'Distributor Tier 2', priority:1}],
  songhong: [{id:'p1', name:'Distributor Tier 2', priority:1}]
};
