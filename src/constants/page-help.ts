/**
 * The help sheet's fixed part for every screen (2026-09-30): what the page
 * shows and what a person can do there, in English source text that every
 * dictionary translates (each string is a key, like any other). Keyed by
 * the screen's route as useSegments() names it; the command tab has one
 * entry per role. The live part, built from each page's own data, comes
 * from usePageSummary (src/lib/page-help.ts).
 *
 * When a screen gains or changes a control, update its entry here and in
 * every dictionary in the same change.
 */
export interface PageHelp {
  what: string;
  can: string[];
}

export const PAGE_HELP: Record<string, PageHelp> = {
  '(tabs)/index': {
    what: 'The big board of citywide concerns, ranked by how urgent people rate them. Below it are open citywide polls from elected officials, then City Council\'s upcoming meetings and recent split votes.',
    can: [
      'Tap "Raise a concern" to post a citywide concern, up to 2 a day. Signed out, the button reads "Sign in to raise a concern".',
      'Tap 1 to 5 on a concern\'s Minor-to-Urgent bar to rate its priority. Tap your number again to take the vote back.',
      'Tap "All users" or "Verified only" to switch whose votes are counted and ranked. Tap "Highest rated" or "Newest" to change the order. Rank numbers stay the same either way.',
      'Tap a concern to read it in full and comment. Tap "Show more" to load 20 more.',
      'Vote on a poll under "Citywide votes". You see the full results once you vote, and tapping your choice again takes your vote back.',
      'Under "City Council", check meeting times and public comment deadlines, open agendas, tap "How to give public comment", or open a recent split vote.',
      'Tap the info icon at the bottom to read what verified means and what Didit shares with the app.',
    ],
  },
  '(tabs)/ward': {
    what: 'Every ward\'s board is public. If you have a home ward, this opens on it: the ward\'s concerns, its alderman, and its open and past polls. Otherwise you see all 50 wards as a grid and a map.',
    can: [
      'Pick a ward from the number grid or the map. Tap "All wards" to browse others and "Back to my ward" to return.',
      'Tap "Raise a ward concern" to post in your home ward, up to 3 times a day. In other wards, tap "Raise a concern in this ward" to post once a week, in up to 5 wards a week.',
      'Tap 1 to 5 on a concern to rate its priority, and tap yours again to take it back. Here the verified count includes only verified residents of this ward.',
      'Tap the alderman to see their grade and ask them a question.',
      'Vote on polls under "On the ballot" if this is your home ward. Results show after you vote. "Past votes" shows the results of closed polls.',
      'Without a home ward, tap "Verify your residency" (with an ID, your votes count in the verified tallies) or "Set your home ward" (no ID needed).',
      'Signed out, tap "Sign in to vote and comment".',
    ],
  },
  '(tabs)/election': {
    what: 'Your next two ballots, each in its own color band. The red bands hold the February 23, 2027 races: mayor, questions put to every mayoral candidate, and the ward races. The blue band holds the November 3 ballot: your races, how to vote, and every state, county, school board, judge, and district race.',
    can: [
      'Tap a box under the header, such as "judges" or "ward races", to jump to that section. Tap the countdown line to jump to the November ballot.',
      'Tap "Find my races" and enter your address once to see the races on your ballot first. Only the district numbers are kept, never the address.',
      'Tap a mayoral candidate to read their full platform and comment on any policy.',
      'Type in "Ask every candidate at once…" and tap "Put it to the candidates". The limit is 3 a day. Tap the arrow on a question to join it, and tap again to leave.',
      'Tap a race, a district number, or a ward number to see who is running. "Your ward" shows your alderman\'s record next to their challengers.',
      'Use the "When and where to vote" links to register, apply for or track a mail ballot, find early voting sites, or find your polling place.',
      'Tap "Open the guide" for Injustice Watch\'s reporting on every judge on the ballot.',
    ],
  },
  '(tabs)/notifications': {
    what: 'Things sent to you, newest first: answers to your questions, comments on your posts, replies to your comments, writing credits, voting deadline reminders, and notices about verification or posting limits. Officials also get new questions here.',
    can: [
      'Tap a notification to open the exact item it is about. Opening it marks it read.',
      'Look for the dot and bold title, which mark notifications you haven\'t opened yet.',
      'Tap "Mark all read" to clear every unread notification at once.',
      'Choose which kinds also reach your phone in Settings, under "Phone notifications".',
      'Signed out, tap "Sign in" to start getting notifications.',
    ],
  },
  '(tabs)/profile': {
    what: 'Your display name, whether you are verified, your home ward, and counts of your concerns, comments, votes, and judgments. Officials and candidates also see their public card as voters see it.',
    can: [
      'Tap "Edit display name" to change your name, or "Shuffle" for a random one, then "Save". Your real identity is never shown.',
      'Tap "My activity" to see the concerns and questions you have posted.',
      'Without a home ward, tap "Verify your residency" (with an ID) or "Set your home ward" (no ID).',
      'With a ward set without an ID, tap "Verify your residency" so your votes count as verified. Tap "Change home ward" to switch, until posting there locks it for a while.',
      'Tap "Unblock" next to anyone under "Blocked users" to see their posts again.',
      'Tap "Settings" (the gear) for language, phone notifications, and account options. Tap "Sign out" and confirm to leave.',
      'Signed out, tap "Sign in or create account", or open "Settings" or "Privacy & data".',
    ],
  },
  '(tabs)/command#official': {
    what: 'Your work as an official: residents\' questions waiting for your response, your polls, the issues people are raising in your ward (or citywide), and your public card.',
    can: [
      'Type in "Write your response…" under a question and tap "Post response". Questions are sorted by most joined. Each shows how many verified residents joined it.',
      'Answer within a week. A question left a week without a response counts as ignored in your grade, and questions from verified residents count double.',
      'Tap "New ward poll" or "New citywide poll" to put a question to the public. You see live results on your own polls. Tap "Close voting" to end one.',
      'Tap an issue to read it and comment. Issues are ranked by verified residents, and ones you have commented on fold down.',
      'Tap "Edit my card" to change your bio, your portrait link, and the "Question alert threshold", the number of joins at which a question sends you an alert.',
      'If asked, tap "Send confirmation email" and then "I confirmed it". Until then you can read but not respond, post, or edit.',
      'Tap "View your public page" to see it exactly as voters do.',
    ],
  },
  '(tabs)/command#candidate': {
    what: 'Your work as a candidate: "ask every candidate" questions you haven\'t answered, the latest comments on your policies, your public card, and your platform.',
    can: [
      'Type your answer under a question and tap "Post answer". Voters see every candidate\'s answer side by side. You can revise it later with "Update answer", but it cannot be taken down.',
      'Tap a question marked "You answered" to see it with every candidate\'s answer.',
      'Tap a policy under "Comments on your policies" to read its newest comments and reply.',
      'Tap "Edit my card" to change your bio, portrait link, and campaign website. Tap "View your public page" to see it as voters do.',
      'Tap "Add a policy", or tap any policy to edit it. A policy you added yourself, not imported from your site, can also be hidden or deleted there.',
      'If your platform comes from your campaign site, tap "Sync from my site" to update it now instead of waiting for the nightly sync. Editing an imported policy stops future syncs from changing it.',
      'If asked, tap "Send confirmation email" and then "I confirmed it". Until then you can read but not answer, post, or edit.',
    ],
  },
  'concern/[id]': {
    what: 'One concern from the board: its ward or citywide label, the full text and sources, how much people say it matters, and the comments. Results show all users and verified residents side by side.',
    can: [
      'Tap a number on the 1 to 5 scale, from "Minor" to "Urgent", to say how much it matters. Tap your number again to take your vote back. Signed out, a tap opens sign-in.',
      'Read "Results" for each level\'s count and percentage, all users and verified. On a ward concern, the verified count includes only verified residents of that ward.',
      'Add a comment in "Add to the discussion" and tap "Post comment", or tap "Reply" under a comment. The "..." button adds source links, and typing *1 in your text cites the first one.',
      'Rate comments with the up and down arrows to rank them under "Best". Tap your arrow again to take it back. "Newest" sorts by time.',
      'On your own concern, tap "Edit" or "Withdraw concern". Withdrawing deletes it with all its votes and comments. "Edited · See edit history" shows earlier versions.',
      'Tap the flag icon to report the concern or block its author. Tap the share icon to send a web link that anyone can open.',
      'On a ward concern, tap "Report it to 311" at the bottom if it is also a city service problem.',
    ],
  },
  'official/[id]': {
    what: 'An official\'s report card: an overall letter grade, constituent approval, an answers score, contact details, their AMA questions and responses, and, for aldermen, Council votes from the City Clerk.',
    can: [
      'Tap "Approve" or "Disapprove", and tap your choice again to take it back. Rating takes a home ward. Only verified residents of the official\'s ward move the grade.',
      'Type a question in the ask box and tap "Ask". Posting limits apply, and the line under the box says when you can ask again.',
      'Tap the arrow and count on someone else\'s question to join it ("I want this answered too"). Tap again to leave. Questions more people have joined count more in the answers grade.',
      'Under a response, tap "Answered" or "Dodged" to judge it. You can switch your verdict later. The results show all users and verified residents separately.',
      'Under an answered question, tap "Continue the conversation" to reply to the official and other readers.',
      'On your own question, tap "Edit" or "Withdraw my question". Both are available until the official responds.',
      'Tap the info icon by "Answers" to see how grading works, or a vote under "Voting record" to see it at the Clerk. The flag icon reports or blocks, and the share icon sends a web link.',
    ],
  },
  'officials': {
    what: 'Every Chicago official on the app: citywide offices first, then each ward in order. Each row shows approval, an answers grade, an overall letter, and what the grade is based on.',
    can: [
      'Tap any official to open their page, where you can rate them and ask a question.',
      'With a home ward, find your own alderman pinned at the top under "your alderman". They also appear in the full list.',
      'Read "% approval" as the approval of verified residents only. It shows "-" until 5 verified residents of the ward have voted.',
      'Check the "From N verified residents · N graded questions" line to see how many people and questions a grade comes from.',
      'Look for "on the platform" to see which officials have claimed their profile and answer questions here.',
    ],
  },
  'candidate/[id]': {
    what: 'A mayoral candidate\'s card and platform: a note on what they have published, an AI summary, and every policy grouped by section, each showing its comment count.',
    can: [
      'Tap "Campaign website" to open their site, or the copy icon beside it to copy the link.',
      'Tap the orange "AI summary" bar to read what the platform proposes and how it compares with the other candidates. Every candidate\'s summary uses the same prompt, written from the policies listed.',
      'Tap a policy to read all of it and comment on it. There is no support or oppose vote on policies, only comments.',
      'Tap the "Imported from" link to see the campaign page those policies were copied from. A green note at the top also opens that page.',
      'When the candidate has open polls, vote in them on this page. The results show once you vote.',
      'Tap the share icon to send a web link to this page.',
    ],
  },
  'candidate/[id]/[policyId]': {
    what: 'One policy from a candidate\'s platform in full, with the sources behind it and a comment thread where people argue for or against it.',
    can: [
      'Tap "Show more" to open a long policy. Tap a link under "Receipts" to open a source, or its copy icon to copy the link.',
      'Tap the "From the platform of" line to go to the candidate\'s page. The "Imported from" link opens the campaign page the policy came from.',
      'Write in "Add to the discussion" and tap "Post comment". Signed out, tap "Sign in to comment". The "..." button adds source links you can cite as *1.',
      'Tap "Reply" to answer a comment in its thread. The up and down arrows rank comments under "Best", and tapping your arrow again takes it back.',
      'Tap "Edit" or "Remove" on your own comments. "Edited · See edit history" shows earlier versions.',
      'Look for the "candidate" chip on the candidate\'s own replies, and "writing credit" on comments they credited for shaping the policy.',
      'Tap the flag icon to report the policy or a comment, or to block its author. Tap the share icon to send a web link.',
    ],
  },
  'election-question/[id]': {
    what: 'A question put to every mayoral candidate, with each candidate\'s answer side by side. Readers\' votes set the order of the answers, and no vote counts are shown.',
    can: [
      'Tap the arrow and count to join the question ("I want this answered too"), and tap again to leave. You cannot join a question you asked.',
      'Tap "Read the rest" to open a long answer, or the candidate\'s name to go to their page.',
      'Tap the up arrow ("This answers it") or the down arrow ("This dodges it") on an answer. Tap the same arrow again to take your vote back.',
      'Votes from verified residents set the order first, and votes from all users break ties.',
      'If you asked the question, tap "Edit" or "Withdraw question". Both are available until the first candidate answers.',
      'Tap the flag icon to report the question or block its asker. Tap the share icon to send a web link.',
    ],
  },
  'my-activity': {
    what: 'Everything you have posted, newest first: the concerns you raised and the questions you asked officials.',
    can: [
      'Signed out, tap "Sign in first" to see your activity.',
      'Tap a concern to open it. Each row shows its ward or citywide label, its vote count, its comment count and its age.',
      'Tap a question to open the page of the official you asked, where the question and any response appear.',
      'Check the status on each question: "Awaiting response", "Community reviewing", "Answered" or "Dodged".',
      'Edit or withdraw a concern or a question from its own page. This page only lists them.',
    ],
  },
  'election-race/[race]': {
    what: 'One race on the November 3, 2026 or February 23, 2027 ballot. It lists every candidate, with the first lines of what each says they are running on, so you can compare them here. Judge races also show the seat, the court and bar association ratings.',
    can: [
      'Tap a candidate\'s card to open their full card, with what they are running on, their background, their campaign site and the sources.',
      'Compare candidates on this page. Each card shows their party, an "Incumbent" chip if they hold the seat, and a preview of what they are running on.',
      'On judge races, read each rating chip as the bar association or Injustice Watch worded it. Tap a chip to open that group\'s evaluation.',
      'Watch for the red banner on a judge\'s card. It counts how many bar associations rated that judge negatively.',
      'Open "Injustice Watch judicial guide" or "Chicago Bar Association evaluations" from the box at the top of any judge race.',
      'On "Judges up for retention", each judge is a separate yes-or-no question on your ballot. A judge needs 60 percent yes to stay.',
      'Look under "Write-in candidates" for declared write-ins. Their names are not printed on the ballot, and the section explains how to write one in.',
    ],
  },
  'election-candidate/[id]': {
    what: 'One ballot candidate\'s card, put together from public sources. It shows what they say they are running on, their background and, for judges, the seat, the court and their ratings. These candidates do not have accounts in the app.',
    can: [
      'Tap "Campaign site" to open their website, or tap the copy icon beside it to copy the link.',
      'Read "Running on" for what they say they will do. For a judge up for retention, this section is called "Record".',
      'Tap a chip under "Ratings" to read that group\'s evaluation. A red banner counts negative ratings from bar associations.',
      'Tap a link under "Compiled from public sources:" to see where this card\'s text came from.',
      'If they have a "Write-in" chip, tap "How to mark your ballot (Board of Elections)" to learn how to write in a name.',
    ],
  },
  'school-board/[race]': {
    what: 'One Chicago school board race on the November 3, 2026 ballot. It lists each nominee with the first lines of what they are running on. The line under the title tells you who votes in this race: every Chicagoan, or only that district\'s residents.',
    can: [
      'Tap a nominee\'s card to open their full card, with what they are running on, their background, their campaign site and the sources.',
      'Compare nominees on this page by the preview of what each is running on and the "Incumbent" chip.',
      'Look under "Write-in candidates" for declared write-ins, whose names are not printed on the ballot, and read how to write one in.',
      'Find your school board district with "Find my races" on the election tab. School board districts do not follow ward lines.',
    ],
  },
  'school-board-candidate/[id]': {
    what: 'One school board nominee\'s card, put together from public sources. It shows what they say they are running on, their background and their campaign site. Nominees do not have accounts in the app.',
    can: [
      'Tap "Campaign site" to open their website, or tap the copy icon beside it to copy the link.',
      'Read "Running on" for what they say they will do, and "Background" for their work history.',
      'Tap a link under "Compiled from public sources:" to see where this card\'s text came from.',
      'If they have a "Write-in" chip, tap "How to mark your ballot (Board of Elections)" to learn how to write in a name.',
    ],
  },
  'ward-race/[ward]': {
    what: 'One ward\'s race for alderman on the February 23, 2027 ballot. It shows the current alderman\'s report card from this app next to everyone who has declared against them.',
    can: [
      'Tap the alderman\'s row to open their page, with the full report card and questions people asked them. Residents\' ratings and judged answers set the grade, not the app.',
      'Read the line under the grade. It shows how many verified residents rated the alderman and how many questions were graded.',
      'Tap "What they say they\'re running on" to open the alderman\'s campaign card. It only appears if they are running again.',
      'Compare the challengers under "Declared challengers" by background and a preview of what each is running on. Tap one to see their full card.',
      'Check back after candidates file on October 19-26, 2026. This page adds challengers as they announce and file.',
      'Tap the share icon at the top to send this race. The link opens on the web for people without the app.',
    ],
  },
  'my-districts': {
    what: 'Your district numbers for races that depend on your street address, not just your ward. That covers US House, Illinois Senate and House, Cook County Commissioner, Board of Review, judicial subcircuit, school board and police district.',
    can: [
      'Type your home address and tap "Find my districts". If it matches, you go back to the election tab with your own races listed first.',
      'Know that your address is sent to the US Census Bureau to find it on the map. The app keeps only your district numbers, never the address.',
      'Type a new address under "Use a different address" to look up your districts again.',
      'If the address is in a different ward than your home ward, tap "Change home ward" first. If you are verified, tap "Open Settings" to verify your new address.',
      'Look up at most 5 addresses a day. Addresses outside Chicago are refused.',
      'If you later pick a different home ward, your saved districts are cleared.',
    ],
  },
  'set-ward': {
    what: 'Pick your home ward without showing an ID. A home ward lets you vote on ward polls, rate your alderman, and post up to 3 times a day there. Your votes count in the all-users totals, not the verified ones.',
    can: [
      'Read "How your home ward works", then tap "Next" to get to the ward picker. If you already have a ward, you go straight to the picker.',
      'Tap a ward number and then "Set home ward" (or "Change home ward"). The ward\'s neighborhoods appear under the grid.',
      'Tap "Not sure of your ward? Look up your address" to use the City of Chicago\'s ward lookup.',
      'Change your ward as often as you like, up to 5 times a day, until you post there. Two posts lock it for a week, and a third locks it for 3 months.',
      'Tap "Verify your residency" to have Didit check your ID. This puts you in the ward on your ID, replaces the one you picked, and counts you in verified totals.',
      'Votes you have already cast stay as they are when you change wards.',
      'If you are verified or an official, this page only shows your ward. Verified people move wards by verifying a new address in Settings.',
    ],
  },
  'sign-in': {
    what: 'Sign in to direct democracy or create an account. You can use an email and password, a sign-in link sent to your email, or Google or Apple.',
    can: [
      'Tap "Create an account" or "Sign in" at the top to switch between making a new account and signing in to one you already have.',
      'Type your "Email" and "Password", then tap "Enter". A new password needs at least 6 characters. Tap "Show" to see what you typed.',
      'Tap "Email me a sign-in link" while signing in to get a link that signs you in with no password. Open it on this phone.',
      'Tap "Forgot password?" to get an email with a link for setting a new password.',
      'Tap Google, or Apple on iPhone and the web, to sign in with that account instead.',
      'Tap "privacy policy" to see what the app stores about you before you continue.',
    ],
  },
  'new-concern': {
    what: 'A form for raising a concern that others can prioritize, either citywide on the big board or in one ward.',
    can: [
      'Write a "Title" of at least 4 characters, then describe the issue under "What’s going on?" in at least 20 characters.',
      'Tap "Add a reference link" to add up to 10 https links. Type *1 or *2 in your text to cite a link where readers can tap it.',
      'Choose "Citywide" or a ward under "Where does this belong?". If you have no home ward yet, verify your residency or set a home ward first.',
      'Post up to 2 citywide concerns a day, and up to 3 a day in your home ward.',
      'Post in a ward that isn\'t your home ward once a week, in up to 5 such wards a week.',
      'Tap "Post concern" to publish it and open it. When you\'ve hit a limit, the button stays off and a note says when you can post again.',
    ],
  },
  'new-poll': {
    what: 'A form for officials to ask constituents a question as a poll, either in their ward or citywide.',
    can: [
      'Write the "Question" in at least 10 characters. Add background, tradeoffs, or links under "Context (optional)".',
      'Choose a "Vote format": "Yes / No", "Multiple choice" (pick one), "Approval" (pick every option you support), or "5-point scale".',
      'For multiple choice or approval, list 2 to 12 options under "Options (one per line)".',
      'Under "Audience", choose your ward\'s residents or "Citywide (everyone)". Officials without a ward can only post citywide.',
      'Know that ward polls take votes from people whose home ward is yours. Verified residents are counted separately in both kinds of poll.',
      'Tap "Open the vote" to start the poll. You see live results but can\'t vote on your own poll. You close voting from the command center.',
    ],
  },
  'edit-policy': {
    what: 'Write a new plank of your platform or edit one you already have. Voters respond in the comments. There is no support or oppose vote.',
    can: [
      'Fill in a "Title" of at least 3 characters, an optional "Section", and "The policy", which can be up to 20,000 characters.',
      'List up to 20 source links under "Receipts - source links", one per line. Each must start with https://.',
      'Tap "Publish policy" to add a new policy to the end of your platform, or "Save changes" to update one.',
      'Know that saving a policy imported from your campaign site takes it over. It becomes yours to manage here, its comments stay, and the site stops updating it.',
      'Tap "Hide" to take a policy you wrote here off your public platform while keeping its comments. Tap "Unhide" to bring it back.',
      'Tap "Delete" and confirm twice to remove the policy and all its comments for good.',
    ],
  },
  'verify': {
    what: 'Prove you are an adult Chicago resident through Didit, a third-party identity service, so your votes count in your ward\'s verified tallies. Opened from Settings, this page verifies a new address after a move.',
    can: [
      'Tap "Start verification with Didit" to check your ID and Chicago address there. Your documents go to Didit, never to the app. People under 18 are declined.',
      'Know that the app keeps only a verified yes or no, your ward and district numbers, and an identifier that stops one ID from verifying twice.',
      'Know that the first 500 checks each month are free, with 3 free attempts per account every 3 months. After that, the button shows the store\'s price.',
      'If asked to confirm your email first, tap "Send confirmation email", open the email, then tap "I confirmed it". Google and Apple accounts skip this step.',
      'If you never open the verification link, your free attempt or your payment carries over to your next try. A verification already in progress continues where you left off.',
      'When moving, use an ID with your new address, or an ID plus a utility bill or bank statement from the last 3 months. Checking a bill always costs money.',
      'Know that an address outside Chicago changes nothing. A new ward replaces your old one, and you can move once every 3 months.',
    ],
  },
  'settings': {
    what: 'Your settings: language, phone notifications, verification and moving, privacy, deleting your account, and the community rules.',
    can: [
      'Tap a language to switch the whole app to it. This works when you\'re signed out too.',
      'Under "Phone notifications", turn on each kind you want: election reminders, answers, comments, replies, writing credits, and new questions (officials only). The first switch you turn on asks your phone for permission.',
      'Tap "Open phone settings" if your phone has notifications turned off for this app.',
      'Without verification, tap "Verify your residency" or "Set your home ward" (no ID needed). You can tap "Change home ward" until posting in that ward locks it.',
      'Moved within Chicago? Once verified, tap "Verify with my ID" or "Verify with a bill or statement". You can do this once every 3 months.',
      'Tap "Privacy & data" to see what the app stores. "Community rules" is at the bottom of the page.',
      'Tap "Delete my account…" and confirm twice to remove your sign-in, profile, verification, and every vote you cast. Your posts stay, credited to [deleted].',
    ],
  },
  'privacy': {
    what: 'What direct democracy stores about you, what it never sees, who can see what, and the controls you have over your data.',
    can: [
      'Check "What we store": your email, your display name, what you post, your ballots, and, if you verify, only a yes or no, your ward and district numbers, and an identifier that blocks duplicate accounts.',
      'Check "What we never see": Didit checks your ID documents, and your address is used once to find your ward and districts, then never saved.',
      'See who can read what. Only you can see your profile and ballots. Others see your display name, a verified badge, and vote totals.',
      'Take back a vote while voting is open, withdraw your concerns and unanswered questions, and delete your comments. Ballots in a closed poll are final.',
      'Change your display name at any time, or block a user to hide their content from you.',
      'Delete your account from Settings to remove your sign-in, profile, verification, and every vote you cast. Your posts stay, credited to [deleted].',
    ],
  },
  'rules': {
    what: 'The community rules for everything posted in the app, and what happens to posts and accounts that break them.',
    can: [
      'Read the six rules: keep it about Chicago and its government, and no threats, harassment, hate, spam, private information, impersonation, or sexual content involving minors.',
      'Tap the flag icon on a post or comment to report it, or to block its author so you stop seeing their content.',
      'Know that reports are reviewed every week. Posts that break the rules come down, and serious or repeated cases lose the account.',
      'Know that an account reported by 5 or more different people is hidden until it is reviewed.',
    ],
  },
};
