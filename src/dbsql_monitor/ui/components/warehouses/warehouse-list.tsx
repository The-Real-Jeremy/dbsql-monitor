import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { selector } from "@/lib/selector";
import {
  type Warehouse,
  sortWarehouses,
  toWarehouse,
  useWarehousesSuspense,
} from "@/components/warehouses/warehouse-data";
import { useMemo, useState } from "react";

const sparklineStyles: Record<Warehouse["state"], string> = {
  active: "text-emerald-500",
  idle: "text-amber-500",
  stopped: "text-slate-400",
};

const statusDotStyles: Record<Warehouse["state"], string> = {
  active: "bg-emerald-500",
  idle: "bg-amber-500",
  stopped: "bg-slate-400",
};

export function WarehouseList() {
  const { data } = useWarehousesSuspense(selector());
  const [search, setSearch] = useState("");
  const warehouses = useMemo(() => data.map(toWarehouse), [data]);
  const filteredWarehouses = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return warehouses;
    }

    return warehouses.filter((warehouse) => {
      const haystack = [
        warehouse.name,
        warehouse.size,
        warehouse.type,
        warehouse.ownerName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [search, warehouses]);
  const sortedWarehouses = useMemo(
    () => sortWarehouses(filteredWarehouses),
    [filteredWarehouses],
  );

  return (
    <section className="rounded-2xl border bg-card/70 shadow-sm">
      <div className="flex flex-col gap-4 px-5 py-4 border-b sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Warehouses
          </p>
        </div>
        <input
          className="h-8 w-full rounded-md border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] sm:w-64"
          placeholder="Search warehouses"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search warehouses"
        />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="px-5 py-2 text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
          <div className="grid grid-cols-[16px_minmax(160px,1.6fr)_90px_110px_130px_70px_140px] items-center gap-3">
            <span />
            <span>Name</span>
            <span>Size</span>
            <span>Type</span>
            <span>Scaling</span>
            <span>Owner</span>
            <span>Queries (1h)</span>
          </div>
        </div>
        <ul className="divide-y">
            {sortedWarehouses.length === 0 ? (
              <li className="px-5 py-6 text-sm text-muted-foreground">
                No warehouses match this search.
              </li>
            ) : (
              sortedWarehouses.map((warehouse) => (
            <li key={warehouse.id}>
              <WarehouseRow warehouse={warehouse} />
            </li>
          ))
        )}
      </ul>
        </div>
      </div>
    </section>
  );
}

export function WarehouseListSkeleton() {
  return (
    <section className="rounded-2xl border bg-card/70 shadow-sm">
      <div className="flex flex-col gap-4 px-5 py-4 border-b sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="px-5 py-2">
            <Skeleton className="h-3 w-full" />
          </div>
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`warehouse-skeleton-${index}`}
              className="grid grid-cols-[16px_minmax(160px,1.6fr)_90px_110px_130px_70px_140px] items-center gap-3 px-5 py-2 border-b last:border-b-0"
            >
              <Skeleton className="h-2 w-2 rounded-full justify-self-end" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-7 w-24" />
            </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WarehouseRow({ warehouse }: { warehouse: Warehouse }) {
  return (
    <Link
      to="/warehouse/$warehouseId"
      params={{ warehouseId: warehouse.id }}
      className="grid grid-cols-[16px_minmax(160px,1.6fr)_90px_110px_130px_70px_140px] items-center gap-3 px-5 py-2 text-sm transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      aria-label={`Open ${warehouse.name} details`}
    >
      <span className="flex items-center justify-end">
        <span
          className={cn("h-2 w-2 rounded-full", statusDotStyles[warehouse.state])}
          title={warehouse.state}
          aria-hidden="true"
        />
      </span>
      <p className="font-medium text-foreground">{warehouse.name}</p>
      <span className="text-xs text-muted-foreground">{warehouse.size}</span>
      <span className="text-xs text-muted-foreground">{warehouse.type}</span>
      <span className="text-xs text-muted-foreground">
        {warehouse.scalingStatus}
      </span>
      <OwnerAvatar ownerName={warehouse.ownerName} />
      <div className="flex items-center gap-2">
        <WarehouseSparkline
          activity={warehouse.activity}
          className={sparklineStyles[warehouse.state]}
        />
        <span className="text-xs text-muted-foreground">
          {warehouse.activeQueries}
        </span>
      </div>
    </Link>
  );
}

function WarehouseSparkline({
  activity,
  className,
}: {
  activity: number[];
  className?: string;
}) {
  const width = 120;
  const height = 28;
  const safeActivity =
    activity.length > 1 ? activity : [0, activity[0] ?? 0, 0];
  const min = Math.min(...safeActivity);
  const max = Math.max(...safeActivity);
  const range = Math.max(1, max - min);

  const points = safeActivity.map((value, index) => {
    const x = (index / (safeActivity.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const path = `M ${points[0]} ${points
    .slice(1)
    .map((point) => `L ${point}`)
    .join(" ")}`;

  return (
    <svg
      aria-hidden="true"
      className={cn("h-6 w-28 text-slate-400", className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1].split(",")[0]}
        cy={points[points.length - 1].split(",")[1]}
        r="2"
        fill="currentColor"
      />
    </svg>
  );
}

function OwnerAvatar({ ownerName }: { ownerName: string | null }) {
  const initials = ownerName
    ? ownerName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
    : "?";

  return (
    <div
      title={ownerName ?? "Unknown owner"}
      aria-label={ownerName ?? "Unknown owner"}
      className="h-7 w-7 rounded-full border bg-muted text-[10px] font-semibold text-muted-foreground flex items-center justify-center"
    >
      {initials}
    </div>
  );
}
