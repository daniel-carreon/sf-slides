import { useEffect, useRef, useState, useCallback } from "react";
import * as fabric from "fabric";
import { useStore } from "@/shared/store";
import { createFabricObject } from "@/features/canvas/element-renderers";
import { SLIDE_WIDTH, SLIDE_HEIGHT } from "@/features/canvas/types";
import type { SlideElement } from "@/features/canvas/types";
import { X } from "lucide-react";

// Get the max animation order for a slide's elements
function getMaxAnimOrder(elements: SlideElement[]): number {
  let max = 0;
  for (const el of elements) {
    if (el.animation?.order && el.animation.order > max) max = el.animation.order;
  }
  return max;
}

export default function PresenterMode() {
  const presenterActive = useStore((s) => s.presenterActive);
  const setPresenterActive = useStore((s) => s.setPresenterActive);
  const presentation = useStore((s) => s.presentation);
  const [slideIndex, setSlideIndex] = useState(
    useStore.getState().currentSlideIndex
  );
  const [animStep, setAnimStep] = useState(999); // which animation step we've revealed (999 = all)
  const [showNotes, setShowNotes] = useState(false);
  const [blackScreen, setBlackScreen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionClass, setTransitionClass] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.StaticCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(Date.now());

  const slideIndexRef = useRef(slideIndex);
  const animStepRef = useRef(animStep);
  useEffect(() => { slideIndexRef.current = slideIndex; }, [slideIndex]);
  useEffect(() => { animStepRef.current = animStep; }, [animStep]);

  const slide = presentation.slides[slideIndex];
  const totalSlides = presentation.slides.length;
  const maxAnimOrder = slide ? getMaxAnimOrder(slide.elements) : 0;

  // Timer
  useEffect(() => {
    if (!presenterActive) return;
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [presenterActive]);

  // Render slide
  useEffect(() => {
    if (!presenterActive || !canvasRef.current || !slide) return;

    if (!fabricRef.current) {
      fabricRef.current = new fabric.StaticCanvas(canvasRef.current, {
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
      });
    }

    const canvas = fabricRef.current;
    let cancelled = false;

    const renderSlide = async () => {
      canvas.clear();
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

      const sorted = [...slide.elements].sort(
        (a, b) => (a.z_index ?? 0) - (b.z_index ?? 0)
      );
      for (const el of sorted) {
        if (cancelled) return;
        // Skip elements whose animation order hasn't been revealed yet
        const elOrder = el.animation?.order ?? 0;
        if (elOrder > 0 && elOrder > animStep) continue;

        const obj = await createFabricObject(el);
        if (cancelled) return;
        if (obj) {
          obj.selectable = false;
          obj.evented = false;
          canvas.add(obj);
        }
      }
      if (!cancelled) canvas.renderAll();
    };

    renderSlide();

    return () => { cancelled = true; };
  }, [presenterActive, slideIndex, slide, animStep]);

  // Resize
  const resizeCanvas = useCallback(() => {
    if (!fabricRef.current || !containerRef.current) return;
    const canvas = fabricRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = Math.min(
      rect.width / SLIDE_WIDTH,
      rect.height / SLIDE_HEIGHT
    );
    canvas.setZoom(scale);
    canvas.setDimensions({
      width: SLIDE_WIDTH * scale,
      height: SLIDE_HEIGHT * scale,
    });
  }, []);

  useEffect(() => {
    if (!presenterActive || !fabricRef.current || !containerRef.current) return;
    resizeCanvas();
  }, [presenterActive, slideIndex, resizeCanvas]);

  useEffect(() => {
    if (!presenterActive || !containerRef.current) return;
    const container = containerRef.current;
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(container);
    return () => ro.disconnect();
  }, [presenterActive, resizeCanvas]);

  // Reset animation step when slide changes
  useEffect(() => {
    const s = presentation.slides[slideIndex];
    const maxOrder = s ? getMaxAnimOrder(s.elements) : 0;
    // If the slide has animated elements, start at step 0 (show only non-animated)
    // If no animated elements, show everything
    setAnimStep(maxOrder > 0 ? 0 : 999);
  }, [slideIndex, presentation.slides]);

  // Slide transition helper
  const goToSlide = useCallback(
    (newIndex: number, direction: "forward" | "backward") => {
      if (transitioning) return;
      if (newIndex < 0 || newIndex >= totalSlides || newIndex === slideIndexRef.current) return;

      const nextSlide = presentation.slides[newIndex];
      const transitionType = nextSlide?.transition || "fade";

      if (transitionType === "none") {
        setSlideIndex(newIndex);
        return;
      }

      // Apply exit transition
      setTransitioning(true);
      if (transitionType === "slide") {
        setTransitionClass(direction === "forward" ? "presenter-slide-exit-left" : "presenter-slide-exit-right");
      } else {
        setTransitionClass("presenter-fade-exit");
      }

      setTimeout(() => {
        setSlideIndex(newIndex);
        // Apply enter transition
        if (transitionType === "slide") {
          setTransitionClass(direction === "forward" ? "presenter-slide-enter-right" : "presenter-slide-enter-left");
        } else {
          setTransitionClass("presenter-fade-enter");
        }
        setTimeout(() => {
          setTransitionClass("");
          setTransitioning(false);
        }, 300);
      }, 250);
    },
    [totalSlides, transitioning, presentation.slides]
  );

  // Keyboard
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "Enter": {
          e.preventDefault();
          // If there are more animation steps to reveal, advance animation first
          const currentSlide = presentation.slides[slideIndexRef.current];
          const currentMax = currentSlide ? getMaxAnimOrder(currentSlide.elements) : 0;
          if (animStepRef.current < currentMax) {
            setAnimStep(animStepRef.current + 1);
          } else {
            goToSlide(slideIndexRef.current + 1, "forward");
          }
          break;
        }
        case "ArrowLeft":
        case "Backspace": {
          e.preventDefault();
          // If we have revealed animation steps, go back one step
          if (animStepRef.current > 0 && animStepRef.current < 999) {
            setAnimStep(animStepRef.current - 1);
          } else {
            goToSlide(slideIndexRef.current - 1, "backward");
          }
          break;
        }
        case "Escape":
          setPresenterActive(false);
          break;
        case "n":
        case "N":
          setShowNotes((n) => !n);
          break;
        case "b":
        case "B":
          setBlackScreen((b) => !b);
          break;
      }
    },
    [totalSlides, setPresenterActive, goToSlide]
  );

  useEffect(() => {
    if (!presenterActive) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [presenterActive, handleKeyDown]);

  // Cleanup
  useEffect(() => {
    if (!presenterActive && fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }
  }, [presenterActive]);

  // Sync back to main view when exiting
  useEffect(() => {
    if (!presenterActive) {
      useStore.getState().setCurrentSlide(slideIndexRef.current);
    }
  }, [presenterActive]);

  if (!presenterActive) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Slide */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden"
      >
        {blackScreen ? (
          <div className="text-white/20 text-lg">Screen blacked out (B)</div>
        ) : (
          <div className={transitionClass} style={{ transition: "all 0.3s ease-in-out" }}>
            <canvas ref={canvasRef} />
          </div>
        )}
      </div>

      {/* Notes overlay */}
      {showNotes && slide?.notes && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 max-w-2xl w-full bg-black/80 backdrop-blur-sm text-white/80 px-6 py-4 rounded-t-xl text-sm leading-relaxed">
          {slide.notes}
        </div>
      )}

      {/* Slide number overlay (bottom-right corner of slide) */}
      {!blackScreen && (
        <div className="absolute bottom-16 right-8 text-white/15 text-sm font-medium pointer-events-none">
          {slideIndex + 1}
        </div>
      )}

      {/* Progress bar */}
      <div className="h-0.5 bg-white/5">
        <div
          className="h-full bg-morado-500/60 transition-all duration-300 ease-out"
          style={{ width: `${((slideIndex + 1) / totalSlides) * 100}%` }}
        />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-6 py-2 bg-black/60 text-white/60 text-sm">
        <div className="flex items-center gap-4">
          <span className="font-medium">
            {slideIndex + 1} / {totalSlides}
          </span>
          <span>{formatTime(elapsed)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/30">
          <span>← → Navigate</span>
          <span>N Notes</span>
          <span>B Black</span>
          <span>Esc Exit</span>
        </div>
        <button
          onClick={() => setPresenterActive(false)}
          className="p-1 rounded hover:bg-white/10 text-white/50"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
