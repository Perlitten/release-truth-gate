#!/bin/sh
set -eu

umask 077
project_dir="${RELEASE_TRUTH_DIR:-/opt/release-truth-gate}"
backup_dir="${RELEASE_TRUTH_BACKUP_DIR:-/var/backups/release-truth-gate}"
retention_days="${RELEASE_TRUTH_BACKUP_RETENTION_DAYS:-14}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$backup_dir"
cd "$project_dir"
docker compose -f compose.production.yaml exec -T postgres \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$backup_dir/release-truth-$timestamp.dump"
find "$backup_dir" -type f -name 'release-truth-*.dump' -mtime "+$retention_days" -delete
