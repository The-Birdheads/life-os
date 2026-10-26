# App Store 掲載情報（Habitas）

## 1.3.1

### このバージョンの最新情報

```
・Memory Calendar とアカウントを共通化しました。同じ Apple / Google アカウントで、両方のアプリを使えます
・アップデート後は、一度ログアウトした状態になります。以前と同じアカウントでログインし直すと、これまでの記録が表示されます
・Memory Calendar でも使っているアカウントを削除するときは、Habitas のデータだけを削除するようにしました
・Google でログインするときに、使うアカウントを選べるようにしました
・広告の表示中に、ヘッダーが縦に広がる不具合と、画面が広告に重なる不具合を修正しました
・新しい端末でログインしたときに、完了の記録が正しく表示されないことがある不具合を修正しました
・その他、安定性を改善しました
```

### 審査メモ

```
App Purpose:
Habitas is a daily habit, task, and action tracking app. Users register habits and tasks, mark them complete with one tap, and review a daily fulfillment score. A weekly view shows consistency over time. Login is optional: without logging in, data is stored only on the device. Logging in with Sign in with Apple or Google enables cloud sync across devices.

What's new in this version (1.3.1):
- Habitas now shares its account system with our other app, "Memory Calendar" (same developer, KOGEN LAB). The same Apple ID or Google account can be used in both apps. Each app's data is stored separately and is never shown in the other app.
- Because the login backend changed, users who update are signed out once. A notice explains this, and signing in again with the same Apple/Google account shows their existing records (we migrated the data on the server).
- Account deletion now considers the other app (see "Account Deletion" below).
- Google Sign-In now always shows the account picker.
- Fixed a layout issue where the header expanded while a banner ad was shown, and modals overlapping the ad.
- Fixed a sync issue where past completions were not shown after logging in on a new device.

External Services:
- Supabase: backend database and authentication (shared with Memory Calendar)
- Google Sign-In (via Supabase Auth): OAuth login in an in-app browser (SFSafariViewController)
- Sign in with Apple (via Supabase Auth): native Apple authentication
- Google AdMob: banner ads
- Local Notifications: reminders scheduled on the device (no push notifications)

Regional Differences:
The app functions consistently across all regions with no region-specific content.

Login & Authentication:
- Sign in with Apple is offered as an equivalent login option alongside Google Sign-In.
- Google Sign-In uses SFSafariViewController (in-app browser) and does not open external Safari.
- App Tracking Transparency permission is requested on app launch before any ad is loaded.

Demo Account (Google Sign-In):
[Address] test.birdhead@gmail.com
[Password] (リポジトリには書かない。App Store Connect に貼るときに記入する)
The demo account already contains sample habits, tasks and actions.
Note: Sign in with Apple does not require a demo account. Reviewers may use their own Apple ID to test this login flow.

Account Deletion (Guideline 5.1.1(v)):
Menu (the "≡" button at the top right) > "アカウント" (Account) > "アカウント削除" (Delete account) > "はい" (Yes).
- If the account is used only in Habitas, all Habitas data and the account itself are deleted.
- If the same account is also used in Memory Calendar, only the Habitas data is deleted, and the account and the Memory Calendar data are kept. The confirmation dialog states this before deletion. The account is deleted completely when it is deleted from the last app that uses it.
- For Sign in with Apple users, the app asks the user to confirm with Apple and then revokes the Sign in with Apple token for Habitas before deleting.
Note: The demo account above is also used in Memory Calendar, so deleting it in Habitas removes only its Habitas data. To verify complete account deletion, please sign in with your own Apple ID (used only in Habitas) and delete the account; it is removed completely, and Habitas disappears from Settings > Apple Account > Sign in with Apple.

Privacy Policy: https://kogenlab.com/habitas/privacy.html
Support: https://kogenlab.com/habitas/support.html
```
