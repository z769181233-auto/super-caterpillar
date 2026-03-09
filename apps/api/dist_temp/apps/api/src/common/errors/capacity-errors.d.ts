export declare enum CapacityErrorCode {
    CAPACITY_EXCEEDED_CONCURRENT = "CAPACITY_EXCEEDED_CONCURRENT",
    CAPACITY_EXCEEDED_QUEUE = "CAPACITY_EXCEEDED_QUEUE",
    CAPACITY_EXCEEDED_TOTAL_QUEUE = "CAPACITY_EXCEEDED_TOTAL_QUEUE",
    CAPACITY_EXCEEDED_USER_CONCURRENT = "CAPACITY_EXCEEDED_USER_CONCURRENT"
}
export declare const CapacityErrorMessages: Record<CapacityErrorCode, string>;
export declare class CapacityExceededException extends Error {
    readonly errorCode: CapacityErrorCode;
    readonly currentCount: number;
    readonly limit: number;
    constructor(errorCode: CapacityErrorCode, currentCount: number, limit: number, message?: string);
}
