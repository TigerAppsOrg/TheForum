CREATE INDEX "organizations_name_id_idx" ON "organizations" USING btree ("name","id");--> statement-breakpoint
CREATE INDEX "organizations_members_id_idx" ON "organizations" USING btree (coalesce("member_count", '-2147483649'::bigint) desc nulls last,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organizations_created_at_id_idx" ON "organizations" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organizations_category_name_id_idx" ON "organizations" USING btree ("category","name","id");--> statement-breakpoint
CREATE INDEX "organizations_category_members_id_idx" ON "organizations" USING btree ("category",coalesce("member_count", '-2147483649'::bigint) desc nulls last,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organizations_category_created_at_id_idx" ON "organizations" USING btree ("category","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);