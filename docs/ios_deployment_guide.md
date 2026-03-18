## 🔑 0. 管理者（Mac所有者）にお願いする作業

管理者権限（sudo）が必要な項目をまとめました。友人に以下のコマンドの実行をお願いしてください。

### ① Xcode のインストールと初期設定
1. **Xcode アプリ**を App Store からインストール。
2. インストール後、Xcode を起動し、追加コンポーネントのインストールを完了させる。
3. ターミナルで以下を実行（コマンドラインツールの有効化）:
   ```bash
   sudo xcode-select --install
   ```

### ② CocoaPods のインストール
iOSのライブラリ管理に必須です。**管理者（友人）のユーザーアカウントで**、友人のターミナルから実行してもらう必要があります。

**方法1: 管理者のアカウントで Homebrew を使う (推奨)**
1. 友人のユーザーでログインしているターミナルを開く。
2. 以下を実行（`sudo` は不要です）:
   ```bash
   brew install cocoapods
   ```

**方法2: gem を使う (方法1がうまくいかない場合)**
1. どちらのユーザー（自分または友人）のターミナルでもOK。
2. 以下を実行（管理者パスワードが必要です）:
   ```bash
   sudo gem install cocoapods
   ```
   ※「Rubyのバージョンが古い」というエラーが出る場合は、**方法1**を優先してください。

---

### ③ ユーザーへの権限付与（最も推奨・作業が楽になります）
作業中にファイル書き込みなどで何度もエラーが出るのを避けるため、可能であれば現在のユーザー（Guest_Dev）に一時的に管理者権限を付与してもらうのが一番スムーズです。
- 「システム設定 > ユーザーとグループ」から、Guest_Devの「このコンピュータの管理を許可」にチェックを入れてもらう。
- これをしておけば、「0.」以外のすべての作業を自分で解決（sudo 実行も可能）できるようになります。

---

## 🏗️ 1. Mac の開発環境構築（ここから自分で作業）

まずはMac側でアプリをビルドできる状態にします。

### 1.1 必須ツールのインストール
ターミナル（Terminal.app）を開き、以下のコマンドを順に実行してください。

1. **Homebrew** (パッケージ管理ツール)
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. **Node.js** (v18以上)
   ```bash
   brew install node
   ```
3. **CocoaPods** (iOSのライブラリ管理)
   ```bash
   brew install cocoapods
   ```
4. **Xcode** (App Storeからインストール)
   - インストール後、一度起動して「Xcode > Settings > Locations > Command Line Tools」が設定されていることを確認してください。

---

## 🌐 2. App Store Connect での準備

アプリをアップロードする「受け皿」を事前に作成します。

1. **Bundle ID の登録**: [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list) にて、`com.kanta.lifeos` (または既存のもの) を登録します。
2. **新規アプリの作成**: [App Store Connect](https://appstoreconnect.apple.com/apps) で「＋」をクリックし、新規Appを作成します。
   - **プラットフォーム**: iOS
   - **名前**: Habitas
   - **バンドルID**: 先ほど登録したものを選択

---

## 🚀 3. ビルドとプロジェクトの同期

プロジェクトをクローンしたディレクトリで実行します。

```bash
# 1. ライブラリのインストール
npm install

# 2. Webアセットのビルド
npm run build

# 3. iOSプロジェクトへの同期
npx cap sync ios
```

---

## 🛠️ 4. Xcode での設定とビルド

```bash
# Xcode でプロジェクトを開く
npx cap open ios
```

### 4.1 プロジェクト設定 (App)
左側の青いアイコン「App」を選択し、中央の **Signing & Capabilities** タブを開きます。
- **Automatically manage signing**: チェックを入れる。
- **Team**: 自分の開発者チームを選択。
- **Bundle Identifier**: App Store Connectで登録したものと一致しているか確認。

### 4.2 AdMob の設定 (重要)
`App/App/Info.plist` を開き、**GADApplicationIdentifier** (AdMob App ID) が正しく設定されているか確認してください。
（テスト用の `ca-app-pub-3940256099942544~1458002511` が入っているはずですが、本番用IDがある場合はここで差し替えます）

### 4.3 プライバシー宣言 (通知など)
通知を使用するため、`Info.plist` に **Privacy - Push Notifications Usage Description** 等の記述があるか確認します（Capacitorが自動追加する場合もありますが、ストア審査で重要です）。

---

## 📤 5. ストアへのアップロード

1. **ターゲットの選択**: Xcode上部のメニューバーで、シミュレータ名ではなく **Any iOS Device (arm64)** を選択します。
2. **アーカイブ作成**: メニューの **Product > Archive** をクリック。ビルドが始まります（数分かかります）。
3. **オーガナイザーの起動**: ビルドが終わると「Organizer」ウィンドウが開きます。
4. **アップロード**:
   - 右側の **Distribute App** をクリック。
   - **App Store Connect** > **Upload** を選択。
   - 画面の指示に従い（基本はNext/UploadでOK）、完了するのを待ちます。

---

## 🧪 6. TestFlight でのテスト (推奨)

アップロード完了から数分〜数十分後、App Store Connectの「TestFlight」タブにビルドが表示されます。
- **輸出コンプライアンス**: 「暗号化を使用していますか？」等の質問に答えます（標準的なHTTPSのみなら「いいえ」です）。
- **外部テスト**: 自分や友人をテストユーザーに招待し、iPhoneから直接アプリをダウンロードして動作を確認できます。

---

## 📸 7. 審査提出用の準備

審査には以下のスクリーンショットが「必須」です（シミュレータで `Cmd + S` で撮影できます）。
- **6.5インチ (iPhone 15 Pro Max 等)**: 4〜5枚
- **5.5インチ (iPhone 8 Plus 等)**: 4〜5枚

これらを App Store Connect の「App情報 ＞ iOSプレビュー」にドラッグ＆ドロップし、各項目を入力して「審査に提出」をクリックすれば完了です！

---

> [!TIP]
> **よくあるトラブル**: 
> `npx cap sync ios` でエラーが出る場合は、`ios/App/App.xcworkspace` ではなく `ios/App/Pods` 周りの問題が多いです。その場合は `cd ios/App && pod install` を試してみてください。
