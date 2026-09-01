-- A4-cert PR2/3: split into its own migration because a newly added enum
-- value cannot safely be used within the same transaction that added it
-- (see A1 PR3's migration for the same pattern and full rationale).
alter type audit_action add value 'facilitator_certified';
