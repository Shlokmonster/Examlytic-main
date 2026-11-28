# Dashboard: improvements backlog

These are changes to make to the admin v2 dashboard **after the whole admin UI is built**. Do not start them before then.

- **Page:** `/v2/admin` (`src/admin-v2/pages/Dashboard.jsx`, sections in `src/admin-v2/pages/dashboard/`)
- **Layout and sidebar:** `src/admin-v2/layout/`
- **Status:** UI built with mock data. Improvements pending.

## UI improvements

- [ ] **Live Exams Monitoring: no flicker in the cards below.** When the carousel moves, the "Questions Performance" and "Advanced AI Proctoring Enabled" cards flicker. They must stay completely still while the carousel changes.
  - _Likely cause:_ the active live card is taller (272px) than inactive ones (250px), and the height animates when the active card changes. That changes the carousel's height, so everything below it shifts.
  - _Fix idea:_ give the carousel a fixed height, and change the active card with `transform`/`scale` or colors only, never `height`.

## Animation improvements

- [ ] **Live Exams Monitoring: smooth next/previous slide.** Clicking the next or previous arrow currently makes the cards jump from one position to the next. They should glide smoothly to the new position, with the active and inactive styles cross-fading (teal ↔ white) at the same time, so there is no jump.
  - _Fix idea:_ animate only `transform` with a smooth easing (for example `cubic-bezier(0.22, 1, 0.36, 1)`, around 400–500ms). Fade the background and text colors at the same time. Keep the card width stable during the slide; it's currently recalculated from a ResizeObserver.
- [ ] **Total Attendance vs Total Pass chart: smooth hover.** Moving the cursor from one month to another (Jan → Feb) makes the active marker, the highlighted bar and the tooltip jump. The graph should feel smooth:
  - The active marker should glide along the line to the new month, without disappearing and reappearing.
  - The highlighted (dark) bar should transition smoothly, either by fading colors between bars or with a single highlight that slides over.
  - The tooltip should slide with the marker, and its values should update without flashing.
  - The month label underline should slide to the new month.
  - _Fix idea:_ draw a single active marker, highlight bar and underline, and animate their positions with CSS `transform` transitions, instead of re-rendering different elements for each month.
  - _Optional suggestion (not requested; confirm first):_ have the chart draw itself in on first load, with bars growing up and the line drawing left to right.
- [ ] **Overall:** every animation should feel polished and consistent (same easing and durations) and respect `prefers-reduced-motion`.

## Other / functional

_None yet._

## Done

_None yet._
