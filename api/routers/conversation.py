import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.models import ConversationStep, JDNoteType, MessageRole
from db.neon import get_db
from routers.auth import get_current_user
from services.ai_service import AIService, get_ai_service
from services.conversation_service import ConversationService

router = APIRouter()


# ── Response schemas ──────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class JDSummary(BaseModel):
    id: uuid.UUID
    company_name: str | None
    role_title: str | None
    labels: dict | None

    model_config = {"from_attributes": True}


class ConversationListItem(BaseModel):
    id: uuid.UUID
    jd: JDSummary
    current_step: ConversationStep
    last_message: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetail(BaseModel):
    id: uuid.UUID
    jd: JDSummary
    current_step: ConversationStep
    state: dict
    messages: list[MessageResponse]
    updated_at: datetime

    model_config = {"from_attributes": True}


class JDNoteResponse(BaseModel):
    id: uuid.UUID
    note_type: JDNoteType
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Conversations ─────────────────────────────────────────────────────────

class CreateConversationRequest(BaseModel):
    jd_id: uuid.UUID


@router.post(
    "/api/conversations",
    response_model=ConversationDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    body: CreateConversationRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = ConversationService(db=db, ai=ai)
    conv = service.create_conversation(jd_id=body.jd_id, clerk_user_id=clerk_user_id)
    return _to_detail(conv)


@router.get("/api/conversations", response_model=list[ConversationListItem])
def list_conversations(
    limit: int = 50,
    offset: int = 0,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = ConversationService(db=db, ai=ai)
    conversations = service.list_conversations(clerk_user_id)
    paginated = conversations[offset : offset + limit]
    return [_to_list_item(c) for c in paginated]


@router.get("/api/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = ConversationService(db=db, ai=ai)
    conv = service.get_conversation(conversation_id, clerk_user_id)
    return _to_detail(conv)


class SendMessageRequest(BaseModel):
    content: str


@router.post(
    "/api/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    conversation_id: uuid.UUID,
    body: SendMessageRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = ConversationService(db=db, ai=ai)
    msg = service.send_message(conversation_id, clerk_user_id, content=body.content)
    return msg


# ── JD Notes ──────────────────────────────────────────────────────────────

class AddJDNoteRequest(BaseModel):
    note_type: JDNoteType
    content: str


@router.post(
    "/api/jds/{jd_id}/notes",
    response_model=JDNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_jd_note(
    jd_id: uuid.UUID,
    body: AddJDNoteRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = ConversationService(db=db, ai=ai)
    note = service.add_jd_note(
        jd_id=jd_id,
        clerk_user_id=clerk_user_id,
        note_type=body.note_type,
        content=body.content,
    )
    return note


@router.get("/api/jds/{jd_id}/notes", response_model=list[JDNoteResponse])
def list_jd_notes(
    jd_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = ConversationService(db=db, ai=ai)
    return service.list_jd_notes(jd_id, clerk_user_id)


@router.delete("/api/jds/{jd_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_jd_note(
    jd_id: uuid.UUID,
    note_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = ConversationService(db=db, ai=ai)
    service.delete_jd_note(note_id, clerk_user_id)


# ── Serialization helpers ─────────────────────────────────────────────────

def _to_list_item(conv) -> ConversationListItem:
    last_msg = conv.messages[-1].content if conv.messages else None
    return ConversationListItem(
        id=conv.id,
        jd=JDSummary(
            id=conv.jd.id,
            company_name=conv.jd.company_name,
            role_title=conv.jd.role_title,
            labels=conv.jd.labels,
        ),
        current_step=conv.current_step,
        last_message=last_msg,
        updated_at=conv.updated_at,
    )


def _to_detail(conv) -> ConversationDetail:
    return ConversationDetail(
        id=conv.id,
        jd=JDSummary(
            id=conv.jd.id,
            company_name=conv.jd.company_name,
            role_title=conv.jd.role_title,
            labels=conv.jd.labels,
        ),
        current_step=conv.current_step,
        state=conv.state or {},
        messages=[
            MessageResponse(
                id=m.id,
                role=m.role,
                content=m.content,
                created_at=m.created_at,
            )
            for m in conv.messages
        ],
        updated_at=conv.updated_at,
    )
