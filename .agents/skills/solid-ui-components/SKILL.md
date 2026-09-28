---
name: solid-ui-components
description: Guide for building robust, reusable, visually stunning UI components inspired by Shadcn/UI, Radix, and modern design systems. Covers state variants, micro-interactions, dark mode, glassmorphism, and color harmony.
---

# Solid UI Components & Modern Design System Skill

This skill guides the creation of production-ready, beautiful, and accessible UI components (Buttons, Cards, Inputs, Modals, Badges, Tables, Navbars) built for modern web applications.

---

## 1. Aesthetic Foundations & Visual Polish

- **Curated Color Palettes**:
  - Avoid raw primaries (`#ff0000`, `#0000ff`). Use curated, modern tones.
  - **Dark Mode**: Use deep zinc/slate tones (`#09090b`, `#0f172a`, `#18181b`) instead of harsh `#000000`.
  - **Subtle Borders**: Use 1px borders with low-opacity colors (`border-zinc-800` or `border-white/10`) to define hierarchy without visual clutter.
  - **Accent Colors**: Pair neutral backgrounds with an energetic accent (e.g. Electric Violet, Cyan, Emerald, or Sunset Amber).
- **Glassmorphism**:
  - Apply backdrop blur for overlays, headers, and floating cards:
  ```css
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  ```
- **Layered Elevation & Shadows**:
  - Use soft, ambient multi-layer shadows instead of harsh drop-shadows:
  ```css
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  /* Or Tailwind: shadow-md hover:shadow-lg hover:shadow-primary/10 */
  ```

---

## 2. Complete Component State Coverage

Every interactive component MUST explicitly handle all 6 visual states:

1. **Default State**: Clean, legible, inviting.
2. **Hover State**: Subtle brightness increase, gentle lift (`-translate-y-0.5`), or border highlight.
3. **Active / Pressed State**: Micro-scale down (`active:scale-[0.98]`) for tactile feedback.
4. **Focus-Visible State**: High-contrast outline or ring (`focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:outline-none`).
5. **Disabled State**: Opacity drop (`opacity-50 cursor-not-allowed pointer-events-none`).
6. **Loading State**: Subtle spinning indicator or skeleton shimmer; prevent duplicate actions.

---

## 3. Micro-Interactions & Animation Standards

- **Timing & Curves**:
  - Durations: `150ms` to `250ms` for micro-interactions (hover/active), `300ms` for modal/drawer transitions.
  - Easing curve: `cubic-bezier(0.16, 1, 0.3, 1)` (snappy ease-out) or standard `ease-in-out`.
  - Avoid slow transitions (> 400ms) for buttons and inputs.
- **Micro-interactions Checklist**:
  - Buttons: Smooth background transition, slight scale down on click.
  - Cards: Border glow or subtle translate up (`hover:-translate-y-1 hover:border-zinc-700`).
  - Inputs: Floating label or smooth focus ring expansion.
  - Dropdowns / Tooltips: Fade + scale up (`scale-95` to `scale-100` with `opacity-0` to `opacity-100`).

---

## 4. Reusable Component Patterns (Shadcn-Style)

### A. Modern Primary & Secondary Button
```jsx
export function Button({ variant = 'primary', size = 'md', isLoading, children, ...props }) {
  const base = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow-md hover:shadow-blue-500/25 focus-visible:ring-blue-500",
    secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 focus-visible:ring-zinc-400",
    ghost: "bg-transparent hover:bg-zinc-800/60 text-zinc-300 hover:text-white",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-sm hover:shadow-rose-500/25 focus-visible:ring-rose-500"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2.5"
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]}`} disabled={isLoading} {...props}>
      {isLoading ? <Spinner className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
}
```

### B. Modern Input Field with Floating Helper/Error
```jsx
export function InputField({ label, error, helperText, id, ...props }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-zinc-300">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border text-sm text-zinc-100 placeholder-zinc-500 transition-all duration-200 outline-none
          ${error 
            ? "border-rose-500/80 focus:ring-2 focus:ring-rose-500/30" 
            : "border-zinc-800 hover:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          }`}
        {...props}
      />
      {error && <span className="text-xs text-rose-400">{error}</span>}
      {!error && helperText && <span className="text-xs text-zinc-500">{helperText}</span>}
    </div>
  );
}
```

### C. Glassmorphism Card
```jsx
export function Card({ title, subtitle, children, className = "" }) {
  return (
    <div className={`rounded-xl bg-zinc-900/70 backdrop-blur-md border border-zinc-800/80 p-6 shadow-xl transition-all duration-200 hover:border-zinc-700/80 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>}
          {subtitle && <p className="text-sm text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
```

---

## 5. Summary Guidelines
- Never leave interactive components without focus or hover feedback.
- Keep border radiuses consistent across components (e.g. `rounded-lg` for buttons/inputs, `rounded-xl` for cards, `rounded-2xl` for modals).
- Always use high visual contrast for typography and critical indicators.
