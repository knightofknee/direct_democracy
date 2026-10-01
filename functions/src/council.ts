/**
 * City Council, from the City Clerk's public legislation API (eLMS,
 * https://api.chicityclerkelms.chicago.gov: no key; labelled beta; a short
 * rate-limit window of about 500 calls). Synced nightly into collections
 * the app reads and no client writes (2026-09-29):
 *
 * - council/upcoming: the next two weeks of City Council and committee
 *   meetings, each with its public comment deadline and agenda / notice.
 * - rollCalls/{historyId}: every roll call with at least one No vote (the
 *   ones that tell you something; a 50-0 vote says little about any one
 *   alderman). Each keeps every member's vote, the tally, and whether the
 *   vote was divided (the losing side had 5 or more) or which members were
 *   in the minority, so an alderman's page can show their divided votes
 *   and their lone dissents.
 * - officials/{uid}.elmsPersonId: each alderman's eLMS id, matched by ward.
 *
 * The matter's own `actions[].votes` are the source of truth (the agenda
 * endpoint lags). Titles and action names are shown as the Clerk writes
 * them; nothing here rates or interprets a vote.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const API = 'https://api.chicityclerkelms.chicago.gov';
/** A losing side this big makes a vote "divided" for the big picture. */
export const DIVIDED_MIN = 5;
/** Backfill start the first time the sync runs. */
const FIRST_SYNC_FROM = '2026-01-01T00:00:00Z';
const MEETING_DAYS_AHEAD = 14;

async function api<T>(path: string): Promise<T> {
  // No `accept: application/json`: with it, some endpoints answer with the
  // JSON double-encoded as a string. Parse a second time if that happens.
  const resp = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!resp.ok) throw new Error(`eLMS ${path} -> ${resp.status}`);
  // Stay far under the undocumented rate window.
  const remaining = Number(resp.headers.get('x-ratelimit-remaining') ?? 500);
  if (remaining < 50) await new Promise((r) => setTimeout(r, 60_000));
  const body: unknown = await resp.json();
  return (typeof body === 'string' ? JSON.parse(body) : body) as T;
}

interface ElmsVote {
  voterName: string;
  vote: string;
  personId: string;
}
interface ElmsAction {
  actionDate: string;
  actionByName: string;
  actionName: string;
  meetingId: string;
  historyId: string;
  votes?: ElmsVote[];
}
interface ElmsMatter {
  matterId: string;
  recordNumber: string;
  title: string;
  type: string;
  lastPublicationDate: string;
  actions?: ElmsAction[];
}

/** Match each sitting alderman to their eLMS person id, by ward. */
export async function syncCouncilMembers(db: Firestore): Promise<number> {
  const people = await api<{ data: { personId: string; ward: string; isActive: boolean; displayName: string }[] }>(
    '/person?top=500'
  );
  let matched = 0;
  const sitting = new Map<number, string>();
  for (const p of people.data) {
    if (p.isActive && /^\d{2}$/.test(p.ward)) sitting.set(Number(p.ward), p.personId);
  }
  const officials = await db.collection('officials').where('wardId', '!=', null).get();
  for (const o of officials.docs) {
    // A predecessor's card keeps no id, so it can't show a successor's votes.
    const id = sitting.get(o.data().wardId as number) ?? null;
    if ((o.data().elmsPersonId ?? null) !== id) {
      await o.ref.update({ elmsPersonId: id ?? FieldValue.delete() });
    }
    if (id) matched += 1;
  }
  return matched;
}

/** The next two weeks of meetings, with public comment deadlines and files. */
export async function syncUpcomingMeetings(db: Firestore): Promise<number> {
  const now = new Date();
  const until = new Date(now.getTime() + MEETING_DAYS_AHEAD * 86_400_000);
  const list = await api<{
    data: {
      meetingId: string;
      status: string;
      body: string;
      location: string;
      videoLink: string | null;
      date: string;
      comment: string | null;
    }[];
  }>(`/meeting?filter=${encodeURIComponent(`date ge ${now.toISOString()}`)}&sort=${encodeURIComponent('date asc')}&top=100`);
  const meetings = [];
  for (const m of list.data) {
    if (new Date(m.date) > until) continue;
    let deadline: string | null = null;
    let agendaUrl: string | null = null;
    let noticeUrl: string | null = null;
    try {
      const a = await api<{
        publicCommentDeadline?: string | null;
        files?: { path: string; attachmentType: string; sort?: number }[];
      }>(`/meeting-agenda/${m.meetingId}`);
      deadline = a.publicCommentDeadline ?? null;
      // A revised agenda (AGENDA_R1) comes after the original: take the last.
      const latest = (type: string) =>
        (a.files ?? [])
          .filter((f) => f.attachmentType === type)
          .sort((x, y) => (y.sort ?? 0) - (x.sort ?? 0))[0]?.path ?? null;
      agendaUrl = latest('Agenda');
      noticeUrl = latest('Notice');
    } catch (err) {
      console.warn(`Agenda for meeting ${m.meetingId} unavailable:`, err);
    }
    meetings.push({
      meetingId: m.meetingId,
      body: m.body,
      date: Timestamp.fromDate(new Date(m.date)),
      cancelled: /cancel/i.test(m.status),
      location: m.location ?? null,
      videoLink: m.videoLink ?? null,
      publicCommentDeadline: deadline ? Timestamp.fromDate(new Date(deadline)) : null,
      agendaUrl,
      noticeUrl,
    });
  }
  await db.doc('council/upcoming').set({ meetings, updatedAt: FieldValue.serverTimestamp() });
  return meetings.length;
}

