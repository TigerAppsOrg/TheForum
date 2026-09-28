import { describe, expect, test } from "bun:test";
import {
  ORG_DIVERSITY_CAP,
  ORG_DIVERSITY_WINDOW,
  type ScoringContext,
  type ScoringInput,
  WEIGHTS,
  compareRecentlyPosted,
  compareScored,
  compareSoonest,
  finalizeFeedOrder,
  postedAt,
  scoreEvent,
  sourceQuality,
} from "./feed-ranking";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-09-28T16:00:00.000Z");

const ctx = (overrides: Partial<ScoringContext> = {}): ScoringContext => ({
  userId: "viewer",
  now: NOW,
  interestTags: new Set(),
  myOrgIds: new Set(),
  interactedOrgIds: new Set(),
  ...overrides,
});

const event = (overrides: Partial<ScoringInput> & { id: string }): ScoringInput => ({
  orgId: null,
  startsAt: NOW + 2 * DAY,
  postedAt: NOW - 10 * DAY,
  tags: [],
  friendsAttendingCount: 0,
  viewCount: 0,
  source: "myprincetonu",
  announcementCount: 0,
  ...overrides,
});

/** Score → sort → finalize, exactly as `loadRankedFeed` does for "For you". */
function rankForYou(inputs: ScoringInput[], c: ScoringContext = ctx()) {
  const scored = inputs.map((e) => ({ ...e, score: scoreEvent(e, c) }));
  scored.sort(compareScored);
  return finalizeFeedOrder(scored, { now: c.now });
}

describe("sourceQuality", () => {
  test("listserv announcements boost, growing gently with repeats", () => {
    expect(sourceQuality("listserv", 1)).toBeCloseTo(0.5);
    expect(sourceQuality("listserv", 2)).toBeCloseTo(Math.log2(3) / 2);
    expect(sourceQuality("listserv", 3)).toBe(1);
    expect(sourceQuality("listserv", 12)).toBe(1);
  });

  test("an official event that was also emailed gets the same boost", () => {
    expect(sourceQuality("myprincetonu", 1)).toBe(sourceQuality("listserv", 1));
  });

  test("unannounced MyPrincetonU listings sit below neutral; Forum events slightly above", () => {
    expect(sourceQuality("myprincetonu", 0)).toBeLessThan(0);
    expect(sourceQuality("manual", 0)).toBeGreaterThan(0);
    expect(sourceQuality("manual", 0)).toBeLessThan(sourceQuality("listserv", 1));
    expect(sourceQuality("legacy-import", 0)).toBe(0);
  });
});

describe("For you: listserv-announced events outrank unannounced MyPrincetonU listings", () => {
  test("otherwise-identical events: announced wins by more than the random nudge can undo", () => {
    const c = ctx();
    const announced = scoreEvent(event({ id: "a", source: "listserv", announcementCount: 1 }), c);
    const official = scoreEvent(event({ id: "b", source: "myprincetonu" }), c);
    expect(announced - official).toBeGreaterThan(WEIGHTS.random + 1);
  });

  test("an emailed official event beats an unannounced one", () => {
    const c = ctx();
    const emailed = scoreEvent(event({ id: "a", announcementCount: 2 }), c);
    const silent = scoreEvent(event({ id: "b" }), c);
    expect(emailed).toBeGreaterThan(silent + WEIGHTS.random);
  });

  test("a feed dominated by MyPrincetonU listings still leads with the announced ones", () => {
    // 30 unannounced official listings and 5 announced events, all in the next
    // four days, no personal signals — the shape of the real feed.
    const inputs: ScoringInput[] = [];
    for (let i = 0; i < 30; i++) {
      inputs.push(event({ id: `mpu-${i}`, startsAt: NOW + (i % 4) * DAY + 6 * HOUR }));
    }
    for (let i = 0; i < 5; i++) {
      inputs.push(
        event({
          id: `list-${i}`,
          source: "listserv",
          announcementCount: 1 + (i % 2),
          startsAt: NOW + (i % 4) * DAY + 8 * HOUR,
        }),
      );
    }
    const order = rankForYou(inputs).map((e) => e.id);
    const firstFive = order.slice(0, 5);
    // The soon-event quota may pull an imminent listing forward, but the
    // announced events all land in the first handful of positions.
    const announcedPositions = order
      .map((id, i) => (id.startsWith("list-") ? i : -1))
      .filter((i) => i >= 0);
    expect(Math.max(...announcedPositions)).toBeLessThan(8);
    expect(firstFive.filter((id) => id.startsWith("list-")).length).toBeGreaterThanOrEqual(4);
  });

  test("among announced events, sooner still ranks higher", () => {
    const c = ctx();
    const tomorrow = scoreEvent(
      event({ id: "a", source: "listserv", announcementCount: 1, startsAt: NOW + DAY }),
      c,
    );
    const inThreeWeeks = scoreEvent(
      event({ id: "b", source: "listserv", announcementCount: 1, startsAt: NOW + 21 * DAY }),
      c,
    );
    expect(tomorrow).toBeGreaterThan(inThreeWeeks + WEIGHTS.random);
  });
});

