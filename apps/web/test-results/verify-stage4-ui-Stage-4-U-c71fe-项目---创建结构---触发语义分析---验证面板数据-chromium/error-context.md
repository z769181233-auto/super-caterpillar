# Page snapshot

```yaml
- generic [active]:
  - alert [ref=e1]
  - dialog "Server Error" [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - navigation [ref=e8]:
          - button "previous" [disabled] [ref=e9]:
            - img "previous" [ref=e10]
          - button "next" [disabled] [ref=e12]:
            - img "next" [ref=e13]
          - generic [ref=e15]: 1 of 1 error
          - generic [ref=e16]:
            - text: Next.js (14.2.33) is outdated
            - link "(learn more)" [ref=e18] [cursor=pointer]:
              - /url: https://nextjs.org/docs/messages/version-staleness
        - heading "Server Error" [level=1] [ref=e19]
        - paragraph [ref=e20]: "Error: Cannot find module './vendor-chunks/@swc+helpers@0.5.5.js' Require stack: - /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/.next/server/webpack-runtime.js - /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/.next/server/app/[locale]/login/page.js - /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/node_modules/.pnpm/next@14.2.33_@playwright+test@1.57.0_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/next/dist/server/require.js - /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/node_modules/.pnpm/next@14.2.33_@playwright+test@1.57.0_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/next/dist/server/load-components.js - /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/node_modules/.pnpm/next@14.2.33_@playwright+test@1.57.0_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/next/dist/build/utils.js - /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/node_modules/.pnpm/next@14.2.33_@playwright+test@1.57.0_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/next/dist/server/dev/static-paths-worker.js - /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/node_modules/.pnpm/next@14.2.33_@playwright+test@1.57.0_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/next/dist/compiled/jest-worker/processChild.js"
        - generic [ref=e21]: This error happened while generating the page. Any console logs will be displayed in the terminal window.
      - generic [ref=e22]:
        - heading "Call Stack" [level=2] [ref=e23]
        - group [ref=e24]:
          - generic "Next.js" [ref=e25] [cursor=pointer]:
            - img [ref=e26]
            - img [ref=e28]
            - text: Next.js
        - generic [ref=e33]:
          - heading "TracingChannel.traceSync" [level=3] [ref=e34]
          - generic [ref=e36]: node:diagnostics_channel (322:14)
        - group [ref=e37]:
          - generic "Next.js" [ref=e38] [cursor=pointer]:
            - img [ref=e39]
            - img [ref=e41]
            - text: Next.js
```