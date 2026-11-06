# RailRadar – SPEC

## Syfte

En "Flightradar för tåg": en mobile-first livekarta över tåg i Sverige, byggd på Trafikverkets öppna API. Man utforskar kartan fritt, klickar på ett tåg och ser var det är, vart det ska och om det är försenat.

Live på `railradar.se`.

## MVP

### Karta

- MapLibre GL med OpenFreeMap och en egen minimal stil i ljust och mörkt läge som följer systemet. Järnvägsnätet (`class=rail` i baskartan) ritas tydligt i grått. Det finns i baskartan först från zoom 8.
- Alla tåg som rapporterar position och har annonserat tågnummer visas live och flyttas direkt till ny position när den kommer.
- Fri navigering: panorera, zooma, klicka på vilket tåg som helst.
- Kartvyn (position och zoom) sparas i localStorage, så man hamnar på samma ställe vid omladdning. Första gången visas hela Sverige.
- Knapp för "Min position" (geolocation) som flyger till användaren och visar en prick. Zoomknappar på desktop.
- Attribution för OpenStreetMap/OpenFreeMap och Trafikverket syns på kartan och fälls ihop till en knapp när man börjar använda kartan.

### Tågikon

- En tågsilhuett sedd ovanifrån som roteras efter bäring.
- Valt tåg markeras tydligt.

### Valt tåg

- Klick på ett tåg markerar det och öppnar infopanelen.
- Kartan visar tågets stationer som prickar: passerade nedtonade, kommande tydliga.
- Klick på tom karta eller stängd panel avmarkerar.

### Infopanel

Panelen har två lägen: kompakt (öppnas direkt) och expanderad. Visa bara fält som faktiskt finns för tåget.

**Kompakt:**

- Tågnummer, produkt och operatör (t.ex. "Öresundståg, Skånetrafiken")
- Från → till
- Status: inställt, delvis inställt eller senast sett (se nedan)
- Försening i minuter
- Hastighet (saknas för många tåg, visas bara när den finns)
- Nästa station med tid och spår
- Avvikelse som kort notis, t.ex. "Buss ersätter" eller "Spårändrat"

**Expanderad:**

- Stopplista: alla annonserade stationer med planerad, beräknad och faktisk tid, spår, och markering av passerade och inställda stationer
- Övrig information från Trafikverket

### Status

I MVP visas bara det som går att läsa direkt ur Trafikverkets data. Ingen egen statuslogik på servern.

- **Inställt:** `Canceled` från `TrainAnnouncement` gäller per stopp. Tåget är inställt när alla stopp är inställda och delvis inställt när bara vissa är det. Det är bara känt när tåget har öppnats.
- **Senast sett:** senaste position äldre än 2 min. Tåget ligger kvar på kartan men nedtonat. Frontend räknar ut det från `measuredAt`.

Ett tåg tas bort från kartan (`remove`) när Trafikverket markerar positionen som raderad (`Deleted`) eller inaktiv (`Status.Active = false`), eller när senaste position är äldre än 30 min.

Frontend återansluter automatiskt om strömmen tappas.

## Milstolpar

Varje milstolpe avslutas med typecheck, tester, lint och en körning av appen och lämnas sedan över för granskning.

### 0. Grund ✅

Monorepo med `api`, `web` och `shared`, dev-Postgres, migrationer, `/api/health` och felhantering via `HttpError`.

### 1. Ingest från Trafikverket ✅

- zod-schema för `TrainPosition` och mappning till `TrainState` (WKT-parsning, id från annonserat tågnummer)
- Initial query som fyller state, sedan SSE-prenumeration med återanslutning och backoff
- Regler för `remove`: `Deleted`, `Status.Active = false` eller äldre än 30 min
- `upstream` i `/api/health` uppdateras
- Tester med inspelade svar som fixtures

**Klart när:** API:t loggar antal tåg i state, antalet håller sig rimligt över tid och `/api/health` visar `connected`.

### 2. Ström till klienter ✅

- `/api/stream` med `snapshot`, `update`, `remove` och `heartbeat`
- Kompakt payload med korta nycklar, schema i `packages/shared`
- Batchade ändringar varannan sekund, bara ändrade tåg

**Klart när:** `curl -N localhost:3000/api/stream` visar en snapshot följd av uppdateringar.

### 3. Karta med live-tåg ✅

- MapLibre med OpenFreeMap i ljust och mörkt läge, tydligare järnvägsnät och attribution
- Tågstore som är fristående från kartan, prenumererar på strömmen och återansluter automatiskt
- Tågikon roterad efter bäring och med storlek som skalar med zoom
- Nedtoning av tåg som inte setts på 2 min
- Knapp för min position, och zoomknappar på desktop

**Klart när:** tågen uppdateras live på kartan i webbläsaren, både på mobil och på desktop.

