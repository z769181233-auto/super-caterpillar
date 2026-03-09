import { HttpException } from '@nestjs/common';
export declare function buildHmacError(code: '4003' | '4004', message: string, debug?: {
    path?: string;
    method?: string;
}): HttpException;
