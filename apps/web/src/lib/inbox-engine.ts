import { env } from "~/env";

/**
 * Server-only client for the InboxEngine HTTP API (listserv emails).
 *
 * Every call is best-effort: missing config, a timeout, a non-2xx or a
 * malformed payload all resolve to empty/null so an org page never fails
 * because the email service is down.
 */

export interface InboxMessage {
  id: string;
  subject: string;
  sender: string | null;
  senderEmail: string | null;
  sentAt: string;
  listservs: string[];
  organization: { id: string; name: string } | null;
  category: string | null;
  preview: string;
  isEvent: boolean;
  /** TigerInbox permalink. */
  url: string | null;
  archiveUrl: string | null;
}

export interface InboxMessageDetail extends InboxMessage {
  body: string;
  links: string[];
}

export interface OrgEmails {
  total: number;
  messages: InboxMessage[];
}

const TIMEOUT_MS = 5_000;
const TIGERINBOX_ORIGIN = "https://inbox.tigerapps.org";

/** TigerInbox page listing every email from an org, e.g. /org/mpu:70043. */
export function tigerInboxOrgUrl(externalId: string) {
  return `${TIGERINBOX_ORIGIN}/org/${encodeURIComponent(externalId)}`;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function httpUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function toMessage(raw: unknown): InboxMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const sentAt = str(r.sentAt);
  if (!id || !sentAt || Number.isNaN(Date.parse(sentAt))) return null;
  const org =
    r.organization && typeof r.organization === "object"
      ? (r.organization as Record<string, unknown>)
      : null;
  return {
    id,
    subject: str(r.subject) ?? "(no subject)",
    sender: str(r.sender),
    senderEmail: str(r.senderEmail),
    sentAt,
    listservs: Array.isArray(r.listservs) ? r.listservs.filter((l) => typeof l === "string") : [],
    organization:
      org && str(org.id) && str(org.name)
        ? { id: org.id as string, name: org.name as string }
        : null,
    category: str(r.category),
    preview: str(r.preview) ?? "",
    isEvent: r.isEvent === true,
    url: httpUrl(r.url),
    archiveUrl: httpUrl(r.archiveUrl),
  };
}

async function engineFetch(path: string, init: { revalidate: number | false }): Promise<unknown> {
  if (!env.INBOX_ENGINE_URL || !env.INBOX_ENGINE_TOKEN) return null;
  const base = env.INBOX_ENGINE_URL.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${env.INBOX_ENGINE_TOKEN}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(init.revalidate === false
        ? { cache: "no-store" as const }
        : { next: { revalidate: init.revalidate } }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** The org's most recent emails (newest first), cached for 5 minutes. */
export async function getOrgEmails(externalId: string, limit = 8): Promise<OrgEmails> {
  const params = new URLSearchParams({
    organization: externalId,
    sort: "newest",
    limit: String(limit),
  });
  const data = await engineFetch(`/v1/messages?${params}`, { revalidate: 300 });
  if (!data || typeof data !== "object") return { total: 0, messages: [] };
  const d = data as Record<string, unknown>;
  const messages = Array.isArray(d.results)
    ? d.results.map(toMessage).filter((m): m is InboxMessage => m !== null)
    : [];
  const total =
    typeof d.total === "number" && d.total >= messages.length ? d.total : messages.length;
  return { total, messages };
}

/** One full email (fetched per request, not cached). */
export async function getEmailById(id: string): Promise<InboxMessageDetail | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const data = await engineFetch(`/v1/messages/${id}`, { revalidate: false });
  const message = toMessage(data);
  if (!message) return null;
  const r = data as Record<string, unknown>;
  return {
    ...message,
    body: str(r.body) ?? message.preview,
    links: Array.isArray(r.links) ? r.links.map(httpUrl).filter((l): l is string => !!l) : [],
  };
}
