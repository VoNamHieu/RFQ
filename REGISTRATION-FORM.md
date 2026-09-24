# QuoteSnap B2B — Registration form (PRD + ghi chú thay đổi)

> Feature: **buyer tự đăng ký B2B** — merchant dựng form trong app, đưa form lên storefront, rồi
> duyệt đơn trong **Wholesale B2B → Registrations**. File này mô tả hành vi hiện tại của prototype
> và ghi lại các quyết định thiết kế (dùng làm nguyên liệu PRD), cùng kiểu với `PRD-NOTES.md`.
> Nhãn UI để nguyên tiếng Anh đúng như trong app.
>
> Cập nhật: 2026-09-23 · Branch: `feature/b2b-registrations` · Stack: Vite + React + @shopify/polaris

---

## 1. Mục tiêu

- Merchant **thu đơn đăng ký B2B ngay trên storefront**, thay vì nhận email rồi tạo company thủ công.
- Mỗi đơn được duyệt là **một buyer có quyền B2B**, gắn vào đúng **Company** (có sẵn hoặc tạo mới),
  từ đó pricing/quote/order đi theo luồng B2B đang có.
- Form do merchant tự cấu hình; storefront render **đúng các field đã cấu hình**, không hard-code.

## 2. Bản đồ file

| Vai trò | File |
|---|---|
| Form builder (4 tab + preview) | `src/b2b/screens/FormSettings.jsx` |
| Hàng đợi đơn (list, filter, bulk) | `src/b2b/screens/Registrations.jsx` |
| Màn duyệt 1 đơn | `src/b2b/screens/RegistrationDetail.jsx` |
| Helper (status, match company, ngày) | `src/b2b/registrations.js` |
| Cấu hình form dùng chung 2 app | `src/shared/registrationForm.js` |
| Form phía storefront | `src/storefront/components/ApplyForm.jsx`, `screens/BusinessAccount.jsx`, `screens/Account.jsx` |
| Seed đơn demo | `src/b2b/data/registrations.js` |
| Action + state | `src/b2b/store.jsx`, `src/b2b/initialState.js` |

## 3. Vòng đời

```
Merchant:  Create form → cấu hình (Form / Review process / Design) → Save
                      → Publish form: chọn place → add trong theme → Live
Buyer:     Storefront → Apply for a business account → submit
Merchant:  Registrations → mở đơn → match Company → Approve / Decline
                      → buyer thành contact của Company → gán pricing
```

## 4. Form builder

### 4.1 Bốn tab (`EDITOR_TABS`)

| Tab | Nội dung |
|---|---|
| **Form** | Title (nội bộ), Page URL, danh sách Fields (kéo thả, sửa label/required, thêm/xoá). |
| **Review process** | `approval` (manual/auto), `afterSubmit` (message/redirect), message cảm ơn, redirect URL, tags. |
| **Design** | Canh lề heading, cỡ chữ label/help, bo góc field/nút, viền, shadow, hover. |
| **Publish form** | Chọn nơi form xuất hiện + tiến độ từng nơi. Xem §6. |

### 4.2 Field model (`src/shared/registrationForm.js`)

- `BUILTIN_FIELDS` — toàn bộ field dựng sẵn; `kind` quyết định cách render (`text`, `email`,
  `password`, `phone`, `company`, `country`, `state`, `location`, `textarea`, `checkbox`,
  `heading`, `submit`). `half: true` = nằm cùng hàng với field trước.
- `TEMPLATE_FIELDS` (= `DEFAULT_FIELD_IDS`) — form khởi tạo: contact (first/last name, business
  email) + business (company name, country, Tax/VAT ID) + message + submit.
  **Không có password**: đây là đơn xin tài khoản B2B, không phải form đăng ký khách lẻ.
- Field built-in bị xoá được nhớ trong `removed` (giữ nguyên label/required), thêm lại là về đúng
  vị trí cũ theo `BUILTIN_ORDER`.
- Custom field: `CUSTOM_TYPES` (dropdown, checkbox, radio, text, textarea, heading, number, date, upload).

### 4.3 Preview

- Khung preview bên phải bám theo surface đang xem (`PREVIEW_TITLE`), nút **Desktop** mở
  toàn màn hình (`DesktopPreview`, portal + Esc để đóng).
- Trên tab Publish form, icon con mắt (`PreviewEye`) đổi surface: registration page,
  product page (Modal / Redirect link), account page.
