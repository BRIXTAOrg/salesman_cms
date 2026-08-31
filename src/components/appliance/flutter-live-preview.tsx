"use client";

// BRIXTA_UNIVERSAL_INTEGRATION_V1
// The preview is the real Flutter/Stac renderer running as Flutter Web.

import { Smartphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ResponsibilityKernel } from "@/lib/responsibility-kernel-types";

function previewUrl() {
  const configured = process.env.NEXT_PUBLIC_BRIXTA_FLUTTER_PREVIEW_URL?.trim();
  const base = configured || "http://localhost:5050/";
  const url = new URL(base);
  url.searchParams.set("brixtaPreview", "1");
  return url;
}

function initialState(kernel: ResponsibilityKernel) {
  return (
    kernel.metadata.ui?.previewStateId ??
    kernel.runtimeWorld.states.find((state) => state.initial)?.id ??
    kernel.runtimeWorld.states[0]?.id ??
    "draft"
  );
}

export function FlutterLivePreview({ kernel }: { kernel: ResponsibilityKernel }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const url = useMemo(() => previewUrl(), []);
  const document = kernel.metadata.ui?.uiDocument;

  const payload = useMemo(() => {
    const stateId = initialState(kernel);
    const captures = Object.fromEntries(
      kernel.possibilities
        .filter((item) => item.type === "capture")
        .map((item) =>
          item.type === "capture" ? [item.capture.id, item.capture] : ["", {}],
        ),
    );
    const actions = kernel.possibilities
      .filter((item) => item.type === "action")
      .map((item) => {
        if (item.type !== "action") return null;
        return {
          key: item.action.id,
          label: item.action.label,
          kind: item.action.kind,
          config: item.action.config,
          status:
            typeof item.action.config.resultingState === "string"
              ? item.action.config.resultingState
              : stateId,
          successMessage:
            typeof item.action.config.successMessage === "string"
              ? item.action.config.successMessage
              : undefined,
        };
      })
      .filter(Boolean);

    return {
      document,
      stateId,
      record: {
        id: "builder-preview",
        status: stateId,
        payload: {
          __state: { process: stateId },
        },
      },
      captures,
      actions,
    };
  }, [document, kernel]);

  function send() {
    const target = iframeRef.current?.contentWindow;
    if (!target || !document) return;
    target.postMessage(
      JSON.stringify({
        type: "brixta.preview.update",
        payload,
      }),
      url.origin,
    );
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== url.origin || typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        if (parsed.type === "brixta.preview.ready") {
          setReady(true);
          queueMicrotask(send);
        }
      } catch {
        // Ignore unrelated iframe messages.
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [url.origin, document, payload]);

  useEffect(() => {
    if (ready) send();
  }, [ready, payload]);

  if (!document) {
    return null;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone className="h-4 w-4" />
            Live Flutter renderer
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Same Flutter/Stac presentation renderer used by the employee app.
          </div>
        </div>
        <span className="rounded-full border px-2 py-1 text-[10px] text-muted-foreground">
          {ready ? "LIVE" : "CONNECTING"}
        </span>
      </div>
      <div className="bg-muted/20 p-3">
        <div className="mx-auto h-[720px] max-w-[390px] overflow-hidden rounded-[32px] border-[6px] border-foreground/90 bg-background shadow-sm">
          <iframe
            ref={iframeRef}
            title="BRIXTA Flutter live preview"
            src={url.toString()}
            className="h-full w-full border-0 bg-background"
            onLoad={() => {
              setReady(false);
              setTimeout(send, 150);
            }}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
      {!ready && (
        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          Start the integrated studio with <code>npm run dev:studio</code>. The CMS will connect automatically.
        </div>
      )}
    </div>
  );
}
