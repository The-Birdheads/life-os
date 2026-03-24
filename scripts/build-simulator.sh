#!/bin/bash
set -e

SIMULATOR_NAME="iPhone 17"
SIMULATOR_OS="26.3.1"
APP_OUTPUT="ios/build/Build/Products/Debug-iphonesimulator/App.app"

echo "=== Capacitor ビルド & iOS 同期 ==="
npm run build
npx cap sync ios

echo "=== iOS シミュレータ向けビルド ==="
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,name=${SIMULATOR_NAME},OS=${SIMULATOR_OS}" \
  -derivedDataPath ios/build \
  build \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO

echo ""
echo "=== シミュレータにアプリをインストール ==="

# シミュレータの UDID を取得
UDID=$(xcrun simctl list devices available | grep "${SIMULATOR_NAME} (" | head -1 | grep -E -o '[0-9A-F-]{36}')
echo "シミュレータ UDID: ${UDID}"

# シミュレータを起動（既に起動中なら無視）
xcrun simctl boot "${UDID}" 2>/dev/null || true

# アプリをインストール
xcrun simctl install "${UDID}" "${APP_OUTPUT}"
echo "✅ インストール完了"

echo ""
echo "✅ ビルド完了"
echo "   出力先: ${APP_OUTPUT}"
