/**
 * Markdown ↔ HTML 変換ユーティリティ
 * note.comとの同期で使用する変換ロジック
 */

/**
 * MarkdownをHTMLに変換
 * note.comの下書き投稿用に最適化
 * 
 * @param {string} markdown - Markdown形式のテキスト
 * @returns {string} HTML形式のテキスト
 */
function markdownToHtml(markdown) {
  if (!markdown) return '';
  
  let html = markdown;
  
  // 見出しの変換
  html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
  
  // 強調と斜体
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
  
  // コードブロック
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // リンク
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // 画像
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  
  // リスト（順序なし）
  html = html.replace(/^[\*\-\+]\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // リスト（順序あり）
  html = html.replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>');
  
  // 引用
  html = html.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');
  
  // 水平線
  html = html.replace(/^---$/gm, '<hr />');
  html = html.replace(/^\*\*\*$/gm, '<hr />');
  
  // 段落（空行で区切る）
  const paragraphs = html.split(/\n\s*\n/);
  html = paragraphs
    .map(p => p.trim())
    .filter(p => p && !p.match(/^<[hul]/)) // 既にタグが付いているものは除外
    .map(p => p.match(/^<[a-z]/) ? p : `<p>${p}</p>`)
    .join('\n\n');
  
  // 改行を<br>に変換（段落内）
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

/**
 * HTMLをMarkdownに変換
 * note.comからGitHubへの逆方向同期用
 * 
 * @param {string} html - HTML形式のテキスト
 * @returns {string} Markdown形式のテキスト
 */
function htmlToMarkdown(html) {
  if (!html) return '';
  
  let markdown = html;
  
  // HTMLタグを削除してテキストのみ抽出（簡易版）
  // より高精度な変換にはturndownライブラリの使用を推奨
  
  // 見出し
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
  
  // 段落
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  
  // 強調と斜体
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~');
  
  // コード
  markdown = markdown.replace(/<pre><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```');
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  
  // リンク
  markdown = markdown.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  // 画像
  markdown = markdown.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$2]($1)');
  
  // リスト
  markdown = markdown.replace(/<ul[^>]*>/gi, '');
  markdown = markdown.replace(/<\/ul>/gi, '\n');
  markdown = markdown.replace(/<ol[^>]*>/gi, '');
  markdown = markdown.replace(/<\/ol>/gi, '\n');
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  
  // 引用
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n');
  
  // 水平線
  markdown = markdown.replace(/<hr[^>]*\/?>/gi, '---\n');
  
  // 改行
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  
  // 残りのHTMLタグを削除
  markdown = markdown.replace(/<[^>]+>/g, '');
  
  // HTMLエンティティのデコード
  markdown = markdown.replace(/&nbsp;/g, ' ');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&quot;/g, '"');
  markdown = markdown.replace(/&#39;/g, "'");
  
  // 余分な改行を整理
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.trim();
  
  return markdown;
}

/**
 * Frontmatterをパース
 * 
 * @param {string} content - Markdownファイルの内容
 * @returns {{data: Object, content: string}} パースされたFrontmatterと本文
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)/);
  
  if (!match) {
    return { data: {}, content: content };
  }
  
  const frontmatterText = match[1];
  const bodyContent = match[2];
  
  // 簡易的なYAMLパーサー
  const data = {};
  frontmatterText.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) return;
    
    const key = trimmed.substring(0, colonIndex).trim();
    let value = trimmed.substring(colonIndex + 1).trim();
    
    // クォートを削除
    value = value.replace(/^['"]|['"]$/g, '');
    
    // 配列の処理
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map(v => v.trim().replace(/['"]/g, ''));
    }
    
    data[key] = value;
  });
  
  return { data, content: bodyContent };
}

/**
 * Frontmatterを生成
 * 
 * @param {Object} data - Frontmatterのデータ
 * @param {string} content - Markdown本文
 * @returns {string} 完全なMarkdownファイルの内容
 */
function generateFrontmatter(data, content) {
  const frontmatterLines = ['---'];
  
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      frontmatterLines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`);
    } else {
      frontmatterLines.push(`${key}: "${value}"`);
    }
  });
  
  frontmatterLines.push('---');
  
  return frontmatterLines.join('\n') + '\n\n' + content;
}

module.exports = {
  markdownToHtml,
  htmlToMarkdown,
  parseFrontmatter,
  generateFrontmatter
};

