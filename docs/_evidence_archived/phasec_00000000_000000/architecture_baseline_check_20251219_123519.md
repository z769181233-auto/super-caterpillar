# Architecture Baseline Alignment Check - Phase C Post-Cleanup

- Date: 2025-12-19T12:35:19+07:00
- Purpose: Verify Phase C cleanup did not break implicit paths not covered by CI

## Checks

### 1. apps/web: Next.js Build

> web@1.0.0 build /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web
> next build

▲ Next.js 14.2.33

Creating an optimized production build ...
✓ Compiled successfully
Linting and checking validity of types ...

./src/app/[locale]/projects/[projectId]/import-novel/page.tsx
6:10 Warning: 'ProjectPermissions' is defined but never used. @typescript-eslint/no-unused-vars
7:10 Warning: 'getJobStatusText' is defined but never used. @typescript-eslint/no-unused-vars
8:8 Warning: 'EngineFilter' is defined but never used. @typescript-eslint/no-unused-vars
13:8 Warning: 'ProjectStructureTree' is defined but never used. @typescript-eslint/no-unused-vars
30:13 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
94:23 Warning: 'setPermissions' is assigned a value but never used. @typescript-eslint/no-unused-vars
104:44 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
292:26 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
350:19 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
367:19 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
653:31 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
654:33 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
722:25 Warning: 'isHttp' is assigned a value but never used. @typescript-eslint/no-unused-vars
878:33 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
879:33 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
880:33 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
882:45 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
883:47 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any

./src/app/[locale]/projects/[projectId]/page.tsx
5:8 Warning: 'Link' is defined but never used. @typescript-eslint/no-unused-vars
9:10 Warning: 'ProjectPermissions' is defined but never used. @typescript-eslint/no-unused-vars
10:10 Warning: 'getAnalysisStatusText' is defined but never used. @typescript-eslint/no-unused-vars
14:8 Warning: 'AnalysisStatusPanel' is defined but never used. @typescript-eslint/no-unused-vars
40:55 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
45:10 Warning: 'error' is assigned a value but never used. @typescript-eslint/no-unused-vars
47:10 Warning: 'novelFileId' is assigned a value but never used. @typescript-eslint/no-unused-vars
49:10 Warning: 'currentJobId' is assigned a value but never used. @typescript-eslint/no-unused-vars
52:23 Warning: 'setPermissions' is assigned a value but never used. @typescript-eslint/no-unused-vars
116:19 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
140:9 Warning: 'handleGenerateStructure' is assigned a value but never used. @typescript-eslint/no-unused-vars
154:9 Warning: 'handleUploadSuccess' is assigned a value but never used. @typescript-eslint/no-unused-vars
156:29 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
187:84 Warning: 'data' is defined but never used. Allowed unused args must match /^\_/u. @typescript-eslint/no-unused-vars
226:9 Warning: 'listLevel' is assigned a value but never used. @typescript-eslint/no-unused-vars
227:9 Warning: 'listItems' is assigned a value but never used. @typescript-eslint/no-unused-vars
243:9 Warning: 'canImportNovel' is assigned a value but never used. @typescript-eslint/no-unused-vars
244:9 Warning: 'canGenerateStructure' is assigned a value but never used. @typescript-eslint/no-unused-vars
358:48 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any

./src/app/[locale]/projects/page.tsx
42:6 Warning: React Hook useEffect has a missing dependency: 'loadProjects'. Either include it or remove the dependency array. react-hooks/exhaustive-deps
52:42 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
83:19 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
110:19 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any

./src/app/[locale]/register/page.tsx
32:11 Warning: 'redirect' is assigned a value but never used. @typescript-eslint/no-unused-vars
51:23 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any

./src/app/[locale]/tasks/[taskId]/graph/page.tsx
15:38 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
36:21 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
61:35 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
70:32 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
135:39 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any
138:69 Warning: Unexpected any. Specify a different type. @typescript-eslint/no-explicit-any

./src/lib/apiClient.ts
6:3 Warning: 'ProjectSceneGraph' is defined but never used. @typescript-eslint/no-unused-vars
7:3 Warning: 'NovelAnalysisStatus' is defined but never used. @typescript-eslint/no-unused-vars
601:53 Warning: 'ListJobsResponse' is defined but never used. @typescript-eslint/no-unused-vars
601:91 Warning: 'ProjectDetailDTO' is defined but never used. @typescript-eslint/no-unused-vars

info - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/basic-features/eslint#disabling-rules
Collecting page data ...
Generating static pages (0/3) ...
✓ Generating static pages (3/3)
Finalizing page optimization ...
Collecting build traces ...

Route (app) Size First Load JS
┌ ○ /\_not-found 875 B 88.2 kB
├ ƒ /[locale] 1.66 kB 97.7 kB
├ ƒ /[locale]/contact 707 B 88 kB
├ ƒ /[locale]/dev/autofill 1.06 kB 88.4 kB
├ ƒ /[locale]/login 2.37 kB 102 kB
├ ƒ /[locale]/monitor/scheduler 2.93 kB 93.6 kB
├ ƒ /[locale]/monitor/workers 1.58 kB 92.2 kB
├ ƒ /[locale]/platform 863 B 88.2 kB
├ ƒ /[locale]/privacy 708 B 88 kB
├ ƒ /[locale]/projects 3.2 kB 118 kB
├ ƒ /[locale]/projects/[projectId] 12.5 kB 127 kB
├ ƒ /[locale]/projects/[projectId]/import-novel 7.97 kB 98.6 kB
├ ƒ /[locale]/projects/[projectId]/pipeline 3.1 kB 93.7 kB
├ ƒ /[locale]/register 2.25 kB 102 kB
├ ƒ /[locale]/solutions/creator 855 B 88.2 kB
├ ƒ /[locale]/solutions/enterprise 815 B 88.1 kB
├ ƒ /[locale]/solutions/studio 817 B 88.1 kB
├ ƒ /[locale]/studio 134 B 87.4 kB
├ ƒ /[locale]/studio/jobs 10.4 kB 101 kB
├ ƒ /[locale]/studio/review 4.03 kB 103 kB
├ ƒ /[locale]/tasks 3.94 kB 94.6 kB
├ ƒ /[locale]/tasks/[taskId]/graph 3.75 kB 94.4 kB
└ ƒ /[locale]/terms 711 B 88 kB

- First Load JS shared by all 87.3 kB
  ├ chunks/175-ed47e9557435a9a1.js 31.7 kB
  ├ chunks/d96dac80-8323eb0040160a50.js 53.7 kB
  └ other shared chunks (total) 1.95 kB

ƒ Middleware 37.6 kB

○ (Static) prerendered as static content
ƒ (Dynamic) server-rendered on demand

✓ Next.js build: PASS
