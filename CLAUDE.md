# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Waar staan we?** Lees `HANDOVER.md` voordat je aan features begint. De app zit in een herontwerp-fase: de richting, de openstaande besluiten en de bekende defecten staan daar, niet hier.

## Wat dit is

LifePilot — een persoonlijke Nederlandse life-management PWA (taken, herinneringen, notities, gewoontes, agenda, recepten, maaltijdplanner). UI, routes en teksten zijn in het Nederlands; houd dat aan bij nieuwe code.

Effectief single-user: geen enkel model behalve NextAuth's User/Account/Session heeft een `userId`. Alle items/habits/recepten zijn gedeeld tussen ingelogde gebruikers. Ga hier niet van uit dat er per-user scoping is, en voeg die niet stilletjes toe.

## Commands

```bash
npm run dev              # next dev (praat met de echte Turso-database, zie hieronder)
npm run build            # prisma generate && next build
npm run lint             # eslint (flat config)
npx tsc --noEmit         # typecheck
npm run check:parse      # regressiegevallen van de dump-parser (zie hieronder)
npm run db:generate-sql  # schema.prisma -> schema.sql (volledige CREATE-script)
```

Er is geen testrunner geïnstalleerd. `npm run check:parse` is het enige geautomatiseerde
nazicht: `scripts/check-parse.ts` draait op Node's eigen TypeScript-stripping, met
`scripts/alias.mjs` als hook voor de `@/`-padalias. Zo kan er een check bij zonder een
testframework toe te voegen — één lintfout in `ServiceWorkerRegistration.tsx` staat er
nog van vóór dit werk, dus `npm run lint` is nooit helemaal groen.

## Database (Turso + Prisma driver adapter)

- Runtime gaat altijd via `src/lib/prisma.ts` → `PrismaLibSql` adapter met `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`. Zonder die env vars gooit het meteen. Ook `npm run dev` schrijft dus in de echte remote database.
- `prisma/schema.prisma` heeft `datasource db { provider = "sqlite" }` zonder url; `prisma.config.ts` zet `file:./dev.db` puur zodat de Prisma **CLI** (`generate`, `migrate diff`) werkt. `dev.db` is geen dev-database van de app.
- De client wordt gegenereerd naar `src/generated/prisma` en is gecommit. Importeer altijd `from "@/generated/prisma/client"`, nooit `@prisma/client`.
- Schemawijziging: pas `prisma/schema.prisma` aan → `npx prisma generate` → SQL naar Turso pushen met `turso db shell lifepilot < schema.sql` (of `npm run db:generate-sql` eerst). `prisma migrate deploy` wordt hier niet gebruikt; `add-missing-tables.sql` is het voorbeeldpatroon voor een idempotente handmatige migratie (`CREATE TABLE IF NOT EXISTS`).

## Auth

- `src/auth.ts`: NextAuth v5 (beta) met PrismaAdapter maar `session.strategy = "jwt"`. Providers: Apple, GitHub, Google, plus Microsoft Entra ID die **alleen** wordt geregistreerd als `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` gezet zijn (die twee staan niet in `.env.example`).
- GitHub krijgt expliciet `issuer: "https://github.com/login/oauth"` mee. Dat is geen kosmetiek: GitHub stuurt sinds RFC 9207 een `iss`-parameter mee en `@auth/core` 0.41 valt zonder deze regel terug op de placeholder `https://authjs.dev`, waarna inloggen faalt met een misleidende "problem with the server configuration". Weghalen mag pas als de dan geïnstalleerde `next-auth` de issuer zelf zet.
- Alleen `AUTH_GITHUB_*` staat in Vercel; Apple en Google hebben daar geen secrets en werken in productie dus niet. Ga er niet van uit dat een provider die in de code staat ook echt kan inloggen. Microsoft access/refresh tokens worden in de JWT gezet én in de `Account`-rij bewaard.
- `src/proxy.ts` is de Next.js 16-variant van middleware: `export default auth` met een matcher die alles beschermt behalve `api/auth`, statics, icons en manifest.
- Elke API-route roept daarnaast zelf `requireAuth()` uit `src/lib/auth-guard.ts` aan als eerste regel en returnt de 401-response als die niet null is. Volg dat patroon bij nieuwe routes.

