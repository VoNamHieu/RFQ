# Companies tab — blueprint & engine tính từng chỉ số

> Tài liệu này là **bản thiết kế (blueprint)** cho tab **Companies** của màn Analytics:
> mục đích từng phần, cách tính mỗi chỉ số (công thức + biến), mô hình trạng thái, và map sang Shopify.
> Bám theo `src/b2b/screens/Analytics.jsx` (tab id nội bộ vẫn là `accounts`).
> Xem thêm [[OVERVIEW-METRICS.md]] cho engine chung & định nghĩa Net sales; [[PRD-NOTES.md]] cho taxonomy.
>
> Cập nhật: 2026-09-11 · Branch: `wip/analytics`

---

## 0. Mục đích & bố cục

**Câu hỏi tab trả lời:** *Danh mục company đang khoẻ hay yếu, ai đang tuột khỏi nhịp mua, doanh thu đến từ khách mới hay khách cũ, và pipeline kích hoạt company đang chảy ra sao?*

Tab có **2 chế độ hiển thị**, quyết định bởi filter Company:
- **All companies** (`selected = null`): so sánh giữa các company.
- **1 company đã chọn** (`selected = company`): drill-down xuống **location** của company đó (mọi "company" thành "location").

Thứ tự các phần (all-companies mode):
1. **Score cards** (§4.1) — 4 KPI tóm tắt danh mục.
2. **Companies past their buying cycle** (§4.4) — exposure card (chỉ khi có company quá hạn).
3. **Relationship state** (§4.2) + **New vs existing revenue** (§4.6) — **cùng 1 hàng, 2 cột** (`InlineGrid md:2`). *(Company contribution §4.5 đã bỏ — share nằm trong bảng §4.7.)* Khi chọn 1 company → thay bằng **Location performance** full-width.
4. **Company performance** (§4.7) — bảng chính, có filter/sort + full-screen Expand.
5. **B2B activation** (§4.8) — funnel đăng ký → duyệt → mua lần đầu.

> **Hai khái niệm TÁCH BIỆT — đừng gộp:**
> - **Lifecycle** (§4.3): company đang ở giai đoạn nào của vòng đời (chưa mua / mới kích hoạt / đã ổn định). Dựa trên **tuổi của lần mua đầu**. *(Nhãn dùng riêng, không trùng chữ với cohort §4.6 — xem callout ở §4.3.)*
> - **Relationship state / health** (§4.2): company có đang mua **đúng nhịp của chính nó** không. Dựa trên **reorder ratio**.
> Một company "Established" (mua lâu rồi) vẫn có thể "At risk" (đang trễ nhịp). Hai trục độc lập.

---

## 1. Nền tảng dữ liệu (kế thừa §0 của Overview)

| Khái niệm | Định nghĩa trong code |
|---|---|
| **Scope** | `scopedCompanies` — lọc theo filter Company (+ Location). |
| **Completed order** | `status ∈ {Fulfilled, Paid}` (`COMPLETED`). |
| **Period rows** | `companyRows` — mỗi company tính trên **completed orders trong kỳ & scope**. Đây là nguồn cho Sales/GP/Growth/AOV/Repeat. |
| **Snapshot rows** | `healthRows` — trạng thái quan hệ tính trên **toàn bộ lịch sử order** của company (all-time), **không lọc theo kỳ**. |
| **Bảng chính = period + snapshot** | `companyTableRows` = ghép `companyRows` (kỳ) với `healthRows` (all-time) theo `id`. Cột Sales/GP là **của kỳ**; cột Status/Typical/Last order là **snapshot**. |
| **Coverage-aware GP** | Mọi Gross profit / Margin dùng `gpStats(os)` — chỉ tính trên phần sales đã có cost, kèm `coverage`. Xem §0 [[OVERVIEW-METRICS.md]]. |

---

## §4.1 — Score cards (ScoreGrid)

**All companies mode** (`companiesScores`):

