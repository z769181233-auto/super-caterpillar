export declare class UpdateShotDto {
    params?: Record<string, any>;
    status?: string;
    title?: string;
    description?: string;
    dialogue?: string;
    prompt?: string;
    reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    reviewNote?: string;
    previewUrl?: string;
}
