// Local, bundled documentation. No credentials, event identifiers, or network requests.
export const ROLES = ['Referee', 'Inspection', 'Judge Advisor', 'Emcee', 'Admin', 'Developer'];
const ALL = ROLES;
const ADMIN = ['Admin', 'Developer'];
const REF = ['Referee', ...ADMIN];
const PHOTO = ['Inspection', 'Referee', ...ADMIN];
const JUDGE = ['Judge Advisor', 'Referee', 'Emcee', ...ADMIN];
const VIEW = ['Referee', 'Emcee', ...ADMIN];
const articles = [];
function add(id, category, title, roles, summary, when, steps, seen, important, related = [], keywords = '') {
  articles.push({ id, category, title, roles, summary, when, steps, seen, important, related, keywords });
}
add('start', 'Getting Started', 'Sign in and choose your event', ALL,
  'Ref OS is a shared workspace for VEX event volunteers. The event you select determines the data and access you receive.',
  'At the start of your shift or when changing events.',
  ['Open Ref OS while connected to the internet and choose the intended VEX event.', 'Use the event role access code or QR card supplied by the event Admin. Follow the available sign-in prompts.', 'Enter your nickname, first name, and last name; add your phone number if you want it in the directory.', 'Check the event name, role, connection status, and, for a League, the session name before recording anything.'],
  'Your nickname appears in live activity. Your full name is used in the directory and official exports. A League with no Active session opens its overview.',
  'Keep access cards private. Signing in and unlocking require server verification; prepare devices before the connection is lost.', ['navigation', 'roles', 'offline', 'lock']);
add('roles', 'Getting Started', 'Roles and access', ALL,
  'Each role has a different workspace. This guide displays articles for your current role.', 'When deciding which volunteer access to request.',
  ['Check your displayed role after sign-in.', 'Inspection uses Robots and Rules. Judge Advisor uses Judging and view-only Alliances.', 'Referees use teams, matches, violations, field operations, robot pictures, rules, nominations, and permitted bracket controls.', 'Emcees use event information and nominations without referee disciplinary views or bracket editing.', 'Admins use the Command Center and event administration. Developer access supports administration across events.', 'Ask an event Admin for the correct access if a needed tool is missing.'],
  'Matches and Rules navigation appears when the corresponding data is loaded. Rankings navigation requires Admin mode.',
  'A guide article does not grant access. Event protections, archived state, and server permissions still apply.', ['navigation', 'codes']);
add('navigation', 'Navigation', 'Find sections, settings, and help', ALL,
  'Desktop navigation and the phone section picker lead to the same role-specific workspace.', 'Whenever you need to switch tasks.',
  ['Use the desktop navigation or the mobile Sections menu to select a section.', 'Open a team, match, or robot; use Back to return to its list.', 'Open the Settings menu for your role’s help, display, access, and event actions.', 'Choose Features & Help, then User Guide. Search locally or browse a category.', 'Use View Quick Start or Guided Tour for an introduction to the live interface.'],
  'Light/Dark Mode and Text Size are device preferences. The header shows the selected event and connection status.',
  'Unavailable sections may be hidden because of your role or missing imported data. Check those before reporting a fault.', ['roles', 'connection', 'trouble']);
add('ref-start', 'Quick Starts', 'Referee quick start', REF,
  'Record clear observations against the correct team and match.', 'Before refereeing your first match.',
  ['Confirm the event, session, profile, and connection status.', 'Open Matches, select the field if needed, and open the match.', 'Review teams, watch notes, and existing history.', 'Tap the involved team to open New Violation; confirm match, type, rule, and notes before saving.', 'Record AWP or field issues in their own controls. Watch the pending/saved state.'],
  'Match details group the two alliances and their records. Pending changes wait for sync.',
  'Ref OS observations do not replace official scoring or the Head Referee’s decisions.', ['violation', 'awp', 'field', 'offline']);
add('inspection-start', 'Quick Starts', 'Inspection quick start', PHOTO,
  'Collect the required robot identification pictures.', 'During inspection after the robot passes.',
  ['Open Robots and find the team.', 'Choose Take pictures in order.', 'Capture Front, Back, Side, and the inspection tag attached to the robot.', 'Add the optional Lexan Diagram if supplied.', 'Check completion and upload status before leaving the team.'],
  'The completion count tracks four required views; the Lexan Diagram is optional.',
  'Inspection role does not provide referee violation logging. In a League, robot pictures belong to the working session.', ['photos', 'rules', 'photo-trouble']);
add('judge-start', 'Quick Starts', 'Judge Advisor quick start', ['Judge Advisor', ...ADMIN],
  'Review nomination evidence and award finalists.', 'Before judging review or preparing award recommendations.',
  ['Open Judging and select an award.', 'Review nominations and their supporting examples.', 'Use the finalist controls where offered.', 'Export nominations when ready to share official forms.', 'Open Alliances to view the current bracket if needed.'],
  'Sportsmanship and Energy have separate nomination information. Judge Advisor alliance views are read only.',
  'Nomination counts do not automatically decide awards. League judging records and exports belong to the working session.', ['judging', 'nom-export']);
add('emcee-start', 'Quick Starts', 'Emcee quick start', ['Emcee', ...ADMIN],
  'Use team, match, alliance, and award information to support announcing.', 'Before announcing a session.',
  ['Confirm event and session in the header.', 'Open Matches to find the scheduled teams and imported results.', 'Open Teams for names and Robots for available identification photos.', 'View Alliances for picks and bracket progress.', 'Use Judging to record a supported nomination when appropriate.'],
  'The Emcee workspace omits disciplinary details and violation entry.',
  'Emcee cannot edit bracket winners. Imported results may lag Tournament Manager until an Admin updates them.', ['matches', 'alliances', 'judging']);
