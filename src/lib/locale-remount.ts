/**
 * Changing the language redraws the whole navigator (the React Compiler
 * caches render-time calls like wardLabel() and plural() by their
 * arguments alone, so only a fresh tree is sure to be all in the new
 * language). So does changing the phone's text size while the app is open
 * (React Native keeps text it already laid out at its old size, clipped or
 * padded, until it is drawn again). A redraw starts at the home tab; the
 * screen that caused it asks to be put back with this.
 */
let pending: string | null = null;

export function reopenAfterRedraw(path: string): void {
  pending = path;
}

export function takeReopenPath(): string | null {
  const path = pending;
  pending = null;
  return path;
}
