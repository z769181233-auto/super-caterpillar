// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient();

// --- 移植自 novel-analysis-processor.ts 的核心逻辑 ---

function basicTextSegmentation(rawText: string, projectId: string) {
    const lines = rawText.split(/\r?\n/);
    const seasons: any[] = [];
    let currentSeason: any = null;
    let currentEpisode: any = null;
    let currentScene: any = null;

    let seasonIndex = 0;
    let episodeIndex = 0;
    let sceneIndex = 0;
    let shotIndex = 0;

    const flushScene = () => {
        if (currentScene && currentScene.shots.length > 0) {
            currentEpisode?.scenes.push(currentScene);
        }
        currentScene = null;
        shotIndex = 0;
    };

    const flushEpisode = () => {
        if (currentEpisode && currentEpisode.scenes.length > 0) {
            currentSeason?.episodes.push(currentEpisode);
        }
        currentEpisode = null;
        sceneIndex = 0;
        shotIndex = 0;
    };

    const flushSeason = () => {
        if (currentSeason && currentSeason.episodes.length > 0) {
            seasons.push(currentSeason);
        }
        currentSeason = null;
        episodeIndex = 0;
        sceneIndex = 0;
        shotIndex = 0;
    };

    const pushSentenceAsShot = (sentence: string) => {
        const text = sentence.trim();
        if (!text) return;

        if (!currentScene) {
            sceneIndex += 1;
            currentScene = {
                index: sceneIndex,
                title: `场景 ${sceneIndex}`,
                summary: '',
                shots: [],
            };
        }

        shotIndex += 1;
        currentScene.shots.push({
            index: shotIndex,
            title: `镜头 ${shotIndex}`,
            summary: text.slice(0, 50),
            text,
        });
    };

    const ensureSeason = () => {
        if (!currentSeason) {
            seasonIndex += 1;
            currentSeason = {
                index: seasonIndex,
                title: `第 ${seasonIndex} 季`,
                summary: '',
                episodes: [],
            };
        }
    };

    const ensureEpisode = () => {
        ensureSeason();
        if (!currentEpisode) {
            episodeIndex += 1;
            currentEpisode = {
                index: episodeIndex,
                title: `第 ${episodeIndex} 集`,
                summary: '',
                scenes: [],
            };
        }
    };

    const seasonPattern = /第\s*([一二三四五六七八九十0-9]+)\s*(季|卷|部)/;
    const episodePattern = /第\s*([一二三四五六七八九十0-9]+)\s*(章|回|集)/;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            flushScene();
            continue;
        }

        const seasonMatch = line.match(seasonPattern);
        if (seasonMatch) {
            flushScene();
            flushEpisode();
            flushSeason();
            seasonIndex += 1;
            currentSeason = {
                index: seasonIndex,
                title: line,
                summary: '',
                episodes: [],
            };
            continue;
        }

        const episodeMatch = line.match(episodePattern);
        if (episodeMatch) {
            flushScene();
            flushEpisode();
            ensureSeason();
            episodeIndex += 1;
            currentEpisode = {
                index: episodeIndex,
                title: line,
                summary: '',
                scenes: [],
            };
            continue;
        }

        ensureEpisode();
        const sentences = line.split(/(?<=[。！？!?])/);
        for (const sentence of sentences) {
            pushSentenceAsShot(sentence);
        }
    }

    flushScene();
    flushEpisode();
    flushSeason();

    // Fallback for no structure
    if (seasons.length === 0 && rawText.trim()) {
        const fallbackSeason = {
            index: 1,
            title: '第 1 季',
            summary: '',
            episodes: [] as any[]
        };
        const fallbackEpisode = {
            index: 1,
            title: '第 1 集',
            summary: '',
            scenes: [] as any[]
        };

        const paragraphs = rawText.split(/\n\s*\n+/);
        let fSceneIndex = 0;
        for (const para of paragraphs) {
            const trimmed = para.trim();
            if (!trimmed) continue;
            fSceneIndex++;
            const scene = {
                index: fSceneIndex,
                title: `场景 ${fSceneIndex}`,
                summary: trimmed.slice(0, 50),
                shots: [] as any[]
            };
            const sentences = trimmed.split(/(?<=[。！？!?])/);
            let fShotIndex = 0;
            for (const s of sentences) {
                const t = s.trim();
                if (!t) continue;
                fShotIndex++;
                scene.shots.push({
                    index: fShotIndex,
                    title: `镜头 ${fShotIndex}`,
                    summary: t.slice(0, 50),
                    text: t
                });
            }
            if (scene.shots.length > 0) fallbackEpisode.scenes.push(scene);
        }
        if (fallbackEpisode.scenes.length > 0) {
            fallbackSeason.episodes.push(fallbackEpisode);
            seasons.push(fallbackSeason);
        }
    }

    return { projectId, seasons };
}

