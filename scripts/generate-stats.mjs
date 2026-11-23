// Generates the profile charts (assets/*.svg) from public GitHub data. No dependencies.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const LOGIN = 'Tofen5061';
// Totals per language from private repos (no repo names). The Action cannot read private
// repos, so refresh this locally with: SAVE_PRIVATE_LANGS=1 GITHUB_TOKEN=$(gh auth token) node scripts/generate-stats.mjs
const PRIVATE_LANGS = 'data/private-languages.json';
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error('GITHUB_TOKEN is required');

const THEMES = {
  light: {
    card: '#FFFFFF', border: '#E3E7EE', text: '#0E1016', muted: '#6B7280', track: '#EEF1F6',
    bar: '#FFD9C2', peak: '#FE853A', langs: ['#FE853A', '#3B5BDB', '#157F45', '#B8531A', '#9AA3B2'],
  },
  dark: {
    card: '#14171F', border: '#272D3A', text: '#F3F5FB', muted: '#9AA3B2', track: '#20242F',
    bar: '#5A3A28', peak: '#FF8C44', langs: ['#FF8C44', '#7C9BFF', '#4FD18B', '#FFB98A', '#6B7280'],
  },
};

const W = 400;
const H = 232;
const PAD = 24;
const FONT = "Nunito,'Segoe UI',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif";

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      nodes { isPrivate languages(first: 12, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } } }
    }
  }
}`;

async function fetchData() {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-stats' },
    body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
  });
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('; '));
  return data.user;
}

function summarizeActivity(calendar) {
  const days = calendar.weeks.flatMap((w) => w.contributionDays);
  const byMonth = new Map();
  let active = 0;
  let run = 0;
  let longest = 0;
  for (const { date, contributionCount: n } of days) {
    const key = date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + n);
    if (n > 0) {
      active += 1;
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  const months = [...byMonth].slice(-12).map(([key, count]) => ({
    label: new Date(`${key}-15T00:00:00Z`).toLocaleString('en', { month: 'short', timeZone: 'UTC' })[0],
    name: key,
    count,
  }));
  return { total: calendar.totalContributions, active, longest, months };
}

async function collectLanguages(repos) {
  const sizes = new Map();
  const hidden = new Map();
  for (const repo of repos) {
    const target = repo.isPrivate ? hidden : sizes;
    for (const { size, node } of repo.languages.edges) target.set(node.name, (target.get(node.name) ?? 0) + size);
  }
  let privateTotals;
  if (process.env.SAVE_PRIVATE_LANGS) {
    privateTotals = Object.fromEntries([...hidden].sort((a, b) => b[1] - a[1]));
    await mkdir('data', { recursive: true });
    await writeFile(PRIVATE_LANGS, `${JSON.stringify(privateTotals, null, 2)}\n`);
  } else {
    privateTotals = JSON.parse(await readFile(PRIVATE_LANGS, 'utf8'));
  }
  for (const [name, size] of Object.entries(privateTotals)) sizes.set(name, (sizes.get(name) ?? 0) + size);
  return sizes;
}

function summarizeLanguages(sizes) {
  const total = [...sizes.values()].reduce((a, b) => a + b, 0) || 1;
  const sorted = [...sizes].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 4).map(([name, size]) => ({ name, pct: (size / total) * 100 }));
  const rest = sorted.slice(4).reduce((a, [, size]) => a + size, 0);
  if (rest > 0) top.push({ name: 'Other', pct: (rest / total) * 100 });
  return top;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const text = (x, y, content, size, fill, weight = 500, extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(content)}</text>`;

function frame(t, title, desc, eyebrow, subtitle, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title><desc id="d">${esc(desc)}</desc>
<g font-family="${FONT}" style="font-variant-numeric:tabular-nums">
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="${t.card}" stroke="${t.border}"/>
${text(PAD, 34, eyebrow, 11, t.muted, 800, 'letter-spacing="1.2"')}
${text(W - PAD, 34, subtitle, 12, t.muted, 600, 'text-anchor="end"')}
${body}
</g>
</svg>
`;
}

function activitySvg(a, t) {
  const stats = [
    ['Contributions', a.total],
    ['Active days', a.active],
    ['Longest streak', `${a.longest} d`],
  ];
  const colW = (W - PAD * 2) / 3;
  const statMarks = stats
    .map(([label, value], i) => {
      const x = PAD + colW * i;
      return text(x, 76, value, 24, i === 0 ? t.peak : t.text, 800, 'letter-spacing="-.4"') + text(x, 95, label, 12, t.muted, 600);
    })
    .join('');

  const top = 116;
  const base = 192;
  const max = Math.max(...a.months.map((m) => m.count), 1);
  const slot = (W - PAD * 2) / a.months.length;
  const barW = Math.min(18, slot - 8);
  const bars = a.months
    .map((m, i) => {
      const x = PAD + slot * i + (slot - barW) / 2;
      const h = m.count ? Math.max(3, ((base - top) * m.count) / max) : 2;
      const fill = !m.count ? t.track : m.count === max ? t.peak : t.bar;
      return `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${fill}"><title>${m.name}: ${m.count}</title></rect>` +
        text((x + barW / 2).toFixed(1), base + 18, m.label, 11, t.muted, 600, 'text-anchor="middle"');
    })
    .join('');

  return frame(
    t,
    'GitHub activity, last 12 months',
    `${a.total} contributions, ${a.active} active days, longest streak ${a.longest} days.`,
    'ACTIVITY',
    'Last 12 months',
    statMarks + bars,
  );
}

function languagesSvg(langs, t) {
  const barW = W - PAD * 2;
  let cursor = PAD;
  const segments = langs
    .map((l, i) => {
      const w = (barW * l.pct) / 100;
      const seg = `<rect x="${cursor.toFixed(1)}" y="54" width="${Math.max(w - 2, 1).toFixed(1)}" height="8" fill="${t.langs[i]}"/>`;
      cursor += w;
      return seg;
    })
    .join('');
  const clip = `<clipPath id="r"><rect x="${PAD}" y="54" width="${barW}" height="8" rx="4"/></clipPath><g clip-path="url(#r)">${segments}</g>`;

  const rows = langs
    .map((l, i) => {
      const y = 92 + i * 27;
      const line = i < langs.length - 1 ? `<line x1="${PAD}" x2="${W - PAD}" y1="${y + 13.5}" y2="${y + 13.5}" stroke="${t.border}"/>` : '';
      return `<circle cx="${PAD + 4}" cy="${y - 4}" r="4" fill="${t.langs[i]}"/>` +
        text(PAD + 18, y, l.name, 13, t.text, 700) +
        text(W - PAD, y, `${l.pct.toFixed(1)}%`, 13, t.muted, 700, 'text-anchor="end"') + line;
    })
    .join('');

  return frame(
    t,
    'Languages across public and private projects',
    langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(', '),
    'LANGUAGES',
    'All projects',
    clip + rows,
  );
}

const user = await fetchData();
const activity = summarizeActivity(user.contributionsCollection.contributionCalendar);
const languages = summarizeLanguages(await collectLanguages(user.repositories.nodes));

await mkdir('assets', { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  await writeFile(`assets/activity-${name}.svg`, activitySvg(activity, theme));
  await writeFile(`assets/languages-${name}.svg`, languagesSvg(languages, theme));
}
console.log(JSON.stringify({ total: activity.total, active: activity.active, longest: activity.longest, languages }));
