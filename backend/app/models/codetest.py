from sqlalchemy import String, Integer, Text, ForeignKey, DateTime, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional
from app.models.base import Base

def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))


class LanguageRuntime(Base):
    __tablename__ = "language_runtimes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    language_key: Mapped[str] = mapped_column(String, unique=True)
    display_name: Mapped[str] = mapped_column(String)
    docker_image: Mapped[str] = mapped_column(String)
    execution_mode: Mapped[str] = mapped_column(String, default="inline")
    command_template: Mapped[str] = mapped_column(Text)
    compile_command: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_extension: Mapped[str] = mapped_column(String, default=".txt")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # Relationships
    problems = relationship(
        "Problem", back_populates="test", cascade="all, delete-orphan"
    )


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    test_id: Mapped[int] = mapped_column(ForeignKey("tests.id"))
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)

    # New fields for multi-language support and limits
    language: Mapped[str] = mapped_column(String, default="python")
    time_limit: Mapped[int] = mapped_column(Integer, default=5)  # seconds
    memory_limit: Mapped[int] = mapped_column(Integer, default=256)  # MB
    difficulty: Mapped[str] = mapped_column(
        String, default="easy"
    )  # easy, medium, hard
    points: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)

    source_problem_bank_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("problem_bank.id"), nullable=True
    )

    test = relationship("Test", back_populates="problems")
    test_cases = relationship(
        "TestCase", back_populates="problem", cascade="all, delete-orphan"
    )
    submissions = relationship(
        "Submission", back_populates="problem", cascade="all, delete-orphan"
    )
    source_problem_bank = relationship("ProblemBank")


class TestCase(Base):
    __tablename__ = "test_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    problem_id: Mapped[int] = mapped_column(ForeignKey("problems.id"))
    input_data: Mapped[str] = mapped_column(Text)
    expected_output: Mapped[str] = mapped_column(Text)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    order: Mapped[int] = mapped_column(Integer, default=0)
    source_problem_bank_test_case_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("problem_bank_test_cases.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)

    problem = relationship("Problem", back_populates="test_cases")
    source_problem_bank_test_case = relationship("ProblemBankTestCase")


class ProblemBank(Base):
    __tablename__ = "problem_bank"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    level: Mapped[int] = mapped_column(Integer, default=1)

    language: Mapped[str] = mapped_column(String, default="python")
    time_limit: Mapped[int] = mapped_column(Integer, default=5)
    memory_limit: Mapped[int] = mapped_column(Integer, default=256)
    difficulty: Mapped[str] = mapped_column(String, default="easy")
    points: Mapped[int] = mapped_column(Integer, default=100)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)

    # Relationships
    test_cases = relationship(
        "ProblemBankTestCase", back_populates="problem", cascade="all, delete-orphan"
    )


class ProblemBankTestCase(Base):
    __tablename__ = "problem_bank_test_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    problem_id: Mapped[int] = mapped_column(ForeignKey("problem_bank.id"))
    input_data: Mapped[str] = mapped_column(Text)
    expected_output: Mapped[str] = mapped_column(Text)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)

    # Relationship
    problem = relationship("ProblemBank", back_populates="test_cases")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    problem_id: Mapped[int] = mapped_column(ForeignKey("problems.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    code: Mapped[str] = mapped_column(Text)

    # Result: "pending", "correct", "wrong", "error", "timeout", "memory_exceeded"
    result: Mapped[str] = mapped_column(String)

    # Execution details
    language: Mapped[str] = mapped_column(String)
    execution_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    memory_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    test_cases_passed: Mapped[int] = mapped_column(Integer, default=0)
    test_cases_total: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)

    problem = relationship("Problem", back_populates="submissions")
