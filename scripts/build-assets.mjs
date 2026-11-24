// Builds the static README pieces (contact buttons, project cards, stack cards, tagline, section icons)
// in light and dark versions. Icons: Simple Icons (CC0) and Lucide (ISC), fetched at build time.
// Run once after editing the content below: node scripts/build-assets.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const SIMPLE = (slug) => `https://cdn.jsdelivr.net/npm/simple-icons@9.21.0/icons/${slug}.svg`;
const LUCIDE = (name) => `https://cdn.jsdelivr.net/npm/lucide-static@0.460.0/icons/${name}.svg`;
const FONT = "Nunito,'Segoe UI',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif";

const THEMES = {
  light: {
    card: '#FFFFFF', border: '#E3E7EE', text: '#0E1016', muted: '#6B7280', tile: '#F6F8FB', orange: '#FE853A',
    peach: '#FFF3EC', peachBorder: '#FFE4D3', orangeText: '#B8531A',
    green: ['#E9F9F0', '#157F45'], blue: ['#EAF1FF', '#3B5BDB'],
  },
  dark: {
    card: '#14171F', border: '#272D3A', text: '#F3F5FB', muted: '#9AA3B2', tile: '#1B1F29', orange: '#FF8C44',
    peach: '#2A1D15', peachBorder: '#4A2F1F', orangeText: '#FFB98A',
    green: ['#13281D', '#4FD18B'], blue: ['#172036', '#7C9BFF'],
  },
};

// Brand logos: [simple-icons slug, brand color]. Very dark brand colors switch to the text color in dark mode.
const BRANDS = {
  'React Native': ['react', '#61DAFB'], React: ['react', '#61DAFB'], Expo: ['expo', '#000020'],
  TypeScript: ['typescript', '#3178C6'], Android: ['android', '#34A853'], Supabase: ['supabase', '#3FCF8E'],
  PostgreSQL: ['postgresql', '#4169E1'], SQLite: ['sqlite', '#003B57'], Astro: ['astro', '#BC52EE'],
  'Tailwind CSS': ['tailwindcss', '#06B6D4'], JavaScript: ['javascript', '#F7DF1E'], HTML: ['html5', '#E34F26'],
  CSS: ['css3', '#1572B6'], Netlify: ['netlify', '#00C7B7'], Vercel: ['vercel', '#000000'],
  AutoCAD: ['autodesk', '#0696D7'], SolidWorks: ['dassaultsystemes', '#005386'],
  YouTube: ['youtube', '#FF0000'], LinkedIn: ['linkedin', '#0A66C2'], Discord: ['discord', '#5865F2'], Email: ['gmail', '#EA4335'],
};
// Tools without a Simple Icons logo use a Lucide line icon instead.
const LINE_ICONS = { NativeWind: 'wind', Remotion: 'clapperboard', Portfolio: 'globe' };

const CONTACTS = [
  ['Portfolio', 'https://tofenportfolio.netlify.app/'],
  ['YouTube', 'https://www.youtube.com/@itofen'],
  ['LinkedIn', 'https://www.linkedin.com/in/kevin-martinez-310bb73a2/'],
  ['Discord', 'https://discordapp.com/users/Tofen'],
  ['Email', 'mailto:richtofenmartinez200@gmail.com'],
];

const PROJECTS = [
  {
    file: 'tofen-erp', icon: 'store', title: 'Tofen ERP', meta: 'Android · Web', status: 'Live',
    lines: ['Business app for appointments, credit and', 'payments, finances, repairs with photos, PDF', 'receipts, thermal printing and offline mode.'],
    tech: ['Expo', 'React Native', 'Supabase', 'TypeScript'],
  },
  {
    file: 'calculanica', icon: 'calculator', title: 'CalculaNica', meta: 'Web', status: 'Live',
    lines: ['Free labor calculators for Nicaragua:', 'net salary (INSS + IR) and aguinaldo.'],
    tech: ['Astro'],
  },
  {
    file: 'youtube-site', icon: 'clapperboard', title: 'Tofen on YouTube', meta: 'Web', status: 'Live',
    lines: ['The website for my YouTube channel,', '@itofen.'],
    tech: ['Astro', 'TypeScript'],
  },
  {
    file: 'custom-systems', icon: 'blocks', title: 'Custom systems', meta: 'Mobile · Web', status: 'Private',
    lines: ['Tools built to fit how each client’s', 'business actually runs.'],
    tech: ['React Native', 'Expo', 'React', 'Supabase', 'SQLite'],
  },
];

