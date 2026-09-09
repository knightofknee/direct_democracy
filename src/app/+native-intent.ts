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

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes(AUTH_LINK_PATH)) {
    const q = path.indexOf('?');
    return `/sign-in${q >= 0 ? path.slice(q) : ''}`;
  }
  return path;
}
