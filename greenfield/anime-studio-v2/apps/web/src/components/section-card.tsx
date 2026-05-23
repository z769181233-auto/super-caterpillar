import type { ReactNode } from 'react';

export function SectionCard({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: 22,
        borderRadius: 32,
        background:
          'radial-gradient(circle at top right, rgba(21,202,255,0.08), transparent 20%), linear-gradient(180deg, rgba(12,18,28,0.94), rgba(9,13,21,0.94))',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 28px 80px rgba(0,0,0,0.26)',
        backdropFilter: 'blur(18px)'
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.05), transparent 18%), radial-gradient(circle at 90% 0%, rgba(122,97,255,0.08), transparent 18%)'
        }}
      />

      <div style={{ position: 'relative', display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {eyebrow ? (
            <div style={{ color: '#87ddff', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              {eyebrow}
            </div>
          ) : null}
          <div style={{ display: 'grid', gap: 6 }}>
            <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.04, letterSpacing: '-0.05em' }}>{title}</h2>
            {description ? (
              <p style={{ margin: 0, color: 'var(--text-subtle)', fontSize: 14, lineHeight: 1.8 }}>{description}</p>
            ) : null}
          </div>
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}
