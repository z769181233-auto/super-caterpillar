-- 五层实体表最小计数/关联完整性抽检

-- 1. 项目计数
SELECT 'projects' as table_name, COUNT(*) as count FROM projects;

-- 2. Season 计数及关联检查
SELECT 
  'seasons' as table_name,
  COUNT(*) as count,
  COUNT(DISTINCT "projectId") as unique_projects
FROM seasons;

-- 3. Episode 计数及关联检查
SELECT 
  'episodes' as table_name,
  COUNT(*) as count,
  COUNT(DISTINCT "seasonId") as unique_seasons,
  COUNT(DISTINCT "projectId") as unique_projects
FROM episodes;

-- 4. Scene 计数及关联检查
SELECT 
  'scenes' as table_name,
  COUNT(*) as count,
  COUNT(DISTINCT "episodeId") as unique_episodes
FROM scenes;

-- 5. Shot 计数及关联检查
SELECT 
  'shots' as table_name,
  COUNT(*) as count,
  COUNT(DISTINCT "sceneId") as unique_scenes
FROM shots;

-- 6. 关联完整性检查（查找孤立记录）
SELECT 
  'orphaned_seasons' as check_type,
  COUNT(*) as count
FROM seasons s
LEFT JOIN projects p ON s."projectId" = p.id
WHERE p.id IS NULL;

SELECT 
  'orphaned_episodes' as check_type,
  COUNT(*) as count
FROM episodes e
LEFT JOIN seasons s ON e."seasonId" = s.id
WHERE s.id IS NULL;

SELECT 
  'orphaned_scenes' as check_type,
  COUNT(*) as count
FROM scenes sc
LEFT JOIN episodes e ON sc."episodeId" = e.id
WHERE e.id IS NULL;

SELECT 
  'orphaned_shots' as check_type,
  COUNT(*) as count
FROM shots sh
LEFT JOIN scenes sc ON sh."sceneId" = sc.id
WHERE sc.id IS NULL;

