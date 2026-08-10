export default function HomePage() {
  return (
    <main style={{
      padding: 60,
      maxWidth: 800,
      margin: "0 auto",
      textAlign: "center"
      }}>
      
      
  
      <h1 style={{ fontSize: 42, marginBottom: 12 }}>
CareClock
</h1>

  
<p style={{ opacity: 0.8, fontSize: 18, marginBottom: 20 }}>
GPS-verified time tracking that replaces paper timesheets for home care agencies.
</p>

  
  <p style={{ opacity: 0.7, maxWidth: 600, lineHeight: 1.6 }}>
  CareClock replaces paper timesheets with GPS-verified clock-in, 
  automatic hour tracking, and downloadable payroll-ready PDF timesheets.
  </p>

  <ul style={{
marginTop: 20,
marginBottom: 30,
listStyle: "none",
padding: 0,
opacity: 0.85
}}>
<li>✔ GPS-verified clock-in</li>
<li>✔ Automatic hour calculation</li>
<li>✔ Payroll-ready PDF timesheets</li>
</ul>

  <div style={{ marginTop: 30 }}>
  <a
href="/employee/clock"
style={{
padding: "14px 26px",
background: "#16a34a",
color: "white",
borderRadius: 8,
textDecoration: "none",
fontWeight: 600,
fontSize: 16
}}
>
Open Employee Clock
</a>

  </div>
  
  </main>
  );
  }
  