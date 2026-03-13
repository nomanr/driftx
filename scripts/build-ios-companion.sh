#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$PROJECT_ROOT/ios-companion"
PREBUILT_DIR="$IOS_DIR/prebuilt"
BUILD_DIR="$IOS_DIR/build"

echo "Building iOS companion (universal simulator)..."

rm -rf "$BUILD_DIR"

xcodebuild build-for-testing \
  -project "$IOS_DIR/DriftxCompanion.xcodeproj" \
  -scheme DriftxCompanionUITests \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath "$BUILD_DIR" \
  ARCHS="arm64 x86_64" \
  ONLY_ACTIVE_ARCH=NO \
  VALID_ARCHS="arm64 x86_64" \
  IPHONEOS_DEPLOYMENT_TARGET=16.0 \
  | tail -20

PRODUCTS_DIR="$BUILD_DIR/Build/Products"
XCTESTRUN_FILE=$(find "$PRODUCTS_DIR" -name "*.xctestrun" -maxdepth 1 | head -1)

if [ -z "$XCTESTRUN_FILE" ]; then
  echo "ERROR: No .xctestrun file found in $PRODUCTS_DIR"
  exit 1
fi

rm -rf "$PREBUILT_DIR"
mkdir -p "$PREBUILT_DIR/Debug-iphonesimulator"

cp "$XCTESTRUN_FILE" "$PREBUILT_DIR/DriftxCompanionUITests.xctestrun"
cp -R "$PRODUCTS_DIR/Debug-iphonesimulator/DriftxCompanion.app" "$PREBUILT_DIR/Debug-iphonesimulator/"
cp -R "$PRODUCTS_DIR/Debug-iphonesimulator/DriftxCompanionUITests-Runner.app" "$PREBUILT_DIR/Debug-iphonesimulator/"

XCODE_VERSION=$(xcodebuild -version | head -1)
XCODE_MAJOR=$(echo "$XCODE_VERSION" | grep -o '[0-9]*' | head -1)
SOURCE_HASH=$(find "$IOS_DIR/DriftxCompanionUITests" "$IOS_DIR/DriftxCompanion" -name "*.swift" -print0 | sort -z | xargs -0 cat | shasum -a 256 | cut -d' ' -f1)
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$PREBUILT_DIR/build-info.json" <<EOF
{
  "xcodeVersion": "$XCODE_VERSION",
  "xcodeMajor": $XCODE_MAJOR,
  "buildDate": "$BUILD_DATE",
  "sourceHash": "$SOURCE_HASH"
}
EOF

rm -rf "$BUILD_DIR"

echo ""
echo "Pre-built companion ready at: $PREBUILT_DIR"
echo "Xcode: $XCODE_VERSION"
echo "Source hash: $SOURCE_HASH"
echo ""
echo "Remember to commit ios-companion/prebuilt/ to git."
