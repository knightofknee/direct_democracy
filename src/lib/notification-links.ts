/**
 * Where tapping a notification goes. The server's link points at the item;
 * a politician's own AMA notifications (a new question, one crossing their
 * alert bar) open their command center instead, where they answer, since
 * their public page reads the same for them as for everyone. A reply in the
 * conversation under an answer stays on the public page, where the
 * conversation lives. Used by the notifications tab and by phone
 * notification taps alike.
 */
export function notificationLink(link: string, uid: string | null | undefined): string {
  if (!uid) return link;
  const own = `/official/${uid}`;
  if (link.includes('thread=1')) return link;
  if (link === own || link.startsWith(`${own}?`)) return `/command${link.slice(own.length)}`;
  return link;
}
