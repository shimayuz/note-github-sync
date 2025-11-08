# Obsidian ⇄ note.com 双方向同期システム - 実装ガイド

## 概要

このガイドでは、GitHubのVaultのmdファイルからnote.comの下書き記事を作成・紐づけし、note.comで編集した内容をGitHubのPRに自動で移行するシステムの実装手順を説明します。

## システム構成

### コンポーネント

1. **GitHubリポジトリ**: Obsidian VaultのMarkdownファイルを管理
2. **note-MCP-server**: note.com APIとの連携（HTTP Streamable対応）
3. **n8n**: ワークフローオーケストレーション
4. **Cloudflare Tunnel**: note-MCP-serverへのリモートアクセス
5. **.note-mapping.json**: ファイルパスとnote IDのマッピング管理

### データフロー

#### 順方向同期（GitHub → note.com）
1. ObsidianでMarkdownファイルを作成・編集
2. GitHubにプッシュ
3. GitHub Webhookがn8nをトリガー
4. n8nがMarkdownをHTMLに変換
5. note-MCP-server経由でnote.comに下書き投稿
6. `.note-mapping.json`を更新

#### 逆方向同期（note.com → GitHub）
1. note.comで下書きを編集
2. n8nの定期トリガー（1時間ごと）が起動
3. 変更を検知
4. HTMLをMarkdownに変換
5. GitHubにPRを作成
6. マージ後に`.note-mapping.json`を更新

## セットアップ手順

### 1. note-MCP-serverのセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/shimayuz/note-mcp-server.git
cd note-mcp-server

# 依存パッケージをインストール
npm install

# .envファイルを作成
cp .env.example .env
```

`.env`ファイルの設定:

```env
NOTE_EMAIL=your_email@example.com
NOTE_PASSWORD=your_password
NOTE_USER_ID=your_note_user_id
MCP_HTTP_PORT=3000
MCP_HTTP_HOST=127.0.0.1
```

サーバーを起動:

```bash
npm run build
npm run start:http
```

### 2. Cloudflare Tunnelの設定

```bash
# Cloudflare Tunnelをインストール（macOS）
brew install cloudflare/cloudflare/cloudflared

# Tunnelを起動
cloudflared tunnel --url http://localhost:3000
```

表示されたURL（例: `https://abc-def-ghi.trycloudflare.com`）をメモします。

### 3. GitHubリポジトリの準備

1. Obsidian記事管理用のリポジトリを作成
2. リポジトリのルートに`.note-mapping.json`を作成:

```json
{
  "version": "1.0",
  "last_updated": "2025-01-XXT00:00:00Z",
  "mappings": {}
}
```

3. Webhookを設定:
   - `Settings` > `Webhooks` > `Add webhook`
   - n8nで生成されたWebhook URLを設定
   - `Content type`: `application/json`
   - `Just the push event`を選択

### 4. n8nワークフローの作成

#### 順方向同期ワークフロー

n8nで新しいワークフローを作成し、以下のノードを追加:

1. **Webhook** (Trigger)
   - HTTP Method: `POST`
   - Webhook URLをコピーしてGitHubに設定

2. **IF** (コミットチェック)
   - Condition: `{{ $json.body.commits }}`
   - Operation: `Is Not Empty`

3. **GitHub** (マッピングファイル取得)
   - Resource: `File`
   - Operation: `Get`
   - File Path: `.note-mapping.json`
   - Options: `Fail on Error`を無効化

4. **Code** (マッピング初期化)
   - Language: `JavaScript`
   - Code: `src/n8n-workflows/forward-sync-workflow.js`の`initializeMappingNode`関数の内容をコピー

5. **SplitInBatches** (ファイル処理)
   - Field to Split: `{{ $json.body.head_commit.modified }}`
   - Batch Size: `1`

6. **GitHub** (ファイル取得)
   - Resource: `File`
   - Operation: `Get`
   - File Path: `{{ $json.fileName }}`

7. **Code** (パース＆note ID取得)
   - Language: `JavaScript`
   - Code: `src/n8n-workflows/forward-sync-workflow.js`の`parseAndGetNoteId`関数の内容をコピー

8. **HTTP Request** (note-MCP-server連携)
   - Method: `POST`
   - URL: `{{ $env.NOTE_MCP_SERVER_URL }}/mcp`
   - Body Content Type: `application/json`
   - Body: `src/n8n-workflows/forward-sync-workflow.js`の`generateMCPRequest`関数を使用

9. **Code** (マッピング更新)
   - Language: `JavaScript`
   - Code: `src/n8n-workflows/forward-sync-workflow.js`の`updateMappingObject`関数の内容をコピー

10. **Code** (変更チェック)
    - Language: `JavaScript`
    - Code: `src/n8n-workflows/forward-sync-workflow.js`の`checkForMappingChanges`関数の内容をコピー

11. **IF** (変更の有無)
    - Condition: `{{ $json.hasChanges }}`
    - Operation: `Is True`

12. **GitHub** (マッピングファイル更新)
    - Resource: `File`
    - Operation: `Update`
    - File Path: `.note-mapping.json`
    - Content: `{{ JSON.stringify($json.updatedMapping, null, 2) }}`
    - Commit Message: `[BOT] Update .note-mapping.json`

#### 逆方向同期ワークフロー

1. **Schedule Trigger** (Trigger)
   - Cron Expression: `0 * * * *` (1時間ごと)

2. **GitHub** (マッピングファイル取得)
   - Resource: `File`
   - Operation: `Get`
   - File Path: `.note-mapping.json`

