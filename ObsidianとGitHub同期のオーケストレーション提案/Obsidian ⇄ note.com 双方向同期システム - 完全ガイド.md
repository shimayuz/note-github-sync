# Obsidian ⇄ note.com 双方向同期システム - 完全ガイド

**作成日**: 2025年11月7日  
**作成者**: Manus AI  
**対象**: Obsidian Vaultとnote.comの間で双方向の自動同期を実現するシステム

---

## エグゼクティブサマリー

本ガイドは、Obsidian Vaultとnote.comの間で、双方向の自動同期を実現するシステムの完全な実装方法を提供します。このシステムにより、Obsidianでの執筆とnote.comでの手動編集を、安全かつ効率的に両立させることが可能になります。

### システムの全体像

![双方向同期システム](https://private-us-east-1.manuscdn.com/sessionFile/nEqrfZfPUuYg5Tcrg8P6ED/sandbox/xSqCMXg4sTO4gXl2yONiSE-images_1762527222667_na1fn_L2hvbWUvdWJ1bnR1L2JpZGlyZWN0aW9uYWxfc3luYw.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbkVxcmZaZlBVdVlnNVRjcmc4UDZFRC9zYW5kYm94L3hTcUNNWGc0c1RPNGdYbDJ5T05pU0UtaW1hZ2VzXzE3NjI1MjcyMjI2NjdfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwySnBaR2x5WldOMGFXOXVZV3hmYzNsdVl3LnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=XclXJc2fkRg5UFietleITrPDeBZgrHUxrqcEy-NpBUl8fHTYqjJXIIoXNAWXAL8M05cRVO~Dt~4AlxM~WJpr3QLihiCq7u0LTQYDpJjp8v3Wqn6HAxdJv52fAkMT~~dvmq~Jgqa3~0S2vLMXAYxF0HPUsItnUoG6-0AXIz8ECzYHzDPOGeTxKPLz9~unUsWY6j72-ADn6SFeOjphFxCu21fCV4J-9XSbATwxrcp8R54txS048p7-ohlMERNb2VZo~Myf9yw9f~9dsGZrOqGcG-kBADqxBIGmU07XKSIHNZhjiRETV88bNu2TV6~-akyrdK12Po4ynKBHiikHogEP7Q__)

### 主な特徴

- **順方向同期 (Obsidian → note.com)**: Obsidianで記事を作成・編集し、GitHubにプッシュすると、自動的にnote.comの下書きとして投稿・更新されます。
- **逆方向同期 (note.com → Obsidian)**: note.comで手動編集した内容を、定期的に検知してGitHubのプルリクエストとして提案し、マージ後にObsidianで編集可能にします。
- **外部IDマッピング**: `.note-mapping.json`ファイルでファイルパスとnote IDの対応関係を一元管理し、競合を回避します。
- **人間によるレビュー**: 逆方向同期では、変更内容をプルリクエストとして確認してからマージできます。

---

## 1. システムアーキテクチャ

### 1.1 コンポーネント構成

| コンポーネント | 役割 | 環境 |
| :--- | :--- | :--- |
| **Obsidian** | 記事の作成・編集（デスクトップ環境） | ローカル |
| **GitHub** | バージョン管理、Webhookトリガー、`.note-mapping.json`の保存 | クラウド |
| **n8n** | 順方向・逆方向のワークフローオーケストレーション | クラウド/VPS |
| **note-MCP-server** | note.com APIラッパー（HTTP Streamable対応） | ローカル/VPS |
| **Cloudflare Tunnel** | note-MCP-serverへのセキュアなリモートアクセス | クラウド |
| **note.com** | 最終的な投稿先プラットフォーム（モバイル編集も可能） | クラウド |

### 1.2 データフロー

#### 順方向同期 (Obsidian → note.com)

1. ユーザーがObsidianで記事を執筆し、GitHubにプッシュします。
2. GitHubがWebhookをn8nに送信します。
3. n8nが`.note-mapping.json`を読み込み、変更されたファイルのnote IDを検索します。
4. n8nがMarkdownをHTMLに変換し、note-MCP-serverに投稿リクエストを送信します。
5. note-MCP-serverがnote.com APIを呼び出し、下書きを作成・更新します。
6. n8nがメモリ上のマッピングオブジェクトを更新し、最後に`.note-mapping.json`をGitHubにコミットします。

#### 逆方向同期 (note.com → Obsidian)

1. ユーザーがnote.comのWebエディタで下書きを手動編集します。
2. n8nの定期トリガー（1時間ごと）がワークフローを起動します。
3. n8nが`.note-mapping.json`を読み込み、note.comの下書き一覧を取得します。
4. n8nが更新日時を比較し、変更があった記事を検出します。
5. n8nが変更された記事の詳細（HTML本文）を取得し、Markdownに変換します。
6. n8nがGitHubに新しいブランチを作成し、Markdownファイルを更新します。
7. n8nがプルリクエストを作成し、Discord/Slackで通知します。
8. ユーザーがGitHub上でPRをレビュー・マージします。
9. マージをトリガーに、順方向ワークフローが実行され、`.note-mapping.json`が更新されます。

---

## 2. `.note-mapping.json`の仕様

### 2.1 配置場所

GitHubリポジトリのルートディレクトリに配置します。

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
      "updated_at": "2025-11-07T12:34:56Z",
      "note_updated_at": "2025-11-07T12:34:56Z"
    }
  }
}
```

### 2.3 フィールド説明

| フィールド | 説明 | 使用される同期方向 |
| :--- | :--- | :--- |
| `note_id` | note.comの記事ID（未投稿の場合は`null`） | 順方向・逆方向 |
| `title` | 記事のタイトル（参照用） | 順方向・逆方向 |
| `created_at` | 初回投稿日時 | 順方向 |
| `updated_at` | GitHubでの最終更新日時 | 順方向 |
| `note_updated_at` | note.com側で最後に確認された更新日時 | 逆方向 |

---

## 3. セットアップ手順

### 3.1 前提条件

- Obsidian VaultがGitHubリポジトリと同期されていること（Obsidian Git Syncプラグインなど）
- note.comのアカウントを持っていること
- n8nがインストールされていること（セルフホストまたはクラウド版）
- Node.jsがインストールされていること（note-MCP-server用）

### 3.2 note-MCP-serverのセットアップ

1. リポジトリをクローン:

   ```bash
   git clone https://github.com/shimayuz/note-mcp-server.git
   cd note-mcp-server
   ```

2. 依存パッケージをインストール:

   ```bash
   npm install
   ```

3. `.env`ファイルを作成し、note.comの認証情報を設定:

   ```env
   NOTE_EMAIL=your-email@example.com
   NOTE_PASSWORD=your-password
   ```

4. サーバーをビルド＆起動:

   ```bash
   npm run build
   npm run start:http
   ```

5. サーバーが`http://localhost:3000`で起動していることを確認します。

