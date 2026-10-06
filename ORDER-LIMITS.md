# QuoteSnap B2B — Order limits (PRD)

> Tính năng **Order limits**: rule về những gì buyer B2B được phép check out (giá trị đơn, số lượng, case pack, ngưỡng
> duyệt đơn), gán store-wide hoặc cho từng company / location. Nhãn UI để nguyên tiếng Anh đúng như trong app.
>
> Cập nhật: 05/10/2026 · Branch: `feature/location-pricing-assign` (chưa commit) · Chỉ có ở bản **Latest** (cờ `orderLimits`)

---

## 1. Tóm tắt

- Thêm mục **Order limits** trong menu của app (dưới Pricing): thư viện rule, tạo / sửa / bật tắt / xoá.
- Ba loại rule: **Order limit**, **Product limit**, **Review threshold**.
- Mỗi rule gán **Store-wide** hoặc cho **Specific companies and locations** (cùng modal chọn company / location như Pricing).
- Trang location có thẻ **Order limits** cạnh Commerce settings: các rule đang áp cho location đó, kèm nút **Add limit**.

## 2. Vì sao làm và đặt ở đâu

**Khoảng trống của Shopify:**
- Shopify có sẵn **quantity rules** theo variant (min / max / increment) trong catalog B2B.
- Shopify **không có** limit theo cả đơn (giá trị tối thiểu / tối đa, tổng số lượng) cho từng company hay location.
- Checkout Blocks của Shopify chỉ chọn được "tất cả khách" hoặc "mọi company B2B".

**Đối thủ đặt setup ở:**
- Một mục riêng có danh sách rule (BSS, Orbit, MinMaxify).
- Hoặc gắn vào nhóm khách (SparkLayer).
- Không app nào đặt trong pricing.

**Quyết định:**
- Entry chính: mục riêng **Order limits**.
- Entry phụ: thẻ trên trang location, nơi Shopify đặt Order submission và Payment terms.
- Điểm khác biệt so với đối thủ: target được tới **từng company / location** (đa số đối thủ chỉ dùng tag).

## 3. Các loại rule

| Loại | Thiết lập | Ghi chú |
|---|---|---|
| **Order limit** | Order value Minimum / Maximum; Order quantity Minimum / Maximum | Giá trị là subtotal theo giá B2B, trước thuế và ship. Số lượng là tổng mọi item trong cart. Để trống = không giới hạn. |
| **Product limit** | Products (All / A collection / Specific products); Minimum, Maximum, Sold in multiples of | Tính theo variant, giống quantity rules của Shopify. Min và max phải là bội của increment. |
| **Review threshold** | Review orders above $X | Đơn trên ngưỡng không check out được. Buyer gửi đơn cho merchant, đơn về thành draft order để duyệt. |

**Các phần chung của mọi rule:**
- **Name**: bắt buộc, chỉ merchant thấy.
- **Status**: Active / Inactive.
- **Buyer message**: tuỳ chọn. Để trống thì dùng câu gợi ý theo rule, ví dụ "Your order must be at least $500 to check out."

## 4. Khi nhiều rule cùng áp

- **Rule cụ thể hơn thắng:** của riêng location → của company → store-wide. Nhờ vậy merchant cho một khách lớn mức
  minimum thấp hơn mọi người được. Ví dụ: Vinh Phat $200 thay store-wide $500.
- **Cùng cấp thì rule chặt hơn thắng:** minimum cao hơn, maximum hoặc ngưỡng thấp hơn.
- **So theo từng thiết lập**, không theo cả rule. Một rule store-wide có thể bị thay phần minimum nhưng vẫn giữ phần
  maximum.
- **Product limit xét theo từng sản phẩm, nguyên cả rule:** không trộn min của rule này với increment của rule kia, vì
  Shopify yêu cầu min / max là bội của increment.
- Trên thẻ của location, rule bị thay hiện **gạch ngang**, kèm "Replaced here by {tên rule}".

## 5. Màn hình

**Order limits (thư viện)**
- Tab All / Order / Product / Review, tìm theo tên.
- Cột: Name, Type, Rule (tóm tắt), Applies to, Status, và các nút bật tắt / sửa / xoá.
- **Create limit** → **Select limit type** (3 thẻ) → editor.
- Chưa có rule thì hiện màn trống: "Set rules for what buyers can order".

**Editor**
- Cột chính: loại + Name, phần thiết lập theo loại, Buyer message.
- Cột phụ: Status, Applies to, giải thích "When limits overlap".
- Lỗi "chưa nhập" chỉ hiện sau khi bấm lưu. Lỗi sai logic (min > max, không phải bội số) hiện ngay.

**Trang location → thẻ Order limits**
- Liệt kê rule đang áp, kèm nhãn nguồn: This location / Company / Store-wide.
- **Add limit** mở editor với tên và location đã điền sẵn.
- Lưu hoặc huỷ đều quay lại trang location.
- **Manage all order limits** mở thư viện.

**Dọn dữ liệu**
- Xoá company thì gỡ company đó và các location của nó khỏi mọi rule.
- "Show the app with no data" xoá luôn danh sách rule.

## 6. Đơn chờ duyệt (Review threshold)

