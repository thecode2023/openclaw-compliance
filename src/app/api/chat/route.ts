import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { semanticSearch, type SearchResult } from "@/lib/ai/search";
import { buildChatRAGPrompt } from "@/lib/ai/prompts/chat-rag";
import { geminiModel } from "@/lib/ai/client";
import type { Citation } from "@/lib/types/chat";
import type { UserProfile } from "@/lib/types/user";

function extractCitations(
  responseText: string,
  chunks: SearchResult[]
): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const chunk of chunks) {
    if (seen.has(chunk.regulation_id)) continue;
    // Check if the regulation title is referenced in the response
    if (
      responseText.toLowerCase().includes(chunk.title.toLowerCase()) ||
      responseText.includes(chunk.source_url)
    ) {
      seen.add(chunk.regulation_id);
      citations.push({
        regulation_id: chunk.regulation_id,
        title: chunk.title,
        jurisdiction: chunk.jurisdiction_display,
        source_url: chunk.source_url,
        chunk_type: chunk.chunk_type,
      });
    }
  }

  return citations;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message, session_id, jurisdictions } = body as {
      message: string;
      session_id?: string;
      jurisdictions?: string[];
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    let activeSessionId = session_id;

    // Session management
    if (activeSessionId) {
      // Verify session belongs to user
      const { data: session, error: sessionError } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("id", activeSessionId)
        .eq("user_id", user.id)
        .single();

      if (sessionError || !session) {
        return NextResponse.json(
          { error: "Chat session not found" },
          { status: 404 }
        );
      }
    } else {
      // Create new session
      const title = message.slice(0, 80).trim();
      const { data: newSession, error: createError } = await adminClient
        .from("chat_sessions")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();

      if (createError || !newSession) {
        return NextResponse.json(
          { error: "Failed to create chat session" },
          { status: 500 }
        );
      }
      activeSessionId = newSession.id;
    }

    // Store user message
    await adminClient.from("chat_messages").insert({
      session_id: activeSessionId,
      role: "user",
      content: message.trim(),
      citations: [],
    });

    // Fetch conversation history
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", activeSessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Semantic search for relevant context
    let searchResults: SearchResult[] = [];
    try {
      searchResults = await semanticSearch(message, {
        jurisdictions: jurisdictions || undefined,
        limit: 8,
        threshold: 0.5,
      });
    } catch (searchError) {
      console.error("[chat] Semantic search failed:", searchError);
      // Continue without context — the prompt handles empty context
    }

    // Fetch user profile
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Build RAG prompt
    const prompt = buildChatRAGPrompt({
      userProfile: userProfile as UserProfile | null,
      retrievedChunks: searchResults,
      conversationHistory: (history || []) as {
        role: string;
        content: string;
      }[],
      userMessage: message,
    });

    // Stream response from Gemini
    const genResult = await geminiModel.generateContentStream(prompt);
    const encoder = new TextEncoder();
    let fullResponse = "";
    const sessionIdForClient = activeSessionId;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of genResult.stream) {
            const text = chunk.text();
            if (text) {
              fullResponse += text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text, done: false })}\n\n`
                )
              );
            }
          }

          // Extract citations
          const citations = extractCitations(fullResponse, searchResults);

          // Send final chunk with citations and session ID
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                text: "",
                done: true,
                citations,
                session_id: sessionIdForClient,
              })}\n\n`
            )
          );

          // Store assistant message (fire and forget)
          adminClient
            .from("chat_messages")
            .insert({
              session_id: sessionIdForClient,
              role: "assistant",
              content: fullResponse,
              citations,
            })
            .then(({ error }) => {
              if (error)
                console.error("[chat] Failed to store assistant message:", error);
            });

          // Update session
          adminClient
            .from("chat_sessions")
            .update({
              message_count: (history?.length || 0) + 2,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessionIdForClient)
            .then(({ error }) => {
              if (error)
                console.error("[chat] Failed to update session:", error);
            });

          controller.close();
        } catch (error) {
          console.error("[chat] Stream error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                text: "",
                done: true,
                error: "An error occurred while generating the response. Please try again.",
                session_id: sessionIdForClient,
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[chat] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
