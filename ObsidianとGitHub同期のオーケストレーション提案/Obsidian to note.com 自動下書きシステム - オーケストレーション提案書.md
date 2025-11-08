# Obsidian to note.com 自動下書きシステム - オーケストレーション提案書

**作成日**: 2025年11月7日  
**作成者**: Manus AI

---

## エグゼクティブサマリー

本提案書は、Obsidianで作成したMarkdownドキュメントをGitHubにプッシュすることで、note.comへ自動的に下書きを投稿するシステムのオーケストレーション設計を提示します。

本システムは、既にセットアップ済みの**note-MCP-server**（HTTP Streamable対応）と**n8n**を活用し、執筆から公開準備までのワークフローを完全自動化します。

### システムの特徴

- **執筆体験の維持**: Obsidianでの快適な執筆環境を損なわず、バックグラウンドで自動化が進行します。
- **メタデータ管理**: Frontmatterによるタイトル、タグ、記事IDの一元管理により、更新と新規作成を自動判別します。
- **セキュアな連携**: Cloudflare Tunnelを使用し、認証情報をローカル環境に保持したまま、リモートからのアクセスを実現します。
- **拡張性**: 画像アップロード、予約投稿、複数プラットフォーム対応など、将来的な機能拡張が容易です。

---

## 1. システムアーキテクチャ

### 1.1 全体構成図