| Thẻ | Công thức | Biến |
|---|---|---|
| **Companies** | Tổng số company đang quản lý. | `managedCount = companies.length` |
| **Active** | Số `companyId` khác nhau có completed order **trong kỳ**. | `activeCompanyIds.size` |
| **New** | Số company có **first completed order rơi vào kỳ**. | `newCompanyIds.size` |
| **Past buying cycle** | Số company đang trễ nhịp (Watch/At risk/Inactive). **Footer chỉ mô tả ("behind their usual reorder cadence") — KHÔNG show GP.** | `pastCycleCompanies.length` |

> **Vì sao score card không show GP:** GP kèm cost coverage là trách nhiệm của **exposure card §4.4** ("Based on X% cost coverage"). Nếu score card cũng show `$GP` mà không kèm coverage → cùng một số ở một nơi disclose độ tin cậy, một nơi không. Chọn: **score card chỉ count**, GP+coverage dồn về §4.4 (tránh duplicate + tránh GP thiếu coverage).

**Single-company mode** (đổi 4 thẻ thành cấp location):

| Thẻ | Công thức | Biến |
|---|---|---|
| **Company sales** | `Σ o.amount` completed trong kỳ của company. | `sales` |
| **Active locations** | `X / Y` — location có completed order trong kỳ / tổng location. | `activeLocations` / `selected.locations.length` |
| **Repeat revenue** | `repeatShare%` + số tiền `repeatRevenue`. | `repeatShare`, `repeatRevenue` |
| **Relationship health** | Nhãn health của company + footer `X.X× reorder ratio` (hoặc "not enough order history"). | `healthOf(selected.id)` |

> ⚠️ **Production — "Active" định nghĩa theo PURCHASE, không phải mọi sale event.** Active companies / Active locations = **có ≥1 B2B purchase/order trong kỳ**. KHÔNG hiểu là "có sales event" — một company chỉ có refund/reversal trong kỳ **không** được tính Active. (Cùng nguyên tắc với Relationship health §4.2: revenue accounting dùng toàn bộ sales events, còn activity/cadence dùng purchase events.) Demo hiện dùng completed order nên chưa lệch; note này chỉ để production sạch semantics.

---

## §4.2 — Relationship state (mô hình health 5 trạng thái)

**Ý tưởng:** so **thời gian kể từ order gần nhất** với **nhịp mua điển hình của chính company** — không phải một điểm số 0–100 mờ nghĩa, mà là trạng thái **giải thích được**.

**Bước tính (`companyCadence` → `healthRows`):**
1. Lấy completed orders của company, sort theo ngày.
2. `gaps` = khoảng cách ngày giữa các order liên tiếp (>0), sort tăng.
3. `typical` (median interval) = **median của gaps, chỉ khi có ≥3 interval** (tức ≥4 order); chưa đủ → `null`.
4. `since` = số ngày kể từ order gần nhất (`daysAgo(last)`).
5. `ratio = since / typical`.

| Trạng thái | Điều kiện | Ý nghĩa | Tone |
|---|---|---|---|
| **Healthy** | `ratio ≤ 1.25` | đang mua đúng/nhanh hơn nhịp | success |
| **Watch** | `ratio ≤ 1.5` | bắt đầu chậm | attention |
| **At risk** | `ratio ≤ 2` | trễ đáng kể | warning |
| **Inactive** | `ratio > 2` | quá gấp đôi nhịp | critical |
| **Insufficient history** | `typical == null` hoặc `since == null` | chưa đủ ≥4 order để kết luận | — |

- `overdue = max(0, since − typical)` — số ngày trễ so với nhịp.
- **Thanh phân bố** (`healthCounts`): mỗi segment rộng theo `count / healthTotal`. **Click segment** → `setHealthFilter` lọc bảng Company performance theo trạng thái đó.
- Sort mặc định của bảng ưu tiên: **At risk → Inactive → Watch → Healthy → Insufficient history** (`HEALTH_ORDER`), rồi all-time sales giảm dần.

