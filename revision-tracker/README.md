# 14-Day Revision Tracker (shared, admin-only)

Static page (`index.html`) + one serverless function (`api/state.js`) + Upstash Redis for storage.
Every admin sees the same live data (it refreshes every 8 seconds).

## Deploy on Vercel
1. Put this folder in a GitHub repo (or run `npx vercel` inside it).
2. Import the repo at vercel.com/new. No build settings needed.
3. In the project: Storage > Marketplace > Upstash Redis > Create. Connect it to the project
   (this adds the `KV_REST_API_URL` / `KV_REST_API_TOKEN` variables automatically).
4. Settings > Environment Variables: add `ADMIN_PASSWORD`.
   Use a comma-separated list (`pass1,pass2,pass3`) to give each admin their own password.
5. Redeploy. Open the URL and sign in with your name + password.

## Notes
- Admin names are for attribution only ("Last update by ..."). Anyone with a valid password has full access.
- "Reset" wipes shared data for everyone.
- To revoke an admin, remove their password from the list and redeploy.
