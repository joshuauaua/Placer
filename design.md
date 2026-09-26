# PLACER Brand Kit
Desktop & Mobile · v1.0

The platform is black and white. The only colours are the three character colours: blue for the city worker, orange for the citizen and purple for the design practitioner.

---

## Typography

Font: **Helvetica** (Bold 700, Medium 500, Regular 400) · Fallback: Arial

| Style | Desktop (size / line height) | Mobile (size / line height) | Weight | Tracking |
|---|---|---|---|---|
| Display | 64 / 68px | 40 / 44px | Bold | -2% |
| H1 | 44 / 52px | 32 / 38px | Bold | -1% |
| H2 | 32 / 40px | 24 / 30px | Bold | -1% |
| H3 | 22 / 28px | 20 / 26px | Bold | 0 |
| Body large | 18 / 28px | 17 / 26px | Regular | 0 |
| Body | 16 / 24px | 16 / 24px | Regular | 0 |
| Label / button | 14 / 20px | 14 / 20px | Medium | +1% |
| Caption | 12 / 16px | 12 / 16px | Regular | +1% |

---

## Colour

### Neutrals

| Name | Hex | Use | Contrast on white |
|---|---|---|---|
| ink | #111111 | Text, primary buttons, icons, footer | 18.9 : 1 |
| grey-700 | #3D3D3D | Secondary text, primary hover | 10.9 : 1 |
| grey-500 | #6E6E6E | Captions, placeholders | 5.1 : 1 |
| grey-300 | #D6D6D6 | Borders, links in footer | — |
| grey-200 | #E6E6E6 | Card outlines, disabled | — |
| grey-100 | #F5F5F5 | Fills | — |
| white | #FFFFFF | Surfaces | — |
| cream | #FAF7F0 | Page background | — |
| error | #B3261E | Form errors | 6.5 : 1 |
| success | #1E7B3A | Confirmations | 5.3 : 1 |

### Character colours

| Step | City worker (blue) | Citizen (orange) | Design practitioner (purple) | Use |
|---|---|---|---|---|
| 50 | #EEF5FE | #FFF3E8 | #F4F0FE | Hover / selected backgrounds, comment highlight |
| 100 | #C6DEF8 | #FFD9B8 | #DDD2FA | Chips, avatars, pins, character buttons, favicon |
| 300 | #8DBBEF | #FDB27A | #B39DF2 | Map areas, chart fills, button hover (no text) |
| 700 | #1D5FA8 | #9E4600 | #5B3CB8 | Text, icons, outlines on white |
| 900 | #123F73 | #6B2E00 | #3A2480 | Text on 50 / 100 tints |

### Contrast rules

| Pair | Ratio | Result |
|---|---|---|
| Ink on any 100 pastel | 13.2 – 14.3 : 1 | AAA |
| blue-700 on white | 6.5 : 1 | AA |
| orange-700 on white | 6.3 : 1 | AA |
| purple-700 on white | 7.5 : 1 | AAA |
| 700 on its own 100 tint | 4.7 – 5.3 : 1 | AA |
| Ink on 12% glass over light map | ≈ 15 : 1 | AAA |
| White on any 100 pastel | 1.3 – 1.4 : 1 | Not allowed |
| orange-100 / 300 as text on white | 1.3 – 1.8 : 1 | Not allowed |

Only black text on pastels. Never white text on a pastel.

---

## Breakpoint

| | Mobile | Desktop |
|---|---|---|
| Window width | 0 – 1023px | 1024px and wider |
| Design width | 390px (min 360px) | 1440px |
| Content width | Full width, max 640px centred | Max 1440px centred |
| Side margin | 20px | 80px |
| Navigation | Glass bottom tab bar, 64px + safe area | Glass sidebar, 280px (collapsed 72px) |
| Map panel | Glass bottom sheet | Glass panel, 400px wide |
| Footer | Black, stacked | Black, one row / 4 columns |

Test widths: 360 · 390 · 768 · 1024 · 1440 · 1920px

---

## Corner radius & shadow

| Radius | Use |
|---|---|
| 12px | Buttons, inputs, chips, sidebar items, comments |
| 16px | Cards, glass panels, sidebar, bottom sheet, modals |

Avatars and pins are circles.

| Shadow | Value | Use |
|---|---|---|
| None | 1px grey-200 border | Cards, buttons, inputs, footer |
| Shadow | x 0 · y 8 · blur 24 · spread 0 · black 10% | Glass, sidebar, dropdowns, modals, card hover |

---

## Matte glass

