ALTER TABLE "watchlist_items" ADD COLUMN "added_price" numeric;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "added_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "avg_buy_price" numeric;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "bought_at" timestamp with time zone;