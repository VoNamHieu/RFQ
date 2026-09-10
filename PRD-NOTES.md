# QuoteSnap B2B — Ghi chú thay đổi (dữ liệu cho PRD)

> File này ghi lại các quyết định về **định nghĩa metric, taxonomy và data model** trong quá trình
> build lại màn **Analytics** và tinh chỉnh thuật ngữ pricing. Dùng làm nguyên liệu viết PRD.
> Nhãn UI (label/metric name) để nguyên tiếng Anh đúng như hiển thị trong app.
> Chi tiết **công thức tính từng chỉ số ở tab Overview** xem file riêng: `OVERVIEW-METRICS.md`.
>
> Cập nhật lần cuối: 2026-09-10 · Branch: `react-migration` · Stack: Vite + React + @shopify/polaris

---

## 1. Analytics — cấu trúc tổng thể

- Màn **Analytics** gồm 4 tab: **Overview**, **Companies**, **Quotes**, **Pricing & Margin**. Không có tab Orders.
- Toàn bộ dựa trên Polaris (component custom: ScoreGrid, ReportCard, RankBars, StackedBar, LineChart, FunnelV2, InsightCard...).
- File chính: `src/b2b/screens/Analytics.jsx`. Data demo: `src/b2b/data/db.js`, `src/b2b/data/analytics.js`.

## 2. Nguyên tắc dữ liệu (áp dụng toàn màn)

- **Date filter theo ngày** (day-based). Previous period = khoảng có **cùng độ dài** ngay liền trước kỳ đang chọn.
- Phân biệt hai loại chỉ số:
  - **Period metrics** — lọc theo kỳ đang chọn (`inPeriod`).
  - **Snapshot metrics** — all-time, chỉ tôn trọng filter company/location (không lọc theo ngày). Ví dụ: quan hệ khách hàng, reorder health.
- **Gross profit / Gross margin** dùng **COGS từ product cost** — công thức chi tiết xem `OVERVIEW-METRICS.md`:
  - Nguồn thật: Shopify Admin API `InventoryItem.unitCost` (cost per unit). → Trong demo mỗi product có field `cost`.
  - `orderCogs` = Σ (qty × cost) theo từng line. **Thiếu cost → COGS/GP/Margin = `null` (KHÔNG ước lượng).** *(Đã bỏ fallback 0.68 — với metric tài chính, "không biết" tốt hơn số giả trông như thật.)*
  - GP/Margin tính trên **phần sales đã costed** (`gpStats`), kèm **cost coverage %** hiện ở footer khi < 100%. GP = costed sales − COGS; Margin = GP / costed sales.

## 3. Price source taxonomy (tab Pricing)

Mỗi order/line được quy về **3 nguồn giá** (đã chốt sau vài vòng chỉnh):

Phân biệt theo **nguồn gốc của pricing** (không phải "cách checkout"). Cả hai loại B2B pricing đều là pricing tái dùng, chỉ khác được tạo ra từ đâu:

| Nguồn (label UI) | Định nghĩa | Map từ `pricingSource` (data) |
|---|---|---|
| **Price created on B2B** | B2B pricing được **tạo trực tiếp trong app** (rule company / location / catalog gán cho buyer). | `Company price`, `Location price` |
| **Price synced from quotes** | B2B pricing có **nguồn gốc từ một quote/RFQ được accept**, sync vào app rồi áp lên order. | `Previous agreement` |
| **Other price** | Giá **không được tạo trên B2B, cũng không sync từ quote** — ví dụ Shopify default list price, hoặc giá keyed tay trên draft order. | phần còn lại (`Manual price`, `None`, `Shopify price`, undefined...) |

**Quyết định thuật ngữ (terminology):**
- `Company pricing` → **B2B app's pricing** → nay đổi thành **Price created on B2B**.
- `Previous agreement` / `Negotiated quote` → **Quoted pricing** → nay đổi thành **Price synced from quotes**.
- **Đã bỏ** category **Default Shopify price** — gộp vào **Other price**.
- Location pricing **chưa tách riêng** khỏi company (chưa có tầng location độc lập) → `Location price` gộp vào **Price created on B2B**.
- **Raw quote price** (giá còn nằm trên quote, **chưa** sync thành B2B pricing) **không đưa vào Pricing performance** — Pricing performance chỉ chứa các pricing (profile) đã tồn tại trong app. Chỉ khi quote đã sync thành pricing thì mới xuất hiện, dưới nhãn **Price synced from quotes**. Ví dụ: order #1021 dùng profile `Standard Wholesale` (sync từ quote) → đọc là "Standard Wholesale · Price synced from quotes".

**Nơi taxonomy hiển thị:** card **Pricing provenance** (StackedBar theo doanh thu), card **Margin by price source** (RankBars theo gross margin), và cột **Source** trong bảng **Pricing performance**.

