
export interface LandingContent {
    readonly nav: {
        readonly process: string;
        readonly features: string;
        readonly platform: string;
        readonly login: string;
        readonly enterStudio: string;
    };
    readonly hero: {
        readonly title: string;
        readonly subtitle: string;
        readonly description: string;
        readonly ctaPrimary: string;
        readonly ctaSecondary: string;
    };
    readonly notATool: {
        readonly title: string;
        readonly cards: readonly { readonly title: string; readonly desc: string }[];
    };
    readonly threeSystems: {  // Previously universe/platform
        readonly title: string;
        readonly subtitle: string;
        readonly cards: readonly { readonly title: string; readonly desc: string }[];
    };
    readonly productionFlow: { // Previously pipeline
        readonly title: string;
        readonly steps: readonly { readonly title: string; readonly desc: string }[];
    };
    capabilities: {
        title: string;
        cards: Array<{
            title: string;
            desc: string;
            link?: string;
        }>;
    };
    solutionRoles: { // Previously personas
        title: string;
        cards: Array<{
            title: string;
            desc: string;
            action: string;
            link?: string;
        }>;
    };
    footerCTA: { // Previously cta
        readonly title: string;
        readonly primary: string;
        readonly secondary: string;
    };
}
