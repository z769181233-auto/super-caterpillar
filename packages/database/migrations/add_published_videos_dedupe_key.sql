ALTER TABLE published_videos
ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS published_videos_dedupe_key_uq
ON published_videos (dedupe_key)
WHERE dedupe_key IS NOT NULL;
