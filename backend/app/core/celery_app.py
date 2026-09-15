from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "dms_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Jakarta",
    enable_utc=False,
)

# Autodiscover tasks from app.tasks package
celery_app.autodiscover_tasks(["app"])

# Schedule daily backup task
celery_app.conf.beat_schedule = {
    "scheduled-backup-daily": {
        "task": "run_scheduled_backup",
        "schedule": crontab(hour=2, minute=0),  # Setiap hari jam 02:00 WIB
    },
}
