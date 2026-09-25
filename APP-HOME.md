# QuoteSnap B2B — App home (PRD)

> Feature: the **Home** screen of Wholesale B2B Solution, the first page a merchant lands on.
> It answers three questions: *is the app set up?*, *does anything need me right now?*, and
> *how is each core feature doing?* This file describes the prototype's current behavior and
> design decisions (source material for the PRD). UI labels are quoted exactly as in the app.
>
> Updated: 2026-09-25 · Branch: `feature/build-from-quotes-rfq-install` (not committed yet) · Stack: Vite + React + @shopify/polaris

---

## 1. Goals

- One place that tells the merchant whether B2B is **set up and working**.
- Surface **what needs action now**, each item with one button that goes straight to the fix.
- Show **one key number per core feature** (Companies, B2B pricing, Registrations, Quotes), each
  with one clear action.
- Follow Shopify's App Home guidance (Homepage pattern, Built for Shopify 3.1.4 / 4.2.3):
  single column, default width, a dismissible setup guide, help links in the footer.

**Not in scope:** trends and charts (they live in Analytics; Home links there), editing anything
inline on Home.

## 2. Entry points

- Home is the default screen when the app opens.
- **Wholesale B2B Solution** in the Shopify admin sidebar opens Home (it used to open the
  Companies list).
- The app URL `#/b2b` opens Home.

## 3. Page layout (top to bottom)

| # | Section | Shown when |
|---|---|---|
| 1 | Page header | Always |
| 2 | Dev strip (prototype only) | Prototype builds — see §13 |
| 3 | Setup guide | Until the merchant dismisses it |
| 4 | Needs attention | Always |
| 5 | Your B2B at a glance | Always |
| 6 | What happens next | Only while setup isn't complete |
| 7 | Footer help | Always |

## 4. Page header

Title and subtitle change with setup progress:

| Setup | Title | Subtitle |
|---|---|---|
| Not complete | **Get your B2B selling workflow ready** | Complete a few setup steps to start accepting B2B registrations and selling with custom pricing. |
| Complete (all 3 steps done) | **Wholesale B2B Solution** | Your B2B companies, pricing and registrations at a glance. |

Secondary actions, top right, always shown:
- **Add company** — goes to the B2B Company list and opens the "Set up Shopify company" wizard
  on top of it (not on Home). Same for every Add company button on Home.
- **Create pricing** — opens Pricing straight on the "choose a type" step (base price or
  quantity breaks).

## 5. Setup guide

Header: **Setup guide** · "Use this guide to get your B2B store up and running." · progress line
"X of 3 tasks completed" with a progress bar and percentage.

| Step | Done when | Description (not done → done) | Button (not done → done) |
|---|---|---|---|
| 1. Add your first B2B company | At least one company exists | "Add a company so its buyers can shop at B2B prices." → "You've added N companies." | Add company → View companies |
| 2. Set up pricing | At least one pricing exists | "Create and assign pricing so buyers see the right prices." → "You've created N pricings." | Create pricing → View pricing |
| 3. Publish your registration form | The form is published to the storefront | "Let buyers submit their business details from your storefront." → "Buyers can apply for B2B access from your storefront." | Create form (no form yet) / Preview form (draft) → Edit form |

Behavior:
- **One step open at a time.** The first unfinished step is open by default; clicking another
  step's title opens that one instead.
- The open step shows its description and button. The button is **primary** while the step is
  unfinished and **secondary** once it's done.
- Step marker: green check = done · solid ring = the current step (first unfinished) · dashed
  ring = later unfinished steps.
- **Collapse** (chevron) hides the step list; header and progress stay visible.
- **Dismiss** (X) hides the whole guide.
- When all three steps are done, setup counts as complete: the page title switches (§4) and
  "What happens next" disappears.

Notes:
- Step 2 counts any pricing, even one that isn't assigned yet. Unassigned pricing is caught
  separately by Needs attention (§6, row 4).
