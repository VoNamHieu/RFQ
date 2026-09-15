# Company Analytics — blueprint & engine tính từng chỉ số

> Bản thiết kế cho **Analytics tab bên trong Company detail** (`CompanyDetail` → tab Analytics) — **account intelligence**, KHÁC với `[[COMPANIES-METRICS.md]]` (tab Companies toàn portfolio). Bám theo `src/b2b/components/CompanyAnalytics.jsx`.
> Xem thêm [[PRICING-METRICS.md]] (pricing metrics), [[QUOTES-METRICS.md]], [[OVERVIEW-METRICS.md]] (engine chung).
>
> Cập nhật: 2026-09-15 · Component: `CompanyAnalytics.jsx`

---

## 0. Triết lý & rule chọn metric

**Company Analytics so company với CHÍNH LỊCH SỬ của nó, không phải benchmark portfolio.** Đó là điều global analytics (filter Company = X) không cho được cảm giác tương tự.

> **Rule chọn metric** — một metric chỉ đủ thành **section riêng** nếu trả lời ít nhất một trong:
> 1. *Company này thường hành xử thế nào?* (learn its own cadence/basket)
> 2. *Company này đang khác chính lịch sử của nó ở đâu?* (change vs own previous period)
> 3. *Pricing/negotiation hiện tại có fit cách company thực sự mua không?*
>
> Metric chỉ trả lời *"company này có bao nhiêu sales/orders?"* → chỉ được làm **context KPI**, không thành section.

**Mental model:** How are they buying? → Is behavior changing? → What are we negotiating? → Does assigned pricing fit? → What happened recently?

**Neo demo:** `TODAY = 2026-08-24` (đồng bộ với màn Analytics chính).

---

## 1. Controls & nền tảng

| Khái niệm | Định nghĩa |
|---|---|
| **Date range** | `period` ∈ {30d, 3m, 6m, 12m}, mặc định 3m. `rangeStart..TODAY`. |
| **Compare** | `previous` (mặc định) → kỳ trước cùng độ dài ngay liền trước (`prevStart..prevEnd`); `none` → tắt delta. |
| **Completed order** | `status ∈ {Fulfilled, Paid}`. `allCompleted` = mọi completed order của company, sort tăng theo date. |
| **`periodOrders` / `prevOrders`** | `allCompleted` lọc trong kỳ / kỳ trước. |
| **PERIOD vs SNAPSHOT** | Net sales/Orders/AOV, negotiation history, pricing health… theo **kỳ**. **Open quote value** và **Relationship state** là **current snapshot** (bỏ date range) — có microcopy *"Current snapshot · not affected by date range"*. |
| **4 tab** | Overview / Buying / Quotes / Pricing (`Tabs`, state `tab`). |

---

## 2. Overview — "company này hiện thế nào?"

### A. Hero (4 KPI)
| KPI | Công thức | Basis |
|---|---|---|
| **Net sales** | Σ `amount` `periodOrders` (+ delta vs prev) | period |
| **Orders** | `periodOrders.length` (+ delta) | period |
| **Average order value** | `netSales / orders` (+ delta) | period |
| **Open quote value** | Σ `quoteVal` các open quote (`status ∉ {Deal Closed, Deal Rejected, Trashed}`) | **snapshot** |

`quoteVal(q)` = Σ `line.quoted × line.qty`. Delta = `pctChange(cur, prev)` khi Compare = previous.

### B. Relationship state (đặc trưng nhất)
- `intervals` = khoảng cách (ngày) giữa các completed order liên tiếp (all-time).
- **Typical reorder** = `median(intervals)` (cần ≥3 interval).
- **Last order** = `since` = TODAY − last order date.
- **Current gap** = `ratio = since / typical` (×usual).
- **State** (cần ≥4 order): `ratio ≤1.25` Healthy · `≤1.5` Watch · `≤2` At risk · `>2` Inactive · else **Insufficient history**.
- Câu: *"{overdue} days past its usual reorder time"* với `overdue = max(0, since − typical)`. **KHÔNG forecast** next order — chỉ nói lệch bao nhiêu so với rhythm.

### C. Contextual sentence (dưới hero)
- **Không còn là card riêng** — chỉ **một câu** render ngay dưới hero card (`changedSentence`); delta Net sales / Orders / AOV đã nằm trên hero rồi nên không lặp lại thành section.
- Câu contextual **rule-based** (không AI): vd `|salesΔ|≤12% ∧ ordersΔ≤−20% ∧ aovΔ≥20%` → *"Sales stayed roughly flat while the company placed fewer, larger orders."* Fallback theo hướng sales. Chỉ hiện khi Compare = previous và cả 2 kỳ đều có order.

