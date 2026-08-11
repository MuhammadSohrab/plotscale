# PlotScale Typography Specification

Status: **Protected design reference**  
Applies to: Authentication, Dashboard, Unit Management, and future PlotScale UI  
Current source of truth: `src/styles.css` and `src/components/Brand.jsx`

## 1. Font families

### Primary UI font — Inter

```css
font-family: "Inter", system-ui, sans-serif;
```

Inter is the default font inherited by the entire application. It is used for:

- body text and descriptions;
- form labels, inputs, selects, and validation text;
- links and navigation;
- badges, status pills, notices, and helper text;
- unit names, supporting values, and table-like information.

Current Google Fonts request:

```css
Inter: 400, 500, 600
```

Fallback order:

1. Inter
2. operating-system UI font through `system-ui`
3. generic `sans-serif`

Important: some current selectors request Inter weights `700` and `800`.
Because those weights are not included in the present Google Fonts request, the
browser may synthesize them. This document records the current implementation;
future font packaging should include Inter 700 and 800 before font synthesis is
disabled.

### Display and brand font — Montserrat

```css
font-family: "Montserrat", sans-serif;
```

Montserrat is reserved for:

- the PlotScale brand name;
- primary page headings;
- major numerical results;
- primary and secondary action buttons;
- strong card titles where visual hierarchy is required.

Loaded weights:

```css
Montserrat: 600, 700, 800
```

Do not replace Montserrat with Inter for the PlotScale wordmark or main display
headings.

## 2. Protected PlotScale brand typography

The PlotScale brand lock-up contains two separate elements:

1. the original, unmodified `plotscale_logo_primary.svg`;
2. the text wordmark `PlotScale`.

The wordmark is split into two spans:

```jsx
<span>Plot</span><span>Scale</span>
```

### Standard horizontal brand

| Property | Value |
|---|---:|
| Font family | Montserrat |
| Font size | 25px |
| Font weight | 800 / Extra Bold |
| Line height | 1 |
| Letter spacing | -0.01em |
| Logo height | 40px |
| Gap between logo and name | 10px |
| Alignment | Horizontally centered |

Color:

- `Plot`: Navy `#1e3a8a`
- `Scale`: vertical green gradient from `#22c55e` to `#4ade80`

### Compact horizontal brand

| Property | Value |
|---|---:|
| Font family | Montserrat |
| Font size | 20px |
| Font weight | 800 |
| Line height | 1 |
| Letter spacing | -0.01em |
| Logo height | 38px |
| Gap | 10px |

### Standard stacked brand

| Property | Value |
|---|---:|
| Font family | Montserrat |
| Font size | 22px |
| Font weight | 800 |
| Logo height | 52px |
| Vertical gap | 10px |

### Compact stacked brand

| Property | Value |
|---|---:|
| Font family | Montserrat |
| Font size | 20px |
| Font weight | 800 |
| Logo height | 46px |
| Vertical gap | 10px |

### Unit-screen compact wordmark

Used in the Quick Converter header:

| Property | Value |
|---|---:|
| Font family | Montserrat |
| Font size | 18px |
| Font weight | 800 |
| Logo size | 31px × 31px |
| Gap | 7px |
| `Plot` color | `#1e3a8a` |
| `Scale` color | `#22c55e` |

### Brand protection rules

- Always use `/assets/plotscale_logo_primary.svg`.
- Never redraw, recolor, crop, distort, rotate, or generate another logo.
- Never change the `Plot` and `Scale` casing.
- Do not use a different font for the PlotScale wordmark.
- Keep the logo’s width automatic when only a height is specified.
- Do not place the brand name twice in the same header area.
- Maintain at least the existing 7–10px separation between logo and wordmark.
- The logo and brand text may be stacked only through the documented stacked
  variants.

## 3. Global type hierarchy

### Display headings

