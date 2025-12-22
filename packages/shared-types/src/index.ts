// 前后端共享类型定义

export * from './auth.dto';
export * from './worker.dto';
export * from './user.dto';
// export * from './project.dto';
export * from './novel-analysis.dto';
export * from './scene-graph';
export * from './engines';
export * from './tasks';
export * from './quality';
export * from './jobs';
export * from './engine-profile';
export * from './projects';
export * from './workbench/project-overview.dto';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  requestId: string;
  timestamp: string;
}










