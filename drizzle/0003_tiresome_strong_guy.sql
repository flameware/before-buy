CREATE TABLE "kis_tokens" (
	"key" text PRIMARY KEY NOT NULL,
	"access_token" text,
	"expires_at" timestamp with time zone,
	"refreshing_since" timestamp with time zone
);
