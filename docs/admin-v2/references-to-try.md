# References to try in Examlytic

Libraries and components saved for later. Nothing here is installed or used yet.

## 1. Better Auth: authentication
- **Link:** https://better-auth.com/
- **What it is:** a TypeScript authentication framework.
- **Why it's here:** a possible alternative or addition to the current auth. Today the app uses **Supabase Auth** (Google OAuth) through `src/context/AuthProvider.jsx`, with roles in `public.users.role`.
- **Before using:** check how it would fit with Supabase:
  - RLS policies depend on `auth.uid()`;
  - the edge function `rapid-task` verifies Supabase JWTs;
  - migrating existing users and sessions.

## 2. ReUI Timeline: "timeline lab"
- **Link:** https://reui.io/components/timeline
- **What it is:** an open-source timeline component (shadcn-style, copied into your project), with activity-feed, milestone, roadmap, git-activity and pipeline variants.
- **Where to use it:**
  - event timelines in **Attempt Review** (`src/admin-v2/pages/student-profile/AttemptReview.jsx`);
  - the **Live Monitor focus panel** (`src/admin-v2/pages/live-monitor/FocusPanel.jsx`);
  - the **Student Profile**.
- **Note:** it's built with Tailwind. Rebuild the design in our own CSS (`src/admin-v2/`) with the locked palette and Inter Tight. **Don't add Tailwind:** its global reset would break the old app's styles.

## 3. 21st.dev activity timeline (by kuratlielia)
- **Link:** https://21st.dev/@kuratlielia/components/timeline
- **What it is:** a vertical activity feed grouped by day, with expandable rows and insert animations. MIT licensed; depends on `motion` and `lucide-react`.
- **Where to use it:**
  - the **Live Alerts** feed (new alerts sliding in);
  - expandable event rows that show details, e.g. "Detected: cell phone, 92% confidence".
- **Note:** same as above. Port the look into our CSS; animate only transform and opacity, and respect `prefers-reduced-motion`. Use `react-icons/lu` (Lucide), which we already have, instead of adding `lucide-react`.
