#!/usr/bin/env bash
# Rebuilds LearnLoop-How-It-Works.pdf from guide.html (needs Google Chrome).
# Screenshots live in screens/ (originals) and build/screens/ (cropped, used by the guide).
cd "$(dirname "$0")"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --no-pdf-header-footer --allow-file-access-from-files --virtual-time-budget=8000 \
  --print-to-pdf=LearnLoop-How-It-Works.pdf "file://$PWD/guide.html"
