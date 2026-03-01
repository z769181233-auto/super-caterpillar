-- V3.0 增量对齐 P0-2: 向量检索能力
-- 为 novel_chapters 表添加 summary_vector 列，用于 long-term memory 相似章节检索
-- 字段命名严格遵守 V3.0 规范：summary_vector (snake_case)
-- 注意：由于 PostgreSQL 15 兼容性问题，暂不创建 HNSW 索引，改用降级策略

ALTER TABLE novel_chapters
ADD COLUMN IF NOT EXISTS summary_vector VECTOR(1536);

-- 添加字段说明
COMMENT ON COLUMN novel_chapters.summary_vector IS
'V3.0 向量检索: 章节摘要的 embedding (1536 维)，用于 long-term memory 相似章节检索。暂无索引，使用线性扫描或外部向量库。';
