
import { LandingContent } from './types';

export const landingZh: LandingContent = {
    nav: {
        process: "制作流程",
        features: "系统能力",
        platform: "开放平台",
        login: "登录",
        enterStudio: "进入工作台"
    },
    hero: {
        title: "把小说，变成可规模生产的动画。",
        subtitle: "用一整套 AI 动画工业系统，而不是零散工具。",
        description: "毛毛虫宇宙通过多引擎协同、结构化资产与自动化生产流程，\n将文本内容持续转化为可交付、可控、可扩展的动画作品。",
        ctaPrimary: "进入 Studio，开始创作",
        ctaSecondary: "了解完整生产流程"
    },
    notATool: {
        title: "这不是一个 AI 工具，\n而是一条完整的动画生产线。",
        cards: [
            {
                title: "结构化生产",
                desc: "小说、角色、世界观被拆解为可计算、可管理的生产结构。"
            },
            {
                title: "质量与一致性",
                desc: "自动 QA、逻辑校验与视觉一致性机制，保障稳定交付。"
            },
            {
                title: "成本与效率可控",
                desc: "GPU / 模型 / 任务级成本实时可见、可预测、可优化。"
            }
        ]
    },
    threeSystems: {
        title: "一个可以持续扩展的 AI 动漫平台",
        subtitle: "所有模型、资产与生产任务，\n均由统一的引擎体系进行编排与执行。",
        cards: [
            {
                title: "引擎体系 (Engine Universe)",
                desc: "统一调度生成、分析、修复与评估等多类 AI 引擎，\n实现跨模型、跨任务的协同工作。"
            },
            {
                title: "模型宇宙 (Model Universe)",
                desc: "多模型可替换、可路由，\n支持私有化微调与风格定制。"
            },
            {
                title: "资产宇宙 (Asset Universe)",
                desc: "角色、场景、风格等数字资产可复用、可积累，\n支撑跨项目、跨季的长期生产。"
            }
        ]
    },
    productionFlow: {
        title: "从故事，到成片的全自动动画生产流程",
        steps: [
            {
                title: "01 小说导入与结构分析",
                desc: "AI 深度理解文本，拆解剧情、角色与世界观核心要素。"
            },
            {
                title: "02 剧本与语义理解",
                desc: "自动转换为标准化制作脚本，构建可执行语义空间。"
            },
            {
                title: "03 分镜与镜头规划",
                desc: "精准规划景别、运镜与画面构图，形成可渲染结构。"
            },
            {
                title: "04 角色 / 场景 / 资产生成",
                desc: "多引擎批量生成一致性资产，进入可复用资产库。"
            },
            {
                title: "05 批量视频生成",
                desc: "集群化渲染与任务调度，高效生成动画片段。"
            },
            {
                title: "06 合成、修复与导出",
                desc: "智能剪辑与后期处理，输出最终可交付成片。"
            }
        ]
    },
    capabilities: {
        title: "为动画工业化而生的六大系统能力",
        cards: [
            {
                title: "可视化场景图谱",
                desc: "直观呈现剧情结构、人物关系与场景关联，轻松掌控复杂叙事体系。",
                link: "structure"
            },
            {
                title: "智能质量评估",
                desc: "系统自动识别并拦截逻辑与视觉错误，无需人工逐帧检查。",
                link: "quality"
            },
            {
                title: "多层级生产管理",
                desc: "支持组织 / 项目 / 场景分层管理，适配大型团队协作与权限控制。",
                link: "overview"
            },
            {
                title: "多引擎智能路由",
                desc: "自动选择“最省钱且可用”的生成方案，最大化单位成本产出。",
                link: "jobs"
            },
            {
                title: "企业级安全审计",
                desc: "IP 全流程可控、可追责、可商用，杜绝版权与合规风险。",
                link: "logs"
            },
            {
                title: "成本与效能中心",
                desc: "实时监控每一分算力消耗，杜绝预算黑洞，优化资源配置。",
                link: "cost"
            }
        ]
    },
    solutionRoles: {
        title: "为不同角色，提供同一套工业能力",
        cards: [
            {
                title: "创作者",
                desc: "把故事，变成真正能持续更新的动画作品。",
                action: "查看解决方案",
                link: "overview"
            },
            {
                title: "动画工作室",
                desc: "用 AI 把动画生产，变成可管理、可复制的流程。",
                action: "查看解决方案",
                link: "pipeline"
            },
            {
                title: "企业 / IP 方",
                desc: "把 IP 内容，变成可控、可审计的工业化数字资产。",
                action: "查看解决方案",
                link: "assets"
            }
        ]
    },
    footerCTA: {
        title: "准备好进入 AI 动漫工业时代了吗？",
        primary: "进入 Studio",
        secondary: "联系我们"
    }
} as const;
