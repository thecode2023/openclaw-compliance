"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Plus,
  Send,
  History,
  ArrowLeft,
  Trash2,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/components/providers/AuthProvider";
import { useChat } from "@/hooks/useChat";
import type { Citation } from "@/lib/types/chat";

const STARTER_QUESTIONS = [
  "What are the EU AI Act penalties for non-compliance?",
  "Which regulations require human oversight of AI decisions?",
  "Compare US and EU requirements for AI transparency",
  "What are the deadlines I should track this quarter?",
];

function CitationChips({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {citations.map((c) => (
        <a
          key={c.regulation_id}
          href={c.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
        >
          {c.title}
          <span className="text-primary/60">({c.jurisdiction})</span>
        </a>
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export function ChatWidget() {
  const { user, loading: authLoading } = useAuth();
  const {
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
  } = useChat();

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && view === "chat") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, view]);

  // Load session list when history view opens
  useEffect(() => {
    if (view === "history") {
      loadSessions();
    }
  }, [view, loadSessions]);

  if (authLoading) return null;
  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    sendMessage(trimmed);
  };

  const handleStarterQuestion = (question: string) => {
    sendMessage(question);
  };

  const handleSessionSelect = (id: string) => {
    setSessionId(id);
    setView("chat");
  };

  const handleNewChat = () => {
    newSession();
    setView("chat");
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
          aria-label="Open AI assistant"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-background animate-pulse" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed z-50 inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[540px] flex flex-col bg-card sm:rounded-xl border border-border shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card sm:rounded-t-xl shrink-0">
            {view === "history" ? (
              <>
                <button
                  onClick={() => setView("chat")}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <span className="text-sm font-medium">Chat History</span>
                <div className="w-14" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Complyze AI</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setView("history")}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Chat history"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNewChat}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="New conversation"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Content area */}
          {view === "history" ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sessions.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No conversations yet
                </p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-2 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors group"
                  >
                    <button
                      onClick={() => handleSessionSelect(session.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-sm font-medium truncate">
                        {session.title || "Untitled conversation"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {session.message_count} messages
                      </p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
                    <div className="text-center">
                      <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-sm font-medium mb-1">
                        Ask about any AI regulation
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Get instant, cited answers from 74+ regulations
                      </p>
                    </div>
                    <div className="w-full space-y-2">
                      {STARTER_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => handleStarterQuestion(q)}
                          className="w-full text-left text-xs p-2.5 rounded-lg border border-border hover:bg-muted hover:border-primary/30 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            <>
                              {msg.content ? (
                                <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:text-xs [&_pre]:text-xs">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                </div>
                              ) : isStreaming ? (
                                <TypingIndicator />
                              ) : null}
                              <CitationChips citations={msg.citations} />
                            </>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="px-3 py-2 text-xs text-destructive bg-destructive/10 border-t border-destructive/20">
                  {error}
                </div>
              )}

              {/* Input */}
              <form
                onSubmit={handleSubmit}
                className="shrink-0 border-t border-border p-3 flex gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about any AI regulation..."
                  disabled={isStreaming}
                  className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isStreaming || !input.trim()}
                  className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
