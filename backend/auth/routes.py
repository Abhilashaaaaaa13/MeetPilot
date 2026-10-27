import base64
import httpx
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from auth.config import OAUTH_PROVIDERS, REDIRECT_BASE_URL, FRONTEND_URL, MCP_SERVICE_NAMES
from auth.token import save_tokens, delete_tokens, get_connected_services

router = APIRouter()


@router.get("/connections")
def list_connections(user_id: str):
    connected = set(get_connected_services(user_id))
    return [
        {"id": service, "name": name, "connected": service in connected}
        for service, name in MCP_SERVICE_NAMES.items()
    ]


@router.get("/connect/{service}")
def connect(service: str, user_id: str):
    if service not in OAUTH_PROVIDERS:
        raise HTTPException(404, f"Unknown service '{service}'")

    provider = OAUTH_PROVIDERS[service]
    if not provider["client_id"] or not provider["client_secret"]:
        raise HTTPException(500, f"'{service}' OAuth credentials are not configured")

    redirect_uri = f"{REDIRECT_BASE_URL}/callback/{service}"

    params = {
        "client_id": provider["client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "state": user_id,
        **provider["extra_auth_params"],
    }
    if provider["scopes"]:  # Notion has no scopes, so don't send an empty one
        params["scope"] = provider["scopes"]

    return RedirectResponse(f"{provider['auth_url']}?{urlencode(params)}")


@router.delete("/connect/{service}")
def disconnect(service: str, user_id: str):
    if service not in OAUTH_PROVIDERS:
        raise HTTPException(404, f"Unknown service '{service}'")

    delete_tokens(user_id, service)
    return {"status": "disconnected", "service": service, "user_id": user_id}


@router.get("/callback/{service}")
def callback(service: str, state: str, code: str | None = None, error: str | None = None):
    if service not in OAUTH_PROVIDERS:
        raise HTTPException(404, f"Unknown service '{service}'")

    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/?connection_error={service}")

    provider = OAUTH_PROVIDERS[service]
    redirect_uri = f"{REDIRECT_BASE_URL}/callback/{service}"
    user_id = state

    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
    }
    headers = {"Accept": "application/json"}

    if service == "notion":
        # Notion wants Basic auth and a JSON body
        basic = base64.b64encode(
            f"{provider['client_id']}:{provider['client_secret']}".encode()
        ).decode()
        headers["Authorization"] = f"Basic {basic}"
        resp = httpx.post(provider["token_url"], json=payload, headers=headers)
    elif service == "jira":
        # Atlassian wants a JSON body
        payload["client_id"] = provider["client_id"]
        payload["client_secret"] = provider["client_secret"]
        resp = httpx.post(provider["token_url"], json=payload, headers=headers)
    else:
        payload["client_id"] = provider["client_id"]
        payload["client_secret"] = provider["client_secret"]
        resp = httpx.post(provider["token_url"], data=payload, headers=headers)

    if not resp.is_success:
        print("TOKEN EXCHANGE FAILED:", service, resp.status_code, resp.text)
    resp.raise_for_status()
    data = resp.json()

    if service == "slack" and not data.get("ok"):
        print("SLACK ERROR:", data)
        return RedirectResponse(f"{FRONTEND_URL}/?connection_error={service}")

    save_tokens(
        user_id=user_id,
        service=service,
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        expires_in=data.get("expires_in"),
    )

    return RedirectResponse(f"{FRONTEND_URL}/?connected={service}")