import { LocalStorageAdapter } from '@scu/storage';
import * as fs from 'fs';
export declare class LocalStorageService {
    private readonly logger;
    readonly adapter: LocalStorageAdapter;
    constructor();
    getAbsolutePath(key: string): string;
    getReadStream(key: string): fs.ReadStream;
    exists(key: string): boolean;
    readString(key: string): Promise<string>;
}
