import { useRef, useEffect, forwardRef, useImperativeHandle, memo } from "react";
import { SLIDE_WIDTH, SLIDE_HEIGHT } from "./types";
import { EMBEDDED_FONTS_CSS } from "@/assets/fonts/embedded-fonts";

interface HtmlSlideRendererProps {
  html: string;
  width?: number;   // Display width (CSS pixels)
  height?: number;  // Display height (CSS pixels)
  className?: string;
  interactive?: boolean; // Allow pointer events in iframe
}

export interface HtmlSlideRendererHandle {
  getIframe: () => HTMLIFrameElement | null;
}

/**
 * Renders a full HTML slide in an iframe using blob URLs.
 *
 * Why blob URL instead of srcdoc?
 * - Tauri v2 WKWebView blocks external CDN resources in srcdoc iframes
 * - Blob URLs bypass this restriction
 * - All fonts (Inter + Font Awesome) are embedded as base64 data URLs
 * - Zero external dependencies = works offline and in any WebView
 */
const HtmlSlideRendererInner = forwardRef<HtmlSlideRendererHandle, HtmlSlideRendererProps>(
  function HtmlSlideRendererInner(
    { html, width, height, className = "", interactive = false },
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const blobUrlRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      getIframe: () => iframeRef.current,
    }));

    // Calculate scale factor based on display size
    const displayWidth = width ?? SLIDE_WIDTH;
    const displayHeight = height ?? SLIDE_HEIGHT;
    const scaleX = displayWidth / SLIDE_WIDTH;
    const scaleY = displayHeight / SLIDE_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    // Inject embedded fonts into the HTML and create blob URL
    useEffect(() => {
      // Clean up previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      const processedHtml = injectEmbeddedFonts(html);
      const blob = new Blob([processedHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      if (iframeRef.current) {
        iframeRef.current.src = url;
      }

      return () => {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    }, [html]);

    return (
      <div
        className={`relative overflow-hidden ${className}`}
        style={{
          width: displayWidth,
          height: displayHeight,
        }}
      >
        <iframe
          ref={iframeRef}
          style={{
            width: SLIDE_WIDTH,
            height: SLIDE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            border: "none",
            pointerEvents: interactive ? "auto" : "none",
          }}
          title="Slide"
        />
      </div>
    );
  }
);

/**
 * Inject embedded fonts CSS into the HTML document.
 * Replaces external CDN links with inline base64-encoded font data.
 */
function injectEmbeddedFonts(html: string): string {
  let processed = html;

  // Remove external CDN links (they don't work in Tauri WebView)
  processed = processed.replace(
    /<link[^>]*fonts\.googleapis\.com[^>]*>/gi,
    ""
  );
  processed = processed.replace(
    /<link[^>]*cdnjs\.cloudflare\.com[^>]*font-awesome[^>]*>/gi,
    ""
  );
  processed = processed.replace(
    /<script[^>]*cdn\.tailwindcss\.com[^>]*><\/script>/gi,
    ""
  );
  // Handle escaped version too (JSON strings)
  processed = processed.replace(
    /<script[^>]*cdn\.tailwindcss\.com[^>]*><\\\/script>/gi,
    ""
  );

  // Inject embedded fonts CSS into <head>
  const fontsStyle = `<style id="embedded-fonts">${EMBEDDED_FONTS_CSS}</style>`;

  if (processed.includes("</head>")) {
    processed = processed.replace("</head>", `${fontsStyle}</head>`);
  } else if (processed.includes("<body")) {
    processed = processed.replace("<body", `${fontsStyle}<body`);
  } else {
    // Wrap in full document
    processed = wrapPartialHtml(processed);
  }

  return processed;
}

/** Wrap partial HTML (just body content) in a full document with embedded fonts */
function wrapPartialHtml(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style id="embedded-fonts">${EMBEDDED_FONTS_CSS}</style>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      width: ${SLIDE_WIDTH}px;
      height: ${SLIDE_HEIGHT}px;
      margin: 0;
      overflow: hidden;
      background: #0D0D0D;
      color: #FFFFFF;
    }
  </style>
</head>
<body>${bodyContent}</body>
</html>`;
}

export const HtmlSlideRenderer = memo(HtmlSlideRendererInner);
