---
name: sfslides
description: "Skill: SF-Slides — Create & Edit Presentations. Use this skill whenever Daniel asks to create a presentation, generate slides, make a slide deck, build a presentation, or anything involving .sfslides files. Also trigger when the user mentions: presentation design, slide generation, keynote-style content, conference talks, pitch decks, or wants to export to PPTX. This skill gives you direct control over SF-Slides, a desktop presentation editor where you write JSON and the app renders it live. Even if the user just says 'make me some slides' or 'I need a deck for my talk', use this skill."
---

# Skill: SF-Slides — Create & Edit Presentations

You have direct control over SF-Slides, a desktop presentation editor. You create and modify presentations by writing `.sfslides` JSON files. The app hot-reloads when the file changes.

## Quick Start

```bash
# Write to BOTH locations:
/Users/danielcarreon/Developer/software/sf-slides/presentations/my-deck.sfslides
cp presentations/my-deck.sfslides ~/Documents/SF-Slides/presentations/
```

The Home Screen reads from `~/Documents/SF-Slides/presentations/`. Always copy there so it appears in "Recent Presentations".

## Canvas & Coordinate System

- Canvas: **1920 x 1080 pixels** (16:9)
- Origin: top-left (0, 0)
- All positions and sizes in **canvas pixels** (NOT points)
- Canvas DPI: 144 (1920 / 13.33 inches). This matters for PPTX import — see Font Size section.

## JSON Structure

```json
{
  "version": 1,
  "metadata": {
    "title": "Presentation Title",
    "author": "Daniel Carreon",
    "created": "2026-04-02"
  },
  "defaults": {
    "font_family": "Arial, Helvetica, sans-serif",
    "background": { "type": "solid", "color": "#0D0D0D" }
  },
  "slides": [
    {
      "id": 1,
      "background": { "type": "solid", "color": "#0D0D0D" },
      "elements": [...],
      "notes": "Speaker notes for this slide",
      "transition": "fade"
    }
  ]
}
```

---

## Element Types (7 total)

### 1. Text
```json
{
  "id": "s1_title", "type": "text",
  "content": "Hello World",
  "x": 120, "y": 100, "width": 800, "height": 80,
  "font_size": 56, "color": "#ffffff",
  "bold": true, "italic": false, "underline": false,
  "align": "left", "valign": "top",
  "font_family": "Arial, Helvetica, sans-serif",
  "line_spacing": 1.2, "letter_spacing": 0,
  "background": null, "padding": 0, "corner_radius": 0,
  "list_type": null
}
```
Required: `id`, `type`, `content`, `x`, `y`, `width`, `height`. Everything else has defaults.

**list_type**: `"bullet"` | `"numbered"` | `null` — auto-prepends bullets or numbers to each line.

### 2. Rich Text (mixed colors/sizes in one text block)
```json
{
  "id": "s1_mixed", "type": "rich_text",
  "runs": [
    {"text": "White text ", "font_size": 56, "color": "#ffffff", "bold": true},
    {"text": "GOLD text", "font_size": 56, "color": "#f69f02", "bold": true}
  ],
  "x": 120, "y": 300, "width": 1600, "height": 80,
  "font_family": "Arial, Helvetica, sans-serif",
  "align": "center"
}
```
Each run has: `text`, `bold`, `italic`, `underline`, `font_size`, `color`, `font_family`, `letter_spacing`.

### 3. Image
```json
{
  "id": "s1_img", "type": "image",
  "src": "/Users/danielcarreon/Developer/software/sf-slides/presentations/assets/photo.png",
  "x": 960, "y": 100, "width": 800, "height": 600,
  "fit": "cover", "corner_radius": 16, "opacity": 1.0
}
```

**CRITICAL: Image paths MUST be absolute.** Fabric.js cannot resolve relative paths. Always use full filesystem paths like `/Users/danielcarreon/...`.

### 4. Shape
```json
{
  "id": "s1_card", "type": "shape", "shape": "rounded_rect",
  "x": 120, "y": 300, "width": 720, "height": 200,
  "fill": "#1a1a1a", "corner_radius": 16,
  "stroke": {"color": "#f69f02", "width": 1},
  "shadow": {"color": "#f69f02", "blur": 20, "offset_x": 0, "offset_y": 0}
}
```
Shapes: `rect`, `rounded_rect`, `ellipse`, `triangle`, `diamond`, `star`, `hexagon`, `pentagon`, `arrow_right`, `arrow_left`

