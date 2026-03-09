export declare const SystemPermissions: {
    readonly AUTH: "auth";
    readonly AUDIT: "audit";
    readonly MODEL_USE: "model.use";
    readonly BILLING: "billing";
    readonly PROJECT_CREATE: "project.create";
    readonly BILLING_VIEW: "billing.view";
    readonly BILLING_MANAGE: "billing.manage";
    readonly MODEL_USE_BASE: "model.use.base";
    readonly NOVEL_UPLOAD: "novel.upload";
    readonly NOVEL_READ: "novel.read";
    readonly NOVEL_UPDATE: "novel.update";
    readonly STRUCTURE_READ: "structure.read";
};
export declare const ProjectPermissions: {
    readonly PROJECT_READ: "project.read";
    readonly PROJECT_WRITE: "project.write";
    readonly PROJECT_UPDATE: "project.update";
    readonly PROJECT_GENERATE: "project.generate";
    readonly PROJECT_REVIEW: "project.review";
    readonly PROJECT_PUBLISH: "project.publish";
    readonly PROJECT_DELETE: "project.delete";
};
export type SystemPermission = (typeof SystemPermissions)[keyof typeof SystemPermissions];
export type ProjectPermission = (typeof ProjectPermissions)[keyof typeof ProjectPermissions];
