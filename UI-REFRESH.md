# Ref-OS UI refresh
Source: the user-supplied latest vex-violation-tracker.zip; source archive remains unchanged.

Design guidance: UI UX Pro Max, Minimalism & Swiss Style and Data-Dense Dashboard. The initial landing-page pattern was rejected as unsuitable for an event workspace. Adopted semantic navigation, clear hierarchy, neutral surfaces, visible focus, responsive spacing and reduced motion. Kept system fonts for offline availability and retained alliance/violation semantic colors.

Desktop: persistent navigation at 1100px, wider content, overview headings and live event totals. Tablet: tabs. Phone: existing section picker, responsive summary cards and wrapping team cards.

No authentication, role permissions, imports, scoring or database logic changed. Preview uses the existing E2E mock environment; production requires the existing event configuration. Do not deploy a mock build.

Validation: production build and schema contract passed. Existing browser suite: 24 passed, 4 failed (two admin workflows on both browser projects). Existing E2E getMyEventRole returns null, causing admin role synchronization to remove mock admin access. No live-role code was changed. Light/dark workspace preview checked; 375px viewport showed no horizontal document overflow. Service-worker cache key bumped for the changed assets.
