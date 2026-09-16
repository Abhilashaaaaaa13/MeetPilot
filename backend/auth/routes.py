"""
Two generic routes, parameterized by `service`, handle OAuth for all
6 providers -- this is what your frontend's "connect" toggle calls.
"""

import httpx
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from auth.config import OAUTH_PROVIDERS, REDIRECT_BASE_URL
from auth.token import save_tokens

router = APIRouter()


@router.get("/connect/{service}")
def connect(service: str, user_id: str):
    """
    Frontend toggle hits this. Redirects the user to the provider's own
    consent screen. `user_id` is threaded through via `state` so the
    callback knows whose tokens these are.
    """
    if service not in OAUTH_PROVIDERS:
        raise HTTPException(404, f"Unknown service '{service}'")

    provider = OAUTH_PROVIDERS[service]
    redirect_uri = f"{REDIRECT_BASE_URL}/callback/{service}"

    params = {
        "client_id": provider["client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": provider["scopes"],
        "state": user_id,  # carries user identity through the redirect
        **provider["extra_auth_params"],
    }
    return RedirectResponse(f"{provider['auth_url']}?{urlencode(params)}")


@router.get("/callback/{service}")
def callback(service: str, code: str, state: str):
    """
    Provider redirects here after the user clicks Allow. `state` is the
    user_id we passed in. Exchange the code for tokens and store them.
    """
    if service not in OAUTH_PROVIDERS:
        raise HTTPException(404, f"Unknown service '{service}'")

    provider = OAUTH_PROVIDERS[service]
    redirect_uri = f"{REDIRECT_BASE_URL}/callback/{service}"
    user_id = state

    resp = httpx.post(
        provider["token_url"],
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": provider["client_id"],
            "client_secret": provider["client_secret"],
        },
        headers={"Accept": "application/json"},
    )
    resp.raise_for_status()
    data = resp.json()

    save_tokens(
        user_id=user_id,
        service=service,
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        expires_in=data.get("expires_in"),
    )

    return {"status": "connected", "service": service, "user_id": user_id}