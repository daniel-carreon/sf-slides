import { useEffect, useRef } from "react";
import { useStore } from "@/shared/store";
import type { Presentation } from "@/features/canvas/types";

export function useFileWatcher() {
  const filePath = useStore((s) => s.filePath);
  const setPresentation = useStore((s) => s.setPresentation);
  const lastSaveTimeRef = useRef(0);

  useEffect(() => {
    if (!filePath) return;

    let cleanup: (() => void) | null = null;

    const setupWatcher = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { listen } = await import("@tauri-apps/api/event");

        // Start watching the file
        await invoke("watch_file", { path: filePath });

        // Listen for file change events
        const unlisten = await listen<string>("file-changed", async (event) => {
          // Ignore changes within 500ms of our own save
          if (Date.now() - lastSaveTimeRef.current < 500) return;

          try {
            const fs = await import("@tauri-apps/plugin-fs");
            const content = await fs.readTextFile(filePath);
            const data = JSON.parse(content) as Presentation;
            if (data && data.slides) {
              console.log("[FileWatcher] Hot reload from:", event.payload);
              setPresentation(data, filePath);
            }
          } catch (err) {
            console.error("[FileWatcher] Failed to reload:", err);
          }
        });

        cleanup = () => {
          unlisten();
          invoke("stop_watching", {}).catch(() => {});
        };
      } catch (err) {
        console.warn("[FileWatcher] Not in Tauri environment:", err);
      }
    };

    setupWatcher();

    return () => {
      cleanup?.();
    };
  }, [filePath, setPresentation]);

  // Track save times to debounce our own saves
  useEffect(() => {
    const unsub = useStore.subscribe((state, prev) => {
      if (state.dirty !== prev.dirty && !state.dirty) {
        lastSaveTimeRef.current = Date.now();
      }
    });
    return unsub;
  }, []);
}