Fill can be gradient:
```json
"fill": {"type": "linear", "angle": 135, "stops": [{"offset": 0, "color": "#8C27F1"}, {"offset": 1, "color": "#0D0D0D"}]}
```

### 5. Line
```json
{
  "id": "s1_sep", "type": "line",
  "x": 120, "y": 280, "width": 80, "height": 0,
  "x1": 120, "y1": 280, "x2": 200, "y2": 280,
  "color": "#f69f02", "line_width": 2,
  "dash": [10, 5], "start_arrow": false, "end_arrow": false
}
```

### 6. Table
```json
{
  "id": "s1_table", "type": "table",
  "x": 120, "y": 300, "width": 1680, "height": 400,
  "cells": [
    ["Header 1", "Header 2", "Header 3"],
    ["Data A", "Data B", "Data C"]
  ],
  "header_row": true, "header_color": "#f69f02",
  "cell_color": "#1a1a1a", "text_color": "#ffffff",
  "border_color": "#333333", "font_size": 16, "corner_radius": 8
}
```

### 7. Chart
```json
{
  "id": "s1_chart", "type": "chart", "chart_type": "bar",
  "x": 200, "y": 300, "width": 1520, "height": 500,
  "data": {
    "labels": ["Q1", "Q2", "Q3"],
    "datasets": [{"label": "Revenue", "values": [10, 20, 30], "color": "#f69f02"}]
  },
  "show_legend": true, "show_values": true,
  "background": "#111111", "text_color": "#ffffff"
}
```
Types: `bar`, `line`, `pie`, `donut`

---

## Common Properties (ALL elements)

| Property | Type | Description |
|----------|------|-------------|
| `z_index` | number | Stacking order (higher = on top) |
| `rotation` | number | Degrees (0-360) |
| `opacity` | number | 0.0 (invisible) to 1.0 (opaque) |
| `locked` | boolean | Prevents editing in UI |
| `shadow` | object | Glow effect: `{color, blur, offset_x, offset_y}` |
| `animation` | object | Entry animation for presenter mode |

### Animation
```json
"animation": {"type": "fade_in", "order": 1, "duration": 400}
```
Types: `fade_in`, `slide_left`, `slide_right`, `slide_up`, `zoom_in`, `none`

Elements with `animation.order` appear one-by-one during presentation — click advances to next element before next slide.

---

## Slide Backgrounds

```json
{"type": "solid", "color": "#0D0D0D"}
{"type": "gradient", "angle": 135, "stops": [{"offset": 0, "color": "#1a0a00"}, {"offset": 1, "color": "#0D0D0D"}]}
{"type": "image", "src": "/absolute/path/to/bg.jpg", "fit": "cover"}
```

---

## CRITICAL RULES (Lessons Learned)

### 1. NO EMOJIS — EVER
Unicode emojis (🧠🚀📊💰 etc.) render as iOS-style colored glyphs on macOS WebKit. They look unprofessional and inconsistent.

**Instead, use single ASCII characters inside colored circles:**
```json
{"id": "s1_icon_bg", "type": "shape", "shape": "ellipse", "x": 160, "y": 284, "width": 36, "height": 36, "fill": "#f69f02"},
{"id": "s1_icon", "type": "text", "content": "$", "x": 160, "y": 293, "width": 36, "height": 18, "font_size": 16, "align": "center", "color": "#ffffff", "bold": true}
```

**Icon character map (use these instead of emojis):**
- Money → `$`  |  Metrics → `M`  |  People → `#`  |  Brain → `C`
- Growth → `^`  |  Target → `*`  |  Idea → `!`  |  Search → `Q`
- Warning → `!` (red circle)  |  Check → `+` (green circle)  |  AI → `AI`
- Date → `D`  |  Forward → `>`  |  Key → `K`

For list items, use `— ` (em dash + space) instead of ✅ or bullet emojis.

### 2. Image Paths MUST Be Absolute
Fabric.js runs in a browser context and cannot resolve relative filesystem paths. Always use absolute paths:
- **WRONG:** `"src": "assets/photo.png"`
- **RIGHT:** `"src": "/Users/danielcarreon/Developer/software/sf-slides/presentations/assets/photo.png"`

Generate images first, then reference them with full paths.

### 3. Font Size = Canvas Pixels (NOT Points)
When creating slides from scratch, `font_size` values are canvas pixel heights on the 1920x1080 coordinate system:
- Title: 48-72px
- Subtitle: 28-36px
- Body: 20-28px
- Label: 14-16px (ALL CAPS with letter_spacing 4-6)
- Footer: 12px
- Big numbers: 72-144px

