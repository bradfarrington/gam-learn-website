# Reviews section (`reviews.js`)

Custom, on-brand replacement for the old GoHighLevel review-widget iframe.
Pulls **live, published reviews** straight from the CRM's Supabase database and
renders a branded carousel. No review dates are shown.

- Component: [`/_assets/reviews.js`](./reviews.js)
- Loaded site-wide (alongside `webhooks.js`) on every page, but **inert** unless
  a mount element is present — so adding the section anywhere is just one `<div>`.

---

## Adding the section to a page

Drop a single element where the section should appear:

```html
<!-- All published reviews -->
<div data-gl-reviews></div>

<!-- Only reviews in one category (by slug) -->
<div data-gl-reviews data-category="research"></div>
```

Optional attributes:

| Attribute       | Purpose                                                            |
| --------------- | ----------------------------------------------------------------- |
| `data-category` | Show only reviews linked to this **category slug** (see below).   |
| `data-heading`  | Render a heading above the carousel (e.g. on a page with no title).|
| `data-intro`    | Render an intro paragraph under the heading.                       |
| `data-limit`    | Cap the number of reviews requested.                              |

On the homepage the mount sits **inside the existing "Voices of Support"
heading block**, so it deliberately has no `data-heading`/`data-intro` — the
Framer heading already sits above it. On a fresh page with no heading of its
own, add them:

```html
<div data-gl-reviews
     data-category="membership"
     data-heading="What our members say"
     data-intro="Real words from people we’ve walked alongside."></div>
```

---

## Categories (filtering per page)

The CRM database models categories as a **many-to-many** relationship:

- `review_categories` — the list of categories (`name`, `slug`, `is_active`).
- `review_category_links` — joins a review to one or more categories.

`data-category` matches on the category **`slug`**. A page filtered to a slug
that has no published reviews yet simply **hides itself** (no empty section).

### One-time: create the categories

Run in the Supabase SQL editor (or add via the CRM UI if it exposes it):

```sql
insert into public.review_categories (name, slug, sort_order) values
  ('General',    'general',    1),
  ('Research',   'research',   2),
  ('Membership', 'membership', 3)
on conflict do nothing;
```

### Tag a review with a category

In the CRM, or via SQL — link a review to a category:

```sql
-- Example: put Marcus's review into 'research'
insert into public.review_category_links (review_id, category_id)
select r.id, c.id
from public.reviews r, public.review_categories c
where r.reviewer_name = 'Marcus' and c.slug = 'research'
on conflict do nothing;
```

> Reviews with **no** category link still appear on any unfiltered
> `<div data-gl-reviews>` (e.g. the homepage). They just won't appear on a
> page filtered to a specific slug until they're linked.

---

## How auto-updating works

The section fetches reviews on every page load, so there is **nothing to
rebuild or redeploy** when reviews change:

1. A review is added in the CRM (Reputation / Reviews).
2. When it's marked **published** (`reviews.is_published = true`) it appears
   on the site automatically.
3. Editing `sort_order` reorders the cards (ascending).
4. Linking it to a category makes it show on that category's filtered pages.

---

## Data source & security

- Reads go directly to Supabase PostgREST:
  `https://boelrbcmcotntfbukzfc.supabase.co/rest/v1/reviews`
- Uses the project's **publishable (anon) key**, which is designed to be
  public. It is embedded in `reviews.js` on purpose.
- **Row-Level Security** on the database only ever exposes:
  - `reviews` where `is_published = true`
  - `review_categories` where `is_active = true`
  - `review_category_links` for published reviews
  So no draft/unpublished review can ever leak, even though the key is public.
- No secret/service-role keys are used anywhere in the site.

## Resilience

If the network or database is unreachable, an **unfiltered** section falls back
to a bundled copy of the current reviews (defined at the top of `reviews.js`)
so the page never looks broken. Category-filtered sections hide instead.

If you significantly change the live reviews, you can refresh that bundled
fallback list in `reviews.js` (`FALLBACK_REVIEWS`) — it's optional and only
matters during an outage.

## ⚠️ This is a hydrated Framer page — two places were changed

The homepage ships Framer's client-side runtime, which **re-renders the section
after load**. So the old GoHighLevel embed lived in *two* places and both were
replaced with the `<div data-gl-reviews>` mount:

1. **Static HTML** — [`index.html`](../index.html) (the server-rendered markup).
2. **Framer module JS** — `_assets/fu/sites/3JNvQNDUeQYQkQWhoJZb7K/HB5x_…CUyg3kHT.mjs`
   (the `ScJHVLo45` node, formerly an `Embed` with the `reputationhub.site`
   widget). A backup of the original is at `/tmp/HB5x.backup.mjs` if needed.

Because the page hydrates, `reviews.js` also re-paints the carousel whenever
Framer empties the mount (MutationObserver + cached data), so the cards survive
hydration.

**If the site is ever re-exported / re-scrubbed from Framer**, both edits above
(and this component wiring) must be re-applied — re-exporting will bring the GHL
embed back.

### Deploy note (cache)

`vercel.json` serves `/_assets/*` as `immutable, max-age=1yr`. The edited
`HB5x…mjs` keeps its original filename, so **returning visitors with it cached
could still load the old embed** after deploy. Before going live, bust that one
file's cache (rename it to a fresh hash and update the single import reference in
the route module `augiA20Il.*.mjs`, or purge the asset). New visitors are
unaffected. Local preview (`serve.mjs`) sends no such cache header, so this only
matters in production.

## Accessibility / UX

- Native swipe + scroll-snap; arrow buttons and dot pagination.
- Keyboard: focus the carousel and use ← / →.
- Gentle autoplay that pauses on hover, focus, touch and when the tab is hidden;
  fully disabled under `prefers-reduced-motion`.
- Long reviews collapse to ~6 lines with a "Read more" toggle.
