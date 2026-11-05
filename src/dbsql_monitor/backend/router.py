import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from databricks.sdk.service.sql import QueryFilter, TimeRange
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.iam import User as UserOut

from .models import (
    VersionOut,
    WarehouseOut,
    WarehouseMetricsOut,
    WarehouseStatsOut,
    WarehouseEndpointMetricOut,
    WarehouseQueryOut,
    WorkspaceContextOut,
    WarehouseQueryPageOut,
)
from .dependencies import get_obo_ws
from .config import conf

api = APIRouter(prefix=conf.api_prefix)


@api.get("/version", response_model=VersionOut, operation_id="version")
async def version():
    return VersionOut.from_metadata()


@api.get("/current-user", response_model=UserOut, operation_id="currentUser")
def me(obo_ws: Annotated[WorkspaceClient, Depends(get_obo_ws)]):
    return obo_ws.current_user.me()


@api.get(
    "/context",
    response_model=WorkspaceContextOut,
    operation_id="workspaceContext",
)
def workspace_context(
    obo_ws: Annotated[WorkspaceClient, Depends(get_obo_ws)],
):
    host = (obo_ws.config.host or "").rstrip("/")
    org_id = conf.databricks_org_id or getattr(obo_ws.config, "org_id", None)

    return WorkspaceContextOut(workspace_host=host, org_id=org_id)


@api.get("/warehouses", response_model=list[WarehouseOut], operation_id="listWarehouses")
def list_warehouses(obo_ws: Annotated[WorkspaceClient, Depends(get_obo_ws)]):
    warehouses: list[WarehouseOut] = []

    for warehouse in obo_ws.warehouses.list():
        if not warehouse.id:
            continue

        warehouses.append(
            WarehouseOut(
                id=warehouse.id,
                name=warehouse.name or "Unknown warehouse",
                size=warehouse.cluster_size,
                state=warehouse.state.value if warehouse.state else None,
                num_active_sessions=warehouse.num_active_sessions,
                num_clusters=warehouse.num_clusters,
                min_num_clusters=warehouse.min_num_clusters,
                max_num_clusters=warehouse.max_num_clusters,
                enable_serverless_compute=warehouse.enable_serverless_compute,
                warehouse_type=warehouse.warehouse_type.value
                if warehouse.warehouse_type
                else None,
                creator_name=warehouse.creator_name,
            )
        )

    return warehouses