> **Đây là current-snapshot metric, tính lại theo TODAY (không forecast).** `since` đo tới **thời điểm hiện tại**, nên **dù không có order mới, ratio vẫn tăng theo từng ngày** và health tự trôi Healthy → Watch → At risk → Inactive. *Ví dụ* typical = 30 ngày: ngày 30 → 1.0× Healthy · ngày 40 → 1.33× Watch · ngày 50 → 1.67× At risk · ngày 70 → 2.33× Inactive. App **không** dự báo "company sẽ churn sau X ngày" — chỉ so trạng thái hiện tại với pattern lịch sử. Vì thế `healthRows` là **snapshot all-time**, không lọc theo period (§1).

---

## §4.3 — Lifecycle

Tính trong `healthRows` từ tuổi lần mua đầu (`firstAge = daysAgo(r.first)`):

| Lifecycle | Điều kiện |
|---|---|
| **No purchase** | `orders === 0` |
| **Recently activated** | có order **và** `firstAge ≤ 90` ngày |
| **Established** | `firstAge > 90` ngày |

Dùng cho filter **Lifecycle** trên bảng (`countLifecycle`). Độc lập với health (§4.2).

> ⚠️ **Taxonomy — cố ý KHÁC chữ với §4.6:** Lifecycle nói về **tuổi kể từ lần mua đầu** ("Recently activated" ≤90 ngày / "Established" >90 ngày). §4.6 nói về **có mua lần đầu trong kỳ đang chọn không** ("New" / "Existing"). Trước đây cả hai đều dùng "New/Established" → **một company có thể vừa "New" (lifecycle) vừa "Established" (revenue mix)** khi lần mua đầu cách >kỳ nhưng ≤90 ngày (vd Date range = 30 ngày, mua lần đầu 60 ngày trước). Đổi nhãn (không đổi logic) để hai khái niệm không đạp nhau: "New/Established" **không còn dùng chung chữ**.

---

## §4.4 — Companies past their buying cycle (exposure card)

- **Điều kiện xuất hiện:** all-companies mode **và** có ≥1 company ở Watch/At risk/Inactive.
- **Nhóm:** `pastCycleCompanies = healthRows.filter(health ∈ {Watch, At risk, Inactive})`.
- **Exposure:** gom **toàn bộ trailing-90 order** của nhóm vào 1 tập (`pastCycleOrders`, `t90Start = TODAY − 89`), chạy `gpStats` **một lần**:
  - `pastCycleSales` = Σ `amount` của tập.
  - `pastCycleStats = gpStats(pastCycleOrders)` → `pastCycleGP` = GP (coverage-aware) và **`pastCycleCoverage`** = costed sales / total sales của nhóm.

> ⚠️ **GP phải kèm cost coverage (bằng không dễ hiểu nhầm margin):** `pastCycleGP` là coverage-aware — chỉ tính trên phần sales đã có cost. Nếu chỉ show `$sales` cạnh `$GP`, merchant dễ suy ra margin = GP/sales (vd $100k sales / $12k GP → tưởng ~12%), trong khi $12k GP thật ra chỉ dựa trên (vd) 40% sales. → Card show thêm **"Based on X% cost coverage"** (`pastCycleCoverageNote`, hiện khi coverage < ~100%) ngay dưới dòng GP; cùng note đó cũng hiện ở InsightCard "Past their normal reorder cycle" (Overview §3.4a). Khi **không order nào costed** → GP = "—". *(Đồng nhất với quy tắc coverage §0 và Hero GP.)*

> **Quyết định thuật ngữ (quan trọng):** gọi là **"historical revenue / exposure"**, **KHÔNG** gọi "revenue at risk". Không có mô hình dự báo churn phía sau — đây là doanh thu **đã xảy ra** của nhóm đang trễ nhịp, không phải dự đoán mất mát. Nói rõ trong subtitle: *"not a prediction of loss."*

