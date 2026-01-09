# Scene.projectId 数据迁移脚本

**生成时间**: 2025-12-11  
**目的**: 将 Scene.projectId 从可选改为必填，符合 DBSpec V1.1 规范

---

## 迁移步骤

### 1. 检查数据

首先检查是否存在 `projectId = null` 的记录：

```typescript
// scripts/migrate-scene-projectid.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkAndMigrate() {
  const scenesWithNullProjectId = await prisma.scene.count({
    where: { projectId: null },
  });

  console.log(`Scenes with null projectId: ${scenesWithNullProjectId}`);

  if (scenesWithNullProjectId === 0) {
    console.log('No migration needed, all scenes have projectId');
    return;
  }

  // 执行迁移
  const scenes = await prisma.scene.findMany({
    where: { projectId: null },
    include: {
      episode: {
        include: {
          project: true,
          season: {
            include: {
              project: true,
            },
          },
        },
      },
    },
  });

  for (const scene of scenes) {
    const projectId = scene.episode?.projectId || scene.episode?.season?.projectId;
    if (projectId) {
      await prisma.scene.update({
        where: { id: scene.id },
        data: { projectId },
      });
      console.log(`Updated scene ${scene.id} with projectId ${projectId}`);
    } else {
      console.error(`Scene ${scene.id} cannot derive projectId, manual intervention needed`);
    }
  }

  await prisma.$disconnect();
}

checkAndMigrate();
```

### 2. 修改 Schema

如果所有 Scene 都能关联到 Project，则将 Schema 修改为：

```prisma
model Scene {
  // ...
  projectId String  // 改为必填
  project   Project @relation("SceneProject", fields: [projectId], references: [id])
  // ...
}
```

### 3. 运行迁移

```bash
pnpm --filter @scu/database prisma migrate dev --name make_scene_projectid_required
```

---

**注意**: 如果存在无法推导 projectId 的 Scene，需要手动处理或删除这些记录。
