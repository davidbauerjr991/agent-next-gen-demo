import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { DesktopDesignsPage } from "@/components/DesktopDesignsPage";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { OutboundEngagementPage } from "@/components/OutboundEngagementPage";
import { LoginPage } from "@/components/LoginPage";
import { applyProfile, useApplyTheme } from "@/settings";
import { PAGE_HASH, resolveHash, type Page } from "@/app-routes";

/** The current hash's page; a legacy route (Desk's) is redirected in place
 *  (the URL's hash replaced, its profile applied). */
function pageFromHash(): Page {
  const route = resolveHash(window.location.hash);
  if (route.redirectTo !== undefined) {
    window.history.replaceState(null, "", route.redirectTo);
    if (route.profile) applyProfile(route.profile);
  }
  return route.page;
}

function useHashRouter(): [Page, (page: Page) => void] {
  const [page, setPageState] = useState<Page>(pageFromHash);

  useEffect(() => {
    const onPop = () => setPageState(pageFromHash());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: Page) => {
    const hash = PAGE_HASH[next];
    window.history.pushState(null, "", hash === "" ? window.location.pathname + window.location.search : hash);
    setPageState(next);
  }, []);

  return [page, navigate];
}

import {
  ContentArea,
  Container,
  AiPanel,
  ConversationMessage,
  AIProcess,
  type AIProcessStep,
  type AiPanelSuggestion,
  type DraggableVariant,
} from "@nicecxone/lyra-ui";

/* ── Session cookie helpers ── */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
}
function readBoolCookie(name: string, fallback: boolean): boolean {
  const val = getCookie(name);
  if (val === "true") return true;
  if (val === "false") return false;
  return fallback;
}

/* ── Simulated AI responses ── */
interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  steps?: AIProcessStep[];
}

const RESPONSES: Record<string, { steps: AIProcessStep[]; text: string }> = {
  default: {
    steps: [
      { id: "1", label: "Searching documentation",    status: "done" },
      { id: "2", label: "Reviewing configuration",    status: "done" },
      { id: "3", label: "Composing response",         status: "done" },
    ],
    text: "I've reviewed the available documentation and configuration options. Here's what I found based on your question.",
  },
  "Create an AI Agent": {
    steps: [
      { id: "1", label: "Checking agent templates",   status: "done" },
      { id: "2", label: "Reviewing permissions",      status: "done" },
      { id: "3", label: "Generating setup guide",     status: "done" },
    ],
    text: "To create an AI Agent, navigate to Admin → AI Agents → New Agent. Choose a model (GPT-4o, Claude 3.5, or Gemini 1.5), configure skills and routing rules, then save and activate.",
  },
  "See what has changed since yesterday": {
    steps: [
      { id: "1", label: "Pulling change log",         status: "done" },
      { id: "2", label: "Comparing configurations",   status: "done" },
      { id: "3", label: "Summarising differences",    status: "done" },
    ],
    text: "Since yesterday there were 3 configuration changes: (1) Billing queue SLA threshold updated from 90s to 60s, (2) AI Agent #4 routing rules modified, (3) New desktop template 'Healthcare v2' published by Jim Smith.",
  },
  "How can I manually configure AI Agents?": {
    steps: [
      { id: "1", label: "Locating configuration docs", status: "done" },
      { id: "2", label: "Identifying key settings",    status: "done" },
      { id: "3", label: "Building step-by-step guide", status: "done" },
    ],
    text: "Manual configuration is available under Admin → AI Agents → select agent → Configure. Key settings include: Model selection, Confidence threshold, Fallback behaviour, Skill assignments, and Escalation rules.",
  },
};

function getResponse(text: string) {
  return RESPONSES[text] ?? RESPONSES.default;
}

const AI_PANEL_DEFAULT_WIDTH = 360;