@api.get(
    "/warehouses/metrics",
    response_model=list[WarehouseMetricsOut],
    operation_id="listWarehousesMetrics",
)
def list_warehouses_metrics(
    obo_ws: Annotated[WorkspaceClient, Depends(get_obo_ws)],
    period_minutes: int = 60,
    bucket_count: int = 60,
    max_results: int = 1000,
):
    warehouses = list(obo_ws.warehouses.list())
    warehouse_ids = [warehouse.id for warehouse in warehouses if warehouse.id]
    bucket_count = max(1, min(bucket_count, 60))
    period_minutes = max(5, min(period_minutes, 240))

    now_ms = int(time.time() * 1000)
    period_ms = period_minutes * 60 * 1000
    start_ms = now_ms - period_ms
    bucket_ms = int(period_ms / bucket_count)

    activity_map = {warehouse_id: [0] * bucket_count for warehouse_id in warehouse_ids}
    page_size = max(1, min(max_results, 1000))

    if warehouse_ids:
        time_range = TimeRange(start_time_ms=start_ms, end_time_ms=now_ms)
        filter_by = QueryFilter(
            query_start_time_range=time_range,
            warehouse_ids=warehouse_ids,
        )
        page_token: str | None = None
        while True:
            response = obo_ws.query_history.list(
                filter_by=filter_by,
                include_metrics=False,
                max_results=page_size,
                page_token=page_token,
            )
            queries = response.res or []

            for query in queries:
                warehouse_id = query.endpoint_id
                if not warehouse_id or warehouse_id not in activity_map:
                    continue

                query_start = query.query_start_time_ms
                if query_start is None:
                    continue

                query_end = (
                    query.query_end_time_ms
                    or query.execution_end_time_ms
                    or now_ms
                )

                if query_end < start_ms or query_start > now_ms:
                    continue

                clamped_start = max(query_start, start_ms)
                clamped_end = min(query_end, now_ms)

                start_index = int((clamped_start - start_ms) // bucket_ms)
                end_index = int((clamped_end - start_ms) // bucket_ms)

                start_index = max(0, min(start_index, bucket_count - 1))
                end_index = max(0, min(end_index, bucket_count - 1))

                for bucket_index in range(start_index, end_index + 1):
                    activity_map[warehouse_id][bucket_index] += 1

            page_token = response.next_page_token
            if not response.has_next_page or not page_token:
                break

    results: list[WarehouseMetricsOut] = []

    for warehouse in warehouses:
        if not warehouse.id:
            continue

        activity = activity_map.get(warehouse.id, [0] * bucket_count)
        activity_score = sum(activity)
        active_queries = activity_score

        results.append(
            WarehouseMetricsOut(
                id=warehouse.id,
                name=warehouse.name or "Unknown warehouse",
                size=warehouse.cluster_size,
                state=warehouse.state.value if warehouse.state else None,
                num_active_sessions=warehouse.num_active_sessions,
                num_clusters=warehouse.num_clusters,
                min_num_clusters=warehouse.min_num_clusters,
                max_num_clusters=warehouse.max_num_clusters,
                enable_serverless_compute=warehouse.enable_serverless_compute,
                warehouse_type=warehouse.warehouse_type.value
                if warehouse.warehouse_type
                else None,
                creator_name=warehouse.creator_name,
                activity=activity,
                activity_window_minutes=period_minutes,
                activity_bucket_ms=bucket_ms,
                activity_score=activity_score,
                active_queries=active_queries,
            )
        )

    return results


@api.get(
    "/warehouses/{warehouse_id}/stats",
    response_model=WarehouseStatsOut,
    operation_id="warehouseStats",
)
def warehouse_stats(
    warehouse_id: str,
    obo_ws: Annotated[WorkspaceClient, Depends(get_obo_ws)],
):
    try:
        response = obo_ws.api_client.do(
            "GET",
            path=f"/api/2.0/sql/warehouses/{warehouse_id}/stats",
        )
    except Exception as exc:
        try:
            response = obo_ws.api_client.do(
                "GET",
                path=f"/sql/warehouses/{warehouse_id}/stats",
            )
        except Exception as fallback_exc:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Failed to load warehouse stats. "
                    f"Primary error: {exc}. Fallback error: {fallback_exc}"
                ),
            ) from fallback_exc

    stats = response.get("stats", {}) if isinstance(response, dict) else {}

    return WarehouseStatsOut(
        num_active_clusters=stats.get("num_active_clusters"),
        num_running_commands=stats.get("num_running_commands"),
        num_queued_commands=stats.get("num_queued_commands"),
        num_running_metadata_rpcs=stats.get("num_running_metadata_rpcs"),
    )


