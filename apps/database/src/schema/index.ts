import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────

export const eventTagEnum = pgEnum("event_tag", [
  "free food",
  "career",
  "research",
  "academics",
  "tech",
  "entrepreneurship",
  "politics",
  "visual arts",
  "performing arts",
  "literature",
  "culture",
  "music",
  "gaming",
  "athletics",
  "religion",
  "sustainability",
  "outdoors",
  "wellness",
  "community service",
  "speaker event",
  "social event",
  "stem",
]);

export const campusRegionEnum = pgEnum("campus_region", [
  "central",
  "east",
  "west",
  "south",
  "north",
  "off-campus",
]);

export const friendshipStatusEnum = pgEnum("friendship_status", [
  "pending",
  "accepted",
  "declined",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "friend_request",
  "event_reminder",
  "org_new_event",
]);

export const orgCategoryEnum = pgEnum("org_category", [
  "career",
  "affinity",
  "performing arts",
  "academics",
  "athletics",
  "social event",
  "culture",
  "religion",
  "politics",
  "community service",
]);

export const orgRoleEnum = pgEnum("org_role", ["owner", "officer", "member"]);

export const eventStatusEnum = pgEnum("event_status", ["draft", "published"]);

export const interactionTypeEnum = pgEnum("interaction_type", [
  "view",
  "click",
  "rsvp",
  "save",
  "share",
  "hide",
]);

export const itemTypeEnum = pgEnum("item_type", ["event", "organization"]);

export const locationCategoryEnum = pgEnum("location_category", [
  "academic",
  "residential",
  "athletic",
  "social",
  "administrative",
  "library",
  "dining",
  "other",
]);

// ── Tables ────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  netId: varchar("net_id", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  classYear: varchar("class_year", { length: 10 }),
  major: varchar("major", { length: 255 }),
  avatarUrl: text("avatar_url"),
  isOrgLeader: boolean("is_org_leader").default(false).notNull(),
  onboarded: boolean("onboarded").default(false).notNull(),
  /** Secret for the user's iCalendar feed URLs (/cal/<token>/…). Created on first use; rotatable. */
  calendarToken: varchar("calendar_token", { length: 64 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userInterests = pgTable(
  "user_interests",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tag: eventTagEnum("tag").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tag] })],
);

export const userRegions = pgTable(
  "user_regions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    region: campusRegionEnum("region").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.region] })],
);

export const campusLocations = pgTable("campus_locations", {
  id: varchar("id", { length: 100 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  category: locationCategoryEnum("category").notNull(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  category: orgCategoryEnum("category").notNull(),
  /** Null for organizations imported from MyPrincetonU (no Forum user created them). */
  creatorId: uuid("creator_id").references(() => users.id),
  /** 'myprincetonu' (synced from InboxEngine) or 'manual' (created in The Forum). */
  source: varchar("source", { length: 20 }).default("manual").notNull(),
  /** Stable InboxEngine organization ID, e.g. "mpu:52941" for MyPrincetonU group 52941. */
  externalId: varchar("external_id", { length: 64 }).unique(),
  acronym: varchar("acronym", { length: 40 }),
  tagline: text("tagline"),
  groupType: varchar("group_type", { length: 120 }),
  /** The organization's MyPrincetonU group page. */
  groupUrl: text("group_url"),
  website: text("website"),
  contactEmail: varchar("contact_email", { length: 255 }),
  /** { instagram?, facebook?, linkedin?, twitter?, youtube? } → URLs */
  socials: jsonb("socials").$type<Record<string, string>>().default({}).notNull(),
  /** Member count reported by MyPrincetonU (not Forum users). */
  memberCount: integer("member_count"),
  syncedAt: timestamp("synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.userId] }),
    // "Orgs I belong to / manage" — the PK leads with org_id, so it can't serve this.
    index("org_members_user_id_idx").on(t.userId),
  ],
);

export const orgFollowers = pgTable(
  "org_followers",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.userId] }),
    // "Orgs I follow" (feed org affinity, follow state).
    index("org_followers_user_id_idx").on(t.userId),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    datetime: timestamp("datetime").notNull(),
    endDatetime: timestamp("end_datetime"),
    locationId: varchar("location_id", { length: 100 })
      .notNull()
      .references(() => campusLocations.id),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id),
    flyerUrl: text("flyer_url"),
    coverPreset: varchar("cover_preset", { length: 50 }),
    externalLink: text("external_link"),
    isPublic: boolean("is_public").default(true).notNull(),
    status: eventStatusEnum("status").default("published").notNull(),
    /** 'manual' | 'myprincetonu' (official) | 'listserv' (extracted from email) | legacy values. */
    source: varchar("source", { length: 20 }).default("manual").notNull(),
    /** For imported events: "ie:<InboxEngine event id>". */
    sourceMessageId: varchar("source_message_id", { length: 255 }).unique(),
    /** Where an imported event came from (MyPrincetonU page or the source email). */
    sourceUrl: text("source_url"),
    /** Room or free-text place beyond the campus location ("Room 104", "Zoom"). */
    locationDetail: varchar("location_detail", { length: 200 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // Feed / map / search candidate scans: upcoming published events by time.
    // Partial, so drafts never bloat it; discovery queries always filter on
    // status = 'published', which lets the planner use it.
    index("events_published_datetime_idx")
      .on(t.datetime)
      .where(sql`${t.status} = 'published'`),
    index("events_org_id_idx").on(t.orgId),
    index("events_creator_id_idx").on(t.creatorId),
    index("events_location_id_idx").on(t.locationId),
  ],
);

export const eventTags = pgTable(
  "event_tags",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    tag: eventTagEnum("tag").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.tag] }),
    // Tag filters and interest matching look events up by tag.
    index("event_tags_tag_idx").on(t.tag),
  ],
);

