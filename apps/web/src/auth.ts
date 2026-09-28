import { db, eq, users } from "@the-forum/database";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { isExpectedServiceUrl, isValidTicket, validateServiceTicket } from "~/lib/cas";
import { casBaseUrl } from "~/lib/cas-server";

/** Auth.js provider id for Princeton CAS. */
export const CAS_PROVIDER_ID = "cas";

const userColumns = {
  id: users.id,
  netId: users.netId,
  email: users.email,
  displayName: users.displayName,
  onboarded: users.onboarded,
};

/**
 * Find-or-create the user for a CAS-verified NetID.
 * On first login we seed email/displayName from the NetID; on later logins we
 * leave them alone so profile edits aren't clobbered.
 */
async function upsertUserByNetId(netId: string) {
  const [inserted] = await db
    .insert(users)
    .values({ netId, email: `${netId}@princeton.edu`, displayName: netId })
    .onConflictDoNothing({ target: users.netId })
    .returning(userColumns);
  if (inserted) return inserted;

  const [existing] = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.netId, netId))
    .limit(1);
  return existing ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    /**
     * Princeton CAS, modelled as a Credentials provider so we keep Auth.js' JWT
     * session (`auth()`, `signOut`, `session.user`). The only "credentials" are
     * a CAS service ticket and the service URL it was issued for; `authorize`
     * re-validates both against CAS server-side, so nothing the client sends
     * is trusted as identity.
     *
     * The only caller is `/api/auth/cas/callback` (which checks the `state`
     * cookie first); direct POSTs to `/api/auth/callback/cas` are rejected in
     * `app/api/auth/[...nextauth]/route.ts`.
     */
    Credentials({
      id: CAS_PROVIDER_ID,
      name: "Princeton CAS",
      credentials: {
        ticket: {},
        service: {},
      },
      async authorize(credentials, request) {
        const { ticket, service } = credentials ?? {};
        if (!isValidTicket(ticket)) return null;

        // The service must be *our* callback URL on the origin Auth.js resolved
        // for this request. Otherwise a ticket CAS issued to another site could
        // be replayed here to impersonate the user who obtained it.
        const expectedOrigin = new URL(request.url).origin;
        if (!isExpectedServiceUrl(service, expectedOrigin)) {
          console.warn("[auth] rejected CAS login: unexpected service URL");
          return null;
        }

        const result = await validateServiceTicket({
          casBaseUrl,
          service: service as string,
          ticket,
        });
        if (!result.ok) {
          console.warn(
            `[auth] CAS ticket validation failed: ${result.reason}${result.code ? ` (${result.code})` : ""}`,
          );
          return null;
        }

        const user = await upsertUserByNetId(result.netId);
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          netId: user.netId,
          onboarded: user.onboarded,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: `user` is what `authorize` returned.
      if (user) {
        token.userId = user.id;
        token.netId = user.netId;
        token.onboarded = user.onboarded ?? false;
        return token;
      }

      // Subsequent requests: refresh onboarded status. A DB hiccup must not
      // 500 every request, so on failure keep the last known token values.
      if (token.userId) {
        try {
          const [row] = await db
            .select({ onboarded: users.onboarded })
            .from(users)
            .where(eq(users.id, token.userId as string))
            .limit(1);
          if (row) token.onboarded = row.onboarded;
        } catch (err) {
          console.error("[auth] failed to refresh session from DB; using cached token", err);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.user.netId = token.netId as string;
        session.user.onboarded = token.onboarded as boolean;
      }
      return session;
    },
  },
});
