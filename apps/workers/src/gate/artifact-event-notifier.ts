/**
 * B3-3: Artifact Event Notifier
 * 
 * 实现 Artifact 生成完成后的事件通知机制，提升下游任务的响应速度。
 * 
 * 设计：
 * - Worker 完成任务后立即发送通知
 * - 支持多种通知渠道（WebSocket、Webhook、数据库事件表）
 * - 异步非阻塞，不影响主流程性能
 */

export interface ArtifactEvent {
    eventId: string;
    jobId: string;
    artifactDir: string;
    artifactType: 'SHOT_RENDER_OUTPUT_MP4' | 'PROVENANCE_JSON' | 'FRAMES_TXT' | 'OTHER';
    storageKey?: string;
    sha256?: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

export class ArtifactEventNotifier {
    private eventQueue: ArtifactEvent[] = [];
    private isProcessing: boolean = false;

    /**
     * 发布 Artifact 生成事件
     * @param event Artifact 事件
     */
    public async publish(event: Omit<ArtifactEvent, 'eventId' | 'timestamp'>): Promise<void> {
        const fullEvent: ArtifactEvent = {
            ...event,
            eventId: this.generateEventId(),
            timestamp: new Date().toISOString(),
        };

        // 加入队列
        this.eventQueue.push(fullEvent);

        // 立即尝试处理（非阻塞）
        this.processQueue().catch((err) => {
            console.error('[ArtifactEventNotifier] 处理队列失败:', err.message);
        });
    }

    /**
     * 处理事件队列（异步批量处理）
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.eventQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            const batch = this.eventQueue.splice(0, 10); // 每次处理最多 10 个事件

            for (const event of batch) {
                await this.notifyEvent(event);
            }
        } finally {
            this.isProcessing = false;

            // 如果还有事件，继续处理
            if (this.eventQueue.length > 0) {
                setImmediate(() => this.processQueue());
            }
        }
    }

    /**
     * 发送单个事件通知
     */
    private async notifyEvent(event: ArtifactEvent): Promise<void> {
        // 方案 1: 写入数据库事件表（最简单，可靠性高）
        // await this.writeToEventTable(event);

        // 方案 2: 发送 WebSocket 通知（实时性高）
        // await this.sendWebSocketNotification(event);

        // 方案 3: 调用 Webhook（集成性强）
        // await this.callWebhook(event);

        // 当前实现：仅记录日志（生产环境应选择合适的通知方式）
        console.log('[ArtifactEventNotifier] 事件发布:', {
            eventId: event.eventId,
            jobId: event.jobId,
            artifactType: event.artifactType,
            artifactDir: event.artifactDir,
        });
    }

    /**
     * 生成唯一事件 ID
     */
    private generateEventId(): string {
        return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 获取队列统计信息
     */
    public getStats() {
        return {
            queueLength: this.eventQueue.length,
            isProcessing: this.isProcessing,
        };
    }

    /**
     * 关闭通知器（优雅退出）
     */
    public async shutdown(): Promise<void> {
        while (this.eventQueue.length > 0) {
            await this.processQueue();
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
}

// 单例模式
let globalNotifier: ArtifactEventNotifier | null = null;

export function getArtifactEventNotifier(): ArtifactEventNotifier {
    if (!globalNotifier) {
        globalNotifier = new ArtifactEventNotifier();
    }
    return globalNotifier;
}
