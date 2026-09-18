import sqlite3
import time
import httpx
from contextlib import contextmanager
from auth.config import OAUTH_PROVIDERS

DB_PATH = "connections.db"


def init_db():
    with _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS connections (
                user_id TEXT NOT NULL,
                service TEXT NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                expires_at REAL,
                PRIMARY KEY (user_id, service)
            )
        """)


@contextmanager
def _conn():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def save_tokens(user_id: str, service: str, access_token: str, refresh_token: str | None, expires_in: int | None):
    expires_at = time.time() + expires_in if expires_in else None
    with _conn() as c:
        c.execute(
            """INSERT INTO connections (user_id, service, access_token, refresh_token, expires_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(user_id, service) DO UPDATE SET
                 access_token=excluded.access_token,
                 refresh_token=excluded.refresh_token,
                 expires_at=excluded.expires_at""",
            (user_id, service, access_token, refresh_token, expires_at),
        )


def _load_tokens(user_id: str, service: str) -> dict | None:
    with _conn() as c:
        row = c.execute(
            "SELECT access_token, refresh_token, expires_at FROM connections WHERE user_id=? AND service=?",
            (user_id, service),
        ).fetchone()
    if not row:
        return None
    return {"access_token": row[0], "refresh_token": row[1], "expires_at": row[2]}


def get_valid_token(user_id: str, service: str) -> str:
    """
    Returns a usable access_token for this user+service, refreshing it
    first if it has expired. Raises if the user never connected this service.
    """
    tokens = _load_tokens(user_id, service)
    if not tokens:
        raise ValueError(f"User '{user_id}' has not connected '{service}'. Ask them to connect it first.")

    if tokens["expires_at"] and time.time() > tokens["expires_at"] - 60:
        tokens = _refresh(user_id, service, tokens["refresh_token"])

    return tokens["access_token"]

def get_connected_services(user_id: str) -> list[str]:
    """Returns the list of service names this user has connected (e.g. ['notion', 'slack'])."""
    with _conn() as c:
        rows = c.execute("SELECT service FROM connections WHERE user_id=?", (user_id,)).fetchall()
    return [r[0] for r in rows]


def _refresh(user_id: str, service: str, refresh_token: str) -> dict:
    provider = OAUTH_PROVIDERS[service]
    resp = httpx.post(provider["token_url"], data={
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": provider["client_id"],
        "client_secret": provider["client_secret"],
    })
    resp.raise_for_status()
    data = resp.json()
    new_access = data["access_token"]
    new_refresh = data.get("refresh_token", refresh_token)  
    expires_in = data.get("expires_in")
    save_tokens(user_id, service, new_access, new_refresh, expires_in)
    return {"access_token": new_access, "refresh_token": new_refresh}