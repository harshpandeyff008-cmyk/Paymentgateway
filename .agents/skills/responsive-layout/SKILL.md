---
name: responsive-layout
description: Comprehensive rules and techniques for crafting responsive web layouts, mobile-first design, fluid typography, dynamic grid and flexbox architectures, viewport units, and touch-target optimization.
---

# Responsive Layout & Mobile-First Design Skill

This skill provides comprehensive guidelines for designing fluid, adaptive, and mobile-friendly web layouts across all modern devices (phones, tablets, laptops, ultra-wides).

---

## 1. Mobile-First Principles

- **Mobile First Approach**: Always write the base styles for mobile screens (320px - 640px) first, then layer on complexity for larger screens using `min-width` breakpoints.
- **Tailwind Breakpoint Standard**:
  - Base: Mobile (< 640px)
  - `sm:`: Large mobile / small tablets (≥ 640px)
  - `md:`: Tablets (≥ 768px)
  - `lg:`: Desktops / Laptops (≥ 1024px)
  - `xl:`: Large desktops (≥ 1280px)
  - `2xl:`: Ultra-wide monitors (≥ 1536px)

```html
<!-- Example: Responsive 1 -> 2 -> 3 -> 4 column card grid -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
  <!-- Card Items -->
</div>
```

---

## 2. Dynamic Viewport & Mobile Safe Areas

- **Viewport Height**: Always prefer `100dvh` (dynamic viewport height) over `100vh` on mobile screens to prevent mobile browser URL address bars from cutting off content.
  - Tailwind: `min-h-[100dvh]` or `h-[100dvh]`
- **Safe Area Insets**: For bottom navigation bars or fixed elements on modern iOS/Android devices:
  ```css
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
  ```

---

## 3. Fluid Layouts & Modern CSS Grid

- **Auto-fit Responsive Grid**: Avoid hardcoding media queries when auto-fit grid can dynamically adjust:
  ```css
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 1.5rem;
  ```
- **Flexbox Wrapping & Gaps**: Always ensure flex items can wrap and do not break viewport widths:
  ```html
  <div class="flex flex-wrap items-center justify-between gap-3">
    ...
  </div>
  ```
- **Overflow Prevention**:
  - Never allow horizontal scroll on the root container (`overflow-x-hidden` on main container when needed).
  - Use `break-words`, `truncate`, or `line-clamp-*` for dynamic or user-generated text content.

---

## 4. Fluid Typography & Spacing

- **Fluid Text with Clamp**:
  - Headings should scale smoothly: `font-size: clamp(1.75rem, 4vw + 1rem, 3.25rem);`
  - Tailwind classes: `text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight`
- **Fluid Spacing (Padding/Margin)**:
  - Mobile containers: `px-4 py-6`
  - Tablet/Desktop containers: `md:px-8 md:py-12 lg:px-12`
  - Max-width wrappers: Always constrain content width for readability (e.g. `max-w-7xl mx-auto`).

---

## 5. Touch Targets & Mobile Usability

- **Minimum Touch Target**: Every button, link, toggle, or icon button must have a minimum clickable/tappable area of **44x44px** on touch devices.
  - If the visual icon is small (e.g. 20px), add padding: `p-3` or `min-h-[44px] min-w-[44px] flex items-center justify-center`.
- **Form Inputs on Mobile**:
  - Input font-size must be at least `16px` (or `text-base`) to prevent iOS Safari from auto-zooming into inputs.
- **Drawer / Hamburger Menus**:
  - Use a slide-over mobile navigation drawer on screens `< md:`.
  - Include backdrop overlay with click-to-dismiss and Esc-key dismiss.

---

## 6. Verification Checklist

When building or reviewing layouts:
1. [ ] Check layout at `375px` (iPhone SE/Mini standard).
2. [ ] Check layout at `768px` (iPad / Tablet vertical).
3. [ ] Check layout at `1024px` and `1440px` (Laptops & Desktops).
4. [ ] Verify no horizontal scrollbars occur on any viewport.
5. [ ] Ensure all action buttons are easily reachable and tappable with a thumb.