### 4. Drift ✅

- Dockerfile och `docker-compose.yml` med `api`, `postgres` och `caddy`
- Caddy proxar `api.railradar.se` till API:t och sköter HTTPS
- Frontend på Vercel, kopplat till GitHub
- GitHub Actions som deployar API:t vid push till `main`
- DNS för `railradar.se` och `api.railradar.se`

**Klart när:** livekartan fungerar på `https://railradar.se`.

### 5. Stationer ✅

- zod-schema för `TrainStation`
- Synk till Postgres vid start om tabellen är tom och sedan en gång per dygn
- Stationerna hålls i minnet för uppslag av namn och position

**Klart när:** tabellen fylls, och API:t överlever en omstart med fylld tabell utan att synka om.

### 6. Infopanel

- zod-schema för `TrainAnnouncement`, hämtas när ett tåg öppnas och cachas med kort TTL
- `/api/trains/:id` med produkt, operatör, från → till, inställt, försening, nästa station och stopplista
- Avvikelser verifieras mot ett tåg som har avvikelser och läggs till om fälten finns
- Klick markerar ett tåg (accentfärg och bricka med tågnummer) och öppnar panelen, klick på tom karta avmarkerar
- Infopanel i kompakt och expanderat läge, mobile-first
- Stationsprickar för valt tåg: passerade nedtonade, kommande tydliga

**Klart när:** MVP är uppfyllt enligt ovan och deployat.

## Efter MVP

Egen logik som bygger vidare på Trafikverkets data:

- Status "Står still": hastighet 0 i mer än 60 s, eller förflyttning under 50 m när hastighet saknas
- Ring på kartan för tåg som står still ute på linjen (> 500 m från närmaste station)
- Positionshistorik i Postgres (en punkt per tåg var 30:e sekund, 24 h) med hastighetsgraf, toppfart och snittfart i infopanelen

Övrigt:

- Sök på tågnummer och station, med avgångar och ankomster per station
- Status "Position saknas" för tåg som har annonseringsdata men ingen position (blir nåbar först med sök)
- Godståg och tåg utan annonserat nummer
- Kameraföljning på mobil: kameran följer valt tåg tills användaren själv drar eller zoomar
- Statusfärger på ikonerna
- Hotspots: flera tåg som står still på samma sträcka markeras som trolig störning
- Live-räknare, t.ex. "312 tåg i rörelse · 14 står still · snabbast just nu: X, 205 km/h"
- Bild per tågtyp (via produktinformationen)
- Mjuk rörelse längs rälsen: positioner matchas mot järnvägsnätet så att tågen glider längs spåret i stället för att hoppa, eventuellt med dead reckoning så att de ligger närmare verkligheten (idag ca 10–20 s efter)
- Indikator för tappad anslutning
- Störningsinformation från `TrainMessage` (t.ex. signalfel på en sträcka)
- Konton, sparade tåg och stationer, push-notiser vid försening
- Statistik över tid, t.ex. punktlighet per linje
- Buss och lokaltrafik, flera språk

## Arkitektur

```
Trafikverket API ──SSE──▶ Backend (Node/Express, TS) ──SSE──▶ Frontend (React)
                           │  in-memory: senaste läge per tåg
                           ▼
                        Postgres (stationer)
```

**Frontend:** React, TypeScript, Vite, Tailwind, MapLibre GL. All kartkod samlas så att stil och ikoner kan bytas på ett ställe. Tågdatan ligger i en egen store som inte känner till kartan. Alla färger, även kartans, är semantiska variabler i OKLCH i `index.css`. Kartan läser dem därifrån. `index.css` innehåller bara dessa tokens och grundstil. UI som återkommer, t.ex. kartknappar, blir React-komponenter med Tailwind-klasser, inte `@apply`-klasser. Ikoner kommer från `lucide-react`.

**Repo:** monorepo med npm workspaces: `apps/api`, `apps/web` och `packages/shared` (gemensamma typer och zod-scheman för SSE-payload och API-svar).

**Backend:** Express i TypeScript, zod för validering av Trafikverkets svar.

- _Ingest:_ vid start och vid varje återanslutning körs först en vanlig query på `TrainPosition` (tåg med färsk position) för att fylla state. Sedan öppnas en enda SSE-prenumeration för ändringar. Om strömmen tappas återansluter backenden med backoff (1 s upp till 60 s, nollställs när händelser kommer igen). Tystnad i mer än 60 s räknas som tappad ström. Senaste läget per tåg hålls i minnet.
  - Filtret använder en absolut tidsstämpel (nu − 30 min), eftersom `$dateadd` inte stöds tillsammans med `sseurl`.
  - Filtret innehåller inte `Status.Active`. Strömmen använder samma filter, och inaktiva händelser behövs för `remove`. Inaktiva positioner i query-svaret sorteras bort i koden.
  - Strömmen skickar ungefär var 5:e sekund ett event med ett helt `RESPONSE` som innehåller alla ändrade positioner sedan förra.
  - Samma annonserade tåg kan ha flera positioner med olika operativa tågnummer, där den gamla ofta är inaktiv. Därför ignoreras händelser (både `update` och `remove`) som är äldre än tågets nuvarande `measuredAt`.
