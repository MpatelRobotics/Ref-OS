# IQ workflows (Level Up v2.0)

Choose **VEX IQ** when creating the event, or set it in **Event Setup**. Tournament and League are both supported; League imports and scores belong to the current working session.

## Install

Run `supabase/iq-competition-program.sql` in the Supabase SQL Editor after the existing schema and event-settings migration, then publish the frontend. The read-only function lets signed-in Inspection devices identify the program without exposing other settings. No VEX Edge Function redeployment is needed for these frontend workflows. The program is cached after a successful read for offline Inspection use.

## Schedule and results

Open **Matches → Import IQ schedule / results**, or use the individual schedule/results imports in **TM Sync Center**. Export the IQ match list/results from TM. Supported CSV headers are:

```csv
Round,Match,Team1,Team2,Field,Score
Qualification,1,123A,456B,Field 1,42
Qualification,2,789C,101D,Field 2,
Finals,1,789C,101D,Field 1,58
```

These are example data, not an official TM template. The parser also accepts TM `MatchNum` and `Red1`/`Blue1` or `Red1`/`Red2` team slots when there are at most two distinct teams in the row, and `RedScore` as a shared-score column when `BlueScore` is blank or zero. Numeric rounds supported: 1 Practice, 2 Qualification, 5 Finals. JSON accepts a matches array with phase, num, teams (or red/blue arrays), field and score. Unsupported exports show an error; no silent four-team conversion occurs.

Review partner teams, match numbers and scores before **Apply IQ matches**. One-team rows support an official missing-partner finals arrangement. Empty scores retain saved scores, zero is a valid score, and changing partners on a scored match requires a reviewed replacement score. Duplicate match numbers within a phase are rejected. Reimports update the same event/session match; they do not remove omitted matches. Partial write failures can require reviewing and retrying the import. IQ imports use individual categories; the V5 multi-file package classifier is not enabled for IQ.

## Refereeing and shared scoring

A teamwork match has two partner teams and one shared score, with no V5 AWP, autonomous bonus, opposing-alliance timeout, or elimination winner. Open a match to review the partnership and shared score, log an IQ-rule violation for a team, or record a field observation/replay ruling. Ref OS does not create a replacement match merely because a replay ruling was logged.

The Admin scoring aid uses SC1–SC5: Floor 1, L1 3, L2 6, L3 12, L4 16 points per scored bag. It rejects negative/fractional counts, more than 38 total bags, and more than six yellow L4 bags. Count each bag once at its highest qualifying level; the Head Referee still determines eligibility under the full manual. Saving updates Ref OS only: enter the official result in TM too. Score writes require a cloud connection and are not placed in the offline outbox. The calculator can be used locally after the app loads.

The referee reference includes 60-second teamwork matches, driver switching with 0:35–0:25 remaining under GG11, starting checks, and stopping at 0:00. Robot reference pictures cannot replace the manual's restrictions on reviewing match pictures/video for scoring rulings.

## Finals

Import final qualification ranks from TM. Open **Finals**, set the number of finals matches, and preview partnerships: ranks 1 + 2, 3 + 4, and so on. Ranks must be unique and consecutive. The lowest-seeded partnership plays first, once per partnership. Confirm the actual field/participants and the Event Partner's finals count in TM; the default count of five is not an eligibility calculation.

The preview creates finals only when none already exist. To change existing finals, import the reviewed TM schedule. Recorded finals are listed by score without automatically declaring a champion. TM handles first-place tiebreaker matches, stop times and seed decisions under T14. Give imported tiebreaker matches unique finals match numbers. Ref OS does not merge division finals or automatically promote a partnership.

## Rankings and skills

Import qualification standings through TM Sync Center. IQ displays the supplied **average score** and **matches played**, not V5 W/L/T or WP/AP/SP. Accepted average headers include AveragePoints, AvgPoints, AverageScore, AvgScore, Average; played headers include NumPlayed, Played, MatchesPlayed. Imported ranks remain authoritative for excluded scores, extra matches, no-shows, tiebreakers and League participation thresholds. Ref OS does not calculate official averages or cumulative League standings.

Skills remain TM-imported Driving and Autonomous Coding results. TM manages run eligibility, the three-attempt allowance per category, stop times and all skills tiebreakers. Individual skills runs are not recorded in Ref OS. IQ VEX API rankings sync is not enabled in this build; use TM imports.

## Inspection

Robots includes a temporary per-team IQ preparation checklist: starting volume, license plates, Brain/motors/battery/Controller, legal parts and reinspection. Check the full supplied manual and official form; the checklist does not save or certify an inspection pass. Front, Side, Back and Inspection Tag remain Ref OS's reference photo workflow. These are app photo requirements, not a claim that the game manual requires those photographs. IQ does not offer the V5 Lexan Diagram slot. Existing photo permissions, compression, offline queue and session isolation continue to apply.

## Verification limits

Automated tests use controlled fixtures. Verify the installed SQL, real TM export shape, score write permissions and two-device sharing with a separate test IQ event before a production event. The bundled rules/manual are Level Up version 2.0, not an automatically updated source of later rulings.