| Usage | Family | Size | Weight | Line height | Letter spacing |
|---|---|---:|---:|---:|---:|
| Welcome hero | Montserrat | `clamp(30px, 8vw, 36px)` | inherited heading emphasis | 1.12 | -0.035em |
| Dashboard hero | Montserrat | `clamp(30px, 6vw, 49px)` | inherited heading emphasis | normal | -0.035em |
| Guest heading | Montserrat | 24px | inherited heading emphasis | normal | -0.035em |
| Auth heading | Montserrat | 22px | inherited heading emphasis | normal | -0.035em |
| Unit page introduction | Montserrat | 18px | inherited heading emphasis | 1.25 | normal |
| Converter title | Montserrat | 18px | 700 | normal | normal |

The shared major-heading color is Navy `#1e3a8a`.

### Body text

| Usage | Family | Size | Weight | Line height | Color |
|---|---|---:|---:|---:|---|
| Welcome description | Inter | 15px | 400 | 1.55 | `#64748b` |
| Auth description | Inter | 13px | 400 | normal | `#64748b` |
| Guest description | Inter | 13px | 400 | 1.6 | `#64748b` |
| Dashboard description | Inter | inherited base | 400 | 1.6 | `#64748b` |
| Unit description | Inter | 10px | 400 | 1.5 | `#718096` |

### Labels and metadata

| Usage | Size | Weight | Tracking/transform |
|---|---:|---:|---|
| Eyebrow | 11px | 800 | 0.12em, uppercase |
| Form label | 12px | 700 | normal |
| Unit section label | 9px | 800 | 0.09em, uppercase |
| Converter FROM/TO label | 8px | 800 | 0.1em, uppercase |
| Live/Test labels | 7px | 800 | 0.1em, uppercase |
| Unit progress text | 9px | 700 | normal |

## 4. Authentication typography

| Element | Family | Size | Weight | Line height |
|---|---|---:|---:|---:|
| Login/Signup heading | Montserrat | 22px | display emphasis | normal |
| Introductory paragraph | Inter | 13px | 400 | normal |
| Field label | Inter | 12px | 700 | normal |
| Input text | Inter | inherited browser/UI size | 400 | normal |
| Password show/hide | Inter | 11px | 700 | normal |
| Forgot password | Inter | 12px | 600 | normal |
| OAuth divider | Inter | 11px | 400 | normal |
| Secondary auth button | Montserrat | 13px | 700 | normal |
| Sync banner | Inter | 12px | 400 | 1.45 |
| Account switch text | Inter | 13px | 400 | normal |
| Account switch link | Inter | 13px | 700 | normal |
| Error/success notice | Inter | 11px | 400 | 1.4 |
| Password rules | Inter | 10px | 400 | normal |
| Guest link | Inter | 12px | 700 | normal |

Primary and secondary global buttons use Montserrat at `15px / 700`.

## 5. Welcome, guest, and dashboard typography

### Welcome mode cards

| Element | Family | Size | Weight | Color |
|---|---|---:|---:|---|
| Card title | Montserrat | 15px | display emphasis | `#1e3a8a` |
| Card subtitle | Inter | 12px | 400 | `#64748b` |
| Authentication links | Inter | 13px | 600 | contextual |

### Guest screen

| Element | Family | Size | Weight |
|---|---|---:|---:|
| Heading | Montserrat | 24px | display emphasis |
| Description | Inter | 13px | 400 |
| Fact title | Inter | 12px | 700 |
| Fact detail | Inter | 10px | 400 |
| Back link | Inter | 12px | 400 |

### Dashboard

| Element | Family | Size | Weight |
|---|---|---:|---:|
| Hero heading | Montserrat | `clamp(30px, 6vw, 49px)` | display emphasis |
| Foundation card title | Montserrat | inherited | display emphasis |
| Prompt/card action | Inter | 12px | 700 |
| Part status note | Inter | 11px | 400 |

## 6. Unit Management typography

### Unit header and controls

