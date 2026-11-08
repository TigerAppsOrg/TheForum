# TIG-308 organization review fixtures

TIG-308 requests a Figma redesign for overlooked suggestions, the long organization
list, inconsistent row heights and description truncation, zero-follower noise,
small logos, mixed offices and clubs, and inconsistent category labels.
This command supplies review data. The directory now supports keyset pagination
with 15 rows per page, Name/Member count/Date created sorts, and an independent
Ascending/Descending control. The remaining
redesign work is separate.

Set `DATABASE_URL` in the root `.env` to your local database, following the root
`.env.example`. From the repository root, with the database running and schema applied:

```powershell
bun run db:seed:org-review --dry-run
bun run db:seed:org-review
```

The command loads the root `.env`, like the other database scripts. It refuses remote hosts and
production mode. It runs independently of the full seed and InboxEngine, in one
transaction. Stable external IDs and names ending in `[TIG-308 demo]` keep imported
and real organizations separate. Reruns refresh these fixtures and event dates;
they restore the specified demo follows, retain additional follows, and do not duplicate fixture rows.
There is no need to reset the database. Additional existing orgs increase the total.

| Review case | Fixture / action |
| --- | --- |
| Many pages | 312 demo organizations: 21 pages at the fixed size of 15, including a partial last page. Names span A–Z. First/Previous/Next are grouped on the right. The result range reads 1–15, 16–30, 31–45, etc. Sort, direction, filters, and keyset cursors are kept in the URL for Back and shared links. |
| Description heights and clipping | 52 null descriptions, 52 empty strings, short descriptions, and 52 long paragraphs. |
| Logo readability and fallback | 104 each with no logo, a simple logo, and a dense logo. Assets are local and work offline. |
| Zero and nonzero followers | Most start at zero; other rows have 1, 3, 8, or 24 followers. Counts come from actual follow records, independently of imported member counts. |
| Offices mixed with clubs | Academic Advising, AccessAbility Center, Office of International Programs, and Research Computing have `groupType = University Office`. Others are student organizations. |
| Category mismatch | All ten categories are represented. Social Event and Community Service expose chip/row wording differences. AccessAbility Center and Active Minds deliberately retain Politics to reproduce the issue. |
| Long suggestion names | The International Association entry has a long name and Academics category. Suggestions remain selected by the existing ranking logic, so this exact entry is not guaranteed to appear. |
| Followed and unfollowed states | Demo viewer `tig308_demo_01` follows some orgs and has Academics/Culture interests, leaving others available for suggestions. These are fictional database users, not CAS accounts; use an existing local auth workflow or sign in normally and follow a few demo orgs. |
| Activity and event counts | First 12 orgs each have one event, with past and upcoming dates; remaining demo orgs have none. |
| Single page | Search `Research Computing` (one demo match), or `Collective 300` (one generated demo match). |
| No results | Search `tig308-no-match-xyz`. Clear the search to restore results. |
| Loading, mobile, URL/back behavior | Use browser network throttling, narrow the viewport, and navigate between pages. Search/category/sort/direction changes reset pagination. Name sorts by `(name, id)`; Member count by `(coalesce(member_count, -2147483649), id)`; Date created by `(created_at, id)`. Each supports ascending or descending order, including the ID tie-breaker. Unknown member counts come last descending and first ascending. Member counts differ from Forum follower counts. |
| No suggestions / wholly empty directory | Requires a separate clean database or a viewer with no eligible suggestions; this seed intentionally populates the directory and does not delete existing data. |

The dry run reports fixture coverage without requiring a database connection.

Pagination indexes are defined in the Drizzle schema and migration
`0007_organization_keyset_indexes.sql`: one tuple index per sort, plus
category-prefixed versions for filtered lists. There are no offset queries or
numbered page jumps. Cursors contain the boundary values, so a deleted boundary
row still works. Changing an organization's sort value can move it between pages;
the directory shows live data rather than a frozen snapshot.
Ranges are computed from the count of matching rows before the first displayed
row, so they remain accurate on refreshed links and after inserts/deletes. This
adds a count query; the rows themselves are still fetched by tuple seek without
an offset. Existing indexes also support reverse scans for the opposite direction.

Pagination URLs use ordinary query parameters rather than encoded JSON:
`direction=next&after_id=<uuid>` plus `after_name`, `after_member_count`, or
`after_created_at`, according to the selected sort. The timestamp uses `T` between
date and time and retains all six fractional digits when present. The server
validates the tuple and queries directly, without looking up the boundary row.
Changing a filter, sort, or order removes all boundary parameters.

Run the database pagination tests against a migrated local database:

```powershell
$env:ORG_TEST_DATABASE_URL = 'postgresql://forum:forum_password@localhost:5434/the_forum'
bun test apps/database/src/organization-page.test.ts
```

Tests insert temporary data in transactions and roll it back. They cover all
sorts, tied values, timestamp microseconds, unknown counts, filters, invalid
cursors, reverse navigation, concurrent inserts/deletes, and index query plans.
