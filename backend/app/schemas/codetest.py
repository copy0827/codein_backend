from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class LanguageRuntimePublic(BaseModel):
    language_key: str
    display_name: str
    file_extension: str
    execution_mode: str

    class Config:
        from_attributes = True


class LanguageRuntimeOut(LanguageRuntimePublic):
    docker_image: str
    command_template: str
    compile_command: Optional[str] = None
    enabled: bool


class LanguageRuntimeCreate(BaseModel):
    language_key: str
    display_name: str
    docker_image: str
    execution_mode: str = "inline"
    command_template: str
    compile_command: Optional[str] = None
    file_extension: str = ".txt"
    enabled: bool = True


class LanguageRuntimeUpdate(BaseModel):
    display_name: Optional[str] = None
    docker_image: Optional[str] = None
    execution_mode: Optional[str] = None
    command_template: Optional[str] = None
    compile_command: Optional[str] = None
    file_extension: Optional[str] = None
    enabled: Optional[bool] = None


class TestCreate(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime


class TestUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class TestOut(BaseModel):
    id: int
    title: str
    start_time: datetime
    end_time: datetime
    problem_count: int = 0
    languages: List[str] = []

    class Config:
        from_attributes = True


class ProblemCreate(BaseModel):
    title: str
    description: str
    language: str = "python"
    time_limit: int = 5
    memory_limit: int = 256
    difficulty: str = "easy"
    points: int = 100


class ProblemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    time_limit: Optional[int] = None
    memory_limit: Optional[int] = None
    difficulty: Optional[str] = None
    points: Optional[int] = None


class TestCaseCreate(BaseModel):
    input_data: str
    expected_output: str
    is_sample: bool = False
    order: int = 0


class TestCaseOut(BaseModel):
    id: int
    problem_id: int
    input_data: str
    expected_output: str
    is_sample: bool
    order: int

    class Config:
        from_attributes = True


class TestCasePublic(BaseModel):
    id: int
    input_data: str
    expected_output: Optional[str] = None
    is_sample: bool
    order: int


class ProblemOut(BaseModel):
    id: int
    test_id: int
    title: str
    description: str
    language: str
    time_limit: int
    memory_limit: int
    difficulty: str
    points: int
    is_solved: Optional[bool] = False
    participant_count: int = 0
    success_rate: float = 0.0
    sample_test_cases: List[TestCasePublic] = []

    class Config:
        from_attributes = True


class ProblemDetail(ProblemOut):
    test_cases: List[TestCaseOut] = []


class ProblemBankTestCasePublic(BaseModel):
    id: int
    input_data: str
    expected_output: Optional[str] = None
    is_sample: bool
    order: int


class ProblemBankOut(BaseModel):
    id: int
    title: str
    description: str
    level: int
    language: str
    time_limit: int
    memory_limit: int
    difficulty: str
    points: int
    is_public: bool
    sample_test_cases: List[ProblemBankTestCasePublic] = []

    class Config:
        from_attributes = True


class ProblemBankCreate(BaseModel):
    title: str
    description: str
    level: int = 1
    language: str = "python"
    time_limit: int = 5
    memory_limit: int = 256
    difficulty: str = "easy"
    points: int = 100
    is_public: bool = True


class ProblemBankUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    level: Optional[int] = None
    language: Optional[str] = None
    time_limit: Optional[int] = None
    memory_limit: Optional[int] = None
    difficulty: Optional[str] = None
    points: Optional[int] = None
    is_public: Optional[bool] = None


class ProblemBankTestCaseCreate(BaseModel):
    input_data: str
    expected_output: str
    is_sample: bool = False
    order: int = 0


class ProblemBankTestCaseUpdate(BaseModel):
    input_data: Optional[str] = None
    expected_output: Optional[str] = None
    is_sample: Optional[bool] = None
    order: Optional[int] = None


class ProblemBankTestCaseOut(BaseModel):
    id: int
    problem_id: int
    input_data: str
    expected_output: str
    is_sample: bool
    order: int

    class Config:
        from_attributes = True


class ProblemBankDetail(ProblemBankOut):
    test_cases: List[ProblemBankTestCaseOut] = []


class TestDetail(TestOut):
    problems: List[ProblemOut] = []
    all_problems_attempted: Optional[bool] = False


class TestParticipantStats(BaseModel):
    user_id: int
    user_name: Optional[str]
    student_id: Optional[str]
    total_submissions: int
    correct_count: int
    wrong_count: int

    class Config:
        from_attributes = True


class SubmissionCreate(BaseModel):
    code: str
    language: str


class PracticeSubmissionCreate(BaseModel):
    problem_id: int
    code: str
    language: str


class PracticeSubmissionResult(BaseModel):
    result: str
    test_cases_passed: int
    test_cases_total: int
    execution_time: float
    memory_used: int
    error_message: Optional[str] = None


class SubmissionOut(BaseModel):
    id: int
    problem_id: int
    user_id: int
    code: str
    language: str
    result: str
    execution_time: Optional[float]
    memory_used: Optional[int]
    test_cases_passed: int
    test_cases_total: int
    error_message: Optional[str]
    submitted_at: datetime

    class Config:
        from_attributes = True


class ProblemFromBankCreate(BaseModel):
    problem_bank_id: int
    title: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    time_limit: Optional[int] = None
    memory_limit: Optional[int] = None
    difficulty: Optional[str] = None
    points: Optional[int] = None


class ProblemFromBankResponse(BaseModel):
    problem_id: int
    test_cases_copied: int
    source_problem_bank_id: int