- **Preview form** ở header (menu, `Page actionGroups`) — chỉ hiện **sau khi form đã lưu** — cho
  chọn surface rồi mở thẳng preview toàn màn hình. Danh sách surface bám theo place đã tick.

## 5. Save model — "Unsaved changes"

- Editor dùng **`ContextualSaveBar`** của Polaris: `Unsaved changes` + **Discard** + **Save**.
- **Dirty** = so sánh JSON của `draft` với bản đã lưu. `draft` gồm: title, fields, slug, approval,
  afterSubmit, message, redirectUrl, tags, appr, places, productMode, productLink, productLinkText,
  accountCopy, removed.
- **Không** tính là thay đổi: tab đang mở, field đang expand, surface đang preview, full-screen
  preview — và **`status` (tiến độ publish)**. Tiến độ không phải nội dung: nếu tính, vừa Save xong
  mà đổi trạng thái place là form lại dirty, và Discard sẽ "xoá" cả việc đã tạo page.
- **Form mới** (đi từ template): coi như chưa từng lưu → save bar hiện ngay từ đầu. **Form cũ**
  (vào bằng Edit form): sạch, chỉ hiện khi có sửa.
- **Save**: ghi config ra `localStorage` (`qsRegistrationForm`) → storefront đọc bản này. Toast
  `Form saved` + banner xác nhận.
- **Discard**: trả mọi field về bản đã lưu; form chưa lưu lần nào thì về đúng template ban đầu.
- **Nguyên tắc**: storefront chỉ thấy **bản đã Save**. Trước đây mỗi lần gõ phím là đẩy thẳng ra
  storefront, nên khái niệm "unsaved" vô nghĩa.

## 6. Publish form — 3 place và vòng qua theme

| Place (`PLACE_LABEL`) | Form xuất hiện ở đâu | Bước kế tiếp |
|---|---|---|
| **Create page** | Trang riêng `/pages/<slug>` do app tạo | `Add registration page` → rồi `Add form to theme →` |
| **Product page** | Modal trên trang sản phẩm, hoặc link dẫn sang trang form | `Add button` (qua theme editor) |
| **Account page** | Card "Apply for a business account" trong tài khoản khách | `Add button` (qua theme editor) |

**Trạng thái mỗi place** (`status[place]`):

| Trạng thái | Ý nghĩa | UI |
|---|---|---|
| `none` | Chưa làm gì | Nút hành động |
| `pageCreated` | Đã tạo page (chỉ Create page) | ✓ Registration page created |
| `waiting` | Đã bấm sang theme editor, chưa xác nhận | ⏱ Waiting for theme editor + `I've added it` / `Open theme again` |
| `live` | Merchant xác nhận đã thêm và save trong theme | ✓ Live + `View storefront` |

**Quy tắc vòng qua theme (quyết định thiết kế):**

- Block trong theme **render bản form đã lưu ở app**, nên rời app khi còn unsaved là mất thay đổi
  và block hiện bản cũ. → Khi còn dirty mà bấm nút sang theme, hiện modal
  **"Save your form first?"** với `Save and open` (lưu rồi mở editor trong một bước) / `Cancel`.
- App **không tự biết** merchant đã thêm + save block bên theme hay chưa → không nhảy thẳng sang
  `live`. Đi qua `waiting`, merchant xác nhận bằng `I've added it` thì mới `live` và mới dispatch
  `PUBLISH_REGISTRATION_FORM`. (App thật nên tự kiểm tra theme thay vì hỏi.)
- Note nhắc trong banner sau khi Save, khi đã tick Product page / Account page:
  *"Product page and Account page need to be added in your theme for changes to take effect.
  Click Add button on each one to be redirected to the theme editor and choose where it goes."*
- Mỗi place là **một lượt redirect riêng** (deep link vào đúng template), không có đích chung.
- `Install manually instead` — fallback 5 bước: mở app embed block, chọn page, thêm block
  "Registration form", copy form ID, điền vào rồi Save.

## 7. Trạng thái form: Draft / Live

- Badge cạnh tiêu đề editor: **Draft** (attention) cho tới khi form có mặt ở ít nhất một place,
  rồi thành **Live** (success). Nguồn: `db.registrationFormPublished`.
