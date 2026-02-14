import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * 环境变量强制校验服务
 * 
 * 根据 GO_LIVE_CHECKLIST_SSOT.md 第2节要求：
 * - P0级环境变量必须在启动时校验
 * - 缺少时拒绝启动并输出明确错误
 * - 生产环境必须额外校验安全配置
 * 
 * @see docs/_specs/GO_LIVE_CHECKLIST_SSOT.md
 */
@Injectable()
export class EnvValidatorService implements OnModuleInit {
    private readonly logger = new Logger(EnvValidatorService.name);

    /**
     * P0 级环境变量清单（所有环境必需）
     */
    private readonly P0_REQUIRED_VARS = [
        'DATABASE_URL',
        'API_SECRET_KEY',
    ] as const;

    /**
     * P1 级环境变量清单（推荐但非强制）
     */
    private readonly P1_RECOMMENDED_VARS = [
        'NODE_ENV',
        'ENABLE_INTERNAL_JOB_WORKER',
    ] as const;

    /**
     * 生产环境强制规则
     */
    private readonly PRODUCTION_RULES = [
        {
            key: 'ALLOW_DATABASE_DESTRUCTIVE_CLEAN',
            expectedValue: 'false',
            description: '生产环境必须禁用数据库破坏性清理',
        },
        {
            key: 'GATE_MODE',
            expectedValue: '0',
            description: '生产环境必须显式设置 GATE_MODE=0',
        },
    ] as const;

    onModuleInit() {
        this.logger.log('🔍 [ENV_VALIDATOR] 开始环境变量强制校验...');

        const errors: string[] = [];
        const warnings: string[] = [];

        // 1. 检查 P0 级必需变量
        for (const varName of this.P0_REQUIRED_VARS) {
            const value = process.env[varName];

            if (!value || value.trim() === '') {
                errors.push(
                    `❌ P0 环境变量缺失: ${varName}\n` +
                    `   描述: ${this.getVarDescription(varName)}\n` +
                    `   影响: 系统无法启动\n` +
                    `   修复: 在 .env.local 中设置 ${varName}`
                );
            } else {
                this.logger.log(`✅ [P0] ${varName}: 已配置 (${this.maskSensitive(varName, value)})`);
            }
        }

        // 2. 检查 P1 级推荐变量
        for (const varName of this.P1_RECOMMENDED_VARS) {
            const value = process.env[varName];

            if (!value || value.trim() === '') {
                warnings.push(
                    `⚠️  P1 环境变量未配置: ${varName}\n` +
                    `   描述: ${this.getVarDescription(varName)}\n` +
                    `   影响: 使用默认值\n` +
                    `   建议: 在 .env.local 中显式设置`
                );
            } else {
                this.logger.log(`✅ [P1] ${varName}: ${value}`);
            }
        }

        // 3. 生产环境额外校验
        const isProduction = process.env.NODE_ENV === 'production';

        if (isProduction) {
            this.logger.warn('🚨 [PRODUCTION MODE] 执行生产环境安全校验...');

            for (const rule of this.PRODUCTION_RULES) {
                const value = process.env[rule.key];

                if (value !== rule.expectedValue) {
                    errors.push(
                        `❌ 生产环境安全规则违规: ${rule.key}\n` +
                        `   要求值: ${rule.expectedValue}\n` +
                        `   实际值: ${value || '(未设置)'}\n` +
                        `   原因: ${rule.description}\n` +
                        `   修复: 在 .env.local 中设置 ${rule.key}=${rule.expectedValue}`
                    );
                } else {
                    this.logger.log(`✅ [PROD_RULE] ${rule.key}=${value} ✓`);
                }
            }
        }

        // 4. 输出校验结果
        if (warnings.length > 0) {
            this.logger.warn('⚠️  ========== 环境变量警告 ==========');
            warnings.forEach(w => this.logger.warn(w));
            this.logger.warn('========================================\n');
        }

        if (errors.length > 0) {
            this.logger.error('❌ ========== 环境变量校验失败 ==========');
            errors.forEach(e => this.logger.error(e));
            this.logger.error('=========================================');
            this.logger.error('\n');
            this.logger.error('🚨 [ENV_VALIDATOR] 环境变量校验失败，系统拒绝启动！');
            this.logger.error('🚨 请修复上述错误后重新启动。');
            this.logger.error('\n');
            this.logger.error('📋 参考文档: docs/_specs/GO_LIVE_CHECKLIST_SSOT.md');
            this.logger.error('\n');

            // 强制退出
            process.exit(1);
        }

        this.logger.log('✅ [ENV_VALIDATOR] 环境变量校验通过！');

        // 输出环境摘要
        this.printEnvironmentSummary();
    }

    /**
     * 获取变量描述
     */
    private getVarDescription(varName: string): string {
        const descriptions: Record<string, string> = {
            DATABASE_URL: '生产数据库连接字符串（PostgreSQL）',
            API_SECRET_KEY: 'HMAC 签名主密钥（强随机字符串，至少32位）',
            NODE_ENV: '运行环境标识（development/production）',
            ENABLE_INTERNAL_JOB_WORKER: '是否启动内置 Worker 进程（true/false）',
            GATE_MODE: '门禁模式（0=生产，1=开发）',
            ALLOW_DATABASE_DESTRUCTIVE_CLEAN: '是否允许数据库破坏性清理（false=禁止）',
        };

        return descriptions[varName] || '（无描述）';
    }

    /**
     * 脱敏敏感信息
     */
    private maskSensitive(varName: string, value: string): string {
        const sensitiveVars = ['API_SECRET_KEY', 'DATABASE_URL'];

        if (sensitiveVars.includes(varName)) {
            if (value.length <= 8) {
                return '****';
            }
            return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        }

        return value;
    }

    /**
     * 打印环境摘要
     */
    private printEnvironmentSummary() {
        const summary = {
            NODE_ENV: process.env.NODE_ENV || 'development',
            DATABASE: this.extractDbHost(process.env.DATABASE_URL || ''),
            GATE_MODE: process.env.GATE_MODE || '(未设置)',
            DESTRUCTIVE_CLEAN: process.env.ALLOW_DATABASE_DESTRUCTIVE_CLEAN || 'false',
            WORKER_ENABLED: process.env.ENABLE_INTERNAL_JOB_WORKER || '(未设置)',
        };

        this.logger.log('📊 ========== 环境配置摘要 ==========');
        this.logger.log(`   运行环境: ${summary.NODE_ENV}`);
        this.logger.log(`   数据库: ${summary.DATABASE}`);
        this.logger.log(`   门禁模式: ${summary.GATE_MODE}`);
        this.logger.log(`   破坏性清理: ${summary.DESTRUCTIVE_CLEAN}`);
        this.logger.log(`   内置Worker: ${summary.WORKER_ENABLED}`);
        this.logger.log('========================================\n');
    }

    /**
     * 从 DATABASE_URL 提取主机信息（脱敏）
     */
    private extractDbHost(url: string): string {
        try {
            const match = url.match(/postgresql:\/\/[^@]+@([^/]+)/);
            return match ? match[1] : '(解析失败)';
        } catch {
            return '(解析失败)';
        }
    }
}
