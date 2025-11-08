import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { noteApiRequest } from "../utils/api-client.js";
import { formatNote, formatComment, formatLike } from "../utils/formatters.js";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createAuthErrorResponse,
  handleApiError 
} from "../utils/error-handler.js";
import { 
  hasAuth,
  buildAuthHeaders,
  getPreviewAccessToken,
} from "../utils/auth.js";
import { env } from "../config/environment.js";

export function registerNoteTools(server: McpServer) {
  // 1. 記事詳細取得ツール
  server.tool(
    "get-note",
    "記事の詳細情報を取得する",
    {
      noteId: z.string().describe("記事ID（例: n4f0c7b884789）"),
    },
    async ({ noteId }) => {
      try {
        const params = new URLSearchParams({
          draft: "true",
          draft_reedit: "false",
          ts: Date.now().toString()
        });
        
        const data = await noteApiRequest(
          `/v3/notes/${noteId}?${params.toString()}`, 
          "GET",
          null,
          true
        );

        const noteData = data.data || {};
        const formattedNote = formatNote(noteData);

        return createSuccessResponse(formattedNote);
      } catch (error) {
        return handleApiError(error, "記事取得");
      }
    }
  );

  // 2. コメント一覧取得ツール
  server.tool(
    "get-comments",
    "記事へのコメント一覧を取得する",
    {
      noteId: z.string().describe("記事ID"),
    },
    async ({ noteId }) => {
      try {
        const data = await noteApiRequest(`/v1/note/${noteId}/comments`);

        let formattedComments: any[] = [];
        if (data.comments) {
          formattedComments = data.comments.map(formatComment);
        }

        return createSuccessResponse({
          comments: formattedComments
        });
      } catch (error) {
        return handleApiError(error, "コメント取得");
      }
    }
  );

  // 3. スキ取得ツール
  server.tool(
    "get-likes",
    "記事のスキ一覧を取得する",
    {
      noteId: z.string().describe("記事ID"),
    },
    async ({ noteId }) => {
      try {
        const data = await noteApiRequest(`/v3/notes/${noteId}/likes`);

        let formattedLikes: any[] = [];
        if (data.data && data.data.likes) {
          formattedLikes = data.data.likes.map(formatLike);
        }

        return createSuccessResponse({
          likes: formattedLikes
        });
      } catch (error) {
        return handleApiError(error, "スキ一覧取得");
      }
    }
  );
