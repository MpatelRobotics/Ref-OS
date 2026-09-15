# Ref-OS UI refresh
Source: the user-supplied latest vex-violation-tracker.zip; source archive remains unchanged.

Design guidance: UI UX Pro Max, Minimalism & Swiss Style and Data-Dense Dashboard. The initial landing-page pattern was rejected as unsuitable for an event workspace. Adopted semantic navigation, clear hierarchy, neutral surfaces, visible focus, responsive spacing and reduced motion. Kept system fonts for offline availability and retained alliance/violation semantic colors.

Desktop: persistent navigation at 1100px, wider content, overview headings and live event totals. Tablet: tabs. Phone: existing section picker, responsive summary cards and wrapping team cards.

No authentication, role permissions, imports, scoring or database logic changed. Preview uses the existing E2E mock environment; production requires the existing event configuration. Do not deploy a mock build.

Validation: production build and schema contract passed. Existing browser suite: 24 passed, 4 failed (two admin workflows on both browser projects). Existing E2E getMyEventRole returns null, causing admin role synchronization to remove mock admin access. No live-role code was changed. Light/dark workspace preview checked; 375px viewport showed no horizontal document overflow. Service-worker cache key bumped for the changed assets.
# Desktop Operations Workspace

The desktop experience now combines an operations dashboard with a clean, wide workspace. At 1100 pixels and above, Ref OS uses a 272 pixel persistent navigation rail, prioritizes Matches when match data exists, exposes Command Center, Field Log, and Contacts as quick event tools, and expands content to a 1440 pixel canvas. Team cards use a two column desktop grid and event notices align with the main workspace.

The desktop navigation rail scrolls independently when its contents exceed the available screen height.

The desktop sidebar and header use a lighter medium navy palette with brighter navigation and status text for improved contrast.

The panel palette follows Highlander Summit branding with lighter navy surfaces, red active navigation, white highlights, and cool blue gray secondary accents. Gold is intentionally excluded from the panel treatment.

Phone and tablet layouts remain unchanged.
