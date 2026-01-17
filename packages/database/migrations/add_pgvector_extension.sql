-- 启用 pgvector 扩展
-- 用于支持 V3.0 递归上下文注入算法的向量检索功能
CREATE EXTENSION IF NOT EXISTS vector;
