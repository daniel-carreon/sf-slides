---
name: sfslides
description: "Skill: SF-Slides \u2014 Create & Edit Presentations. Use this skill whenever Daniel asks to create a presentation, generate slides, make a slide deck, build a presentation, or anything involving .sfslides files. Also trigger when the user mentions: presentation design, slide generation, keynote-style content, conference talks, pitch decks, or wants to export to PPTX. This skill gives you direct control over SF-Slides, a desktop presentation editor where you write JSON and the app renders it live. Even if the user just says 'make me some slides' or 'I need a deck for my talk', use this skill."
---

# SF-Slides — Create & Edit Presentations

You have direct control over SF-Slides, a desktop presentation editor. You create and modify presentations by writing `.sfslides` JSON files. The app hot-reloads when the file changes.

## Quick Start

To create a presentation, write a `.sfslides` JSON file to the presentations directory:

```bash
# Dev mode path:
/Users/danielcarreon/Developer/software/sf-slides/presentations/

# File: presentations/my-presentation.sfslides
```

Then tell the user to open it in SF-Slides (File > Open, or Cmd+O).

## Slide Coordinate System

- Canvas: **1920 x 1080 pixels** (16:9)
- Origin: top-left (0, 0)
- All positions and sizes are in pixels

## JSON Format

```json
{
  "version": 1,
  "metadata": {
    "title": "Presentation Title",
    "author": "Author Name",
    "created": "2026-04-01"
  },
  "defaults": {
    "font_family": "Inter, system-ui, sans-serif",
    "background": { "type": "solid", "color": "#0f0f17" }
  },
  "slides": [
    {
      "id": 1,
      "background": { "type": "solid", "color": "#0f0f17" },
      "elements": [...],
      "notes": "Speaker notes for this slide"
    }
  ]
}
```

## Element Types

### Text
```json
{
  "id": "el_1", "type": "text",
  "content": "Hello World",
  "x": 100, "y": 100, "width": 600, "height": 80,
  "font_size": 48, "color": "#ffffff",
  "bold": true, "italic": false, "underline": false,
  "align": "center", "valign": "top",
  "font_family": "Inter, system-ui, sans-serif",
  "line_spacing": 1.2,
  "background": null, "padding": 0, "corner_radius": 0
}
```
Only `id`, `type`, `content`, `x`, `y`, `width`, `height` are required. Everything else has sensible defaults.

### Image
```json
{
  "id": "el_2", "type": "image",
  "src": "https://example.com/photo.jpg",
  "x": 400, "y": 300, "width": 500, "height": 350,
  "fit": "cover", "corner_radius": 12,
  "opacity": 1.0
}
```
`src` can be a URL or a relative file path.

### Shape
```json
{
  "id": "el_3", "type": "shape",
  "shape": "rounded_rect",
  "x": 100, "y": 800, "width": 400, "height": 60,
  "fill": "#8B5CF6", "corner_radius": 30,
  "stroke": { "color": "#ffffff", "width": 2 }
}
```
Available shapes: `rect`, `rounded_rect`, `ellipse`, `triangle`, `diamond`, `star`, `hexagon`, `pentagon`, `arrow_right`, `arrow_left`

Fill can be a gradient:
```json
"fill": {
  "type": "linear", "angle": 135,
  "stops": [
    { "offset": 0.0, "color": "#8B5CF6" },
    { "offset": 1.0, "color": "#6D28D9" }
  ]
}
```

### Line
```json
{
  "id": "el_4", "type": "line",
  "x": 100, "y": 500, "width": 400, "height": 0,
  "x1": 100, "y1": 500, "x2": 500, "y2": 500,
  "color": "#ffffff", "line_width": 2,
  "start_arrow": false, "end_arrow": true,
  "dash": [10, 5]
}
```

### Common Properties (all elements)
- `z_index`: number (higher = on top)
- `rotation`: degrees (0-360)
- `opacity`: 0.0 - 1.0
- `locked`: boolean (prevents editing in UI)
- `shadow`: glow/shadow effect (see Glow Effect section below)

## Slide Backgrounds

