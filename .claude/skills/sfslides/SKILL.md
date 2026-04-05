---
name: sfslides
description: "Skill: SF-Slides — Create & Edit Presentations. Use this skill whenever Daniel asks to create a presentation, generate slides, make a slide deck, build a presentation, or anything involving .sfslides files. Also trigger when the user mentions: presentation design, slide generation, keynote-style content, conference talks, pitch decks, or wants to export to PPTX. This skill gives you direct control over SF-Slides, a desktop presentation editor where you write JSON and the app renders it live. Even if the user just says 'make me some slides' or 'I need a deck for my talk', use this skill."
---

# Skill: SF-Slides — Hybrid HTML + Elements Engine

You create presentations by writing `.sfslides` JSON files. Each slide has **two layers**:
1. `html` — Full HTML page for visual rendering (glassmorphism, blur, Inter 900, FA icons)
2. `elements[]` — Structured component array for PPTX export (each card/text/shape = separate editable PowerPoint object)

## Architecture: HTML Skin + Element Skeleton

```
Claude generates BOTH html AND elements[] per slide
  → App renders html via iframe (full CSS power)
  → PPTX export uses elements[] (editable components, not flat image)
  → Element overlay enables click-to-select in editor
```

Full CSS power via HTML:
- `backdrop-filter: blur()` — real glassmorphism
- `font-weight: 900` — Inter Black
- Font Awesome icons — real vector icons
- `filter: blur(80px)` — atmospheric bokeh
- `radial-gradient` — composite gradients
- `text-shadow`, `box-shadow` — glow effects
- All inline styles — NO Tailwind classes needed

### CRITICAL: NO CDN DEPENDENCIES

The HTML slides run inside Tauri WebView (WKWebView) which blocks external CDN resources in iframes. The app injects Inter + Font Awesome fonts automatically via embedded base64 data.

**DO NOT include** in generated HTML:
- `<link href="https://fonts.googleapis.com/...">` — REMOVED AUTOMATICALLY
- `<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/...">` — REMOVED AUTOMATICALLY  
- `<script src="https://cdn.tailwindcss.com">` — REMOVED AUTOMATICALLY
- Any external `<link>` or `<script>` tags

**DO use:**
- `font-family: 'Inter', sans-serif` — works (font injected by renderer)
- `class="fas fa-robot"` or `class="fab fa-youtube"` — works (FA CSS injected by renderer)
- Inline `style="..."` for ALL layout/colors — REQUIRED (no Tailwind classes)
- Font Awesome icon elements: `<i class="fas fa-icon-name"></i>` — works

## Quick Start

```bash
# Write the .sfslides file
# Then copy to both locations:
cp my-deck.sfslides ~/Documents/SF-Slides/presentations/
```

## JSON Structure

```json
{
  "version": 1,
  "metadata": {
    "title": "Presentation Title",
    "author": "Daniel Carreon",
    "created": "2026-04-04"
  },
  "slides": [
    {
      "id": 1,
      "html": "<!DOCTYPE html><html>...</html>",
      "elements": [
        {"id": "s1_title", "type": "text", "content": "Title", "x": 120, "y": 300, "width": 1680, "height": 100, "font_size": 96, "color": "#ffffff", "bold": true, "align": "center"},
        {"id": "s1_card1_bg", "type": "shape", "shape": "rounded_rect", "x": 200, "y": 500, "width": 480, "height": 300, "fill": "#1a1a1a", "corner_radius": 20, "stroke": {"color": "#f69f02", "width": 1}, "shadow": {"color": "#f69f02", "blur": 20, "offset_x": 0, "offset_y": 0}},
        {"id": "s1_card1_txt", "type": "text", "content": "Card text", "x": 240, "y": 560, "width": 400, "height": 40, "font_size": 28, "color": "#f69f02", "bold": true}
      ],
      "notes": "Speaker notes for this slide"
    }
  ]
}
```

Each slide has:
- `id` — unique number
- `html` — **complete HTML document** for visual rendering (Tailwind + Inter + FA)
- `elements[]` — **structured components** for PPTX export + element selection
- `notes` — speaker notes (optional, shown in presenter mode)

**CRITICAL: Always generate BOTH `html` AND `elements[]`.** The html is what the user sees. The elements are what PowerPoint gets.

---

## HTML Slide Template

