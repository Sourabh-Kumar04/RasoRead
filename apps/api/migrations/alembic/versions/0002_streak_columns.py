"""Add streak columns to users table

Revision ID: 0002_streak
Revises: 0001_initial
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_streak"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("streak_days",            sa.Integer(),                          nullable=True, server_default="0"))
    op.add_column("users", sa.Column("streak_last_date",       sa.DateTime(timezone=True),            nullable=True))
    op.add_column("users", sa.Column("longest_streak",         sa.Integer(),                          nullable=True, server_default="0"))
    op.add_column("users", sa.Column("total_listening_minutes",sa.Integer(),                          nullable=True, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "total_listening_minutes")
    op.drop_column("users", "longest_streak")
    op.drop_column("users", "streak_last_date")
    op.drop_column("users", "streak_days")
