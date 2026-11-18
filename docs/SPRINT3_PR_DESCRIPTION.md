# feat: Complete unit move-in baselines and guided AI finding review

Suggested base: `ai-image-comparison`; head: `feature/guided-photo-inspections`.
PR #68 is still open/unmerged. Retarget to `main` after the parent merges. Do not
merge either branch as part of this change.

Landlords can now create, resume and approve a move-in baseline for a verified unit
without assigning capture to a tenant. A dedicated manager-only draft lifecycle
reuses existing private upload/recovery components and publishes immutable snapshots.
Replacing an approved baseline requires explicit expected-version confirmation and
preserves all previous evidence. Future inspections reuse the unit's saved template
and match only exact unit/template-version/step/slot identities.

Guided review persists individual/pair confirm, dismiss, manual-review and resolved
decisions with audits. Eligible completed high-severity results create deduplicated
unverified in-app alerts with authorized navigation. Existing maintenance is preserved.
Django now loads local `.env` safely; the existing Gemini service retains strict
quotas, one attempt, safe fallback and durable deduplication. Retrieval failures and
supersession cannot cause a repeat paid call for a completed guided photo.

Validation: see [Sprint 3 finalization report](SPRINT3_FINALIZATION_REPORT.md) for
executed Django/Jest/TypeScript/lint/Eval/native-build/security results. Evals use 21
synthetic replay cases and zero provider calls. iOS simulator build passed; Android
requires SDK configuration. Live Gemini, controlled Cloudinary/private-delivery,
Atlas remote index/migration checks and full device acceptance remain pending.
The additive `0002_landlordbaselinedraft` migration must be applied only to an
explicitly authorized environment. No shared data migration or provider deletion ran.

Related: #9, #10, #11, #12, #13, #14, #47, #51, #52. Keep issues open pending teammate
review, integration and the remaining acceptance gates. Verify Eval is required by
branch rules; no branch protection was modified. Codex assisted with code/tests/docs.
