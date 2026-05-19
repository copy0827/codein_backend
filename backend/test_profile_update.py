import asyncio
from sqlalchemy import select
from app.db.session import async_session
from app.models.user import User
from app.schemas.user import UserProfileUpdate

async def test():
    # just parse the schema
    try:
        data = UserProfileUpdate(
            name="Test User",
            student_id="test1234",
            major="Test Major",
            generation="1.5기"
        )
        print("Schema Validation Success:", data.model_dump(exclude_unset=True))
    except Exception as e:
        print("Schema Validation Error:", str(e))

if __name__ == "__main__":
    asyncio.run(test())
