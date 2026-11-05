import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const SETTINGS_STORAGE_KEY = "dbsql-monitor.settings";
const DEFAULT_SETTINGS = {
  maxTimelineSpans: 2000,
  defaultRangeHours: 1,
};
const DEFAULT_RANGE_OPTIONS = [
  { value: 1, label: "1h" },
  { value: 8, label: "8h" },
  { value: 24, label: "24h" },
  { value: 168, label: "7d" },
  { value: 336, label: "14d" },
];

type WarehouseSettings = typeof DEFAULT_SETTINGS;

function normalizeSettings(value: WarehouseSettings): WarehouseSettings {
  const maxTimelineSpans = Math.min(
    5000,
    Math.max(100, Math.round(value.maxTimelineSpans || DEFAULT_SETTINGS.maxTimelineSpans)),
  );
  const validRange =
    DEFAULT_RANGE_OPTIONS.find((option) => option.value === value.defaultRangeHours)
      ?.value ?? DEFAULT_SETTINGS.defaultRangeHours;
  return {
    maxTimelineSpans,
    defaultRangeHours: validRange,
  };
}

function readSettings(): WarehouseSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<WarehouseSettings>;
    return normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...parsed,
    });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useWarehouseSettings() {
  const [settings, setSettings] = useState<WarehouseSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(readSettings());
  }, []);

  const updateSettings = useCallback((partial: Partial<WarehouseSettings>) => {
    setSettings((current) => {
      const next = normalizeSettings({ ...current, ...partial });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  return { settings, updateSettings, rangeOptions: DEFAULT_RANGE_OPTIONS };
}

export function WarehouseSettingsMenu({
  settings,
  onChange,
  rangeOptions,
  className,
}: {
  settings: WarehouseSettings;
  onChange: (partial: Partial<WarehouseSettings>) => void;
  rangeOptions: { value: number; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label="Settings"
        ref={triggerRef}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground transition hover:text-foreground"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Settings className="h-4 w-4" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="Close settings"
                onClick={() => setOpen(false)}
              />
              <div className="relative w-full max-w-sm rounded-lg border border-border/60 bg-background p-4 text-xs shadow-2xl">
                <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  Settings
                </div>
                <div className="space-y-4">
                  <label className="space-y-1">
                    <span className="block text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
                      Max spans
                    </span>
                    <input
                      type="number"
                      min={100}
                      max={5000}
                      step={100}
                      value={settings.maxTimelineSpans}
                      onChange={(event) =>
                        onChange({
                          maxTimelineSpans: Number(event.target.value || 0),
                        })
                      }
                      className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-foreground"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
                      Default range
                    </span>
                    <select
                      value={settings.defaultRangeHours}
                      onChange={(event) =>
                        onChange({ defaultRangeHours: Number(event.target.value) })
                      }
                      className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-foreground"
                    >
                      {rangeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="rounded-md border border-border/60 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition hover:text-foreground"
                      onClick={() => {
                        setOpen(false);
                        triggerRef.current?.focus();
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
