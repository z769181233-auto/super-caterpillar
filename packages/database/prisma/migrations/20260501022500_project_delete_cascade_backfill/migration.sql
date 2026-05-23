ALTER TABLE "novel_sources" DROP CONSTRAINT IF EXISTS "novel_sources_projectId_fkey";
ALTER TABLE "novel_sources"
  ADD CONSTRAINT "novel_sources_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "billing_events" DROP CONSTRAINT IF EXISTS "billing_events_project_id_fkey";
ALTER TABLE "billing_events"
  ADD CONSTRAINT "billing_events_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "characters" DROP CONSTRAINT IF EXISTS "characters_project_id_fkey";
ALTER TABLE "characters"
  ADD CONSTRAINT "characters_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "locations" DROP CONSTRAINT IF EXISTS "locations_project_id_fkey";
ALTER TABLE "locations"
  ADD CONSTRAINT "locations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "props" DROP CONSTRAINT IF EXISTS "props_project_id_fkey";
ALTER TABLE "props"
  ADD CONSTRAINT "props_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "outfits" DROP CONSTRAINT IF EXISTS "outfits_project_id_fkey";
ALTER TABLE "outfits"
  ADD CONSTRAINT "outfits_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "script_builds" DROP CONSTRAINT IF EXISTS "script_builds_project_id_fkey";
ALTER TABLE "script_builds"
  ADD CONSTRAINT "script_builds_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
