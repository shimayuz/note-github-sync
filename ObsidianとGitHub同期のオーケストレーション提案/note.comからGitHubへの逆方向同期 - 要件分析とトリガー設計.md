# note.comからGitHubへの逆方向同期 - 要件分析とトリガー設計

## 1. システム概要

本システムは、先に設計した「Obsidian → GitHub → note.com」の順方向同期システムの逆方向として、**note.comで手動編集した下書きの変更内容を自動的にGitHubに反映**し、Obsidian/Cursorで編集可能にするものです。

### 1.1 ユースケース

- ユーザーがnote.comのWebエディタで下書きを直接編集する（スマートフォンからの編集など）
- 編集内容をGitHubリポジトリに反映させたい
- 変更内容をプルリクエストまたはIssueとして提案し、人間がレビュー・マージする
- マージ後、Obsidian VaultやCursorで最新の内容を編集できる

### 1.2 システムフロー

```
note.com (手動編集) → n8n (定期チェック) → 変更検知 → GitHub (PR/Issue作成) → 人間がマージ → Obsidian/Cursor (同期完了)
```

---

## 2. 要件分析

### 2.1 機能要件

| 要件 | 説明 |
| :--- | :--- |
| **変更検知** | note.comの下書きが更新されたことを自動的に検知する |
| **差分抽出** | `.note-mapping.json`と照合し、どのファイルが変更されたかを特定する |
| **HTML→Markdown変換** | note.comから取得したHTML形式の本文をMarkdownに変換する |
| **PR/Issue生成** | 変更内容をGitHubのプルリクエストまたはIssueとして自動作成する |
| **人間によるレビュー** | 自動マージではなく、人間がレビュー・承認してからマージする |
| **Obsidian同期** | マージ後、Obsidian VaultがGitHubから最新の変更を取得する |

### 2.2 非機能要件

| 要件 | 説明 |
| :--- | :--- |
| **定期実行** | n8nのスケジューラーで定期的に変更をチェックする（例: 1時間ごと） |
| **冪等性** | 同じ変更を複数回検知しても、重複したPR/Issueを作成しない |
| **エラーハンドリング** | note.com APIエラーやGitHub APIエラーを適切に処理する |
| **通知** | PR/Issue作成時にSlackやDiscordで通知する（オプション） |

---

## 3. トリガー設計

### 3.1 トリガー方式の比較

note.comからの変更を検知する方式として、以下の3つを検討します。

| 方式 | 説明 | メリット | デメリット |
| :--- | :--- | :--- | :--- |
| **定期ポーリング** | n8nのスケジューラーで定期的にnote.comをチェック | 実装が簡単 | リアルタイム性が低い、API呼び出しが多い |
| **Webhook** | note.comからWebhookを受信 | リアルタイム、効率的 | note.comはWebhook機能を提供していない |
| **手動トリガー** | ユーザーがn8nのWebhookを手動で呼び出す | 確実 | 自動化されない |

### 3.2 推奨方式: 定期ポーリング

**note.comは現時点でWebhook機能を提供していない**ため、**定期ポーリング方式**を採用します。

#### 実装方法

- n8nの`Schedule Trigger`ノードを使用し、定期的にワークフローを起動します。
- 起動間隔は、ユーザーの編集頻度に応じて設定します（推奨: 1時間〜6時間ごと）。
- note-MCP-serverの`get-my-notes`ツールを使用して、自分の下書き一覧を取得します。
- `.note-mapping.json`と照合し、`updated_at`が新しくなっているファイルを検出します。

---

## 4. 変更検知のロジック

### 4.1 `.note-mapping.json`の拡張

逆方向同期をサポートするため、マッピングファイルに`note_updated_at`フィールドを追加します。

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

### 4.2 変更検知のアルゴリズム

1. note-MCP-serverから下書き一覧を取得します。
2. 各下書きの`note_id`を使って、`.note-mapping.json`から対応するファイルパスを検索します。
3. note.comの`updated_at`と`.note-mapping.json`の`note_updated_at`を比較します。
4. note.comの方が新しい場合、変更があったと判断します。

---

## 5. トリガー設計のまとめ

| 項目 | 設計内容 |
| :--- | :--- |
| **トリガー方式** | 定期ポーリング（n8nのSchedule Trigger） |
| **実行間隔** | 1時間〜6時間ごと（ユーザーが設定可能） |
| **変更検知** | `.note-mapping.json`の`note_updated_at`とnote.comの`updated_at`を比較 |
| **データ取得** | note-MCP-serverの`get-my-notes`と`get-note`ツールを使用 |
| **冪等性** | 既に作成済みのPR/Issueは再作成しない（タイトルやブランチ名で判定） |

次のフェーズでは、note-MCP-serverを使った具体的な変更検知とデータ取得のワークフローを設計します。
