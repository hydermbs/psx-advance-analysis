import os
from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./watchlist.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

def init_db_tables():
    SQLModel.metadata.create_all(engine)
    from sqlalchemy import text
    with Session(engine) as session:
        try:
            session.execute(text("ALTER TABLE watchlist_items ADD COLUMN quantity INTEGER DEFAULT NULL"))
            session.commit()
        except Exception:
            pass

def get_db_session():
    with Session(engine) as session:
        yield session
