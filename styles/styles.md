# Lexlab — Main-site Style History

Scope: this documents the **main app** (`src/app/*`, `src/components/*`) only.
The `/designs` M1/M2/M3 preview variants were exploratory, never part of the main
site, and were deleted — intentionally not documented here.

---

## v2 — "Modern Dark" (indigo → violet) — CURRENT

Direction: modern dark SaaS look (Vercel/Linear style) — near-black canvas with
ambient indigo/violet glows, glassy translucent cards, gradient primary actions,
semantic status colors. Dark mode is now the **default** theme; the light theme
(ThemeToggle) still works. Mobile-first layout, spacing, sizes and touch targets
were kept identical to v1.

### Global

- `src/app/globals.css`
  - `--background: #07070c` / `--foreground: #f4f4f5` in `.dark` (light unchanged).
  - `.dark body` gets the ambient canvas:
    `radial-gradient(900px 480px at 12% -6%, rgba(99,102,241,.16), transparent 62%)`,
    `radial-gradient(820px 460px at 88% -4%, rgba(139,92,246,.14), transparent 62%)`,
    `radial-gradient(1000px 620px at 50% 112%, rgba(56,189,248,.07), transparent 65%)`,
    `background-attachment: fixed`.
  - indigo `::selection`, indigo keyboard focus ring, thin scrollbars.
- `src/app/layout.tsx`
  - Inline theme script defaults to dark: `if(t!=='light'){add .dark}` (localStorage key `lexlab_theme`).
  - `<body>` has **no bg class** (canvas comes from CSS); footer glass border `dark:border-white/10`.

### Token recipes (Tailwind v4, `dark:` = `.dark`)

| Element | Light | Dark |
|---|---|---|
| Card / surface | `border-zinc-200 bg-white` | `dark:border-white/10 dark:bg-white/[0.04]` |
| Elevated (header, modal, drawer) | `bg-white/85 backdrop-blur-xl` | `dark:bg-[#0c0c14]/95 dark:border-white/10 dark:backdrop-blur-xl` |
| Primary button | `bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500` | `dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400` |
| Secondary / outline | `border-zinc-200` | `dark:border-white/15 dark:hover:bg-white/5` |
| Active pill / tab | `bg-indigo-600 text-white` | `dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25` |
| Input / select / textarea | `border-zinc-200` | `dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60` |
| Progress fill | `bg-indigo-600` | `dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500` (track `dark:bg-white/10`) |
| Links / hover text | `hover:text-indigo-600` | `dark:hover:text-indigo-300` |

### Semantic colors (colored status is allowed again)

| Meaning | Text | Soft surface |
|---|---|---|
| correct / success / paid / ✓ | `text-emerald-600 dark:text-emerald-400` | `bg-emerald-50 border-emerald-200 dark:bg-emerald-400/10 dark:border-emerald-400/30` |
| wrong / danger / ✗ / delete | `text-rose-600 dark:text-rose-400` | `bg-rose-50 border-rose-200 dark:bg-rose-400/10 dark:border-rose-400/30` |
| warning / pending / lock / unanswered | `text-amber-600 dark:text-amber-400` | `bg-amber-50 border-amber-200 dark:bg-amber-400/10 dark:border-amber-400/30` |
| info / accent / answers-with-key (●) | `text-indigo-600 dark:text-indigo-300` | `bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-400/30` |
| notes (✎) | `text-violet-600 dark:text-violet-300` | violet tints |
| нарийн жижиг text on amber | `text-amber-700 dark:text-amber-300` (small text contrast) |

### Component-specific decisions (kept deliberately)

- Destructive actions (`Устгах`, `✕` delete icons, `Арилгах`) = **rose**; everything else primary = indigo gradient.
- Notes `✎` trigger/badge = **violet** (distinct from info/amber).
- Unanswered (○) = amber; unknown (?) / paused = amber.
- Quiz hero "Үндсэн шалгалт" dark card: `dark:bg-gradient-to-br dark:from-indigo-600/25 dark:to-violet-600/20 dark:border-indigo-400/25` (light stays near-black).
- Home stat numbers: indigo / violet / sky / emerald (Нийт / Үндсэн / Дэд / Шалгалт+Сургалт).
- Plan promo (home) + exam banner (home): indigo/violet gradient surfaces.
- Calendar: exam day cells `dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/30`; today ring indigo.
- Plan page checklist ✓ colored with `first-letter:text-emerald-600 dark:first-letter:text-emerald-400`.
- Option rows in `AdminClient`/history use `!`-important overrides (`!border-emerald-500 !bg-emerald-50 dark:!bg-emerald-400/10`) so status tints beat the base card surface in Tailwind's cascade.
- Login view switcher (Нэвтрэх/Бүртгүүлэх/Нууц үг сэргээх) left as plain text buttons (no conditional classNames).
- Light-mode progress fill stayed `bg-zinc-900` (only dark got the gradient).

