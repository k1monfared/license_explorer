import { useState, useEffect } from "react";

function parseRoute(hash) {
  const h = (hash || '').replace(/^#/, '');
  if (!h || h === '/') return { name: 'browse' };
  const m = h.match(/^\/license\/([a-z0-9][a-z0-9-]*)(?:\/(text))?$/);
  if (m) return m[2] ? { name: 'text', id: m[1] } : { name: 'detail', id: m[1] };
  const cm = h.match(/^\/compare(?:\?set=([a-z0-9,.-]+))?$/);
  if (cm) return { name: 'compare', ids: cm[1] ? cm[1].split(',').filter(Boolean) : [] };
  return { name: 'browse' };
}

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

function BrowseStub()   { return <p>Browse page (stub)</p>; }
function DetailStub({id}){ return <p>Detail page (stub) for <strong>{id}</strong></p>; }
function TextStub({id})  { return <p>Text page (stub) for <strong>{id}</strong></p>; }
function CompareStub({ids}){ return <p>Compare page (stub): {ids.join(', ') || '(none)'}</p>; }

function App() {
  const route = useRoute();
  if (route.name === 'detail')  return <DetailStub id={route.id}/>;
  if (route.name === 'text')    return <TextStub id={route.id}/>;
  if (route.name === 'compare') return <CompareStub ids={route.ids}/>;
  return <BrowseStub/>;
}

export default App;
