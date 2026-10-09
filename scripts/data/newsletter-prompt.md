# Ward newsletter reading prompt

The ONE prompt for every ward newsletter issue and every weekly digest. Same
words for every ward and every alderman. Used by the daily scheduled task
"ward-newsletter-digest" with `npm run newsletters` (see scripts/newsletters.ts).

## Who reads the output

A Chicago resident on a phone, on their ward's page in direct democracy,
deciding whether there is anything this week they should show up for, weigh
in on, or know about. They will not read the newsletter itself unless
something in the summary sends them there.

## Per issue

Input: one queued issue (`id`, `ward`, `title`, `url`, `sentAt`, `text`).
Output: one object in the results array:

```json
{
  "id": "<the queued id>",
  "skip": false,
  "sentAt": "<only if the queue's date is a first-seen date and the issue states its own date: ISO with Chicago offset>",
  "summary": "...",
  "summaryEs": "...",
  "officeHours": null,
  "meetings": []
}
```

### skip

`true` only when the issue is old news: an archive link whose own text dates
it more than 3 weeks before the queue's `sentAt`. A skipped issue needs no
summary (empty strings) and no meetings.

### summary / summaryEs

- 2 to 4 short sentences, at most 70 words. Spanish is a faithful
  translation, not a rewrite.
- What the issue tells residents, weighted the way the issue weights it:
  meetings and hearings, decisions coming up (zoning, budget, participatory
  budgeting), closures and construction, services and deadlines, safety
  notices. Lead with whatever a resident could act on.
- Describe, never rate. Attribute to the office ("The office announces",
  "The newsletter lists"). No praise words, no superlatives, no
  characterizing the alderman, no judging a position. An alderman's stated
  position may be reported as theirs ("Alderman X writes that she opposes
  ...").
- Concrete: names of streets, dates, programs. No filler ("lots of updates",
  "stay informed"). Nothing about the newsletter's format.
- No em or en dashes anywhere. Plain hyphens, commas, periods.
- Dates, never relative time: "on Tuesday, Sept 29", not "tonight",
  "tomorrow", or "this week". The summary is read days later.
- People's quoted words stay in their original language.

### officeHours

When the issue states the ward office's regular hours or a standing ward
night, `{ "text": "...", "textEs": "..." }` in one or two short lines
("Mon 10 AM to 6:30 PM, Tue to Thu 10 AM to 5 PM, Fri by phone or
appointment. Ward night: Mondays, 5 to 6:30 PM."). Otherwise `null`.

### meetings

Public meetings in the future (relative to the issue's date) where a
resident can show up and be heard or ask questions:

- `development`: a community meeting on a proposed project, zoning change,
  liquor license, or land use; a developer presentation; a hearing on one.
- `ward`: a town hall, ward night held as a special event, budget meeting,
  participatory budgeting assembly or vote, a ward committee meeting open to
  the public (zoning advisory, public safety, youth council).
- `community`: other public civic meetings the issue announces: CAPS beat
  meetings, police district council, LSC, SSA, park advisory council,
  CDOT or city project meetings.

Not meetings: festivals, parties, fairs, giveaways, clinics, shredding days,
mobile DMV, job fairs, volunteer shifts, filming notices.

Each meeting:

```json
{
  "title": "Community meeting on rezoning 5036-44 N Ashland",
  "kind": "development",
  "start": "2026-10-14T18:30:00-05:00",
  "end": null,
  "place": "Online",
  "address": null,
  "online": true,
  "url": "https://bit.ly/5036ashland"
}
```

- `title`: says what it is about in under 10 words, in English (it is
  shown as written; it names the place or project, not the newsletter).
- `start`: date AND time stated in the issue, as ISO 8601 with the Chicago
  offset (-05:00 during daylight time, -06:00 after the first Sunday in
  November). No time stated: leave the meeting out.
- `place`: the venue as written ("Budlong Elementary, 2701 W Foster Ave");
  `address`: a street address that a map can find, when given; `online`:
  true for virtual or hybrid.
- `url`: the RSVP, registration, or details link from the issue (https
  only), else null.
- A recurring standing meeting (every Monday) is officeHours, not a meeting.

## Weekly digest (Mondays)

Input: `npm run newsletters -- recent --days 7` (the week's issue summaries,
ward by ward). Output:

```json
{
  "weekOf": "<Monday, YYYY-MM-DD>",
  "summary": "...",
  "summaryEs": "...",
  "wards": [1, 2, 3],
  "issueCount": 0
}
```

- 4 to 7 short chunks separated by blank lines, each opening with a short
  topic lead and a colon (`Zoning meetings: ...`, under 32 characters; the
  app sets it bold), then what ward offices told residents, naming the
  wards ("the 40th and 48th wards"). Shared threads
  first (several wards on the same city issue), then notable one-ward items
  a resident elsewhere would still want to know.
- Same rules as issue summaries: describe, never rate or rank wards or
  aldermen; no "most active"; no em or en dashes.
- `wards`: every ward with an issue in the input; `issueCount`: the number
  of issues.
