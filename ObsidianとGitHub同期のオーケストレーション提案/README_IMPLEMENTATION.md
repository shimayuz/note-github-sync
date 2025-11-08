# Obsidian ⇄ note.com 双方向同期システム - 実装完了ガイド

## ✅ 実装完了項目

### 1. コアユーティリティ

- ✅ **Markdown ↔ HTML変換ユーティリティ** (`src/utils/markdown-converter.js`)
  - MarkdownからHTMLへの変換（note.com投稿用）
  - HTMLからMarkdownへの変換（逆方向同期用）
  - Frontmatterのパースと生成

- ✅ **マッピング管理ユーティリティ** (`src/utils/mapping-manager.js`)
  - `.note-mapping.json`の初期化と管理
  - note_idの取得と更新
  - 変更検知機能
  - 逆方向同期用の更新検出

### 2. n8nワークフロー実装

- ✅ **順方向同期ワークフロー** (`src/n8n-workflows/forward-sync-workflow.js`)
  - GitHub Webhookトリガー
  - Markdownファイルのパース
  - note-MCP-server連携
  - マッピングファイルの更新

- ✅ **逆方向同期ワークフロー** (`src/n8n-workflows/reverse-sync-workflow.js`)
  - 定期トリガー（1時間ごと）
  - note.com変更検知
  - HTML→Markdown変換
  - GitHub PR作成

### 3. 設定ファイルとドキュメント

- ✅ **実装ガイド** (`IMPLEMENTATION_GUIDE.md`)
  - セットアップ手順
  - ワークフロー設定方法
  - トラブルシューティング

- ✅ **マッピングファイル例** (`.note-mapping.json.example`)
  - テンプレート構造
  - フィールド説明

- ✅ **n8nワークフロー設定例** (`n8n-workflow-configs/forward-sync-config.json`)
  - 順方向同期ワークフローのJSON設定

## 📋 セットアップ手順

### ステップ1: 依存パッケージのインストール

```bash
cd "ObsidianとGitHub同期のオーケストレーション提案"
npm install
```

### ステップ2: note-MCP-serverのセットアップ

詳細は `IMPLEMENTATION_GUIDE.md` を参照してください。

### ステップ3: n8nワークフローのインポート

1. n8nにログイン
2. 「Workflows」→「Import from File」
3. `n8n-workflow-configs/forward-sync-config.json` をインポート
4. 環境変数を設定:
   - `NOTE_MCP_SERVER_URL`: Cloudflare TunnelのURL
   - `GITHUB_TOKEN`: GitHub Personal Access Token

### ステップ4: GitHub Webhookの設定

1. GitHubリポジトリの `Settings` > `Webhooks` に移動
2. n8nのWebhook URLを設定
3. `Content type`: `application/json`
4. `Just the push event` を選択

## 🔧 使用方法

### 新規記事の投稿

1. ObsidianでMarkdownファイルを作成:

```markdown
---
title: "記事タイトル"
tags: ["タグ1", "タグ2"]
---

## はじめに

記事の本文をここに記述します。
```

2. GitHubにプッシュ
3. n8nワークフローが自動的に起動
4. note.comに下書きが作成される
5. `.note-mapping.json`が更新される

### 既存記事の更新

1. Obsidianで既存のMarkdownファイルを編集
2. GitHubにプッシュ
3. n8nワークフローが既存の下書きを更新

### note.comでの編集

1. note.comのWebエディタで下書きを編集
2. 編集内容を保存
3. n8nが1時間ごとに変更をチェック
4. 変更が検知されるとGitHubにPRが作成される
5. PRをレビュー・マージ
6. Obsidianで最新の内容を確認

## 📝 コードの使用方法

### n8nのCodeノードでの使用

各ワークフローのCodeノードには、対応するJavaScriptファイルの関数をコピーして使用します。

#### 順方向同期の例

```javascript
// Code: マッピング初期化 ノード
const { initializeMapping } = require('./src/utils/mapping-manager');
const mappingData = initializeMapping($input.item.json);
return { mappingData };
```

#### 逆方向同期の例

```javascript
// Code: HTML→Markdown変換 ノード
const { htmlToMarkdown, generateFrontmatter } = require('./src/utils/markdown-converter');
const markdownBody = htmlToMarkdown($input.item.json.result.data.body);
// ... 続き
```

## 🐛 トラブルシューティング

### マッピングファイルが更新されない

- n8nの実行ログを確認
- `Code: 変更チェック`ノードの出力を確認
- `hasChanges`が`true`になっているか確認

### note IDが見つからない

- `.note-mapping.json`に該当するファイルパスのエントリが存在するか確認
- ファイルパスはリポジトリルートからの相対パスである必要があります

### HTML→Markdown変換がうまくいかない

- 簡易的な実装のため、複雑なHTML構造には対応していません
- より高精度な変換には`turndown`ライブラリの使用を推奨します

## 📚 参考ドキュメント

- [完全ガイド](./Obsidian%20⇄%20note.com%20双方向同期システム%20-%20完全ガイド.md)
- [実装ガイド](./IMPLEMENTATION_GUIDE.md)
- [最終実装ガイド](./Obsidian%20Vault%20to%20note.com%20自動下書きシステム%20-%20最終実装ガイド.md)
- [逆方向同期ガイド](./note.com%20→%20GitHub%20逆方向同期システム%20-%20最終実装ガイド.md)

## 🔄 今後の改善案

1. **より高精度なMarkdown変換**
   - `marked`や`turndown`ライブラリの統合
   - カスタムルールの追加

2. **画像の同期**
   - Obsidianの画像をnote.comにアップロード
   - note.comの画像をObsidianにダウンロード

3. **エラーハンドリングの強化**
   - リトライロジックの追加
   - エラー通知の改善

4. **パフォーマンスの最適化**
   - バッチ処理の改善
   - キャッシュ機能の追加

## 📄 ライセンス

MIT

