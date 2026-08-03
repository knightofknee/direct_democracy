/**
 * Platform operators, by sign-in email. Must match isAdmin() in
 * firestore.rules - the rules are the enforcement; this list only decides
 * what the UI offers. Move to custom claims when there's more than one.
 */
export const ADMIN_EMAILS = ['bricarlis@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * The UI gate, mirroring isAdmin() in firestore.rules - including its
 * email_verified requirement. An unverified address never grants operator
 * tools, so the button and the rules agree instead of offering an action
 * that would be denied.
 */
export function isAdminUser(
  user: { email: string | null; emailVerified: boolean } | null | undefined
): boolean {
  return !!user && user.emailVerified && isAdminEmail(user.email);
}