@api.get(
    "/warehouses/{warehouse_id}/endpoint-metrics",
    response_model=list[WarehouseEndpointMetricOut],
    operation_id="warehouseEndpointMetrics",
)
def warehouse_endpoint_metrics(
    warehouse_id: str,
    obo_ws: Annotated[WorkspaceClient, Depends(get_obo_ws)],
    start_time_ms: int | None = None,
    end_time_ms: int | None = None,
):
    now_ms = int(time.time() * 1000)
    end_time_ms = end_time_ms or now_ms
    start_time_ms = start_time_ms or (end_time_ms - 30 * 60 * 1000)

    try:
        response = obo_ws.api_client.do(
            "GET",
            path="/api/2.0/sql/history/endpoint-metrics",
            query={
                "endpoint_id": warehouse_id,
                "time_range.start_time_ms": start_time_ms,
                "time_range.end_time_ms": end_time_ms,
            },
        )
    except Exception as exc:
        try:
            response = obo_ws.api_client.do(
                "GET",
                path="/sql/history/endpoint-metrics",
                query={
                    "endpoint_id": warehouse_id,
                    "time_range.start_time_ms": start_time_ms,
                    "time_range.end_time_ms": end_time_ms,
                },
            )
        except Exception as fallback_exc:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Failed to load endpoint metrics. "
                    f"Primary error: {exc}. Fallback error: {fallback_exc}"
                ),
            ) from fallback_exc

    if isinstance(response, list):
        metrics = response
    elif isinstance(response, dict):
        metrics = response.get("metrics", []) or []
    else:
        metrics = []
    results: list[WarehouseEndpointMetricOut] = []

    for metric in metrics:
        time_range = metric.get("time_range") or {}
        results.append(
            WarehouseEndpointMetricOut(
                start_time_ms=time_range.get("start_time_ms"),
                end_time_ms=time_range.get("end_time_ms"),
                max_running_slots=metric.get("max_running_slots"),
                max_queued_slots=metric.get("max_queued_slots"),
                throughput=metric.get("throughput"),
            )
        )

    return results


