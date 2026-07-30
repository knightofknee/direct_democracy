"use strict";
/**
 * Server-side tally arithmetic — the only place aggregate counts are written.
 * Mirrors the shapes in src/lib/types.ts (the app package and this functions
 * package don't share code, so the ~60 lines are duplicated by design; keep
 * both in sync if the ballot model changes).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANSWER_JUDGMENT_QUORUM = exports.PRIORITY_WEIGHTS = void 0;
exports.addBallot = addBallot;
exports.removeBallot = removeBallot;
exports.weightedScore = weightedScore;
exports.PRIORITY_WEIGHTS = {
    critical: 3,
    high: 2,
    medium: 1,
    low: 0,
};
exports.ANSWER_JUDGMENT_QUORUM = 5;
function keysOf(value) {
    return Array.isArray(value) ? value : [value];
}
function bump(counts, key, delta) {
    const next = (counts[key] ?? 0) + delta;
    if (next <= 0)
        delete counts[key];
    else
        counts[key] = next;
}
function clone(tally) {
    return {
        all: { ...tally.all },
        verified: { ...tally.verified },
        registered: { ...tally.registered },
        totalAll: tally.totalAll,
        totalVerified: tally.totalVerified,
        totalRegistered: tally.totalRegistered,
    };
}
/** Add one ballot. */
function addBallot(tally, value, voter) {
    const t = clone(tally);
    const slices = [
        [t.all, true],
        [t.verified, voter.verified],
        [t.registered, voter.registeredVoter],
    ];
    for (const [counts, applies] of slices) {
        if (!applies)
            continue;
        for (const k of keysOf(value))
            bump(counts, k, +1);
    }
    t.totalAll += 1;
    if (voter.verified)
        t.totalVerified += 1;
    if (voter.registeredVoter)
        t.totalRegistered += 1;
    return t;
}
/** Remove one ballot, using the slices stored on that ballot. */
function removeBallot(tally, value, voter) {
    const t = clone(tally);
    const slices = [
        [t.all, true],
        [t.verified, voter.verified],
        [t.registered, voter.registeredVoter],
    ];
    for (const [counts, applies] of slices) {
        if (!applies)
            continue;
        for (const k of keysOf(value))
            bump(counts, k, -1);
    }
    t.totalAll = Math.max(0, t.totalAll - 1);
    if (voter.verified)
        t.totalVerified = Math.max(0, t.totalVerified - 1);
    if (voter.registeredVoter)
        t.totalRegistered = Math.max(0, t.totalRegistered - 1);
    return t;
}
function weightedScore(counts, weights) {
    let score = 0;
    for (const [key, count] of Object.entries(counts)) {
        score += (weights[key] ?? 0) * count;
    }
    return score;
}
//# sourceMappingURL=tally.js.map