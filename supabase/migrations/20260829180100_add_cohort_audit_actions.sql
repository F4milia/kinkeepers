-- Split into its own migration because a newly added enum value cannot
-- safely be used within the same transaction that added it - see A1
-- PR3's migration for the same pattern and full rationale. Scoped to
-- exactly what this PR's own cohort-creation orchestration needs;
-- reschedule/cancel/substitution/completion actions are added by the
-- later PRs in this session that actually introduce them.
alter type audit_action add value 'cohort_created';
alter type audit_action add value 'cohort_creation_failed';
