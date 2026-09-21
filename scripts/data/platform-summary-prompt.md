# Platform summary prompt

The one prompt used for every mayoral candidate's "AI summary" section. The
output lives in `platform-summaries.json` and is written to production by
`npm run set-platform-summaries`. Do not vary the prompt by candidate.

## Procedure (three passes)

1. `npm run set-platform-summaries -- --dump <dir>` and read EVERY candidate's
   platform in full, exactly as the app lists it (unarchived policies, in
   order). Nothing else is a source: not the campaign site, not news, not
   memory, not the candidate's record.
2. Pass one: write "The platform" for every candidate.
3. Pass two: with all the platforms read, write "Next to the other
   candidates" for every candidate.
4. Pass three: lay all eighteen pieces side by side and even them out. The
   same fact must read the same way on every page it appears (one wording for
   "Cardenas would add 200 officers"), every candidate gets the same kinds of
   chunks at about the same length, and nobody's page carries a caveat or a
   compliment the others do not get.
5. Record each candidate's `policiesHash` from `hashes.json` in the entry.
6. Translate to Spanish in the same change (neutral Mexican/Chicago Spanish,
   proper nouns and program names kept as written).

## Format

Each piece is a few chunks separated by a blank line. A chunk opens with a
short lead and a colon ("Housing: ", "Only Kelly: "), which the app sets in
bold, then one or two plain sentences. The app shows this at full body size
on a phone, so length is the enemy: a chunk past about 35 words is a wall.

## The prompt

> You are telling a Chicago voter on their phone what a candidate for mayor
> would do. They will not read the policies. They want something they can
> take in at a glance and repeat to a friend. Your only source is the list of
> policies below, as the campaign published them.
>
> "The platform": three or four chunks, 100 words at most in total. Each chunk
> is one subject and says what the candidate would do, in everyday words,
> with their own numbers when the number is the point (50,000 homes, 200
> officers). Order and weight follow the platform: lead with what it leads
> with and spends the most words on. A side item gets no space even if it is
> colorful. If the policies are written for a different office, or a subject
> is announced but not published, say so plainly.
>
> "Next to the other candidates": two to four chunks, 90 words at most in
> total. What only this candidate proposes, the sharpest differences with
> named candidates, and any subject most others cover that this one does not.
> A contrast earns its chunk only if it is a real fork a voter would argue
> about at dinner: who pays (lower taxes, a bigger tax base, a new tax), cash
> to households, renters against builders, what to do with vacant land,
> police on trains against more trains, how to face pensions, mental health
> response. Skip subjects where the candidates differ only in detail. Police
> staffing was tried and cut for exactly that reason: everyone wants more
> detectives and fewer officers at desks, and the numbers told voters nothing.
> "Only X" is for proposals nobody else lists, not for a stance most of the
> city shares (criticizing Chicago Teachers Union leadership is not unique).
>
> Summarize. Never describe the document: no counts of policies or sections,
> no remarks on format, no "the text says", no "cites figures". Leave out
> legal mechanics and caveats (what needs a constitutional amendment, what
> needs Springfield), and leave out anything nearly every candidate says
> (faster permits, responsible budgeting, making pension payments): it tells
> the voter nothing about this one. A habit that marks the platform can be
> said once as a plain fact (points to cities that already did it, comes with
> 100-day plans, leans on her record as comptroller).
>
> Each piece must stand on its own, so name the candidate and name the
> others. Describe, never judge. No praise or criticism words (detailed,
> thorough, real, serious, vague, thin, strong, weak, bold, comprehensive).
> Do not rank candidates or say whether a plan would work. Do not use
> anything you know about the candidate from outside the list.
>
> Plain short sentences. No em dashes or en dashes. No lists, no headings
> beyond the chunk leads.

## When to rewrite

`npm run set-platform-summaries -- --check` lists candidates whose live
platform no longer matches the hash their summary was written from. Rewrite
that candidate's platform piece, then reread every candidate's comparison,
since a changed platform can date any of them. A newly provisioned candidate
means a new entry and the same reread.
