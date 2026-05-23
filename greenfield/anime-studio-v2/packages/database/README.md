# Database Package

当前提供绿地项目的第一版 Prisma 数据模型。

## 覆盖范围

- 项目
- 小说与章节
- 角色
- 集纲
- 分场
- 分镜
- 一致性问题

## 迁移建议

1. 配置 `DATABASE_URL`
2. 在本目录运行 `pnpm prisma migrate dev`
3. 生成 Prisma Client
4. 用 Prisma 仓储替换 `apps/api/src/store.ts`

