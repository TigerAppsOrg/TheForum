CREATE INDEX "event_tags_tag_idx" ON "event_tags" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "events_published_datetime_idx" ON "events" USING btree ("datetime") WHERE "events"."status" = 'published';--> statement-breakpoint
CREATE INDEX "events_org_id_idx" ON "events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "events_creator_id_idx" ON "events" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "events_location_id_idx" ON "events" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "friendships_friend_id_status_idx" ON "friendships" USING btree ("friend_id","status");--> statement-breakpoint
CREATE INDEX "interactions_user_id_created_at_idx" ON "interactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "interactions_item_id_type_idx" ON "interactions" USING btree ("item_id","interaction_type");--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "org_followers_user_id_idx" ON "org_followers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "org_members_user_id_idx" ON "org_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rsvps_event_id_idx" ON "rsvps" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "saved_events_event_id_idx" ON "saved_events" USING btree ("event_id");