### Gotchas

- `dark:bg-gradient-to-br` only sets `background-image`. If the element also has a light `bg-white` base, the alpha stops composite over white in dark mode — always pair with a dark `background-color` (e.g. `dark:bg-white/[0.03]`). Fixed once on the home exam banner.
- Native `<select>` popup lists: light option text inherits `dark:text-zinc-100` while Windows Chrome paints the list white → invisible options. Fixed globally in `globals.css`: `select option { background-color: var(--background); color: var(--foreground); }` (theme vars, works in both modes).
- Native `<select>` width: a long selected option gives the select an intrinsic min-content width (grid/flex items default to `min-width: auto`) → overflows its card. Fixed globally: `select { min-width: 0; max-width: 100%; text-overflow: ellipsis; }` plus explicit `min-w-0` on BrowseClient's two selects.
- Native `<select>` OPEN list width is OS/browser-controlled and cannot be constrained by CSS — it widens to fit the longest option text. Fixed by replacing all 4 native selects (browse main/sub, exam-settings main/sub) with `src/components/DropSelect.tsx`, a custom dropdown modeled on the quiz setup "Дэд ангилал сонгох…" picker (button + fixed backdrop closer + `absolute left-0 right-0` panel with truncated options). Option labels, counts, 🔒 prefixes, disabled state and handlers unchanged; settings `label` wrappers became `div` + `aria-label` on the trigger.
- Status tints need `!` overrides where a base surface class is also present (see option rows above).

### Files restyled in this pass

`src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/browse/page.tsx`,
`src/app/quiz/page.tsx`, `src/app/admin/page.tsx`, `src/app/history/page.tsx`,
`src/app/calendar/page.tsx`, `src/app/login/page.tsx`, `src/app/plan/page.tsx`,
`src/components/Header.tsx`, `src/components/ThemeToggle.tsx`, `src/components/HomeCategories.tsx`,
`src/components/BrowseClient.tsx`, `src/components/QuizClient.tsx`, `src/components/AdminClient.tsx`,
`src/components/PaymentRequestButton.tsx`, `src/components/QuestionDiscussion.tsx`,
`src/components/QuestionNote.tsx`, `src/components/QuestionReport.tsx`.

Constraint honored: content, Mongolian copy, layout/spacing tokens and all features
were **not** changed — only `className` values (verified by stripping class tokens
from `git HEAD` vs working copy).

---

## v1 — "Monochrome Light" (previous main style, up to commit `c05f2d5`)

Direction: strictly monochrome, mobile-first, no green/amber/red anywhere
(RULES.md banned them). Default theme followed the OS (`prefers-color-scheme`);
`dark:` variants existed but were the same monochrome palette inverted.

### Tokens

| Element | Light | Dark |
|---|---|---|
| Body | `bg-zinc-50` | `dark:bg-zinc-950` |
| Card / surface | `border bg-white` | `dark:bg-zinc-900 dark:border-zinc-800` (nested `dark:bg-zinc-800 dark:border-zinc-700`) |
| Header | `border-b bg-white/90 backdrop-blur` | `dark:bg-zinc-900/90 dark:border-zinc-800` |
| Primary button | `bg-zinc-900 text-white hover:bg-zinc-800` | `dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200` |
| Active nav / pill | `bg-zinc-900 text-white` | `dark:bg-white dark:text-zinc-900` |
| Secondary button | `border` + `hover:bg-zinc-50` | `dark:border-zinc-700 dark:hover:bg-zinc-800` |
| Inputs | `border` focus `ring-zinc-900` | `dark:bg-zinc-900` neutrals |
| Progress | `bg-zinc-900` fill, `bg-zinc-100` track | zinc |
| Status (✓/✗/○) | **all zinc** — no semantic colors | zinc |

### Layout conventions carried into v2

- Mobile-first sizes: compact text (`text-[10px]`–`text-[15px]` on mobile), `rounded-lg sm:rounded-xl` / `rounded-xl sm:rounded-2xl` cards, `min-h-[36px]`–`min-h-[44px]` touch targets, page frame `max-w-6xl px-2 sm:px-6 py-4 sm:py-8`.
- `Header` sticky with mobile slide-in drawer; `BrandMark` uses `/logo-light.png` + `/logo-dark.png`.

---

## Timeline

1. **v1 Monochrome Light** — main site, live up to `c05f2d5` (price 39,900₮ commit).
2. **Preview experiments (deleted)** — `/designs` M1 Essential / M2 Paper / M3 Mono one-page
   then multi-page mirrors; built to compare directions. Removed entirely in the v2
   session (routes + `src/components/designs/` + `src/lib/designs.ts` + `src/lib/design-preview.ts`).
3. **v2 Modern Dark (indigo → violet)** — current. Main site restyled, dark default,
   semantic colors re-allowed. See token recipes above; mirrors `opencode/RULES.md`
   design rules and `opencode/START.md` current state.
