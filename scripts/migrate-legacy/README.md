# 旧プロジェクト → 共通プロジェクトへのデータ移行

旧 Supabase プロジェクト(Habitas 単独、`nxspggurjyguhbdkraog`)のデータを、Memory Calendar と共通のプロジェクト
(`posqpbpfnmnnacqzkoxy`、`habitas` スキーマ)へ移す。

## 性質
- **既定はドライラン**(何も書き込まない)。`--apply` を付けたときだけ書き込む。
- **行ID(uuid)を変えない**。新バージョンの端末内データと、ログイン後に重複なく統合されるため。
- **何度実行してもよい**。移行先に同じ行があれば、`updated_at` が新しいほうを残す(新バージョンで編集したデータを、古いデータで上書きしない)。
- 移行先には追加・更新だけで、削除はしない。旧プロジェクトは読み取りだけ。
- 次の行は移行しない(実行結果の最後に一覧が出る): 行IDが uuid でない行、参照先(習慣・行動)が無い実施記録。

## ユーザーの突き合わせ
旧ユーザー → 新プロジェクトのユーザーを、次の順で探す。
1. Apple / Google の識別子(`sub`)が一致(Apple の `sub` はチーム単位、Google の `sub` はアカウント単位で共通)
2. メールアドレスが一致(大文字小文字は区別しない。Apple の「メールを隠す」の中継アドレスも、同じアプリなら同じ値)

見つからなかったユーザーはスキップして、最後に一覧を出す。

## 準備
1. 両プロジェクトの `service_role`(`sb_secret_...`)キーを、ダッシュボードの Project Settings → API Keys から取得する。
2. **キーはチャットやコマンド履歴に残さない**。ターミナルで、次のように入力して設定する(入力は表示されない)。

```bash
read -s "LEGACY_SERVICE_ROLE_KEY?旧プロジェクトの service_role: " && export LEGACY_SERVICE_ROLE_KEY && echo
read -s "NEW_SERVICE_ROLE_KEY?新プロジェクトの service_role: " && export NEW_SERVICE_ROLE_KEY && echo
export LEGACY_URL=https://nxspggurjyguhbdkraog.supabase.co
export NEW_URL=https://posqpbpfnmnnacqzkoxy.supabase.co
```

## 実行

```bash
cd /Users/user/Dev/life-os && node scripts/migrate-legacy/run.mjs
```

出力の「対応」と、追加・更新の件数を確認する。1人だけ試すときは `--user <旧プロジェクトのメールアドレス>`。
問題がなければ、`--apply` を付けて実行する。

## 進め方

### B. 先にユーザーを作ってから移行する(`--create-missing-users`)【採用】
ユーザーに個別連絡できず、まだ使っているか分からないため、データを先に新プロジェクトへ移しておく。
ユーザーが新バージョンに更新して、旧版と同じ Apple/Google でログインすれば、データがそのまま出る。

1. ドライランで、対応付けを確認する。

```bash
cd /Users/user/Dev/life-os && node scripts/migrate-legacy/run.mjs --create-missing-users
```

2. 問題がなければ、書き込む。

```bash
node scripts/migrate-legacy/run.mjs --create-missing-users --apply
```

   - 新プロジェクトに対応するユーザーがいなければ、旧メールアドレスでユーザーを**作成**する(データが無い人は作らない)。
   - 同時に、**Apple/Google の識別子の登録 SQL** を `./migrate-identities.sql` に書き出す。個人情報(メール等)を含むので、コミットしない(`.gitignore` 済み)。使い終わったら削除する。

3. **識別子の登録 SQL を実行する(重要)**。新プロジェクトにリンクした状態で、`memory-calendar` ディレクトリから実行する。

```bash
cd /Users/user/Dev/memory-calendar && supabase db query --linked -f /Users/user/Dev/life-os/migrate-identities.sql
```

   これで、旧版と同じ Apple/Google アカウントでログインしたとき、メールの自動連携に頼らず、確実に移行済みのユーザーとしてログインできる。
   何度実行しても重複しない(`on conflict do nothing`)。

4. もう一度ドライランして、対応が `[apple-sub]` / `[google-sub]` になっていることを確認する。

**本番で一括実行する前に、1人で試す(必須)**
- 新しいテスト用の Google アカウントで、**旧版(App Store 版)にログイン**して、習慣を1つ作る(旧プロジェクトにユーザーとデータができる)。
- そのメールアドレスだけを対象に、上の手順 1〜3 を実行する(`--user <メールアドレス>` を付ける)。
- **新バージョンで、同じ Google アカウントでログイン**する。習慣が出て、`auth.users` に、同じ人の行が増えていない(1行のまま)ことを確認する。

### A. 先にユーザーにログインしてもらい、そのあと移行する
連絡できる場合のみ。新バージョンでログインしてもらってから、`--create-missing-users` なしで実行する。

## 旧プロジェクトを止める前の最後の実行
旧バージョンの利用者が、移行後に旧プロジェクトへ書き込んだ分を拾うため、停止の直前にもう一度 `--apply` で実行する(差分だけが反映される)。

## 取り消し
移行先のデータは追加・更新のみ。取り消すときは、そのユーザーの `habitas.*` の行を SQL で削除する
(アカウントごと消す場合は、アプリのアカウント削除、または `delete_app_data`)。
