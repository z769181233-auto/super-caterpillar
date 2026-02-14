import * as http from 'http';

async function testComfy() {
  const prompt = {
    '3': {
      inputs: {
        seed: 42,
        steps: 20,
        cfg: 7,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
      class_type: 'KSampler',
    },
    '4': {
      inputs: {
        ckpt_name: 'v1-5-pruned-emaonly.safetensors',
      },
      class_type: 'CheckpointLoaderSimple',
    },
    '5': {
      inputs: {
        width: 512,
        height: 512,
        batch_size: 1,
      },
      class_type: 'EmptyLatentImage',
    },
    '6': {
      inputs: {
        text: 'A beautiful landscape',
        clip: ['10', 0],
      },
      class_type: 'CLIPTextEncode',
    },
    '7': {
      inputs: {
        text: 'low quality, blurry',
        clip: ['10', 0],
      },
      class_type: 'CLIPTextEncode',
    },
    '8': {
      inputs: {
        samples: ['3', 0],
        vae: ['4', 2],
      },
      class_type: 'VAEDecode',
    },
    '9': {
      inputs: {
        filename_prefix: 'test_render',
        images: ['8', 0],
      },
      class_type: 'SaveImage',
    },
    '10': {
      inputs: {
        clip_name: 'clip_l.safetensors',
        type: 'stable_diffusion',
      },
      class_type: 'CLIPLoader',
    },
  };

  const body = JSON.stringify({ prompt });
  const options = {
    hostname: '127.0.0.1',
    port: 8188,
    path: '/prompt',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      console.log('Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error('Error:', e);
  });

  req.write(body);
  req.end();
}

testComfy();
