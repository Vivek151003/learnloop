# Design system

LearnLoop should look like a product a front-end team built and shipped: familiar structure,
consistent components, and no decoration that doesn't do a job.

## History (and why it changed)

1. **v1** used default Tailwind indigo, Inter, soft shadows, a gradient hero card and pill badges.
   It read as an AI-generated template.
2. **v2** swapped that for a themed "exercise book" look (beige paper, serif headings, mono
   labels, coloured left borders). It was distinctive but still read as an art-directed concept,
   not a working app.
3. **v3 (current)** drops the theme and follows the conventions of real product UIs: an app shell,
   neutral grays, one brand colour, real icons, and the interaction patterns users already know.

References: Linear and Stripe (restrained neutrals, dense tables), Duolingo and Khan Academy
(lesson screen: close and progress on top, fixed bottom action bar), and teacher dashboards
generally (class overview plus a student drill-down, with at-risk students ranked first).

## Structure

| Pattern           | Where                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| **App shell**     | Fixed left sidebar with icons and a user menu; top bar and drawer below 1024 px                               |
| **Page header**   | Breadcrumbs, title, one-line description, primary actions on the right                                        |
| **Tabs**          | Class page: Overview, Students, Assignments                                                                   |
| **Lesson screen** | Full-screen: close and progress bar on top, one question, fixed bottom bar (Check, then marking and Continue) |
| **Tables**        | Search and filters in a toolbar, sortable headers, row hover, avatars, inline progress bars, pagination       |
| **Feedback**      | Toasts for confirmations, inline alerts for form errors, empty states with an icon and a next step            |

## Tokens (`apps/web/tailwind.config.js`)

The Tailwind palette is **replaced**, not extended, so only these colours exist.

| Token     | Use                                                                    |
| --------- | ---------------------------------------------------------------------- |
| `gray`    | 25–900 neutral scale. Page `gray-50`, panels white, borders `gray-200` |
| `brand`   | One blue: `brand-600` `#2457E6` for actions, links and active nav      |
| `success` | Correct answers, completed work, healthy mastery                       |
| `danger`  | Incorrect answers, overdue work, at-risk students, destructive actions |
| `warning` | Due soon, drafts, in-between mastery                                   |

- Type: the system font stack (SF Pro, Segoe UI, Roboto). 14 px base, `tabular-nums` on figures.
  Monospace only for class codes and audit log data.
- Radius 6 px on controls, 8 px on panels, full on pills and avatars. Panels use a 1 px border
  and a barely visible shadow.
- Icons: Lucide, always with a visible label or an `aria-label`.
- Every text colour pair meets WCAG AA (≥ 4.5:1). `gray-400` is for icons and hairlines only.

## Components (`components/ui.tsx`, `components/toast.tsx`)

Button, ButtonLink, IconButton, Card, CardHeader, PageHeader, Input, Select, TextArea,
SearchInput, FilterSelect, Badge, Avatar, StatCard, ProgressBar, Table helpers (`TableWrap`,
`Th`, `SortTh`, `Td`, `Pager`), Tabs, Modal, Alert, EmptyState, ErrorState, LoadingBlock, Code,
Toast. Pages build only from these.

## Rules

- No gradients or glows; no coloured side-border cards; no decorative badges ("New", "Live").
- Colour means state. Green is correct or done, red is wrong or at risk, amber is pending.
- Copy is plain and specific ("Due in 5 days", "3 of 10 answered"), not cheerful filler.
- Every screen has loading, empty and error states, and works from 360 px with no sideways scroll.
- Responsive grids need an explicit `grid-cols-1` base, otherwise a wide child can stretch the
  page on phones.
- Keyboard: visible focus ring everywhere, skip link, A–D keys on multiple-choice questions,
  `aria-live` marking, `aria-sort` on sortable columns.
