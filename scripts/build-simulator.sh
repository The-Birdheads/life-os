#!/bin/bash
set -e

echo "=== Capacitor ビルド & iOS 同期 ==="
npm run build
npx cap sync ios

echo "=== iOS シミュレータ向けビルド ==="
xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16e' \
  -derivedDataPath ios/build \
  build \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  | xcpretty || true

echo ""
echo "✅ ビルド完了"
echo "   出力先: ios/build/Build/Products/Debug-iphonesimulator/App.app"
