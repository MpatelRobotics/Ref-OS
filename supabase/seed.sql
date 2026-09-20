-- =====================================================================
-- Seed for the single locked event: The Highlander Summit Signature Event.
-- Run this ONCE in the Supabase SQL editor, AFTER schema.sql.
-- Safe to re-run (idempotent).
--
-- The event id below MUST match src/App.jsx (EVENT_ID). Join code: HS2026.
-- =====================================================================

insert into public.events (id, name, quals, practice, bracket, finals_best_of, join_code)
values (
  '11111111-1111-4111-8111-111111111111',
  'The Highlander Summit Signature Event',
  0,      -- qualification match count (set in-app once the schedule is known)
  0,      -- practice match count
  16,     -- elimination bracket: top 16
  3,      -- finals: best of 3
  'HS2026'
)
on conflict (id) do update set
  name = excluded.name,
  bracket = excluded.bracket,
  finals_best_of = excluded.finals_best_of,
  join_code = excluded.join_code;


-- Permanent Ref OS keypad Admin credential. Stored as a SHA-256 hash server side.
insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
values(
  '11111111-1111-4111-8111-111111111111',
  'admin_keypad',
  'admin',
  encode(digest('1A23','sha256'),'hex'),
  true
)
on conflict(event_id,credential_name)
do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=true,updated_at=now();

-- Permanent backup role credentials. Generated event day codes remain separate
-- and can still be regenerated in the app without changing these backups.
insert into public.event_access_credentials(event_id,credential_name,role,credential_hash,enabled)
values
  ('11111111-1111-4111-8111-111111111111','backup_ref_code','ref','3604e01cd7f166aa7ba8171221bde0eb81321ec900d48b0ecf2bba329510adde',true),
  ('11111111-1111-4111-8111-111111111111','backup_judge_code','judge','acd804081f67a9f6983f69ea4da5c06bfa3823656e69da802192a75d9ad84d8e',true),
  ('11111111-1111-4111-8111-111111111111','backup_emcee_code','emcee','5e0fc5e08d28ab37563e350a422f37dcc6272e8c1d2490bbec12df19619a8a5f',true),
  ('11111111-1111-4111-8111-111111111111','backup_inspection_code','inspection','507387d041d89ad1b99cfd2f292a2e758d884971d0a95d72d94c573eed734738',true)
on conflict(event_id,credential_name)
do update set role=excluded.role,credential_hash=excluded.credential_hash,enabled=true,updated_at=now();

