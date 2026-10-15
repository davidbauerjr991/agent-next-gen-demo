/** The thread the docked channel preview shows, given the one it was asked
 *  to show and the one in the main column: never the main column's own
 *  thread, so one conversation never renders twice. E.g. selecting an
 *  unselected card through its chat row switches to that card (the chat is
 *  its main-column thread) and asks for the same chat in the preview; a
 *  card carried over by a tier switch is unselected on the new page. Any
 *  such request (a row click, a header icon, an "added" activation)
 *  resolves to no preview. */
export function dockedPreviewKey(requested: string | null, mainColumnKey: string | undefined): string | null {
  return requested !== null && requested !== mainColumnKey ? requested : null;
}
