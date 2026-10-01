/**
 * Rewrites incoming native URLs before expo-router routes them.
 *
 * Firebase's auth emails link to https://www.waldgrave.com/directdemocracy/auth
 * (the project's action URL), which is a universal link / app link into this
 * app. Without this hook the router would look for a /directdemocracy/auth
 * screen and show the unmatched-route page while use-auth completes the
 * sign-in from the same URL. Land on the sign-in screen instead, query intact;
 * use-auth then replaces it with the big board once the link is redeemed.
 */
const AUTH_LINK_PATH = '/directdemocracy/auth';

/**
 * Shared links point at the web version on waldgrave.com, under this base
 * path (/directdemocracy/app/concern/abc). When the app is installed and the
 * link opens it, drop the base path and route to the same screen.
 */
const WEB_APP_PATH = '/directdemocracy/app';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes(AUTH_LINK_PATH)) {
    const q = path.indexOf('?');
    return `/sign-in${q >= 0 ? path.slice(q) : ''}`;
  }
  const web = path.indexOf(WEB_APP_PATH);
  if (web >= 0) return path.slice(web + WEB_APP_PATH.length) || '/';
  return path;
}