export const eventTagEmbeddings = pgTable("event_tag_embeddings", {
  tagName: eventTagEnum("tag_name").primaryKey(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
});

export const rsvps = pgTable(
  "rsvps",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.eventId] }),
    // Attendee lists / RSVP counts per event (PK leads with user_id).
    index("rsvps_event_id_idx").on(t.eventId),
  ],
);

export const savedEvents = pgTable(
  "saved_events",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.eventId] }),
    // Per-event lookups and ON DELETE CASCADE from events.
    index("saved_events_event_id_idx").on(t.eventId),
  ],
);

export const friendships = pgTable(
  "friendships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: uuid("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.friendId] }),
    // Reverse direction: incoming requests / friends where I'm the recipient.
    index("friendships_friend_id_status_idx").on(t.friendId, t.status),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    payload: jsonb("payload").notNull(),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // The dropdown: a user's newest notifications first.
    index("notifications_user_id_created_at_idx").on(t.userId, t.createdAt.desc()),
  ],
);

export const pipelineLogStatusEnum = pgEnum("pipeline_log_status", [
  "success",
  "skipped_not_event",
  "duplicate",
  "error",
  "needs_review",
]);

export const listservConfigs = pgTable("listserv_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  address: varchar("address", { length: 255 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  orgId: uuid("org_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
  gmailLabel: varchar("gmail_label", { length: 255 }),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pipelineLogs = pgTable("pipeline_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  listservConfigId: uuid("listserv_config_id").references(() => listservConfigs.id, {
    onDelete: "set null",
  }),
  status: pipelineLogStatusEnum("status").notNull(),
  errorText: text("error_text"),
  extractedEventId: uuid("extracted_event_id").references(() => events.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Listserv email archive ───────────────────────────────

export const listservEmails = pgTable("listserv_emails", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull().unique(),
  listserv: varchar("listserv", { length: 100 }).notNull(),
  subject: text("subject").notNull(),
  authorName: varchar("author_name", { length: 255 }),
  authorEmail: varchar("author_email", { length: 255 }),
  date: timestamp("date", { withTimezone: true }),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  isHoagiemail: boolean("is_hoagiemail").default(false).notNull(),
  hoagiemailSenderName: varchar("hoagiemail_sender_name", { length: 255 }),
  hoagiemailSenderEmail: varchar("hoagiemail_sender_email", { length: 255 }),
  links: jsonb("links").default([]),
  images: jsonb("images").default([]),
  attachments: jsonb("attachments").default([]),
  listservUrl: text("listserv_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Integration state ────────────────────────────────────

/** Cursors and bookkeeping for background syncs (e.g. InboxEngine event revisions). */
export const syncState = pgTable("sync_state", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Recommendation / ML tables ────────────────────────────

export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull(),
    itemType: itemTypeEnum("item_type").default("event").notNull(),
    interactionType: interactionTypeEnum("interaction_type").notNull(),
    interactionValue: doublePrecision("interaction_value").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // A user's interaction history (recommendations / preference vectors).
    index("interactions_user_id_created_at_idx").on(t.userId, t.createdAt),
    // Per-event view counts for feed popularity (append-only, grows fastest).
    index("interactions_item_id_type_idx").on(t.itemId, t.interactionType),
  ],
);

export const userPreferenceVectors = pgTable("user_preference_vectors", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  tagWeights: jsonb("tag_weights").default({}).notNull(),
  latentVector: doublePrecision("latent_vector").array(),
  interactionCount: doublePrecision("interaction_count").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Relations ─────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  interests: many(userInterests),
  regions: many(userRegions),
  createdEvents: many(events),
  rsvps: many(rsvps),
  savedEvents: many(savedEvents),
  orgMemberships: many(orgMembers),
  orgFollows: many(orgFollowers),
  sentFriendRequests: many(friendships, { relationName: "sentRequests" }),
  receivedFriendRequests: many(friendships, {
    relationName: "receivedRequests",
  }),
  notifications: many(notifications),
}));

