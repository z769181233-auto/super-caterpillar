import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ScriptBuildService {
    constructor(private readonly prisma: PrismaService) { }

    async getOutline(buildId: string) {
        try {
            const build = await this.prisma.scriptBuild.findUnique({
                where: { id: buildId },
                include: {
                    storySource: true,
                    episodes: {
                        orderBy: { index: 'asc' },
                        include: {
                            sourceRef: true,
                            scenes: {
                                orderBy: { sceneIndex: 'asc' },
                                include: {
                                    sourceRef: true,
                                    shots: {
                                        orderBy: { index: 'asc' },
                                        include: { sourceRef: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!build) throw new NotFoundException(`Build ${buildId} not found`);

            // Aggregate Stats
            const stats = {
                episodes: build.episodes?.length || 0,
                scenes: build.episodes?.reduce((acc, ep) => acc + (ep.scenes?.length || 0), 0) || 0,
                shots: build.episodes?.reduce((acc, ep) => acc + (ep.scenes?.reduce((sAcc, sc) => sAcc + (sc.shots?.length || 0), 0) || 0), 0) || 0,
                characters: 0, // Placeholder for aggregation logic
                coveragePercent: (build.metadata as any)?.coveragePercent || 0,
                totalBytes: build.storySource?.size || 0
            };

            return {
                build: {
                    id: build.id,
                    projectId: build.projectId,
                    title: build.storySource?.title,
                    status: build.status,
                    auditId: (build.metadata as any)?.auditId || build.id.substring(0, 8),
                    globalHash: build.storySource?.globalHash,
                    createdAt: build.createdAt
                },
                stats,
                episodes: build.episodes?.map(ep => ({
                    id: ep.id,
                    index: ep.index,
                    title: ep.name, // Revert to name
                    startOffset: ep.sourceRef?.offsetStart,
                    endOffset: ep.sourceRef?.offsetEnd,
                    scenes: ep.scenes?.map(sc => ({
                        id: sc.id,
                        index: sc.sceneIndex,
                        title: sc.summary || `Scene ${sc.sceneIndex}`,
                        startOffset: sc.sourceRef?.offsetStart,
                        endOffset: sc.sourceRef?.offsetEnd,
                        shots: sc.shots?.map(shot => ({
                            id: shot.id,
                            index: shot.index,
                            summary: shot.content,
                            startOffset: shot.sourceRef?.offsetStart,
                            endOffset: shot.sourceRef?.offsetEnd,
                            sourceHash: shot.sourceRef?.textHash
                        })) || []
                    })) || []
                })) || []
            };
        } catch (error) {
            console.error('[ScriptBuildService.getOutline] ERROR:', error);
            throw error;
        }
    }

    async getShotSource(shotId: string, context: number = 400) {
        const shot = await this.prisma.shot.findUnique({
            where: { id: shotId },
            include: {
                sourceRef: true,
                scriptBuild: { include: { storySource: true } }
            }
        });

        if (!shot || !shot.sourceRef || !shot.scriptBuild) throw new NotFoundException(`Shot ${shotId} or its source/build reference not found`);

        const source = shot.scriptBuild.storySource;
        const filePath = source.path;

        if (!fs.existsSync(filePath)) throw new NotFoundException(`Source file not found at ${filePath}`);

        const start = Math.max(0, shot.sourceRef.offsetStart - context);
        const end = Math.min(source.size, shot.sourceRef.offsetEnd + context);
        const length = end - start;

        const buffer = Buffer.alloc(length);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, length, start);
        fs.closeSync(fd);

        const excerpt = buffer.toString('utf8');

        return {
            shot: { id: shot.id, buildId: shot.buildId, summary: shot.content },
            source: {
                startOffset: shot.sourceRef.offsetStart,
                endOffset: shot.sourceRef.offsetEnd,
                sourceHash: shot.sourceRef.textHash,
                globalHash: source.globalHash,
                excerpt,
                excerptStart: start,
                excerptEnd: end
            }
        };
    }
}
