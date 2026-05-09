# Frontend Fixes Spec

## P0 — Broken

### 1. Company name not showing in sidebar after analysis

**What is broken:** The `POST /analyze` endpoint (single-job) does not include `company` and `role` in its JSON response, even though the pipeline extracts them. The frontend assigns `res.company` and `res.role` to the job object, but both are `undefined`, so the sidebar always shows "Pending..." for every analyzed job. The main content area also shows a blank company title. The batch endpoint already includes these fields correctly.

**What done looks like:** After analysis completes, the sidebar shows the company name (e.g. "Google") in bold, and the role (e.g. "Senior Frontend Engineer") below it. The main content header shows the company name as the page title and the role as the subtitle. Works for both single-job and batch analysis.

**What not to do:** Do not change the frontend to derive company/role from the job description text. Do not add a separate API call to fetch this data. The backend already has the values — they just need to be included in the response.

### 2. Inline styles in blocked portal section

**What is broken:** The textarea, button, and surrounding text for the "blocked portal" manual-input state all use hardcoded inline styles (`style="..."` attributes) instead of CSS classes. These inline styles don't match the Notion aesthetic of the rest of the application — they use different border colors, no hover state on the button, and no disabled styling.

**What done looks like:** The entire blocked-portal section uses CSS classes consistent with the rest of the app. The textarea matches the style of the CV paste textarea. The button matches the style of the "Save CV" button (dark background, hover state, disabled state). All inline `style` attributes in the template are removed.

**What not to do:** Do not create a separate "blocked portal" component. Do not add new CSS files. Keep the styles in `job-analysis.component.css` alongside the rest.

### 3. Duplicate `.coverage-bar` CSS class

**What is broken:** The `.coverage-bar` class is defined twice in `job-analysis.component.css` — once for the wrapper (with `height`, `width`, `display`), and once duplicating just `height: 100%`. This is dead code that serves no purpose.

**What done looks like:** A single definition of `.coverage-bar`. No duplicate selectors.

**What not to do:** Do not merge the two definitions into some combined version — just remove one. Do not rename the class.

---

## P1 — UX

### 4. Analyzing state not visually distinct per job

**What is broken:** Three different job statuses (`queued`, `fetching`, `analyzing`) all receive the same CSS class `dot-analyzing` — a single blue pulsing dot. When multiple jobs are in the queue, the user cannot see: which job is currently being processed, which one is fetching a URL, and which ones are waiting. The sidebar is the primary navigation surface, and all processing states look identical there.

**What done looks like:** Each of the three processing states has a distinct visual indicator:
- `queued` — neutral gray dot, no animation (waiting its turn)
- `fetching` — blue dot with slow pulse (fetching external URL)
- `analyzing` — blue dot with faster pulse (LLM pipeline running)

The currently-processing job is visually emphasized in the sidebar (e.g. highlighted row or brighter dot) so the user always knows what's happening right now.

**What not to do:** Do not add text labels next to every dot in the sidebar — the subtitle text already changes per status. Do not add progress bars inside the sidebar. Do not change the color assignments for `done`, `failed`, `input`, or `blocked` states.

### 5. Skill breakdown is a flat list — needs better layout

**What is broken:** The skill detail view shows two columns of identical-looking cards. Each card has a skill name and one metadata field (confidence or requirement badge). There is no visual differentiation between:
- Skills the candidate has vs. skills the job requires
- Matched skills vs. unmatched skills (critical for decision-making)
- Required vs. preferred vs. implicit requirements
- High-confidence vs. low-confidence candidate skills

The flat layout makes it hard to quickly scan and understand fit.

**What done looks like:** The two-column grid remains (Your Skills | Job Requirements), but each column uses visual hierarchy to communicate more:

**Your Skills column:**
- Skills are ordered by confidence (highest first)
- Each skill card shows: name + confidence bar (not just text percentage)
- Skills that match a required skill in the opposite column are visually connected (e.g. subtle green left border or checkmark icon)
- Low-confidence skills (< 50%) show differently — a subtle visual cue that this skill is weak

**Job Requirements column:**
- Skills are ordered by requirement level first (required → preferred → implicit), then alphabetically
- Each card shows: name + requirement badge + a visual indicator of match status
- Matched skills get a green left border or checkmark, placed at the top
- Unmatched skills get no border (or a subtle gray indicator), placed at the bottom within each requirement group
- Required skills that are unmatched are the most visually urgent (red/orange accent, or grouped separately at the top with a warning)

**Requirement level communication:**
- `required` badge: prominent, dark or red-toned — communicates "this matters"
- `preferred` badge: muted, neutral — communicates "nice to have"
- `implicit` badge: light gray — communicates "assumed context"
- Badges should use background color + text color, not just text

**What not to do:** Do not add animations or interactive filtering. Do not change the toggle behavior (still hidden behind "View skill breakdown" button). Do not add a third column for "matched skills" — use visual indicators within the two existing columns. Do not add pie charts or radar charts. Do not change the data model — all information already exists in `gapAnalysis`.

### 6. No visual distinction for selected job during processing

