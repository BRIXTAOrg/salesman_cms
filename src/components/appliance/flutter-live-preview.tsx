"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Loader2, RefreshCw, WifiOff } from "lucide-react";

import type { ResponsibilityKernel } from "@/lib/responsibility-kernel-types";

import {
  SoftPreviewOverlay,
  type SoftPreviewStatus,
  type SoftPreviewTab,
} from "./soft-preview-overlay";

/** How long to wait for the Flutter preview before saying it isn't running. */
const CONNECT_TIMEOUT_MS = 8000;

type Props = {
  kernel: ResponsibilityKernel;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  onBlockSelect?: (id: string) => void;
  onSelectedBlockIdChange?: (id: string) => void;
  isDragging?: boolean;
  draggingBlockId?: string | null;
  designContent?: ReactNode;
  /** BRIXTA_UI_V2: render the launcher in place instead of floating. */
  inline?: boolean;

  /**
   * BRIXTA_CREATOR_PREVIEW_V1
   *
   * Render the real Flutter iframe directly inside the page instead of
   * opening it through the preview overlay.
   */
  embedded?: boolean;

  [key: string]: unknown;
};

function previewUrl() {
  const configured =
    process.env.NEXT_PUBLIC_BRIXTA_FLUTTER_PREVIEW_URL?.trim();

  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost";

  const url = new URL(
    configured || "/flutter-preview/",
    base,
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
    designContent,
    inline = false,
    embedded = false,
  } = props;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  // BRIXTA_UI_V2: say plainly when the live preview isn't running.
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [frameMounted, setFrameMounted] = useState(false);
  const url = useMemo(() => previewUrl(), []);
  const document = kernel.metadata.ui?.uiDocument;

  const payload = useMemo(() => {
    const stateId = initialState(kernel);
    const captures: Record<string, unknown> = {};

    for (const item of kernel.possibilities) {
      if (item.type !== "capture") continue;

      const key = item.capture.storeAs?.trim() || item.capture.id;
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
      if (event.origin !== url.origin || typeof event.data !== "string") {
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
    if (!ready) return;

    const timer = window.setTimeout(send, 100);
    return () => window.clearTimeout(timer);
  }, [ready, send]);

  useEffect(() => {
    if (ready || !frameMounted) return;
    const timer = window.setTimeout(() => setTimedOut(true), CONNECT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [ready, attempt, frameMounted]);

  if (!document) return null;

  const status: SoftPreviewStatus = ready ? "live" : timedOut ? "offline" : "connecting";

  function retry() {
    setReady(false);
    setTimedOut(false);
    setAttempt((value) => value + 1);
  }

  const liveContent = (
    <div className="flex min-h-full justify-center py-2">
      <div className="relative h-[min(720px,calc(100vh-200px))] min-h-[480px] w-full max-w-[390px] overflow-hidden rounded-[32px] border-[6px] border-[#1D2321] bg-white shadow-[0_8px_20px_rgba(29,35,33,0.08),0_24px_56px_rgba(29,35,33,0.12)]">
        <iframe
          key={attempt}
          ref={(node) => {
            iframeRef.current = node;
            if (node && !frameMounted) setFrameMounted(true);
          }}
          title="Live app preview"
          src={url.toString()}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => {
            setReady(false);
            window.setTimeout(send, 120);
          }}
        />

        {status !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-6 text-center">
            {status === "connecting" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-[#2F6B62]" />
                <div className="text-[14px] font-medium text-[#1D2321]">Connecting to the app…</div>
                <div className="text-[13px] leading-5 text-[#5F6964]">
                  This takes a few seconds the first time.
                </div>
              </>
            ) : (
              <>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F3F0]">
                  <WifiOff className="h-5 w-5 text-[#5F6964]" />
                </span>
                <div className="text-[15px] font-semibold text-[#1D2321]">
                  Exact app preview is unavailable
                </div>

                <div className="text-[13px] leading-5 text-[#5F6964]">
                  {designContent
                    ? "Your editable Design preview still works. The exact Flutter renderer has not been installed in this deployment yet."
                    : "The Flutter renderer has not been installed in this deployment yet."}
                </div>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-1 inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#D3D8D3] bg-white px-3.5 text-[13px] font-medium text-[#1D2321] hover:bg-[#F6F7F5]"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Try again
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // BRIXTA_EMBEDDED_FLUTTER_PREVIEW_V1
  //
  // Preview stage in the creator uses the EXACT same Flutter renderer
  // that the employee app uses — not a React imitation.
  if (embedded) {
    return (
      <div className="w-full">
        {liveContent}
      </div>
    );
  }

  const tabs: SoftPreviewTab[] = [
    ...(designContent
      ? [
          {
            id: "design",
            label: "Design",
            content: (
              <div className="flex min-h-full justify-center py-2">
                {designContent}
              </div>
            ),
          },
        ]
      : []),
    {
      id: "live",
      label: "Live",
      content: liveContent,
    },
  ];

  return (
    <div className={inline ? "shrink-0" : "fixed bottom-4 right-4 z-[90] sm:bottom-5 sm:right-6"}>
      <SoftPreviewOverlay
        variant={inline ? "inline" : "floating"}
        launcherLabel={inline ? "Live app" : "Preview app"}
        title={designContent ? "App preview" : "Live app"}
        subtitle={
          designContent
            ? "What your team sees on the phone. Tap a part to edit it."
            : "The real app running your draft. Tap a part to select it."
        }
        badge={
          !frameMounted
            ? undefined
            : status === "live"
              ? "Live"
              : status === "connecting"
                ? "Connecting…"
                : "Live off"
        }
        status={status}
        tabs={tabs}
        defaultTabId={designContent ? "design" : "live"}
      />
    </div>
  );
}
