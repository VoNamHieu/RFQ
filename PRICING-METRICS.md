# Pricing & Margin tab — blueprint & engine tính từng chỉ số

> Bản thiết kế cho tab **Pricing & Margin** của màn Analytics: mục đích từng phần, công thức mỗi chỉ số,
> taxonomy nguồn giá, và map sang production. Bám theo `src/b2b/screens/Analytics.jsx` — khối render `const pricingTab` (comment `// ── PRICING & MARGIN`) + các dẫn xuất `// ── pricing usage / realization` và `// ── quantity rules / pricing changes`. *(Trích dòng dùng anchor comment thay vì số dòng cứng — file đang được sửa liên tục.)*
> Xem thêm [[OVERVIEW-METRICS.md]] (engine chung: COGS/coverage, price-source taxonomy) ·
> [[COMPANIES-METRICS.md]] · [[QUOTES-METRICS.md]] (discount-band win rate §5.7) · [[ORDERS-METRICS.md]] · [[PRD-NOTES.md]] (§ pricing taxonomy).
>
> Cập nhật: 2026-09-14 · Nguồn: `src/b2b/screens/Analytics.jsx`

---

## 0. Mục đích & bố cục

**Câu hỏi tab trả lời:** *Điều khoản giá B2B có hợp lý & có lãi không? Bao nhiêu **order và order value** đang dùng B2B pricing (vs other pricing, tại lúc order được tạo), nhóm nào lãi hơn, giá bị sửa tay nhiều không, có bao nhiêu value dưới ngưỡng margin, pricing đang phủ được bao nhiêu, và quantity pricing hiệu quả đến đâu (reach rate)?*

Thứ tự các phần (`pricingTab`):
1. **Core economics** (§6.1) — 4 thẻ: B2B price vs Shopify (resolved) / Margin at order creation / Orders using B2B pricing (adoption) / Order value below margin threshold (+ selector ngưỡng margin).
2. **Baseline pricing footprint** (§6.2, MiniCompare) — 5 số nền về độ phủ pricing.
3. **Order value by pricing source** + **Margin by pricing source** (§6.3) — 2 cột (2 nhóm: B2B pricing / Other pricing).
4. **Pricing performance** (§6.4) — bảng theo từng pricing profile.
5. **Quantity pricing effectiveness** (§6.6) — reach rate / order value at tier / realized discount.
6. **Advanced pricing analysis** (§6.5, expander) — pricing-change before/after.

> **2 nhóm pricing (merchant-facing)** — dùng xuyên suốt tab (đã bỏ mô hình 3 nguồn cũ):
> - **B2B pricing** ← line dùng **Company / Location / app pricing** tại lúc order được tạo (`pricingSource ∈ {Company price, Location price, Previous agreement}`, không bị override). **Pricing từng sync từ quote vẫn là B2B pricing** một khi được áp lên line — `synced_from_quote` chỉ là **metadata origin nội bộ**, KHÔNG còn là dimension analytics.
> - **Other pricing** ← line **không** dùng B2B pricing lúc tạo: manual custom price (override / `Manual price`) hoặc Shopify default (`None`).

