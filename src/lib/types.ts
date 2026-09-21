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
  /**
   * Unanswered questions still inside the week-long grace window - they sit
   * out of the answer grade instead of counting as ignored. Trigger-written,
   * aged out by the nightly sweepPendingQuestions recount.
   */
  questionsPending?: number;
  /** Questions the community confirmed as genuinely answered. */
  questionsAnswered: number;
  /** Questions where the community judged the response a dodge. */
  questionsDodged: number;
  /** Approval ballots (approve/disapprove), aggregated by trigger. */
  approvalTallies?: DualTally;
  /** Approval among the official's own constituents (ward residents). */
  approvalConstituents?: { approve: number; disapprove: number };
  /**
   * Notify this official when a question reaches this many upvotes (their
   * own setting, edited on their card; onQuestionUpvoteWrite sends the
   * alert). Absent means the default threshold.
   */
  upvoteAlertThreshold?: number;
  /**
   * Upvote-weighted answer buckets, recounted by Cloud Functions whenever a
   * question, response, verdict, or question upvote changes (and nightly).
   * Each question weighs 1 + its verified upvotes, so ignoring a question
   * fifty people joined costs far more than ignoring one nobody backed.
   * credit = responses not judged dodges; pending/ignored split follows the
   * same grace window as questionsPending. Absent until first recount.
   */
  answerWeights?: { credit: number; dodged: number; ignored: number; pending: number };
}

/** One person's standing approval of an official - changeable any time. */
export type ApprovalValue = 'approve' | 'disapprove';

/**
 * A candidate for office (not yet elected). Provisioned by the operator like
 * officials; candidates publish a platform and can poll their audience, but
 * carry none of the grading machinery until they hold office.
 */
/**
 * A nominee in the 2026 school board election. Not an account - a read-only
 * voter-info card seeded by the operator (scripts/seed-school-board.ts) from
 * public sources. If a nominee ever joins the platform they get a real
 * candidate account; these docs stay the directory either way.
 */
/**
 * Crop for a directory headshot that isn't already a centered head-and-
 * shoulders shot: the point to center on, as fractions of the image's width
 * and height (0-1), and a zoom past the plain cover fit (1 = none).
 */
export interface PhotoFrame {
  x: number;
  y: number;
  zoom: number;
}

/**
 * A nominee in an upcoming election - the general-purpose voter directory
 * (November 2026 statewide/county races, February 2027 municipal races).
 * Not an account: a read-only card seeded by the operator
 * (scripts/seed-election.ts) from public sources, same contract as
 * SchoolBoardCandidate. Race ids and labels live in
 * src/constants/elections.ts.
 */
export interface ElectionCandidateCard {
  id: string;
  /** Which ballot: '2026-general' or '2027-municipal'. */
  election: string;
  /** Race id, e.g. 'governor', 'cook-assessor', 'clerk', 'ward-25'. */
  race: string;
  name: string;
  /** Ballot party; null for Chicago's nonpartisan municipal races. */
  party: string | null;
  incumbent: boolean;
  /**
   * A declared write-in: filed to have write-in votes counted, but the name
   * is not printed on the ballot. Absent/false for ballot candidates.
   */
  writeIn?: boolean;
  website: string | null;
  /** Externally hosted headshot (https), rendered by link, never stored. */
  photoUrl?: string | null;
  photoFrame?: PhotoFrame | null;
  /** What the candidate says they are running on, in neutral summary. */
  runningOn: string;
  priorCareer: string | null;
  /** Operator-authored Spanish of the two fields above; English fallback. */
  runningOnEs?: string | null;
  priorCareerEs?: string | null;
  /** Judicial races: the vacancy being filled ("Vacancy of Hon. ..."). */
  seat?: string | null;
  /** Judicial: the court ("Circuit Court of Cook County"). */
  court?: string | null;
  /**
   * Bar association and Injustice Watch findings, quoted exactly as the
   * rating body words them. Empty until a body publishes for this cycle.
   */
  ratings?: { source: string; rating: string; url?: string | null }[];
  /** Public sources the summary was compiled from. */
  sourceUrls: string[];
}

/**
 * Editorial note on one race (an open seat, an unopposed incumbent, a
 * not-yet-announced field). Seeded read-only alongside the candidate cards;
 * doc id is `${election}--${race}`.
 */
