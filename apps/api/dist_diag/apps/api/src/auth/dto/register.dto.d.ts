import { UserType } from 'database';
export declare class RegisterDto {
    email: string;
    password: string;
    name?: string;
    userType?: UserType;
}
