from pydantic import BaseModel
from .. import __version__


class VersionOut(BaseModel):
    version: str

    @classmethod
    def from_metadata(cls):
        return cls(version=__version__)


class Warehouse(BaseModel):
    id: str
    name: str
    size: str | None = None
    state: str | None = None
    num_active_sessions: int | None = None
    num_clusters: int | None = None
    min_num_clusters: int | None = None
    max_num_clusters: int | None = None
    enable_serverless_compute: bool | None = None
    warehouse_type: str | None = None
    creator_name: str | None = None


class WarehouseIn(BaseModel):
    id: str | None = None
    name: str | None = None
    size: str | None = None


class WarehouseOut(Warehouse):
    pass


class WarehouseMetricsOut(WarehouseOut):
    activity: list[int]
    activity_window_minutes: int
    activity_bucket_ms: int
    activity_score: int
    active_queries: int


class WarehouseStatsOut(BaseModel):
    num_active_clusters: int | None = None
    num_running_commands: int | None = None
    num_queued_commands: int | None = None
    num_running_metadata_rpcs: int | None = None


class WarehouseEndpointMetricOut(BaseModel):
    start_time_ms: int | None = None
    end_time_ms: int | None = None
    max_running_slots: int | None = None
    max_queued_slots: int | None = None
    throughput: int | None = None


class WarehouseQueryOut(BaseModel):
    id: str
    status: str | None = None
    start_time_ms: int | None = None
    end_time_ms: int | None = None
    queued_start_time_ms: int | None = None
    queued_end_time_ms: int | None = None
    user_name: str | None = None
    query_text: str | None = None
    source: str | None = None
    source_name: str | None = None
    statement_type: str | None = None
    duration_ms: int | None = None
    fetch_time_ms: int | None = None
    cache_hit_percent: float | None = None
    files_read: int | None = None
    bytes_scanned: int | None = None
    spill_bytes: int | None = None


class WorkspaceContextOut(BaseModel):
    workspace_host: str
    org_id: str | None = None


class WarehouseQueryPageOut(BaseModel):
    queries: list[WarehouseQueryOut]
    next_page_token: str | None = None
    has_next_page: bool | None = None
