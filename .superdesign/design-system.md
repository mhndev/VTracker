# Sentinel Fleet marketing design system

## Product and audience

Sentinel Fleet is a privacy-first, multi-tenant GPS fleet tracking demonstrator for fleet operators, reseller support teams, and platform operations. The landing page should convert operational leaders and service partners by making three promises immediately clear: live fleet visibility, customer-controlled location sharing, and safe operational boundaries.

The product deliberately excludes remote immobilization, production identity, billing, and unsupported hardware claims. Never imply that vehicle control is available. Platform administrators receive aggregate operations only and never coordinates.

## Brand idea

**Clarity without overreach.** Sentinel feels calm, precise, protective, and operationally capable. It should not look militaristic, surveillance-heavy, crypto-like, or like a generic purple SaaS template.

## Visual foundation

- Use `Manrope` for headings and display numbers, with tight `-0.035em` tracking.
- Use `DM Sans` for body copy, controls, labels, and navigation.
- Primary background `#f6f7fb`; white surface `#ffffff`; ink `#1d2033`; muted `#7c8298`; line `#e9eaf1`.
- Brand violet `#6558f5` and `#4e43d7`; restrained violet gradient `#7165ff → #5547dc` only for the mark, CTA emphasis, and selected states.
- Trust green `#1a9b70` / `#20ac79`; warning amber `#d88716`; risk red `#d84f5e`.
- Supporting tints: `#eeecff`, `#e4f7f0`, `#fff0e2`, `#e5f3fd`.
- Cards use 16px radius, 1px `#e9eaf1` borders, and soft low-opacity shadows.
- Buttons use 10–12px radius, strong concise labels, and clear focus/hover states.
- Use Lucide-style outline icons. Do not invent an unrelated icon style.

## Landing-page architecture

1. Slim navigation: Sentinel route-style mark and wordmark; Product, Privacy, For partners, Architecture; secondary “View demo” and primary “Open portal”.
2. Hero: assertive value proposition, short supporting copy, two CTAs, and trust indicators. Include a product-led hero visual that combines a simplified Berlin fleet map, live vehicle status, and explicit privacy grant state.
3. Proof strip: concrete MVP signals such as customer-controlled grants, separate admin plane, immutable audit trail, and OpenStreetMap attribution—not fabricated customer logos or business metrics.
4. Three capability sections: live fleet intelligence; scoped reseller collaboration; privacy and safety by design.
5. Product split-view: customer portal versus platform operations, emphasizing that platform views omit coordinates.
6. Security/architecture band: organization isolation, server-side policy enforcement, time-limited revocable grants, audit evidence.
7. Final CTA and restrained footer.

## Copy principles

- Prefer specific operational language over hype.
- Never fabricate customer counts, uptime percentages, testimonials, certifications, awards, or partners.
- Use demo facts from the codebase only: live map, devices, vehicles, alerts, reseller service relationships, temporary grants, audit events, separate admin plane.
- Say “local MVP” or “demonstrator” where needed; do not present it as a production-certified platform.

## Motion and responsiveness

- Use subtle 150–250ms hover/focus transitions and a restrained live-status pulse.
- Avoid parallax, looping decorative animation, autoplay video, or motion that competes with operational data.
- Desktop hero may be asymmetric; tablet and mobile must stack with CTAs and privacy messaging visible before the product visual.
- Preserve high contrast, semantic headings, keyboard-visible focus, and reduced-motion compatibility.

## Fidelity constraint

Use only the fonts, colors, spacing language, icon style, and component styles defined here and in the supplied source CSS. Do not introduce decorative serif fonts, neon colors, glassmorphism, pink gradients, black cyberpunk styling, or unrelated visual systems.
