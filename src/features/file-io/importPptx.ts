import JSZip from "jszip";
import type {
  Presentation,
  Slide,
  SlideElement,
  TextElement,
  RichTextElement,
  TextRun,
  ShapeElement,
  ImageElement,
  SlideBackground,
} from "@/features/canvas/types";

// Namespace-agnostic element queries for OOXML.
// DOMParser with "text/xml" preserves namespace prefixes (e.g. <a:p>, <p:sp>),
// so plain querySelector("p") will never match <a:p>.  These helpers use
// getElementsByTagNameNS("*", localName) which matches regardless of prefix.
function qs(parent: Element | Document, localName: string): Element | null {
  return parent.getElementsByTagNameNS("*", localName)[0] || null;
}

function qsa(parent: Element | Document, localName: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS("*", localName));
}

// EMU → pixel conversion (PPTX uses English Metric Units)
// Standard widescreen: 12192000 x 6858000 EMU = 13.33" x 7.5"
// Our canvas: 1920 x 1080 px
// Both axes: 1 px = 6350 EMU (12192000/1920 = 6858000/1080 = 6350)
const EMU_PER_PX = 6350;

// Canvas DPI: 1920 / 13.333" = 144 DPI
// Font pt → canvas px: pt × (144/72) = pt × 2
const PT_TO_CANVAS_PX = 2;

function emuToPx(emu: number): number {
  return emu / EMU_PER_PX;
}

// Only round at final assignment — preserves sub-pixel accuracy through calculations
function roundPx(v: number): number {
  return Math.round(v * 10) / 10; // keep 1 decimal for precision
}

// OOXML booleans can be "1", "true", "on", or just present (no value = true)
function ooxmlBool(val: string | null): boolean {
  if (val === null) return false;
  return val !== "0" && val !== "false" && val !== "off";
}

// Theme color map — populated from ppt/theme/theme1.xml at import time.
// tx1=dk1, tx2=dk2, bg1=lt1, bg2=lt2 are aliases.
let themeColorMap: Record<string, string> = {};

function initThemeColors(defaults: Record<string, string>) {
  themeColorMap = { ...defaults };
  // Aliases used in slide XML
  if (themeColorMap.dk1) themeColorMap.tx1 = themeColorMap.dk1;
  if (themeColorMap.dk2) themeColorMap.tx2 = themeColorMap.dk2;
  if (themeColorMap.lt1) themeColorMap.bg1 = themeColorMap.lt1;
  if (themeColorMap.lt2) themeColorMap.bg2 = themeColorMap.lt2;
}

// Parse hex color from OOXML (e.g., "FF6B00" → "#FF6B00")
function parseColor(node: Element | null, fallback = "#ffffff"): string {
  if (!node) return fallback;
  const srgb = qs(node, "srgbClr");
  if (srgb) return "#" + srgb.getAttribute("val");
  const scheme = qs(node, "schemeClr");
  if (scheme) {
    const val = scheme.getAttribute("val") || "";
    return themeColorMap[val] || fallback;
  }
  return fallback;
}