> ⚠️ **Attribution = SNAPSHOT LÚC ORDER ĐƯỢC TẠO, theo từng line.** Snapshot mỗi line mang **cả hai lớp**:
> - **resolved** (pricing-engine output, TRƯỚC override): `resolvedPricingSource`, `resolvedPricingId`, (prod) `resolvedUnitPrice` — B2B pricing **đã được resolve**, kể cả khi sau đó bị override.
> - **at-creation** (giá thực áp lúc tạo): `pricingSourceAtCreation`, `appliedUnitPriceAtCreation`, `quantityAtCreation`, `costAtCreation`, `wasPriceOverridden`.
>
> **Vì sao cần cả hai:** ví dụ B2B resolve $80, merchant override $85 → `resolvedPricingSource=B2B, resolvedUnitPrice=80` nhưng `pricingSourceAtCreation=Other, appliedUnitPriceAtCreation=85, wasPriceOverridden=true`. Nhờ đó **Provenance → Other pricing** (đúng: giá áp không phải B2B) mà **Manual price changes → đếm là B2B override** (đúng: biết $85 đã override pricing nào). Nếu chỉ lưu `pricingSourceAtCreation=Other` thì mất thông tin đã override B2B nào.
>
> - **Group/economics** dùng **at-creation** (line overridden → Other). Lớp **resolved** + `wasPriceOverridden` giữ để loại overridden line khỏi vs-Shopify + future-proof (Manual price changes đã bỏ khỏi merchant UI).
> - **Sales / GP / Margin by group/profile** = Σ **initial line value** (`appliedUnitPriceAtCreation × qty`) và Σ line GP — cộng **theo line**.
> - **`appliedUnitPriceAtCreation` = giá effective CÓ MẶT lúc tạo order** — discount đã tồn tại **trước** creation **được tính vào** (vd B2B $80, line discount 10% → applied $72). Chỉ adjustment **thêm sau creation** (discount/refund/price-edit/reversal) mới bị **ignore**. Muốn đo pure pricing-rule $80 thì đọc `resolvedUnitPrice` riêng.
> - **Decoupled với Net sales của Overview** (Net sales trừ discount/reversal realized; Pricing tab đo giá-tại-lúc-tạo). **Không ép reconcile** 2 con số này.
> - **Orders / Companies** = **distinct count** order/company có **≥ 1 line** thuộc group/profile (một order có thể ở cả 2 group).
> - **Line GP** = initial line value − `costAtCreation × qty`; thiếu cost → không costed (**coverage theo line**). **Margin** = Σ line GP / Σ **costed** initial value.
>
> ✅ **Đã implement trong `Analytics.jsx`:** `lineSnapshot` mang `resolvedLineValue` (engine, trước discount/override) lẫn `lineValue` (applied at creation); shared `attributedLines` (2 nhóm, dùng chung Overview + Pricing); `groupEcon` (§6.3), `pricingMap` theo line + `orderIds` distinct (§6.4). **§6.1 split rõ:** **B2B price vs Shopify** dùng `resolvedLineValue` (`b2bVsShopify*`) — discount/override KHÔNG lọt vào; **Margin at order creation** + **Order value** dùng `lineValue`; thẻ thứ 3 nay là **Orders using B2B pricing** (adoption). *(Metric Manual price changes đã bỏ khỏi merchant UI; `resolvedPricingId`/`resolvedUnitPrice`/`wasPriceOverridden` vẫn trong snapshot — future-proof.)* **Demo:** không có draft discount nên resolved == applied (metric giống nhau — dormant như coverage), nhưng cấu trúc đúng: hypothetical $80 B2B + 10% draft → vs-Shopify vẫn −20%, còn order value/margin phản ánh $72.

> 🔗 **Engine đã tách thành module dùng chung:** `lineSnapshot` / `buildAttributedLines` / `pricingProfileRows` / `appliedEconomics` nay nằm ở **`src/b2b/pricingAttribution.js`** (không còn inline trong `Analytics.jsx`). **Cùng một module** này được **Company Analytics** (`CompanyAnalytics.jsx`, tab Analytics trong Company detail — xem [[COMPANY-ANALYTICS.md]] §5) import lại: Company Analytics chỉ truyền `periodOrders` của riêng company vào `buildAttributedLines`, **không định nghĩa pricing engine riêng**, nên số Pricing performance / adoption / margin của nó khớp từng đồng với tab này. Snapshot semantics (resolved* / *AtCreation, group B2B/Other) do module giữ — hai màn không được lệch định nghĩa.

> 🧩 **Rule phức tạp thì define `resolvedUnitPrice` thế nào?** `resolvedUnitPrice` là **OUTPUT của engine cho line đó tại lúc tạo order**, KHÔNG phải bản thân rule. Dù rule có bao nhiêu logic (base theo priority + scope fallthrough, quantity tier, conditional rules, per-variant `variantAdjustments`, %/fixed), engine chạy ra **một** con số. `pricing.js` `priceForDetail` đã chứng minh: trả `{ price, layer, decidedBy }` (vd `{ price: 75, layer: 'rule', decidedBy: 'ABC Hanoi Negotiated · Rule 1' }`) → `resolvedUnitPrice = price`, `resolvedPricingId` = profile thắng, `decidedBy` = branch nào quyết.
> - **Analytics KHÔNG re-run engine** — đọc snapshot engine ghi lúc tạo. Replay sẽ sai (cần đúng qty/variant/condition tại thời điểm đó, và rule có thể đã sửa từ đó); snapshot đóng băng → historical bất biến.
> - **Quantity tier / variant khác nhau mỗi line** → mỗi line có `resolvedUnitPrice` riêng tại qty/variant của nó; aggregate **value-weighted** (`Σ resolvedUnitPrice×qty / Σ list×qty`) nên giá không đồng nhất vẫn cộng đúng, không giả định "một % duy nhất".
> - **Rule nào thắng** engine đã quyết (priority, first-price-wins) → attribution chỉ cần profile thắng + giá cuối.
> - **Cái duy nhất thực sự khó** = tách 1 giá resolved thành đóng góp của **nhiều rule stack** (base −10% rồi conditional −5%) → **pocket-price waterfall**, future ở §6.5, KHÔNG thuộc attribution. Nói gọn: **độ phức tạp nằm ở engine (upstream); snapshot chỉ ghi kết quả** → define được với rule bất kỳ.
> - **Nhiều rule khác SCOPE trong 1 profile** (vd Rule 1: collection A −10%, Rule 2: collection B −20%): giá là **per-product** — product ở A → −10%, ở B → −20% (mỗi line `resolvedUnitPrice` riêng). Product thuộc **cả A và B** → `matchConditionalRuleIndex` lấy **rule đầu tiên khớp theo thứ tự** (Rule 1 → −10%; first-match, KHÔNG phải rẻ nhất); `decidedBy` ghi "Rule 1". Product không thuộc scope nào → default của profile. **Row profile trong §6.4 = value-weighted blend** các line (A + B → vd −15%), KHÔNG phải một % của một rule. Muốn thấy **riêng từng rule** thì group theo `decidedBy` (`profile · Rule N`) thay vì `resolvedPricingId` — engine trả sẵn `decidedBy`; đây là lựa chọn granularity profile-level vs rule-level, chưa làm.

