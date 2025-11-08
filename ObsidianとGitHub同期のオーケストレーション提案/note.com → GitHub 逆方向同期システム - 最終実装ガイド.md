# note.com → GitHub 逆方向同期システム - 最終実装ガイド

**作成日**: 2025年11月7日  
**作成者**: Manus AI  
**対象**: note.comの下書きを手動編集後、GitHubにプルリクエストとして自動送信し、Obsidian/Cursorで編集可能にするシステム

---

## エグゼクティブサマリー

本ガイドは、先に設計した「Obsidian → GitHub → note.com」の順方向同期システムの逆方向として、**note.comで手動編集した下書きの変更内容を自動的にGitHubに反映**し、Obsidian/Cursorで編集可能にするシステムの実装方法を提供します。

### システムの特徴

- **定期的な変更検知**: n8nが1時間ごとにnote.comをチェックし、変更を自動検知します。
- **プルリクエスト自動生成**: 変更内容をGitHubのプルリクエストとして自動作成し、差分をレビューできます。
- **人間によるレビュー**: 自動マージではなく、人間がレビュー・承認してからマージします。
- **状態の整合性**: マージ後、既存の順方向ワークフローが実行され、`.note-mapping.json`が最新の状態に更新されます。

---

## 1. システムアーキテクチャ

### 1.1 全体構成

本システムは、順方向同期システムと組み合わせることで、**双方向同期**を実現します。

| コンポーネント | 順方向の役割 | 逆方向の役割 |
| :--- | :--- | :--- |
| **Obsidian** | 記事の作成・編集 | マージ後の最新内容を表示 |
| **GitHub** | バージョン管理、Webhookトリガー | プルリクエスト受信、レビュー、マージ |
| **n8n** | Obsidian→note.comの投稿 | note.com→GitHubのPR作成 |
| **note-MCP-server** | note.com APIへの投稿 | note.com APIからのデータ取得 |
| **note.com** | 下書きの保存先 | 手動編集の起点 |

### 1.2 データフロー

