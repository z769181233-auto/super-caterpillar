import { IdentityConsistencyService } from './identity-consistency.service';
export declare class IdentityController {
    private readonly identityService;
    constructor(identityService: IdentityConsistencyService);
    scoreAndRecord(body: any): Promise<{
        recordId: string;
        score: number;
        verdict: "PASS" | "FAIL";
        details: any;
    }>;
}
