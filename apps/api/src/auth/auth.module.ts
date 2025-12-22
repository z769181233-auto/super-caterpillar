import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtOrHmacGuard } from './guards/jwt-or-hmac.guard';
import { PermissionsGuard } from './permissions.guard';
import { UserModule } from '../user/user.module';
import { OrganizationModule } from '../organization/organization.module';
import { HmacAuthModule } from './hmac/hmac-auth.module';
import { PermissionModule } from '../permission/permission.module';
import { env } from 'config';
import { AuditModule } from '../audit/audit.module';
import { NonceModule } from './nonce.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || env.jwtSecret,
        signOptions: {
          expiresIn: env.jwtExpiresIn,
        },
      }),
    }),
    forwardRef(() => UserModule),
    HmacAuthModule, // 导入 HMAC 认证模块
    PermissionModule, // 导入权限模块（PermissionsGuard 需要 PermissionService）
    AuditModule,
    NonceModule, // 导入 Nonce 模块
    ApiSecurityModule, // 导入 API Security 模块（JwtOrHmacGuard 需要 ApiSecurityGuard）
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    JwtOrHmacGuard,
    PermissionsGuard,
  ],
  exports: [AuthService, HmacAuthModule, JwtAuthGuard, JwtOrHmacGuard, PermissionsGuard, NonceModule], // 导出供其他模块使用
})
export class AuthModule { }










