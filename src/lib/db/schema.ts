import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  demoOffsetDays: integer("demo_offset_days").notNull().default(0),
});

export const watchlistItems = pgTable("watchlist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(), // watching | bought | removed
  addedPrice: numeric("added_price"), // 담은 시점 가격 (근거 유효성 기준)
  addedAt: timestamp("added_at", { withTimezone: true }),
  avgBuyPrice: numeric("avg_buy_price"), // 매수 단가 (손익 기준). status=bought일 때만
  boughtAt: timestamp("bought_at", { withTimezone: true }),
  isSeed: boolean("is_seed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const theses = pgTable("theses", {
  id: uuid("id").primaryKey().defaultRandom(),
  watchlistItemId: uuid("watchlist_item_id")
    .notNull()
    .references(() => watchlistItems.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  category: text("category").notNull(), // fundamental|undervalued|theme|dividend|technical|recommended|gut
  followup: jsonb("followup"),
  freeText: text("free_text"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const critiques = pgTable("critiques", {
  id: uuid("id").primaryKey().defaultRandom(),
  thesisId: uuid("thesis_id")
    .notNull()
    .references(() => theses.id, { onDelete: "cascade" }),
  isChallengeable: boolean("is_challengeable").notNull(),
  counterpoints: jsonb("counterpoints"), // [{point, severity, basis}]
  openQuestions: jsonb("open_questions"),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const premises = pgTable("premises", {
  id: uuid("id").primaryKey().defaultRandom(),
  thesisId: uuid("thesis_id")
    .notNull()
    .references(() => theses.id, { onDelete: "cascade" }),
  statement: text("statement").notNull(),
  checkType: text("check_type").notNull(), // price | valuation | fundamental | qualitative
  checkConfig: jsonb("check_config"), // {metric, operator, value, period}
  status: text("status").notNull(), // intact | broken | pending | manual
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  brokenAt: timestamp("broken_at", { withTimezone: true }),
  observedValue: text("observed_value"),
});

export const orderEvents = pgTable("order_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  watchlistItemId: uuid("watchlist_item_id")
    .notNull()
    .references(() => watchlistItems.id, { onDelete: "cascade" }),
  thesisShown: boolean("thesis_shown").notNull(),
  initialQty: integer("initial_qty").notNull(),
  finalQty: integer("final_qty").notNull(),
  action: text("action").notNull(), // proceed | adjust | cancel | update_thesis
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
