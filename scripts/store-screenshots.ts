/**
 * Store screenshots (2026-10-09, from the testers' report: show the
 * features, not generic phone images). Drives the installed Google Chrome
 * headless over the DevTools protocol (no extra packages), opens each
 * screen of the app at phone size, and saves 1080x1920 JPEGs
 * (Play's preferred 9:16, no alpha) with a caption band over the screen, in
 * store-screenshots/<lang>/.
 *
 *   npm run store-screenshots                    Google Play, English
 *   npm run store-screenshots -- --es            Google Play, Spanish
 *   npm run store-screenshots -- --apple [--es]  App Store sizes
 *
 * Google Play takes 1080x1920 (store-screenshots/<lang>/play). The App
 * Store takes only exact sizes per slot: 1284x2778 for "iPhone with Face
 * ID (large display)" (the slot App Store Connect required for this app on
 * 2026-10-09), 1320x2868 for "iPhone with Dynamic Island (large display)",
 * 1206x2622 for the Dynamic Island medium display. `--apple` makes only
 * 1320x2868, the "iPhone with Dynamic Island (large display)" slot Brian
 * uploads to (2026-10-13: one size, the same one every time, one set per
 * language); `--size=apple-6.5` / `apple-6.3` exist only if a slot ever
 * demands them. The app is
 * iPhone-only (no supportsTablet), so no iPad set is needed.
 *
 * Point it at the local web dev server (`npx expo start --web --port 8085`,
 * the default here, which reads production data): the live site's App
 * Check (reCAPTCHA v3) turns headless Chrome away, so there every screen
 * comes back empty. The dev server uses the registered debug token.
 *
 * Neutral on purpose: the alderman shot is the fictional ward 51 alderman
 * (never a real official's grade in a store image), and the ballot shots
 * (a race, My ballot) have no pick made (a picked real candidate would read
 * as an endorsement). The browser signs in to no one; the ballot planner
 * shows because the dev build stands in with City Hall's districts. Upload is by hand in Play Console / App Store Connect.
 */
import { spawn } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE = process.env.SHOTS_SITE ?? 'http://localhost:8085';
const PORT = 9333;
const spanish = process.argv.includes('--es');
/** Where the app keeps the chosen language (LOCALE_KEY in src/lib/i18n.tsx). */
const LOCALE_KEY = 'locale';
const lang = spanish ? 'es' : 'en';
/**
 * One store size: the final image, the app's viewport (points) and the
 * scale it is drawn at, and the caption band's height and type size.
 */
interface Preset {
  folder: string;
  out: { width: number; height: number };
  phone: { width: number; height: number };
  scale: number;
  caption: number;
  font: number;
}
const PRESETS: Record<string, Preset> = {
  play: { folder: 'play', out: { width: 1080, height: 1920 }, phone: { width: 390, height: 780 }, scale: 2, caption: 330, font: 66 },
  'apple-6.9': { folder: 'apple-1320x2868', out: { width: 1320, height: 2868 }, phone: { width: 390, height: 806 }, scale: 3, caption: 420, font: 80 },
  // The slot App Store Connect actually asked for on 2026-10-09: "iPhone
  // with Face ID (large display)", which takes only 1284x2778 or 1242x2688.
  'apple-6.5': { folder: 'apple-1284x2778', out: { width: 1284, height: 2778 }, phone: { width: 390, height: 808 }, scale: 2.9, caption: 405, font: 78 },
  'apple-6.3': { folder: 'apple-1206x2622', out: { width: 1206, height: 2622 }, phone: { width: 390, height: 786 }, scale: 2.8, caption: 390, font: 74 },
};
const only = process.argv.find((a) => a.startsWith('--size='))?.slice('--size='.length);
const presets = only
  ? [PRESETS[only]]
  : process.argv.includes('--apple')
    ? [PRESETS['apple-6.9']]
    : [PRESETS.play];
