import { useEffect, useState } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Card } from '@astryxdesign/core/Card';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Badge } from '@astryxdesign/core/Badge';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@astryxdesign/core/Link';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { VStack } from '@astryxdesign/core/VStack';

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

const Lines = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...p}><path d="M4 6h16M4 12h16M4 18h10" /></svg>;
const Logo = () => <HStack gap={0.5} aria-hidden="true">{SIDES.map((b) => <span key={b} className={`swatch ${b}`} style={{ width: 5, height: 14, margin: 0 }} />)}</HStack>;
const TABS = [
  { id: 'all', label: 'Top stories', icon: Lines },
  { id: 'L', label: 'Missed by the left', icon: 'eyeSlash' },
  { id: 'R', label: 'Missed by the right', icon: 'eyeSlash' },
];

function Story({ s }) {
  const miss = blindspot(s);
  return (
    <Card padding={0}>
      <Collapsible defaultIsOpen={false} style={{ padding: '16px 20px' }} trigger={
        <div className="story-head">
          <VStack gap={1}>
            <Heading level={4} accessibilityLevel={2} weight="medium">{s.title}</Heading>
            <HStack gap={3} align="center" wrap="wrap">
              <Text type="supporting">{s.articles.length} sources</Text>
              <Text type="supporting">{ago(s.time)}</Text>
              {miss && <Badge variant="yellow" label={`Blindspot: ${NAMES[miss].toLowerCase()}`} />}
            </HStack>
          </VStack>
          <div role="img" aria-label={`Coverage: ${s.counts.L} left, ${s.counts.C} center, ${s.counts.R} right`}>
            <div className="counts">
              {SIDES.map((b) => <Text key={b} type="supporting" hasTabularNumbers><span className={`swatch ${b}`} />{NAMES[b]} {s.counts[b]}</Text>)}
            </div>
            <div className="bar">
              {SIDES.filter((b) => s.counts[b]).map((b) => <span key={b} className={b} style={{ flex: s.counts[b] }} />)}
            </div>
          </div>
        </div>
      }>
        <ul className="articles">
          {[...s.articles].sort((a, b) => SIDES.indexOf(a.bias) - SIDES.indexOf(b.bias)).map((a) => (
            <li key={a.link}>
              <span className={`swatch ${a.bias}`} title={NAMES[a.bias]} />
              <Text type="supporting" maxLines={1}>{a.source}</Text>
              <Link href={a.link} isExternalLink color="primary" maxLines={1}>{a.title}</Link>
            </li>
          ))}
        </ul>
      </Collapsible>
    </Card>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('api/stories').then((r) => r.json()).then(setData).catch(() => setError(true));
    const onKey = (e) => {
      if (e.key === '/' && !e.target.matches('input')) { e.preventDefault(); document.querySelector('input[type=search]')?.focus(); }
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
  const stats = [['Stories', stories.length], ['Outlets', data?.sources], ['Blindspots', count('L') + count('R')]];

  const sideNav = (
    <SideNav
      header={<SideNavHeading heading="Spectra" icon={<Logo />} />}
      topContent={<TextInput type="search" label="Search stories" isLabelHidden placeholder="Search  ( / )" startIcon="search" value={q} onChange={setQ} />}
      footer={<Text type="supporting" as="p">Bias labels are rough groupings of each outlet, not a judgment of any single article.</Text>}
    >
      <SideNavSection title="Views">
        {TABS.map((t) => (
          <SideNavItem key={t.id} label={t.label} icon={t.icon} isSelected={tab === t.id} onClick={() => setTab(t.id)}
            endContent={data && <Text type="supporting" hasTabularNumbers>{count(t.id)}</Text>} />
        ))}
      </SideNavSection>
    </SideNav>
  );

  return (
    <AppShell sideNav={sideNav} height="auto" contentPadding={8}>
      <VStack gap={6}>
        <HStack justify="between" align="end" gap={4} wrap="wrap">
          <Heading level={1}>Coverage by outlet bias</Heading>
          <Text type="supporting" role="status">{status}</Text>
        </HStack>
        <Grid columns={{ minWidth: 180, repeat: 'fit' }} gap={4} aria-label="Summary">
          {stats.map(([label, n]) => (
            <Card key={label}>
              <VStack gap={2}>
                <Text type="label" color="secondary">{label}</Text>
                <Text type="display-3" hasTabularNumbers>{data ? n : '–'}</Text>
              </VStack>
            </Card>
          ))}
        </Grid>
        <VStack gap={2} aria-label="Stories">
          {shown.map((s) => <Story key={s.articles[0].link} s={s} />)}
          {!shown.length && stories.length > 0 && <Text color="secondary">No stories match</Text>}
        </VStack>
      </VStack>
    </AppShell>
  );
}
