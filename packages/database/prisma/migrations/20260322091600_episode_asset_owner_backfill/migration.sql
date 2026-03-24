UPDATE "assets" a
SET
  "ownerType" = 'EPISODE',
  "ownerId" = pv."episodeId"
FROM "published_videos" pv
WHERE a."id" = pv."assetId"
  AND a."ownerType" = 'SCENE'
  AND a."type" = 'VIDEO';
