import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ErrorBoundary } from "react-error-boundary";
import Navbar from "@/components/apx/navbar";
import { WarehouseNav } from "@/components/warehouses/warehouse-nav";
import {
  useWarehouseSettings,
  WarehouseSettingsMenu,
} from "@/components/warehouses/warehouse-settings";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { selector } from "@/lib/selector";
import { useWarehousesSuspense } from "@/components/warehouses/warehouse-data";
import {
  useWarehouseEndpointMetricsSuspense,
  type WarehouseStats,
  useWarehouseStatsSuspense,
  useWarehouseQueriesInfiniteSuspense,
  useWorkspaceContextSuspense,
  type WarehouseEndpointMetric,
  type WarehouseQuery,
  type WarehouseQueriesPage,
} from "@/components/warehouses/warehouse-metrics";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";

export const Route = createFileRoute("/warehouse/$warehouseId")({
  component: () => <WarehouseDetail />,
});

function WarehouseDetail() {
  const { warehouseId } = Route.useParams();
  const { settings, updateSettings, rangeOptions } = useWarehouseSettings();
  const rangeState = useWarehouseRange(settings.defaultRangeHours);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <Navbar
        leftContent={
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-sm font-semibold tracking-tight text-foreground transition hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label="Back to warehouses"
            >
              {__APP_NAME__}
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <ErrorBoundary
              fallback={<WarehouseIdentityFallback warehouseId={warehouseId} />}
            >
              <Suspense fallback={<WarehouseIdentitySkeleton />}>
                <WarehouseIdentity warehouseId={warehouseId} />
              </Suspense>
            </ErrorBoundary>
          </div>
        }
        rightContent={
          <div className="flex items-center gap-4">
            <RangePicker rangeState={rangeState} />
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

      <main className="flex min-h-[calc(100vh-2.5rem)] w-full">
        <div className="flex min-w-0 flex-1 flex-col pb-8">
          <section className="border-b bg-card/70">
            <ErrorBoundary
              fallbackRender={({ error }) => <MetricsError error={error} />}
            >
              <Suspense fallback={<MetricsSkeleton />}>
                <WarehouseMetrics
                  warehouseId={warehouseId}
                  rangeState={rangeState}
                />
              </Suspense>
            </ErrorBoundary>
          </section>

          <section className="px-6 pt-2">
            <ErrorBoundary
              fallbackRender={({ error }) => <QueriesError error={error} />}
            >
              <Suspense fallback={<QueriesSkeleton />}>
                <WarehouseQueriesTimeline
                  warehouseId={warehouseId}
                  range={rangeState.displayRange}
                  basePreset={rangeState.basePreset}
                  fetchRange={rangeState.baseRange}
                  maxTimelineSpans={settings.maxTimelineSpans}
                  selectedUser={selectedUser}
                  selectedSource={selectedSource}
                  onZoom={(range) => {
                    rangeState.setCustomRange(range);
                    rangeState.setRangePreset("custom");
                  }}
                  onResetZoom={rangeState.resetZoom}
                  isZoomed={rangeState.isZoomed}
                />
              </Suspense>
            </ErrorBoundary>
          </section>
        </div>
        <aside className="w-72 shrink-0 border-l border-border/60 bg-card/60 px-4 py-6">
          <ErrorBoundary fallback={<SummaryError />}>
            <Suspense fallback={<SummarySkeleton />}>
              <WarehouseSummaryPanel
                warehouseId={warehouseId}
                basePreset={rangeState.basePreset}
                fetchRange={rangeState.baseRange}
                range={rangeState.displayRange}
                isZoomed={rangeState.isZoomed}
                onUserSelect={(user) =>
                  setSelectedUser((current) => (current === user ? null : user))
                }
                onSourceSelect={(source) =>
                  setSelectedSource((current) =>
                    current === source ? null : source,
                  )
                }
              />
            </Suspense>
          </ErrorBoundary>
        </aside>
      </main>
    </div>
  );
}