- _Annonseringsdata:_ `TrainAnnouncement` hämtas när ett tåg öppnas och cachas i minnet med kort TTL.
- _Stationer:_ `TrainStation` synkas till Postgres en gång per dygn (och vid start om tabellen är tom). Stationerna läses in i minnet vid start och efter varje synk. De behövs för att översätta signaturer till namn och för att rita stationsprickar. Alla platser sparas, även icke annonserade och utländska, så att alla signaturer går att slå upp. En synk ersätter hela tabellen i en transaktion. Misslyckas den görs ett nytt försök efter 5 min, och API:t fortsätter köra under tiden.
- _Fan-out:_ alla klienter får alla tåg. Först en snapshot, sedan batchade ändringar varannan sekund. Bara ändrade tåg skickas, med korta nycklar för att spara mobildata (ca 25 % mindre än fulla fältnamn). Ingen komprimeringsmiddleware på SSE-routen.
  - Händelser: `snapshot` (alla tåg, direkt vid anslutning), `update` (ändrade tåg), `remove` (id:n) och `heartbeat` (`{ t }` = servertid, var 15:e sekund).
  - Ett tåg i strömmen: `i` id, `n` tågnummer, `la`/`lo` position (5 decimaler), `s` hastighet eller `null`, `b` bäring, `t` `measuredAt` i epoch-sekunder. Scheman i `packages/shared/src/stream.ts`.
  - Tåg som försvinner vid återanslutning mot Trafikverket skickas som `remove`.
- _Omstart:_ in-memory-state sparas inte. Efter omstart byggs det upp på nytt via initial query och strömmen. Postgres används inte för att återställa state.
- _Migrationer:_ numrerade SQL-filer som körs vid start.

**Tester:** Vitest för zod-parsning och mappning av Trafikverkets data, med inspelade API-svar som fixtures.

**Lokal utveckling:** `docker-compose.dev.yml` med bara Postgres. API och web körs lokalt med hot reload.

### In-memory-state per tåg

```ts
type TrainState = {
  id: string // {departure_date}-{advertised_train_number}
  trainNumber: string // AdvertisedTrainNumber
  departureDate: string // YYYY-MM-DD
  lat: number
  lon: number
  speed: number | null // km/h, saknas ofta
  bearing: number // grader
  measuredAt: Date // TimeStamp
}
```

**Drift:** frontend ligger på Vercel på `www.railradar.se`, så att den lilla VM:en slipper bygga den. `railradar.se` redirectar dit. Backend ligger på en x86-VM på Oracle Cloud Always Free (för att prova gratis, Hetzner är reservplan) med `docker compose`: `api`, `postgres`, `caddy`. Caddy proxar `api.railradar.se` till API:t och sköter HTTPS. API:t tillåter CORS från `https://www.railradar.se`, och frontend får API-adressen via `VITE_API_URL` vid bygget. DNS hos STRATO: `railradar.se` och `www.railradar.se` enligt Vercels instruktioner och A-post för `api.railradar.se` till VM:ens IP.

**Deploy:** Vercel bygger och deployar frontend vid push till `main`. GitHub Actions deployar API:t vid samma push: SSH till VM:en och kör `git pull --ff-only && docker compose up -d --build --remove-orphans`. Inget image registry i MVP. Workflowen använder GitHub-secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` och `DEPLOY_KNOWN_HOSTS`.

**Hemligheter:** Trafikverkets API-nyckel och Postgres-lösenordet finns bara i `.env` på servern (se `.env.example`). Aldrig i frontend eller i git.

## Datamodell (Postgres)

```sql
stations (
  signature     text PRIMARY KEY,   -- LocationSignature
  name          text NOT NULL,
  lat           double precision,
  lon           double precision,
  updated_at    timestamptz
);
```

## API

| Metod | Endpoint          | Beskrivning                                                                 |
| ----- | ----------------- | --------------------------------------------------------------------------- |
| GET   | `/api/health`     | Status för server, DB och uppströmsström (inkl. tid sedan senaste händelse) |
| GET   | `/api/stream`     | SSE-händelser: `snapshot`, `update`, `remove`, `heartbeat`                  |
| GET   | `/api/trains/:id` | All info för infopanelen: status, försening, stopplista, avvikelser m.m.    |

Fel returneras som `{ "error": { "code": "...", "message": "..." } }`.