---

## §4.5 — ~~Company / Location contribution~~ (đã bỏ)

Card RankBars "share of sales by company/location" **đã gỡ** khỏi tab — thông tin share/contribution đã có ở cột **Sales / Share** của bảng **Company performance** (§4.7), nên card riêng bị trùng. (Số §4.5 giữ trống để không phá cross-ref ở các doc khác.)

---

## §4.6 — New vs existing revenue (StackedBar)

Cùng card & định nghĩa với Overview §3.2b (dùng chung `newCompanyRevenue` / `existingCompanyRevenue`). Chia theo **cohort mua lần đầu trong kỳ** — KHÁC với Lifecycle (§4.3).

| Phần | Công thức | Biến |
|---|---|---|
| **New companies** | Σ `amount` của order thuộc company có **first purchase TRONG kỳ đang chọn**. | `newCompanyRevenue` |
| **Existing companies** | `max(0, sales − newCompanyRevenue)` — company đã mua lần đầu **TRƯỚC kỳ**. | `existingCompanyRevenue` |

- `newCompanyIds` = company có `firstOrderByCompany` (first **completed** order, all-time) `≥ rangeStart`.
- **Chú thích % — mẫu số BẮT BUỘC là total revenue (`sales`)**, đây là revenue mix:
  - `New % = newCompanyRevenue / sales`
  - `Existing % = existingCompanyRevenue / sales`
  - Vì `existingCompanyRevenue = max(0, sales − newCompanyRevenue)` nên `new + existing = sales` → hai % cộng lại = 100%. *(Đã bỏ biến `lifecycleTotal` — tên gây hiểu nhầm là count; dùng thẳng `sales`.)*
- Single-company mode: thay bằng **Location performance** (bảng location).

> ⚠️ **Production:** dùng **first B2B sale** (sales-event basis), KHÔNG phải first *completed* order (Net sales không gate theo status). Cohort split nên tính rõ ràng: **New = Net sales của company có first sale TRONG kỳ; Existing = first sale TRƯỚC kỳ** — thay vì lấy `sales − newCompanyRevenue`. Xem §3.2b [[OVERVIEW-METRICS.md]].

---

## §4.7 — Company performance (bảng chính)

**Cột** (all-companies mode, `sortedCompanyRows`):

| Cột | Nguồn | Ghi chú |
|---|---|---|
| **Company** | `r.name` (CompanyLink → click filter về company đó) | |
| **Sales** | `money(r.revenue)` | period |
| **Gross profit** | `moneyN(r.gp)` | coverage-aware, "—" khi chưa costed |
| **Margin** | `pctN(r.margin)` | GP / costed sales; **0 order → "—"** (không phải 0%, xem §0 [[OVERVIEW-METRICS.md]]) |
| **Growth** | `r.growth` (chỉ khi Compare bật) | `pctChange(current, previous range)` |
| **Repeat revenue** | `r.repeat%` | header đổi từ "Repeat" → **"Repeat revenue"** (+ tooltip *"Share of sales from repeat orders"*); = repeat revenue / revenue của company — KHÔNG phải % order/% customer |
| **Last order** | `${r.since}d ago` | **chỉ recency** — bỏ `· +Nd` overdue (đã dồn sang tooltip Status) |
| **Typical reorder** | `~${r.typical}d` | **chỉ baseline** ("thường mua bao lâu 1 lần") — bỏ `· X.X×` ratio (thuộc current-state, dồn sang Status) |
| **Status** | Badge health + **Tooltip**: `X.X× its usual reorder gap · N days past its typical reorder time` | ratio (2.6×) + overdue giải thích **tại sao** = Inactive, không bắt user tự suy từ bảng |

> **Vì sao tách:** trước đây "Last order" nhồi recency + overdue (`41d ago · +25d`) và "Typical reorder" trộn baseline + current-state (`16d · 2.6×`) — bắt merchant tự đọc engine. Giờ mỗi cột trả lời **một câu hỏi**; phần "tại sao Inactive" (ratio + overdue) nằm ở tooltip Status.

