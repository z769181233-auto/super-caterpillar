import { Controller, Post, Body, Get, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('billing')
export class BillingController {
    constructor(private readonly billingService: BillingService) { }

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
}
