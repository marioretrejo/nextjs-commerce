export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  chunk_count: number;
}

export interface UploadForm {
  source_name: string;
  content: string;
}
