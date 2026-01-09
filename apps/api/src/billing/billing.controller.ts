import { Controller, Post, Body, Get, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingSettlementService } from './billing-settlement.service';

@Controller('billing')
export class BillingController {
    constructor(
        private readonly billingService: BillingService,
        private readonly billingSettlementService: BillingSettlementService
    ) { }

    @Post('subscribe')
    @UseGuards(JwtAuthGuard)
    async subscribe(@Req() req: any, @Body('planId') planId: string) {
        if (!req.user || !req.user.id) throw new UnauthorizedException();
        return this.billingService.createSubscription(req.user.id, planId);
    }

    @Get('subscription')
    @UseGuards(JwtAuthGuard)
    async getSubscription(@Req() req: any) {
        if (!req.user || !req.user.id) throw new UnauthorizedException();
        return this.billingService.getSubscription(req.user.id);
    }

    @Get('plans')
    async getPlans() {
        return this.billingService.getPlans();
    }

    @Post('settle')
    @UseGuards(JwtAuthGuard)
    async settle(@Req() req: any, @Body('projectId') projectId: string) {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) throw new UnauthorizedException();
        // Entry point for P1-C Settlement
        return this.billingSettlementService.settleProject(projectId);
    }
}
