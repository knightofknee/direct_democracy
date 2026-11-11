/**
 * The app opens on the elections tab (2026-11-09, Brian: the mayor games
 * are the app's front door until February 23). The home tab still owns "/",
 * so shared links, the web address, and every `router.replace('/')` keep
 * meaning the big board; only a plain launch, one that opened at "/" with
 * no link behind it, is sent on, once.
 */
let decided = false;
let pending = false;

/** Called by the root layout with the path the app opened at. */
export function noteLaunchPath(path: string): void {
  if (decided) return;
  decided = true;
  pending = path === '/' || path === '';
}

/** True once, for the home tab's first draw of a plain launch. */
export function takeLaunchRedirect(): boolean {
  const go = pending;
  pending = false;
  return go;
}
