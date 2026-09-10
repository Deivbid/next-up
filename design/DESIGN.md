# Next Up · visual direction 01

Status: David approved the graphite/lime direction on September 10, 2026. The local interface is implemented. References generated September 10, 2026 with ImageGen. The images are inspiration, not exact component specifications or functional screens.

## Read

A quiet gaming companion: graphite surfaces, soft lime for actions, game artwork for personality. No productivity scores, streaks, urgency or guilt about unfinished games.

| Token | Proposed value |
| --- | --- |
| Canvas | #141618 |
| Surface | #202326 |
| Text | #F3F4EF |
| Secondary text | #B1B8B5 |
| Accent | #CEE99B |
| Button text | #141618 |
| Body size | 16 px minimum for product content |
| Type family | One locally hosted sans family; reference resembles Geist |
| Corners | 12 px for surfaces, 8 px for controls |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32 / 48 |
| Motion | Short opacity/transform transitions; respect reduced motion |

Dark is the initial theme. The implemented light palette uses an off-white canvas with a deep green accent; both themes are included in the browser accessibility checks.

## Screen analysis

- **Today desktop:** strong current-game banner, full-width context row and up to three suggestions. Use this hierarchy, but ensure empty libraries and no eligible games have useful actions. The current PC game may appear while filtering Steam Deck; visually separate it from the filtered suggestions.
- **Today mobile:** compact current-game row and vertically stacked suggestions. The generated three-column filter row is too dense; use Device and Time in two columns and optional Genre below. Unify its title/subtitle with desktop. Remove the invented “See all” flow and replace generic claims such as “fits your time” with an explicit user preference or “Session fit unknown”.
- **Library:** cover-led two-column mobile grid, owned/wishlist switch and status filter. At 320 px stack the switch and filter. Use consistent cover aspect ratios, readable titles and a dignified no-cover fallback.
- **Add game:** title, result selection, ownership and explicit playable-device choices. Hide optional notes/session details behind disclosure. Reference selection inconsistency: Steam Deck appears selected; actual initial selection must not infer compatibility. Status applies to owned games; wishlist remains separate.
- **Steam preview:** selectable rows, explicit count and preservation notice. Display no checkbox as checked until selection state exists. PC ownership does not prove Steam Deck compatibility. Unknown/private library responses must not look like a successful empty import.

## Normalize during implementation

The five independent images drift in icon family, header scale, artwork, gradient buttons, corner radii and fake OS status bars. Use one icon family and solid accent buttons; omit simulated OS chrome. Keep 44 px targets, visible labels and keyboard focus. Optional game metadata must never become compulsory tracking.

References do not validate accessibility: implement semantic controls with shadcn/Radix and verify the rendered interface, including screen-reader names, focus restoration and reduced motion. Do not reproduce the images as a product UI background.

Taste's typography and restraint principles apply here; its marketing-page rules are not a reason to force a landing-page layout onto this app. Awesome DESIGN.md's Linear reference informs spacing and hierarchy, not brand copying.
