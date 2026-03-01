import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        avatar: true,
        userType: true,
        role: true,
        tier: true,
        quota: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getQuota(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { quota: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 从 quota JSON 字段中提取配额信息
    const quota = user.quota as {
      remainingTokens?: number;
      computeSeconds?: number;
      credits?: number;
    } | null;

    return {
      remainingTokens: quota?.remainingTokens ?? 0,
      computeSeconds: quota?.computeSeconds ?? 0,
      credits: quota?.credits ?? 0,
    };
  }
}