Every slide follows this base structure. Copy and adapt per slide:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <!-- NO CDN links needed! Inter + Font Awesome are injected by the renderer -->
  <style>
    body {
      font-family: 'Inter', sans-serif;
      width: 1920px; height: 1080px;
      margin: 0; overflow: hidden;
      background: #0D0D0D; color: #FFFFFF;
    }
    .slide { width: 1920px; height: 1080px; position: relative; }
    .glass {
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(12px);
      border-radius: 16px;
    }
    .bokeh {
      position: absolute; border-radius: 50%;
      filter: blur(80px); pointer-events: none;
    }
    .glow-amber {
      border: 1px solid rgba(246,159,2,0.5);
      box-shadow: 0 0 20px rgba(246,159,2,0.15);
    }
    .glow-purple {
      border: 1px solid rgba(140,39,241,0.5);
      box-shadow: 0 0 20px rgba(140,39,241,0.15);
    }
    .text-glow { text-shadow: 0 0 20px rgba(246,159,2,0.4); }
    .text-glow-purple { text-shadow: 0 0 20px rgba(140,39,241,0.4); }
  </style>
</head>
<body>
  <div class="slide flex flex-col justify-between p-16">
    <!-- Atmospheric bokeh -->
    <div class="bokeh w-96 h-96 bg-amber-500/10 -top-24 -left-24"></div>
    <div class="bokeh w-80 h-80 bg-purple-600/10 -bottom-20 -right-20"></div>

    <!-- Content goes here -->

    <!-- Footer (MANDATORY on every slide) -->
    <div class="flex justify-between text-xs tracking-widest text-gray-600 uppercase border-t border-white/10 pt-6">
      <span>DANIEL CARREON | SAAS FACTORY</span>
      <span class="text-amber-500">SECTION NAME</span>
    </div>
  </div>
