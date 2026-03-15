export interface ShotPlanningEngineInput {
    shotId: string;
    text: string;
    semanticInfo?: Record<string, unknown>;
    context?: Record<string, unknown>;
    options?: {
        suggestShotType?: boolean;
        suggestMovement?: boolean;
    };
}
export interface ShotPlanningEngineOutput {
    shotType?: {
        primary: string;
        confidence?: number;
    };
    movement?: {
        primary: string;
        confidence?: number;
    };
}
