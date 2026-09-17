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

The Highlander navy surfaces use a deeper medium navy while preserving the red active navigation and high contrast text.

New volunteer join codes remain visible to administrators across devices instead of being hidden after generation. Codes created by older builds must be regenerated once because their readable value was never stored.

Signed in volunteers can share only their own role code from Invite Other Key Volunteers. Referees see the referee code, Judge Advisors see the Judge Advisor code, and Emcees see the emcee code. Admin mode retains access to all codes and code management.

Role names are normalized when a session is restored so referee aliases always map to the referee invite code. The service worker cache version is advanced so installed mobile apps receive this fix.

Successful volunteer sign in remembers the entered four character role code on that device. Older hashed only codes are displayed in Invite Other Key Volunteers after the volunteer signs out and signs in once, replacing the unhelpful ACTIVE badge with the actual code.

Volunteers can request regeneration of their own role code. Admins receive a live in app request with the role and requester, and the open volunteer invite panel receives and displays the regenerated code through realtime event sync without being closed or refreshed.

Regenerated codes are also published as internal role code update events with server timestamps. The invite panel overlays the latest published code over any older locally remembered code and polls every three seconds while open as a fallback when mobile realtime is interrupted.

The Invite Other Key Volunteers panel uses mobile viewport height, touch scrolling, safe area padding, and a higher layer than the bottom navigation. Its title and Done action remain visible while the content scrolls.

Invite Other Key Volunteers is available from the settings menu for Referees, Judge Advisors, and Emcees. Each volunteer still sees only the join code for their signed in role.

Judge Advisors receive a narrow database permission to create role code regeneration requests without receiving general Field Log write access. The request button confirms success and displays database or network failures instead of failing silently.

The phone header now shows one compact online volunteer count instead of an expanding avatar stack. Connection text is shortened, the duplicate signed in name is hidden, and the event title stays on one line on phones. Tapping the count still opens the complete online volunteer list, while tablet and desktop retain the full avatar stack.

Admins can enable true web push alerts per device. A role code regeneration request calls a secured Supabase Edge Function, which verifies the saved request, sends a high priority notification only to current event admins, removes expired subscriptions, and opens the requested role directly in code management when tapped. The existing live in app request remains available as a fallback.

The Clear Data panel now scrolls independently on phones, renders above the fixed bottom navigation, respects the device safe area, and keeps its header and Delete Selected controls accessible while the option list scrolls.

Key Volunteer Status now uses the same mobile safe sheet behavior. Its roster scrolls independently above the bottom navigation while the title and close control remain visible.

Admins can assign signed in volunteers to Field 1, Field 2, Field 3, Pit Floor, Competition Floor, Skills, or Judging from Key Volunteer Status. Volunteers see their own assignment in a live workspace card, and assignment changes synchronize across devices through shared event settings.

The admin push alert control is grouped under Access in the settings menu with the other login, invitation, and permission controls.

Push alert enrollment is now available to Referees, Judge Advisors, Emcees, and Admins. Every role can send a categorized help request, all subscribed event members receive the notification, and an Admin acknowledgment updates live for the entire crew.

Help requests require a location so responders know where to go. Field 1, Field 2, Field 3, Pit Floor, Competition Floor, Skills, Judging, and Other are available, and the selected location appears in both the shared banner and push alert.

Tablet and desktop online presence retain the full avatar stack.
