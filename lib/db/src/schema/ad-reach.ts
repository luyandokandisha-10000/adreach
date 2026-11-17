import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("ad_reach_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["customer", "admin"] })
    .notNull()
    .default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const adsTable = pgTable("ad_reach_ads", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  email: text("email").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  link: text("link").notNull(),
  imagePath: text("image_path"),
  status: text("status", { enum: ["pending", "active", "rejected"] })
    .notNull()
    .default("pending"),
  planId: text("plan_id", { enum: ["free", "weekly", "monthly"] })
    .notNull()
    .default("free"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

export const subscriptionsTable = pgTable("ad_reach_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: text("plan_id", { enum: ["weekly", "monthly"] }).notNull(),
  status: text("status", {
    enum: ["payment_pending", "active", "canceled", "expired", "rejected"],
  })
    .notNull()
    .default("payment_pending"),
  amountK: integer("amount_k").notNull(),
  currency: text("currency").notNull().default("ZMK"),
  paymentStatus: text("payment_status", {
    enum: ["pending", "confirmed", "rejected", "mock_paid"],
  })
    .notNull()
    .default("pending"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  paymentReviewedAt: timestamp("payment_reviewed_at", { withTimezone: true }),
  paymentReviewNote: text("payment_review_note"),
});

export const distributionEventsTable = pgTable("ad_reach_distribution_events", {
  id: text("id").primaryKey(),
  adId: text("ad_id")
    .notNull()
    .references(() => adsTable.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  eventType: text("event_type", {
    enum: ["ad.submitted", "ad.approved", "ad.channel_post"],
  })
    .notNull(),
  status: text("status", {
    enum: [
      "queued",
      "ready",
      "processing",
      "manual_required",
      "needs_connection",
      "delivered",
      "failed",
    ],
  })
    .notNull()
    .default("queued"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});

export const socialAccountsTable = pgTable(
  "ad_reach_social_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    provider: text("provider", {
      enum: ["facebook_page", "instagram", "linkedin", "reddit"],
    }).notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    displayName: text("display_name").notNull(),
    profileUrl: text("profile_url").notNull(),
    accountType: text("account_type").notNull(),
    scopes: text("scopes").notNull().default(""),
    accessTokenCiphertext: text("access_token_ciphertext").notNull(),
    refreshTokenCiphertext: text("refresh_token_ciphertext"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    isBrandChannel: boolean("is_brand_channel").notNull().default(false),
    connectedAt: timestamp("connected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    accountUnique: uniqueIndex("ad_reach_social_account_unique").on(
      table.userId,
      table.provider,
      table.providerAccountId,
    ),
  }),
);

export const socialOAuthStatesTable = pgTable("ad_reach_social_oauth_states", {
  stateHash: text("state_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  provider: text("provider", {
    enum: ["facebook_page", "instagram", "linkedin", "reddit"],
  }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const imageUploadsTable = pgTable("ad_reach_image_uploads", {
  objectPath: text("object_path").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  contentType: text("content_type").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
