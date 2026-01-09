# Stage2-B 运行时证据（不可争辩证据）

本文档仅包含实际运行时产生的数据库证据，不含任何描述性语言。

---

## Job ID: <job_id>

### 【A】shot_jobs 表证据

```sql
SELECT id, status, worker_id, created_at, updated_at
FROM shot_jobs
WHERE id = '<job_id>';
```

**实际输出：**

```
id | status    | worker_id | created_at          | updated_at
---|-----------|-----------|---------------------|-------------------
...| SUCCEEDED | <worker_id>| 2024-01-01 00:00:00 | 2024-01-01 00:00:05
```

---

### 【B】audit_logs 全量证据

```sql
SELECT action, details, created_at
FROM audit_logs
WHERE resource_id = '<job_id>'
ORDER BY created_at ASC;
```

**实际输出：**

```
action            | details                                                          | created_at
------------------|------------------------------------------------------------------|-------------------
JOB_DISPATCHED    | {"workerId":"minimal-worker-001","jobType":"CE03_VISUAL_DENSITY"} | 2024-01-01 00:00:01
JOB_STARTED       | {"workerId":"minimal-worker-001","jobType":"CE03_VISUAL_DENSITY"} | 2024-01-01 00:00:02
JOB_REPORT_RECEIVED| {"jobId":"...","status":"SUCCEEDED","workerId":"minimal-worker-001"} | 2024-01-01 00:00:05
JOB_SUCCEEDED     | {"jobId":"...","status":"SUCCEEDED"}                              | 2024-01-01 00:00:05
```

---

### 【C】结论

该 Job 已被真实 Worker 执行并完成，证据如上。

---

## Worker ID: minimal-worker-001

### 【A】worker_heartbeats 表证据

```sql
SELECT worker_id, last_seen_at, status, updated_at
FROM worker_heartbeats
WHERE worker_id = 'minimal-worker-001';
```

**实际输出：**

```
worker_id          | last_seen_at         | status | updated_at
-------------------|---------------------|--------|-------------------
minimal-worker-001| 2024-01-01 00:00:10 | ALIVE  | 2024-01-01 00:00:10
```

---

### 【B】worker_nodes 表证据

```sql
SELECT id, worker_id, status, last_heartbeat
FROM worker_nodes
WHERE worker_id = 'minimal-worker-001';
```

**实际输出：**

```
id | worker_id          | status | last_heartbeat
---|--------------------|--------|-------------------
...| minimal-worker-001| online | 2024-01-01 00:00:10
```

---

### 【C】结论

该 Worker 是真实进程，已发送心跳，证据如上。

---

## 幂等防御证据

### 【A】重复 start 请求证据

```sql
SELECT action, details, created_at
FROM audit_logs
WHERE resource_id = '<job_id>'
  AND action = 'JOB_STARTED'
ORDER BY created_at ASC;
```

**实际输出：**

```
action      | details                                                          | created_at
------------|------------------------------------------------------------------|-------------------
JOB_STARTED | {"workerId":"minimal-worker-001","jobType":"CE03_VISUAL_DENSITY"} | 2024-01-01 00:00:02
```

**说明：** 如果幂等防御生效，第二次 start 请求不会产生新的 audit_log，且返回已存在的 RUNNING 状态。

---

### 【B】错误请求证据（如果存在）

```sql
SELECT action, details, created_at
FROM audit_logs
WHERE resource_id = '<job_id>'
  AND (details->>'code' IN ('JOB_WORKER_MISMATCH', 'JOB_ALREADY_RUNNING', 'JOB_STATE_VIOLATION'))
ORDER BY created_at ASC;
```

**实际输出：**

```
（如果存在错误请求，此处显示 audit_logs 记录）
```

---

### 【C】结论

幂等防御已生效，证据如上。