| Property | Value |
|---|---|
| Fill | White, 12% opacity |
| Background blur | 24px |
| Saturation | 140% |
| Border | 1px white, 45% opacity |
| Radius | 16px |
| Shadow | y 8 · blur 24 · black 10% |
| Padding | 24px desktop · 16px mobile |
| Text | Ink only, min 14px |
| Fallback (no blur support) | White, 85% opacity |

Used for: map panels, sidebar, mobile tab bar, bottom sheet, map search bar, glass buttons on maps. Never glass on glass.

---

## Sidebar (desktop)

| Property | Value |
|---|---|
| Surface | Matte glass |
| Width | 280px · collapsed 72px |
| Inset | 12px from window edges |
| Radius | 16px |
| Item height | 48px |
| Item radius | 12px |
| Icon / label | 20px icon · 16px label |
| Active item | White 60% fill · Bold |
| Mobile | Becomes glass bottom tab bar, 64px |

---

## Footer

| Property | Value |
|---|---|
| Background | #111111 · no radius · no shadow |
| Headings | 14px Bold, white |
| Links | 14px Regular, grey-300 · hover white + underline |
| Wordmark | White, 16px cap height |
| Padding | Desktop 64px top/bottom, 80px sides · Mobile 40px / 20px |
| Divider | 1px grey-700 |
| Layout | Desktop 4 columns · Mobile stacked |
| Where | Content pages only, not on the map screen |

---

## Components

**Buttons**

| Property | Value |
|---|---|
| Height | 48px · 40px compact desktop · 44px min on mobile |
| Radius | 12px |
| Padding | 24px horizontal |
| Label | 14–16px Medium / Bold |
| Primary | Ink fill, white text · hover grey-700 |
| Secondary | White fill, 1px ink border · hover grey-100 |
| Text link | Ink, 1px underline |
| Disabled | grey-200 fill, grey-500 text |
| Glass button | Matte glass, maps only |
| Character button | 100 fill · 1px 700 border · ink text · hover 300 |
| Focus | 2px ink ring · 2px offset |

**Input**

| Property | Value |
|---|---|
| Height | 48px |
| Radius | 12px |
| Border | 1px grey-300 · focus 2px ink |
| Label | 14px Medium, 8px above field |
| Error | #B3261E border + message |

**Chip**: 32px high · 12px radius · 8px dot in 700 · 12px padding · 100 fill · ink label

**Card**: 16px radius · no shadow · 1px grey-200 border · 24px padding · shadow on hover

**Touch targets**: min 44 × 44px on mobile, 8px apart

---

## Characters in use

| Element | Spec |
|---|---|
| Avatar | 40px desktop · 36px mobile · 100 fill · 2px 700 ring · 16px bold initials |
| Comment | 50 tint background · 12px radius · 700 label (12px bold, +16% tracking) · ink text |
| Map pin | 24px · 100 fill · 2px 700 ring · 3px white halo · shadow |

---

## Wordmark

| Property | Value |
|---|---|
| Typeface | Helvetica Bold, uppercase |
| Tracking | +8% |
| Clear space | Height of the "P" on all sides |
| Cap height | Desktop 20px · Mobile 16px |
| Minimum width | 72px |
| Position | Top left · 80px margin desktop, 20px mobile |
| Colour | #111111 or white only |

---

## Favicon

Bench illustration on a #111111 square.

| Account | Bench colour |
|---|---|
| Default | White |
| City worker | blue-100 #C6DEF8 |
| Citizen | orange-100 #FFD9B8 |
| Design practitioner | purple-100 #DDD2FA |

| Property | Value |
|---|---|
| Sizes | 16 · 32 · 48 · 180 · 192 · 512px |
| Artwork | Bench fills 68% of the square, centred |
| Background | Square in browser tab · 22% radius as app icon |
| Stroke | 1px simplified bench at 16–32px · full drawing from 48px |

---

## Illustration

| Property | Value |
|---|---|
| Projection | Isometric, 30° |
| Stroke | 1.5px ink, round caps and joins · white fill |
| Tint circle | Character 100 behind the object · object at 64% of the circle |
| Size | Desktop 72–160px high · Mobile 48–72px high |
| Clear space | 48px from text |
| Mobile | Max 3 per screen |

---

## Background (isometric city)

| File | Use |
|---|---|
| placer_city_desktop.svg | Desktop background, 16:9, black lines |
| placer_city_desktop_light.svg | Desktop background, grey-300 lines, behind text and cards |
| placer_city_mobile.svg | Mobile background, portrait, black lines |
| placer_city_mobile_light.svg | Mobile background, grey-300 lines, behind text and cards |

The SVGs fill the window and crop the edges rather than stretching. Switch from the mobile file to the desktop file at 1024px. Use the light versions behind the landing page.
