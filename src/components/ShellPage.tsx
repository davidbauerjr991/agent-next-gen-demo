import { useState, useRef, useEffect } from "react";
import {
  PageHeader,
  AiPanel,
  AiIcon,
  Button,
  Container,
} from "@nicecxone/lyra-ui";

/* ── Animated slide-in wrapper ── */
function SlidingPanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (open) {
      setMounted(true);
      timer.current = setTimeout(() => setVisible(true), 10);
    } else {
      setVisible(false);
      timer.current = setTimeout(() => setMounted(false), 300);
    }
    return () => clearTimeout(timer.current);
  }, [open]);

  if (!mounted) return null;

  return (
    <div style={{
      width: visible ? 432 : 0,
      overflow: "hidden",
      flexShrink: 0,
      transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
    }}>
      <div className="flex h-full pr-3 pb-3" style={{ width: 432 }}>
        {children}
      </div>
    </div>
  );
}

/* ── ShellPage ── */
export function ShellPage() {
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  return (
    <main className="flex flex-col flex-1 overflow-hidden bg-lyra-bg-surface-shell h-screen animate-in fade-in-0 duration-500">

      {/* ── Page Header ── */}
      <Container className="mx-3 mt-3 shrink-0">
        <PageHeader
          title="Page Title"
          actions={
            <Button variant="outline" onClick={() => setAiPanelOpen((v) => !v)}>
              <AiIcon className="h-4 w-4" />
              Ask AI
            </Button>
          }
        />
      </Container>

      {/* ── Content + AI Panel ── */}
      <div className="flex flex-1 overflow-hidden gap-3 p-3 pt-0 min-h-0">

        {/* Main content area — empty */}
        <div className="flex-1 rounded-lyra-lg border border-lyra-border-subtle bg-lyra-bg-surface-base overflow-hidden" />

        {/* AI Panel — docked, draggable */}
        <SlidingPanel open={aiPanelOpen}>
          <AiPanel
            userName="John"
            className="h-full"
            draggable
            draggableVariant="docked"
            onClose={() => setAiPanelOpen(false)}
            onNewConversation={() => {}}
          />
        </SlidingPanel>
      </div>
    </main>
  );
}