---

## 1. Nền tảng dữ liệu

| Khái niệm | Định nghĩa trong code |
|---|---|
| **`orders` (PERIOD)** | Completed orders (`status ∈ {Fulfilled, Paid}`) trong scope + trong kỳ. Nền của §6.1, §6.3, §6.4. |
| **COGS / GP / Margin** | `orderCogs(o)` = Σ `qty × product.cost`; thiếu cost → `null`. `gpStats(os)` tính GP/margin **chỉ trên phần đã costed**, kèm `coverage`. Chi tiết [[OVERVIEW-METRICS.md]] §0 (quy tắc coverage). |
| **Creation snapshot (per line)** | Đơn vị attribution cho §6.1–§6.4 (xem callout §0), 2 lớp: **resolved** (`resolvedPricingSource`, `resolvedPricingId`, prod `resolvedUnitPrice`) + **at-creation** (`pricingSourceAtCreation`, `appliedUnitPriceAtCreation`, `quantityAtCreation`, `costAtCreation`, `wasPriceOverridden`). Demo derive qua `lineSnapshot(o, it)` từ `o.pricingSource`/`o.pricing`/`it.revenue`/`it.overridden`/`product.cost`. |
| **Initial line value / line GP (at creation)** | `initial line value` = `appliedUnitPriceAtCreation × qty` = `line.revenue` trong demo — **giá effective lúc order tạo** (discount có sẵn **trước** creation đã được tính vào; chỉ adjustment sau creation bị bỏ). `line GP` = initial line value − `costAtCreation × qty` (`null` nếu thiếu cost → coverage theo line). |
| **resolved B2B reference (Shopify list)** | `resolvedB2BReference` = Σ `product.list × qty` **trên resolved-B2B lines có resolved price** — mốc đo **B2B price vs Shopify** (§6.1, so với `resolvedB2BValue`). Per-profile: `x.reference` vs `x.resolvedValue` trong `pricingMap`. |
| **resolved vs at-creation** | `resolvedIsB2B` = engine resolve B2B (kể cả sau bị override) — **data-model, future-proof** (từng dùng cho Manual price changes, nay bỏ). `isB2B` (at-creation) = resolved B2B **và** không override → dùng cho **group/economics** + loại overridden line khỏi vs-Shopify. Line override: `resolvedIsB2B=true`, `isB2B=false`. |
| **`overridden` / `wasPriceOverridden`** | Cờ trên line item (`analyticsOrderItems`): giá B2B đã resolved bị **sửa tay** trước khi order tạo. Map với custom line price của Shopify draft order. |
| **Quantity events** | `analyticsQuantityEvents` (stream demo) — `moq_blocked` (§6.6 MiniCompare) và `tier_observed` (§6.6 bảng), lọc `inPeriod` + company scope. |
| **Pricing changes** | `analyticsPricingChanges` (stream demo) — before/after một lần sửa rule. Chỉ lọc **company scope**, KHÔNG lọc kỳ (§6.5). |

> **Period vs snapshot:** §6.1 / §6.3 / §6.4 / §6.6 theo **kỳ** (`orders` / quantity events `inPeriod`). Nhưng §6.2 (Active agreements, Companies/Locations with pricing) là **config snapshot** (độ phủ pricing hiện tại, không theo kỳ) và §6.5 (pricing changes) cũng **snapshot** (chỉ company scope). Cùng nguyên tắc period-vs-snapshot ở [[OVERVIEW-METRICS.md]] §0.

---

## §6.1 — Core economics (ScoreGrid, 4 thẻ)

