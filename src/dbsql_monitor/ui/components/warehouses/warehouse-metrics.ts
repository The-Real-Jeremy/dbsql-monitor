import {
  useSuspenseQuery,
  useSuspenseInfiniteQuery,
  type InfiniteData,
  type DataTag,
  type QueryClient,
  type QueryFunction,
  type QueryKey,
  type UseSuspenseQueryOptions,
  type UseSuspenseInfiniteQueryOptions,
  type UseSuspenseQueryResult,
} from "@tanstack/react-query";
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import * as axios from "axios";

export type WarehouseStats = {
  num_active_clusters: number | null;
  num_running_commands: number | null;
  num_queued_commands: number | null;
  num_running_metadata_rpcs: number | null;
};

export type WarehouseEndpointMetric = {
  start_time_ms: number | null;
  end_time_ms: number | null;
  max_running_slots: number | null;
  max_queued_slots: number | null;
  throughput: number | null;
};

export type WarehouseQuery = {
  id: string;
  status: string | null;
  start_time_ms: number | null;
  end_time_ms: number | null;
  queued_start_time_ms: number | null;
  queued_end_time_ms: number | null;
  user_name: string | null;
  query_text: string | null;
  source: string | null;
  source_name: string | null;
  statement_type: string | null;
  duration_ms: number | null;
  fetch_time_ms: number | null;
  cache_hit_percent: number | null;
  files_read: number | null;
  bytes_scanned: number | null;
  spill_bytes: number | null;
};

export type WarehouseQueriesPage = {
  queries: WarehouseQuery[];
  next_page_token: string | null;
  has_next_page: boolean | null;
};

export type WorkspaceContext = {
  workspace_host: string;
  org_id: string | null;
};

const normalizeStatsResponse = (
  response: AxiosResponse<WarehouseStats | { stats?: WarehouseStats }>,
): AxiosResponse<WarehouseStats> => ({
  ...response,
  data: (response.data as { stats?: WarehouseStats })?.stats ??
    (response.data as WarehouseStats) ??
    {},
});