// Preserve original font names with appropriate fallback chains.
// macOS has Arial, Helvetica, Times New Roman, Georgia, Courier New,
// Verdana, Tahoma, Trebuchet MS built-in — no need to remap these.
// Only remap fonts that truly aren't available on the system.
function mapFont(pptxFont: string): string {
  // Fonts available on macOS — preserve them with fallbacks
  const systemFonts: Record<string, string> = {
    "Arial": "Arial, Helvetica, sans-serif",
    "Helvetica": "Helvetica, Arial, sans-serif",
    "Helvetica Neue": "Helvetica Neue, Helvetica, Arial, sans-serif",
    "Times New Roman": "Times New Roman, Times, serif",
    "Georgia": "Georgia, serif",
    "Courier New": "Courier New, Courier, monospace",
    "Verdana": "Verdana, Geneva, sans-serif",
    "Tahoma": "Tahoma, Geneva, sans-serif",
    "Trebuchet MS": "Trebuchet MS, sans-serif",
    "Impact": "Impact, sans-serif",
    "Comic Sans MS": "Comic Sans MS, cursive",
    "Lucida Grande": "Lucida Grande, sans-serif",
    "Futura": "Futura, sans-serif",
    "Avenir": "Avenir, sans-serif",
    "Avenir Next": "Avenir Next, sans-serif",
    "SF Pro Display": "SF Pro Display, system-ui, sans-serif",
    "Menlo": "Menlo, Monaco, monospace",
  };
  if (systemFonts[pptxFont]) return systemFonts[pptxFont];

  // Windows-only fonts — map to closest available alternative
  const remapFonts: Record<string, string> = {
    "Calibri": "Helvetica Neue, Helvetica, Arial, sans-serif",
    "Calibri Light": "Helvetica Neue, Helvetica, Arial, sans-serif",
    "Segoe UI": "Helvetica Neue, Helvetica, Arial, sans-serif",
    "Cambria": "Georgia, serif",
    "Consolas": "Roboto Mono, Menlo, monospace",
    "Century Gothic": "Poppins, Futura, sans-serif",
    "Gill Sans MT": "Lato, Gill Sans, sans-serif",
    "Franklin Gothic Medium": "Montserrat, sans-serif",
    "Garamond": "Playfair Display, Georgia, serif",
    "Rockwell": "Georgia, serif",
    "Lucida Console": "Source Code Pro, Menlo, monospace",
  };
  if (remapFonts[pptxFont]) return remapFonts[pptxFont];

  // Inter — modern font used by Skywork and many tech presentations
  if (pptxFont === "Inter") return "Inter, Helvetica Neue, Arial, sans-serif";

  // Unknown font: pass through with generic fallback
  return `${pptxFont}, sans-serif`;
}

// Default PPTX text body insets in EMU (the internal padding of text boxes)
// These are defined in the OOXML spec as default values for bodyPr
const DEFAULT_L_INS = 91440;  // ~14.4px — left margin
const DEFAULT_T_INS = 45720;  // ~7.2px  — top margin
const DEFAULT_R_INS = 91440;  // ~14.4px — right margin
const DEFAULT_B_INS = 45720;  // ~7.2px  — bottom margin

// Parse text body properties (margins, vertical alignment)
function parseBodyPr(txBody: Element): {
  lIns: number;
  tIns: number;
  rIns: number;
  bIns: number;
  anchor: "top" | "middle" | "bottom";
} {
  const bodyPr = qs(txBody, "bodyPr");
  let lIns = DEFAULT_L_INS;
  let tIns = DEFAULT_T_INS;
  let rIns = DEFAULT_R_INS;
  let bIns = DEFAULT_B_INS;
  let anchor: "top" | "middle" | "bottom" = "top";

  if (bodyPr) {
    // Parse explicit insets (only override if explicitly present)
    const lVal = bodyPr.getAttribute("lIns");
    const tVal = bodyPr.getAttribute("tIns");
    const rVal = bodyPr.getAttribute("rIns");
    const bVal = bodyPr.getAttribute("bIns");
    if (lVal !== null) lIns = parseInt(lVal);
    if (tVal !== null) tIns = parseInt(tVal);
    if (rVal !== null) rIns = parseInt(rVal);
    if (bVal !== null) bIns = parseInt(bVal);

    // Parse vertical alignment
    const anchorAttr = bodyPr.getAttribute("anchor");
    if (anchorAttr === "ctr") anchor = "middle";
    else if (anchorAttr === "b") anchor = "bottom";
  }

  return { lIns, tIns, rIns, bIns, anchor };
}