| Thẻ | Công thức | Biến |
|---|---|---|
| **B2B price vs Shopify** | `b2bVsShopifyDelta = resolvedB2BValue − resolvedB2BReference`; `Pct = delta / resolvedB2BReference × 100`. Dùng **`resolvedLineValue`** (giá pricing-engine, TRƯỚC draft discount/override) trên resolved-B2B lines — discount/override KHÔNG lọt vào (đánh giá chất lượng pricing rule). Foot `$X above/below Shopify on B2B-priced lines`. | `b2bVsShopifyDelta/Pct`, `resolvedB2BValue` |
| **Margin at order creation** | `appliedMargin = appliedGP / appliedCostedValue × 100`; `appliedGP` = Σ (initial line value − costAtCreation×qty) trên costed lines. Foot = `GP · Y% cost coverage` (`appliedMarginCoverage`) khi < 100%. **At-creation, KHÔNG phải realized** — realized margin ở Overview. | `appliedMargin`, `appliedGP`, `appliedMarginCoverage` |
| **Orders using B2B pricing** (adoption) | `b2bOrderShare = b2bOrderIds.size / orderCountAll × 100`; foot = `N of M orders`. Thay cho "Manual price changes" (đã bỏ khỏi merchant UI — flow hiện tại không cho nhập custom unit price trước khi tạo order → metric không meaningful). Data model `resolvedPricingId`/`resolvedUnitPrice`/`wasPriceOverridden` **vẫn giữ** trong snapshot (future-proof), chỉ không còn metric. | `b2bOrderShare`, `b2bOrderIds`, `orderCountAll` |
| **Order value below margin threshold** | `marginExceptionValue` = Σ **initial line value** của line có `lineMarginAtCreation < marginFloor`. Foot = `N lines below X% margin` **+ "· Based on Y% cost coverage"** khi < 100% (`marginCoverage`). Line thiếu cost bị **loại** → phải disclose. | `marginExceptionValue`, `marginExceptionLines`, `marginFloor`, `marginCoverage` |

- **§6.1 tách 2 basis (chốt hướng A):** **B2B price vs Shopify** dùng **resolvedUnitPrice** (chất lượng pricing rule — không để draft discount làm nhiễu); **Margin at order creation**, **Order value below margin threshold**, và §6.2–§6.4 order value/margin dùng **appliedUnitPriceAtCreation** (economics tại lúc tạo). Realized Net sales/GP (sau discount/refund) là việc của **Overview** — đừng so 1-1.
- **Margin threshold selector**: `marginThreshold` ∈ {15, 20, 25, 30}%, mặc định 20. `lineMarginAtCreation(s)` = `(initial line value − costAtCreation×qty) / initial line value × 100`; **thiếu cost → `null`** (không đếm là "dưới ngưỡng"; disclose coverage).
- **B2B price vs Shopify** so **resolved price** (engine output) vs Shopify list, chỉ trên B2B-priced lines — khác discount-band ở Quotes §5.7 (đó là giá *quoted* vs list).

---

## §6.2 — Baseline pricing footprint (MiniCompare, 5 số)

| Số | Công thức | Biến | Period? |
|---|---|---|---|
| **Active pricing agreements** | `#{policy \| status ≠ Inactive ∧ audienceType = 'b2b'}` | `activePolicyCount` | snapshot |
| **Companies with pricing** | `#{scopedCompany \| có base pricing hoặc quantity}` (`hasPricingFn`) | `companiesWithPricing` | snapshot |
| **Order value using B2B pricing** | Σ **initial line value** của các B2B-priced line (`b2bValue`); sub = `X% of order value` (`b2bValueShare` = b2bValue / `orderValueTotal`) | `b2bValue`, `b2bValueShare` | period, at-creation |

> **"Orders using B2B pricing" đã chuyển lên §6.1 hero** (adoption). §6.2 chỉ còn 4 số: 3 config-snapshot + Order value using B2B pricing (period).

- **"Order value" chứ không phải "Sales"** — cố ý: đây là Σ initial line value tại lúc tạo (snapshot), **không** reconcile với Overview Net sales (đã trừ discount/refund). "Sales" dễ khiến merchant đem so với Overview rồi hỏi vì sao lệch; "order value" nói đúng bản chất snapshot.
- **B2B pricing** = app resolve được (company/location) **hoặc** đến từ quote đã áp lên line — KHÔNG tính manual override / Shopify default. Cùng định nghĩa §0. *(Trước đây "Revenue/Orders on negotiated pricing" tính whole-order theo `influencedOrders` → phóng đại: 29,780 vs at-creation 24,520.)*

---

## §6.3 — Order value by pricing source + Margin by pricing source

### a) Order value by pricing source (StackedBar)