add('admin-start', 'Quick Starts', 'Admin and Developer quick start', ADMIN,
  'Prepare an event and verify volunteer devices before operations begin.', 'Before opening the event to volunteers.',
  ['Confirm the correct event and Admin mode, then open Event Command Center.', 'Review Event Setup and Event Settings.', 'Import roster and schedules through TM Sync Center; review each change preview.', 'For a League, create sessions and start the intended one.', 'Prepare volunteer access cards and the contact directory.', 'Run Pre Event System Test and Two Device Sync Test, prepare offline devices, and download a backup.'],
  'Command Center groups tools into Event Setup & Management, Event Operations, System & Devices, Exports & Backups, and Danger Zone.',
  'Developer access does not remove protected event restrictions. Check the selected event before any management operation.', ['command', 'tm', 'tests', 'backup']);
add('teams', 'Referee', 'Teams, watch notes, and team scanner', VIEW,
  'Find a team and review the information available to your role.', 'When identifying a robot or reviewing team context.',
  ['Open Teams and search by team number or name.', 'Open the team to view its record and available history.', 'Referees can add a specific watch note for other officials and start a violation from the team.', 'Use the camera scanner when offered, allow camera access, and verify the recognized team number before opening it.'],
  'Watch notes appear with relevant matches. League team history can identify the originating session.',
  'Scanner recognition can be wrong. Emcee views omit disciplinary information. Watch notes are shared across a League.', ['violation', 'photos', 'photo-trouble']);
add('matches', 'Tournament Workflows', 'Schedules and match details', VIEW,
  'Matches shows the imported schedule, teams, results, and available field controls.', 'During qualifications or eliminations.',
  ['Open Matches after an Admin imports the schedule.', 'Use search, field filters, or match jumping to find the match.', 'Open it and verify phase, number, field, and teams.', 'Review imported scores and use your permitted match actions.', 'Move to the next match or return to the list.'],
  'Elimination matches take priority when present; qualifications remain available. A missing Matches tab can mean no schedule is loaded.',
  'Tournament Manager remains the official results source. Confirm a League session before using repeated match numbers.', ['violation', 'field', 'tm-results', 'league']);
add('violation', 'Referee', 'Log and correct a violation', REF,
  'Save an observation for a team with a match reference and rule.', 'After confirming an incident with the responsible official.',
  ['Open a team or match and choose the violation action.', 'Confirm team and match phase/number.', 'Choose Minor, Major, or Inspection; select a rule or enter the supported custom description.', 'Write specific notes and add evidence pictures if useful.', 'Review any duplicate warning and save once.', 'For corrections, open the existing synced record and use Edit or Delete when permitted.'],
  'A pending record shows its saving state. New entries offer Undo for eight seconds; confirmation removes the entry across connected devices.',
  'Regular users can correct their own entries; Admin access handles wider corrections. Avoid creating a second record to correct the first. Queued entries must sync before some actions become available.', ['rules', 'offline', 'violation-export'], 'history disciplinary duplicate undo');
add('awp', 'Referee', 'Record an Autonomous Win Point check', REF,
  'Record Red and Blue autonomous observations with the event’s checklist.', 'At the end of autonomous in a qualification match.',
  ['Open the qualification match and its AWP checker.', 'Select the observed criteria for each alliance.', 'Check the checklist against the event rules and confirm both sides.', 'Save the observation once.'],
  'The checklist covers scoring conditions, field perimeter contact, and autonomous violations for the configured event. Saved checks appear in history.',
  'An AWP check does not change Tournament Manager scores. Use the actual event rules rather than applying another game’s checklist.', ['rules', 'awp-history']);
add('awp-history', 'Admin', 'AWP History and Analytics', ADMIN,
  'Review saved checks and summary success rates.', 'When reviewing autonomous patterns or event reports.',
  ['Open Command Center → AWP History and Analytics.', 'Review saved match checks and Red/Blue criteria.', 'Open the analytics view and compare overall and criterion success rates.', 'Use Field Comparison where provided to compare activity by field.'],
  'Analytics summarize recorded observations, including Pins, Goals, perimeter, and violation criteria for the supported checklist.',
  'Missing checks are not evidence of an official failed AWP. League results reflect the current working session.', ['awp', 'report']);
add('field', 'Referee', 'Field log, faults, replays, and timeouts', ['Referee', 'Judge Advisor', ...ADMIN],
  'Keep operational observations separate from team violations.', 'For field problems, replays, timeouts, or other field notes.',
  ['Open Field Log from the menu, or use the relevant match control.', 'Choose the entry kind and confirm the match, field, and teams where offered.', 'Describe what happened and save.', 'Review the operational timeline; remove an entry only when permitted and after verifying it is wrong.'],
  'The Field Log filters out internal settings and sync records. Elimination timeouts are tracked by alliance across the bracket.',
  'A log entry does not itself authorize a replay or timeout. Judge Advisor access differs from referee controls; use only the actions shown.', ['matches', 'help-requests', 'offline']);
add('reset-check', 'Referee', 'Field reset and live setup checks', REF,
  'Use the implemented field setup checks to coordinate readiness.', 'When preparing the competition field between matches.',
  ['Open the field setup/reset controls offered in the match workflow.', 'Confirm the correct field and match.', 'Review the displayed quadrant checklist and mark the observed state.', 'Check the shared state before indicating readiness; correct a mistaken check using the offered controls.'],
  'Quadrant and live setup displays show recorded readiness information for the selected match.',
  'A digital check is a coordination aid; physically inspect the field. League checks are session specific.', ['matches', 'field']);
add('photos', 'Inspection', 'Robot pictures and completion', PHOTO,
  'Store robot views so authorized volunteers can identify and inspect teams.', 'During inspection or when replacing an incorrect picture.',
  ['Open Robots, search the roster, and select the team.', 'Use Take pictures in order or an individual view’s capture/upload control.', 'Take Front, Back, Side, and the passed-inspection tag view.', 'Optionally add the Lexan Diagram.', 'Open a picture to review it and use the offered replacement/removal control if needed.', 'Check pending upload and completion information.'],
  'Four required views determine completion. The optional diagram does not change that count. Camera controls name the next picture.',
  'Pictures are private event data. Inspection can capture or retake pictures but cannot delete them; ask a Referee or Admin for deletion. Camera access depends on browser permissions and a supported secure context. Venue mode does not replace cloud robot-photo storage.', ['inspection-start', 'photo-trouble', 'offline']);
