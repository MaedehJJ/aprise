from datetime import datetime
import enum
from typing import Optional, TypedDict
import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func

OPENAI_EMBEDDING_SMALL_DIM = 1536


class CompanySize(str, enum.Enum):
    STARTUP = "startup"
    SCALEUP = "scaleup"
    ENTERPRISE = "enterprise"


class DocumentKind(str, enum.Enum):
    RESUME = "resume"
    LINKEDIN = "linkedin"
    OTHER = "other"


class ChunkType(str, enum.Enum):
    EXPERIENCE = "EXPERIENCE"
    EDUCATION = "EDUCATION"
    SKILLS_SUMMARY = "SKILLS_SUMMARY"
    PROJECTS = "PROJECTS"
    LANGUAGES = "LANGUAGES"
    OTHER = "OTHER"
    WAR_STORY = "WAR_STORY"
    PREFERENCE = "PREFERENCE"


class ApplicationStatus(str, enum.Enum):
    APPLIED = "applied"
    SCREENING = "screening"
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    OFFER = "offer"
    REJECTED = "rejected"


class ConversationStep(str, enum.Enum):
    JD_PARSING = "jd_parsing"
    GAP_DETECTION = "gap_detection"
    GAP_CONVERSATION = "gap_conversation"
    RESUME_GENERATION = "resume_generation"
    DONE = "done"


class JDNoteType(str, enum.Enum):
    NOTE = "NOTE"
    WAR_STORY = "WAR_STORY"
    WORRY = "WORRY"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"


class JDLabels(TypedDict):
    company_size: str  # CompanySize value
    role_focus: str
    tech_depth: str
    domain: str


class ParsedRequirements(TypedDict):
    required_skills: list[str]
    nice_to_have: list[str]
    years_required: Optional[int]
    responsibilities: list[str]
    language_requirements: list[str]
    visa_sponsorship: Optional[bool]
    perks: list[str]


class ConversationState(TypedDict):
    gaps: list[str]
    questions_asked: list[str]
    answers: list[str]
    questions_remaining: int


class ResumeContent(TypedDict):
    summary: str
    experience: list[dict]
    skills: list[str]


class Base(DeclarativeBase):
    pass


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    clerk_user_id: Mapped[str] = mapped_column(
        String, unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    target_roles: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    preferred_company_size: Mapped[CompanySize | None] = mapped_column(
        Enum(CompanySize), nullable=True
    )
    years_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    memories: Mapped[list["Memory"]] = relationship(back_populates="profile")
    jds: Mapped[list["JD"]] = relationship(back_populates="profile")
    documents: Mapped[list["Document"]] = relationship(back_populates="profile")


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list] = mapped_column(
        Vector(OPENAI_EMBEDDING_SMALL_DIM), nullable=False
    )
    chunk_type: Mapped[ChunkType] = mapped_column(Enum(ChunkType), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    profile: Mapped["Profile"] = relationship(back_populates="memories")


class JD(Base):
    __tablename__ = "jds"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    company_name: Mapped[str | None] = mapped_column(String, nullable=True)
    role_title: Mapped[str | None] = mapped_column(String, nullable=True)
    parsed_requirements: Mapped[ParsedRequirements | None] = mapped_column(
        JSONB, nullable=True
    )
    labels: Mapped[JDLabels | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    profile: Mapped["Profile"] = relationship(back_populates="jds")
    jd_memories: Mapped[list["JDMemory"]] = relationship(back_populates="jd")
    conversation: Mapped["Conversation | None"] = relationship(back_populates="jd")
    resumes: Mapped[list["Resume"]] = relationship(back_populates="jd")
    notes: Mapped[list["JDNote"]] = relationship(back_populates="jd")


class JDMemory(Base):
    __tablename__ = "jd_memories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    jd_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jds.id"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list] = mapped_column(
        Vector(OPENAI_EMBEDDING_SMALL_DIM), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    jd: Mapped["JD"] = relationship(back_populates="jd_memories")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    jd_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jds.id"), unique=True, nullable=False
    )
    state: Mapped[ConversationState] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    current_step: Mapped[ConversationStep] = mapped_column(
        Enum(ConversationStep), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    jd: Mapped["JD"] = relationship(back_populates="conversation")
    messages: Mapped[list["ConversationMessage"]] = relationship(
        back_populates="conversation", order_by="ConversationMessage.created_at"
    )


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    jd_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jds.id"), nullable=False
    )
    content: Mapped[ResumeContent | None] = mapped_column(JSONB, nullable=True)
    labels: Mapped[JDLabels | None] = mapped_column(JSONB, nullable=True)
    docx_content: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    is_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    jd: Mapped["JD"] = relationship(back_populates="resumes")
    application: Mapped["Application | None"] = relationship(back_populates="resume")


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    jd_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jds.id"), nullable=False
    )
    resume_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resumes.id"), nullable=True
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus), nullable=False, default=ApplicationStatus.APPLIED
    )
    company_name: Mapped[str | None] = mapped_column(String, nullable=True)
    role_title: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    resume: Mapped["Resume | None"] = relationship(back_populates="application")


class JDNote(Base):
    __tablename__ = "jd_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    jd_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jds.id"), nullable=False
    )
    note_type: Mapped[JDNoteType] = mapped_column(Enum(JDNoteType), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    jd: Mapped["JD"] = relationship(back_populates="notes")


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False
    )
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[DocumentKind] = mapped_column(
        Enum(DocumentKind, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    memories_extracted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    profile: Mapped["Profile"] = relationship(back_populates="documents")
