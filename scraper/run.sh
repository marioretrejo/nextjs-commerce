#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Copy .env if it doesn't exist
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "Created .env from .env.example — edit credentials if needed."
fi

# Install dependencies
echo "Installing dependencies…"
pip install -r requirements.txt --quiet

# Create data directory
mkdir -p data

echo "Starting scraper…"
python3 scraper.py
