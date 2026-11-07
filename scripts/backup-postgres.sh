#!/usr/bin/env bash
# ============================================================================
# Postgres daily backup - Logistics Platform
# ============================================================================
#
# Dumps the production database to a timestamped, gzipped file and keeps the
# most-recent 30 days. Designed to run as a daily cron job:
#
#   # /etc/cron.d/logistics-backup
#   0 2 * * *  root  /opt/logistics/scripts/backup-postgres.sh \
#                       >> /var/log/logistics-backup.log 2>&1
#
# Required environment (typically sourced from the same .env as the app):
#   DATABASE_URL                 postgres://user:pass@host:port/db
#   BACKUP_DIR                   /var/backups/logistics              (default)
#   BACKUP_RETENTION_DAYS        30                               (default)
#   BACKUP_S3_BUCKET             empty → local only; set to s3://bucket/path
#                                to also upload (requires `aws` CLI configured)
#
# Exit codes:
#   0   success
#   1   pg_dump failed
#   2   missing DATABASE_URL
#   3   upload failed (when BACKUP_S3_BUCKET is set)
#
# Manual restore (read-only practice - always test first):
#   gunzip -c /var/backups/logistics/logistics-YYYYMMDD-HHMMSS.sql.gz \
#       | psql "$DATABASE_URL"
# ============================================================================

set -euo pipefail

# ---- config ----------------------------------------------------------------
BACKUP_DIR="${BACKUP_DIR:-/var/backups/logistics}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"

TS="$(date -u +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/logistics-${TS}.sql.gz"

echo "[$(date -u -Iseconds)] backup start → $FILE"

# `pg_dump` honors DATABASE_URL directly. `--no-owner --no-acl` keeps the
# dump portable across hosts; `--clean --if-exists` lets a fresh restore
# overwrite an existing schema cleanly.
if ! pg_dump \
      --no-owner --no-acl \
      --clean --if-exists \
      --format=plain \
      "$DATABASE_URL" \
      | gzip -9 > "$FILE"; then
  echo "ERROR: pg_dump failed" >&2
  rm -f "$FILE"
  exit 1
fi

SIZE="$(du -h "$FILE" | cut -f1)"
echo "[$(date -u -Iseconds)] backup OK ($SIZE)"

# ---- offsite upload (optional) ---------------------------------------------
if [[ -n "$S3_BUCKET" ]]; then
  echo "[$(date -u -Iseconds)] uploading to $S3_BUCKET …"
  if ! aws s3 cp "$FILE" "${S3_BUCKET%/}/logistics-${TS}.sql.gz" --no-progress; then
    echo "ERROR: S3 upload failed" >&2
    exit 3
  fi
  echo "[$(date -u -Iseconds)] upload OK"
fi

# ---- retention -------------------------------------------------------------
# Local: delete files older than RETENTION_DAYS. S3 retention is configured
# via the bucket's lifecycle policy (which is more reliable than this script
# and survives missed runs), so we don't try to manage it here.
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -name 'logistics-*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete | wc -l)"
echo "[$(date -u -Iseconds)] retention sweep removed $DELETED file(s) older than $RETENTION_DAYS days"

echo "[$(date -u -Iseconds)] backup done"
