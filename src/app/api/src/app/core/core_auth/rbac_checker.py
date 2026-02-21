
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.core_auth.user import User

bearer_schema = HTTPBearer(auto_error=True)

# Module-level dependency sentinels (avoid calling Depends() inside argument defaults)
CURRENT_USER_CRED_DEP = Depends(bearer_schema)
CURRENT_USER_DEP = Depends(lambda cred: User.from_token(cred.credentials))


def get_current_user(credientials: HTTPAuthorizationCredentials = CURRENT_USER_CRED_DEP) -> User:
    """
    Extracts JWT from request and returns a User instance.
    """
    token = credientials.credentials
    return User.from_token(token)


def require_roles(allowed_roles: list[str] | None = None):
    """
    FastAPI dependency to enforce allowed roles per endpoint.
    If allowed_roles is None or empty, allow all roles.
    """

    def role_checker(user: User = CURRENT_USER_DEP):
        if allowed_roles and not any(role in allowed_roles for role in user.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have the required role",
            )
        return user

    return role_checker
