# Modern UI/UX, Web Design & Accessibility Standards

These rules enforce modern, premium frontend design and accessibility standards across all web components and pages in this project.

## 1. Visual Hierarchy & Aesthetics
- **Aesthetic Benchmark**: The user interface must look modern, professional, and visually engaging (reminiscent of Linear, Vercel, or Stripe interfaces).
- **Color Palettes**:
  - Dark mode backgrounds must use rich slate/zinc tones (`bg-zinc-950`, `bg-slate-900`) instead of flat black.
  - Pair subtle borders (`border-zinc-800` or `border-white/10`) with ambient card shadows.
  - Use high-contrast, purposeful accent colors (e.g. violet, blue, emerald).
- **Typography**:
  - Use clear size and weight hierarchy (e.g., tight bold headers, clean legible body, muted 60% opacity secondary info).

## 2. Reusable Component Rules
- Every clickable button or interactive card must have:
  - Hover state (lighten/darken + subtle lift)
  - Active state (`active:scale-[0.98]`)
  - Explicit keyboard focus ring (`focus-visible:ring-2`)
  - Disabled state with `opacity-50 pointer-events-none`
  - Smooth transitions (`transition-all duration-200`)

## 3. Responsive Layouts (Mobile-First)
- Always design mobile-first:
  - Base styles target mobile screens.
  - Breakpoints (`sm:`, `md:`, `lg:`, `xl:`) progressively adapt layout columns and spacing.
  - Use dynamic viewport heights (`min-h-[100dvh]`) for mobile full-screen views.
  - Touch targets must be at least 44x44px.

## 4. Accessibility (WCAG 2.1 AA)
- Never remove focus rings without an accessible `focus-visible` replacement.
- Icon-only buttons must have `aria-label`.
- Decorative icons must have `aria-hidden="true"`.
- Modals must support `Escape` key close and maintain focus trap.
- Ensure text contrast meets at least 4.5:1 ratio.