function RangePicker({ rangeState }: { rangeState: WarehouseRangeState }) {
  const {
    rangeOptions,
    rangePreset,
    setRangePreset,
    setBasePreset,
    setCustomRange,
  } = rangeState;

  return (
    <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
      <select
        className="rounded-md border border-border/60 bg-background px-2 py-1 text-[10px] text-foreground"
        value={rangePreset}
        onChange={(event) => {
          const value = event.target.value as RangeOption["id"] | "custom";
          if (value === "custom") {
            setRangePreset("custom");
            return;
          }
          setCustomRange(null);
          setRangePreset(value);
          setBasePreset(value);
        }}
      >
        {rangeOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
        <option value="custom">Custom range</option>
      </select>
    </div>
  );
}

type RangeOption = {
  id:
    | "last_1_hour"
    | "last_8_hours"
    | "last_24_hours"
    | "last_7_days"
    | "last_14_days";
  label: string;
  durationMs: number;
};

const RANGE_OPTIONS: RangeOption[] = [
  { id: "last_1_hour", label: "Last hour", durationMs: 60 * 60 * 1000 },
  { id: "last_8_hours", label: "Last 8 hours", durationMs: 8 * 60 * 60 * 1000 },
  {
    id: "last_24_hours",
    label: "Last 24 hours",
    durationMs: 24 * 60 * 60 * 1000,
  },
  { id: "last_7_days", label: "Last 7 days", durationMs: 7 * 24 * 60 * 60 * 1000 },
  { id: "last_14_days", label: "Last 14 days", durationMs: 14 * 24 * 60 * 60 * 1000 },
];

type WarehouseRangeState = {
  rangeOptions: RangeOption[];
  rangePreset: RangeOption["id"] | "custom";
  basePreset: RangeOption["id"];
  selectedOption: RangeOption;
  baseRange: { startMs: number; endMs: number };
  activeRange: { startMs: number; endMs: number };
  displayRange: { startMs: number; endMs: number };
  isZoomed: boolean;
  setRangePreset: (value: RangeOption["id"] | "custom") => void;
  setBasePreset: (value: RangeOption["id"]) => void;
  setCustomRange: (range: { startMs: number; endMs: number } | null) => void;
  resetZoom: () => void;
};

function resolvePresetFromHours(hours: number) {
  const targetMs = hours * 60 * 60 * 1000;
  return (
    RANGE_OPTIONS.find((option) => option.durationMs === targetMs)?.id ??
    RANGE_OPTIONS[0].id
  );
}

function useWarehouseRange(defaultRangeHours: number): WarehouseRangeState {
  const rangeOptions = RANGE_OPTIONS;
  const defaultPreset = useMemo(
    () => resolvePresetFromHours(defaultRangeHours),
    [defaultRangeHours],
  );
  const [basePreset, setBasePreset] =
    useState<RangeOption["id"]>(defaultPreset);
  const [rangePreset, setRangePreset] =
    useState<RangeOption["id"] | "custom">(defaultPreset);
  const [customRange, setCustomRange] = useState<{
    startMs: number;
    endMs: number;
  } | null>(null);
  const [rangeAnchorMs, setRangeAnchorMs] = useState(() => Date.now());
  const selectedOption =
    rangeOptions.find((option) => option.id === rangePreset) ??
    rangeOptions.find((option) => option.id === basePreset) ??
    rangeOptions[0];
  const baseOption =
    rangeOptions.find((option) => option.id === basePreset) ?? rangeOptions[0];

  useEffect(() => {
    if (rangePreset === "custom" && customRange) {
      return;
    }
    const interval = window.setInterval(() => {
      setRangeAnchorMs(Date.now());
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [customRange, rangePreset]);

  useEffect(() => {
    if (rangePreset === "custom" && customRange) {
      return;
    }
    setRangeAnchorMs(Date.now());
  }, [customRange, rangePreset, selectedOption.durationMs]);

  const baseRange = {
    startMs: rangeAnchorMs - baseOption.durationMs,
    endMs: rangeAnchorMs,
  };
  const activeRange =
    rangePreset === "custom" && customRange ? customRange : baseRange;
  const displayRange =
    rangePreset === "custom" && customRange ? customRange : activeRange;
  const isZoomed = rangePreset === "custom";
  const resetZoom = () => {
    setCustomRange(null);
    setRangePreset(basePreset);
  };

  return {
    rangeOptions,
    rangePreset,
    basePreset,
    selectedOption,
    baseRange,
    activeRange,
    displayRange,
    isZoomed,
    setRangePreset,
    setBasePreset,
    setCustomRange,
    resetZoom,
  };
}

function MiniStepChart({
  values,
  className,
  height = 24,
}: {
  values: number[];
  className: string;
  height?: number;
}) {
  const safeValues = values.length > 0 ? values : [0];
  const maxValue = Math.max(...safeValues, 1);
  const minValue = Math.min(...safeValues, 0);
  const range = Math.max(1, maxValue - minValue);
  const width = 120;
  const stepWidth = width / Math.max(safeValues.length, 1);

  const points = safeValues.map((value, index) => {
    const x = index * stepWidth;
    const y = height - ((value - minValue) / range) * height;
    return { x, y };
  });

  const basePath = points.reduce((acc, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    return `${acc} H ${point.x} V ${point.y}`;
  }, "");
  const linePath = `${basePath} H ${width}`;

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none h-full w-full text-foreground/70",
        className,
      )}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="miter"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function WarehouseMetrics({
  warehouseId,
  rangeState,
}: {
  warehouseId: string;
  rangeState: WarehouseRangeState;
}) {
  const queryClient = useQueryClient();
  const statsSelector = selector<WarehouseStats>();
  const { data: stats } = useWarehouseStatsSuspense(warehouseId, {
    ...statsSelector,
    query: {
      ...statsSelector.query,
      refetchInterval: rangeState.isZoomed ? false : 15_000,
      refetchIntervalInBackground: !rangeState.isZoomed,
    },
  });
  const {
    activeRange,
    displayRange,
    baseRange,
    basePreset,
    setRangePreset,
    setCustomRange,
    resetZoom,
  } = rangeState;
  const metricsSelector = selector<WarehouseEndpointMetric[]>();
  const rangeKey = [basePreset];
  const displayRangeMs = Math.max(1, displayRange.endMs - displayRange.startMs);
  const bucketMs = getBucketMs(displayRangeMs);
  const minFetchMs = Math.max(displayRangeMs, bucketMs);
  const paddingMs = Math.max(0, Math.ceil((minFetchMs - displayRangeMs) / 2));
  const metricsRange = rangeState.isZoomed
    ? {
        startMs: Math.max(0, baseRange.startMs),
        endMs: baseRange.endMs,
      }
    : activeRange;
  const requestParams = {
    start_time_ms: metricsRange.startMs,
    end_time_ms: metricsRange.endMs,
  };
  const { data: metrics } = useWarehouseEndpointMetricsSuspense(warehouseId, {
    ...metricsSelector,
    query: {
      ...metricsSelector.query,
      queryKey: [
        "/api/warehouses",
        warehouseId,
        "endpoint-metrics",
        ...rangeKey,
      ],
      refetchInterval: rangeState.isZoomed ? false : 15_000,
      refetchIntervalInBackground: !rangeState.isZoomed,
    },
    axios: { params: requestParams },
  });

  const currentRunning = stats.num_running_commands ?? 0;
  const currentQueued = stats.num_queued_commands ?? 0;
  const currentClusters = stats.num_active_clusters ?? 0;
  const safeMetrics = metrics.length > 0 ? metrics : [];
  const derivedTimelineData = useMemo(() => {
    if (!rangeState.isZoomed) {
      return null;
    }
    const rangeMs = displayRange.endMs - displayRange.startMs;
    if (rangeMs > 30 * 60 * 1000) {
      return null;
    }
    const cached = queryClient.getQueryData<
      InfiniteData<{ data: WarehouseQueriesPage }>
    >([
      "/api/warehouses",
      warehouseId,
      "queries",
      basePreset,
    ]);
    const queries =
      cached?.pages?.flatMap((page) => page.data?.queries ?? []) ?? [];
    if (queries.length === 0) {
      return null;
    }
    return buildQueryHistoryTimeline(
      queries,
      displayRange,
      currentClusters,
    );
  }, [
    basePreset,
    currentClusters,
    displayRange.endMs,
    displayRange.startMs,
    queryClient,
    rangeState.isZoomed,
    warehouseId,
  ]);

  const timelineData = useMemo(() => {
    if (derivedTimelineData) {
      return derivedTimelineData;
    }
    if (safeMetrics.length === 0) {
      return [
        {
          startMs: displayRange.startMs,
          endMs: displayRange.endMs,
          running: currentRunning,
          queued: currentQueued,
          completed: 0,
          scaling: currentClusters,
        },
      ];
    }
    const data = buildTimelineData(
      safeMetrics,
      displayRange.startMs,
      displayRange.endMs,
    );
    if (data.length === 0) {
      return [
        {
          startMs: displayRange.startMs,
          endMs: displayRange.endMs,
          running: currentRunning,
          queued: currentQueued,
          completed: 0,
          scaling: currentClusters,
        },
      ];
    }
    return data;
  }, [
    currentClusters,
    currentQueued,
    currentRunning,
    derivedTimelineData,
    displayRange.endMs,
    displayRange.startMs,
    safeMetrics,
  ]);
  const completedSeries = timelineData.map((metric) => metric.completed);
  const currentCompleted = completedSeries[completedSeries.length - 1] ?? 0;

  return (
    <MetricsTimeline
      data={timelineData}
      current={{
        running: currentRunning,
        queued: currentQueued,
        completed: currentCompleted,
        clusters: currentClusters,
      }}
      baseRange={baseRange}
      onZoom={(range) => {
        setCustomRange(range);
        setRangePreset("custom");
      }}
      onResetZoom={resetZoom}
    />
  );
}

type TimelineMetric = {
  startMs: number;
  endMs: number;
  running: number;
  queued: number;
  completed: number;
  scaling: number;
};

type MetricsTimelineProps = {
  data: TimelineMetric[];
  current: {
    running: number;
    queued: number;
    completed: number;
    clusters: number;
  };
  baseRange: { startMs: number; endMs: number };
  onZoom: (range: { startMs: number; endMs: number }) => void;
  onResetZoom: () => void;
};

function MetricsTimeline({
  data,
  current,
  baseRange,
  onZoom,
  onResetZoom,
}: MetricsTimelineProps) {
  const [hover, setHover] = useState<{
    index: number;
    percent: number;
    left: number;
    top: number;
    containerWidth: number;
  } | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragCurrent, setDragCurrent] = useState<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; startMs: number; endMs: number } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);
  const selection =
    dragStart !== null && dragCurrent !== null
      ? {
          left: Math.min(dragStart, dragCurrent),
          width: Math.abs(dragCurrent - dragStart),
        }
      : null;
  const hoverMetric = hover ? data[hover.index] : null;
  const rangeStart = data[0]?.startMs ?? 0;
  const rangeEnd = data[data.length - 1]?.endMs ?? rangeStart;
  const rangeMs = Math.max(1, rangeEnd - rangeStart);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const percent = rect.width > 0 ? x / rect.width : 0;
    const index = Math.min(
      data.length - 1,
      Math.max(0, Math.round(percent * (data.length - 1))),
    );
    const containerRect = containerRef.current?.getBoundingClientRect();
    const containerLeft = containerRect?.left ?? rect.left;
    const containerTop = containerRect?.top ?? rect.top;
    setHover({
      index,
      percent,
      left: rect.left + x - containerLeft,
      top: rect.top - containerTop,
      containerWidth: containerRect?.width ?? rect.width,
    });
    if (isPanning && panStartRef.current && rect.width > 0) {
      const delta = (event.clientX - panStartRef.current.x) / rect.width;
      const deltaMs = delta * rangeMs;
      const candidateStart = panStartRef.current.startMs + deltaMs;
      const candidateEnd = panStartRef.current.endMs + deltaMs;
      const clampedStart = Math.max(
        baseRange.startMs,
        Math.min(candidateStart, baseRange.endMs - rangeMs),
      );
      const clampedEnd = clampedStart + rangeMs;
      onZoom({
        startMs: Math.floor(clampedStart),
        endMs: Math.ceil(clampedEnd),
      });
      return;
    }
    if (dragStart !== null) {
      setDragCurrent(percent);
    }
  };

  const handlePointerLeave = () => {
    if (dragStart === null) {
      setHover(null);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const percent = rect.width > 0 ? x / rect.width : 0;
    if (event.metaKey) {
      setIsPanning(true);
      panStartRef.current = {
        x: event.clientX,
        startMs: rangeStart,
        endMs: rangeEnd,
      };
    } else {
      setDragStart(percent);
      setDragCurrent(percent);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      setDragStart(null);
      setDragCurrent(null);
      return;
    }
    if (selection && selection.width > 0.02) {
      const startMs = rangeStart + selection.left * rangeMs;
      const endMs = rangeStart + (selection.left + selection.width) * rangeMs;
      onZoom({
        startMs: Math.floor(startMs),
        endMs: Math.ceil(endMs),
      });
    }
    setDragStart(null);
    setDragCurrent(null);
  };

  const tooltip = hoverMetric ? (
    <MetricsTooltip
      data={hoverMetric}
      timeLabel={formatTimeRange(hoverMetric.startMs, hoverMetric.endMs)}
    />
  ) : null;
  const tooltipPlacement =
    hover && hover.top < 72 ? "below" : "above";
  useLayoutEffect(() => {
    if (!tooltipRef.current) {
      return;
    }
    setTooltipWidth(tooltipRef.current.offsetWidth);
  }, [hoverMetric, tooltipPlacement]);
  const tooltipLeft = (() => {
    if (!hover) {
      return 0;
    }
    const halfWidth = tooltipWidth / 2;
    const minLeft = halfWidth + 8;
    const maxLeft = Math.max(minLeft, (hover.containerWidth ?? 0) - halfWidth - 8);
    const clamped = Math.min(Math.max(hover.left, minLeft), maxLeft);
    return Number.isFinite(clamped) ? clamped : hover.left;
  })();

  return (
    <div
      ref={containerRef}
      className="relative overflow-visible"
      onDoubleClick={onResetZoom}
    >
      <div className="border-t border-border/60">
        <MetricChartRow
          leftContent={
            <div className="space-y-0.5">
              <MetricValueRow
                label="Running"
                value={current.running}
                className="text-emerald-400"
              />
              <MetricValueRow
                label="Queued"
                value={current.queued}
                className="text-amber-400"
              />
            </div>
          }
        rowHeightClassName="h-13"
          hoverPercent={hover?.percent ?? null}
          selection={selection}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <StackedBarsChart
            running={data.map((item) => item.running)}
            queued={data.map((item) => item.queued)}
            runningClassName="bg-emerald-500"
            queuedClassName="bg-amber-500"
          />
        </MetricChartRow>
        <MetricChartRow
          leftContent={
            <MetricValueRow
              label="Completed"
              value={current.completed}
              className="text-sky-400"
            />
          }
          rowHeightClassName="h-8"
          hoverPercent={hover?.percent ?? null}
          selection={selection}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <MiniStepChart
            values={data.map((item) => item.completed)}
            className="text-sky-400"
          />
        </MetricChartRow>
        <MetricChartRow
          leftContent={
            <MetricValueRow
              label="Clusters"
              value={current.clusters}
              className="text-amber-400"
            />
          }
          rowHeightClassName="h-8"
          hoverPercent={hover?.percent ?? null}
          selection={selection}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <StepAreaChart
            values={data.map((item) => item.scaling)}
            className="text-amber-300"
            height={32}
          />
        </MetricChartRow>
      </div>
      {hover && tooltip ? (
        <div
          className="pointer-events-none absolute z-40"
          style={{
            left: tooltipLeft,
            top: hover.top + (tooltipPlacement === "below" ? 18 : -6),
          }}
        >
          <div
            ref={tooltipRef}
            className={cn("-translate-x-1/2", tooltipPlacement === "below" ? "translate-y-0" : "-translate-y-full")}
          >
            {tooltip}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricChartRow({
  leftContent,
  children,
  hoverPercent,
  selection,
  onPointerMove,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  rowHeightClassName = "h-11",
}: {
  leftContent: ReactNode;
  children: ReactNode;
  hoverPercent: number | null;
  selection: { left: number; width: number } | null;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  rowHeightClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative grid min-h-0 grid-cols-[160px_1fr] items-stretch gap-0 pl-6 pr-0",
        rowHeightClassName,
      )}
    >
      <div className="flex h-full flex-col justify-center border-r border-border/60 pr-3">
        {leftContent}
      </div>
      <div className="h-full min-h-0 pl-0">
        <div
          className="relative h-full cursor-crosshair"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          style={{ touchAction: "none" }}
        >
          <div className="pointer-events-none absolute inset-0">
            {selection ? (
              <div
                className="absolute inset-y-0 bg-foreground/10"
                style={{
                  left: `${selection.left * 100}%`,
                  width: `${selection.width * 100}%`,
                }}
              />
            ) : null}
            {hoverPercent !== null ? (
              <div
                className="absolute inset-y-0 w-px bg-foreground/50"
                style={{ left: `${hoverPercent * 100}%` }}
              />
            ) : null}
          </div>
          <div className="h-full box-border pt-[2px]">{children}</div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border/60" />
    </div>
  );
}

function MetricValueRow({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-base font-semibold tabular-nums text-right",
          className,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function MetricsTooltip({
  data,
  timeLabel,
}: {
  data: TimelineMetric;
  timeLabel: string;
}) {
  return (
    <div className="min-w-[220px] rounded-md border border-border/60 bg-background/95 px-3 py-2 text-[10px] text-foreground shadow-lg">
      <div className="whitespace-nowrap text-[9px] uppercase tracking-[0.24em] text-muted-foreground">
        {timeLabel}
      </div>
      <div className="mt-2 grid gap-1">
        <TooltipRow label="Running" value={data.running} className="text-emerald-400" />
        <TooltipRow label="Queued" value={data.queued} className="text-amber-400" />
        <TooltipRow label="Completed" value={data.completed} className="text-sky-400" />
        <TooltipRow label="Clusters" value={data.scaling} className="text-amber-300" />
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-baseline gap-2">
      <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-[11px] font-semibold tabular-nums", className)}>
        {value}
      </span>
    </div>
  );
}

function buildTimelineData(
  metrics: WarehouseEndpointMetric[],
  startMs: number,
  endMs: number,
): TimelineMetric[] {
  const rangeMs = Math.max(1, endMs - startMs);
  const bucketMs = getBucketMs(rangeMs);
  const bucketCount = Math.max(1, Math.ceil(rangeMs / bucketMs));
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = startMs + index * bucketMs;
    const bucketEnd = Math.min(endMs, bucketStart + bucketMs);
    return {
      startMs: bucketStart,
      endMs: bucketEnd,
      running: null as number | null,
      queued: null as number | null,
      completed: null as number | null,
      scaling: null as number | null,
    };
  });

  metrics.forEach((metric, index) => {
    const metricStart = metric.start_time_ms ?? startMs + index * bucketMs;
    const metricEnd = metric.end_time_ms ?? metricStart + bucketMs;
    if (metricEnd < startMs || metricStart > endMs) {
      return;
    }
    const effectiveStart = Math.max(startMs, metricStart);
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((effectiveStart - startMs) / bucketMs)),
    );
    const bucket = buckets[bucketIndex];
    const running = metric.max_running_slots ?? 0;
    const queued = metric.max_queued_slots ?? 0;
    const completed = metric.throughput ?? 0;
    bucket.running = Math.max(bucket.running ?? running, running);
    bucket.queued = Math.max(bucket.queued ?? queued, queued);
    bucket.completed = (bucket.completed ?? 0) + completed;
    bucket.scaling = Math.max(bucket.scaling ?? running, running);
  });

  const filled = buckets.map((bucket) => ({ ...bucket }));
  let lastRunning: number | null = null;
  let lastQueued: number | null = null;
  let lastCompleted: number | null = null;
  let lastScaling: number | null = null;

  filled.forEach((bucket) => {
    if (bucket.running === null) {
      bucket.running = lastRunning;
    } else {
      lastRunning = bucket.running;
    }
    if (bucket.queued === null) {
      bucket.queued = lastQueued;
    } else {
      lastQueued = bucket.queued;
    }
    if (bucket.completed === null) {
      bucket.completed = lastCompleted;
    } else {
      lastCompleted = bucket.completed;
    }
    if (bucket.scaling === null) {
      bucket.scaling = lastScaling;
    } else {
      lastScaling = bucket.scaling;
    }
  });

  const firstRunning = filled.find((bucket) => bucket.running !== null)?.running ?? 0;
  const firstQueued = filled.find((bucket) => bucket.queued !== null)?.queued ?? 0;
  const firstCompleted =
    filled.find((bucket) => bucket.completed !== null)?.completed ?? 0;
  const firstScaling = filled.find((bucket) => bucket.scaling !== null)?.scaling ?? 0;

  return filled.map((bucket) => ({
    ...bucket,
    running: bucket.running ?? firstRunning,
    queued: bucket.queued ?? firstQueued,
    completed: bucket.completed ?? firstCompleted,
    scaling: bucket.scaling ?? firstScaling,
  }));
}

