# Content sourcing follow-ups (news tab and ward newsletters)

Saved 2026-10-08. Items move out of here when they are done. Nothing here
has been sent; every email goes out from Brian.

## News tab: outlets to ask

The app lists each of these under "Not included" as blocked (or will, once
added). When one is sent, the outlet's status in `NOT_INCLUDED`
(functions/src/news.ts) becomes `asked`; if it agrees it moves into
`SOURCES`; if it says no, `declined`.

| Outlet | Send to | What happens to our reader |
|---|---|---|
| Chicago Tribune | tcasales@tribpub.com (licensing contact on its contact page) | 403 for any feed reader |
| Crain's Chicago Business | contact form on chicagobusiness.com (no address listed) | 403 for any feed reader |
| Hyde Park Herald | Hannah Faris, editor, h.faris@hpherald.com | 429 "too many requests" from our server |
| Axios Chicago | no address found yet | 403 for any feed reader (not yet on the app's list) |
| Chicago Defender | no address found yet | 403 for any feed reader (not yet on the app's list) |

For outlets that block every feed reader (Tribune, Crain's, Axios, Defender):

> Subject: Permission to list your headlines in direct democracy
>
> Hello, I run direct democracy, a free Chicago civic app. Its news tab lists headlines from every newsroom that covers Chicago, newest first, and each headline links to the story on the newsroom's own site. We show only the headline and its link, never article text. Your site turns away our feed reader, which identifies itself as "directdemocracy-news". May we read your RSS feed for headlines and links, or is there a feed you'd prefer we use? If you'd rather not be included, the app will say so. Thank you, Brian Carlisle

For the Herald, whose feed works but whose host blocks our server:

> Subject: Your feed and direct democracy's news tab
>
> Hello, I run direct democracy, a free Chicago civic app whose news tab lists headlines from every Chicago newsroom. Each headline links to your site, and we never show article text. Your feed works from a regular connection, but your host blocks our server, which runs on Google Cloud (it gets "too many requests"). Our reader checks every 20 minutes and identifies itself as "directdemocracy-news". Could you allow it, or tell us how you'd prefer we read your feed? Thank you, Brian Carlisle

Traffic rule (Brian 2026-10-08): an outlet must be in the Tranco top
million. `npm run news-ranks` prints every rank and flags a crossing.
Below the bar as of 2026-10-08, so not in and not asked: The TRiiBE,
Borderless, City Bureau, Illinois Answers Project, Austin Weekly News.

Left out on purpose: Hoodline (AI-written local summaries; Brian 2026-10-08: "we don't need summaries, we are the summary").

## Ward newsletters: offices to ask

Send from directdemocracy.wards@gmail.com so the office adds that address
(one email with these in BCC works). All are @cityofchicago.org.

- No signup found: 5 (Ward05), 13 (Ward13), 14 (Ward14), 37 (Ward37), 38 (Ward38), 43 (Ward43)
- Signup form failed 2026-10-05: 21 (Ward21), 31 (Ward31), 32 (Ward32), 41 (Ward41), 42 (Ward42). Retrying the form in a browser signed into the inbox also works. 31, 32, 42 are already read from their archive pages.
- Only a campaign list found: 8 (Ward08), 24 (ward24)

> Subject: Please add us to the ward newsletter
>
> Hello, could you add directdemocracy.wards@gmail.com to the ward office's email newsletter? direct democracy is a free Chicago civic app that lists each ward's announced community meetings and a short summary of the ward's newsletter on its ward page, with a link to the office. Thank you, Brian Carlisle

Decisions open: ward 8's only list is on aldermanmichelleharris.com and
ward 41's is paid for by the campaign committee. The rule (AGENTS.md)
allows a campaign list only when the office's own site offers nothing
else, which is the case for both; subscribing means submitting their forms
from the inbox.

## Ongoing work

- Newsrooms with no usable feed yet that clear the traffic bar: look on
  each site for another feed address. Chicago Magazine (feed empty, rank
  43k), Windy City Times (307k), Dziennik Zwiazkowy (Polish daily, 478k),
  Univision Chicago (univision.com). Below the bar, so only if they rise:
  AustinTalks, Lawndale News, Gazette Chicago. Chicago Journal has not
  posted since November 2025.
- Subscribed, nothing received yet: wards 4, 6, 7, 9, 16, 17, 27, 28, 45, 47.
  The Monday report flags any still silent on 2026-10-19; then they join the
  ward office email above.
- Ward 14's site is down (recheck). Ward 15's Mailchimp list has been quiet
  since 2026-08-14. Ward 18 sends text alerts only (Ward18 to 22828): nothing
  for the inbox to read. Ward 19 prints quarterly PDFs on its site.
- Optional: Strong Towns Chicago's open-source ward newsletter tracker
  (chicago-newsletter-aggregator.open-advocacy.com) could share its sources.