add('rules', 'Rules & Official Q&A', 'Search rules, manual, and Official Q&A', ['Referee', 'Inspection', 'Emcee', ...ADMIN],
  'Rules provides the event’s rule reference and official resource links.', 'Before citing a rule or checking an interpretation.',
  ['Open Rules and search a rule code, term, or description.', 'Open the rule to read its available notes.', 'Star common rules and use recent rules to speed repeat access.', 'For Highlander, open the bundled Override manual and its supported search/navigation.', 'Open Official Q&A from the rules resources while online.'],
  'Favorites and recent rules are stored on this device. Custom events use their own rules/resources; the bundled Override manual is Highlander specific.',
  'Official Q&A requires internet and is not an offline archive. Verify the game and resource version. This guide does not prescribe game-rule interpretations.', ['violation', 'offline'], 'rulebook manual favorites recent');
add('judging', 'Judging', 'Nominations and finalists', JUDGE,
  'Record evidence for Sportsmanship and Energy award review.', 'When you observe a specific award-worthy example.',
  ['Open Judging and choose the award.', 'Choose Nominate a team and confirm the team and match.', 'Select observed criteria, describe the example, and save.', 'Review nominations and use permitted delete/finalist actions when appropriate.', 'Judge Advisors or Admins can prepare official nomination exports.'],
  'Award panels organize nomination evidence and finalists. Imported judging/ranking information supports review.',
  'Ref OS does not automatically select award winners. League nominations and finalists belong to the working session.', ['nom-export', 'judge-start']);
add('alliances', 'Tournament Workflows', 'Import alliances and advance the elimination bracket', ['Referee', 'Judge Advisor', 'Emcee', ...ADMIN],
  'Import official alliances from Tournament Manager and follow bracket progress.', 'After alliance selection and during eliminations.',
  ['Complete and finalize alliance selection in Tournament Manager.', 'Export Match List and Results from Tournament Manager as CSV after the elimination match list has been created.', 'Open Alliances in Ref OS. An Admin chooses Import Alliances and selects that CSV.', 'Review the change preview and target event or League session, then choose Apply changes.', 'Referees and Admins select the winning alliance in permitted bracket controls to advance it.', 'Review the next-round matches; select a winner again to clear it when correcting an error.'],
  'The alliance importer requires eight Round 6 rows with Instance 1 through 8 and the Round, Instance, Red1, Red2, Blue1, and Blue2 columns. Applying it replaces the current Round of 16 and all 16 alliance assignments.',
  'Judge Advisor and Emcee bracket views are read only. Protected event restrictions still apply. TM is the official source. Smaller starting brackets are not supported by this alliance importer.', ['tm-results', 'rankings', 'matches']);
add('rankings', 'Admin', 'Qualification and Skills rankings', ADMIN,
  'Review imported qualification order and Skills Challenge scores.', 'After importing TM standings or when comparing session snapshots.',
  ['Open Rankings from navigation or Command Center.', 'Choose the qualification or Skills view.', 'Import updated data through TM Sync Center or the offered skills import.', 'In a League, choose a session to review its imported snapshot.'],
  'Standings reflect uploaded TM data. Activity/violation summaries are different from official qualification standings.',
  'Ref OS does not calculate cumulative League standings. Any cumulative results shown are exactly the imported TM snapshot.', ['tm', 'league', 'activity']);
add('tm', 'Tournament Manager Imports', 'TM Sync Center and import previews', ADMIN,
  'Update event data from Tournament Manager exports.', 'During setup and whenever TM data changes.',
  ['Open Command Center → TM Sync Center.', 'For a League, verify Import Into and the working session.', 'Choose Teams, Match schedule, Qualification rankings, Skills Challenge rankings, Alliance selection, or Match results.', 'Select the appropriate exported file.', 'Read the change preview, warnings, and target session. Choose Apply changes only after checking the file.', 'Review the update status and loaded counts.'],
  'Previews distinguish additions, changes, and untouched records. No-change imports are blocked as unnecessary. A package import option can process the supported export package.',
  'This is file import, not a live TM API connection. Import teams first when the preview warns about unknown teams. Imports need cloud access even in venue mode.', ['tm-roster', 'tm-results', 'league-import'], 'csv package import matches teams');
add('tm-roster', 'Tournament Manager Imports', 'Import teams, schedules, rankings, and skills', ADMIN,
  'Load the roster and competition information used throughout Ref OS.', 'Before volunteers begin and after revised TM exports.',
  ['Export the intended roster/schedule/standings from Tournament Manager.', 'Open TM Sync Center and choose the matching import type.', 'Select the file and inspect parsed teams, phase, and match numbers.', 'Cancel and correct the file if warnings indicate the wrong event or unexpected teams.', 'Apply changes, then open Teams, Matches, or Rankings to verify the update.'],
  'Reimporting a schedule updates existing match identities rather than creating duplicates. Rankings and Skills are separate imports.',
  'Do not rename columns blindly or use another event’s export. Match identity includes the League session, phase, and number.', ['tm', 'rankings', 'league-import']);
add('tm-results', 'Tournament Manager Imports', 'Import alliances and match results', ADMIN,
  'Bring official bracket and score information into Ref OS.', 'After alliance selection or as official results are released.',
  ['Open TM Sync Center and choose Upload alliances or Import scores.', 'Select the intended TM export.', 'Review phase, matchup, changed values, and target session.', 'Apply changes and inspect Alliances or Matches.', 'Re-export from TM and reimport when official results are corrected.'],
  'An official imported Round of 16 bracket preserves its alliances rather than replacing them from rankings. Elimination score updates take priority when elimination results are present.',
  'Ref OS does not send AWP observations or violation logs back to TM. Do not treat displayed values as a substitute for official scoring.', ['alliances', 'matches', 'tm']);
add('league', 'League Events', 'League overview and active session', ALL,
  'A League contains ordered sessions while sharing its roster, rules, and volunteer access.', 'At the start of each League session.',
  ['Check the session name beneath the event name.', 'Tap it to open League Overview and review Active, Upcoming, and Completed sessions.', 'If no session is Active, wait for an Admin to start one.', 'When a session-change banner appears, finish reviewing your entry and choose Go to the Active session.'],
  'Devices normally open the Active session. Admins can open another session in the current browser tab. Other roles work in the Active session.',
  'Session changes do not forcibly jump a device mid-entry. Match numbers can repeat in different sessions; always check the session.', ['league-data', 'offline']);
