export interface CurrentUserPayload {
    userId: string;
    email: string;
    userType: string;
    role: string;
    tier: string;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