// Parse a single shape/text element from XML
function parseShape(
  spNode: Element,
  slideImages: Map<string, string>,
  nextId: () => string,
  themeFonts?: { major: string; minor: string }
): SlideElement | null {
  // Get transform (position + size)
  const spPr = qs(spNode, "spPr");
  const xfrm = spPr ? qs(spPr, "xfrm") : null;
  if (!xfrm && !spPr) return null;
  const xfrmOrSpPr = xfrm || spPr!;

  const off = qs(xfrmOrSpPr, "off");
  const ext = qs(xfrmOrSpPr, "ext");
  if (!off || !ext) return null;

  // Keep precise floating-point values through the pipeline
  const rawX = emuToPx(parseInt(off.getAttribute("x") || "0"));
  const rawY = emuToPx(parseInt(off.getAttribute("y") || "0"));
  const rawW = emuToPx(parseInt(ext.getAttribute("cx") || "0"));
  const rawH = emuToPx(parseInt(ext.getAttribute("cy") || "0"));

  if (rawW < 1 && rawH < 1) return null;

  // Check rotation
  const rot = xfrmOrSpPr.getAttribute("rot");
  const rotation = rot ? Math.round(parseInt(rot) / 60000) : 0;

  // Check for image (blipFill)
  const blipFill = qs(spNode, "blipFill");
  const blip = blipFill ? qs(blipFill, "blip") : null;
  if (blip) {
    const rEmbed = blip.getAttribute("r:embed") || blip.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "embed"
    );
    const imgSrc = rEmbed ? slideImages.get(rEmbed) || "" : "";

    // Check for opacity (alpha modulation)
    let imgOpacity = 1.0;
    const alphaModFix = blip ? qs(blip, "alphaModFix") : null;
    if (alphaModFix) {
      const amt = alphaModFix.getAttribute("amt");
      if (amt) imgOpacity = parseInt(amt) / 100000;
    }
    // Also check spPr for overall element opacity
    if (spPr) {
      const noFillCheck = qs(spPr, "noFill");
      // Some PPTX use alpha on the blip fill itself
      const alphaEl = blipFill ? qs(blipFill, "alphaModFix") : null;
      if (alphaEl) {
        const amt = alphaEl.getAttribute("amt");
        if (amt) imgOpacity = parseInt(amt) / 100000;
      }
    }

    return {
      id: nextId(),
      type: "image",
      src: imgSrc,
      x: Math.round(rawX),
      y: Math.round(rawY),
      width: Math.round(rawW),
      height: Math.round(rawH),
      corner_radius: 0,
      rotation,
      opacity: imgOpacity < 0.99 ? roundPx(imgOpacity) : undefined,
    } as ImageElement;
  }

  // Check for text body
  const txBody = qs(spNode, "txBody");
  if (txBody) {
    // Parse text body margins and vertical alignment
    const body = parseBodyPr(txBody);
    const marginL = emuToPx(body.lIns);
    const marginT = emuToPx(body.tIns);
    const marginR = emuToPx(body.rIns);
    const marginB = emuToPx(body.bIns);

    const textX = roundPx(rawX + marginL);
    const textY = roundPx(rawY + marginT);
    const textW = roundPx(rawW - marginL - marginR);
    let textH = roundPx(rawH - marginT - marginB);

    // Ensure text box height is at least 1.3x the font size to prevent clipping.
    // PPTX sometimes creates text boxes that are exactly the font height,
    // but Fabric.js needs extra space for line-height and descenders.
    // We calculate this after parsing runs (below) and adjust if needed.

    const defaultFont = mapFont(themeFonts?.minor ?? "Arial");

    // Collect per-run styles
    const allRuns: TextRun[] = [];
    let align: "left" | "center" | "right" = "left";
    let lineSpacing: number | undefined;

    const paragraphs = qsa(txBody, "p");
    paragraphs.forEach((p, pi) => {
      if (pi > 0) allRuns.push({ text: "\n" });

      // Paragraph alignment & spacing
      const pPr = qs(p, "pPr");
      let defFontSize = 0;
      let defBold = false;
      let defColor = "";
      let defFont = "";
      if (pPr) {
        const algn = pPr.getAttribute("algn");
        if (algn === "ctr") align = "center";
        else if (algn === "r") align = "right";

        const lnSpc = qs(pPr, "lnSpc");
        if (lnSpc) {
          const spcPct = qs(lnSpc, "spcPct");
          if (spcPct) {
            const val = spcPct.getAttribute("val");
            if (val) lineSpacing = parseInt(val) / 100000;
          }
        }

        // Paragraph default run properties
        const defRPr = qs(pPr, "defRPr");
        if (defRPr) {
          const sz = defRPr.getAttribute("sz");
          if (sz) defFontSize = Math.round((parseFloat(sz) / 100) * PT_TO_CANVAS_PX);
          defBold = ooxmlBool(defRPr.getAttribute("b"));
          const sf = qs(defRPr, "solidFill");
          if (sf) defColor = parseColor(sf);
          const lat = qs(defRPr, "latin");
          if (lat) {
            const tf = lat.getAttribute("typeface") || "";
            if (tf && !tf.startsWith("+")) defFont = tf;
          }
        }
      }

      const runs = qsa(p, "r");
      runs.forEach((r) => {
        const t = qs(r, "t");
        const text = t?.textContent || "";
        if (!text) return;

        // Start with paragraph defaults
        let fontSize = defFontSize || 64; // fallback for imported text
        let color = defColor || "#ffffff";
        let bold = defBold;
        let italic = false;
        let underline = false;
        let fontFamily = defFont;
        let letterSpacing: number | undefined;

        const rPr = qs(r, "rPr");
        if (rPr) {
          const sz = rPr.getAttribute("sz");
          if (sz) fontSize = Math.round((parseFloat(sz) / 100) * PT_TO_CANVAS_PX);

          bold = ooxmlBool(rPr.getAttribute("b")) || defBold;
          italic = ooxmlBool(rPr.getAttribute("i"));
          const uAttr = rPr.getAttribute("u");
          underline = uAttr !== null && uAttr !== "none";

          const spc = rPr.getAttribute("spc");
          if (spc) letterSpacing = (parseFloat(spc) / 100) * PT_TO_CANVAS_PX;

          const solidFill = qs(rPr, "solidFill");
          if (solidFill) color = parseColor(solidFill);

          const latin = qs(rPr, "latin");
          if (latin) {
            const typeface = latin.getAttribute("typeface") || "";
            if (typeface && !typeface.startsWith("+")) fontFamily = typeface;
          }
        }

        allRuns.push({
          text,
          font_size: fontSize,
          color,
          bold,
          italic,
          underline,
          font_family: mapFont(fontFamily || themeFonts?.minor || "Arial"),
          letter_spacing: letterSpacing,
        });
      });
    });

    // Filter out empty
    const fullText = allRuns.map((r) => r.text).join("");
    if (!fullText.trim()) return null;

    // Check if all runs have the same style → use simple TextElement
    const styledRuns = allRuns.filter((r) => r.text !== "\n");
    const first = styledRuns[0];
    const allSame = styledRuns.every(
      (r) =>
        r.font_size === first?.font_size &&
        r.color === first?.color &&
        r.bold === first?.bold &&
        r.italic === first?.italic &&
        r.font_family === first?.font_family
    );

    // Adjust height: ensure text box can fit the largest font with line-height
    const maxFontSize = Math.max(...styledRuns.map(r => r.font_size || 64));
    const lineCount = fullText.split("\n").length;
    const minHeight = maxFontSize * 1.25 * lineCount;
    if (textH < minHeight) textH = roundPx(minHeight);

    if (allSame && first) {
      // Simple TextElement
      const el: TextElement = {
        id: nextId(),
        type: "text",
        content: fullText.trim(),
        x: Math.round(textX),
        y: Math.round(textY),
        width: Math.round(textW),
        height: Math.round(textH),
        font_size: first.font_size,
        color: first.color,
        bold: first.bold,
        italic: first.italic,
        underline: first.underline,
        align,
        valign: body.anchor,
        rotation,
        font_family: first.font_family,
        letter_spacing: first.letter_spacing,
      };
      if (lineSpacing !== undefined) el.line_spacing = lineSpacing;
      return el;
    }

    // Rich text — preserve per-run styles
    const el: RichTextElement = {
      id: nextId(),
      type: "rich_text",
      runs: allRuns,
      x: Math.round(textX),
      y: Math.round(textY),
      width: Math.round(textW),
      height: Math.round(textH),
      font_family: first?.font_family || defaultFont,
      align,
      valign: body.anchor,
      rotation,
    };
    if (lineSpacing !== undefined) el.line_spacing = lineSpacing;
    return el;
  }

  // It's a shape (rect, ellipse, etc.)
  const prstGeom = spPr ? qs(spPr, "prstGeom") : null;
  const geomType = prstGeom?.getAttribute("prst") || "rect";

  const shapeMap: Record<string, string> = {
    rect: "rect",
    roundRect: "rounded_rect",
    ellipse: "ellipse",
    triangle: "triangle",
    diamond: "diamond",
    star5: "star",
    hexagon: "hexagon",
    rightArrow: "arrow_right",
    leftArrow: "arrow_left",
    line: "rect", // lines handled separately
  };
  const shape = (shapeMap[geomType] || "rect") as ShapeElement["shape"];

  // Fill color (solid or gradient)
  let fill: string | { type: "linear" | "radial"; angle?: number; stops: { offset: number; color: string }[] } | null = null;
  const shapeSolidFill = spPr ? qs(spPr, "solidFill") : null;
  if (shapeSolidFill) {
    fill = parseColor(shapeSolidFill, "#8B5CF6");
  }
  // Gradient fill for shapes
  const shapeGradFill = spPr ? qs(spPr, "gradFill") : null;
  if (shapeGradFill && !shapeSolidFill) {
    const gStops = qsa(shapeGradFill, "gs");
    if (gStops.length >= 2) {
      const gradStops = gStops.map((gs) => ({
        offset: parseInt(gs.getAttribute("pos") || "0") / 100000,
        color: parseColor(gs, "#0D0D0D"),
      }));
      const lin = qs(shapeGradFill, "lin");
      let angle = 135;
      if (lin) {
        const angAttr = lin.getAttribute("ang");
        if (angAttr) angle = Math.round(parseInt(angAttr) / 60000);
      }
      fill = { type: "linear" as const, angle, stops: gradStops };
    }
  }
  const noFill = spPr ? qs(spPr, "noFill") : null;
  if (noFill) fill = null;

  // Stroke
  let stroke: { color: string; width: number } | undefined;
  const ln = spPr ? qs(spPr, "ln") : null;
  if (ln) {
    const lnW = ln.getAttribute("w");
    const lnFill = qs(ln, "solidFill");
    if (lnFill) {
      // Line width in EMU: 12700 EMU = 1pt = ~1.33px
      const widthPt = lnW ? parseFloat(lnW) / 12700 : 1;
      stroke = {
        color: parseColor(lnFill, "#ffffff"),
        width: Math.max(1, Math.round(widthPt)),
      };
    }
  }

  // Corner radius for roundRect
  const x = Math.round(rawX);
  const y = Math.round(rawY);
  const width = Math.round(rawW);
  const height = Math.round(rawH);
  let cornerRadius = 0;
  if (geomType === "roundRect" && prstGeom) {
    const avLst = qs(prstGeom, "avLst");
    const av = avLst ? qs(avLst, "av") : null;
    if (av) {
      const fmla = av.getAttribute("fmla");
      // PPTX uses "val XXXXX" where the value is in 1/50000 of the shape size
      if (fmla) {
        const match = fmla.match(/val\s+(\d+)/);
        if (match) {
          cornerRadius = Math.round(
            (parseInt(match[1]) / 50000) * Math.min(width, height)
          );
        }
      }
    }
    if (cornerRadius === 0) cornerRadius = 12; // default
  }

  // Parse shadow/glow effect
  let shadow: { color: string; blur: number; offset_x: number; offset_y: number } | undefined;
  const effectLst = spPr ? qs(spPr, "effectLst") : null;
  if (effectLst) {
    // Outer glow
    const outerShdw = qs(effectLst, "outerShdw");
    if (outerShdw) {
      const blurRad = outerShdw.getAttribute("blurRad");
      const dist = outerShdw.getAttribute("dist");
      const dir = outerShdw.getAttribute("dir");
      const shdwColor = parseColor(outerShdw, "#000000");
      const blur = blurRad ? Math.round(parseInt(blurRad) / 12700) : 10;
      const distance = dist ? parseInt(dist) / 12700 : 0;
      const angle = dir ? parseInt(dir) / 60000 : 270;
      const offsetX = Math.round(distance * Math.cos((angle * Math.PI) / 180));
      const offsetY = Math.round(distance * Math.sin((angle * Math.PI) / 180));
      shadow = { color: shdwColor, blur, offset_x: offsetX, offset_y: offsetY };
    }
    // Glow effect (colored glow around element)
    const glow = qs(effectLst, "glow");
    if (glow && !shadow) {
      const glowRad = glow.getAttribute("rad");
      const glowColor = parseColor(glow, "#f69f02");
      const blur = glowRad ? Math.round(parseInt(glowRad) / 12700) : 15;
      shadow = { color: glowColor, blur, offset_x: 0, offset_y: 0 };
    }
  }

  const shapeEl: ShapeElement = {
    id: nextId(),
    type: "shape",
    shape,
    x,
    y,
    width,
    height,
    fill,
    stroke: stroke || undefined,
    corner_radius: cornerRadius,
    rotation,
  };
  if (shadow) (shapeEl as any).shadow = shadow;
  return shapeEl;
}

