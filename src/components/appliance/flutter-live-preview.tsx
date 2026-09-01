"use client";

// BRIXTA_FAST_FLUTTER_ONLY
// One preview only: the local Flutter/Stac renderer on :5050.

import { Smartphone } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ResponsibilityKernel } from "@/lib/responsibility-kernel-types";

type Props = {
  kernel: ResponsibilityKernel;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  onBlockSelect?: (id: string) => void;
  onSelectedBlockIdChange?: (id: string) => void;
  isDragging?: boolean;
  draggingBlockId?: string | null;
  [key: string]: unknown;
};

function previewUrl() {
  const configured =
    process.env.NEXT_PUBLIC_BRIXTA_FLUTTER_PREVIEW_URL?.trim();

  const url = new URL(
    configured || "http://localhost:5050/",
  );

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

export function FlutterLivePreview(props: Props) {
  const {
    kernel,
    selectedBlockId,
    onSelectBlock,
    onBlockSelect,
    onSelectedBlockIdChange,
    isDragging = false,
    draggingBlockId,
  } = props;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const url = useMemo(() => previewUrl(), []);
  const document = kernel.metadata.ui?.uiDocument;

  const payload = useMemo(() => {
    const stateId = initialState(kernel);
    const captures: Record<string, unknown> = {};

    for (const item of kernel.possibilities) {
      if (item.type !== "capture") continue;

      const key =
        item.capture.storeAs?.trim() ||
        item.capture.id;

      captures[key] = item.capture;
      captures[item.capture.id] = item.capture;
    }

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
          __state: {
            process: stateId,
          },
        },
      },
      captures,
      actions,
      selectedBlockId: selectedBlockId ?? null,
      isDragging,
      draggingBlockId: draggingBlockId ?? null,
    };
  }, [
    document,
    draggingBlockId,
    isDragging,
    kernel,
    selectedBlockId,
  ]);

  const send = useCallback(() => {
    const target = iframeRef.current?.contentWindow;

    if (!target || !document) return;

    target.postMessage(
      JSON.stringify({
        type: "brixta.preview.update",
        payload,
      }),
      url.origin,
    );
  }, [document, payload, url.origin]);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (
        event.origin !== url.origin ||
        typeof event.data !== "string"
      ) {
        return;
      }

      try {
        const message = JSON.parse(event.data) as {
          type?: string;
          blockId?: string;
          id?: string;
          payload?: {
            blockId?: string;
            id?: string;
          };
        };

        if (message.type === "brixta.preview.ready") {
          setReady(true);
          queueMicrotask(send);
          return;
        }

        if (message.type === "brixta.preview.select") {
          const id =
            message.blockId ??
            message.id ??
            message.payload?.blockId ??
            message.payload?.id;

          if (typeof id === "string" && id.trim()) {
            const clean = id.trim();
            onSelectBlock?.(clean);
            onBlockSelect?.(clean);
            onSelectedBlockIdChange?.(clean);
          }
        }
      } catch {
        // Ignore unrelated messages.
      }
    }

    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [
    onBlockSelect,
    onSelectBlock,
    onSelectedBlockIdChange,
    send,
    url.origin,
  ]);

  useEffect(() => {
    if (ready) send();
  }, [ready, send]);

  if (!document) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone className="h-4 w-4" />
            Flutter device preview
          </div>

          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Local Flutter/Stac employee-app preview.
          </div>
        </div>

        <span className="rounded-full border px-2 py-1 text-[10px] text-muted-foreground">
          {ready ? "LIVE" : "CONNECTING"}
        </span>
      </div>

      <div className="bg-muted/20 p-3">
        <div className="mx-auto h-[720px] max-w-[390px] overflow-hidden rounded-[32px] border-[6px] border-foreground/90 bg-background">
          <iframe
            ref={iframeRef}
            title="BRIXTA Flutter preview"
            src={url.toString()}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin"
            onLoad={() => {
              setReady(false);
              window.setTimeout(send, 150);
            }}
          />
        </div>
      </div>
    </div>
  );
}