- Step 3 stays done if the merchant turns the form off later.

## 6. Needs attention

Card title **Needs attention**. Each row has a bold headline with a count, a one-line
explanation, and one button.

- Rows are ordered **most blocking first**. There are no severity colours; order is the only
  priority signal.
- A row only appears when there's something to act on; it disappears when its count reaches 0.
- When no rows apply: "You're all caught up. Nothing needs your attention right now."

| Order | Headline | Explanation | Shows when | Button → destination |
|---|---|---|---|---|
| 1 | N companies need B2B pricing | No pricing applies to at least one of their locations. | At least one location of a company gets no B2B pricing (or the company itself, if it has no locations). Each company counts once, however many locations lack pricing. | **Assign pricing** → Companies list, filtered to "Needs a price" |
| 2 | N registrations waiting for review | Buyers applied for B2B access through your registration form. | Registrations that are still pending review (not approved or rejected yet). | **Review registrations** → Registrations, filtered to pending |
| 3 | Your registration form isn't published | Buyers can't apply until it's available on your storefront. | A form has been created but never published to the storefront. | **Publish form** → form builder |
| 4 | N pricing setups aren't assigned | Pricing stays inactive until it's assigned to a company, location or customer. | A pricing that is turned on but assigned to nothing. | **View pricing** → Pricing library, filtered to "Status: Inactive" |

Definitions:
- **Price lookup for a location**, in order: the location's own pricing → the company's base
  pricing (turned on and within its start/end dates) → quantity pricing on the location or the
  company → the store-wide default for all companies. If none applies, the location has no price.
- **Unassigned pricing**: not used by any company, location, customer, customer tag, or
  store-wide default. Pricing the merchant turned off on purpose is **not** counted.

## 7. Your B2B at a glance

Section heading **Your B2B at a glance**, with a **View analytics** link on the right (only when
Analytics is enabled). Four cards: one column on phone, two on tablet, four on desktop. Each card
has an icon and title, an optional badge, a big number with a caption, a one-line description,
and one button.