function buildQueryHistoryTimeline(
  queries: WarehouseQuery[],
  range: { startMs: number; endMs: number },
  clusters: number,
): TimelineMetric[] {
  const rangeMs = Math.max(1, range.endMs - range.startMs);
  const bucketMs = rangeMs <= 10 * 60 * 1000 ? 15_000 : 30_000;
  const bucketCount = Math.max(1, Math.ceil(rangeMs / bucketMs));
  const buckets: TimelineMetric[] = Array.from({ length: bucketCount }, (_, index) => {
    const start = range.startMs + index * bucketMs;
    const end = Math.min(range.endMs, start + bucketMs);
    return {
      startMs: start,
      endMs: end,
      running: 0,
      queued: 0,
      completed: 0,
      scaling: clusters,
    };
  });

  queries.forEach((query) => {
    const start = Math.max(query.start_time_ms ?? range.startMs, range.startMs);
    const end = Math.min(query.end_time_ms ?? range.endMs, range.endMs);
    if (end <= start) {
      return;
    }
    const status = query.status?.toUpperCase() ?? "RUNNING";
    const isQueuedStatus =
      status === "QUEUED" || status === "COMPILING" || status === "COMPILED";
    const queueStart = query.queued_start_time_ms;
    const queueEnd =
      query.queued_end_time_ms ??
      query.start_time_ms ??
      query.queued_start_time_ms;
    const queueWindowValid =
      queueStart !== null &&
      queueEnd !== null &&
      queueEnd > queueStart;

    if (queueWindowValid) {
      const queuedStart = Math.max(queueStart ?? range.startMs, range.startMs);
      const queuedEnd = Math.min(queueEnd ?? range.endMs, range.endMs);
      if (queuedEnd > queuedStart) {
        const queuedStartIndex = Math.floor((queuedStart - range.startMs) / bucketMs);
        const queuedEndIndex = Math.floor((queuedEnd - range.startMs) / bucketMs);
        for (
          let index = Math.max(0, queuedStartIndex);
          index <= Math.min(bucketCount - 1, queuedEndIndex);
          index += 1
        ) {
          buckets[index].queued += 1;
        }
      }
    }

    if (!queueWindowValid) {
      const startIndex = Math.floor((start - range.startMs) / bucketMs);
      const endIndex = Math.floor((end - range.startMs) / bucketMs);
      for (
        let index = Math.max(0, startIndex);
        index <= Math.min(bucketCount - 1, endIndex);
        index += 1
      ) {
        if (isQueuedStatus) {
          buckets[index].queued += 1;
        } else {
          buckets[index].running += 1;
        }
      }
    } else {
      const runningStart = Math.max(queueEnd ?? start, range.startMs);
      const runningEnd = end;
      if (runningEnd > runningStart) {
        const startIndex = Math.floor((runningStart - range.startMs) / bucketMs);
        const endIndex = Math.floor((runningEnd - range.startMs) / bucketMs);
        for (
          let index = Math.max(0, startIndex);
          index <= Math.min(bucketCount - 1, endIndex);
          index += 1
        ) {
          buckets[index].running += 1;
        }
      }
    }

    const endTimeMs = query.end_time_ms;
    if (endTimeMs && endTimeMs >= range.startMs && endTimeMs <= range.endMs) {
      const completedIndex = Math.min(
        bucketCount - 1,
        Math.floor((endTimeMs - range.startMs) / bucketMs),
      );
      buckets[completedIndex].completed += 1;
    }
  });

  return buckets;
}

function formatTimeRange(startMs: number, endMs: number) {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  const startTime = timeFormatter.format(start);
  const endTime = timeFormatter.format(end);
  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return `${dateFormatter.format(start)} · ${startTime}–${endTime}`;
  }

  return `${dateFormatter.format(start)} ${startTime}–${dateFormatter.format(
    end,
  )} ${endTime}`;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function getBucketMs(rangeMs: number) {
  if (rangeMs <= 8 * HOUR_MS) {
    return 5 * 60 * 1000;
  }
  if (rangeMs <= 48 * HOUR_MS) {
    return 10 * 60 * 1000;
  }
  if (rangeMs <= 7 * DAY_MS) {
    return HOUR_MS;
  }
  return 2 * HOUR_MS;
}

