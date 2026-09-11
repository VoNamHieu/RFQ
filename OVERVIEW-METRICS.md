# Overview tab — engine tính giá / cách tính từng chỉ số

> Tài liệu này giải thích **mỗi phần trong tab Overview** của màn Analytics được tính ra sao:
> công thức, dữ liệu nguồn, và map sang Shopify. Bám theo `src/b2b/screens/Analytics.jsx`.
> Xem thêm [[PRD-NOTES.md]] cho taxonomy pricing & định nghĩa các tab khác.
>
> Cập nhật: 2026-09-10 · Branch: `wip/analytics`

---

## 0. Nền tảng dùng chung (áp dụng cho mọi chỉ số)

| Khái niệm | Định nghĩa trong code |
|---|---|
| **Scope** | `scopedCompanies` = lọc theo filter Company (+ Location). Mọi chỉ số chỉ tính trong scope này. |
| **Kỳ (period)** | `rangeStart..rangeEnd` — theo **ngày** (day-based), lấy từ Date range. `spanDays` = số ngày. |
| **Kỳ trước (previous)** | `previousPeriodEnd = rangeStart − 1 ngày`; `previousPeriodStart` = lùi thêm `spanDays−1` → **cùng độ dài, ngay liền trước**. Chỉ dùng khi bật "Compare to". |
| **Completed order** | `status ∈ {Fulfilled, Paid}` (`COMPLETED`). Order Blocked/Draft/Needs review… **bị loại**. |
| **`orders`** | Completed orders trong scope **và** trong kỳ (`inPeriod`). Đây là tập nền của hầu hết chỉ số period. |
| **Doanh thu 1 order** | `o.amount` — **proxy demo** cho Net sales của order (gần `Order.total`). Định nghĩa Net sales chuẩn (gross − discounts − reversals, từ sales events, không gate theo status) xem **§3.1**. |
| **Line items** | `analyticsOrderItems[o.id]` = `{ sku, qty, revenue }` (map với draft-order line items của Shopify). |
| **COGS** | `productCost(sku)` = `product.cost` (map **Shopify `InventoryItem.unitCost`**). `orderCogs(o)` = Σ `qty × cost`. **Nếu cost thiếu** — product không có cost, hoặc order không có line items — `orderCogs` = **`null`** (không ước lượng). |
| **Gross profit / Margin 1 order** | `orderGP(o)` = `null` khi COGS null, ngược lại `amount − COGS`. |
| **Quy tắc coverage (quan trọng)** | Không fabricate số liệu tài chính. `gpStats(orders)` tính GP/Margin **chỉ trên phần sales đã có cost** (bỏ các order chưa costed), kèm **`coverage`** = `costedSales / totalSales`. **Margin = GP / costedSales** (margin của phần đã costed, không phải chia cho tổng sales → không bị hiểu sai là toàn store). Khi coverage < 100% → footer của Gross profit/Margin hiện **"X% of sales have cost data"**. **Không có order nào costed → "—"** (chưa biết). **Scope 0 order → GP = $0** (bán 0 = lãi $0, là số 0 thật) **nhưng Margin = "—"** (not applicable — mẫu số = 0; "0%" sẽ bị đọc thành "có bán nhưng không có lãi", trong khi thực ra không có sales nào để tính margin). Áp dụng cho Hero KPI, Top companies, Top products, chart, Pricing tab. *(Đã bỏ fallback `amount × 0.68`.)* |
| **Delta** | Khi bật Compare: `pctChange(giá trị kỳ này, giá trị kỳ trước)`. Margin & repeat hiển thị chênh lệch theo **pp** (điểm phần trăm). |

> **Period vs snapshot:** `orders` (và mọi chỉ số từ nó) lọc theo **kỳ**. Riêng **quotes mở** ("Current open quote value") là **snapshot hiện tại** — mọi quote đang mở, **không lọc theo Date Range lẫn Location** (chỉ giữ Company scope) — xem §3.4b.

---

## §3.1 — Hero KPIs (5 thẻ đầu)

