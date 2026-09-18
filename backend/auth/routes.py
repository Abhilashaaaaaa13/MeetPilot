"""
Two generic routes, parameterized by `service`, handle OAuth for all
6 providers -- this is what your frontend's "connect" toggle calls.
"""

import httpx
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from auth.config import OAUTH_PROVIDERS, REDIRECT_BASE_URL, FRONTEND_URL, MCP_SERVICE_NAMES
from auth.token import save_tokens, delete_tokens, get_connected_services

router = APIRouter()


@router.get("/connections")
def list_connections(user_id: str):
    """
    Backs the sidebar's MCP toggle list: every known service plus whether
    this user has already connected it.
    """
    connected = set(get_connected_services(user_id))
    return [
        {"id": service, "name": name, "connected": service in connected}
        for service, name in MCP_SERVICE_NAMES.items()
    ]


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


@router.delete("/connect/{service}")
def disconnect(service: str, user_id: str):
    """Frontend toggle-off hits this to drop a stored connection."""
    if service not in OAUTH_PROVIDERS:
        raise HTTPException(404, f"Unknown service '{service}'")

    delete_tokens(user_id, service)
    return {"status": "disconnected", "service": service, "user_id": user_id}


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

    return RedirectResponse(f"{FRONTEND_URL}/?connected={service}")