/** City Hall's districts (121 N LaSalle), from districtsForPoint, for the ballot shots. */
const CITY_HALL_DISTRICTS = {
  usHouse: 7,
  ilSenate: 3,
  ilHouse: 6,
  cookCommissioner: 2,
  boardOfReview: 3,
  subcircuit: 5,
  schoolBoard: '6b',
  police: 1,
};
/** The fictional test alderman (ward 51). */
const FICTIONAL_ALDERMAN = 'GM8UnlsrkRYYcEqi0lR0U5PRqs33';

interface Shot {
  name: string;
  path: string;
  caption: { en: string; es: string };
  /** Run in the page after load, e.g. to open a ward or scroll to a section. */
  prepare?: string;
}

// The numbers are the order in the store: the mayor games lead (2026-11-10,
// they are what the app is until February 23), then the rest of the app.
const SHOTS: Shot[] = [
  {
    name: '4-alderman',
    path: `/official/${FICTIONAL_ALDERMAN}`,
    caption: { en: 'Ask your alderman anything', es: 'Pregúntale lo que quieras a tu concejal' },
  },
  {
    name: '5-big-board',
    // A fresh load of "/" is a plain launch, which the app sends on to the
    // elections tab (src/lib/launch.ts): tap the home tab to get the board.
    path: '/',
    caption: { en: "Chicago's concerns, ranked by the people", es: 'Las preocupaciones de Chicago, ordenadas por la gente' },
    prepare: `
      const home = document.querySelector('[role=tab][href="/"]');
      if (home) home.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      await new Promise((r) => setTimeout(r, 5000));`,
  },
  {
    name: '2-blind-date',
    // Blind date keeps every name and portrait hidden until the reveal, so
    // the store image shows the game and no candidate's face.
    path: '/game/blind',
    caption: { en: 'Blind-date your next mayor', es: 'Una cita a ciegas con tu próximo alcalde' },
  },
  {
    name: '6-take-part',
    path: '/ward',
    caption: { en: 'Meetings, zoning and your ward office', es: 'Reuniones, zonificación y tu oficina de distrito' },
    prepare: `
      const cell = document.querySelector('[aria-label="11th Ward"], [aria-label="Distrito 11"]');
      cell && cell.click();
      await new Promise((r) => setTimeout(r, 4000));
      await new Promise((r) => setTimeout(r, 3000));
      const head = [...document.querySelectorAll('[role=heading], div')].find((d) => /^(take part|participa)$/i.test(d.innerText.trim()));
      let box = head && head.parentElement;
      while (box && !(box.scrollHeight > box.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      if (head && box) box.scrollTop += head.getBoundingClientRect().top - box.getBoundingClientRect().top - 24;`,
  },
  {
    name: '7-news',
    path: '/news',
    caption: { en: 'Chicago news in one place', es: 'Las noticias de Chicago en un solo lugar' },
    // The live feed is whatever happened today; a store image leaves out
    // crime, investigations, deaths, and stories naming a politician, so it
    // never looks like the app picked a side. Every row shown is real.
    prepare: `
      const risky = /candidate|probe|alleg|charg|shot|shoot|kill|murder|dies|died|death|dead|arrest|sue|lawsuit|police|ICE|Trump|Johnson|Pritzker|mayor|alderm|election|campaign|school board|board president|consejo escolar|candidat|alcald|concejal|eleccion|elección|crash|hit-and-run|impeach|secretary|congress|senat|stab|robb|carjack|victim|injur|wound|fatal|crime|gun|furious|fire\\b|missing|tip\\b|porn|abuse|assault|marine|sergeant|resting place|funeral|trial|guilty|sentenc|indict/i;
      const rows = [...document.querySelectorAll('[role=link]')].filter((a) => / ago|hace /.test(a.innerText));
      // The headline alone decides: the outlet's name ("CBS News Chicago")
      // must not make a national story count as local.
      const headline = (row) => row.innerText.split('\\n').filter(Boolean).slice(1).join(' ') || row.innerText;
      // ...and keeps to stories plainly about Chicago or Illinois (the feed
      // also carries national wire stories), since that is what it shows off.
      const local = /Chicago|CTA|Cubs|White Sox|Sox|Bears|Bulls|Blackhawks|Sky|Fire FC|Lake Michigan|Illinois|CPS|Loop|Bronzeville|Pilsen|Wicker Park|Logan Square|Hyde Park|Lincoln Park|Navy Pier|O'Hare|Midway|Cook County|Rate Field|Wrigley|Soldier Field|Shedd|Ryan Field/i;
      for (const row of rows) if (risky.test(headline(row)) || !local.test(headline(row))) row.remove();`,
  },
  {
    name: '1-mayor-games',
    path: '/election',
    caption: { en: 'Five games to meet the mayoral field', es: 'Cinco juegos para conocer a los candidatos' },
  },
  {
    name: '3-pizza-date',
    path: '/game/pizza',
    caption: { en: 'Every candidate, ranked by pizza', es: 'Cada candidato, en orden de pizza' },
  },
];

