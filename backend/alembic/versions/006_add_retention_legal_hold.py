"""Add Legal Hold & Retention Policy tables and columns

Revision ID: 006_add_retention_legal_hold
Revises: 005_add_sindas_sync_log
Create Date: 2026-08-27 09:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "006_add_retention_legal_hold"
down_revision: Union[str, None] = "ecca60d84439"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tabel kebijakan retensi
    op.create_table(
        "retention_policy",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sekolah_id", sa.Integer(), sa.ForeignKey("sekolah.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jenis_dok", sa.String(100), nullable=False),
        sa.Column("durasi_hari", sa.Integer(), nullable=False, server_default="1825"),
        sa.Column("aksi_setelah", sa.String(20), nullable=False, server_default="archive"),
        sa.Column("notif_hari_sebelum", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("admin.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sekolah_id", "jenis_dok", name="uq_retention_sekolah_jenis"),
        sa.CheckConstraint("aksi_setelah IN ('archive', 'delete', 'notify_only')", name="ck_retention_aksi_setelah"),
        comment="Kebijakan retensi dokumen per jenis per sekolah",
    )
    op.create_index("ix_retention_policy_sekolah_id", "retention_policy", ["sekolah_id"])
    op.create_index("ix_retention_policy_jenis_dok", "retention_policy", ["jenis_dok"])

    # 2. Tabel log aksi retensi
    op.create_table(
        "retention_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("dokumen_id", sa.Integer(), sa.ForeignKey("dokumen.id", ondelete="SET NULL"), nullable=True),
        sa.Column("aksi", sa.String(30), nullable=False),
        sa.Column("alasan", sa.Text(), nullable=True),
        sa.Column("dilakukan_oleh", sa.Integer(), sa.ForeignKey("admin.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="Log histori setiap aksi retensi (immutable)",
    )
    op.create_index("ix_retention_log_dokumen_id", "retention_log", ["dokumen_id"])
    op.create_index("ix_retention_log_created_at", "retention_log", ["created_at"])

    # 3. Kolom Legal Hold & Retention di tabel dokumen
    op.add_column("dokumen", sa.Column("legal_hold", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("dokumen", sa.Column("legal_hold_by", sa.Integer(), sa.ForeignKey("admin.id", ondelete="SET NULL"), nullable=True))
    op.add_column("dokumen", sa.Column("legal_hold_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("dokumen", sa.Column("legal_hold_alasan", sa.Text(), nullable=True))
    op.add_column("dokumen", sa.Column("retention_expires_at", sa.DateTime(timezone=True), nullable=True))

    # 4. Partial indexes
    op.create_index("idx_dokumen_retention_expires", "dokumen", ["retention_expires_at"],
                    postgresql_where=sa.text("legal_hold = false"))
    op.create_index("idx_dokumen_legal_hold_active", "dokumen", ["legal_hold"],
                    postgresql_where=sa.text("legal_hold = true"))


def downgrade() -> None:
    op.drop_index("idx_dokumen_legal_hold_active", table_name="dokumen")
    op.drop_index("idx_dokumen_retention_expires", table_name="dokumen")
    op.drop_column("dokumen", "retention_expires_at")
    op.drop_column("dokumen", "legal_hold_alasan")
    op.drop_column("dokumen", "legal_hold_at")
    op.drop_column("dokumen", "legal_hold_by")
    op.drop_column("dokumen", "legal_hold")
    op.drop_index("ix_retention_log_created_at", table_name="retention_log")
    op.drop_index("ix_retention_log_dokumen_id", table_name="retention_log")
    op.drop_table("retention_log")
    op.drop_index("ix_retention_policy_jenis_dok", table_name="retention_policy")
    op.drop_index("ix_retention_policy_sekolah_id", table_name="retention_policy")
    op.drop_table("retention_policy")
