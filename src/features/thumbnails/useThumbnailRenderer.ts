import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import type { Slide } from "@/features/canvas/types";
import { SLIDE_WIDTH, SLIDE_HEIGHT } from "@/features/canvas/types";
import { createFabricObject } from "@/features/canvas/element-renderers";

const THUMB_SCALE = 0.1; // 1920*0.1 = 192px wide thumbnails

// Render queue to prevent concurrent access to shared canvas
let _queue: Promise<void> = Promise.resolve();
let _offscreen: fabric.StaticCanvas | null = null;

function getOffscreen(): fabric.StaticCanvas {
  if (!_offscreen) {
    const el = document.createElement("canvas");
    _offscreen = new fabric.StaticCanvas(el, {
      width: Math.round(SLIDE_WIDTH * THUMB_SCALE),
      height: Math.round(SLIDE_HEIGHT * THUMB_SCALE),
      enableRetinaScaling: false,
    });
  }
  return _offscreen;
}

async function renderSlideInternal(slide: Slide): Promise<string> {
  const canvas = getOffscreen();

  // Full reset
  canvas.getObjects().slice().forEach((o) => canvas.remove(o));
  canvas.clear();

  // Background
  const bg = slide.background;
  if (bg?.type === "solid") {
    canvas.backgroundColor = bg.color;
  } else if (bg?.type === "gradient" && bg.stops) {
    const gradient = new fabric.Gradient({
      type: "linear",
      coords: {
        x1: 0,
        y1: 0,
        x2: SLIDE_WIDTH * Math.cos(((bg.angle ?? 0) * Math.PI) / 180),
        y2: SLIDE_HEIGHT * Math.sin(((bg.angle ?? 0) * Math.PI) / 180),
      },
      colorStops: bg.stops.map((s) => ({ offset: s.offset, color: s.color })),
    });
    canvas.backgroundColor = gradient as unknown as string;
  } else {
    canvas.backgroundColor = "#0f0f17";
  }

  // Render elements
  const sorted = [...slide.elements].sort(
    (a, b) => (a.z_index ?? 0) - (b.z_index ?? 0)
  );

  for (const el of sorted) {
    try {
      const obj = await createFabricObject(el);
      if (obj) {
        canvas.add(obj);
      }
    } catch {
      // Skip failed elements
    }
  }

  canvas.setZoom(THUMB_SCALE);
  canvas.renderAll();

  const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });

  // Full cleanup
  canvas.getObjects().slice().forEach((o) => canvas.remove(o));

  return dataUrl;
}

/**
 * Serialized render — ensures only one thumbnail renders at a time.
 */
export function renderSlideThumbnail(slide: Slide): Promise<string> {
  const job = _queue.then(() => renderSlideInternal(slide));
  _queue = job.then(() => {}, () => {}); // swallow errors in queue chain
  return job;
}

/**
 * Hook: renders a thumbnail for a slide and re-renders when slide data changes.
 */
export function useThumbnailImage(slide: Slide | undefined): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const elementsKey = JSON.stringify(slide?.elements);
  const bgKey = JSON.stringify(slide?.background);
  const renderRef = useRef(0);

  useEffect(() => {
    if (!slide) {
      setDataUrl(null);
      return;
    }

    const id = ++renderRef.current;

    renderSlideThumbnail(slide).then((url) => {
      if (id === renderRef.current) {
        setDataUrl(url);
      }
    });
  }, [slide?.id, elementsKey, bgKey]);

  return dataUrl;
}