// Parse slide background — handles solid, gradient, and picture backgrounds
function parseBackground(
  slideDoc: Document,
  slideImages: Map<string, string>
): { bg: SlideBackground | undefined; bgImageElement: ImageElement | null } {
  const bg = qs(slideDoc, "bg");
  if (!bg) return { bg: undefined, bgImageElement: null };

  // Check for background picture (blipFill)
  const bgPr = qs(bg, "bgPr");
  if (bgPr) {
    const blipFill = qs(bgPr, "blipFill");
    if (blipFill) {
      const blip = qs(blipFill, "blip");
      if (blip) {
        const rEmbed = blip.getAttribute("r:embed") || blip.getAttributeNS(
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
          "embed"
        );
        const imgSrc = rEmbed ? slideImages.get(rEmbed) || "" : "";
        if (imgSrc) {
          // Return the background image as a fullscreen element at z_index -1
          return {
            bg: { type: "solid", color: "#0D0D0D" },
            bgImageElement: {
              id: "bg_img",
              type: "image",
              src: imgSrc,
              x: 0,
              y: 0,
              width: 1920,
              height: 1080,
              corner_radius: 0,
              opacity: 1.0,
              z_index: -100,
            } as ImageElement,
          };
        }
      }
    }

    const solidFill = qs(bgPr, "solidFill");
    if (solidFill) {
      return { bg: { type: "solid", color: parseColor(solidFill, "#0D0D0D") }, bgImageElement: null };
    }

    const gradFill = qs(bgPr, "gradFill");
    if (gradFill) {
      const stops = qsa(gradFill, "gs");
      if (stops.length >= 2) {
        const gradStops = Array.from(stops).map((gs) => ({
          offset: parseInt(gs.getAttribute("pos") || "0") / 100000,
          color: parseColor(gs, "#0D0D0D"),
        }));
        // Parse gradient angle from lin element
        const lin = qs(gradFill, "lin");
        let angle = 180;
        if (lin) {
          const angAttr = lin.getAttribute("ang");
          if (angAttr) angle = Math.round(parseInt(angAttr) / 60000);
        }
        return {
          bg: { type: "gradient", angle, stops: gradStops },
          bgImageElement: null,
        };
      }
    }
  }

  // Fallback: check directly under bg (some PPTXs structure it differently)
  const solidFill = qs(bg, "solidFill");
  if (solidFill) {
    return { bg: { type: "solid", color: parseColor(solidFill, "#0D0D0D") }, bgImageElement: null };
  }

  const gradFill = qs(bg, "gradFill");
  if (gradFill) {
    const stops = qsa(gradFill, "gs");
    if (stops.length >= 2) {
      const gradStops = Array.from(stops).map((gs) => ({
        offset: parseInt(gs.getAttribute("pos") || "0") / 100000,
        color: parseColor(gs, "#0D0D0D"),
      }));
      const lin = qs(gradFill, "lin");
      let angle = 180;
      if (lin) {
        const angAttr = lin.getAttribute("ang");
        if (angAttr) angle = Math.round(parseInt(angAttr) / 60000);
      }
      return {
        bg: { type: "gradient", angle, stops: gradStops },
        bgImageElement: null,
      };
    }
  }

  return { bg: { type: "solid", color: "#0D0D0D" }, bgImageElement: null };
}