/**
 * Which side carried a roll call. The action's name says whether it passed
 * ("Passed", "Recommended to Pass", "Adopted") or failed, which vote counts
 * alone can't: an ordinance needs 26 votes, some need two thirds. Counts are
 * the fallback for a name that says neither, and a tie has no winner.
 */
function winningSide(actionName: string, yes: number, no: number): 'Yea' | 'Nay' | null {
  const name = actionName.toLowerCase();
  if (/fail|not pass|defeat|reject|not adopt|not approve/.test(name)) return 'Nay';
  if (/pass|adopt|approv|concur/.test(name)) return 'Yea';
  if (yes === no) return null;
  return yes > no ? 'Yea' : 'Nay';
}

/** "Yea" -> "yes", "Nay" -> "no"; everything else ("Absent", "Recused"...) as written. */
function normalizeVote(v: string): string {
  if (v === 'Yea') return 'yes';
  if (v === 'Nay') return 'no';
  return v;
}

/**
 * Roll calls with at least one No, from matters published since the last
 * sync (the first run backfills the year). Upserts by the action's stable
 * historyId, so corrections at the Clerk overwrite.
 */
export async function syncRollCalls(db: Firestore): Promise<number> {
  const stateRef = db.doc('council/sync');
  const since = ((await stateRef.get()).data()?.lastPublication as string | undefined) ?? FIRST_SYNC_FROM;
  const filter = `lastPublicationDate gt ${since} and actions/any(a: a/votes/any(v: v/vote eq 'Nay'))`;
  let skip = 0;
  let latest = since;
  let written = 0;
  for (;;) {
    const page = await api<{ data: ElmsMatter[]; meta: { count: number } }>(
      `/matter?filter=${encodeURIComponent(filter)}&sort=${encodeURIComponent('lastPublicationDate asc')}&top=100&skip=${skip}`
    );
    for (const summary of page.data) {
      if (summary.lastPublicationDate > latest) latest = summary.lastPublicationDate;
      let matter: ElmsMatter;
      try {
        matter = await api<ElmsMatter>(`/matter/${summary.matterId}`);
      } catch (err) {
        // One bad record is skipped (it's picked up when it's republished),
        // so it can't hold the whole sync back.
        console.warn(`Matter ${summary.matterId} unavailable:`, err);
        continue;
      }
      for (const action of matter.actions ?? []) {
        const votes = action.votes ?? [];
        if (!votes.some((v) => v.vote === 'Nay')) continue;
        const yes = votes.filter((v) => v.vote === 'Yea').length;
        const no = votes.filter((v) => v.vote === 'Nay').length;
        const winner = winningSide(action.actionName, yes, no);
        const minority = winner
          ? votes.filter((v) => (v.vote === 'Yea' || v.vote === 'Nay') && v.vote !== winner)
          : [];
        await db.doc(`rollCalls/${action.historyId}`).set({
          matterId: matter.matterId,
          recordNumber: matter.recordNumber,
          title: matter.title,
          matterType: matter.type,
          actionName: action.actionName,
          body: action.actionByName,
          council: action.actionByName === 'City Council',
          date: Timestamp.fromDate(new Date(action.actionDate)),
          yes,
          no,
          divided: minority.length >= DIVIDED_MIN,
          minorityVoters: minority.map((v) => v.personId),
          votes: Object.fromEntries(votes.map((v) => [v.personId, normalizeVote(v.vote)])),
          url: `https://chicityclerkelms.chicago.gov/Matter/?matterId=${matter.matterId}`,
          syncedAt: FieldValue.serverTimestamp(),
        });
        written += 1;
      }
    }
    skip += page.data.length;
    // Oldest first, so each finished page is a safe place to resume from.
    await stateRef.set({ lastPublication: latest }, { merge: true });
    if (page.data.length === 0 || skip >= page.meta.count) break;
  }
  await stateRef.set({ lastPublication: latest, lastRunAt: FieldValue.serverTimestamp() }, { merge: true });
  return written;
}