const STACK = [
  { file: 'mobile', label: 'MOBILE', items: ['React Native', 'Expo', 'TypeScript', 'NativeWind', 'Android'] },
  { file: 'backend', label: 'BACKEND AND DATA', items: ['Supabase', 'PostgreSQL', 'SQLite'] },
  { file: 'web', label: 'WEB', items: ['React', 'Astro', 'Tailwind CSS', 'JavaScript', 'HTML', 'CSS'] },
  { file: 'more', label: 'SHIPPING, VIDEO AND CAD', items: ['Netlify', 'Vercel', 'Remotion', 'AutoCAD', 'SolidWorks'] },
];

const TAGLINES = ['Mobile apps with React Native and Expo', 'Backends and data on Supabase', 'Fast websites with Astro', 'Made in Nicaragua'];
const SECTION_ICONS = ['layers', 'activity', 'blocks'];

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textWidth = (s, size) => [...s].reduce((w, c) => w + (/[A-Z@]/.test(c) ? 0.66 : /[ .,·:]/.test(c) ? 0.3 : /[il1]/.test(c) ? 0.28 : 0.55), 0) * size;
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const svgDoc = (w, h, title, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>${extra}
<g font-family="${FONT}">
${body}
</g>
</svg>
`;

const cache = new Map();
async function get(url) {
  if (!cache.has(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    cache.set(url, await res.text());
  }
  return cache.get(url);
}
async function brandPath(name) {
  const [slug] = BRANDS[name];
  const svg = await get(SIMPLE(slug));
  return svg.match(/<path d="([^"]+)"/)[1];
}
async function lineInner(name) {
  const svg = await get(LUCIDE(name));
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').replace(/<!--[\s\S]*?-->/g, '').trim();
}

// Draws a logo of `size` px at (x, y), in brand color (or a line icon in orange).
async function logo(name, x, y, size, t) {
  if (BRANDS[name]) {
    const color = BRANDS[name][1];
    const fill = t === THEMES.dark && luminance(color) < 0.12 ? t.text : color;
    return `<g transform="translate(${x} ${y}) scale(${size / 24})"><path d="${await brandPath(name)}" fill="${fill}"/></g>`;
  }
  return lineIcon(LINE_ICONS[name], x, y, size, t.orange);
}
async function lineIcon(name, x, y, size, color, width = 1.75) {
  return `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${await lineInner(name)}</g>`;
}

// ---------- pieces ----------
async function contactButton(name, t) {
  const size = 13;
  const w = Math.round(14 + 16 + 8 + textWidth(name, size) + 16);
  const h = 36;
  const body = `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="10" fill="${t.card}" stroke="${t.border}"/>
${await logo(name, 14, 10, 16, t)}
<text x="38" y="23" font-size="${size}" font-weight="700" fill="${t.text}">${esc(name)}</text>`;
  return svgDoc(w, h, name, body);
}

function pill(label, x, y, [bg, fg], size = 11) {
  const w = textWidth(label, size) + 22;
  return {
    w,
    svg: `<rect x="${(x - w).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="20" rx="10" fill="${bg}"/>
<circle cx="${(x - w + 10).toFixed(1)}" cy="${y + 10}" r="3" fill="${fg}"/>
<text x="${(x - w + 17).toFixed(1)}" y="${y + 14}" font-size="${size}" font-weight="700" fill="${fg}">${esc(label)}</text>`,
  };
}

async function chipRow(items, x, y, maxX, t) {
  let cursor = x;
  const parts = [];
  for (const name of items) {
    const w = 8 + 12 + 6 + textWidth(name, 11) + 8;
    if (cursor + w > maxX) break;
    parts.push(`<rect x="${cursor.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="24" rx="7" fill="${t.tile}" stroke="${t.border}"/>
${await logo(name, cursor + 8, y + 6, 12, t)}
<text x="${(cursor + 26).toFixed(1)}" y="${y + 16}" font-size="11" font-weight="700" fill="${t.text}">${esc(name)}</text>`);
    cursor += w + 6;
  }
  return parts.join('\n');
}

async function projectCard(p, t) {
  const W = 400;
  const H = 196;
  const P = 22;
  const status = pill(p.status, W - P, 26, p.status === 'Live' ? t.green : t.blue);
  const desc = p.lines.map((l, i) => `<text x="${P}" y="${98 + i * 19}" font-size="13" font-weight="500" fill="${t.muted}">${esc(l)}</text>`).join('\n');
  const body = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.card}" stroke="${t.border}"/>
<rect x="${P}" y="22" width="40" height="40" rx="10" fill="${t.peach}" stroke="${t.peachBorder}"/>
${await lineIcon(p.icon, P + 10, 32, 20, t.orange)}
<text x="${P + 54}" y="39" font-size="16" font-weight="800" fill="${t.text}" letter-spacing="-.3">${esc(p.title)}</text>
<text x="${P + 54}" y="57" font-size="12" font-weight="600" fill="${t.muted}">${esc(p.meta)}</text>
${status.svg}
${desc}
${await chipRow(p.tech, P, H - 22 - 24, W - P, t)}`;
  return svgDoc(W, H, `${p.title}: ${p.lines.join(' ')}`, body);
}