// --- Worker Loop ---

async function runWorker() {
    console.log("🚀 Headless Worker Started on " + process.env.DATABASE_URL);

    while (true) {
        try {
            const job = await prisma.novelAnalysisJob.findFirst({
                where: { status: 'PENDING' },
                orderBy: { createdAt: 'asc' }
            });

            if (!job) {
                // No jobs, wait
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            console.log(`\nProcessing Job ${job.id} (Project: ${job.projectId})...`);

            // Mark RUNNING
            await prisma.novelAnalysisJob.update({
                where: { id: job.id },
                data: { status: 'RUNNING', errorMessage: null }
            });

            // Get Novel Source
            const novelSourceId = job.novelSourceId;
            let novelSource: any;

            if (novelSourceId) {
                novelSource = await prisma.novelSource.findUnique({ where: { id: novelSourceId } });
            } else {
                novelSource = await prisma.novelSource.findFirst({
                    where: { projectId: job.projectId },
                    orderBy: { createdAt: 'desc' }
                });
            }

            if (!novelSource || !novelSource.rawText) {
                throw new Error("No novel source found or empty rawText");
            }

            // ANALYZE
            const structure = basicTextSegmentation(novelSource.rawText, job.projectId);
            console.log(`Analyzed: ${structure.seasons.length} Seasons.`);

            // SAVE TO DB (Transaction)
            await prisma.$transaction(async (tx: any) => {
                // Same logic as applyAnalyzedStructureToDatabase roughly
                for (const season of structure.seasons) {
                    const dbSeason = await tx.season.create({
                        data: {
                            projectId: job.projectId,
                            index: season.index,
                            title: season.title,
                            description: season.summary
                        }
                    });

                    for (const episode of season.episodes) {
                        const dbEpisode = await tx.episode.create({
                            data: {
                                seasonId: dbSeason.id,
                                projectId: job.projectId,
                                index: episode.index,
                                name: episode.title,
                                summary: episode.summary
                            }
                        });

                        for (const scene of episode.scenes) {
                            const dbScene = await tx.scene.create({
                                data: {
                                    episodeId: dbEpisode.id,
                                    index: scene.index,
                                    title: scene.title,
                                    summary: scene.summary
                                }
                            });

                            for (const shot of scene.shots) {
                                await tx.shot.create({
                                    data: {
                                        sceneId: dbScene.id,
                                        index: shot.index,
                                        title: shot.title,
                                        description: shot.summary,
                                        type: 'novel_analysis',
                                        params: { sourceText: shot.text }
                                    }
                                });
                            }
                        }
                    }
                }
            });

            // Mark DONE
            await prisma.novelAnalysisJob.update({
                where: { id: job.id },
                data: {
                    status: 'DONE',
                    progress: { current: 100, total: 100, message: 'Analysis complete via Headless' }
                }
            });
            console.log(`✅ Job ${job.id} DONE.`);

        } catch (e: any) {
            console.error("❌ Job Failed", e);
            // Mark FAILED if we found a job
            // But if findFirst failed (db error), we retry loop.
            // If we had a job 'job' in scope... accessing it here is hard in this block structure unless var hoisted or let.
            // Simplified: console error and wait.
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

runWorker()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