### D. Attention needed (factual, KHÔNG risk score)
Surface signal + CTA click sang tab:
- `N open quotes inactive for more than 10 days` → Quotes (`staleOpen` = open quote có `lastActivity > 10`).
- `$X order value below 20% margin` → Pricing (`exceptionValue`).
- `Last purchase was R× the usual reorder interval ago` (khi `ratio > 1.5`) → Buying.

### E. Recent activity
Unified timeline (6 events gần nhất) từ orders + quotes(created + won) + pricing changes; CTA "View all activity" (→ tab Quotes có full timeline). Xem §6.

---

## 3. Buying — "company này mua như thế nào?"

- **A. Buying rhythm** — Typical reorder / Last order / Current gap / Orders in period + **cadence timeline** (`Timeline`, mỗi order 1 cột, gap label giữa các order). Hero của tab, nhấn cadence chứ không phải sales line.
- **B. Purchase trend** — `LineChart` sales theo tháng + so **prev90 vs cur90** (`ShiftRow` Net sales / Orders / AOV) + câu contextual. Mục đích: mua nhiều hơn / ít hơn / hay chỉ đổi kích thước order.
- **C. Basket behaviour** (last 8 completed orders):
  - **Frequently purchased**: SKU xuất hiện ≥ ⌈N/2⌉ trong last-8.
  - **New in recent orders**: SKU có `firstPurchase` nằm trong ~3 order gần nhất và **chưa từng** mua ở earlier (`first {date}`).
  - **Previously frequent**: SKU từng ở ≥ nửa các order *earlier* (trước last-4) nhưng **vắng ở last-4**. Chỉ nói factual — KHÔNG gọi "churn/lost". **Chỉ tính khi có ≥8 completed order** (`MIN_HISTORY_FOR_LAPSED`) — ít hơn thì hiện *"Needs ≥8 orders"* thay vì kết luận trên mẫu quá nhỏ.
- **D. Product mix change** — share theo `productType` (theo line value): prev period → cur period (`ShiftRow` %). Global Top Products không trả lời được "company dịch demand sang đâu". **Chỉ render khi taxonomy dùng được** (`mixUsable`: ≥2 category khác `"Other"` và có value ở ít nhất 1 kỳ) — nếu product không có productType hữu ích thì ẩn hẳn section thay vì hiện một hàng "Other 100%".
- **E. Order summary** — Largest / Median order value / Products per order / Days since last + CTA "View orders →" (→ tab Orders thật). *Analytics = understand; Orders tab = manage records.*

---

## 4. Quotes — "đang negotiate với company này thế nào?"

- **A. Quote summary** — Open quote value (snapshot) · Open quotes · Win rate (by count, period) · First response time (median `created → sự kiện sent/priced` đầu tiên trên timeline).
- **B. Open quote attention** — bảng open quotes: Quote · Value · Status · Age (`quoteAge`) · Last activity (`lastActivity`, từ timeline). Sort activity cũ nhất trước. Note *"N quotes had no activity for more than 10 days"* + CTA "View all quotes →".
- **C. Negotiation history** (period) — Quotes created · Won · Lost · Win rate by count · Median time to decision. **Bỏ "Still open"** — hero (§A / Overview) đã có Open quotes nên không lặp lại. Median time to decision = median `createdAt → resolvedAt` trên finalized quote, với **`resolvedAt(q)`** = `q.resolvedAt` nếu có, không thì **sự kiện timeline cuối cùng** (thời điểm quote thành Won/Lost) — **KHÔNG dùng `q.updated`** (một quote đã Won vẫn có thể bị edit tiếp, `updated` sẽ trễ). Production nên lưu `resolvedAt` thật khi quote resolve. Không cần "Win rate by company" vì company đã cố định.
- **D. Quoted price vs company pricing** — trên **recent won quotes** (≤6): `quoteVariance = (Σ quoted×qty − Σ refAtQuote×qty) / Σ refAtQuote×qty`. **`refAtQuote` là snapshot giá company được gán TẠI THỜI ĐIỂM quote** (`companyPricingReferenceAtQuote`, seed trong `db.js`) — **KHÔNG re-run pricing engine hiện tại** (`resolveDetail`) lên quote lịch sử, vì pricing có thể đã đổi từ lúc quote. Line không có `refAtQuote` bị **loại** (không fallback sang live engine). **Average difference** là **value-weighted** (Σ quoted / Σ ref trên tất cả line, khớp tooltip "weighted by value") — không phải trung bình cộng % từng quote. + "N within ±5% · M >10% below". Trả lời: pricing gán cho company có phải negotiate lại thường xuyên không.
- **E. Win rate by discount** (company-only) — band `0–5% / 5–10% / 10–15% / 15%+` off (vs Shopify list), `rate = won/finalized` + sample size. Association, không kết luận nhân quả.
- **F. Quote → purchase continuity** — **CHƯA build**: demo không có deterministic quote→order link; theo nguyên tắc "không fake metric" nếu chưa có link chắc chắn.

---

## 5. Pricing — "pricing của company này có fit không?"