![逆方向同期フロー](https://private-us-east-1.manuscdn.com/sessionFile/nEqrfZfPUuYg5Tcrg8P6ED/sandbox/xSqCMXg4sTO4gXl2yONiSE-images_1762527224010_na1fn_L2hvbWUvdWJ1bnR1L3JldmVyc2Vfc3luY19mbG93.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbkVxcmZaZlBVdVlnNVRjcmc4UDZFRC9zYW5kYm94L3hTcUNNWGc0c1RPNGdYbDJ5T05pU0UtaW1hZ2VzXzE3NjI1MjcyMjQwMTBfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzSmxkbVZ5YzJWZmMzbHVZMTltYkc5My5wbmciLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=imY0n2sQ1qkczSshlQeKwcR9F3X0Fzn3k8fq96ERJl~uJBvmZ532-UHUCSiZqxA8Hov-~QQ~xyqDOFBNt6gkh8aa8jyCQO1Ez2Bk0W4ClcFxXov6Cq6XcQN~~RuTAwlH8IfWBVM47oyx2rEgRbSE3859maDcOlbKhbTxzqkXbgBdoIBFHqNV7SfUU1oskF2aPrIkxR2xtTbzYnFYXk9H8ew6PdqRkph4k2ATCBq9tRRbzUMcvxoqKw-6SeqoOcI1d4hcEHJAYJeYHEFYb2KExBZIL6J6G22LTwHOGLkskRwgQRg~c5eWFql8kk9TSzdHngDNqpknh~NbscRFTeAnEg__)

1. ユーザーがnote.comのWebエディタで下書きを手動編集します。
2. n8nの定期トリガー（1時間ごと）がワークフローを起動します。
3. n8nが`.note-mapping.json`を読み込み、note.comの下書き一覧を取得します。
4. n8nが更新日時を比較し、変更があった記事を検出します。
5. n8nが変更された記事の詳細（HTML本文）を取得し、Markdownに変換します。
6. n8nがGitHubに新しいブランチを作成し、Markdownファイルを更新します。
7. n8nがプルリクエストを作成し、Discord/Slackで通知します。
8. ユーザーがGitHub上でPRをレビュー・マージします。
9. マージをトリガーに、既存の順方向ワークフローが実行され、`.note-mapping.json`が更新されます。

---

## 2. `.note-mapping.json`の拡張

逆方向同期をサポートするため、マッピングファイルに`note_updated_at`フィールドを追加します。

### 2.1 拡張後のファイル構造

```json
{
  "version": "1.0",
  "last_updated": "2025-11-07T12:34:56Z",
  "mappings": {
    "articles/tech/ai-automation.md": {
      "note_id": "n4f0c7b884789",
      "title": "AI自動化の未来",
      "created_at": "2025-11-01T10:00:00Z",
      "updated_at": "2025-11-07T12:34:56Z",
      "note_updated_at": "2025-11-07T12:34:56Z"
    }
  }
}
```

### 2.2 フィールド説明

| フィールド | 説明 |
| :--- | :--- |
| `note_updated_at` | note.com側で最後に確認された更新日時。逆方向同期の変更検知に使用されます。 |

---

## 3. n8nワークフロー設計

### 3.1 ワークフロー1: 変更検知とデータ取得

このワークフローは、定期的にnote.comをチェックし、変更があった記事の情報を次のワークフローに渡します。

#### ノード構成

| ノード名 | タイプ | 役割 |
| :--- | :--- | :--- |
| **Schedule Trigger** | Trigger | 1時間ごとにワークフローを起動 |
| **GitHub (マッピングファイル取得)** | API | `.note-mapping.json`を取得 |
| **HTTP Request (下書き一覧取得)** | API | note-MCP-serverから下書き一覧を取得 |
| **Code (変更検知)** | Function | 更新日時を比較し、変更があった記事をリストアップ |
| **IF (変更の有無をチェック)** | Conditional | 変更がない場合はワークフローを終了 |
| **SplitInBatches** | Loop | 変更があった記事を1つずつ処理 |
| **HTTP Request (記事詳細取得)** | API | note-MCP-serverから記事の詳細を取得 |
| **Code (HTML→Markdown変換)** | Function | HTML本文をMarkdownに変換 |
| **Set (データ準備)** | Function | 次のワークフローに渡すデータを整形 |

#### 主要ノードのコード例

**Code: 変更検知**

```javascript
const myNotes = $input.item.json.result.data.notes;
const mappingData = $node["GitHub: Get Mapping File"].json.content ? JSON.parse(Buffer.from($node["GitHub: Get Mapping File"].json.content, 'base64').toString('utf-8')) : { mappings: {} };

const updatedNotes = [];

const noteIdToPathMap = Object.entries(mappingData.mappings).reduce((acc, [path, data]) => {
  if (data.note_id) {
    acc[data.note_id] = { path, ...data };
  }
  return acc;
}, {});

for (const note of myNotes) {
  const mappingInfo = noteIdToPathMap[note.key];
  if (!mappingInfo) continue;

  const noteUpdatedAt = new Date(note.updated_at);
  const mappingNoteUpdatedAt = new Date(mappingInfo.note_updated_at || 0);

  if (noteUpdatedAt > mappingNoteUpdatedAt) {
    updatedNotes.push({
      note_id: note.key,
      file_path: mappingInfo.path,
      note_updated_at: note.updated_at
    });
  }
}

return updatedNotes;
```

**Code: HTML→Markdown変換**

```javascript
const noteData = $input.item.json.result.data;
const htmlBody = noteData.body;

let markdownBody = htmlBody
  .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
  .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
  .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
  .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
  .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
  .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<a href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
  .replace(/<[^>]+>/g, '');

const frontmatter = `---
title: "${noteData.name}"
tags: [${noteData.hashtags.map(t => `"${t.hashtag.name}"`).join(', ')}]
---

`;

const newMarkdownContent = frontmatter + markdownBody;

return {
  newMarkdownContent: newMarkdownContent,
  title: noteData.name,
  note_id: noteData.key
};
```

### 3.2 ワークフロー2: プルリクエスト作成

このワークフローは、ワークフロー1から渡されたデータを使って、GitHubにプルリクエストを作成します。

#### ノード構成

| ノード名 | タイプ | 役割 |
| :--- | :--- | :--- |
| **Start / Webhook** | Trigger | ワークフロー1からのデータを受信 |
| **GitHub (ブランチ作成)** | API | `bot/update-{note_id}`という名前のブランチを作成 |
| **GitHub (ファイル作成/更新)** | API | 新しいブランチにMarkdownファイルを作成/更新 |
| **GitHub (プルリクエスト作成)** | API | プルリクエストを作成 |
| **IF (PR重複チェック)** | Conditional | 既に同じPRが存在する場合はスキップ |
| **Discord/Slack (通知)** | API | 新しいPRが作成されたことを通知 |

#### 主要ノードの設定例

**GitHub: ブランチ作成**

- **Branch Name**: `bot/update-{{ $json.note_id }}`
- **Source Branch**: `main`

**GitHub: ファイル作成/更新**

- **File Path**: `{{ $json.file_path }}`
- **Content**: `{{ $json.new_content }}`
- **Branch**: `bot/update-{{ $json.note_id }}`
- **Commit Message**: `[BOT] Update content from note.com: {{ $json.title }}`

**GitHub: プルリクエスト作成**

- **Title**: `[note.com Sync] Update: {{ $json.title }}`
- **Head Branch**: `bot/update-{{ $json.note_id }}`
- **Base Branch**: `main`
- **Body**:

```markdown
note.comで編集された内容を同期します。

**記事タイトル**: {{ $json.title }}
**note ID**: {{ $json.note_id }}

内容を確認してマージしてください。
```

---

## 4. マージ後の同期フロー

PRがマージされた後、既存の**順方向同期ワークフロー**が自動的に実行され、`.note-mapping.json`が更新されます。

### 4.1 順方向ワークフローの修正

順方向同期ワークフローの「Code: Update Mapping Object」ノードに、`note_updated_at`を更新するロジックを追加します。

```javascript
// ... 既存のロジック ...

const filePath = originalData.filePath;
const newNoteId = postResult.key;
const noteUpdatedAt = postResult.updated_at; // note.comからのレスポンス

if (mappingData.mappings[filePath]) {
  mappingData.mappings[filePath].note_id = newNoteId;
  mappingData.mappings[filePath].title = originalData.title;
  mappingData.mappings[filePath].updated_at = new Date().toISOString();
  mappingData.mappings[filePath].note_updated_at = noteUpdatedAt; // この行を追加
} else {
  mappingData.mappings[filePath] = {
    note_id: newNoteId,
    title: originalData.title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    note_updated_at: noteUpdatedAt // この行を追加
  };
}

mappingData.last_updated = new Date().toISOString();

return { mappingData };
```

### 4.2 この方式の利点

- **ワークフローの再利用**: 新しいワークフローを作成する必要がなく、既存の仕組みを有効活用できます。
- **状態の整合性**: 順方向と逆方向の両方で同じマッピングファイルが更新されるため、データの整合性が保たれます。

---

## 5. セットアップ手順

### 5.1 前提条件

- 順方向同期システム（Obsidian → GitHub → note.com）が既に構築されていること
- note-MCP-serverがHTTP Streamable対応で起動していること
- Cloudflare Tunnelが設定されていること

### 5.2 n8nワークフローの作成

1. n8nで新しいワークフロー「note.com → GitHub (変更検知)」を作成します。
2. 上記の「ワークフロー1: 変更検知とデータ取得」に従ってノードを構築します。
3. 環境変数を設定:
   - `NOTE_MCP_SERVER_URL`: `https://abc-def-ghi.trycloudflare.com/mcp`
   - `GITHUB_TOKEN`: GitHub Personal Access Token
4. ワークフローを保存＆アクティブ化します。

5. n8nで新しいワークフロー「note.com → GitHub (PR作成)」を作成します。
6. 上記の「ワークフロー2: プルリクエスト作成」に従ってノードを構築します。
7. ワークフロー1の最後に「Execute Workflow」ノードを追加し、ワークフロー2を呼び出すように設定します。
8. ワークフローを保存＆アクティブ化します。

### 5.3 順方向ワークフローの修正

1. 既存の順方向同期ワークフローを開きます。
2. 「Code: Update Mapping Object」ノードを編集し、`note_updated_at`を更新するロジックを追加します（上記のコード例を参照）。
3. ワークフローを保存します。

### 5.4 通知設定（オプション）

1. Discord/SlackのインカミングWebhook URLを取得します。
2. n8nの「Discord/Slack (通知)」ノードにWebhook URLを設定します。

---

## 6. 運用フロー

### 6.1 note.comでの編集

1. ユーザーがnote.comのWebエディタで下書きを編集します（スマートフォンからでも可能）。
2. 編集内容を保存します。

### 6.2 自動同期

1. n8nが1時間ごとにnote.comをチェックします。
2. 変更が検知されると、自動的にGitHubのプルリクエストが作成されます。
3. Discord/Slackに通知が届きます。

### 6.3 レビュー＆マージ

1. ユーザーがGitHub上でPRを開き、変更内容（Diff）を確認します。
2. 問題がなければ、「Merge pull request」ボタンをクリックしてマージします。
3. マージをトリガーに、順方向ワークフローが実行され、`.note-mapping.json`が更新されます。

### 6.4 Obsidian/Cursorでの編集

1. Obsidian VaultがGitHubから最新の変更を取得します（Git Syncプラグインなどを使用）。
2. note.comで編集した内容が、Obsidian/Cursorで確認・編集できるようになります。

---

## 7. トラブルシューティング

### 7.1 変更が検知されない

- `.note-mapping.json`の`note_updated_at`フィールドが正しく更新されているか確認してください。
- note-MCP-serverの`get-my-notes`ツールが正しく動作しているか確認してください。

### 7.2 PRが重複して作成される

- 「IF (PR重複チェック)」ノードが正しく設定されているか確認してください。
- 同じブランチ名からのPRが既に存在する場合、GitHub APIはエラーを返します。

### 7.3 HTML→Markdown変換がうまくいかない

- 本ガイドで提供しているHTML→Markdown変換は簡易的なものです。
- より高精度な変換には、`turndown`などのライブラリを使用することを推奨します。
- n8nの`Code`ノードで`npm`パッケージをインストールして使用できます。

---

## 8. 今後の拡張案

### 8.1 より高精度なHTML→Markdown変換

`turndown`ライブラリを使用して、より正確な変換を実現できます。

```javascript
const TurndownService = require('turndown');
const turndownService = new TurndownService();
const markdown = turndownService.turndown(htmlBody);
```

### 8.2 画像の同期

note.comの画像URLをObsidianのローカル画像に変換し、GitHubにコミットする機能を追加できます。

### 8.3 コンフリクト検出

Obsidian側とnote.com側の両方で同時に編集された場合、コンフリクトを検出して警告する機能を追加できます。

### 8.4 自動マージ

信頼性が確保できた場合、人間のレビューをスキップして自動マージする機能を追加できます。

---

## 9. まとめ

本ガイドで提示したシステムにより、note.comでの手動編集とObsidianでの編集を、安全かつ効率的に両立させることが可能になります。

### 主な利点

- **柔軟な編集環境**: note.comのWebエディタ（スマートフォン対応）とObsidian/Cursor（デスクトップ）の両方で編集できます。
- **安全なレビュー**: 変更内容をプルリクエストとして確認してからマージできます。
- **状態の整合性**: `.note-mapping.json`が常に最新の状態に保たれます。
- **自動化**: 定期的な変更検知とPR作成が完全に自動化されます。

この設計により、順方向と逆方向の双方向同期が完成し、Obsidianとnote.comの間でシームレスなコンテンツ管理が実現します。

---

**作成者**: Manus AI  
**最終更新日**: 2025年11月7日