### 3.3 Cloudflare Tunnelのセットアップ

1. Cloudflare Tunnelをインストール:

   ```bash
   brew install cloudflare/cloudflare/cloudflared
   ```

2. Tunnelを起動:

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. 生成されたURLをメモします（例: `https://abc-def-ghi.trycloudflare.com`）。

### 3.4 GitHubのセットアップ

1. Obsidian記事管理用のリポジトリを作成します。
2. リポジトリのルートに`.note-mapping.json`を作成します（空のテンプレート）:

   ```json
   {
     "version": "1.0",
     "last_updated": "2025-11-07T00:00:00Z",
     "mappings": {}
   }
   ```

3. `Settings` > `Webhooks` > `Add webhook`をクリックします。
4. n8nで生成されたWebhook URLを設定します。
5. `Content type`を`application/json`に設定します。
6. `Just the push event`を選択します。

### 3.5 n8nワークフローのセットアップ

#### ワークフロー1: 順方向同期 (Obsidian → note.com)

1. n8nで新しいワークフローを作成します。
2. 「最終実装ガイド」（`final_implementation_guide.md`）の「n8nワークフロー設計」に従ってノードを構築します。
3. 環境変数を設定:
   - `NOTE_MCP_SERVER_URL`: `https://abc-def-ghi.trycloudflare.com/mcp`
   - `GITHUB_TOKEN`: GitHub Personal Access Token
4. ワークフローを保存＆アクティブ化します。

#### ワークフロー2: 逆方向同期 (note.com → Obsidian)

1. n8nで新しいワークフローを作成します。
2. 「逆方向同期最終実装ガイド」（`reverse_sync_final_guide.md`）の「n8nワークフロー設計」に従ってノードを構築します。
3. 環境変数を設定（ワークフロー1と同じ）。
4. ワークフローを保存＆アクティブ化します。

---

## 4. 運用フロー

### 4.1 Obsidianでの記事作成（順方向同期）

1. Obsidianで新しいMarkdownファイルを作成します。
2. Frontmatterに`title`と`tags`を記述します:

   ```yaml
   ---
   title: "記事タイトル"
   tags: ["タグ1", "タグ2"]
   ---
   ```

3. 記事の本文を執筆します。
4. GitHubにプッシュします（Obsidian Git Syncプラグインの場合、自動プッシュも可能）。
5. n8nワークフローが自動的に起動し、note.comに下書きを投稿します。
6. `.note-mapping.json`に新しいエントリが追加されます。

### 4.2 note.comでの手動編集（逆方向同期）