@api.get(
    "/warehouses/{warehouse_id}/queries",
    response_model=WarehouseQueryPageOut,
    operation_id="warehouseQueries",
)
def warehouse_queries(
    warehouse_id: str,
    obo_ws: Annotated[WorkspaceClient, Depends(get_obo_ws)],
    start_time_ms: int | None = None,
    end_time_ms: int | None = None,
    max_results: int = 1000,
    page_token: str | None = None,
):
    now_ms = int(time.time() * 1000)
    range_end_ms = end_time_ms or now_ms
    range_start_ms = start_time_ms or (range_end_ms - 30 * 60 * 1000)
    max_results = max(1, min(max_results, 1000))
    overlap_window_ms = max(range_end_ms - range_start_ms, 60 * 60 * 1000)
    max_overlap_ms = 30 * 24 * 60 * 60 * 1000
    query_start_ms = max(0, range_start_ms - min(overlap_window_ms, max_overlap_ms))

    filter_by = QueryFilter(
        query_start_time_range=TimeRange(
            start_time_ms=query_start_ms,
            end_time_ms=range_end_ms,
        ),
        warehouse_ids=[warehouse_id],
    )
    response = obo_ws.query_history.list(
        filter_by=filter_by,
        include_metrics=True,
        max_results=max_results,
        page_token=page_token,
    )
    queries = response.res or []
    results: list[WarehouseQueryOut] = []
    dashboard_names: dict[str, str] = {}
    query_names: dict[str, str] = {}

    dashboard_ids: set[str] = set()
    legacy_dashboard_ids: set[str] = set()
    query_ids: set[str] = set()

    for query in queries:
        if not query.query_source:
            continue
        if query.query_source.dashboard_id:
            dashboard_ids.add(query.query_source.dashboard_id)
        if query.query_source.legacy_dashboard_id:
            legacy_dashboard_ids.add(query.query_source.legacy_dashboard_id)
        if query.query_source.sql_query_id:
            query_ids.add(query.query_source.sql_query_id)

    for dashboard_id in dashboard_ids | legacy_dashboard_ids:
        try:
            dashboard = obo_ws.dashboards.get(dashboard_id)
        except Exception:
            continue
        if dashboard and dashboard.name:
            dashboard_names[dashboard_id] = dashboard.name

    for query_id in query_ids:
        try:
            query_info = obo_ws.queries.get(query_id)
        except Exception:
            continue
        if query_info and query_info.display_name:
            query_names[query_id] = query_info.display_name

    def normalize_time_ms(value: int | None) -> int | None:
        if value is None:
            return None
        if value > 10_000_000_000_000:
            return int(value / 1000)
        if value < 100_000_000_000:
            return value * 1000
        return value

    for query in queries:
        query_id = query.query_id or query.lookup_key
        if not query_id:
            continue

        start_ms = normalize_time_ms(query.query_start_time_ms)
        if start_ms is None:
            continue
        end_ms = normalize_time_ms(
            query.query_end_time_ms or query.execution_end_time_ms
        )
        overlap_end_ms = end_ms if end_ms is not None else range_end_ms
        if start_ms > range_end_ms or overlap_end_ms < range_start_ms:
            continue
        metrics = query.metrics
        read_bytes = metrics.read_bytes if metrics else None
        if read_bytes is None and metrics:
            read_files_bytes = metrics.read_files_bytes or 0
            read_remote_bytes = metrics.read_remote_bytes or 0
            read_bytes = read_files_bytes + read_remote_bytes
            if read_bytes == 0:
                read_bytes = None
        cache_hit_percent = None
        if metrics:
            read_cache_bytes = metrics.read_cache_bytes
            if read_bytes and read_cache_bytes is not None:
                cache_hit_percent = (read_cache_bytes / read_bytes) * 100
            elif metrics.result_from_cache:
                cache_hit_percent = 100.0
            elif read_bytes == 0:
                cache_hit_percent = 0.0
        queue_start_candidates = []
        if metrics:
            if metrics.overloading_queue_start_timestamp:
                queue_start_candidates.append(metrics.overloading_queue_start_timestamp)
            if metrics.provisioning_queue_start_timestamp:
                queue_start_candidates.append(metrics.provisioning_queue_start_timestamp)
        queue_start_ms = min(queue_start_candidates) if queue_start_candidates else None
        queue_end_ms = start_ms if queue_start_ms and start_ms else None
        if queue_start_ms and queue_end_ms and queue_end_ms <= queue_start_ms:
            queue_start_ms = None
            queue_end_ms = None

        query_source_label = None
        if query.query_source:
            source_fields = [
                ("Alert", query.query_source.alert_id),
                ("Dashboard", query.query_source.dashboard_id),
                ("Genie", query.query_source.genie_space_id),
                ("Job", query.query_source.job_info),
                ("Legacy dashboard", query.query_source.legacy_dashboard_id),
                ("Notebook", query.query_source.notebook_id),
                ("SQL query", query.query_source.sql_query_id),
            ]
            for label, value in source_fields:
                if value:
                    query_source_label = label
                    break
        source_name = None
        if query.query_source:
            if query.query_source.dashboard_id:
                source_name = dashboard_names.get(query.query_source.dashboard_id)
            elif query.query_source.legacy_dashboard_id:
                source_name = dashboard_names.get(
                    query.query_source.legacy_dashboard_id
                )
            elif query.query_source.sql_query_id:
                source_name = query_names.get(query.query_source.sql_query_id)
            elif query.query_source.notebook_id:
                notebook_id = query.query_source.notebook_id
                if notebook_id and "/" in notebook_id:
                    source_name = notebook_id.rsplit("/", 1)[-1]
        results.append(
            WarehouseQueryOut(
                id=query_id,
                status=query.status.value if query.status else None,
                start_time_ms=start_ms,
                end_time_ms=end_ms,
                queued_start_time_ms=queue_start_ms,
                queued_end_time_ms=queue_end_ms,
                user_name=query.user_name,
                query_text=query.query_text,
                source=query_source_label or query.client_application or "Unknown",
                source_name=source_name,
                statement_type=query.statement_type.value
                if query.statement_type
                else None,
                duration_ms=query.duration
                or (metrics.total_time_ms if metrics else None),
                fetch_time_ms=metrics.result_fetch_time_ms if metrics else None,
                cache_hit_percent=cache_hit_percent,
                files_read=metrics.read_files_count if metrics else None,
                bytes_scanned=read_bytes,
                spill_bytes=metrics.spill_to_disk_bytes if metrics else None,
            )
        )

    results.sort(
        key=lambda item: item.end_time_ms or item.start_time_ms or 0,
        reverse=True,
    )
    return WarehouseQueryPageOut(
        queries=results,
        next_page_token=response.next_page_token,
        has_next_page=response.has_next_page,
    )