-- ------------------------------------------------------------------
-- TEAMS (101 registered as of registration close)
-- ------------------------------------------------------------------
insert into public.teams (event_id, number, name) values
  ('11111111-1111-4111-8111-111111111111', '37S', 'Supa Hot Chilli Peppers'),
  ('11111111-1111-4111-8111-111111111111', '88S', 'Starlight'),
  ('11111111-1111-4111-8111-111111111111', '96Z', 'Ctrl Z'),
  ('11111111-1111-4111-8111-111111111111', '119B', 'BOTMAN'),
  ('11111111-1111-4111-8111-111111111111', '119P', 'Polarity'),
  ('11111111-1111-4111-8111-111111111111', '119X', 'Exponential'),
  ('11111111-1111-4111-8111-111111111111', '169A', 'The Cavalry'),
  ('11111111-1111-4111-8111-111111111111', '169C', 'The Cavalry'),
  ('11111111-1111-4111-8111-111111111111', '169R', 'The Cavalry'),
  ('11111111-1111-4111-8111-111111111111', '169X', 'The Cavalry'),
  ('11111111-1111-4111-8111-111111111111', '197E', 'Ethereus'),
  ('11111111-1111-4111-8111-111111111111', '197G', 'Genesis'),
  ('11111111-1111-4111-8111-111111111111', '255H', 'Norristown Robotics - HOG RIDAAAAA'),
  ('11111111-1111-4111-8111-111111111111', '293Z', 'Equinox'),
  ('11111111-1111-4111-8111-111111111111', '295A', 'Habibi'),
  ('11111111-1111-4111-8111-111111111111', '295Y', 'PARTY'),
  ('11111111-1111-4111-8111-111111111111', '1028A', 'WASHED'),
  ('11111111-1111-4111-8111-111111111111', '1281A', 'It''s MyGO!!!!! - Radiant'),
  ('11111111-1111-4111-8111-111111111111', '1523A', 'Avarice'),
  ('11111111-1111-4111-8111-111111111111', '1584A', 'Artemis'),
  ('11111111-1111-4111-8111-111111111111', '1698A', 'Limited Edition'),
  ('11111111-1111-4111-8111-111111111111', '1755N', 'Nuclear Robotics'),
  ('11111111-1111-4111-8111-111111111111', '1769A', 'EXtreme'),
  ('11111111-1111-4111-8111-111111111111', '1862A', 'Shining Bots'),
  ('11111111-1111-4111-8111-111111111111', '1862X', 'Goofy Goobers'),
  ('11111111-1111-4111-8111-111111111111', '2145V', 'Pink Swirlee Unicorns'),
  ('11111111-1111-4111-8111-111111111111', '2145X', 'Pink Shimmeree Unicorns'),
  ('11111111-1111-4111-8111-111111111111', '2145Y', 'Pink Spanglee Unicorns'),
  ('11111111-1111-4111-8111-111111111111', '2145Z', 'Pink Shinee Unicorns'),
  ('11111111-1111-4111-8111-111111111111', '2429A', 'Blockbot - Radiant'),
  ('11111111-1111-4111-8111-111111111111', '2498B', 'bummer.'),
  ('11111111-1111-4111-8111-111111111111', '2502A', 'Affogato'),
  ('11111111-1111-4111-8111-111111111111', '2502V', 'Olive Oil'),
  ('11111111-1111-4111-8111-111111111111', '2523A', 'Trinity'),
  ('11111111-1111-4111-8111-111111111111', '2523V', 'Trinity'),
  ('11111111-1111-4111-8111-111111111111', '2627E', 'Demotorized'),
  ('11111111-1111-4111-8111-111111111111', '2702R', 'Stingray'),
  ('11111111-1111-4111-8111-111111111111', '2982A', 'AVERAGE INTELLIGENCE'),
  ('11111111-1111-4111-8111-111111111111', '2982B', 'Bagarre Bears'),
  ('11111111-1111-4111-8111-111111111111', '2982X', 'left me all on read'),
  ('11111111-1111-4111-8111-111111111111', '2982Z', 'Zesty Zebras'),
  ('11111111-1111-4111-8111-111111111111', '3150Z', 'Wing It'),
  ('11111111-1111-4111-8111-111111111111', '3151X', 'Firefly'),
  ('11111111-1111-4111-8111-111111111111', '3760X', 'White Lotus'),
  ('11111111-1111-4111-8111-111111111111', '3866F', NULL),
  ('11111111-1111-4111-8111-111111111111', '4478N', 'Nightfall'),
  ('11111111-1111-4111-8111-111111111111', '4610J', 'Jariffe : Robot Rev'),
  ('11111111-1111-4111-8111-111111111111', '4610P', 'Penguin Mafia: Robot Rev'),
  ('11111111-1111-4111-8111-111111111111', '4610S', '5 Step : Robot Rev'),
  ('11111111-1111-4111-8111-111111111111', '4610T', 'Turtle Tots : Robot Rev'),
  ('11111111-1111-4111-8111-111111111111', '4610W', 'Wreckage: Robot Rev'),
  ('11111111-1111-4111-8111-111111111111', '4610Z', 'Zenith: Robot Rev'),
  ('11111111-1111-4111-8111-111111111111', '5150D', 'Mad Hatters - Delta'),
  ('11111111-1111-4111-8111-111111111111', '5249Z', 'Nexus'),
  ('11111111-1111-4111-8111-111111111111', '7405A', 'Millburn Axiom'),
  ('11111111-1111-4111-8111-111111111111', '7405B', 'Millburn Blackout'),
  ('11111111-1111-4111-8111-111111111111', '7405C', 'Millburn Chinsanity'),
  ('11111111-1111-4111-8111-111111111111', '7405M', 'Millburn Mayhem'),
  ('11111111-1111-4111-8111-111111111111', '8737M', 'ROKKR'),
  ('11111111-1111-4111-8111-111111111111', '9039J', 'Jinx'),
  ('11111111-1111-4111-8111-111111111111', '9364E', 'Iron Eagles - Ember'),
  ('11111111-1111-4111-8111-111111111111', '9909D', 'Delilah'),
  ('11111111-1111-4111-8111-111111111111', '9909M', 'Marco'),
  ('11111111-1111-4111-8111-111111111111', '10702X', 'Milky Way Monkeys'),
  ('11111111-1111-4111-8111-111111111111', '11753A', 'Nylock'),
  ('11111111-1111-4111-8111-111111111111', '11753B', 'TBD'),
  ('11111111-1111-4111-8111-111111111111', '12125A', 'Sublime A'),
  ('11111111-1111-4111-8111-111111111111', '12914X', 'OmegaBotz'),
  ('11111111-1111-4111-8111-111111111111', '12914Y', 'OmegaBlitz'),
  ('11111111-1111-4111-8111-111111111111', '16099A', 'Overclock'),
  ('11111111-1111-4111-8111-111111111111', '16099B', 'Overclock'),
  ('11111111-1111-4111-8111-111111111111', '16099C', 'Overclock'),
  ('11111111-1111-4111-8111-111111111111', '16099D', 'Overclock'),
  ('11111111-1111-4111-8111-111111111111', '16099E', 'Overclock'),
  ('11111111-1111-4111-8111-111111111111', '16689A', 'Dracobots'),
  ('11111111-1111-4111-8111-111111111111', '16689G', 'Dracobots/Gray Dimension'),
  ('11111111-1111-4111-8111-111111111111', '20850G', 'Tigers Robotics'),
  ('11111111-1111-4111-8111-111111111111', '20850T', 'Tailwind'),
  ('11111111-1111-4111-8111-111111111111', '20850V', 'Octobots'),
  ('11111111-1111-4111-8111-111111111111', '20850W', 'Accelerated Dragon'),
  ('11111111-1111-4111-8111-111111111111', '20850X', 'Superposition'),
  ('11111111-1111-4111-8111-111111111111', '20850Z', 'Full Throttle'),
  ('11111111-1111-4111-8111-111111111111', '25335A', 'Odyssey'),
  ('11111111-1111-4111-8111-111111111111', '26767P', 'Parallax Robotics'),
  ('11111111-1111-4111-8111-111111111111', '48730A', 'Aimbot'),
  ('11111111-1111-4111-8111-111111111111', '59218C', 'Cedar Grove Catalyst'),
  ('11111111-1111-4111-8111-111111111111', '62880A', 'C2C - Tidal'),
  ('11111111-1111-4111-8111-111111111111', '62880C', 'C2C - C''Mon Man!'),
  ('11111111-1111-4111-8111-111111111111', '62880D', 'C2C - Disconnected'),
  ('11111111-1111-4111-8111-111111111111', '62880E', 'C2C - E'),
  ('11111111-1111-4111-8111-111111111111', '66300A', 'Aurora'),
  ('11111111-1111-4111-8111-111111111111', '66556Z', 'Nameless'),
  ('11111111-1111-4111-8111-111111111111', '81390E', 'αR - E'),
  ('11111111-1111-4111-8111-111111111111', '88288A', 'TBD'),
  ('11111111-1111-4111-8111-111111111111', '90110X', 'Nap time'),
  ('11111111-1111-4111-8111-111111111111', '91725A', 'Wreckit Ridgers'),
  ('11111111-1111-4111-8111-111111111111', '93375B', 'Lightning McQueen: Krubots'),
  ('11111111-1111-4111-8111-111111111111', '96138A', 'Monroe Alchemy'),
  ('11111111-1111-4111-8111-111111111111', '96138E', 'Monroe Eclipse'),
  ('11111111-1111-4111-8111-111111111111', '96138X', 'Monroe Reflex'),
  ('11111111-1111-4111-8111-111111111111', '99209X', 'Refract')
on conflict (event_id, number) do update set name = excluded.name;