add('league-manage', 'League Events', 'Create, start, and manage League sessions', ADMIN,
  'Manage the ordered sessions of the selected League.', 'When planning dates or moving to the next session.',
  ['Open League Overview from the header or Command Center → League Sessions.', 'Create a session with name, date, optional times, order, and League Session or League Finals type.', 'Use Edit and the up/down controls to correct details and ordering.', 'Choose Start for the intended session; the previous Active session becomes Completed.', 'Use Complete or Mark Upcoming when appropriate.', 'Before Delete, read the record counts and type the exact session name when required.'],
  'Only one session is Active. A populated or previously started session requires explicit name confirmation for deletion.',
  'The Active session cannot be deleted. Deleting a session removes its records; back up first. Changes require authorized cloud access.', ['league', 'league-data', 'backup']);
add('league-data', 'League Events', 'Shared data, session records, and attendance', ALL,
  'Understand what carries across sessions and what belongs to one session.', 'Before reviewing history or changing sessions.',
  ['Treat roster, rules, access codes, contacts, branding, countdown, assignments, and watch notes as League-wide.', 'Treat matches, violations, operational field log, AWP, field reset checks, judging, alliances, attendance, and robot pictures as session records.', 'In a team’s League history, use the Present/Absent controls when offered to record attendance for the working session. League Overview summarizes attendance.', 'Review a team’s session labels when examining its history.'],
  'Imported rankings, W-L-T, skills, and judging order remain snapshots of the session in which they were imported.',
  'League-wide edits affect other sessions. PDFs and CSVs cover the working session. Backup All JSON includes the whole League.', ['league-import', 'backup']);
add('league-import', 'League Events', 'Import into the right League session', ADMIN,
  'Keep repeated match numbers and standings separate between sessions.', 'Before any League TM import.',
  ['Open TM Sync Center and read League and Import Into.', 'Select another session only if you intend to work there; the workspace switches and the Sync Center reopens.', 'Check the preview starts with the intended session.', 'Apply and verify that session’s schedule and standings.', 'Return to the Active session when corrections are finished.'],
  'Matches, results, alliances, rankings, and skills target the selected session. New teams join the shared League roster.',
  'Reimporting Session 3 does not update Session 2. Imported cumulative standings are shown as a snapshot, not recomputed by Ref OS.', ['tm', 'league', 'rankings']);
add('conversion', 'League Events', 'Convert a Tournament to a League', ADMIN,
  'Move a supported Tournament into the first session of a new League.', 'Only when the event really needs multiple sessions.',
  ['Download a backup and confirm the intended event.', 'Open Event Settings and choose Convert to League when offered.', 'Read the conversion preview and enter the first session details.', 'Complete the displayed confirmation.', 'Verify the first session and original records in League Overview; prepare subsequent sessions.'],
  'Original Tournament records become part of the first session. Existing League-wide data remains shared.',
  'Conversion is one-way; a League cannot become a Tournament. Protected events cannot be converted. Resolve pending uploads before conversion; held writes may need manual re-entry into the correct session.', ['league-manage', 'backup', 'offline']);
add('command', 'Admin', 'Event Command Center tool map', ADMIN,
  'The Command Center is the Admin operations overview.', 'For event setup, support, and reporting.',
  ['Open Settings → Event Command Center in Admin mode.', 'Use Event Setup & Management for TM Sync Center, Event Setup, Event Settings, Volunteer Access Codes, Event Management, and League Sessions when applicable.', 'Use Event Operations for contacts, Rankings, Activity Feed, and AWP History and Analytics.', 'Use System & Devices for Sync & Venue Server, Pre Event System Test, Two Device Sync Test, and Admin Diagnostics.', 'Use Exports & Backups for violations, nominations, event report, and Backup All JSON.', 'Read the separate Danger Zone before Clear Event Data or Reset Volunteer Sign Ins.'],
  'Overview counts summarize matches, violations, replays, field faults, activity, and volunteer status. Announcement, countdown, and assignment controls support coordination.',
  'Optional tools appear only when enabled. Do not assume every deployment has alert delivery available.', ['setup', 'settings', 'tests', 'clear']);
add('setup', 'Admin', 'Event Setup and field names', ADMIN,
  'Set match-count and elimination options used in the workspace.', 'Before loading schedules or adjusting event configuration.',
  ['Open Command Center → Event Setup.', 'Review the name, qualification and practice match counts.', 'Choose the supported elimination bracket and single or best-of-three finals setting.', 'Save and verify the offered match choices.', 'Use Event Settings or the offered Field Name Configurator to set unique display names for the competition fields.'],
  'Setup values guide match dropdowns. Field display names change labels without rewriting the imported field identity.',
  'These values do not import a real TM schedule. Bracket, best-of, and match-count setup is League-wide.', ['settings', 'tm']);
add('settings', 'Admin', 'Event Settings and branding', ADMIN,
  'Edit the event’s identity and field display labels.', 'When setting up a custom event or correcting its presentation.',
  ['Open Command Center → Event Settings.', 'Enter the event name and short name.', 'Use an optional full image URL for the logo and a valid accent color.', 'Give each competition field a distinct name.', 'Review the preview and validation messages, then Save.'],
  'The short name, logo, and accent update the event presentation. Some protected event changes may be unavailable.',
  'External logos may require internet. Event Settings is separate from Event Setup match options and Event Management lifecycle actions.', ['setup', 'management', 'conversion']);
add('creation', 'Admin', 'Create and choose events', ADMIN,
  'Create a separate workspace with its own roster and access.', 'When preparing a new event.',
  ['Return to Choose VEX Event using the appropriate event-picker/lock action.', 'Choose Create VEX Event and complete its required event details.', 'Choose Tournament or League as the event format.', 'For a League, optionally create the first session.', 'Open the new event, review Admin access, and complete setup, imports, and volunteer access.'],
  'Events keep separate operational records. New events use their own roster, rules, settings, and resources.',
  'Creation needs internet and appropriate access. Format is fixed except the supported one-way Tournament-to-League conversion.', ['start', 'admin-start', 'conversion']);
