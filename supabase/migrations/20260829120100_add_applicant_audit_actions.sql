-- Split into its own migration because a newly added enum value cannot
-- safely be used within the same transaction that added it - see A1
-- PR3's migration for the same pattern and full rationale.

alter type audit_action add value 'applicant_assigned';
alter type audit_action add value 'applicant_declined';
alter type audit_action add value 'applicant_reopened';
