# 14-Day Revision Tracker (shared, admin-only)

Required layout at the TOP LEVEL of your repo (or set Vercel's Root Directory to the folder holding these):

    index.html
    package.json
    vercel.json
    api/state.js
    api/ping.js

## Deploy
1. Push these files to GitHub and import the repo at vercel.com/new (no build settings).
2. Storage > Marketplace > Upstash Redis > create and connect it to the project.
3. Settings > Environment Variables: add ADMIN_PASSWORD (comma-separate for several admins).
4. Redeploy.

## Check it works
- /api/ping  -> {"ok":true,"passwordSet":true,"redisSet":true}  (404 = api folder not found; false = variable missing)
- /api/state -> {"error":"Unauthorized"}  (this is correct without a password)
Then open the site and sign in with your name + password.

## Access model
- Anyone with the link can VIEW the tracker (no sign-in).
- Only admins (valid ADMIN_PASSWORD) can change anything. The API rejects writes without a valid password.
- Public visitors do not see the Admins tab, activity log or admin names.
