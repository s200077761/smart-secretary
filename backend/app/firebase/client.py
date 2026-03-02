"""
Firebase Admin SDK helpers.

Wraps Firestore operations for chat history persistence
and Firebase Auth token verification.
"""

import logging
from typing import Optional
from datetime import datetime

import firebase_admin
from firebase_admin import firestore, auth

logger = logging.getLogger(__name__)


def _db() -> firestore.Client:
    return firestore.client()


# ── Auth ──────────────────────────────────────────────────────────────────────

def verify_token(id_token: str) -> Optional[dict]:
    """Verify a Firebase ID token. Returns the decoded claims or None."""
    try:
        return auth.verify_id_token(id_token)
    except Exception as exc:
        logger.warning("Token verification failed: %s", exc)
        return None


# ── Chat history ──────────────────────────────────────────────────────────────

def save_message(
    user_id: str,
    session_id: str,
    role: str,
    content: str,
    message_id: Optional[str] = None,
) -> str:
    import uuid
    msg_id = message_id or str(uuid.uuid4())
    _db().collection("users").document(user_id) \
        .collection("sessions").document(session_id) \
        .collection("messages").document(msg_id) \
        .set({
            "id": msg_id,
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        })
    return msg_id


def get_messages(user_id: str, session_id: str) -> list[dict]:
    docs = (
        _db().collection("users").document(user_id)
        .collection("sessions").document(session_id)
        .collection("messages")
        .order_by("timestamp")
        .get()
    )
    return [doc.to_dict() for doc in docs]


def list_sessions(user_id: str) -> list[dict]:
    docs = (
        _db().collection("users").document(user_id)
        .collection("sessions")
        .order_by("updated_at", direction=firestore.Query.DESCENDING)
        .limit(50)
        .get()
    )
    return [doc.to_dict() for doc in docs]


def upsert_session(user_id: str, session_id: str, title: str = "") -> None:
    _db().collection("users").document(user_id) \
        .collection("sessions").document(session_id) \
        .set({
            "id": session_id,
            "title": title,
            "updated_at": datetime.utcnow().isoformat(),
        }, merge=True)
