from pydantic import BaseModel


class NoteCreateRequest(BaseModel):
    workspace_id: int
    visibility: str = "PRIVATE"
    team_id: int | None = None
    scope_type: str = "PROJECT"
    project_id: int | None = None
    env: str | None = None
    cluster_id: int | None = None
    content: str


class NoteUpdateRequest(BaseModel):
    visibility: str | None = None
    team_id: int | None = None
    scope_type: str | None = None
    project_id: int | None = None
    env: str | None = None
    cluster_id: int | None = None
    content: str | None = None
