import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto, res: Response): Promise<{
        success: boolean;
        data: {
            user: {
                id: string;
                email: string;
                avatar: string | null;
                userType: import("database").$Enums.UserType;
                role: import("database").$Enums.UserRole;
                tier: import("database").$Enums.UserTier;
                organizationId: string;
            };
        };
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
    }>;
    login(loginDto: LoginDto, res: Response): Promise<{
        success: boolean;
        data: {
            user: {
                id: string;
                email: string;
                avatar: string | null;
                userType: import("database").$Enums.UserType;
                role: import("database").$Enums.UserRole;
                tier: import("database").$Enums.UserTier;
            };
        };
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
    }>;
    refresh(req: Request, res: Response): Promise<{
        success: boolean;
        data: {
            message: string;
        };
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
    }>;
    logout(res: Response): Promise<{
        success: boolean;
        data: {
            message: string;
        };
        timestamp: string;
    }>;
}
