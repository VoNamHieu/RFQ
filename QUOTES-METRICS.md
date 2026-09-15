# Quotes tab — blueprint & engine tính từng chỉ số

> Bản thiết kế cho tab **Quotes** của màn Analytics: mục đích từng phần, công thức mỗi chỉ số,
> phân bố trạng thái quote, và map sang production. Bám theo `src/b2b/screens/Analytics.jsx` (§5.x).
> Xem thêm [[OVERVIEW-METRICS.md]] (engine chung, snapshot vs period) · [[COMPANIES-METRICS.md]] · [[PRD-NOTES.md]] (funnel taxonomy).
>
> Cập nhật: 2026-09-14 · UI copy đồng bộ với code (headers + tooltips)

---

## 0. Mục đích & bố cục

**Câu hỏi tab trả lời:** *Pipeline báo giá đang có bao nhiêu tiền, đang kẹt ở đâu, tỷ lệ thắng bao nhiêu, mất bao lâu để phản hồi/chốt, và discount ảnh hưởng win-rate thế nào?*

**2 chế độ** (theo filter Company):
- **All companies** (`selected = null`): toàn portfolio + card **Advanced quote analysis**.
- **1 company** (`selected`): thêm card **Quote detail** (bảng quote thô của company).

Thứ tự các phần (all-companies mode):
1. **Hero KPIs** (§5.1) — 4 thẻ: Open quote value / Win rate by value / Stale quote value / First response time.
2. **Baseline strip** (§5.2, MiniCompare) — 6 số nền.
3. **Open quote aging** (§5.3) + **Quote status distribution** (§5.5) — 2 cột.
4. **Median time to decision** (§5.4).
5. **Advanced quote analysis** (§5.6/§5.7) — win-rate cuts (expander).

> **Trạng thái quote:** **Negotiating / Won / Lost / open** — §5.5 hiển thị **phân bố theo trạng thái hiện tại** (mỗi quote 1 lần), không phải funnel progression. Đã bỏ ý tưởng 5-stage + "Lost reasons" (xem [[PRD-NOTES.md]] §6).

---

## 1. Nền tảng dữ liệu

| Khái niệm | Định nghĩa trong code |
|---|---|
| **Nguồn** | `allQuotes = state.db.quotes`. Mỗi quote: `{ id, company, location, created, updated, status, progress, lines[{sku, quoted, qty}], timeline[{what, when}] }`. |
| **`quotes` (PERIOD)** | Quote **tạo trong kỳ** (`inPeriod(q.created)`) + trong scope company (+ location). Nền của hầu hết chỉ số. |
| **`openQuotes` (SNAPSHOT)** | `snapshotQuotes` (mọi quote của company, **bỏ cả date range lẫn location** — chỉ giữ Company scope) lọc `status ∉ {Deal Closed, Deal Rejected, Trashed}`. Là **current snapshot** — quote mở từ 5 tháng trước vẫn tính. |
| **Status** | `Deal Closed` = **Won** · `Deal Rejected` = **Lost** · `Negotiating` · `Trashed` (loại). |
| **Progress** | `Email Sent` / `PDF Exported` / `Draft Order Created` / `Auto Confirmed` — dùng để suy ra "đã priced/sent". |
| **`quoteVal(q)`** | `Σ (line.quoted × line.qty)` — **giá đã báo (negotiated)** × số lượng. |
| **`quoteListVal(q)`** | `Σ (Shopify list × qty)` — mốc để tính discount. |
| **`quoteAge(q)`** | Số ngày từ `updated \|\| created` đến TODAY. |

> **Period vs snapshot:** Hero **Open quote value** & **Stale quote value** và card **Aging** đều dựa trên `openQuotes` (**snapshot**, không lọc theo kỳ). Distribution / win-rate / decision / baseline dựa trên `quotes` (**period**, `created` trong kỳ). Giống nguyên tắc "Current open quote value" ở Overview §3.4b.

---

## §5.1 — Hero KPIs