**Do NOT confuse with PPTX point sizes.** When importing PPTX, the import code multiplies by 2 (144 DPI / 72 = 2) to convert points to canvas pixels.

### 4. Bokeh Must Be Subtle
Decorative bokeh ellipses should be barely visible — atmospheric, not solid circles:
- **Size:** 80-160px max (NEVER 200+)
- **Opacity:** 0.03-0.06 (NEVER above 0.08)
- **Shadow blur:** 20-30
- **Count:** 2-3 per slide max
- **Position:** Upper corners or edges, never center

### 5. Always Copy to Documents Directory
```bash
cp presentations/my-deck.sfslides ~/Documents/SF-Slides/presentations/
```
The Home Screen only reads from `~/Documents/SF-Slides/presentations/`.

### 6. Cards Should Use Full Width
On a 1920px canvas with 120px margins, cards have 1680px of usable space. Use it:
- 2-column grid: cards at 720px wide with 40px gap (120 + 720 + 40 + 720 + 120 = 1720)
- 3-column grid: cards at 520px wide with 40px gap
- Single card: 1680px wide

**Don't cluster cards in one corner leaving half the slide empty.**

### 7. Quote/Phrase Slides Need Atmosphere
A quote slide with just text looks bare. Always add:
- 2-3 subtle bokeh ellipses (different positions, 0.03-0.05 opacity)
- A horizontal separator line below the quote (80-200px, accent color)
- Generous vertical centering (y: 300-400 for the main text)

---

## Brand Colors

| Color | Hex | Use |
|-------|-----|-----|
| Amber (primary) | #f69f02 | Titles, numbers, borders, glow, callouts |
| Morado (secondary) | #8C27F1 | Labels, categories, section markers |
| White | #FFFFFF | Main titles, headings |
| Gray | #BBBBBB | Body text, descriptions |
| Dark BG | #0D0D0D | Slide backgrounds |
| Card BG | #1a1a1a | Card fills (NOT solid black) |
| Green | #00CC66 | Success, growth, positive |
| Red | #FF3333 | Error, danger, negative |
| Blue | #4488FF | Neutral/cool data |
| Dark gray | #555555 | Footer, placeholder text |
| Border | #333333 | Subtle borders, dividers |

---

## MANDATORY: Slide Infrastructure

Every slide MUST have:

### Footer
```json
{"id": "sN_footer_left", "type": "text", "content": "DANIEL CARREON | SAAS FACTORY", "x": 120, "y": 1020, "width": 600, "height": 24, "font_size": 12, "color": "#555555"},
{"id": "sN_footer_right", "type": "text", "content": "SECTION LABEL", "x": 1200, "y": 1020, "width": 600, "height": 24, "font_size": 12, "color": "#f69f02", "align": "right"}
```

### Section Label (on content slides)
```json
{"id": "sN_vbar", "type": "shape", "shape": "rounded_rect", "x": 120, "y": 100, "width": 4, "height": 24, "fill": "#f69f02", "corner_radius": 2},
{"id": "sN_label", "type": "text", "content": "SECTION NAME", "x": 136, "y": 98, "width": 400, "height": 28, "font_size": 14, "color": "#f69f02", "bold": true, "letter_spacing": 5}
```

### Glow Card
```json
{"id": "sN_card_bg", "type": "shape", "shape": "rounded_rect", "x": 120, "y": 300, "width": 720, "height": 200, "fill": "#1a1a1a", "corner_radius": 16, "stroke": {"color": "#f69f02", "width": 1}, "shadow": {"color": "#f69f02", "blur": 18, "offset_x": 0, "offset_y": 0}}
```

### Icon Badge (inside cards)
```json
{"id": "sN_icon_bg", "type": "shape", "shape": "ellipse", "x": 160, "y": 324, "width": 36, "height": 36, "fill": "#f69f02"},
{"id": "sN_icon", "type": "text", "content": "$", "x": 160, "y": 333, "width": 36, "height": 18, "font_size": 16, "color": "#ffffff", "bold": true, "align": "center"}
```

### Callout Bar
```json
{"id": "sN_callout_bg", "type": "shape", "shape": "rounded_rect", "x": 280, "y": 700, "width": 1360, "height": 60, "fill": "#1a1a1a", "corner_radius": 30, "stroke": {"color": "#333333", "width": 1}},
{"id": "sN_callout_icon", "type": "text", "content": ">", "x": 310, "y": 710, "width": 40, "height": 40, "font_size": 20, "align": "center", "color": "#f69f02", "bold": true},
{"id": "sN_callout_text", "type": "text", "content": "Key insight here.", "x": 360, "y": 713, "width": 1200, "height": 34, "font_size": 18, "color": "#f69f02", "italic": true}
```

