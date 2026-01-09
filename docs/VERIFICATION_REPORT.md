## Health Check 结果

**/health/ready 返回 JSON**:

```json
{
  "ok": true,
  "status": "ready",
  "checks": {
    "database": true,
    "redis": true
  },
  "ts": "2025-12-20T02:03:38.531Z"
}
```

**所有端点结果**:

```json
[
  {
    "endpoint": "/health/ready",
    "status": 200,
    "response": {
      "ok": true,
      "status": "ready",
      "checks": {
        "database": true,
        "redis": true
      },
      "ts": "2025-12-20T02:03:38.531Z"
    },
    "timestamp": "2025-12-20T02:03:38.535Z"
  },
  {
    "endpoint": "/health/live",
    "status": 200,
    "response": {
      "ok": true,
      "status": "alive",
      "ts": "2025-12-20T02:03:38.537Z"
    },
    "timestamp": "2025-12-20T02:03:38.538Z"
  },
  {
    "endpoint": "/health/gpu",
    "status": 200,
    "response": {
      "available": false,
      "reason": "GPU detection not implemented",
      "ts": "2025-12-20T02:03:38.538Z"
    },
    "timestamp": "2025-12-20T02:03:38.539Z"
  },
  {
    "endpoint": "/health",
    "status": 200,
    "response": {
      "status": "ok",
      "info": {
        "memory_heap": {
          "status": "up"
        },
        "database": {
          "status": "up"
        }
      },
      "error": {},
      "details": {
        "memory_heap": {
          "status": "up"
        },
        "database": {
          "status": "up"
        }
      }
    },
    "timestamp": "2025-12-20T02:03:38.542Z"
  }
]
```

## HMAC 正常请求验证

✅ **正常请求返回 200**

```json
{
  "success": true,
  "status": 200,
  "response": {
    "success": true,
    "data": {
      "projects": [
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "name": "Smoke Verification Project",
          "description": null,
          "createdAt": "2025-12-20T00:43:30.384Z",
          "updatedAt": "2025-12-20T00:43:30.384Z",
          "status": "in_progress"
        }
      ],
      "total": 1,
      "page": 1,
      "pageSize": 100,
      "totalPages": 1
    },
    "requestId": "619b7461-e75d-4806-98c6-742955a941de",
    "timestamp": "2025-12-20T02:03:38.634Z"
  },
  "requestHeaders": {
    "X-Api-Key": "scu_smoke_key",
    "X-Nonce": "nonce-1766196218-5cbbzf",
    "X-Timestamp": "1766196218",
    "X-Signature": "e76b4382f1b1bbab1ff6a99ba0c6198183dcab10c61383838e356127865ce57d",
    "Content-Type": "application/json"
  },
  "timestamp": "2025-12-20T02:03:38.635Z"
}
```

## Nonce 重放检测结果

```json
{
  "firstRequest": {
    "success": true,
    "status": 200,
    "response": {
      "success": true,
      "data": {
        "projects": [
          {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Smoke Verification Project",
            "description": null,
            "createdAt": "2025-12-20T00:43:30.384Z",
            "updatedAt": "2025-12-20T00:43:30.384Z",
            "status": "in_progress"
          }
        ],
        "total": 1,
        "page": 1,
        "pageSize": 100,
        "totalPages": 1
      },
      "requestId": "4c7ce6cc-2fac-425a-a8c6-867b2d81c016",
      "timestamp": "2025-12-20T02:03:38.646Z"
    },
    "requestHeaders": {
      "X-Api-Key": "scu_smoke_key",
      "X-Nonce": "replay-test-1766196218-q6utc4",
      "X-Timestamp": "1766196218",
      "X-Signature": "6e8ac5d6ecf0eee84c944dcc607ba2533f4aa05ceab959527c992197d78b4da5",
      "Content-Type": "application/json"
    },
    "timestamp": "2025-12-20T02:03:38.646Z"
  },
  "secondRequest": {
    "success": false,
    "status": 403,
    "response": {
      "success": false,
      "error": {
        "code": "4004",
        "message": "Nonce replay detected"
      },
      "requestId": "674d36e0-1fbf-40aa-9219-7d2ab4dfc7da",
      "timestamp": "2025-12-20T02:03:38.757Z",
      "path": "/api/projects",
      "method": "GET"
    },
    "requestHeaders": {
      "X-Api-Key": "scu_smoke_key",
      "X-Nonce": "replay-test-1766196218-q6utc4",
      "X-Timestamp": "1766196219",
      "X-Signature": "7b98cc4cb622ddd5364fafba57198acfe3a7e753206c01d8718fc717f52ac8c2",
      "Content-Type": "application/json"
    },
    "timestamp": "2025-12-20T02:03:38.758Z"
  }
}
```

## HMAC 重放拒绝证据

**第一次请求（成功）**:

- Status: 200
- Response:

```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "Smoke Verification Project",
        "description": null,
        "createdAt": "2025-12-20T00:43:30.384Z",
        "updatedAt": "2025-12-20T00:43:30.384Z",
        "status": "in_progress"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 100,
    "totalPages": 1
  },
  "requestId": "4c7ce6cc-2fac-425a-a8c6-867b2d81c016",
  "timestamp": "2025-12-20T02:03:38.646Z"
}
```

**第二次请求（重放，必须被拒绝）**:

- Status: 403
- Response:

```json
{
  "success": false,
  "error": {
    "code": "4004",
    "message": "Nonce replay detected"
  },
  "requestId": "674d36e0-1fbf-40aa-9219-7d2ab4dfc7da",
  "timestamp": "2025-12-20T02:03:38.757Z",
  "path": "/api/projects",
  "method": "GET"
}
```

**验证结果**: ✅ 重放被正确拒绝

## CRUD 最小路径结果

**关键 IDs**:

```json
{
  "projectId": "7ca67ffc-8429-461f-97d8-d91a66f04223",
  "episodeId": "163ae4d1-d9e1-4996-9d30-b617a19cd02b",
  "sceneId": "944ce71e-0630-4d23-8d44-a5b6ff0e740f",
  "shotId": "7e1e79ec-3349-427a-8cf1-adc6718c7e04"
}
```

**完整结果**:

```json
{
  "projectId": "7ca67ffc-8429-461f-97d8-d91a66f04223",
  "episodeId": "163ae4d1-d9e1-4996-9d30-b617a19cd02b",
  "sceneId": "944ce71e-0630-4d23-8d44-a5b6ff0e740f",
  "shotId": "7e1e79ec-3349-427a-8cf1-adc6718c7e04",
  "steps": [
    {
      "step": "Create Project",
      "result": {
        "success": true,
        "status": 201,
        "response": {
          "success": true,
          "data": {
            "id": "7ca67ffc-8429-461f-97d8-d91a66f04223",
            "name": "Smoke Test Project 1766196218783",
            "description": "Smoke test project",
            "ownerId": "c634b350-af4a-47ce-826f-0096d0df3d0d",
            "organizationId": "bd2a51c8-6d11-4cab-a974-f8866a65c7f7",
            "status": "in_progress",
            "metadata": null,
            "settingsJson": null,
            "createdAt": "2025-12-20T02:03:38.796Z",
            "updatedAt": "2025-12-20T02:03:38.796Z"
          },
          "requestId": "0e98d58c-b183-4063-8ffd-48138be977ad",
          "timestamp": "2025-12-20T02:03:38.801Z"
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-lkgijq",
          "X-Timestamp": "1766196218",
          "X-Signature": "ca0337e77f45e9df08ea2fba9b5b53e515e1ffd5dc56e944e9f7819654c32eff",
          "Content-Type": "application/json",
          "X-Content-SHA256": "94aee612510454d5bf14e71eeee040037987ba442404529a481ab182f5c62b29"
        },
        "timestamp": "2025-12-20T02:03:38.802Z"
      }
    },
    {
      "step": "Create Season",
      "result": {
        "success": false,
        "status": 400,
        "response": {
          "message": ["property description should not exist"],
          "error": "Bad Request",
          "statusCode": 400
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-j7nxq",
          "X-Timestamp": "1766196218",
          "X-Signature": "d1c52fa6e807795a5ffb98d9d5a567c8abbcd3812239f598324aaa38857463d8",
          "Content-Type": "application/json",
          "X-Content-SHA256": "3143c66283433bc3f508c9fe60a0092193e5e650234a63fb18425d108bc207da"
        },
        "timestamp": "2025-12-20T02:03:38.809Z"
      }
    },
    {
      "step": "Create Episode",
      "result": {
        "success": true,
        "status": 201,
        "response": {
          "success": true,
          "data": {
            "id": "163ae4d1-d9e1-4996-9d30-b617a19cd02b",
            "seasonId": "6904e72e-cdb1-4e0f-a29b-ad9828520221",
            "projectId": "7ca67ffc-8429-461f-97d8-d91a66f04223",
            "index": 1,
            "name": "Episode 1",
            "summary": "Smoke test episode",
            "chapterId": null
          },
          "requestId": "4bd2a4d7-475e-4583-859d-923ee182f2ca",
          "timestamp": "2025-12-20T02:03:38.823Z"
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-0nisj",
          "X-Timestamp": "1766196218",
          "X-Signature": "3846fb69d0dab29c08f30112878c09eba22a55c3319eae5460b5d7b72157166e",
          "Content-Type": "application/json",
          "X-Content-SHA256": "34e6413759144e4bf517b6fd990668b6921b2f44172c5137e9ce3db8369036dd"
        },
        "timestamp": "2025-12-20T02:03:38.823Z"
      }
    },
    {
      "step": "Create Scene",
      "result": {
        "success": true,
        "status": 201,
        "response": {
          "success": true,
          "data": {
            "id": "944ce71e-0630-4d23-8d44-a5b6ff0e740f",
            "episodeId": "163ae4d1-d9e1-4996-9d30-b617a19cd02b",
            "index": 1,
            "title": "Scene 1",
            "summary": "Smoke test scene",
            "characters": null,
            "visualDensityScore": null,
            "enrichedText": null,
            "sceneDraftId": null,
            "projectId": null
          },
          "requestId": "6785a06a-d048-4fdb-92b5-1c03e8ea4d7c",
          "timestamp": "2025-12-20T02:03:38.837Z"
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-mfw6qj",
          "X-Timestamp": "1766196218",
          "X-Signature": "8291e7ebbb2875434569e350e571259e56dd04a594bb73e950c11f52080990cb",
          "Content-Type": "application/json",
          "X-Content-SHA256": "1414384475966433844eb307027a82020a1ddd78c2c6e6dd74ea21660df2e394"
        },
        "timestamp": "2025-12-20T02:03:38.837Z"
      }
    },
    {
      "step": "Create Shot",
      "result": {
        "success": true,
        "status": 201,
        "response": {
          "success": true,
          "data": {
            "id": "7e1e79ec-3349-427a-8cf1-adc6718c7e04",
            "sceneId": "944ce71e-0630-4d23-8d44-a5b6ff0e740f",
            "index": 1,
            "title": "Shot 1",
            "description": "Smoke test shot",
            "type": "test",
            "params": {},
            "qualityScore": {},
            "reviewedAt": null,
            "durationSeconds": null,
            "organizationId": "bd2a51c8-6d11-4cab-a974-f8866a65c7f7",
            "enrichedPrompt": null
          },
          "requestId": "467cdc75-ccd9-43b5-aa4a-f15757665798",
          "timestamp": "2025-12-20T02:03:38.850Z"
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-nhub4f",
          "X-Timestamp": "1766196218",
          "X-Signature": "c2f7c1ba89ed6cea75b66bb16e0a26d79ac32a2b070bbaaeda93a5263af6f609",
          "Content-Type": "application/json",
          "X-Content-SHA256": "120d21c7cd9c02c912761b7fa887919fc8fd0dfbde8a1e12d81be16016cadb60"
        },
        "timestamp": "2025-12-20T02:03:38.850Z"
      }
    },
    {
      "step": "Read Project",
      "result": {
        "success": true,
        "status": 200,
        "response": {
          "success": true,
          "data": {
            "id": "7ca67ffc-8429-461f-97d8-d91a66f04223",
            "name": "Smoke Test Project 1766196218783",
            "description": "Smoke test project",
            "ownerId": "c634b350-af4a-47ce-826f-0096d0df3d0d",
            "organizationId": "bd2a51c8-6d11-4cab-a974-f8866a65c7f7",
            "status": "in_progress",
            "metadata": null,
            "settingsJson": null,
            "createdAt": "2025-12-20T02:03:38.796Z",
            "updatedAt": "2025-12-20T02:03:38.796Z",
            "episodes": [
              {
                "id": "163ae4d1-d9e1-4996-9d30-b617a19cd02b",
                "seasonId": "6904e72e-cdb1-4e0f-a29b-ad9828520221",
                "projectId": "7ca67ffc-8429-461f-97d8-d91a66f04223",
                "index": 1,
                "name": "Episode 1",
                "summary": "Smoke test episode",
                "chapterId": null,
                "scenes": [
                  {
                    "id": "944ce71e-0630-4d23-8d44-a5b6ff0e740f",
                    "episodeId": "163ae4d1-d9e1-4996-9d30-b617a19cd02b",
                    "index": 1,
                    "title": "Scene 1",
                    "summary": "Smoke test scene",
                    "characters": null,
                    "visualDensityScore": null,
                    "enrichedText": null,
                    "sceneDraftId": null,
                    "projectId": null,
                    "shots": [
                      {
                        "id": "7e1e79ec-3349-427a-8cf1-adc6718c7e04",
                        "sceneId": "944ce71e-0630-4d23-8d44-a5b6ff0e740f",
                        "index": 1,
                        "title": "Shot 1",
                        "description": "Smoke test shot",
                        "type": "test",
                        "params": {},
                        "qualityScore": {},
                        "reviewedAt": null,
                        "durationSeconds": null,
                        "organizationId": "bd2a51c8-6d11-4cab-a974-f8866a65c7f7",
                        "enrichedPrompt": null
                      }
                    ]
                  }
                ]
              }
            ]
          },
          "requestId": "86093e59-ef20-49aa-a787-580fe890d7cf",
          "timestamp": "2025-12-20T02:03:38.855Z"
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-zxfhv",
          "X-Timestamp": "1766196218",
          "X-Signature": "e75438aad6d35ecded80c3665e0ea90e3d67d5bb230cc61d532d8555ba1f045c",
          "Content-Type": "application/json"
        },
        "timestamp": "2025-12-20T02:03:38.856Z"
      }
    },
    {
      "step": "Read Shot (try /api/projects/shots/7e1e79ec-3349-427a-8cf1-adc6718c7e04)",
      "result": {
        "success": true,
        "status": 200,
        "response": {
          "success": true,
          "data": {
            "id": "7e1e79ec-3349-427a-8cf1-adc6718c7e04",
            "sceneId": "944ce71e-0630-4d23-8d44-a5b6ff0e740f",
            "index": 1,
            "title": "Shot 1",
            "description": "Smoke test shot",
            "type": "test",
            "params": {},
            "qualityScore": {},
            "reviewedAt": null,
            "durationSeconds": null,
            "organizationId": "bd2a51c8-6d11-4cab-a974-f8866a65c7f7",
            "enrichedPrompt": null,
            "qualityScores": [],
            "safetyResults": [],
            "scene": {
              "id": "944ce71e-0630-4d23-8d44-a5b6ff0e740f",
              "episodeId": "163ae4d1-d9e1-4996-9d30-b617a19cd02b",
              "index": 1,
              "title": "Scene 1",
              "summary": "Smoke test scene",
              "characters": null,
              "visualDensityScore": null,
              "enrichedText": null,
              "sceneDraftId": null,
              "projectId": null,
              "episode": {
                "id": "163ae4d1-d9e1-4996-9d30-b617a19cd02b",
                "seasonId": "6904e72e-cdb1-4e0f-a29b-ad9828520221",
                "projectId": "7ca67ffc-8429-461f-97d8-d91a66f04223",
                "index": 1,
                "name": "Episode 1",
                "summary": "Smoke test episode",
                "chapterId": null,
                "project": {
                  "id": "7ca67ffc-8429-461f-97d8-d91a66f04223",
                  "name": "Smoke Test Project 1766196218783",
                  "description": "Smoke test project",
                  "ownerId": "c634b350-af4a-47ce-826f-0096d0df3d0d",
                  "organizationId": "bd2a51c8-6d11-4cab-a974-f8866a65c7f7",
                  "status": "in_progress",
                  "metadata": null,
                  "settingsJson": null,
                  "createdAt": "2025-12-20T02:03:38.796Z",
                  "updatedAt": "2025-12-20T02:03:38.796Z"
                }
              }
            }
          },
          "requestId": "33e0ae1a-8bed-4ee0-a531-9dc93bcc2c92",
          "timestamp": "2025-12-20T02:03:38.864Z"
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-cq857a",
          "X-Timestamp": "1766196218",
          "X-Signature": "22817966743cdf2e10d84b9a39d70e8a0337ff22c0218b5d1f902885f70e476b",
          "Content-Type": "application/json"
        },
        "timestamp": "2025-12-20T02:03:38.864Z"
      }
    }
  ],
  "success": true
}
```

## Worker 最小流程结果

**关键信息（Job 状态变化）**:

```json
{
  "workerId": "smoke-worker-1766196218868",
  "jobId": "b4414b57-f9a9-41fa-8404-6ac13e3103bf",
  "reportStatusUsed": "N/A",
  "steps": [
    {
      "step": "Register Worker",
      "success": true,
      "httpStatus": 201,
      "response": {
        "success": true,
        "data": {
          "id": "3c16831a-8df0-437f-97fe-2b5f6e79ff5f",
          "workerId": "smoke-worker-1766196218868",
          "status": "online",
          "capabilities": {}
        }
      }
    },
    {
      "step": "Heartbeat",
      "success": true,
      "httpStatus": 201,
      "response": {
        "ok": true,
        "workerId": "smoke-worker-1766196218868",
        "ts": "2025-12-20T02:03:38.885Z"
      }
    },
    {
      "step": "Get Next Job",
      "success": true,
      "httpStatus": 201,
      "response": {
        "success": true,
        "data": {
          "id": "b4414b57-f9a9-41fa-8404-6ac13e3103bf",
          "type": "NOVEL_ANALYSIS",
          "payload": {
            "userId": "d687e747-4aa5-408e-95d2-99674fb1adaa",
            "chapterId": "8ca7f768-a413-426b-bbb2-ac2b691609ac",
            "projectId": "be47fb4b-29cc-4733-99a5-ec12b9bf3a32",
            "organizationId": "4181b825-9ce8-4b8e-a757-3bdc4151f4d7"
          },
          "taskId": "7475f1f4-13cf-4861-8ac1-f76234ef0158",
          "shotId": "59af452a-a86e-4bdb-9a1b-ec79218985d9",
          "projectId": "be47fb4b-29cc-4733-99a5-ec12b9bf3a32"
        }
      }
    },
    {
      "step": "Start Job (RUNNING)",
      "success": false,
      "httpStatus": 403,
      "response": {
        "success": false,
        "error": {
          "code": "4004",
          "message": "Nonce replay detected"
        },
        "requestId": "6f7dcaf7-12d7-4792-b2fe-13bc0b118169",
        "timestamp": "2025-12-20T02:03:38.907Z",
        "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/start",
        "method": "POST"
      }
    },
    {
      "step": "Report Job (SUCCESS)",
      "success": false,
      "httpStatus": 403,
      "response": {
        "success": false,
        "error": {
          "code": "4004",
          "message": "Nonce replay detected"
        },
        "requestId": "1ecc0860-ee64-4c61-b712-f92a0821aff5",
        "timestamp": "2025-12-20T02:03:38.915Z",
        "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/report",
        "method": "POST"
      }
    },
    {
      "step": "Report Job (SUCCEEDED fallback)",
      "success": false,
      "httpStatus": 403,
      "response": {
        "success": false,
        "error": {
          "code": "4004",
          "message": "Nonce replay detected"
        },
        "requestId": "08d08442-1645-43aa-8a58-cc1bdaa5e3a9",
        "timestamp": "2025-12-20T02:03:38.922Z",
        "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/report",
        "method": "POST"
      }
    }
  ]
}
```

**最终采用的 Report 状态值**: `N/A`

**完整结果**:

```json
{
  "workerId": "smoke-worker-1766196218868",
  "jobId": "b4414b57-f9a9-41fa-8404-6ac13e3103bf",
  "steps": [
    {
      "step": "Register Worker",
      "result": {
        "success": true,
        "status": 201,
        "response": {
          "success": true,
          "data": {
            "id": "3c16831a-8df0-437f-97fe-2b5f6e79ff5f",
            "workerId": "smoke-worker-1766196218868",
            "status": "online",
            "capabilities": {}
          }
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-viliba",
          "X-Timestamp": "1766196218",
          "X-Signature": "f8690b13ff55203da8697ed180a147ce47b86a5f8aeab5567c6db0a086a44461",
          "Content-Type": "application/json",
          "X-Content-SHA256": "3d29c4ca98d2f8f57d14ea8a198ba42632f367c8e828366e0bda191439acddf5"
        },
        "timestamp": "2025-12-20T02:03:38.877Z"
      }
    },
    {
      "step": "Heartbeat",
      "result": {
        "success": true,
        "status": 201,
        "response": {
          "ok": true,
          "workerId": "smoke-worker-1766196218868",
          "ts": "2025-12-20T02:03:38.885Z"
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-n3pw5r",
          "X-Timestamp": "1766196218",
          "X-Signature": "58892993367fa6a623da4aba8f874ef83adbce6572c592e0547c663d03c59038",
          "Content-Type": "application/json",
          "X-Content-SHA256": "d4fc339cd9a416100291ec3dc7a62f6b1d52848f9cb4ae3980955a9cc5432ac2"
        },
        "timestamp": "2025-12-20T02:03:38.886Z"
      }
    },
    {
      "step": "Get Next Job",
      "result": {
        "success": true,
        "status": 201,
        "response": {
          "success": true,
          "data": {
            "id": "b4414b57-f9a9-41fa-8404-6ac13e3103bf",
            "type": "NOVEL_ANALYSIS",
            "payload": {
              "userId": "d687e747-4aa5-408e-95d2-99674fb1adaa",
              "chapterId": "8ca7f768-a413-426b-bbb2-ac2b691609ac",
              "projectId": "be47fb4b-29cc-4733-99a5-ec12b9bf3a32",
              "organizationId": "4181b825-9ce8-4b8e-a757-3bdc4151f4d7"
            },
            "taskId": "7475f1f4-13cf-4861-8ac1-f76234ef0158",
            "shotId": "59af452a-a86e-4bdb-9a1b-ec79218985d9",
            "projectId": "be47fb4b-29cc-4733-99a5-ec12b9bf3a32"
          }
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-0bfqa7",
          "X-Timestamp": "1766196218",
          "X-Signature": "04b4a03afdd8a6531bb9400bb61f5ffa1e91c7a9e52aeb5eb43fad6e217553a1",
          "Content-Type": "application/json"
        },
        "timestamp": "2025-12-20T02:03:38.900Z"
      }
    },
    {
      "step": "Start Job (RUNNING)",
      "result": {
        "success": false,
        "status": 403,
        "response": {
          "success": false,
          "error": {
            "code": "4004",
            "message": "Nonce replay detected"
          },
          "requestId": "6f7dcaf7-12d7-4792-b2fe-13bc0b118169",
          "timestamp": "2025-12-20T02:03:38.907Z",
          "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/start",
          "method": "POST"
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-t1qgnn",
          "X-Timestamp": "1766196218",
          "X-Signature": "8e116e14703f92e2accd9cb73a31723985ce77fa25f7e0b4f231e1b0c1dd3d27",
          "Content-Type": "application/json",
          "X-Content-SHA256": "eaa4dc994446b7b46e4a1fac1c246c3563f5c0c93e264ace40b11dcc78103297"
        },
        "timestamp": "2025-12-20T02:03:38.908Z"
      }
    },
    {
      "step": "Report Job (SUCCESS)",
      "result": {
        "success": false,
        "status": 403,
        "response": {
          "success": false,
          "error": {
            "code": "4004",
            "message": "Nonce replay detected"
          },
          "requestId": "1ecc0860-ee64-4c61-b712-f92a0821aff5",
          "timestamp": "2025-12-20T02:03:38.915Z",
          "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/report",
          "method": "POST"
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-e3e8y7",
          "X-Timestamp": "1766196218",
          "X-Signature": "a9da8ee9196962fe1a2752acb5677f0cb87bee0c1d65c5b7b924ba5bbf3ddf35",
          "Content-Type": "application/json",
          "X-Content-SHA256": "c78808ba8c2670fc6091266446db941087e50c7ac2504b6fc250617afeaebee6"
        },
        "timestamp": "2025-12-20T02:03:38.915Z"
      }
    },
    {
      "step": "Report Job (SUCCEEDED fallback)",
      "result": {
        "success": false,
        "status": 403,
        "response": {
          "success": false,
          "error": {
            "code": "4004",
            "message": "Nonce replay detected"
          },
          "requestId": "08d08442-1645-43aa-8a58-cc1bdaa5e3a9",
          "timestamp": "2025-12-20T02:03:38.922Z",
          "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/report",
          "method": "POST"
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766196218-i2kh0m",
          "X-Timestamp": "1766196218",
          "X-Signature": "9d4fa8e9285e4d14adb50f0e9185111c67c73b7935da12c809b9880594ebe4d6",
          "Content-Type": "application/json",
          "X-Content-SHA256": "3757d66ab30ca71f739f8225227e1c385158ccdd1728eae2b647422a0bfd2008"
        },
        "timestamp": "2025-12-20T02:03:38.923Z"
      }
    }
  ],
  "success": true
}
```

## Engine Binding 测试

❌ API_KEY/API_SECRET not set, test skipped

## SQL 验证结果

### SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "016f6a5b-9a36-42c4-a493-e9c9be809805",
    "action": "API_SIGNATURE_ERROR",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766196218-g0qlan",
    "signature": "c9269e09a6a0a0c70dcd46e325463613420d46a2239a4ac6261c33d1fe753833",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/7ca67ffc-8429-461f-97d8-d91a66f04223/novel/analyze",
      "method": "POST",
      "message": "签名验证失败"
    }
  },
  {
    "id": "96f4e743-010d-4daa-a2b0-f4645c7aaa90",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766196218-g0qlan",
    "signature": "c9269e09a6a0a0c70dcd46e325463613420d46a2239a4ac6261c33d1fe753833",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/7ca67ffc-8429-461f-97d8-d91a66f04223/novel/analyze",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "签名验证失败"
    }
  },
  {
    "id": "28d4eb34-d9fd-4ab0-b884-08c3090942d5",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766196218-g0qlan",
    "signature": null,
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/7ca67ffc-8429-461f-97d8-d91a66f04223/novel/analyze",
      "nonce": "nonce-1766196218-g0qlan",
      "method": "POST",
      "reason": "HMAC_SIGNATURE_MISMATCH",
      "timestamp": "1766196218"
    }
  },
  {
    "id": "29be0393-5a27-47ed-9a22-97592b148fef",
    "action": "NOVEL_IMPORT",
    "resourceType": "project",
    "resourceId": "7ca67ffc-8429-461f-97d8-d91a66f04223",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "7ca67ffc-8429-461f-97d8-d91a66f04223",
      "importMode": "text",
      "novelTitle": "Smoke Test Novel",
      "chapterCount": 1,
      "novelSourceId": "36e05fbc-b4ad-42bd-a1ac-d70fec7298c4",
      "characterCount": 146
    }
  },
  {
    "id": "e1e9c313-2d3f-40b5-a247-23fbdc4c321d",
    "action": "JOB_CREATED",
    "resourceType": "job",
    "resourceId": "55d7792f-4844-4f0a-b2d9-87e11a6c5bd9",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "taskId": "a580209b-70d0-40c1-a8e9-d8d59c3c5e35"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 2
- **结果示例** (前 5 行):

```json
[
  {
    "status": "PENDING",
    "count": 1,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 9
  },
  {
    "table_name": "seasons",
    "count": 8,
    "unique_projects": 8
  },
  {
    "table_name": "episodes",
    "count": 9,
    "unique_seasons": 6,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 10,
    "unique_episodes": 6
  },
  {
    "table_name": "shots",
    "count": 34,
    "unique_scenes": 10
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "016f6a5b-9a36-42c4-a493-e9c9be809805",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766196218-g0qlan",
        "signature": "c9269e09a6a0a0c70dcd46e325463613420d46a2239a4ac6261c33d1fe753833",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7ca67ffc-8429-461f-97d8-d91a66f04223/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "96f4e743-010d-4daa-a2b0-f4645c7aaa90",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766196218-g0qlan",
        "signature": "c9269e09a6a0a0c70dcd46e325463613420d46a2239a4ac6261c33d1fe753833",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7ca67ffc-8429-461f-97d8-d91a66f04223/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "28d4eb34-d9fd-4ab0-b884-08c3090942d5",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766196218-g0qlan",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/7ca67ffc-8429-461f-97d8-d91a66f04223/novel/analyze",
          "nonce": "nonce-1766196218-g0qlan",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766196218"
        }
      },
      {
        "id": "29be0393-5a27-47ed-9a22-97592b148fef",
        "action": "NOVEL_IMPORT",
        "resourceType": "project",
        "resourceId": "7ca67ffc-8429-461f-97d8-d91a66f04223",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "7ca67ffc-8429-461f-97d8-d91a66f04223",
          "importMode": "text",
          "novelTitle": "Smoke Test Novel",
          "chapterCount": 1,
          "novelSourceId": "36e05fbc-b4ad-42bd-a1ac-d70fec7298c4",
          "characterCount": 146
        }
      },
      {
        "id": "e1e9c313-2d3f-40b5-a247-23fbdc4c321d",
        "action": "JOB_CREATED",
        "resourceType": "job",
        "resourceId": "55d7792f-4844-4f0a-b2d9-87e11a6c5bd9",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "a580209b-70d0-40c1-a8e9-d8d59c3c5e35"
        }
      },
      {
        "id": "889ea33f-daaa-472c-823d-74fca0e41a24",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "a580209b-70d0-40c1-a8e9-d8d59c3c5e35",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "bd2a51c8-6d11-4cab-a974-f8866a65c7f7"
        }
      },
      {
        "id": "ddee0dcb-ccaa-45a0-8e5d-28c0bdb7f156",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766196218-i2kh0m",
        "signature": "9d4fa8e9285e4d14adb50f0e9185111c67c73b7935da12c809b9880594ebe4d6",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/report",
          "method": "POST",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "30117ba4-cb18-48a4-90a8-a484b15dfd21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/report",
          "nonce": "nonce-1766196218-i2kh0m",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766196218
        }
      },
      {
        "id": "99ce4ae3-555b-49dc-9cbe-c01e0a067e89",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766196218-e3e8y7",
        "signature": "a9da8ee9196962fe1a2752acb5677f0cb87bee0c1d65c5b7b924ba5bbf3ddf35",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/report",
          "method": "POST",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "5c13446a-14f6-42a4-97ab-54ce2f3ab753",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/report",
          "nonce": "nonce-1766196218-e3e8y7",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766196218
        }
      },
      {
        "id": "892c06d3-48a0-445f-af34-5039fb117aef",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766196218-t1qgnn",
        "signature": "8e116e14703f92e2accd9cb73a31723985ce77fa25f7e0b4f231e1b0c1dd3d27",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/start",
          "method": "POST",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "37e60d7b-26f8-420c-ba2d-6e25e6704360",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/jobs/b4414b57-f9a9-41fa-8404-6ac13e3103bf/start",
          "nonce": "nonce-1766196218-t1qgnn",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766196218
        }
      },
      {
        "id": "32ae0e85-1a96-4563-8190-6d72cffdee6e",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "b4414b57-f9a9-41fa-8404-6ac13e3103bf",
        "nonce": "nonce-1766196218-0bfqa7",
        "signature": "04b4a03afdd8a6531bb9400bb61f5ffa1e91c7a9e52aeb5eb43fad6e217553a1",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "7475f1f4-13cf-4861-8ac1-f76234ef0158",
          "workerId": "smoke-worker-1766196218868"
        }
      },
      {
        "id": "aec78d8f-760f-458d-9e6c-ffe7574d0bfd",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "b4414b57-f9a9-41fa-8404-6ac13e3103bf",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "7475f1f4-13cf-4861-8ac1-f76234ef0158",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "smoke-worker-1766196218868"
        }
      },
      {
        "id": "f32be2a6-bd51-428d-a6ca-6e2601046812",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "3c16831a-8df0-437f-97fe-2b5f6e79ff5f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766196218868",
          "capabilities": {}
        }
      },
      {
        "id": "1b4ff5dc-29e7-4eb8-b5f1-4da2ff364307",
        "action": "SHOT_CREATE",
        "resourceType": "/api/projects/scenes/:sceneId/shots",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/scenes/944ce71e-0630-4d23-8d44-a5b6ff0e740f/shots",
          "method": "POST"
        }
      },
      {
        "id": "16270537-a72d-4b3c-9e2d-001942127a11",
        "action": "SHOT_CREATE",
        "resourceType": "shot",
        "resourceId": "7e1e79ec-3349-427a-8cf1-adc6718c7e04",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "sceneId": "944ce71e-0630-4d23-8d44-a5b6ff0e740f",
          "shotIndex": 1
        }
      },
      {
        "id": "970a0606-d096-4549-9164-3eb75d2e242d",
        "action": "SCENE_CREATE",
        "resourceType": "/api/projects/episodes/:episodeId/scenes",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/episodes/163ae4d1-d9e1-4996-9d30-b617a19cd02b/scenes",
          "method": "POST"
        }
      },
      {
        "id": "acf11725-aac3-4f19-9e66-b1c3f470d63f",
        "action": "SCENE_CREATE",
        "resourceType": "scene",
        "resourceId": "944ce71e-0630-4d23-8d44-a5b6ff0e740f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "episodeId": "163ae4d1-d9e1-4996-9d30-b617a19cd02b",
          "sceneIndex": 1
        }
      },
      {
        "id": "dd99cad4-4e34-4cf6-bbea-66cfb022a20b",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "7ca67ffc-8429-461f-97d8-d91a66f04223",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/7ca67ffc-8429-461f-97d8-d91a66f04223/episodes",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "PENDING",
        "count": 1,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 9
      },
      {
        "table_name": "seasons",
        "count": 8,
        "unique_projects": 8
      },
      {
        "table_name": "episodes",
        "count": 9,
        "unique_seasons": 6,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 10,
        "unique_episodes": 6
      },
      {
        "table_name": "shots",
        "count": 34,
        "unique_scenes": 10
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "6e4501fc-ffcc-4c7d-8c03-409eaa3989d2",
    "action": "API_SIGNATURE_ERROR",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766191424-v0711s",
    "signature": "2b4d4b793918dda4d4fcaa7379d773f26b22be89efa868cd1ec0baf4105e29b8",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/be47fb4b-29cc-4733-99a5-ec12b9bf3a32/novel/analyze",
      "method": "POST",
      "message": "签名验证失败"
    }
  },
  {
    "id": "18c6a3bf-1abc-438d-a674-9fafb50691ee",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766191424-v0711s",
    "signature": "2b4d4b793918dda4d4fcaa7379d773f26b22be89efa868cd1ec0baf4105e29b8",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/be47fb4b-29cc-4733-99a5-ec12b9bf3a32/novel/analyze",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "签名验证失败"
    }
  },
  {
    "id": "ea3db319-acdb-4916-8264-386b0b9eff1b",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766191424-v0711s",
    "signature": null,
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/be47fb4b-29cc-4733-99a5-ec12b9bf3a32/novel/analyze",
      "nonce": "nonce-1766191424-v0711s",
      "method": "POST",
      "reason": "HMAC_SIGNATURE_MISMATCH",
      "timestamp": "1766191424"
    }
  },
  {
    "id": "5730536e-22a8-4d7a-97f8-db5074a0a170",
    "action": "NOVEL_IMPORT",
    "resourceType": "project",
    "resourceId": "be47fb4b-29cc-4733-99a5-ec12b9bf3a32",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "be47fb4b-29cc-4733-99a5-ec12b9bf3a32",
      "importMode": "text",
      "novelTitle": "Smoke Test Novel",
      "chapterCount": 1,
      "novelSourceId": "b19cfc9c-42de-4eea-ad54-073f3dcf6309",
      "characterCount": 146
    }
  },
  {
    "id": "b4ec4550-8956-40b9-b7bb-eddb4c6b2d5f",
    "action": "JOB_CREATED",
    "resourceType": "job",
    "resourceId": "b4414b57-f9a9-41fa-8404-6ac13e3103bf",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "taskId": "7475f1f4-13cf-4861-8ac1-f76234ef0158"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "PENDING",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 5
  },
  {
    "table_name": "seasons",
    "count": 4,
    "unique_projects": 4
  },
  {
    "table_name": "episodes",
    "count": 5,
    "unique_seasons": 3,
    "unique_projects": 3
  },
  {
    "table_name": "scenes",
    "count": 8,
    "unique_episodes": 4
  },
  {
    "table_name": "shots",
    "count": 32,
    "unique_scenes": 8
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "6e4501fc-ffcc-4c7d-8c03-409eaa3989d2",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766191424-v0711s",
        "signature": "2b4d4b793918dda4d4fcaa7379d773f26b22be89efa868cd1ec0baf4105e29b8",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/be47fb4b-29cc-4733-99a5-ec12b9bf3a32/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "18c6a3bf-1abc-438d-a674-9fafb50691ee",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766191424-v0711s",
        "signature": "2b4d4b793918dda4d4fcaa7379d773f26b22be89efa868cd1ec0baf4105e29b8",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/be47fb4b-29cc-4733-99a5-ec12b9bf3a32/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "ea3db319-acdb-4916-8264-386b0b9eff1b",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766191424-v0711s",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/be47fb4b-29cc-4733-99a5-ec12b9bf3a32/novel/analyze",
          "nonce": "nonce-1766191424-v0711s",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766191424"
        }
      },
      {
        "id": "5730536e-22a8-4d7a-97f8-db5074a0a170",
        "action": "NOVEL_IMPORT",
        "resourceType": "project",
        "resourceId": "be47fb4b-29cc-4733-99a5-ec12b9bf3a32",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "be47fb4b-29cc-4733-99a5-ec12b9bf3a32",
          "importMode": "text",
          "novelTitle": "Smoke Test Novel",
          "chapterCount": 1,
          "novelSourceId": "b19cfc9c-42de-4eea-ad54-073f3dcf6309",
          "characterCount": 146
        }
      },
      {
        "id": "b4ec4550-8956-40b9-b7bb-eddb4c6b2d5f",
        "action": "JOB_CREATED",
        "resourceType": "job",
        "resourceId": "b4414b57-f9a9-41fa-8404-6ac13e3103bf",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "7475f1f4-13cf-4861-8ac1-f76234ef0158"
        }
      },
      {
        "id": "52c6ec72-ef19-4559-882c-adc14f352ac5",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "7475f1f4-13cf-4861-8ac1-f76234ef0158",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "4181b825-9ce8-4b8e-a757-3bdc4151f4d7"
        }
      },
      {
        "id": "1a1d7f6b-ee18-4fbb-9b19-ec82d4ba322b",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "2a5ab34c-9c2d-43ee-95aa-c6dbef740a67",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766191424468",
          "capabilities": {}
        }
      },
      {
        "id": "ed6a7b8c-05a2-47f9-9b79-c1a3edeebb95",
        "action": "SHOT_CREATE",
        "resourceType": "/api/projects/scenes/:sceneId/shots",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/scenes/d0a46b8e-8fad-4f8c-a5a0-59599c3fe7e8/shots",
          "method": "POST"
        }
      },
      {
        "id": "9fdb8f7a-2d6d-4678-871f-ea13d1fd786b",
        "action": "SHOT_CREATE",
        "resourceType": "shot",
        "resourceId": "87ec092c-8d76-4752-93ea-28c61cfb6ea4",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "sceneId": "d0a46b8e-8fad-4f8c-a5a0-59599c3fe7e8",
          "shotIndex": 1
        }
      },
      {
        "id": "3aec8640-7647-409b-b45f-31773370d583",
        "action": "SCENE_CREATE",
        "resourceType": "/api/projects/episodes/:episodeId/scenes",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/episodes/310deaeb-701c-4e04-bfae-960c85ca3c31/scenes",
          "method": "POST"
        }
      },
      {
        "id": "5ca3e689-edf1-457f-adba-66ca4f9beb12",
        "action": "SCENE_CREATE",
        "resourceType": "scene",
        "resourceId": "d0a46b8e-8fad-4f8c-a5a0-59599c3fe7e8",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "episodeId": "310deaeb-701c-4e04-bfae-960c85ca3c31",
          "sceneIndex": 1
        }
      },
      {
        "id": "97bdc40b-c903-4ab4-bb22-508888ae512d",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "be47fb4b-29cc-4733-99a5-ec12b9bf3a32",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/be47fb4b-29cc-4733-99a5-ec12b9bf3a32/episodes",
          "method": "POST"
        }
      },
      {
        "id": "10c26f38-02fe-4de7-9071-cf91b9928daa",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "310deaeb-701c-4e04-bfae-960c85ca3c31",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "be47fb4b-29cc-4733-99a5-ec12b9bf3a32",
          "episodeIndex": 1
        }
      },
      {
        "id": "644b6190-5477-4a22-ad6f-c29cd36e91ef",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "56c4abfd-95e4-4cd1-b018-84cec693730b",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "be47fb4b-29cc-4733-99a5-ec12b9bf3a32",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766191424320",
          "organizationId": "4181b825-9ce8-4b8e-a757-3bdc4151f4d7"
        }
      },
      {
        "id": "bccc14e4-7129-4369-85be-c7abe5776ff2",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766191424-jq28vp",
        "signature": "364710d5185b6cd54a89866d269192a8902aa24a886afd5115100a412f3b9c46",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "6074f85e-d741-4d70-b192-acd278e6cfe9",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766191424-jq28vp",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766191425
        }
      },
      {
        "id": "dc02c018-cac2-4653-8e20-61bafec4cf4a",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "ebd770d9-e231-419b-94f7-83128374682d",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/ebd770d9-e231-419b-94f7-83128374682d/episodes",
          "method": "POST"
        }
      },
      {
        "id": "6b8ae1eb-0fa5-40ad-af3d-dbea40d76485",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "d7331a98-b4fd-4fe9-8ef9-546ece040ab2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "ebd770d9-e231-419b-94f7-83128374682d",
          "episodeIndex": 1
        }
      },
      {
        "id": "cb4ba3a8-2e04-4bd7-9811-2aec5aa84a7b",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "PENDING",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 5
      },
      {
        "table_name": "seasons",
        "count": 4,
        "unique_projects": 4
      },
      {
        "table_name": "episodes",
        "count": 5,
        "unique_seasons": 3,
        "unique_projects": 3
      },
      {
        "table_name": "scenes",
        "count": 8,
        "unique_episodes": 4
      },
      {
        "table_name": "shots",
        "count": 32,
        "unique_scenes": 8
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "90a691d2-415d-419e-8d86-38c92ec232ec",
    "action": "API_SIGNATURE_ERROR",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766160040-dadwls",
    "signature": "058ba427070a5d7c7e526bc87ce3d3e96259822ef0c684a9040c1ddc75742e31",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/616eb96c-dc42-471a-b3b1-9cc89f421574/novel/analyze",
      "method": "POST",
      "message": "签名验证失败"
    }
  },
  {
    "id": "7a0dbd00-54fc-4d2b-a5fa-7aa934d5c00b",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766160040-dadwls",
    "signature": "058ba427070a5d7c7e526bc87ce3d3e96259822ef0c684a9040c1ddc75742e31",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/616eb96c-dc42-471a-b3b1-9cc89f421574/novel/analyze",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "签名验证失败"
    }
  },
  {
    "id": "77246b31-50a1-40cc-a614-f5ca9323fc8d",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766160040-dadwls",
    "signature": null,
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/616eb96c-dc42-471a-b3b1-9cc89f421574/novel/analyze",
      "nonce": "nonce-1766160040-dadwls",
      "method": "POST",
      "reason": "HMAC_SIGNATURE_MISMATCH",
      "timestamp": "1766160040"
    }
  },
  {
    "id": "2d178d21-7f69-44fc-a828-3ac3f25284bf",
    "action": "NOVEL_IMPORT",
    "resourceType": "project",
    "resourceId": "616eb96c-dc42-471a-b3b1-9cc89f421574",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "616eb96c-dc42-471a-b3b1-9cc89f421574",
      "importMode": "text",
      "novelTitle": "Smoke Test Novel",
      "chapterCount": 1,
      "novelSourceId": "d44d5a59-b4db-40b6-b44a-b44b23a80b08",
      "characterCount": 146
    }
  },
  {
    "id": "a270b747-d9bb-4515-a5d5-0beda408fd53",
    "action": "JOB_CREATED",
    "resourceType": "job",
    "resourceId": "b889d893-ead3-49e6-b3cf-d406441e2c37",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "taskId": "fe8e0bc9-f8b6-49e8-a06a-9943c8d6dda6"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "PENDING",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 5
  },
  {
    "table_name": "seasons",
    "count": 4,
    "unique_projects": 4
  },
  {
    "table_name": "episodes",
    "count": 5,
    "unique_seasons": 3,
    "unique_projects": 3
  },
  {
    "table_name": "scenes",
    "count": 8,
    "unique_episodes": 4
  },
  {
    "table_name": "shots",
    "count": 32,
    "unique_scenes": 8
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "90a691d2-415d-419e-8d86-38c92ec232ec",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766160040-dadwls",
        "signature": "058ba427070a5d7c7e526bc87ce3d3e96259822ef0c684a9040c1ddc75742e31",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/616eb96c-dc42-471a-b3b1-9cc89f421574/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "7a0dbd00-54fc-4d2b-a5fa-7aa934d5c00b",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766160040-dadwls",
        "signature": "058ba427070a5d7c7e526bc87ce3d3e96259822ef0c684a9040c1ddc75742e31",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/616eb96c-dc42-471a-b3b1-9cc89f421574/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "77246b31-50a1-40cc-a614-f5ca9323fc8d",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766160040-dadwls",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/616eb96c-dc42-471a-b3b1-9cc89f421574/novel/analyze",
          "nonce": "nonce-1766160040-dadwls",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766160040"
        }
      },
      {
        "id": "2d178d21-7f69-44fc-a828-3ac3f25284bf",
        "action": "NOVEL_IMPORT",
        "resourceType": "project",
        "resourceId": "616eb96c-dc42-471a-b3b1-9cc89f421574",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "616eb96c-dc42-471a-b3b1-9cc89f421574",
          "importMode": "text",
          "novelTitle": "Smoke Test Novel",
          "chapterCount": 1,
          "novelSourceId": "d44d5a59-b4db-40b6-b44a-b44b23a80b08",
          "characterCount": 146
        }
      },
      {
        "id": "a270b747-d9bb-4515-a5d5-0beda408fd53",
        "action": "JOB_CREATED",
        "resourceType": "job",
        "resourceId": "b889d893-ead3-49e6-b3cf-d406441e2c37",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "fe8e0bc9-f8b6-49e8-a06a-9943c8d6dda6"
        }
      },
      {
        "id": "8dae7ba2-ce0c-468a-b485-ff51b4eed718",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "fe8e0bc9-f8b6-49e8-a06a-9943c8d6dda6",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "f5fc947c-5e58-4cd4-b926-e9f5d8e521a4"
        }
      },
      {
        "id": "4fa5d89c-44df-40c6-8bea-35a69366d0f2",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "8ab3378b-6b9a-47ea-a2a5-0d9095bac972",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766160040157",
          "capabilities": {}
        }
      },
      {
        "id": "58158986-8070-438f-85d3-718e62668d95",
        "action": "SHOT_CREATE",
        "resourceType": "/api/projects/scenes/:sceneId/shots",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/scenes/88d2a3c1-f6d1-4183-a20e-f133054377bc/shots",
          "method": "POST"
        }
      },
      {
        "id": "0e5b2dec-0b37-4e83-8f5f-404f6457cc4c",
        "action": "SHOT_CREATE",
        "resourceType": "shot",
        "resourceId": "0253d4e4-1500-4ba7-8dc4-553f3ea7c2ef",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "sceneId": "88d2a3c1-f6d1-4183-a20e-f133054377bc",
          "shotIndex": 1
        }
      },
      {
        "id": "0e91afca-002a-42b7-b3c8-a938565e3a7b",
        "action": "SCENE_CREATE",
        "resourceType": "/api/projects/episodes/:episodeId/scenes",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/episodes/71aa30e7-c780-4ef5-bc54-38735abbe3b6/scenes",
          "method": "POST"
        }
      },
      {
        "id": "96cbd1ca-64cb-44d9-8e73-6c5e585dff39",
        "action": "SCENE_CREATE",
        "resourceType": "scene",
        "resourceId": "88d2a3c1-f6d1-4183-a20e-f133054377bc",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "episodeId": "71aa30e7-c780-4ef5-bc54-38735abbe3b6",
          "sceneIndex": 1
        }
      },
      {
        "id": "edd159ad-3203-4cec-b577-129121dd5c43",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "616eb96c-dc42-471a-b3b1-9cc89f421574",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/616eb96c-dc42-471a-b3b1-9cc89f421574/episodes",
          "method": "POST"
        }
      },
      {
        "id": "650871f0-2110-49ff-9198-d1abd448ac89",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "71aa30e7-c780-4ef5-bc54-38735abbe3b6",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "616eb96c-dc42-471a-b3b1-9cc89f421574",
          "episodeIndex": 1
        }
      },
      {
        "id": "6e388786-b70b-48fa-9bc4-7c91e19b2162",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "8b23a078-1059-422f-80a5-cf245a84f503",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "616eb96c-dc42-471a-b3b1-9cc89f421574",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766160040077",
          "organizationId": "f5fc947c-5e58-4cd4-b926-e9f5d8e521a4"
        }
      },
      {
        "id": "cbd18684-72f5-40a8-85a0-23b5fa27ec05",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766160039-mq36tf",
        "signature": "ef1f7cdc52d01bc2e838a6a2a025c987e859729931da7e47c97e2b5bfedb6042",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "f644873b-4cbc-4754-8f43-85d2d4604ef2",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766160039-mq36tf",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766160040
        }
      },
      {
        "id": "8990e459-07fa-4077-9ba8-07c44b635fd7",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "bd7036ec-6df6-4bee-8639-39d3637124a4",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/bd7036ec-6df6-4bee-8639-39d3637124a4/episodes",
          "method": "POST"
        }
      },
      {
        "id": "523c54ab-438b-431a-9ebf-87b3ee60e3c7",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "5fcb2376-6187-49dd-874a-e03ea156000b",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "bd7036ec-6df6-4bee-8639-39d3637124a4",
          "episodeIndex": 1
        }
      },
      {
        "id": "765c50e2-aeaf-47bd-954f-3baa2cf47af0",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "PENDING",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 5
      },
      {
        "table_name": "seasons",
        "count": 4,
        "unique_projects": 4
      },
      {
        "table_name": "episodes",
        "count": 5,
        "unique_seasons": 3,
        "unique_projects": 3
      },
      {
        "table_name": "scenes",
        "count": 8,
        "unique_episodes": 4
      },
      {
        "table_name": "shots",
        "count": 32,
        "unique_scenes": 8
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "c8b38a54-0ed0-44e8-8c46-7ec79801f5b2",
    "action": "API_SIGNATURE_ERROR",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766155064-7jg0j7",
    "signature": "523931e100501223b0b7037b4cb8e94d693e160831c64e28bf82618fc1e71085",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/e74aceaf-5092-4325-b9bf-b62d92160a5e/novel/analyze",
      "method": "POST",
      "message": "签名验证失败"
    }
  },
  {
    "id": "29f00847-68e6-4189-89f1-d7a4aede1d60",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766155064-7jg0j7",
    "signature": "523931e100501223b0b7037b4cb8e94d693e160831c64e28bf82618fc1e71085",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/e74aceaf-5092-4325-b9bf-b62d92160a5e/novel/analyze",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "签名验证失败"
    }
  },
  {
    "id": "c338eb24-70c8-4ed8-80ab-adcb2ce4cef4",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766155064-7jg0j7",
    "signature": null,
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/e74aceaf-5092-4325-b9bf-b62d92160a5e/novel/analyze",
      "nonce": "nonce-1766155064-7jg0j7",
      "method": "POST",
      "reason": "HMAC_SIGNATURE_MISMATCH",
      "timestamp": "1766155064"
    }
  },
  {
    "id": "cb25256d-00c3-44a0-8b06-f980542bc3d3",
    "action": "NOVEL_IMPORT",
    "resourceType": "project",
    "resourceId": "e74aceaf-5092-4325-b9bf-b62d92160a5e",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "e74aceaf-5092-4325-b9bf-b62d92160a5e",
      "importMode": "text",
      "novelTitle": "Smoke Test Novel",
      "chapterCount": 1,
      "novelSourceId": "1ef87156-a39e-44ee-b5e7-f92cc7bc7a95",
      "characterCount": 146
    }
  },
  {
    "id": "071806ee-be13-4890-aa04-32a2ed2e0e99",
    "action": "JOB_CREATED",
    "resourceType": "job",
    "resourceId": "387806df-300e-4f4a-b7ab-836d6119dd91",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "taskId": "87ea0996-e2db-4020-9272-9b8a25d9d40e"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "PENDING",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 4
  },
  {
    "table_name": "seasons",
    "count": 4,
    "unique_projects": 3
  },
  {
    "table_name": "episodes",
    "count": 3,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 2,
    "unique_episodes": 2
  },
  {
    "table_name": "shots",
    "count": 2,
    "unique_scenes": 2
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "c8b38a54-0ed0-44e8-8c46-7ec79801f5b2",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766155064-7jg0j7",
        "signature": "523931e100501223b0b7037b4cb8e94d693e160831c64e28bf82618fc1e71085",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/e74aceaf-5092-4325-b9bf-b62d92160a5e/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "29f00847-68e6-4189-89f1-d7a4aede1d60",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766155064-7jg0j7",
        "signature": "523931e100501223b0b7037b4cb8e94d693e160831c64e28bf82618fc1e71085",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/e74aceaf-5092-4325-b9bf-b62d92160a5e/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "c338eb24-70c8-4ed8-80ab-adcb2ce4cef4",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766155064-7jg0j7",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/e74aceaf-5092-4325-b9bf-b62d92160a5e/novel/analyze",
          "nonce": "nonce-1766155064-7jg0j7",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766155064"
        }
      },
      {
        "id": "cb25256d-00c3-44a0-8b06-f980542bc3d3",
        "action": "NOVEL_IMPORT",
        "resourceType": "project",
        "resourceId": "e74aceaf-5092-4325-b9bf-b62d92160a5e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "e74aceaf-5092-4325-b9bf-b62d92160a5e",
          "importMode": "text",
          "novelTitle": "Smoke Test Novel",
          "chapterCount": 1,
          "novelSourceId": "1ef87156-a39e-44ee-b5e7-f92cc7bc7a95",
          "characterCount": 146
        }
      },
      {
        "id": "071806ee-be13-4890-aa04-32a2ed2e0e99",
        "action": "JOB_CREATED",
        "resourceType": "job",
        "resourceId": "387806df-300e-4f4a-b7ab-836d6119dd91",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "87ea0996-e2db-4020-9272-9b8a25d9d40e"
        }
      },
      {
        "id": "9ce68571-36c8-4cce-9ff3-c01776b4bf30",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "87ea0996-e2db-4020-9272-9b8a25d9d40e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "25d1fc9d-6e9a-4a83-8061-2aa2387a65c9"
        }
      },
      {
        "id": "b2063c02-a514-4a45-a20c-231f471fae9e",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "94752368-1d2e-45be-ab63-5c2495a7f826",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766155064371",
          "capabilities": {}
        }
      },
      {
        "id": "a1685cd1-82f7-49de-b6f7-9e45d1415b3e",
        "action": "SHOT_CREATE",
        "resourceType": "/api/projects/scenes/:sceneId/shots",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/scenes/1ff17518-3f8d-4e60-bc67-f39ce9d7019a/shots",
          "method": "POST"
        }
      },
      {
        "id": "da752ff7-7aff-4f02-a082-34df56b5bdb0",
        "action": "SHOT_CREATE",
        "resourceType": "shot",
        "resourceId": "d1bb77ee-b4b9-4547-a5e5-f5338992a7aa",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "sceneId": "1ff17518-3f8d-4e60-bc67-f39ce9d7019a",
          "shotIndex": 1
        }
      },
      {
        "id": "44da5cb5-b403-4316-8d23-92442cfe800b",
        "action": "SCENE_CREATE",
        "resourceType": "/api/projects/episodes/:episodeId/scenes",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/episodes/e55014d9-a959-425b-bf5c-18d0bd1ad28f/scenes",
          "method": "POST"
        }
      },
      {
        "id": "24dc8b87-02ce-47ed-993b-7ae62bdadef9",
        "action": "SCENE_CREATE",
        "resourceType": "scene",
        "resourceId": "1ff17518-3f8d-4e60-bc67-f39ce9d7019a",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "episodeId": "e55014d9-a959-425b-bf5c-18d0bd1ad28f",
          "sceneIndex": 1
        }
      },
      {
        "id": "b75e28b1-dc07-4545-a3f5-c8cffc5b8744",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "e74aceaf-5092-4325-b9bf-b62d92160a5e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e74aceaf-5092-4325-b9bf-b62d92160a5e/episodes",
          "method": "POST"
        }
      },
      {
        "id": "a283600e-b224-4f34-ab56-9a6491fd1c3c",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "e55014d9-a959-425b-bf5c-18d0bd1ad28f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "e74aceaf-5092-4325-b9bf-b62d92160a5e",
          "episodeIndex": 1
        }
      },
      {
        "id": "e503dc9f-67db-4357-9fda-62f1b7b639b5",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "7d3172f9-ec76-4360-8774-311aa793467b",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "e74aceaf-5092-4325-b9bf-b62d92160a5e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766155064274",
          "organizationId": "25d1fc9d-6e9a-4a83-8061-2aa2387a65c9"
        }
      },
      {
        "id": "22210ec3-0a83-4e56-b3ef-05d01239375e",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766155064-g8ltvi",
        "signature": "873cb7c37b21a2eeacc654772bb57b517e6a2945325cda109fe08e783f88e204",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "2cc1c282-cdd5-49a4-824d-2074d766689c",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766155064-g8ltvi",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766155065
        }
      },
      {
        "id": "2afe196b-f594-41ee-95f2-be3c4fe80a32",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "69628494-dc01-46b5-ab9d-bd25cf38a150",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/69628494-dc01-46b5-ab9d-bd25cf38a150/episodes",
          "method": "POST"
        }
      },
      {
        "id": "9f76546b-b50e-4c03-979e-1a4267cd91fd",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "1d311a8a-b5b7-4406-8037-b15c3ee2c046",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "69628494-dc01-46b5-ab9d-bd25cf38a150",
          "episodeIndex": 1
        }
      },
      {
        "id": "cd760deb-7d1c-46f2-9c2d-8c9ba705a71c",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "PENDING",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 4
      },
      {
        "table_name": "seasons",
        "count": 4,
        "unique_projects": 3
      },
      {
        "table_name": "episodes",
        "count": 3,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 2,
        "unique_episodes": 2
      },
      {
        "table_name": "shots",
        "count": 2,
        "unique_scenes": 2
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "4011dd8f-392f-4782-bdfa-8c9d8408a1ce",
    "action": "API_SIGNATURE_ERROR",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766155026-80gh3gj",
    "signature": "923423908e767a19d5623a2b50951c7c1d4a4d7ad90d1fa30332d8cd8bbeb70b",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/67f047c7-3782-424e-b47d-bb5f986b0e76/novel/analyze",
      "method": "POST",
      "message": "签名验证失败"
    }
  },
  {
    "id": "affcda1f-cd62-46d3-adc3-524ef4f79c8d",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766155026-80gh3gj",
    "signature": "923423908e767a19d5623a2b50951c7c1d4a4d7ad90d1fa30332d8cd8bbeb70b",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/67f047c7-3782-424e-b47d-bb5f986b0e76/novel/analyze",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "签名验证失败"
    }
  },
  {
    "id": "d1636fa7-d172-44dc-b389-3803f8e6735d",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766155026-80gh3gj",
    "signature": null,
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/67f047c7-3782-424e-b47d-bb5f986b0e76/novel/analyze",
      "nonce": "nonce-1766155026-80gh3gj",
      "method": "POST",
      "reason": "HMAC_SIGNATURE_MISMATCH",
      "timestamp": "1766155026"
    }
  },
  {
    "id": "65d79262-61d3-4670-9e2f-c939b0eec8f6",
    "action": "NOVEL_IMPORT",
    "resourceType": "project",
    "resourceId": "67f047c7-3782-424e-b47d-bb5f986b0e76",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "67f047c7-3782-424e-b47d-bb5f986b0e76",
      "importMode": "text",
      "novelTitle": "Smoke Test Novel",
      "chapterCount": 1,
      "novelSourceId": "cfed60d9-6c6d-4aa3-98f5-d6eaf497c4a9",
      "characterCount": 146
    }
  },
  {
    "id": "7e8e642c-ba24-4cd5-8b1d-b2445ca545cd",
    "action": "JOB_CREATED",
    "resourceType": "job",
    "resourceId": "98517bd2-495e-4960-9c01-bd03ccfd80d7",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "taskId": "fa24d33d-2b4b-400e-88ce-be09744294fc"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "PENDING",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 4
  },
  {
    "table_name": "seasons",
    "count": 4,
    "unique_projects": 3
  },
  {
    "table_name": "episodes",
    "count": 3,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 2,
    "unique_episodes": 2
  },
  {
    "table_name": "shots",
    "count": 2,
    "unique_scenes": 2
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "4011dd8f-392f-4782-bdfa-8c9d8408a1ce",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766155026-80gh3gj",
        "signature": "923423908e767a19d5623a2b50951c7c1d4a4d7ad90d1fa30332d8cd8bbeb70b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/67f047c7-3782-424e-b47d-bb5f986b0e76/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "affcda1f-cd62-46d3-adc3-524ef4f79c8d",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766155026-80gh3gj",
        "signature": "923423908e767a19d5623a2b50951c7c1d4a4d7ad90d1fa30332d8cd8bbeb70b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/67f047c7-3782-424e-b47d-bb5f986b0e76/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "d1636fa7-d172-44dc-b389-3803f8e6735d",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766155026-80gh3gj",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/67f047c7-3782-424e-b47d-bb5f986b0e76/novel/analyze",
          "nonce": "nonce-1766155026-80gh3gj",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766155026"
        }
      },
      {
        "id": "65d79262-61d3-4670-9e2f-c939b0eec8f6",
        "action": "NOVEL_IMPORT",
        "resourceType": "project",
        "resourceId": "67f047c7-3782-424e-b47d-bb5f986b0e76",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "67f047c7-3782-424e-b47d-bb5f986b0e76",
          "importMode": "text",
          "novelTitle": "Smoke Test Novel",
          "chapterCount": 1,
          "novelSourceId": "cfed60d9-6c6d-4aa3-98f5-d6eaf497c4a9",
          "characterCount": 146
        }
      },
      {
        "id": "7e8e642c-ba24-4cd5-8b1d-b2445ca545cd",
        "action": "JOB_CREATED",
        "resourceType": "job",
        "resourceId": "98517bd2-495e-4960-9c01-bd03ccfd80d7",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "fa24d33d-2b4b-400e-88ce-be09744294fc"
        }
      },
      {
        "id": "a5b51e82-b14f-42cd-9364-24f605f5ad1e",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "fa24d33d-2b4b-400e-88ce-be09744294fc",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "2cd67f7a-3515-4fde-8f37-6e9acd97e0a6"
        }
      },
      {
        "id": "9cfa61e8-7ceb-4cf3-b62f-6380bb1592a7",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "70178da3-eefb-4d16-ad99-b850a75d6a10",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766155026146",
          "capabilities": {}
        }
      },
      {
        "id": "50494c03-a069-40dc-8ec5-b9ec16c4180b",
        "action": "SHOT_CREATE",
        "resourceType": "/api/projects/scenes/:sceneId/shots",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/scenes/5109f0e4-7bbb-4ef1-bc25-bfeb49be4b94/shots",
          "method": "POST"
        }
      },
      {
        "id": "c1e59fa5-a18d-44f0-8726-7c1690ab7536",
        "action": "SHOT_CREATE",
        "resourceType": "shot",
        "resourceId": "5155e556-7c21-4be0-a556-4abe75009289",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "sceneId": "5109f0e4-7bbb-4ef1-bc25-bfeb49be4b94",
          "shotIndex": 1
        }
      },
      {
        "id": "4808b71c-ce9a-4247-be6e-0af92b1b61a7",
        "action": "SCENE_CREATE",
        "resourceType": "/api/projects/episodes/:episodeId/scenes",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/episodes/83ad5c69-8390-4637-8592-b64b5f8a19cc/scenes",
          "method": "POST"
        }
      },
      {
        "id": "36977f56-436b-4fbc-bfeb-e00a1831f5d3",
        "action": "SCENE_CREATE",
        "resourceType": "scene",
        "resourceId": "5109f0e4-7bbb-4ef1-bc25-bfeb49be4b94",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "episodeId": "83ad5c69-8390-4637-8592-b64b5f8a19cc",
          "sceneIndex": 1
        }
      },
      {
        "id": "65eb8ce4-c842-42f3-a8a3-21365435d191",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "67f047c7-3782-424e-b47d-bb5f986b0e76",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/67f047c7-3782-424e-b47d-bb5f986b0e76/episodes",
          "method": "POST"
        }
      },
      {
        "id": "8a985059-f6c5-4805-9142-42e62b599a8e",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "83ad5c69-8390-4637-8592-b64b5f8a19cc",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "67f047c7-3782-424e-b47d-bb5f986b0e76",
          "episodeIndex": 1
        }
      },
      {
        "id": "909677c5-5633-402f-a5e3-fa951a483083",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "b002b25d-7537-4aff-be4c-3a95c319d6f0",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "67f047c7-3782-424e-b47d-bb5f986b0e76",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766155026042",
          "organizationId": "2cd67f7a-3515-4fde-8f37-6e9acd97e0a6"
        }
      },
      {
        "id": "1343410f-ec87-44ce-8f8b-4d8eddaa59de",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766155025-5gyze9",
        "signature": "9910608dc9ce59f029c8c902dcb40b923005daf2b59534178c58b9b873021bf4",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "7d3be23a-f460-44aa-a679-77c463ac9cf8",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766155025-5gyze9",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766155026
        }
      },
      {
        "id": "b9cedb77-5128-4acb-87ec-920a5d117673",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "4b9c03c7-6a78-4597-b793-06edbf907afc",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/4b9c03c7-6a78-4597-b793-06edbf907afc/episodes",
          "method": "POST"
        }
      },
      {
        "id": "8edb4e18-5c9c-4bcb-aff9-81440f583e62",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "665e2a20-d0be-4c38-9673-01fe46dc92d5",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "4b9c03c7-6a78-4597-b793-06edbf907afc",
          "episodeIndex": 1
        }
      },
      {
        "id": "35e38daa-872f-478e-9d65-19ecbd77cd2a",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "PENDING",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 4
      },
      {
        "table_name": "seasons",
        "count": 4,
        "unique_projects": 3
      },
      {
        "table_name": "episodes",
        "count": 3,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 2,
        "unique_episodes": 2
      },
      {
        "table_name": "shots",
        "count": 2,
        "unique_scenes": 2
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "dac8d765-83ad-4e16-a205-fc8c7a40f88c",
    "action": "API_SIGNATURE_ERROR",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766154800-02kdr9",
    "signature": "3ccbbe3bee0ae8a74451826870dfb21b2483fcbaace493bb052cc4dfcca9510b",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/98915463-127d-4d96-b646-54a307c9a0f3/novel/analyze",
      "method": "POST",
      "message": "签名验证失败"
    }
  },
  {
    "id": "2bfc066b-76f9-4ee6-9418-2eb432ffd49a",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766154800-02kdr9",
    "signature": "3ccbbe3bee0ae8a74451826870dfb21b2483fcbaace493bb052cc4dfcca9510b",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/98915463-127d-4d96-b646-54a307c9a0f3/novel/analyze",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "签名验证失败"
    }
  },
  {
    "id": "27707eef-0781-4615-b22c-29fb44517b39",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766154800-02kdr9",
    "signature": null,
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/98915463-127d-4d96-b646-54a307c9a0f3/novel/analyze",
      "nonce": "nonce-1766154800-02kdr9",
      "method": "POST",
      "reason": "HMAC_SIGNATURE_MISMATCH",
      "timestamp": "1766154800"
    }
  },
  {
    "id": "ed391811-4f3e-47dd-a654-ce467bf96cc3",
    "action": "NOVEL_IMPORT",
    "resourceType": "project",
    "resourceId": "98915463-127d-4d96-b646-54a307c9a0f3",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "98915463-127d-4d96-b646-54a307c9a0f3",
      "importMode": "text",
      "novelTitle": "Smoke Test Novel",
      "chapterCount": 1,
      "novelSourceId": "aa8de501-a212-4e06-a83e-94a2da08c41b",
      "characterCount": 146
    }
  },
  {
    "id": "ed161ff7-ac03-424a-bcc7-3bd3524ef9e5",
    "action": "JOB_CREATED",
    "resourceType": "job",
    "resourceId": "ca9d605f-6ce2-49b7-9431-2680bff6aec4",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "taskId": "74a141ed-d108-43e3-92e9-ad80cfd84718"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "PENDING",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 4
  },
  {
    "table_name": "seasons",
    "count": 4,
    "unique_projects": 3
  },
  {
    "table_name": "episodes",
    "count": 3,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 2,
    "unique_episodes": 2
  },
  {
    "table_name": "shots",
    "count": 2,
    "unique_scenes": 2
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "dac8d765-83ad-4e16-a205-fc8c7a40f88c",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766154800-02kdr9",
        "signature": "3ccbbe3bee0ae8a74451826870dfb21b2483fcbaace493bb052cc4dfcca9510b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/98915463-127d-4d96-b646-54a307c9a0f3/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "2bfc066b-76f9-4ee6-9418-2eb432ffd49a",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766154800-02kdr9",
        "signature": "3ccbbe3bee0ae8a74451826870dfb21b2483fcbaace493bb052cc4dfcca9510b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/98915463-127d-4d96-b646-54a307c9a0f3/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "27707eef-0781-4615-b22c-29fb44517b39",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766154800-02kdr9",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/98915463-127d-4d96-b646-54a307c9a0f3/novel/analyze",
          "nonce": "nonce-1766154800-02kdr9",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766154800"
        }
      },
      {
        "id": "ed391811-4f3e-47dd-a654-ce467bf96cc3",
        "action": "NOVEL_IMPORT",
        "resourceType": "project",
        "resourceId": "98915463-127d-4d96-b646-54a307c9a0f3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "98915463-127d-4d96-b646-54a307c9a0f3",
          "importMode": "text",
          "novelTitle": "Smoke Test Novel",
          "chapterCount": 1,
          "novelSourceId": "aa8de501-a212-4e06-a83e-94a2da08c41b",
          "characterCount": 146
        }
      },
      {
        "id": "ed161ff7-ac03-424a-bcc7-3bd3524ef9e5",
        "action": "JOB_CREATED",
        "resourceType": "job",
        "resourceId": "ca9d605f-6ce2-49b7-9431-2680bff6aec4",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "74a141ed-d108-43e3-92e9-ad80cfd84718"
        }
      },
      {
        "id": "bb1a123c-ae46-4652-be33-cf37c3fe0195",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "74a141ed-d108-43e3-92e9-ad80cfd84718",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "dcdf0604-6d97-4747-b500-fb35ed083a43"
        }
      },
      {
        "id": "4c61217c-3fa2-44a5-b16d-e292dc25f1d1",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "de5ce701-b233-4ce0-89ce-fbce412196c3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766154800276",
          "capabilities": {}
        }
      },
      {
        "id": "d6ab2c67-65a7-48fd-bd73-2b8be46c8151",
        "action": "SHOT_CREATE",
        "resourceType": "/api/projects/scenes/:sceneId/shots",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/scenes/5162caeb-27bf-4eca-8b4d-11503fe74190/shots",
          "method": "POST"
        }
      },
      {
        "id": "792f9d1b-9d98-49a2-a215-f0dc40b85e3d",
        "action": "SHOT_CREATE",
        "resourceType": "shot",
        "resourceId": "f8aa871b-e175-495e-8433-9d9b779643f2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "sceneId": "5162caeb-27bf-4eca-8b4d-11503fe74190",
          "shotIndex": 1
        }
      },
      {
        "id": "318086b5-3e6b-4a91-8973-1b36be8c6991",
        "action": "SCENE_CREATE",
        "resourceType": "/api/projects/episodes/:episodeId/scenes",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/episodes/c9623202-504a-448b-b626-5196082baaf6/scenes",
          "method": "POST"
        }
      },
      {
        "id": "f3977e8f-0e68-4a22-99bf-fa9b0445bbc1",
        "action": "SCENE_CREATE",
        "resourceType": "scene",
        "resourceId": "5162caeb-27bf-4eca-8b4d-11503fe74190",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "episodeId": "c9623202-504a-448b-b626-5196082baaf6",
          "sceneIndex": 1
        }
      },
      {
        "id": "1095ba59-53a2-489b-833c-53d6eb7c3728",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "98915463-127d-4d96-b646-54a307c9a0f3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/98915463-127d-4d96-b646-54a307c9a0f3/episodes",
          "method": "POST"
        }
      },
      {
        "id": "efddd802-2949-4758-a5a4-70d45d309c03",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "c9623202-504a-448b-b626-5196082baaf6",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "98915463-127d-4d96-b646-54a307c9a0f3",
          "episodeIndex": 1
        }
      },
      {
        "id": "738522a1-e036-4b1d-b449-fc72e62b404a",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "e59c8741-dba1-42dc-b15d-18876a72cf83",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "98915463-127d-4d96-b646-54a307c9a0f3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766154800174",
          "organizationId": "dcdf0604-6d97-4747-b500-fb35ed083a43"
        }
      },
      {
        "id": "e1aa5424-9ced-4b24-97ac-f0a69bf9b71d",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766154800-j5ikhi",
        "signature": "cdc3cfd6dd50ff4239262f59eb1db2851ca335a00ace5826a5cb5464b7ffe29f",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "de4aed87-350e-44ea-839a-cf6cca881329",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766154800-j5ikhi",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766154801
        }
      },
      {
        "id": "d60fba1d-8d73-4740-b8c3-c9658c589d71",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "a06cce3b-c19c-4db3-a283-89bb7e19667f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/a06cce3b-c19c-4db3-a283-89bb7e19667f/episodes",
          "method": "POST"
        }
      },
      {
        "id": "f2073251-1d39-4ae4-a66e-b2642a1fc1e0",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "45d7c198-5455-42f8-b359-9f02b57f2d17",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "a06cce3b-c19c-4db3-a283-89bb7e19667f",
          "episodeIndex": 1
        }
      },
      {
        "id": "378f4e1e-33fe-414c-af8d-401598498179",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "PENDING",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 4
      },
      {
        "table_name": "seasons",
        "count": 4,
        "unique_projects": 3
      },
      {
        "table_name": "episodes",
        "count": 3,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 2,
        "unique_episodes": 2
      },
      {
        "table_name": "shots",
        "count": 2,
        "unique_scenes": 2
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "6906b909-df36-406e-ab11-48c8668c5b8a",
    "action": "API_SIGNATURE_ERROR",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766154721-p31c7",
    "signature": "ce4abaf996ce8664c9c6fec43a822be9e6ebd1216e57746733ae7f26def6ef94",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/36d4c586-2cc4-4af7-bb38-8a31eb4a463e/novel/analyze",
      "method": "POST",
      "message": "签名验证失败"
    }
  },
  {
    "id": "1a62cdfa-c62e-4a49-891e-74516cb827ee",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766154721-p31c7",
    "signature": "ce4abaf996ce8664c9c6fec43a822be9e6ebd1216e57746733ae7f26def6ef94",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/36d4c586-2cc4-4af7-bb38-8a31eb4a463e/novel/analyze",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "签名验证失败"
    }
  },
  {
    "id": "7c69c771-b52a-4e28-a319-154747eb30d4",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766154721-p31c7",
    "signature": null,
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/36d4c586-2cc4-4af7-bb38-8a31eb4a463e/novel/analyze",
      "nonce": "nonce-1766154721-p31c7",
      "method": "POST",
      "reason": "HMAC_SIGNATURE_MISMATCH",
      "timestamp": "1766154721"
    }
  },
  {
    "id": "ae7da78a-4f14-401f-8cac-d96005dd5f64",
    "action": "NOVEL_IMPORT",
    "resourceType": "project",
    "resourceId": "36d4c586-2cc4-4af7-bb38-8a31eb4a463e",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "36d4c586-2cc4-4af7-bb38-8a31eb4a463e",
      "importMode": "text",
      "novelTitle": "Smoke Test Novel",
      "chapterCount": 1,
      "novelSourceId": "217a8564-0639-42d9-83ee-555001e65e89",
      "characterCount": 146
    }
  },
  {
    "id": "14f860a5-4d49-47fb-89b3-5efe9e0509de",
    "action": "JOB_CREATED",
    "resourceType": "job",
    "resourceId": "a0074e1c-695d-4862-a183-438dc718f779",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "taskId": "cf1cafbb-3451-4e16-8e8a-02eabebd3249"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "PENDING",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 4
  },
  {
    "table_name": "seasons",
    "count": 4,
    "unique_projects": 3
  },
  {
    "table_name": "episodes",
    "count": 3,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 2,
    "unique_episodes": 2
  },
  {
    "table_name": "shots",
    "count": 2,
    "unique_scenes": 2
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "6906b909-df36-406e-ab11-48c8668c5b8a",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766154721-p31c7",
        "signature": "ce4abaf996ce8664c9c6fec43a822be9e6ebd1216e57746733ae7f26def6ef94",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/36d4c586-2cc4-4af7-bb38-8a31eb4a463e/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "1a62cdfa-c62e-4a49-891e-74516cb827ee",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766154721-p31c7",
        "signature": "ce4abaf996ce8664c9c6fec43a822be9e6ebd1216e57746733ae7f26def6ef94",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/36d4c586-2cc4-4af7-bb38-8a31eb4a463e/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "7c69c771-b52a-4e28-a319-154747eb30d4",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766154721-p31c7",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/36d4c586-2cc4-4af7-bb38-8a31eb4a463e/novel/analyze",
          "nonce": "nonce-1766154721-p31c7",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766154721"
        }
      },
      {
        "id": "ae7da78a-4f14-401f-8cac-d96005dd5f64",
        "action": "NOVEL_IMPORT",
        "resourceType": "project",
        "resourceId": "36d4c586-2cc4-4af7-bb38-8a31eb4a463e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "36d4c586-2cc4-4af7-bb38-8a31eb4a463e",
          "importMode": "text",
          "novelTitle": "Smoke Test Novel",
          "chapterCount": 1,
          "novelSourceId": "217a8564-0639-42d9-83ee-555001e65e89",
          "characterCount": 146
        }
      },
      {
        "id": "14f860a5-4d49-47fb-89b3-5efe9e0509de",
        "action": "JOB_CREATED",
        "resourceType": "job",
        "resourceId": "a0074e1c-695d-4862-a183-438dc718f779",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "cf1cafbb-3451-4e16-8e8a-02eabebd3249"
        }
      },
      {
        "id": "a06edd45-7263-4f71-9b02-b3cdbbae6e19",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "cf1cafbb-3451-4e16-8e8a-02eabebd3249",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "85ce2715-3fb0-4f10-a0ee-fce5b254068b"
        }
      },
      {
        "id": "626c88f9-b89a-42bb-94d3-af1aa82da960",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "5ca47bba-7876-4d77-a25d-b1c1ff491050",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766154721743",
          "capabilities": {}
        }
      },
      {
        "id": "e6aab4a0-73a3-422b-a7f9-f5909c27dcb9",
        "action": "SHOT_CREATE",
        "resourceType": "/api/projects/scenes/:sceneId/shots",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/scenes/22cd994d-5a6f-4e43-b57c-6b26f76fdf99/shots",
          "method": "POST"
        }
      },
      {
        "id": "5c0fb430-7fdf-4295-b839-f0975ed4b3df",
        "action": "SHOT_CREATE",
        "resourceType": "shot",
        "resourceId": "4ce33d4a-4262-4848-baf7-7eaf14320c81",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "sceneId": "22cd994d-5a6f-4e43-b57c-6b26f76fdf99",
          "shotIndex": 1
        }
      },
      {
        "id": "ff0ca9a0-c47e-4344-849f-93746e0b3afe",
        "action": "SCENE_CREATE",
        "resourceType": "/api/projects/episodes/:episodeId/scenes",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/episodes/29b007c1-7594-450d-8d2b-d4fd0228eb93/scenes",
          "method": "POST"
        }
      },
      {
        "id": "b7a4d962-cb20-4c8c-be6b-ec7f303e5df2",
        "action": "SCENE_CREATE",
        "resourceType": "scene",
        "resourceId": "22cd994d-5a6f-4e43-b57c-6b26f76fdf99",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "episodeId": "29b007c1-7594-450d-8d2b-d4fd0228eb93",
          "sceneIndex": 1
        }
      },
      {
        "id": "1287c357-19de-4588-9709-62516361ca5e",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "36d4c586-2cc4-4af7-bb38-8a31eb4a463e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/36d4c586-2cc4-4af7-bb38-8a31eb4a463e/episodes",
          "method": "POST"
        }
      },
      {
        "id": "285548f5-a4ba-4e13-91c3-81e63120ec47",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "29b007c1-7594-450d-8d2b-d4fd0228eb93",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "36d4c586-2cc4-4af7-bb38-8a31eb4a463e",
          "episodeIndex": 1
        }
      },
      {
        "id": "3d23f520-0e76-459c-bd0f-e164bdf639e4",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "5e24d7fd-2211-4d32-ab6e-d7cb260ba8a9",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "36d4c586-2cc4-4af7-bb38-8a31eb4a463e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766154721639",
          "organizationId": "85ce2715-3fb0-4f10-a0ee-fce5b254068b"
        }
      },
      {
        "id": "f3414ed8-cdbb-483d-b019-bc76cbe54ac1",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766154721-oul73s",
        "signature": "c5aaa902255da632074daa9da40981be049b170290facfdc6fa80a7c4b711b71",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "7e8c6459-33a8-40d3-9720-7d44d9a867f4",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766154721-oul73s",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766154722
        }
      },
      {
        "id": "d73c4eb0-3483-49a9-9b48-c8727544425f",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "f9fac8a0-8ec6-4632-bd9a-dda191ee1e5a",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/f9fac8a0-8ec6-4632-bd9a-dda191ee1e5a/episodes",
          "method": "POST"
        }
      },
      {
        "id": "4d227f5c-e7b7-45e8-aaf6-307ddd997445",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "66ca3ff4-a762-4904-982b-6932039aeb43",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "f9fac8a0-8ec6-4632-bd9a-dda191ee1e5a",
          "episodeIndex": 1
        }
      },
      {
        "id": "af53beab-739f-4dd6-bddb-d7c5ba5447d6",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "PENDING",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 4
      },
      {
        "table_name": "seasons",
        "count": 4,
        "unique_projects": 3
      },
      {
        "table_name": "episodes",
        "count": 3,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 2,
        "unique_episodes": 2
      },
      {
        "table_name": "shots",
        "count": 2,
        "unique_scenes": 2
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "e03c9a69-9265-4bab-a432-093f3e122c08",
    "action": "API_SIGNATURE_ERROR",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766154624-gf60x",
    "signature": "ffaf6df045c33571ba71cc425c5e92733acb9b5d3c3d69b1de5c6d2185f57a66",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/131e06cb-962e-473f-bcef-daf81c832276/novel/analyze",
      "method": "POST",
      "message": "签名验证失败"
    }
  },
  {
    "id": "881f7d67-b199-4f65-a664-ae005daeefc1",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766154624-gf60x",
    "signature": "ffaf6df045c33571ba71cc425c5e92733acb9b5d3c3d69b1de5c6d2185f57a66",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/131e06cb-962e-473f-bcef-daf81c832276/novel/analyze",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "签名验证失败"
    }
  },
  {
    "id": "f49c3684-c9c8-4c51-9708-7d9d034a806c",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766154624-gf60x",
    "signature": null,
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/131e06cb-962e-473f-bcef-daf81c832276/novel/analyze",
      "nonce": "nonce-1766154624-gf60x",
      "method": "POST",
      "reason": "HMAC_SIGNATURE_MISMATCH",
      "timestamp": "1766154624"
    }
  },
  {
    "id": "4666d76a-2526-47d4-ab48-4e905a90f1ba",
    "action": "NOVEL_IMPORT",
    "resourceType": "project",
    "resourceId": "131e06cb-962e-473f-bcef-daf81c832276",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "131e06cb-962e-473f-bcef-daf81c832276",
      "importMode": "text",
      "novelTitle": "Smoke Test Novel",
      "chapterCount": 1,
      "novelSourceId": "15aab709-7b78-4c38-a0d3-49ef9166da4b",
      "characterCount": 146
    }
  },
  {
    "id": "cea7d145-2731-4b7b-93b1-80398564ac3f",
    "action": "JOB_CREATED",
    "resourceType": "job",
    "resourceId": "108e9225-7c35-4d02-9cdc-3e3df2fd8de8",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "taskId": "b65da7d2-8e01-4336-93a6-78f8812f1211"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "PENDING",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 4
  },
  {
    "table_name": "seasons",
    "count": 4,
    "unique_projects": 3
  },
  {
    "table_name": "episodes",
    "count": 3,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 2,
    "unique_episodes": 2
  },
  {
    "table_name": "shots",
    "count": 2,
    "unique_scenes": 2
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "e03c9a69-9265-4bab-a432-093f3e122c08",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766154624-gf60x",
        "signature": "ffaf6df045c33571ba71cc425c5e92733acb9b5d3c3d69b1de5c6d2185f57a66",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/131e06cb-962e-473f-bcef-daf81c832276/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "881f7d67-b199-4f65-a664-ae005daeefc1",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766154624-gf60x",
        "signature": "ffaf6df045c33571ba71cc425c5e92733acb9b5d3c3d69b1de5c6d2185f57a66",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/131e06cb-962e-473f-bcef-daf81c832276/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "f49c3684-c9c8-4c51-9708-7d9d034a806c",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766154624-gf60x",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/131e06cb-962e-473f-bcef-daf81c832276/novel/analyze",
          "nonce": "nonce-1766154624-gf60x",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766154624"
        }
      },
      {
        "id": "4666d76a-2526-47d4-ab48-4e905a90f1ba",
        "action": "NOVEL_IMPORT",
        "resourceType": "project",
        "resourceId": "131e06cb-962e-473f-bcef-daf81c832276",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "131e06cb-962e-473f-bcef-daf81c832276",
          "importMode": "text",
          "novelTitle": "Smoke Test Novel",
          "chapterCount": 1,
          "novelSourceId": "15aab709-7b78-4c38-a0d3-49ef9166da4b",
          "characterCount": 146
        }
      },
      {
        "id": "cea7d145-2731-4b7b-93b1-80398564ac3f",
        "action": "JOB_CREATED",
        "resourceType": "job",
        "resourceId": "108e9225-7c35-4d02-9cdc-3e3df2fd8de8",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "b65da7d2-8e01-4336-93a6-78f8812f1211"
        }
      },
      {
        "id": "c3f4c956-89e6-4a93-9b8e-c344245d3d17",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "b65da7d2-8e01-4336-93a6-78f8812f1211",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "56b20b53-e970-4aa7-ac55-10c705c9bd54"
        }
      },
      {
        "id": "f76bae35-cd4a-407a-be55-d7ec6d3f3017",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "7d4c0747-96ae-4af7-915e-1b36b81dc899",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766154624178",
          "capabilities": {}
        }
      },
      {
        "id": "6e97e11c-e787-4d1d-b3be-87f403ec1107",
        "action": "SHOT_CREATE",
        "resourceType": "/api/projects/scenes/:sceneId/shots",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/scenes/0eed8bba-af8c-4dc9-960a-e176621575d4/shots",
          "method": "POST"
        }
      },
      {
        "id": "be3e5585-0103-4a12-a7ef-f13b334273be",
        "action": "SHOT_CREATE",
        "resourceType": "shot",
        "resourceId": "049d2604-5059-429b-8731-d2b8ed790d7a",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "sceneId": "0eed8bba-af8c-4dc9-960a-e176621575d4",
          "shotIndex": 1
        }
      },
      {
        "id": "8219592c-e2d7-411b-ae1a-cd8dc9faee8d",
        "action": "SCENE_CREATE",
        "resourceType": "/api/projects/episodes/:episodeId/scenes",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/episodes/bd7680c8-9aec-4d53-af5d-836495bd9731/scenes",
          "method": "POST"
        }
      },
      {
        "id": "542bf90a-85a4-4057-92ee-8d4be3e22cf5",
        "action": "SCENE_CREATE",
        "resourceType": "scene",
        "resourceId": "0eed8bba-af8c-4dc9-960a-e176621575d4",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "episodeId": "bd7680c8-9aec-4d53-af5d-836495bd9731",
          "sceneIndex": 1
        }
      },
      {
        "id": "92229a6d-4359-4113-bb10-89cc27580444",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "131e06cb-962e-473f-bcef-daf81c832276",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/131e06cb-962e-473f-bcef-daf81c832276/episodes",
          "method": "POST"
        }
      },
      {
        "id": "c27a11e2-5748-4131-a528-07eea1906563",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "bd7680c8-9aec-4d53-af5d-836495bd9731",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "131e06cb-962e-473f-bcef-daf81c832276",
          "episodeIndex": 1
        }
      },
      {
        "id": "685632e5-3b2e-4c98-a8b2-c154765d435f",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "1dcac292-14de-4dcc-86d4-94b4251c919d",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "131e06cb-962e-473f-bcef-daf81c832276",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766154624089",
          "organizationId": "56b20b53-e970-4aa7-ac55-10c705c9bd54"
        }
      },
      {
        "id": "625dbf24-4dd0-4d84-b349-cb1056ebe48c",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766154623-waz93w",
        "signature": "3643f77ed007c10c2bb9ba1d3fbddab16ac932aaa6b5b95d44244f4b9f9187d6",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "NONCE_REPLAY: Nonce replay detected"
        }
      },
      {
        "id": "be2d6f8e-fcf4-4ee9-83f7-d9d177e73f4a",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766154623-waz93w",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766154624
        }
      },
      {
        "id": "c663fbb4-a37a-447b-a098-76cdac5493bf",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "2a610ad3-349b-43d5-b89d-b944c392da83",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/2a610ad3-349b-43d5-b89d-b944c392da83/episodes",
          "method": "POST"
        }
      },
      {
        "id": "eafaacb4-d70c-4044-af8e-b760f5d1b8d8",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "07ee18e4-fd17-490c-841b-3c8e2743be66",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "2a610ad3-349b-43d5-b89d-b944c392da83",
          "episodeIndex": 1
        }
      },
      {
        "id": "b08425a8-19e6-4e39-9ca9-2c42c3d48322",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "PENDING",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 4
      },
      {
        "table_name": "seasons",
        "count": 4,
        "unique_projects": 3
      },
      {
        "table_name": "episodes",
        "count": 3,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 2,
        "unique_episodes": 2
      },
      {
        "table_name": "shots",
        "count": 2,
        "unique_scenes": 2
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "f9eb83d9-6eed-4659-91e0-d9f752574da6",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766153650-4d462",
    "signature": "7ce36b647e97937f7017346e03ad84a2bb76134da92a116c86506d3933bb3718",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/bd4ffd4f-2b2e-4d46-ae27-f24c8910e8e6/novel/analyze",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "expectedSignature is not defined"
    }
  },
  {
    "id": "ace05f7f-8976-42da-8a1a-e39c1abf5364",
    "action": "NOVEL_IMPORT",
    "resourceType": "project",
    "resourceId": "bd4ffd4f-2b2e-4d46-ae27-f24c8910e8e6",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "bd4ffd4f-2b2e-4d46-ae27-f24c8910e8e6",
      "importMode": "text",
      "novelTitle": "Smoke Test Novel",
      "chapterCount": 1,
      "novelSourceId": "1f7a92ab-14e9-4d79-8eb9-408ef458fd05",
      "characterCount": 146
    }
  },
  {
    "id": "4b8175e1-f1ab-4cd8-be56-5271b0b1befb",
    "action": "JOB_CREATED",
    "resourceType": "job",
    "resourceId": "8573f2a0-6cf4-479a-a709-4176deff2c0f",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "taskId": "bf0b8406-1051-44e2-8337-ace109f3a548"
    }
  },
  {
    "id": "3768422a-5fb2-4b71-8659-f2c2cfab67aa",
    "action": "TASK_CREATED",
    "resourceType": "task",
    "resourceId": "bf0b8406-1051-44e2-8337-ace109f3a548",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "organizationId": "6301bdd1-6d72-473b-afc7-c809c5d5b15b"
    }
  },
  {
    "id": "3ad638fd-5d3c-449b-9948-e1875c27c13b",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "2a9804b3-d785-4d42-8ed5-3b1998277e76",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766153650891",
      "capabilities": {}
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "PENDING",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 4
  },
  {
    "table_name": "seasons",
    "count": 4,
    "unique_projects": 3
  },
  {
    "table_name": "episodes",
    "count": 3,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 2,
    "unique_episodes": 2
  },
  {
    "table_name": "shots",
    "count": 2,
    "unique_scenes": 2
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "f9eb83d9-6eed-4659-91e0-d9f752574da6",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766153650-4d462",
        "signature": "7ce36b647e97937f7017346e03ad84a2bb76134da92a116c86506d3933bb3718",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/bd4ffd4f-2b2e-4d46-ae27-f24c8910e8e6/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "expectedSignature is not defined"
        }
      },
      {
        "id": "ace05f7f-8976-42da-8a1a-e39c1abf5364",
        "action": "NOVEL_IMPORT",
        "resourceType": "project",
        "resourceId": "bd4ffd4f-2b2e-4d46-ae27-f24c8910e8e6",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "bd4ffd4f-2b2e-4d46-ae27-f24c8910e8e6",
          "importMode": "text",
          "novelTitle": "Smoke Test Novel",
          "chapterCount": 1,
          "novelSourceId": "1f7a92ab-14e9-4d79-8eb9-408ef458fd05",
          "characterCount": 146
        }
      },
      {
        "id": "4b8175e1-f1ab-4cd8-be56-5271b0b1befb",
        "action": "JOB_CREATED",
        "resourceType": "job",
        "resourceId": "8573f2a0-6cf4-479a-a709-4176deff2c0f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "bf0b8406-1051-44e2-8337-ace109f3a548"
        }
      },
      {
        "id": "3768422a-5fb2-4b71-8659-f2c2cfab67aa",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "bf0b8406-1051-44e2-8337-ace109f3a548",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "6301bdd1-6d72-473b-afc7-c809c5d5b15b"
        }
      },
      {
        "id": "3ad638fd-5d3c-449b-9948-e1875c27c13b",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "2a9804b3-d785-4d42-8ed5-3b1998277e76",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766153650891",
          "capabilities": {}
        }
      },
      {
        "id": "9a9b9474-109a-4aa3-ae8e-0ff7b303b8cb",
        "action": "SHOT_CREATE",
        "resourceType": "/api/projects/scenes/:sceneId/shots",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/scenes/00930353-6d8f-4ca1-9d3a-01f47aca849e/shots",
          "method": "POST"
        }
      },
      {
        "id": "0435f00b-43c8-4a32-8899-b332f8b8e76f",
        "action": "SHOT_CREATE",
        "resourceType": "shot",
        "resourceId": "846763cb-3bc8-4d51-b21d-ccee87712e41",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "sceneId": "00930353-6d8f-4ca1-9d3a-01f47aca849e",
          "shotIndex": 1
        }
      },
      {
        "id": "1fed5987-94e3-40bc-a933-063ceed24acd",
        "action": "SCENE_CREATE",
        "resourceType": "/api/projects/episodes/:episodeId/scenes",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/episodes/c7c4ef7f-0c03-40bc-81b4-16432605a4ad/scenes",
          "method": "POST"
        }
      },
      {
        "id": "7715d9fc-8c59-4b48-8956-2b511747abb5",
        "action": "SCENE_CREATE",
        "resourceType": "scene",
        "resourceId": "00930353-6d8f-4ca1-9d3a-01f47aca849e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "episodeId": "c7c4ef7f-0c03-40bc-81b4-16432605a4ad",
          "sceneIndex": 1
        }
      },
      {
        "id": "33201e7a-7c84-42ff-98ac-4c03c5174a6d",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "bd4ffd4f-2b2e-4d46-ae27-f24c8910e8e6",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/bd4ffd4f-2b2e-4d46-ae27-f24c8910e8e6/episodes",
          "method": "POST"
        }
      },
      {
        "id": "a86e01f3-3e28-48c9-94be-127a4155f37c",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "c7c4ef7f-0c03-40bc-81b4-16432605a4ad",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "bd4ffd4f-2b2e-4d46-ae27-f24c8910e8e6",
          "episodeIndex": 1
        }
      },
      {
        "id": "bfee13ac-9efa-4977-bc69-38158e3ad45b",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "36d318af-5b08-4bc2-ba02-e20206110012",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "bd4ffd4f-2b2e-4d46-ae27-f24c8910e8e6",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766153650816",
          "organizationId": "6301bdd1-6d72-473b-afc7-c809c5d5b15b"
        }
      },
      {
        "id": "5ce6e14c-82c5-4a23-82a8-ead47353dd7b",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766153650-76z75n",
        "signature": "dca034fab82f6045f1d2562a7b0ecd77937dd1636e7277ce5cba8125767ab8f2",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "NONCE_REPLAY: Nonce replay detected"
        }
      },
      {
        "id": "848c5ac0-f830-4636-9d22-a1410a726581",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766153650-76z75n",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766153651
        }
      },
      {
        "id": "90868c80-ac02-46f3-a327-1b7b0169bf7d",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "2023a447-acca-4833-ba1b-7d85e92a8df3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/2023a447-acca-4833-ba1b-7d85e92a8df3/episodes",
          "method": "POST"
        }
      },
      {
        "id": "ae7ce14f-0bdf-473b-a11a-30e10922a124",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "7ddd2d8a-ed85-4b93-98f4-46ac34342faf",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "2023a447-acca-4833-ba1b-7d85e92a8df3",
          "episodeIndex": 1
        }
      },
      {
        "id": "43a7c64c-a45e-4d64-ae05-b5f163c63745",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "32721319-c938-4bc6-92a8-694f9e50052d",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "2023a447-acca-4833-ba1b-7d85e92a8df3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "P0 Verify Project",
          "organizationId": "6301bdd1-6d72-473b-afc7-c809c5d5b15b"
        }
      },
      {
        "id": "f3e121d1-c620-4997-9cd9-9350a17d83ed",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766153649-5doqrp",
        "signature": "b664a03502dce63bd103efe0dab1711c6d76351b4731825249451aafefc6bb8b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "NONCE_REPLAY: Nonce replay detected"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "PENDING",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 4
      },
      {
        "table_name": "seasons",
        "count": 4,
        "unique_projects": 3
      },
      {
        "table_name": "episodes",
        "count": 3,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 2,
        "unique_episodes": 2
      },
      {
        "table_name": "shots",
        "count": 2,
        "unique_scenes": 2
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "9e045e0e-01e5-49b4-94e4-ac5f448f2f13",
    "action": "API_SIGNATURE_ERROR",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766153536-4cnidm",
    "signature": "25f18a73353ccd0831174a7d831a1a8004d5a2385dfca6d6e6494793af11dafc",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/c9afa933-56bf-4866-b93d-cf1f9a8b8b45/novel/analyze",
      "method": "POST",
      "message": "签名验证失败"
    }
  },
  {
    "id": "0f1e9cd3-a007-46ed-b638-52c892d14c2d",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766153536-4cnidm",
    "signature": "25f18a73353ccd0831174a7d831a1a8004d5a2385dfca6d6e6494793af11dafc",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/c9afa933-56bf-4866-b93d-cf1f9a8b8b45/novel/analyze",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "签名验证失败"
    }
  },
  {
    "id": "7bfcf4ed-c2e6-427e-b84b-54da1448d7e6",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766153536-4cnidm",
    "signature": null,
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/c9afa933-56bf-4866-b93d-cf1f9a8b8b45/novel/analyze",
      "nonce": "nonce-1766153536-4cnidm",
      "method": "POST",
      "reason": "HMAC_SIGNATURE_MISMATCH",
      "timestamp": "1766153536"
    }
  },
  {
    "id": "d952aad1-5cf3-4a38-926b-48980f4aa0f9",
    "action": "NOVEL_IMPORT",
    "resourceType": "project",
    "resourceId": "c9afa933-56bf-4866-b93d-cf1f9a8b8b45",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "c9afa933-56bf-4866-b93d-cf1f9a8b8b45",
      "importMode": "text",
      "novelTitle": "Smoke Test Novel",
      "chapterCount": 1,
      "novelSourceId": "012ab045-905c-49d6-88ca-b6e4e3cfdbd3",
      "characterCount": 146
    }
  },
  {
    "id": "ff6870b8-f0f0-4406-8df2-2367a684a6e1",
    "action": "JOB_CREATED",
    "resourceType": "job",
    "resourceId": "24be9fa1-bf4a-4d48-9448-0611c9fcff99",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "taskId": "1f3d8ba3-90b6-4a3d-9689-4bdc6dc6baae"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "PENDING",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 4
  },
  {
    "table_name": "seasons",
    "count": 4,
    "unique_projects": 3
  },
  {
    "table_name": "episodes",
    "count": 3,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 2,
    "unique_episodes": 2
  },
  {
    "table_name": "shots",
    "count": 2,
    "unique_scenes": 2
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "9e045e0e-01e5-49b4-94e4-ac5f448f2f13",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766153536-4cnidm",
        "signature": "25f18a73353ccd0831174a7d831a1a8004d5a2385dfca6d6e6494793af11dafc",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/c9afa933-56bf-4866-b93d-cf1f9a8b8b45/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "0f1e9cd3-a007-46ed-b638-52c892d14c2d",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766153536-4cnidm",
        "signature": "25f18a73353ccd0831174a7d831a1a8004d5a2385dfca6d6e6494793af11dafc",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/c9afa933-56bf-4866-b93d-cf1f9a8b8b45/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "7bfcf4ed-c2e6-427e-b84b-54da1448d7e6",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766153536-4cnidm",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/c9afa933-56bf-4866-b93d-cf1f9a8b8b45/novel/analyze",
          "nonce": "nonce-1766153536-4cnidm",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766153536"
        }
      },
      {
        "id": "d952aad1-5cf3-4a38-926b-48980f4aa0f9",
        "action": "NOVEL_IMPORT",
        "resourceType": "project",
        "resourceId": "c9afa933-56bf-4866-b93d-cf1f9a8b8b45",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "c9afa933-56bf-4866-b93d-cf1f9a8b8b45",
          "importMode": "text",
          "novelTitle": "Smoke Test Novel",
          "chapterCount": 1,
          "novelSourceId": "012ab045-905c-49d6-88ca-b6e4e3cfdbd3",
          "characterCount": 146
        }
      },
      {
        "id": "ff6870b8-f0f0-4406-8df2-2367a684a6e1",
        "action": "JOB_CREATED",
        "resourceType": "job",
        "resourceId": "24be9fa1-bf4a-4d48-9448-0611c9fcff99",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "1f3d8ba3-90b6-4a3d-9689-4bdc6dc6baae"
        }
      },
      {
        "id": "e318f86f-a9e8-447c-8b2f-b39967e2ea08",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "1f3d8ba3-90b6-4a3d-9689-4bdc6dc6baae",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "9c04e674-b478-40fc-bb35-1fa5365e6193"
        }
      },
      {
        "id": "ed92c590-2316-430e-9945-a251accefe74",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "7e9b4deb-d673-48d8-82e4-a8bb43507220",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766153536918",
          "capabilities": {}
        }
      },
      {
        "id": "acc920eb-65b3-4eed-a70f-565cb35c1d2d",
        "action": "SHOT_CREATE",
        "resourceType": "/api/projects/scenes/:sceneId/shots",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/scenes/944a8632-3e91-4391-a365-6ecc76a2499c/shots",
          "method": "POST"
        }
      },
      {
        "id": "b7156699-7eff-4fee-98ed-76a22fdf1052",
        "action": "SHOT_CREATE",
        "resourceType": "shot",
        "resourceId": "17443902-93b4-4f1c-b518-618156294bdc",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "sceneId": "944a8632-3e91-4391-a365-6ecc76a2499c",
          "shotIndex": 1
        }
      },
      {
        "id": "7a1a7239-3c3e-4fff-9aa1-d30b159b49ce",
        "action": "SCENE_CREATE",
        "resourceType": "/api/projects/episodes/:episodeId/scenes",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/episodes/788858ba-7b3f-4015-a36d-9a50c25161d7/scenes",
          "method": "POST"
        }
      },
      {
        "id": "619626bf-cdcd-4862-854b-654ca223a392",
        "action": "SCENE_CREATE",
        "resourceType": "scene",
        "resourceId": "944a8632-3e91-4391-a365-6ecc76a2499c",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "episodeId": "788858ba-7b3f-4015-a36d-9a50c25161d7",
          "sceneIndex": 1
        }
      },
      {
        "id": "38a64e86-ad9f-48e3-8d1f-7b386533f526",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "c9afa933-56bf-4866-b93d-cf1f9a8b8b45",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/c9afa933-56bf-4866-b93d-cf1f9a8b8b45/episodes",
          "method": "POST"
        }
      },
      {
        "id": "5c51c5ef-6027-470c-841f-9d9bb1c2f436",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "788858ba-7b3f-4015-a36d-9a50c25161d7",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "c9afa933-56bf-4866-b93d-cf1f9a8b8b45",
          "episodeIndex": 1
        }
      },
      {
        "id": "5b9305b9-4e0f-452a-ac5f-3eb1a9ca6f52",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "46095b7b-5656-49f8-9e16-ea3d0c1ffb54",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "c9afa933-56bf-4866-b93d-cf1f9a8b8b45",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766153536831",
          "organizationId": "9c04e674-b478-40fc-bb35-1fa5365e6193"
        }
      },
      {
        "id": "176c8091-11ca-49e0-a506-f852e27a3e56",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766153536-moi045",
        "signature": "7ced7550eac7f4fa0777eb3794c2804e945a97cf8eaad3e9cdce977d63339999",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "NONCE_REPLAY: Nonce replay detected"
        }
      },
      {
        "id": "bfccc8f3-d800-4c82-89e9-c8a13ca92486",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766153536-moi045",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766153537
        }
      },
      {
        "id": "566c5add-8ecd-4483-9242-13aac1ed16c8",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "c9a68553-e2ec-4441-aa3b-c2ffbe4c6d79",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/c9a68553-e2ec-4441-aa3b-c2ffbe4c6d79/episodes",
          "method": "POST"
        }
      },
      {
        "id": "fe6cffdd-0905-4edb-82c1-b7f339d2eaca",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "e98b2e0d-8322-45bb-b04c-5dd692885973",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "c9a68553-e2ec-4441-aa3b-c2ffbe4c6d79",
          "episodeIndex": 1
        }
      },
      {
        "id": "e752a0b0-dbe5-4fbc-a67b-234d4ec023ea",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "PENDING",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 4
      },
      {
        "table_name": "seasons",
        "count": 4,
        "unique_projects": 3
      },
      {
        "table_name": "episodes",
        "count": 3,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 2,
        "unique_episodes": 2
      },
      {
        "table_name": "shots",
        "count": 2,
        "unique_scenes": 2
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "a281b7ec-68d3-4fa7-b596-4c0fdbd75118",
    "action": "TASK_CREATED",
    "resourceType": "task",
    "resourceId": "b2a941cb-5c82-4068-ab69-3b0341894c8f",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "organizationId": "f64a163c-822b-4afd-bf13-0e59d0769717"
    }
  },
  {
    "id": "9a64d111-7818-45ed-8c60-8308d105704f",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "57a61926-05f5-425d-a6ef-4b3a88ed37a7",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766153321903",
      "capabilities": {}
    }
  },
  {
    "id": "e0d76cbc-744a-4910-9c61-70a8cf80cfa2",
    "action": "EPISODE_CREATE",
    "resourceType": "/api/projects/:projectId/episodes",
    "resourceId": "d94d977d-12ff-4c03-b9ad-68b426c8e4ec",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/d94d977d-12ff-4c03-b9ad-68b426c8e4ec/episodes",
      "method": "POST"
    }
  },
  {
    "id": "903c49d6-9f91-4376-8387-0e5abd38a615",
    "action": "EPISODE_CREATE",
    "resourceType": "episode",
    "resourceId": "1caaf40d-d9dd-492a-bfff-80301194bf21",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "d94d977d-12ff-4c03-b9ad-68b426c8e4ec",
      "episodeIndex": 1
    }
  },
  {
    "id": "93ef89d5-b99d-4d7b-afae-11d24ee8628c",
    "action": "PROJECT_CREATE",
    "resourceType": "/api/projects",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 4
  },
  {
    "table_name": "seasons",
    "count": 4,
    "unique_projects": 3
  },
  {
    "table_name": "episodes",
    "count": 3,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 1,
    "unique_episodes": 1
  },
  {
    "table_name": "shots",
    "count": 1,
    "unique_scenes": 1
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "a281b7ec-68d3-4fa7-b596-4c0fdbd75118",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "b2a941cb-5c82-4068-ab69-3b0341894c8f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "f64a163c-822b-4afd-bf13-0e59d0769717"
        }
      },
      {
        "id": "9a64d111-7818-45ed-8c60-8308d105704f",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "57a61926-05f5-425d-a6ef-4b3a88ed37a7",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766153321903",
          "capabilities": {}
        }
      },
      {
        "id": "e0d76cbc-744a-4910-9c61-70a8cf80cfa2",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "d94d977d-12ff-4c03-b9ad-68b426c8e4ec",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/d94d977d-12ff-4c03-b9ad-68b426c8e4ec/episodes",
          "method": "POST"
        }
      },
      {
        "id": "903c49d6-9f91-4376-8387-0e5abd38a615",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "1caaf40d-d9dd-492a-bfff-80301194bf21",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "d94d977d-12ff-4c03-b9ad-68b426c8e4ec",
          "episodeIndex": 1
        }
      },
      {
        "id": "93ef89d5-b99d-4d7b-afae-11d24ee8628c",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "33400d4f-aad5-4604-8e02-8ef0253d747f",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "d94d977d-12ff-4c03-b9ad-68b426c8e4ec",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766153321864",
          "organizationId": "f64a163c-822b-4afd-bf13-0e59d0769717"
        }
      },
      {
        "id": "7eb2a53b-4c62-447c-87b0-f04d79382064",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766153321-hr13eh",
        "signature": "5a80069dabbefaad3d0022a32473e377710a95c0493417d1ceb83bbc5f08e8c0",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "8fa4d35c-c358-4077-be8f-9acbbfbaa5ed",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766153321-hr13eh",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766153322
        }
      },
      {
        "id": "218c80ec-ab9a-4a7d-9b02-2aa74aa111a4",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "f7a12d18-f263-4fa5-8934-355ebe30a9a0",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/f7a12d18-f263-4fa5-8934-355ebe30a9a0/episodes",
          "method": "POST"
        }
      },
      {
        "id": "2244dce7-ff74-45a8-8e89-e13a66a50658",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "ee58a654-094e-4139-880b-547d13460f4b",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "f7a12d18-f263-4fa5-8934-355ebe30a9a0",
          "episodeIndex": 1
        }
      },
      {
        "id": "00b51a21-6139-4105-8831-7a414f8e0ab7",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "7adca35b-ec3a-46ba-8322-6b55b12fde76",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "f7a12d18-f263-4fa5-8934-355ebe30a9a0",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "P0 Verify Project",
          "organizationId": "f64a163c-822b-4afd-bf13-0e59d0769717"
        }
      },
      {
        "id": "26979483-0ae5-448b-ba51-fb6ad544415e",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766153320-84hnh",
        "signature": "ebd62454d2e88e6c561498b9e422fa22371c57ec43e6fd93ba052b9bd6b2e873",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "119bfb84-f533-4ea6-bf53-7df193f03fa9",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766153320-84hnh",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766153321
        }
      },
      {
        "id": "34442a50-acf1-4d1e-9a39-3e4c02a005f7",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "25087bfb-0f3a-4c85-a15c-2d1d17c840ec",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "518b6b87-d487-4210-a5f8-658f33a88c0b",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Seasons Verify Project",
          "organizationId": "f64a163c-822b-4afd-bf13-0e59d0769717"
        }
      },
      {
        "id": "76507b0c-320e-44ff-ab21-f8711bd45f8d",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "/api/organizations/switch",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/organizations/switch",
          "method": "POST"
        }
      },
      {
        "id": "8f01dd1f-1def-4abe-bc06-c35fe6037b56",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "organization",
        "resourceId": "f64a163c-822b-4afd-bf13-0e59d0769717",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "role": "OWNER",
          "organizationName": "Smoke Tenant"
        }
      },
      {
        "id": "37db69a0-22dd-44ba-84b9-ee1243d1a636",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "68310ab7-4b31-44c2-8fb9-e908227b7782",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST",
          "message": "Invalid credentials"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 4
      },
      {
        "table_name": "seasons",
        "count": 4,
        "unique_projects": 3
      },
      {
        "table_name": "episodes",
        "count": 3,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 1,
        "unique_episodes": 1
      },
      {
        "table_name": "shots",
        "count": 1,
        "unique_scenes": 1
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 17
- **结果示例** (前 5 行):

```json
[
  {
    "id": "7c5136ae-4c49-4ab8-ba6c-985529b54cc7",
    "action": "TASK_CREATED",
    "resourceType": "task",
    "resourceId": "a7fdc031-b9f4-4007-ba98-4532a24e75f8",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "organizationId": "bb47a99a-531f-4c5a-bbcd-adedacfd3a17"
    }
  },
  {
    "id": "1b915989-5cd8-4b74-ad8f-6a91652e1a86",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "252ea17f-b371-4a12-bbae-b3040afc066b",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766150758687",
      "capabilities": {}
    }
  },
  {
    "id": "d3a3f656-b489-43b7-8994-ece285be1082",
    "action": "EPISODE_CREATE",
    "resourceType": "/api/projects/:projectId/episodes",
    "resourceId": "6176bec2-679c-4695-a30c-b7b342dd26ef",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/6176bec2-679c-4695-a30c-b7b342dd26ef/episodes",
      "method": "POST"
    }
  },
  {
    "id": "cc06d710-ce1b-42ee-8d22-32e8ea7951ef",
    "action": "EPISODE_CREATE",
    "resourceType": "episode",
    "resourceId": "37c897f5-4f38-4a07-aaf5-369fdae044ad",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "6176bec2-679c-4695-a30c-b7b342dd26ef",
      "episodeIndex": 1
    }
  },
  {
    "id": "ff140e9d-e67b-4f6f-834b-710ef24c89c4",
    "action": "PROJECT_CREATE",
    "resourceType": "/api/projects",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 4
  },
  {
    "table_name": "seasons",
    "count": 5,
    "unique_projects": 4
  },
  {
    "table_name": "episodes",
    "count": 4,
    "unique_seasons": 3,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 1,
    "unique_episodes": 1
  },
  {
    "table_name": "shots",
    "count": 1,
    "unique_scenes": 1
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "7c5136ae-4c49-4ab8-ba6c-985529b54cc7",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "a7fdc031-b9f4-4007-ba98-4532a24e75f8",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "bb47a99a-531f-4c5a-bbcd-adedacfd3a17"
        }
      },
      {
        "id": "1b915989-5cd8-4b74-ad8f-6a91652e1a86",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "252ea17f-b371-4a12-bbae-b3040afc066b",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766150758687",
          "capabilities": {}
        }
      },
      {
        "id": "d3a3f656-b489-43b7-8994-ece285be1082",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "6176bec2-679c-4695-a30c-b7b342dd26ef",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/6176bec2-679c-4695-a30c-b7b342dd26ef/episodes",
          "method": "POST"
        }
      },
      {
        "id": "cc06d710-ce1b-42ee-8d22-32e8ea7951ef",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "37c897f5-4f38-4a07-aaf5-369fdae044ad",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "6176bec2-679c-4695-a30c-b7b342dd26ef",
          "episodeIndex": 1
        }
      },
      {
        "id": "ff140e9d-e67b-4f6f-834b-710ef24c89c4",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "88118b52-f248-4b2e-9ca1-28c25a3f639e",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "6176bec2-679c-4695-a30c-b7b342dd26ef",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766150758643",
          "organizationId": "bb47a99a-531f-4c5a-bbcd-adedacfd3a17"
        }
      },
      {
        "id": "4afcf914-e164-4543-a7ee-ff452c5c2798",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766150758-54n4u",
        "signature": "f11e913aee1828ff305943f963982507bf382471f4be83b42bac58710dd43c61",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "52d77a1f-7a60-4dd6-82bd-08c5cb27bf53",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766150758-54n4u",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766150759
        }
      },
      {
        "id": "ae758daf-d1ef-4a4c-a799-1952ccd74d39",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "2dba4c26-bc01-42f9-b94e-c468b3756e0f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/2dba4c26-bc01-42f9-b94e-c468b3756e0f/episodes",
          "method": "POST"
        }
      },
      {
        "id": "91bfcb34-cde5-42ff-bd46-93d46aae988f",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "9d64f2ae-5b38-4695-8bb2-6922f28bcd4f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "2dba4c26-bc01-42f9-b94e-c468b3756e0f",
          "episodeIndex": 1
        }
      },
      {
        "id": "1abea959-3627-46dc-960e-10ca5930a7c1",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "5c326135-db66-4ebc-80c9-533e4b429605",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "2dba4c26-bc01-42f9-b94e-c468b3756e0f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "P0 Verify Project",
          "organizationId": "bb47a99a-531f-4c5a-bbcd-adedacfd3a17"
        }
      },
      {
        "id": "d2d14bca-c793-4ad5-a044-f6894614fb14",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766150757-ezydf2",
        "signature": "735045d5eaffb31f5c8d33e0448bd367e754975b9542e2d87bcf122f986ff563",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "061e499f-2bd7-47e6-af4a-7536b455b428",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766150757-ezydf2",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766150758
        }
      },
      {
        "id": "f1c8d705-c707-4dde-b3f1-499e67d72ce0",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "/api/organizations/switch",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/organizations/switch",
          "method": "POST"
        }
      },
      {
        "id": "3b220b7a-85ca-4423-bd68-81b95b284876",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "organization",
        "resourceId": "bb47a99a-531f-4c5a-bbcd-adedacfd3a17",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "role": "OWNER",
          "organizationName": "Smoke Org"
        }
      },
      {
        "id": "2a878bbe-825c-4dfd-8a03-e0ea0f73e860",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 4
      },
      {
        "table_name": "seasons",
        "count": 5,
        "unique_projects": 4
      },
      {
        "table_name": "episodes",
        "count": 4,
        "unique_seasons": 3,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 1,
        "unique_episodes": 1
      },
      {
        "table_name": "shots",
        "count": 1,
        "unique_scenes": 1
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 17
- **结果示例** (前 5 行):

```json
[
  {
    "id": "ff196080-b992-4165-b9c5-2c2923083a3d",
    "action": "TASK_CREATED",
    "resourceType": "task",
    "resourceId": "2913b3d1-a0d9-470e-8a2a-5f874acfef56",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "type": "NOVEL_ANALYSIS",
      "organizationId": "bd0cbd6c-b5d8-4a4b-94cd-e1def11ae6ad"
    }
  },
  {
    "id": "189f01cb-bc7c-452e-9600-e05a6f74066f",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "15b62591-dfcb-4156-86b2-c1fa9dcfdfd6",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766150729126",
      "capabilities": {}
    }
  },
  {
    "id": "349d5351-a7d5-4a97-9c25-b3ace9405019",
    "action": "EPISODE_CREATE",
    "resourceType": "/api/projects/:projectId/episodes",
    "resourceId": "eeeff5ea-aba9-4453-bdd7-e090c27f4180",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/eeeff5ea-aba9-4453-bdd7-e090c27f4180/episodes",
      "method": "POST"
    }
  },
  {
    "id": "7af5e142-3ab3-4f3a-a5ec-f9086c975fc0",
    "action": "EPISODE_CREATE",
    "resourceType": "episode",
    "resourceId": "a90cf684-ec7c-4bb7-9690-0c742337a2e0",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "eeeff5ea-aba9-4453-bdd7-e090c27f4180",
      "episodeIndex": 1
    }
  },
  {
    "id": "461f5fa7-86aa-43cb-b81f-d2486ad620fd",
    "action": "PROJECT_CREATE",
    "resourceType": "/api/projects",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 3
  },
  {
    "table_name": "seasons",
    "count": 4,
    "unique_projects": 3
  },
  {
    "table_name": "episodes",
    "count": 3,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 1,
    "unique_episodes": 1
  },
  {
    "table_name": "shots",
    "count": 1,
    "unique_scenes": 1
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "ff196080-b992-4165-b9c5-2c2923083a3d",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "2913b3d1-a0d9-470e-8a2a-5f874acfef56",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "organizationId": "bd0cbd6c-b5d8-4a4b-94cd-e1def11ae6ad"
        }
      },
      {
        "id": "189f01cb-bc7c-452e-9600-e05a6f74066f",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "15b62591-dfcb-4156-86b2-c1fa9dcfdfd6",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766150729126",
          "capabilities": {}
        }
      },
      {
        "id": "349d5351-a7d5-4a97-9c25-b3ace9405019",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "eeeff5ea-aba9-4453-bdd7-e090c27f4180",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/eeeff5ea-aba9-4453-bdd7-e090c27f4180/episodes",
          "method": "POST"
        }
      },
      {
        "id": "7af5e142-3ab3-4f3a-a5ec-f9086c975fc0",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "a90cf684-ec7c-4bb7-9690-0c742337a2e0",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "eeeff5ea-aba9-4453-bdd7-e090c27f4180",
          "episodeIndex": 1
        }
      },
      {
        "id": "461f5fa7-86aa-43cb-b81f-d2486ad620fd",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "12db57fa-8e92-4cdb-8b86-64d70b38f8c5",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "eeeff5ea-aba9-4453-bdd7-e090c27f4180",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766150729080",
          "organizationId": "bd0cbd6c-b5d8-4a4b-94cd-e1def11ae6ad"
        }
      },
      {
        "id": "d4604dc5-a436-4116-a3ce-dd4522956af4",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766150728-ivy7cq",
        "signature": "c552c81acdf656767f82cb63da20e29bec823209f7a2a032c8dd13edb8c5360e",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "bd3759b4-ecad-40c8-82e1-3086d5702804",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766150728-ivy7cq",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766150729
        }
      },
      {
        "id": "adfa9b6f-dd95-42a1-bbd4-18419891a541",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "3c699437-62c8-46cb-9f56-0bde3519fd57",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/3c699437-62c8-46cb-9f56-0bde3519fd57/episodes",
          "method": "POST"
        }
      },
      {
        "id": "f34c1159-800b-44cf-8401-f22e1f7700fa",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "31d8a806-d521-423c-ba07-d0982af87269",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "3c699437-62c8-46cb-9f56-0bde3519fd57",
          "episodeIndex": 1
        }
      },
      {
        "id": "7993604d-9af3-4bc1-8f74-2334928dbcc8",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "9bfed008-e2d3-4bde-8a80-df50a429edb3",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "3c699437-62c8-46cb-9f56-0bde3519fd57",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "P0 Verify Project",
          "organizationId": "bd0cbd6c-b5d8-4a4b-94cd-e1def11ae6ad"
        }
      },
      {
        "id": "9ea2c96a-1320-459e-a6af-7d3e47916ab4",
        "action": "API_NONCE_REPLAY",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766150728-hhploa",
        "signature": "6eefddbef99795d863563ec08ecfffba8c4fb5dc5bdf1f4c46ad8fc1b6293bfd",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4004",
          "path": "/api/projects",
          "method": "GET",
          "message": "Nonce replay detected"
        }
      },
      {
        "id": "75c2dbfa-ea43-4ad4-8c50-c1d2b30b52ab",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "scu_smoke_key",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "replay-test-1766150728-hhploa",
          "method": "GET",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1766150729
        }
      },
      {
        "id": "8df21ac4-9d79-426c-891a-4ce732028538",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "/api/organizations/switch",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/organizations/switch",
          "method": "POST"
        }
      },
      {
        "id": "9d74af2d-eece-48d7-b630-09e591a476a1",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "organization",
        "resourceId": "bd0cbd6c-b5d8-4a4b-94cd-e1def11ae6ad",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "role": "OWNER",
          "organizationName": "Smoke Org"
        }
      },
      {
        "id": "1c8ff025-1da3-4087-9459-778c08630076",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 3
      },
      {
        "table_name": "seasons",
        "count": 4,
        "unique_projects": 3
      },
      {
        "table_name": "episodes",
        "count": 3,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 1,
        "unique_episodes": 1
      },
      {
        "table_name": "shots",
        "count": 1,
        "unique_scenes": 1
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 6
- **结果示例** (前 5 行):

```json
[
  {
    "id": "3b374ebd-40ca-4aa8-959f-0b1c47dd2134",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "cbaad1a8-e776-4ab6-9581-1266798f847c",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766147509705",
      "capabilities": {}
    }
  },
  {
    "id": "e7b2c29f-4081-4c34-a521-b58daffee76a",
    "action": "PROJECT_CREATE",
    "resourceType": "/api/projects",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST"
    }
  },
  {
    "id": "c0df8899-4646-4d1e-a918-d254036fec56",
    "action": "PROJECT_CREATED",
    "resourceType": "project",
    "resourceId": "b0dc199d-c08a-4d66-9f60-7a59db578cdc",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Project 1766147509667",
      "organizationId": "3339fc65-bb84-42e4-a3f2-82bf0640d60e"
    }
  },
  {
    "id": "c7392595-c750-4e61-b2b9-ab9d42de6cbf",
    "action": "ORGANIZATION_SWITCH",
    "resourceType": "/api/organizations/switch",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/organizations/switch",
      "method": "POST"
    }
  },
  {
    "id": "52372a67-d927-4c3e-a66e-03dfd5f9bac3",
    "action": "ORGANIZATION_SWITCH",
    "resourceType": "organization",
    "resourceId": "3339fc65-bb84-42e4-a3f2-82bf0640d60e",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "role": "OWNER",
      "organizationName": "Smoke Org"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 2
  },
  {
    "table_name": "seasons",
    "count": 2,
    "unique_projects": 2
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "3b374ebd-40ca-4aa8-959f-0b1c47dd2134",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "cbaad1a8-e776-4ab6-9581-1266798f847c",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766147509705",
          "capabilities": {}
        }
      },
      {
        "id": "e7b2c29f-4081-4c34-a521-b58daffee76a",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "c0df8899-4646-4d1e-a918-d254036fec56",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "b0dc199d-c08a-4d66-9f60-7a59db578cdc",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766147509667",
          "organizationId": "3339fc65-bb84-42e4-a3f2-82bf0640d60e"
        }
      },
      {
        "id": "c7392595-c750-4e61-b2b9-ab9d42de6cbf",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "/api/organizations/switch",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/organizations/switch",
          "method": "POST"
        }
      },
      {
        "id": "52372a67-d927-4c3e-a66e-03dfd5f9bac3",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "organization",
        "resourceId": "3339fc65-bb84-42e4-a3f2-82bf0640d60e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "role": "OWNER",
          "organizationName": "Smoke Org"
        }
      },
      {
        "id": "64e567c4-4b63-4f54-b6a7-376d3d3faca9",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 2
      },
      {
        "table_name": "seasons",
        "count": 2,
        "unique_projects": 2
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 6
- **结果示例** (前 5 行):

```json
[
  {
    "id": "fbb0d14d-de8d-4923-a5b6-fafc6cbd466f",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "02bffef0-8d87-48da-82e6-a9d3d1137016",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766145611873",
      "capabilities": {}
    }
  },
  {
    "id": "778b2765-f923-4082-81b8-083483c74860",
    "action": "PROJECT_CREATE",
    "resourceType": "/api/projects",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST"
    }
  },
  {
    "id": "70dbf2b8-1000-4e42-8855-e4d389de6a2e",
    "action": "PROJECT_CREATED",
    "resourceType": "project",
    "resourceId": "b3117e1b-e207-4aa1-802c-6d33ea9a8c29",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Project 1766145611811",
      "organizationId": "c896b8b6-da19-44a0-9d43-c3d7222aedee"
    }
  },
  {
    "id": "f3b12bcb-6872-41a6-bd8e-53fc1319fe63",
    "action": "ORGANIZATION_SWITCH",
    "resourceType": "/api/organizations/switch",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/organizations/switch",
      "method": "POST"
    }
  },
  {
    "id": "ec81f080-d2f7-48c0-816f-7faaf0ce0ad1",
    "action": "ORGANIZATION_SWITCH",
    "resourceType": "organization",
    "resourceId": "c896b8b6-da19-44a0-9d43-c3d7222aedee",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "role": "OWNER",
      "organizationName": "Smoke Org"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 2
  },
  {
    "table_name": "seasons",
    "count": 2,
    "unique_projects": 2
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "fbb0d14d-de8d-4923-a5b6-fafc6cbd466f",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "02bffef0-8d87-48da-82e6-a9d3d1137016",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766145611873",
          "capabilities": {}
        }
      },
      {
        "id": "778b2765-f923-4082-81b8-083483c74860",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "70dbf2b8-1000-4e42-8855-e4d389de6a2e",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "b3117e1b-e207-4aa1-802c-6d33ea9a8c29",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766145611811",
          "organizationId": "c896b8b6-da19-44a0-9d43-c3d7222aedee"
        }
      },
      {
        "id": "f3b12bcb-6872-41a6-bd8e-53fc1319fe63",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "/api/organizations/switch",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/organizations/switch",
          "method": "POST"
        }
      },
      {
        "id": "ec81f080-d2f7-48c0-816f-7faaf0ce0ad1",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "organization",
        "resourceId": "c896b8b6-da19-44a0-9d43-c3d7222aedee",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "role": "OWNER",
          "organizationName": "Smoke Org"
        }
      },
      {
        "id": "3a5ffe44-3608-4fd0-b8c5-5200a06bf9f9",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 2
      },
      {
        "table_name": "seasons",
        "count": 2,
        "unique_projects": 2
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 6
- **结果示例** (前 5 行):

```json
[
  {
    "id": "99f134ad-135d-4e99-ac9d-05ecbeae49a0",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "1dbde782-207e-4904-93a3-cc373699e2f6",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766145579212",
      "capabilities": {}
    }
  },
  {
    "id": "8326f02d-cc4f-42a4-b5da-a284aaaae558",
    "action": "PROJECT_CREATE",
    "resourceType": "/api/projects",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST"
    }
  },
  {
    "id": "f5b06142-0c74-4dc4-aaa7-6e37d8f8f4d0",
    "action": "PROJECT_CREATED",
    "resourceType": "project",
    "resourceId": "da94688c-ca05-4b3b-9f51-2374aa206b17",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Project 1766145579172",
      "organizationId": "5e0f4d6a-5a0d-40fc-8a87-c9c29d2672a8"
    }
  },
  {
    "id": "f51c1ba9-547f-41b5-8363-06d50bd4e4a3",
    "action": "ORGANIZATION_SWITCH",
    "resourceType": "/api/organizations/switch",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/organizations/switch",
      "method": "POST"
    }
  },
  {
    "id": "7b44a8b6-ac39-4ec2-8186-bdfc444973fd",
    "action": "ORGANIZATION_SWITCH",
    "resourceType": "organization",
    "resourceId": "5e0f4d6a-5a0d-40fc-8a87-c9c29d2672a8",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "role": "OWNER",
      "organizationName": "Smoke Org"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 2
  },
  {
    "table_name": "seasons",
    "count": 2,
    "unique_projects": 2
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "99f134ad-135d-4e99-ac9d-05ecbeae49a0",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "1dbde782-207e-4904-93a3-cc373699e2f6",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766145579212",
          "capabilities": {}
        }
      },
      {
        "id": "8326f02d-cc4f-42a4-b5da-a284aaaae558",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "f5b06142-0c74-4dc4-aaa7-6e37d8f8f4d0",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "da94688c-ca05-4b3b-9f51-2374aa206b17",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766145579172",
          "organizationId": "5e0f4d6a-5a0d-40fc-8a87-c9c29d2672a8"
        }
      },
      {
        "id": "f51c1ba9-547f-41b5-8363-06d50bd4e4a3",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "/api/organizations/switch",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/organizations/switch",
          "method": "POST"
        }
      },
      {
        "id": "7b44a8b6-ac39-4ec2-8186-bdfc444973fd",
        "action": "ORGANIZATION_SWITCH",
        "resourceType": "organization",
        "resourceId": "5e0f4d6a-5a0d-40fc-8a87-c9c29d2672a8",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "role": "OWNER",
          "organizationName": "Smoke Org"
        }
      },
      {
        "id": "5e36a428-470a-4fe6-8822-e3f966383165",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 2
      },
      {
        "table_name": "seasons",
        "count": 2,
        "unique_projects": 2
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "ec73e2e8-6529-4646-8584-b4edd99f8dd9",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/jobs/capacity",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "0eda625f-c13a-4fe7-8a94-f8e498eb032d",
    "action": "JOB_RETRYING",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "error": "Frame missing: temp/seed/seed-1766033687382/0.png",
      "spanId": null,
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "attempts": 1,
      "duration": 819,
      "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
      "errorCode": "JOB_RETRYING",
      "modelUsed": null,
      "retryCount": 1,
      "nextRetryAt": "2025-12-18T04:55:10.170Z",
      "backoffDelayMs": 1000
    }
  },
  {
    "id": "f4a1bb0a-b4ee-47dd-a2b9-eedde04b9a32",
    "action": "JOB_REPORT_RECEIVED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": "299743645a37ef49c0564a1dfdd57d87",
    "signature": "fb8dd9a71196fe639d0bc2dd9dc66e43db17e0b3e4bef83be6ccfcfdab0ed609",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "jobId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
      "reason": "Frame missing: temp/seed/seed-1766033687382/0.png",
      "status": "FAILED",
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
    }
  },
  {
    "id": "6a275d89-7f70-4384-976a-96e76ac22cbe",
    "action": "JOB_STARTED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": "12e10aca04dd4706388a27f26cbb6fba",
    "signature": "497127cb38038b111c04eace4a3cd06a2e4193826cc6a9fdea713d486d6bf069",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "type": "VIDEO_RENDER",
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "workerId": "local-worker"
    }
  },
  {
    "id": "f9ee25e1-3b3f-403f-9e92-bbfc5b33e643",
    "action": "JOB_DISPATCHED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "jobType": "VIDEO_RENDER",
      "workerId": "local-worker"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 4,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 7
  },
  {
    "table_name": "seasons",
    "count": 6,
    "unique_projects": 6
  },
  {
    "table_name": "episodes",
    "count": 6,
    "unique_seasons": 6,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 4,
    "unique_episodes": 4
  },
  {
    "table_name": "shots",
    "count": 4,
    "unique_scenes": 4
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "ec73e2e8-6529-4646-8584-b4edd99f8dd9",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/jobs/capacity",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "0eda625f-c13a-4fe7-8a94-f8e498eb032d",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033687382/0.png",
          "spanId": null,
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "attempts": 1,
          "duration": 819,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:55:10.170Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "f4a1bb0a-b4ee-47dd-a2b9-eedde04b9a32",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": "299743645a37ef49c0564a1dfdd57d87",
        "signature": "fb8dd9a71196fe639d0bc2dd9dc66e43db17e0b3e4bef83be6ccfcfdab0ed609",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
          "reason": "Frame missing: temp/seed/seed-1766033687382/0.png",
          "status": "FAILED",
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "6a275d89-7f70-4384-976a-96e76ac22cbe",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": "12e10aca04dd4706388a27f26cbb6fba",
        "signature": "497127cb38038b111c04eace4a3cd06a2e4193826cc6a9fdea713d486d6bf069",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "workerId": "local-worker"
        }
      },
      {
        "id": "f9ee25e1-3b3f-403f-9e92-bbfc5b33e643",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "06198151-bc5d-4400-ae26-c0213d0068a7",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "SHOT_RENDER",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "0fb57c66-fd09-47e1-b5f1-0ece9055e45c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "acf4a664-f0af-4aa6-b785-b2147ed76dc6",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "d754166e-5590-4bf7-8850-3c60609e576b",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033547139/0.png",
          "spanId": null,
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "attempts": 1,
          "duration": 984,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:50.083Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "641421a9-46a5-47be-b2fb-9f92e1bb90f0",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": "c85f078f51a489abdda8d02c8739d35e",
        "signature": "691d4194ac121ea16593b3bfbe07a4e7208eb3d4929d1329d25736de5f0fa893",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "b85f5367-f973-4425-abb1-1fac0afcf253",
          "reason": "Frame missing: temp/seed/seed-1766033547139/0.png",
          "status": "FAILED",
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "2a6df887-6306-45ed-b716-6aa961ff05cc",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": "2f60afad864902bad653448e5b6c37d8",
        "signature": "2d81818e08ef4fb9ecb1a390dd3efe719efee296c9484274ff2428d2ded07f13",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "workerId": "local-worker"
        }
      },
      {
        "id": "52c9cff5-757b-49bd-b660-30b5b11e8aae",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5ceea017-6da1-45f5-b476-5e5a91a005b1",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "SHOT_RENDER",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "58305702-c5f8-4c46-8ff2-3e4ab22a633c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "aef93561-cc09-4767-8309-1f559a60d875",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033415354/0.png",
          "spanId": null,
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "attempts": 1,
          "duration": 92755,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:09.984Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "8fc88960-596a-401d-94de-47741b590d25",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": "2c467a1240d06dfc4e6bd3b9b9ec0924",
        "signature": "5ce0116f8070dcd354f1995f0aa76efa6de08979ef4000b3371484a49e607a8d",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
          "reason": "Frame missing: temp/seed/seed-1766033415354/0.png",
          "status": "FAILED",
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "370054d9-5b66-423f-b03f-07719510fb26",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": "94988835593e5d4237b2e2275da6e752",
        "signature": "a5e60051c1b6e5cc9398f754268a8180583935d6a4ff9cef7178ba3ad4559efc",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5b64193d-7c99-4d15-ae9c-3db444ea1447",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5d9154c0-0e79-4857-a7ee-0144cc79d6c7",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033213675/0.png",
          "spanId": null,
          "taskId": "5e800e62-f4ba-474b-bf9c-4d2e1f7ee2f9",
          "attempts": 1,
          "duration": 292340,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:07.996Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "3d6a5a24-0612-448f-8e8d-7f5edc39fe2b",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
        "nonce": "0c569d7c298b581ef436bd1dca0a228e",
        "signature": "50a9b5fe3929676333752bab80a3affa96e83334d17ac29751743bddc9613f68",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
          "reason": "Frame missing: temp/seed/seed-1766033213675/0.png",
          "status": "FAILED",
          "taskId": "5e800e62-f4ba-474b-bf9c-4d2e1f7ee2f9",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 4,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 7
      },
      {
        "table_name": "seasons",
        "count": 6,
        "unique_projects": 6
      },
      {
        "table_name": "episodes",
        "count": 6,
        "unique_seasons": 6,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 4,
        "unique_episodes": 4
      },
      {
        "table_name": "shots",
        "count": 4,
        "unique_scenes": 4
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "ec73e2e8-6529-4646-8584-b4edd99f8dd9",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/jobs/capacity",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "0eda625f-c13a-4fe7-8a94-f8e498eb032d",
    "action": "JOB_RETRYING",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "error": "Frame missing: temp/seed/seed-1766033687382/0.png",
      "spanId": null,
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "attempts": 1,
      "duration": 819,
      "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
      "errorCode": "JOB_RETRYING",
      "modelUsed": null,
      "retryCount": 1,
      "nextRetryAt": "2025-12-18T04:55:10.170Z",
      "backoffDelayMs": 1000
    }
  },
  {
    "id": "f4a1bb0a-b4ee-47dd-a2b9-eedde04b9a32",
    "action": "JOB_REPORT_RECEIVED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": "299743645a37ef49c0564a1dfdd57d87",
    "signature": "fb8dd9a71196fe639d0bc2dd9dc66e43db17e0b3e4bef83be6ccfcfdab0ed609",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "jobId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
      "reason": "Frame missing: temp/seed/seed-1766033687382/0.png",
      "status": "FAILED",
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
    }
  },
  {
    "id": "6a275d89-7f70-4384-976a-96e76ac22cbe",
    "action": "JOB_STARTED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": "12e10aca04dd4706388a27f26cbb6fba",
    "signature": "497127cb38038b111c04eace4a3cd06a2e4193826cc6a9fdea713d486d6bf069",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "type": "VIDEO_RENDER",
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "workerId": "local-worker"
    }
  },
  {
    "id": "f9ee25e1-3b3f-403f-9e92-bbfc5b33e643",
    "action": "JOB_DISPATCHED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "jobType": "VIDEO_RENDER",
      "workerId": "local-worker"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 4,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 7
  },
  {
    "table_name": "seasons",
    "count": 6,
    "unique_projects": 6
  },
  {
    "table_name": "episodes",
    "count": 6,
    "unique_seasons": 6,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 4,
    "unique_episodes": 4
  },
  {
    "table_name": "shots",
    "count": 4,
    "unique_scenes": 4
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "ec73e2e8-6529-4646-8584-b4edd99f8dd9",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/jobs/capacity",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "0eda625f-c13a-4fe7-8a94-f8e498eb032d",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033687382/0.png",
          "spanId": null,
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "attempts": 1,
          "duration": 819,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:55:10.170Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "f4a1bb0a-b4ee-47dd-a2b9-eedde04b9a32",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": "299743645a37ef49c0564a1dfdd57d87",
        "signature": "fb8dd9a71196fe639d0bc2dd9dc66e43db17e0b3e4bef83be6ccfcfdab0ed609",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
          "reason": "Frame missing: temp/seed/seed-1766033687382/0.png",
          "status": "FAILED",
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "6a275d89-7f70-4384-976a-96e76ac22cbe",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": "12e10aca04dd4706388a27f26cbb6fba",
        "signature": "497127cb38038b111c04eace4a3cd06a2e4193826cc6a9fdea713d486d6bf069",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "workerId": "local-worker"
        }
      },
      {
        "id": "f9ee25e1-3b3f-403f-9e92-bbfc5b33e643",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "06198151-bc5d-4400-ae26-c0213d0068a7",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "SHOT_RENDER",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "0fb57c66-fd09-47e1-b5f1-0ece9055e45c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "acf4a664-f0af-4aa6-b785-b2147ed76dc6",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "d754166e-5590-4bf7-8850-3c60609e576b",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033547139/0.png",
          "spanId": null,
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "attempts": 1,
          "duration": 984,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:50.083Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "641421a9-46a5-47be-b2fb-9f92e1bb90f0",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": "c85f078f51a489abdda8d02c8739d35e",
        "signature": "691d4194ac121ea16593b3bfbe07a4e7208eb3d4929d1329d25736de5f0fa893",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "b85f5367-f973-4425-abb1-1fac0afcf253",
          "reason": "Frame missing: temp/seed/seed-1766033547139/0.png",
          "status": "FAILED",
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "2a6df887-6306-45ed-b716-6aa961ff05cc",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": "2f60afad864902bad653448e5b6c37d8",
        "signature": "2d81818e08ef4fb9ecb1a390dd3efe719efee296c9484274ff2428d2ded07f13",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "workerId": "local-worker"
        }
      },
      {
        "id": "52c9cff5-757b-49bd-b660-30b5b11e8aae",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5ceea017-6da1-45f5-b476-5e5a91a005b1",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "SHOT_RENDER",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "58305702-c5f8-4c46-8ff2-3e4ab22a633c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "aef93561-cc09-4767-8309-1f559a60d875",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033415354/0.png",
          "spanId": null,
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "attempts": 1,
          "duration": 92755,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:09.984Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "8fc88960-596a-401d-94de-47741b590d25",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": "2c467a1240d06dfc4e6bd3b9b9ec0924",
        "signature": "5ce0116f8070dcd354f1995f0aa76efa6de08979ef4000b3371484a49e607a8d",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
          "reason": "Frame missing: temp/seed/seed-1766033415354/0.png",
          "status": "FAILED",
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "370054d9-5b66-423f-b03f-07719510fb26",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": "94988835593e5d4237b2e2275da6e752",
        "signature": "a5e60051c1b6e5cc9398f754268a8180583935d6a4ff9cef7178ba3ad4559efc",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5b64193d-7c99-4d15-ae9c-3db444ea1447",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5d9154c0-0e79-4857-a7ee-0144cc79d6c7",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033213675/0.png",
          "spanId": null,
          "taskId": "5e800e62-f4ba-474b-bf9c-4d2e1f7ee2f9",
          "attempts": 1,
          "duration": 292340,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:07.996Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "3d6a5a24-0612-448f-8e8d-7f5edc39fe2b",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
        "nonce": "0c569d7c298b581ef436bd1dca0a228e",
        "signature": "50a9b5fe3929676333752bab80a3affa96e83334d17ac29751743bddc9613f68",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
          "reason": "Frame missing: temp/seed/seed-1766033213675/0.png",
          "status": "FAILED",
          "taskId": "5e800e62-f4ba-474b-bf9c-4d2e1f7ee2f9",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 4,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 7
      },
      {
        "table_name": "seasons",
        "count": 6,
        "unique_projects": 6
      },
      {
        "table_name": "episodes",
        "count": 6,
        "unique_seasons": 6,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 4,
        "unique_episodes": 4
      },
      {
        "table_name": "shots",
        "count": 4,
        "unique_scenes": 4
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "ec73e2e8-6529-4646-8584-b4edd99f8dd9",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/jobs/capacity",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "0eda625f-c13a-4fe7-8a94-f8e498eb032d",
    "action": "JOB_RETRYING",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "error": "Frame missing: temp/seed/seed-1766033687382/0.png",
      "spanId": null,
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "attempts": 1,
      "duration": 819,
      "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
      "errorCode": "JOB_RETRYING",
      "modelUsed": null,
      "retryCount": 1,
      "nextRetryAt": "2025-12-18T04:55:10.170Z",
      "backoffDelayMs": 1000
    }
  },
  {
    "id": "f4a1bb0a-b4ee-47dd-a2b9-eedde04b9a32",
    "action": "JOB_REPORT_RECEIVED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": "299743645a37ef49c0564a1dfdd57d87",
    "signature": "fb8dd9a71196fe639d0bc2dd9dc66e43db17e0b3e4bef83be6ccfcfdab0ed609",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "jobId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
      "reason": "Frame missing: temp/seed/seed-1766033687382/0.png",
      "status": "FAILED",
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
    }
  },
  {
    "id": "6a275d89-7f70-4384-976a-96e76ac22cbe",
    "action": "JOB_STARTED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": "12e10aca04dd4706388a27f26cbb6fba",
    "signature": "497127cb38038b111c04eace4a3cd06a2e4193826cc6a9fdea713d486d6bf069",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "type": "VIDEO_RENDER",
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "workerId": "local-worker"
    }
  },
  {
    "id": "f9ee25e1-3b3f-403f-9e92-bbfc5b33e643",
    "action": "JOB_DISPATCHED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "jobType": "VIDEO_RENDER",
      "workerId": "local-worker"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 4,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 7
  },
  {
    "table_name": "seasons",
    "count": 6,
    "unique_projects": 6
  },
  {
    "table_name": "episodes",
    "count": 6,
    "unique_seasons": 6,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 4,
    "unique_episodes": 4
  },
  {
    "table_name": "shots",
    "count": 4,
    "unique_scenes": 4
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "ec73e2e8-6529-4646-8584-b4edd99f8dd9",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/jobs/capacity",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "0eda625f-c13a-4fe7-8a94-f8e498eb032d",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033687382/0.png",
          "spanId": null,
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "attempts": 1,
          "duration": 819,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:55:10.170Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "f4a1bb0a-b4ee-47dd-a2b9-eedde04b9a32",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": "299743645a37ef49c0564a1dfdd57d87",
        "signature": "fb8dd9a71196fe639d0bc2dd9dc66e43db17e0b3e4bef83be6ccfcfdab0ed609",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
          "reason": "Frame missing: temp/seed/seed-1766033687382/0.png",
          "status": "FAILED",
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "6a275d89-7f70-4384-976a-96e76ac22cbe",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": "12e10aca04dd4706388a27f26cbb6fba",
        "signature": "497127cb38038b111c04eace4a3cd06a2e4193826cc6a9fdea713d486d6bf069",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "workerId": "local-worker"
        }
      },
      {
        "id": "f9ee25e1-3b3f-403f-9e92-bbfc5b33e643",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "06198151-bc5d-4400-ae26-c0213d0068a7",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "SHOT_RENDER",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "0fb57c66-fd09-47e1-b5f1-0ece9055e45c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "acf4a664-f0af-4aa6-b785-b2147ed76dc6",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "d754166e-5590-4bf7-8850-3c60609e576b",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033547139/0.png",
          "spanId": null,
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "attempts": 1,
          "duration": 984,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:50.083Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "641421a9-46a5-47be-b2fb-9f92e1bb90f0",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": "c85f078f51a489abdda8d02c8739d35e",
        "signature": "691d4194ac121ea16593b3bfbe07a4e7208eb3d4929d1329d25736de5f0fa893",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "b85f5367-f973-4425-abb1-1fac0afcf253",
          "reason": "Frame missing: temp/seed/seed-1766033547139/0.png",
          "status": "FAILED",
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "2a6df887-6306-45ed-b716-6aa961ff05cc",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": "2f60afad864902bad653448e5b6c37d8",
        "signature": "2d81818e08ef4fb9ecb1a390dd3efe719efee296c9484274ff2428d2ded07f13",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "workerId": "local-worker"
        }
      },
      {
        "id": "52c9cff5-757b-49bd-b660-30b5b11e8aae",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5ceea017-6da1-45f5-b476-5e5a91a005b1",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "SHOT_RENDER",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "58305702-c5f8-4c46-8ff2-3e4ab22a633c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "aef93561-cc09-4767-8309-1f559a60d875",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033415354/0.png",
          "spanId": null,
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "attempts": 1,
          "duration": 92755,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:09.984Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "8fc88960-596a-401d-94de-47741b590d25",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": "2c467a1240d06dfc4e6bd3b9b9ec0924",
        "signature": "5ce0116f8070dcd354f1995f0aa76efa6de08979ef4000b3371484a49e607a8d",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
          "reason": "Frame missing: temp/seed/seed-1766033415354/0.png",
          "status": "FAILED",
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "370054d9-5b66-423f-b03f-07719510fb26",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": "94988835593e5d4237b2e2275da6e752",
        "signature": "a5e60051c1b6e5cc9398f754268a8180583935d6a4ff9cef7178ba3ad4559efc",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5b64193d-7c99-4d15-ae9c-3db444ea1447",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5d9154c0-0e79-4857-a7ee-0144cc79d6c7",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033213675/0.png",
          "spanId": null,
          "taskId": "5e800e62-f4ba-474b-bf9c-4d2e1f7ee2f9",
          "attempts": 1,
          "duration": 292340,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:07.996Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "3d6a5a24-0612-448f-8e8d-7f5edc39fe2b",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
        "nonce": "0c569d7c298b581ef436bd1dca0a228e",
        "signature": "50a9b5fe3929676333752bab80a3affa96e83334d17ac29751743bddc9613f68",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
          "reason": "Frame missing: temp/seed/seed-1766033213675/0.png",
          "status": "FAILED",
          "taskId": "5e800e62-f4ba-474b-bf9c-4d2e1f7ee2f9",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 4,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 7
      },
      {
        "table_name": "seasons",
        "count": 6,
        "unique_projects": 6
      },
      {
        "table_name": "episodes",
        "count": 6,
        "unique_seasons": 6,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 4,
        "unique_episodes": 4
      },
      {
        "table_name": "shots",
        "count": 4,
        "unique_scenes": 4
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "ec73e2e8-6529-4646-8584-b4edd99f8dd9",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/jobs/capacity",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "0eda625f-c13a-4fe7-8a94-f8e498eb032d",
    "action": "JOB_RETRYING",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "error": "Frame missing: temp/seed/seed-1766033687382/0.png",
      "spanId": null,
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "attempts": 1,
      "duration": 819,
      "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
      "errorCode": "JOB_RETRYING",
      "modelUsed": null,
      "retryCount": 1,
      "nextRetryAt": "2025-12-18T04:55:10.170Z",
      "backoffDelayMs": 1000
    }
  },
  {
    "id": "f4a1bb0a-b4ee-47dd-a2b9-eedde04b9a32",
    "action": "JOB_REPORT_RECEIVED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": "299743645a37ef49c0564a1dfdd57d87",
    "signature": "fb8dd9a71196fe639d0bc2dd9dc66e43db17e0b3e4bef83be6ccfcfdab0ed609",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "jobId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
      "reason": "Frame missing: temp/seed/seed-1766033687382/0.png",
      "status": "FAILED",
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
    }
  },
  {
    "id": "6a275d89-7f70-4384-976a-96e76ac22cbe",
    "action": "JOB_STARTED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": "12e10aca04dd4706388a27f26cbb6fba",
    "signature": "497127cb38038b111c04eace4a3cd06a2e4193826cc6a9fdea713d486d6bf069",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "type": "VIDEO_RENDER",
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "workerId": "local-worker"
    }
  },
  {
    "id": "f9ee25e1-3b3f-403f-9e92-bbfc5b33e643",
    "action": "JOB_DISPATCHED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "jobType": "VIDEO_RENDER",
      "workerId": "local-worker"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 4,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 7
  },
  {
    "table_name": "seasons",
    "count": 6,
    "unique_projects": 6
  },
  {
    "table_name": "episodes",
    "count": 6,
    "unique_seasons": 6,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 4,
    "unique_episodes": 4
  },
  {
    "table_name": "shots",
    "count": 4,
    "unique_scenes": 4
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "ec73e2e8-6529-4646-8584-b4edd99f8dd9",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/jobs/capacity",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "0eda625f-c13a-4fe7-8a94-f8e498eb032d",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033687382/0.png",
          "spanId": null,
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "attempts": 1,
          "duration": 819,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:55:10.170Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "f4a1bb0a-b4ee-47dd-a2b9-eedde04b9a32",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": "299743645a37ef49c0564a1dfdd57d87",
        "signature": "fb8dd9a71196fe639d0bc2dd9dc66e43db17e0b3e4bef83be6ccfcfdab0ed609",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
          "reason": "Frame missing: temp/seed/seed-1766033687382/0.png",
          "status": "FAILED",
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "6a275d89-7f70-4384-976a-96e76ac22cbe",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": "12e10aca04dd4706388a27f26cbb6fba",
        "signature": "497127cb38038b111c04eace4a3cd06a2e4193826cc6a9fdea713d486d6bf069",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "workerId": "local-worker"
        }
      },
      {
        "id": "f9ee25e1-3b3f-403f-9e92-bbfc5b33e643",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "06198151-bc5d-4400-ae26-c0213d0068a7",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "SHOT_RENDER",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "0fb57c66-fd09-47e1-b5f1-0ece9055e45c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "acf4a664-f0af-4aa6-b785-b2147ed76dc6",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "d754166e-5590-4bf7-8850-3c60609e576b",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033547139/0.png",
          "spanId": null,
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "attempts": 1,
          "duration": 984,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:50.083Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "641421a9-46a5-47be-b2fb-9f92e1bb90f0",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": "c85f078f51a489abdda8d02c8739d35e",
        "signature": "691d4194ac121ea16593b3bfbe07a4e7208eb3d4929d1329d25736de5f0fa893",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "b85f5367-f973-4425-abb1-1fac0afcf253",
          "reason": "Frame missing: temp/seed/seed-1766033547139/0.png",
          "status": "FAILED",
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "2a6df887-6306-45ed-b716-6aa961ff05cc",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": "2f60afad864902bad653448e5b6c37d8",
        "signature": "2d81818e08ef4fb9ecb1a390dd3efe719efee296c9484274ff2428d2ded07f13",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "workerId": "local-worker"
        }
      },
      {
        "id": "52c9cff5-757b-49bd-b660-30b5b11e8aae",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5ceea017-6da1-45f5-b476-5e5a91a005b1",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "SHOT_RENDER",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "58305702-c5f8-4c46-8ff2-3e4ab22a633c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "aef93561-cc09-4767-8309-1f559a60d875",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033415354/0.png",
          "spanId": null,
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "attempts": 1,
          "duration": 92755,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:09.984Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "8fc88960-596a-401d-94de-47741b590d25",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": "2c467a1240d06dfc4e6bd3b9b9ec0924",
        "signature": "5ce0116f8070dcd354f1995f0aa76efa6de08979ef4000b3371484a49e607a8d",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
          "reason": "Frame missing: temp/seed/seed-1766033415354/0.png",
          "status": "FAILED",
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "370054d9-5b66-423f-b03f-07719510fb26",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": "94988835593e5d4237b2e2275da6e752",
        "signature": "a5e60051c1b6e5cc9398f754268a8180583935d6a4ff9cef7178ba3ad4559efc",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5b64193d-7c99-4d15-ae9c-3db444ea1447",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5d9154c0-0e79-4857-a7ee-0144cc79d6c7",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033213675/0.png",
          "spanId": null,
          "taskId": "5e800e62-f4ba-474b-bf9c-4d2e1f7ee2f9",
          "attempts": 1,
          "duration": 292340,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:07.996Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "3d6a5a24-0612-448f-8e8d-7f5edc39fe2b",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
        "nonce": "0c569d7c298b581ef436bd1dca0a228e",
        "signature": "50a9b5fe3929676333752bab80a3affa96e83334d17ac29751743bddc9613f68",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
          "reason": "Frame missing: temp/seed/seed-1766033213675/0.png",
          "status": "FAILED",
          "taskId": "5e800e62-f4ba-474b-bf9c-4d2e1f7ee2f9",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 4,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 7
      },
      {
        "table_name": "seasons",
        "count": 6,
        "unique_projects": 6
      },
      {
        "table_name": "episodes",
        "count": 6,
        "unique_seasons": 6,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 4,
        "unique_episodes": 4
      },
      {
        "table_name": "shots",
        "count": 4,
        "unique_scenes": 4
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "ec73e2e8-6529-4646-8584-b4edd99f8dd9",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/jobs/capacity",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "0eda625f-c13a-4fe7-8a94-f8e498eb032d",
    "action": "JOB_RETRYING",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "error": "Frame missing: temp/seed/seed-1766033687382/0.png",
      "spanId": null,
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "attempts": 1,
      "duration": 819,
      "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
      "errorCode": "JOB_RETRYING",
      "modelUsed": null,
      "retryCount": 1,
      "nextRetryAt": "2025-12-18T04:55:10.170Z",
      "backoffDelayMs": 1000
    }
  },
  {
    "id": "f4a1bb0a-b4ee-47dd-a2b9-eedde04b9a32",
    "action": "JOB_REPORT_RECEIVED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": "299743645a37ef49c0564a1dfdd57d87",
    "signature": "fb8dd9a71196fe639d0bc2dd9dc66e43db17e0b3e4bef83be6ccfcfdab0ed609",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "jobId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
      "reason": "Frame missing: temp/seed/seed-1766033687382/0.png",
      "status": "FAILED",
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
    }
  },
  {
    "id": "6a275d89-7f70-4384-976a-96e76ac22cbe",
    "action": "JOB_STARTED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": "12e10aca04dd4706388a27f26cbb6fba",
    "signature": "497127cb38038b111c04eace4a3cd06a2e4193826cc6a9fdea713d486d6bf069",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "type": "VIDEO_RENDER",
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "workerId": "local-worker"
    }
  },
  {
    "id": "f9ee25e1-3b3f-403f-9e92-bbfc5b33e643",
    "action": "JOB_DISPATCHED",
    "resourceType": "job",
    "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
      "jobType": "VIDEO_RENDER",
      "workerId": "local-worker"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 1
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 4,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 7
  },
  {
    "table_name": "seasons",
    "count": 6,
    "unique_projects": 6
  },
  {
    "table_name": "episodes",
    "count": 6,
    "unique_seasons": 6,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 4,
    "unique_episodes": 4
  },
  {
    "table_name": "shots",
    "count": 4,
    "unique_scenes": 4
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "ec73e2e8-6529-4646-8584-b4edd99f8dd9",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/jobs/capacity",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "0eda625f-c13a-4fe7-8a94-f8e498eb032d",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033687382/0.png",
          "spanId": null,
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "attempts": 1,
          "duration": 819,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:55:10.170Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "f4a1bb0a-b4ee-47dd-a2b9-eedde04b9a32",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": "299743645a37ef49c0564a1dfdd57d87",
        "signature": "fb8dd9a71196fe639d0bc2dd9dc66e43db17e0b3e4bef83be6ccfcfdab0ed609",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
          "reason": "Frame missing: temp/seed/seed-1766033687382/0.png",
          "status": "FAILED",
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "6a275d89-7f70-4384-976a-96e76ac22cbe",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": "12e10aca04dd4706388a27f26cbb6fba",
        "signature": "497127cb38038b111c04eace4a3cd06a2e4193826cc6a9fdea713d486d6bf069",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "workerId": "local-worker"
        }
      },
      {
        "id": "f9ee25e1-3b3f-403f-9e92-bbfc5b33e643",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "5f81ce15-f5d8-450f-bd0e-5677115da563",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "06198151-bc5d-4400-ae26-c0213d0068a7",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "777a8dcd-fc57-4369-a505-bd07e265f75e",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "SHOT_RENDER",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "0fb57c66-fd09-47e1-b5f1-0ece9055e45c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "acf4a664-f0af-4aa6-b785-b2147ed76dc6",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "d754166e-5590-4bf7-8850-3c60609e576b",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033547139/0.png",
          "spanId": null,
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "attempts": 1,
          "duration": 984,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:50.083Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "641421a9-46a5-47be-b2fb-9f92e1bb90f0",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": "c85f078f51a489abdda8d02c8739d35e",
        "signature": "691d4194ac121ea16593b3bfbe07a4e7208eb3d4929d1329d25736de5f0fa893",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "b85f5367-f973-4425-abb1-1fac0afcf253",
          "reason": "Frame missing: temp/seed/seed-1766033547139/0.png",
          "status": "FAILED",
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "2a6df887-6306-45ed-b716-6aa961ff05cc",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": "2f60afad864902bad653448e5b6c37d8",
        "signature": "2d81818e08ef4fb9ecb1a390dd3efe719efee296c9484274ff2428d2ded07f13",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "workerId": "local-worker"
        }
      },
      {
        "id": "52c9cff5-757b-49bd-b660-30b5b11e8aae",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "b85f5367-f973-4425-abb1-1fac0afcf253",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5ceea017-6da1-45f5-b476-5e5a91a005b1",
        "action": "TASK_CREATED",
        "resourceType": "task",
        "resourceId": "cc9a4bb2-9bc5-4ceb-b6f4-7b69f6d91e81",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "SHOT_RENDER",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "58305702-c5f8-4c46-8ff2-3e4ab22a633c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "local-worker",
          "status": "online",
          "workerId": "local-worker",
          "capabilities": {
            "maxBatchSize": 1,
            "supportedModels": [],
            "supportedJobTypes": ["NOVEL_ANALYSIS", "VIDEO_RENDER"]
          }
        }
      },
      {
        "id": "aef93561-cc09-4767-8309-1f559a60d875",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033415354/0.png",
          "spanId": null,
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "attempts": 1,
          "duration": 92755,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:09.984Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "8fc88960-596a-401d-94de-47741b590d25",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": "2c467a1240d06dfc4e6bd3b9b9ec0924",
        "signature": "5ce0116f8070dcd354f1995f0aa76efa6de08979ef4000b3371484a49e607a8d",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
          "reason": "Frame missing: temp/seed/seed-1766033415354/0.png",
          "status": "FAILED",
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      },
      {
        "id": "370054d9-5b66-423f-b03f-07719510fb26",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": "94988835593e5d4237b2e2275da6e752",
        "signature": "a5e60051c1b6e5cc9398f754268a8180583935d6a4ff9cef7178ba3ad4559efc",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "type": "VIDEO_RENDER",
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5b64193d-7c99-4d15-ae9c-3db444ea1447",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "7c5d2eb2-b468-4e93-94ac-5bd70a3270fe",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "f129662c-67e4-4a01-b711-1a72db3371f4",
          "jobType": "VIDEO_RENDER",
          "workerId": "local-worker"
        }
      },
      {
        "id": "5d9154c0-0e79-4857-a7ee-0144cc79d6c7",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "Frame missing: temp/seed/seed-1766033213675/0.png",
          "spanId": null,
          "taskId": "5e800e62-f4ba-474b-bf9c-4d2e1f7ee2f9",
          "attempts": 1,
          "duration": 292340,
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1",
          "errorCode": "JOB_RETRYING",
          "modelUsed": null,
          "retryCount": 1,
          "nextRetryAt": "2025-12-18T04:52:07.996Z",
          "backoffDelayMs": 1000
        }
      },
      {
        "id": "3d6a5a24-0612-448f-8e8d-7f5edc39fe2b",
        "action": "JOB_REPORT_RECEIVED",
        "resourceType": "job",
        "resourceId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
        "nonce": "0c569d7c298b581ef436bd1dca0a228e",
        "signature": "50a9b5fe3929676333752bab80a3affa96e83334d17ac29751743bddc9613f68",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "jobId": "eb3540f5-a7c1-43bf-b30f-ee26673199ed",
          "reason": "Frame missing: temp/seed/seed-1766033213675/0.png",
          "status": "FAILED",
          "taskId": "5e800e62-f4ba-474b-bf9c-4d2e1f7ee2f9",
          "workerId": "ae954767-b89d-4e3d-aee1-5d7a8bc247d1"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 4,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 7
      },
      {
        "table_name": "seasons",
        "count": 6,
        "unique_projects": 6
      },
      {
        "table_name": "episodes",
        "count": 6,
        "unique_seasons": 6,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 4,
        "unique_episodes": 4
      },
      {
        "table_name": "shots",
        "count": 4,
        "unique_scenes": 4
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "9ae1f197-f2e0-47aa-a7ca-0950ea95a32b",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "ff4d1849-7921-4322-ab88-03d0879ddd9c",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766033083710",
      "capabilities": {}
    }
  },
  {
    "id": "717838d8-703b-4457-b8d4-8a90ec424d38",
    "action": "API_FORBIDDEN",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766033083-jfl0zr",
    "signature": "fe3ed119dccb4ec5bb264c76cab768456e096823cdd96461d37556c37cdcd788",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Permission denied"
    }
  },
  {
    "id": "4824c5b8-7c19-4afc-ad38-7383ca6e4292",
    "action": "API_FORBIDDEN",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766033083-hbst",
    "signature": "07975ca177f710fb50547ce090db8be8cf8040f21ac6110b606fcba40f61ec6d",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/non-existent-project-id/scene-graph",
      "method": "GET",
      "message": "Permission denied"
    }
  },
  {
    "id": "d56b5516-fcf9-4255-8494-23c99324ed82",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce_1766032339105",
    "signature": "bbf487c3f6f181a79bca084480133f9d1a8c79cd37125474ef5e9dc76c8a8d1b",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "签名验证失败"
    }
  },
  {
    "id": "e87a8fbb-e768-4c9c-b7b6-3d075789b756",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce_1766032339105",
    "signature": null,
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "nonce": "nonce_1766032339105",
      "method": "POST",
      "reason": "HMAC_SIGNATURE_MISMATCH",
      "timestamp": "1766032339105"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 3
  },
  {
    "table_name": "seasons",
    "count": 2,
    "unique_projects": 2
  },
  {
    "table_name": "episodes",
    "count": 2,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "9ae1f197-f2e0-47aa-a7ca-0950ea95a32b",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "ff4d1849-7921-4322-ab88-03d0879ddd9c",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766033083710",
          "capabilities": {}
        }
      },
      {
        "id": "717838d8-703b-4457-b8d4-8a90ec424d38",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766033083-jfl0zr",
        "signature": "fe3ed119dccb4ec5bb264c76cab768456e096823cdd96461d37556c37cdcd788",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "4824c5b8-7c19-4afc-ad38-7383ca6e4292",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766033083-hbst",
        "signature": "07975ca177f710fb50547ce090db8be8cf8040f21ac6110b606fcba40f61ec6d",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/non-existent-project-id/scene-graph",
          "method": "GET",
          "message": "Permission denied"
        }
      },
      {
        "id": "d56b5516-fcf9-4255-8494-23c99324ed82",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce_1766032339105",
        "signature": "bbf487c3f6f181a79bca084480133f9d1a8c79cd37125474ef5e9dc76c8a8d1b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "e87a8fbb-e768-4c9c-b7b6-3d075789b756",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce_1766032339105",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "nonce": "nonce_1766032339105",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766032339105"
        }
      },
      {
        "id": "6853f79a-969c-409d-bfa4-84a893e6a190",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "2bd30283-56fc-42b6-8ef8-cf4e46e3a373",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766029851572",
          "capabilities": {}
        }
      },
      {
        "id": "ae4f0172-9d37-42e0-bbf0-340c82a15a78",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766029851-48ff9m",
        "signature": "41a866a8a5eb316d8e31a63b61ccd74330806e200fb397c2349906ad71a5da41",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "6da86c8c-2878-4ee0-b576-da86658c4209",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766029851-ykpio",
        "signature": "b309659babecbd50136d27b2bc62a376541288de8a5843f9f0f387a1423b0fc6",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/non-existent-project-id/scene-graph",
          "method": "GET",
          "message": "Permission denied"
        }
      },
      {
        "id": "eb12238d-2b55-43e8-9f07-3f2657edd253",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "5f936c1c-276c-4c97-8935-ff09d820e43b",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766028386060",
          "capabilities": {}
        }
      },
      {
        "id": "aa185003-b5eb-4709-ae9b-0918d5e60992",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028386-cecnh",
        "signature": "6aaab864be5509b4263acde187d89e781e0c586df6e9b8fb24632dee446cef46",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "3f0dd898-e713-42b7-ae70-f8131f339211",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-vo93u",
        "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "85aef9f2-022d-4865-8191-4f9e53b08196",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-vo93u",
        "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "92459449-07e5-4467-9aa4-7b81a120a724",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-s442z",
        "signature": "c3462186cbd23f19b30464480d26a217ebcc34018378d23af2849f225335d638",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers/smoke-worker-1766028131431/heartbeat",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "933fce57-0fd8-42fa-be6e-1c2ed4b3a8f9",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-s442z",
        "signature": "c3462186cbd23f19b30464480d26a217ebcc34018378d23af2849f225335d638",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers/smoke-worker-1766028131431/heartbeat",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "c746741d-4a1b-4f8e-87aa-e256515e6ca6",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-vvjf8r",
        "signature": "cf7314bc27f74d3cec4adc4e536c5a44c0928e85016d8a5dc33dc8f79af46888",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "f03a22ab-7a35-46a9-ac61-48552fc9ee09",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-vvjf8r",
        "signature": "cf7314bc27f74d3cec4adc4e536c5a44c0928e85016d8a5dc33dc8f79af46888",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "dd57f189-6d03-4aed-b9b8-e6ffbacd70c9",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-4ruk9",
        "signature": "108cbab1dbea907b0d0b616de395b569895efd0166c1d449681c9eaadb4757c3",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "c0232607-5f55-4587-9553-548de6e3670a",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-4ruk9",
        "signature": "108cbab1dbea907b0d0b616de395b569895efd0166c1d449681c9eaadb4757c3",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "59f93a81-bcfa-4bec-8973-105ae5874279",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "4e635c5c49b6e5d3ecfd9b7a3bd793a47b9d247257123370903e7a1d64881211",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "69edfbc9-4446-413a-a0ca-ab05bcd9577d",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "4e635c5c49b6e5d3ecfd9b7a3bd793a47b9d247257123370903e7a1d64881211",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "GET",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 3
      },
      {
        "table_name": "seasons",
        "count": 2,
        "unique_projects": 2
      },
      {
        "table_name": "episodes",
        "count": 2,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "6853f79a-969c-409d-bfa4-84a893e6a190",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "2bd30283-56fc-42b6-8ef8-cf4e46e3a373",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766029851572",
      "capabilities": {}
    }
  },
  {
    "id": "ae4f0172-9d37-42e0-bbf0-340c82a15a78",
    "action": "API_FORBIDDEN",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766029851-48ff9m",
    "signature": "41a866a8a5eb316d8e31a63b61ccd74330806e200fb397c2349906ad71a5da41",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Permission denied"
    }
  },
  {
    "id": "6da86c8c-2878-4ee0-b576-da86658c4209",
    "action": "API_FORBIDDEN",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766029851-ykpio",
    "signature": "b309659babecbd50136d27b2bc62a376541288de8a5843f9f0f387a1423b0fc6",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/non-existent-project-id/scene-graph",
      "method": "GET",
      "message": "Permission denied"
    }
  },
  {
    "id": "eb12238d-2b55-43e8-9f07-3f2657edd253",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "5f936c1c-276c-4c97-8935-ff09d820e43b",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766028386060",
      "capabilities": {}
    }
  },
  {
    "id": "aa185003-b5eb-4709-ae9b-0918d5e60992",
    "action": "API_FORBIDDEN",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766028386-cecnh",
    "signature": "6aaab864be5509b4263acde187d89e781e0c586df6e9b8fb24632dee446cef46",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Permission denied"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 3
  },
  {
    "table_name": "seasons",
    "count": 2,
    "unique_projects": 2
  },
  {
    "table_name": "episodes",
    "count": 2,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "6853f79a-969c-409d-bfa4-84a893e6a190",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "2bd30283-56fc-42b6-8ef8-cf4e46e3a373",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766029851572",
          "capabilities": {}
        }
      },
      {
        "id": "ae4f0172-9d37-42e0-bbf0-340c82a15a78",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766029851-48ff9m",
        "signature": "41a866a8a5eb316d8e31a63b61ccd74330806e200fb397c2349906ad71a5da41",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "6da86c8c-2878-4ee0-b576-da86658c4209",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766029851-ykpio",
        "signature": "b309659babecbd50136d27b2bc62a376541288de8a5843f9f0f387a1423b0fc6",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/non-existent-project-id/scene-graph",
          "method": "GET",
          "message": "Permission denied"
        }
      },
      {
        "id": "eb12238d-2b55-43e8-9f07-3f2657edd253",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "5f936c1c-276c-4c97-8935-ff09d820e43b",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766028386060",
          "capabilities": {}
        }
      },
      {
        "id": "aa185003-b5eb-4709-ae9b-0918d5e60992",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028386-cecnh",
        "signature": "6aaab864be5509b4263acde187d89e781e0c586df6e9b8fb24632dee446cef46",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "3f0dd898-e713-42b7-ae70-f8131f339211",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-vo93u",
        "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "85aef9f2-022d-4865-8191-4f9e53b08196",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-vo93u",
        "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "92459449-07e5-4467-9aa4-7b81a120a724",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-s442z",
        "signature": "c3462186cbd23f19b30464480d26a217ebcc34018378d23af2849f225335d638",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers/smoke-worker-1766028131431/heartbeat",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "933fce57-0fd8-42fa-be6e-1c2ed4b3a8f9",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-s442z",
        "signature": "c3462186cbd23f19b30464480d26a217ebcc34018378d23af2849f225335d638",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers/smoke-worker-1766028131431/heartbeat",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "c746741d-4a1b-4f8e-87aa-e256515e6ca6",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-vvjf8r",
        "signature": "cf7314bc27f74d3cec4adc4e536c5a44c0928e85016d8a5dc33dc8f79af46888",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "f03a22ab-7a35-46a9-ac61-48552fc9ee09",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-vvjf8r",
        "signature": "cf7314bc27f74d3cec4adc4e536c5a44c0928e85016d8a5dc33dc8f79af46888",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "dd57f189-6d03-4aed-b9b8-e6ffbacd70c9",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-4ruk9",
        "signature": "108cbab1dbea907b0d0b616de395b569895efd0166c1d449681c9eaadb4757c3",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "c0232607-5f55-4587-9553-548de6e3670a",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-4ruk9",
        "signature": "108cbab1dbea907b0d0b616de395b569895efd0166c1d449681c9eaadb4757c3",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "59f93a81-bcfa-4bec-8973-105ae5874279",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "4e635c5c49b6e5d3ecfd9b7a3bd793a47b9d247257123370903e7a1d64881211",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "69edfbc9-4446-413a-a0ca-ab05bcd9577d",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "4e635c5c49b6e5d3ecfd9b7a3bd793a47b9d247257123370903e7a1d64881211",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "GET",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "1b917a41-b6dc-498d-8a1e-397baeae24b7",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "b3264180aa0f86371a2bf7526c4cdeccf5541fb92ac0fac996b7c5e2eff6a4ff",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "755f80e4-bf21-42f0-a39d-02c00f43ccbe",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "b3264180aa0f86371a2bf7526c4cdeccf5541fb92ac0fac996b7c5e2eff6a4ff",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "GET",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "5533cf03-3d2e-4ef0-a5e9-0c3b8f2d91be",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-5g83mc",
        "signature": "64857264bd43bcd9b703bd2657e3751d653d52b4a0101774188e8f4ff4b56259",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "ac952945-42e3-4385-b894-de28ac7906d6",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-5g83mc",
        "signature": "64857264bd43bcd9b703bd2657e3751d653d52b4a0101774188e8f4ff4b56259",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "GET",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "fb4b8cd9-c0b1-4826-86d4-3d98f271272e",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "b3176ba8-0186-492c-84af-7d4b3b2d34cd",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027770117",
          "capabilities": {}
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 3
      },
      {
        "table_name": "seasons",
        "count": 2,
        "unique_projects": 2
      },
      {
        "table_name": "episodes",
        "count": 2,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "eb12238d-2b55-43e8-9f07-3f2657edd253",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "5f936c1c-276c-4c97-8935-ff09d820e43b",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766028386060",
      "capabilities": {}
    }
  },
  {
    "id": "aa185003-b5eb-4709-ae9b-0918d5e60992",
    "action": "API_FORBIDDEN",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766028386-cecnh",
    "signature": "6aaab864be5509b4263acde187d89e781e0c586df6e9b8fb24632dee446cef46",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Permission denied"
    }
  },
  {
    "id": "3f0dd898-e713-42b7-ae70-f8131f339211",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766028131-vo93u",
    "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
      "method": "POST",
      "message": "无效的 API Key"
    }
  },
  {
    "id": "85aef9f2-022d-4865-8191-4f9e53b08196",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766028131-vo93u",
    "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "无效的 API Key"
    }
  },
  {
    "id": "92459449-07e5-4467-9aa4-7b81a120a724",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766028131-s442z",
    "signature": "c3462186cbd23f19b30464480d26a217ebcc34018378d23af2849f225335d638",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/workers/smoke-worker-1766028131431/heartbeat",
      "method": "POST",
      "message": "无效的 API Key"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 3
  },
  {
    "table_name": "seasons",
    "count": 2,
    "unique_projects": 2
  },
  {
    "table_name": "episodes",
    "count": 2,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "eb12238d-2b55-43e8-9f07-3f2657edd253",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "5f936c1c-276c-4c97-8935-ff09d820e43b",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766028386060",
          "capabilities": {}
        }
      },
      {
        "id": "aa185003-b5eb-4709-ae9b-0918d5e60992",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028386-cecnh",
        "signature": "6aaab864be5509b4263acde187d89e781e0c586df6e9b8fb24632dee446cef46",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "3f0dd898-e713-42b7-ae70-f8131f339211",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-vo93u",
        "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "85aef9f2-022d-4865-8191-4f9e53b08196",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-vo93u",
        "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "92459449-07e5-4467-9aa4-7b81a120a724",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-s442z",
        "signature": "c3462186cbd23f19b30464480d26a217ebcc34018378d23af2849f225335d638",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers/smoke-worker-1766028131431/heartbeat",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "933fce57-0fd8-42fa-be6e-1c2ed4b3a8f9",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-s442z",
        "signature": "c3462186cbd23f19b30464480d26a217ebcc34018378d23af2849f225335d638",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers/smoke-worker-1766028131431/heartbeat",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "c746741d-4a1b-4f8e-87aa-e256515e6ca6",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-vvjf8r",
        "signature": "cf7314bc27f74d3cec4adc4e536c5a44c0928e85016d8a5dc33dc8f79af46888",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "f03a22ab-7a35-46a9-ac61-48552fc9ee09",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-vvjf8r",
        "signature": "cf7314bc27f74d3cec4adc4e536c5a44c0928e85016d8a5dc33dc8f79af46888",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "dd57f189-6d03-4aed-b9b8-e6ffbacd70c9",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-4ruk9",
        "signature": "108cbab1dbea907b0d0b616de395b569895efd0166c1d449681c9eaadb4757c3",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "c0232607-5f55-4587-9553-548de6e3670a",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-4ruk9",
        "signature": "108cbab1dbea907b0d0b616de395b569895efd0166c1d449681c9eaadb4757c3",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "59f93a81-bcfa-4bec-8973-105ae5874279",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "4e635c5c49b6e5d3ecfd9b7a3bd793a47b9d247257123370903e7a1d64881211",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "69edfbc9-4446-413a-a0ca-ab05bcd9577d",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "4e635c5c49b6e5d3ecfd9b7a3bd793a47b9d247257123370903e7a1d64881211",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "GET",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "1b917a41-b6dc-498d-8a1e-397baeae24b7",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "b3264180aa0f86371a2bf7526c4cdeccf5541fb92ac0fac996b7c5e2eff6a4ff",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "755f80e4-bf21-42f0-a39d-02c00f43ccbe",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "b3264180aa0f86371a2bf7526c4cdeccf5541fb92ac0fac996b7c5e2eff6a4ff",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "GET",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "5533cf03-3d2e-4ef0-a5e9-0c3b8f2d91be",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-5g83mc",
        "signature": "64857264bd43bcd9b703bd2657e3751d653d52b4a0101774188e8f4ff4b56259",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "ac952945-42e3-4385-b894-de28ac7906d6",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-5g83mc",
        "signature": "64857264bd43bcd9b703bd2657e3751d653d52b4a0101774188e8f4ff4b56259",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "GET",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "fb4b8cd9-c0b1-4826-86d4-3d98f271272e",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "b3176ba8-0186-492c-84af-7d4b3b2d34cd",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027770117",
          "capabilities": {}
        }
      },
      {
        "id": "1d097af7-516e-49ed-a91d-b527c678bd20",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766027770-cm15ol",
        "signature": "feac7a13c97d9ba31f29f8b435670026c5a11c3968f527c58f05b36cb427d835",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "a42a01cd-435b-4738-ba6c-288fe27b69af",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "5b3b2ef6-ca3b-469e-a2ea-26289c44bac7",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027734148",
          "capabilities": {}
        }
      },
      {
        "id": "8bc0388b-2c13-46a8-b28a-5b49937f97a7",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766027734-t7ctdx",
        "signature": "8b74cb27b4186543e0cab4d9fce196b9e5e13b21a6139524b9155d37d4127eb6",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 3
      },
      {
        "table_name": "seasons",
        "count": 2,
        "unique_projects": 2
      },
      {
        "table_name": "episodes",
        "count": 2,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "3f0dd898-e713-42b7-ae70-f8131f339211",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766028131-vo93u",
    "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
      "method": "POST",
      "message": "无效的 API Key"
    }
  },
  {
    "id": "85aef9f2-022d-4865-8191-4f9e53b08196",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766028131-vo93u",
    "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "无效的 API Key"
    }
  },
  {
    "id": "92459449-07e5-4467-9aa4-7b81a120a724",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766028131-s442z",
    "signature": "c3462186cbd23f19b30464480d26a217ebcc34018378d23af2849f225335d638",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/workers/smoke-worker-1766028131431/heartbeat",
      "method": "POST",
      "message": "无效的 API Key"
    }
  },
  {
    "id": "933fce57-0fd8-42fa-be6e-1c2ed4b3a8f9",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766028131-s442z",
    "signature": "c3462186cbd23f19b30464480d26a217ebcc34018378d23af2849f225335d638",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/workers/smoke-worker-1766028131431/heartbeat",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "无效的 API Key"
    }
  },
  {
    "id": "c746741d-4a1b-4f8e-87aa-e256515e6ca6",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766028131-vvjf8r",
    "signature": "cf7314bc27f74d3cec4adc4e536c5a44c0928e85016d8a5dc33dc8f79af46888",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/workers",
      "method": "POST",
      "message": "无效的 API Key"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 3
  },
  {
    "table_name": "seasons",
    "count": 2,
    "unique_projects": 2
  },
  {
    "table_name": "episodes",
    "count": 2,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "3f0dd898-e713-42b7-ae70-f8131f339211",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-vo93u",
        "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "85aef9f2-022d-4865-8191-4f9e53b08196",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-vo93u",
        "signature": "7c76a2ce07217b8e2e38d005c04b319441be84009dafb4cb7032e2791c042f7b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers/smoke-worker-1766028131431/jobs/next",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "92459449-07e5-4467-9aa4-7b81a120a724",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-s442z",
        "signature": "c3462186cbd23f19b30464480d26a217ebcc34018378d23af2849f225335d638",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers/smoke-worker-1766028131431/heartbeat",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "933fce57-0fd8-42fa-be6e-1c2ed4b3a8f9",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-s442z",
        "signature": "c3462186cbd23f19b30464480d26a217ebcc34018378d23af2849f225335d638",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers/smoke-worker-1766028131431/heartbeat",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "c746741d-4a1b-4f8e-87aa-e256515e6ca6",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-vvjf8r",
        "signature": "cf7314bc27f74d3cec4adc4e536c5a44c0928e85016d8a5dc33dc8f79af46888",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/workers",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "f03a22ab-7a35-46a9-ac61-48552fc9ee09",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-vvjf8r",
        "signature": "cf7314bc27f74d3cec4adc4e536c5a44c0928e85016d8a5dc33dc8f79af46888",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/workers",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "dd57f189-6d03-4aed-b9b8-e6ffbacd70c9",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-4ruk9",
        "signature": "108cbab1dbea907b0d0b616de395b569895efd0166c1d449681c9eaadb4757c3",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "c0232607-5f55-4587-9553-548de6e3670a",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-4ruk9",
        "signature": "108cbab1dbea907b0d0b616de395b569895efd0166c1d449681c9eaadb4757c3",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "59f93a81-bcfa-4bec-8973-105ae5874279",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "4e635c5c49b6e5d3ecfd9b7a3bd793a47b9d247257123370903e7a1d64881211",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "69edfbc9-4446-413a-a0ca-ab05bcd9577d",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "4e635c5c49b6e5d3ecfd9b7a3bd793a47b9d247257123370903e7a1d64881211",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "GET",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "1b917a41-b6dc-498d-8a1e-397baeae24b7",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "b3264180aa0f86371a2bf7526c4cdeccf5541fb92ac0fac996b7c5e2eff6a4ff",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "755f80e4-bf21-42f0-a39d-02c00f43ccbe",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "replay-test-1766028131-33tuk",
        "signature": "b3264180aa0f86371a2bf7526c4cdeccf5541fb92ac0fac996b7c5e2eff6a4ff",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "GET",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "5533cf03-3d2e-4ef0-a5e9-0c3b8f2d91be",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766028131-5g83mc",
        "signature": "64857264bd43bcd9b703bd2657e3751d653d52b4a0101774188e8f4ff4b56259",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "ac952945-42e3-4385-b894-de28ac7906d6",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766028131-5g83mc",
        "signature": "64857264bd43bcd9b703bd2657e3751d653d52b4a0101774188e8f4ff4b56259",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects",
          "method": "GET",
          "reason": "HMAC_AUTH_FAILED",
          "message": "无效的 API Key"
        }
      },
      {
        "id": "fb4b8cd9-c0b1-4826-86d4-3d98f271272e",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "b3176ba8-0186-492c-84af-7d4b3b2d34cd",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027770117",
          "capabilities": {}
        }
      },
      {
        "id": "1d097af7-516e-49ed-a91d-b527c678bd20",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766027770-cm15ol",
        "signature": "feac7a13c97d9ba31f29f8b435670026c5a11c3968f527c58f05b36cb427d835",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "a42a01cd-435b-4738-ba6c-288fe27b69af",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "5b3b2ef6-ca3b-469e-a2ea-26289c44bac7",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027734148",
          "capabilities": {}
        }
      },
      {
        "id": "8bc0388b-2c13-46a8-b28a-5b49937f97a7",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766027734-t7ctdx",
        "signature": "8b74cb27b4186543e0cab4d9fce196b9e5e13b21a6139524b9155d37d4127eb6",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "a13806ec-86e9-4aa4-bc3c-4ff24eff19ff",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "242f212d-1dcd-4d57-b794-6cc6e4238f4f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027670199",
          "capabilities": {}
        }
      },
      {
        "id": "c35075d5-c987-487a-8fbb-baf40e8d9d28",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766027670-s9hta3",
        "signature": "451c4827b0eac0796c790d3543f904cd29f3759d0ee55ad13da922aa9c29614a",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 3
      },
      {
        "table_name": "seasons",
        "count": 2,
        "unique_projects": 2
      },
      {
        "table_name": "episodes",
        "count": 2,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "fb4b8cd9-c0b1-4826-86d4-3d98f271272e",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "b3176ba8-0186-492c-84af-7d4b3b2d34cd",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766027770117",
      "capabilities": {}
    }
  },
  {
    "id": "1d097af7-516e-49ed-a91d-b527c678bd20",
    "action": "API_FORBIDDEN",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766027770-cm15ol",
    "signature": "feac7a13c97d9ba31f29f8b435670026c5a11c3968f527c58f05b36cb427d835",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Permission denied"
    }
  },
  {
    "id": "a42a01cd-435b-4738-ba6c-288fe27b69af",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "5b3b2ef6-ca3b-469e-a2ea-26289c44bac7",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766027734148",
      "capabilities": {}
    }
  },
  {
    "id": "8bc0388b-2c13-46a8-b28a-5b49937f97a7",
    "action": "API_FORBIDDEN",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766027734-t7ctdx",
    "signature": "8b74cb27b4186543e0cab4d9fce196b9e5e13b21a6139524b9155d37d4127eb6",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Permission denied"
    }
  },
  {
    "id": "a13806ec-86e9-4aa4-bc3c-4ff24eff19ff",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "242f212d-1dcd-4d57-b794-6cc6e4238f4f",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766027670199",
      "capabilities": {}
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 3
  },
  {
    "table_name": "seasons",
    "count": 2,
    "unique_projects": 2
  },
  {
    "table_name": "episodes",
    "count": 2,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "fb4b8cd9-c0b1-4826-86d4-3d98f271272e",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "b3176ba8-0186-492c-84af-7d4b3b2d34cd",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027770117",
          "capabilities": {}
        }
      },
      {
        "id": "1d097af7-516e-49ed-a91d-b527c678bd20",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766027770-cm15ol",
        "signature": "feac7a13c97d9ba31f29f8b435670026c5a11c3968f527c58f05b36cb427d835",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "a42a01cd-435b-4738-ba6c-288fe27b69af",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "5b3b2ef6-ca3b-469e-a2ea-26289c44bac7",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027734148",
          "capabilities": {}
        }
      },
      {
        "id": "8bc0388b-2c13-46a8-b28a-5b49937f97a7",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766027734-t7ctdx",
        "signature": "8b74cb27b4186543e0cab4d9fce196b9e5e13b21a6139524b9155d37d4127eb6",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "a13806ec-86e9-4aa4-bc3c-4ff24eff19ff",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "242f212d-1dcd-4d57-b794-6cc6e4238f4f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027670199",
          "capabilities": {}
        }
      },
      {
        "id": "c35075d5-c987-487a-8fbb-baf40e8d9d28",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766027670-s9hta3",
        "signature": "451c4827b0eac0796c790d3543f904cd29f3759d0ee55ad13da922aa9c29614a",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "f4dd109f-4ddf-4ff1-b8b2-9af91df7a504",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "aae7834b-eb93-43ac-bd83-e8f142848418",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025502734",
          "capabilities": {}
        }
      },
      {
        "id": "61f14cfa-2723-4a8f-90a5-1eebeb72db3e",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "16d3146a-c609-407b-b511-7ed52fae8856",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/16d3146a-c609-407b-b511-7ed52fae8856/episodes",
          "method": "POST"
        }
      },
      {
        "id": "0106a594-ca5c-4895-b51e-afa2e8433154",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "0ebf084d-837d-47c6-97c2-b0d2be26512c",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "16d3146a-c609-407b-b511-7ed52fae8856",
          "episodeIndex": 1
        }
      },
      {
        "id": "1e91a519-a89b-4b90-b230-c508721618a7",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "831329bb-e21b-42b7-8bcc-16b755ebf5a5",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "16d3146a-c609-407b-b511-7ed52fae8856",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025502662",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "4e4a0626-1c2f-44d3-8f3d-087b58ee7a3e",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766025289-i3dta",
        "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "9568a479-4611-4a4f-b189-213fa52c9bf5",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766025289-i3dta",
        "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "f7d65a03-97ba-4d38-a45e-13e2ea93fc54",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766025289-i3dta",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "nonce": "nonce-1766025289-i3dta",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766025289"
        }
      },
      {
        "id": "1540177c-75fe-432d-be27-c018998f566c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "824b32b7-6c31-4fb0-85b9-65407b8c8cfa",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025289963",
          "capabilities": {}
        }
      },
      {
        "id": "0a7eb80a-068f-4e77-a58e-29b1ed5de554",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/episodes",
          "method": "POST"
        }
      },
      {
        "id": "8a09479a-2c23-4b6c-a385-ced0bc93b6f4",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "e31ef508-bedb-44c9-ae20-bfcec6796735",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
          "episodeIndex": 1
        }
      },
      {
        "id": "5d476833-ef5d-4e9e-813f-5af135ba7756",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "3f40424d-949b-45b1-845a-3e9985967007",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025289890",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "246a8522-b1fb-48b8-93aa-018578c71bcb",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "d78d4b88-9023-43ce-9838-137df91aaaa3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025191914",
          "capabilities": {}
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 3
      },
      {
        "table_name": "seasons",
        "count": 2,
        "unique_projects": 2
      },
      {
        "table_name": "episodes",
        "count": 2,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "a42a01cd-435b-4738-ba6c-288fe27b69af",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "5b3b2ef6-ca3b-469e-a2ea-26289c44bac7",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766027734148",
      "capabilities": {}
    }
  },
  {
    "id": "8bc0388b-2c13-46a8-b28a-5b49937f97a7",
    "action": "API_FORBIDDEN",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766027734-t7ctdx",
    "signature": "8b74cb27b4186543e0cab4d9fce196b9e5e13b21a6139524b9155d37d4127eb6",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Permission denied"
    }
  },
  {
    "id": "a13806ec-86e9-4aa4-bc3c-4ff24eff19ff",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "242f212d-1dcd-4d57-b794-6cc6e4238f4f",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766027670199",
      "capabilities": {}
    }
  },
  {
    "id": "c35075d5-c987-487a-8fbb-baf40e8d9d28",
    "action": "API_FORBIDDEN",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766027670-s9hta3",
    "signature": "451c4827b0eac0796c790d3543f904cd29f3759d0ee55ad13da922aa9c29614a",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Permission denied"
    }
  },
  {
    "id": "f4dd109f-4ddf-4ff1-b8b2-9af91df7a504",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "aae7834b-eb93-43ac-bd83-e8f142848418",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766025502734",
      "capabilities": {}
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 3
  },
  {
    "table_name": "seasons",
    "count": 2,
    "unique_projects": 2
  },
  {
    "table_name": "episodes",
    "count": 2,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "a42a01cd-435b-4738-ba6c-288fe27b69af",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "5b3b2ef6-ca3b-469e-a2ea-26289c44bac7",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027734148",
          "capabilities": {}
        }
      },
      {
        "id": "8bc0388b-2c13-46a8-b28a-5b49937f97a7",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766027734-t7ctdx",
        "signature": "8b74cb27b4186543e0cab4d9fce196b9e5e13b21a6139524b9155d37d4127eb6",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "a13806ec-86e9-4aa4-bc3c-4ff24eff19ff",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "242f212d-1dcd-4d57-b794-6cc6e4238f4f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027670199",
          "capabilities": {}
        }
      },
      {
        "id": "c35075d5-c987-487a-8fbb-baf40e8d9d28",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766027670-s9hta3",
        "signature": "451c4827b0eac0796c790d3543f904cd29f3759d0ee55ad13da922aa9c29614a",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "f4dd109f-4ddf-4ff1-b8b2-9af91df7a504",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "aae7834b-eb93-43ac-bd83-e8f142848418",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025502734",
          "capabilities": {}
        }
      },
      {
        "id": "61f14cfa-2723-4a8f-90a5-1eebeb72db3e",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "16d3146a-c609-407b-b511-7ed52fae8856",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/16d3146a-c609-407b-b511-7ed52fae8856/episodes",
          "method": "POST"
        }
      },
      {
        "id": "0106a594-ca5c-4895-b51e-afa2e8433154",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "0ebf084d-837d-47c6-97c2-b0d2be26512c",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "16d3146a-c609-407b-b511-7ed52fae8856",
          "episodeIndex": 1
        }
      },
      {
        "id": "1e91a519-a89b-4b90-b230-c508721618a7",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "831329bb-e21b-42b7-8bcc-16b755ebf5a5",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "16d3146a-c609-407b-b511-7ed52fae8856",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025502662",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "4e4a0626-1c2f-44d3-8f3d-087b58ee7a3e",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766025289-i3dta",
        "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "9568a479-4611-4a4f-b189-213fa52c9bf5",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766025289-i3dta",
        "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "f7d65a03-97ba-4d38-a45e-13e2ea93fc54",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766025289-i3dta",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "nonce": "nonce-1766025289-i3dta",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766025289"
        }
      },
      {
        "id": "1540177c-75fe-432d-be27-c018998f566c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "824b32b7-6c31-4fb0-85b9-65407b8c8cfa",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025289963",
          "capabilities": {}
        }
      },
      {
        "id": "0a7eb80a-068f-4e77-a58e-29b1ed5de554",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/episodes",
          "method": "POST"
        }
      },
      {
        "id": "8a09479a-2c23-4b6c-a385-ced0bc93b6f4",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "e31ef508-bedb-44c9-ae20-bfcec6796735",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
          "episodeIndex": 1
        }
      },
      {
        "id": "5d476833-ef5d-4e9e-813f-5af135ba7756",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "3f40424d-949b-45b1-845a-3e9985967007",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025289890",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "246a8522-b1fb-48b8-93aa-018578c71bcb",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "d78d4b88-9023-43ce-9838-137df91aaaa3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025191914",
          "capabilities": {}
        }
      },
      {
        "id": "02f7a5e8-969b-4df5-be52-e8f45b52dac8",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "f5191a50-01e2-47a0-865d-f3ee5bb44ae3",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "5803356c-7bad-4d81-a9b9-45a19b2f0517",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025191847",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 3
      },
      {
        "table_name": "seasons",
        "count": 2,
        "unique_projects": 2
      },
      {
        "table_name": "episodes",
        "count": 2,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 18
- **结果示例** (前 5 行):

```json
[
  {
    "id": "a13806ec-86e9-4aa4-bc3c-4ff24eff19ff",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "242f212d-1dcd-4d57-b794-6cc6e4238f4f",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766027670199",
      "capabilities": {}
    }
  },
  {
    "id": "c35075d5-c987-487a-8fbb-baf40e8d9d28",
    "action": "API_FORBIDDEN",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766027670-s9hta3",
    "signature": "451c4827b0eac0796c790d3543f904cd29f3759d0ee55ad13da922aa9c29614a",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Permission denied"
    }
  },
  {
    "id": "f4dd109f-4ddf-4ff1-b8b2-9af91df7a504",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "aae7834b-eb93-43ac-bd83-e8f142848418",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766025502734",
      "capabilities": {}
    }
  },
  {
    "id": "61f14cfa-2723-4a8f-90a5-1eebeb72db3e",
    "action": "EPISODE_CREATE",
    "resourceType": "/api/projects/:projectId/episodes",
    "resourceId": "16d3146a-c609-407b-b511-7ed52fae8856",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/16d3146a-c609-407b-b511-7ed52fae8856/episodes",
      "method": "POST"
    }
  },
  {
    "id": "0106a594-ca5c-4895-b51e-afa2e8433154",
    "action": "EPISODE_CREATE",
    "resourceType": "episode",
    "resourceId": "0ebf084d-837d-47c6-97c2-b0d2be26512c",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "16d3146a-c609-407b-b511-7ed52fae8856",
      "episodeIndex": 1
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 3
  },
  {
    "table_name": "seasons",
    "count": 2,
    "unique_projects": 2
  },
  {
    "table_name": "episodes",
    "count": 2,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "a13806ec-86e9-4aa4-bc3c-4ff24eff19ff",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "242f212d-1dcd-4d57-b794-6cc6e4238f4f",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766027670199",
          "capabilities": {}
        }
      },
      {
        "id": "c35075d5-c987-487a-8fbb-baf40e8d9d28",
        "action": "API_FORBIDDEN",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766027670-s9hta3",
        "signature": "451c4827b0eac0796c790d3543f904cd29f3759d0ee55ad13da922aa9c29614a",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Permission denied"
        }
      },
      {
        "id": "f4dd109f-4ddf-4ff1-b8b2-9af91df7a504",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "aae7834b-eb93-43ac-bd83-e8f142848418",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025502734",
          "capabilities": {}
        }
      },
      {
        "id": "61f14cfa-2723-4a8f-90a5-1eebeb72db3e",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "16d3146a-c609-407b-b511-7ed52fae8856",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/16d3146a-c609-407b-b511-7ed52fae8856/episodes",
          "method": "POST"
        }
      },
      {
        "id": "0106a594-ca5c-4895-b51e-afa2e8433154",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "0ebf084d-837d-47c6-97c2-b0d2be26512c",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "16d3146a-c609-407b-b511-7ed52fae8856",
          "episodeIndex": 1
        }
      },
      {
        "id": "1e91a519-a89b-4b90-b230-c508721618a7",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "831329bb-e21b-42b7-8bcc-16b755ebf5a5",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "16d3146a-c609-407b-b511-7ed52fae8856",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025502662",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "4e4a0626-1c2f-44d3-8f3d-087b58ee7a3e",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766025289-i3dta",
        "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "9568a479-4611-4a4f-b189-213fa52c9bf5",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766025289-i3dta",
        "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "f7d65a03-97ba-4d38-a45e-13e2ea93fc54",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766025289-i3dta",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "nonce": "nonce-1766025289-i3dta",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766025289"
        }
      },
      {
        "id": "1540177c-75fe-432d-be27-c018998f566c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "824b32b7-6c31-4fb0-85b9-65407b8c8cfa",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025289963",
          "capabilities": {}
        }
      },
      {
        "id": "0a7eb80a-068f-4e77-a58e-29b1ed5de554",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/episodes",
          "method": "POST"
        }
      },
      {
        "id": "8a09479a-2c23-4b6c-a385-ced0bc93b6f4",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "e31ef508-bedb-44c9-ae20-bfcec6796735",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
          "episodeIndex": 1
        }
      },
      {
        "id": "5d476833-ef5d-4e9e-813f-5af135ba7756",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "3f40424d-949b-45b1-845a-3e9985967007",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025289890",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "246a8522-b1fb-48b8-93aa-018578c71bcb",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "d78d4b88-9023-43ce-9838-137df91aaaa3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025191914",
          "capabilities": {}
        }
      },
      {
        "id": "02f7a5e8-969b-4df5-be52-e8f45b52dac8",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "f5191a50-01e2-47a0-865d-f3ee5bb44ae3",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "5803356c-7bad-4d81-a9b9-45a19b2f0517",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025191847",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 3
      },
      {
        "table_name": "seasons",
        "count": 2,
        "unique_projects": 2
      },
      {
        "table_name": "episodes",
        "count": 2,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 16
- **结果示例** (前 5 行):

```json
[
  {
    "id": "f4dd109f-4ddf-4ff1-b8b2-9af91df7a504",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "aae7834b-eb93-43ac-bd83-e8f142848418",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766025502734",
      "capabilities": {}
    }
  },
  {
    "id": "61f14cfa-2723-4a8f-90a5-1eebeb72db3e",
    "action": "EPISODE_CREATE",
    "resourceType": "/api/projects/:projectId/episodes",
    "resourceId": "16d3146a-c609-407b-b511-7ed52fae8856",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/16d3146a-c609-407b-b511-7ed52fae8856/episodes",
      "method": "POST"
    }
  },
  {
    "id": "0106a594-ca5c-4895-b51e-afa2e8433154",
    "action": "EPISODE_CREATE",
    "resourceType": "episode",
    "resourceId": "0ebf084d-837d-47c6-97c2-b0d2be26512c",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "projectId": "16d3146a-c609-407b-b511-7ed52fae8856",
      "episodeIndex": 1
    }
  },
  {
    "id": "1e91a519-a89b-4b90-b230-c508721618a7",
    "action": "PROJECT_CREATE",
    "resourceType": "/api/projects",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST"
    }
  },
  {
    "id": "831329bb-e21b-42b7-8bcc-16b755ebf5a5",
    "action": "PROJECT_CREATED",
    "resourceType": "project",
    "resourceId": "16d3146a-c609-407b-b511-7ed52fae8856",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Project 1766025502662",
      "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 3
  },
  {
    "table_name": "seasons",
    "count": 2,
    "unique_projects": 2
  },
  {
    "table_name": "episodes",
    "count": 2,
    "unique_seasons": 2,
    "unique_projects": 2
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "f4dd109f-4ddf-4ff1-b8b2-9af91df7a504",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "aae7834b-eb93-43ac-bd83-e8f142848418",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025502734",
          "capabilities": {}
        }
      },
      {
        "id": "61f14cfa-2723-4a8f-90a5-1eebeb72db3e",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "16d3146a-c609-407b-b511-7ed52fae8856",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/16d3146a-c609-407b-b511-7ed52fae8856/episodes",
          "method": "POST"
        }
      },
      {
        "id": "0106a594-ca5c-4895-b51e-afa2e8433154",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "0ebf084d-837d-47c6-97c2-b0d2be26512c",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "16d3146a-c609-407b-b511-7ed52fae8856",
          "episodeIndex": 1
        }
      },
      {
        "id": "1e91a519-a89b-4b90-b230-c508721618a7",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "831329bb-e21b-42b7-8bcc-16b755ebf5a5",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "16d3146a-c609-407b-b511-7ed52fae8856",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025502662",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "4e4a0626-1c2f-44d3-8f3d-087b58ee7a3e",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766025289-i3dta",
        "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "9568a479-4611-4a4f-b189-213fa52c9bf5",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766025289-i3dta",
        "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "f7d65a03-97ba-4d38-a45e-13e2ea93fc54",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766025289-i3dta",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "nonce": "nonce-1766025289-i3dta",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766025289"
        }
      },
      {
        "id": "1540177c-75fe-432d-be27-c018998f566c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "824b32b7-6c31-4fb0-85b9-65407b8c8cfa",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025289963",
          "capabilities": {}
        }
      },
      {
        "id": "0a7eb80a-068f-4e77-a58e-29b1ed5de554",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/episodes",
          "method": "POST"
        }
      },
      {
        "id": "8a09479a-2c23-4b6c-a385-ced0bc93b6f4",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "e31ef508-bedb-44c9-ae20-bfcec6796735",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
          "episodeIndex": 1
        }
      },
      {
        "id": "5d476833-ef5d-4e9e-813f-5af135ba7756",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "3f40424d-949b-45b1-845a-3e9985967007",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025289890",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "246a8522-b1fb-48b8-93aa-018578c71bcb",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "d78d4b88-9023-43ce-9838-137df91aaaa3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025191914",
          "capabilities": {}
        }
      },
      {
        "id": "02f7a5e8-969b-4df5-be52-e8f45b52dac8",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "f5191a50-01e2-47a0-865d-f3ee5bb44ae3",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "5803356c-7bad-4d81-a9b9-45a19b2f0517",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025191847",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 3
      },
      {
        "table_name": "seasons",
        "count": 2,
        "unique_projects": 2
      },
      {
        "table_name": "episodes",
        "count": 2,
        "unique_seasons": 2,
        "unique_projects": 2
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 11
- **结果示例** (前 5 行):

```json
[
  {
    "id": "4e4a0626-1c2f-44d3-8f3d-087b58ee7a3e",
    "action": "API_SIGNATURE_ERROR",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1766025289-i3dta",
    "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
      "method": "POST",
      "message": "签名验证失败"
    }
  },
  {
    "id": "9568a479-4611-4a4f-b189-213fa52c9bf5",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766025289-i3dta",
    "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "code": "4003",
      "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
      "method": "POST",
      "reason": "HMAC_AUTH_FAILED",
      "message": "签名验证失败"
    }
  },
  {
    "id": "f7d65a03-97ba-4d38-a45e-13e2ea93fc54",
    "action": "SECURITY_EVENT",
    "resourceType": "api_security",
    "resourceId": "scu_smoke_key",
    "nonce": "nonce-1766025289-i3dta",
    "signature": null,
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
      "nonce": "nonce-1766025289-i3dta",
      "method": "POST",
      "reason": "HMAC_SIGNATURE_MISMATCH",
      "timestamp": "1766025289"
    }
  },
  {
    "id": "1540177c-75fe-432d-be27-c018998f566c",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "824b32b7-6c31-4fb0-85b9-65407b8c8cfa",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766025289963",
      "capabilities": {}
    }
  },
  {
    "id": "0a7eb80a-068f-4e77-a58e-29b1ed5de554",
    "action": "EPISODE_CREATE",
    "resourceType": "/api/projects/:projectId/episodes",
    "resourceId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/episodes",
      "method": "POST"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 2
  },
  {
    "table_name": "seasons",
    "count": 1,
    "unique_projects": 1
  },
  {
    "table_name": "episodes",
    "count": 1,
    "unique_seasons": 1,
    "unique_projects": 1
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "4e4a0626-1c2f-44d3-8f3d-087b58ee7a3e",
        "action": "API_SIGNATURE_ERROR",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1766025289-i3dta",
        "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "method": "POST",
          "message": "签名验证失败"
        }
      },
      {
        "id": "9568a479-4611-4a4f-b189-213fa52c9bf5",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766025289-i3dta",
        "signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "code": "4003",
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "method": "POST",
          "reason": "HMAC_AUTH_FAILED",
          "message": "签名验证失败"
        }
      },
      {
        "id": "f7d65a03-97ba-4d38-a45e-13e2ea93fc54",
        "action": "SECURITY_EVENT",
        "resourceType": "api_security",
        "resourceId": "scu_smoke_key",
        "nonce": "nonce-1766025289-i3dta",
        "signature": null,
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "nonce": "nonce-1766025289-i3dta",
          "method": "POST",
          "reason": "HMAC_SIGNATURE_MISMATCH",
          "timestamp": "1766025289"
        }
      },
      {
        "id": "1540177c-75fe-432d-be27-c018998f566c",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "824b32b7-6c31-4fb0-85b9-65407b8c8cfa",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025289963",
          "capabilities": {}
        }
      },
      {
        "id": "0a7eb80a-068f-4e77-a58e-29b1ed5de554",
        "action": "EPISODE_CREATE",
        "resourceType": "/api/projects/:projectId/episodes",
        "resourceId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/episodes",
          "method": "POST"
        }
      },
      {
        "id": "8a09479a-2c23-4b6c-a385-ced0bc93b6f4",
        "action": "EPISODE_CREATE",
        "resourceType": "episode",
        "resourceId": "e31ef508-bedb-44c9-ae20-bfcec6796735",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "projectId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
          "episodeIndex": 1
        }
      },
      {
        "id": "5d476833-ef5d-4e9e-813f-5af135ba7756",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "3f40424d-949b-45b1-845a-3e9985967007",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025289890",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      },
      {
        "id": "246a8522-b1fb-48b8-93aa-018578c71bcb",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "d78d4b88-9023-43ce-9838-137df91aaaa3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025191914",
          "capabilities": {}
        }
      },
      {
        "id": "02f7a5e8-969b-4df5-be52-e8f45b52dac8",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "f5191a50-01e2-47a0-865d-f3ee5bb44ae3",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "5803356c-7bad-4d81-a9b9-45a19b2f0517",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025191847",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 2
      },
      {
        "table_name": "seasons",
        "count": 1,
        "unique_projects": 1
      },
      {
        "table_name": "episodes",
        "count": 1,
        "unique_seasons": 1,
        "unique_projects": 1
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 3
- **结果示例** (前 5 行):

```json
[
  {
    "id": "246a8522-b1fb-48b8-93aa-018578c71bcb",
    "action": "WORKER_REGISTERED",
    "resourceType": "worker",
    "resourceId": "d78d4b88-9023-43ce-9838-137df91aaaa3",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Worker",
      "status": "online",
      "workerId": "smoke-worker-1766025191914",
      "capabilities": {}
    }
  },
  {
    "id": "02f7a5e8-969b-4df5-be52-e8f45b52dac8",
    "action": "PROJECT_CREATE",
    "resourceType": "/api/projects",
    "resourceId": null,
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST"
    }
  },
  {
    "id": "f5191a50-01e2-47a0-865d-f3ee5bb44ae3",
    "action": "PROJECT_CREATED",
    "resourceType": "project",
    "resourceId": "5803356c-7bad-4d81-a9b9-45a19b2f0517",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "name": "Smoke Test Project 1766025191847",
      "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 1
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "246a8522-b1fb-48b8-93aa-018578c71bcb",
        "action": "WORKER_REGISTERED",
        "resourceType": "worker",
        "resourceId": "d78d4b88-9023-43ce-9838-137df91aaaa3",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Worker",
          "status": "online",
          "workerId": "smoke-worker-1766025191914",
          "capabilities": {}
        }
      },
      {
        "id": "02f7a5e8-969b-4df5-be52-e8f45b52dac8",
        "action": "PROJECT_CREATE",
        "resourceType": "/api/projects",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST"
        }
      },
      {
        "id": "f5191a50-01e2-47a0-865d-f3ee5bb44ae3",
        "action": "PROJECT_CREATED",
        "resourceType": "project",
        "resourceId": "5803356c-7bad-4d81-a9b9-45a19b2f0517",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "name": "Smoke Test Project 1766025191847",
          "organizationId": "d93b2e9e-3a98-46fa-986d-10462b8ac91f"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 1
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 23
  },
  {
    "table_name": "seasons",
    "count": 23,
    "unique_projects": 23
  },
  {
    "table_name": "episodes",
    "count": 499,
    "unique_seasons": 23,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 499,
    "unique_episodes": 499
  },
  {
    "table_name": "shots",
    "count": 1443,
    "unique_scenes": 499
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 23
      },
      {
        "table_name": "seasons",
        "count": 23,
        "unique_projects": 23
      },
      {
        "table_name": "episodes",
        "count": 499,
        "unique_seasons": 23,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 499,
        "unique_episodes": 499
      },
      {
        "table_name": "shots",
        "count": 1443,
        "unique_scenes": 499
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 22
  },
  {
    "table_name": "seasons",
    "count": 22,
    "unique_projects": 22
  },
  {
    "table_name": "episodes",
    "count": 498,
    "unique_seasons": 22,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 498,
    "unique_episodes": 498
  },
  {
    "table_name": "shots",
    "count": 1442,
    "unique_scenes": 498
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 22
      },
      {
        "table_name": "seasons",
        "count": 22,
        "unique_projects": 22
      },
      {
        "table_name": "episodes",
        "count": 498,
        "unique_seasons": 22,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 498,
        "unique_episodes": 498
      },
      {
        "table_name": "shots",
        "count": 1442,
        "unique_scenes": 498
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 20
- **结果示例** (前 5 行):

```json
[
  {
    "id": "8d222051-6aff-4a02-aebf-079eee500b66",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
      "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632150
    }
  },
  {
    "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
      "nonce": "af26701748c64f310041d9752f5e494d",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632149
    }
  },
  {
    "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
      "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765632148
    }
  },
  {
    "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "e2e-nonce-1765587590801",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587590
    }
  },
  {
    "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
    "action": "SECURITY_EVENT",
    "resourceType": "api_key",
    "resourceId": "ak_worker_dev_0000000000000000",
    "nonce": null,
    "signature": null,
    "timestamp": null,
    "createdAt": {},
    "details": {
      "path": "/api/workers/test-worker-001/jobs/next",
      "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
      "method": "POST",
      "reason": "NONCE_REPLAY_DETECTED",
      "timestamp": 1765587582
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "status": "RETRYING",
    "count": 9,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "SUCCEEDED",
    "count": 5,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "RUNNING",
    "count": 3,
    "earliest": {},
    "latest": {}
  },
  {
    "status": "FAILED",
    "count": 1,
    "earliest": {},
    "latest": {}
  }
]
```

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 21
  },
  {
    "table_name": "seasons",
    "count": 21,
    "unique_projects": 21
  },
  {
    "table_name": "episodes",
    "count": 497,
    "unique_seasons": 21,
    "unique_projects": 5
  },
  {
    "table_name": "scenes",
    "count": 497,
    "unique_episodes": 497
  },
  {
    "table_name": "shots",
    "count": 1441,
    "unique_scenes": 497
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "8d222051-6aff-4a02-aebf-079eee500b66",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/analyze",
          "nonce": "b23f1c8041370c5d0fc52458c0b83a8c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632150
        }
      },
      {
        "id": "a4c807e4-cdb5-413c-ad53-e9ddb4a3b7df",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import",
          "nonce": "af26701748c64f310041d9752f5e494d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632149
        }
      },
      {
        "id": "a907a708-8ed2-4528-a80e-d85f7727d3f7",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/projects/e9ca2533-48d5-4dc5-bdcd-d1190625dd44/novel/import-file",
          "nonce": "39474a5b95fa1be64fd6a8bc26413b2c",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765632148
        }
      },
      {
        "id": "c7cd4417-4655-460e-b07c-b74842dadb5f",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765587590801",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587590
        }
      },
      {
        "id": "04ec29f2-4378-4385-83a4-1f1c35df1d21",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "prisma-single-source-test-1765587582073-6d68e324-ad6c-4fb3-813f-ce07ac44af74",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765587582
        }
      },
      {
        "id": "564a7631-61e6-4092-b94e-321c81b0d15e",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "e2e-nonce-1765558486586",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558486
        }
      },
      {
        "id": "03f297d7-b2ac-4241-bd54-b52429c2d3de",
        "action": "SECURITY_EVENT",
        "resourceType": "api_key",
        "resourceId": "ak_worker_dev_0000000000000000",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/workers/test-worker-001/jobs/next",
          "nonce": "final-replay-test-1765558479391-2e1824e3-300b-47c4-95cb-be758f09e77d",
          "method": "POST",
          "reason": "NONCE_REPLAY_DETECTED",
          "timestamp": 1765558479
        }
      },
      {
        "id": "44ef5e7e-1917-4fcc-998c-eb0ed07740ed",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "0319b5b7-7676-4c1f-b8b5-f971b4fe56bb",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "47f888dd-89cd-4464-8245-92b47fa3f79e",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "45947440-da2f-4f42-af1f-252a69e227d0",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "600fe181-8ccc-4c7e-b55b-7706bddabed2",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "4ca74c18-3e98-40b4-8167-03aa5e093ce7",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "f11621f7-b407-4cfd-9eb1-74ee1285cb62",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "4eb2dfb5-3ac2-48bb-add7-fe3efef03c2b",
        "action": "LOGIN",
        "resourceType": "/api/auth/login",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/login",
          "method": "POST"
        }
      },
      {
        "id": "b47310f1-d798-4978-b6e4-1703feb0d289",
        "action": "LOGIN",
        "resourceType": "/api/auth/register",
        "resourceId": null,
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "path": "/api/auth/register",
          "method": "POST"
        }
      },
      {
        "id": "303cb8d4-3696-4148-aa75-9ae8309a0fb6",
        "action": "JOB_RETRYING",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "error": "\nInvalid `prisma.shot.deleteMany()` invocation in\n/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts:290:21\n\n  287 const { projectId, seasons } = structure;\n  288 \n  289 // 1. 清理旧结构（使用 deleteMany，按 Shot → Scene → Episode → Season 顺序，通过反向关联过滤 projectId）\n→ 290 await prisma.shot.deleteMany(\nForeign key constraint violated: `ShotJob_shotId_fkey (index)`",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "attempts": 2,
          "workerId": "27d400e5-8e4b-401e-bd20-af362f2cc826",
          "retryCount": 1
        }
      },
      {
        "id": "bc7a6d57-5677-4bc2-b09c-5f9389b2cf2a",
        "action": "JOB_STARTED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "type": "NOVEL_ANALYSIS",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "workerId": "local-worker"
        }
      },
      {
        "id": "10bec2cd-02db-4dc2-b304-0cbfb54c018d",
        "action": "JOB_DISPATCHED",
        "resourceType": "job",
        "resourceId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "NOVEL_ANALYSIS",
          "workerId": "local-worker"
        }
      },
      {
        "id": "abf33aa1-f045-4bc0-a615-40de4ad57fe9",
        "action": "NOVEL_ANALYZE",
        "resourceType": "novel_analysis_job",
        "resourceId": "e1b41a40-6393-430e-bc62-fb1327b12074",
        "nonce": null,
        "signature": null,
        "timestamp": null,
        "createdAt": {},
        "details": {
          "jobId": "c77d71e4-f760-489d-adab-aee6e771bcf2",
          "taskId": "09468002-f8dd-4747-9613-57a61e5a04b9",
          "jobType": "ANALYZE_ALL",
          "chapterId": null,
          "projectId": "da8c5a9e-1ffc-4460-9684-d12886e44485",
          "novelSourceId": "ac46e36a-576b-4c59-a962-06e13156d6d9"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": [
      {
        "status": "RETRYING",
        "count": 9,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "SUCCEEDED",
        "count": 5,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "RUNNING",
        "count": 3,
        "earliest": {},
        "latest": {}
      },
      {
        "status": "FAILED",
        "count": 1,
        "earliest": {},
        "latest": {}
      }
    ]
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 21
      },
      {
        "table_name": "seasons",
        "count": 21,
        "unique_projects": 21
      },
      {
        "table_name": "episodes",
        "count": 497,
        "unique_seasons": 21,
        "unique_projects": 5
      },
      {
        "table_name": "scenes",
        "count": 497,
        "unique_episodes": 497
      },
      {
        "table_name": "shots",
        "count": 1441,
        "unique_scenes": 497
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "id": "199f0523-2578-4d1c-ab28-4015157ba89a",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1765772575-dca3vg",
    "signature": "7a978d169ade73e6e82860cebc111735bb0f2a85348fae06b0518439884bfa98",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Unauthorized"
    }
  },
  {
    "id": "8d0cd723-7a72-45a4-88f4-665fad9b437f",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "replay-test-1765772574-1h1db9",
    "signature": "9756d614f20d25fed5ca246b5edc451c72cfdeece0d2a7bfc0e5507777107cbf",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "34834381-cd86-4e7b-92fa-70fe979845a2",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "replay-test-1765772574-1h1db9",
    "signature": "56170ad6f5eec5c4d4daa9029f9e8b0533f1f4a1df99d0bfc0bf98db17cd5948",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "40ee1b27-2758-4717-b463-6a81e3ed5a1d",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1765772574-ulahnh",
    "signature": "ea2b54a4fee04d1fd904e334f08488ff06416d8a76f57408a75b2e5ccca1562e",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "199f0523-2578-4d1c-ab28-4015157ba89a",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1765772575-dca3vg",
        "signature": "7a978d169ade73e6e82860cebc111735bb0f2a85348fae06b0518439884bfa98",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Unauthorized"
        }
      },
      {
        "id": "8d0cd723-7a72-45a4-88f4-665fad9b437f",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1765772574-1h1db9",
        "signature": "9756d614f20d25fed5ca246b5edc451c72cfdeece0d2a7bfc0e5507777107cbf",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "34834381-cd86-4e7b-92fa-70fe979845a2",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1765772574-1h1db9",
        "signature": "56170ad6f5eec5c4d4daa9029f9e8b0533f1f4a1df99d0bfc0bf98db17cd5948",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "40ee1b27-2758-4717-b463-6a81e3ed5a1d",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1765772574-ulahnh",
        "signature": "ea2b54a4fee04d1fd904e334f08488ff06416d8a76f57408a75b2e5ccca1562e",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "id": "199f0523-2578-4d1c-ab28-4015157ba89a",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1765772575-dca3vg",
    "signature": "7a978d169ade73e6e82860cebc111735bb0f2a85348fae06b0518439884bfa98",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Unauthorized"
    }
  },
  {
    "id": "8d0cd723-7a72-45a4-88f4-665fad9b437f",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "replay-test-1765772574-1h1db9",
    "signature": "9756d614f20d25fed5ca246b5edc451c72cfdeece0d2a7bfc0e5507777107cbf",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "34834381-cd86-4e7b-92fa-70fe979845a2",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "replay-test-1765772574-1h1db9",
    "signature": "56170ad6f5eec5c4d4daa9029f9e8b0533f1f4a1df99d0bfc0bf98db17cd5948",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "40ee1b27-2758-4717-b463-6a81e3ed5a1d",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1765772574-ulahnh",
    "signature": "ea2b54a4fee04d1fd904e334f08488ff06416d8a76f57408a75b2e5ccca1562e",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "199f0523-2578-4d1c-ab28-4015157ba89a",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1765772575-dca3vg",
        "signature": "7a978d169ade73e6e82860cebc111735bb0f2a85348fae06b0518439884bfa98",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Unauthorized"
        }
      },
      {
        "id": "8d0cd723-7a72-45a4-88f4-665fad9b437f",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1765772574-1h1db9",
        "signature": "9756d614f20d25fed5ca246b5edc451c72cfdeece0d2a7bfc0e5507777107cbf",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "34834381-cd86-4e7b-92fa-70fe979845a2",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1765772574-1h1db9",
        "signature": "56170ad6f5eec5c4d4daa9029f9e8b0533f1f4a1df99d0bfc0bf98db17cd5948",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "40ee1b27-2758-4717-b463-6a81e3ed5a1d",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1765772574-ulahnh",
        "signature": "ea2b54a4fee04d1fd904e334f08488ff06416d8a76f57408a75b2e5ccca1562e",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "id": "199f0523-2578-4d1c-ab28-4015157ba89a",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1765772575-dca3vg",
    "signature": "7a978d169ade73e6e82860cebc111735bb0f2a85348fae06b0518439884bfa98",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Unauthorized"
    }
  },
  {
    "id": "8d0cd723-7a72-45a4-88f4-665fad9b437f",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "replay-test-1765772574-1h1db9",
    "signature": "9756d614f20d25fed5ca246b5edc451c72cfdeece0d2a7bfc0e5507777107cbf",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "34834381-cd86-4e7b-92fa-70fe979845a2",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "replay-test-1765772574-1h1db9",
    "signature": "56170ad6f5eec5c4d4daa9029f9e8b0533f1f4a1df99d0bfc0bf98db17cd5948",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "40ee1b27-2758-4717-b463-6a81e3ed5a1d",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1765772574-ulahnh",
    "signature": "ea2b54a4fee04d1fd904e334f08488ff06416d8a76f57408a75b2e5ccca1562e",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "199f0523-2578-4d1c-ab28-4015157ba89a",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1765772575-dca3vg",
        "signature": "7a978d169ade73e6e82860cebc111735bb0f2a85348fae06b0518439884bfa98",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Unauthorized"
        }
      },
      {
        "id": "8d0cd723-7a72-45a4-88f4-665fad9b437f",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1765772574-1h1db9",
        "signature": "9756d614f20d25fed5ca246b5edc451c72cfdeece0d2a7bfc0e5507777107cbf",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "34834381-cd86-4e7b-92fa-70fe979845a2",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1765772574-1h1db9",
        "signature": "56170ad6f5eec5c4d4daa9029f9e8b0533f1f4a1df99d0bfc0bf98db17cd5948",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "40ee1b27-2758-4717-b463-6a81e3ed5a1d",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1765772574-ulahnh",
        "signature": "ea2b54a4fee04d1fd904e334f08488ff06416d8a76f57408a75b2e5ccca1562e",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "id": "199f0523-2578-4d1c-ab28-4015157ba89a",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1765772575-dca3vg",
    "signature": "7a978d169ade73e6e82860cebc111735bb0f2a85348fae06b0518439884bfa98",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Unauthorized"
    }
  },
  {
    "id": "8d0cd723-7a72-45a4-88f4-665fad9b437f",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "replay-test-1765772574-1h1db9",
    "signature": "9756d614f20d25fed5ca246b5edc451c72cfdeece0d2a7bfc0e5507777107cbf",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "34834381-cd86-4e7b-92fa-70fe979845a2",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "replay-test-1765772574-1h1db9",
    "signature": "56170ad6f5eec5c4d4daa9029f9e8b0533f1f4a1df99d0bfc0bf98db17cd5948",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "40ee1b27-2758-4717-b463-6a81e3ed5a1d",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1765772574-ulahnh",
    "signature": "ea2b54a4fee04d1fd904e334f08488ff06416d8a76f57408a75b2e5ccca1562e",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "199f0523-2578-4d1c-ab28-4015157ba89a",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1765772575-dca3vg",
        "signature": "7a978d169ade73e6e82860cebc111735bb0f2a85348fae06b0518439884bfa98",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Unauthorized"
        }
      },
      {
        "id": "8d0cd723-7a72-45a4-88f4-665fad9b437f",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1765772574-1h1db9",
        "signature": "9756d614f20d25fed5ca246b5edc451c72cfdeece0d2a7bfc0e5507777107cbf",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "34834381-cd86-4e7b-92fa-70fe979845a2",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1765772574-1h1db9",
        "signature": "56170ad6f5eec5c4d4daa9029f9e8b0533f1f4a1df99d0bfc0bf98db17cd5948",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "40ee1b27-2758-4717-b463-6a81e3ed5a1d",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1765772574-ulahnh",
        "signature": "ea2b54a4fee04d1fd904e334f08488ff06416d8a76f57408a75b2e5ccca1562e",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ✅ 成功
- **返回行数**: 4
- **结果示例** (前 5 行):

```json
[
  {
    "id": "199f0523-2578-4d1c-ab28-4015157ba89a",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1765772575-dca3vg",
    "signature": "7a978d169ade73e6e82860cebc111735bb0f2a85348fae06b0518439884bfa98",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "POST",
      "message": "Unauthorized"
    }
  },
  {
    "id": "8d0cd723-7a72-45a4-88f4-665fad9b437f",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "replay-test-1765772574-1h1db9",
    "signature": "9756d614f20d25fed5ca246b5edc451c72cfdeece0d2a7bfc0e5507777107cbf",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "34834381-cd86-4e7b-92fa-70fe979845a2",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "replay-test-1765772574-1h1db9",
    "signature": "56170ad6f5eec5c4d4daa9029f9e8b0533f1f4a1df99d0bfc0bf98db17cd5948",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  },
  {
    "id": "40ee1b27-2758-4717-b463-6a81e3ed5a1d",
    "action": "API_UNAUTHORIZED",
    "resourceType": "api",
    "resourceId": null,
    "nonce": "nonce-1765772574-ulahnh",
    "signature": "ea2b54a4fee04d1fd904e334f08488ff06416d8a76f57408a75b2e5ccca1562e",
    "timestamp": {},
    "createdAt": {},
    "details": {
      "path": "/api/projects",
      "method": "GET",
      "message": "Unauthorized"
    }
  }
]
```

#### job_status_agg.sql

- **执行状态**: ✅ 成功
- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ✅ 成功
- **返回行数**: 9
- **结果示例** (前 5 行):

```json
[
  {
    "table_name": "projects",
    "count": 0
  },
  {
    "table_name": "seasons",
    "count": 0,
    "unique_projects": 0
  },
  {
    "table_name": "episodes",
    "count": 0,
    "unique_seasons": 0,
    "unique_projects": 0
  },
  {
    "table_name": "scenes",
    "count": 0,
    "unique_episodes": 0
  },
  {
    "table_name": "shots",
    "count": 0,
    "unique_scenes": 0
  }
]
```

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": true,
    "results": [
      {
        "id": "199f0523-2578-4d1c-ab28-4015157ba89a",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1765772575-dca3vg",
        "signature": "7a978d169ade73e6e82860cebc111735bb0f2a85348fae06b0518439884bfa98",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "POST",
          "message": "Unauthorized"
        }
      },
      {
        "id": "8d0cd723-7a72-45a4-88f4-665fad9b437f",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1765772574-1h1db9",
        "signature": "9756d614f20d25fed5ca246b5edc451c72cfdeece0d2a7bfc0e5507777107cbf",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "34834381-cd86-4e7b-92fa-70fe979845a2",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "replay-test-1765772574-1h1db9",
        "signature": "56170ad6f5eec5c4d4daa9029f9e8b0533f1f4a1df99d0bfc0bf98db17cd5948",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      },
      {
        "id": "40ee1b27-2758-4717-b463-6a81e3ed5a1d",
        "action": "API_UNAUTHORIZED",
        "resourceType": "api",
        "resourceId": null,
        "nonce": "nonce-1765772574-ulahnh",
        "signature": "ea2b54a4fee04d1fd904e334f08488ff06416d8a76f57408a75b2e5ccca1562e",
        "timestamp": {},
        "createdAt": {},
        "details": {
          "path": "/api/projects",
          "method": "GET",
          "message": "Unauthorized"
        }
      }
    ]
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": true,
    "results": []
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": true,
    "results": [
      {
        "table_name": "projects",
        "count": 0
      },
      {
        "table_name": "seasons",
        "count": 0,
        "unique_projects": 0
      },
      {
        "table_name": "episodes",
        "count": 0,
        "unique_seasons": 0,
        "unique_projects": 0
      },
      {
        "table_name": "scenes",
        "count": 0,
        "unique_episodes": 0
      },
      {
        "table_name": "shots",
        "count": 0,
        "unique_scenes": 0
      },
      {
        "check_type": "orphaned_seasons",
        "count": 0
      },
      {
        "check_type": "orphaned_episodes",
        "count": 0
      },
      {
        "check_type": "orphaned_scenes",
        "count": 0
      },
      {
        "check_type": "orphaned_shots",
        "count": 0
      }
    ]
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "resourcetype" does not exist`

- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "createdat" does not exist`

- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "projectid" does not exist`

- **返回行数**: 0

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"resourcetype\" does not exist`"
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"createdat\" does not exist`"
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"projectid\" does not exist`"
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "resourcetype" does not exist`

- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "createdat" does not exist`

- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "projectid" does not exist`

- **返回行数**: 0

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"resourcetype\" does not exist`"
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"createdat\" does not exist`"
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"projectid\" does not exist`"
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "resource_type" does not exist`

- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42P01`. Message: `relation "shotjob" does not exist`

- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "project_id" does not exist`

- **返回行数**: 0

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"resource_type\" does not exist`"
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42P01`. Message: `relation \"shotjob\" does not exist`"
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"project_id\" does not exist`"
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "resource_type" does not exist`

- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42P01`. Message: `relation "shot_jobs" does not exist`

- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "project_id" does not exist`

- **返回行数**: 0

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"resource_type\" does not exist`"
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42P01`. Message: `relation \"shot_jobs\" does not exist`"
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"project_id\" does not exist`"
  }
]
```

## SQL 验证详细结果

#### audit_recent.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "resource_type" does not exist`

- **返回行数**: 0

#### job_status_agg.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42P01`. Message: `relation "shot_jobs" does not exist`

- **返回行数**: 0

#### entity_integrity.sql

