/**
 * .note-mapping.json 管理ユーティリティ
 * GitHubリポジトリ内のマッピングファイルを管理
 */

/**
 * マッピングファイルの初期化
 * ファイルが存在しない場合は空のテンプレートを作成
 * 
 * @param {Object} mappingFileInput - GitHub APIからのファイル取得結果
 * @returns {Object} マッピングデータオブジェクト
 */
function initializeMapping(mappingFileInput) {
  let mappingData;
  
  if (mappingFileInput && mappingFileInput.content) {
    // ファイルが存在する場合、デコードしてパース
    const decodedContent = Buffer.from(mappingFileInput.content, 'base64').toString('utf-8');
    try {
      mappingData = JSON.parse(decodedContent);
    } catch (e) {
      console.error('Failed to parse mapping file:', e);
      mappingData = createEmptyMapping();
    }
  } else {
    // ファイルが存在しない場合、空のテンプレートを作成
    mappingData = createEmptyMapping();
  }
  
  return mappingData;
}

/**
 * 空のマッピングテンプレートを作成
 * 
 * @returns {Object} 空のマッピングデータ
 */
function createEmptyMapping() {
  return {
    version: "1.0",
    last_updated: new Date().toISOString(),
    mappings: {}
  };
}

/**
 * マッピングデータからnote_idを取得
 * 
 * @param {Object} mappingData - マッピングデータ
 * @param {string} filePath - ファイルパス（リポジトリルートからの相対パス）
 * @returns {string|null} note_id（存在しない場合はnull）
 */
function getNoteId(mappingData, filePath) {
  if (!mappingData || !mappingData.mappings) {
    return null;
  }
  
  const mapping = mappingData.mappings[filePath];
  return mapping && mapping.note_id ? mapping.note_id : null;
}

/**
 * マッピングデータを更新
 * 
 * @param {Object} mappingData - 既存のマッピングデータ
 * @param {string} filePath - ファイルパス
 * @param {string} noteId - note.comの記事ID
 * @param {string} title - 記事タイトル
 * @param {string} noteUpdatedAt - note.com側の更新日時（オプション）
 * @returns {Object} 更新されたマッピングデータ
 */
function updateMapping(mappingData, filePath, noteId, title, noteUpdatedAt = null) {
  if (!mappingData.mappings) {
    mappingData.mappings = {};
  }
  
  const now = new Date().toISOString();
  
  if (mappingData.mappings[filePath]) {
    // 既存エントリの更新
    mappingData.mappings[filePath].note_id = noteId;
    mappingData.mappings[filePath].title = title;
    mappingData.mappings[filePath].updated_at = now;
    if (noteUpdatedAt) {
      mappingData.mappings[filePath].note_updated_at = noteUpdatedAt;
    }
  } else {
    // 新規エントリの作成
    mappingData.mappings[filePath] = {
      note_id: noteId,
      title: title,
      created_at: now,
      updated_at: now
    };
    if (noteUpdatedAt) {
      mappingData.mappings[filePath].note_updated_at = noteUpdatedAt;
    }
  }
  
  mappingData.last_updated = now;
  
  return mappingData;
}

/**
 * マッピングデータに変更があったかをチェック
 * 
 * @param {Object} initialMapping - 初期のマッピングデータ
 * @param {Object} updatedMapping - 更新後のマッピングデータ
 * @returns {boolean} 変更があった場合true
 */
function hasMappingChanges(initialMapping, updatedMapping) {
  return JSON.stringify(initialMapping) !== JSON.stringify(updatedMapping);
}

/**
 * マッピングファイルをBase64エンコード
 * GitHub APIに送信するために使用
 * 
 * @param {Object} mappingData - マッピングデータ
 * @returns {string} Base64エンコードされたJSON文字列
 */
function encodeMapping(mappingData) {
  const jsonString = JSON.stringify(mappingData, null, 2);
  return Buffer.from(jsonString, 'utf-8').toString('base64');
}

/**
 * note_idからファイルパスを逆引き
 * 逆方向同期で使用
 * 
 * @param {Object} mappingData - マッピングデータ
 * @param {string} noteId - note.comの記事ID
 * @returns {string|null} ファイルパス（見つからない場合はnull）
 */
function getFilePathByNoteId(mappingData, noteId) {
  if (!mappingData || !mappingData.mappings) {
    return null;
  }
  
  for (const [filePath, mapping] of Object.entries(mappingData.mappings)) {
    if (mapping.note_id === noteId) {
      return filePath;
    }
  }
  
  return null;
}

/**
 * 更新が必要な記事を検出
 * 逆方向同期で使用
 * 
 * @param {Object} mappingData - マッピングデータ
 * @param {Array} notes - note.comから取得した下書き一覧
 * @returns {Array} 更新が必要な記事のリスト
 */
function detectUpdatedNotes(mappingData, notes) {
  const updatedNotes = [];
  
  if (!mappingData || !mappingData.mappings || !notes) {
    return updatedNotes;
  }
  
  // note_idからファイルパスへの逆引きマップを作成
  const noteIdToPathMap = {};
  for (const [filePath, mapping] of Object.entries(mappingData.mappings)) {
    if (mapping.note_id) {
      noteIdToPathMap[mapping.note_id] = {
        filePath,
        ...mapping
      };
    }
  }
  
  // note.comの下書き一覧をチェック
  for (const note of notes) {
    const mappingInfo = noteIdToPathMap[note.key];
    if (!mappingInfo) continue;
    
    const noteUpdatedAt = new Date(note.updated_at);
    const mappingNoteUpdatedAt = new Date(mappingInfo.note_updated_at || 0);
    
    if (noteUpdatedAt > mappingNoteUpdatedAt) {
      updatedNotes.push({
        note_id: note.key,
        file_path: mappingInfo.filePath,
        note_updated_at: note.updated_at,
        title: note.name || mappingInfo.title
      });
    }
  }
  
  return updatedNotes;
}

module.exports = {
  initializeMapping,
  createEmptyMapping,
  getNoteId,
  updateMapping,
  hasMappingChanges,
  encodeMapping,
  getFilePathByNoteId,
  detectUpdatedNotes
};