### Bokeh Atmosphere
```json
{"id": "sN_bokeh1", "type": "shape", "shape": "ellipse", "x": 1500, "y": 80, "width": 120, "height": 120, "fill": "#f69f02", "opacity": 0.04, "shadow": {"color": "#f69f02", "blur": 25, "offset_x": 0, "offset_y": 0}},
{"id": "sN_bokeh2", "type": "shape", "shape": "ellipse", "x": 200, "y": 700, "width": 100, "height": 100, "fill": "#8C27F1", "opacity": 0.03, "shadow": {"color": "#8C27F1", "blur": 20, "offset_x": 0, "offset_y": 0}}
```

---

## Slide Patterns

### Statement/Quote
Main text centered (48-56px, white, bold) + accent subtitle below (28-32px, amber, italic) + 2-3 bokeh + separator line + footer.

### VS / Comparison
Two large cards side by side. Left: cold color border (#4488FF). Right: warm color border (#f69f02). Each has big number (72-96px) + label + description. "VS" text in gray between them.

### Timeline (Vertical)
Vertical line (2px, #333333) as spine. Nodes: colored ellipses (24-48px) along the line. Time labels left, descriptions right. Bigger node + glow for the key moment.

### Terminal Mockup
Dark rounded_rect (#111111, stroke #333333). Header bar (32px) with 3 dots (red/yellow/green ellipses 12x12). Content lines in monospace.

### Cards Grid (Glassmorphism)
2-3 column grid. Each card: shape bg (rounded_rect, #1a1a1a, glow stroke) + icon badge + title (white, bold) + description (gray). Different stroke colors per card.

### Image Placeholder
Rounded_rect (#1A1A1A) with dashed stroke (#f69f02, dash: [10, 5]). Centered text: "[INSERTAR IMAGEN: description]" in #555555.

### 60/40 Split
Left 60% (x:120, w:900): label + title + bullet items. Right 40% (x:1080, w:720): image or placeholder with accent border.

### Big Number
Huge number (96-144px, amber, bold, with glow) centered + subtitle below + 3 stat cards in a row.

### Escalating Data
Vertically stacked values increasing in size. Small gray → medium gray → HUGE amber with glow. Vertical line connector on left.

---

## Generating Images for Slides

Use the `image-generation` skill to create custom images:

```bash
cd /Users/danielcarreon/Developer/software/business-os/claudeclaw
npx tsx scripts/generate-image.ts \
  --prompt "Description of what to generate" \
  --size 2K --aspect 16:9 \
  --output /Users/danielcarreon/Developer/software/sf-slides/presentations/assets/image-name.png \
  --upload
```

Then reference with absolute path:
```json
{"type": "image", "src": "/Users/danielcarreon/Developer/software/sf-slides/presentations/assets/image-name.png", ...}
```

**Always create `mkdir -p presentations/assets/` first.**

---

## Complete Slide Example

```json
{
  "id": 3,
  "background": {"type": "solid", "color": "#0D0D0D"},
  "elements": [
    {"id": "s3_bokeh1", "type": "shape", "shape": "ellipse", "x": 1500, "y": 80, "width": 120, "height": 120, "fill": "#f69f02", "opacity": 0.04, "shadow": {"color": "#f69f02", "blur": 25, "offset_x": 0, "offset_y": 0}},
    {"id": "s3_bokeh2", "type": "shape", "shape": "ellipse", "x": 200, "y": 600, "width": 100, "height": 100, "fill": "#8C27F1", "opacity": 0.03, "shadow": {"color": "#8C27F1", "blur": 20, "offset_x": 0, "offset_y": 0}},
    {"id": "s3_number", "type": "text", "content": "$72,000+", "x": 160, "y": 250, "width": 1600, "height": 160, "font_size": 120, "color": "#f69f02", "bold": true, "align": "center", "shadow": {"color": "#f69f02", "blur": 20, "offset_x": 0, "offset_y": 0}},
    {"id": "s3_subtitle", "type": "text", "content": "Revenue en menos de 5 meses", "x": 360, "y": 430, "width": 1200, "height": 40, "font_size": 28, "color": "#BBBBBB", "align": "center"},
    {"id": "s3_sep", "type": "line", "x": 860, "y": 500, "width": 200, "height": 0, "x1": 860, "y1": 500, "x2": 1060, "y2": 500, "color": "#f69f02", "line_width": 2},
    {"id": "s3_stat1_bg", "type": "shape", "shape": "rounded_rect", "x": 260, "y": 550, "width": 380, "height": 120, "fill": "#1a1a1a", "corner_radius": 14, "stroke": {"color": "#f69f02", "width": 1}, "shadow": {"color": "#f69f02", "blur": 15, "offset_x": 0, "offset_y": 0}},
    {"id": "s3_stat1_num", "type": "text", "content": "700+", "x": 260, "y": 560, "width": 380, "height": 50, "font_size": 36, "color": "#f69f02", "bold": true, "align": "center"},
    {"id": "s3_stat1_label", "type": "text", "content": "miembros", "x": 260, "y": 618, "width": 380, "height": 30, "font_size": 16, "color": "#888888", "align": "center"},
    {"id": "s3_footer_left", "type": "text", "content": "DANIEL CARREON | SAAS FACTORY", "x": 120, "y": 1020, "width": 600, "height": 24, "font_size": 12, "color": "#555555"},
    {"id": "s3_footer_right", "type": "text", "content": "RESULTADO", "x": 1200, "y": 1020, "width": 600, "height": 24, "font_size": 12, "color": "#f69f02", "align": "right"}
  ],
  "notes": "Pause after showing the number. Let it breathe."
}
```

---

## QUALITY STANDARDS (Learned from Skywork comparison, Apr 2026)

### Typography Must Feel Heavy
Skywork presentations use thick, impactful typography. Our defaults were too light.
- **Big numbers** (revenue, stats): font_size 120-144, bold, with text glow shadow
- **Titles**: font_size 56-72, bold. Use `"font_family": "Impact, Helvetica Neue, Arial, sans-serif"` for extra weight on hero numbers
- **Subtitles with mixed color**: Use `rich_text` type with runs[] to color key words differently (e.g., "Revenue en menos de " white + "3 MESES" amber)

### Cards Must Have Visual Richness
Plain cards with just text look flat. Every card needs:
- **Icon at top**: Colored circle (48px) with ASCII character or generated PNG icon
- **Big number** in accent color (36-48px, bold)
- **Label** below in gray (16-18px, ALL CAPS)
- **Border glow** matching the accent color (shadow blur 15-20)
- **Consistent card sizing** across the row (all same width/height)

### Slides Need Background Depth
Skywork uses layered backgrounds (gradient + texture + decorative elements). Our solid #0D0D0D is too flat.
- **Use gradient backgrounds** on section openers and key slides (angle 135-160, from #0D0D0D to #1A1A1A or subtle purple/amber tint)
- **Add 2-3 decorative arcs** (large ellipses 400-700px, stroke-only, opacity 0.05-0.12, accent colors)
- **Subtle noise/texture** can be simulated with multiple tiny bokeh elements at very low opacity

### Images Must Be Embedded as Base64
Tauri WebView cannot resolve local file paths reliably. ALL images in sfslides files MUST be embedded as data URLs:
```bash
python3 -c "import base64; data=open('image.png','rb').read(); print(f'data:image/png;base64,{base64.b64encode(data).decode()}')"
```
This makes files larger but guarantees rendering in both dev and production.

### Statement Slides Need Atmosphere
A slide with just one big phrase looks bare. Always add:
- Gradient background (not flat solid)
- 2-3 bokeh elements (0.03-0.05 opacity)
- Horizontal separator line below the statement
- Generous vertical centering (y: 280-350)
- Optional callout bar at bottom with key insight

### Use Sketchnote Images for Complex Concepts
For slides explaining systems, pipelines, or architectures:
- Generate sketchnote-style images using video-visuals skill
- Place them near-fullscreen (60x40 to 1800x900) with corner_radius 16-20
- Add a callout bar below with the key takeaway
- The image IS the slide content, text elements are minimal (just the section label)

### Cover Image in Metadata
Add `cover_image_data` (base64 thumbnail, max 400px wide) to metadata for Home Screen preview:
```json
"metadata": {
  "title": "Presentation Title",
  "cover_image_data": "data:image/png;base64,..."
}
```

---

## Workflow Checklist

1. `mkdir -p presentations/assets/`
2. Generate any needed images (video-visuals or image-generation skill) → save to `presentations/assets/`
3. Write `.sfslides` JSON — embed images as base64 data URLs
4. Validate: `node -e "JSON.parse(require('fs').readFileSync('file.sfslides','utf8'))"`
5. Copy to `~/Documents/SF-Slides/presentations/`
6. Tell user to open in SF-Slides (or it appears in Recent)
7. **Verify with Playwright** on localhost:1420 — check fonts, images, layout
