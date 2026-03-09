import { AxiosRequestConfig } from 'axios';
export interface HttpClientConfig {
    baseURL: string;
    timeout: number;
    headers?: Record<string, string>;
}
export interface HttpClientResponse<T = any> {
    status: number;
    data: T;
    headers: Record<string, string>;
}
export declare class HttpClient {
    private client;
    constructor(config: HttpClientConfig);
    post<T = any>(path: string, data: any, config?: AxiosRequestConfig): Promise<HttpClientResponse<T>>;
}