- Chia **Σ initial line value** theo group **của từng line** (2 nhóm), filter value > 0:
  - **B2B pricing** = Σ initial line value của line dùng Company/Location/app pricing (kể cả synced-from-quote) lúc tạo.
  - **Other pricing** = Σ initial line value của line manual/override/Shopify default.
- `b2bPricingValue` / `otherPricingValue` = `groupEcon.get(name).value` (cộng **initial line value** theo line qua `attributedLines`, line override → Other). `provenanceSegments` = 2 segment.

### b) Margin by pricing source (RankBars)

- Card **"Margin by pricing source"**, note: *"Margin based on the price used when the order was created. Later price changes and adjustments are excluded."*
- Mỗi group → `value = Σ initial line value`, `gp = Σ line GP` (costed lines), `margin = Σ line GP / Σ costed initial value`, `coverage`. `pricingSourceRows` (2 dòng) filter `value > 0`, sort giảm. Bar theo **margin** (`width = margin / pricingSourceMaxMargin × 100`); sub = **`$21,580 order value · $3,210 gross profit`** (KHÔNG dùng "sales"); valueLabel = `margin%` (`—` khi chưa costed).
- **Coverage từng group:** dưới mỗi bar, nếu `coverage = costedValue / revenue < 100%` → thêm **"· Y% cost coverage"**. So margin giữa các group mà **không** nói coverage sẽ gây hiểu nhầm — group coverage thấp dễ có margin "đẹp" giả tạo. 100% → ẩn.
- Trả lời: **B2B pricing hay other pricing lãi hơn** (tại giá lúc tạo order) — không chỉ nhóm nào doanh thu to.

---

## §6.4 — Pricing performance (bảng, sort theo Gross profit)

**Chỉ hiện named B2B pricing PROFILE** — **KHÔNG có row "Other pricing"**. Line không có profile (Other pricing, hoặc B2B không tên profile) bị loại khỏi bảng (`if (!s.pricingId) return`); chúng đã có ở §6.2 order value + §6.3 provenance, không phải "một pricing" để đánh giá ở đây. Chỉ **applied (non-overridden) lines** vào row profile.

Mỗi profile → **Order value = Σ initial line value** (`value`), **Gross profit = Σ line GP** (costed), **Margin = Σ line GP / Σ costed initial value**, **vs Shopify** = `(resolvedValue − reference)/reference`. **Orders** = `orderIds.size` (distinct); **Companies** = distinct. Sort theo Gross profit giảm dần (`null` xuống cuối).

