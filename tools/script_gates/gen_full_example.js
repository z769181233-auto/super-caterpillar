const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../../docs/script_spec/examples/full_episode_0001.shot.json');

const beats = [];
const TOTAL_SHOTS = 150; // Meets 140-260 range
const BEAT_COUNT = 15;
const SHOTS_PER_BEAT = 10;
// B1.1-1: Duration for Density (150 shots / 6 min = 25 shots/min approx)
// Fast Pace (40-70) vs Normal (20-35).
// Let's set duration to 400s (6.66 min). 150/6.66 = 22.5.
// If Pace is "常", Range 20-35. Fits.
const DURATION_SEC = 400;

for (let i = 0; i < BEAT_COUNT; i++) {
    const isReversal = (i % 5 === 0); // 0(T), 5(T), 10(T) -> 3 reversals
    // Climax Logic: Must have 1 Big, >=4 Small.
    // Big: 14.
    // Small: Need 4. Let's place at 2, 5, 8, 11 (conflict with reversal at 5? SSOT allows both? Schema separate tags. OK.)
    // Or just 1, 4, 7, 10, 13.
    // Let's rely on simple list: [3, 6, 9, 12] -> 4 Smalls.
    const isSmallClimax = [3, 6, 9, 12].includes(i);
    const climax = (i === 14) ? 'Big' : (isSmallClimax ? 'Small' : null);

    // B1.1-2: Evidence
    const revEvid = isReversal ? {
        entryPose: "站立",
        exitPose: "跪地",
        turnActionShotId: `s_${i}_0`
    } : undefined;

    const cliEvid = climax ? {
        triggerShotId: `s_${i}_0`,
        propInvolved: "激光枪",
        payoff: "爆炸"
    } : undefined;

    const beat = {
        id: `beat_${i}`,
        paceTag: "常", // Changed to Normal to fit 22.5 density
        beatGoal: "让敌人退缩", // Strong verb check
        sfxLines: ["爆炸声"],
        thirdActorProp: "激光枪",
        transitionTag: "动作匹配", // Valid Enum
        reversalTag: isReversal,
        reversalEvidence: revEvid,
        climaxTag: climax || null,
        climaxEvidence: cliEvid,
        shotLines: []
    };

    for (let j = 0; j < SHOTS_PER_BEAT; j++) {
        beat.shotLines.push({
            id: `s_${i}_${j}`,
            framing: "特写",
            subject: "Hero",
            actionChain: "Hero举枪(起势)，瞄准敌人(过程)，扣动扳机(落点)，后坐力震手(反应)。",
            parallelTask: "调整呼吸",
            dialogue: "去死吧！",
            usesProp: true // B1.1-3
        });
    }
    beats.push(beat);
}

const content = {
    episodeMeta: { durationSec: DURATION_SEC },
    beats: beats
};

fs.writeFileSync(target, JSON.stringify(content, null, 2));
console.log(`Generated ${target} with ${TOTAL_SHOTS} shots.`);
