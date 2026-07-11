---
name: Finance Pro Dashboard
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006e2f'
  on-secondary: '#ffffff'
  secondary-container: '#6bff8f'
  on-secondary-container: '#007432'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#410004'
  on-tertiary-container: '#ef4444'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 1rem
  stack-gap: 0.75rem
  card-padding: 1.25rem
  touch-target: 2.75rem
---

## Brand & Style
The design system is engineered for high-stakes financial environments, emphasizing precision, clarity, and authority. The target audience includes active investors and analysts who require rapid data interpretation on mobile devices. 

The aesthetic is **Corporate Modern** with a focus on data density without clutter. It utilizes a structured, systematic approach to information architecture, ensuring that "Buy" and "Sell" signals are immediately perceptible while maintaining a professional, calm atmosphere through deep navy tones and generous white space.

## Colors
The palette is rooted in financial tradition but executed with modern vibrancy. 

- **Primary (Deep Navy):** Used for all structural elements, primary text, and heavy navigation components to instill a sense of institutional trust.
- **Secondary (Dynamic Green):** Reserved exclusively for positive movement, profit indicators, and "Buy" calls.
- **Tertiary (Vibrant Red):** Reserved for negative movement, loss indicators, and "Sell" calls.
- **Neutral (Slate White):** The background color provides a soft, low-glare surface that makes foreground cards and text pop.
- **Surface:** Pure white (#FFFFFF) is used for card containers to contrast against the neutral background.

## Typography
Inter is selected for its exceptional legibility and tabular numeric support, which is critical for financial data alignment. 

- **Data Alignment:** For all price points and percentages, ensure `font-variant-numeric: tabular-nums` is enabled to prevent "jitter" when values update in real-time.
- **Hierarchy:** Use `label-md` in Deep Navy at 60% opacity for metadata titles (e.g., "MARKET CAP") to keep the focus on the primary data values.
- **Weight:** Avoid weights below 400 to ensure readability on mobile screens under varying lighting conditions.

## Layout & Spacing
The layout follows a **fluid vertical stack** optimized for one-handed mobile use. 

- **Grid:** A standard 4-column mobile grid with 16px (1rem) side margins.
- **Vertical Rhythm:** Elements are grouped in logical "pods" using a 12px (0.75rem) gap. Larger sections are separated by 24px (1.5rem).
- **Density:** While the design is professional, we prioritize "tappability." All interactive elements must maintain a minimum height of 44px.

## Elevation & Depth
This design system uses a **Tonal Layering** approach combined with subtle ambient shadows to define the z-axis.

- **Level 0 (Background):** Neutral #F8FAFC.
- **Level 1 (Cards):** Pure White surface with a very soft shadow: `0px 4px 6px -1px rgba(15, 23, 42, 0.05), 0px 2px 4px -2px rgba(15, 23, 42, 0.05)`.
- **Active State:** When a card is pressed, it should subtly shrink (scale 0.98) rather than increase elevation, maintaining a tactile, "pressed-in" feel.
- **Separators:** Use 1px borders in #E2E8F0 for internal card divisions instead of shadows to keep the UI crisp.

## Shapes
The shape language balances modern approachability with corporate structure.

- **Cards & Sections:** Use `rounded-lg` (16px) for main dashboard containers to soften the data-heavy interface.
- **Buttons & Inputs:** Use `rounded-md` (8px) to provide a more precise, functional appearance.
- **Indicators:** Small status dots or "Buy/Sell" pills should use a full pill radius for immediate shape recognition.

## Components
- **Buttons:** Primary buttons use the Deep Navy (#0F172A) background with White text for high contrast. Secondary buttons use a Slate 100 background with Navy text.
- **Data Cards:** Essential containers for stock info. Must include a clear header (Ticker/Name) and a primary value (Price). Growth percentages are housed in "Trend Pills" (Green or Red background at 10% opacity with 100% opacity text).
- **Input Fields:** Clean outlines in Slate 200. On focus, the border shifts to Deep Navy. No shadows on resting state.
- **Sparklines:** Minimalist charts inside cards should use a 2px stroke width. The color of the line is determined by the period's net gain/loss (Green or Red).
- **Lists:** Transaction or watchlist items use a horizontal layout with the ticker icon on the left and the price/change right-aligned. Use subtle 1px dividers between items.