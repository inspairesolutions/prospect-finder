"""
Database utilities for the analysis worker.
Connects to PostgreSQL using the same DATABASE_URL as Prisma.
"""

import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras


def get_connection():
    """Create a new database connection from DATABASE_URL."""
    return psycopg2.connect(
        os.environ['DATABASE_URL'],
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


@contextmanager
def get_cursor(autocommit=False):
    """Context manager that yields a cursor and handles commit/rollback."""
    conn = get_connection()
    conn.autocommit = autocommit
    try:
        with conn.cursor() as cur:
            yield cur
            if not autocommit:
                conn.commit()
    except Exception:
        if not autocommit:
            conn.rollback()
        raise
    finally:
        conn.close()
