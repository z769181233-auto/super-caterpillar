-- 回滚 V3.0 向量列
-- 移除 novel_chapters 表的 summary_vector 列

ALTER TABLE novel_chapters DROP COLUMN IF EXISTS summary_vector;
