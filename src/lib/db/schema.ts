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
  // ADR-0004: 데모 시점은 서버가 기억하지 않는다 — 클라이언트가 조회 인자로 넘긴다.
  llmCallCount: integer("llm_call_count").notNull().default(0),
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
  // ADR-0004: status/observed_value는 fundamental|qualitative 전제에만 의미가 있다.
  // price|valuation 전제는 저장된 값을 무시하고 조회 시 시세로 계산한다.
  status: text("status").notNull(), // intact | broken | pending | manual
  observedValue: text("observed_value"),
});

// KIS OAuth 접근토큰 — 인스턴스 메모리 대신 여기 영속화해 서버리스 콜드 스타트/
// 인스턴스 교체 사이에도 재사용한다(issue #59). key는 "quote"|"trade" — quote-client/
// trade-client의 자격증명 분리를 그대로 반영한다. refreshingSince는 발급 요청이
// KIS 분당 1회 제한에 동시에 걸리지 않도록 인스턴스 간 발급을 직렬화하는 데 쓴다.
export const kisTokens = pgTable("kis_tokens", {
  key: text("key").primaryKey(), // "quote" | "trade"
  accessToken: text("access_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  refreshingSince: timestamp("refreshing_since", { withTimezone: true }),
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
