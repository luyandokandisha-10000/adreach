import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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
  status: text("status", { enum: ["active", "canceled", "expired"] })
    .notNull()
    .default("active"),
  amountK: integer("amount_k").notNull(),
  currency: text("currency").notNull().default("ZMK"),
  paymentStatus: text("payment_status", { enum: ["mock_paid"] })
    .notNull()
    .default("mock_paid"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
});

export const distributionEventsTable = pgTable("ad_reach_distribution_events", {
  id: text("id").primaryKey(),
  adId: text("ad_id")
    .notNull()
    .references(() => adsTable.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  eventType: text("event_type", { enum: ["ad.submitted", "ad.approved"] })
    .notNull(),
  status: text("status", {
    enum: ["queued", "ready", "delivered", "failed"],
  })
    .notNull()
    .default("queued"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
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
