import sqlite3

from sqlmodel import SQLModel, create_engine, Session

sqlite_file_name = "app.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _migrate_user_table()
    _migrate_task_table()


def _migrate_user_table():
    # Keep existing local DB usable after schema changes without wiping data.
    with sqlite3.connect(sqlite_file_name) as conn:
        cursor = conn.execute("PRAGMA table_info(user)")
        existing_columns = {row[1] for row in cursor.fetchall()}

        if "email" not in existing_columns:
            conn.execute("ALTER TABLE user ADD COLUMN email TEXT")
        if "password_hash" not in existing_columns:
            conn.execute("ALTER TABLE user ADD COLUMN password_hash TEXT")
        conn.commit()


def _migrate_task_table():
    # Preserve task progress across restarts by adding a status column.
    with sqlite3.connect(sqlite_file_name) as conn:
        cursor = conn.execute("PRAGMA table_info(task)")
        existing_columns = {row[1] for row in cursor.fetchall()}

        if "status" not in existing_columns:
            conn.execute("ALTER TABLE task ADD COLUMN status TEXT")
            conn.execute("UPDATE task SET status = CASE WHEN is_completed = 1 THEN 'DONE' ELSE 'TODO' END WHERE status IS NULL")
        else:
            conn.execute("UPDATE task SET status = CASE WHEN is_completed = 1 THEN 'DONE' ELSE COALESCE(status, 'TODO') END")
        conn.commit()

def get_session():
    with Session(engine) as session:
        yield session