export interface ElectionRaceNote {
  id: string;
  election: string;
  race: string;
  note: string;
  /** Operator-authored Spanish of the note; English fallback. */
  noteEs?: string | null;
  sourceUrls?: string[];
}

export interface SchoolBoardCandidate {
  id: string;
  name: string;
  /** 'president' (citywide) or a district id like '4b'. */
  race: string;
  /** Sitting board member. */
  incumbent: boolean;
  /** A declared write-in: votes count, but the name is not on the ballot. */
  writeIn?: boolean;
  /** Official campaign site (https), if the campaign has one. */
  website: string | null;
  /** Externally hosted headshot (https), rendered by link, never stored. */
  photoUrl?: string | null;
  photoFrame?: PhotoFrame | null;
  /** What the candidate has said they are running on, in neutral summary. */
  runningOn: string;
  /** Factual professional background, when public record has it. */
  priorCareer: string | null;
  /** Operator-authored Spanish of the two fields above; English fallback. */
  runningOnEs?: string | null;
  priorCareerEs?: string | null;
  /** Public sources the summary was compiled from. */
  sourceUrls: string[];
}

/** See Candidate.aiSummary. Each paragraph stands on its own. */
export interface PlatformSummary {
  /** What this candidate's listed policies say. */
  summary: string;
  summaryEs?: string | null;
  /** How that compares with the other candidates' listed policies. */
  comparison: string;
  comparisonEs?: string | null;
  generatedAt: Timestamp;
  /** Fingerprint of the policy text it was written from, to spot a stale one. */
  policiesHash: string;
}

export interface Candidate {
  uid: string;
  name: string;
  /** e.g. "Candidate for Mayor" */
  office: string;
  bio: string;
  /**
   * A directory entry rather than a person: its "policies" are profiles of
   * the remaining declared candidates (operator-written, no comments). Listed
   * after the real candidates on the election tab.
   */
  directory?: boolean;
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
   * (green, a plain description of what the campaign published; tapping it
   * opens the campaign's platform page). Defaults to warning.
   */
  platformNoteTone?: 'warning' | 'success' | null;
  /** Operator-translated Spanish rendition of platformNote (English fallback). */
  platformNoteEs?: string | null;
  /**
   * AI-written reading of the platform, operator-generated with one fixed
   * prompt for every candidate (scripts/data/platform-summary-prompt.md) and
   * written by `npm run set-platform-summaries`. Describes only what the
   * listed policies say; never a verdict.
   */
  aiSummary?: PlatformSummary | null;
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
  /**
   * Author-supplied source links (https only), in citation order. Typing *1
   * in the body links the reader to references[0]; uncited links still
   * render at the bottom of the concern.
   */
  references?: string[];
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
  /** Author-supplied source links (https only), shown behind the sources button. */
  references?: string[];
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

export type CommentSort = 'newest' | 'best';

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
  /**
   * People who joined the question ("I want this answered too"), aggregated
   * by trigger from the votes subcollection. The verified count is what
   * weights the official's answer grade - the same sybil defense as
   * judgment verdicts, where only verified voices move the needle.
   */
  upvotes?: number;
  upvotesVerified?: number;
  createdAt: Timestamp;
}

/**
 * The election AMA: one question put to every candidate at once. Anyone
 * signed in can ask; any candidate can answer at any time, one answer each
 * (the answer doc id is the candidate's uid). Answers are ranked by hidden
 * up/down scores - placement only, never displayed.
 */
export interface ElectionQuestion {
  id: string;
  authorUid: string;
  authorName: string;
  authorVerified: boolean;
  body: string;
  /** Candidates who have answered, maintained by onElectionAnswerWrite. */
  answerCount: number;
  /** People who joined the question, aggregated by trigger; orders the list. */
  upvotes?: number;
  upvotesVerified?: number;
  createdAt: Timestamp;
}

/** One candidate's answer to an election question; doc id = candidate uid. */
export interface ElectionAnswer {
  id: string;
  candidateUid: string;
  candidateName: string;
  body: string;
  /** Hidden placement scores (up minus down), trigger-written. */
  score?: number;
  scoreVerified?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
