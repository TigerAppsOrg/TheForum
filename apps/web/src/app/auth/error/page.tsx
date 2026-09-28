import type { Metadata } from "next";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const metadata: Metadata = {
  title: "Sign-in problem — Forum",
  robots: { index: false },
};

type ErrorCopy = { title: string; description: string };

/**
 * Only known codes are rendered; the raw `error` query param is never echoed.
 * Covers Auth.js' own codes (Configuration, AccessDenied, Verification, …)
 * plus the ones our CAS routes emit.
 */
const ERRORS: Record<string, ErrorCopy> = {
  CasState: {
    title: "Your sign-in session expired",
    description:
      "The sign-in link was opened in a different browser, took too long, or was already used. Please try again.",
  },
  CasTicket: {
    title: "Princeton sign-in didn't complete",
    description: "We didn't receive a valid response from Princeton CAS. Please try again.",
  },
  CasValidation: {
    title: "We couldn't verify your Princeton login",
    description:
      "Princeton CAS didn't confirm this sign-in. This can happen if you refreshed or reused an old link. Please try again.",
  },
  CasUnavailable: {
    title: "Sign-in is temporarily unavailable",
    description:
      "We couldn't reach Princeton CAS or finish setting up your account. Please try again in a moment.",
  },
  AccessDenied: {
    title: "Access denied",
    description: "You don't have permission to sign in to Forum.",
  },
  Configuration: {
    title: "Sign-in is misconfigured",
    description:
      "Something is wrong on our end. Please try again later, and let the TigerApps team know if it keeps happening.",
  },
};

const DEFAULT_ERROR: ErrorCopy = {
  title: "Something went wrong signing you in",
  description: "Please try again. If the problem persists, let the TigerApps team know.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const code = typeof error === "string" ? error : undefined;
  const known = code !== undefined && Object.hasOwn(ERRORS, code);
  const copy = known ? ERRORS[code] : DEFAULT_ERROR;

  return (
    <main className="flex min-h-screen items-center justify-center bg-forum-yellow-10 px-4 py-12 font-dm-sans">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="font-serif text-[22px] italic tracking-tight">The Forum</p>
          <CardTitle className="text-lg">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        {code ? (
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Error code: <span className="font-dm-mono">{known ? code : "Unknown"}</span>
            </p>
          </CardContent>
        ) : null}
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          {/* Plain <a>: these are route handlers / full navigations, not RSC pages. */}
          <Button asChild variant="cerulean" size="cta" className="w-full sm:flex-1">
            <a href="/api/auth/cas/login">Try again</a>
          </Button>
          <Button asChild variant="quiet" size="cta" className="w-full sm:flex-1">
            <a href="/">Back to home</a>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