## Kernmodel: één `Item`-tabel, afgeleide mappen

Taken, herinneringen en notities zijn allemaal `Item` met `type` (`TASK` | `REMINDER` | `NOTE`) en `folder` (`PRIVE` | `WERK` | `JANNIE_MEPPEL`).

De "tijdmappen" (`vandaag`, `deze-week`, `deze-maand`, `dit-jaar`, `ooit`, `notities`) staan **niet** in de database — ze worden bij elke render uit `item.date` berekend. Die logica hoort op één plek: **`src/lib/day.ts`**. Daar staat welke dag het is (in `Europe/Amsterdam`, niet de UTC-klok van de server), in welk tijdvak een datum valt (`bucketFor`), het rekenen met `"YYYY-MM-DD"`-strings, en de Nederlandse dag- en maandnamen met hun formatters.

Wie erop leunt: `src/lib/folders.ts` (`getTimeFolderForDate`), `src/lib/types.ts` (herhaling en afvinken), `src/lib/today.ts` + `src/components/TodayView.tsx` (de ochtendkaart), `src/app/api/item-counts/route.ts` (de badges) en `src/components/TypedItemView.tsx` (client-side groepering, met een eigen `Date`-berekening die nog naar `day.ts` toe moet). Voeg geen tweede implementatie toe — "menu zegt 3, lijst toont 2" kwam hiervandaan.

Herhaling is alleen wekelijks: `recurrenceDays` is een komma-string van weekdagnummers (0=zo). Een herhalend item wordt nooit `completed`; afvinken maakt/verwijdert een `RecurrenceCompletion` voor die dag via `POST /api/items/[id]/complete`.

## Data flow: server shell, client fetch

Pages in `src/app/**/page.tsx` zijn dunne server components: ze doen `await auth()`, wrappen in `<AppShell>` (navigatie + inhoudsvlak) en renderen één client component in een `Suspense`. Alle data komt daarna client-side uit `/api/*` met `cache: "no-store"`; routes zetten `export const dynamic = "force-dynamic"` en expliciete no-store `Cache-Control` headers (caching heeft hier eerder stale-data bugs veroorzaakt).

Cross-component refresh loopt via een window-event, niet via router refresh of state lifting:

```ts
window.dispatchEvent(new CustomEvent("item-moved"));
```

`MainNav` (de badge op Vandaag), `ItemListView`, `FolderView` en `QuickAdd` luisteren daarop. Als je een mutatie toevoegt die aantallen kan veranderen, dispatch dit event.

Filters komen uit query params, niet uit routes: `/lijst?tijd=deze-week` (gelezen met `useSearchParams`, dus de pagina moet in een `Suspense` staan).

## Navigatie: vier ingangen

`AppShell` is een **server** component (nodig voor de uitlog-server-action in `SignOutForm`) en rendert `MainNav`. Daar staan vier ingangen: Vandaag (`/`), Lijst (`/lijst`), Eten (`/maaltijdplanner`), Zoeken (`/zoeken`) — op mobiel een tabbalk onderaan, op desktop een smalle rail links.

- De rest van de pagina's bestaat nog en is bereikbaar via de "Meer"-la in `MainNav` (`/contacten`, `/agenda`, `/habits`, `/recepten`) of via de losse typelijsten (`/taken`, `/herinneringen`, `/notities`). Voeg géén vijfde ingang toe zonder dat te bespreken; het punt van het herontwerp was minder keuzes.
- `owns` per ingang bepaalt welke ingang oplicht op een pagina die zelf geen tab is (`/contacten` licht Vandaag op).
- De kop en de tabbalk op mobiel staan `fixed`; `AppShell` compenseert dat met `pt-20 pb-24` en zet die op `lg` weer uit. Als je iets aan de hoogte verandert, verander beide.
- `ItemListView` is één component voor `/lijst` (`type="ALLE"`) en de losse typelijsten. In `ALLE`-modus krijgen notities een eigen sectie onderaan, want die hebben geen datum.

