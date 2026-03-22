import { ControlNetMapper } from './controlnet_mapper';

const validBindings = {
  ref_char_1: 'assets/characters/hero_base.png',
  dyn_pose: '_dynamic/poses/pose_001.png',
};

const invalidBindingsValues = {
  bad_abs: '/etc/passwd',
  bad_protocol: 'https://example.com/evil.png',
  bad_dots: 'assets/../secret.txt',
  bad_drive: 'C:\\Windows\\System32',
  bad_prefix: 'downloads/image.png',
};

async function test() {
  let failed = false;

  try {
    const resolved = ControlNetMapper.resolveBinding('binding:ref_char_1', validBindings);
    if (resolved !== 'assets/characters/hero_base.png') {
      throw new Error(`Expected assets/characters/hero_base.png, got ${resolved}`);
    }
  } catch {
    failed = true;
  }

  try {
    ControlNetMapper.resolveBinding('assets/prop.png', {});
  } catch {
    failed = true;
  }

  try {
    ControlNetMapper.resolveBinding('/etc/passwd', {});
    failed = true;
  } catch (e: any) {
    if (!e.message.includes('Invalid (Blacklisted) Path')) {
      failed = true;
    }
  }

  for (const [key, val] of Object.entries(invalidBindingsValues)) {
    try {
      const bindings = { [key]: val };
      ControlNetMapper.resolveBinding(`binding:${key}`, bindings);
      failed = true;
    } catch (e: any) {
      if (!e.message.includes('Resolved path invalid')) {
        failed = true;
      }
    }
  }

  try {
    ControlNetMapper.resolveBinding('binding:missing_key', validBindings);
    failed = true;
  } catch (e: any) {
    if (!e.message.includes('Binding key not found')) {
      failed = true;
    }
  }

  if (failed) {
    throw new Error('C1 ControlNet mapper verification failed');
  }
}

test();