Chỉ **evaluate**, không config (config vẫn ở Pricing tab thật của company). Scoped cho company, dùng lại định nghĩa [[PRICING-METRICS.md]].

> **Thừa hưởng engine (quan trọng):** toàn bộ §5 **KHÔNG có pricing engine riêng**. Nó import `buildAttributedLines` / `pricingProfileRows` / `appliedEconomics` từ **`src/b2b/pricingAttribution.js`** — **đúng cùng module** mà Pricing tab global (§6 [[PRICING-METRICS.md]]) dùng. Chạy trên `buildAttributedLines(periodOrders, productCost)` với `periodOrders` = completed orders của **riêng company** này. Snapshot rule (resolved* pre-override vs *AtCreation, group B2B pricing / Other) giữ nguyên định nghĩa từ engine chung; Company Analytics **chỉ thêm company scope**. Vì thế số ở §5 khớp từng đồng với Pricing performance của Pricing tab (vd c1: `ABC Hanoi Negotiated $9,220 / −21.6% / 2 orders`, `Contractor Standard $4,380 / −16.7% / 1 order`).

- **A. Pricing health** — B2B price vs Shopify (resolved-vs-list trên B2B-priced lines) · Margin at order creation (`appliedEconomics(...).margin`, costed lines) · Orders using B2B pricing (%) · Order value below 20% margin (`exceptionValue`, lines có margin@creation < 20%).
- **B. Pricing adoption over time** — `LineChart` theo tháng, **có toggle Orders / Order value** (`adoptionMode`): *Orders* = % order có ≥1 B2B line; *Order value* = % **order value** thực sự đi qua B2B line (`b2bValue / totalValue`). Câu hỏi: company có thực sự transact qua pricing đã gán không — order-value view cho thấy bao nhiêu *value* thật sự chảy qua.
- **C. Pricing vs negotiation** — bridge Quotes↔Pricing: assigned (snapshot `refAtQuote`, §4 D) vs recent won quotes (within ±5% / 5–10% below / >10% below). Nếu liên tục negotiate thấp hơn assigned → surface evidence (không auto-recommend).
- **D. Pricing performance** — `pricingProfileRows(attributedLines, productBySku)` (cùng hàm với Pricing tab), group theo **named B2B pricing profile**: Order value / Margin / vs Shopify (resolved vs Shopify list) / Orders. Nhiều profile → table; 1 profile → single summary; không có → note. Không còn tự group thủ công theo `o.pricing`.
- **E. Quantity pricing effectiveness** — nếu company có quantity pricing (`tierEvents` cho company): Tier reach rate · Order value at reached tiers · Average tier discount (weighted pre-discount). Không có → *"No quantity pricing assigned"* (không render empty vô nghĩa).
- **F. Margin exceptions** — bảng line dưới ngưỡng 20% margin: Product · Order value · Margin · Pricing + CTA "View pricing →".

---

## 6. Cross-tab navigation

Overview là entry point. **Attention needed** click từng signal → tab tương ứng (stale quotes → Quotes, below-margin → Pricing, reorder gap → Buying). CTAs "View orders/quotes/pricing →" → nhảy sang tab thật của CompanyDetail (`SET_COMPANY_TAB`). Nút **"Compare with all companies"** (ở CompanyDetail, đổi tên từ "View advanced analytics") → màn Analytics global — nói rõ nó rời khỏi account view sang portfolio-wide.

→ 4 tab không đứng độc lập mà nối thành **một account story**.

---

## 7. Tóm tắt biến ↔ phần UI

| Biến chính | Phần |
|---|---|
| `curS`/`prevS` (n, rev, aov, prods), `salesDelta`/`ordersDelta`/`aovDelta`, `openQuoteValue`, `changedSentence` | Overview hero + contextual sentence |
| `typical`, `since`, `ratio`, `overdue`, `relState` | Relationship state / Buying rhythm |
| `attention[]` | Attention needed |
| `allEvents` | Recent activity / timeline |
| `salesSeries`, `prevS`/`curS`, `frequently`/`newInRecent`/`previouslyFrequent`, `curMix`/`prevMix` | Buying |
| `openQuotes`, `staleOpen`, `winRateCount`, `responseMedian`, `decisionMedian`, `varRows`/`avgVariance` | Quotes |
| `attributedLines` + `appliedEconomics`/`pricingProfileRows` (từ `pricingAttribution.js`), `vsShopify`, `marginAtCreation`, `adoptionOrders`/`adoptionValue`, `adoptionSeries` (+`adoptionMode`), `companyProfiles`, `exceptionLines`/`exceptionValue`, `tierEvents` | Pricing |

> **Demo caveat:** company ít lịch sử (vd c1 chỉ 4 completed orders) → "Previously frequent" / prev-window / basket có thể hiện `—`; logic handle empty gracefully. Company nhiều order sẽ đầy đủ hơn.
