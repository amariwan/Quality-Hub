from datetime import datetime, timedelta

import jwt

# Dev secret (local only!)
SECRET_KEY = "devsecret"
ALGORITHM = "HS256"


def generate_fake_jwt(
    username="paul.mittelstaedt@testemail",
    name="paul testuser1234",
    roles=None,
    organization=None,
):
    now = datetime.utcnow()
    if roles is None:
        roles = [
        ]
    if organization is None:
        organization = []

    payload = {
        "exp": int((now + timedelta(hours=1)).timestamp()),
        "iat": int(now.timestamp()),
        "auth_time": int(now.timestamp()) - 10,
        "proxy": ["proxy"],
        "resource_access": {"proxy": {"roles": ["proxy"]}},
        "email_verified": True,
        "roles": roles,
        "organization": organization,
        "name": name,
        "preferred_username": username,
        "given_name": name.split()[0],
        "family_name": name.split()[1],
        "email": username,
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token


if __name__ == "__main__":
    print(generate_fake_jwt())