![システム構成図](https://private-us-east-1.manuscdn.com/sessionFile/nEqrfZfPUuYg5Tcrg8P6ED/sandbox/jXGAj91hjDaLoKnR8uyGDR-images_1762525962854_na1fn_L2hvbWUvdWJ1bnR1L3N5c3RlbV9mbG93.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbkVxcmZaZlBVdVlnNVRjcmc4UDZFRC9zYW5kYm94L2pYR0FqOTFoakRhTG9LblI4dXlHRFItaW1hZ2VzXzE3NjI1MjU5NjI4NTRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzTjVjM1JsYlY5bWJHOTMucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=J5LiBm8kLsJ-sKWYKNehNmAPf4bCJ1uuEusV~SEj-RepnKBLvx3pF33Sc7RcrsiBUawZA1BiRx6w2Hl7ZREcATOh~JE26utAJd-t85SKibyhKlZ6o3WDRHh0JtmUhXBlTkfWE1Vb4vfJs8hNkf7FVNZY3ZKWcq2KmpS39RoycA~zWafcc8LFvGlkHhMfVHO2mtXFTbQCwnrd9ikXyALYi1zpVVQLd774uKt8LKrMU5Y1mDEp2R-wX8syzoZsaaUhO5xC-3okHnQ8LFv5i6POSnLPh9Br7z4PzSRUM6iA0rQlNhl907WQoK5JvBzbjf8Bhl0FsyVXbB52ymOZfx1oiw__)

本システムは、以下の5つの主要コンポーネントで構成されます。

| コンポーネント | 役割 | 環境 |
| :--- | :--- | :--- |
| **Obsidian** | 記事の作成・編集 | ユーザーのローカル環境 |
| **GitHub** | バージョン管理とWebhookトリガー | クラウド |
| **n8n** | ワークフローオーケストレーション | クラウド/VPS |
| **note-MCP-server** | note.com APIラッパー | ローカル/VPS |
| **note.com** | 最終的な投稿先プラットフォーム | クラウド |

### 1.2 データフロー

システム全体のデータフローは以下の通りです。

1. **記事作成**: ユーザーがObsidianでMarkdown記事を執筆し、Frontmatterにメタデータ（タイトル、タグ、記事ID）を記述します。
2. **GitHubプッシュ**: ユーザーがGitリポジトリにコミット＆プッシュすると、GitHubがWebhookをn8nに送信します。
3. **ワークフロー起動**: n8nがWebhookを受信し、変更されたファイルの情報を取得します。
4. **データ変換**: n8nがMarkdownファイルの内容をパースし、FrontmatterとMarkdown本文を分離してHTML形式に変換します。
5. **下書き投稿**: n8nがnote-MCP-serverにHTTPリクエストを送信し、note.com APIを経由して下書きを作成・更新します。
6. **記事ID更新**: 初回投稿の場合、n8nがGitHub APIを呼び出して、Frontmatterの`note_id`フィールドを更新します。

---

## 2. n8nワークフロー設計

### 2.1 ワークフロー図

![n8nワークフロー](https://private-us-east-1.manuscdn.com/sessionFile/nEqrfZfPUuYg5Tcrg8P6ED/sandbox/jXGAj91hjDaLoKnR8uyGDR-images_1762525962856_na1fn_L2hvbWUvdWJ1bnR1L3dvcmtmbG93.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbkVxcmZaZlBVdVlnNVRjcmc4UDZFRC9zYW5kYm94L2pYR0FqOTFoakRhTG9LblI4dXlHRFItaW1hZ2VzXzE3NjI1MjU5NjI4NTZfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzZHZjbXRtYkc5My5wbmciLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=UKA2A86L2tefHBMqvTRZuBbjxdC8J-QRsiNoj1LN~yfvDO3ndXOhQRw2xdcuOXmSIR2NsUiM3WpQfFeGFES-7Z4b8QQhdCLAwwo7TV-GSD~Apwt3f6hbx93dgqhSF97DgxoyF0u4~DdClI-xTKVq-V48egWc-Xwft6dQqo4USxE9C~9nqISZqEs5fwZaJ8iqmdIZi53~QXyeD7cvhLpXrOUeTVk2sL4smS4h18P4FWid-k52kVLEuorS~6Kj7eowBkfhly2fVQyu-54JhD19RghSqY3xqI1X9uIAZh~es3Zy9IgX~I033meOJ3Ueq6~gSOPsTfqWc0498DbgChiqBg__)

### 2.2 ノード構成

本ワークフローは、以下の9つのノードで構成されます。

| ノード名 | タイプ | 役割 |
| :--- | :--- | :--- |
| **Webhook** | Trigger | GitHubからのWebhookを受信 |
| **IF (コミットチェック)** | Conditional | プッシュにコミットが含まれているかを確認 |
| **SplitInBatches** | Loop | 複数ファイルの変更に対応するため、1つずつ処理 |
| **GitHub (ファイル取得)** | API | 変更されたMarkdownファイルの内容を取得 |
| **Code (パース)** | Function | Frontmatterのパースとマークダウン→HTML変換 |
| **HTTP Request** | API | note-MCP-serverへのリクエスト送信 |
| **IF (新規判定)** | Conditional | 新規投稿か更新かを判定 |
| **Code (更新準備)** | Function | GitHubに書き戻すファイル内容を準備 |
| **GitHub (更新)** | API | Frontmatterの`note_id`を更新 |

### 2.3 主要ノードの詳細設定

#### Webhook (トリガー)

```json
{
  "httpMethod": "POST",
  "path": "obsidian-to-note",
  "responseMode": "onReceived"
}
```

このノードをアクティブ化すると、Webhook URLが生成されます。このURLをGitHubリポジトリの`Settings` > `Webhooks`に登録します。

#### Code (パースとHTML変換)

このノードでは、GitHubから取得したBase64エンコードされたファイル内容をデコードし、Frontmatterとマークダウン本文を分離します。その後、マークダウンをHTMLに変換します。

```javascript
// Frontmatterパーサー
const matter = (input) => {
  const match = input.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)/);
  if (!match) return { data: {}, content: input };
  const frontmatter = match[1].split('\n').reduce((acc, line) => {
    const parts = line.split(':');
    const key = parts[0].trim();
    const value = parts.slice(1).join(':').trim();
    if (key) acc[key] = value.replace(/['"]/g, '');
    return acc;
  }, {});
  return { data: frontmatter, content: match[2] };
};

// Markdown to HTML変換
const markdownToHtml = (md) => {
  md = md.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
  md = md.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  md = md.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
  md = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  md = md.replace(/\*(.*?)\*/g, '<em>$1</em>');
  md = md.replace(/\n/g, '<br>');
  return md;
};

const base64content = $input.item.json.content;
const decodedContent = Buffer.from(base64content, 'base64').toString('utf-8');

const { data, content } = matter(decodedContent);
const htmlBody = markdownToHtml(content);

const tags = data.tags ? data.tags.replace(/[\[\]]/g, '').split(',').map(t => t.trim()) : [];

return {
  title: data.title || '無題',
  body: htmlBody,
  tags: tags,
  note_id: data.note_id && data.note_id !== 'null' ? data.note_id : null,
  originalContent: decodedContent
};
```

#### HTTP Request (note-MCP-server連携)

このノードでは、note-MCP-serverの`post-draft-note`ツールを呼び出します。リクエストはJSON-RPC 2.0形式で送信されます。

```json
{
  "method": "POST",
  "url": "{{ $env.NOTE_MCP_SERVER_URL }}",
  "sendBody": true,
  "bodyContentType": "application/json",
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "tool_name": "post-draft-note",
      "inputs": {
        "title": "={{ $json.title }}",
        "body": "={{ $json.body }}",
        "tags": "={{ JSON.stringify($json.tags) }}",
        "id": "={{ $json.note_id }}"
      }
    },
    "id": "n8n-workflow-{{ $workflow.id }}"
  }
}
```

---

## 3. note-MCP-server連携

### 3.1 HTTP Streamable トランスポート

note-MCP-serverは、HTTP/SSEトランスポートに対応しており、n8nからのリモートアクセスが可能です。

#### エンドポイント

- **ヘルスチェック**: `https://<your-tunnel-url>/health`
- **MCPエンドポイント**: `https://<your-tunnel-url>/mcp`

#### リクエスト形式

n8nからnote-MCP-serverへのリクエストは、JSON-RPC 2.0形式で送信されます。

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "tool_name": "post-draft-note",
    "inputs": {
      "title": "記事タイトル",
      "body": "<h1>本文</h1>",
      "tags": ["タグ1", "タグ2"],
      "id": "n4f0c7b884789"
    }
  },
  "id": "1"
}
```

#### レスポンス形式

成功時には、以下のような形式でレスポンスが返されます。

```json
{
  "jsonrpc": "2.0",
  "result": {
    "data": {
      "key": "n4f0c7b884789",
      "name": "記事タイトル",
      "status": "draft"
    }
  },
  "id": "1"
}
```

### 3.2 認証

note-MCP-serverは、`.env`ファイルに設定されたnote.comの認証情報を使用して、自動的にAPIリクエストを認証します。n8n側で認証情報を保持する必要はありません。

```env
NOTE_EMAIL=your_email@example.com
NOTE_PASSWORD=your_password
NOTE_USER_ID=your_note_user_id
```

### 3.3 Cloudflare Tunnel

note-MCP-serverをn8nからアクセス可能にするため、Cloudflare Tunnelを使用します。

```bash
cloudflared tunnel --url http://localhost:3000
```

このコマンドを実行すると、`https://abc-def-ghi.trycloudflare.com`のような一時的な公開URLが生成されます。このURLをn8nの環境変数`NOTE_MCP_SERVER_URL`に設定します（末尾に`/mcp`を追加）。