3. **HTTP Request** (下書き一覧取得)
   - Method: `POST`
   - URL: `{{ $env.NOTE_MCP_SERVER_URL }}/mcp`
   - Body: JSON-RPC 2.0形式で`get-my-notes`ツールを呼び出し

4. **Code** (変更検知)
   - Language: `JavaScript`
   - Code: `src/n8n-workflows/reverse-sync-workflow.js`の`detectChanges`関数の内容をコピー

5. **IF** (変更の有無)
   - Condition: `{{ $json.length }}`
   - Operation: `Is Greater Than`
   - Value: `0`

6. **SplitInBatches** (記事処理)
   - Field to Split: `{{ $json }}`
   - Batch Size: `1`

7. **HTTP Request** (記事詳細取得)
   - Method: `POST`
   - URL: `{{ $env.NOTE_MCP_SERVER_URL }}/mcp`
   - Body: JSON-RPC 2.0形式で`get-note`ツールを呼び出し

8. **Code** (HTML→Markdown変換)
   - Language: `JavaScript`
   - Code: `src/n8n-workflows/reverse-sync-workflow.js`の`convertHtmlToMarkdown`関数の内容をコピー

9. **Code** (PRデータ準備)
   - Language: `JavaScript`
   - Code: `src/n8n-workflows/reverse-sync-workflow.js`の`preparePRData`関数の内容をコピー

10. **GitHub** (ブランチ作成)
    - Resource: `Branch`
    - Operation: `Create`
    - Branch Name: `{{ $json.branch_name }}`
    - Source Branch: `main`

11. **GitHub** (ファイル更新)
    - Resource: `File`
    - Operation: `Update`
    - File Path: `{{ $json.file_path }}`
    - Content: `{{ $json.file_content }}`
    - Branch: `{{ $json.branch_name }}`
    - Commit Message: `{{ $json.commit_message }}`

12. **GitHub** (PR作成)
    - Resource: `Pull Request`
    - Operation: `Create`
    - Title: `{{ $json.pr_title }}`
    - Head Branch: `{{ $json.branch_name }}`
    - Base Branch: `main`
    - Body: `{{ $json.pr_body }}`

13. **Discord/Slack** (通知) - オプション
    - 新しいPRが作成されたことを通知

### 5. 環境変数の設定

n8nの環境変数に以下を設定:

- `NOTE_MCP_SERVER_URL`: Cloudflare TunnelのURL（例: `https://abc-def-ghi.trycloudflare.com/mcp`）
- `GITHUB_TOKEN`: GitHub Personal Access Token

## 使用方法

### 新規記事の投稿

1. Obsidianで新しいMarkdownファイルを作成:

```markdown
---
title: "記事タイトル"
tags: ["タグ1", "タグ2"]
---

## はじめに

記事の本文をここに記述します。
```

2. GitHubにプッシュ
3. n8nワークフローが自動的に起動し、note.comに下書きを投稿
4. `.note-mapping.json`に新しいエントリが追加される

### 既存記事の更新

1. Obsidianで既存のMarkdownファイルを編集
2. GitHubにプッシュ
3. n8nワークフローが`.note-mapping.json`から`note_id`を検索
4. 既存の下書きが更新される

### note.comでの編集

1. note.comのWebエディタで下書きを編集
2. 編集内容を保存
3. n8nが1時間ごとにnote.comをチェック
4. 変更が検知されると、自動的にGitHubのプルリクエストが作成される
5. GitHub上でPRをレビュー・マージ
6. マージ後、順方向ワークフローが実行され、`.note-mapping.json`が更新される

## トラブルシューティング

### マッピングファイルが更新されない

- n8nの`Code: Check for Mapping Changes`ノードのログを確認
- `hasChanges`が`false`の場合、投稿が成功していない可能性があります

### note IDが見つからない

- `.note-mapping.json`に該当するファイルパスのエントリが存在するか確認
- ファイルパスは、リポジトリのルートからの相対パスである必要があります

### 変更が検知されない

- `.note-mapping.json`の`note_updated_at`フィールドが正しく更新されているか確認
- note-MCP-serverの`get-my-notes`ツールが正しく動作しているか確認

### PRが重複して作成される

- 「IF (PR重複チェック)」ノードが正しく設定されているか確認
- 同じブランチ名からのPRが既に存在する場合、GitHub APIはエラーを返します

## 注意事項

- Markdown→HTML変換は簡易的な実装です。より高精度な変換には`marked`や`turndown`などのライブラリの使用を推奨します
- HTML→Markdown変換も簡易的な実装です。より高精度な変換には`turndown`ライブラリの使用を推奨します
- note-MCP-serverはHTTP Streamable対応版を使用してください
- Cloudflare TunnelのURLは定期的に変更される可能性があります。永続的なURLが必要な場合は、Cloudflare Tunnelの設定を変更してください

## 参考ドキュメント

- [Obsidian ⇄ note.com 双方向同期システム - 完全ガイド](./ObsidianとGitHub同期のオーケストレーション提案/Obsidian%20⇄%20note.com%20双方向同期システム%20-%20完全ガイド.md)
- [Obsidian Vault to note.com 自動下書きシステム - 最終実装ガイド](./ObsidianとGitHub同期のオーケストレーション提案/Obsidian%20Vault%20to%20note.com%20自動下書きシステム%20-%20最終実装ガイド.md)
- [note.com → GitHub 逆方向同期システム - 最終実装ガイド](./ObsidianとGitHub同期のオーケストレーション提案/note.com%20→%20GitHub%20逆方向同期システム%20-%20最終実装ガイド.md)

