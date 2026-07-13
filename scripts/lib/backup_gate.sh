#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# =============================================================================
# lf_require_fresh_backup — no migration without a way back.
#
# update.sh used to read:
#     ./scripts/backup.sh && log "backup created" || log "backup skipped"
# It TRIED to back up, SWALLOWED the failure, and MIGRATED ANYWAY. "backup skipped" went into a log
# nobody reads, and a forward-only migration then ran against un-backed-up data.
#
# RD-6 makes the lifecycle forward-only with NO supported downgrade — so the backup is not a nicety,
# it is the ENTIRE rollback story. A migration without one is a migration with no way back.
#
# Returns non-zero unless a backup exists that is FRESH (this run's, not last month's). The user may
# skip it — but only by saying so: --no-backup / LF_NO_BACKUP=1.
# =============================================================================

# How new a backup must be to count as "this update's" (seconds).
LF_BACKUP_MAX_AGE="${LF_BACKUP_MAX_AGE:-3600}"

lf_backups_dir() {
  # Test seam; otherwise derived from the ONE data-dir answer (scripts/lib/datadir.sh).
  if [[ -n "${LF_BACKUPS_DIR:-}" ]]; then
    printf '%s\n' "$LF_BACKUPS_DIR"
    return 0
  fi
  local lib
  lib="$(dirname "${BASH_SOURCE[0]}")/datadir.sh"
  # shellcheck source=datadir.sh
  [[ -f "$lib" ]] && source "$lib"
  printf '%s\n' "$(lf_data_dir)/backups"
}

lf_require_fresh_backup() {
  if [[ -n "${LF_NO_BACKUP:-}" ]]; then
    echo "[update] --no-backup given: proceeding WITHOUT a backup. Forward-only migrations have no downgrade path." >&2
    return 0
  fi

  local dir newest age
  dir="$(lf_backups_dir)"

  if [[ ! -d "$dir" ]]; then
    echo "[update] ABORT: no backups directory ($dir). Run ./scripts/backup.sh first, or pass --no-backup." >&2
    return 1
  fi

  # The newest backup file, by mtime.
  newest="$(find "$dir" -maxdepth 1 -type f \( -name '*.db' -o -name '*.age' -o -name '*.tar*' \) \
            -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"

  if [[ -z "$newest" ]]; then
    echo "[update] ABORT: no backup found in $dir. Run ./scripts/backup.sh first, or pass --no-backup." >&2
    return 1
  fi

  age=$(( $(date +%s) - $(stat -c %Y "$newest") ))
  if (( age > LF_BACKUP_MAX_AGE )); then
    echo "[update] ABORT: the newest backup is $((age / 60))m old ($newest)." >&2
    echo "[update] A stale backup does not protect the migration you are about to run." >&2
    echo "[update] Run ./scripts/backup.sh, or pass --no-backup to proceed anyway." >&2
    return 1
  fi

  echo "[update] fresh backup verified: $newest"
  return 0
}