---

## 4. Obsidianでの記事作成フロー

### 4.1 Frontmatterテンプレート

Obsidianで新しい記事を作成する際、以下のFrontmatterテンプレートを使用します。

```yaml
---
title: "記事タイトル"
tags: ["タグ1", "タグ2", "タグ3"]
note_id: null
---

## はじめに

記事の本文をここに記述します。
```

### 4.2 フィールド説明

| フィールド | 必須 | 説明 | 例 |
| :--- | :--- | :--- | :--- |
| `title` | ✅ | 記事のタイトル | `"私の新しい記事"` |
| `tags` | ❌ | タグのリスト（最大10個） | `["技術", "自動化"]` |
| `note_id` | ✅ | note.comの記事ID（初回は`null`） | `null` または `"n4f0c7b884789"` |

### 4.3 GitHubへのプッシュ

記事の執筆が完了したら、Gitクライアントを使ってGitHubにプッシュします。

```bash
git add .
git commit -m "新しい記事を追加"
git push origin main
```

プッシュが完了すると、n8nワークフローが自動的に起動し、note.comに下書きが投稿されます。

### 4.4 記事IDの自動更新

初回投稿が成功すると、n8nワークフローがGitHub上のMarkdownファイルのFrontmatterにある`note_id`フィールドを自動的に更新します。