**What is broken:** When analysis is running (`isProcessing = true`), the sidebar shows a generic "Processing..." text in the actions area. The currently-processing job has the same visual appearance as all other queued/fetching/analyzing jobs. There is nothing in the sidebar that tells the user "this job is the one being processed right now."

**What done looks like:** The currently-processing job's sidebar row has a visual distinction that sets it apart from waiting and completed jobs. This could be: a brighter/highlighted row background, a more prominent dot, or an animated indicator specific to the active item. The effect is that the user can glance at the sidebar and immediately see which job is being processed. The component needs to track which specific job is currently being processed, not just whether processing is happening globally. A dedicated property storing the active job's ID enables the sidebar to apply the visual distinction only to that specific item.

**What not to do:** Do not add a separate "now processing" label section. Do not disable clicks on the sidebar during processing — the user should still be able to select other jobs to see their state. Do not auto-scroll the sidebar.

---

## P2 — Polish

### 7. Empty state is a single text line

**What is broken:** The empty state shown when no job is selected is a single 13px gray line "Select a job or add one to get started" centered in the content area. No icon, no visual weight, no suggestion of where to start.

**What done looks like:** The empty state is visually considered — it fills the content area with purposeful whitespace. It includes: an icon or subtle graphic, a heading ("No job selected"), and a short description suggesting the next action ("Add a job URL or paste a description in the sidebar"). The text is visually balanced in the center of the content area. The Notion aesthetic is maintained — nothing flashy, but not an afterthought.

**What not to do:** Do not add illustrations or large graphics. Do not make the empty state interactive (no buttons that trigger sidebar actions). Do not add on-boarding tooltips.

### 8. Score percentage `%` sign positioning

**What is broken:** The `%` sign uses `vertical-align: super` to sit above the baseline of the score number. This is fragile across different font renderings and browser engines — it can appear too high, too low, or misaligned.

**What done looks like:** The `%` sign is positioned relative to the score number using `font-size` and `position: relative` + `top` (or `vertical-align: top` with a smaller font-size). The result is consistent across browsers and font renderings. Visually, the `%` appears as a smaller suffix to the score number, not floating above it.

**What not to do:** Do not remove the `%` sign. Do not change the score number font size.

### 9. No loading/skeleton state for main content area

**What is broken:** When the user clicks a job that's still processing (`queued`, `fetching`, `analyzing`), the main content area shows plain text status messages ("Analyzing job...", "Fetching job description..."). These messages are unstyled (no padding, no visual container) and cause the layout to jump when results finally load and all the sections appear at once.

**What done looks like:** The main content maintains consistent layout structure during processing. When a job is being processed, the company title area, score area, and content section placeholders occupy the same space they will when results load. These placeholders are visually muted (gray blocks or subtle loading indicators) but hold the layout steady so nothing jumps when results arrive.

**What not to do:** Do not add a full-page overlay or spinner blocking the main content. Do not add animated skeleton screens with shimmer effects — keep it simple. Do not change the sidebar during this process.

### 10. Sidebar add-job input toggle inconsistency

**What is broken:** Clicking the "Add job" dashed border area toggles it into an inline input field, but there is no way to cancel or close the input without adding a job or reloading the page. Clicking the dashed area again while the input is shown does nothing (it just focuses the already-visible input). The user is trapped in add mode.

**What done looks like:** The input field has an escape hatch — pressing Escape or clicking outside the input area collapses it back to the dashed "Add job" button. Alternatively, a small cancel button (an X or "Cancel" text) appears next to the Add button when the input is shown.

**What not to do:** Do not auto-collapse on blur without an Escape handler (that feels broken on mobile). Do not add a modal or slide-out panel — keep the inline interaction. Do not change the Enter-to-add behavior.

### 11. No visual feedback on download buttons

**What is broken:** When the user clicks a "Download" button for tailored CV, cover letter, or interview prep, nothing visual happens. The file downloads silently. The user gets no confirmation that the action was registered.

**What done looks like:** After clicking a download button, it briefly shows a confirmation state — either a checkmark replacing the button text, a "Downloaded!" label that fades back to the original text, or a brief flash of the button color. The feedback is subtle and lasts 1-2 seconds before resetting.

**What not to do:** Do not add toast notifications or snackbars. Do not add a download progress indicator. Do not prevent the user from clicking download again (re-downloading is fine).

### 12. Sidebar scroll behavior

**What is broken:** The sidebar uses `overflow-y: auto` without constraints. When the CV panel expands or many jobs are added, the bottom of the sidebar (add-job input, analyze button) can scroll out of view. The sidebar content has three regions that compete for space: CV section, job list, and bottom actions.

**What done looks like:** The job list (middle section) is the only scrollable area within the sidebar. The CV section at the top and the add-job/analyze actions at the bottom remain in their fixed positions regardless of how many jobs are in the list. The add-job input and analyze button are always visible without scrolling.

**What not to do:** Do not change the sidebar width. Do not convert the sidebar to a CSS Grid layout when flexbox suffices. Do not add a minimum height to the sidebar — it should always fill the viewport.
