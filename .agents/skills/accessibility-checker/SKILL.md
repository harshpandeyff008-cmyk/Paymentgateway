---
name: accessibility-checker
description: Complete accessibility (a11y) audit and implementation guide adhering to WCAG 2.1 AA/AAA standards. Covers semantic HTML, ARIA attributes, keyboard navigation, focus management, and color contrast.
---

# Accessibility (A11y) & WCAG 2.1 Guidelines Skill

This skill provides mandatory checks and implementation patterns to ensure web applications are fully accessible to keyboard users, screen readers, and users with visual or motor impairments.

---

## 1. Semantic HTML Structure

- **Landmark Elements**: Use standard HTML5 landmarks instead of arbitrary `<div>` nesting:
  - `<header>`: Page or component header.
  - `<nav>`: Primary navigation links.
  - `<main>`: Core page content (must have only **one** per page).
  - `<aside>`: Complementary sidebars or secondary menus.
  - `<footer>`: Page or section footer.
  - `<section>` and `<article>`: Thematic content groupings (must contain a heading).
- **Heading Hierarchy**:
  - Always have exactly **one `<h1>`** per page.
  - Never skip heading levels (e.g., jump directly from `<h2>` to `<h4>`).

---

## 2. Keyboard Navigation & Focus Management

- **Visible Focus Rings**:
  - Never use `outline: none` without providing an alternative focus style!
  - Standard focus ring:
    ```css
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
    ```
- **Modal & Drawer Focus Traps**:
  - When a modal or drawer opens, programmatically move focus to the first interactive element or the close button.
  - Prevent `Tab` and `Shift+Tab` from escaping the modal while it is active.
  - Always support closing via the `Escape` key:
    ```javascript
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);
    ```
  - When the modal closes, return focus to the trigger button that opened it.
- **Skip Links**:
  - For pages with long navigation headers, provide a skip-to-content link:
    ```html
    <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md">
      Skip to main content
    </a>
    ```

---

## 3. ARIA Roles & Attributes Best Practices

- **Rule 1 of ARIA**: Use native HTML elements (`<button>`, `<a>`, `<input>`) whenever possible. Only use ARIA when native HTML cannot express the role or state.
- **Icon Buttons**:
  - If a button contains only an icon (e.g., an SVG cross or pencil), it **must** have an `aria-label`:
    ```html
    <button aria-label="Close dialog" class="...">
      <XMarkIcon aria-hidden="true" class="w-5 h-5" />
    </button>
    ```
  - Mark decorative SVGs with `aria-hidden="true"`.
- **Dynamic Content & Alerts**:
  - For toast messages, status banners, or live search results, use `role="status"` or `aria-live="polite"` so screen readers announce changes:
    ```html
    <div role="status" aria-live="polite" class="...">
      Payment verified successfully
    </div>
    ```
- **Expanded/Collapsed States**:
  - Accordions and dropdown triggers must declare `aria-expanded={isOpen}` and `aria-controls="menu-id"`.

---

## 4. Color Contrast & Visual Accessibility

- **WCAG 2.1 AA Contrast Requirements**:
  - **Normal Text (< 18pt / 24px)**: Minimum contrast ratio of **4.5:1** against the background.
  - **Large Text (≥ 18pt / 24px or bold ≥ 14pt / 18.5px)**: Minimum contrast ratio of **3:1**.
  - **UI Components & Graphical Objects**: Minimum contrast ratio of **3:1** (e.g., input borders, active icons, checkboxes).
- **Never Rely on Color Alone**:
  - Do not signify error, success, or status using color only.
  - Always pair color with an icon and clear text (e.g., a green checkmark + "Completed", red warning icon + "Failed").

---

## 5. Automated & Manual Audit Checklist

Before finishing any UI feature:
1. [ ] **Keyboard Test**: Can you navigate through the entire page and trigger all actions using only `Tab`, `Shift+Tab`, `Enter`, `Space`, and `Esc`?
2. [ ] **Label Test**: Does every form input have a linked `<label htmlFor="...">` or `aria-label`?
3. [ ] **Image Alt Text**: Do all informative images have meaningful `alt` text? Are decorative images marked `alt=""` or `aria-hidden="true"`?
4. [ ] **Screen Reader Contrast**: Are placeholder texts, badges, and muted text readable without straining?
5. [ ] **Touch Target Size**: Are all interactive elements at least 44x44px on mobile devices?