**Filter/sort** (`companyFilters`, dùng chung cho card + full-screen):
- **Health**: All / mỗi trạng thái (kèm count).
- **Lifecycle**: All / No purchase / Recently activated / Established (kèm count).
- **Pricing**: Any / Has pricing / No pricing (`companyHasPricing` = có `pricing.base` hoặc `pricing.quantity`).
- **Sort**: Health (default) / Sales / Growth / Repeat revenue / Last order / Days overdue. **Đã bỏ Orders & AOV** khỏi sort — bảng không có 2 cột đó nên sort theo chúng thì user không verify được vì sao row này trên row kia (nếu cần thì đưa Orders/AOV vào expanded table thay vì sort mù).

**Logic sort (`sortedCompanyRows`)** — pipeline: `companyRows` (period) → `companyTableRows` (ghép snapshot health + `histSales` all-time) → `filteredCompanyRows` (lọc Health/Lifecycle/Pricing) → `sortedCompanyRows`:

| `companySort` | Field | Hướng | Ghi chú |
|---|---|---|---|
| **default** (Health) | `HEALTH_ORDER` rồi `histSales` | rank ASC, tie sales DESC | ưu tiên việc cần xử lý; cùng state → account to hơn lên trên |
| **sales** | `revenue` (kỳ) | DESC | |
| **growth** | `growth` | DESC | null (không có kỳ trước) → `−∞` → chìm đáy |
| **repeat** | `repeat` | DESC | |
| **recency** (Last order) | `since` | **ASC** | mua gần nhất trước; null → `+∞` → chìm đáy |
| **overdue** (Days overdue) | `overdue` | DESC | null → `−1` → chìm đáy |

- **`HEALTH_ORDER`** = `{ 'At risk': 0, Inactive: 1, Watch: 2, Healthy: 3, 'Insufficient history': 4 }` (số nhỏ = lên trên → **đẩy vấn đề lên đầu**, không phải xếp theo doanh thu). `histSales` (Σ all-time completed sales) chỉ là **tie-break** trong cùng health state.
- **Null-handling nhất quán để luôn chìm đáy** (`growth −∞`, `since +∞` vì asc, `overdue −1`) → company thiếu dữ liệu không chiếm top giả tạo.
- **`recency` là hướng ASC duy nhất** (`a − b`) vì "gần nhất" = `since` nhỏ nhất; các key còn lại đều DESC (`b − a`).
- Switch chỉ còn đúng 6 nhánh khớp dropdown — **`orders`/`aov` đã xoá** (dead sau khi bỏ khỏi sort).

**Full-screen (Expand):**
- Nút `Expand` (MaximizeIcon) → `setCompanyModalOpen(true)`.
- Overlay render bằng **`createPortal(..., document.body)`** để thoát stacking context của Polaris Frame (nếu không sẽ bị sidebar/topbar đè). `zIndex: 519`.
- **Chỉ mount bảng ở MỘT nơi tại một thời điểm:** `{!companyModalOpen && companyPerfTable}` trong card — IndexTable sticky-first-column dùng DOM ref, hai instance sống cùng lúc sẽ tranh ref và mất cột Company. (memory [[fullscreen-overlay-portal]])

**Single-company mode:** bảng đổi thành **Location performance** (`allLocationRows` qua `metricTable`, entity = Location, cột Sales/Share/Orders/AOV/Growth).

---

## §4.8 — B2B activation (FunnelV2)

Pipeline kích hoạt company từ đăng ký đến mua lần đầu (`analyticsCompanyActivation`, lọc `inPeriod(registered)`):

| Stage | Count |
|---|---|
| **Registered** | `activationRows.length` — company **đăng ký trong kỳ** |
| **Approved to date** | `activationApproved` (có `approved`) — `· X%` của Registered |
| **First purchase to date** | `activationPurchased` (có `firstOrder`) — `· X%` của Approved |