```json
// Solid
"background": { "type": "solid", "color": "#0f0f17" }

// Gradient
"background": {
  "type": "gradient", "angle": 135,
  "stops": [
    { "offset": 0.0, "color": "#1e1b4b" },
    { "offset": 1.0, "color": "#0f0f17" }
  ]
}

// Image
"background": { "type": "image", "src": "url-or-path", "fit": "cover" }
```

## Brand Colors

| Color | Hex | Use |
|-------|-----|-----|
| Morado | #8B5CF6 | Primary accent |
| Ambar | #F59E0B | Secondary accent |
| Dark BG | #0f0f17 | Default slide background |
| Surface | #1a1a2e | Cards, panels |

## How to Create a Presentation

1. Create the `.sfslides` file with the JSON content
2. Use `mkdir -p presentations/` if needed
3. Write the file to `presentations/{name}.sfslides`
4. Tell the user to open it in SF-Slides

## How to Edit a Presentation

1. Read the existing `.sfslides` file
2. Modify the JSON (add/remove/edit elements, slides, notes)
3. Write the updated JSON back to the same file
4. The app auto-reloads within 200ms

## Design Tips (CRITICAL — follow these to produce professional output)

- Use dark backgrounds (#0D0D0D, #111111, #1A1A1A) — NEVER white
- Title text: 48-72px, bold, white
- Body text: 22-28px, #BBBBBB
- Use morado (#8B5CF6) for accents, highlights, key elements
- Use ambar (#F59E0B / #f69f02) as primary brand accent
- Leave generous margins (120-160px from edges)
- Complex slides can have 12-20 elements — DON'T be minimal, be RICH
- Use rounded_rect shapes as containers/cards
- Add speaker notes with key talking points
- Always use unique, descriptive element IDs like "s1_title", "s3_card1_bg"
- For multi-line text use \n in content strings
- Use z_index to layer elements (shape backgrounds below text, text on top)

## MANDATORY: Slide Infrastructure (EVERY slide must have these)

### Footer (REQUIRED on every slide)
Every slide MUST have a consistent footer:
```json
{"id": "sN_footer_left", "type": "text", "content": "DANIEL CARREON | SAAS FACTORY", "x": 120, "y": 1020, "width": 600, "height": 24, "font_size": 11, "color": "#555555"},
{"id": "sN_footer_right", "type": "text", "content": "CONTEXT LABEL HERE", "x": 1200, "y": 1020, "width": 600, "height": 24, "font_size": 11, "color": "#f69f02", "align": "right"}
```

### Vertical Accent Bar (on section/label slides)
Small vertical bar next to section labels:
```json
{"id": "sN_vbar", "type": "shape", "shape": "rounded_rect", "x": 120, "y": 230, "width": 4, "height": 24, "fill": "#f69f02", "corner_radius": 2}
```

### Mixed-Color Text (CRITICAL for visual impact)
When a title has ONE key word to highlight (e.g., "El churn es SILENCIOSO"), split into TWO text elements side by side:
```json
{"id": "sN_title_w", "type": "text", "content": "El churn es ", "x": 160, "y": 260, "width": 550, "height": 80, "font_size": 56, "color": "#ffffff", "bold": true, "align": "right"},
{"id": "sN_title_a", "type": "text", "content": "SILENCIOSO", "x": 710, "y": 260, "width": 600, "height": 80, "font_size": 56, "color": "#f69f02", "bold": true, "align": "left"}
```

### Callout Bar (on content slides)
Bottom callout with translucent background + icon + quote:
```json
{"id": "sN_callout_bg", "type": "shape", "shape": "rounded_rect", "x": 280, "y": 880, "width": 1360, "height": 60, "fill": "#1a1a1a", "corner_radius": 30, "stroke": {"color": "#333333", "width": 1}},
{"id": "sN_callout_icon", "type": "text", "content": "\u26a1", "x": 310, "y": 890, "width": 40, "height": 40, "font_size": 22, "align": "center"},
{"id": "sN_callout_text", "type": "text", "content": "Key insight or quote here.", "x": 360, "y": 893, "width": 1200, "height": 34, "font_size": 16, "color": "#f69f02", "italic": true}
```

### GLOW EFFECT (use on card borders and accent shapes)
Any element can have a shadow/glow via the `shadow` property. This is what makes cards feel like they "emit light" — matching the shadow color to the border color creates a colored glow around the shape.

```json
"shadow": {"color": "#f69f02", "blur": 20, "offset_x": 0, "offset_y": 0}
```

**When to use glow:**
- **Card glow**: Match shadow color to stroke color, blur 15-25, offset 0. This makes the card border appear to emit light, creating depth and a sci-fi feel.
- **Text glow**: Use white or accent color, blur 8-12. Makes titles pop off the dark background.
- **Accent shapes**: Match fill color, blur 20-30, for atmospheric bokeh-style glow.

**Example — glowing card with amber border:**
```json
{
  "type": "shape", "shape": "rounded_rect",
  "x": 200, "y": 300, "width": 460, "height": 260,
  "fill": "#1a1a1a", "corner_radius": 16,
  "stroke": {"color": "#f69f02", "width": 1},
  "shadow": {"color": "#f69f02", "blur": 20, "offset_x": 0, "offset_y": 0}
}
```

**Example — glowing bokeh orb:**
```json
{
  "type": "shape", "shape": "ellipse",
  "x": 300, "y": 80, "width": 120, "height": 120,
  "fill": "#f69f02", "opacity": 0.06,
  "shadow": {"color": "#f69f02", "blur": 30, "offset_x": 0, "offset_y": 0}
}
```

### ICON CENTERING (CRITICAL — icons look broken if off-center)
When placing unicode icons inside circles, precise centering matters. The icon text element must share the same `x` and `width` as the circle, and use `align: "center"`. The vertical position needs a manual nudge because text rendering adds ascender space.

**Formula for vertical centering:**
- icon_y = circle_y + (circle_height - icon_font_size) / 2 + 2  (the +2 compensates for text ascender)

**48px circle with 22px icon (most common):**
```json
{"id": "sN_icon_bg", "type": "shape", "shape": "ellipse", "x": 460, "y": 350, "width": 48, "height": 48, "fill": "#f69f02"},
{"id": "sN_icon", "type": "text", "content": "\u26a1", "x": 460, "y": 365, "width": 48, "height": 22, "font_size": 22, "align": "center"}
```

**36px circle with 18px icon (smaller variant):**
```json
{"id": "sN_icon_sm_bg", "type": "shape", "shape": "ellipse", "x": 300, "y": 400, "width": 36, "height": 36, "fill": "#8C27F1"},
{"id": "sN_icon_sm", "type": "text", "content": "\u2699", "x": 300, "y": 411, "width": 36, "height": 18, "font_size": 18, "align": "center"}
```

**Icon palette** (use these unicode symbols — they render well across platforms):
- \u26a1 (zap/power), \ud83c\udfaf (target), \ud83d\udcb0 (money), \ud83d\udd25 (fire), \u2699 (gear), \ud83d\udcca (chart), \ud83e\udde0 (brain), \ud83d\udd12 (lock), \ud83d\ude80 (rocket), \u25b6 (play), \ud83d\udcac (chat), \u23f0 (clock), \ud83d\udcc8 (growth), \ud83e\udd16 (robot), \ud83d\udca1 (bulb), \u2705 (check), \u26a0 (warning), \ud83d\udd04 (cycle), \ud83d\udc65 (people), \ud83d\udc8e (gem), \ud83d\udc7b (ghost), \ud83c\udf1f (star)

## Reusable Slide Patterns

### Pattern: Section Title
Label (ALL CAPS, accent color, 14-16px, letter_spacing 4-6) + Title (white, 64-72px, bold) + horizontal line (accent, 2px) + optional subtitle (gray, 18-24px). Use gradient background for section openers.

### Pattern: Statement/Quote
Single impactful text centered (48-72px, white bold) + optional accent subtitle below (28-36px, accent color, italic). Dark solid background. Maximum whitespace.

### Pattern: Icon Badge (CRITICAL — use on almost every content slide)
Colored circle + unicode symbol creates instant visual anchors. See ICON CENTERING section above for precise positioning. Add glow to the circle for extra impact:
```json
{"id": "sN_icon_bg", "type": "shape", "shape": "ellipse", "x": 460, "y": 350, "width": 48, "height": 48, "fill": "#f69f02",
 "shadow": {"color": "#f69f02", "blur": 15, "offset_x": 0, "offset_y": 0}},
{"id": "sN_icon", "type": "text", "content": "\u26a1", "x": 460, "y": 365, "width": 48, "height": 22, "font_size": 22, "align": "center"}
```

### Pattern: Cards Layout (Glassmorphism)
Cards with TRANSLUCENT backgrounds and colored border glow:
- Fill: "#1a1a1a" (NOT solid black — slightly lighter for translucency effect)
- Stroke: 1-2px with accent color
- Shadow/glow: match stroke color, blur 15-20
- Corner radius: 14-16px
- Each card should have an ICON BADGE at the top center or top-left
- Title bold white, description gray below
- Stack vertically (120px gap) or grid (2-3 columns)
- Cards can use different stroke colors for visual hierarchy (amber, purple, green, red)

### Pattern: Image Placeholder
Title above (white, 32-36px, centered, bold) + line separator (accent, centered) + large rounded_rect (fill "#1A1A1A", stroke accent 2px, corner_radius 16) + centered label "[INSERTAR IMAGEN]" (#555555, 18-20px).

### Pattern: 60/40 Split
Left 60% (x:120, width:900): label + title + body text + callout. Right 40% (x:1080, width:720): image placeholder with accent border. Good for principle/concept + visual slides.

### Pattern: Escalating Data
Vertically stacked text increasing in size: small gray (28px) -> medium gray (36px) -> HUGE accent (72-96px, bold). Vertical line on left as timeline connector. Creates visual crescendo.

### Pattern: Numbered Steps/Timeline
Ellipse shapes (120x120) with dark fill and accent stroke. Number text centered inside (32px, bold, accent). Labels below each circle (ALL CAPS, 16px). Connect with dashed line. Highlight one step with different accent color (e.g., purple for critical step).

### Pattern: Grid Stats
2x3 or 3x2 grid of cards. Each card: big number (48px, accent, bold) + label text (20px, gray). One card can have thicker border for emphasis. Equal spacing between cards.

### Pattern: Terminal/Code
Dark rounded_rect (fill "#111111", stroke "#333333", corner_radius 12). Title bar at top (32px height, with 3 colored dots: red/yellow/green ellipses 12x12). Code lines in Menlo monospace (15px) with syntax highlighting colors.

### Pattern: Pipeline/Flow Diagram
Horizontal row of cards connected by ">" arrow text elements. Each card has:
- Icon badge at top (colored circle + unicode)
- Title bold center
- Description small gray center
- Different border colors per step (e.g., amber->gray->gray->green->purple)
- Add glow to key steps (first and last cards)

### Pattern: Chart / Data Visualization
Build charts from shapes + lines + text. For exponential curves:
- Background rounded_rect card with border
- Title text at top of card
- X-axis: horizontal line with year labels (text elements)
- Y-axis: implied by data point positions
- Data points: small filled ellipses (10-14px) at calculated positions
- Curve: connect points with line elements between each pair of dots
- Value labels: small text above each data point
- This creates a REAL chart within the slide, not a placeholder

### Pattern: VS / Comparison
Two large numbers facing each other with "VS" in the center:
- Left card with colored border (e.g., blue #4488FF for negative)
- Right card with colored border (e.g., amber for positive)
- Each has: icon badge + HUGE number + label + sub-description
- "VS" text in gray between them

### Pattern: Decorative Elements
Bokeh: ellipse shapes (60-200px) with accent fill at 3-6% opacity + glow shadow.
Arcs: large ellipse shapes (400-600px) with stroke-only (no fill), accent colors at 8-15% opacity.
Separators: horizontal lines (accent color, 2px width, 200-400px long).
Curved lines: use line elements to suggest motion/growth curves.