add('management', 'Admin', 'Archive, restore, and delete events', ADMIN,
  'Manage an event’s lifecycle independently of clearing selected records.', 'When an event has finished or an archived event must be recovered.',
  ['Back up the event before lifecycle changes.', 'Open Event Management and verify the name and status.', 'Choose Archive when permitted, then type ARCHIVE in its confirmation.', 'Use the archived-event controls in the event picker to restore an event when authorized.', 'For permanent deletion, review the dedicated deletion dialog and complete its required confirmation only for the intended event.'],
  'Archiving changes availability while retaining data. Restoring a League restores its sessions. Permanent deletion removes event data.',
  'Protected events block lifecycle actions. Permanent deletion is different from archiving and cannot be undone by Restore.', ['backup', 'clear', 'creation']);
add('codes', 'Admin', 'Volunteer access codes and QR cards', ADMIN,
  'Issue event-specific role access without sharing administrative credentials.', 'When volunteers arrive or need replacement access.',
  ['Open Command Center → Volunteer Access Codes.', 'Select the intended role and generate the supported access code/card.', 'Display, print, or provide the QR card privately to the intended volunteer.', 'Review replacement code requests and issue the appropriate role replacement.', 'Disable a code when it should no longer allow new logins.'],
  'QR creation and decoding run locally; sign-in is still verified by the server.',
  'Disabling a code blocks future sign-ins, but does not automatically sign out existing volunteers. Use Reset Volunteer Sign Ins only when that event-wide result is intended.', ['start', 'reset-signins']);
add('contacts', 'Navigation', 'Profiles, contact directory, and volunteer status', ['Referee', ...ADMIN],
  'Find event contacts and see volunteer presence.', 'For coordinating a shift or locating responsible staff.',
  ['Use your profile control to correct nickname, full name, and optional phone where available.', 'Open Event Contact Directory to find names, roles, locations, and contact details.', 'Admins can add, edit, and reorder additional contacts.', 'Open Key Volunteer Status to review online people and known volunteers.', 'Admins can use permitted Make Admin/Remove Admin controls for other online event members.'],
  'Profile changes update the shared directory. Presence shows current connectivity; known volunteers can appear offline.',
  'Presence is not proof of attendance or readiness. Contact information is event data; avoid publishing it in public reports.', ['help-requests', 'coordination']);
add('help-requests', 'Navigation', 'Request Help, push alerts, and replacement codes', ALL,
  'Notify the event crew of an operational need with its location.', 'When you need staff assistance or your role code replaced.',
  ['Choose Request Help from the available access/menu action.', 'Select the request type and location; add a clear note and submit.', 'Review acknowledgement so you know the crew is handling it.', 'Use Enable push alerts and allow browser notifications on supported devices if desired.', 'Use the role-code request action for a replacement code and watch for the response.'],
  'Subscribed Admins can receive help and code-request alerts. Push support depends on device/browser setup; iPhone/iPad push needs an installed app.',
  'Venue-mode requests are shared locally but do not send push alerts. For urgent assistance, contact venue staff directly rather than waiting for an app acknowledgement.', ['connection', 'coordination']);
add('coordination', 'Admin', 'Assignments, announcements, countdown, and alert counter', ADMIN,
  'Coordinate crew activity through the shared event controls.', 'Before shifts or when plans change.',
  ['Open Command Center and review volunteer status and assignments.', 'Use the assignment controls offered to identify the responsible volunteer/field.', 'Send a Key Volunteer Announcement with a clear message; review or delete announcements using the offered controls.', 'Set or clear the shared countdown for the intended time.', 'Refresh the event alert counter; Reset count only when you intend to erase the totals.'],
  'Devices can acknowledge announcements. Alert totals summarize sent alerts and requests. Countdown and assignments are shared across a League.',
  'Resetting alert totals cannot be undone. Delivery depends on connectivity and notification permissions; online presence does not confirm receipt.', ['contacts', 'help-requests']);
add('activity', 'Admin', 'Activity Feed and violation summaries', ADMIN,
  'Review recorded incident activity and patterns.', 'For reviewing recent entries or preparing an event report.',
  ['Open Command Center → Activity Feed.', 'Read recent entries and open supporting pictures where available.', 'Use permitted Edit/Delete controls to correct records.', 'Review violation summaries separately from imported qualification/Skills standings.'],
  'Activity is based on recorded incidents. Team/rule totals can help locate recurring observations.',
  'Incident counts are not official competition standings or an automatic disciplinary decision.', ['violation', 'rankings', 'report']);
add('connection', 'Sync & Offline Use', 'Connection status and pending changes', ALL,
  'Understand whether this device can reach its selected data service.', 'Before saving, switching devices, or troubleshooting.',
  ['Read the connection badge beside the event name.', 'Checking means the connection is still being tested; Connected means the service was reachable.', 'Offline/Unavailable means supported writes may be waiting locally. Queued counts show unsent work.', 'Use the header refresh action where offered; Admins can open Diagnostics or Sync & Venue Server.', 'Wait for queued work to resolve before closing the browser or changing event/session.'],
  'The last-synced time describes a completed refresh. Local Venue Server and Cloud have different connection labels.',
  'Wi-Fi connection alone does not prove Cloud is reachable. A connected badge does not guarantee every write was accepted; check pending and failed items.', ['offline', 'sync-fail', 'venue']);
add('offline', 'Sync & Offline Use', 'Prepare for offline use', ALL,
  'Previously loaded app data and supported queued writes help during a connection loss.', 'Before entering a venue with unreliable internet.',
  ['Open and sign into the app online on every device.', 'Load the event roster, matches, rules, and pictures needed for the shift.', 'Open this User Guide once after installing the updated build; its content and search are bundled with the app.', 'Use the offered offline-readiness/system checks and verify service-worker readiness.', 'When offline, save supported entries once and watch their pending state.', 'Reconnect the same device and confirm sync completes before clearing storage or signing out.'],
  'Cached roster/schedule data stays visible. Rules and this guide work locally after the app assets are cached. League queues keep their originating session.',
  'Offline is not a promise that all features work: sign-in, administration, TM imports, and Official Q&A need service access. Pictures need prior loading or supported upload queues. Do not clear browser data with pending work.', ['connection', 'sync-fail', 'venue'], 'cache pending changes');
