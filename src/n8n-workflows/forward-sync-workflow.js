/**
 * 順方向同期ワークフロー（GitHub → note.com）
 * n8nのCodeノードで使用するJavaScriptコード
 * 
 * このファイルは、n8nワークフローの各Codeノードにコピーして使用します
 */

const { markdownToHtml, parseFrontmatter } = require('../utils/markdown-converter');
const { initializeMapping, getNoteId, updateMapping, hasMappingChanges } = require('../utils/mapping-manager');

/**
 * Node: Code - マッピング初期化
 * GitHubから取得した.note-mapping.jsonをパースまたは初期化
 */
function initializeMappingNode() {
  const mappingFileInput = $input.item.json;
  const mappingData = initializeMapping(mappingFileInput);
  return { mappingData };
}

/**
 * Node: Code - パース＆note ID取得
 * Markdownファイルをパースし、マッピングからnote_idを取得
 */
function parseAndGetNoteId() {
  const fileContent = $input.item.json.content;
  const filePath = $input.item.json.path || $input.item.json.fileName; // GitHubから取得したファイルパス
  const mappingData = $node["Code: Initialize Mapping"].json.mappingData;
  
  // Base64デコード
  const decodedContent = Buffer.from(fileContent, 'base64').toString('utf-8');
  
  // Frontmatterパース
  const { data, content } = parseFrontmatter(decodedContent);
  
  // Markdown to HTML変換
  const htmlBody = markdownToHtml(content);
  
  // マッピングデータからnote_idを取得
  const note_id = getNoteId(mappingData, filePath);
  
  // タグを配列に変換
  let tags = [];
  if (data.tags) {
    if (Array.isArray(data.tags)) {
      tags = data.tags;
    } else {
      tags = data.tags.replace(/[\[\]]/g, '').split(',').map(t => t.trim());
    }
  }
  
  return {
    filePath: filePath,
    title: data.title || '無題',
    body: htmlBody,
    tags: tags,
    note_id: note_id,
    originalContent: decodedContent
  };
}

/**
 * Node: Code - マッピング更新
 * note.comへの投稿成功後、メモリ上のマッピングオブジェクトを更新
 */
function updateMappingObject() {
  const postResult = $input.item.json.result.data;
  const originalData = $node["Code: Parse & Get note_id"].json;
  let mappingData = $node["Code: Initialize Mapping"].json.mappingData;
  
  const filePath = originalData.filePath;
  const newNoteId = postResult.key;
  const noteUpdatedAt = postResult.updated_at || null;
  
  // マッピングデータを更新
  mappingData = updateMapping(
    mappingData,
    filePath,
    newNoteId,
    originalData.title,
    noteUpdatedAt
  );
  
  return { mappingData };
}

/**
 * Node: Code - 変更チェック
 * SplitInBatchesループ完了後、マッピングに変更があったかを確認
 */
function checkForMappingChanges() {
  const initialMapping = $node["Code: Initialize Mapping"].json.mappingData;
  
  // SplitInBatchesの最後のアイテムから更新されたマッピングを取得
  // 注意: 実際のn8nワークフローでは、ループ内で更新されたマッピングを
  // 適切に保持する必要があります
  const updatedMapping = $node["Code: Update Mapping Object"].json.mappingData;
  
  const hasChanges = hasMappingChanges(initialMapping, updatedMapping);
  
  if (hasChanges) {
    return {
      hasChanges: true,
      updatedMapping: updatedMapping
    };
  } else {
    return {
      hasChanges: false
    };
  }
}

/**
 * HTTP Request - note-MCP-server連携用のリクエストボディ生成
 */
function generateMCPRequest(title, body, tags, noteId) {
  return {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      tool_name: "post-draft-note",
      inputs: {
        title: title,
        body: body,
        tags: tags,
        id: noteId || null
      }
    },
    id: `n8n-workflow-${$workflow.id || 'unknown'}`
  };
}

// n8nで使用する場合は、各関数を個別にエクスポート
// 実際のn8nワークフローでは、各Codeノードに該当する関数の内容を直接記述します

module.exports = {
  initializeMappingNode,
  parseAndGetNoteId,
  updateMappingObject,
  checkForMappingChanges,
  generateMCPRequest
};

