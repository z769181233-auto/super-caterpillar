import { ControlNetMapper } from './controlnet_mapper';

console.log('=== C1 ControlNet Mapper Binding Resolution Test ===');

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

  // 1. Test VALID resolution
  try {
    const resolved = ControlNetMapper.resolveBinding('binding:ref_char_1', validBindings);
    if (resolved !== 'assets/characters/hero_base.png') {
      throw new Error(`Expected assets/characters/hero_base.png, got ${resolved}`);
    }
    console.log('✅ Valid binding resolution passed.');
  } catch (e) {
    console.error('❌ Valid binding test FAILED:', e);
    failed = true;
  }

  // 2. Test DIRECT path (VALID)
  try {
    const resolved = ControlNetMapper.resolveBinding('assets/prop.png', {});
    console.log('✅ Valid direct path passed.');
  } catch (e) {
    console.error('❌ Valid direct path test FAILED:', e);
    failed = true;
  }

  // 3. Test DIRECT path (INVALID)
  try {
    ControlNetMapper.resolveBinding('/etc/passwd', {});
    console.error('❌ Invalid direct path FAILED (Should have thrown)');
    failed = true;
  } catch (e: any) {
    if (e.message.includes('Invalid (Blacklisted) Path')) {
      console.log('✅ Invalid direct path correctly rejected.');
    } else {
      console.error('❌ Invalid direct path threw wrong error:', e.message);
      failed = true;
    }
  }

  // 4. Test INVALID Binding Values (Injection Attack Simulation)
  for (const [key, val] of Object.entries(invalidBindingsValues)) {
    try {
      const bindings = { [key]: val };
      ControlNetMapper.resolveBinding(`binding:${key}`, bindings);
      console.error(`❌ Binding value check FAILED for ${key} (Should have thrown)`);
      failed = true;
    } catch (e: any) {
      if (e.message.includes('Resolved path invalid')) {
        console.log(`✅ Binding value check passed for ${key} (Rejected)`);
      } else {
        console.error(`❌ Binding value check for ${key} threw wrong error:`, e.message);
        failed = true;
      }
    }
  }

  // 5. Test Missing Binding
  try {
    ControlNetMapper.resolveBinding('binding:missing_key', validBindings);
    console.error('❌ Missing binding check FAILED (Should have thrown)');
    failed = true;
  } catch (e: any) {
    if (e.message.includes('Binding key not found')) {
      console.log('✅ Missing binding check passed.');
    } else {
      console.error('❌ Missing binding check threw wrong error:', e.message);
      failed = true;
    }
  }

  if (failed) {
    console.error('\n❌ TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED');
    process.exit(0);
  }
}

test();
