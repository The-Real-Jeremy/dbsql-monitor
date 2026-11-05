import { createFileRoute, Link } from "@tanstack/react-router";
import Navbar from "@/components/apx/navbar";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { WarehouseNav } from "@/components/warehouses/warehouse-nav";
import {
  useWarehouseSettings,
  WarehouseSettingsMenu,
} from "@/components/warehouses/warehouse-settings";
import {
  WarehouseList,
  WarehouseListSkeleton,
} from "@/components/warehouses/warehouse-list";

export const Route = createFileRoute("/")({
  component: () => <Index />,
});

function Index() {
  const { settings, updateSettings, rangeOptions } = useWarehouseSettings();

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <Navbar
        leftContent={
          <Link
            to="/"
            className="text-sm font-semibold tracking-tight text-foreground transition hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label="Back to warehouses"
          >
            {__APP_NAME__}
          </Link>
        }
        rightContent={
          <div className="flex items-center gap-4">
            <WarehouseNav />
            <WarehouseSettingsMenu
              settings={settings}
              onChange={updateSettings}
              rangeOptions={rangeOptions}
            />
          </div>
        }
        className="font-mono"
        containerClassName="h-10 px-6"
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        <ErrorBoundary
          fallback={
            <div className="rounded-2xl border bg-card/70 p-6 text-sm text-destructive">
              Unable to load warehouses.
            </div>
          }
        >
          <Suspense fallback={<WarehouseListSkeleton />}>
            <WarehouseList />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
