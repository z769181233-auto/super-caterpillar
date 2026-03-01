const fs = require('fs');
const path = require('path');

function compile(storyPath) {
  const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'));

  // Strategy: Create 8 beats for a standard episode
  const totalDuration = story.episodeMeta.durationSec || 360;
  const beatCount = 8;
  const baseDuration = Math.floor(totalDuration / beatCount);

  const beats = [];

  // Beat 0: Introduction (from coreEvent)
  beats.push(
    createBeat('beat_0', '常', baseDuration, '引入冲突: ' + story.goal, '物件匹配', false, null, [
      '潜入',
      '观察',
      '开启',
    ])
  );

  // Beat 1-3: Obstacles
  story.obstacles.slice(0, 3).forEach((obs, i) => {
    beats.push(
      createBeat(
        `beat_${i + 1}`,
        '快',
        baseDuration,
        '对抗阻碍: ' + obs,
        '动作匹配',
        false,
        i === 2 ? 'Small' : null,
        ['冲刺', '躲避', '射击', '反击']
      )
    );
  });

  // Beat 4-6: Turns
  story.turns.forEach((turn, i) => {
    beats.push(
      createBeat(
        `beat_${i + 4}`,
        i % 2 === 0 ? '快' : '慢',
        baseDuration,
        '剧情转折: ' + turn,
        '光影匹配',
        true,
        i === 1 ? 'Big' : 'Small',
        ['翻转', '对峙', '博弈']
      )
    );
  });

  // Beat 7: Cliffhanger
  beats.push(
    createBeat(
      'beat_7',
      '慢',
      totalDuration - baseDuration * (beatCount - 1),
      '留下悬念: ' + story.cliffhanger,
      '声音匹配',
      false,
      'Small',
      ['告退', '消失', '回响']
    )
  );

  const skeleton = {
    episodeId: story.id,
    episodeMeta: {
      durationSec: totalDuration,
    },
    locations: story.locations || [],
    beats: beats,
  };

  return skeleton;
}

function createBeat(id, pace, duration, goal, trans, reversal, climax, motifs) {
  const beat = {
    id: id,
    paceTag: pace,
    estDurationSec: duration,
    beatGoal: goal,
    actionMotifs: motifs || [],
    sfxIds: [],
    thirdActorPropId: '',
    transitionTag: trans,
    reversalTag: reversal,
    climaxTag: climax,
    shotLines: [],
  };

  if (reversal) {
    beat.reversalEvidence = {
      entryPose: '[起势姿态]',
      exitPose: '[落点姿态]',
      turnActionShotId: id + '_S1',
    };
  }

  if (climax) {
    beat.climaxEvidence = {
      triggerShotId: id + '_S1',
      propInvolved: '[核心道具]',
      payoff: '[视觉奇观]',
    };
  }

  return beat;
}

const input = process.argv[2];
const output = process.argv[3] || 'skeleton.json';

if (!input) {
  console.error('Usage: node story_to_shot_skeleton.js <input.story.json> [output.shot.json]');
  process.exit(1);
}

const result = compile(input);
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(`Skeleton compiled to ${output}`);