## 4. Định nghĩa các metric (tab Pricing)

- **vs Shopify** (trước tên là "Realized delta"): giá thực thu so với **list price của Shopify**. Hiển thị `X% lower` / `X% higher`. Công thức: (revenue − reference)/reference, reference = Σ (Shopify list × qty).
- **Manual price changes** (trước tên là "Differs from assigned"): **ghi nhận line có giá bị thay đổi tay khi tạo draft order**, đè lên mức giá mà pricing đã gán cho company/location.
  - Chỉ tính trên **B2B lines (eligible)** — line thuộc order có nguồn `Company/Location price` hoặc `Previous agreement`. Line **Other price** không có "assigned pricing" nên **không** vào mẫu số (hiển thị `—`).
  - Rate = overridden lines / eligible lines. Per-profile: gom theo pricing profile.
  - Data: cờ `overridden: true` trên line item (map với custom line price của Shopify draft order). Production sẽ suy ra bằng cách so **đơn giá thực tế của line ≠ giá catalog/price-list gán**.
  - Khác với **vs Shopify**: "vs Shopify" so với list price; "Manual price changes" so với **giá app đáng lẽ tính ra**.
- **Revenue on negotiated pricing / Orders on negotiated pricing**: chỉ đếm **Price created on B2B + Price synced from quotes** (không tính Other/manual/Shopify default).
- **Sales below margin threshold**: số line có margin dưới ngưỡng cấu hình được (mặc định 30%, có control chỉnh), là exception chứ không phải trung bình.

## 5. Data model đã thêm cho demo (map sang Shopify khi lên production)

- `product.cost` cho 6 sản phẩm (map `InventoryItem.unitCost`): FIL-XL 62, FIL-STD 44, SEA-30 5, HOS-12 104, VLV-40 33, MCFC 880.
- Line item field `overridden: true` — đánh dấu giá bị sửa tay (drive **Manual price changes**). Hiện gắn ở 3 line: #1044 (VLV-40), #1017 (HOS-12), #1033 (SEA-30).
- `order.pricingSource` các giá trị: `Company price`, `Location price` (→ **Price created on B2B**); `Previous agreement` (→ **Price synced from quotes**); `Manual price`, `None`, `Shopify price` (→ **Other price**).
- **Seed order minh hoạ Other price**: #1055 — giá custom keyed tay trên draft order (HOS-12 $130 vs $145 list), gắn vào Vinh Phat Trading để không phá tín hiệu reorder-cycle của ABC Construction.

## 6. Chỉ số Overview / Companies / Quotes (tóm tắt định nghĩa)

- **Overview**: Net B2B sales, Gross profit, Gross margin, Active companies, Repeat revenue + hàng phụ (Orders, AOV, Units sold, New buying companies). Card **Needs attention** gom các tín hiệu kèm bối cảnh tài chính (reorder cycle → hero là **số company**, current open quote value...).
- **Companies** (nhãn tab; tab id nội bộ vẫn là `accounts`): tách **lifecycle** khỏi **relationship health**. Health model **5 trạng thái**: Healthy (≤1.25× median interval) / Watch (≤1.5×) / At risk (≤2×) / Inactive (>2×) / Insufficient history (cần ≥4 order, ≥3 interval). Reorder ratio = days-since-last-order / median-interval.
- **Quotes**: funnel **3 trạng thái** khớp app quote hiện tại — **RFQ received → Negotiating → Won**, cộng nhánh **Lost** (terminal). (Đã bỏ ý tưởng 5-stage và bỏ "Lost reasons".)

## 7. Nguồn dữ liệu cần Shopify API (khi lên production)

- **COGS / cost**: `InventoryItem.unitCost`.
- **Receivables / Overdue cash** (đang tạm hoãn): `Order.totalOutstandingSet`, `Order.paymentTerms` → `PaymentTerms.overdue / dueInDays / paymentSchedules` → `PaymentSchedule.dueAt / completedAt / balanceDue`.
- **Manual price change**: so line-item custom price với giá catalog/price-list resolve.

## 8. Các thay đổi UI khác trong session (không thuộc Analytics)

- Add-company wizard: segmented stepper, radio + avatar company list, bỏ Cancel ở step 2/3, modal nhỏ lại.
- Base pricing: multi-select dùng chung Combobox dropdown (`PricingCombobox`), create từng cái một; committed list rút gọn.
- Quantity pricing: chuyển thành empty state có action Add rõ ràng.
- Product search modal: theo cấu trúc modal search của Shopify (search + sort), dùng chung `ProductPriceTable` cho các preview price.
- Custom item modal (kiểu draft order của Shopify).
- Active dates: thêm field **End time**.
- Pricing engine: clamp discount > base price về 0 (không âm). Variant-level pricing (`variantAdjustments` keyed theo variantId).
