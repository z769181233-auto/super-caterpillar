import Link from 'next/link';
import { CreateProjectForm } from '../components/create-project-form';
import { getProjects } from '../lib/api';
import { normalizeProjectSnapshot } from '../lib/normalize';
import type { ProjectSnapshot } from '../lib/types';

export default async function HomePage() {
  const projects = (await getProjects<ProjectSnapshot[]>()).map(normalizeProjectSnapshot);
  const latestProject = projects[0];
  const recentProjects = projects.slice(0, 3);

  return (
    <main className="home-container">
      {/* Background Decor - Subtle highlights */}
      <div className="bg-glow-1" />
      <div className="bg-glow-2" />

      <section className="hero-section">
        <header className="home-header">
          <div className="brand">
            <div className="brand-dot" />
            <span className="brand-name">SUPER CATERPILLAR</span>
          </div>
          {latestProject && (
            <Link href={`/projects/${latestProject.project.id}`} className="nav-link glass-card">
              进入工作台
            </Link>
          )}
        </header>

        <div className="hero-content">
          <h1 className="title-xl text-gradient">
            剧本创作<br />
            即刻进入工业级链路
          </h1>
          <p className="hero-subtitle">
            从小说原著到视频出片，每一个环节都经过 AI 重塑。<br />
            极简、高效、专为导演设计的创作中台。
          </p>

          <div className="hero-actions">
            {latestProject ? (
              <Link href={`/projects/${latestProject.project.id}`} className="btn-primary">
                继续创作：{latestProject.project.name}
              </Link>
            ) : (
              <a href="#new-project" className="btn-primary">开始创建项目</a>
            )}
            <a href="#new-project" className="btn-secondary glass-card">新建项目</a>
          </div>
        </div>
      </section>

      <section className="projects-section">
        <div className="grid-container">
          <div className="recent-list">
            <h2 className="section-label">最近工作台</h2>
            <div className="project-grid">
              {recentProjects.length === 0 ? (
                <div className="empty-state glass-card">
                  还没有项目，立即开启你的第一部动画大作。
                </div>
              ) : (
                recentProjects.map((snapshot) => (
                  <Link 
                    key={snapshot.project.id} 
                    href={`/projects/${snapshot.project.id}`} 
                    className="project-tile glass-card"
                  >
                    <div className="project-tile-info">
                      <h3 className="project-tile-name">{snapshot.project.name}</h3>
                      <p className="project-tile-desc">{snapshot.project.description || '继续导演工作台的创作'}</p>
                    </div>
                    <div className="project-tile-status">
                      {formatStageLabel(snapshot.project.stage)}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div id="new-project" className="create-area">
            <h2 className="section-label">新制作项目</h2>
            <div className="glass-panel create-card">
              <CreateProjectForm />
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .home-container {
          min-height: 100vh;
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 40px 120px;
          position: relative;
        }

        .hero-section {
          min-height: 85vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 40px 0 80px;
        }

        .home-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 60px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 20px var(--accent-glow);
        }

        .brand-name {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.2em;
          color: var(--text-main);
        }

        .nav-link {
          padding: 8px 18px;
          border-radius: var(--radius-full);
          font-size: 13px;
          font-weight: 600;
        }

        .hero-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          max-width: 900px;
        }

        .hero-subtitle {
          margin: 32px 0 48px;
          font-size: 18px;
          line-height: 1.8;
          color: var(--text-subtle);
          max-width: 600px;
        }

        .hero-actions {
          display: flex;
          gap: 16px;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
          color: #000;
          padding: 18px 36px;
          border-radius: var(--radius-full);
          font-weight: 800;
          font-size: 16px;
          box-shadow: 0 16px 40px rgba(0, 210, 255, 0.2);
          transition: var(--transition-normal);
        }

        .btn-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 24px 60px rgba(0, 210, 255, 0.3);
        }

        .btn-secondary {
          padding: 18px 36px;
          border-radius: var(--radius-full);
          font-weight: 700;
          font-size: 16px;
        }

        .projects-section {
          margin-top: 40px;
        }

        .grid-container {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 40px;
        }

        .section-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--text-muted);
          margin-bottom: 24px;
        }

        .project-grid {
          display: grid;
          gap: 20px;
        }

        .project-tile {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          border-radius: var(--radius-md);
        }

        .project-tile-name {
          margin: 0 0 4px;
          font-size: 20px;
          font-weight: 700;
        }

        .project-tile-desc {
          margin: 0;
          font-size: 14px;
          color: var(--text-subtle);
        }

        .project-tile-status {
          padding: 6px 14px;
          border-radius: var(--radius-full);
          background: rgba(255,255,255, 0.05);
          border: 1px solid var(--glass-border);
          font-size: 12px;
          font-weight: 700;
          color: var(--accent);
        }

        .create-card {
          padding: 32px;
          border-radius: var(--radius-lg);
        }

        .empty-state {
          padding: 60px;
          text-align: center;
          color: var(--text-muted);
          border-radius: var(--radius-md);
          font-style: italic;
        }

        /* Bg Decor */
        .bg-glow-1 {
          position: fixed;
          top: -10%;
          left: -5%;
          width: 40%;
          height: 40%;
          background: radial-gradient(circle, rgba(0, 210, 255, 0.05) 0%, transparent 70%);
          pointer-events: none;
        }
        .bg-glow-2 {
          position: fixed;
          bottom: 10%;
          right: -5%;
          width: 50%;
          height: 50%;
          background: radial-gradient(circle, rgba(138, 112, 255, 0.05) 0%, transparent 70%);
          pointer-events: none;
        }

        @media (max-width: 1024px) {
          .grid-container {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function formatStageLabel(stage: string) {
  const stageMap: Record<string, string> = {
    created: '已创建',
    'project created': '已创建',
    novel_imported: '原著已导入',
    analysis_ready: '分析已完成',
    package_generated: '整包已生成',
    preview_prepared: '预演已准备',
    render_queued: '出片队列中',
    reviewed: '已审校',
    render_completed: '已完成出片',
    'render completed': '已完成出片'
  };

  return stageMap[stage] || stage.replace(/_/g, ' ');
}

