"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, ChatSession, StreamChunk } from "@/lib/types/chat";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Load messages when session changes
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as ChatMessage[]);
      });
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load session list
  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (data) setSessions(data as ChatSession[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    async (content: string, jurisdictions?: string[]) => {
      if (isStreaming) return;
      setIsStreaming(true);
      setError(null);

      // Optimistically add user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        session_id: sessionId || "",
        role: "user",
        content,
        citations: [],
        created_at: new Date().toISOString(),
      };

      // Add placeholder assistant message
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        session_id: sessionId || "",
        role: "assistant",
        content: "",
        citations: [],
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            session_id: sessionId,
            jurisdictions,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `Request failed (${res.status})`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const chunk: StreamChunk = JSON.parse(line.slice(6));

              if (chunk.error) {
                setError(chunk.error);
              }

              if (chunk.text) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + chunk.text,
                  };
                  return updated;
                });
              }

              if (chunk.done) {
                if (chunk.session_id && chunk.session_id !== sessionId) {
                  setSessionId(chunk.session_id);
                }
                if (chunk.citations) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    updated[updated.length - 1] = {
                      ...last,
                      citations: chunk.citations!,
                    };
                    return updated;
                  });
                }
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send message"
        );
        // Remove empty assistant placeholder on error
        setMessages((prev) =>
          prev.filter((m) => m.content.length > 0 || m.role === "user")
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [sessionId, isStreaming] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const newSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setError(null);
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      await supabase.from("chat_sessions").delete().eq("id", id);
      if (id === sessionId) {
        newSession();
      }
      loadSessions();
    },
    [sessionId, newSession, loadSessions] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    messages,
    sessionId,
    sessions,
    isStreaming,
    error,
    sendMessage,
    setSessionId,
    newSession,
    loadSessions,
    deleteSession,
  };
}
