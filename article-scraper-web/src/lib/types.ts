export interface Article {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}
