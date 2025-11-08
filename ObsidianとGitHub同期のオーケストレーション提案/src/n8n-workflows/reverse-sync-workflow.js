/**
 * 逆方向同期ワークフロー（note.com → GitHub）
 * n8nのCodeノードで使用するJavaScriptコード
 */

const { htmlToMarkdown, generateFrontmatter } = require('../utils/markdown-converter');
const { initializeMapping, detectUpdatedNotes } = require('../utils/mapping-manager');

/**
 * Node: Code - 変更検知
 * note.comの下書き一覧とマッピングファイルを比較し、更新が必要な記事を検出
 */
function detectChanges() {
  const myNotes = $input.item.json.result.data.notes;
  const mappingFileInput = $node["GitHub: Get Mapping File"].json;
  
  // マッピングファイルを初期化
  const mappingData = initializeMapping(mappingFileInput);
  
  // 更新が必要な記事を検出
  const updatedNotes = detectUpdatedNotes(mappingData, myNotes);
  
  return updatedNotes;
}

/**
 * Node: Code - HTML→Markdown変換
 * note.comから取得したHTML本文をMarkdownに変換
 */
function convertHtmlToMarkdown() {
  const noteData = $input.item.json.result.data;
  const htmlBody = noteData.body;
  
  // HTML to Markdown変換
  const markdownBody = htmlToMarkdown(htmlBody);
  
  // Frontmatterを生成
  const tags = noteData.hashtags ? noteData.hashtags.map(t => t.hashtag.name) : [];
  const frontmatterData = {
    title: noteData.name || '無題',
    tags: tags
  };
  
  const newMarkdownContent = generateFrontmatter(frontmatterData, markdownBody);
  
  return {
    newMarkdownContent: newMarkdownContent,
    title: noteData.name || '無題',
    note_id: noteData.key,
    file_path: $node["Code: Detect Changes"].json.file_path
  };
}

/**
 * GitHub PR作成用のデータ準備
 */
function preparePRData() {
  const conversionResult = $input.item.json;
  const changeInfo = $node["Code: Detect Changes"].json;
  
  return {
    branch_name: `bot/update-${changeInfo.note_id}`,
    file_path: changeInfo.file_path,
    file_content: conversionResult.newMarkdownContent,
    title: conversionResult.title,
    note_id: changeInfo.note_id,
    commit_message: `[BOT] Update content from note.com: ${conversionResult.title}`,
    pr_title: `[note.com Sync] Update: ${conversionResult.title}`,
    pr_body: `note.comで編集された内容を同期します。

**記事タイトル**: ${conversionResult.title}
**note ID**: ${changeInfo.note_id}

内容を確認してマージしてください。`
  };
}

/**
 * PR重複チェック用の関数
 * 既に同じブランチからのPRが存在するかチェック
 */
function checkPRExists(existingPRs, branchName) {
  if (!existingPRs || !Array.isArray(existingPRs)) {
    return false;
  }
  
  return existingPRs.some(pr => pr.head.ref === branchName);
}

module.exports = {
  detectChanges,
  convertHtmlToMarkdown,
  preparePRData,
  checkPRExists
};

