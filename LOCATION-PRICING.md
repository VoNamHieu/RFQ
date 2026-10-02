# QuoteSnap B2B — Giá B2B theo location (PRD)

> Tổng hợp các thay đổi trong app để hỗ trợ **giá B2B theo từng location**, **nhiều quantity pricing**, và việc
> **thêm company** gọn hơn. Nhãn UI để nguyên tiếng Anh đúng như trong app.
>
> Cập nhật: 28/09/2026 · Bản demo: rfq-x-b2b.vercel.app/b2b/

---

## 1. Tóm tắt

- Giá B2B trước đây chỉ gán được cho **cả company**. Giờ merchant gán được cho **cả company hoặc từng location**.
- Mỗi company / location giờ có **nhiều quantity pricing** (trước chỉ một).
- **Thêm company** không còn kèm bước gán giá. Giá được gán sau, ở trang company hoặc trang location.
- Mọi chỗ gán giá dùng chung lựa chọn **All locations / Specific locations**, với cùng một ý nghĩa.

## 2. Thay đổi về cách gán giá

| Hạng mục | Trước | Giờ |
|---|---|---|
| Đối tượng nhận giá | Chỉ cả company | Cả company (mọi location, kể cả location thêm sau) hoặc một số location |
| Quantity pricing | Mỗi company một cái | Nhiều cái, xếp theo **Priority** như base pricing |
| Giá riêng của location | Chỉ ghi đè một giá duy nhất, chỉ xem, không sửa trong app | Location có **bộ giá riêng** cho từng loại (base / quantity), dùng thay bộ giá chung của company |
| Location có giá riêng lần đầu | — | Bắt đầu từ bộ giá chung rồi thêm, bớt, đổi (ví dụ 13 giá chung + 1 giá riêng = 14 giá) |
| Bỏ giá cuối cùng của location | — | Location **không có** giá loại đó cho tới khi merchant chọn **Use company pricing** |
| Quay lại giá company | Không có | **Use company pricing** trên trang location |
| "Gán cho cả company" | Bỏ sót location đang có giá riêng | **All locations** tới mọi location, ở mọi chỗ gán giá |

**Cách app chọn giá cho buyer:**

1. Nếu location của buyer có bộ giá riêng thì dùng bộ đó; nếu không, dùng bộ giá chung của company. Base và quantity
   được xét riêng.
2. **Base pricing** đầu tiên theo Priority, đang hoạt động và có áp cho sản phẩm, sẽ quyết định giá.
3. Nếu không có base pricing nào áp, **quantity pricing** đầu tiên có áp cho sản phẩm sẽ quyết định giá.
4. Không có giá nào thì dùng **Default B2B pricing** trong Settings (nếu có), còn không thì giá Shopify.

- Company bị đánh dấu **Needs a price** khi **ít nhất một location** chưa có giá.

## 3. Thay đổi theo khu vực trong app

**Thêm company (Add company from Shopify)**

- Bỏ bước gán giá. Lý do: với trường hợp phổ biến nhất (mọi location cùng giá), bước này cần 9 lần bấm và đi qua danh
  sách location hai lần.
- Còn một màn hình: chọn company, chọn location muốn thêm (mặc định tất cả), rồi bấm **Add company**. Contact đi theo
  location của họ.
- Company mới thêm một phần location vẫn hiện trong danh sách (nhãn **Added**), để thêm tiếp các location còn lại.
- Thêm xong, app mở tab **Pricing** của company để merchant gán giá.

**Trang company, tab Pricing**

- Base pricing và quantity pricing đều hiện nhiều giá, mỗi giá có Edit, Change, Remove.
- Khi thêm giá, có thêm lựa chọn **Apply to: All locations / Specific locations**.
- Thông báo khi có location đang dùng giá riêng, vì đổi hoặc bỏ giá ở trang company không tới các location đó.
- **Preview prices** chọn được location để xem đúng giá của location đó.
- **Build pricing from closed quotes** chọn được áp cho cả company hay một location.

**Trang location**

- Trước chỉ xem giá. Giờ có **Add pricing**, và Edit, Change, Remove cho từng giá, cùng **Use company pricing**.
- Bảng giá hiện cả giá **Scheduled** và **Inactive**.
- **Buyers** chuyển sang cột phải, chỉ hiện tên; vai trò hiện khi hover.
- Bỏ nhãn "Location override".

**Tạo và sửa giá**

- **Who this pricing serves** chọn được một số location của company, không chỉ cả company.
- Tạo giá mới từ trang company có thêm phần chọn location nào nhận giá.
- Sửa một giá đang dùng ở nhiều nơi: hộp thoại mới **Save changes to {tên giá}** nói rõ giá đang dùng ở đâu. Mặc định
  lưu thành **bản riêng** cho company hoặc location đang sửa; tick **Apply to all … instead** để sửa ở mọi nơi.
- **Pricing details**: tên giá và Priority xếp dọc; tên giá bắt buộc.

**Thư viện Pricing**

- Gán một giá cho nhiều nơi cùng lúc: thêm lựa chọn **Locations**, bên cạnh Companies và Store-wide.

**Quote**

- Giá B2B trên quote tính theo location của quote.

**Câu chữ**

- "Company base price" đổi thành "Base price". Default B2B pricing áp cho "every company or location".
- "Select companies" đổi thành "Select companies and locations".

## 4. Lỗi đã sửa

- Quantity pricing tạo từ trang company bị lưu nhầm thành base pricing.
- Thêm giá cho cả company bỏ sót location đang có giá riêng.

## 5. Thao tác nào ảnh hưởng tới đâu

| Thao tác | Bộ giá chung của company | Location có giá riêng | Location dùng giá company |
|---|---|---|---|
| Thêm giá cho **All locations** | Có thêm | Có thêm | Nhận qua giá company |
| Thêm giá cho **Specific locations** | Không đổi | Có thêm (nếu được chọn) | Có giá riêng và có thêm (nếu được chọn) |
| Đổi / bỏ giá trên trang company | Đổi / bỏ | **Không** đổi | Nhận thay đổi |
| Thêm / đổi / bỏ giá trên trang location | Không đổi | Đổi | Có giá riêng rồi đổi |
| **Use company pricing** | Không đổi | Quay về giá company | Không áp dụng |
| Xoá hẳn một giá khỏi thư viện | Bỏ | Bỏ | Nhận thay đổi |

## 6. Việc còn mở và rủi ro

1. **Location có giá riêng không còn nhận thay đổi của company.** Merchant dễ quên điều này; hiện chỉ có thông báo trên
   trang company. **Đề xuất:** đổi sang cách "cộng thêm": giá của location = giá của company + giá thêm riêng − giá ẩn
   riêng, để location luôn nhận thay đổi của company. Chưa làm vì là thay đổi lớn.
2. **Base và quantity tách riêng** khiến một location có nhiều trạng thái khó giải thích. Hướng "cộng thêm" ở mục 1
   giải quyết được.
3. **"Take the volume discount off → The base price"** trong quantity pricing mới là thiết lập, chưa tác động tới giá
   buyer thực trả.
4. **Analytics chưa tính theo location.** Company chỉ có giá ở cấp location có thể bị tính là "chưa có giá".
5. Home ghi "N companies need B2B pricing", nhưng thực tế đếm company có ít nhất một location chưa có giá.
6. Hộp thoại xoá company chưa tính các giá riêng của location khi báo số giá sẽ bị gỡ.
7. **Preview prices** chưa tính Default B2B pricing.
8. Cần một vòng kiểm tra giao diện đầy đủ trước khi coi là hoàn tất.
