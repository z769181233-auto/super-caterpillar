# Stage1 审计日志覆盖的六大场景检查

**生成时间**: 2025-12-11  
**审计范围**: 所有 Controller 的审计日志覆盖情况  
**审计模式**: 只读审计，不修改代码

---

## 摘要

本文档检查六大审计场景的覆盖率，逐 Controller 验证是否全部落库、是否包含 nonce/signature/timestamp、是否包含 resourceType/resourceId。

**六大场景**:

1. 登录 / 登出
2. 用户资料操作
3. 权限变更（RolePermission）
4. Project / Episode / Scene / Shot CRUD
5. Worker / Job 报告链路
6. HMAC 错误/签名失败/重放攻击

---

## 场景 1: 登录 / 登出

### 1.1 登录（Login）

**Controller**: `apps/api/src/auth/auth.controller.ts`

**方法**: `login()`

**审计状态**: ✅ **已覆盖**

**审计实现**:

```typescript
@Post('login')
@Public()
@UseInterceptors(AuditInterceptor)
@AuditAction(AuditActions.LOGIN)
async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
  // ...
}
```

**审计字段检查**:

- ✅ `action`: `AuditActions.LOGIN`
- ✅ `resourceType`: 通过 AuditInterceptor 自动设置（应为 `auth`）
- ✅ `resourceId`: 通过 AuditInterceptor 自动设置（应为 `userId`）
- ⚠️ `nonce`: 登录接口为公开接口，不使用 HMAC，无 nonce
- ⚠️ `signature`: 登录接口为公开接口，不使用 HMAC，无 signature
- ⚠️ `timestamp`: 登录接口为公开接口，不使用 HMAC，无 timestamp
- ✅ `ip`: 通过 AuditInterceptor 自动提取
- ✅ `userAgent`: 通过 AuditInterceptor 自动提取

**结论**: ✅ **已覆盖**，但登录接口不使用 HMAC，因此无 nonce/signature/timestamp（符合规范）。

---

### 1.2 登出（Logout）

**Controller**: `apps/api/src/auth/auth.controller.ts`

**方法**: `logout()`

**审计状态**: ✅ **已覆盖**

**审计实现**:

```typescript
@Post('logout')
@UseInterceptors(AuditInterceptor)
@AuditAction(AuditActions.LOGOUT)
async logout(@Res({ passthrough: true }) res: Response) {
  // ...
}
```

**审计字段检查**:

- ✅ `action`: `AuditActions.LOGOUT`
- ✅ `resourceType`: 通过 AuditInterceptor 自动设置（应为 `auth`）
- ✅ `resourceId`: 通过 AuditInterceptor 自动设置（应为 `userId`）
- ⚠️ `nonce`: 登出接口使用 JWT，不使用 HMAC，无 nonce
- ⚠️ `signature`: 登出接口使用 JWT，不使用 HMAC，无 signature
- ⚠️ `timestamp`: 登出接口使用 JWT，不使用 HMAC，无 timestamp
- ✅ `ip`: 通过 AuditInterceptor 自动提取
- ✅ `userAgent`: 通过 AuditInterceptor 自动提取

**结论**: ✅ **已覆盖**，但登出接口不使用 HMAC，因此无 nonce/signature/timestamp（符合规范）。

---

### 1.3 注册（Register）

**Controller**: `apps/api/src/auth/auth.controller.ts`

**方法**: `register()`

**审计状态**: ✅ **已覆盖**

**审计实现**:

```typescript
@Post('register')
@Public()
@UseInterceptors(AuditInterceptor)
@AuditAction(AuditActions.LOGIN) // 注册也视为一次登录入口
async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
  // ...
}
```

**审计字段检查**: 同登录接口

**结论**: ✅ **已覆盖**

---

## 场景 2: 用户资料操作

### 2.1 获取当前用户（Get Current User）

**Controller**: `apps/api/src/user/user.controller.ts`

**方法**: `getCurrentUser()`

**审计状态**: ⚠️ **未覆盖**

**审计实现**: 无审计日志记录

**建议**: P2（读取操作，可选审计）

---

### 2.2 切换组织（Switch Organization）

**Controller**: `apps/api/src/user/user.controller.ts` / `apps/api/src/organization/organization.controller.ts`

**方法**: `switchOrganization()`

**审计状态**: ⚠️ **未覆盖**

**审计实现**: 无审计日志记录

**建议**: **P1（重要操作，应审计）**

---

### 2.3 获取配额（Get Quota）