**更新前**:
```yaml
note_id: null
```

**更新後**:
```yaml
note_id: n4f0c7b884789
```

次回以降のプッシュでは、この`note_id`を使って記事が更新されます。

---

## 5. セットアップ手順

### 5.1 note-MCP-server

1. リポジトリをクローン: `git clone https://github.com/shimayuz/note-mcp-server.git`
2. 依存パッケージをインストール: `npm install`
3. `.env`ファイルを作成し、note.comの認証情報を設定
4. サーバーをビルド＆起動: `npm run build && npm run start:http`

### 5.2 Cloudflare Tunnel

1. Cloudflare Tunnelをインストール: `brew install cloudflare/cloudflare/cloudflared`
2. Tunnelを起動: `cloudflared tunnel --url http://localhost:3000`
3. 生成されたURLをメモ

### 5.3 GitHub

1. Obsidian記事管理用のリポジトリを作成
2. `Settings` > `Webhooks` > `Add webhook`
3. n8nで生成されたWebhook URLを設定
4. `Content type`を`application/json`に設定
5. `Just the push event`を選択

### 5.4 n8n

1. 新しいワークフローを作成
2. Webhookノードを追加し、URLを生成
3. 前述のノード構成に従ってワークフローを構築
4. 環境変数`NOTE_MCP_SERVER_URL`にCloudflare TunnelのURL + `/mcp`を設定
5. ワークフローを保存＆アクティブ化

---

## 6. 今後の拡張案

### 6.1 画像の自動アップロード

Obsidianで使用している画像を、note.comの画像アップロードAPIを使って自動的にアップロードし、本文内のリンクを置き換えることができます。

### 6.2 予約投稿

Frontmatterに`publish_at`フィールドを追加し、n8nのスケジューラーと組み合わせることで、指定した日時に自動公開する機能を実装できます。

### 6.3 複数プラットフォーム対応

note.comだけでなく、ZennやQiitaなど、他のプラットフォームにも同時に投稿できるように、n8nワークフローを拡張できます。

### 6.4 投稿結果の通知

n8nの`Slack`ノードや`Discord`ノードを追加し、投稿の成功・失敗をリアルタイムで通知する機能を実装できます。

---

## 7. まとめ

本提案書で提示したオーケストレーション設計により、Obsidianでの執筆からnote.comへの下書き投稿までを完全に自動化できます。この仕組みは、以下の利点を提供します。

- **執筆に集中**: 技術的な投稿プロセスを気にせず、コンテンツ作成に専念できます。
- **バージョン管理**: GitHubを経由することで、記事の変更履歴を完全に追跡できます。
- **柔軟な拡張性**: n8nのノードベースアーキテクチャにより、新しい機能を簡単に追加できます。
- **セキュアな運用**: 認証情報をローカル環境に保持し、Cloudflare Tunnelで安全にリモートアクセスを実現します。

本システムを導入することで、効率的で持続可能なコンテンツ公開ワークフローが実現します。

---

**作成者**: Manus AI  
**最終更新日**: 2025年11月7日
