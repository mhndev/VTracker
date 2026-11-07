---
version: "superdesign-alpha"
name: "Void-frame portfolio"
description: "A near-black gallery shell that frames a bright, information-dense product mockup; glass utility controls, pill CTAs, and a dark 3-up related-work grid carry all remaining structure."
colors:
  background: "#000000"
  surface: "#181818"
  surface-alt: "#F0F0F0"
  text-primary: "#FFFFFF"
  text-secondary: "#6C87FB"
  text-tertiary: "#404565"
  accent: "#3A5EFB"
  accent-soft: "#6C87FB"
typography:
  display-lg:
    fontFamily: "Inter"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: "1.5"
    letterSpacing: "0.5px"
  body-md:
    fontFamily: "Inter"
    fontSize: "16px"
    fontWeight: 300
    lineHeight: "1.55"
  label-md:
    fontFamily: "Inter"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "1.5"
    letterSpacing: "0.5px"
  icon-accent:
    fontFamily: "icomoon"
    fontWeight: 400
spacing:
  base: "8px"
  gap: "40px"
  section-padding: "40px"
rounded:
  control: "5px"
  card: "3px"
  capsule: "100px"
  pill: "9999px"
components:
  button-hero-primary:
    background: "rgba(255, 255, 255, 0.08)"
    text-color: "#FFFFFF"
    radius: "100px"
    height: "40px"
    padding: "0px 14px"
  button-navbar-cta:
    background: "rgba(255, 255, 255, 0.1)"
    text-color: "#FFFFFF"
    radius: "100px"
    height: "40px"
    padding: "0px 20px"
    hover-background: "#333333"
  button-utility-pill:
    background: "rgba(255, 255, 255, 0.1)"
    text-color: "#FFFFFF"
    radius: "32px"
    height: "40px"
    padding: "0px"
    hover-background: "rgba(255, 255, 255, 0.2)"
  button-icon-circle:
    background: "transparent"
    text-color: "#FFFFFF"
    radius: "50%"
    height: "60px"
    padding: "0px"
  card-media-caption:
    background: "transparent"
    radius: "0px"
    padding: "0px"
  card-checklist:
    background: "transparent"
    radius: "0px"
    padding: "0px"
  card-tag-row:
    background: "transparent"
    radius: "3px"
    padding: "0px"
---
# Void-frame portfolio
Source: https://me.muz.li/khoajak/teaching-lms-classroom-management-dashboard

## Overview
This is a dark-mode-default gallery shell built to stage one dominant artifact: a bright SaaS-dashboard mockup suspended in black negative space. The system itself is minimal to the point of invisibility — an edge-to-edge transparent navbar, glass pill utility buttons, and a tight Inter type scale — so that nearly all visual interest lives inside the framed product image rather than the chrome around it. The aesthetic is closer to a digital product-shot studio or portfolio case-study page than a marketing site: black void, soft radial glow, glass controls, device mockups tilted and lit like photography.

## Composition
The first screen opens on an edge-to-edge black navbar holding a mark and a single CTA, followed by a byline row, a title line, and then the hero artifact itself — a dashboard screenshot inside a tilted laptop/tablet frame, occupying the majority of the viewport width within the 1200px content column. Scrolling down, the rhythm alternates between full-bleed black passages (pure void, sometimes a bare device photograph) and dense bright passages (the dashboard screenshot itself, cropped into different close-ups: a tablet-in-hand shot, a wall-mounted monitor shot, a flat desktop screenshot, a free-standing monitor render). A short project-description paragraph and a tag/link row break up the image sequence once, acting as the only pure-text band on the page. The page closes with a 3-up related-work card row and a dark multi-column footer. The deliberate choice is to let imagery carry the page almost entirely, rejecting a component-rich, card-grid marketing layout in favor of a sparse sequence of large visual beats separated by black — density is near-zero outside of the artifact itself.

