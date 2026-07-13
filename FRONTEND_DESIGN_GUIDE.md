# Frontend Design Guide

This document defines a practical design system and UI workflow for building a professional, modern, and appealing frontend.

## 1. Goals

- Professional: clear hierarchy, consistency, and polish.
- Modern: clean layouts, responsive behavior, subtle motion.
- Appealing: strong typography, intentional color, refined components.

## 2. Design Principles

- Consistency over novelty: reuse patterns and spacing.
- Clarity first: UI should feel obvious and low-friction.
- Accessibility by default: contrast, keyboard access, visible focus.
- Progressive enhancement: solid base UX before advanced effects.

## 3. Stack Assumptions

This guide is optimized for:

- React
- Tailwind CSS
- Component-driven architecture

If your stack differs, keep the same design rules and map tokens to your styling system.

## 4. Design Tokens

Use semantic tokens instead of hardcoded color values in components.

```css
:root {
  --color-bg: #f6f7fb;
  --color-surface: #ffffff;
  --color-surface-2: #f1f3f9;
  --color-text: #111827;
  --color-muted: #6b7280;
  --color-primary: #0f766e;
  --color-primary-contrast: #ffffff;
  --color-success: #15803d;
  --color-warning: #b45309;
  --color-danger: #b91c1c;
  --color-border: #d1d5db;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.10);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
}
```

## 5. Typography

- Use one display font and one body font.
- Suggested:
  - Display: `Manrope`
  - Body: `Inter`
- Type scale:
  - `h1`: 36/44
  - `h2`: 28/36
  - `h3`: 22/30
  - `body-lg`: 18/28
  - `body`: 16/24
  - `caption`: 14/20

## 6. Spacing and Layout

- Use an 8px baseline grid: `4, 8, 12, 16, 24, 32, 40, 48, 64`.
- Container widths:
  - `max-w-screen-sm` for forms-heavy pages.
  - `max-w-screen-xl` for dashboards.
- Keep section rhythm consistent (for example `py-12` desktop, `py-8` mobile).

## 7. Core Components

Each component should define purpose, variants, states, and accessibility.

- Button: primary, secondary, ghost, danger.
- Input: default, focus, disabled, error.
- Select/Dropdown: keyboard navigable, clear focus.
- Card: header/content/footer spacing standards.
- Modal/Drawer: focus trap + escape close.
- Table/List: compact and comfortable row modes.
- Toast/Alert: success/warning/error/info.

## 8. Interaction and Motion

- Motion should support understanding, not decoration.
- Transition duration: `150ms-250ms`.
- Use:
  - hover elevation on cards/buttons
  - fade/slide for modal entry
  - skeleton loading for async content
- Respect reduced motion preferences.

## 9. Accessibility Checklist

- Color contrast meets WCAG AA.
- Full keyboard support for interactive controls.
- Focus indicators always visible.
- Inputs have labels and error text.
- Tap targets at least `44x44`.
- No color-only status indicators.

## 10. Responsive Strategy

- Mobile-first breakpoints:
  - `sm 640`, `md 768`, `lg 1024`, `xl 1280`
- Mobile:
  - stacked sections
  - compact spacing
  - collapsible nav
- Desktop:
  - multi-column layouts
  - persistent navigation when useful

## 11. Page-Level UX Patterns

- Every page should handle:
  - loading state
  - empty state
  - success state
  - error state
- Use actionable empty states with clear CTAs.

## 12. Tailwind Conventions

- Prefer utility composition over deep custom CSS.
- Extract repeated patterns into shared components.
- Use `clsx` or equivalent for clean variant logic.
- Keep one source of truth for spacing, radius, and shadows.

## 13. Suggested Project Structure

```txt
src/
  components/
    ui/
      Button.tsx
      Input.tsx
      Card.tsx
      Modal.tsx
    layout/
      AppShell.tsx
      Header.tsx
      Sidebar.tsx
  pages/
  styles/
    tokens.css
    globals.css
```

## 14. Definition of Done (UI)

- Component matches token system.
- Works on mobile/tablet/desktop.
- Accessible via keyboard and screen-reader friendly labels.
- Visual states implemented (default/hover/focus/disabled/error/loading).
- No layout breaks at common viewport widths.

## 15. Quick Design Review Rubric

- Is the hierarchy clear in 3 seconds?
- Are primary actions obvious?
- Are similar things styled the same way?
- Is there enough whitespace?
- Do states communicate clearly?
- Is the page still usable without a mouse?

---

If needed, add a companion file named `UI_COMPONENT_SPEC.md` with exact props and states for each reusable component in this project.
