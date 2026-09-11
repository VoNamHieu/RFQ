# Quotes tab — blueprint & engine tính từng chỉ số

> Bản thiết kế cho tab **Quotes** của màn Analytics: mục đích từng phần, công thức mỗi chỉ số,
> mô hình funnel, và map sang production. Bám theo `src/b2b/screens/Analytics.jsx` (§5.x).
> Xem thêm [[OVERVIEW-METRICS.md]] (engine chung, snapshot vs period) · [[COMPANIES-METRICS.md]] · [[PRD-NOTES.md]] (funnel taxonomy).
>
> Cập nhật: 2026-09-11 · Branch: `wip/analytics`

---

## 0. Mục đích & bố cục

**Câu hỏi tab trả lời:** *Pipeline báo giá đang có bao nhiêu tiền, đang kẹt ở đâu, tỷ lệ thắng bao nhiêu, mất bao lâu để phản hồi/chốt, và discount ảnh hưởng win-rate thế nào?*

**2 chế độ** (theo filter Company):
- **All companies** (`selected = null`): toàn portfolio + card **Advanced pipeline analysis**.
- **1 company** (`selected`): thêm card **Quote detail** (bảng quote thô của company).

Thứ tự các phần (all-companies mode):
1. **Hero KPIs** (§5.1) — 4 thẻ: Open pipeline / Win rate by value / Stale pipeline / First response.
2. **Baseline strip** (§5.2, MiniCompare) — 6 số nền.
3. **Didn't close quote aging** (§5.3) + **Pipeline funnel** (§5.5) — 2 cột.
4. **Median time to decision** (§5.4).
5. **Advanced pipeline analysis** (§5.6/§5.7) — win-rate cuts (expander).

> **Funnel app quote chỉ 3 trạng thái:** **RFQ received → Negotiating → Won**, cộng nhánh **Lost** (terminal, không nằm dưới Won). Đã bỏ ý tưởng 5-stage + "Lost reasons" (xem [[PRD-NOTES.md]] §6).

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

> **Period vs snapshot:** Hero **Open pipeline** & **Stale pipeline** và card **Aging** đều dựa trên `openQuotes` (**snapshot**, không lọc theo kỳ). Funnel / win-rate / decision / baseline dựa trên `quotes` (**period**, `created` trong kỳ). Giống nguyên tắc "Current open quote value" ở Overview §3.4b.

---

## §5.1 — Hero KPIs

| Thẻ | Công thức | Biến |
|---|---|---|
| **Open pipeline** | `Σ quoteVal` trên **openQuotes** (snapshot). Footer = số quote đang mở. | `openQuoteValue`, `openQuotes.length` |
| **Win rate by value** | `wonValue / finalizedValue × 100`. Footer "$X won of $Y finalized". `null` khi chưa có quote finalized. | `winRateValue` |
| **Stale pipeline** | `Σ quoteVal` của **openQuotes có `quoteAge > 10` ngày**. Footer = số quote idle >10 ngày. | `staleValue`, `staleQuotes.length` |
| **First response** | **Median** thời gian `created → sự kiện "quote sent/priced" đầu tiên` (timeline), trên `pricedQuotes`. | `responseMedian` |

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

## §5.3 — Didn't close quote aging (RankBars)

- Chia **openQuotes** (snapshot) theo `quoteAge`: `< 3d` / `3–7d` / `8–14d` / `15+d`.
- Mỗi bar: `value = Σ quoteVal` của bucket; **bar scale theo VALUE, không phải count** (`width = value / agingMaxVal`). `sub` = "N quotes still open".
- Ý nghĩa: giá trị quote **chưa chốt** đang già đi ở đâu — không phải đếm quote.
- (Tên card là "**Didn't close quote aging**" — quote đã có activity nhưng chưa closed.)

---

## §5.4 — Median time to decision

- `decisionMedian` = **median** của `created → updated` (số ngày) trên **finalizedQuotes** (Won + Lost).
- **Median, không phải average** (nói rõ trong subtitle) — tránh outlier kéo lệch.
- Khác **First response** (§5.1): response = tới lúc **báo giá lần đầu**; decision = tới lúc **chốt Won/Lost**.

