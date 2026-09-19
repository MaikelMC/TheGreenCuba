CREATE TABLE "business_owners" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"place_id" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	CONSTRAINT "business_owners_user_place_unique" UNIQUE("user_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text,
	"email" text NOT NULL,
	"name" text,
	"image_url" text,
	"location_city" text,
	"location_lat" double precision,
	"location_lng" double precision,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"preferences" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"short_description" text,
	"category_id" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"address" text,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"neighborhood" text,
	"phone" text,
	"website" text,
	"hours_json" jsonb,
	"payment_methods" text[],
	"currencies" text[],
	"price_level" integer DEFAULT 1,
	"vibe" text[],
	"tags" text[],
	"features" jsonb,
	"image_urls" text[],
	"embedding" vector(1024),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_boosted" boolean DEFAULT false NOT NULL,
	"boost_expires_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "places_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "place_images" (
	"id" text PRIMARY KEY NOT NULL,
	"place_id" text NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"width" integer,
	"height" integer,
	"is_cover" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"place_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" time,
	"close_time" time,
	"is_closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "place_hours_place_day_unique" UNIQUE("place_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE "place_menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"place_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" double precision,
	"currency" text DEFAULT 'MLC',
	"image_url" text,
	"tag" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"place_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"content" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_place_user_unique" UNIQUE("place_id","user_id"),
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "saved_places" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"place_id" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_places_user_place_unique" UNIQUE("user_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "user_search_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"query" text NOT NULL,
	"type" text DEFAULT 'natural_language' NOT NULL,
	"results_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_owners" ADD CONSTRAINT "business_owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_owners" ADD CONSTRAINT "business_owners_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_images" ADD CONSTRAINT "place_images_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hours" ADD CONSTRAINT "place_hours_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_menu_items" ADD CONSTRAINT "place_menu_items_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_search_history" ADD CONSTRAINT "user_search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_owners_user_idx" ON "business_owners" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "business_owners_place_idx" ON "business_owners" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "users_clerk_id_idx" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "places_slug_idx" ON "places" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "places_category_idx" ON "places" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "places_city_idx" ON "places" USING btree ("city");--> statement-breakpoint
CREATE INDEX "places_coords_idx" ON "places" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "places_active_idx" ON "places" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "places_boosted_idx" ON "places" USING btree ("is_boosted");--> statement-breakpoint
CREATE INDEX "places_embedding_idx" ON "places" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "place_images_place_idx" ON "place_images" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "place_images_cover_idx" ON "place_images" USING btree ("place_id","is_cover");--> statement-breakpoint
CREATE INDEX "place_hours_place_idx" ON "place_hours" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "menu_items_place_idx" ON "place_menu_items" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "menu_items_active_idx" ON "place_menu_items" USING btree ("place_id","is_active");--> statement-breakpoint
CREATE INDEX "reviews_place_idx" ON "reviews" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "reviews_user_idx" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_places_user_idx" ON "saved_places" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_places_place_idx" ON "saved_places" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "search_history_user_idx" ON "user_search_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_history_user_created_idx" ON "user_search_history" USING btree ("user_id","created_at");