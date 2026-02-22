from pydantic import BaseModel, Field


class GitlabIssueCreateRequest(BaseModel):
    project_id: int
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    labels: list[str] = Field(default_factory=list)
    due_date: str | None = None