| Chỉ số | Công thức | Biến |
|---|---|---|
| **Net B2B sales** | Tổng **Net sales** của B2B order trong kỳ & scope. **Định nghĩa chuẩn (Shopify) — xem block bên dưới.** *(Demo hiện dùng proxy `Σ o.amount` — đơn giản hoá, chưa đúng hẳn.)* | `sales` |
| **Gross profit** | `gpStats(orders).gp` = Σ `orderGP` trên **các order đã có cost** (costed sales − COGS). Xem **Quy tắc coverage** (§0). Footer hiện **"X% of sales have cost data"** khi coverage < 100%; **"—"** khi không order nào có cost. *(Production: = **Net sales − Net COGS**, COGS cũng reverse theo return/cancel — callout §3.1.)* | `grossProfit` |
| **Gross margin** | `gpStats(orders).margin` = `grossProfit / costedSales × 100` — margin của **phần đã costed** (không chia cho tổng sales). Footer/"—" như Gross profit. | `grossMargin` |
| **Cost coverage** | `costCoverage = costedSales / sales × 100`. **Không phải thẻ riêng** — hiện trong footer của Gross profit / Gross margin khi < 100% để nói rõ số đang dựa trên bao nhiêu % sales. | `costCoverage` |
| **Active companies** | Số `companyId` **khác nhau** xuất hiện trong `orders`; footer "of N managed companies" với `managedCount = companies.length`. *(Khi đã chọn 1 company → đổi thành **Active locations**.)* | `activeCompanyIds.size` |
| **Repeat revenue** | `repeatShare = repeatRevenue / sales × 100`. `repeatRevenue` = Σ `amount` của các order **KHÔNG phải** order hoàn tất **đầu tiên** của company đó (mọi order từ lần thứ 2 trở đi). Footer hiện số tiền `repeatRevenue`. *(Production: tính theo **first sale**, không phải first completed order — callout §3.1.)* | `repeatShare`, `repeatRevenue` |

### Net B2B sales — định nghĩa chuẩn (production)

`Net B2B sales = Gross sales − Discounts − Sales reversals`

- **Gross sales** = giá sản phẩm × số lượng — **trước** discount, return, tax và shipping.
- **Discounts** = discount ở line item **+** phần discount cấp order được **phân bổ (allocated)** về line item.
- **Sales reversals** = phần giá trị sản phẩm bị **đảo ngược** do return / cancellation / order adjustment.
- Chỉ tính sales thuộc **B2B order** (`is_b2b_order = true`).
- **Không** gồm shipping, tax, duties và fees.
- **Recognition theo sale event:** sale ghi nhận **tại thời điểm sale phát sinh**; reversal ghi nhận **tại thời điểm reversal phát sinh**. **Financial status và fulfillment status KHÔNG phải điều kiện** để một sale được tính.
- **Data source:** Shopify **Sales / sales events** — KHÔNG lấy trực tiếp `Order.total`.

> ⚠️ **Demo vs production:** Demo hiện tính `sales = Σ o.amount` trên `orders` (đã lọc `status ∈ {Fulfilled, Paid}`), **lệch** với định nghĩa chuẩn ở 2 điểm: **(1)** `o.amount` là tổng order (gần `Order.total`) — chưa tách gross/discount/reversal và có thể gồm shipping/tax; **(2)** demo **gate theo completed status**, trong khi Net sales chuẩn **không** phụ thuộc financial/fulfillment status. Lên production phải đọc từ **sales events**.

> ⚠️ **Metric phái sinh KHÔNG chỉ "kế thừa" khi đổi sales — mỗi cái cần định nghĩa riêng trên cùng sales-event basis:**
> - **Gross profit (production)** = **`Net sales − Net COGS`**. **Net COGS cũng phải reverse theo return/cancellation/adjustment** — không dùng nguyên `qty × cost`. *Ví dụ:* sell → Net sales $100 / COGS $60 / GP $40; **return toàn bộ** → Net sales reversal −$100 **và** COGS reversal −$60 → Net sales $0 / COGS $0 / **GP $0**. Nếu production vẫn lấy `qty × cost = $60` mà sales đã về $0 → GP = **−$60 (sai)**.
> - **Repeat revenue (production)** = Net sales từ order **sau first buying order / first sale** của company — KHÔNG phải "sau first *completed* order" (vì Net sales không gate theo status; hai mental model sẽ lệch).
> - **New buying companies (production)** = company có **first B2B purchase / first B2B sale** trong kỳ — KHÔNG phải first *completed* order.
> - **Top products revenue (production)** = **net line sales** (gross line − allocated discount − reversals), KHÔNG phải raw `line.revenue` — nếu không sẽ không reconcile với Overview Net sales (vd Overview $80 nhưng Σ product $100).

---

## §3.2 — Baseline context (dải 4 số phụ)