add('sync-fail', 'Troubleshooting', 'Queued, rejected, or missing changes', ADMIN,
  'Diagnose changes that have not reached the selected service.', 'When another device does not show an entry.',
  ['Check both devices use the same event, League session, and Cloud/venue mode.', 'Confirm connectivity and refresh once.', 'Review queued counts and wait for temporary failures to retry.', 'Open Command Center → Failed Sync Items for rejected Cloud writes; read the error and fix the cause before Retry.', 'Use Discard only after preserving the observation and deciding it should not be retried.', 'For venue rejections, export venue data and inspect pending/rejected status.'],
  'Rejected Cloud writes are retained for Admin review. Venue Sync status separately counts pending and rejected changes.',
  'Do not repeatedly re-enter an observation or erase storage. Switching back to Cloud does not upload venue records automatically.', ['connection', 'venue', 'backup']);
add('venue', 'Local Venue Server', 'Connect and operate on the Local Venue Server', ADMIN,
  'Share supported event operations over the venue network when internet is unreliable.', 'When the event crew has prepared a venue server.',
  ['Ask the server operator for its address and connect all devices to the same venue network.', 'Open Ref OS from the venue server’s own address; sign in while internet is available.', 'Open Command Center → Sync & Venue Server.', 'Verify Server URL, choose Local Venue Server, and use Test Connection.', 'Use Sync Now and inspect last sync, pending, and rejected status.', 'Export Venue Data before leaving venue mode or ending the event.'],
  'The mode choice applies to this device. Opening the venue-hosted app normally selects venue mode unless an Admin previously chose a mode.',
  'A Cloud HTTPS page cannot call an HTTP venue server; open the venue-hosted address. Cloud reconciliation is not implemented, so venue records remain separate.', ['venue-scope', 'venue-trouble', 'backup']);
add('venue-scope', 'Local Venue Server', 'What venue mode shares', ALL,
  'Venue mode supports a limited set of operational records.', 'Before relying on venue mode for a shift.',
  ['Use the connection label to identify the current mode.', 'Use venue mode for violations, supported field log entries, volunteer roster, and presence.', 'Use Cloud/internet for sign-in, event administration, codes, TM imports, teams, matches, rules, judging, and robot inspection-photo storage.', 'Ask an Admin to export venue data at the end of operations.'],
  'Violation evidence taken in venue mode is stored on the venue server and exported, but other devices see a photo count. League records carry their session.',
  'Venue mode does not automatically copy records into Cloud and does not send push notifications. Clear Event Data clears Cloud data only.', ['venue', 'offline', 'connection']);
add('tests', 'Admin', 'System tests and Admin Diagnostics', ADMIN,
  'Check storage, app readiness, data access, and cross-device sync.', 'Before an event or while investigating a failure.',
  ['Open Command Center → Pre Event System Test and run its checks.', 'Read each pass/fail result; resolve failures before approving the device.', 'Open Two Device Sync Test on two devices in the same event/session and follow probe/acknowledgement instructions.', 'Open Admin Diagnostics to inspect app, event, network, queue, storage, and test status.', 'Copy/download a diagnostic report only to a trusted support destination.'],
  'Checks include supported storage/service-worker readiness, backend access, realtime, TM parsing, and PDF generation.',
  'A successful test describes the tested device and connection at that time. Review diagnostic reports for private event details before sharing.', ['connection', 'sync-fail']);
add('violation-export', 'Reports & Exports', 'Export violations and Match Anomaly Log', ADMIN,
  'Create supported violation reports from recorded observations.', 'When preparing official event records.',
  ['Confirm event and working session, and wait for pending changes to resolve.', 'Open Command Center → Export Violations.', 'Choose the offered violation export or official Match Anomaly Log PDF.', 'Open the downloaded output and verify teams, matches, notes, and official names.'],
  'Exports include the records available in the current workspace; official forms use volunteer full names.',
  'League CSV/PDF exports cover the working session. Keep disciplinary records private and export venue data separately.', ['violation', 'backup', 'report']);
add('nom-export', 'Reports & Exports', 'Export official nomination forms', ['Judge Advisor', ...ADMIN],
  'Create the combined supported Sportsmanship and Energy nomination PDF.', 'Before sharing nomination evidence with authorized judges.',
  ['Review Judging records and working session.', 'Use Export nominations from the Judge Advisor menu or Command Center.', 'Wait for PDF generation and download.', 'Open the PDF to verify criteria, examples, teams, matches, and full names.'],
  'The export fills the supplied official nomination forms.',
  'An export is evidence for review, not an award decision. League exports cover the working session.', ['judging', 'backup']);
add('report', 'Reports & Exports', 'Export Event Report', ADMIN,
  'Generate a PDF summary of recorded event operations.', 'After a session or for an authorized operations review.',
  ['Check the event/session and resolve queued work.', 'Open Command Center → Export Event Report.', 'Wait for generation and download the PDF.', 'Verify event overview, AWP, field comparison, violations, alliances, and judging totals.'],
  'The report summarizes available operational records and analytics.',
  'Incomplete inputs make an incomplete report. League reports cover the working session; venue data must be preserved separately.', ['backup', 'awp-history']);
add('backup', 'Reports & Exports', 'Backup All JSON and Export Venue Data', ADMIN,
  'Keep snapshots before destructive changes and at the end of operations.', 'Before clear/reset/conversion/deletion and after a session.',
  ['Wait for Cloud queued writes to finish and verify the event.', 'Open Command Center → Backup All JSON and save the downloaded file securely.', 'For a League, verify the backup includes the League and its sessions.', 'If any device used venue mode, open Sync & Venue Server → Export Venue Data as well.', 'Check that the downloaded files open and store them somewhere independent of the event device.'],
  'Cloud backup and venue export are separate snapshots. Venue exports include stored evidence and retained/rejected local work as supported.',
  'A JSON download is not an automatic restore workflow or automatic Cloud reconciliation. Pending writes and external photo assets need separate verification.', ['clear', 'management', 'venue']);
