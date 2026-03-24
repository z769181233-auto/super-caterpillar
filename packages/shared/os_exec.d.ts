export declare function execAsync(cmd: string, args: string[], opts?: {
    timeoutMs?: number;
    [key: string]: any;
}): Promise<{
    code: number;
    stdout: string;
    stderr: string;
    timedOut?: boolean;
}>;