- Cùng trạng thái đó ở **Home**: `Form live` / `Form draft` / `No form`.
- `hasRegistrationForm` bật khi chọn template (`CREATE_REGISTRATION_FORM`);
  `registrationFormPublished` bật khi một place thành `live`.

## 8. Registrations queue

- Tab + đếm: **Pending review / Approved / Declined / All**.
- Search theo tên, email, company, country, tax ID. Sort theo Submitted / Applicant / Company /
  Country (2 chiều). Đổi tab hoặc search thì bỏ selection đang chọn.
- Bulk: **Approve / Decline** (chỉ áp lên các dòng pending trong selection) và **Delete**, đều qua
  modal xác nhận, có liệt kê từng đơn và company mà buyer sẽ vào.
- Cột **Company match**: company đã nối, hoặc gợi ý (`· suggested`), hoặc `New company`.
- **Empty state (mỗi khối tự empty, không thay cả màn):**
  - Chưa có form: *No registration forms yet* + **Create form**.
  - Có form, chưa có đơn: *No registrations yet* + **Edit form**.
  - Tab trống: empty riêng cho từng tab. Search không ra: một dòng chữ, không kèm nút.
- **Dev toggle** (badge `Dev`, `SHOW_DEV_TOOLS`): *Preview no form* — xem empty state của trạng
  thái chưa có form, vì demo luôn có sẵn form.

## 9. Review → approve

- Màn chi tiết bày đơn theo đúng các section của form, cột phải là quyết định: vào **company gợi ý**,
  **company khác**, hay **company mới**.
- `matchCompany` — gợi ý theo thứ tự tín hiệu mạnh dần xuống:
  1. email đã là contact của company,
  2. trùng **domain email công việc** (loại các domain cá nhân: gmail, yahoo, outlook…),
  3. trùng **tên company** sau khi chuẩn hoá (bỏ dấu, bỏ `co/ltd/jsc/llc/inc/company`).
- **Approve** (`APPROVE_REGISTRATION`):
  - Vào company có sẵn → thêm contact (`Ordering only` / `Buys directly`) nếu email chưa có, cập
    nhật số buyer và activity.
  - Company mới → tạo company `source: 'Registration form'`, một location **Head office** (country
    và Tax ID lấy từ đơn), contact đầu là **Location admin**, `pricing` rỗng.
  - Đơn chuyển `approved`, ghi `decidedAt` + `companyId`.
- **Decline** → `declined` + `decidedAt`. **Delete** → xoá khỏi hàng đợi, company đã tạo vẫn giữ.
- `decidedAt` dùng `todayISO()` (giờ local). Không dùng `toISOString()` vì với UTC+7 thì sáng sớm
  sẽ ra ngày hôm trước.

## 10. Data model

**Một registration** (`src/b2b/data/registrations.js`):

```js
{ id, status: 'pending' | 'approved' | 'declined', submittedAt, source,
  firstName, lastName, email, company, country, taxId, message,
  companyId?, decidedAt? }
```

- `source` = nơi buyer gửi đơn (`Registration page`, `Account page`…).
- `REG_STATUS` giữ label + tone của badge cho cả list lẫn màn chi tiết.

**Form config** — key `qsRegistrationForm` trong `localStorage`, dùng chung 2 app. Storefront gọi
`readRegistrationForm()`; thiếu/hỏng thì fallback `DEFAULT_FORM`. `visibleFields()` bỏ nút submit và
bỏ các field mà tài khoản đã đăng nhập tự biết (first/last name, email, password), đồng thời bỏ
heading nào không còn field nào bên dưới.

**Store actions:** `CREATE_REGISTRATION_FORM`, `PUBLISH_REGISTRATION_FORM`, `OPEN_REGISTRATION`,
`SET_REGISTRATION_FILTER / _SEARCH / _SORT`, `APPROVE_REGISTRATION`, `APPROVE_REGISTRATIONS`,
`DECLINE_REGISTRATIONS`, `DELETE_REGISTRATIONS`.

## 11. Ghi chú thay đổi (22–23/09/2026)

