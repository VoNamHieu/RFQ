// ABC Construction as the B2B app prototype (rfq-x-b2b-ui, Current version) shows it
// on its Company page: a snapshot of the prototype's data, for previewing the page in
// Shopify admin. Each pricing carries its hover summary (the prototype's
// pricingSummaryItems: icon, label and value).

const company = {
  "id": "c1",
  "name": "ABC Construction",
  "source": "QuoteSnap RFQ",
  "mainContact": "John Nguyen",
  "autoAddLocations": false,
  "totalSales": 48235,
  "orderCount": 6,
  "quoteCount": 7,
  "assignedCount": 14,
  "locations": [
    {
      "id": "l1",
      "name": "Hanoi",
      "deleted": false,
      "buyers": 2
    },
    {
      "id": "l2",
      "name": "Bac Ninh site",
      "deleted": false,
      "buyers": 1
    },
    {
      "id": "l7",
      "name": "Hai Duong depot",
      "deleted": true,
      "buyers": 0
    }
  ],
  "quotes": [
    {
      "id": "1051074",
      "buyer": "John Nguyen",
      "email": "john@abcconstruction.com",
      "created": "2026-08-05 11:10:08",
      "leadScore": null,
      "progress": "Email Sent",
      "status": "Read",
      "assignee": "",
      "unpriced": true
    },
    {
      "id": "1028991",
      "buyer": "Le Thu Ha",
      "email": "ha@abcconstruction.com",
      "created": "2026-07-14 15:53:51",
      "leadScore": null,
      "progress": "Draft Order Created",
      "status": "Deal Closed",
      "assignee": "Vo Nam Hieu",
      "unpriced": false
    },
    {
      "id": "1030120",
      "buyer": "John Nguyen",
      "email": "john@abcconstruction.com",
      "created": "2026-08-10 10:20:00",
      "leadScore": null,
      "progress": "Draft Order Created",
      "status": "Deal Closed",
      "assignee": "Vo Nam Hieu",
      "unpriced": false
    },
    {
      "id": "1028785",
      "buyer": "Pham Duc",
      "email": "duc@abcconstruction.com",
      "created": "2026-07-14 11:43:55",
      "leadScore": null,
      "progress": "PDF Exported",
      "status": "New Received",
      "assignee": "",
      "unpriced": true
    },
    {
      "id": "1024486",
      "buyer": "John Nguyen",
      "email": "john@abcconstruction.com",
      "created": "2026-03-04 09:30:12",
      "leadScore": null,
      "progress": "Draft Order Created",
      "status": "Deal Closed",
      "assignee": "Vo Nam Hieu",
      "unpriced": false
    },
    {
      "id": "1021730",
      "buyer": "Pham Duc",
      "email": "duc@abcconstruction.com",
      "created": "2026-03-26 14:05:40",
      "leadScore": null,
      "progress": "Email Sent",
      "status": "Deal Rejected",
      "assignee": "Vo Nam Hieu",
      "unpriced": false
    },
    {
      "id": "1020388",
      "buyer": "Le Thu Ha",
      "email": "ha@abcconstruction.com",
      "created": "2026-04-15 10:48:03",
      "leadScore": null,
      "progress": "Email Sent",
      "status": "Deal Rejected",
      "assignee": "Vo Nam Hieu",
      "unpriced": false
    }
  ],
  "orders": [
    {
      "id": "#1045",
      "po": "PO-9821",
      "location": "Hanoi",
      "buyer": "John Nguyen",
      "date": "2026-07-15",
      "amount": 12400,
      "status": "Needs review"
    },
    {
      "id": "#1047",
      "po": "PO-9840",
      "location": "Hanoi",
      "buyer": "John Nguyen",
      "date": "2026-08-03",
      "amount": 12200,
      "status": "Invoice sent"
    },
    {
      "id": "#1044",
      "po": "PO-9814",
      "location": "Hanoi",
      "buyer": "Le Thu Ha",
      "date": "2026-07-14",
      "amount": 5860,
      "status": "Fulfilled"
    },
    {
      "id": "#1039",
      "po": "PO-9770",
      "location": "Hanoi",
      "buyer": "John Nguyen",
      "date": "2026-06-28",
      "amount": 6120,
      "status": "Paid"
    },
    {
      "id": "#1028",
      "po": "PO-9651",
      "location": "Bac Ninh site",
      "buyer": "Pham Duc",
      "date": "2026-06-12",
      "amount": 4380,
      "status": "Fulfilled"
    },
    {
      "id": "#1017",
      "po": "PO-9518",
      "location": "Hanoi",
      "buyer": "John Nguyen",
      "date": "2026-05-19",
      "amount": 7275,
      "status": "Fulfilled"
    }
  ],
  "contacts": [
    {
      "name": "John Nguyen",
      "email": "john@abcconstruction.com",
      "role": "Location admin",
      "access": "Buys directly",
      "locations": "Hanoi"
    },
    {
      "name": "Le Thu Ha",
      "email": "ha@abcconstruction.com",
      "role": "Ordering only",
      "access": "Buys directly",
      "locations": "Hanoi"
    },
    {
      "name": "Pham Duc",
      "email": "duc@abcconstruction.com",
      "role": "Ordering only",
      "access": "You approve first",
      "locations": "Bac Ninh site"
    }
  ],
  "pricing": {
    "base": [
      {
        "name": "Distributor Tier 2",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "All products"
          ],
          [
            "discount",
            "Calculation",
            "3 rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "4 Companies · 1 Location"
          ],
          [
            "star",
            "Priority",
            "1"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "ABC Hanoi Site Rates",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "2 selected products"
          ],
          [
            "discount",
            "Calculation",
            "2 overrides"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Location"
          ],
          [
            "star",
            "Priority",
            "1"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "Contract Base",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company · 1 Location"
          ],
          [
            "star",
            "Priority",
            "2"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "Volume Tier A",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "2 Companies · 4 Locations"
          ],
          [
            "star",
            "Priority",
            "3"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "Volume Tier B",
        "status": "Inactive",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company · 1 Location"
          ],
          [
            "star",
            "Priority",
            "4"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "VLV-40 Contract Price",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company · 1 Location"
          ],
          [
            "star",
            "Priority",
            "5"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "Volume Tier C",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company · 1 Location"
          ],
          [
            "star",
            "Priority",
            "5"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "Contractor Bulk",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company · 3 Locations"
          ],
          [
            "star",
            "Priority",
            "6"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "Government Rate",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company · 1 Location"
          ],
          [
            "star",
            "Priority",
            "7"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "Loyalty Base",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company · 1 Location"
          ],
          [
            "star",
            "Priority",
            "8"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "Seasonal 2026",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company · 1 Location"
          ],
          [
            "star",
            "Priority",
            "9"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "Fleet Discount",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company · 2 Locations"
          ],
          [
            "star",
            "Priority",
            "10"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "Clearance Base",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company · 1 Location"
          ],
          [
            "star",
            "Priority",
            "11"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      },
      {
        "name": "New Year Promo",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Base pricing"
          ],
          [
            "product",
            "Products",
            "Shopify prices"
          ],
          [
            "discount",
            "Calculation",
            "No rules"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company · 1 Location"
          ],
          [
            "star",
            "Priority",
            "12"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      }
    ],
    "quantity": [
      {
        "name": "Pallet Breaks",
        "status": "Active",
        "summary": [
          [
            "receipt-dollar",
            "Type",
            "Quantity pricing"
          ],
          [
            "product",
            "Products",
            "All products"
          ],
          [
            "discount",
            "Calculation",
            "3 quantity ranges"
          ],
          [
            "team",
            "Serves",
            "Company-based B2B"
          ],
          [
            "person",
            "Assigned to",
            "1 Company"
          ],
          [
            "star",
            "Priority",
            "0"
          ],
          [
            "calendar",
            "Start",
            "Immediately"
          ]
        ]
      }
    ]
  }
};

export default company;
