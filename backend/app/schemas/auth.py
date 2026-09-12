from pydantic import BaseModel


class AuthenticatedUserOut(BaseModel):
    uid: str
    email: str | None = None
    name: str | None = None
    picture: str | None = None
    sign_in_provider: str | None = None
