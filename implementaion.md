Applikationsdefinition: IPTV Hub

Denna definition beskriver kraven, strukturen och logiken för att återskapa applikationen "IPTV Hub". Klienten implementeras med **vanilla HTML, CSS och senaste ECMAScript JavaScript** (ES-moduler med `import` från npm-paket). Backend-lagret implementeras med **Netlify Functions**.

1. Syfte

Att erbjuda ett användarvänligt gränssnitt för att bläddra, söka, filtrera och organisera IPTV-innehåll (Video On Demand och Serier) från leverantörer som använder Xtream Codes API-standarden.

1.1 Teknikstack (klient)

| Lager | Teknik |
|-------|--------|
| Markup | Vanilla HTML5 (semantiska element: `header`, `nav`, `main`, `section`, `dialog`, m.m.) |
| Stil | Vanilla CSS (egna stylesheets, CSS custom properties, flexbox/grid) |
| Logik | Senaste ECMAScript JavaScript som **ES-moduler** (`<script type="module">`) |
| Paket | npm-paket importeras med standard `import`-syntax (t.ex. `import { foo } from 'bar'`) |
| Bygg | Vite (eller motsvarande) bundlar klienten till statiska filer för Netlify |

**Inga UI-ramverk** (React, Vue, Angular, Svelte, m.m.) — DOM manipuleras direkt via `document`, `querySelector`, `createElement`, event listeners och `classList`.

**Exempel på projektstruktur:**

```
/
├── index.html              # Rot-HTML, länkar CSS och startmodul
├── css/
│   └── styles.css          # Globala och komponentspecifika stilar
├── js/
│   ├── main.js             # App-startpunkt (type="module")
│   ├── api/
│   │   └── xtream.js       # Anrop till Netlify Functions
│   ├── views/
│   │   ├── movies.js
│   │   ├── series.js
│   │   └── lists.js
│   ├── components/
│   │   ├── grid.js
│   │   ├── modal.js
│   │   └── search.js
│   └── storage/
│       └── local.js        # localStorage-hjälpare
├── netlify/
│   └── functions/
│       └── xtream.js       # Server-side proxy (BFF)
├── package.json            # npm-beroenden för klient (och ev. dev-tools)
└── vite.config.js          # Bundlar ES-moduler till dist/
```

**Exempel på modulimport i klienten:**

```html
<!-- index.html -->
<link rel="stylesheet" href="/css/styles.css" />
<script type="module" src="/js/main.js"></script>
```

```javascript
// js/main.js
import { fetchXtream } from './api/xtream.js';
import { initMoviesView } from './views/movies.js';
import { loadCredentials, saveCredentials } from './storage/local.js';
// npm-paket vid behov, t.ex.:
// import debounce from 'lodash-es/debounce.js';
```

2. Autentisering & API-integration

2.1 Arkitektur (Klient → Netlify Functions → Xtream API)

Den vanilla JavaScript-klienten (ES-moduler) får aldrig anropa Xtream Codes API direkt. All kommunikation med IPTV-leverantören sker via Netlify Functions som server-side proxy (BFF). Klienten använder `fetch()` mot egna function-endpoints.

Flöde:

1. Klienten skickar anslutningsuppgifter och önskad åtgärd till en Netlify Function.
2. Funktionen bygger rätt Xtream-URL och gör HTTP/HTTPS-anropet mot leverantörens server.
3. Funktionen returnerar svaret (JSON) till klienten.

Detta löser CORS-problematik eftersom anropet till IPTV-leverantören sker från servern, inte från webbläsaren.

2.2 Anslutningsprotokoll

Xtream Codes API nås via HTTP/HTTPS från Netlify Functions.

Klienten anropar Netlify Functions på samma ursprung som frontenden (t.ex. `/.netlify/functions/xtream` eller motsvarande routes), vilket undviker CORS även mellan klient och egen backend.

2.3 Autentiseringsparametrar

Användaren måste kunna ange följande uppgifter för att ansluta:

Server URL: Leverantörens basadress (t.ex. http://server.com:8080).

Username: Användarnamn.

Password: Lösenord.

Dessa uppgifter skickas med varje backend-anrop (t.ex. i request body) så att funktionen kan autentisera mot Xtream API. De lagras inte på servern utöver den korta livslängden för ett enskilt function-anrop.

2.4 Sessionshantering (klient)

Anslutningsuppgifterna ska sparas lokalt i `localStorage` (eller `sessionStorage` om så önskas) för automatisk inloggning vid framtida besök. En dedikerad modul (t.ex. `js/storage/local.js`) kapslar in läs/skriv/radera.

En "Logga ut"-funktion måste finnas som rensar sparade uppgifter och tvingar användaren tillbaka till inloggningsvyn (visar login-formuläret i HTML och döljer huvudapplikationen via CSS-klasser eller `hidden`-attribut).

2.5 Netlify Function — kontrakt

Backend ska exponera minst en Netlify Function som proxar Xtream-anrop. Funktionen tar emot:

- `serverUrl`, `username`, `password` — anslutningsuppgifter från klienten
- `action` — vilken Xtream-åtgärd som ska utföras
- Eventuella extra parametrar (t.ex. `category_id`, `vod_id`, `series_id`)

Funktionen validerar indata, anropar rätt Xtream-endpoint och returnerar JSON-svaret eller ett strukturerat felmeddelande.

Exempel på klientanrop:

```
POST /.netlify/functions/xtream
{
  "serverUrl": "http://server.com:8080",
  "username": "...",
  "password": "...",
  "action": "get_vod_categories"
}
```

2.6 Xtream API Endpoints (anropas av Netlify Functions)

Funktionen bygger anrop mot följande endpoints (där `[BASE_URL]` är Server URL + `/player_api.php?username=[USER]&password=[PASS]`):

Autentisering: `[BASE_URL]` (Returnerar användarinfo om giltig).

VOD Kategorier: `[BASE_URL]&action=get_vod_categories`

Serie Kategorier: `[BASE_URL]&action=get_series_categories`

VOD Innehåll i kategori: `[BASE_URL]&action=get_vod_streams&category_id=[ID]`

Serie Innehåll i kategori: `[BASE_URL]&action=get_series&category_id=[ID]`

VOD Detaljinformation: `[BASE_URL]&action=get_vod_info&vod_id=[ID]`

Serie Detaljinformation: `[BASE_URL]&action=get_series_info&series_id=[ID]`

Klienten ska mappa sina behov till `action`-parametern; den ska inte känna till eller konstruera Xtream-URL:er själv.

2.7 Felhantering i backend

Netlify Functions ska fånga nätverksfel, timeout och ogiltiga svar från Xtream API och returnera tydliga HTTP-statuskoder och felmeddelanden till klienten (t.ex. 401 vid ogiltiga inloggningsuppgifter, 502 vid att leverantören inte svarar).

3. Vyer & Navigering

Applikationen består av tre primära huvudvyer, valbara via en huvudmeny (`<nav>` med knappar eller länkar som växlar aktiv vy):

Filmer (VOD)

Serier

Mina Listor

Varje vy har en motsvarande ES-modul (t.ex. `js/views/movies.js`) som ansvarar för att rendera innehåll i en avsedda `<section>`-containers i HTML. Vybyte hanteras genom att visa/dölja sektioner (CSS-klass `is-active` eller `hidden`) och anropa respektive moduls `init()`/`render()`.

3.1 Vy: Filmer / Serier

Kategoriväljare: En `<select>` (rullgardinsmeny) som fylls dynamiskt med `<option>`-element baserat på data från API:et.

Innehållsraster (Grid): Ett CSS Grid- eller flexbox-baserat raster (`<div class="content-grid">`) där varje post renderas som ett kort (`<article>`) med posterbild (`<img>`) och titel.

Laddningsindikering: En laddningsindikator (t.ex. `<div class="loading" aria-busy="true">`) måste visas vid byte av kategori medan data hämtas.

3.2 Vy: Mina Listor

Listväljare: Flikar eller knappar (`<button role="tab">`) för att växla mellan användarens skapade listor.

Skapa ny lista: Ett `<input type="text">` och en `<button>` för att lägga till nya listor.

Radera lista: Ett alternativ för att ta bort den för tillfället valda listan (med en bekräftelsedialog via `<dialog>` eller `window.confirm()`).

4. Innehållshantering (Klientlogik)

4.1 Sökning

Ett `<input type="search">` som tillåter textsökning i det för tillfället laddade innehållet (den valda kategorin eller listan).

Sökningen ska ske i realtid mot klientens minne — filtrera den hämtade arrayen med `Array.prototype.filter()` baserat på titeln. Vid behov kan ett npm-paket som `lodash-es/debounce` användas för att begränsa antalet omrenderingar vid snabb inmatning.

4.2 Sortering

Användaren ska kunna sortera det för tillfället visade innehållet enligt följande kriterier:

Alfabetiskt (Namn/Titel)

Betyg (Högst först)

Senast tillagd (Nyast först)

4.3 Custom Lists (Egna Listor)

Datastruktur: Applikationen måste upprätthålla en `Map` (eller ett vanligt objekt) där nyckeln är listans namn och värdet är en array av innehållsobjekt. Vid serialisering till `localStorage` konverteras `Map` till JSON (`Object.fromEntries()` / `JSON.stringify`).

Lagring: Listdatan måste sparas i `localStorage` och läsas in vid appstart.

Lägg till/Ta bort: Från innehållsrastret eller detaljvyn måste användaren snabbt kunna lägga till eller ta bort ett specifikt objekt (film/serie) till/från en eller flera av sina listor.

Visuell Feedback: Det ska tydligt framgå för användaren vilka listor ett valt objekt redan tillhör.

5. Detaljvy (Modal/Overlay)

När en användare väljer ett specifikt objekt i innehållsrastret ska en detaljvy öppnas. Implementeras med det inbyggda HTML-elementet `<dialog>` (eller en `<div class="modal">` med CSS och `aria-modal="true"`) som fylls dynamiskt via JavaScript.

Informationshämtning: Applikationen gör ett nytt anrop via Netlify Function (`get_vod_info` eller `get_series_info`) baserat på objektets ID.

Innehåll att visa:

Titel

Stor omslagsbild / Backdrop (om tillgängligt) eller Poster.

Betyg, Utgivningsår, Genre, Regissör.

Handling (Plot/Beskrivning).

Medverkande (Cast).

Interaktioner i Detaljvyn:

Möjlighet att stänga vyn.

Knapp för att hantera objektet i "Mina Listor".

(Framtida funktionalitet: Spela upp-knapp).

6. Felhantering

Inloggningsfel: Tydligt meddelande om server-URL är felaktig, eller om användarnamn/lösenord avvisas (baserat på svar från Netlify Function).

Nätverksfel: Om anrop till Netlify Function misslyckas, eller om funktionen rapporterar att Xtream API inte svarar, ska ett användarvänligt felmeddelande visas.

Tomma resultat: Om en kategori eller sökning inte returnerar något innehåll ska ett meddelande visas (t.ex. "Inget innehåll hittades" i en `<p class="empty-state">`).

7. Moderna JavaScript-konventioner

Klientkoden ska följa senaste ECMAScript-standarder:

- **ES-moduler** — `import` / `export`; inga CommonJS (`require`) i webbläsarkod.
- **Async/await** — alla `fetch()`-anrop och asynkron DOM-uppdatering.
- **Const/let** — undvik `var`.
- **Arrow functions, destructuring, spread/rest, optional chaining (`?.`), nullish coalescing (`??`)** — använd där det förenklar koden.
- **Native APIs** — föredra inbyggda webbläsar-API:er (`fetch`, `URL`, `URLSearchParams`, `structuredClone`, `Intl`) framför onödiga npm-beroenden.
- **npm-paket** — importera endast vid tydligt behov (t.ex. debounce, datumformatering); håll beroendelistan minimal.

Referance:
M3U-länk: http://nxtstream.one:8080/get.php?username=<User>>&password=<paswword>&type=m3u_plus&output=ts

EPG-länk: http://nxtstream.one:8080/xmltv.php?username=<User>>&password=<paswword>
