# RailRadar – SPEC

## Syfte

En "Flightradar för tåg": en mobile-first livekarta över tåg i Sverige, byggd på Trafikverkets öppna API. Man utforskar kartan fritt, klickar på ett tåg och ser var det är, vart det ska och om det är försenat.

Live på `railradar.se`.

## MVP

### Karta

- MapLibre GL med OpenFreeMap, mörk stil. Järnvägsnätet (`class=rail` i baskartan) ritas tydligare i en dämpad accentfärg.
- Alla tåg som rapporterar position och har annonserat tågnummer visas live och rör sig mjukt (interpolering mellan positioner).
- Fri navigering: panorera, zooma, klicka på vilket tåg som helst.
- Attribution för OpenStreetMap/OpenFreeMap och Trafikverket syns på kartan.

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
- Status: i rörelse, står still X min, senast sett, inställt
- Försening i minuter
- Hastighet
- Nästa station med tid och spår
- Avvikelse som kort notis, t.ex. "Buss ersätter" eller "Spårändrat"

**Expanderad:**

- Stopplista: alla stationer med planerad, beräknad och faktisk tid, spår, och markering av passerade stationer
- Hastighetsgraf från positionshistoriken
- Toppfart och snittfart för resan (från historiken)
- Övrig information från Trafikverket

### Status (räknas ut på servern för infopanelen)

- **I rörelse**
- **Står still:** hastighet 0 i mer än 60 s. Om hastighet saknas räknas tåget som stillastående när det flyttat sig mindre än 50 m. Kräver `stoppedSince` i state, se nedan.
- **Senast sett:** senaste position äldre än 2 min. Tåget ligger kvar på kartan men nedtonat. Nedtoningen räknar frontend ut själv från `measuredAt`.
- **Inställt:** från `TrainAnnouncement`, så det är bara känt när tåget har öppnats.

Status visas i infopanelen, inte som färg på kartan. Enda undantaget är ringen för tåg som står still ute på linjen.

Ett tåg tas bort från kartan (`remove`) när Trafikverket markerar positionen som raderad eller inaktiv, eller när senaste position är äldre än 30 min.

Frontend återansluter automatiskt om strömmen tappas.

## Efter MVP

- Sök på tågnummer och station, med avgångar och ankomster per station
- Status "Position saknas" för tåg som har annonseringsdata men ingen position (blir nåbar först med sök)
- Godståg och tåg utan annonserat nummer
- Kameraföljning på mobil: kameran följer valt tåg tills användaren själv drar eller zoomar
- Statusfärger på ikonerna och storlek som skalar med zoom
- Hotspots: flera tåg som står still på samma sträcka markeras som trolig störning
- Live-räknare, t.ex. "312 tåg i rörelse · 14 står still · snabbast just nu: X, 205 km/h"
- Bild per tågtyp (via produktinformationen)
- Dead reckoning för mjukare rörelse
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
                        Postgres (stationer, positionshistorik 24 h)
