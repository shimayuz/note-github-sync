# Obsidian Vault to note.com 自動下書きシステム - 最終実装ガイド

**作成日**: 2025年11月7日  
**作成者**: Manus AI  
**対象**: 複数ディレクトリ内の各Markdownファイルに固有のnote IDを紐づけて管理するシステム

---

## エグゼクティブサマリー

本ガイドは、Obsidian Vault内の複数ディレクトリに存在する各Markdownファイルに、それぞれ固有のnote.com記事IDを紐づけ、GitHubへのプッシュをトリガーに自動的に下書き投稿・更新するシステムの実装方法を提供します。

### 改善されたシステムの特徴

- **外部IDマッピング**: `.note-mapping.json`ファイルでファイルパスとnote IDの対応関係を一元管理します。
- **競合の完全回避**: Markdownファイルへの書き戻しを廃止し、ファイル競合のリスクを根本的に解消します。
- **Git履歴のクリーン化**: BOTによるコミットがマッピングファイルのみに限定され、記事の変更履歴が追いやすくなります。
- **スケーラビリティ**: 数百〜数千のファイルを効率的に管理できます。

---

## 1. システムアーキテクチャ

### 1.1 全体構成

本システムは、以下の5つのコンポーネントで構成されます。

| コンポーネント | 役割 | 環境 |
| :--- | :--- | :--- |
| **Obsidian** | 記事の作成・編集（Frontmatterは`title`と`tags`のみ） | ローカル |
| **GitHub** | バージョン管理、Webhookトリガー、`.note-mapping.json`の保存 | クラウド |
| **n8n** | ワークフローオーケストレーション | クラウド/VPS |
| **note-MCP-server** | note.com APIラッパー（HTTP Streamable対応） | ローカル/VPS |
| **note.com** | 最終的な投稿先プラットフォーム | クラウド |

### 1.2 データフロー

1. ユーザーがObsidianで記事を執筆し、GitHubにプッシュします。
2. GitHubがWebhookをn8nに送信します。
3. n8nが`.note-mapping.json`を読み込み、変更されたファイルのnote IDを検索します。
4. n8nがMarkdownをHTMLに変換し、note-MCP-serverに投稿リクエストを送信します。
5. note-MCP-serverがnote.com APIを呼び出し、下書きを作成・更新します。
6. n8nがメモリ上のマッピングオブジェクトを更新し、最後に`.note-mapping.json`をGitHubにコミットします。

---

## 2. `.note-mapping.json`の仕様

### 2.1 配置場所

GitHubリポジトリのルートディレクトリに配置します。

```
my-note-articles/
├── .note-mapping.json  ← ここに配置
├── articles/
│   ├── tech/
│   │   └── ai-automation.md
│   └── lifestyle/
│       └── morning-routine.md
└── drafts/
    └── new-article.md
```

### 2.2 ファイル構造

```json
{
  "version": "1.0",
  "last_updated": "2025-11-07T12:34:56Z",
  "mappings": {
    "articles/tech/ai-automation.md": {
      "note_id": "n4f0c7b884789",
      "title": "AI自動化の未来",
      "created_at": "2025-11-01T10:00:00Z",
      "updated_at": "2025-11-07T12:34:56Z"
    },
    "articles/lifestyle/morning-routine.md": {
      "note_id": "n5g1d8c995890",
      "title": "朝のルーティン",
      "created_at": "2025-11-02T08:30:00Z",
      "updated_at": "2025-11-05T15:20:00Z"
    },
    "drafts/new-article.md": {
      "note_id": null,
      "title": "新しい記事（未投稿）",
      "created_at": "2025-11-07T09:00:00Z",
      "updated_at": null
    }
  }
}
```

### 2.3 初期セットアップ

リポジトリに`.note-mapping.json`が存在しない場合、n8nワークフローが自動的に空のテンプレートを作成します。手動で作成する場合は、以下の内容で作成してください。

```json
{
  "version": "1.0",
  "last_updated": "2025-11-07T00:00:00Z",
  "mappings": {}
}
```

---

## 3. Obsidianでの記事作成

### 3.1 Frontmatterテンプレート

**重要**: 以前の設計と異なり、Frontmatterに`note_id`フィールドは**不要**です。

```yaml
---
title: "記事タイトル"
tags: ["タグ1", "タグ2", "タグ3"]
---

## はじめに

記事の本文をここに記述します。
```

### 3.2 ディレクトリ構造の例

Obsidian Vault内で、自由にディレクトリを構成できます。

