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

# Schedule periodic check for automatic backup (every 60 seconds)
celery_app.conf.beat_schedule = {
    "check-scheduled-backup-periodic": {
        "task": "check_and_run_scheduled_backup",
        "schedule": 60.0,  # Memeriksa jadwal setiap 60 detik
    },
}