```

**Frontend:** React, TypeScript, Vite, Tailwind, MapLibre GL. All kartkod samlas så att stil och ikoner kan bytas på ett ställe. Tågdatan ligger i en egen store som inte känner till kartan.

**Repo:** monorepo med npm workspaces: `apps/api`, `apps/web` och `packages/shared` (gemensamma typer och zod-scheman för SSE-payload och API-svar).

**Backend:** Express i TypeScript, zod för validering av Trafikverkets svar.

- _Ingest:_ vid start och vid varje återanslutning körs först en vanlig query på `TrainPosition` (aktiva tåg med färsk position) för att fylla state. Sedan öppnas en enda SSE-prenumeration för ändringar. Om strömmen tappas återansluter backenden med backoff. Senaste läget per tåg hålls i minnet.
- _Annonseringsdata:_ `TrainAnnouncement` hämtas när ett tåg öppnas och cachas i minnet med kort TTL.
- _Stationer:_ `TrainStation` synkas till Postgres en gång per dygn (och vid start om tabellen är tom). Stationerna läses in i minnet vid start och efter varje synk, för att kunna räkna ut `stoppedOnLine`.
- _Fan-out:_ alla klienter får alla tåg. Först en snapshot, sedan batchade ändringar varannan sekund. Bara ändrade tåg skickas, i ett kompakt format med korta nycklar. Ingen komprimeringsmiddleware på SSE-routen.
- _Historik:_ en punkt per tåg var 30:e sekund. Punkterna samlas och skrivs till Postgres som en multi-row-insert ungefär varannan sekund. Cleanup-jobb **en gång i timmen** raderar allt äldre än 24 h.
- _Omstart:_ in-memory-state sparas inte. Efter omstart byggs det upp på nytt via initial query och strömmen. Postgres används inte för att återställa state.
- _Migrationer:_ numrerade SQL-filer som körs vid start.

**Tester:** Vitest för statuslogik och zod-parsning, med inspelade API-svar som fixtures.

**Lokal utveckling:** `docker-compose.dev.yml` med bara Postgres. API och web körs lokalt med hot reload.

### In-memory-state per tåg

```ts
type TrainState = {
  id: string // {departure_date}-{train_number}
  trainNumber: string
  departureDate: string // YYYY-MM-DD
  lat: number
  lon: number
  speed: number | null // km/h
  bearing: number | null // grader
  measuredAt: Date
  stoppedSince: Date | null // sätts när speed blir 0, nollställs när > 0
  stoppedAnchor: { lat: number; lon: number } | null // referenspunkt för 50 m-regeln när speed saknas
  stoppedOnLine: boolean // står still > 60 s och > 500 m från närmaste station, skickas i strömmen
  lastPersistedAt: Date | null // för 30 s-loggningen
}
```

**Drift:** en Hetzner-VPS med `docker compose`: `api`, `postgres`, `caddy`. Caddy serverar frontend och proxar `/api` på samma domän och sköter HTTPS. Frontend byggs i en multi-stage Dockerfile och den byggda `dist/` serveras av Caddy. DNS hos STRATO: A-post för `railradar.se` till VPS:ens IP.

**Deploy:** GitHub Actions vid push till `main`: SSH till VPS:en och kör `git pull && docker compose up -d --build`. Inget image registry i MVP.

**Hemligheter:** Trafikverkets API-nyckel finns bara i backendens `.env` på servern och som GitHub-secret vid behov. Aldrig i frontend eller i git.

## Datamodell (Postgres)

```sql
stations (
  signature     text PRIMARY KEY,   -- LocationSignature
  name          text NOT NULL,
  lat           double precision,
  lon           double precision,
  updated_at    timestamptz
);

train_positions (
  id             bigserial PRIMARY KEY,
  train_number   text NOT NULL,     -- AdvertisedTrainNumber
  departure_date date NOT NULL,     -- unikt tillsammans med tågnummer
  lat            double precision NOT NULL,
  lon            double precision NOT NULL,
  speed          int,               -- km/h
  bearing        int,               -- grader
  measured_at    timestamptz NOT NULL
);
CREATE INDEX ON train_positions (train_number, departure_date, measured_at);
CREATE INDEX ON train_positions (measured_at);  -- för cleanup
```

## API

| Metod | Endpoint                  | Beskrivning                                                                 |
| ----- | ------------------------- | --------------------------------------------------------------------------- |
| GET   | `/api/health`             | Status för server, DB och uppströmsström (inkl. tid sedan senaste händelse) |
| GET   | `/api/stream`             | SSE-händelser: `snapshot`, `update`, `remove`, `heartbeat`                  |
| GET   | `/api/trains/:id`         | All info för infopanelen: status, försening, stopplista, avvikelser m.m.    |
| GET   | `/api/trains/:id/history` | Positioner för hastighetsgraf, toppfart och snittfart                       |

Fel returneras som `{ "error": { "code": "...", "message": "..." } }`.
