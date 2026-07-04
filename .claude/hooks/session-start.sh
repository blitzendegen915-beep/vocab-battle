#!/bin/bash
# SessionStart hook: best-effort setup of optional developer tooling
# (RTK token-saving CLI proxy + the "superpowers" plugin).
#
# Intentionally does NOT use `set -e`: every step is best-effort so a
# network hiccup or a locked-down sandbox degrades to "tool unavailable"
# instead of blocking the session from starting.
set -uo pipefail

log() { echo "[session-start] $*" >&2; }

# Make sure ~/.local/bin (where we install rtk) is on PATH for the rest of
# this session, not just this script's own subshell.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
fi
export PATH="$HOME/.local/bin:$PATH"

setup_rtk() {
  if command -v rtk >/dev/null 2>&1; then
    log "rtk already installed ($(rtk --version 2>/dev/null))"
  else
    log "rtk not found — attempting install"
    mkdir -p "$HOME/.local/bin"
    installed=false

    # Fast path: prebuilt release binary. Works when the environment's
    # network policy allows github.com release-asset downloads.
    if command -v curl >/dev/null 2>&1; then
      if timeout 20 curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh 2>/dev/null \
         | timeout 60 sh >/dev/null 2>&1; then
        installed=true
        log "rtk installed via install.sh (prebuilt binary)"
      fi
    fi

    # Fallback: build from source. Needed in sandboxes that block
    # github.com/*/releases/download/* but still allow `git clone` over
    # https (observed in Claude Code's remote sandbox: raw.githubusercontent.com
    # and git-over-https work, but github.com web/release pages 403).
    if [ "$installed" = false ] && command -v cargo >/dev/null 2>&1; then
      log "prebuilt binary unavailable — building rtk from source (first run only, ~3-4 min)"
      src_dir="$(mktemp -d)"
      if timeout 60 git clone --depth 1 https://github.com/rtk-ai/rtk.git "$src_dir" >/dev/null 2>&1; then
        if (cd "$src_dir" && timeout 480 cargo build --release >/dev/null 2>&1); then
          if cp "$src_dir/target/release/rtk" "$HOME/.local/bin/rtk" && chmod +x "$HOME/.local/bin/rtk"; then
            installed=true
            log "rtk built from source and installed"
          fi
        fi
      fi
      rm -rf "$src_dir"
    fi

    if [ "$installed" = false ]; then
      log "rtk install failed (no network access, or cargo unavailable) — continuing without it"
      return
    fi
  fi

  # Register the Claude Code hook (idempotent; rtk itself checks and skips
  # if already present). Telemetry consent prompt auto-skips on non-tty stdin.
  if ! grep -q '"rtk hook claude"' "$HOME/.claude/settings.json" 2>/dev/null; then
    timeout 15 rtk init -g --auto-patch --no-trust-filters </dev/null >/dev/null 2>&1 \
      || log "rtk init -g failed (non-fatal)"
  fi
}

setup_superpowers() {
  if ! command -v claude >/dev/null 2>&1; then
    log "claude CLI not on PATH — skipping superpowers plugin setup"
    return
  fi
  if claude plugin list 2>/dev/null | grep -q "superpowers@superpowers-marketplace"; then
    log "superpowers plugin already installed"
    return
  fi
  log "installing superpowers plugin"
  if timeout 60 claude plugin marketplace add obra/superpowers-marketplace >/dev/null 2>&1; then
    timeout 30 claude plugin install superpowers@superpowers-marketplace >/dev/null 2>&1 \
      || log "superpowers plugin install failed (non-fatal)"
  else
    log "superpowers marketplace add failed (non-fatal, likely no network access)"
  fi
}

setup_rtk
setup_superpowers

log "session-start setup complete"
exit 0
