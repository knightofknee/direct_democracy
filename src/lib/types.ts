import type { Timestamp } from 'firebase/firestore';

/**
 * Four groups of people use the app:
 *  - unverified users  (role 'citizen', verified: false)
 *  - verified users    (role 'citizen', verified: true) - proved identity via a
 *    third-party provider (Didit); we only ever store the boolean + ward.
 *  - elected officials (role 'official') - approved admins who run polls and AMAs.
 *  - candidates        (role 'candidate') - provisioned by the operator; they
 *    publish a platform (the more perfect platform) and run polls, but are not
 *    graded like sitting officials.
 */
export type Role = 'citizen' | 'official' | 'candidate';

/** Personal participation counters, written only by Cloud Functions triggers. */
export interface UserStats {
  concerns: number;
  comments: number;
  votes: number;
  judgments: number;
  /** Writing credits awarded by candidates; absent on accounts that predate them. */
  credits?: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  role: Role;
  verified: boolean;
  /** 1–50 for Chicago wards; null until verified (ward comes from verified address). */
  wardId: number | null;
  /** Optional for accounts created before stats existed. */
  stats?: UserStats;
  createdAt: Timestamp;
}

export interface Official {
  uid: string;
  name: string;
  title: string; // e.g. "Alderman, 1st Ward" or "Mayor"
  wardId: number | null; // null for citywide offices
  bio: string;
  /**
   * Externally hosted portrait (https URL) - we render it but never host or
   * store the image itself. Null shows an initials avatar.
   */
  photoUrl?: string | null;
  /** The official's public website, shown as a link. */
  websiteUrl?: string | null;
  /** Public ward-office contact info, as published by the city. */
  contactEmail?: string | null;
  phone?: string | null;
  /**
   * True once the person proved control of their published email (password
   * reset, magic link, or SSO). Written only by Cloud Functions
   * (refreshClaim / nightly sweepClaims). Unclaimed profiles are public
   * record: askable, but silence is held as pending, never graded ignored.
   */
  claimed?: boolean;
  /** AMA responsiveness counters, maintained by Cloud Functions triggers. */
  questionsAsked: number;
  questionsResponded: number;
  /** Questions the community confirmed as genuinely answered. */
  questionsAnswered: number;
  /** Questions where the community judged the response a dodge. */
  questionsDodged: number;
  /** Approval ballots (approve/disapprove), aggregated by trigger. */
  approvalTallies?: DualTally;
  /** Approval among the official's own constituents (ward residents). */
  approvalConstituents?: { approve: number; disapprove: number };
}

/** One person's standing approval of an official - changeable any time. */
export type ApprovalValue = 'approve' | 'disapprove';

/**
 * A candidate for office (not yet elected). Provisioned by the operator like
 * officials; candidates publish a platform and can poll their audience, but
 * carry none of the grading machinery until they hold office.
 */
export interface Candidate {
  uid: string;
  name: string;
  /** e.g. "Candidate for Mayor" */
  office: string;
  bio: string;
  /** Externally hosted portrait (https URL) - never stored or proxied. */
  photoUrl?: string | null;
  /** The campaign's public website, shown as a link. */
  websiteUrl?: string | null;
  /**
   * Campaign page the platform syncs from (operator-provisioned). When set,
   * a Cloud Function parses the page and upserts the candidate's policies;
   * those synced policies are read-only in the app so the site stays the
   * single source of truth. Null means the platform is managed in-app.
   */
  sourceUrl?: string | null;
  lastSyncedAt?: Timestamp | null;
  /**
   * Operator-written editorial note shown prominently above the platform,
   * e.g. calling out that a candidate has published no real platform for the
   * office they seek. Null hides it.
   */
  platformNote?: string | null;
  /**
   * How the note reads: 'warning' (amber, calling out a gap) or 'success'
   * (green, crediting good work; tapping it opens the campaign's platform
   * page). Defaults to warning.
   */
  platformNoteTone?: 'warning' | 'success' | null;
  /** Same claim signal as Official.claimed (refreshClaim / sweepClaims). */
  claimed?: boolean;
  /** Live (unarchived) policy count, maintained by Cloud Functions triggers. */
  policyCount: number;
}

/** One in-app notification, written only by Cloud Functions triggers. */
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  /** One-line excerpt of the thing that happened. */
  body: string;
  /** App route the notification opens. */
  link: string;
  read: boolean;
  createdAt: Timestamp;
}

/** Option keys for a policy's DualTally - a straight stance vote. */
export const POLICY_STANCES = ['support', 'oppose'] as const;
export type PolicyStance = (typeof POLICY_STANCES)[number];

/** A cited source on a policy - "the receipts". */
export interface PolicyLink {
  label: string;
  url: string;
}

/**
 * One plank of a candidate's platform (the more perfect platform). Synced
 * policies (`source: 'site'`) are written only by the platform-sync Cloud
 * Function; in-app policies (`source: 'app'`) are the candidate's own writes.
 * Policies that disappear from a synced site are archived, not deleted, so
 * their votes and comments survive a site reshuffle.
 */
