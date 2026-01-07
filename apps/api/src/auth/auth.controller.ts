import { Controller, Post, Body, Res, Req, Inject } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { env } from '@scu/config';
import { AuditAction } from '../audit/audit.decorator';
import { AuditActions } from '../audit/audit.constants';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @Public() // 标记为公开路由，跳过 HMAC 校验
  @AuditAction(AuditActions.LOGIN) // 注册也视为一次登录入口
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(registerDto);

    // 设置 httpOnly cookie
    const isProduction = env.isProduction;
    res.cookie('accessToken', result.data.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    if (result.data.refreshToken) {
      res.cookie('refreshToken', result.data.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    // 返回用户信息，不返回 token
    return {
      success: true,
      data: {
        user: result.data.user,
      },
      requestId: result.requestId,
      timestamp: result.timestamp,
    };
  }

  @Post('login')
  @Public() // 标记为公开路由，跳过 HMAC 校验
  @AuditAction(AuditActions.LOGIN)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);

    // 设置 httpOnly cookie
    const isProduction = env.isProduction;
    res.cookie('accessToken', result.data.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    if (result.data.refreshToken) {
      res.cookie('refreshToken', result.data.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    // 返回用户信息，不返回 token
    return {
      success: true,
      data: {
        user: result.data.user,
      },
      requestId: result.requestId,
      timestamp: result.timestamp,
    };
  }

  @Post('refresh')
  @Public() // 标记为公开路由，跳过 HMAC 校验
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      throw new Error('Refresh token not found');
    }

    const result = await this.authService.refresh(refreshToken);

    // 设置新的 access token cookie
    const isProduction = env.isProduction;
    res.cookie('accessToken', result.data.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      data: {
        message: 'Token refreshed',
      },
      requestId: result.requestId,
      timestamp: result.timestamp,
    };
  }

  @Post('logout')
  @AuditAction(AuditActions.LOGOUT)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return {
      success: true,
      data: { message: 'Logged out successfully' },
      timestamp: new Date().toISOString(),
    };
  }
}










