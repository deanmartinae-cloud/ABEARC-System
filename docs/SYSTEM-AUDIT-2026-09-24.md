# System inspection — September 24, 2026

## Confirmed failure and repair

`GET /api/documents` joined `Users uu` twice. SQLite rejected the query with
`SQLITE_ERROR: ambiguous column name: uu.username`. Dashboard loading caught that
failure and substituted `[]` for the document cache. Metrics, My Assignments,
Work Assignment, ownership-picker workload counts, and assignment badges all
consume that shared cache.

Removed the duplicate join. Document-loading failures now reach the dashboard
error message, including during background refreshes, and preserve previously
loaded documents instead of replacing them with an empty list.

No application records were modified. The local database contains 406 documents,
176 assigned documents and 160 uploaded documents. These are database totals;
dashboard filters, requirement states, project outcomes and completion status
determine the counts displayed on each screen.

## Verification

- Reproduced the original SQL failure against the local database opened read-only.
- Corrected document controller returned HTTP-style status 200 with 406 rows,
  176 assignments and 160 uploads. The review controller returned 28 rows, the
  checked-monitoring controller returned zero, and workload analytics counted
  176 assigned documents across 11 visible users. These were direct controller
  calls with the due-date resolver stubbed; they do not verify live HTTP sessions
  or effective deadline calculations.
- SQLite quick check: `ok`; foreign-key violations: zero; document assignments
  referencing missing users: zero.
- Prepared 566 static SQL statements with SQLite EXPLAIN. The document query was
  the only failing application query. The other failure referenced `Projects_new`,
  a temporary migration table that is absent after migration. Dynamic SQL and
  fresh-database migrations were not covered by this scan.
- Added `scripts/check-dashboard-assignments.js` to `npm run check`. It uses an
  isolated in-memory SQLite database and actual controller/frontend functions to
  verify document retrieval, uploader/assignee names, dashboard metrics, personal
  and global assignment counts, bulk project/document assignment, rejection of
  ordinary-user bulk assignment, and cache preservation/error reporting after a
  failed refresh. Notifications and stage-access resolution are stubbed.
- Full `npm run check` passed, including syntax/structure, 284 route registrations,
  frontend asset caching, document-date wiring and the existing map checks.
- Additional standalone checks passed: documentation UI, map printing and
  deletion notifications.
- Generated frontend assets were rebuilt by the structure check.

## Additional audit gaps

Five standalone scripts outside `npm run check` fail before establishing a
current application regression:

| Script | Observed mismatch |
| --- | --- |
| `check-document-remarks.js` | Expects an obsolete remarks migration string and the former `updateDocumentRemarks` controller. Current code uses `updateDocumentRemarksController`. |
| `check-remarks-editor.js` | Extracts the removed `openDocumentRemarks` function; current UI uses `openDocumentRemarkModal` and `saveDocumentRemark`. |
| `check-export-missing-colors.js` | Its VM sandbox omits `formatExportDateTime`, which the current export implementation defines and calls. |
| `check-project-summary.js` | Expects the former six-column `print-documents-table`; current markup uses ten-column `project-summary-documents`. |
| `check-nas-readiness.js` | Searches for the obsolete `[5/5] Waiting` deployment step; current launcher uses `[4/6] Waiting`. |

These scripts were left unchanged rather than altering application behavior to
match obsolete assertions. They need to be updated before they can validate their
current features. README also links to architecture/map/monitoring documentation
that is missing from this workspace.

## Deployment and limits

Repairs are in this local project. The NAS was not contacted, deployed to, or
restarted. Deploy the updated project and restart the serving Node process, then
reload the browser to load the rebuilt assets.

This inspection covered source wiring, static SQL, local database integrity and
the listed runnable checks. It was not an end-to-end browser exercise of every
role, upload/download, calendar action, backup/restore, external map provider or
NAS deployment. The separate calendar integration script requires an isolated
test server and was not run against live data.
