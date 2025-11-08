# Obsidian to note.com 自動下書きシステム 実装ガイド

## 目次

1. [システム概要](#1-システム概要)
2. [前提条件](#2-前提条件)
3. [セットアップ手順](#3-セットアップ手順)
4. [Obsidianでの記事作成](#4-obsidianでの記事作成)
5. [トラブルシューティング](#5-トラブルシューティング)
6. [今後の拡張案](#6-今後の拡張案)

---

## 1. システム概要

本システムは、**Obsidian**で執筆したMarkdown記事を**GitHub**にプッシュすることで、**n8n**がこれを検知し、**note-MCP-server**を経由して**note.com**に自動で下書きを投稿・更新する仕組みです。

### システムフロー

```
Obsidian (執筆) → GitHub (同期) → n8n (処理) → note-MCP-server (API) → note.com (下書き保存)
```

### 主な利点

- Obsidianでの執筆体験を維持したまま、note.comへの投稿を自動化できます。
- Frontmatterによるメタデータ管理により、タイトル、タグ、記事IDを一元管理できます。
- 初回投稿後は自動的に記事IDが記録され、次回以降は更新として処理されます。

---

## 2. 前提条件

### 必要な環境

| 項目 | 要件 |
| :--- | :--- |
| **note-MCP-server** | ローカルPCまたはVPSにインストール済み |
| **Cloudflare Tunnel** | note-MCP-serverを公開するために設定済み |
| **n8n** | クラウド版またはセルフホスト版が利用可能 |
| **GitHub** | Webhookが設定可能なリポジトリ |
| **Obsidian** | Gitプラグインまたは外部Gitクライアントで同期可能 |
| **note.com** | アカウントと認証情報（メールアドレス、パスワード、ユーザーID） |

### 必要な認証情報

- **note.com**: メールアドレス、パスワード、ユーザーID（`.env`ファイルに設定）
- **GitHub**: Personal Access Token（n8nでGitHub APIを呼び出すため）

---

## 3. セットアップ手順

### 3.1 note-MCP-serverのセットアップ

1. **リポジトリのクローン**

   ```bash
   git clone https://github.com/shimayuz/note-mcp-server.git
   cd note-mcp-server
   ```

2. **依存パッケージのインストール**

   ```bash
   npm install
   ```

3. **環境変数の設定**

   `.env.example`をコピーして`.env`を作成し、以下を設定します。

   ```bash
   cp .env.example .env
   ```

   `.env`ファイルの内容:

   ```env
   NOTE_EMAIL=your_email@example.com
   NOTE_PASSWORD=your_password
   NOTE_USER_ID=your_note_user_id
   MCP_HTTP_PORT=3000
   MCP_HTTP_HOST=127.0.0.1
   ```

4. **サーバーのビルドと起動**

   ```bash
   npm run build
   npm run start:http
   ```

   サーバーが`http://127.0.0.1:3000`で起動します。

### 3.2 Cloudflare Tunnelの設定

1. **Cloudflare Tunnelのインストール**

   ```bash
   brew install cloudflare/cloudflare/cloudflared
   ```

2. **Tunnelの起動**

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

   表示されたURL（例: `https://abc-def-ghi.trycloudflare.com`）をメモします。このURLがn8nから`note-MCP-server`にアクセスするためのエンドポイントになります。

3. **自動起動設定（macOS）**

   macOSでは、`note-mcp-server`リポジトリに含まれる`scripts/manage-services.sh`を使用して、PC起動時に自動でサーバーとTunnelを起動できます。

   ```bash
   chmod +x scripts/manage-services.sh
   ./scripts/manage-services.sh setup
   ./scripts/manage-services.sh start
   ```

### 3.3 GitHubリポジトリの準備

1. **リポジトリの作成**

   Obsidianで管理する記事用のGitHubリポジトリを作成します（例: `my-note-articles`）。

2. **Webhookの設定**

   - リポジトリの`Settings` > `Webhooks` > `Add webhook`を選択
   - **Payload URL**: n8nで生成されるWebhook URL（次のステップで取得）
   - **Content type**: `application/json`
   - **Which events**: `Just the push event`を選択
   - `Add webhook`をクリック

### 3.4 n8nワークフローの作成

1. **n8nにログイン**

   n8nのダッシュボードにアクセスし、新しいワークフローを作成します。

2. **Webhookノードの追加**

   - `Webhook`ノードを追加し、`HTTP Method`を`POST`に設定
   - ノードをアクティブにすると、Webhook URLが生成されます
   - このURLをGitHubのWebhook設定にコピーします

3. **ワークフローノードの追加**

   以下のノードを順番に追加し、前述の「n8nワークフロー設計とMCP連携ガイド」に従って設定します。

   - `IF` (コミットチェック)
   - `SplitInBatches` (ファイル分割)
   - `GitHub` (ファイル取得)
   - `Code` (パースとHTML変換)
   - `HTTP Request` (note-MCP-server連携)
   - `IF` (新規投稿判定)
   - `Code` (ファイル更新準備)
   - `GitHub` (ファイル更新)

4. **環境変数の設定**

   n8nの環境変数に以下を追加します（セキュリティのため）。

   - `NOTE_MCP_SERVER_URL`: Cloudflare TunnelのURL + `/mcp`（例: `https://abc-def-ghi.trycloudflare.com/mcp`）
   - `GITHUB_TOKEN`: GitHub Personal Access Token

5. **ワークフローの保存とアクティブ化**

   ワークフローを保存し、アクティブ化します。

---

## 4. Obsidianでの記事作成

### 4.1 Frontmatterの記述

Obsidianで新しいMarkdownファイルを作成する際、以下のようなFrontmatterを先頭に記述します。

```yaml
---
title: "私の新しい記事のタイトル"
tags: ["技術", "プログラミング", "自動化"]
note_id: null
---

## はじめに

これは記事の本文です。Obsidianで自由に執筆してください。

### セクション1

本文の内容...
```

### 4.2 Frontmatterのフィールド説明

| フィールド | 説明 | 例 |
| :--- | :--- | :--- |
| `title` | 記事のタイトル | `"私の新しい記事のタイトル"` |
| `tags` | タグのリスト（最大10個） | `["技術", "プログラミング", "自動化"]` |
| `note_id` | note.comの記事ID（初回は`null`） | `null` または `"n4f0c7b884789"` |

### 4.3 GitHubへのプッシュ

Obsidianで記事を執筆後、Gitプラグインまたは外部Gitクライアントを使ってGitHubにプッシュします。

```bash
git add .
git commit -m "新しい記事を追加"
git push origin main
```

プッシュが完了すると、n8nワークフローが自動的に起動し、note.comに下書きが投稿されます。

### 4.4 記事IDの自動更新

初回投稿が成功すると、n8nワークフローがGitHub上のMarkdownファイルのFrontmatterにある`note_id`フィールドを自動的に更新します。次回以降のプッシュでは、この`note_id`を使って記事が更新されます。

---

## 5. トラブルシューティング

### 5.1 note-MCP-serverに接続できない

**症状**: n8nの`HTTP Request`ノードでエラーが発生する。

**解決策**:
- Cloudflare Tunnelが起動しているか確認してください（`cloudflared tunnel --url http://localhost:3000`）。
- `note-MCP-server`が起動しているか確認してください（`npm run start:http`）。
- n8nの環境変数`NOTE_MCP_SERVER_URL`が正しいか確認してください。

### 5.2 認証エラーが発生する

**症状**: `post-draft-note`の実行時に認証エラーが返される。

**解決策**:
- `.env`ファイルに正しいnote.comの認証情報が設定されているか確認してください。
- `note-MCP-server`を再起動して、環境変数を再読み込みしてください。

### 5.3 Frontmatterのパースに失敗する

**症状**: n8nの`Code`ノードでエラーが発生する。

**解決策**:
- Frontmatterの形式が正しいか確認してください（`---`で囲まれ、`key: value`形式）。
- タグは配列形式（`["tag1", "tag2"]`）で記述してください。

### 5.4 記事IDが更新されない

**症状**: 初回投稿後もFrontmatterの`note_id`が`null`のまま。

**解決策**:
- n8nの`GitHub`（ファイル更新）ノードの設定を確認してください。
- GitHub Personal Access Tokenに`repo`スコープが含まれているか確認してください。

---

## 6. 今後の拡張案

### 6.1 画像の自動アップロード

ObsidianのMarkdown内で使用している画像を、note.comの画像アップロードAPIを使って自動的にアップロードし、本文内のリンクを置き換えることができます。

### 6.2 公開日時の予約投稿

Frontmatterに`publish_at`フィールドを追加し、n8nのスケジューラーと組み合わせることで、指定した日時に自動公開する機能を実装できます。

### 6.3 複数プラットフォームへの同時投稿

note.comだけでなく、ZennやQiitaなど、他のプラットフォームにも同時に投稿できるように、n8nワークフローを拡張できます。

### 6.4 投稿結果の通知

n8nの`Slack`ノードや`Discord`ノードを追加し、投稿の成功・失敗をリアルタイムで通知する機能を実装できます。

---

## まとめ

本ガイドに従ってセットアップを行うことで、Obsidianでの執筆からnote.comへの下書き投稿までを完全に自動化できます。この仕組みにより、執筆に集中しながら、効率的にコンテンツを管理・公開することが可能になります。

**作成者**: Manus AI  
**最終更新日**: 2025年11月7日
