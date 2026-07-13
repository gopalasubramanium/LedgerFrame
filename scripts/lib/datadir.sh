#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# =============================================================================
# lf_data_dir — the ONE answer to "where is the data dir?"
#
# Before this file existed the repo had FIVE answers, and only one of them read `.env`:
#   doctor.sh / benchmark.sh   -> ${LEDGERFRAME_DATA_DIR:-/mnt/ledgerframe-data}
#   reset-demo-data.sh / start-dev.sh -> ${LEDGERFRAME_DATA_DIR:-$REPO_DIR/data}
#   update.sh                  -> sed it out of .env   (the only one that looked)
#   app/core/config.py         -> /mnt/ledgerframe-data, correctly loaded from .env
#
# The bash scripts read only the EXPORTED variable. So a user who set LEDGERFRAME_DATA_DIR in .env —
# which IS the documented contract — and then ran ./scripts/reset-demo-data.sh from a plain shell got
# that script's own fallback and operated on THE WRONG DIRECTORY. A destructive script pointed at a
# directory the user never named is not a papercut.
#
# PRECEDENCE — deliberately identical to the app's (pydantic-settings):
#   1. an exported LEDGERFRAME_DATA_DIR   (environment beats file)
#   2. LEDGERFRAME_DATA_DIR in .env       (the documented contract)
#   3. the ONE documented default below
#
# The default is pinned to `app/core/config.py`'s by a test, so the scripts and the app can never
# drift apart again — otherwise this file would just have become a sixth answer.
# =============================================================================

# The single documented default. Pinned to app/core/config.py:data_dir by
# tests/integration/test_data_dir_resolution.py — change one and that test fails.
LF_DEFAULT_DATA_DIR="/mnt/ledgerframe-data"

lf_repo_dir() {
  # The repo root, from wherever this library was sourced.
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

lf_data_dir() {
  # 1. exported wins
  if [[ -n "${LEDGERFRAME_DATA_DIR:-}" ]]; then
    printf '%s\n' "$LEDGERFRAME_DATA_DIR"
    return 0
  fi

  # 2. .env — the contract the app honours, so the scripts honour it too.
  #    (LF_DATA_DIR_IGNORE_DOT_ENV=1 skips this: it lets the test read the built-in default.)
  if [[ -z "${LF_DATA_DIR_IGNORE_DOT_ENV:-}" ]]; then
    local env_file
    env_file="$(lf_repo_dir)/.env"
    if [[ -f "$env_file" ]]; then
      local from_env
      from_env="$(sed -n 's/^[[:space:]]*LEDGERFRAME_DATA_DIR[[:space:]]*=[[:space:]]*//p' "$env_file" \
                  | tail -1 | tr -d '"'"'"'' | sed 's/[[:space:]]*$//')"
      if [[ -n "$from_env" ]]; then
        printf '%s\n' "$from_env"
        return 0
      fi
    fi
  fi

  # 3. the one documented default
  printf '%s\n' "$LF_DEFAULT_DATA_DIR"
}