- **Approved → purchasing** = `activationRate` = `purchased / approved × 100`.
- **Typical approval → first order** = `activationTypical` = median số ngày `approved → firstOrder`.
- Single-company mode: lọc còn đúng company đang chọn.

### ⚠️ Semantics thời gian — quyết định: REGISTRATION COHORT → conversion to date

Funnel chọn cohort theo **registration date trong kỳ**, rồi đếm approved / first purchase **bất kể chúng xảy ra khi nào** (miễn đã xảy ra tính đến hiện tại). Đây là quyết định có chủ đích, **không** phải activity-in-period.

**Ví dụ:** kỳ = `Jan 1–31`, company: Registered `Jan 20` · Approved `Feb 3` · First purchase `Feb 10`.
- Report "January" chạy **ngày Jan 31**: company này ở stage Registered (chưa approved).
- Report "January" chạy lại **ngày Feb 28**: cùng company giờ đã Approved + Purchased → **số Approved/Purchased của January tăng lên**.

→ Đây là **cohort conversion "to date"** (bao nhiêu % cohort đăng-ký-tháng-1 đã chuyển đổi tính đến hôm nay), **KHÔNG** phải "hoạt động trong tháng 1". Report vì thế **mutable theo thời gian** — chủ đích, nên label rõ **"Registered cohort … to date"** + tooltip giải thích.

> **Lựa chọn thay thế (nếu sau này cần historical report immutable):** gate `approved` và `firstOrder` **≤ `rangeEnd`** — chỉ đếm chuyển đổi xảy ra **trong/đến hết kỳ**. Khi đó "January" chạy lúc nào cũng ra cùng số. Hiện **KHÔNG** chọn hướng này (ưu tiên xem cohort chuyển đổi tới hiện tại). Đổi hướng = đổi logic (thêm điều kiện ngày), không chỉ label.

---

## §4.9 — Card tooltips (ⓘ copy)

Mỗi ReportCard trên tab Companies có info tooltip (prop `help` của ReportCard — icon ⓘ; card có controls thì icon nằm cạnh title, không controls thì flush mép phải). Copy verbatim (giữ đồng bộ với UI khi đổi):

**Relationship state** (`RelationshipStateHelp`)
```
Relationship state shows whether a company is ordering on its usual schedule, based on its own order history.

Healthy — Ordering within its usual rhythm.
Watch — Slightly overdue compared with its usual rhythm.
At risk — Meaningfully overdue compared with its usual rhythm.
Inactive — More than twice its usual reorder interval has passed since the last order.
Insufficient history — Not enough order history to establish a reliable rhythm. Requires at least 4 orders.
```

**Companies past their buying cycle**
```
Companies that are past their usual reorder cycle — Watch, At risk, or Inactive by relationship state.

Sales and gross profit reflect the group's trailing 90 days of activity. These are historical figures, not a prediction of churn or future loss. When cost data is incomplete, gross profit shows the percentage of sales with cost data.
```

**New vs existing revenue**
```
New — Revenue from companies whose first purchase falls within the selected period.
Existing — Revenue from companies that first purchased before the selected period.
Percentages show each cohort's share of total B2B sales in the period.
```

**Location performance** (single-company mode)
```
Each of this company's locations, with its sales, share of the company's sales, orders and average order value in the selected period.
```

**Company performance**
```
One row per company, combining performance for the selected period with its current relationship state.

Sales, gross profit, margin, growth, and repeat revenue follow the selected period. Last order, typical reorder, and status reflect the company's current relationship state and are not limited by the date range.
```

**B2B activation**
```
Registration cohort
Companies are grouped by registration date, then tracked through approval and first purchase to date. Earlier cohorts may continue to increase as more companies convert.
```