| # | Thay đổi | Lý do |
|---|---|---|
| 1 | Thêm `ContextualSaveBar` cho editor; storefront chỉ đọc bản đã Save | Trước đó gõ tới đâu đẩy ra storefront tới đó, không có khái niệm nháp |
| 2 | `status` (tiến độ publish) tách khỏi `draft` | Nếu không, vừa Save xong đổi trạng thái place là form dirty lại; Discard cũng sẽ xoá tiến độ |
| 3 | Form mới thì save bar hiện ngay; form cũ thì chỉ hiện khi sửa | Form chưa lưu lần nào thì chưa có gì trên storefront |
| 4 | Thêm menu **Preview form** ở header, chỉ hiện sau khi lưu | Có bản đã lưu thì mới có cái để xem; cho chọn đúng surface |
| 5 | `fullPreview` đổi từ boolean sang "surface đang xem" | Để menu mở đúng surface, không phụ thuộc tab đang đứng |
| 6 | Modal **Save your form first?** trước khi sang theme editor | Rời app khi đang dirty = mất thay đổi, block hiện bản cũ |
| 7 | Thêm trạng thái **waiting** + nút `I've added it` | App không thấy được thao tác bên theme; báo `Live` ngay là sai |
| 8 | Badge tiêu đề **Draft/Live** thay cho **Active** cứng | Form mới tạo chưa lên storefront mà báo Active là sai, lại lệch với Home |
| 9 | Banner **Form saved** (giữ tiêu đề, bỏ nút Publish form và dòng "Buyers can't see it yet") | Toast biến mất quá nhanh, cần chỗ nói rõ bước tiếp theo |
| 10 | Câu note: *"need to be added in your theme for changes to take effect"* | Bản cũ *"are added in your theme"* nghe như đã xong rồi |
| 11 | Empty state tách 2 trường hợp: chưa có form vs chưa có đơn; thêm dev toggle *Preview no form* | Hai trạng thái cần hai hành động khác nhau (Create form vs Edit form) |
| 12 | `todayISO()` thay `toISOString().slice(0,10)` | UTC+7 sáng sớm sẽ ghi nhầm sang ngày hôm trước |

## 12. Ảnh màn hình

Chụp từ prototype chạy thật (2026-09-23), cũng là bộ ảnh được chèn vào `QuoteSnap B2B — Registration Form.docx`
theo từng journey. File gốc: `docs/registration-form/`.

| Trạng thái | Ảnh |
|---|---|
| Chưa có form (J1) | `j01-no-form.jpg` |
| Form Builder + default template (J2) | `j02-form-builder.jpg` |
| Unsaved changes (J3) | `j03-unsaved-changes.jpg` |
| Preview form menu (J4) | `j04-preview-form-menu.jpg` |
| Publish form — 3 placements (J6) | `j06-publish-form.jpg` |
| "Save your form first?" + waiting (J10) | `j10-save-first-modal.jpg`, `j10-saved-waiting.jpg` |
| Chưa có registration (J12) | `j12-no-registrations.jpg` |
| Storefront form + submit (J13–J14) | `j13-storefront-form.jpg`, `j14-validation.jpg`, `j14-application-received.jpg` |
| Queue + review (J15–J16) | `j15-queue.jpg`, `j16-review-detail.jpg` |
| Search không kết quả (J22) | `j22-search-empty.jpg` |
| Bulk approve (open decision) | `bulk-approve.jpg` |

## 13. Việc còn mở / rủi ro

1. **Đơn từ storefront chưa chảy vào hàng đợi.** `SUBMIT_B2B_APPLICATION` chỉ lưu vào
   `b2bApplications` của storefront; `db.registrations` bên B2B vẫn chỉ có seed. Muốn demo trọn
   vòng thì cần cầu nối qua `localStorage` như `writeRegistrationForm` đang làm.
2. **Account page thực tế không nằm trong theme editor.** Tài khoản khách của Shopify dùng
   **Customer accounts editor** riêng. Copy hiện tại gộp chung là "theme editor".
3. **Tab Design chưa có tác dụng.** `appr` nằm trong draft và được lưu, nhưng không được truyền
   xuống preview lẫn storefront.
4. **Banner hướng dẫn gắn với lần Save.** Đóng banner hoặc tick place trước khi Save thì không còn
   chỗ nào nhắc về vòng qua theme.
5. **`Turn form off` mới chỉ là toast**, chưa đổi trạng thái form.
6. **Trạng thái `live` dựa vào merchant tự xác nhận** — app thật nên kiểm tra block trong theme.
7. **Multi-step form** vẫn là template `Coming soon`.
8. Form ID trong `Install manually instead` đang hard-code một UUID.
