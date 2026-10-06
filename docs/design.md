# Design system

LearnLoop should look like a tool a developer and a teacher designed on purpose, not an
average of every SaaS template. Every visual default below is a decision, with the reason.

## Direction: an exercise book

Maths practice happens on paper. The UI borrows from that: a warm paper background, black ink,
one highlighter colour, and red and green used the way a teacher's pen uses them, only to mark work.

References studied: Brilliant (serif headlines, tactile black buttons, near-monochrome), Linear
(dense lists, hairline rules, restraint), Khan Academy (clear mastery language).

## Tokens (`apps/web/tailwind.config.js`)

| Token             | Value                 | Use                                                 |
| ----------------- | --------------------- | --------------------------------------------------- |
| `paper`           | `#F6F4EE`             | Page background                                     |
| `paper.raised`    | `#FFFEFB`             | Panels, inputs                                      |
| `ink`             | `#1C1B17`             | Text, primary buttons, focus ring                   |
| `ink.2` / `ink.3` | `#57534A` / `#6B665D` | Secondary text (both ≥ 4.5:1 on paper)              |
| `rule`            | `#E3DED2`             | Dividers and borders (no drop shadows on panels)    |
| `pencil`          | `#F2C230`             | The only highlight: current item, progress, mastery |
| `right` / `wrong` | `#276B43` / `#B23A26` | Marking answers and risk. Never decoration          |

The Tailwind palette is **replaced**, not extended, so `indigo-600` and friends don't exist.
Colour names must not collide with Tailwind utilities: `right` was renamed to `correct` because
`text-right` already means right-aligned text.

## Type

- **Source Serif 4** for page titles and questions. A question should read like a textbook.
- **IBM Plex Sans** for the interface.
- **IBM Plex Mono** for numbers, codes, timestamps and small labels (`.eyebrow`). Join codes,
  scores and counts line up in tables.
- All fonts are self-hosted (Fontsource), so the CSP stays `'self'`.

## Shape

- Radius 6px on panels and controls, 3px on small tags. No pill-everything.
- Panels have a 1px rule and no shadow. The only shadow is the solid 2px "key" ledge under
  buttons, which presses down on click.
- Lists and tables over card grids. Stats sit in one strip divided by rules, not four boxes.

## Rules of thumb

- No gradients, glow, emoji icons, or "Live"/"New" pills.
- Colour carries meaning: yellow = you are here / progress, green = correct, red = wrong or at risk.
- Copy is specific ("2 days overdue", "Q4 of 10") rather than cheerful filler.
- Every screen still has loading, empty and error states, and works from 360px.