export interface Policy {
  id: string;
  candidateUid: string;
  /** Grouping header, e.g. "Health & Home". */
  section: string;
  title: string;
  body: string;
  links: PolicyLink[];
  /** Display order across the whole platform. */
  order: number;
  source: 'site' | 'app';
  archived: boolean;
  tallies: DualTally;
  commentCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Every vote is tallied two ways: all users, and verified users. On
 * ward-scoped items the verified slice counts only verified residents of
 * that ward; "verified" always means "verified for this item's area"
 * (citywide items count every verified Chicagoan).
 */
export interface DualTally {
  /** counts per option key over all users */
  all: Record<string, number>;
  /** counts per option key over verified users (area-scoped on ward items) */
  verified: Record<string, number>;
  totalAll: number;
  totalVerified: number;
}

export type TallyLens = 'all' | 'verified';

export type Scope = 'city' | 'ward';

/**
 * Concerns are voted on by priority - how much does this matter - rather than
 * up/down. Option keys for a concern's DualTally.
 */
/** 1 (barely) to 5 (critical). Older ballots may hold legacy named keys. */
export const CONCERN_PRIORITIES = ['1', '2', '3', '4', '5'] as const;
export type ConcernPriority = (typeof CONCERN_PRIORITIES)[number];
// Priority → board-score weights live server-side in functions/src/tally.ts.

export interface Concern {
  id: string;
  title: string;
  body: string;
  scope: Scope;
  wardId: number | null; // set when scope === 'ward'
  authorUid: string;
  authorName: string;
  authorVerified: boolean;
  tallies: DualTally;
  /** Weighted priority score over all users - big board rank. */
  score: number;
  /** Weighted priority score over verified users (ward residents for ward concerns). */
  scoreVerified: number;
  commentCount: number;
  createdAt: Timestamp;
}

export interface Comment {
  id: string;
  authorUid: string;
  authorName: string;
  authorVerified: boolean;
  body: string;
  /**
   * Threaded replies: the id of the thread's ROOT comment, null on top-level
   * comments. Replies to replies stay in the same thread (flat, chronological,
   * one visual indent) so the back-and-forth is unlimited but stays readable.
   */
  threadId?: string | null;
  /** Display name of the comment being answered - "replying to X" context. */
  replyToName?: string | null;
  /**
   * Writing credit: the candidate marked this comment as one that changed
   * their policy. Pure recognition - it confers nothing but the credit.
   * Only set on policy comments, only by the policy's candidate.
   */
  credited?: boolean;
  creditedAt?: Timestamp | null;
  /**
   * Up minus down votes, trigger-maintained and never displayed - ratings
   * exist only to order the "best" sort. scoreVerified is the same figure
   * over verified voters. Absent until the first vote lands.
   */
  score?: number;
  scoreVerified?: number;
  createdAt: Timestamp;
}

/** A comment rating - placement only, no public counts. */
export type CommentVoteValue = 'up' | 'down';

export type CommentSort = 'newest' | 'oldest' | 'best';

/** Target of a reply: the thread root plus who is being answered. */
export interface CommentReply {
  threadId: string;
  replyToName: string;
}

/** Poll formats officials can choose from - deliberately not just up/down. */
export type PollType = 'yesNo' | 'multipleChoice' | 'approval' | 'scale5';

export const SCALE5_OPTIONS = [
  { key: 'stronglyOppose', label: 'Strongly oppose' },
  { key: 'oppose', label: 'Oppose' },
  { key: 'neutral', label: 'Neutral' },
  { key: 'support', label: 'Support' },
  { key: 'stronglySupport', label: 'Strongly support' },
] as const;

export interface PollOption {
  key: string;
  label: string;
}

export interface Poll {
  id: string;
  question: string;
  detail: string;
  type: PollType;
  options: PollOption[];
  scope: Scope;
  wardId: number | null;
  authorUid: string;
  authorName: string;
  open: boolean;
  tallies: DualTally;
  createdAt: Timestamp;
}

export type VoteValue = string | string[]; // string[] only for approval polls

export interface VoteDoc {
  uid: string;
  value: VoteValue;
  /** Voter's status snapshotted at vote time; drives the dual tallies. */
  verified: boolean;
  /** Voter's ward at cast time - scopes ward-item slices to residents. */
  wardId: number | null;
  createdAt: Timestamp;
}

/**
 * AMA question lifecycle. The community - not the politician - decides whether
 * a response actually answered the question. There is no up/down voting on the
 * official's response, only "did this answer it?".
 */
export type QuestionStatus = 'awaitingResponse' | 'underReview' | 'answered' | 'dodged';

export interface AmaQuestion {
  id: string;
  officialUid: string;
  authorUid: string;
  authorName: string;
  authorVerified: boolean;
  body: string;
  status: QuestionStatus;
  response: string | null;
  respondedAt: Timestamp | null;
  /** Community judgment: did the response answer the question? */
  answeredYes: number;
  answeredNo: number;
  /** Same counts over verified users only - the verified lens on judgments. */
  answeredYesVerified?: number;
  answeredNoVerified?: number;
  createdAt: Timestamp;
}
