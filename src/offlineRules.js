// Bundled rule index for offline use. Generated from supabase/seed_rules.sql.
// Keep this file in sync when the event rule seed is updated.
export const OFFLINE_RULES = [
  {
    "code": "SC1",
    "desc": "All scoring statuses are evaluated after the Match ends",
    "category": "Scoring",
    "ord": 1
  },
  {
    "code": "SC2",
    "desc": "Placed Scoring Object criteria",
    "category": "Scoring",
    "ord": 2
  },
  {
    "code": "SC3",
    "desc": "Each Placed Pin can have zero, one, or two Scored halves",
    "category": "Scoring",
    "ord": 3
  },
  {
    "code": "SC4",
    "desc": "A Toggle is considered set to a color when it meets all of the following criteria",
    "category": "Scoring",
    "ord": 4
  },
  {
    "code": "SC5",
    "desc": "Yellow Pin Ownership",
    "category": "Scoring",
    "ord": 5
  },
  {
    "code": "SC6",
    "desc": "Robot Midfield criteria",
    "category": "Scoring",
    "ord": 6
  },
  {
    "code": "SC7",
    "desc": "Autonomous Bonus criteria",
    "category": "Scoring",
    "ord": 7
  },
  {
    "code": "SC8",
    "desc": "Autonomous Win Point criteria",
    "category": "Scoring",
    "ord": 8
  },
  {
    "code": "SG1",
    "desc": "Starting a Match",
    "category": "Specific Game",
    "ord": 9
  },
  {
    "code": "SG2",
    "desc": "Horizontal expansion is limited",
    "category": "Specific Game",
    "ord": 10
  },
  {
    "code": "SG3",
    "desc": "Vertical expansion is limited",
    "category": "Specific Game",
    "ord": 11
  },
  {
    "code": "SG4",
    "desc": "Keep Scoring Objects in the Field",
    "category": "Specific Game",
    "ord": 12
  },
  {
    "code": "SG5",
    "desc": "Each Robot gets one Pin as a Preload",
    "category": "Specific Game",
    "ord": 13
  },
  {
    "code": "SG6",
    "desc": "Possession is limited to a maximum of one Pin and one Cup",
    "category": "Specific Game",
    "ord": 14
  },
  {
    "code": "SG7",
    "desc": "Don't cross the Autonomous Line, and don't interfere with your opponents' actions",
    "category": "Specific Game",
    "ord": 15
  },
  {
    "code": "SG8",
    "desc": "Engage with the Midfield and Autonomous Line during the Autonomous Period at your own risk",
    "category": "Specific Game",
    "ord": 16
  },
  {
    "code": "SG9",
    "desc": "Alliance Goals are protected",
    "category": "Specific Game",
    "ord": 17
  },
  {
    "code": "SG10",
    "desc": "Scoring Objects can't be removed from neutral or opponent-Alliance Goals",
    "category": "Specific Game",
    "ord": 18
  },
  {
    "code": "SG11",
    "desc": "Match Loads may be introduced during the Match under certain conditions",
    "category": "Specific Game",
    "ord": 19
  },
  {
    "code": "SG12",
    "desc": "Some rules change during the Endgame period",
    "category": "Specific Game",
    "ord": 20
  },
  {
    "code": "SG13",
    "desc": "Load Zones are protected during the Driver Controlled Period of the Match",
    "category": "Specific Game",
    "ord": 21
  },
  {
    "code": "S1",
    "desc": "Be safe out there",
    "category": "Safety",
    "ord": 22
  },
  {
    "code": "S2",
    "desc": "Students must be accompanied by an Adult",
    "category": "Safety",
    "ord": 23
  },
  {
    "code": "S3",
    "desc": "Each Student Team member must have a completed participant release form on file",
    "category": "Safety",
    "ord": 24
  },
  {
    "code": "S4",
    "desc": "Stay inside the Field",
    "category": "Safety",
    "ord": 25
  },
  {
    "code": "S5",
    "desc": "Wear safety glasses",
    "category": "Safety",
    "ord": 26
  },
  {
    "code": "G1",
    "desc": "Participants must follow the Code of Conduct",
    "category": "General",
    "ord": 27
  },
  {
    "code": "G2",
    "desc": "Participants must follow the Student Centered Policy",
    "category": "General",
    "ord": 28
  },
  {
    "code": "G3",
    "desc": "Use common sense",
    "category": "General",
    "ord": 29
  },
  {
    "code": "G4",
    "desc": "Students must meet the Student Eligibility Policy requirements",
    "category": "General",
    "ord": 30
  },
  {
    "code": "G5",
    "desc": "There is a difference between accidentally and willfully violating a Robot rule",
    "category": "General",
    "ord": 31
  },
  {
    "code": "GG1",
    "desc": "Only Drive Team Members, and only in the Alliance Station",
    "category": "General Game",
    "ord": 32
  },
  {
    "code": "GG2",
    "desc": "A Team's Robot should attend every Match",
    "category": "General Game",
    "ord": 33
  },
  {
    "code": "GG3",
    "desc": "Robots on the Field must be ready to play",
    "category": "General Game",
    "ord": 34
  },
  {
    "code": "GG4",
    "desc": "Hands out of the Field",
    "category": "General Game",
    "ord": 35
  },
  {
    "code": "GG5",
    "desc": "Match replays are allowed, but rare",
    "category": "General Game",
    "ord": 36
  },
  {
    "code": "GG6",
    "desc": "Disqualifications",
    "category": "General Game",
    "ord": 37
  },
  {
    "code": "GG7",
    "desc": "Time-outs",
    "category": "General Game",
    "ord": 38
  },
  {
    "code": "GG8",
    "desc": "Keep your Robots together",
    "category": "General Game",
    "ord": 39
  },
  {
    "code": "GG9",
    "desc": "Don't hook your Robot to the Field, and don't get Entangled",
    "category": "General Game",
    "ord": 40
  },
  {
    "code": "GG10",
    "desc": "The red Alliance may choose to place last",
    "category": "General Game",
    "ord": 41
  },
  {
    "code": "GG11",
    "desc": "Controllers must stay connected to the Field",
    "category": "General Game",
    "ord": 42
  },
  {
    "code": "GG12",
    "desc": "Autonomous means \"no humans\"",
    "category": "General Game",
    "ord": 43
  },
  {
    "code": "GG13",
    "desc": "All rules still apply in the Autonomous Period",
    "category": "General Game",
    "ord": 44
  },
  {
    "code": "GG14",
    "desc": "Don't destroy other Robots. But, be prepared to encounter defense",
    "category": "General Game",
    "ord": 45
  },
  {
    "code": "GG15",
    "desc": "Offensive Robots get the \"benefit of the doubt\" when judgment calls are required",
    "category": "General Game",
    "ord": 46
  },
  {
    "code": "GG16",
    "desc": "You can't force an opponent into a penalty",
    "category": "General Game",
    "ord": 47
  },
  {
    "code": "GG17",
    "desc": "No Holding for more than a 3-count",
    "category": "General Game",
    "ord": 48
  },
  {
    "code": "GG18",
    "desc": "Use Scoring Objects to play the game",
    "category": "General Game",
    "ord": 49
  },
  {
    "code": "RSC1",
    "desc": "Standard rules apply in most cases",
    "category": "Robot Skills",
    "ord": 50
  },
  {
    "code": "RSC2",
    "desc": "Match play is different in Robot Skills Matches",
    "category": "Robot Skills",
    "ord": 51
  },
  {
    "code": "RSC3",
    "desc": "Scoring Robot Skills Matches",
    "category": "Robot Skills",
    "ord": 52
  },
  {
    "code": "RSC4",
    "desc": "Field setup for Robot Skills Matches",
    "category": "Robot Skills",
    "ord": 53
  },
  {
    "code": "RSC5",
    "desc": "Skills Stop Time",
    "category": "Robot Skills",
    "ord": 54
  },
  {
    "code": "R1",
    "desc": "One Robot per Team",
    "category": "Robot",
    "ord": 55
  },
  {
    "code": "R2",
    "desc": "Robots must pass inspection",
    "category": "Robot",
    "ord": 56
  },
  {
    "code": "R3",
    "desc": "Robots must fit within an 18\" x 18\" x 18\" volume",
    "category": "Robot",
    "ord": 57
  },
  {
    "code": "R4",
    "desc": "Officially registered Team numbers must be displayed on Robot License Plates",
    "category": "Robot",
    "ord": 58
  },
  {
    "code": "R5",
    "desc": "Let go of Scoring Objects after the Match",
    "category": "Robot",
    "ord": 59
  },
  {
    "code": "R6",
    "desc": "Robots have one Brain",
    "category": "Robot",
    "ord": 60
  },
  {
    "code": "R7",
    "desc": "Keep the power button or battery connection accessible",
    "category": "Robot",
    "ord": 61
  },
  {
    "code": "R8",
    "desc": "Firmware 1.1.5",
    "category": "Robot",
    "ord": 62
  },
  {
    "code": "R9",
    "desc": "Use a \"Competition Template\" for programming",
    "category": "Robot",
    "ord": 63
  },
  {
    "code": "R10",
    "desc": "Motors are limited",
    "category": "Robot",
    "ord": 64
  },
  {
    "code": "R11",
    "desc": "Subsystems 1 & 2 have a combined motor limit",
    "category": "Robot",
    "ord": 65
  },
  {
    "code": "R12",
    "desc": "Electrical power comes from batteries only",
    "category": "Robot",
    "ord": 66
  },
  {
    "code": "R13",
    "desc": "Robots use the V5 wireless radio",
    "category": "Robot",
    "ord": 67
  },
  {
    "code": "R14",
    "desc": "Give the radio some space",
    "category": "Robot",
    "ord": 68
  },
  {
    "code": "R15",
    "desc": "One or two Controllers per Robot",
    "category": "Robot",
    "ord": 69
  },
  {
    "code": "R16",
    "desc": "Robots are built from the V5 system",
    "category": "Robot",
    "ord": 70
  },
  {
    "code": "R17",
    "desc": "New parts are legal",
    "category": "Robot",
    "ord": 71
  },
  {
    "code": "R18",
    "desc": "Prohibited Items",
    "category": "Robot",
    "ord": 72
  },
  {
    "code": "R19",
    "desc": "Certain third-party components are allowed",
    "category": "Robot",
    "ord": 73
  },
  {
    "code": "R20",
    "desc": "Custom V5 Smart Cables are allowed",
    "category": "Robot",
    "ord": 74
  },
  {
    "code": "R21",
    "desc": "A limited amount of tape is allowed",
    "category": "Robot",
    "ord": 75
  },
  {
    "code": "R22",
    "desc": "Certain third-party fasteners are allowed",
    "category": "Robot",
    "ord": 76
  },
  {
    "code": "R23",
    "desc": "Visual decorations are allowed",
    "category": "Robot",
    "ord": 77
  },
  {
    "code": "R24",
    "desc": "A limited amount of custom plastic is allowed",
    "category": "Robot",
    "ord": 78
  },
  {
    "code": "R25",
    "desc": "Pneumatics are limited",
    "category": "Robot",
    "ord": 79
  },
  {
    "code": "R26",
    "desc": "The pressure gauge is a required part if a Robot includes pneumatics",
    "category": "Robot",
    "ord": 80
  },
  {
    "code": "R27",
    "desc": "Most modifications to non-electrical components are allowed",
    "category": "Robot",
    "ord": 81
  },
  {
    "code": "R28",
    "desc": "No modifications to electronic or pneumatic components are allowed",
    "category": "Robot",
    "ord": 82
  },
  {
    "code": "T1",
    "desc": "Head Referees have ultimate and final authority on all gameplay and Robot ruling decisions",
    "category": "Tournament",
    "ord": 83
  },
  {
    "code": "T2",
    "desc": "Head Referees must be qualified",
    "category": "Tournament",
    "ord": 84
  },
  {
    "code": "T3",
    "desc": "Drive Team Members are permitted to immediately appeal a Head Referee's ruling",
    "category": "Tournament",
    "ord": 85
  },
  {
    "code": "T4",
    "desc": "The Event Partner has ultimate authority regarding all non-gameplay decisions",
    "category": "Tournament",
    "ord": 86
  },
  {
    "code": "T5",
    "desc": "Be prepared for minor Field variance",
    "category": "Tournament",
    "ord": 87
  },
  {
    "code": "T6",
    "desc": "Fields may be repaired at the Event Partner's discretion",
    "category": "Tournament",
    "ord": 88
  },
  {
    "code": "T7",
    "desc": "Fields at an event must be consistent with each other",
    "category": "Tournament",
    "ord": 89
  },
  {
    "code": "T8",
    "desc": "There are three types of Field control that may be used",
    "category": "Tournament",
    "ord": 90
  },
  {
    "code": "T9",
    "desc": "There are two types of Field Perimeter that may be used",
    "category": "Tournament",
    "ord": 91
  },
  {
    "code": "T10",
    "desc": "Qualification Matches follow the Match Schedule",
    "category": "Tournament",
    "ord": 92
  },
  {
    "code": "T11",
    "desc": "Each Team will have at least six Qualification Matches",
    "category": "Tournament",
    "ord": 93
  },
  {
    "code": "T12",
    "desc": "Qualification Matches contribute to a Team's ranking for Alliance Selection",
    "category": "Tournament",
    "ord": 94
  },
  {
    "code": "T13",
    "desc": "Qualification Matches tiebreakers",
    "category": "Tournament",
    "ord": 95
  },
  {
    "code": "T14",
    "desc": "Small Tournaments have fewer Alliances",
    "category": "Tournament",
    "ord": 96
  },
  {
    "code": "T15",
    "desc": "Send a Student representative to Alliance Selection",
    "category": "Tournament",
    "ord": 97
  },
  {
    "code": "T16",
    "desc": "Each Team may only be invited once to join one Alliance",
    "category": "Tournament",
    "ord": 98
  },
  {
    "code": "T17",
    "desc": "Elimination Matches follow the Elimination Bracket",
    "category": "Tournament",
    "ord": 99
  },
  {
    "code": "T18",
    "desc": "Elimination Matches are a blend of \"Best of 1\" and \"Best of 3\"",
    "category": "Tournament",
    "ord": 100
  },
  {
    "code": "T19",
    "desc": "Ties in Elimination Matches lead to limited rematches",
    "category": "Tournament",
    "ord": 101
  },
  {
    "code": "T20",
    "desc": "Skills Match Schedule",
    "category": "Tournament",
    "ord": 102
  },
  {
    "code": "T21",
    "desc": "Skills Challenge Fields do not require the same modifications as the Head-to-Head Fields",
    "category": "Tournament",
    "ord": 103
  },
  {
    "code": "T22",
    "desc": "Skills Rankings at events",
    "category": "Tournament",
    "ord": 104
  },
  {
    "code": "T23",
    "desc": "Skills Rankings globally",
    "category": "Tournament",
    "ord": 105
  },
  {
    "code": "T24",
    "desc": "Robot Skills at League Events",
    "category": "Tournament",
    "ord": 106
  }
];
export const OFFLINE_RULEBOOK_VERSION = "Override 2026-2027 / Ref-OS bundled rule index";
