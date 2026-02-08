'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          backgroundColor: '#f9fafb',
          color: '#111827',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              height: '48px',
              width: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              background: 'linear-gradient(to bottom right, #1a6aff, #00008b)',
              fontSize: '18px',
              fontWeight: 700,
              color: '#fff',
            }}
          >
            A
          </div>
          <div>
            <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700 }}>
              Something went wrong
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              A critical error occurred. Please try again.
            </p>
          </div>
          <button
            onClick={reset}
            style={{
              border: 'none',
              borderRadius: '8px',
              background: 'linear-gradient(to right, #1a6aff, #00008b)',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
