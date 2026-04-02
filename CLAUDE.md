# CLAUDE.md — SF-Slides Development Instructions

## What is SF-Slides?

SF-Slides is a macOS desktop presentation editor built with Tauri v2 + React + Fabric.js. Each slide is a 16:9 canvas (1920x1080) where elements (text, images, shapes, lines) are freely placed. Claude creates and edits presentations by writing `.sfslides` JSON files. The app hot-reloads on file changes.

## Quick Start (Dev Mode)

```bash
# 1. Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
export PATH="$HOME/.cargo/bin:$PATH"

# 2. Install Node dependencies
npm install

# 3. Run in dev mode (Vite HMR + Tauri)
npm run tauri dev
```

## Build Desktop App

```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/macos/SF-Slides.app
```

## Project Structure

```
sf-slides/
├── src/                              # React frontend
│   ├── features/
│   │   ├── canvas/                   # Fabric.js canvas + element rendering
│   │   │   ├── SlideCanvas.tsx       # Main canvas component
│   │   │   ├── element-renderers.ts  # JSON → Fabric.js object factories
│   │   │   └── types.ts             # All TypeScript types + defaults
│   │   ├── thumbnails/               # Slide thumbnail panel
│   │   ├── properties/               # Element property editor panel
│   │   ├── toolbar/                  # Top toolbar
│   │   ├── presenter/                # Fullscreen presenter mode
│   │   ├── file-io/                  # Save/Load + file watcher
│   │   └── export/                   # PPTX export via pptxgenjs
│   ├── shared/
│   │   └── store.ts                  # Zustand store (single source of truth)
│   ├── App.tsx                       # Main layout (3 panels)
│   └── main.tsx                      # Entry point
├── src-tauri/                        # Rust backend (thin)
│   ├── src/
│   │   ├── lib.rs                    # Tauri setup, plugins, IPC commands
│   │   ├── main.rs                   # Entry point
│   │   └── watcher.rs               # File watcher (notify crate)
│   └── tauri.conf.json               # App config
├── .claude/commands/sfslides.md      # Skill for Claude to create presentations
├── presentations/                    # Presentations directory (dev mode)
└── package.json
```

## Architecture

### Data Flow
```
.sfslides JSON file
  ↕ (read/write via Tauri FS)
Zustand Store (single source of truth)
  ↕ (React state)
Fabric.js Canvas (renders elements)
  ↕ (object events)
Properties Panel (edits element props)
```

### File Watcher (Claude Integration)
1. When a `.sfslides` file is opened, the Rust backend starts watching it via `notify` crate
2. If Claude writes to the file externally, the watcher detects the change
3. Frontend receives `file-changed` event, reloads JSON, updates store
4. Canvas re-renders with new data — latency <200ms

### Element System
All elements live in slide coordinate space (1920x1080). Types:
- `text` — Fabric.js Textbox (editable, supports font/color/align)
- `image` — Fabric.js Image (with corner radius clipping)
- `shape` — Fabric.js Rect/Ellipse/Polygon (rect, ellipse, triangle, star, etc.)
- `line` — Fabric.js Line (with arrows)

### PPTX Export
Uses `pptxgenjs`. Each element maps to a PowerPoint shape:
- text → `addText()`, shape → `addShape()`, image → `addImage()`, line → `addShape("line")`
- Coordinates converted from px to inches (1920px = 10", 1080px = 7.5")
- Speaker notes preserved via `addNotes()`

## Key Files

| File | Purpose |
|------|---------|
| `src/features/canvas/types.ts` | All TypeScript interfaces, element types, defaults |
| `src/shared/store.ts` | Zustand store with all actions (add/remove/update elements, undo/redo) |
| `src/features/canvas/element-renderers.ts` | JSON element → Fabric.js object conversion |
| `src/features/canvas/SlideCanvas.tsx` | Main canvas with Fabric.js, handles interaction |
| `src/features/export/exportPptx.ts` | PPTX export pipeline |
| `src-tauri/src/watcher.rs` | File watcher for hot-reload |
| `.claude/commands/sfslides.md` | Skill definition for Claude |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| V | Select tool |
| T | Text tool |
| S | Shape tool |
| L | Line tool |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Cmd+C | Copy selected elements |
| Cmd+V | Paste copied elements (offset +30px) |
| Cmd+D | Duplicate selected elements |
| Cmd+S | Save |
| Cmd+Shift+S | Save As |
| Cmd+O | Open |
| Cmd+N | New |
| Delete/Backspace | Delete selected |
| F5 | Presenter mode |
| PageUp/PageDown | Navigate slides |

## Properties Panel Features

### Text Elements
- Font family selector (Inter, Georgia, Menlo, Helvetica, etc.)
- Font size, Bold, Italic, Underline
- Text alignment (left, center, right)
- Text color + background color
- Line height

### Shape Elements
- Shape type selector (rect, ellipse, triangle, diamond, star, hexagon, etc.)
- Fill color
- Corner radius
- Stroke color + width

### Image Elements
- Image URL/path
- Corner radius
- Fit mode (cover, contain, stretch, none)

### All Elements
- Position (X, Y, W, H)
- Rotation, Opacity
- Layer controls (Bring to Front, Send to Back)
- Lock/Unlock

### Slide Level
- Background color picker
- Solid color presets (6 swatches)
- Gradient presets (Dark, Morado, Ocean, Sunset, Forest, Slate)
- Speaker notes editor

## Canvas Features
- Snap-to-center guidelines when dragging elements
- Real canvas preview thumbnails (not placeholders)
- Right-click context menu on slide thumbnails (Add, Duplicate, Delete)
- Fabric.js v7 with originX/Y="left"/"top" (important: v7 defaults to "center")

## Brand Colors

| Color | Hex |
|-------|-----|
| Morado | #8B5CF6 |
| Ambar | #F59E0B |
| Dark BG | #0f0f17 |
| Panel | #141420 |
| Surface | #1a1a2e |
| Border | #2a2a3e |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm run tauri dev` fails | Ensure Rust is installed: `rustc --version` |
| Canvas blank | Check browser console for Fabric.js errors |
| File watcher not working | Ensure file was opened via File > Open (sets watch path) |
| PPTX export fails | Check console; fallback downloads via browser |
| TypeScript errors | Run `npx tsc --noEmit` to check |