function StackedBarsChart({
  running,
  queued,
  runningClassName,
  queuedClassName,
}: {
  running: number[];
  queued: number[];
  runningClassName: string;
  queuedClassName: string;
}) {
  const count = Math.max(running.length, queued.length, 1);
  const series = Array.from({ length: count }).map((_, index) => ({
    running: running[index] ?? 0,
    queued: queued[index] ?? 0,
  }));
  const maxTotal = Math.max(
    ...series.map((item) => item.running + item.queued),
    1,
  );
  return (
    <div
      className="pointer-events-none relative grid h-full items-end gap-0"
      style={{
        gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
      }}
    >
      {series.map((item, index) => {
        const runningHeight = (item.running / maxTotal) * 100;
        const queuedHeight = (item.queued / maxTotal) * 100;

        return (
          <div
            key={`stack-${index}`}
            className="flex h-full flex-col justify-end"
          >
            <div
              className={cn("w-full", queuedClassName)}
              style={{ height: `${queuedHeight}%` }}
            />
            <div
              className={cn("w-full", runningClassName)}
              style={{ height: `${runningHeight}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function StepAreaChart({
  values,
  className,
  height = 24,
}: {
  values: number[];
  className: string;
  height?: number;
}) {
  const safeValues = values.length > 0 ? values : [0];
  const maxValue = Math.max(...safeValues, 1);
  const minValue = Math.min(...safeValues, 0);
  const range = Math.max(1, maxValue - minValue);
  const width = 120;
  const stepWidth = width / Math.max(safeValues.length, 1);

  const points = safeValues.map((value, index) => {
    const x = index * stepWidth;
    const y = height - ((value - minValue) / range) * height;
    return { x, y };
  });

  const basePath = points.reduce((acc, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    return `${acc} H ${point.x} V ${point.y}`;
  }, "");
  const linePath = `${basePath} H ${width}`;
  const areaPath = `${linePath} V ${height} H 0 Z`;

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none h-full w-full text-foreground/70",
        className,
      )}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      <path d={areaPath} fill="currentColor" fillOpacity="0.1" />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="miter"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
      {safeValues.slice(1).map((value, index) => {
        const prev = safeValues[index];
        if (value === prev) {
          return null;
        }
        const x = (index + 1) * stepWidth;
        const y1 = height - ((prev - minValue) / range) * height;
        const y2 = height - ((value - minValue) / range) * height;
        return (
          <line
            key={`change-${index}`}
            x1={x}
            x2={x}
            y1={Math.min(y1, y2)}
            y2={Math.max(y1, y2)}
            stroke="currentColor"
            strokeOpacity="0.7"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

function MetricsSkeleton() {
  return (
    <div className="divide-y border-t border-border/60">
      <div className="flex items-center justify-between px-6 py-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-6 w-32" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`metric-skeleton-${index}`}
          className="grid h-9 grid-cols-[160px_1fr] items-stretch gap-0 pl-6 pr-0"
        >
          <div className="flex h-full flex-col justify-center border-r border-border/60 pr-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
          <div className="pl-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-6 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function QueriesSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      <Skeleton className="h-3 w-28" />
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={`query-skeleton-${index}`} className="h-8 w-full" />
      ))}
    </div>
  );
}

function MetricsError({ error }: { error: Error }) {
  const errorDetail =
    (error as { response?: { data?: { detail?: string } } }).response?.data
      ?.detail ?? error.message;

  return (
    <div className="px-6 py-3 text-xs text-destructive">
      Unable to load warehouse metrics: {errorDetail}
    </div>
  );
}

function QueriesError({ error }: { error: Error }) {
  const errorDetail =
    (error as { response?: { data?: { detail?: string } } }).response?.data
      ?.detail ?? error.message;
  return (
    <div className="mt-4 text-xs text-destructive">
      Unable to load queries: {errorDetail}
    </div>
  );
}

function SummaryError() {
  return (
    <div className="text-xs text-destructive">
      Unable to load summary.
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`summary-skeleton-${index}`} className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

function SummarySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex w-full items-center justify-between text-[10px] uppercase tracking-[0.24em] text-muted-foreground"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{title}</span>
        <span className="text-[9px]">{isOpen ? "–" : "+"}</span>
      </button>
      {isOpen ? children : null}
    </div>
  );
}

function SummaryBars({
  items,
  formatValue,
  getColor,
}: {
  items: { label: string; value: number }[];
  formatValue?: (value: number) => string;
  getColor?: (item: { label: string; value: number }) => string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-foreground/80">
            <span className="truncate">{item.label}</span>
            <span className="tabular-nums">
              {formatValue ? formatValue(item.value) : item.value}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted-foreground/15">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: getColor ? getColor(item) : "rgba(226,232,240,0.7)",
              }}
            />
          </div>
        </div>
      ))}
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">No data</div>
      ) : null}
    </div>
  );
}

function SummaryHistogram({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const [tooltip, setTooltip] = useState<SummaryTooltipState | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex h-16 items-end gap-1 rounded-md px-2 py-2">
        {total === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
            No data
          </div>
        ) : (
          items.map((item) => {
            const percent = Math.round((item.value / total) * 100);
            return (
              <div
                key={item.label}
                className="flex h-full flex-1 items-end"
                onMouseMove={(event) =>
                  setTooltip({
                    x: event.clientX,
                    y: event.clientY,
                    title: item.label,
                    rows: [
                      {
                        label: "Count",
                        value: `${item.value.toLocaleString()} (${percent}%)`,
                      },
                    ],
                  })
                }
                onMouseLeave={() => setTooltip(null)}
              >
                <div
                  className="relative w-full rounded-[1px] bg-foreground/70"
                  style={{ height: `${(item.value / maxValue) * 100}%` }}
                >
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full pb-0.5 text-[8px] leading-none text-foreground/80">
                    {percent}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="grid grid-cols-6 gap-1 text-[9px] text-muted-foreground">
        {items.map((item) => (
          <span key={`${item.label}-label`} className="truncate text-center">
            {item.label}
          </span>
        ))}
      </div>
      <SummaryTooltip state={tooltip} />
    </div>
  );
}

function SummaryHeatmap({
  data,
}: {
  data: { rows: string[]; cols: string[]; values: number[][] };
}) {
  const total = data.values
    .flatMap((row) => row)
    .reduce((sum, value) => sum + value, 0);
  const maxValue = Math.max(
    ...data.values.flatMap((row) => row),
    1,
  );
  const [tooltip, setTooltip] = useState<SummaryTooltipState | null>(null);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[52px_1fr] gap-2">
        <div className="space-y-1 text-[9px] text-muted-foreground">
          {data.rows.map((label) => (
            <div key={`row-${label}`} className="flex h-3 items-center">
              {label}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {total === 0 ? (
            <div className="flex h-16 items-center justify-center rounded-md border border-border/60 text-[10px] text-muted-foreground">
              No data
            </div>
          ) : (
            data.values.map((row, rowIndex) => (
            <div
              key={`heatmap-row-${rowIndex}`}
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${data.cols.length}, minmax(0, 1fr))`,
              }}
            >
                {row.map((value, colIndex) => {
                  const intensity = value / maxValue;
                  const color = `rgba(16, 185, 129, ${0.15 + intensity * 0.85})`;
                  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
                  return (
                    <div
                      key={`cell-${rowIndex}-${colIndex}`}
                      className="flex h-3 items-center justify-center rounded-[2px] text-[8px]"
                      style={{
                        backgroundColor: color,
                        color:
                          intensity > 0.55
                            ? "rgba(15, 23, 42, 0.85)"
                            : "rgba(226, 232, 240, 0.85)",
                      }}
                      onMouseMove={(event) =>
                        setTooltip({
                          x: event.clientX,
                          y: event.clientY,
                          title: `${data.rows[rowIndex]} × ${data.cols[colIndex]}`,
                          rows: [
                            {
                              label: "Queries",
                              value: `${value.toLocaleString()} (${percent}%)`,
                            },
                          ],
                        })
                      }
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {value > 0 ? value.toLocaleString() : ""}
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div
            className="grid gap-1 text-[9px] text-muted-foreground"
            style={{
              gridTemplateColumns: `repeat(${data.cols.length}, minmax(0, 1fr))`,
            }}
          >
            {data.cols.map((label) => (
              <span key={`col-${label}`} className="truncate text-center">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      {data.values.length === 0 ? (
        <div className="text-xs text-muted-foreground">No data</div>
      ) : null}
      <SummaryTooltip state={tooltip} />
    </div>
  );
}

type SummaryTooltipRow = {
  label: string;
  value: string;
  color?: string;
};

type SummaryTooltipState = {
  x: number;
  y: number;
  title: string;
  rows: SummaryTooltipRow[];
};

function SummaryTooltip({ state }: { state: SummaryTooltipState | null }) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!tooltipRef.current) {
      return;
    }
    const { offsetWidth, offsetHeight } = tooltipRef.current;
    setTooltipSize({ width: offsetWidth, height: offsetHeight });
  }, [state]);

  if (!state) {
    return null;
  }

  const padding = 12;
  const clampedLeft = Math.min(
    Math.max(state.x, padding + tooltipSize.width / 2),
    window.innerWidth - padding - tooltipSize.width / 2,
  );
  const anchorTop = Math.min(state.y, window.innerHeight - padding);
  const clampedTop = Math.max(anchorTop, padding + tooltipSize.height);

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: clampedLeft,
        top: clampedTop,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div
        ref={tooltipRef}
        className="min-w-[220px] rounded-md border border-border/60 bg-background/95 px-3 py-2 text-[10px] text-foreground shadow-lg"
      >
        <div className="whitespace-nowrap text-[9px] uppercase tracking-[0.24em] text-muted-foreground">
          {state.title}
        </div>
        <div className="mt-2 grid gap-1">
          {state.rows.map((row) => (
            <div
              key={`${state.title}-${row.label}`}
              className="grid grid-cols-[88px_1fr] items-baseline gap-2"
            >
              <span className="whitespace-nowrap text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                {row.label}
              </span>
              <span
                className="whitespace-nowrap text-[11px] font-semibold tabular-nums"
                style={row.color ? { color: row.color } : undefined}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryStackedBars({
  items,
  formatTotal,
  onItemClick,
}: {
  items: {
    label: string;
    total: number;
    segments: { key: string; value: number; color: string }[];
  }[];
  formatTotal?: (item: {
    label: string;
    total: number;
    segments: { key: string; value: number; color: string }[];
  }) => string;
  onItemClick?: (label: string) => void;
}) {
  const maxTotal = Math.max(...items.map((item) => item.total), 1);
  const [tooltip, setTooltip] = useState<SummaryTooltipState | null>(null);

  const buildTooltipRows = (item: {
    total: number;
    segments: { key: string; value: number; color: string }[];
  }) => [
    {
      label: "Total",
      value: item.total.toLocaleString(),
      color: "",
    },
    ...item.segments.map((segment) => ({
      label: segment.key.charAt(0).toUpperCase() + segment.key.slice(1),
      value: `${segment.value.toLocaleString()} (${item.total > 0 ? Math.round((segment.value / item.total) * 100) : 0}%)`,
      color: segment.color,
    })),
  ];

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "group relative space-y-1",
            onItemClick && "cursor-pointer",
          )}
          role={onItemClick ? "button" : undefined}
          tabIndex={onItemClick ? 0 : undefined}
          onMouseMove={(event) =>
            setTooltip({
              x: event.clientX,
              y: event.clientY,
              title: item.label,
              rows: buildTooltipRows(item),
            })
          }
          onMouseLeave={() => setTooltip(null)}
          onClick={() => onItemClick?.(item.label)}
          onKeyDown={(event) => {
            if (!onItemClick) {
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onItemClick(item.label);
            }
          }}
        >
          <div className="flex items-center justify-between text-[11px] text-foreground/80">
            <span className="truncate">{item.label}</span>
            <span className="tabular-nums">
              {formatTotal ? formatTotal(item) : item.total}
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted-foreground/15"
          >
            <div
              className="flex h-1.5 transition hover:shadow-[0_0_8px_rgba(226,232,240,0.6)]"
              style={{ width: `${(item.total / maxTotal) * 100}%` }}
            >
              {item.segments.map((segment) => (
                <div
                  key={`${item.label}-${segment.key}`}
                  style={{
                    width: `${(segment.value / Math.max(item.total, 1)) * 100}%`,
                    backgroundColor: segment.color,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">No data</div>
      ) : null}
      <SummaryTooltip state={tooltip} />
    </div>
  );
}

function WarehouseIdentity({ warehouseId }: { warehouseId: string }) {
  const { data } = useWarehousesSuspense(selector());
  const warehouse = data.find((item) => item.id === warehouseId);
  const displayName = warehouse?.name ?? "Warehouse";

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="text-foreground">{displayName}</span>
      <span>#{warehouseId}</span>
    </div>
  );
}

function WarehouseIdentitySkeleton() {
  return <Skeleton className="h-4 w-40" />;
}

function WarehouseIdentityFallback({ warehouseId }: { warehouseId: string }) {
  return (
    <span className="text-xs text-muted-foreground">#{warehouseId}</span>
  );
}

type TimelineItem = {
  id: string;
  status: "running" | "queued" | "failed";
  start: number;
  end: number;
  title: string;
  source: string;
  user: string;
  filesRead: number;
  bytesScanned: number;
  spillBytes: number;
};

type PackedLane = {
  items: TimelineItem[];
  lastEnd: number;
};

const QUERY_TIMELINE_MAX_HEIGHT = 220;
const QUERY_LANE_HEIGHT = 7;
const QUERY_LANE_GAP = 1;
const QUERY_ITEM_HEIGHT = 3;
const DEFAULT_MAX_TIMELINE_SPANS = 2000;

type TimelineColorMode =
  | "status"
  | "source"
  | "user"
  | "files"
  | "bytes"
  | "spill";

const TIMELINE_COLOR_OPTIONS: { id: TimelineColorMode; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "source", label: "Source" },
  { id: "user", label: "User" },
  { id: "files", label: "Files read" },
  { id: "bytes", label: "Bytes scanned" },
  { id: "spill", label: "Spill bytes" },
];

const packTimelineRows = (items: TimelineItem[]) => {
  const sorted = [...items].sort((a, b) => {
    if (a.start === b.start) {
      return a.end - b.end;
    }
    return a.start - b.start;
  });
  const lanes: PackedLane[] = [];
  const minGapPercent = 0.15;

  sorted.forEach((item) => {
    const lane = lanes.find(
      (candidate) => candidate.lastEnd + minGapPercent <= item.start,
    );

    if (lane) {
      lane.items.push(item);
      lane.lastEnd = item.end;
    } else {
      lanes.push({ items: [item], lastEnd: item.end });
    }
  });

  return lanes;
};

type WarehouseQueriesTimelineProps = {
  warehouseId: string;
  range: { startMs: number; endMs: number };
  basePreset: RangeOption["id"];
  fetchRange: { startMs: number; endMs: number };
  maxTimelineSpans: number;
  selectedUser: string | null;
  selectedSource: string | null;
  onZoom: (range: { startMs: number; endMs: number }) => void;
  onResetZoom: () => void;
  isZoomed: boolean;
};

type WarehouseSummaryPanelProps = {
  warehouseId: string;
  basePreset: RangeOption["id"];
  fetchRange: { startMs: number; endMs: number };
  range: { startMs: number; endMs: number };
  isZoomed: boolean;
  onUserSelect: (user: string) => void;
  onSourceSelect: (source: string) => void;
};

function getQueriesRangeKey(basePreset: RangeOption["id"]) {
  return [basePreset] as const;
}

function buildSourceStatusBreakdown(queries: WarehouseQuery[]) {
  const counts = new Map<
    string,
    {
      total: number;
      running: number;
      queued: number;
      finished: number;
      failed: number;
      other: number;
    }
  >();
  queries.forEach((query) => {
    const source = query.source ?? "Unknown";
    const bucket = counts.get(source) ?? {
      total: 0,
      running: 0,
      queued: 0,
      finished: 0,
      failed: 0,
      other: 0,
    };
    const normalized = normalizeStatusBucket(query.status);
    bucket.total += 1;
    bucket[normalized] += 1;
    counts.set(source, bucket);
  });

  const entries = Array.from(counts.entries()).sort(
    ([, a], [, b]) => b.total - a.total,
  );
  const totalQueries = entries.reduce((sum, [, bucket]) => sum + bucket.total, 0);
  const top = entries.slice(0, 5);
  const remainder = entries.slice(5);
  const items = top.map(([label, bucket]) => ({
    label,
    total: bucket.total,
    percent: totalQueries > 0 ? Math.round((bucket.total / totalQueries) * 100) : 0,
    segments: [
      { key: "running", value: bucket.running, color: summaryStatusColor("running") },
      { key: "queued", value: bucket.queued, color: summaryStatusColor("queued") },
      { key: "finished", value: bucket.finished, color: summaryStatusColor("finished") },
      { key: "failed", value: bucket.failed, color: summaryStatusColor("failed") },
      { key: "other", value: bucket.other, color: summaryStatusColor("other") },
    ].filter((segment) => segment.value > 0),
  }));

  if (remainder.length > 0) {
    const otherBucket = remainder.reduce(
      (acc, [, bucket]) => ({
        total: acc.total + bucket.total,
        running: acc.running + bucket.running,
        queued: acc.queued + bucket.queued,
        finished: acc.finished + bucket.finished,
        failed: acc.failed + bucket.failed,
        other: acc.other + bucket.other,
      }),
      {
        total: 0,
        running: 0,
        queued: 0,
        finished: 0,
        failed: 0,
        other: 0,
      },
    );
    items.push({
      label: "Other",
      total: otherBucket.total,
      percent:
        totalQueries > 0 ? Math.round((otherBucket.total / totalQueries) * 100) : 0,
      segments: [
        { key: "running", value: otherBucket.running, color: summaryStatusColor("running") },
        { key: "queued", value: otherBucket.queued, color: summaryStatusColor("queued") },
        { key: "finished", value: otherBucket.finished, color: summaryStatusColor("finished") },
        { key: "failed", value: otherBucket.failed, color: summaryStatusColor("failed") },
        { key: "other", value: otherBucket.other, color: summaryStatusColor("other") },
      ].filter((segment) => segment.value > 0),
    });
  }

  return items;
}

function buildDurationDistribution(queries: WarehouseQuery[]) {
  const buckets = [
    { label: "<1s", max: 1000 },
    { label: "1-5s", max: 5000 },
    { label: "5-15s", max: 15000 },
    { label: "15-60s", max: 60000 },
    { label: "1-5m", max: 300000 },
    { label: ">5m", max: Number.POSITIVE_INFINITY },
  ];
  const counts = buckets.map(() => 0);
  queries.forEach((query) => {
    const duration = query.duration_ms ?? 0;
    const index = buckets.findIndex((bucket) => duration <= bucket.max);
    if (index >= 0) {
      counts[index] += 1;
    }
  });
  return buckets.map((bucket, index) => ({
    label: bucket.label,
    value: counts[index],
  }));
}

function buildFilesBytesHeatmap(queries: WarehouseQuery[]) {
  const fileBuckets = [
    { label: "0", max: 0 },
    { label: "<100", max: 100 },
    { label: "<1k", max: 1000 },
    { label: "<10k", max: 10_000 },
    { label: "<100k", max: 100_000 },
    { label: "100k+", max: Number.POSITIVE_INFINITY },
  ];
  const byteBuckets = [
    { label: "<1GB", max: 1024 * 1024 * 1024 },
    { label: "<10GB", max: 10 * 1024 * 1024 * 1024 },
    { label: "<100GB", max: 100 * 1024 * 1024 * 1024 },
    { label: "<1TB", max: 1024 * 1024 * 1024 * 1024 },
    { label: ">1TB", max: Number.POSITIVE_INFINITY },
  ];
  const values = fileBuckets.map(() => byteBuckets.map(() => 0));
  queries.forEach((query) => {
    const files = query.files_read ?? 0;
    const bytes = query.bytes_scanned ?? 0;
    const fileIndex = fileBuckets.findIndex((bucket) => files <= bucket.max);
    const byteIndex = byteBuckets.findIndex((bucket) => bytes <= bucket.max);
    if (fileIndex >= 0 && byteIndex >= 0) {
      values[fileIndex][byteIndex] += 1;
    }
  });
  return {
    rows: fileBuckets.map((bucket) => bucket.label),
    cols: byteBuckets.map((bucket) => bucket.label),
    values,
  };
}

function buildTopUsersStatusBreakdown(queries: WarehouseQuery[]) {
  const counts = new Map<
    string,
    {
      total: number;
      running: number;
      queued: number;
      finished: number;
      failed: number;
      other: number;
    }
  >();
  queries.forEach((query) => {
    const user = formatUserName(query.user_name) ?? "Unknown";
    const bucket = counts.get(user) ?? {
      total: 0,
      running: 0,
      queued: 0,
      finished: 0,
      failed: 0,
      other: 0,
    };
    bucket.total += 1;
    const statusBucket = normalizeStatusBucket(query.status);
    bucket[statusBucket] += 1;
    counts.set(user, bucket);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([label, bucket]) => ({
      label,
      total: bucket.total,
      segments: [
        { key: "running", value: bucket.running, color: summaryStatusColor("running") },
        { key: "queued", value: bucket.queued, color: summaryStatusColor("queued") },
        { key: "finished", value: bucket.finished, color: summaryStatusColor("finished") },
        { key: "failed", value: bucket.failed, color: summaryStatusColor("failed") },
        { key: "other", value: bucket.other, color: summaryStatusColor("other") },
      ].filter((segment) => segment.value > 0),
    }));
}

function normalizeStatusBucket(status: string | null | undefined) {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized === "running" || normalized === "started") {
    return "running" as const;
  }
  if (normalized === "queued" || normalized === "compiling" || normalized === "compiled") {
    return "queued" as const;
  }
  if (normalized === "failed" || normalized === "canceled") {
    return "failed" as const;
  }
  if (normalized === "finished") {
    return "finished" as const;
  }
  return "other" as const;
}

function summaryStatusColor(status: "running" | "queued" | "finished" | "failed" | "other") {
  switch (status) {
    case "running":
      return "rgb(56, 189, 248)";
    case "queued":
      return "rgb(245, 158, 11)";
    case "finished":
      return "rgb(34, 197, 94)";
    case "failed":
      return "rgb(244, 63, 94)";
    default:
      return "rgb(148, 163, 184)";
  }
}

function WarehouseQueriesTimeline({
  warehouseId,
  range,
  basePreset,
  fetchRange,
  maxTimelineSpans,
  selectedUser,
  selectedSource,
  onZoom,
  onResetZoom,
  isZoomed,
}: WarehouseQueriesTimelineProps) {
  const queriesRangeKey = getQueriesRangeKey(basePreset);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWarehouseQueriesInfiniteSuspense(warehouseId, {
    query: {
      queryKey: [
        "/api/warehouses",
        warehouseId,
        "queries",
        ...queriesRangeKey,
      ],
      refetchInterval: isZoomed ? false : 15_000,
      refetchIntervalInBackground: !isZoomed,
    },
    axios: {
      params: {
        start_time_ms: fetchRange.startMs,
        end_time_ms: fetchRange.endMs,
        max_results: 1000,
      },
    },
  });
  const queries = useMemo(
    () => data.pages.flatMap((page) => page.data.queries ?? []),
    [data.pages],
  );
  const workspaceSelector = selector<{ workspace_host: string; org_id: string | null }>();
  const { data: workspaceContext } = useWorkspaceContextSuspense({
    ...workspaceSelector,
  });
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragCurrent, setDragCurrent] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    x: number;
    startMs: number;
    endMs: number;
  } | null>(null);
  const [colorMode, setColorMode] = useState<TimelineColorMode>("status");
  const [timelineMaxHeight, setTimelineMaxHeight] = useState(
    QUERY_TIMELINE_MAX_HEIGHT,
  );
  const selection =
    dragStart !== null && dragCurrent !== null
      ? {
          left: Math.min(dragStart, dragCurrent),
          width: Math.abs(dragCurrent - dragStart),
        }
      : null;
  const rangeMs = Math.max(1, range.endMs - range.startMs);
  const timelineItems = useMemo(
    () => buildQueryTimelineItems(queries, range),
    [queries, range.endMs, range.startMs],
  );
  const packedTimeline = useMemo(
    () => packTimelineRows(timelineItems),
    [timelineItems],
  );
  const timelineScale = useMemo(() => {
    const maxFiles = Math.max(
      0,
      ...timelineItems.map((item) => item.filesRead),
    );
    const maxBytes = Math.max(
      0,
      ...timelineItems.map((item) => item.bytesScanned),
    );
    const maxSpill = Math.max(
      0,
      ...timelineItems.map((item) => item.spillBytes),
    );
    return { maxFiles, maxBytes, maxSpill };
  }, [timelineItems]);
  useEffect(() => {
    const update = () => {
      const viewportLimit = window.innerHeight * 0.28;
      setTimelineMaxHeight(
        Math.max(96, Math.min(QUERY_TIMELINE_MAX_HEIGHT, viewportLimit)),
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const maxVisibleLanes = Math.max(
    1,
    Math.floor(
      (timelineMaxHeight + QUERY_LANE_GAP) /
        (QUERY_LANE_HEIGHT + QUERY_LANE_GAP),
    ),
  );
  const maxSpans = Math.max(100, maxTimelineSpans || DEFAULT_MAX_TIMELINE_SPANS);
  const isTimelineTooDense = timelineItems.length > maxSpans;
  const isTimelineOverflow = packedTimeline.length > maxVisibleLanes;
  const tableRows = useMemo(
    () => buildQueryTableRows(queries),
    [queries],
  );
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const [userFilter, setUserFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortState, setSortState] = useState<{
    key: NumericSortKey;
    direction: "asc" | "desc";
  }>({ key: "endTimeMs", direction: "desc" });
  const userOptions = useMemo(
    () =>
      Array.from(
        new Set(tableRows.map((row) => row.user).filter((value) => value !== "—")),
      ).sort(),
    [tableRows],
  );
  const sourceOptions = useMemo(
    () =>
      Array.from(
        new Set(tableRows.map((row) => row.source).filter((value) => value !== "—")),
      ).sort(),
    [tableRows],
  );
  useEffect(() => {
    if (!selectedUser) {
      setUserFilter("all");
      return;
    }
    setUserFilter(selectedUser);
  }, [selectedUser]);
  useEffect(() => {
    if (!selectedSource) {
      setSourceFilter("all");
      return;
    }
    setSourceFilter(selectedSource);
  }, [selectedSource]);
  useEffect(() => {
    if (userFilter !== "all" && !userOptions.includes(userFilter)) {
      setUserFilter("all");
    }
  }, [userFilter, userOptions]);
  useEffect(() => {
    if (sourceFilter !== "all" && !sourceOptions.includes(sourceFilter)) {
      setSourceFilter("all");
    }
  }, [sourceFilter, sourceOptions]);
  const filteredRows = useMemo(
    () =>
      tableRows.filter((row) => {
        const overlapsRange =
          row.endTimeMs >= range.startMs && row.startTimeMs <= range.endMs;
        if (!overlapsRange) {
          return false;
        }
        if (userFilter !== "all" && row.user !== userFilter) {
          return false;
        }
        if (sourceFilter !== "all" && row.source !== sourceFilter) {
          return false;
        }
        return true;
      }),
    [range.endMs, range.startMs, sourceFilter, tableRows, userFilter],
  );
  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      const aValue = getNumericSortValue(a, sortState.key);
      const bValue = getNumericSortValue(b, sortState.key);
      if (aValue === bValue) {
        return 0;
      }
      const comparison = aValue > bValue ? 1 : -1;
      return sortState.direction === "asc" ? comparison : -comparison;
    });
    return rows;
  }, [filteredRows, sortState.direction, sortState.key]);
  const scrollToRow = useCallback(
    (id: string) => {
      const container = tableScrollRef.current;
      if (!container) {
        return false;
      }
      const escapeSelector =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape
          : (value: string) => value.replace(/["\\]/g, "\\$&");
      const row = container.querySelector(
        `tbody tr[data-query-id="${escapeSelector(id)}"]`,
      ) as HTMLTableRowElement | null;
      if (!row) {
        return false;
      }
      container.scrollTo({ top: row.offsetTop, behavior: "smooth" });
      return true;
    },
    [],
  );
  const handleHighlight = useCallback(
    (id: string | null) => {
      setHighlightedId(id);
      if (!id) {
        return;
      }
      if (!scrollToRow(id)) {
        setPendingScrollId(id);
      }
    },
    [scrollToRow],
  );
  useEffect(() => {
    if (!pendingScrollId) {
      return;
    }
    if (scrollToRow(pendingScrollId)) {
      setPendingScrollId(null);
    }
  }, [pendingScrollId, scrollToRow]);
  const updateVisibleCount = useCallback(() => {
    const container = tableScrollRef.current;
    if (!container) {
      return;
    }
    const firstRow = container.querySelector("tbody tr");
    const rowHeight = firstRow?.getBoundingClientRect().height ?? 0;
    if (rowHeight <= 0) {
      setVisibleRange({
        start: sortedRows.length > 0 ? 1 : 0,
        end: sortedRows.length,
      });
      return;
    }
    const startIndex = Math.floor(container.scrollTop / rowHeight);
    const endIndex = Math.min(
      sortedRows.length,
      Math.ceil((container.scrollTop + container.clientHeight) / rowHeight),
    );
    const start = sortedRows.length === 0 ? 0 : Math.min(sortedRows.length, startIndex + 1);
    const end = Math.max(start, endIndex);
    setVisibleRange({ start, end });
  }, [sortedRows.length]);
  useLayoutEffect(() => {
    updateVisibleCount();
  }, [sortedRows.length, updateVisibleCount]);
  useEffect(() => {
    const handleResize = () => updateVisibleCount();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateVisibleCount]);
  const totalQueriesInRange = sortedRows.length;

  if (timelineItems.length === 0) {
    return (
      <div className="mt-4 text-xs text-muted-foreground">
        No queries in this range.
      </div>
    );
  }

  return (
    <div className="mt-2 overflow-x-hidden">
      <div className="min-w-0">
        <TimelineAxis range={range} />
        <>
          <div
            className="relative mt-2"
            onDoubleClick={onResetZoom}
            onPointerDown={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const x = Math.min(
                Math.max(event.clientX - rect.left, 0),
                rect.width,
              );
              const percent = rect.width > 0 ? x / rect.width : 0;
              if (event.metaKey) {
                setIsPanning(true);
                panStartRef.current = {
                  x,
                  startMs: range.startMs,
                  endMs: range.endMs,
                };
                setDragStart(null);
                setDragCurrent(null);
              } else {
                setDragStart(percent);
                setDragCurrent(percent);
              }
              setHoverPercent(percent);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const x = Math.min(
                Math.max(event.clientX - rect.left, 0),
                rect.width,
              );
              const percent = rect.width > 0 ? x / rect.width : 0;
              setHoverPercent(percent);
              if (isPanning && panStartRef.current && rect.width > 0) {
                const deltaMs =
                  ((x - panStartRef.current.x) / rect.width) * rangeMs;
                const windowSize =
                  panStartRef.current.endMs - panStartRef.current.startMs;
                let nextStart = panStartRef.current.startMs + deltaMs;
                let nextEnd = panStartRef.current.endMs + deltaMs;
                if (nextStart < fetchRange.startMs) {
                  nextStart = fetchRange.startMs;
                  nextEnd = nextStart + windowSize;
                }
                if (nextEnd > fetchRange.endMs) {
                  nextEnd = fetchRange.endMs;
                  nextStart = nextEnd - windowSize;
                }
                onZoom({
                  startMs: Math.floor(nextStart),
                  endMs: Math.ceil(nextEnd),
                });
                return;
              }
              if (dragStart !== null) {
                setDragCurrent(percent);
              }
            }}
            onPointerUp={() => {
              if (isPanning) {
                setIsPanning(false);
                panStartRef.current = null;
              } else if (selection && selection.width > 0.02) {
                const startMs = range.startMs + selection.left * rangeMs;
                const endMs =
                  range.startMs + (selection.left + selection.width) * rangeMs;
                onZoom({
                  startMs: Math.floor(startMs),
                  endMs: Math.ceil(endMs),
                });
              }
              setDragStart(null);
              setDragCurrent(null);
              setHoverPercent(null);
            }}
            onPointerLeave={() => {
              if (isPanning) {
                return;
              }
              if (dragStart === null) {
                setHoverPercent(null);
                return;
              }
              setDragCurrent(null);
            }}
            style={{ touchAction: "none" }}
          >
            <div className="pointer-events-none absolute inset-0">
              {selection ? (
                <div
                  className="absolute inset-y-0 bg-foreground/10"
                  style={{
                    left: `${selection.left * 100}%`,
                    width: `${selection.width * 100}%`,
                  }}
                />
              ) : null}
              {hoverPercent !== null ? (
                <div
                  className="absolute inset-y-0 w-px bg-foreground/25"
                  style={{ left: `${hoverPercent * 100}%` }}
                />
              ) : null}
            </div>
            {isTimelineTooDense || isTimelineOverflow ? (
              <div
                className="select-none flex items-center justify-center text-xs text-muted-foreground"
                style={{
                  height: timelineMaxHeight,
                }}
              >
                Zoom in more to see query spans
              </div>
            ) : (
              <div
                className="space-y-[3px] overflow-hidden"
                style={{ height: timelineMaxHeight }}
              >
                {packedTimeline.map((row, index) => (
                  <TimelineLane
                    key={`lane-${index}`}
                    items={row.items}
                    onHighlight={handleHighlight}
                    colorMode={colorMode}
                    scale={timelineScale}
                    activeUserFilter={userFilter !== "all" ? userFilter : null}
                    activeSourceFilter={
                      sourceFilter !== "all" ? sourceFilter : null
                    }
                  />
                ))}
              </div>
            )}
            <div className="pointer-events-none absolute bottom-2 right-3 text-[9px] uppercase tracking-[0.24em] text-muted-foreground/70">
              {timelineItems.length.toLocaleString()} spans
            </div>

          </div>
          <div className="-mx-6 mt-6 border-t border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                <span>Queries in range</span>
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
                  <label className="flex items-center gap-2">
                    <span className="text-muted-foreground/70">Color</span>
                    <select
                      className="rounded-md border border-border/60 bg-background px-2 py-1 text-[10px] text-foreground"
                      value={colorMode}
                      onChange={(event) =>
                        setColorMode(event.target.value as TimelineColorMode)
                      }
                    >
                      {TIMELINE_COLOR_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-muted-foreground/70">User</span>
                    <select
                    className="rounded-md border border-border/60 bg-background px-2 py-1 text-[10px] text-foreground"
                    value={userFilter}
                    onChange={(event) => setUserFilter(event.target.value)}
                  >
                    <option value="all">All</option>
                    {userOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground/70">Source</span>
                  <select
                    className="rounded-md border border-border/60 bg-background px-2 py-1 text-[10px] text-foreground"
                    value={sourceFilter}
                    onChange={(event) => setSourceFilter(event.target.value)}
                  >
                    <option value="all">All</option>
                    {sourceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="overflow-x-hidden px-6 pb-6">
              <div className="pr-2">
                <table className="w-full table-fixed text-xs">
                  <colgroup>
                    <col className="w-[7%]" />
                    <col className="w-[5%]" />
                    <col className="w-[12%]" />
                    <col className="w-[7%]" />
                    <col className="w-[18%]" />
                    <col className="w-[7%]" />
                    <col className="w-[6%]" />
                    <col className="w-[6%]" />
                    <col className="w-[6%]" />
                    <col className="w-[7%]" />
                    <col className="w-[5%]" />
                  </colgroup>
                  <thead className="border-y border-border/60 bg-background text-[9px] uppercase tracking-[0.24em] text-muted-foreground shadow-[0_1px_0_rgba(148,163,184,0.2)]">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Start</th>
                      <th className="px-2 py-1.5 text-left font-medium">Status</th>
                      <th className="px-2 py-1.5 text-left font-medium">Source</th>
                      <th className="px-2 py-1.5 text-left font-medium">Statement</th>
                      <th className="px-2 py-1.5 text-left font-medium">User</th>
                      {renderNumericHeader("Duration", "durationMs", sortState, setSortState)}
                      {renderNumericHeader("Fetch", "fetchTimeMs", sortState, setSortState)}
                      {renderNumericHeader("Cache %", "cacheHitPercent", sortState, setSortState)}
                      {renderNumericHeader("Files", "filesRead", sortState, setSortState)}
                      {renderNumericHeader("Bytes", "bytesScanned", sortState, setSortState)}
                      {renderNumericHeader("Spill", "spillBytes", sortState, setSortState)}
                    </tr>
                  </thead>
                </table>
              </div>
              <div
                ref={tableScrollRef}
                className="relative max-h-[calc(45vh-50px)] overflow-y-auto pr-2"
                onScroll={updateVisibleCount}
              >
                <table className="w-full table-fixed text-xs">
                  <colgroup>
                    <col className="w-[7%]" />
                    <col className="w-[5%]" />
                    <col className="w-[12%]" />
                    <col className="w-[7%]" />
                    <col className="w-[18%]" />
                    <col className="w-[7%]" />
                    <col className="w-[6%]" />
                    <col className="w-[6%]" />
                    <col className="w-[6%]" />
                    <col className="w-[7%]" />
                    <col className="w-[5%]" />
                  </colgroup>
                  <tbody className="divide-y divide-border/40">
                    {sortedRows.map((row) => {
                      const isActive = highlightedId === row.id;
                      const queryLink = buildQueryLink(
                        workspaceContext.workspace_host,
                        workspaceContext.org_id,
                        warehouseId,
                        row.id,
                      );
                      return (
                        <tr
                          key={row.id}
                          data-query-id={row.id}
                          className={cn(
                            "cursor-pointer transition hover:bg-card/60",
                            isActive &&
                              "bg-foreground/25 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.7)]",
                          )}
                          style={{ scrollMarginTop: "140px" }}
                          onClick={() => window.open(queryLink, "_blank", "noopener")}
                          role="link"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              window.open(queryLink, "_blank", "noopener");
                            }
                          }}
                        >
                          <td className="px-2 py-1.5 whitespace-nowrap">{row.startTime}</td>
                          <td className={cn("px-2 py-1.5", row.statusClassName)}>
                            {row.status}
                          </td>
                          <td
                            className="px-2 py-1.5"
                            title={row.sourceName ?? undefined}
                          >
                            {row.source}
                          </td>
                          <td className="px-2 py-1.5">{row.statementType}</td>
                          <td className="px-2 py-1.5">{row.user}</td>
                          <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{row.duration}</td>
                          <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{row.fetchTime}</td>
                          <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{row.cacheHit}</td>
                          <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{row.filesRead}</td>
                          <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{row.bytesScanned}</td>
                          <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{row.spillBytes}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
                <span>
                  Showing {visibleRange.start}-{visibleRange.end} of {totalQueriesInRange}
                </span>
                <button
                  type="button"
                  className="rounded-md border border-border/60 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
                  onClick={() => {
                    const container = tableScrollRef.current;
                    if (!container) {
                      return;
                    }
                    container.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Top
                </button>
              </div>
            </div>
          </div>
        </>
      </div>
    </div>
  );
}

function WarehouseSummaryPanel({
  warehouseId,
  basePreset,
  fetchRange,
  range,
  isZoomed,
  onUserSelect,
  onSourceSelect,
}: WarehouseSummaryPanelProps) {
  const queriesRangeKey = getQueriesRangeKey(basePreset);
  const { data } = useWarehouseQueriesInfiniteSuspense(warehouseId, {
    query: {
      queryKey: [
        "/api/warehouses",
        warehouseId,
        "queries",
        ...queriesRangeKey,
      ],
      refetchInterval: isZoomed ? false : 15_000,
      refetchIntervalInBackground: !isZoomed,
    },
    axios: {
      params: {
        start_time_ms: fetchRange.startMs,
        end_time_ms: fetchRange.endMs,
        max_results: 1000,
      },
    },
  });
  const queries = useMemo(
    () => data.pages.flatMap((page) => page.data.queries ?? []),
    [data.pages],
  );
  const uniqueQueries = useMemo(() => {
    const map = new Map<string, WarehouseQuery>();
    queries.forEach((query) => {
      if (!map.has(query.id)) {
        map.set(query.id, query);
      }
    });
    return Array.from(map.values());
  }, [queries]);
  const queriesInRange = useMemo(
    () =>
      uniqueQueries.filter((query) => {
        const start = query.start_time_ms ?? 0;
        const end = query.end_time_ms ?? start;
        return end >= range.startMs && start <= range.endMs;
      }),
    [range.endMs, range.startMs, uniqueQueries],
  );

  const sourceBreakdown = useMemo(
    () => buildSourceStatusBreakdown(queriesInRange),
    [queriesInRange],
  );
  const durationDistribution = useMemo(
    () => buildDurationDistribution(queriesInRange),
    [queriesInRange],
  );
  const filesBytesHeatmap = useMemo(
    () => buildFilesBytesHeatmap(queriesInRange),
    [queriesInRange],
  );
  const topUsers = useMemo(
    () => buildTopUsersStatusBreakdown(queriesInRange),
    [queriesInRange],
  );

  return (
    <div className="sticky top-10 space-y-6 text-xs text-muted-foreground">
      <SummarySection title="Query breakdown % by source">
        <SummaryStackedBars
          items={sourceBreakdown}
          formatTotal={(item) =>
            typeof item.percent === "number" ? `${item.percent}%` : `${item.total}`
          }
          onItemClick={onSourceSelect}
        />
      </SummarySection>
      <SummarySection title="Distribution of query times">
        <SummaryHistogram items={durationDistribution} />
      </SummarySection>
      <SummarySection title="Files × bytes scanned">
        <SummaryHeatmap data={filesBytesHeatmap} />
      </SummarySection>
      <SummarySection title="Top 10 users">
        <SummaryStackedBars items={topUsers} onItemClick={onUserSelect} />
      </SummarySection>
    </div>
  );
}

function TimelineAxis({ range }: { range: { startMs: number; endMs: number } }) {
  const rangeMs = Math.max(1, range.endMs - range.startMs);
  const showSeconds = rangeMs <= 30 * 60 * 1000;
  const tickCount = rangeMs <= 10 * 60 * 1000 ? 10 : rangeMs <= 60 * 60 * 1000 ? 8 : 6;
  const ticks = useMemo(
    () => buildTimelineTicks(range, tickCount, { showSeconds }),
    [range.endMs, range.startMs, showSeconds, tickCount],
  );
  const dateLabel = useMemo(() => formatTimelineDate(range), [range.endMs, range.startMs]);

  return (
    <div className="text-[10px] text-muted-foreground">
      <div className="mb-0.5 text-[9px] uppercase tracking-[0.28em] text-muted-foreground/70">
        {dateLabel}
      </div>
      <div className="border-t border-border/60 pt-0">
        <div className="flex items-start justify-between">
          {ticks.map((tick, index) => (
            <div key={`tick-${index}`} className="flex flex-col items-center">
              <div className="h-2 w-px bg-border/60" />
              <span className="mt-0.5 whitespace-nowrap">{tick.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatTimelineDate(range: { startMs: number; endMs: number }) {
  const start = new Date(range.startMs);
  const end = new Date(range.endMs);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (start.toDateString() === end.toDateString()) {
    return formatter.format(start);
  }
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function buildTimelineTicks(
  range: { startMs: number; endMs: number },
  count: number,
  options?: { showSeconds?: boolean },
) {
  const start = new Date(range.startMs);
  const end = new Date(range.endMs);
  const sameDay = start.toDateString() === end.toDateString();
  const showSeconds = options?.showSeconds ?? false;
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
  });
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  const ticks = Math.max(2, count);

  return Array.from({ length: ticks }).map((_, index) => {
    const percent = ticks === 1 ? 0 : index / (ticks - 1);
    const timeMs = range.startMs + (range.endMs - range.startMs) * percent;
    const label = sameDay
      ? timeFormatter.format(new Date(timeMs))
      : `${dateFormatter.format(new Date(timeMs))} ${timeFormatter.format(
          new Date(timeMs),
        )}`;

    return { percent, label };
  });
}

function buildQueryTimelineItems(
  queries: WarehouseQuery[],
  range: { startMs: number; endMs: number },
): TimelineItem[] {
  const rangeMs = Math.max(1, range.endMs - range.startMs);
  const grouped = new Map<
    string,
    {
      startMs: number;
      endMs: number;
      statuses: Set<string>;
      source: string;
      user: string;
      filesRead: number;
      bytesScanned: number;
      spillBytes: number;
    }
  >();

  queries.forEach((query) => {
    const startMs = query.start_time_ms ?? range.startMs;
    const endMs = query.end_time_ms ?? range.endMs;
    const existing = grouped.get(query.id);
    const statusValue = query.status?.toUpperCase() ?? "RUNNING";
    const source = query.source ?? "Unknown";
    const user = formatUserName(query.user_name) ?? "Unknown";
    const filesRead = query.files_read ?? 0;
    const bytesScanned = query.bytes_scanned ?? 0;
    const spillBytes = query.spill_bytes ?? 0;

    if (!existing) {
      grouped.set(query.id, {
        startMs,
        endMs,
        statuses: new Set([statusValue]),
        source,
        user,
        filesRead,
        bytesScanned,
        spillBytes,
      });
      return;
    }

    existing.startMs = Math.min(existing.startMs, startMs);
    existing.endMs = Math.max(existing.endMs, endMs);
    existing.statuses.add(statusValue);
    existing.source = existing.source || source;
    existing.user = existing.user || user;
    existing.filesRead = Math.max(existing.filesRead, filesRead);
    existing.bytesScanned = Math.max(existing.bytesScanned, bytesScanned);
    existing.spillBytes = Math.max(existing.spillBytes, spillBytes);
  });

  return Array.from(grouped.entries())
    .flatMap(([id, record]) => {
      const startMs = record.startMs;
      const endMs = record.endMs;
      const clampedStart = Math.min(
        range.endMs,
        Math.max(range.startMs, startMs),
      );
      const clampedEnd = Math.min(
        range.endMs,
        Math.max(range.startMs, endMs),
      );

      if (clampedEnd <= clampedStart) {
        return [];
      }

      const start = ((clampedStart - range.startMs) / rangeMs) * 100;
      const rawEnd = ((clampedEnd - range.startMs) / rangeMs) * 100;
      const minWidthPercent = 0.2;
      const end = Math.min(100, Math.max(rawEnd, start + minWidthPercent));
      return [
        {
          id,
          status: mapQueryStatusValue(record.statuses),
          start,
          end,
          title: id,
          source: record.source,
          user: record.user,
          filesRead: record.filesRead,
          bytesScanned: record.bytesScanned,
          spillBytes: record.spillBytes,
        },
      ];
    })
    .sort((a, b) => a.start - b.start);
}

type QueryTableRow = {
  id: string;
  status: string;
  statusClassName: string;
  user: string;
  source: string;
  sourceName: string | null;
  statementType: string;
  startTime: string;
  startTimeMs: number;
  duration: string;
  durationMs: number;
  fetchTime: string;
  fetchTimeMs: number;
  cacheHit: string;
  cacheHitPercent: number;
  filesRead: string;
  filesReadCount: number;
  bytesScanned: string;
  bytesScannedBytes: number;
  spillBytes: string;
  spillBytesValue: number;
  endTimeMs: number;
};

function buildQueryTableRows(queries: WarehouseQuery[]): QueryTableRow[] {
  return queries.map((query) => {
    const status = formatQueryStatus(query.status);
    const startTimeMs = query.start_time_ms ?? 0;
    const endTimeMs = query.end_time_ms ?? startTimeMs;
    const durationMs = query.duration_ms ?? 0;
    const fetchTimeMs = query.fetch_time_ms ?? 0;
    const cacheHitPercent = query.cache_hit_percent ?? 0;
    const filesReadCount = query.files_read ?? 0;
    const bytesScannedBytes = query.bytes_scanned ?? 0;
    const spillBytesValue = query.spill_bytes ?? 0;
    return {
      id: query.id,
      status,
      statusClassName: statusColorClass(status),
      user: formatUserName(query.user_name) ?? "—",
      source: query.source ?? "—",
      sourceName: query.source_name ?? null,
      statementType: query.statement_type ?? "—",
      startTime: formatTimestamp(query.start_time_ms),
      startTimeMs,
      duration: formatDuration(query.duration_ms),
      durationMs,
      fetchTime: formatDuration(query.fetch_time_ms),
      fetchTimeMs,
      cacheHit: formatPercent(query.cache_hit_percent),
      cacheHitPercent,
      filesRead: formatCount(query.files_read),
      filesReadCount,
      bytesScanned: formatBytes(query.bytes_scanned),
      bytesScannedBytes,
      spillBytes: formatBytes(query.spill_bytes),
      spillBytesValue,
      endTimeMs,
    };
  });
}

type NumericSortKey =
  | "durationMs"
  | "fetchTimeMs"
  | "cacheHitPercent"
  | "filesRead"
  | "bytesScanned"
  | "spillBytes"
  | "endTimeMs";

function getNumericSortValue(row: QueryTableRow, key: NumericSortKey) {
  switch (key) {
    case "durationMs":
      return row.durationMs;
    case "fetchTimeMs":
      return row.fetchTimeMs;
    case "cacheHitPercent":
      return row.cacheHitPercent;
    case "filesRead":
      return row.filesReadCount;
    case "bytesScanned":
      return row.bytesScannedBytes;
    case "spillBytes":
      return row.spillBytesValue;
    case "endTimeMs":
      return row.endTimeMs;
    default:
      return 0;
  }
}

function renderNumericHeader(
  label: string,
  key: NumericSortKey,
  sortState: { key: NumericSortKey; direction: "asc" | "desc" },
  setSortState: (next: { key: NumericSortKey; direction: "asc" | "desc" }) => void,
) {
  const isActive = sortState.key === key;
  const indicator = isActive ? (sortState.direction === "asc" ? "▲" : "▼") : "";
  return (
    <th className="px-2 py-1.5 text-left font-medium">
      <button
        type="button"
        onClick={() =>
          setSortState({
            key,
            direction: isActive && sortState.direction === "desc" ? "asc" : "desc",
          })
        }
        className="flex items-center gap-1 uppercase tracking-[0.24em]"
      >
        <span>{label}</span>
        <span className="text-[8px] text-muted-foreground/70">{indicator}</span>
      </button>
    </th>
  );
}

function formatQueryStatus(status: string | null) {
  if (!status) {
    return "Unknown";
  }
  const normalized = status.toUpperCase();
  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
}

function statusColorClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "running" || normalized === "started") {
    return "text-emerald-300";
  }
  if (normalized === "queued" || normalized === "compiling" || normalized === "compiled") {
    return "text-amber-300";
  }
  if (normalized === "failed" || normalized === "canceled") {
    return "text-rose-300";
  }
  if (normalized === "finished") {
    return "text-sky-300";
  }
  return "text-muted-foreground";
}

function formatTimestamp(value: number | null) {
  if (!value) {
    return "—";
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return formatter.format(new Date(value));
}

function formatDuration(value: number | null) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }
  const seconds = value / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

function formatPercent(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(0)}%`;
}

function formatUserName(value: string | null | undefined) {
  if (!value) {
    return value;
  }
  const [name, domain] = value.split("@");
  if (!domain) {
    return value;
  }
  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return value;
  }
  const localPart = name?.trim();
  if (!localPart) {
    return value;
  }
  return localPart;
}

function formatCount(value: number | null) {
  if (value === null || value === undefined) {
    return "—";
  }
  return value.toLocaleString("en-US");
}

function formatBytes(value: number | null) {
  if (value === null || value === undefined || value === 0) {
    return value === 0 ? "0 B" : "—";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = value;
  let unitIndex = 0;
  while (val >= 1024 && unitIndex < units.length - 1) {
    val /= 1024;
    unitIndex += 1;
  }
  return `${val.toFixed(val >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function buildQueryLink(
  workspaceHost: string,
  orgId: string | null,
  warehouseId: string,
  queryId: string,
) {
  const base = workspaceHost ? `${workspaceHost}` : "";
  const orgParam = orgId ? `o=${encodeURIComponent(orgId)}&` : "";
  return `${base}/sql/warehouses/${warehouseId}/monitoring?${orgParam}queryId=${encodeURIComponent(
    queryId,
  )}`;
}

function mapQueryStatusValue(statuses: Set<string>) {
  if (statuses.has("FAILED") || statuses.has("CANCELED")) {
    return "failed" as const;
  }
  if (statuses.has("QUEUED")) {
    return "queued" as const;
  }
  return "running" as const;
}

function TimelineLane({
  items,
  onHighlight,
  colorMode,
  scale,
  activeUserFilter,
  activeSourceFilter,
}: {
  items: TimelineItem[];
  onHighlight: (id: string | null) => void;
  colorMode: TimelineColorMode;
  scale: { maxFiles: number; maxBytes: number; maxSpill: number };
  activeUserFilter: string | null;
  activeSourceFilter: string | null;
}) {
  return (
    <div className="text-[9px]">
      <div className="relative" style={{ height: QUERY_LANE_HEIGHT }}>
        {items.map((item) => (
          <TimelineSpan
            key={item.id}
            item={item}
            colorMode={colorMode}
            scale={scale}
            onHighlight={onHighlight}
            isDimmed={
              (activeUserFilter && item.user !== activeUserFilter) ||
              (activeSourceFilter && item.source !== activeSourceFilter)
            }
          />
        ))}
      </div>
    </div>
  );
}

function TimelineSpan({
  item,
  colorMode,
  scale,
  onHighlight,
  isDimmed,
}: {
  item: TimelineItem;
  colorMode: TimelineColorMode;
  scale: { maxFiles: number; maxBytes: number; maxSpill: number };
  onHighlight: (id: string | null) => void;
  isDimmed: boolean;
}) {
  const color = getTimelineColor(item, colorMode, scale);
  const fillColor = isDimmed ? "rgba(148, 163, 184, 0.35)" : color;
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-[1px] shadow-none transition hover:shadow-[0_0_8px_currentColor]"
      style={{
        left: `${item.start}%`,
        width: `${Math.max(0, item.end - item.start)}%`,
        height: QUERY_ITEM_HEIGHT,
        backgroundColor: fillColor,
        color: fillColor,
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={() => onHighlight(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onHighlight(item.id);
        }
      }}
    />
  );
}

function getTimelineColor(
  item: TimelineItem,
  mode: TimelineColorMode,
  scale: { maxFiles: number; maxBytes: number; maxSpill: number },
) {
  switch (mode) {
    case "status":
      return statusColor(item.status);
    case "source":
      return stringToColor(item.source);
    case "user":
      return stringToColor(item.user);
    case "files":
      return valueToColor(item.filesRead, scale.maxFiles, 140);
    case "bytes":
      return valueToColor(item.bytesScanned, scale.maxBytes, 210);
    case "spill":
      return valueToColor(item.spillBytes, scale.maxSpill, 28);
    default:
      return statusColor(item.status);
  }
}

function statusColor(status: TimelineItem["status"]) {
  switch (status) {
    case "queued":
      return "rgb(245, 158, 11)";
    case "failed":
      return "rgb(244, 63, 94)";
    default:
      return "rgb(16, 185, 129)";
  }
}

function stringToColor(value: string) {
  if (!value) {
    return "rgb(148, 163, 184)";
  }
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 55%)`;
}

function valueToColor(value: number, maxValue: number, hue: number) {
  if (maxValue <= 0) {
    return "rgb(148, 163, 184)";
  }
  const ratio = Math.min(Math.max(value / maxValue, 0), 1);
  const lightness = 30 + ratio * 45;
  return `hsl(${hue} 75% ${lightness}%)`;
}
