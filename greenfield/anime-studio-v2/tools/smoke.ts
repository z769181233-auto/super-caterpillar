import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../apps/api/src/app';

async function main() {
  process.env.ANIME_STUDIO_V2_REPOSITORY = 'memory';

  const app = createApp();
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    const project = await request(baseUrl, '/api/projects', {
      method: 'POST',
      body: {
        name: 'Smoke Project',
        description: 'Pipeline smoke validation'
      }
    });

    const projectId = project.project.id as string;
    assert.ok(projectId, 'project id should exist');

    const sourceFile = await request(baseUrl, `/api/projects/${projectId}/files`, {
      method: 'POST',
      body: {
        name: 'rainy-night.txt',
        kind: 'novel_source',
        mimeType: 'text/plain',
        contentBase64: Buffer.from(
          [
            '第一章 雨夜。林川在宗门广场听见禁地异响，却被师兄压下。',
            '第二章 夜查。林川与苏苒潜入藏书阁，发现旧卷记载与现实不符。',
            '第三章 对峙。长老在山门石阶拦下二人，警告他们不要继续追查。',
            '第四章 真相。雨夜长廊中，林川得知师父当年失踪与禁地封印有关。'
          ].join('\n\n'),
          'utf8'
        ).toString('base64')
      }
    });
    assert.equal(sourceFile.kind, 'novel_source', 'source file should be created');

    const assetFile = await request(baseUrl, `/api/projects/${projectId}/files`, {
      method: 'POST',
      body: {
        name: 'hero-ref.txt',
        kind: 'asset_attachment',
        mimeType: 'text/plain',
        contentBase64: Buffer.from('主角参考设定：青蓝主色，克制、冷静、少年感。', 'utf8').toString('base64')
      }
    });
    assert.equal(assetFile.kind, 'asset_attachment', 'asset attachment should be created');

    const asset = await request(baseUrl, `/api/projects/${projectId}/assets`, {
      method: 'POST',
      body: {
        name: '主角立绘设定',
        type: 'character_sheet',
        description: '统一主角造型与色彩表现',
        sourceFileId: assetFile.id,
        tags: ['主角', '设定']
      }
    });
    assert.equal(asset.type, 'character_sheet', 'asset should be created');

    const importJob = await request(baseUrl, `/api/projects/${projectId}/import-jobs`, {
      method: 'POST',
      body: {
        fileId: sourceFile.id,
        title: '雨夜真相'
      }
    });
    assert.equal(importJob.status, 'completed', 'import job should complete');

    const session = await request(baseUrl, `/api/projects/${projectId}/novel/upload-sessions`, {
      method: 'POST',
      body: {
        title: '雨夜真相',
        totalChunks: 2
      }
    });
    assert.equal(session.totalChunks, 2, 'upload session should be created');

    await request(baseUrl, `/api/upload-sessions/${session.id}/chunks`, {
      method: 'POST',
      body: {
        index: 0,
        content: [
          '第一章 雨夜。林川在宗门广场听见禁地异响，却被师兄压下。',
          '第二章 夜查。林川与苏苒潜入藏书阁，发现旧卷记载与现实不符。'
        ].join('\n\n')
      }
    });

    await request(baseUrl, `/api/upload-sessions/${session.id}/chunks`, {
      method: 'POST',
      body: {
        index: 1,
        content: [
          '第三章 对峙。长老在山门石阶拦下二人，警告他们不要继续追查。',
          '第四章 真相。雨夜长廊中，林川得知师父当年失踪与禁地封印有关。'
        ].join('\n\n')
      }
    });

    await request(baseUrl, `/api/upload-sessions/${session.id}/finalize`, {
      method: 'POST'
    });

    const episodePackage = await request(baseUrl, `/api/projects/${projectId}/pipeline/episode-package`, {
      method: 'POST',
      body: {
        episodeNo: 1,
        adaptationMode: 'faithful'
      }
    });

    assert.equal(episodePackage.outline.episodeNo, 1, 'episode number should match');
    assert.ok(Array.isArray(episodePackage.scenes) && episodePackage.scenes.length >= 4, 'scenes should be generated');
    assert.ok(Array.isArray(episodePackage.shots) && episodePackage.shots.length >= episodePackage.scenes.length * 3, 'shots should be generated');
    assert.ok(Array.isArray(episodePackage.issues), 'issues array should exist');

    const previewJob = await request(baseUrl, `/api/projects/${projectId}/preview-jobs`, {
      method: 'POST',
      body: {
        episodeNo: 1,
        provider: 'mock_storyboard'
      }
    });
    assert.equal(previewJob.status, 'prompt_ready', 'preview job should be prepared');

    const renderJob = await request(baseUrl, `/api/projects/${projectId}/render-jobs`, {
      method: 'POST',
      body: {
        episodeNo: 1,
        provider: 'mock_video',
        qualityPreset: 'preview'
      }
    });
    assert.equal(renderJob.status, 'completed', 'mock render job should complete');

    const projectSnapshot = await request(baseUrl, `/api/projects/${projectId}`, { method: 'GET' });
    assert.equal(projectSnapshot.project.stage, 'render_completed', 'project should be advanced to render_completed');
    assert.equal(projectSnapshot.episodeOutlines.length, 1, 'outline should be persisted');
    assert.equal(projectSnapshot.scenes.length, episodePackage.scenes.length, 'scene count should persist');
    assert.equal(projectSnapshot.shots.length, episodePackage.shots.length, 'shot count should persist');
    assert.ok(Array.isArray(projectSnapshot.versions) && projectSnapshot.versions.length >= 5, 'versions should be recorded');
    assert.equal(projectSnapshot.previewJobs.length, 1, 'preview job should persist');
    assert.equal(projectSnapshot.renderJobs.length, 1, 'render job should persist');
    assert.equal(projectSnapshot.assets.length, 1, 'asset should persist');
    assert.equal(projectSnapshot.storedFiles.length, 2, 'stored files should persist');
    assert.equal(projectSnapshot.importJobs.length, 1, 'import job should persist');
    assert.equal(projectSnapshot.uploadSessions.length, 1, 'upload session should persist');

    const versions = await request(baseUrl, `/api/projects/${projectId}/versions`, { method: 'GET' });
    assert.equal(versions.length, projectSnapshot.versions.length, 'versions endpoint should match project snapshot');
    const renderJobs = await request(baseUrl, `/api/projects/${projectId}/render-jobs`, { method: 'GET' });
    assert.equal(renderJobs.length, projectSnapshot.renderJobs.length, 'render jobs endpoint should match project snapshot');

    console.log(JSON.stringify({
      ok: true,
      projectId,
      scenes: projectSnapshot.scenes.length,
      shots: projectSnapshot.shots.length,
      issues: projectSnapshot.issues.length,
      versions: projectSnapshot.versions.length,
      previewJobs: projectSnapshot.previewJobs.length,
      renderJobs: projectSnapshot.renderJobs.length,
      assets: projectSnapshot.assets.length,
      storedFiles: projectSnapshot.storedFiles.length,
      importJobs: projectSnapshot.importJobs.length,
      uploadSessions: projectSnapshot.uploadSessions.length
    }));
  } finally {
    server.close();
  }
}

async function request(baseUrl: string, path: string, options: { method: string; body?: unknown }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  assert.ok(response.ok, `${options.method} ${path} failed with ${response.status}`);
  return response.json();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