## Colors
Background is true black (`#000000`), confirmed as the dominant pixel value at roughly 62% of the frame plus another 9% near-black surface tone (`#181818`) — this is an unambiguous dark-first system, not a light page with dark accents. Reversed into this void sits the product mockup itself, which reads as near-white/light-gray (`#F0F0F0` ~13%, `#FFFFFF` ~6%, `#D8D8D8` ~1%) — the mockup functions as a bright island, not the page chrome. Text ink is white (`#FFFFFF`) for primary labels, with a cool lavender-blue (`#6C87FB`) used as a secondary/muted ink and a deeper slate-indigo (`#404565`) for tertiary text — both read as cool-toned grays-with-a-tint rather than loud color. True brand/accent color is a saturated indigo-blue (`#3A5EFB`, with `#6C87FB` as its lighter alias), rationed almost entirely to link text and small in-mockup UI chips — it never fills a large surface. The author's own primitive scale (`--mantine-primary-color-0` through `-5`, `#E7F5FF` → `#339AF0`) confirms a blue-hue primary ramp that the page draws from sparingly. Everything else — borders, dividers, large surfaces — is deliberately left colorless: black, white, or transparent, so the one indigo accent and the mockup's internal UI colors (greens, oranges) are the only chroma in the system.

## Typography
A single Inter family carries every text role, with weight and tracking doing the differentiation work rather than size variation. A medium-weight 20px/1.5 line with 0.5px tracking (`display-lg`) serves headline-level text such as the title line beneath the byline. Body copy sits at 16px/300 weight with a relaxed 1.55 line-height (`body-md`), used for the project-description paragraph — notably light-weight for a dark background, keeping long-form text quiet. A 16px/600 semibold with the same 0.5px tracking (`label-md`) marks interactive labels — tag pills, footer column headers, nav items. An `icomoon` icon font supplies all pictographic glyphs (share, heart, link icons) inline with text at matching size. There is no serif or display accent face anywhere in the system — hierarchy is built entirely from this one grotesque sans at three weights.

## Layout
Content is held to a 1200px max-width column, centered in the black canvas, with generous unconstrained black above/below/beside it at wider viewports. Primary rhythm unit is a 40px gap/section-padding, with a secondary 8–16px micro-spacing scale (8, 10, 12, 16px) governing control padding and icon gaps. The only true multi-column grid is the closing related-work row: 3 columns, 40px gap, each item spanning roughly a third of the container in a single even row — a uniform card grid, not bento or masonry. Card corner radius across the system is minimal: 3px on the small in-mockup data rows, 0px on the outer media/caption and checklist card families, meaning nearly all rounding happens at the control level (buttons, capsules) rather than the card level. The page is single-track vertically — no sidebar, no sticky in-page nav beyond the top bar — so responsiveness is simply the column narrowing and images stacking full-width.