**Controller**: `apps/api/src/user/user.controller.ts`

**方法**: `getQuota()`

**审计状态**: ⚠️ **未覆盖**

**审计实现**: 无审计日志记录

**建议**: P2（读取操作，可选审计）

---

## 场景 3: 权限变更（RolePermission）

### 3.1 权限变更操作

**Controller**: 未找到专门的权限管理 Controller

**审计状态**: ⚠️ **未覆盖**

**审计实现**: 无审计日志记录

**建议**: **P1（重要操作，应审计）**

**需要检查**:

- Role 创建/更新/删除
- Permission 创建/更新/删除
- RolePermission 关联/解除关联

---

## 场景 4: Project / Episode / Scene / Shot CRUD

### 4.1 Project CRUD

**Controller**: `apps/api/src/project/project.controller.ts`

**方法**:

- `createProject()` ✅
- `updateProject()` ✅
- `deleteProject()` ✅

**审计状态**: ✅ **已覆盖**

**审计实现**:

```typescript
@Post()
@UseInterceptors(AuditInterceptor)
@AuditAction(AuditActions.PROJECT_CREATE)
async createProject(...) { ... }

@Patch(':id')
@UseInterceptors(AuditInterceptor)
@AuditAction(AuditActions.PROJECT_UPDATE)
async updateProject(...) { ... }

@Delete(':id')
@UseInterceptors(AuditInterceptor)
@AuditAction(AuditActions.PROJECT_DELETE)
async deleteProject(...) { ... }
```

**审计字段检查**:

- ✅ `action`: `PROJECT_CREATE` / `PROJECT_UPDATE` / `PROJECT_DELETE`
- ✅ `resourceType`: 通过 AuditInterceptor 自动设置（应为 `project`）
- ✅ `resourceId`: 通过 AuditInterceptor 自动设置（应为 `projectId`）
- ⚠️ `nonce`: Project CRUD 使用 JWT，不使用 HMAC，无 nonce
- ⚠️ `signature`: Project CRUD 使用 JWT，不使用 HMAC，无 signature
- ⚠️ `timestamp`: Project CRUD 使用 JWT，不使用 HMAC，无 timestamp
- ✅ `ip`: 通过 AuditInterceptor 自动提取
- ✅ `userAgent`: 通过 AuditInterceptor 自动提取

**结论**: ✅ **已覆盖**

---

### 4.2 Episode CRUD

**Controller**: `apps/api/src/project/project.controller.ts`

**方法**:

- `createEpisode()` ✅
- `updateEpisode()` ⚠️ 未找到
- `deleteEpisode()` ⚠️ 未找到

**审计状态**: ⚠️ **部分覆盖**

**审计实现**:

```typescript
@Post(':projectId/episodes')
@UseInterceptors(AuditInterceptor)
@AuditAction(AuditActions.EPISODE_CREATE)
async createEpisode(...) {
  // 显式记录审计日志
  await this.auditLogService.record({
    userId: user.userId,
    action: AuditActions.EPISODE_CREATE,
    resourceType: 'episode',
    resourceId: episode.id,
    ip: requestInfo.ip,
    userAgent: requestInfo.userAgent,
    details: { projectId, episodeIndex: episode.index },
  }).catch(() => undefined);
}
```

**审计字段检查**:

- ✅ `action`: `EPISODE_CREATE`
- ✅ `resourceType`: `episode`
- ✅ `resourceId`: `episode.id`
- ⚠️ `nonce`: Episode CRUD 使用 JWT，不使用 HMAC，无 nonce
- ⚠️ `signature`: Episode CRUD 使用 JWT，不使用 HMAC，无 signature
- ⚠️ `timestamp`: Episode CRUD 使用 JWT，不使用 HMAC，无 timestamp
- ✅ `ip`: 已提取
- ✅ `userAgent`: 已提取

**缺失操作**:

- ⚠️ `updateEpisode()`: 未找到方法
- ⚠️ `deleteEpisode()`: 未找到方法

**结论**: ⚠️ **部分覆盖**（仅 CREATE 已覆盖）

---

### 4.3 Scene CRUD

**Controller**: `apps/api/src/project/project.controller.ts`

**方法**:

- `createScene()` ✅
- `updateScene()` ✅
- `deleteScene()` ⚠️ 未找到

**审计状态**: ⚠️ **部分覆盖**

**审计实现**:

