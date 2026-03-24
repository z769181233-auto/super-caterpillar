/**
 * HTTP Client
 * 对 HTTP 请求的最小封装，用于 EngineAdapter 调用外部服务
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

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

export class HttpClient {
  private client: AxiosInstance;

  constructor(config: HttpClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });
  }

  /**
   * 发送 POST 请求
   */
  async post<T = any>(
    path: string,
    data: any,
    config?: AxiosRequestConfig
  ): Promise<HttpClientResponse<T>> {
    try {
      const response = await this.client.post<T>(path, data, config);
      return {
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      // 将 AxiosError 转换为更友好的错误格式
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          // HTTP 响应错误（4xx, 5xx）
          throw {
            type: 'HTTP_ERROR',
            status: axiosError.response.status,
            statusText: axiosError.response.statusText,
            data: axiosError.response.data,
            message: `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`,
          };
        } else if (axiosError.request) {
          // 请求已发送但没有收到响应（网络错误、超时等）
          const code = (axiosError.code as string) || 'UNKNOWN';
          throw {
            type: 'NETWORK_ERROR',
            code,
            message: axiosError.message || 'Network request failed',
            originalError: axiosError,
          };
        }
      }
      // 其他错误
      throw {
        type: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        originalError: error,
      };
    }
  }
}