| Card | Big number | Caption | Badge | Button |
|---|---|---|---|---|
| **Companies** | Number of companies | "N locations" | — | View companies (Add company when there are none) |
| **B2B pricing** | Pricings in effect: turned on and assigned (scheduled ones included) | "active · N quantity breaks" ("active" when there's no pricing) | — | View pricing (Create pricing when there's none) |
| **Registrations** | Registrations pending review | "pending review" | Form live (green) · Form draft (orange) · Form off (grey) · No form (grey) | View registrations (Create form when there's no form) |
| **Quotes** — RFQ app installed | Open quotes | "open · N deals closed" | — | Open RFQ app |
| **Quotes** — installed, no quotes yet | 0 | "open · 0 deals closed" | — | Open RFQ app |
| **Quotes** — not installed | *(no number)* | — | Not installed | Install app → App Store |

Card descriptions:
- Companies: "B2B companies with their locations, buyers and payment terms."
- B2B pricing: "Base prices and quantity breaks for companies and customers."
- Registrations: "B2B applications from the registration form on your storefront."
- Quotes (installed): "Quote requests from the RFQ app, tracked on each company."
- Quotes (not installed): "Install O:Request a Quote to collect quote requests and turn accepted
  quotes into B2B pricing."

**Open quote**: any quote that isn't closed as won (Deal Closed), rejected (Deal Rejected) or
moved to trash.

## 8. What happens next

Info card, shown only while setup isn't complete:

> **What happens next** — Once you complete the setup, you can:
> - Review registration requests from your storefront
> - Approve and assign buyers to companies
> - Reuse your B2B pricing across products and customer groups

## 9. Footer

"Learn more about **Wholesale B2B Solution** or **contact support**."

## 10. Page states

| State | What the merchant sees |
|---|---|
| **Brand-new merchant** | Title "Get your B2B selling workflow ready" · setup guide at 0 of 3 with step 1 open · Needs attention shows "You're all caught up" · all numbers 0 · Registrations badge "No form" · Quotes card "Not installed" · What happens next shown. |
| **Setup in progress** | Same title · guide shows progress with the first unfinished step open · warnings appear as data comes in. |
| **Setup complete** | Title "Wholesale B2B Solution" · guide stays until dismissed · What happens next hidden. |

## 11. Data

Home **doesn't store anything new**. It reads what the app already has:
- companies and their locations;
- pricing and where each one is assigned;
- registrations and the registration form's status (not created / draft / live / turned off);
- quotes from the RFQ app, and whether the RFQ app is installed.

The only new setting is **whether the setup guide is dismissed**.

## 12. Change notes

**2026-09-25**
- Home added as the default landing screen; the Wholesale B2B Solution sidebar entry now opens it.
- The unassigned-pricing warning no longer counts pricing the merchant turned
  off; it only counts pricing that is turned on and assigned to nothing.
- Needs attention copy updated to the spec: "need B2B pricing", "Review registrations", "isn't published" / "available on your storefront",
  "pricing setups aren't assigned".
- Add company no longer opens its wizard on top of Home; it goes to the B2B Company list first and
  opens the wizard there.
- Dev strip: added **Preview empty quotes**, which shows the Quotes card as if the RFQ app is
  installed but no quotes have arrived yet.
- Demo data: the registration form now starts **created but not published**, so all 4 warnings
  show on Home without any clicks. Publishing it from the form builder clears the warning and
  completes setup step 3. Only one dev preview can be on at a time.
- The unassigned-pricing warning's **View pricing** now opens the Pricing library filtered to
  **Status: Inactive**, with the filter bar open.
- Removed the **open quotes need pricing** warning from Needs attention: the quote data model isn't
  right yet. Needs attention now has 4 warnings. The Quotes card in "Your B2B at a glance" stays.

## 13. Open items

- **Turned-off form has no warning.** If a published form is switched off, buyers can't apply,
  but the only sign is the grey "Form off" badge on the Registrations card.
- **Brand-new merchant sees "You're all caught up."** That reads oddly when nothing is set up yet;
  consider a different message, or hiding the card, until setup starts.
- **Dismissed guide can't come back**, and in the prototype the dismissal isn't saved (it
  reappears on reload). Production should save it per shop and offer a way to reopen the guide.
- **"B2B pricing" number is labelled "active" but includes scheduled pricing.**
- **The "Status: Inactive" filter also lists pricing the merchant turned off**, so the list can be
  longer than the warning's count (the warning leaves turned-off pricing out).
- **"N quantity breaks" counts all quantity-break pricing**, including unassigned or turned-off.
- **Prototype-only:** the dev strip ("Preview empty state", "Preview empty quotes") also shows in production builds;
  **Install app** and the footer help links are placeholders.
- **Quote warnings are on hold** until the quote data model is fixed (the removed open-quotes
  warning, and the proposed quote warnings below).
- **Proposed warnings, not built yet:**
  - Blocking now: blocked orders at checkout, orders held for review, wholesale customers without
    a price.
  - Coming up: pricing ending soon, pricing starting soon, quotes about to expire.
  - To do: closed quotes not turned into B2B pricing, locations with no buyers, payment terms not
    set, archived products still used by active pricing, form turned off.
  - Also proposed: group rows under these three urgency headings and show at most about 5 rows,
    with a "Show all" link.

## 14. File map

| Role | File |
|---|---|
| Home screen | `src/b2b/screens/Home.jsx` |
| Route + sidebar entry | `src/b2b/App.jsx` |
| Default screen, guide dismissed | `src/b2b/initialState.js`, `src/b2b/store.jsx` |
| Price lookup, pricing status | `src/b2b/pricing.js` |