## Invoeren: één tekstveld met natuurlijke taal

`src/components/QuickAdd.tsx` staat bovenaan elke lijst en is de normale manier om iets toe te voegen: je typt `morgen 9u tandarts`, `src/lib/parse-input.ts` maakt daar een herinnering voor morgen 09:00 van met de titel "Tandarts", en de preview eronder toont wát er gemaakt wordt vóór je opslaat. Dat is de kern van het ontwerp: de parser gokt, maar nooit stil.

- De parser is puur en tijdzone-vrij testbaar: `parseQuickInput(text, { today, defaultType })`. Voeg bij elke nieuwe formulering een geval toe in `scripts/check-parse.ts`.
- Datum, tijd en categorie zijn in de preview te overschrijven; `CreateItemModal` blijft als escape via "Meer velden" (met de getypte tekst als titel).
- Type volgt uit de tekst: een tijd maakt het een `REMINDER` (alleen die kan een melding sturen), `notitie:` maakt het een `NOTE`, anders het type van de lijst waar je staat.
- Een categorie wordt alleen uit *woorden* geraden (`#werk`, "jannie", "vergadering"), nooit uit de klok. Die klokgok stond eerder in `getDefaultFolder()` en labelde privé-items onzichtbaar als WERK.

## Integraties

- **AI (geen SDK):** directe `fetch` naar `https://api.anthropic.com/v1/messages` met `x-api-key: ANTHROPIC_API_KEY` en `anthropic-version: 2023-06-01`. Maaltijdplan: `claude-sonnet-4-6` met een lange Nederlandse system prompt met dieet- en weekregels in `src/app/api/meal-plan/generate/route.ts`. Recept-import (URL/foto): `claude-haiku-4-5-20251001`. Output is JSON-in-tekst en wordt geparsed.
- **Albert Heijn bonus:** `src/app/api/ah-bonus/route.ts` haalt een anoniem token bij `api.ah.nl/mobile-auth` en zoekt bonusproducten met een `Appie/8.22.3` user agent. Ongedocumenteerde API, kan breken.
- **Agenda:** ICS-feeds staan in `CalendarFeed` en worden server-side gefetcht en geparsed door de eigen mini-parser `src/lib/ics-parser.ts` (`webcal://` wordt naar `https://` herschreven, 5 min revalidate, kapotte feeds worden stil overgeslagen). Microsoft 365-agenda gaat via `src/lib/microsoft-graph.ts`, dat access tokens uit `Account` haalt en zelf refresht.
- **Bijlagen:** bestanden worden als `Bytes` in SQLite/Turso opgeslagen (max 10MB), uitgeleverd via `/api/attachments/[id]`. Geen blob storage.
- **PWA + push:** `public/sw.js` (handmatig onderhouden, `CACHE_NAME` bumpen bij wijziging) wordt geregistreerd door `ServiceWorkerRegistration`. Push via `web-push` met VAPID keys; `vercel.json` heeft een cron om 07:00 op `/api/push/send`, die een `Authorization: Bearer $CRON_SECRET` verwacht. `ReminderChecker` in de root layout doet daarnaast client-side checks.

## Styling

Tailwind v4 via `@import "tailwindcss"` in `src/app/globals.css` — er is geen `tailwind.config`. Primaire kleur is **violet** (`violet-600` / `#6d28d9`); blauw is bewust weggemigreerd, gebruik het niet voor nieuwe UI. Tiptap-editorstyling staat handmatig in `globals.css` onder `.tiptap`.
