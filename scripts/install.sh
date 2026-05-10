#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 --tool <tool-name>"
  echo ""
  echo "Supported tools:"
  echo "  claude-code    Install the Claude Code CLI (@anthropic-ai/claude-code)"
  exit 1
}

install_claude_code() {
  echo "Installing Claude Code CLI..."

  if ! command -v node &>/dev/null; then
    echo "Error: Node.js is required but not found. Please install Node.js first." >&2
    exit 1
  fi

  if command -v npm &>/dev/null; then
    npm install -g @anthropic-ai/claude-code
  elif command -v pnpm &>/dev/null; then
    pnpm add -g @anthropic-ai/claude-code
  else
    echo "Error: npm or pnpm is required but neither was found." >&2
    exit 1
  fi

  echo "Claude Code installed successfully."
  echo "Run 'claude --help' to get started."
}

TOOL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool)
      TOOL="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      ;;
  esac
done

if [[ -z "$TOOL" ]]; then
  echo "Error: --tool is required." >&2
  usage
fi

case "$TOOL" in
  claude-code)
    install_claude_code
    ;;
  *)
    echo "Error: Unknown tool '$TOOL'." >&2
    usage
    ;;
esac