| Chỉ số | Công thức | Biến |
|---|---|---|
| **Orders** | `orders.length` | `orderCount` |
| **Average order value** | `sales / orderCount` | `aov` |
| **Units sold** | Σ `qty` trên toàn bộ line items của `orders` | `unitsSold` |
| **New buying companies** | Số company có **order hoàn tất đầu tiên** rơi vào trong kỳ (`firstOrder ≥ rangeStart`). **Khi chọn 1 company → đổi thành "New locations"** = số location của company đó có first completed order trong kỳ (parallel đúng concept). *Trước đây đổi thành "Active locations" — sai concept (activity ≠ acquisition) và trùng với Hero — đã sửa.* Production def: **first B2B sale**, xem callout §3.1. | `newCompanyIds.size` / `newLocations` |

---

## §3.3 — Sales & profit over time (biểu đồ đường)

- **Bucket thích ứng theo `spanDays`:** ≤31 ngày → theo **ngày**; ≤92 ngày → theo **tuần**; còn lại → theo **tháng** (`bucketMode`).
- Mỗi bucket (`fillBuckets`): `sales` = Σ amount; `gp`/`margin` = `gpStats(bucketOrders)` (costed — xem §0). Bucket không có cost → `gp`/`margin` = **null** → chart **vẽ khoảng trống**, không rơi điểm về 0 giả.
- **Nút chuyển** (Sales / Gross profit / Gross margin) chọn giá trị vẽ: `seriesVal(b)` = `b.gp | b.margin | b.sales`.
- Bật Compare → vẽ chồng series kỳ trước (`overviewPrevSeries`).

---

## §3.4 — Needs attention (thẻ tín hiệu cần xử lý)

### a) "Past their normal reorder cycle" → hero = **SỐ company**
- **Relationship health** (mô hình 5 trạng thái): `reorder ratio = days-since-last-order / median-interval`.
  Healthy ≤1.25× · Watch ≤1.5× · At risk ≤2× · Inactive >2× · else **Insufficient history** (cần ≥4 order / ≥3 khoảng cách).
  - **Current snapshot, recompute theo TODAY** (không forecast): anchor = **latest B2B purchase/order** — return/cancellation/reversal **KHÔNG** reset nhịp. `since` đo tới hiện tại nên health tự trôi theo ngày dù không có order mới. Chi tiết & định nghĩa production: `COMPANIES-METRICS.md` §4.2, §5.
- `pastCycleCompanies` = các company ở **Watch / At risk / Inactive**.
- **Hero (số lớn)** = **`pastCycleCompanies.length`** (vd "3 companies"). Chủ ý đưa **số company** làm hero để **scale khi có nhiều company** — việc cần làm là "review N company", không phải đọc 1 con số GP gộp.
- **Context (dòng phụ)** = `pastCycleGP` = Σ **gross profit 90 ngày gần nhất** (`trailing90GP`: completed orders trong `[TODAY−89, TODAY]`, qua `gpStats`). Hiển thị "$X gross profit in the last 90 days".
  - ⚠️ **Production:** trailing-90 GP dùng **cùng Net sales / Net COGS event basis** như Hero Gross profit (Net GP với reversal cả hai phía) — không phải "completed orders × (qty × cost)". Xem callout §3.1.
- ⚠️ Chủ ý **không** gọi là "revenue at risk" — không có mô hình dự báo, chỉ là bối cảnh tài chính lịch sử.

### b) "Current open quote value" → value = `openQuoteValue`
- ⚠️ **Đây là current snapshot, KHÔNG chạy theo Date Range** (khác với mọi metric khác trong Overview). `openQuotes` = mọi quote **KHÔNG** ở `{Deal Closed, Deal Rejected, Trashed}` — quote mở từ 5 tháng trước vẫn tính. **Cố ý bỏ cả Date Range lẫn Location filter** (chỉ giữ Company scope), để tránh phá mental model "Last 30 days" của trang. Card có microcopy **"Current snapshot · not affected by date range or location"** để nói rõ điều này.
- `openQuoteValue` = Σ `quoteVal(q)`, với `quoteVal` = Σ `line.quoted × line.qty`.
- Context: "N quote(s) still open" (N = `openQuotes.length`).

