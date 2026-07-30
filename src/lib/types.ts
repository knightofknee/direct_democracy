import type { Timestamp } from 'firebase/firestore';

/**
 * Three groups of people use the app:
 *  - unverified users  (role 'citizen', verified: false)
 *  - verified users    (role 'citizen', verified: true) — proved identity via a
 *    third-party provider (Persona); we only ever store the boolean + ward.
 *  - elected officials (role 'official') — approved admins who run polls and AMAs.
 */
export type Role = 'citizen' | 'official';

export interface UserProfile {
  uid: string;
  displayName: string;
  role: Role;
  verified: boolean;
  /** 1–50 for Chicago wards; null until verified (ward comes from verified address). */
  wardId: number | null;
  /** Registered-voter flag, second filter on the big board. Set during verification. */
  registeredVoter: boolean;
  createdAt: Timestamp;
}

export interface Official {
  uid: string;
  name: string;
  title: string; // e.g. "Alderman, 1st Ward" or "Mayor"
  wardId: number | null; // null for citywide offices
  bio: string;
  /** AMA responsiveness counters, maintained transactionally as the community votes. */
  questionsAsked: number;
  questionsResponded: number;
  /** Questions the community confirmed as genuinely answered. */
  questionsAnswered: number;
  /** Questions where the community judged the response a dodge. */
  questionsDodged: number;
}

/**
 * Every vote is tallied twice: once over all users and once over verified users
 * only, so any result can be viewed through either lens. `registered` is a
 * third slice for the big board's registered-voter filter.
 */
export interface DualTally {
  /** counts per option key over all users */
  all: Record<string, number>;
  /** counts per option key over verified users only */
  verified: Record<string, number>;
  /** counts per option key over registered voters only */
  registered: Record<string, number>;
  totalAll: number;
  totalVerified: number;
  totalRegistered: number;
}

export type TallyLens = 'all' | 'verified' | 'registered';

export type Scope = 'city' | 'ward';

/**
 * Concerns are voted on by priority — how much does this matter — rather than
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
  /** Weighted priority score over all users — big board rank. */
  score: number;
  /** Weighted priority score over verified users only. */
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

/** Poll formats officials can choose from — deliberately not just up/down. */
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
  registeredVoter: boolean;
  createdAt: Timestamp;
}

/**
 * AMA question lifecycle. The community — not the politician — decides whether
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
  createdAt: Timestamp;
}

/** Minimum community judgments before a question flips to answered/dodged. */
export const ANSWER_JUDGMENT_QUORUM = 5;
