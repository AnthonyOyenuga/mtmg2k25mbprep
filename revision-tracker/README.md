# MTMG 2K25 MB PREP: 14-Day Revision Tracker (v2)

Layout at the TOP LEVEL of the repo (or set Vercel's Root Directory to the folder holding these):

    index.html
    package.json
    vercel.json
    api/state.js
    api/auth.js
    api/quiz.js
    api/ping.js
    lib/auth.js

## Roles
- Visitor (no account): view the group's progress only.
- User (self-service sign-up): everything a visitor sees, plus "My progress": a private tracker
  (own topic statuses, session ticks, scores, error bank). Users cannot change the group's data.
- Admin: everything a user has, plus control of the GROUP's shared progress, the Admins tab
  (activity log, user list) and Reset.

## Deploy
1. Push to GitHub, import at vercel.com/new (no build settings).
2. Storage > Marketplace > Upstash Redis > connect to the project.
3. Settings > Environment Variables: ADMIN_PASSWORD (e.g. `Ada:pass1,Ben:pass2`; named entries are
   recommended so each admin has a verified name and a separate personal tracker).
   Optional: SESSION_SECRET (any long random text) to control session signing.
4. Redeploy.

## Check
- /api/ping -> {"ok":true,"passwordSet":true,"redisSet":true}

## Notes
- Sign-in sessions last 30 days. Removing an admin's password from ADMIN_PASSWORD revokes their session.
- Passwords of users are stored hashed (scrypt). Sign-ups are capped at 300 accounts.
- There is no password reset for users yet; an admin can delete a user by removing the entry
  from the `rev14:users` hash in the Upstash console.

## Quizzes (MCQs)
- Admins: Quizzes tab > "Add a quiz". Upload .txt, .md, .csv, .json or .docx, or paste text, then Preview and Save.
- Text format: numbered questions, options A to E, then "Answer: B" and optionally "Explanation: ...".
  An "ANSWER KEY" section at the end ("1. B  2. C ...") and options ending in * are also understood.
- CSV: header row with question, A, B, C, D, answer, explanation. JSON: [{question, options[], answer, explanation}].
- PDF is not read in the browser: paste its text instead. Word files that use automatic list numbering
  have no typed numbers; retype or convert them to text first.
- Users (and admins): Smart review (missed and due questions first, then new), Missed only, Everything, New only.
  "Think first" hides the options until you reveal them (active recall).
- Spaced repetition: a correct answer moves a question to a longer gap (30 min, 1, 2, 4, 7 days);
  a miss resets it and brings it back in 10 minutes. A question is "mastered" after 4 correct in a row.
- Question scores are private to each account.

## Quiz organisation (v3.1)
- Every account sees questions in number order (Q1, Q2, ...). Smart review chooses which questions to include
  (missed and due first), then shows them in number order. Everything runs the whole quiz in order.
- Quizzes are grouped by day (Day 1, Day 2, ... then "No day set") and shown as collapsed cards; tap a card to open it.
- Filter by day (chips) and by course. Admins set a quiz's day when uploading (a file name such as "Day 3 quiz"
  sets it automatically) or later from the open card.

## Editing a quiz (admin)
Open a quiz card to change its Day or Course (useful when a quiz was uploaded with the wrong course). Changes save immediately
and do not affect anyone's progress.
