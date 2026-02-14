import * as readline from 'readline';
import { Readable } from 'stream';
import {
    AnalyzedProjectStructure,
    AnalyzedSeason,
    AnalyzedEpisode,
    AnalyzedScene,
    AnalyzedShot,
} from '@scu/shared-types';

/**
 * Stream-based Novel Parser
 * memory-efficient parsing for large novels (15M+ chars)
 */
export async function parseNovelStream(
    input: Readable,
    projectId: string
): Promise<AnalyzedProjectStructure> {
    const rl = readline.createInterface({
        input: input,
        crlfDelay: Infinity,
    });

    const seasons: AnalyzedSeason[] = [];
    let currentSeason: AnalyzedSeason | null = null;
    let currentEpisode: AnalyzedEpisode | null = null;
    let currentScene: AnalyzedScene | null = null;

    let seasonIndex = 0;
    let episodeIndex = 0;
    let sceneIndex = 0;
    let shotIndex = 0;

    // Regex Patterns
    const seasonPattern = /第\s*([一二三四五六七八九十0-9]+)\s*(季|卷|部)/;
    const episodePattern = /第\s*([一二三四五六七八九十0-9]+)\s*(章|回|集)/;

    const flushScene = () => {
        if (currentScene && currentScene.shots.length > 0) {
            if (!currentEpisode) ensureEpisode();
            currentEpisode!.scenes.push(currentScene);
        }
        currentScene = null;
        shotIndex = 0;
    };

    const flushEpisode = () => {
        if (currentEpisode && currentEpisode.scenes.length > 0) {
            if (!currentSeason) ensureSeason();
            currentSeason!.episodes.push(currentEpisode);
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
        const shot: AnalyzedShot = {
            index: shotIndex,
            title: `镜头 ${shotIndex}`,
            summary: text.slice(0, 50),
            text,
        };
        currentScene.shots.push(shot);
    };

    for await (const line of rl) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
            flushScene();
            continue;
        }

        const seasonMatch = trimmedLine.match(seasonPattern);
        if (seasonMatch) {
            flushScene();
            flushEpisode();
            flushSeason();

            seasonIndex += 1;
            currentSeason = {
                index: seasonIndex,
                title: trimmedLine,
                summary: '',
                episodes: [],
            };
            continue;
        }

        const episodeMatch = trimmedLine.match(episodePattern);
        if (episodeMatch) {
            flushScene();
            flushEpisode();
            ensureSeason();

            episodeIndex += 1;
            currentEpisode = {
                index: episodeIndex,
                title: trimmedLine,
                summary: '',
                scenes: [],
            };
            continue;
        }

        // Normal Text
        ensureEpisode();
        // Split sentences
        const sentences = trimmedLine.split(/(?<=[。！？!?])/);
        for (const sentence of sentences) {
            pushSentenceAsShot(sentence);
        }
    }

    // Final flush
    flushScene();
    flushEpisode();
    flushSeason();

    // Fallback for no-structure novels
    if (seasons.length === 0) {
        // Logic for flat structure remains if needed, or return empty structure
        // For now, let's just return what we have (even if empty, consistent with old logic edge case)
        // If absolutely no structure found, creating a default one is handled by caller or basic fallback logic
        // But here we mimic basic: if text exists but no structure?
        // Since stream is consumed, verify if we pushed anything.
    }

    // Calculate Stats
    let seasonsCount = seasons.length;
    let episodesCount = 0;
    let scenesCount = 0;
    let shotsCount = 0;

    for (const s of seasons) {
        episodesCount += s.episodes.length;
        for (const e of s.episodes) {
            scenesCount += e.scenes.length;
            for (const sc of e.scenes) {
                shotsCount += sc.shots.length;
            }
        }
    }

    return {
        projectId,
        seasons,
        stats: {
            seasonsCount,
            episodesCount,
            scenesCount,
            shotsCount,
        },
    };
}
