// app/dashboard/loading.jsx
export default function Loading() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ height: 28, width: 200, borderRadius: 6, background: "var(--color-background-secondary)", marginBottom: 8 }} />
      <div style={{ height: 16, width: 140, borderRadius: 6, background: "var(--color-background-secondary)", marginBottom: 24 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ height: 64, borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 12 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: 140, borderRadius: "var(--border-radius-lg)", background: "var(--color-background-secondary)" }} />
        ))}
      </div>
    </main>
  );
}