</body>
</html>
```

**IMPORTANT:** Slide dimensions are **1280x720** in the HTML (standard web resolution). The iframe renderer scales it to fit the display. This is how Skywork does it — CDN scripts (Tailwind) work best at standard viewport sizes.

---

## Brand Constants

### Colors
| Color | Hex | CSS Class / RGBA |
|-------|-----|-----------------|
| Amber (primary) | #f69f02 | `text-[#f69f02]`, `rgba(246,159,2,...)` |
| Purple (secondary) | #8C27F1 | `text-[#8C27F1]`, `rgba(140,39,241,...)` |
| Dark BG | #0D0D0D | `bg-[#0D0D0D]` |
| Card BG | rgba(0,0,0,0.6) | Glass card background |
| Text primary | #FFFFFF | White |
| Text secondary | #BBBBBB | `text-gray-400` |
| Text muted | #555555 | `text-gray-600` |
| Success | #00CC66 | `text-[#00CC66]` |
| Error | #FF3333 | `text-[#FF3333]` |

### Typography
| Element | Size | Weight | Style |
|---------|------|--------|-------|
| Big titles | 64-96px | 900 (Black) | `text-glow` on accent words |
| Subtitles | 24-32px | 700 | Gray |
| Body text | 16-20px | 400 | `text-gray-400` |
| Labels | 12-14px | 700 | UPPERCASE, `tracking-[0.3em]` |
| Big numbers | 72-120px | 900 | Amber + `text-glow` |
| Code | 14-18px | 400 | `font-mono` |

### Icons (Font Awesome)
Use real Font Awesome icons instead of ASCII characters:
- `fa-microchip` — tech/AI
- `fa-users` — community/people
- `fa-rocket` — traction/growth
- `fa-robot` — agents/AI
- `fa-code` — code/development
- `fa-server` — production/infra
- `fa-hammer` — volume/work
- `fa-bolt` — impact/energy
- `fa-chart-line` — metrics
- `fa-dollar-sign` — money/revenue
- `fa-shield` — security/protection
- `fa-brain` — intelligence
- `fa-fire` — hot/trending
- `fa-arrow-right` — flow/next
- `fa-quote-left` — quotes

### Effects
| Effect | CSS |
|--------|-----|
| Glassmorphism | `background: rgba(0,0,0,0.6); backdrop-filter: blur(12px); border-radius: 16px;` |
| Bokeh | `position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.1;` |
| Amber glow border | `border: 1px solid rgba(246,159,2,0.5); box-shadow: 0 0 20px rgba(246,159,2,0.15);` |
| Purple glow border | `border: 1px solid rgba(140,39,241,0.5); box-shadow: 0 0 20px rgba(140,39,241,0.15);` |
| Text glow | `text-shadow: 0 0 20px rgba(246,159,2,0.4);` |
| Decorative arc | `border: 1px solid color; border-radius: 50%; opacity: 0.05-0.1;` |

---

## Slide Patterns

### 1. Cover Slide
```html
<div class="slide flex flex-col items-center justify-center p-16 relative overflow-hidden"
     style="background: radial-gradient(circle at 20% 30%, rgba(140,39,241,0.08), transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(246,159,2,0.08), transparent 50%);">
  <div class="bokeh w-[500px] h-[500px] bg-purple-600/10 -top-32 -left-32"></div>
  <div class="bokeh w-[400px] h-[400px] bg-amber-500/10 -bottom-24 -right-24"></div>
  <div class="text-[#8C27F1] font-bold tracking-[0.3em] text-sm mb-6 uppercase">SAAS FACTORY</div>
  <h1 class="text-7xl font-black text-center leading-tight mb-4">
    Mi <span class="text-[#f69f02] text-glow">Business OS</span>
  </h1>
  <p class="text-2xl text-gray-400 text-center max-w-3xl">
    Sistema IA Empresarial: Arquitectura, Agentes y Automatizacion
  </p>
  <div class="mt-12 text-gray-600 text-sm tracking-widest uppercase">Daniel Carreon</div>
</div>
```

### 2. Statement / Big Number
```html
<div class="slide flex flex-col items-center justify-center p-16 relative overflow-hidden">
  <div class="bokeh w-96 h-96 bg-amber-500/10 top-0 right-0"></div>
  <div class="text-[120px] font-black text-[#f69f02] text-glow leading-none">$72,000+</div>
  <p class="text-2xl text-gray-400 mt-4">Revenue en menos de 5 meses</p>
  <div class="w-32 h-0.5 bg-[#f69f02] mt-8 mb-8"></div>
  <div class="flex gap-8">
    <div class="glass glow-amber px-8 py-4 text-center">
      <div class="text-3xl font-black text-[#f69f02]">700+</div>
      <div class="text-sm text-gray-500 mt-1">miembros</div>
    </div>
    <!-- more stat cards -->
  </div>
</div>
```

### 3. Cards Grid (Glassmorphism)
```html
<div class="slide flex flex-col justify-between p-16 relative overflow-hidden">
  <div class="bokeh w-80 h-80 bg-purple-600/10 -top-20 -right-20"></div>
  <!-- Label -->
  <div class="flex items-center gap-3 mb-2">
    <div class="w-1 h-6 bg-[#f69f02] rounded-full"></div>
    <span class="text-[#f69f02] font-bold tracking-[0.3em] text-sm uppercase">Section</span>
  </div>
  <h2 class="text-5xl font-black mb-8">Title Here</h2>
  <!-- Cards -->
  <div class="grid grid-cols-3 gap-6 flex-1">
    <div class="glass glow-amber p-8 flex flex-col">
      <div class="text-[#f69f02] text-3xl mb-4"><i class="fas fa-dollar-sign"></i></div>
      <div class="text-2xl font-black mb-2">Card Title</div>
      <div class="text-gray-400 text-base leading-relaxed">Description text here.</div>
    </div>
    <div class="glass glow-purple p-8 flex flex-col">
      <div class="text-[#8C27F1] text-3xl mb-4"><i class="fas fa-robot"></i></div>
      <div class="text-2xl font-black mb-2">Card Title</div>
      <div class="text-gray-400 text-base leading-relaxed">Description text here.</div>
    </div>
    <!-- more cards, alternating glow-amber / glow-purple -->
  </div>
  <!-- Footer -->
  <div class="flex justify-between text-xs tracking-widest text-gray-600 uppercase border-t border-white/10 pt-6">
    <span>DANIEL CARREON | SAAS FACTORY</span>
    <span class="text-amber-500">SECTION</span>
  </div>
</div>
```

### 4. Formula / Equation (Skywork Style)
```html
<div class="slide flex flex-col justify-between p-16 relative overflow-hidden">
  <div class="bokeh w-96 h-96 bg-[#8C27F1]/10 -top-24 -left-24"></div>
  <div class="bokeh w-80 h-80 bg-[#f69f02]/10 -bottom-20 -right-20"></div>
  <div>
    <div class="text-[#8C27F1] font-bold tracking-[0.3em] text-sm mb-4 uppercase">LABEL</div>
    <h1 class="text-6xl font-black mb-2">
      Trabajo = <span class="text-[#f69f02] text-glow">Volumen</span> x <span class="text-[#8C27F1]">Apalancamiento</span>
    </h1>
    <p class="text-gray-400 text-2xl">Subtitle text here.</p>
  </div>
  <div class="flex gap-8 items-center flex-1 py-12">
    <div class="glass glow-amber flex-1 p-8 text-center">
      <div class="text-[#f69f02] text-4xl mb-4"><i class="fas fa-hammer"></i></div>
      <div class="text-3xl font-black">VOLUMEN</div>
      <div class="text-gray-400 mt-2">Description</div>
    </div>
    <div class="text-5xl font-black text-gray-600"><i class="fas fa-times"></i></div>
    <div class="glass glow-purple flex-1 p-8 text-center">
      <div class="text-[#8C27F1] text-4xl mb-4"><i class="fas fa-microchip"></i></div>
      <div class="text-3xl font-black">APALANCAMIENTO</div>
      <div class="text-gray-400 mt-2">Description</div>
    </div>
    <div class="text-5xl font-black text-gray-600"><i class="fas fa-equals"></i></div>
    <div class="glass glow-amber flex-1 p-8 text-center bg-gradient-to-br from-black to-[#f69f02]/10">
      <div class="text-[#f69f02] text-4xl mb-4"><i class="fas fa-bolt"></i></div>
      <div class="text-3xl font-black">IMPACTO</div>
      <div class="text-gray-400 mt-2">Description</div>
    </div>
  </div>
  <div class="flex justify-between text-xs tracking-widest text-gray-600 uppercase border-t border-white/10 pt-6">
    <span>DANIEL CARREON | SAAS FACTORY</span>
    <span class="text-amber-500">SECTION</span>
  </div>
</div>
```

### 5. Quote / Cita
```html
<div class="slide flex flex-col items-center justify-center p-16 relative overflow-hidden"
     style="background: radial-gradient(circle at 30% 40%, rgba(140,39,241,0.06), transparent 50%);">
  <div class="bokeh w-80 h-80 bg-amber-500/10 top-10 right-10"></div>
  <div class="glass p-12 max-w-4xl text-center" style="border: 1px solid rgba(255,255,255,0.1);">
    <i class="fas fa-quote-left text-[#f69f02] text-2xl mb-6 block"></i>
    <p class="text-4xl font-black italic leading-snug">
      "La IA de hoy es <span class="text-[#f69f02]">la peor</span> que vas a usar en tu vida."
    </p>
  </div>
  <div class="flex items-center gap-4 mt-8">
    <div class="w-16 h-0.5 bg-[#f69f02]"></div>
    <span class="text-gray-500 text-sm tracking-[0.3em] uppercase">Alex Hormozi</span>
    <div class="w-16 h-0.5 bg-[#f69f02]"></div>
  </div>
</div>
```

### 6. Terminal / Code
```html
<div class="slide flex flex-col justify-between p-16 relative overflow-hidden">
  <h2 class="text-5xl font-black mb-8">Title</h2>
  <div class="rounded-xl overflow-hidden border border-gray-800 flex-1">
    <div class="bg-[#1a1a1a] px-4 py-2 flex items-center gap-2">
      <div class="w-3 h-3 rounded-full bg-red-500"></div>
      <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
      <div class="w-3 h-3 rounded-full bg-green-500"></div>
      <span class="text-gray-500 text-xs ml-2">BusinessOS.py</span>
    </div>
    <div class="bg-[#111111] p-6 font-mono text-base leading-relaxed">
      <span class="text-[#8C27F1]">class</span> <span class="text-white">BusinessOS</span>:
      <br>  brain = <span class="text-[#f69f02]">"CLAUDE.md"</span>  <span class="text-gray-600"># 1,300 lineas</span>
    </div>
  </div>
</div>
```

### 7. Image Slide
```html
<div class="slide flex flex-col justify-between p-16 relative overflow-hidden">
  <div class="flex items-center gap-3 mb-4">
    <div class="w-1 h-6 bg-[#f69f02] rounded-full"></div>
    <span class="text-[#f69f02] font-bold tracking-[0.3em] text-sm uppercase">Section</span>
  </div>
  <!-- Image: use base64 data URL or absolute path -->
  <div class="flex-1 flex items-center justify-center">
    <img src="data:image/png;base64,..." class="max-h-full rounded-2xl" alt="Description">
  </div>
  <!-- Callout bar -->
  <div class="glass px-6 py-3 mt-4 flex items-center gap-3" style="border: 1px solid rgba(255,255,255,0.1);">
    <i class="fas fa-lightbulb text-[#f69f02]"></i>
    <span class="text-[#f69f02] text-base italic">"Key insight about this image."</span>
  </div>
  <div class="flex justify-between text-xs tracking-widest text-gray-600 uppercase border-t border-white/10 pt-6">
    <span>DANIEL CARREON | SAAS FACTORY</span>
    <span class="text-amber-500">SECTION</span>
  </div>
</div>
```

### 8. Transition / Section Break
```html
<div class="slide flex flex-col items-center justify-center relative overflow-hidden"
     style="background: radial-gradient(circle at 10% 10%, rgba(140,39,241,0.08), transparent 50%),
            radial-gradient(circle at 90% 90%, rgba(246,159,2,0.08), transparent 50%);">
  <div class="bokeh w-[500px] h-[500px] bg-purple-600/10 -top-32 left-1/4"></div>
  <div class="bokeh w-[400px] h-[400px] bg-amber-500/10 -bottom-24 right-1/4"></div>
  <!-- Decorative arcs -->
  <div class="absolute w-[600px] h-[600px] border border-[#f69f02]/10 rounded-full -top-48 -right-48"></div>
  <div class="absolute w-[400px] h-[400px] border border-[#8C27F1]/10 rounded-full -bottom-32 -left-32"></div>
  <div class="text-[#8C27F1] font-bold tracking-[0.3em] text-sm mb-6 uppercase">Next Section</div>
  <h1 class="text-6xl font-black text-center leading-tight">
    The <span class="text-[#f69f02] text-glow">Key Concept</span>
  </h1>
  <p class="text-xl text-gray-500 mt-4 text-center max-w-2xl">Optional subtitle here</p>
</div>
```

### 9. VS / Comparison
```html
<div class="slide flex flex-col justify-between p-16 relative overflow-hidden">
  <h2 class="text-5xl font-black text-center mb-8">Before <span class="text-gray-600">vs</span> After</h2>
  <div class="flex gap-8 flex-1">
    <div class="glass flex-1 p-8 border border-red-500/30" style="box-shadow: 0 0 20px rgba(255,51,51,0.1);">
      <div class="text-red-400 text-6xl font-black mb-4">Before</div>
      <ul class="text-gray-400 text-lg space-y-3">
        <li>Point 1</li>
        <li>Point 2</li>
      </ul>
    </div>
    <div class="glass flex-1 p-8 glow-amber">
      <div class="text-[#f69f02] text-6xl font-black mb-4">After</div>
      <ul class="text-gray-400 text-lg space-y-3">
        <li>Point 1</li>
        <li>Point 2</li>
      </ul>
    </div>
  </div>
</div>
```

---

## Embedding Images

Images in HTML slides use standard `<img>` tags. Two options:

### Base64 (recommended for portability)
```bash
python3 -c "import base64; data=open('image.png','rb').read(); print(f'data:image/png;base64,{base64.b64encode(data).decode()}')"
```
Then: `<img src="data:image/png;base64,..." class="rounded-2xl" alt="...">`

### Absolute path (dev only)
```html
<img src="/Users/danielcarreon/path/to/image.png" class="rounded-2xl" alt="...">
```

### Generating images
Use the `image-generation` skill or `video-visuals` skill to generate images, then embed as base64.

---

## Element Skeleton — PPTX Export Components

Every visual component in the HTML must have a corresponding entry in `elements[]`. This is what gets exported to PPTX as editable shapes.

### Mapping Rules

| HTML Component | Element Type | Notes |
|---------------|-------------|-------|
| Glassmorphism card | `shape` (rounded_rect) | fill: "#1a1a1a", stroke, shadow, corner_radius |
| Text block | `text` | Match position, font_size, color, bold, align |
| Rich text (mixed colors) | `rich_text` | Use runs[] for per-word styling |
| Font Awesome icon | `text` | Use descriptive label like "[icon]" (FA doesn't export to PPTX) |
| Image | `image` | Same src (base64), position, dimensions |
| Footer left | `text` | x:120, y:1020, font_size:12, color:"#555555" |
| Footer right | `text` | x:1200, y:1020, font_size:12, color:"#f69f02", align:"right" |
| Bokeh / decorative blur | **SKIP** | Not useful in PPTX, purely decorative |
| Decorative arcs | **SKIP** | Same reason |

### HTML ↔ Element Linking (IMPORTANT)

Every HTML element that corresponds to an entry in `elements[]` MUST have a `data-el` attribute matching the element's `id`:

```html
<!-- In HTML -->
<div data-el="s1_card1_bg" style="...">
  <h3 data-el="s1_card1_title" style="...">VOLUMEN</h3>
  <p data-el="s1_card1_desc" style="...">Description</p>
</div>
```
```json
// In elements[]
{"id": "s1_card1_bg", "type": "shape", ...},
{"id": "s1_card1_title", "type": "text", "content": "VOLUMEN", ...},
{"id": "s1_card1_desc", "type": "text", "content": "Description", ...}
```

This enables the editor to move HTML elements visually when the user drags them. Without `data-el`, the overlay moves but the visual stays frozen.

### Coordinate System

Both HTML and elements use **1920x1080** coordinate space. Direct mapping:
- HTML: `body { width: 1920px; height: 1080px; }` with `style="left:120px; top:300px"`
- Element: `"x": 120, "y": 300`

### Example: Card with Title

**In HTML:**
```html
<div style="position:absolute; left:200px; top:400px; width:500px; height:300px;
            background:rgba(0,0,0,0.6); backdrop-filter:blur(12px); border-radius:20px;
            border:1px solid rgba(246,159,2,0.3); box-shadow:0 0 20px rgba(246,159,2,0.1);">
  <h3 style="font-size:28px; font-weight:900; color:#f69f02;">VOLUMEN</h3>
  <p style="color:#AAAAAA;">Description text</p>
</div>
```

**In elements[]:**
```json
[
  {"id": "card_bg", "type": "shape", "shape": "rounded_rect", "x": 200, "y": 400, "width": 500, "height": 300, "fill": "#1a1a1a", "corner_radius": 20, "stroke": {"color": "#f69f02", "width": 1}, "shadow": {"color": "#f69f02", "blur": 20, "offset_x": 0, "offset_y": 0}},
  {"id": "card_title", "type": "text", "content": "VOLUMEN", "x": 240, "y": 440, "width": 420, "height": 40, "font_size": 28, "color": "#f69f02", "bold": true},
  {"id": "card_desc", "type": "text", "content": "Description text", "x": 240, "y": 490, "width": 420, "height": 30, "font_size": 16, "color": "#AAAAAA"}
]
```

### Element Types Reference

```json
// Text
{"type": "text", "content": "Hello", "x": 0, "y": 0, "width": 400, "height": 60, "font_size": 32, "color": "#fff", "bold": true, "align": "center"}

// Shape (card background)
{"type": "shape", "shape": "rounded_rect", "x": 0, "y": 0, "width": 500, "height": 300, "fill": "#1a1a1a", "corner_radius": 16, "stroke": {"color": "#f69f02", "width": 1}}

// Image
{"type": "image", "src": "data:image/png;base64,...", "x": 0, "y": 0, "width": 800, "height": 600, "corner_radius": 16}

// Line (separator)
{"type": "line", "x": 860, "y": 500, "width": 200, "height": 0, "x1": 860, "y1": 500, "x2": 1060, "y2": 500, "color": "#f69f02", "line_width": 2}
```

### What to SKIP in elements[] (decorative only)
- Bokeh blur circles (CSS `filter: blur(80px)`)
- Background radial gradients
- Decorative arcs (border-only circles)
- These are purely atmospheric and have no value in PowerPoint

---

## CRITICAL RULES

### 1. Every Slide = Complete HTML Document
Each `html` field must be a self-contained HTML page with `<html>`, `<head>`, `<body>`. Do NOT include any CDN links — the renderer injects Inter + Font Awesome automatically. Use only inline `style=""` attributes (NO Tailwind utility classes).

### 2. Slide Dimensions: 1920x1080
Set `body { width: 1920px; height: 1080px; }` in every slide. The renderer scales this to fit. This matches the element coordinate space (1920x1080) so positions map directly.

### 3. Footer on Every Slide
Every content slide must have the footer bar:
```html
<div class="flex justify-between text-xs tracking-widest text-gray-600 uppercase border-t border-white/10 pt-6">
  <span>DANIEL CARREON | SAAS FACTORY</span>
  <span class="text-amber-500">SECTION NAME</span>
</div>
```

### 4. NO Emojis
Use Font Awesome icons instead. Never Unicode emojis.

### 5. Escape Script Tags in JSON
When embedding HTML in JSON strings, escape the closing script tag:
- Write `<\/script>` instead of `</script>` inside JSON string values.

### 6. Copy to Documents
```bash
cp deck.sfslides ~/Documents/SF-Slides/presentations/
```

### 7. Speaker Notes in JSON, Not HTML
Notes go in the slide's `notes` field in JSON, NOT inside the HTML.

---

## Generating Images for Slides

```bash
cd /Users/danielcarreon/Developer/software/business-os/claudeclaw
npx tsx scripts/generate-image.ts \
  --prompt "Description of what to generate" \
  --size 2K --aspect 16:9 \
  --output /path/to/output.png \
  --upload
```

Then convert to base64 and embed in `<img>` tag.

---

## Workflow

1. Design the narrative arc (what story are you telling?)
2. For each slide, create BOTH `html` (visual) AND `elements[]` (PPTX structure)
3. Build the `.sfslides` JSON
4. Validate: `node -e "JSON.parse(require('fs').readFileSync('file.sfslides','utf8'))"`
5. Copy to `~/Documents/SF-Slides/presentations/`
6. Open in SF-Slides or let file watcher reload

---

## Complete Example (3-slide deck)

```json
{
  "version": 1,
  "metadata": {
    "title": "Mi Business OS",
    "author": "Daniel Carreon",
    "created": "2026-04-04"
  },
  "slides": [
    {
      "id": 1,
      "html": "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\"><link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap\" rel=\"stylesheet\"><link href=\"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css\" rel=\"stylesheet\"><script src=\"https://cdn.tailwindcss.com\"><\/script><style>body{font-family:'Inter',sans-serif;width:1280px;height:720px;margin:0;overflow:hidden;background:#0D0D0D;color:#FFF;} .slide{width:1280px;height:720px;position:relative;} .bokeh{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;} .text-glow{text-shadow:0 0 20px rgba(246,159,2,0.4);}</style></head><body><div class=\"slide flex flex-col items-center justify-center p-16 relative overflow-hidden\" style=\"background:radial-gradient(circle at 20% 30%,rgba(140,39,241,0.08),transparent 50%),radial-gradient(circle at 80% 70%,rgba(246,159,2,0.08),transparent 50%);\"><div class=\"bokeh w-[500px] h-[500px] bg-purple-600/10 -top-32 -left-32\"></div><div class=\"bokeh w-[400px] h-[400px] bg-amber-500/10 -bottom-24 -right-24\"></div><div class=\"text-[#8C27F1] font-bold tracking-[0.3em] text-sm mb-6 uppercase\">SAAS FACTORY</div><h1 class=\"text-7xl font-black text-center leading-tight mb-4\">Mi <span class=\"text-[#f69f02] text-glow\">Business OS</span></h1><p class=\"text-2xl text-gray-400 text-center max-w-3xl\">Sistema IA Empresarial</p><div class=\"mt-12 text-gray-600 text-sm tracking-widest uppercase\">Daniel Carreon</div></div></body></html>",
      "notes": "Welcome slide. Introduce the concept of Business OS."
    },
    {
      "id": 2,
      "html": "... second slide HTML ...",
      "notes": "Explain the architecture."
    }
  ]
}
```

---

## Legacy Compatibility

- Slides with only `elements` (old Fabric.js format) still render via Fabric.js canvas
- Slides with only `html` (no elements) export PPTX as flat image (fallback)
- Slides with BOTH `html` AND `elements[]` (recommended) get the best of both worlds:
  - Beautiful HTML rendering in the app
  - Editable components in PPTX export
