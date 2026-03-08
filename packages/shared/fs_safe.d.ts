export declare function readFileUnderLimit(filePath: string, maxBytes?: number): Promise<string>;
export declare function readBufferUnderLimit(filePath: string, maxBytes?: number): Promise<Buffer>;
export declare function safeJoin(root: string, key: string): string;
