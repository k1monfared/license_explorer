import { useState, useEffect } from "react";

function App() {
  const [catalog, setCatalog] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch("licenses/index.json")
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(setCatalog)
      .catch(e => setErr(String(e)));
  }, []);

  if (err) return <p style={{color: "#f87171"}}>Error: {err}</p>;
  if (!catalog) return <p>Loading...</p>;
  if (catalog.length === 0) return <p>No licenses yet. Add one via <code>/add-license</code>.</p>;
  return <p>Loaded {catalog.length} license(s). Browse UI coming next.</p>;
}

export default App;