| Element | Family | Size | Weight |
|---|---|---:|---:|
| Header title | Montserrat | 15px | display emphasis |
| Header subtitle | Inter | 9px | 400 |
| Offline badge | Inter | 9px | 800 |
| Intro heading | Montserrat | 18px | display emphasis |
| Intro description | Inter | 10px | 400 |
| Select-card label | Inter | 9px | 700 |
| Selected unit | Inter | 13px | 700 |
| Calibration warning | Inter | 9px | 400 |
| Toggle title | Inter | 11px | strong/inherited |
| Toggle example | Inter | 9px | 400 |
| Navigation title | Inter | 10px | strong/inherited |
| Navigation subtitle | Inter | 8px | 400 |
| Unit action button | Montserrat | 12px | 700 |
| Save confirmation | Inter | 9px | 700 |
| Error message | Inter | 9px | 400 |

### Calibration and derived family

| Element | Family | Size | Weight |
|---|---|---:|---:|
| Unit choice pills | Inter | 9px | 700 |
| Calibration equation | Inter | 10px | 700 |
| Equation inputs/selects | Inter | 10px | 700 |
| Hierarchy summary | Inter | 9px | 700 |
| Hierarchy fields | Inter | 9px | 400 |
| Derived card title | Inter | 10px | strong/inherited |
| Derived LIVE badge | Inter | 7px | 400 |
| Derived rows | Inter | 9px | 400/strong |
| Regional disclaimer | Inter | 8px | 400 |

### Custom Unit screen

| Element | Family | Size | Weight |
|---|---|---:|---:|
| Dimension tabs | Inter | 10px | 700 |
| Field labels | Inter | 9px | 700 |
| Field values | Inter | 11px | 400 |
| Live-test badge | Inter | 7px | 800 |
| Live-test input | Inter | 15px | 700 |
| Live-test unit symbol | Inter | 11px | 700 |
| Live-test main result | Montserrat | 18px | display emphasis |
| Live-test comparison | Inter | 9px | 400 |

### Quick Converter

| Element | Family | Size | Weight |
|---|---|---:|---:|
| Screen title | Montserrat | 18px | 700 |
| Screen subtitle | Inter | 9px | 400 |
| Input/output number | Montserrat | 26px | 700 |
| Unit selector | Inter | 10px | 700 |
| Breakdown label | Inter | 7px | 800 |
| Composite result | Montserrat | 14px | display emphasis |
| Equivalent values | Inter | 9px | 400 |
| Calibration hint | Inter | 9px | 400 |

## 7. Font-weight policy

Use these semantic meanings consistently:

| Weight | Meaning |
|---:|---|
| 400 | normal body text and supporting information |
| 500 | medium emphasis where normal text is too light |
| 600 | links and moderate emphasis |
| 700 | buttons, form labels, selected values, and strong UI controls |
| 800 | PlotScale wordmark, eyebrows, badges, and uppercase micro-labels |

Do not use font weights below 400. Avoid adding 900 unless the brand system is
formally revised.

## 8. Color tokens associated with typography

| Token/use | Value |
|---|---|
| Primary navy / brand `Plot` | `#1e3a8a` |
| Primary blue / interactive | `#2563eb` |
| Brand green / `Scale` | `#22c55e` |
| Brand green highlight | `#4ade80` |
| Primary body | `#17213a` |
| Muted body | `#64748b` |
| Light metadata | `#94a3b8` |
| Success | `#15803d` or `#16803c` |
| Warning | `#d97706` / contextual brown |
| Error | `#991b1b` or `#dc2626` |

## 9. Maintenance rules

Before changing typography:

1. Update this specification and `src/styles.css` together.
2. Confirm all four brand variants remain visually aligned.
3. Verify Login, Signup, Guest, Dashboard, Unit Defaults, Calibration, Custom
   Unit, and Converter at mobile and desktop breakpoints.
4. Do not modify the original SVG logo.
5. Do not introduce a third primary font without an approved brand revision.
6. Prefer reusable typography tokens over one-off page-specific values in future
   implementation work.

