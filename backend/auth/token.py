import json
import os
import time

import firebase_admin
import httpx
from cryptography.fernet import Fernet
from firebase_admin import credentials, firestore

from auth.config import OAUTH_PROVIDERS

_db = None
_fernet: Fernet | None = None


def init_db():
    """
    Name kept as init_db so app.py needs no change. Now it initialises
    Firebase Admin + Firestore (and the optional token encryption key).
    """
    global _db, _fernet

    if not firebase_admin._apps:
        sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if sa_json:
            cred = credentials.Certificate(json.loads(sa_json))
        else:
            # Falls back to GOOGLE_APPLICATION_CREDENTIALS (path to key file)
            cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)

    _db = firestore.client()

    key = os.environ.get("TOKEN_ENCRYPTION_KEY")
    _fernet = Fernet(key.encode()) if key else None
    if _fernet is None:
        print("WARNING: TOKEN_ENCRYPTION_KEY not set -- tokens stored unencrypted.")


def _ref(user_id: str, service: str):
    # users/{uid}/connections/{service}
    return (
        _db.collection("users")
        .document(user_id)
        .collection("connections")
        .document(service)
    )


def _enc(value: str | None) -> str | None:
    if value is None or _fernet is None:
        return value
    return _fernet.encrypt(value.encode()).decode()


def _dec(value: str | None) -> str | None:
    if value is None or _fernet is None:
        return value
    return _fernet.decrypt(value.encode()).decode()


def save_tokens(
    user_id: str,
    service: str,
    access_token: str,
    refresh_token: str | None,
    expires_in: int | None,
):
    doc = {
        "access_token": _enc(access_token),
        "expires_at": time.time() + expires_in if expires_in else None,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    # Some providers only return a refresh_token the first time.
    # Don't overwrite an existing one with None.
    if refresh_token:
        doc["refresh_token"] = _enc(refresh_token)

    _ref(user_id, service).set(doc, merge=True)


def _load_tokens(user_id: str, service: str) -> dict | None:
    snap = _ref(user_id, service).get()
    if not snap.exists:
        return None
    d = snap.to_dict()
    return {
        "access_token": _dec(d.get("access_token")),
        "refresh_token": _dec(d.get("refresh_token")),
        "expires_at": d.get("expires_at"),
    }


def get_valid_token(user_id: str, service: str) -> str:
    """
    Returns a usable access_token for this user+service, refreshing it
    first if it has expired. Raises if the user never connected this service.
    """
    tokens = _load_tokens(user_id, service)
    if not tokens:
        raise ValueError(
            f"User '{user_id}' has not connected '{service}'. Ask them to connect it first."
        )

    if tokens["expires_at"] and time.time() > tokens["expires_at"] - 60:
        if not tokens["refresh_token"]:
            raise ValueError(
                f"'{service}' token expired and cannot be refreshed. Ask the user to reconnect it."
            )
        tokens = _refresh(user_id, service, tokens["refresh_token"])

    return tokens["access_token"]


def delete_tokens(user_id: str, service: str) -> None:
    """Removes a stored connection, e.g. when the user flips a sidebar toggle off."""
    _ref(user_id, service).delete()


def get_connected_services(user_id: str) -> list[str]:
    """Returns the list of service names this user has connected (e.g. ['notion', 'slack'])."""
    docs = (
        _db.collection("users")
        .document(user_id)
        .collection("connections")
        .stream()
    )
    return [d.id for d in docs]


def _refresh(user_id: str, service: str, refresh_token: str) -> dict:
    provider = OAUTH_PROVIDERS[service]
    resp = httpx.post(
        provider["token_url"],
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": provider["client_id"],
            "client_secret": provider["client_secret"],
        },
        headers={"Accept": "application/json"},
    )
    resp.raise_for_status()
    data = resp.json()

    new_access = data["access_token"]
    new_refresh = data.get("refresh_token", refresh_token)
    save_tokens(user_id, service, new_access, new_refresh, data.get("expires_in"))
    return {"access_token": new_access, "refresh_token": new_refresh}