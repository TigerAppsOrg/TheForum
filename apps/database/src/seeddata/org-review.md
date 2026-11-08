# TIG-308 organization review fixtures

TIG-308 requests a Figma redesign for overlooked suggestions, the long organization
list, inconsistent row heights and description truncation, zero-follower noise,
small logos, mixed offices and clubs, and inconsistent category labels.
This command supplies review data; it does not implement pagination or the redesign.

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
| Many pages, shortened page controls | 312 demo organizations: 16 pages at the proposed size of 20, including a partial last page. Names span A–Z. The current UI still uses its existing list behavior. |
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
| Loading, mobile, URL/back behavior | Use browser network throttling, narrow the viewport, and navigate once the relevant UI is implemented. Data alone cannot create these behaviors. |
| No suggestions / wholly empty directory | Requires a separate clean database or a viewer with no eligible suggestions; this seed intentionally populates the directory and does not delete existing data. |

The dry run reports fixture coverage without requiring a database connection.
