from pydantic import BaseModel


class TeamProjectMappingCreateRequest(BaseModel):
    team_id: int
    project_id: int
