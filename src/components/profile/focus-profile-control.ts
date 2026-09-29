export function focusProfileControl(event: React.PointerEvent<HTMLElement>) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("button, a")) return;

  const selector = 'input:not([type="file"]):not(:disabled), textarea:not(:disabled), select:not(:disabled)';
  const field =
    target.closest<HTMLElement>(selector) ??
    target.closest("label")?.querySelector<HTMLElement>(selector);

  if (field && field !== document.activeElement) {
    field.focus({ preventScroll: true });
  }
}