export const getWarehouseStats = (
  warehouseId: string,
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<WarehouseStats>> => {
  return axios.default
    .get(`/api/warehouses/${warehouseId}/stats`, options)
    .then(normalizeStatsResponse);
};

export const getWarehouseStatsQueryKey = (warehouseId: string) => {
  return [`/api/warehouses/${warehouseId}/stats`] as const;
};

export const getWarehouseStatsSuspenseQueryOptions = <
  TData = Awaited<ReturnType<typeof getWarehouseStats>>,
  TError = AxiosError<unknown>,
>(
  warehouseId: string,
  options?: {
    query?: Partial<
      UseSuspenseQueryOptions<
        Awaited<ReturnType<typeof getWarehouseStats>>,
        TError,
        TData
      >
    >;
    axios?: AxiosRequestConfig;
  },
) => {
  const { query: queryOptions, axios: axiosOptions } = options ?? {};

  const queryKey = queryOptions?.queryKey ?? getWarehouseStatsQueryKey(warehouseId);

  const queryFn: QueryFunction<Awaited<ReturnType<typeof getWarehouseStats>>> = ({
    signal,
  }) => getWarehouseStats(warehouseId, { signal, ...axiosOptions });

  return {
    queryKey,
    queryFn,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    ...queryOptions,
  } as UseSuspenseQueryOptions<
    Awaited<ReturnType<typeof getWarehouseStats>>,
    TError,
    TData
  > & { queryKey: DataTag<QueryKey, TData, TError> };
};

export function useWarehouseStatsSuspense<
  TData = Awaited<ReturnType<typeof getWarehouseStats>>,
  TError = AxiosError<unknown>,
>(
  warehouseId: string,
  options?: {
    query?: Partial<
      UseSuspenseQueryOptions<
        Awaited<ReturnType<typeof getWarehouseStats>>,
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
  const queryOptions = getWarehouseStatsSuspenseQueryOptions(
    warehouseId,
    options,
  );

  const query = useSuspenseQuery(
    queryOptions,
    queryClient,
  ) as UseSuspenseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
  };

  query.queryKey = queryOptions.queryKey;

  return query;
}

export const getWarehouseEndpointMetrics = (
  warehouseId: string,
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<WarehouseEndpointMetric[]>> => {
  return axios.default.get(
    `/api/warehouses/${warehouseId}/endpoint-metrics`,
    options,
  );
};

export const getWarehouseEndpointMetricsQueryKey = (warehouseId: string) => {
  return [`/api/warehouses/${warehouseId}/endpoint-metrics`] as const;
};

export const getWarehouseEndpointMetricsSuspenseQueryOptions = <
  TData = Awaited<ReturnType<typeof getWarehouseEndpointMetrics>>,
  TError = AxiosError<unknown>,
>(
  warehouseId: string,
  options?: {
    query?: Partial<
      UseSuspenseQueryOptions<
        Awaited<ReturnType<typeof getWarehouseEndpointMetrics>>,
        TError,
        TData
      >
    >;
    axios?: AxiosRequestConfig;
  },
) => {
  const { query: queryOptions, axios: axiosOptions } = options ?? {};

  const queryKey =
    queryOptions?.queryKey ?? getWarehouseEndpointMetricsQueryKey(warehouseId);

  const queryFn: QueryFunction<
    Awaited<ReturnType<typeof getWarehouseEndpointMetrics>>
  > = ({ signal }) =>
    getWarehouseEndpointMetrics(warehouseId, { signal, ...axiosOptions });

  return {
    queryKey,
    queryFn,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    ...queryOptions,
  } as UseSuspenseQueryOptions<
    Awaited<ReturnType<typeof getWarehouseEndpointMetrics>>,
    TError,
    TData
  > & { queryKey: DataTag<QueryKey, TData, TError> };
};

export function useWarehouseEndpointMetricsSuspense<
  TData = Awaited<ReturnType<typeof getWarehouseEndpointMetrics>>,
  TError = AxiosError<unknown>,
>(
  warehouseId: string,
  options?: {
    query?: Partial<
      UseSuspenseQueryOptions<
        Awaited<ReturnType<typeof getWarehouseEndpointMetrics>>,
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
  const queryOptions = getWarehouseEndpointMetricsSuspenseQueryOptions(
    warehouseId,
    options,
  );

  const query = useSuspenseQuery(
    queryOptions,
    queryClient,
  ) as UseSuspenseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
  };

  query.queryKey = queryOptions.queryKey;

  return query;
}

export const getWarehouseQueries = (
  warehouseId: string,
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<WarehouseQueriesPage>> => {
  return axios.default.get(
    `/api/warehouses/${warehouseId}/queries`,
    options,
  );
};

type WarehouseQueriesResponse = Awaited<ReturnType<typeof getWarehouseQueries>>;
type WarehouseQueriesInfiniteData = InfiniteData<
  WarehouseQueriesResponse,
  string | null
>;

export const getWarehouseQueriesQueryKey = (warehouseId: string) => {
  return [`/api/warehouses/${warehouseId}/queries`] as const;
};

export const getWarehouseQueriesSuspenseQueryOptions = <
  TData = Awaited<ReturnType<typeof getWarehouseQueries>>,
  TError = AxiosError<unknown>,
>(
  warehouseId: string,
  options?: {
    query?: Partial<
      UseSuspenseQueryOptions<
        Awaited<ReturnType<typeof getWarehouseQueries>>,
        TError,
        TData
      >
    >;
    axios?: AxiosRequestConfig;
  },
) => {
  const { query: queryOptions, axios: axiosOptions } = options ?? {};

  const queryKey = queryOptions?.queryKey ?? getWarehouseQueriesQueryKey(warehouseId);

  const queryFn: QueryFunction<Awaited<ReturnType<typeof getWarehouseQueries>>> = ({
    signal,
  }) => getWarehouseQueries(warehouseId, { signal, ...axiosOptions });

  return {
    queryKey,
    queryFn,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    ...queryOptions,
  } as UseSuspenseQueryOptions<
    Awaited<ReturnType<typeof getWarehouseQueries>>,
    TError,
    TData
  > & { queryKey: DataTag<QueryKey, TData, TError> };
};

export function useWarehouseQueriesSuspense<
  TData = Awaited<ReturnType<typeof getWarehouseQueries>>,
  TError = AxiosError<unknown>,
>(
  warehouseId: string,
  options?: {
    query?: Partial<
      UseSuspenseQueryOptions<
        Awaited<ReturnType<typeof getWarehouseQueries>>,
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
  const queryOptions = getWarehouseQueriesSuspenseQueryOptions(warehouseId, options);

  const query = useSuspenseQuery(
    queryOptions,
    queryClient,
  ) as UseSuspenseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
  };

  query.queryKey = queryOptions.queryKey;

  return query;
}

export const getWarehouseQueriesInfiniteSuspenseQueryOptions = (
  warehouseId: string,
  options?: {
    query?: Partial<
      UseSuspenseInfiniteQueryOptions<
        WarehouseQueriesResponse,
        AxiosError<unknown>,
        WarehouseQueriesInfiniteData,
        QueryKey,
        string | null
      >
    >;
    axios?: AxiosRequestConfig;
  },
) => {
  const { query: queryOptions, axios: axiosOptions } = options ?? {};
  const queryKey =
    queryOptions?.queryKey ?? getWarehouseQueriesQueryKey(warehouseId);

  const queryFn: QueryFunction<
    WarehouseQueriesResponse,
    QueryKey,
    string | null
  > = ({ signal, pageParam }) =>
    getWarehouseQueries(warehouseId, {
      signal,
      ...axiosOptions,
      params: {
        ...(axiosOptions?.params ?? {}),
        page_token: pageParam ?? undefined,
      },
    });

  return {
    queryKey,
    queryFn,
    initialPageParam: null,
    getNextPageParam: (lastPage: AxiosResponse<WarehouseQueriesPage>) =>
      lastPage.data.next_page_token ?? undefined,
    ...queryOptions,
  } as UseSuspenseInfiniteQueryOptions<
    WarehouseQueriesResponse,
    AxiosError<unknown>,
    WarehouseQueriesInfiniteData,
    QueryKey,
    string | null
  >;
};

export function useWarehouseQueriesInfiniteSuspense(
  warehouseId: string,
  options?: {
    query?: Partial<
      UseSuspenseInfiniteQueryOptions<
        WarehouseQueriesResponse,
        AxiosError<unknown>,
        WarehouseQueriesInfiniteData,
        QueryKey,
        string | null
      >
    >;
    axios?: AxiosRequestConfig;
  },
  queryClient?: QueryClient,
) {
  const queryOptions = getWarehouseQueriesInfiniteSuspenseQueryOptions(
    warehouseId,
    options,
  );

  return useSuspenseInfiniteQuery(
    queryOptions,
    queryClient,
  );
}

export const getWorkspaceContext = (
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<WorkspaceContext>> => {
  return axios.default.get("/api/context", options);
};

export const getWorkspaceContextQueryKey = () => {
  return ["/api/context"] as const;
};

export const getWorkspaceContextSuspenseQueryOptions = <
  TData = Awaited<ReturnType<typeof getWorkspaceContext>>,
  TError = AxiosError<unknown>,
>(
  options?: {
    query?: Partial<
      UseSuspenseQueryOptions<
        Awaited<ReturnType<typeof getWorkspaceContext>>,
        TError,
        TData
      >
    >;
    axios?: AxiosRequestConfig;
  },
) => {
  const { query: queryOptions, axios: axiosOptions } = options ?? {};

  const queryKey = queryOptions?.queryKey ?? getWorkspaceContextQueryKey();

  const queryFn: QueryFunction<Awaited<ReturnType<typeof getWorkspaceContext>>> = ({
    signal,
  }) => getWorkspaceContext({ signal, ...axiosOptions });

  return {
    queryKey,
    queryFn,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    ...queryOptions,
  } as UseSuspenseQueryOptions<
    Awaited<ReturnType<typeof getWorkspaceContext>>,
    TError,
    TData
  > & { queryKey: DataTag<QueryKey, TData, TError> };
};

export function useWorkspaceContextSuspense<
  TData = Awaited<ReturnType<typeof getWorkspaceContext>>,
  TError = AxiosError<unknown>,
>(
  options?: {
    query?: Partial<
      UseSuspenseQueryOptions<
        Awaited<ReturnType<typeof getWorkspaceContext>>,
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
  const queryOptions = getWorkspaceContextSuspenseQueryOptions(options);

  const query = useSuspenseQuery(
    queryOptions,
    queryClient,
  ) as UseSuspenseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
  };

  query.queryKey = queryOptions.queryKey;

  return query;
}