export const userInterestsRelations = relations(userInterests, ({ one }) => ({
  user: one(users, {
    fields: [userInterests.userId],
    references: [users.id],
  }),
}));

export const userRegionsRelations = relations(userRegions, ({ one }) => ({
  user: one(users, {
    fields: [userRegions.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  creator: one(users, {
    fields: [organizations.creatorId],
    references: [users.id],
  }),
  members: many(orgMembers),
  followers: many(orgFollowers),
  events: many(events),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org: one(organizations, {
    fields: [orgMembers.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [orgMembers.userId],
    references: [users.id],
  }),
}));

export const orgFollowersRelations = relations(orgFollowers, ({ one }) => ({
  org: one(organizations, {
    fields: [orgFollowers.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [orgFollowers.userId],
    references: [users.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  location: one(campusLocations, {
    fields: [events.locationId],
    references: [campusLocations.id],
  }),
  organization: one(organizations, {
    fields: [events.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [events.creatorId],
    references: [users.id],
  }),
  tags: many(eventTags),
  rsvps: many(rsvps),
  savedBy: many(savedEvents),
}));

export const eventTagsRelations = relations(eventTags, ({ one }) => ({
  event: one(events, {
    fields: [eventTags.eventId],
    references: [events.id],
  }),
}));

export const rsvpsRelations = relations(rsvps, ({ one }) => ({
  user: one(users, { fields: [rsvps.userId], references: [users.id] }),
  event: one(events, { fields: [rsvps.eventId], references: [events.id] }),
}));

export const savedEventsRelations = relations(savedEvents, ({ one }) => ({
  user: one(users, {
    fields: [savedEvents.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [savedEvents.eventId],
    references: [events.id],
  }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  user: one(users, {
    fields: [friendships.userId],
    references: [users.id],
    relationName: "sentRequests",
  }),
  friend: one(users, {
    fields: [friendships.friendId],
    references: [users.id],
    relationName: "receivedRequests",
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const listservConfigsRelations = relations(listservConfigs, ({ one }) => ({
  org: one(organizations, {
    fields: [listservConfigs.orgId],
    references: [organizations.id],
  }),
}));

export const pipelineLogsRelations = relations(pipelineLogs, ({ one }) => ({
  listservConfig: one(listservConfigs, {
    fields: [pipelineLogs.listservConfigId],
    references: [listservConfigs.id],
  }),
  extractedEvent: one(events, {
    fields: [pipelineLogs.extractedEventId],
    references: [events.id],
  }),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  user: one(users, {
    fields: [interactions.userId],
    references: [users.id],
  }),
}));

export const userPreferenceVectorsRelations = relations(userPreferenceVectors, ({ one }) => ({
  user: one(users, {
    fields: [userPreferenceVectors.userId],
    references: [users.id],
  }),
}));

// ── Type exports ──────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type CampusLocation = typeof campusLocations.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ListservConfig = typeof listservConfigs.$inferSelect;
export type NewListservConfig = typeof listservConfigs.$inferInsert;
export type PipelineLog = typeof pipelineLogs.$inferSelect;
export type NewPipelineLog = typeof pipelineLogs.$inferInsert;
export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;
export type UserPreferenceVector = typeof userPreferenceVectors.$inferSelect;
export type ListservEmail = typeof listservEmails.$inferSelect;
export type NewListservEmail = typeof listservEmails.$inferInsert;
