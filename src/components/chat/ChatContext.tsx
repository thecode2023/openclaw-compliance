"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface PageContext {
  page: string;
  entity?: string;
  entityTitle?: string;
}

interface ChatContextValue {
  pageContext: PageContext;
  setPageContext: (ctx: PageContext) => void;
  triggerMessage: string | null;
  setTriggerMessage: (msg: string | null) => void;
}

const ChatCtx = createContext<ChatContextValue>({
  pageContext: { page: "home" },
  setPageContext: () => {},
  triggerMessage: null,
  setTriggerMessage: () => {},
});

export function ChatContextProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContext] = useState<PageContext>({ page: "home" });
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  return (
    <ChatCtx.Provider value={{ pageContext, setPageContext, triggerMessage, setTriggerMessage }}>
      {children}
    </ChatCtx.Provider>
  );
}

export function useChatContext() {
  return useContext(ChatCtx);
}

export function useSetChatContext(ctx: PageContext) {
  const { setPageContext } = useContext(ChatCtx);
  const page = ctx.page;
  const entity = ctx.entity;
  const entityTitle = ctx.entityTitle;

  useEffect(() => {
    setPageContext({ page, entity, entityTitle });
  }, [page, entity, entityTitle, setPageContext]);
}

export function useTriggerChat() {
  const { setTriggerMessage } = useContext(ChatCtx);
  return useCallback((msg: string) => setTriggerMessage(msg), [setTriggerMessage]);
}