add('clear', 'Admin', 'Clear Event Data safely', ADMIN,
  'Selectively delete supported Cloud event records.', 'Only when authorized staff intend to remove records.',
  ['Download backups and verify event/session.', 'Open Command Center → Clear Event Data.', 'Read each category’s description: Violations, Robot pictures, Match replays, Quadrant checks, Teams, Match schedule, Judging, Alliances, and Watchlist. Choose only the intended categories.', 'Robot pictures removes inspection pictures including pictures queued on this device, while keeping violation attachments. Teams also removes the roster and its inspection pictures; Match schedule also clears associated imported rankings and W-L-T.', 'Review protected/disabled options and the League session notice.', 'Choose Delete Selected and complete the confirmation; verify the result.'],
  'The dialog explains selected record groups. Session data clears only for the working League session; shared data can affect the whole League.',
  'Deletion cannot be undone by an ordinary refresh. This does not clear venue-server data. Disabled protected categories must remain protected.', ['backup', 'reset-signins', 'management']);
add('reset-signins', 'Admin', 'Reset Volunteer Sign Ins', ADMIN,
  'Require event volunteers to sign in and recreate their profiles.', 'When event-wide volunteer sign-in state must be reset.',
  ['Confirm the correct event and inform the crew.', 'Open Command Center → Reset Volunteer Sign Ins.', 'Read the event-wide confirmation and proceed only if intended.', 'Have volunteers use the appropriate role access and enter nickname, first name, and last name again.', 'Review assignments and contact/profile information after the reset.'],
  'Volunteers are signed out; profiles and stale assignments are cleared. Teams, matches, violations, and pictures remain.',
  'This affects the whole event, including a League’s volunteers. It is different from locking one device or disabling one code.', ['lock', 'codes']);
add('lock', 'Navigation', 'Lock This Device and change events', ALL,
  'Choose where this device returns when leaving the workspace.', 'At the end of a shift or before handing the device to someone else.',
  ['Check pending work before leaving.', 'Open Settings → Lock This Device.', 'Choose Main Screen to sign out and return to Choose VEX Event.', 'Choose Event Main Page to lock the device at this event’s login page while remembering the sign-in.', 'Choose Cancel to stay in the workspace.'],
  'Event Main Page offers the remembered-role unlock; the server rechecks it. Main Screen requires the appropriate new sign-in.',
  'Locking this device does not sign out all volunteers or delete event records. Unlocking needs server access.', ['start', 'offline']);
add('photo-trouble', 'Troubleshooting', 'Camera, scanner, or picture upload problems', PHOTO,
  'Resolve permission and connectivity problems without losing pictures.', 'When capture, scanning, or upload fails.',
  ['Check camera permissions in the browser/device settings and close another app using the camera.', 'Use the supported HTTPS app or an appropriate supported browser context for camera access.', 'Confirm the team and view label; try the offered file-upload control if camera capture is unavailable.', 'Check connection/pending upload state and reconnect before repeating the upload.', 'For scanner trouble, use team search manually and verify the number.'],
  'Stored photos and upload status are distinct from camera permission. Some OCR resources need preparation before offline use.',
  'Do not clear storage while pictures are pending. Venue evidence and cloud robot inspection photos use different storage paths.', ['photos', 'offline']);
add('venue-trouble', 'Troubleshooting', 'Venue server connection problems', ADMIN,
  'Check the local network and device mode when venue sync is unavailable.', 'When Test Connection fails or local changes do not arrive.',
  ['Confirm server operator has started the server and devices are on the same network.', 'Verify the exact host/IP and port in Server URL; use the operator’s IP address if a local hostname fails.', 'Open the app from the venue address if an HTTPS-to-HTTP warning appears.', 'Ask the network operator to check firewall access and guest/client isolation.', 'Use Test Connection and Sync Now, then check pending/rejected status.', 'Preserve Export Venue Data before changing modes.'],
  'Offline/Error means the venue service is not currently reachable or returned an error.',
  'Cloud and venue data are separate. Do not switch modes expecting local records to reconcile automatically.', ['venue', 'sync-fail']);
add('trouble', 'Troubleshooting', 'Missing tabs, stale data, and support', ALL,
  'Check common causes before escalating a problem.', 'When a section is missing, information looks old, or the guide cannot answer a question.',
  ['Check the event, role, and League session.', 'A missing Matches or Rules tab can mean the corresponding data has not loaded; ask an Admin to verify imports.', 'Check connection status and refresh once; avoid duplicate entries.', 'For a stale app, install the offered update after preserving pending work and reload.', 'Ask an Admin to review Diagnostics and failed writes.', 'Use Features & Help → Send Feedback with device, event name, expected action, and what happened.'],
  'Role restrictions, event protection, missing imported data, and network failures have different remedies.',
  'Do not include passwords, access cards, protected identifiers, private photos, or raw unreviewed diagnostics in public feedback.', ['roles', 'connection', 'offline']);

add('view-feedback', 'Developer', 'View feedback submissions', ['Developer'],
  'Read feedback for the current event/session, or use Universal Feedback on Choose VEX Event to review all events and League sessions after Developer sign-in.', 'When reviewing bugs, requests, or general feedback.',
  ['Sign in with Developer access and select the event and working League session.', 'Open Features & Help and choose View Feedback.', 'Search by message or sender, and review the submission date.', 'Use Back to Features & Help when finished.'],
  'The screen lists saved feedback messages, newest first. Developer can set New, In progress, or Resolved, search by sender/message, and filter by status. Existing submissions start as New. Changes require a cloud connection; Refresh statuses loads updates from other Developer devices. Original messages remain unchanged. New submissions appear as event data syncs. Other field log entries are excluded.',
  'This screen is available only to Developers. It shows the current event or session, not a combined inbox across events. Older submissions may contain only the message, sender, and date.', ['trouble']);

