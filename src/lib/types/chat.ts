export interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  regulation_id: string;
  title: string;
  jurisdiction: string;
  source_url: string;
  chunk_type: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface StreamChunk {
  text: string;
  done: boolean;
  citations?: Citation[];
  session_id?: string;
  error?: string;
}