// Parse speaker notes
async function parseNotes(
  zip: JSZip,
  slideIndex: number
): Promise<string> {
  const notesFile = zip.file(
    `ppt/notesSlides/notesSlide${slideIndex}.xml`
  );
  if (!notesFile) return "";

  try {
    const xml = await notesFile.async("text");
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const texts: string[] = [];
    for (const txBody of qsa(doc, "txBody")) {
      for (const p of qsa(txBody, "p")) {
        for (const r of qsa(p, "r")) {
          const t = qs(r, "t");
          if (t?.textContent) texts.push(t.textContent);
        }
      }
    }
    // Filter out slide number placeholders
    return texts
      .filter((t) => t.trim() && !/^\d+$/.test(t.trim()))
      .join(" ")
      .trim();
  } catch {
    return "";
  }
}

// Extract embedded images from PPTX
async function extractImages(
  zip: JSZip,
  slideIndex: number
): Promise<Map<string, string>> {
  const images = new Map<string, string>();

  // Read slide relationships
  const relsFile = zip.file(
    `ppt/slides/_rels/slide${slideIndex}.xml.rels`
  );
  if (!relsFile) return images;

  const relsXml = await relsFile.async("text");
  const parser = new DOMParser();
  const relsDoc = parser.parseFromString(relsXml, "text/xml");
  const rels = qsa(relsDoc, "Relationship");

  for (const rel of Array.from(rels)) {
    const type = rel.getAttribute("Type") || "";
    if (type.includes("image")) {
      const rId = rel.getAttribute("Id") || "";
      const target = rel.getAttribute("Target") || "";
      // Target is relative to ppt/slides/, so resolve to full path
      const imgPath = target.startsWith("../")
        ? "ppt/" + target.slice(3)
        : "ppt/slides/" + target;

      const imgFile = zip.file(imgPath);
      if (imgFile) {
        try {
          const imgData = await imgFile.async("base64");
          const ext = imgPath.split(".").pop()?.toLowerCase() || "png";
          const mimeMap: Record<string, string> = {
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            svg: "image/svg+xml",
            webp: "image/webp",
          };
          const mime = mimeMap[ext] || "image/png";
          images.set(rId, `data:${mime};base64,${imgData}`);
        } catch {
          // Skip failed images
        }
      }
    }
  }

  return images;
}