add('vex-live-sync', 'Sync & Offline', 'Import VEX qualification rankings', ADMIN,
  'Preview published VEX API data before importing it into the current event or League session.', 'When standings have been published on VEX Events.',
  ['In cloud mode, open Rankings or the Event Command Center and select VEX API Sync. Confirm the target event and League session.', 'Enter the full event code, select Load divisions, and choose a division.', 'Only qualification rankings are available.', 'Check for updates, review the preview, then Start syncing. Overlapping standings are updated.', 'Start syncing imports the preview and enables automatic updates. Checks run once a minute while Ref OS stays open, visible and online, even after closing the dialog.', 'Close the dialog to use the app while syncing. Use Stop sync in the status bar to stop monitoring. '],
  'Rankings retain official qualification ranks. Skills use Tournament Manager imports.',
  'Published data may lag scoring. Empty snapshots preserve data; errors stop automatic updates. Imports can partially succeed if a write fails; retry the reviewed snapshot. Match schedules and scores use Tournament Manager imports. Only qualification rankings are synced.', [], 'api vex events skills scores rankings division automatic polling');
add('team-events', 'Teams & Inspection', 'Registered and past team events', ['Referee','Emcee','Admin','Developer'],
 'View VEX-reported events alongside the team history.', 'When checking a team’s event schedule.',
 ['Open Teams, then select a team.', 'Find Registered & Past Events. The list loads online and shows upcoming events first, then past events.', 'Use Refresh events for a fresh lookup. V5 event links open the official event page.', 'Previously loaded lists remain available on this device offline. Check the Last checked time.'],
 'Events from the past year through the next year show their code, date and location.',
 'The API documents team event associations; this is not proof of registration status or attendance. Missing events may not be exposed by the API. No match or ranking data is changed.', [], 'registered registration upcoming team history vex api offline');
add('iq-event', 'Getting Started', 'Create a VEX IQ event', ALL,
 'Choose a competition program before creating the event.', 'When creating an IQ or V5RC / VEX U event.',
 ['Choose Create VEX Event and select VEX IQ or V5RC / VEX U.', 'Optional VEX lookup detects the program; confirm it matches your event.', 'Enter the name, choose Tournament or League, and finish event creation.', 'For IQ events, open Rules or Features & Help to read the supplied Level Up 2026–2027 manual version 2.0. The IQ Rules screen includes 78 searchable quick-reference descriptions grouped by category.', 'Admins can correct the saved program in Event Setup. Open PDF or Download manual if the embedded viewer is unavailable.'],
 'The competition program is saved with the event. Existing events default to V5RC / VEX U.',
 'IQ now provides partner teamwork matches, shared scores, ranked finals, IQ violation rule choices and inspection preparation. Qualification averages and skills are imported from TM; official rankings and tiebreakers remain in TM. The manual is available offline after the updated app finishes caching its files. Check official resources for subsequent revisions.', [], 'iq viqrc level up manual competition program');
add('highlander-practice', 'Quick Starts', 'Practice logging at Highlander Summit', ['Referee','Admin','Developer','Judge Advisor'],
 'Demonstrate violations without saving changes to the protected Highlander event.', 'When showing Ref OS to volunteers.',
 ['Open the protected Highlander Summit demo.', 'In Practice violations, choose Log practice violation.', 'Select a team, match and rules, then add notes or example photos.', 'Choose Add practice entry to show a temporary card. Use Clear practice entries to reset your demonstration.'],
 'Practice cards appear in a separate area marked Not saved. The usual event form is used.',
 'Practice entries are held only in memory on this device. Leaving the event or reloading removes them. They do not change real teams, history, totals, exports or sync queues. Existing Highlander records remain protected.', [], 'highlander demo practice fake temporary violation');
add('iq-workflows', 'Quick Starts', 'Run IQ teamwork and finals', ALL,
 'Follow the partner-team workflow for Level Up.', 'Before operating an IQ event.',
 ['Choose VEX IQ in Event Setup. Import teams and official qualification rankings through TM Sync Center.', 'Open Matches and import the IQ schedule/results CSV: Round, Match, Team1, Team2, Field and optional Score. Review the preview before applying. In a League, confirm the working session first.', 'Open a match to see both partners, the shared score and referee checks. Admins can save a reviewed shared score or use the Level Up bag-count aid. Record the official score in TM as well.', 'Use Log violation for a partner to cite IQ rules. Record field observations or a replay ruling; IQ has no AWP or opposing-alliance timeout.', 'Open Finals, select the finals match count and preview adjacent-ranked partnerships. Lowest seed plays first. Import TM finals to update existing pairings; resolve first-place ties and stop times in TM.', 'Open Rankings for imported average scores and Skills Challenge results. In Robots, use the temporary IQ inspection checklist and capture robot reference pictures.'],
 'Partner teamwork, shared-score results, ranked finals, and IQ rule choices replace V5 match controls.',
 'Scoring eligibility still requires the full manual. Blank imported scores preserve saved results. Tiebreakers, no-shows, excluded qualification scores and League participation eligibility are managed in TM. The inspection checklist is temporary and does not certify a pass. IQ schedules/results use individual imports, not the V5 event-package classifier. IQ API rankings sync is not enabled; import TM standings.', ['iq-event'], 'iq teamwork score finals partners inspection skills average level up');
export const GUIDE_ARTICLES = articles;
export function visibleArticles(role) {
  return articles.filter((a) => a.roles.includes(role));
}
export function searchArticles(role, query = '', category = '') {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return visibleArticles(role).filter((a) => (!category || a.category === category) && words.every((word) =>
    [a.title, a.category, a.summary, a.when, ...a.steps, a.seen, a.important, a.keywords,
      'Available to When to use it How to use it What you will see Important Related guides'].join(' ').toLocaleLowerCase().includes(word)));
}





// Qualification API sync quick start: open Rankings or Event Command Center > VEX API Sync. Confirm the event code; divisions load automatically for a saved code and a single division is selected. Review the preview and click Start syncing to import and enable background updates. Import once performs only one import. Manage or Stop sync from the status bar. Skills and matches use Tournament Manager imports.