| Thẻ | Công thức | Biến |
|---|---|---|
| **Open quote value** | `Σ quoteVal` trên **openQuotes** (snapshot). Footer = số quote đang mở. | `openQuoteValue`, `openQuotes.length` |
| **Win rate by value** | `wonValue / finalizedValue × 100`. Footer "$X won of $Y finalized". `null` khi chưa có quote finalized. | `winRateValue` |
| **Stale quote value** | `Σ quoteVal` của **openQuotes có `quoteAge > 10` ngày**. Footer = số quote idle >10 ngày. | `staleValue`, `staleQuotes.length` |
| **First response time** | **Median** thời gian `created → sự kiện "quote sent/priced" đầu tiên` (timeline), trên `pricedQuotes`. | `responseMedian` |

- `finalizedQuotes = wonQuotes + lostQuotes` (Won = `Deal Closed`, Lost = `Deal Rejected`), tính trên **period** `quotes`.
- `wonValue`/`finalizedValue` = `Σ quoteVal`.

---

## §5.2 — Baseline strip (MiniCompare)

| Số | Công thức | Biến |
|---|---|---|
| **Quotes created** | `quotes.length` (period). | `received` |
| **Total quoted value** | `Σ quoteVal` trên period quotes. | `quoteValueTotal` |
| **Won quotes** | `#{status = Deal Closed}` (period). | `wonQuotes.length` |
| **Lost quotes** | `#{status = Deal Rejected}` (period). | `lostQuotes.length` |
| **Average quote value** | `quoteValueTotal / received`. | `avgQuoteValue` |
| **Win rate by count** | `wonQuotes.length / finalizedQuotes.length × 100`. `null` khi chưa finalized. | `winRateCount` |

---

## §5.3 — Open quote aging (RankBars)

- Chia **openQuotes** (snapshot) theo `quoteAge`: `< 3d` / `3–7d` / `8–14d` / `15+d`.
- Mỗi bar: `value = Σ quoteVal` của bucket; **bar scale theo VALUE, không phải count** (`width = value / agingMaxVal`). `sub` = "N quotes still open".
- Ý nghĩa: giá trị quote **chưa chốt** đang già đi ở đâu — không phải đếm quote.
- (Tên card là "**Open quote aging**" — quote đã có activity nhưng chưa closed.)

---

## §5.4 — Median time to decision

- `decisionMedian` = **median** của `created → updated` (số ngày) trên **finalizedQuotes** (Won + Lost).
- **Median, không phải average** (nói rõ trong subtitle) — tránh outlier kéo lệch.
- Khác **First response time** (§5.1): response = tới lúc **báo giá lần đầu**; decision = tới lúc **chốt Won/Lost**.

---

## §5.5 — Quote status distribution (StackedBar)

- Chia **quotes tạo trong kỳ** theo **trạng thái hiện tại** — mỗi quote đếm **1 lần**, các segment cộng lại = 100% của RFQs. (`distSegments`).
- Segment = current status (Negotiating / Won / Lost / open).
- Toggle **Count | Value** (`quoteFunnelMode`): metric = số quote hoặc `Σ quoteVal`.

> ⚠️ **Đã đổi từ funnel → distribution:** trước đây là FunnelV2 cohort (stage **xa nhất đạt được**, RFQ received → Negotiating → Won + Lost); nay là **phân bố theo trạng thái hiện tại** (mỗi quote đúng 1 lần, sum 100%). Distribution là snapshot phân bố, KHÔNG phải conversion-to-date như funnel cũ.

---

## §5.6 / §5.7 — Advanced quote analysis (chỉ all-companies, expander)

Subtitle: *"Explore patterns associated with won and lost quotes. Small samples can be noisy, and these patterns do not prove cause and effect."* Mỗi cut luôn kèm **sample size**.

**Win rate by company** (`companyQuoteTable`, sort theo quoted value): mỗi company →
`Company` · `Quotes` (RFQs) · `Quoted value` (`Σ quoteVal`) · `Open quote value` (`Σ quoteVal` quote đang mở) · `Win rate (count)` = won/finalized · `Win rate (value)` = wonValue/finalizedValue · `First response time` (created → first sent).