// Main import function
export async function importPptx(file: File): Promise<Presentation> {
  const zip = new JSZip();
  await zip.loadAsync(file);

  // Count slides
  const slideFiles: string[] = [];
  zip.folder("ppt/slides")?.forEach((path, _file) => {
    if (path.match(/^slide\d+\.xml$/)) {
      slideFiles.push(path);
    }
  });

  // Sort by slide number
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || "0");
    const numB = parseInt(b.match(/\d+/)?.[0] || "0");
    return numA - numB;
  });

  let elementCounter = 0;
  const nextId = () => `imp_${++elementCounter}`;

  const parser = new DOMParser();

  // Resolve theme fonts (+mj-lt = heading font, +mn-lt = body font)
  let themeMajorFont = "Arial";
  let themeMinorFont = "Arial";
  try {
    const themeFile = zip.file("ppt/theme/theme1.xml");
    if (themeFile) {
      const themeXml = await themeFile.async("text");
      const themeDoc = parser.parseFromString(themeXml, "text/xml");
      const majorFont = qs(themeDoc, "majorFont");
      const minorFont = qs(themeDoc, "minorFont");
      if (majorFont) {
        const latin = qs(majorFont, "latin");
        if (latin) themeMajorFont = latin.getAttribute("typeface") || "Arial";
      }
      if (minorFont) {
        const latin = qs(minorFont, "latin");
        if (latin) themeMinorFont = latin.getAttribute("typeface") || "Arial";
      }
    }
    // Parse theme colors from <a:clrScheme>
    const themeFile2 = zip.file("ppt/theme/theme1.xml");
    if (themeFile2) {
      const themeXml2 = await themeFile2.async("text");
      const themeDoc2 = parser.parseFromString(themeXml2, "text/xml");
      const clrScheme = qs(themeDoc2, "clrScheme");
      if (clrScheme) {
        const colorNames = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
        const colors: Record<string, string> = {};
        for (const name of colorNames) {
          const el = qs(clrScheme, name);
          if (el) {
            const srgb = qs(el, "srgbClr");
            if (srgb) {
              colors[name] = "#" + srgb.getAttribute("val");
            } else {
              const sys = qs(el, "sysClr");
              if (sys) {
                colors[name] = "#" + (sys.getAttribute("lastClr") || sys.getAttribute("val") || "000000");
              }
            }
          }
        }
        initThemeColors(colors);
      }
    }
  } catch { /* use defaults */ }

  const slides: Slide[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = zip.file(`ppt/slides/${slideFiles[i]}`);
    if (!slideFile) continue;

    const xml = await slideFile.async("text");
    const doc = parser.parseFromString(xml, "text/xml");

    // Extract images for this slide
    const slideNum = parseInt(slideFiles[i].match(/\d+/)?.[0] || "1");
    const slideImages = await extractImages(zip, slideNum);

    // Parse background (now also handles picture backgrounds)
    const { bg: background, bgImageElement } = parseBackground(doc, slideImages);

    // Parse all shapes (sp = shape, pic = picture)
    const elements: SlideElement[] = [];
    // If background is a picture, add it as first element (behind everything)
    if (bgImageElement) {
      bgImageElement.id = nextId();
      elements.push(bgImageElement);
    }
    const spTree = qs(doc, "spTree");

    if (spTree) {
      // Iterate ALL direct children of spTree in document order.
      // PPTX z-order = document order (first = back, last = front).
      // We MUST preserve this order so images don't cover text.
      for (const child of Array.from(spTree.children)) {
        const localName = child.localName;
        if (localName === "sp" || localName === "pic") {
          const el = parseShape(child as Element, slideImages, nextId, { major: themeMajorFont, minor: themeMinorFont });
          if (el) elements.push(el);
        } else if (localName === "grpSp") {
          // Flatten group shapes — process children in order
          for (const grpChild of Array.from(child.children)) {
            const grpLocalName = grpChild.localName;
            if (grpLocalName === "sp" || grpLocalName === "pic") {
              const el = parseShape(grpChild as Element, slideImages, nextId);
              if (el) elements.push(el);
            }
          }
        }
      }
    }

    // Parse notes
    const notes = await parseNotes(zip, slideNum);

    slides.push({
      id: i + 1,
      background,
      elements,
      notes,
    });
  }

  // Try to get presentation title from core properties
  let title = "Imported Presentation";
  const coreFile = zip.file("docProps/core.xml");
  if (coreFile) {
    try {
      const coreXml = await coreFile.async("text");
      const coreDoc = parser.parseFromString(coreXml, "text/xml");
      const titleEl = qs(coreDoc, "title");
      if (titleEl?.textContent) title = titleEl.textContent;
    } catch {
      // ignore
    }
  }

  return {
    version: 1,
    metadata: {
      title,
      author: "",
      created: new Date().toISOString().split("T")[0],
    },
    defaults: {
      font_family: "Inter, system-ui, sans-serif",
      background: { type: "solid", color: "#0D0D0D" },
    },
    slides,
  };
}