Đơn vượt ngưỡng duyệt mang trạng thái **Needs review**, ghi lại rule đã giữ nó (`heldBy`), và là một draft order chờ
merchant quyết định. Dữ liệu mẫu có hai đơn: #1045 (ABC Construction · Hanoi, $12,400, ngưỡng riêng $10,000) và #1048
(Vinh Phat · Da Nang, $21,500, ngưỡng store-wide $20,000).

| Nơi | Hiển thị |
|---|---|
| **Home → Needs attention** | Dòng đầu tiên: "N orders waiting for your review". Bên dưới là danh sách đơn, đơn chờ lâu nhất xếp trước, tối đa 5 đơn. Mỗi đơn có mã đơn (bấm vào mở trang location), company · location, số tiền, buyer · ngày · lý do, cùng nút **Decline** / **Approve**. |
| **Trang location → Order history** | Banner cảnh báo phía trên bảng: "Order #… for $… is waiting for your review", kèm lý do và hai nút. Trong bảng, đơn chờ duyệt ghim lên đầu, có dòng lý do dưới mã đơn. |
| **Trang company → tab Orders** | Đơn chờ duyệt ghim lên đầu, có dòng lý do và hai nút ở cột cuối. |

- **Approve:** draft order được hoàn tất thành đơn thật, trạng thái chuyển sang **Unfulfilled**.
- **Decline:** hỏi lại trước khi làm. Draft bị huỷ, buyer được báo, có thể sửa đơn rồi gửi lại. Trạng thái chuyển sang
  **Declined**.
- Cả hai thao tác đều ghi vào activity của company.
- Analytics chỉ tính đơn Fulfilled / Paid, nên duyệt hay từ chối không làm đổi số liệu.

## 7. Phía buyer (storefront demo)

Storefront dùng chung logic kiểm tra với app (`cartProblems` / `productRuleFor` trong `b2b/limits.js`), tức đúng những
gì validation function sẽ kiểm tra. Rule chỉ áp cho buyer đã đăng nhập vào một company location. Khách vãng lai và
khách chưa duyệt không bị ảnh hưởng.

Rule mẫu cho Watson Co · Phố Thái Hà (`quatnap.of@gmail.com`):
- Store-wide: minimum $500.
- Company: áo đấu bán theo pack 5, tối thiểu 10.
- Location: đơn trên $5,000 phải gửi duyệt.

**Trang sản phẩm**
- Số lượng bắt đầu từ mức tối thiểu và nút +/− bước theo pack.
- Dưới ô số lượng có ghi chú "Sold in packs of 5 · Minimum 10".
- Số lượng sai thì hiện lỗi đỏ ("Order at least 10.") và khoá Add to cart.

**Cart**
- Nút +/− bước theo pack.
- Vi phạm rule thì hiện hộp cảnh báo, kèm số tiền còn thiếu, ví dụ "Your order must be at least $500 to check out.
  Add $491.50 more.", và khoá **Check out**.
- Vượt ngưỡng duyệt thì thay Check out bằng **Submit order for review**, đơn được gửi cho merchant. Demo hiện chỉ báo
  "Order sent for review" và xoá cart.

## 8. Cách chặn đơn ở bản thật (đề xuất kỹ thuật)

- **Cart and Checkout Validation Function** (`cart.validations.generate.run`).
  - Đọc được `buyerIdentity.purchasingCompany.location`, cart lines và subtotal.
  - Báo lỗi ở cart, checkout (kể cả Shop Pay, Apple Pay) và draft order.
  - App public chạy được trên mọi plan.
- Rule được ghi vào **metafield** của validation (`validationCreate`) hoặc của company location. Function không gọi
  mạng được, trừ custom app trên Enterprise.
- **Product limit** đồng bộ thêm sang quantity rules của Shopify (`quantityRulesAdd` trên price list của catalog), để
  theme hiện được min / increment trên trang sản phẩm.
- **Giới hạn:**
  - Không chạy với Create Order API, order edit, POS hay subscription.
  - Merchant bỏ qua được validation khi hoàn tất draft order.
  - Function không có đồng hồ, nên muốn limit theo kỳ (ví dụ mỗi tháng) thì app phải tự đếm.

Nguồn chính:
- shopify.dev/docs/api/functions/2026-10/cart-and-checkout-validation
- shopify.dev/docs/api/admin-graphql/2026-10/mutations/quantityRulesAdd
- help.shopify.com/en/manual/checkout-settings/checkout-blocks/order-value-limits
- help.shopify.com/manual/b2b/catalogs/quantity-pricing

## 9. Việc còn mở

1. Rule của storefront demo là **bộ riêng** cho Watson Co (company này không có trong dữ liệu của B2B app), nên sửa rule
   trong app không làm storefront đổi theo.
2. Đơn gửi từ storefront ("Submit order for review") chưa chạy sang hàng chờ duyệt của app. Hai app demo không dùng
   chung dữ liệu.
3. **Review threshold và Order submission của Shopify** ("Submit all orders as drafts for review") chồng nghĩa một phần.
   Cần câu chữ để phân biệt: một bên là mọi đơn, một bên là đơn trên ngưỡng.
4. Chưa target được theo **customer tag** hoặc khách D2C wholesale. Pricing thì đã có.
5. Home mới chỉ có đơn chờ duyệt. **Setup guide** và **Analytics** chưa nhắc tới Order limits (ví dụ số đơn bị chặn).
6. Chưa có cảnh báo khi một rule store-wide bị **mọi** company thay thế, tức là rule đó không còn tác dụng ở đâu.
