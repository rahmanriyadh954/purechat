export type SearchResultType = "user" | "chat" | "message" | "attachment";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  preview?: string;
};
