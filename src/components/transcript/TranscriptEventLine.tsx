// A plain system-event line in the conversation: "time · name[ · context]" over the bold text, its bullets under it.
// No bubble, avatar, click or collapse. The AI agent's event lines ("Launch price held") and plain Copilot answers
// (P-LAYOUT-F1 F: "time · Copilot · the question") share it, on a conversation and a kind cell.

export function TranscriptEventLine({
  time,
  name,
  context,
  text,
  points,
}: {
  time: string;
  name: string;
  context?: string;
  text: string;
  points?: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-0.5" data-event-line="">
      <span className="lyra-body-sm text-lyra-fg-secondary">
        {time} · {name}
        {context && <> · {context}</>}
      </span>
      <span className="lyra-body-md-emphasis text-lyra-fg-default">{text}</span>
      {!!points?.length && (
        <ul className="list-disc ps-5 lyra-body-md text-lyra-fg-default">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