## Components
- **Navbar**: edge-to-edge square bar, full viewport width (0px inset either side), 90px tall, transparent background, sticky on scroll. Holds exactly 2 items — a logo mark on the left and one capsule CTA on the right (`rgba(255,255,255,0.1)` fill, `#FFFFFF` text, 100px radius, 40px height, 0px/20px padding, hover → `#333333` background). Square outer corners with a fully pill-shaped CTA inside is the governing contrast of this bar.
- **Hero primary button**: an observed near-white/glass solid pill sitting directly under the byline on the first screen — `rgba(255,255,255,0.08)` fill, `#FFFFFF` text, 100px (full pill) radius, 40px height, 0–14px padding. This is the single most emphasized control on the first screen and is distinct from the navbar's capsule CTA and from the glass utility pills measured further down the page.
- **Icon circle buttons**: transparent fill, 50% radius, 60px tall, no padding — used as a row of large circular icon affordances (share/like/link type actions) floating near the hero image, fully borderless until interacted with.
- **Utility glass pill buttons**: `rgba(255,255,255,0.1)` fill, `#FFFFFF` text, 32px radius, 40px height, appearing in the lower engagement row (like/share cluster) near the page end; hover brightens to `rgba(255,255,255,0.2)`. Slightly-rounded-to-full capsule feel, visually softer than the hero pill because of the lower radius relative to its height.
- **Media-caption card family**: transparent fill, 0px radius, 0px padding — a full-bleed image or device mockup followed immediately by a caption label; used ×3 in the closing related-work row, each occupying one of three equal columns.
- **Checklist/body card family**: transparent fill, 0px radius, 0px padding, anatomy of heading + list + body text — used for structural text blocks such as the project-description band and footer column groups (×4 column groups in the footer).
- **Dense data-row card**: 3px radius, 0px padding, arranged as 5 stacked full-width rows (100% item width each) — this maps to the in-mockup attendance/status list rows photographed inside the product screenshot, not a page-level component, but the clearest card rhythm the evidence captures.
- **Stat/feature grid**: a 5-column, 40px-gap grid with one wide lead row (28% height) followed by four equal rows (14% each) — appears inside the dashboard screenshot's own dashboard UI (metric + chart cluster), reproduced here as the card density reference for anyone rebuilding that inner screen.
- **Footer**: transparent background, no card surface, organized as label-column groups with 24 total links across columns (Products, Follow us, Company, Reach us) plus a brand mark and a two-line descriptive paragraph; a locale-switcher row of language abbreviations sits bottom-right.

## Graphics & Effects
A soft radial glow — `radial-gradient(rgba(255, 255, 255, 0.055), rgba(0, 0, 0, 0) 72%)` — sits behind the hero device mockup only, covering roughly 3% of total page area; it is a localized vignette light source behind the artifact, not a page-wide aurora wash, and the rest of the black canvas stays flat and unlit. Glass controls use layered inset shadows for edge definition: `rgba(255, 255, 255, 0.11) 0px 0px 24px 0px inset` for a soft inner glow and `rgba(255, 255, 255, 0.2) 0px 0px 0px 1px inset` for a crisp 1px inner border; a warm variant, `rgba(255, 180, 67, 0.12) 0px 0px 0px 1px inset`, appears on at least one highlighted control. Backdrop blur is heavy and double-pronged: `blur(50px)` for wide-area glass panels and `blur(14px) saturate(1.15) brightness(0.55)` for a darkened, saturation-boosted glass used behind floating UI (likely the engagement bar). The product mockup itself is treated as photography — tilted perspective, drop shadow, studio-lit device renders (laptop, tablet in hand, wall-mounted monitor, desktop monitor on a stand) rather than flat screenshots, reinforcing a case-study/portfolio presentation rather than a live app feel.

## Motion
Interactions are fast and linear-leaning: `color 0.15s ease-in`, `all 0.15s ease`, and combined `background-color, color 0.15s, 0.15s ease-in` transitions govern hover/focus state changes on buttons and links — snappy, sub-200ms, with an ease-in bias that suits quick utility feedback rather than springy entrances. Six distinct keyframe animations are registered on the page alongside CSS scroll-driven animation support, indicating scroll-triggered reveals (likely fade/slide-in on the image sequence and related-work cards) synced to scroll position rather than fixed timers.

## Guardrails
- Never fill the hero background with the radial-gradient glow at full-frame scale — it is a small halo behind the device mockup only, covering ~3% of the page; everywhere else stays flat black.
- Do not render the navbar as a centered or rounded capsule bar — it is edge-to-edge with 0px corner radii on all four corners; only its internal CTA is a pill.
- Keep the hero primary pill (`rgba(255,255,255,0.08)`, 100px radius, 40px height) distinct from the navbar CTA and the lower glass utility pills (32px radius) — do not substitute one variant's values for another.
- Do not introduce a second typeface; all hierarchy comes from Inter weight/tracking shifts plus the icomoon icon glyphs, never a serif or display font.
- Preserve near-zero card rounding (0–3px) on content cards; reserve larger/pill radii strictly for buttons and capsule controls.
- Do not saturate large surfaces with the indigo accent; it belongs to link text, small chips, and the primitive color ramp only.