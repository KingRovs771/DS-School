"""tahun_ajaran per sekolah — reset & isolasi per sekolah

Revision ID: 007_tahun_ajaran_per_sekolah
Revises: db16f4c7afb3
Create Date: 2026-08-29 14:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '007_tahun_ajaran_per_sekolah'
down_revision: Union[str, None] = 'db16f4c7afb3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. RESET: hapus semua data tahun ajaran lama (global) ─────────────────
    op.execute("TRUNCATE TABLE tahun_ajaran RESTART IDENTITY CASCADE")

    # ── 2. Drop constraint & index global ──────────────────────────────────────
    # Unique constraint on `tahun` saja (global) harus dihapus
    op.execute("ALTER TABLE tahun_ajaran DROP CONSTRAINT IF EXISTS tahun_ajaran_tahun_key")
    op.execute("DROP INDEX IF EXISTS ix_tahun_ajaran_tahun")

    # ── 3. Tambah kolom sekolah_id FK → sekolah.id ────────────────────────────
    op.add_column(
        "tahun_ajaran",
        sa.Column(
            "sekolah_id",
            sa.Integer(),
            sa.ForeignKey("sekolah.id", ondelete="CASCADE"),
            nullable=False,
            comment="FK ke sekolah pemilik tahun ajaran",
        ),
    )

    # ── 4. Constraint unik per sekolah: (sekolah_id, tahun) ───────────────────
    op.create_unique_constraint(
        "uq_tahun_ajaran_sekolah_tahun",
        "tahun_ajaran",
        ["sekolah_id", "tahun"],
    )

    # ── 5. Indexes untuk query per sekolah ────────────────────────────────────
    op.create_index("ix_tahun_ajaran_sekolah_id", "tahun_ajaran", ["sekolah_id"], unique=False)
    op.create_index("ix_tahun_ajaran_tahun", "tahun_ajaran", ["tahun"], unique=False)
    # Index partial untuk default per sekolah (opsional, untuk performa)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tahun_ajaran_default_per_sekolah
        ON tahun_ajaran (sekolah_id) WHERE is_default = true
    """)


def downgrade() -> None:
    # Hapus index partial default
    op.execute("DROP INDEX IF EXISTS uq_tahun_ajaran_default_per_sekolah")
    op.drop_index("ix_tahun_ajaran_tahun", table_name="tahun_ajaran")
    op.drop_index("ix_tahun_ajaran_sekolah_id", table_name="tahun_ajaran")
    op.drop_constraint("uq_tahun_ajaran_sekolah_tahun", "tahun_ajaran", type_="unique")
    op.drop_column("tahun_ajaran", "sekolah_id")
    # Kembalikan unique global & index
    op.create_index("ix_tahun_ajaran_tahun", "tahun_ajaran", ["tahun"], unique=False)
    op.create_unique_constraint("tahun_ajaran_tahun_key", "tahun_ajaran", ["tahun"])