describe("For you: followed orgs rise", () => {
  test("following an org adds the full org weight", () => {
    const e = event({ id: "a", orgId: "org-1" });
    const base = scoreEvent(e, ctx());
    const followed = scoreEvent(e, ctx({ myOrgIds: new Set(["org-1"]) }));
    expect(followed - base).toBeCloseTo(WEIGHTS.org);
  });

  test("a followed org's event two weeks out outranks an unfollowed one in two days", () => {
    const c = ctx({ myOrgIds: new Set(["club"]) });
    const followedFar = scoreEvent(event({ id: "a", orgId: "club", startsAt: NOW + 14 * DAY }), c);
    const otherSoon = scoreEvent(event({ id: "b", orgId: "other", startsAt: NOW + 2 * DAY }), c);
    expect(followedFar).toBeGreaterThan(otherSoon + WEIGHTS.random);
  });

  test("followed events reach the first page, without flooding it", () => {
    const inputs: ScoringInput[] = [];
    for (let i = 0; i < 60; i++) {
      inputs.push(
        event({
          id: `other-${i}`,
          orgId: `org-${i}`,
          source: "listserv",
          announcementCount: 1,
          startsAt: NOW + (i % 10) * DAY + 5 * HOUR,
        }),
      );
    }
    for (let i = 0; i < 6; i++) {
      inputs.push(event({ id: `club-${i}`, orgId: "club", startsAt: NOW + (10 + i * 2) * DAY }));
    }

    const unfollowed = rankForYou(inputs).map((e) => e.id);
    const followed = rankForYou(inputs, ctx({ myOrgIds: new Set(["club"]) })).map((e) => e.id);

    const firstPage = (order: string[]) =>
      order.slice(0, ORG_DIVERSITY_WINDOW).filter((id) => id.startsWith("club-")).length;

    expect(firstPage(unfollowed)).toBe(0);
    // Hoisted onto page 1, but the org cap still limits it to 3 per 20.
    expect(firstPage(followed)).toBe(ORG_DIVERSITY_CAP);
    // Every followed event rises.
    for (let i = 0; i < 6; i++) {
      expect(followed.indexOf(`club-${i}`)).toBeLessThan(unfollowed.indexOf(`club-${i}`));
    }
  });
});

describe("Soonest", () => {
  test("start time ascending, ties by id", () => {
    const items = [
      { id: "c", startsAt: NOW + 3 * DAY },
      { id: "b", startsAt: NOW + DAY },
      { id: "a", startsAt: NOW + DAY },
    ];
    expect([...items].sort(compareSoonest).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });
});

describe("Recently posted", () => {
  test("posted time is the first announcement, else when it entered The Forum", () => {
    const created = new Date(NOW - 5 * DAY);
    const announced = new Date(NOW - 2 * HOUR);
    expect(postedAt({ announcedAt: announced, createdAt: created })).toBe(announced.getTime());
    expect(postedAt({ announcedAt: null, createdAt: created })).toBe(created.getTime());
  });

  test("ordered by announcement time, newest first", () => {
    const rows = [
      { id: "old-email", announcedAt: new Date(NOW - 3 * DAY), createdAt: new Date(NOW - HOUR) },
      { id: "new-email", announcedAt: new Date(NOW - 1 * HOUR), createdAt: new Date(NOW) },
      { id: "mpu-listing", announcedAt: null, createdAt: new Date(NOW - 2 * DAY) },
      { id: "forum-post", announcedAt: null, createdAt: new Date(NOW - 5 * HOUR) },
    ].map((r, i) => ({ id: r.id, postedAt: postedAt(r), startsAt: NOW + i * DAY }));

    expect([...rows].sort(compareRecentlyPosted).map((e) => e.id)).toEqual([
      "new-email",
      "forum-post",
      "mpu-listing",
      "old-email",
    ]);
  });

  test("same posted time falls back to soonest first", () => {
    const items = [
      { id: "later", postedAt: NOW, startsAt: NOW + 2 * DAY },
      { id: "sooner", postedAt: NOW, startsAt: NOW + DAY },
    ];
    expect([...items].sort(compareRecentlyPosted).map((e) => e.id)).toEqual(["sooner", "later"]);
  });
});