```
my-note-articles/
├── articles/
│   ├── tech/
│   │   ├── ai-automation.md
│   │   └── web-development.md
│   ├── lifestyle/
│   │   └── morning-routine.md
│   └── business/
│       └── productivity-tips.md
└── drafts/
    └── new-article.md
```

各ファイルのパス（例: `articles/tech/ai-automation.md`）が、`.note-mapping.json`のキーとして使用されます。

---

## 4. n8nワークフロー設計

### 4.1 ワークフロー図

![改善されたn8nワークフロー](https://private-us-east-1.manuscdn.com/sessionFile/nEqrfZfPUuYg5Tcrg8P6ED/sandbox/ijJpOTkeJJIbkyLNFfzV6e-images_1762526437636_na1fn_L2hvbWUvdWJ1bnR1L2ltcHJvdmVkX3dvcmtmbG93.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbkVxcmZaZlBVdVlnNVRjcmc4UDZFRC9zYW5kYm94L2lqSnBPVGtlSkpJYmt5TE5GZnpWNmUtaW1hZ2VzXzE3NjI1MjY0Mzc2MzZfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwybHRjSEp2ZG1Wa1gzZHZjbXRtYkc5My5wbmciLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=QldzVrpAuE~ly4M7cRyZ6yBJEPsya~X2s5L01Fo9foug5BgzpNAg5b-ARKCATuXxm1YITV9qoEMQSuHHgKWt6twRkAN6FvdQOj4hThfrgvyje~qGqlQAx996eg84Y4moiVSOeT2EmAo9JBrWgrYMOVSXb1pNDTFFqOoy-f7JZLECnK9Zu4azG6-O~fh5VIDT0ot9D4pG0l85RIHFdyZn0ZWj-yFtRZobCiMnEmm4eveTx-OJF5qkBEkz5t-wn2LLykhwXZrFXYKYbDDTbCHOwB4IgH8kKBv1vXmXRt0eIWMCPrpPM7X~JxkLstG1gWr8Z9nlFWVOkLnHowzFLeOX3w__)

### 4.2 ノード構成

| ノード名 | タイプ | 役割 |
| :--- | :--- | :--- |
| **Webhook** | Trigger | GitHubからのWebhookを受信 |
| **IF (コミットチェック)** | Conditional | 空のプッシュを無視 |
| **GitHub (マッピングファイル取得)** | API | `.note-mapping.json`を取得 |
| **Code (マッピング初期化)** | Function | マッピングファイルをパースまたは初期化 |
| **SplitInBatches** | Loop | 変更されたファイルを1つずつ処理 |
| **GitHub (ファイル取得)** | API | Markdownファイルの内容を取得 |
| **Code (パース＆note ID取得)** | Function | Frontmatterをパースし、マッピングからnote IDを検索 |
| **HTTP Request** | API | note-MCP-serverに投稿リクエスト |
| **Code (マッピング更新)** | Function | メモリ上のマッピングオブジェクトを更新 |
| **Code (変更チェック)** | Function | マッピングに変更があったかを確認 |
| **GitHub (マッピングファイル更新)** | API | 変更があった場合のみ`.note-mapping.json`をコミット |

### 4.3 主要ノードのコード例

#### Code: マッピング初期化

```javascript
const mappingFileInput = $input.item.json;

let mappingData;

if (mappingFileInput.content) {
  const decodedContent = Buffer.from(mappingFileInput.content, 'base64').toString('utf-8');
  mappingData = JSON.parse(decodedContent);
} else {
  mappingData = {
    version: "1.0",
    last_updated: new Date().toISOString(),
    mappings: {}
  };
}

return { mappingData };
```

#### Code: パース＆note ID取得

```javascript
const fileContent = $input.item.json.content;
const filePath = $input.item.json.path; // GitHubから取得したファイルパス
const mappingData = $node["Code: Initialize Mapping"].json.mappingData;

const decodedContent = Buffer.from(fileContent, 'base64').toString('utf-8');

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

const { data, content } = matter(decodedContent);

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

const htmlBody = markdownToHtml(content);

// マッピングデータからnote_idを取得
const note_id = mappingData.mappings[filePath] ? mappingData.mappings[filePath].note_id : null;

return {
  filePath: filePath,
  title: data.title || '無題',
  body: htmlBody,
  tags: data.tags ? data.tags.replace(/[\[\]]/g, '').split(',').map(t => t.trim()) : [],
  note_id: note_id
};
```

#### Code: マッピング更新

```javascript
const postResult = $input.item.json.result.data;
const originalData = $node["Code: Parse & Get note_id"].json;
let mappingData = $node["Code: Initialize Mapping"].json.mappingData;

const filePath = originalData.filePath;
const newNoteId = postResult.key;

if (mappingData.mappings[filePath]) {
  mappingData.mappings[filePath].note_id = newNoteId;
  mappingData.mappings[filePath].title = originalData.title;
  mappingData.mappings[filePath].updated_at = new Date().toISOString();
} else {
  mappingData.mappings[filePath] = {
    note_id: newNoteId,
    title: originalData.title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

mappingData.last_updated = new Date().toISOString();

return { mappingData };
```

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
3. 生成されたURLをメモ（例: `https://abc-def-ghi.trycloudflare.com`）

### 5.3 GitHub

1. Obsidian記事管理用のリポジトリを作成
2. リポジトリのルートに`.note-mapping.json`を作成（空のテンプレート）
3. `Settings` > `Webhooks` > `Add webhook`
4. n8nで生成されたWebhook URLを設定
5. `Content type`を`application/json`に設定
6. `Just the push event`を選択

### 5.4 n8n

1. 新しいワークフローを作成
2. 上記のノード構成に従ってワークフローを構築
3. 環境変数を設定:
   - `NOTE_MCP_SERVER_URL`: `https://abc-def-ghi.trycloudflare.com/mcp`
   - `GITHUB_TOKEN`: GitHub Personal Access Token
4. ワークフローを保存＆アクティブ化

---

## 6. 運用フロー

### 6.1 新規記事の投稿

1. Obsidianで新しいMarkdownファイルを作成（Frontmatterには`title`と`tags`のみ）
2. GitHubにプッシュ
3. n8nワークフローが自動的に起動し、note.comに下書きを投稿
4. `.note-mapping.json`に新しいエントリが追加される

### 6.2 既存記事の更新

1. Obsidianで既存のMarkdownファイルを編集
2. GitHubにプッシュ
3. n8nワークフローが`.note-mapping.json`から`note_id`を検索
4. 既存の下書きが更新される
5. `.note-mapping.json`の`updated_at`が更新される

### 6.3 マッピングファイルの確認

`.note-mapping.json`をGitHubで開くと、すべてのファイルの投稿状況を一目で確認できます。

---

## 7. トラブルシューティング

### 7.1 マッピングファイルが更新されない

- n8nの`Code: Check for Mapping Changes`ノードのログを確認してください。
- `hasChanges`が`false`の場合、投稿が成功していない可能性があります。

### 7.2 note IDが見つからない

- `.note-mapping.json`に該当するファイルパスのエントリが存在するか確認してください。
- ファイルパスは、リポジトリのルートからの相対パスである必要があります。

### 7.3 競合が発生する

- 本設計では、Markdownファイルへの書き戻しを行わないため、競合は発生しません。
- もし`.note-mapping.json`自体に競合が発生した場合は、手動でマージしてください。

---

## 8. 今後の拡張案

### 8.1 画像の自動アップロード

Obsidianで使用している画像を、note.comの画像アップロードAPIを使って自動的にアップロードし、本文内のリンクを置き換えることができます。

### 8.2 予約投稿

Frontmatterに`publish_at`フィールドを追加し、n8nのスケジューラーと組み合わせることで、指定した日時に自動公開する機能を実装できます。

### 8.3 複数プラットフォーム対応

note.comだけでなく、ZennやQiitaなど、他のプラットフォームにも同時に投稿できるように、n8nワークフローを拡張できます。

### 8.4 削除の同期

Markdownファイルを削除した際に、対応するnote.comの記事も削除する機能を追加できます。

---

## 9. まとめ

本ガイドで提示したシステムにより、Obsidian Vault内の複数ディレクトリに存在する各Markdownファイルに、それぞれ固有のnote.com記事IDを紐づけ、安定かつ効率的に管理できます。

### 主な利点

- **競合の完全回避**: Markdownファイルへの書き戻しを廃止し、ファイル競合のリスクを根本的に解消します。
- **Git履歴のクリーン化**: BOTによるコミットがマッピングファイルのみに限定され、記事の変更履歴が追いやすくなります。
- **スケーラビリティ**: 数百〜数千のファイルを効率的に管理できます。
- **一元管理**: `.note-mapping.json`を見るだけで、リポジトリ内の全ファイルの投稿状況が一目でわかります。

この設計により、Obsidianでの執筆体験を損なうことなく、効率的で持続可能なコンテンツ公開ワークフローが実現します。

---

**作成者**: Manus AI  
**最終更新日**: 2025年11月7日