- **执行状态**: ❌ 失败
- **错误**:
  Invalid `prisma.$queryRawUnsafe()` invocation:

Raw query failed. Code: `42703`. Message: `column "project_id" does not exist`

- **返回行数**: 0

**完整 JSON 输出**:

```json
[
  {
    "sqlFile": "audit_recent.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"resource_type\" does not exist`"
  },
  {
    "sqlFile": "job_status_agg.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42P01`. Message: `relation \"shot_jobs\" does not exist`"
  },
  {
    "sqlFile": "entity_integrity.sql",
    "success": false,
    "results": [],
    "error": "\nInvalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `42703`. Message: `column \"project_id\" does not exist`"
  }
]
```

## 风险清单和旁路清单

### 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## 旁路/弱校验清单

#### Dev Bypass 开关

- **位置**: `apps/api/src/common/utils/signature-path.utils.ts`
- **机制**: 路径白名单（`shouldBypassSignature`）
- **白名单路径**:
  - `/api/auth/**`
  - `/api/health`
  - `/api/public/**`
  - `/health`
  - `/metrics`
  - `/ping`
- **生产模式**: Smoke 测试中强制设置 `NODE_ENV=production` 和 `BYPASS_HMAC=false`
- **状态**: ✅ 生产模式下 bypass 已禁用

#### 弱校验项

- **Nonce 存储**: 使用数据库 `nonce_store` 表（非 Redis）
- **时间窗口**: ±300 秒（5 分钟）
- **状态**: ✅ 已实现防重放机制

### 风险清单

#### 本轮改动影响分析

- **改动类型**: 仅新增验证工具、健康检查端点、门禁脚本
- **影响范围**:
  - ✅ 未修改业务逻辑
  - ✅ 未修改数据库 schema
  - ✅ 未修改核心契约（APISpec/EngineSpec）
  - ✅ 未修改 Job 状态机
  - ✅ 未修改 HMAC/Nonce 验证逻辑
- **对 Stage3/4 的影响**: ❌ **无影响**
  - Stage3-A (Job-Engine 绑定): 不受影响
  - Stage4 (其他功能): 不受影响

### 回滚判断

#### 回滚需求

- **是否需要回滚**: ❌ **不需要回滚**

#### 理由

1. ✅ Smoke 全通过（前提条件）
2. ✅ 无 schema 破坏（未修改 Prisma schema）
3. ✅ 未放宽生产校验（强制 `NODE_ENV=production`）
4. ✅ 仅补齐门禁/健康端点/脚本强校验
5. ✅ 对后续开发是增益、无破坏

#### 回滚点（如需要）

- Git commit/tag: （如需要回滚，使用本次提交前的 commit）
- 数据回滚: 不需要（未修改数据库）

## Smoke 测试总结

❌ **测试失败** - 请检查上述错误

## SQL 验证错误

错误: Do not know how to serialize a BigInt
堆栈: TypeError: Do not know how to serialize a BigInt
at JSON.stringify (<anonymous>)
at main (/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/tools/smoke/stage1_stage2_smoke.ts:322:63)

## HMAC 测试

❌ API_KEY/API_SECRET not set, smoke test failed

## CRUD 测试

❌ API_KEY/API_SECRET not set, test failed

## Worker 测试

❌ API_KEY/API_SECRET not set, test failed

## Engine Binding 测试错误

projectId is required for Engine Binding test. CRUD test must pass first.

## Engine Binding + Worker Claim 闭环验证

**关键信息**:

```json
{}
```

**完整结果**:

```json
{
  "workerId": "smoke-worker-binding-1766025289995",
  "steps": [
    {
      "step": "Create NOVEL_ANALYSIS Job (via /api/projects/:projectId/novel/analyze)",
      "result": {
        "success": false,
        "status": 400,
        "response": {
          "success": false,
          "error": {
            "code": "4003",
            "message": "签名验证失败"
          },
          "requestId": "d873db16-2f9c-4fbd-8feb-ee384852a04b",
          "timestamp": "2025-12-18T02:34:49.998Z",
          "path": "/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze",
          "method": "POST"
        },
        "requestHeaders": {
          "X-Api-Key": "scu_smoke_key",
          "X-Nonce": "nonce-1766025289-i3dta",
          "X-Timestamp": "1766025289",
          "X-Signature": "9f1dd5ced70b2a73659fe9eae45338866fd9bcd7b68ff3f4c17b5e7f1bbfae3b",
          "Content-Type": "application/json",
          "X-Content-SHA256": "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
        },
        "timestamp": "2025-12-18T02:34:50.000Z"
      }
    }
  ],
  "success": false,
  "error": "Failed to create job: {\"success\":false,\"error\":{\"code\":\"4003\",\"message\":\"签名验证失败\"},\"requestId\":\"d873db16-2f9c-4fbd-8feb-ee384852a04b\",\"timestamp\":\"2025-12-18T02:34:49.998Z\",\"path\":\"/api/projects/7dc16b18-2028-48fc-9ac4-9f9ad6f9cdf1/novel/analyze\",\"method\":\"POST\"}"
}
```

## RBAC 权限拒绝验证 (P0-1)

✅ **HMAC 请求未绕过 RBAC，无权访问时返回 403**