> **vs Shopify = money total (value-weighted), KHÔNG phải trung bình các %:** `(Σ tiền các line dùng pricing này − Σ Shopify list của chính các line đó) / Σ Shopify list`. Cộng theo order (tổng items thuộc pricing đó) rồi gộp = cộng thẳng các line — line giá trị lớn nặng hơn, đúng bản chất "tổng $ đặt thấp/cao hơn Shopify". (Không tính trung bình đơn giản từng line %.)
>
> **vs Shopify khi profile có product bị override:** vs Shopify = **resolved B2B price của profile** vs Shopify list, tính trên **các line profile thực sự áp** (non-overridden). Một product bị **manual override KHÔNG** được đưa vào vs-Shopify của profile (giá cuối là giá tay, sẽ làm nhiễu tín hiệu chất-lượng-pricing-rule). *Ví dụ:* ABC Hanoi Negotiated có VLV-40 (#1044) bị override → vs Shopify = −21.6% (không tính VLV-40). *(Metric "Manual price changes" đã bỏ khỏi merchant UI — flow không cho custom unit price trước khi tạo order; nhưng `wasPriceOverridden` vẫn có trong snapshot để loại line khỏi vs-Shopify + future-proof.)* *(Production: có `resolvedUnitPrice` thì có thể fold overridden line vào vs-Shopify **tại resolved price** — vẫn không dùng giá override.)*

| Cột | Công thức (line-level, at-creation) |
|---|---|
| **Pricing** | Tên profile (`pricingId`). Chỉ named B2B profile. *(Cột **Source** đã bỏ — mọi row luôn là B2B pricing.)* |
| **Order value** | Σ initial line value (`value`) của applied line thuộc profile. *(Đổi tên từ "Sales" → không cố reconcile với Net sales ở Overview.)* |
| **Gross profit** | Σ line GP (costed) của applied line (`—` nếu không line nào costed). |
| **Margin** | Σ line GP / Σ costed initial value (`—` nếu chưa costed). |
| **vs Shopify** | `(resolvedValue − reference)/reference` — **resolved price** của profile vs Shopify list; overridden line bị loại (xem callout trên). |
| **Orders** | distinct order có ≥1 applied line thuộc profile (`orderIds.size`). |
| **Companies** | distinct company tương tự. |

---

## §6.6 — Quantity pricing effectiveness

> **Chốt scope (leader):** §6.6 CHỈ đo **hiệu quả quantity pricing** — có bao nhiêu cơ hội dùng tier → bao nhiêu thực sự đạt → order value đi qua tier → discount thực tế. **Đã cắt khỏi merchant-facing** 3 metric friction/potential/cohort: **MOQ-blocked demand**, **Near threshold**, **Later completed a purchase** (chúng đo demand/behavior, không đo tier có hiệu quả không). Data `moq_blocked` vẫn còn trong seed như **internal telemetry**, không surface. Bảng cũng **bỏ cột Near threshold**, thêm **Reach rate**.

Nguồn: `tierEvents` = `analyticsQuantityEvents` type `tier_observed`, lọc `inPeriod` + scope. `wDiscount(evs)` = value-weighted `Σ(realizedDiscount×orderValue)/Σ orderValue`.

### KPIs (MiniCompare, 3 số)

| Số | Công thức | Biến |
|---|---|---|
| **Tier reach rate** | `tierReached / tierEligible × 100`; sub = `N of M eligible purchases reached a tier`. **Metric effectiveness quan trọng nhất.** | `tierReachRate`, `tierReached`, `tierEligible` |
| **Order value at reached tiers** | Σ `orderValue` của các event **reached = true** (toàn scope). *(Đổi tên từ "Order value at quantity pricing" — chính xác hơn: chỉ cộng observations reached.)* | `tierOrderValue` |
| **Average tier discount** | `wDiscount(reached)` — value-weighted (pre-discount) trên các event reached. | `tierAvgDiscount` |

### Bảng `tierPolicies` (từ `tier_observed`, group theo `policy`)

| Cột | Công thức |
|---|---|
| **Quantity pricing** | tên tier/policy. |
| **Eligible purchases** | `#{observations}` — purchase có cơ hội đạt tier này. |
| **Reached tier** | `#{reached}` — số lần thực sự đạt tier. |
| **Reach rate** | `reached / eligible × 100` — mức độ tier được dùng thực sự (thay cho Near threshold). |
| **Order value at tier** | Σ `orderValue` của các lần reached. |
| **Tier discount** | `wDiscount(reached)` — value-weighted pre-discount (`—` nếu chưa lần nào reached). |

> Mọi cột §6.6 (KPI + bảng) đều có **tooltip hover** (gạch chân chấm). **Tier discount weighted theo PRE-DISCOUNT reference value** (KHÔNG phải post-discount order value): `Σ(discount% × referenceValue)/Σ referenceValue`, với `referenceValue = orderValue / (1 − discount)`. Lý do: đơn $1,000 giảm 20% phải có weight $1,000, không phải $800 — nếu weight bằng order value (đã trừ discount) thì đơn discount cao bị giảm weight, sai chiều economic impact. *(Demo: đổi từ 11.70% → 11.77%.)* Mental model sạch: *bao nhiêu cơ hội → bao nhiêu thực dùng → tạo bao nhiêu order value → discount bao nhiêu.* Không còn "buyer suýt đạt tier?", "MOQ chặn demand?", "sau này có quay lại mua?".
>
> **Verify (demo):** reach rate 50% (3 of 6), order value at quantity pricing $3,290, avg realized discount 11.7%; Pallet Breaks 4/2/50%/$2,170/10%, Filter Case Pricing 2/1/50%/$1,120/15%.

---

## §6.5 — Advanced pricing analysis (expander)

Subtitle cảnh báo: *"Temporal comparison, not causal attribution."* — so sánh theo thời gian, KHÔNG phải quy nhân quả.

- **Pricing change outcomes** (`ruleChanges` = `analyticsPricingChanges` lọc **company scope**, không lọc kỳ): mỗi dòng = 1 lần sửa rule → `Date` · `Scope` · `Rule change` (+ `change`) · **`Window`** (`±windowDays`d) · `Sales before / after` · `AOV before / after` · `Δ before / after` (`priceDelta` — chênh so với list).
- ⚠️ **Matched windows (bắt buộc):** `before` và `after` phải **cùng độ dài** (`windowDays`) — 30d trước vs 30d sau (hoặc N ngày trước vs cùng N ngày sau nếu change còn mới). Nếu before = 30d nhưng "since" = 90d thì Sales tăng **không nói lên gì** (chỉ do window dài hơn). Cột **Window** hiển thị exposure để rõ 2 vế cân nhau; đã đổi header "since" → "after". Trong seed `windowDays: 30`.
- **Basis = realized Net sales (exception có chủ đích của tab):** Sales/AOV before/after ở đây là **realized business outcome**, KHÁC basis at-creation của §6.1–§6.4. Card ghi thẳng *"Sales/AOV here are realized Net sales, intentionally a different basis from the at-creation metrics above."* — vì câu hỏi ở đây là "sau khi đổi pricing, business outcome đổi thế nào", không phải "engine output đổi thế nào".
- **Warning "Temporal comparison, not causal attribution" giữ nguyên** — matched window mới chỉ loại bias độ-dài-window, KHÔNG chứng minh nhân quả.
- **Chưa làm được** (ghi rõ trong card): pocket-price waterfall, pocket margin, price leakage — cần dữ liệu **pocket price** (freight/servicing concessions) mà hệ chưa capture.

---

## 2. Nguồn dữ liệu & map production

| Chỉ số | Nguồn demo | Map production |
|---|---|---|
| B2B price vs Shopify (§6.1) | `resolvedB2BValue − resolvedB2BReference` (resolved price, B2B-priced lines) | `resolvedUnitPrice` vs Shopify list snapshot — chỉ B2B-resolved lines; draft discount KHÔNG lọt |
| Profile vs Shopify (bảng §6.4) | `(resolvedValue − reference)/reference` per profile | `resolvedUnitPrice` của profile vs Shopify list (KHÔNG dùng applied) |
| Margin at order creation (§6.1) | line GP / costed initial value, **at-creation** | giá applied lúc tạo − `costAtCreation`; realized margin (Net sales − Net COGS, reverse theo return/cancel) là việc của Overview §3.1 |
| ~~Manual price changes~~ (đã bỏ merchant-facing) | cờ `wasPriceOverridden` trên snapshot | Data model giữ future-proof; production suy override = đơn giá line ≠ giá catalog gán — chỉ bật lại nếu flow cho custom unit price trước khi tạo order |
| Provenance / Margin by pricing source | Σ initial line value theo **group của từng line** (B2B pricing / Other pricing), at-creation | `pricingSourceAtCreation` của line lúc order tạo; 2 group merchant-facing |
| Order value / Orders using B2B pricing | `b2bValue` = Σ initial line value B2B lines; `b2bOrderIds` distinct of `orderCountAll` | line có `pricingSourceAtCreation` = B2B; đếm distinct order |
| Pricing performance | group theo `pricingId`; Σ initial line value/GP; Orders/Companies distinct | per-line price-list/agreement + creation snapshot |
| Active agreements / coverage | `policies` + `company.pricing` config | số price-list active + company/location được gán, current snapshot |
| Quantity pricing effectiveness | stream `analyticsQuantityEvents` (`tier_observed`) | tier reach rate + order value at tier + realized discount (value-weighted) từ order events. Friction/potential (`moq_blocked`, near, later-completed) đã cắt khỏi merchant-facing → internal telemetry. |
| Pricing change outcomes | stream `analyticsPricingChanges` | before/after quanh mốc sửa rule trên **matched windows** (`windowDays`, cùng exposure 2 vế); temporal, không causal |

### Ghi chú production
- **Attribution = snapshot line-level tại lúc order tạo, 2 nhóm (B2B pricing / Other pricing)** cho §6.2/§6.3/§6.4. Shared layer (`lineSnapshot`/`attributedLines`) dùng chung Overview + Pricing. Line `overridden` → Other; synced-from-quote → B2B. Cách cũ (whole-order, 3 nguồn) **phóng đại** nhóm "trội" của order — đã thay.
- **Pricing tab đo giá tại lúc tạo, decoupled với Net sales:** dùng `appliedUnitPriceAtCreation`/`costAtCreation`; discount/refund/price-edit/reversal **sau đó KHÔNG** đổi attribution hay margin-at-applied-price. Đừng ép "Order value using B2B pricing" reconcile với Net B2B sales của Overview (2 basis khác nhau) — xem callout §0.
- **GP/margin dùng coverage rule** — không fabricate; `—` khi chưa costed. Đồng bộ với Overview/Companies. Áp **theo line** (line thiếu cost → không costed, không kéo GP về null cho cả nhóm).
- **Disclose coverage ở mọi margin metric có loại line thiếu cost**: **Margin at order creation** (`appliedMarginCoverage`), **Order value below margin threshold** (`marginCoverage`), **Margin by pricing source** (coverage từng group) — đều hiện khi < 100%. Nguyên tắc: bất kỳ số margin/GP nào bỏ qua phần chưa costed đều phải nói rõ đang dựa trên bao nhiêu % sales — nếu không merchant tưởng đã kiểm tra toàn bộ.
- **Demo/test các disclosure & định nghĩa production bằng 2 nút dev** — xem mục **Dev test buttons** ngay dưới.
- **§6.2 là MIXED-BASIS** (KHÔNG phải toàn snapshot): *current snapshot* (không gate Date range) = **Active pricing agreements · Companies with pricing**; *selected period* (at-creation) = **Order value using B2B pricing** (§6.2) + **Orders using B2B pricing** (nay ở §6.1 hero). **§6.5**: pricing-change records **không** gate theo global date range.
- **"Manual price changes" đã bỏ khỏi merchant UI** (flow không cho custom unit price trước khi tạo order → metric không meaningful). Snapshot vẫn giữ `resolvedPricingId`/`resolvedUnitPrice`/`wasPriceOverridden` để future-proof.
- **Advanced** cố tình chỉ để before/after temporal + để trống pocket-price cho tới khi có dữ liệu — tránh gợi ý nhân quả sai.
- Discount-band / price-variance win-rate (§5.7) thuộc tab **Quotes** (đo giá *quoted* vs list/company), KHÔNG nằm ở tab này — xem [[QUOTES-METRICS.md]] §5.7.

---

## 2b. Dev test buttons (test cases)

Panel dev nằm **trên** thanh filter, chỉ hiện khi chạy `npm run dev` (gated `import.meta.env.DEV`) — **không** vào prod build. Đây là các **test case tay** để kiểm định định nghĩa production mà seed mặc định (không discount/return, đủ cost) không thể hiện ra:

| Nút | State / data | Case inject | Kiểm định điều gì |
|---|---|---|---|
| **Inject test data** | `devInject`, `EVENT_OVERLAY` | #1039 −$400 discount · #1033 SEA-30 return (−$1,250 sales / −$1,000 COGS) | Overview: Net sales = gross − discounts − reversals; Net COGS reverse theo return; Top products/GP theo event basis. **Pricing tab KHÔNG đổi** (at-creation basis) — chứng minh decoupling: Sales/Margin by pricing source giữ nguyên khi có discount/return sau tạo. |
| **Inject missing cost** | `devMissingCost`, `DEV_MISSING_COST_SKU = 'SEA-30'` | `productCost('SEA-30')` → `null` (line SEA-30 mất cost) | **Cost-coverage disclosure** sáng lên **đồng bộ**: **Margin at order creation**, **Order value below margin threshold** ("Based on ~83% cost coverage"), **Margin by pricing source** (coverage từng group) — cùng Hero Gross margin ở Overview. Xác nhận margin metric loại line thiếu cost đều disclose coverage. |

- Hai nút **độc lập**, bật/tắt riêng; có thể bật cả hai cùng lúc.
- Toggle qua `productCost` (nút missing-cost) là hàm trung tâm → ảnh hưởng **mọi tab** (Overview/Companies/Pricing), đúng ý "một nguồn sự thật cho cost".
- Reset: bấm lại chính nút đó (`Reset test data` / `Reset missing cost`).

> Đây là **test tay trong dev UI**, không phải unit test tự động — project hiện **chưa có test runner** (`package.json` chỉ có `dev`/`build`/`preview`). Nếu sau này thêm Vitest, các case trên là ứng viên đầu tiên để chuyển thành assertion: `synced-from-quote` (#1021) → B2B; line `overridden` (#1044 VLV-40, #1033 SEA-30) → Other; **Order value using B2B pricing bất biến** khi #1039 bị −$400 discount sau tạo; coverage disclosure hiện khi strip SEA-30.

---

## 3. Tóm tắt biến ↔ phần UI

| Biến chính | Phần |
|---|---|
| `b2bVsShopifyDelta/Pct`+`resolvedB2BValue` (resolved-price), `appliedMargin`/`appliedGP`/`appliedMarginCoverage`, `b2bOrderShare`/`b2bOrderIds`/`orderCountAll` (adoption), `marginExceptionValue`/`marginFloor`/`marginCoverage` | §6.1 Core economics |
| `activePolicyCount`, `companiesWithPricing`, `locationsCovered` (snapshot), `b2bValue`/`b2bValueShare` (period) | §6.2 Footprint |
| `lineSnapshot`/`attributedLines`, `B2B_SOURCES`, `groupEcon`, `b2bPricingValue`/`otherPricingValue`, `provenanceSegments`, `pricingSourceRows`, `pricingSourceMaxMargin` | §6.3 Provenance + margin by pricing source |
| `pricingMap`/`pricingUsage` (line-level at-creation, `orderIds` distinct) | §6.4 Pricing performance |
| `tierEvents`, `tierReachRate`/`tierReached`/`tierEligible`, `tierOrderValue`, `tierAvgDiscount`, `tierPolicies` (`reachRate`) | §6.6 Quantity pricing effectiveness |
| `ruleChanges` | §6.5 Advanced |
