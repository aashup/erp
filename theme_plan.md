# Add Accent Color Themes

## Context

The app currently has light/dark/system mode toggle. The primary color is hardcoded as **Blue** via CSS custom properties (`--color-primary-50` through `--color-primary-900`) in `fe/src/index.css` using Tailwind v4's `@theme` block. The user wants 2 additional color themes (accent colors) selectable from the frontend, independent of light/dark mode.

## Approach

Add **4 accent color options**: Blue (current default), Emerald (green), Violet (purple), and Rose (pink). These override the `--color-primary-*` CSS variables at runtime. Persisted in localStorage via themeStore. No backend changes needed.

---

## Files to Modify

### 1. `fe/src/store/themeStore.ts`
- Add `accent` state: `'blue' | 'emerald' | 'violet' | 'rose'` (default: `'blue'`)
- Add `setAccent()` action
- Persist to `localStorage` key `accent`

### 2. `fe/src/contexts/ThemeContext.tsx`
- Read `accent` from themeStore
- On accent change, apply CSS variable overrides on `document.documentElement.style`
- Define color palettes for each accent (50-900 shades)
- Expose `accent` and `setAccent` via context

### 3. `fe/src/pages/Settings.tsx`
- Add "Accent Color" section inside the existing Appearance card (below Light/Dark/System buttons)
- Show 4 colored circle buttons (blue, emerald, violet, rose) with a check mark on the selected one
- Clicking sets the accent

### 4. `fe/src/index.css`
- No changes needed — the `@theme` block stays as the default (blue). Runtime overrides via JS take precedence.

---

## Color Palettes

Using Tailwind's standard color scales:

**Blue** (default — no overrides needed):
50: #eff6ff, 100: #dbeafe, 200: #bfdbfe, 300: #93c5fd, 400: #60a5fa, 500: #3b82f6, 600: #2563eb, 700: #1d4ed8, 800: #1e40af, 900: #1e3a8a

**Emerald**:
50: #ecfdf5, 100: #d1fae5, 200: #a7f3d0, 300: #6ee7b7, 400: #34d399, 500: #10b981, 600: #059669, 700: #047857, 800: #065f46, 900: #064e3b

**Violet**:
50: #f5f3ff, 100: #ede9fe, 200: #ddd6fe, 300: #c4b5fd, 400: #a78bfa, 500: #8b5cf6, 600: #7c3aed, 700: #6d28d9, 800: #5b21b6, 900: #4c1d95

**Rose**:
50: #fff1f2, 100: #ffe4e6, 200: #fecdd3, 300: #fda4af, 400: #fb7185, 500: #f43f5e, 600: #e11d48, 700: #be123c, 800: #9f1239, 900: #881337

---

## Implementation Details

### themeStore changes
```ts
accent: (localStorage.getItem('accent') as AccentColor) || 'blue',
setAccent: (accent) => { localStorage.setItem('accent', accent); set({ accent }); }
```

### ThemeContext — apply accent
```ts
const accentPalettes = { blue: {...}, emerald: {...}, violet: {...}, rose: {...} };

useEffect(() => {
  if (accent === 'blue') {
    // Remove overrides — fall back to @theme defaults
    for (let i of shadeKeys) document.documentElement.style.removeProperty(`--color-primary-${i}`);
  } else {
    const palette = accentPalettes[accent];
    for (const [shade, color] of Object.entries(palette)) {
      document.documentElement.style.setProperty(`--color-primary-${shade}`, color);
    }
  }
}, [accent]);
```

### Settings UI — accent selector
Below the Light/Dark/System grid, add a row of 4 colored circles with labels. Selected one gets a ring + check icon.

---

## What Does NOT Change
- Light/dark/system toggle — completely independent
- Backend — purely frontend/CSS concern
- Any component code — everything uses `primary-*` classes already
- index.css `@theme` block — stays as default blue fallback

## Verification
- Select each accent color and confirm all primary-colored elements update (buttons, focus rings, badges, sidebar active state)
- Toggle dark mode — accent should persist
- Refresh page — accent should persist from localStorage
- Select "Blue" — should restore original colors exactly