Ngoài card (cùng đợt): header cột **Repeat revenue** → *"Share of sales from repeat orders (revenue after each company's first order ÷ its revenue)."*

---

## 5. Nguồn dữ liệu & map Shopify (production)

| Chỉ số | Nguồn demo | Map Shopify (production) |
|---|---|---|
| Sales / AOV / Growth / Contribution | `o.amount` completed | **Net sales** từ sales events (§3.1 [[OVERVIEW-METRICS.md]]) |
| Gross profit / Margin | `product.cost × qty` | `InventoryItem.unitCost`; **Net COGS reverse theo return** |
| Relationship health, Typical reorder | ngày order trong `c.orders` | ngày của **latest B2B purchase/order** (KHÔNG lấy return/reversal), recompute theo TODAY |
| Repeat revenue | order sau first *completed* order | order sau **first sale** |
| New companies | first **completed** order trong kỳ | **first B2B sale** trong kỳ |
| Lifecycle (first purchase age) | first completed order | first B2B sale |
| Activation funnel | `analyticsCompanyActivation` (demo seed) | Company registration / approval events của B2B app |
| Has pricing | `company.pricing` config | Catalog / price-list gán cho company |

### Ghi chú production
- **Growth & Contribution**: dùng Net sales (sales-event basis), không phải `Order.total`.
- **Company performance GP/Margin**: giống Hero — GP = Net sales − **Net COGS** (COGS reverse theo return/cancel), coverage-aware.
- **Past buying cycle exposure**: vẫn là **historical**, không phải dự báo; nếu sau này thêm mô hình churn thì mới được gọi "at risk revenue".

#### ⚠️ Relationship health — anchor là PURCHASE, không phải mọi "sale event"

Tách rõ **2 lớp** để dev không hiểu nhầm return/reversal là một lần mua:

| Lớp | Nguồn event |
|---|---|
| **Revenue accounting** (Sales/GP/…) | **toàn bộ** sales events (purchase + return + cancellation + reversal + adjustment) |
| **Relationship health** (reorder cadence) | **chỉ purchase/order events** làm mốc; state tính lại theo **TODAY** |

> **Định nghĩa production (chuẩn):**
> *Relationship health uses the date of the latest B2B purchase/order as the anchor. "Days since last purchase" is recalculated against the current date, so health updates continuously over time. Returns, cancellations, and other reversal events do not reset the reorder cycle.*

- Health/Typical reorder giữ nguyên định nghĩa Healthy ≤1.25× / Watch ≤1.5× / At risk ≤2× / Inactive >2× (bội số của median interval).
- **Ví dụ vì sao return không được reset:** `Jan 1` purchase · `Jan 30` purchase · `Feb 15` return. Tại `Feb 20`, `since` = **21 ngày kể từ Jan 30** (purchase gần nhất), KHÔNG phải 5 ngày kể từ Feb 15 — vì return không phải một lần reorder của customer.
- Đây là lý do metric này là **current snapshot** (recompute theo TODAY), khớp với `healthRows` = snapshot all-time trong code.

---

## 6. Tóm tắt biến ↔ phần UI

| Biến chính | Phần |
|---|---|
| `companiesScores` | §4.1 Score cards |
| `companyCadence`, `healthRows`, `healthCounts`, `HEALTH_SEGMENTS/TONE/ORDER` | §4.2 Relationship state |
| `pastCycleCompanies`, `pastCycleOrders`, `pastCycleSales`, `pastCycleGP`, `pastCycleCoverage`, `t90Orders` | §4.4 Exposure |
| `allLocationRows` | §4.6 (selected → Location performance) / §4.7 |
| `newCompanyIds`, `newCompanyRevenue`, `existingCompanyRevenue` | §4.6 New vs existing |
| `companyTableRows` → `filteredCompanyRows` → `sortedCompanyRows`, `companyPerfTable`, `companyFilters` | §4.7 Company performance |
| `activationRows`, `activationRate`, `activationTypical` | §4.8 Activation |
