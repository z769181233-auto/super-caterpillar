import { PrismaService } from '../prisma/prisma.service';
export declare class UserService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByEmail(email: string): Promise<any>;
    findById(id: string): Promise<any>;
    getQuota(userId: string): Promise<any>;
}