### Win rate analysis (4 cut, grouping heading)

**a) Win rate by deal size** (`dealSizeBuckets`): `< $2k` / `$2k–$10k` / `$10k–$50k` / `$50k+` theo `quoteVal`; `rate = won / finalized` trong bucket (+ count).

**b) Win rate by discount** (`discountBuckets`): `0–5%` / `5–10%` / `10–15%` / `15%+` off theo `quoteDiscountPct(q)` = `(list − quoted) / list`; `rate = won / finalized` (+ count).
- **Average discount vs Shopify** = `avgDiscount` = `(Σ list×qty − Σ quoted×qty) / Σ list×qty`, **weighted theo quoted value · vs Shopify list** (clamp ≥ 0).

**c) Quoted price vs company pricing** (`varianceBuckets`): so giá quoted với **giá company đã gán** — `avgPriceVariance` = `(Σ quoted − Σ assigned) / Σ assigned`, **signed** (dương = quoted cao hơn). `rate = won / finalized` theo band.

**d) Win rate with vs without company pricing** (`winWithPricing` / `winWithoutPricing`): 2 nhóm — **Company pricing** (quote có giá company gán lúc quote) vs **Shopify price only** (chỉ Shopify làm mốc); mỗi nhóm `rate = won / finalized` (+ count).

---

## Quote detail (single-company mode)

Bảng quote thô của company đang chọn (`quoteDetailTable`): `Quote` · `Status` (badge: Won→success, Lost→critical) · `Age` (`quoteAge d`) · `Quoted value` (`quoteVal`). **Bỏ cột Location** — quote hiện chỉ có company scope.

---

## 6. Nguồn dữ liệu & map production

| Chỉ số | Nguồn demo | Map production |
|---|---|---|
| Quote value | `Σ line.quoted × qty` | Giá negotiated đã chốt trên quote/RFQ record |
| Win / Lost | `status ∈ {Deal Closed, Deal Rejected}` | Trạng thái terminal của quote trong app |
| First response time | timeline event "quote sent/priced" | Timestamp sự kiện báo giá đầu tiên |
| Time to decision | `created → updated` | `created → resolved` (Won/Lost) |
| Discount band / avg discount | `quoted` vs `product.list` | Giá quoted vs Shopify list price |
| Open / Stale quote value | `openQuotes` snapshot | Quote đang mở theo current state (không gate theo kỳ) |

### Ghi chú production
- **Distribution & baseline = quote tạo-trong-kỳ.** Distribution là **phân bố theo current status** (mỗi quote 1 lần, sum 100%) — snapshot, không phải conversion-to-date như funnel cũ. (Win-rate/decision cũng theo period `quotes`.)
- **Open quote value / Stale quote value = current snapshot** (bỏ date + location, chỉ Company scope) — cùng mental model với Overview "Current open quote value".
- **Win rate** nên báo **cả count và value** (đã có) — deal to/nhỏ có win-rate khác nhau, xem thêm §5.7 by deal size.
- Discount **vs Shopify list**, weighted theo value — không phải trung bình đơn giản của các %.

---

## 7. Tóm tắt biến ↔ phần UI

| Biến chính | Phần |
|---|---|
| `openQuoteValue`, `winRateValue`, `wonValue`, `finalizedValue`, `staleValue`, `responseMedian` | §5.1 Hero |
| `received`, `quoteValueTotal`, `wonQuotes`, `lostQuotes`, `avgQuoteValue`, `winRateCount` | §5.2 Baseline |
| `agingBuckets`, `agingMaxVal` | §5.3 Aging |
| `decisionMedian` | §5.4 Decision |
| `distSegments`, `quoteFunnelMode` | §5.5 Quote status distribution |
| `companyQuoteTable`, `dealSizeBuckets`, `discountBuckets`, `avgDiscount` | §5.6/§5.7 Advanced |
| `quoteDetailTable` | Quote detail (selected) |
