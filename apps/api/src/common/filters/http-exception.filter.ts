import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // 提取错误消息
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        if (Array.isArray(message)) {
          message = message[0];
        }
      }

      // 映射业务错误码
      if (exception instanceof ConflictException) {
        errorCode = 'EMAIL_EXISTS';
      } else if (exception instanceof UnauthorizedException) {
        errorCode = 'INVALID_CREDENTIALS';
      } else if (exception instanceof ForbiddenException) {
        errorCode = 'FORBIDDEN';
      } else if (exception instanceof NotFoundException) {
        errorCode = 'NOT_FOUND';
      } else {
        errorCode = `HTTP_${status}`;
      }
    }

    response.status(status).json({
      success: false,
      error: {
        code: errorCode,
        message,
      },
      requestId: request.headers['x-request-id'] || randomUUID(),
      timestamp: new Date().toISOString(),
    });
  }
}











