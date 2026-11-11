# Candidate content rules

The one set of rules for everything the app says about a candidate for mayor:
the "what sets them apart" summary, the splits table, the consensus list, the
key points, and the quotes. The same rules for every candidate, Brian's own
page included. The words live in `mayor-games.json` (seeded by
`npm run seed-mayor-games`); a candidate's platform page copies them from
there (`npm run set-platform-summaries`). There is one copy of every fact.

## The reader

A Chicago voter on a phone with about a minute. They are choosing between
sixteen people. They will leave the moment a screen tells them something they
have already read about someone else. Respect that: say what separates this
candidate from the others, fast, and stop. We do not pick winners. We lay the
differences out plainly enough that the voter can.

## What went wrong before (2026-11-09)

The first summaries followed each platform's own order and weight. Every
campaign leads with housing, police, and the budget, so every summary did too,
and a voter read sixteen police paragraphs that differed in nothing a person
votes on. Headline proposals that only one candidate makes (a city charter,
$3,000 a year to working families, a trade certificate to graduate) were left
out to make room. A second copy of each summary, written from memory instead
of the platforms, had wrong facts in it. These rules exist to stop all three.

## The test for every sentence

Would this sentence still be true with another candidate's name on it? If
yes, it does not belong on this candidate's page. It belongs in `consensus`,
once, or nowhere.

## Procedure

1. Sources. `npm run set-platform-summaries -- --dump <dir>` and read EVERY
   platform in full, exactly as the app lists it. For a candidate with no
   imported platform, read their campaign site and their own words in the
   press from THIS campaign (after they entered the race). A quote or position
   from an earlier campaign or an earlier office is not a source. Nothing from
   memory. An opponent's description of a candidate is not a source for that
   candidate.
2. The contrast sheet. Before writing a word about anyone, list every concrete
   commitment in every platform, by subject, across all candidates, side by
   side. Then sort each subject into one of three piles:
   - **Consensus**: nearly everyone says it, or they differ only in numbers
     and detail. Goes in `consensus` as one line. Policing is here: everyone
     wants more officers on the street and on the CTA, and how many told
     voters nothing (cut from the comparison in October, cut everywhere in
     November). No summary chunk and no split is about policing.
   - **Split**: two or more different answers to the same question, each held
     by a named candidate, that a person would vote on (who pays, what happens
     to pensions, where TIF money goes, cash to households). Goes in `splits`.
   - **Only**: something one candidate proposes and nobody else does. Goes in
     that candidate's summary under "Only <Name>".
   Two rulings from Brian (2026-11-09) on borderline cases:
   - A have-it-or-not question about a product or a number is NOT a split.
     "Bring back ShotSpotter or not" restates the problem falsely: the thing
     had reliability problems, and no candidate is arguing how it should be
     measured or what the alternative is. The same goes for officer
     headcounts (add 1,000, fill 2,000 vacancies, redeploy 600): everyone
     agrees staffing goes up in some manner. A subject like that becomes a
     split only when candidates argue the substance, with details.
   - Structural change that nobody else matches is what the app most wants
     to show. Quigley's single elected board in place of eight police
     oversight bodies is the example: it changes who holds power, and no one
     else proposes anything like it. Such a proposal leads the candidate's
     summary and their key points, whatever its subject. Rank a candidate's
     "Only" items by how much they would change how the city is run, not by
     how much space the platform gives them.
3. Write `splits` and `consensus` first. Then each summary. Then the key
   points. Then reread every summary against the contrast sheet: is the
   candidate's most distinctive proposal the first thing on the page?
4. Every English field gets its Spanish in the same change (neutral
   Mexican/Chicago Spanish; proper nouns, program names, and quotes kept as
   written).
5. `npm run seed-mayor-games -- --check`. It refuses a police chunk, a fifth
   chunk, a summary over 105 words, rating words, a split with one live side,
   and a candidate on two sides. Fix what it refuses, then seed, then
   `npm run set-platform-summaries`.

## The summary: "what sets them apart"

At most four chunks, 105 words in all. Each chunk opens with a short lead and
a colon, which the app sets in bold, then one or two plain sentences. In this
order of preference:

1. `Only <Name>:` what nobody else proposes. Lead with the one a voter would
   repeat to a friend. A candidate can have more than one; pick by how much it
   would change the city, not by how much space the platform gives it.
2. A side of a split, under the split's subject (`Taxes:`, `Pensions:`), with
   the other side named: "Quigley and Cardenas would have workers share the
   cost." A proposal shared with exactly one other candidate goes here too,
   naming them ("Quigley would also reopen them").
3. `With most of the field:` one line, when most of a platform says what most
   platforms say. It saves the reader from looking for a difference that is
   not there.
4. `Not published:` one line, when a candidate has no platform or a subject
   is announced without text. Say what is missing; do not fill the space.

A candidate with one distinctive idea gets a one-chunk summary. Short is the
goal, not a failure. Never pad to match another candidate's length.

Numbers when the number is the point (50,000 homes, $22, $3,000). Attribute
a claim that is the candidate's own ("Kelly says Chicago is the only large
city without a charter"). Leave out legal mechanics, how a document is
organized, and anything about the candidate's record that is not a pitch they
make themselves.

## The splits table

One table for the whole field, on the doc. A split has a subject and two or
more sides; a side has a short label and the candidates on it. A candidate is
on one side or none: nothing on record means no side, never a guess. Every
placement must be something that candidate's platform or own words say. The
app draws every comparison from this table (the tab, the speed date, the
candidate page, the platform page, the search pages), so a fact reads the
same everywhere and a change is made once.

Add a split when a new fork appears; remove one when a side empties. The seed
drops a split from the app by itself when it has fewer than two live sides,
and says so.

## Key points and quotes

Three or four points per candidate, the same distinctive items as the
summary, most distinctive first. A point is shown on a blind date before the
name, so it names nobody and uses no he, she, his, or her.

A quote is the candidate's own words, verbatim, in the language they were
said, from this campaign, with the URL of a page that shows those words.
Campaign copy written about the candidate in the third person is not a quote.
A quote goes under the point it is about, or it does not go. A quote with an
em or en dash is cut before the dash or left out. Check that the page still
shows the words before adding one, and never attach a quote to a URL you did
not load. Quotes are also the whole of the Pick-up lines game: a candidate
with fewer than four usable quotes comes up thin, so look for those first.

## Describe, never rate

No praise or criticism words (detailed, thorough, serious, vague, thin,
strong, weak, bold, comprehensive, ambitious, radical). Do not rank
candidates or say whether a plan would work. "With most of the field" and
"Not published" are descriptions, applied to every candidate they fit. Any
list of candidates that is not ranked by a stated measure is in random order,
never alphabetical.

Plain short sentences. No em dashes or en dashes. No lists inside a chunk.

## When to rewrite

- `npm run set-platform-summaries -- --check` lists platforms that changed
  since their summary was written. Reread the platform, redo that candidate's
  row of the contrast sheet, and then check every pile: one new proposal can
  turn an "Only" into a split or a split into consensus.
- A candidate enters, leaves, or is removed from the ballot: rerun the sheet.
  The seed reports splits that lost a side.
- A candidate says something new on the record that changes a side: move
  them, with the quote and its URL on their points.
