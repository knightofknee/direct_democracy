import type { Timestamp } from 'firebase/firestore';

/**
 * Three groups of people use the app:
 *  - unverified users  (role 'citizen', verified: false)
 *  - verified users    (role 'citizen', verified: true) - proved identity via a
 *    third-party provider (Didit); we only ever store the boolean + ward.
 *  - elected officials (role 'official') - approved admins who run polls and AMAs.
 */
export type Role = 'citizen' | 'official';

/** Personal participation counters, written only by Cloud Functions triggers. */
export interface UserStats {
  concerns: number;
  comments: number;
  votes: number;
  judgments: number;
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
export const CONCERN_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
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
  createdAt: Timestamp;
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

/**
 * Minimum VERIFIED judgments before a question flips to answered/dodged.
 * Unverified judgments are shown but don't decide - sockpuppets can't brand
 * an official a dodger or launder a real dodge.
 */
export const ANSWER_JUDGMENT_QUORUM = 5;