---

## §5.5 — Pipeline funnel (cohort, FunnelV2)

- **Cohort** = quote **tạo trong kỳ**, track tới **stage xa nhất đạt được** (không phải "đang đứng ở stage nào").
- 4 dòng: **RFQ received** (`quotes`) → **Negotiating** (`Negotiating` + `Deal Closed`) → **Won** (`Deal Closed`); + **Lost** (`Deal Rejected`, terminal — hiển thị là % của RFQs, không phải downstream của Won).
- Toggle **Count | Value** (`quoteFunnelMode`): metric = số quote hoặc `Σ quoteVal`.
- Mỗi stage hiển thị: `metric · X% of RFQs`, note `Y% from prior` (Lost note = `% of RFQs · lost`).

> ⚠️ **Cohort semantics (như activation §4.8 [[COMPANIES-METRICS.md]]):** đếm cohort tạo-trong-kỳ đã đi xa tới đâu tính đến hiện tại → mở lại kỳ cũ về sau, số Won/Negotiating có thể tăng khi quote tiếp tục chuyển stage. Là conversion-to-date, không phải "activity trong kỳ".

---

## §5.6 / §5.7 — Advanced pipeline analysis (chỉ all-companies, expander)

Subtitle cảnh báo: *"always read with the sample size; correlation is not causation."* Mỗi cut luôn kèm **sample size**.

**a) Win rate by company** (`companyQuoteTable`, sort theo quoted value): mỗi company →
`RFQs` · `Quoted value` (`Σ quoteVal`) · `Open value` (`Σ quoteVal` quote đang mở) · `Win (count)` = won/finalized · `Win (value)` = wonValue/finalizedValue · `Median response` (created → first sent).

**b) Win rate by deal size** (`dealSizeBuckets`): `< $2k` / `$2k–$10k` / `$10k–$50k` / `$50k+` theo `quoteVal`; `rate = won / finalized` trong bucket (+ count).

**c) Win rate by discount band** (`discountBuckets`): `0–5%` / `5–10%` / `10–15%` / `15%+` off theo `quoteDiscountPct(q)` = `(list − quoted) / list`; `rate = won / finalized` (+ count).
- **Average discount given** = `avgDiscount` = `(Σ list×qty − Σ quoted×qty) / Σ list×qty`, **weighted theo quoted value · vs Shopify list** (clamp ≥ 0).

---

## Quote detail (single-company mode)

Bảng quote thô của company đang chọn (`quoteDetailTable`): `Quote id` · `Location` · `Status` (badge: Won→success, Lost→critical) · `Age` (`quoteAge d`) · `Quoted value` (`quoteVal`).

---

## 6. Nguồn dữ liệu & map production

| Chỉ số | Nguồn demo | Map production |
|---|---|---|
| Quote value | `Σ line.quoted × qty` | Giá negotiated đã chốt trên quote/RFQ record |
| Win / Lost | `status ∈ {Deal Closed, Deal Rejected}` | Trạng thái terminal của quote trong app |
| First response / Median response | timeline event "quote sent/priced" | Timestamp sự kiện báo giá đầu tiên |
| Time to decision | `created → updated` | `created → resolved` (Won/Lost) |
| Discount band / avg discount | `quoted` vs `product.list` | Giá quoted vs Shopify list price |
| Open / Stale pipeline | `openQuotes` snapshot | Quote đang mở theo current state (không gate theo kỳ) |

### Ghi chú production
- **Funnel & baseline = cohort tạo-trong-kỳ**, conversion-to-date (mutable) — như activation funnel. Nếu cần report bất biến thì gate stage-transition ≤ `rangeEnd` (đổi logic).
- **Open pipeline / Stale pipeline = current snapshot** (bỏ date + location, chỉ Company scope) — cùng mental model với Overview "Current open quote value".
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
| `funnelSource`, `funnelV2Stages`, `quoteFunnelMode`, `stageValue` | §5.5 Funnel |
| `companyQuoteTable`, `dealSizeBuckets`, `discountBuckets`, `avgDiscount` | §5.6/§5.7 Advanced |
| `quoteDetailTable` | Quote detail (selected) |