```typescript
@Post('episodes/:episodeId/scenes')
@UseInterceptors(AuditInterceptor)
@AuditAction(AuditActions.SCENE_CREATE)
async createScene(...) {
  // 显式记录审计日志
  await this.auditLogService.record({
    userId: user.userId,
    action: AuditActions.SCENE_CREATE,
    resourceType: 'scene',
    resourceId: scene.id,
    ip: requestInfo.ip,
    userAgent: requestInfo.userAgent,
    details: { episodeId, sceneIndex: scene.index },
  }).catch(() => undefined);
}

@Patch('scenes/:id')
@UseInterceptors(AuditInterceptor)
@AuditAction(AuditActions.SCENE_UPDATE)
async updateScene(...) {
  // 显式记录审计日志
  await this.auditLogService.record({
    userId: user.userId,
    action: AuditActions.SCENE_UPDATE,
    resourceType: 'scene',
    resourceId: id,
    ip: requestInfo.ip,
    userAgent: requestInfo.userAgent,
    details: { sceneIndex: scene.index },
  }).catch(() => undefined);
}
```

**审计字段检查**: 同 Episode CRUD

**缺失操作**:

- ⚠️ `deleteScene()`: 未找到方法

**结论**: ⚠️ **部分覆盖**（CREATE 和 UPDATE 已覆盖）

---

### 4.4 Shot CRUD

**Controller**: `apps/api/src/project/project.controller.ts`

**方法**:

- `createShot()` ✅
- `updateShot()` ✅
- `deleteShot()` ⚠️ 未找到

**审计状态**: ⚠️ **部分覆盖**

**审计实现**:

```typescript
@Post('scenes/:sceneId/shots')
@UseInterceptors(AuditInterceptor)
@AuditAction(AuditActions.SHOT_CREATE)
async createShot(...) {
  // 显式记录审计日志
  await this.auditLogService.record({
    userId: user.userId,
    action: AuditActions.SHOT_CREATE,
    resourceType: 'shot',
    resourceId: shot.id,
    ip: requestInfo.ip,
    userAgent: requestInfo.userAgent,
    details: { sceneId, shotIndex: shot.index },
  }).catch(() => undefined);
}

@Patch('shots/:id')
@UseInterceptors(AuditInterceptor)
@AuditAction(AuditActions.SHOT_UPDATE)
async updateShot(...) {
  // 显式记录审计日志
  await this.auditLogService.record({
    userId: user.userId,
    action: AuditActions.SHOT_UPDATE,
    resourceType: 'shot',
    resourceId: id,
    ip: requestInfo.ip,
    userAgent: requestInfo.userAgent,
    details: { shotIndex: shot.index },
  }).catch(() => undefined);
}
```

**审计字段检查**: 同 Episode CRUD

**缺失操作**:

- ⚠️ `deleteShot()`: 未找到方法

**结论**: ⚠️ **部分覆盖**（CREATE 和 UPDATE 已覆盖）

---

## 场景 5: Worker / Job 报告链路

### 5.1 Worker 获取下一个 Job

**Controller**: `apps/api/src/worker/worker.controller.ts`

**方法**: `getNextJob()`

**审计状态**: ✅ **已覆盖**

**审计实现**:

```typescript
@Post(':workerId/jobs/next')
async getNextJob(...) {
  // 记录审计日志
  await this.auditLogService.record({
    userId: user?.userId,
    apiKeyId,
    action: 'JOB_STARTED',
    resourceType: 'job',
    resourceId: job.id,
    ip: requestInfo.ip,
    userAgent: requestInfo.userAgent,
    nonce,
    signature,
    timestamp: hmacTimestamp ? new Date(Number(hmacTimestamp)) : undefined,
    details: {
      workerId,
      taskId: job.taskId,
      type: job.type,
    },
  });
}
```

**审计字段检查**:

- ✅ `action`: `JOB_STARTED`
- ✅ `resourceType`: `job`
- ✅ `resourceId`: `job.id`
- ✅ `nonce`: 已提取（HMAC 请求）
- ✅ `signature`: 已提取（HMAC 请求）
- ✅ `timestamp`: 已提取（HMAC 请求）
- ✅ `ip`: 已提取
- ✅ `userAgent`: 已提取
- ✅ `apiKeyId`: 已提取（HMAC 请求）

**结论**: ✅ **已覆盖**，包含完整的 nonce/signature/timestamp

---

### 5.2 Job 回报告

**Controller**: `apps/api/src/job/job.controller.ts`

**方法**: `reportJob()`

**审计状态**: ✅ **已覆盖**

**审计实现**:

