import { useEffect, useRef, useState } from 'react';

const NAMES = { L: 'Left', C: 'Center', R: 'Right' };
const SIDES = ['L', 'C', 'R'];
const ago = (t) => { const m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`; };

// A story is a blindspot for a side when that side has almost no coverage and the other side has plenty.
function blindspot(s) {
  const n = s.articles.length, { L, R } = s.counts;
  if (n < 4) return null;
  if (L / n <= 0.1 && R / n >= 0.4) return 'L';
  if (R / n <= 0.1 && L / n >= 0.4) return 'R';
  return null;
}

const Eye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><path d="m4 4 16 16" /></svg>
);
const TABS = [
  { id: 'all', label: 'Top stories', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg> },
  { id: 'L', label: 'Missed by the left', icon: <Eye /> },
  { id: 'R', label: 'Missed by the right', icon: <Eye /> },
];

function Story({ s }) {
  const miss = blindspot(s);
  return (
    <details>
      <summary>
        <div>
          <h2>{s.title}</h2>
          <div className="meta">
            <span>{s.articles.length} sources</span>
            <span>{ago(s.time)}</span>
            {miss && <span className="blind">Blindspot: {NAMES[miss].toLowerCase()}</span>}
          </div>
        </div>
        <div>
          <div className="counts" role="img" aria-label={`Coverage: ${s.counts.L} left, ${s.counts.C} center, ${s.counts.R} right`}>
            {SIDES.map((b) => <span key={b} className={b}>{NAMES[b]} {s.counts[b]}</span>)}
          </div>
          <div className="bar">
            {SIDES.filter((b) => s.counts[b]).map((b) => <span key={b} className={b} style={{ flex: s.counts[b] }} />)}
          </div>
        </div>
      </summary>
      <ul>
        {[...s.articles].sort((a, b) => SIDES.indexOf(a.bias) - SIDES.indexOf(b.bias)).map((a) => (
          <li key={a.link}>
            <span className={`dot ${a.bias}`} title={NAMES[a.bias]} />
            <span className="src">{a.source}</span>
            <a href={a.link} target="_blank" rel="noopener noreferrer">{a.title}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const search = useRef(null);

  useEffect(() => {
    fetch('api/stories').then((r) => r.json()).then(setData).catch(() => setError(true));
    const onKey = (e) => {
      if (e.key === '/' && !e.target.matches('input')) { e.preventDefault(); search.current.focus(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const stories = data?.stories ?? [];
  const count = (side) => (side === 'all' ? stories.length : stories.filter((s) => blindspot(s) === side).length);
  const needle = q.trim().toLowerCase();
  const shown = stories.filter((s) => (tab === 'all' || blindspot(s) === tab) &&
    (!needle || s.articles.some((a) => (a.title + ' ' + a.source).toLowerCase().includes(needle))));
  const status = error ? 'Could not load stories' : data ? `Updated ${ago(data.updated)}` : 'Loading outlets';

  return (
    <div className="app">
      <aside>
        <div className="logo"><i><b /><b /><b /></i>Spectra</div>
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#85858b" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input ref={search} type="search" placeholder="Search" aria-label="Search stories" value={q} onChange={(e) => setQ(e.target.value)} />
          <kbd>/</kbd>
        </div>
        <div className="nav-label">Views</div>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
              {t.icon}{t.label} <span className="n">{data && count(t.id)}</span>
            </button>
          ))}
        </nav>
        <p className="note">Bias labels are rough groupings of each outlet, not a judgment of any single article.</p>
      </aside>
      <main>
        <header>
          <h1>Coverage by outlet bias</h1>
          <span id="status" role="status">{status}</span>
        </header>
        <section className="stats" aria-label="Summary">
          <div className="stat"><span>Stories</span><b>{data ? stories.length : '–'}</b></div>
          <div className="stat"><span>Outlets</span><b>{data ? data.sources : '–'}</b></div>
          <div className="stat"><span>Blindspots</span><b>{data ? count('L') + count('R') : '–'}</b></div>
        </section>
        <section aria-label="Stories">
          {shown.map((s) => <Story key={s.articles[0].link} s={s} />)}
          {!shown.length && stories.length > 0 && <p className="empty">No stories match</p>}
        </section>
      </main>
    </div>
  );
}