async function stackCard(group, t) {
  const W = 400;
  const H = 142;
  const P = 22;
  const slot = (W - P * 2) / 6;
  const tiles = [];
  for (const [i, name] of group.items.entries()) {
    const cx = P + slot * i + slot / 2;
    tiles.push(`<rect x="${(cx - 22).toFixed(1)}" y="50" width="44" height="44" rx="11" fill="${t.tile}" stroke="${t.border}"/>
${await logo(name, cx - 12, 60, 24, t)}
<text x="${cx.toFixed(1)}" y="114" font-size="11" font-weight="700" fill="${t.muted}" text-anchor="middle">${esc(name)}</text>`);
  }
  const body = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.card}" stroke="${t.border}"/>
<text x="${P}" y="32" font-size="11" font-weight="800" fill="${t.muted}" letter-spacing="1.2">${esc(group.label)}</text>
${tiles.join('\n')}`;
  return svgDoc(W, H, `${group.label}: ${group.items.join(', ')}`, body);
}

function tagline(t) {
  const W = 460;
  const H = 34;
  const step = 3;
  const total = step * TAGLINES.length;
  const share = 100 / TAGLINES.length;
  const css = `<style>
.l{opacity:0;animation:cycle ${total}s infinite}
@keyframes cycle{0%{opacity:0;transform:translateY(6px)}3%{opacity:1;transform:translateY(0)}${(share - 3).toFixed(1)}%{opacity:1;transform:translateY(0)}${share.toFixed(1)}%{opacity:0;transform:translateY(-6px)}100%{opacity:0}}
${TAGLINES.map((_, i) => `.l${i}{animation-delay:${i * step}s}`).join('')}
@media (prefers-reduced-motion:reduce){.l{animation:none}.l0{opacity:1}}
</style>`;
  const lines = TAGLINES.map((s, i) => {
    const w = textWidth(s, 17);
    const x = (W - w) / 2;
    return `<g class="l l${i}"><circle cx="${(x - 12).toFixed(1)}" cy="17" r="4" fill="${t.orange}"/><text x="${W / 2}" y="23" font-size="17" font-weight="700" fill="${t.text}" text-anchor="middle">${esc(s)}</text></g>`;
  }).join('\n');
  return svgDoc(W, H, TAGLINES.join(' · '), lines, css);
}

// ---------- write ----------
const out = 'assets';
await mkdir(`${out}/buttons`, { recursive: true });
await mkdir(`${out}/projects`, { recursive: true });
await mkdir(`${out}/stack`, { recursive: true });
await mkdir(`${out}/icons`, { recursive: true });

for (const [mode, t] of Object.entries(THEMES)) {
  for (const [name] of CONTACTS) await writeFile(`${out}/buttons/${name.toLowerCase()}-${mode}.svg`, await contactButton(name, t));
  for (const p of PROJECTS) await writeFile(`${out}/projects/${p.file}-${mode}.svg`, await projectCard(p, t));
  for (const g of STACK) await writeFile(`${out}/stack/${g.file}-${mode}.svg`, await stackCard(g, t));
  await writeFile(`${out}/tagline-${mode}.svg`, tagline(t));
}
for (const name of SECTION_ICONS) {
  await writeFile(`${out}/icons/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${await lineIcon(name, 0, 0, 24, '#FE853A', 2)}</svg>\n`);
}
console.log('done');