```typescript
@Post('jobs/:id/report')
@UseGuards(JwtOrHmacGuard)
async reportJob(...) {
  const result = await this.jobService.reportJobResult(
    jobId,
    reportDto.status,
    reportDto.result,
    reportDto.errorMessage,
    user?.userId,
    apiKeyId,
    requestInfo.ip,
    requestInfo.userAgent,
    {
      nonce,
      signature,
      hmacTimestamp,
    },
  );
  // JobService 内部记录审计日志
}
```

**审计字段检查**:

- ✅ `action`: `JOB_SUCCEEDED` / `JOB_FAILED` / `JOB_RETRYING`
- ✅ `resourceType`: `job`
- ✅ `resourceId`: `jobId`
- ✅ `nonce`: 已提取（HMAC 请求）
- ✅ `signature`: 已提取（HMAC 请求）
- ✅ `timestamp`: 已提取（HMAC 请求）
- ✅ `ip`: 已提取
- ✅ `userAgent`: 已提取
- ✅ `apiKeyId`: 已提取（HMAC 请求）

**结论**: ✅ **已覆盖**，包含完整的 nonce/signature/timestamp

---

## 场景 6: HMAC 错误/签名失败/重放攻击

### 6.1 HMAC 签名失败

**Guard**: `apps/api/src/auth/hmac/hmac-auth.guard.ts`

**方法**: `canActivate()`

**审计状态**: ✅ **已覆盖**

**审计实现**:

```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  try {
    const keyRecord = await this.hmacAuthService.verifySignature(...);
    return true;
  } catch (error: any) {
    // 写审计：签名失败
    await this.auditLogService.record({
      apiKeyId: undefined,
      action: AuditActions.SECURITY_EVENT,
      resourceType: 'api_security',
      resourceId: apiKey,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      nonce,
      signature,
      timestamp: new Date(),
      details: {
        reason: 'HMAC_AUTH_FAILED',
        path,
        method,
        message: error?.response?.error?.message || error?.message,
        code: error?.response?.error?.code || '4003',
      },
    }).catch(() => undefined);
    throw error;
  }
}
```

**审计字段检查**:

- ✅ `action`: `SECURITY_EVENT`
- ✅ `resourceType`: `api_security`
- ✅ `resourceId`: `apiKey`
- ✅ `nonce`: 已记录
- ✅ `signature`: 已记录
- ✅ `timestamp`: 已记录
- ✅ `ip`: 已提取
- ✅ `userAgent`: 已提取
- ✅ `details`: 包含失败原因、路径、方法、错误码

**结论**: ✅ **已覆盖**，包含完整的 nonce/signature/timestamp

---

### 6.2 Nonce 重放攻击

**Service**: `apps/api/src/auth/hmac/hmac-auth.service.ts`

**方法**: `verifySignature()`

**审计状态**: ✅ **已覆盖**

**审计实现**:

```typescript
const nonceSaved = await this.saveNonce(nonceKey, timestampNum);
if (!nonceSaved) {
  await this.writeAudit(
    apiKey,
    AuditActions.SECURITY_EVENT,
    'api_security',
    {
      reason: 'HMAC_NONCE_REPLAY',
      path: debug?.path,
      method: debug?.method,
      nonce,
    },
    debug
  );
  throw this.buildHmacError('4004', 'Nonce 已被使用，请重新生成请求', debug);
}
```

**审计字段检查**:

- ✅ `action`: `SECURITY_EVENT`
- ✅ `resourceType`: `api_security`
- ✅ `resourceId`: `apiKey`
- ✅ `nonce`: 已记录
- ✅ `signature`: 已记录（在 writeAudit 中）
- ✅ `timestamp`: 已记录（在 writeAudit 中）
- ✅ `ip`: 已提取
- ✅ `userAgent`: 已提取
- ✅ `details`: 包含重放原因、路径、方法

**结论**: ✅ **已覆盖**，包含完整的 nonce/signature/timestamp

---

### 6.3 签名验证失败

**Service**: `apps/api/src/auth/hmac/hmac-auth.service.ts`

**方法**: `verifySignature()`

**审计状态**: ✅ **已覆盖**

**审计实现**:

```typescript
if (signature !== expectedSignature) {
  await this.writeAudit(
    apiKey,
    AuditActions.SECURITY_EVENT,
    'api_security',
    {
      reason: 'HMAC_SIGNATURE_MISMATCH',
      path: debug?.path,
      method: debug?.method,
      nonce,
      timestamp,
    },
    debug
  );
  throw this.buildHmacError('4003', '签名验证失败', debug);
}
```

