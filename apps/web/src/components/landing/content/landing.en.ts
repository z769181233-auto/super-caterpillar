
import { LandingContent } from './types';

export const landingEn: LandingContent = {
    nav: {
        process: "Production Flow",
        features: "Capabilities",
        platform: "Open Platform",
        login: "Log In",
        enterStudio: "Enter Studio"
    },
    hero: {
        title: "Turn Novels into Scalable Animation.",
        subtitle: "Use a complete AI industrial system, not scattered tools.",
        description: "Super Caterpillar converts text content into deliverable, controllable, and scalable animations\nthrough multi-engine collaboration, structured assets, and automated production workflows.",
        ctaPrimary: "Enter Studio",
        ctaSecondary: "View Process"
    },
    notATool: {
        title: "Not Just an AI Tool,\nA Complete Animation Production Line.",
        cards: [
            {
                title: "Structured Production",
                desc: "Novels, characters, and world views dismantled into computable production structures."
            },
            {
                title: "Quality & Consistency",
                desc: "Auto QA, logic verification, and visual consistency mechanisms ensure stable delivery."
            },
            {
                title: "Controllable Cost & Efficiency",
                desc: "Real-time visibility, predictability, and optimization of GPU, model, and task-level costs."
            }
        ]
    },
    threeSystems: {
        title: "An Expandable AI Animation Platform",
        subtitle: "All models, assets, and production tasks\nare unified and orchestrated by the Engine system.",
        cards: [
            {
                title: "Engine Universe",
                desc: "Core Scheduler: Unifies generation, analysis, repair, and evaluation engines for cross-model collaboration."
            },
            {
                title: "Model Universe",
                desc: "Multi-model routing and swapping,\nsupporting privatization fine-tuning and style customization."
            },
            {
                title: "Asset Universe",
                desc: "Reusable, cumulative digital assets (Characters, Scenes, Styles)\nsupporting long-term cross-project production."
            }
        ]
    },
    productionFlow: {
        title: "From Story to Film\nFully Automated Production Flow",
        steps: [
            {
                title: "01 Import & Analysis",
                desc: "AI deeply understands text, dismantling plot, characters, and world-view elements."
            },
            {
                title: "02 Script & Semantics",
                desc: "Auto-converts to standard production scripts, building an executable semantic space."
            },
            {
                title: "03 Shot Planning",
                desc: "Precisely plans framing, camera movement, and composition for render-ready structures."
            },
            {
                title: "04 Asset Generation",
                desc: "Batch generates consistent Characters, Scenes, and Assets for the reusable library."
            },
            {
                title: "05 Batch Video Generation",
                desc: "Cluster rendering and task scheduling for high-efficiency animation fragment generation."
            },
            {
                title: "06 Synthesis, Repair & Export",
                desc: "Intelligent editing and post-processing to output final deliverable films."
            }
        ]
    },
    capabilities: {
        title: "Six Core Capabilities for Industrial Animation",
        cards: [
            {
                title: "Visual Scene Graph",
                desc: "Intuitively present plot structure, relationships, and scene links to master complex narratives.",
                link: "structure"
            },
            {
                title: "Intelligent QA",
                desc: "System automatically identifies and blocks logic/visual errors without manual frame-by-frame checks.",
                link: "quality"
            },
            {
                title: "Multi-Level Management",
                desc: "Supports Organization/Project/Scene layering, adapting to large teams and permission controls.",
                link: "overview"
            },
            {
                title: "Smart Engine Routing",
                desc: "Automatically selects the 'most cost-effective and available' generation scheme to maximize ROI.",
                link: "jobs"
            },
            {
                title: "Enterprise Audit",
                desc: "Full-process IP control, traceability, and commercial compliance, eliminating copyright risks.",
                link: "logs"
            },
            {
                title: "Cost & Efficiency Center",
                desc: "Real-time monitoring of every compute unit consumed, eliminating budget black holes.",
                link: "cost"
            }
        ]
    },
    solutionRoles: {
        title: "Providing the Same Industrial Capabilities for Different Roles",
        cards: [
            {
                title: "Creators",
                desc: "Turn stories into truly continuously updated animated works.",
                action: "View Solution",
                link: "overview"
            },
            {
                title: "Studios",
                desc: "Use AI to turn animation production into a manageable, reproducible process.",
                action: "View Solution",
                link: "pipeline"
            },
            {
                title: "Enterprise / IP Owners",
                desc: "Turn IP content into controllable, auditable industrial digital assets.",
                action: "View Solution",
                link: "assets"
            }
        ]
    },
    footerCTA: {
        title: "Ready to Enter the AI Animation Industrial Era?",
        primary: "Enter Studio",
        secondary: "Contact Us"
    }
} as const;
