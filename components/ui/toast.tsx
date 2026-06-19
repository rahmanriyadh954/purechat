"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
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

  const toast = useCallback((input: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...input, id }].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div
            className={cn(
              "flex gap-3 rounded-lg border bg-card p-4 text-sm shadow-xl shadow-black/10",
              item.kind === "success" && "border-emerald-500/30",
              item.kind === "error" && "border-destructive/30",
              item.kind === "info" && "border-accent/30"
            )}
            key={item.id}
          >
            {item.kind === "success" ? <CheckCircle2 className="size-5 text-emerald-600" /> : null}
            {item.kind === "error" ? <XCircle className="size-5 text-destructive" /> : null}
            {item.kind === "info" ? <Info className="size-5 text-accent" /> : null}
            <div>
              <p className="font-medium">{item.title}</p>
              {item.description ? <p className="mt-1 text-muted-foreground">{item.description}</p> : null}
            </div>
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
