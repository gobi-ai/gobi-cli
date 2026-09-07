# Design quality floor (HTML artifacts)

Anti-patterns and notes adapted from Anthropic frontend-design. Keep pages distinctive; avoid the default AI look.

## Visual anti-patterns

- Cream / off-white backgrounds paired with `#D97757` (or similar terracotta) accent — the cliché Claude/AI landing palette
- Acid-green or neon accents on near-black “hacker dark” themes
- Generic SaaS card grids: white cards, soft gray borders, identical 16px radius, purple/blue gradient buttons
- ALL-CAPS eyebrow labels (`OVERVIEW`, `FEATURES`) with wide letter-spacing
- Inter / Roboto / system-ui as the only type choice without a deliberate pairing
- Hero + three feature cards + testimonial cookie-cutter layout
- Decorative blur orbs, mesh gradients, and sparklines with no information role
- Overused glassmorphism or heavy drop shadows on every surface

## Writing

- No filler marketing (“seamlessly”, “unlock”, “next-gen”, “leverage”)
- Prefer concrete labels and short sentences over slogan stacks
- UI copy should match the artifact’s real purpose (dashboard metrics, report sections, demo controls)

## Motion

- Prefer subtle, purposeful transitions (opacity/transform < 200ms) over bounce or endless loops
- Respect `prefers-reduced-motion`
- Do not autoplay noisy animations in a sandboxed post iframe

## Quality floor

- Clear hierarchy: one focal point, then supporting structure
- Consistent spacing scale; align columns; avoid accidental 1–2px drift
- Accessible contrast; visible focus rings for interactive controls
- Self-contained HTML: inline CSS/JS; avoid CDN webfonts and remote scripts
- Works in a narrow sandboxed iframe as well as wider viewports
- After build, do a Chanel pass: tighten type, whitespace, and copy before `gobi personal artifact create|revise --kind html`