**审计字段检查**: 同 Nonce 重放攻击

**结论**: ✅ **已覆盖**，包含完整的 nonce/signature/timestamp

---

## 总结

### 覆盖率统计

| 场景                               | 子场景          | 状态        | 覆盖率                |
| ---------------------------------- | --------------- | ----------- | --------------------- |
| 1. 登录/登出                       | 登录            | ✅ 已覆盖   | 100%                  |
|                                    | 登出            | ✅ 已覆盖   | 100%                  |
|                                    | 注册            | ✅ 已覆盖   | 100%                  |
| 2. 用户资料操作                    | 获取当前用户    | ⚠️ 未覆盖   | 0%                    |
|                                    | 切换组织        | ⚠️ 未覆盖   | 0%                    |
|                                    | 获取配额        | ⚠️ 未覆盖   | 0%                    |
| 3. 权限变更                        | 所有权限操作    | ⚠️ 未覆盖   | 0%                    |
| 4. Project/Episode/Scene/Shot CRUD | Project CRUD    | ✅ 已覆盖   | 100%                  |
|                                    | Episode CRUD    | ⚠️ 部分覆盖 | 33% (仅 CREATE)       |
|                                    | Scene CRUD      | ⚠️ 部分覆盖 | 67% (CREATE + UPDATE) |
|                                    | Shot CRUD       | ⚠️ 部分覆盖 | 67% (CREATE + UPDATE) |
| 5. Worker/Job 报告链路             | Worker 获取 Job | ✅ 已覆盖   | 100%                  |
|                                    | Job 回报告      | ✅ 已覆盖   | 100%                  |
| 6. HMAC 错误/签名失败/重放攻击     | 签名失败        | ✅ 已覆盖   | 100%                  |
|                                    | Nonce 重放      | ✅ 已覆盖   | 100%                  |
|                                    | 签名验证失败    | ✅ 已覆盖   | 100%                  |

### 总体覆盖率

- **已完全覆盖**: 6 个子场景（登录/登出/注册、Project CRUD、Worker/Job 报告、HMAC 错误）
- **部分覆盖**: 3 个子场景（Episode/Scene/Shot CRUD）
- **未覆盖**: 4 个子场景（用户资料操作、权限变更）

**总体覆盖率**: 约 **65%**

---

## 缺失审计项清单

### P1 级（必须修复）

1. **切换组织操作**: `OrganizationController.switchOrganization()` / `UserController.switchOrganization()`
2. **权限变更操作**: Role/Permission/RolePermission 的创建/更新/删除
3. **Episode DELETE**: `ProjectController.deleteEpisode()`（如果存在）
4. **Scene DELETE**: `ProjectController.deleteScene()`（如果存在）
5. **Shot DELETE**: `ProjectController.deleteShot()`（如果存在）

### P2 级（可选修复）

1. **获取当前用户**: `UserController.getCurrentUser()`
2. **获取配额**: `UserController.getQuota()`
3. **Episode UPDATE**: `ProjectController.updateEpisode()`（如果存在）

---

## 审计字段完整性检查

### 已覆盖场景的字段完整性

| 场景                    | action | resourceType | resourceId | nonce     | signature | timestamp | ip  | userAgent |
| ----------------------- | ------ | ------------ | ---------- | --------- | --------- | --------- | --- | --------- |
| 登录/登出               | ✅     | ✅           | ✅         | ⚠️ (JWT)  | ⚠️ (JWT)  | ⚠️ (JWT)  | ✅  | ✅        |
| Project CRUD            | ✅     | ✅           | ✅         | ⚠️ (JWT)  | ⚠️ (JWT)  | ⚠️ (JWT)  | ✅  | ✅        |
| Episode/Scene/Shot CRUD | ✅     | ✅           | ✅         | ⚠️ (JWT)  | ⚠️ (JWT)  | ⚠️ (JWT)  | ✅  | ✅        |
| Worker/Job 报告         | ✅     | ✅           | ✅         | ✅ (HMAC) | ✅ (HMAC) | ✅ (HMAC) | ✅  | ✅        |
| HMAC 错误               | ✅     | ✅           | ✅         | ✅        | ✅        | ✅        | ✅  | ✅        |

**说明**:

- JWT 认证的接口不使用 HMAC，因此无 nonce/signature/timestamp（符合规范）
- HMAC 认证的接口必须包含 nonce/signature/timestamp（已完整实现）

---

**文档状态**: ✅ 审计完成，待下一批次修复