type Cdp = { send: (method: string, params?: Record<string, unknown>) => Promise<any> };

async function connect(): Promise<Cdp> {
  for (let i = 0; i < 50; i++) {
    try {
      const list = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
      const page = list.find((t) => t.type === 'page');
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          ws.onopen = resolve;
          ws.onerror = reject;
        });
        let id = 0;
        const pending = new Map<number, (v: any) => void>();
        ws.onmessage = (e) => {
          const msg = JSON.parse(String(e.data));
          if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)!(msg.error ? Promise.reject(new Error(msg.error.message)) : msg.result);
            pending.delete(msg.id);
          }
        };
        return {
          send: (method, params = {}) =>
            new Promise((resolve) => {
              id += 1;
              pending.set(id, resolve);
              ws.send(JSON.stringify({ id, method, params }));
            }),
        };
      }
    } catch {
      // Chrome is still starting.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Could not reach headless Chrome.');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function evaluate(cdp: Cdp, expression: string) {
  await cdp.send('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true });
}

/** Whether an expression is true in the page right now. */
async function isTrue(cdp: Cdp, expression: string): Promise<boolean> {
  const res = await cdp.send('Runtime.evaluate', { expression: `!!(${expression})`, returnByValue: true });
  return res?.result?.value === true;
}

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'dd-shots-'));
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--force-dark-mode',
    'about:blank',
  ]);
  try {
    const cdp = await connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { ...presets[0].phone, deviceScaleFactor: presets[0].scale, mobile: true });
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });

    // First visit: the welcome is marked seen and the language is set the
    // way the app stores it, so no first-run card covers the screens. (The
    // app has no language prompt to click any more: it opens in English.)
    await cdp.send('Page.navigate', { url: SITE });
    await sleep(6000);
    await evaluate(
      cdp,
      `localStorage.setItem('welcome.v2', 'seen');
       localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, ${JSON.stringify(spanish ? 'es' : 'en')});`
    );
    await cdp.send('Page.reload');
    await sleep(6000);
    // The police district grid waits for districts, and the browser is
    // signed in to no one: stand in with City Hall's (121 N LaSalle, 42nd
    // Ward), which the dev build reads (useMyDistricts).
    await evaluate(
      cdp,
      `localStorage.setItem('dev.shotDistricts', ${JSON.stringify(JSON.stringify(CITY_HALL_DISTRICTS))});
       localStorage.removeItem('mayorGames.blind.seen');`
    );

    for (const preset of presets) {
    const dir = join('store-screenshots', lang, preset.folder);
    mkdirSync(dir, { recursive: true });
    const { out: OUT, phone: PHONE } = preset;
    await cdp.send('Emulation.setDeviceMetricsOverride', { ...PHONE, deviceScaleFactor: preset.scale, mobile: true });
    // --shot=<name> retakes one image (e.g. --shot=7-news) without the rest.
    const onlyShot = process.argv.find((a) => a.startsWith('--shot='))?.slice('--shot='.length);
    for (const shot of SHOTS.filter((x) => !onlyShot || x.name === onlyShot)) {
      await cdp.send('Page.navigate', { url: `${SITE}${shot.path}` });
      // Wait for the app to draw, not for a fixed time: a slow bundle left
      // blank white shots (2026-11-10). Then let data and images settle.
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        if (await isTrue(cdp, `document.body && document.body.innerText.trim().length > 80`)) break;
      }
      // A dead dev server gives Chrome's own error page, which would be
      // photographed like any other (it was, 2026-11-10): stop instead.
      if (await isTrue(cdp, `/refused to connect|can.t be reached|ERR_CONNECTION/i.test(document.body.innerText)`)) {
        throw new Error(`The web dev server at ${SITE} is not answering; nothing was saved for ${shot.name}.`);
      }
      await sleep(6000);
      // A welcome or update card that still shows is closed.
      await evaluate(
        cdp,
        `for (const label of ['Look around first', 'Primero echar un vistazo', 'Got it', 'Entendido', 'Maybe later', 'Quizás después']) {
           const b = [...document.querySelectorAll('[role=button]')].find((x) => x.innerText.trim() === label);
           if (b) b.click();
         }`
      );
      if (shot.prepare) await evaluate(cdp, shot.prepare);
      await sleep(1500);
      if (process.argv.includes('--debug')) {
        const seen = await cdp.send('Runtime.evaluate', {
          expression: `JSON.stringify({ text: document.body.innerText.trim().length, bg: getComputedStyle(document.body).backgroundColor, w: innerWidth, h: innerHeight, first: document.body.innerText.trim().slice(0, 60) })`,
          returnByValue: true,
        });
        console.log(shot.name, seen?.result?.value);
      }
      const screen = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data as string;
      if (process.argv.includes('--debug')) console.log(shot.name, 'png bytes', Math.round((screen.length * 3) / 4));

      // Caption band over the screen, rendered by the same browser.
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        html,body{margin:0;width:${OUT.width}px;height:${OUT.height}px;background:#0b1220;overflow:hidden}
        .cap{height:${preset.caption}px;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 ${Math.round(OUT.width * 0.065)}px;
          font:700 ${preset.font}px/1.18 -apple-system,'Helvetica Neue',Arial,sans-serif;color:#fff}
        .phone{position:absolute;left:50%;top:${preset.caption}px;transform:translateX(-50%);width:${Math.round(PHONE.width * preset.scale)}px;
          border-radius:${Math.round(22 * preset.scale)}px;overflow:hidden;box-shadow:0 0 0 ${Math.round(5 * preset.scale)}px #1c2638}
        .phone img{display:block;width:100%}
      </style></head><body><div class="cap"><div>${shot.caption[lang]}</div></div>
      <div class="phone"><img src="data:image/png;base64,${screen}"></div></body></html>`;
      await cdp.send('Emulation.setDeviceMetricsOverride', { ...OUT, deviceScaleFactor: 1, mobile: false });
      const frame = await cdp.send('Page.getFrameTree');
      await cdp.send('Page.setDocumentContent', { frameId: frame.frameTree.frame.id, html });
      await sleep(800);
      const out = (await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })).data as string;
      writeFileSync(join(dir, `${shot.name}.jpg`), Buffer.from(out, 'base64'));
      console.log(`saved ${join(dir, `${shot.name}.jpg`)}`);
      await cdp.send('Emulation.setDeviceMetricsOverride', { ...PHONE, deviceScaleFactor: preset.scale, mobile: true });
    }
    }
  } finally {
    const exited = new Promise((r) => chrome.once('exit', r));
    chrome.kill();
    await Promise.race([exited, sleep(5000)]);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