### c) (Chỉ khi bật Compare) "Gross margin fell for <company>"
- `marginDrops` = với mỗi company: `drop = prevMargin − currentMargin` (margin cả hai kỳ qua `gpStats`). `worstMargin` = company tụt nhiều nhất. Value = số pp tụt; context = doanh thu kỳ này (`salesAffected`).
- ⚠️ **Guardrail coverage (chống false signal):** margin mỗi kỳ chỉ là margin của **phần đã costed**. Nếu coverage hai kỳ lệch (vd previous 100% vs current 30%) thì "drop" có thể **không thật** — 70% sales chưa costed có thể đổi hẳn kết quả. → **Chỉ raise signal khi coverage CẢ HAI kỳ ≥ 80%** (`MARGIN_DROP_MIN_COVERAGE = 80`); dưới ngưỡng → **suppress** (không tạo Needs-attention action trên incomplete data). Khi hiện mà coverage < 100% → note **"Based on X% cost coverage"** (X = min của hai kỳ).

---

## §3.6 — Top companies (bảng top 5) + "View all companies"

- `companyRows` = mỗi company: `revenue` = Σ amount (trong kỳ), `gp`/`margin` = `gpStats(companyOrders)` (costed — xem §0; "—" nếu company có order nhưng chưa costed, `$0`/`0%` nếu 0 order), `share` = `revenue/sales`, `orders`, `repeat`, `last order`. Sắp theo `revenue` giảm dần, lấy **top 5**.
- ⚠️ **Production:** `revenue` phải là **Σ Net sales events attributed to company** (giống Top products → net line sales), KHÔNG phải `Σ Order.total`/`Σ amount` — để Top companies reconcile với Overview Net sales & với Top products. Xem callout §3.1.
- Nút **"View all companies"** → `setTab(1)` chuyển sang tab **Companies** (bảng Company performance đầy đủ + nút Expand full-screen).

---

## §3.2b — New vs existing revenue (thanh xếp chồng)

- **Demo:** **New companies revenue** = Σ amount của order thuộc company có order-đầu-tiên trong kỳ (`newCompanyRevenue`); **Existing** = `sales − newCompanyRevenue`.
- ⚠️ **Production (định nghĩa cohort rõ, không chỉ "sales − new"):**
  - **New company revenue** = **Net sales từ companies có first B2B sale TRONG period**.
  - **Existing company revenue** = **Net sales từ companies có first B2B sale TRƯỚC period**.
  - Cohort chia theo **first B2B sale** (nhất quán với "New buying companies", §3.2) — không phải "first completed order". Tính `existing = sales − new` tuy đúng về số nhưng nên define theo cohort để rõ nghĩa.

---

## §3.7 — Top products (bảng top 5) + "View all"

- Gom line items của `orders` theo `sku` (`productRows`). Mỗi product: `revenue` = Σ `line.revenue`, `units` = Σ `qty`, **`orders` = số order KHÁC NHAU chứa SKU đó** (distinct `orderId`, không phải số dòng — 1 SKU xuất hiện 2 line trong cùng 1 order vẫn tính 1 order), `aov` = `revenue / distinct orders`, `share` = `revenue/sales`. Sắp theo revenue giảm dần.
- **GP / Margin (đúng rule coverage §0):** cost là **per-SKU, all-or-nothing** — nếu product **có cost** → `gp = revenue − Σ(qty × cost)`, `margin = gp/revenue`; nếu **thiếu cost** → `gp = null`, `margin = null` → hiển thị **"—"** (KHÔNG fabricate). *(Ở cấp product KHÔNG có "partial coverage" như cấp order/scope, vì mọi line cùng SKU dùng chung 1 giá cost — cost là 0% hoặc 100%. Code dùng cờ `costKnown`.)*
- ⚠️ **Production:** `revenue` phải là **net line sales** (gross line − allocated discount − reversals), KHÔNG phải raw `line.revenue`, để Σ product **reconcile** với Overview Net sales — xem callout §3.1.
- Nút "View all" mở rộng từ top 5 → toàn bộ (`showAllProducts`).

---

## Bảng map dữ liệu → Shopify (khi lên production)

| Dữ liệu nội bộ | Nguồn Shopify |
|---|---|
| `o.amount` (Net sales) | **Shopify Sales / sales events** (`gross − discounts − reversals`, ex shipping/tax, `is_b2b_order`) — **KHÔNG** phải `Order.total`. Xem §3.1. |
| `o.status` (demo gate) | Order fulfillment/financial status — *lưu ý:* Net sales chuẩn **không** gate theo status (§3.1). |
| `product.cost` (COGS) | `InventoryItem.unitCost`. Thiếu cost → **không ước lượng**; GP/Margin để null và hiện coverage (§0). |
| Line items `{sku, qty, revenue}` | Order / draft-order line items |
| `quote.lines[].quoted × qty` | Quote/RFQ đã lưu (app QuoteSnap) |
| Company / location / firstOrder | Shopify B2B Company + đơn hàng lịch sử |
