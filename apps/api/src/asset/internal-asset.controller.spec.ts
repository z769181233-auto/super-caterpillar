import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InternalAssetController } from './internal-asset.controller';
import { SignedUrlService } from '../storage/signed-url.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApiSecurityGuard } from '../security/api-security/api-security.guard';

describe('InternalAssetController', () => {
  let controller: InternalAssetController;

  const mockSignedUrlService = {
    generateSignedUrl: jest.fn(),
  };

  const mockPrismaService = {
    asset: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [InternalAssetController],
      providers: [
        { provide: SignedUrlService, useValue: mockSignedUrlService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    });

    moduleBuilder.overrideGuard(ApiSecurityGuard).useValue({
      canActivate: jest.fn().mockReturnValue(true),
    });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<InternalAssetController>(InternalAssetController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('缺少 key 时应报错', async () => {
    await expect(controller.getPublicUrl('')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('找不到资产归属时应报错', async () => {
    mockPrismaService.asset.findMany.mockResolvedValue([]);

    await expect(controller.getPublicUrl('videos/demo.mp4')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('同一个 storageKey 对应多个不同归属时应拒绝签名', async () => {
    mockPrismaService.asset.findMany.mockResolvedValue([
      { project: { organizationId: 'org-1', ownerId: 'user-1' } },
      { project: { organizationId: 'org-2', ownerId: 'user-2' } },
    ]);

    await expect(controller.getPublicUrl('videos/demo.mp4')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('归属唯一时应返回签名 URL', async () => {
    mockPrismaService.asset.findMany.mockResolvedValue([
      { project: { organizationId: 'org-1', ownerId: 'user-1' } },
      { project: { organizationId: 'org-1', ownerId: 'user-1' } },
    ]);
    mockSignedUrlService.generateSignedUrl.mockResolvedValue({
      url: 'https://signed.example/video.mp4',
      expiresAt: '2026-03-25T20:00:00.000Z',
    });

    await expect(controller.getPublicUrl('videos/demo.mp4')).resolves.toEqual({
      url: 'https://signed.example/video.mp4',
      expiresAt: '2026-03-25T20:00:00.000Z',
      storageKey: 'videos/demo.mp4',
    });

    expect(mockSignedUrlService.generateSignedUrl).toHaveBeenCalledWith({
      key: 'videos/demo.mp4',
      tenantId: 'org-1',
      userId: 'user-1',
      expiresIn: 300,
    });
  });
});
