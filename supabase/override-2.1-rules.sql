begin;
-- Update official titles only; preserve custom descriptions, rule codes and violation records.
update public.rules set description='Scored Pin Half criteria' where code='SC3' and description='Each Placed Pin can have zero, one, or two Scored halves';
update public.rules set description='Ownership of Yellow Pin Halves' where code='SC5' and description='Yellow Pin Ownership';
update public.refos_rule_templates set description='Scored Pin Half criteria' where ruleset='v5rc-override-2026-2027' and code='SC3' and description='Each Placed Pin can have zero, one, or two Scored halves';
update public.refos_rule_templates set description='Ownership of Yellow Pin Halves' where ruleset='v5rc-override-2026-2027' and code='SC5' and description='Yellow Pin Ownership';
update public.refos_rulesets set source='Override Game Manual 2.1, October 8, 2026' where key='v5rc-override-2026-2027';
commit;
