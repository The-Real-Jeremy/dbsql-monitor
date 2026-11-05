import {
  useSuspenseQuery,
  type DataTag,
  type QueryClient,
  type QueryFunction,
  type QueryKey,
  type UseSuspenseQueryOptions,
  type UseSuspenseQueryResult,
} from "@tanstack/react-query";
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import * as axios from "axios";

export type WarehouseState = "active" | "idle" | "stopped";

export type WarehouseApi = {
  id: string;
  name: string;
  size: string | null;
  state: string | null;
  num_active_sessions: number | null;
  num_clusters: number | null;
  min_num_clusters: number | null;
  max_num_clusters: number | null;
  enable_serverless_compute: boolean | null;
  warehouse_type: string | null;
  creator_name: string | null;
  activity: number[];
  activity_window_minutes: number;
  activity_bucket_ms: number;
  activity_score: number;
  active_queries: number;
};

export type Warehouse = {
  id: string;
  name: string;
  size: string;
  type: string;
  scalingStatus: string;
  state: WarehouseState;
  activeQueries: number;
  activity: number[];
  activityScore: number;
  ownerName: string | null;
  numClusters: number | null;
  minClusters: number | null;
  maxClusters: number | null;
};

const stateRank: Record<WarehouseState, number> = {
  active: 3,
  idle: 2,
  stopped: 1,
};

const sizeRank: Record<string, number> = {
  "2X-Small": 1,
  "X-Small": 2,
  Small: 3,
  Medium: 4,
  Large: 5,
  "X-Large": 6,
  "2X-Large": 7,
  "3X-Large": 8,
  "4X-Large": 9,
};

export const sortWarehouses = (warehouses: Warehouse[]) =>
  [...warehouses].sort((a, b) => {
    const activeDelta = (b.activeQueries ?? 0) - (a.activeQueries ?? 0);
    if (activeDelta !== 0) {
      return activeDelta;
    }
    const stateDelta = (stateRank[b.state] ?? 0) - (stateRank[a.state] ?? 0);
    if (stateDelta !== 0) {
      return stateDelta;
    }
    const sizeDelta =
      (sizeRank[b.size] ?? 0) - (sizeRank[a.size] ?? 0);
    if (sizeDelta !== 0) {
      return sizeDelta;
    }
    return a.name.localeCompare(b.name);
  });

export const listWarehouses = (
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<WarehouseApi[]>> => {
  return axios.default.get(`/api/warehouses/metrics`, options);
};

export const getWarehousesQueryKey = () => {
  return [`/api/warehouses/metrics`] as const;
};

export const getWarehousesSuspenseQueryOptions = <
  TData = Awaited<ReturnType<typeof listWarehouses>>,
  TError = AxiosError<unknown>,
>(options?: {
  query?: Partial<
    UseSuspenseQueryOptions<
      Awaited<ReturnType<typeof listWarehouses>>,
      TError,
      TData
    >
  >;
  axios?: AxiosRequestConfig;
}) => {
  const { query: queryOptions, axios: axiosOptions } = options ?? {};

  const queryKey = queryOptions?.queryKey ?? getWarehousesQueryKey();

  const queryFn: QueryFunction<Awaited<ReturnType<typeof listWarehouses>>> = ({
    signal,
  }) => listWarehouses({ signal, ...axiosOptions });

  return {
    queryKey,
    queryFn,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    ...queryOptions,
  } as UseSuspenseQueryOptions<
    Awaited<ReturnType<typeof listWarehouses>>,
    TError,
    TData
  > & { queryKey: DataTag<QueryKey, TData, TError> };
};

export function useWarehousesSuspense<
  TData = Awaited<ReturnType<typeof listWarehouses>>,
  TError = AxiosError<unknown>,
>(
  options?: {
    query?: Partial<
      UseSuspenseQueryOptions<
        Awaited<ReturnType<typeof listWarehouses>>,
        TError,
        TData
      >
    >;
    axios?: AxiosRequestConfig;
  },
  queryClient?: QueryClient,
): UseSuspenseQueryResult<TData, TError> & {
  queryKey: DataTag<QueryKey, TData, TError>;
} {
  const queryOptions = getWarehousesSuspenseQueryOptions(options);

  const query = useSuspenseQuery(
    queryOptions,
    queryClient,
  ) as UseSuspenseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
  };

  query.queryKey = queryOptions.queryKey;

  return query;
}

export const toWarehouseState = (state?: string | null): WarehouseState => {
  const normalized = state?.toUpperCase();

  if (normalized === "RUNNING" || normalized === "STARTING") {
    return "active";
  }

  if (normalized === "STOPPING") {
    return "idle";
  }

  return "stopped";
};

export const toWarehouse = (warehouse: WarehouseApi): Warehouse => {
  const state = toWarehouseState(warehouse.state);
  const activity = warehouse.activity ?? [];
  const activityScore =
    warehouse.activity_score ?? activity.reduce((total, value) => total + value, 0);
  const activeQueries =
    warehouse.active_queries ?? activity[activity.length - 1] ?? 0;
  const typeLabel = getWarehouseTypeLabel(warehouse);
  const scalingStatus = formatScalingStatus({
    numClusters: warehouse.num_clusters,
    minClusters: warehouse.min_num_clusters,
    maxClusters: warehouse.max_num_clusters,
  });

  return {
    id: warehouse.id,
    name: warehouse.name,
    size: warehouse.size ?? "Unknown",
    type: typeLabel,
    scalingStatus,
    state,
    activeQueries,
    activity,
    activityScore,
    ownerName: warehouse.creator_name,
    numClusters: warehouse.num_clusters,
    minClusters: warehouse.min_num_clusters,
    maxClusters: warehouse.max_num_clusters,
  };
};

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getWarehouseTypeLabel = (warehouse: WarehouseApi) => {
  if (warehouse.enable_serverless_compute) {
    return "Serverless";
  }

  if (warehouse.warehouse_type) {
    const normalized = warehouse.warehouse_type.toUpperCase();
    if (normalized.includes("SERVERLESS")) {
      return "Serverless";
    }

    return formatLabel(warehouse.warehouse_type);
  }

  return "Unknown";
};

const formatScalingStatus = ({
  numClusters,
  minClusters,
  maxClusters,
}: {
  numClusters: number | null;
  minClusters: number | null;
  maxClusters: number | null;
}) => {
  const current = numClusters ?? minClusters ?? maxClusters;
  const maxValue = maxClusters ?? minClusters ?? numClusters;

  if (current == null || maxValue == null) {
    return "-";
  }

  return `${current}/${maxValue}`;
};
