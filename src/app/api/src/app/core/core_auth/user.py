from dataclasses import dataclass

import jwt


@dataclass
class User:
    """
    Represents a user extracted from a JWT access token (KeyCloak).

    This class provides a structured way to work with user-related claims
    (such as email, name, roles, and organisation) after decoding a JWT.
    It is intended for quick access to user identity and authorization data
    without repeatedly parsing the token.

    Attributes:
        email (Optional[str]): The email address of the user, if present.
        name (Optional[str]): The full name of the user, if present.
        roles (List[str]): A list of role identifiers assigned to the user.
        organisation (List[str]): A list of organisations the user belongs to.

    Class Methods:
        from_token(token: str) -> "User":
            Decodes the given JWT (without signature verification) and
            constructs a User object populated with SOME of the claims found in
            the payload.

    """

    email: str | None
    name: str | None
    roles: list[str]
    organization: list[str]

    @classmethod
    def from_token(cls, token: str):
        payload = jwt.decode(token, options={"verify_signature": False})
        return cls(
            roles=payload.get("roles", []),
            organization=payload.get("organization", []),
            name=payload.get("name"),
            email=payload.get("email"),
        )