/* ── App ── */
function App() {
  const [page, setPage] = useHashRouter();
  // The settings store's theme drives `<html data-theme>` on every page.
  useApplyTheme();
  const [sidebarOpen, setSidebarOpen] = useState(() => readBoolCookie("lyra_sidebar_open", false));
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [thinking,   setThinking]   = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Ask AI panel — draggable (dockable/undockable + resizable), same
     state machine as the Agent Workspace pages' own real implementation
     (AgentWorkspaceAdvancedPage.tsx). Opens
     docked by default. Previously this used a simple width-animated
     SlidingPanel with a non-draggable AiPanel, which is why it couldn't be
     detached or resized. ── */
  type PanelState = "closed" | "open" | "closing";
  const [aiPanelOpen,  setAiPanelOpen]  = useState(false);
  const [aiMounted,    setAiMounted]    = useState(false);
  const [aiState,      setAiState]      = useState<PanelState>("closed");
  const [aiVariant,    setAiVariant]    = useState<DraggableVariant>("docked");
  const [aiWidth,      setAiWidth]      = useState(AI_PANEL_DEFAULT_WIDTH);
  const [aiHeight,     setAiHeight]     = useState(860);
  const [aiIsResizing, setAiIsResizing] = useState(false);
  const aiFloatLeft = useRef<number | null>(null);
  const aiFloatTop  = useRef<number | null>(null);
  const aiPanelRef  = useRef<HTMLDivElement>(null);
  const aiAnimTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const MAX_PANEL_HEIGHT = 860;
  const BOTTOM_PADDING   = 8;

  const computePanelHeight = () => {
    if (!containerRef.current) return MAX_PANEL_HEIGHT;
    const top = containerRef.current.getBoundingClientRect().top;
    return Math.min(window.innerHeight - top - BOTTOM_PADDING, MAX_PANEL_HEIGHT);
  };

  useEffect(() => {
    clearTimeout(aiAnimTimer.current);
    if (aiPanelOpen) {
      if (containerRef.current && aiFloatLeft.current === null) {
        const r = containerRef.current.getBoundingClientRect();
        aiFloatLeft.current = r.left + containerRef.current.offsetWidth - aiWidth - 16;
      }
      setAiHeight(computePanelHeight());
      setAiMounted(true);
      setAiState("open");
    } else {
      setAiState("closing");
      aiAnimTimer.current = setTimeout(() => setAiState("closed"), 150);
    }
    return () => clearTimeout(aiAnimTimer.current);
  }, [aiPanelOpen]);

  useEffect(() => {
    if (!aiPanelOpen) return;
    const onResize = () => setAiHeight(computePanelHeight());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [aiPanelOpen]);

  const handleAiVariantChange = (v: DraggableVariant) => {
    if (v === "docked" && aiPanelRef.current) {
      const r = aiPanelRef.current.getBoundingClientRect();
      aiFloatLeft.current = r.left;
      aiFloatTop.current  = r.top;
    }
    setAiVariant(v);
  };

  const getAiFloatStyle = (): React.CSSProperties => {
    const rect = containerRef.current?.getBoundingClientRect();
    const left = aiFloatLeft.current !== null
      ? aiFloatLeft.current
      : containerRef.current
        ? (rect?.left ?? 0) + containerRef.current.offsetWidth - aiWidth - 16
        : 0;
    const top = aiFloatTop.current !== null ? aiFloatTop.current : (rect?.top ?? 0);
    return { position: "fixed", top, left, zIndex: 9999 };
  };

  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      setCookie("lyra_sidebar_open", String(next));
      return next;
    });
  }, []);

  /* Narrow-viewport hover-to-open overlay mode for the left nav — same
     pattern as the Agent Workspace pages' own `isNavNarrow`/`overlay`
     wiring (AgentWorkspaceAdvancedPage.tsx). The Sidebar used here
     (Agent Workspace Premium, etc.) used to never track window width or pass
     `overlay` to LeftNav, so it always stayed in static/pushed mode instead
     of collapsing to a hover-to-open absolute overlay on narrow screens. */
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isNavNarrow = windowWidth < 1280;

  // Auto-collapse the expanded nav when viewport drops below 1280px
  useEffect(() => {
    if (isNavNarrow && sidebarOpen) {
      setSidebarOpen(false);
      setCookie("lyra_sidebar_open", "false");
    }
  }, [isNavNarrow]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", text }]);
    setInputValue("");
    setThinking(true);
    setTimeout(() => {
      const { steps, text: responseText } = getResponse(text);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "ai", text: responseText, steps }]);
      setThinking(false);
    }, 1800);
  }, []);

  const handleSuggestion = useCallback((s: AiPanelSuggestion) => {
    setAiPanelOpen(true);
    sendMessage(s.label);
  }, [sendMessage]);

  const handleNewConversation = useCallback(() => {
    setMessages([]); setInputValue(""); setThinking(false);
  }, []);

  const SUGGESTIONS: AiPanelSuggestion[] = [
    { id: "1", label: "Create an AI Agent" },
    { id: "2", label: "See what has changed since yesterday" },
    { id: "3", label: "How can I manually configure AI Agents?" },
  ];

  const conversationContent = messages.length > 0 || thinking ? (
    <div className="flex flex-col gap-4">
      {messages.map((msg) =>
        msg.role === "user" ? (
          <ConversationMessage key={msg.id} variant="user">{msg.text}</ConversationMessage>
        ) : (
          <ConversationMessage key={msg.id} variant="ai" process={msg.steps} processExpanded={false}>
            {msg.text}
          </ConversationMessage>
        )
      )}
      {thinking && (
        <ConversationMessage variant="ai">
          <AIProcess label="Thinking…" defaultExpanded steps={[
            { id: "1", label: "Searching documentation", status: "active" },
            { id: "2", label: "Reviewing configuration",  status: "pending" },
            { id: "3", label: "Composing response",       status: "pending" },
          ]} />
        </ConversationMessage>
      )}
      <div ref={messagesEndRef} />
    </div>
  ) : undefined;

  const aiPanel = aiMounted ? (
    <AiPanel
      ref={aiPanelRef}
      draggable
      draggableVariant={aiVariant}
      defaultDraggableWidth={aiWidth}
      defaultDraggableHeight={aiHeight}
      onVariantChange={handleAiVariantChange}
      onWidthChange={setAiWidth}
      onResizeStateChange={setAiIsResizing}
      userName="John"
      suggestions={SUGGESTIONS}
      onSuggestion={handleSuggestion}
      onClose={() => setAiPanelOpen(false)}
      onNewConversation={handleNewConversation}
      inputProps={{ value: inputValue, onChange: setInputValue, onSubmit: sendMessage }}
      className={aiVariant === "docked" ? "h-full" : undefined}
    >
      {conversationContent}
    </AiPanel>
  ) : null;

  if (page === "agent-advanced") {
    return <AgentWorkspaceAdvancedPage showPageHeader showPanelToggle showInteriorPanel onNavigate={setPage} />;
  }

  if (page === "login") {
    return <LoginPage onNavigate={setPage} />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden animate-in fade-in-0 duration-500">
      <Header onNavigate={setPage} currentPage={page} />
      <div className="flex flex-1 overflow-hidden bg-lyra-bg-surface-shell">
        <Sidebar open={sidebarOpen} onToggle={handleSidebarToggle} overlay={isNavNarrow} />

        <ContentArea ref={containerRef} className="relative min-w-0">
          <Container className="relative flex flex-1 overflow-hidden">
            {page === "outbound"
              ? <OutboundEngagementPage onAiPanelToggle={() => setAiPanelOpen((v) => !v)} />
              : <DesktopDesignsPage onAiPanelToggle={() => setAiPanelOpen((v) => !v)} />
            }
          </Container>

          {/* AI panel — float (fixed position, doesn't take layout space) */}
          {aiVariant === "float" && aiMounted && (
            <div
              style={{
                ...getAiFloatStyle(),
                pointerEvents: "none",
                visibility: aiState === "closed" ? "hidden" : "visible",
                opacity: aiState === "open" ? 1 : 0,
                transform: aiState === "open" ? "translateY(0)" : "translateY(-8px)",
                transition: aiState === "open"
                  ? "opacity 150ms ease, transform 150ms ease"
                  : "opacity 100ms ease, transform 100ms ease",
              }}
            >
              <div style={{ pointerEvents: "auto" }}>{aiPanel}</div>
            </div>
          )}
        </ContentArea>

        {/* AI panel — docked (sibling of the content column so flex layout keeps it in-bounds) */}
        {aiVariant === "docked" && (
          <div className="pb-3" style={{
            width: aiState === "open" ? aiWidth : 0,
            marginRight: aiState === "open" ? 12 : 0,
            overflow: "hidden",
            flexShrink: 0,
            transition: aiIsResizing ? "none" : "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}>
            <div
              className="h-full animate-in fade-in-0 duration-150"
              style={{ width: aiWidth, display: aiState === "open" ? "block" : "none" }}
            >
              {aiPanel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
