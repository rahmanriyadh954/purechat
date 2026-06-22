"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";

type Toast = {
  id: string;
  title: string;
  description?: string;
  kind: ToastKind;
};

type ToastContextValue = {
  toast: (input: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dragByToast, setDragByToast] = useState<Record<string, { startX: number; currentX: number }>>({});

  const toast = useCallback((input: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...input, id }].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);
  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    setDragByToast((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 flex max-w-sm flex-col gap-2 sm:left-auto sm:right-4 sm:bottom-4" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div
            className={cn(
              "flex touch-pan-y gap-3 rounded-lg border bg-card p-4 text-sm shadow-xl shadow-black/10 transition-transform",
              item.kind === "success" && "border-emerald-500/30",
              item.kind === "error" && "border-destructive/30",
              item.kind === "info" && "border-accent/30"
            )}
            key={item.id}
            style={{
              transform: `translateX(${dragByToast[item.id]?.currentX ?? 0}px)`,
              opacity: dragByToast[item.id]?.currentX
                ? Math.max(0.45, 1 - Math.abs(dragByToast[item.id].currentX) / 260)
                : 1
            }}
            onPointerDown={(event) => {
              setDragByToast((current) => ({
                ...current,
                [item.id]: { startX: event.clientX, currentX: 0 }
              }));
            }}
            onPointerMove={(event) => {
              setDragByToast((current) => {
                const drag = current[item.id];
                if (!drag) return current;
                return {
                  ...current,
                  [item.id]: {
                    ...drag,
                    currentX: event.clientX - drag.startX
                  }
                };
              });
            }}
            onPointerUp={() => {
              const drag = dragByToast[item.id];
              if (drag && Math.abs(drag.currentX) > 90) {
                dismiss(item.id);
                return;
              }
              setDragByToast((current) => {
                const next = { ...current };
                delete next[item.id];
                return next;
              });
            }}
            onPointerCancel={() => {
              setDragByToast((current) => {
                const next = { ...current };
                delete next[item.id];
                return next;
              });
            }}
          >
            {item.kind === "success" ? <CheckCircle2 className="size-5 text-emerald-600" /> : null}
            {item.kind === "error" ? <XCircle className="size-5 text-destructive" /> : null}
            {item.kind === "info" ? <Info className="size-5 text-accent" /> : null}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.title}</p>
              {item.description ? <p className="mt-1 text-muted-foreground">{item.description}</p> : null}
            </div>
            <button
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(item.id)}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }
  return context;
}
