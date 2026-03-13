#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PREBUILT_DIR="$PROJECT_ROOT/ios-companion/prebuilt"
IOS_DIR="$PROJECT_ROOT/ios-companion"

ERRORS=0

check() {
  if [ ! -e "$1" ]; then
    echo "MISSING: $1"
    ERRORS=$((ERRORS + 1))
  fi
}

check "$PREBUILT_DIR/build-info.json"
check "$PREBUILT_DIR/DriftxCompanionUITests.xctestrun"
check "$PREBUILT_DIR/Debug-iphonesimulator/DriftxCompanion.app"
check "$PREBUILT_DIR/Debug-iphonesimulator/DriftxCompanionUITests-Runner.app"

if [ -f "$PREBUILT_DIR/build-info.json" ]; then
  if ! python3 -c "import json; json.load(open('$PREBUILT_DIR/build-info.json'))" 2>/dev/null; then
    echo "INVALID: build-info.json is not valid JSON"
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ -f "$PREBUILT_DIR/build-info.json" ]; then
  CURRENT_HASH=$(find "$IOS_DIR/DriftxCompanionUITests" "$IOS_DIR/DriftxCompanion" -name "*.swift" -print0 | sort -z | xargs -0 cat | shasum -a 256 | cut -d' ' -f1)
  STORED_HASH=$(python3 -c "import json; print(json.load(open('$PREBUILT_DIR/build-info.json')).get('sourceHash',''))")
  if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
    echo "STALE: Swift source has changed since last build. Run: npm run build:ios"
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "Pre-built companion validation failed ($ERRORS errors)."
  echo "Run: npm run build:ios"
  exit 1
fi

echo "Pre-built companion validated successfully."
