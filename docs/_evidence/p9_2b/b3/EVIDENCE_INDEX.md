# P9.2B · Stage B.3 Integration Evidence Index

This directory contains the audit evidence for the successful integration of Railway API, Railway Worker, and Cloudflare/Railway Pages.

## Evidence Files
- [local_build_full.log](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_evidence/p9_2b/b3/local_build_full.log): 本地全量构建成功的完整日志，证明环境可复现性。
- [api_health_http_code.txt](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_evidence/p9_2b/b3/api_health_http_code.txt): API 健康检查 HTTP 状态码 (预期 200)。
- [api_health_body_head2k.txt](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_evidence/p9_2b/b3/api_health_body_head2k.txt): API 健康检查响应正文，含 `mode` 标注。
- [api_health_headers.txt](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_evidence/p9_2b/b3/api_health_headers.txt): API 健康检查响应头。
- [pages_root_http_code.txt](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_evidence/p9_2b/b3/pages_root_http_code.txt): Web 前端根路径 HTTP 状态码 (预期 200)。
- [railway_api.log](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_evidence/p9_2b/b3/railway_api.log): API 服务的 Railway 实时运行日志。
- [railway_worker.log](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_evidence/p9_2b/b3/railway_worker.log): Worker 服务的 Railway 实时运行日志。
- [verdict.txt](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_evidence/p9_2b/b3/verdict.txt): 自动化探测脚本生成的最终判定报告，含 `api_mode`。

## Verification URLS
- API: https://api-production-4e28.up.railway.app/api/health
- Web: https://web-production-22956.up.railway.app