1. note.comのWebエディタ（スマートフォンからでも可能）で下書きを編集します。
2. 編集内容を保存します。
3. n8nが1時間ごとにnote.comをチェックし、変更を検知します。
4. 変更が検知されると、自動的にGitHubのプルリクエストが作成されます。
5. Discord/Slackに通知が届きます。
6. GitHub上でPRを開き、変更内容（Diff）を確認します。
7. 問題がなければ、「Merge pull request」ボタンをクリックしてマージします。
8. マージをトリガーに、順方向ワークフローが実行され、`.note-mapping.json`が更新されます。
9. Obsidian VaultがGitHubから最新の変更を取得します。

### 4.3 既存記事の更新（順方向同期）

1. Obsidianで既存のMarkdownファイルを編集します。
2. GitHubにプッシュします。
3. n8nワークフローが`.note-mapping.json`から`note_id`を検索します。
4. 既存の下書きが更新されます。
5. `.note-mapping.json`の`updated_at`と`note_updated_at`が更新されます。

---

## 5. トラブルシューティング

### 5.1 順方向同期の問題

#### マッピングファイルが更新されない

- n8nの`Code: Check for Mapping Changes`ノードのログを確認してください。
- `hasChanges`が`false`の場合、投稿が成功していない可能性があります。

#### note IDが見つからない

- `.note-mapping.json`に該当するファイルパスのエントリが存在するか確認してください。
- ファイルパスは、リポジトリのルートからの相対パスである必要があります。

### 5.2 逆方向同期の問題

#### 変更が検知されない

- `.note-mapping.json`の`note_updated_at`フィールドが正しく更新されているか確認してください。
- note-MCP-serverの`get-my-notes`ツールが正しく動作しているか確認してください。

#### PRが重複して作成される

- 「IF (PR重複チェック)」ノードが正しく設定されているか確認してください。
- 同じブランチ名からのPRが既に存在する場合、GitHub APIはエラーを返します。

#### HTML→Markdown変換がうまくいかない

- 本ガイドで提供しているHTML→Markdown変換は簡易的なものです。
- より高精度な変換には、`turndown`などのライブラリを使用することを推奨します。

### 5.3 共通の問題

#### note-MCP-serverに接続できない

- Cloudflare Tunnelが起動しているか確認してください。
- n8nの環境変数`NOTE_MCP_SERVER_URL`が正しく設定されているか確認してください。

#### GitHub APIのレート制限

- GitHub APIには、1時間あたり5000リクエストの制限があります。
- 大量のファイルを一度に処理する場合、制限に達する可能性があります。

---

## 6. 今後の拡張案

### 6.1 画像の双方向同期

Obsidianで使用している画像を、note.comの画像アップロードAPIを使って自動的にアップロードし、本文内のリンクを置き換えることができます。逆方向では、note.comの画像をダウンロードして、Obsidian Vaultに保存します。

### 6.2 予約投稿

Frontmatterに`publish_at`フィールドを追加し、n8nのスケジューラーと組み合わせることで、指定した日時に自動公開する機能を実装できます。

### 6.3 複数プラットフォーム対応

note.comだけでなく、ZennやQiitaなど、他のプラットフォームにも同時に投稿できるように、n8nワークフローを拡張できます。

### 6.4 コンフリクト検出

Obsidian側とnote.com側の両方で同時に編集された場合、コンフリクトを検出して警告する機能を追加できます。

### 6.5 削除の同期

Markdownファイルを削除した際に、対応するnote.comの記事も削除する機能を追加できます。逆方向では、note.comで記事を削除した際に、Obsidian Vaultからもファイルを削除します。

---

## 7. まとめ

本ガイドで提示したシステムにより、Obsidian Vaultとnote.comの間で、双方向の自動同期が実現します。

### 主な利点

- **柔軟な編集環境**: Obsidian（デスクトップ）とnote.com（モバイル）の両方で編集できます。
- **競合の完全回避**: Markdownファイルへの書き戻しを廃止し、ファイル競合のリスクを根本的に解消します。
- **Git履歴のクリーン化**: BOTによるコミットがマッピングファイルのみに限定され、記事の変更履歴が追いやすくなります。
- **安全なレビュー**: 逆方向同期では、変更内容をプルリクエストとして確認してからマージできます。
- **状態の整合性**: `.note-mapping.json`が常に最新の状態に保たれます。
- **完全自動化**: 順方向・逆方向の両方で、変更検知から同期まで完全に自動化されます。

この設計により、Obsidianでの執筆体験を損なうことなく、効率的で持続可能なコンテンツ公開ワークフローが実現します。

---

**作成者**: Manus AI  
**最終更新日**: 2025年11月7日

---

## 参考ドキュメント

- **順方向同期の詳細**: `final_implementation_guide.md`
- **逆方向同期の詳細**: `reverse_sync_final_guide.md`
- **ID管理方式の設計**: `multi_file_id_management.md`
- **n8nワークフロー設計**: `improved_n8n_workflow.md`
- **データベース構築**: `id_database_and_mapping.md`
