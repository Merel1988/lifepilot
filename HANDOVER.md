# Handover — waar staan we

Bijwerken aan het eind van elke sessie. Lees dit samen met `CLAUDE.md` voordat je begint.

**Laatst bijgewerkt:** 20 augustus 2026 (v9 — flexibel weekmenu + mealprep)
**Fase:** bouwen. Ochtendkaart, contacten, dump-invoer, de vier ingangen en het flexibele weekmenu staan er. De agenda is het openstaande besluit: Merel kan geen van haar twee agenda's delen (zie hieronder).

## ⚠️ Eerst dit — het wacht op Merel

De app werkt, maar een paar dingen kan alleen jij doen:

1. **Controleer of inloggen weer werkt.** Op 20 aug lag het plat (zie "Storing 20 augustus" hieronder); de fix staat live sinds 11:39. Als je nog steeds een foutpagina krijgt: de logs zijn op te vragen met `vercel logs https://www.lifepilot.nl --json`.
2. **Beslis over Apple en Google.** De loginpagina toont drie knoppen, maar in Vercel staan alleen de `AUTH_GITHUB_*`-variabelen. Apple en Google kunnen dus niet werken; die knoppen leiden naar dezelfde foutpagina. Kies: secrets toevoegen in Vercel, of die twee knoppen weghalen. Niet laten staan — een knop die altijd faalt kost vertrouwen in de hele app.
3. **Besluit over de agenda.** Op 20 aug bleek de aanname uit v7 fout: Merel kan haar privé-agenda niet publiceren (het is een gedeelde agenda die haar man heeft aangemaakt; alleen de eigenaar kan publiceren) en haar werkagenda vermoedelijk ook niet. De openbare `webcal://`-route valt daarmee weg. Zie "De agenda: wat kan nog" hieronder.
4. **Een paar contacten invoeren** op `/contacten`. Zonder rijen blijven "Verjaardagen" en "Even laten weten" weg.

De contacttabel staat in Turso (19 aug gedraaid en nagekeken: tabel, index en alle dertien kolommen kloppen met het model). Daar hoef je niets meer aan te doen.

## De agenda: wat kan nog

De tijdlijn met afspraken én taken door elkaar is volgens de visie het enige dat geen andere app voor Merel doet. Die staat of valt bij één werkende feed, en de route die daarvoor was bedacht (openbare `webcal://`-link) blijkt niet te kunnen. Wat er nog over is, van goedkoop naar duur:

1. **Haar man publiceert de gedeelde privé-agenda.** Hij is de eigenaar, dus bij hem staat de knop er wél (Agenda op de Mac of iCloud.com → agenda delen → Openbare agenda). Levert een `webcal://`-link die de bestaande ICS-parser meteen aankan. Kost één verzoek en nul code.
2. **CalDAV met een app-specifiek wachtwoord.** LifePilot praat dan als agenda-app met `caldav.icloud.com` en leest álle agenda's waar Merel bij kan, gedeelde agenda's inbegrepen — zonder dat er iets gedeeld hoeft te worden. Het wachtwoord maakt ze zelf aan op account.apple.com, gratis, werkt met tweestapsverificatie. Kost wél code: discovery (PROPFIND) en een `calendar-query` REPORT, plus het wachtwoord veilig opslaan.
3. **Werkagenda via Microsoft Graph.** De code staat er nog (nu dode code) en OAuth-toestemming geeft ze zelf; het risico is dat de tenant beheerderstoestemming eist. Eerst goedkoop te testen: staat "agenda publiceren" aan in Outlook web (Instellingen → Agenda → Gedeelde agenda's)?
4. **Agenda eruit.** Dan wordt Vandaag een takenlijst met een nu-streep, en verliest de app het onderscheidende deel van de visie. Dat is een productbesluit, geen opruimactie — pas doen als 1 t/m 3 allemaal afvallen.

**Wat níet kan:** inloggen met Apple geeft geen agenda-toegang. "Sign in with Apple" levert alleen naam en e-mail; Apple heeft geen agenda-API achter OAuth. Bovendien kost Apple als inlogprovider een Developer Program-lidmaatschap van €99 per jaar. De Apple-knop op de loginpagina kan dus weg, tenzij Merel dat lidmaatschap om een andere reden wil.

## Aanleiding

Merel gebruikt de app weinig en wist niet of dat kwam door bugs, door de UX, of doordat de app de verkeerde dingen doet. Conclusie na een gesprek en een codereview: alle drie een beetje, maar de kern is dat **de app geen taak heeft in haar dag** — hij is passief en vraagt veel bij het invoeren.

De volledige visie staat in de artifact `Waarvoor is LifePilot er?` (privé gepubliceerd, link in de sessie van 19 aug). Hieronder de samenvatting die je nodig hebt om verder te werken.

## De visie in vijf regels

1. De app wordt gebouwd rond **drie momenten**: de ochtendkaart (07:00, 30 sec) ✅, de dump (onderweg, 2 tikken) ✅, het weekmenu (zondag, 15 min) ✅.
2. Belangrijkste UI-idee: **agenda-afspraken en taken door elkaar op één tijdlijn** op het Vandaag-scherm ✅. Dat is het enige dat geen andere app voor haar doet — maar het staat of valt bij een gekoppelde agenda (zie boven).
3. Menu van tien ingangen naar **vier**: Vandaag, Lijst, Eten, Zoeken ✅.
4. Invoeren wordt **één tekstveld met natuurlijke taal** ✅.
5. Meetlat over vier weken: **tikt ze de ochtendmelding aan?** Zo nee, dan is de aanname fout en gaan we niet doorbouwen. Dat is de enige echte test; al het bovenstaande is tot dan een aanname.

## Vastgesteld in het gesprek

- **Werkagenda (Microsoft 365) valt af.** Merel verwacht geen toestemming van IT. De ochtendkaart gaat dus over "wat staat er vandaag *naast* je werk".
- **iCloud-agenda is de agenda die het moet worden.** De route via een openbare `webcal://`-deellink bleek op 20 aug niet te kunnen: de privé-agenda is een gedeelde agenda van haar man en alleen de eigenaar kan publiceren. Zie "De agenda: wat kan nog".
- **Privé / Werk / Jannie Meppel is een optioneel label geworden**, geen verplichte keuze en geen menu-item: chips onder het invoerveld en een filter boven de lijst.
- **Jannie Meppel is een bedrijfje** waar Merel naast haar werk klussen voor doet, als vrijwilliger — geen uren of facturen. Dus een categorie, geen eigen module. Wel de categorie waar de app de énige plek is: loondienst-werk heeft Outlook en mail al.
- **Alle drie de categorieën blijven** — werk*taken* horen in de app, alleen de werk*agenda* valt af. De tijdgok in `getDefaultFolder()` (ma–do 08:00–16:00 = WERK) is eruit: die labelde privé-items onzichtbaar verkeerd.
- **Het weekmenu moet losser.** Frietjes op vrijdag en restjes op donderdag zijn gewoontes, geen wetten. Merel bepaalt per week zelf hoeveel en welke avonden ze een menu wil — geen vaste instelling, geen aanname. Het gekozen aantal is meteen de noemer voor mealprep ("3 gerechten voor 5 avonden"). Ze wil leren mealpreppen: minder verschillende gerechten voor meer dagen, met porties, kookmomenten, bewaaradvies en variatie binnen hetzelfde gerecht.
- **Nu single-user**, later misschien haar partner erbij. Geen voorbereidend werk daarvoor, wel geen keuzes maken die het blokkeren.

## Wat er nu staat

**De ochtendkaart** (`/`)
- `src/lib/day.ts` is de enige plek waar "welke dag is het" en "in welk tijdvak hoort dit" staat. Leidt de dag af in `Europe/Amsterdam` in plaats van de UTC-klok van de server (dat was rond middernacht stil verkeerd) en vergelijkt datums als `YYYY-MM-DD`-strings. Bevat ook de Nederlandse dag- en maandnamen met hun formatters.
- `src/lib/today.ts` stelt de kaart server-side samen; `page.tsx` rendert met de data al in handen, dus geen spinner en geen zeven parallelle fetches.
- `src/components/TodayView.tsx`: afspraken en taken door elkaar op één tijdlijn met een nu-streep, samenvattingsregel bovenaan, maaltijd van vandaag uit het weekmenu, achterstallig ingeklapt onderaan met "Naar morgen", hele regel aantikbaar, optimistisch afvinken met terugdraaien bij fouten.
- `src/lib/calendar.ts` meldt wélke agenda-feed faalde in plaats van stil over te slaan.

**Meldingen** — `/api/push/send` stuurt de ochtendkaart, passend bij een cron van één keer per dag (`0 6 * * *` = 08:00 CEST / 07:00 CET). Daarvoor vuurde de cron om 07:00 terwijl de route zocht naar herinneringen in de komende vijf minuten, dus er kwam nooit iets aan. `?mode=due` houdt het pad per herinnering beschikbaar voor een externe pinger. Een verjaardag van vandaag krijgt een **eigen** melding, want die verdrinkt in een samenvattingsregel.

**Contacten** (`/contacten`)
- `Contact`-model met de verjaardag als losse dag/maand/jaar, want een verjaardag zonder geboortejaar moet kunnen. Plus `keepInTouchWeeks` en `lastContactAt`.
- `src/lib/contacts.ts`: eerstvolgende verjaardag (29 februari schuift naar 1 maart), zeven dagen vooruitkijken, en wie aan de beurt is voor een berichtje.
- Het interval is opt-in per persoon: leeg betekent geen herinnering. De app zeurt niet ongevraagd over iedereen.

**De dump-invoer** — één tekstveld in plaats van een modal met acht velden
- `src/lib/parse-input.ts`: `parseQuickInput(text, { today, defaultType })` is puur en geeft titel, type, datum, tijd, categorie en herhaling terug. Begrijpt onder andere `morgen 9u tandarts`, `vrijdag boodschappen`, `volgende week maandag`, `over 3 dagen`, `15 september`, `15-9`, `31/12/2026`, `elke maandag`, `iedere werkdag`, `elke di en do`, `half 10`, `kwart voor 8`, `19u30`, `vanavond`, `morgenochtend`, `notitie: ...` en `#werk`.
- `src/components/QuickAdd.tsx` staat bovenaan elke lijst met een preview die toont wát er gemaakt wordt. De parser gokt wel, maar nooit stil — dat is het hele punt. Datum en tijd zijn in de preview aan te tikken, de categorie staat als chips (voorgesteld op basis van woorden, nooit op basis van de klok). Enter voegt toe, de focus blijft staan, en erna staat er "Ongedaan maken".
- Een tijd maakt het een herinnering (alleen die kan een melding sturen), `notitie:` maakt het een notitie, anders het type van de lijst waar je staat. "Meer velden" opent het oude `CreateItemModal` met de getypte tekst als titel, voor omschrijvingen en bijlagen.

**Het weekmenu** (`/maaltijdplanner`)
- Niets aan het menu staat meer vast op de server. `src/lib/meal-plan-input.ts` bouwt het schema en de prompt puur uit de invoer: het dagenraster, de gewoontes die deze week aanstaan en de mealprep-getallen. De route (`api/meal-plan/generate`) doet alleen nog het verzoek, de foutafhandeling en het opslaan.
- **Restjes en frietjes zijn gewoontes geworden**, geen wetten: twee schakelaars met een eigen dagkeuze. Wat uitstaat bestaat voor het menu niet; wat aanstaat bezet die dag in het raster (de cel toont `R` of `F`) en telt niet mee als te plannen maaltijd. Standaard staat elke avond aan — de app gokt niet meer welke avonden Merel wil.
- Ook de dagvoorkeuren (dinsdag snel, zondag prep) gaan alleen mee als die dag écht gepland is, en de badge-lijst in het antwoordformaat volgt de actieve gewoontes.
- **Mealprep-modus**: aantal verschillende gerechten en porties per maaltijd, met de noemer in beeld ("3 gerechten voor 5 maaltijden"). Het antwoord krijgt dan per dag porties, kookmoment (koken / opwarmen / ontdooien / koud) en bewaaradvies, plus de opdracht om binnen hetzelfde basisgerecht te variëren.
- `max_tokens` van 2000 naar 8000 (12000 met mealprep) — dat was de vermoedelijke oorzaak van de generieke "Er ging iets mis". Afkappen, onbereikbare API en onleesbare JSON geven nu elk een eigen melding in plaats van één stille catch.
- Prep-stappen komen als groepen per dag terug (`prep`); oudere menu's met `zondag_prep` worden nog getoond.
- Het raster, de gewoontes en de mealprep-getallen worden bij het plan bewaard (sleutel `instellingen` in de JSON, geen schemawijziging) en via `GET /api/meal-plan/settings` teruggezet. Volgende week begint dus waar deze week eindigde.
- `npm run check:mealplan` — 11 regressiegevallen op de promptopbouw in `scripts/check-mealplan.ts`. De maaltijdplanner zit achter de login en is niet met een browser te controleren; dit is de enige manier om te zien dat de server het raster volgt. De check ving meteen twee echte fouten: `0` gerechten werd stil `3` (falsy `||`), en de dagvoorkeuren noemden dagen die niet gepland waren.

**Navigatie: vier ingangen**
- `src/components/MainNav.tsx`: Vandaag (`/`), Lijst (`/lijst`), Eten (`/maaltijdplanner`), Zoeken (`/zoeken`). Op mobiel een tabbalk onderaan bij je duim, op desktop een smalle rail links. Eén badge, op Vandaag: het aantal open dingen van vandaag.
- De pagina's die uit het menu gingen zijn niet verwijderd maar staan in een "Meer"-la: contacten, agenda, gewoontes, recepten en de losse lijsten per type. Zonder die la waren ze alleen nog via de URL te vinden — en `/agenda` heb je juist nodig. De tien tijd-subitems zijn weg; `?tijd=` werkt nog als filter.
- `src/app/lijst/page.tsx` is de hoofdlijst: taken, herinneringen én notities door elkaar op tijdvak, met de categoriechips erboven. Notities krijgen een eigen sectie onderaan, want die hebben geen datum en zouden anders in "Ooit" verdwijnen.
- `ItemListView` (was `TypedItemView`) bedient zowel `/lijst` (`type="ALLE"`) als de drie typelijsten, en rekent via `bucketFor()` uit `lib/day.ts`.
- `AppShell` is een server component, zodat uitloggen via een server action kan (`SignOutForm`, hetzelfde patroon als inloggen). De oude `Sidebar.tsx` is verwijderd.

**De eerste geautomatiseerde check** — `npm run check:parse` draait 29 regressiegevallen uit `scripts/check-parse.ts` op Node's eigen TypeScript-stripping, met `scripts/alias.mjs` voor de `@/`-alias. Geen testframework toegevoegd. De check ving meteen een echte bug: de titel-opschoning knipte zonder woordgrens, dus "afval buiten zetten" werd "afval buiten zett". Hetzelfde patroon past op `day.ts` als je daar ooit aan sleutelt.

## Storing 20 augustus: inloggen ging niet meer

**Symptoom:** na het kiezen van GitHub kwam er "Server error — There is a problem with the server configuration."

**Oorzaak, uit de productielogs:** `GET /api/auth/callback/github` gooide `CallbackRouteError` met als cause `unexpected "iss" (issuer) response parameter value`, en als detail `expected: "https://authjs.dev"`. GitHub is RFC 9207 gaan gebruiken en stuurt sinds kort een `iss`-parameter mee in de callback. `oauth4webapi` vergelijkt die met de issuer van de provider (regel 2068 in de geïnstalleerde build: gooit alléén als `iss` aanwezig is en afwijkt), en `@auth/core` 0.41 zet voor GitHub geen `issuer` — dan valt hij terug op de placeholder `https://authjs.dev`. Er was dus niets aan onze kant veranderd; GitHub veranderde.

**Fix:** `GitHub({ issuer: "https://github.com/login/oauth" })` in `src/auth.ts`. Vooraf nagemeten met `parseProviders` uit het geïnstalleerde pakket: zonder die regel wordt `as.issuer` de placeholder, met die regel de waarde die GitHub meestuurt, en er komt géén discovery-verzoek bij (die tak kiest de callback alleen als `token`/`userinfo` geen echte URL hebben). Upstream staat dezelfde regel nu in de provider zelf, dus bij een latere `next-auth`-upgrade is dit dubbel in plaats van fout — **niet weghalen zonder te controleren of de nieuwe versie hem zelf zet.**

**Wat dit leert voor de volgende keer:** de foutpagina van NextAuth zegt altijd "server configuration", ongeacht de echte oorzaak. De echte fout staat alleen in de Vercel-logs:

```bash
vercel logs https://www.lifepilot.nl --json | grep "auth\]\[cause"
```

De Vercel CLI is nu aan dit project gekoppeld (`.vercel/`, staat in `.gitignore`), dus `vercel logs` en `vercel env ls production` werken zonder extra stappen.

## Wat nog open is in de code

Opgelost sinds de codereview: de meldingen die nooit afgingen, de zeven fetches op het dashboard, de tijdindeling die vijf keer bestond, de klokgok in `getDefaultFolder()`, en de uitlog-lintfout in de zijbalk.

| Wat | Waar | Status |
| --- | --- | --- |
| Het weekmenu is nog niet één keer echt gegenereerd sinds de wijziging: dat kost een API-aanroep met een echte sleutel en het schrijft een rij in Turso. De promptopbouw is met 11 gevallen nagelopen, het antwoord van het model niet. | `npm run check:mealplan`, `/maaltijdplanner` | Open — Merel proberen |
| De agenda heeft geen werkende feed en de bedachte route kan niet. | zie "De agenda: wat kan nog" | Open — beslissing aan Merel |
| Apple en Google staan als provider in de code, maar hun secrets staan niet in Vercel. Die twee knoppen op de loginpagina falen dus altijd. Voor Apple komt daar bij dat het €99/jaar kost en geen agenda-toegang oplevert. | `src/auth.ts`, `src/app/login/page.tsx`, Vercel env | Open — beslissing aan Merel |
| Stille foutafhandeling (`catch {}`) op meerdere plekken: mislukkingen zijn onzichtbaar. | o.a. `api/calendar/[folder]`, `ReminderChecker`, `api/ah-bonus` | Open |
| Microsoft-integratie is dode code: `MICROSOFT_CLIENT_ID` staat niet in `.env`, dus de provider wordt nooit geregistreerd en de statusroute zegt altijd "niet verbonden". Nu de werkagenda afvalt, kan dit weg. | `src/auth.ts`, `src/app/api/microsoft/status/route.ts`, `src/lib/microsoft-graph.ts` | Open — opruimen |
| Verversen via het zelfverzonnen window-event `item-moved`; niets controleert of alle plekken meedoen. | `MainNav`, `FolderView`, `ItemListView`, `QuickAdd` | Later |
| Geen tests op de tijdindeling (randgevallen: achterstallig, herhalend, jaargrens). De dump-parser heeft er 29, de weekmenu-invoer 11. | `scripts/check-parse.ts` als voorbeeld | Later |
| Bijlagen als `Bytes` in Turso (tot 10 MB per bestand). | `prisma/schema.prisma`, `api/attachments` | Later |
| Geen `userId` op inhoudelijke modellen; alle data is gedeeld tussen inloggers. | `prisma/schema.prisma` | Later |
| Schemawijzigingen gaan handmatig via `schema.sql` naar Turso; geen migratiegeschiedenis. | `prisma.config.ts`, `add-contacts.sql` als voorbeeld | Later |

## Bekend en bewust laten liggen

- **De navigatie is niet visueel nagekeken.** Alles zit achter de OAuth-login, dus een browsercheck kan hier niet. Typecheck en build zijn groen, maar kijk zelf op je telefoon of de vaste kop en de tabbalk niets afsnijden; de marges zitten in `pt-20 pb-24` in `AppShell.tsx`.
- `next-auth` zit op `5.0.0-beta.30` (een beta, met een caret-range in `package.json`). `package-lock.json` staat in git en Vercel bouwt met `npm ci`, dus builds zijn reproduceerbaar — zonder die lockfile zou een nieuwe beta ongemerkt mee kunnen komen. De beta-tag staat inmiddels op `.32`; upgraden kan de GitHub-issuer-regel overbodig maken, maar doe dat als losse stap en test inloggen daarna.
- Eén lintfout in een bestand dat bij geen van deze stappen hoort: `ServiceWorkerRegistration.tsx` (functie gebruikt vóór declaratie). `npm run lint` is dus nooit helemaal groen.
- Op de ochtendkaart staat nog geen dumpveld. Nu de tabbalk er is, is de logische stap één "+" in die balk die overal het veld opent, in plaats van drie losse velden op de lijstpagina's.
- `FolderView` (`/folder/[folder]`) heeft nog de oude knop met de modal en geen dumpveld. Die route staat niet meer in het menu en kan waarschijnlijk vervallen zodra de categoriefilter in `/lijst` genoeg blijkt.
- `ItemListView` en `FolderView` groeperen client-side. Ze gebruiken wel de gedeelde helpers, dus ze kunnen niet meer van het menu afwijken.

## Kleine vragen die onderweg mogen worden beslist

1. Mag de app zeuren over de dumplijst ("5 dingen zonder datum")? Items zonder datum staan nu onder "Ooit" en niemand wijst er ooit naar.
2. Een uur van 1 t/m 7 zonder dagdeel leest de parser als 's middags ("6u" → 18:00). Als dat in de praktijk vaker misgaat dan goed gaat, draaien we die regel om.
3. Is de "Meer"-la de juiste oplossing, of moet er echt niets naast de vier ingangen staan?

## Volgorde voor het vervolg

1. **Agenda beslissen** — de vier opties hierboven. Dit is nu het grootste ding, want de tijdlijn is het onderscheidende deel van de visie en die staat leeg.
2. **Dumpen vanaf elk scherm** — de "+" in de tabbalk, zodat het dumpveld niet aan de lijstpagina's hangt.
3. Foutmeldingen en bevestigingen overal zichtbaar maken; de `catch {}`-plekken opruimen.
4. Dode Microsoft-code verwijderen — **wacht hiermee** tot de agenda beslist is: bij optie 3 is dit juist de code die je nodig hebt.

Daarna niets meer bouwen tot de meetlat uit de visie een antwoord heeft: tikt ze de ochtendmelding aan?

## Sessielog

- **20 aug 2026 (v9)** — Weekmenu flexibel gemaakt: promptopbouw naar `src/lib/meal-plan-input.ts`, restjes en frietjes als verplaatsbare gewoontes, mealprep-modus met porties en bewaaradvies, `max_tokens` omhoog, eigen foutmelding per faalpad, instellingen die vorige week onthouden, plus `npm run check:mealplan` met 11 gevallen. Daarna bleek uit een vraag van Merel dat de agenda-aanname niet klopt: geen van haar twee agenda's kan ze zelf delen. De agenda-opties staan nu bovenaan als besluit, en het antwoord op "kan inloggen met Apple de agenda lezen" is nee.
- **20 aug 2026 (v8)** — Inloggen lag plat. Oorzaak uit de productielogs gehaald (GitHub + RFC 9207 versus de placeholder-issuer in `@auth/core`), fix van één regel in `src/auth.ts` nagemeten en uitgerold. Onderweg gezien dat Apple en Google geen secrets hebben in Vercel. Vercel CLI aan het project gekoppeld.
- **19 aug 2026 (v7)** — Handover herschreven: drie losse "Gebouwd op 19 augustus"-secties samengevoegd tot één "Wat er nu staat", opgeloste bevindingen uit de tabel gehaald, het werk voor Merel bovenaan gezet en de volgorde opnieuw genummerd. Geen codewijzigingen.
- **19 aug 2026 (v6)** — Navigatie naar vier ingangen: `MainNav` met tabbalk en rail, "Meer"-la voor de pagina's die uit het menu gingen, nieuwe `/lijst` met alle types op één tijdlijn, `TypedItemView` → `ItemListView` op de gedeelde tijdindeling, `AppShell` als server component met uitloggen via een server action, `Sidebar.tsx` verwijderd. Contacttabel in Turso nagekeken.
- **19 aug 2026 (v5)** — Dump-invoer gebouwd: Nederlandse parser met 29 regressiegevallen (`npm run check:parse`), `QuickAdd` met zichtbare preview bovenaan de lijsten, categorie-chips, ongedaan maken, en `CreateItemModal` als escape met voorgevulde titel. Dag- en maandnamen naar `day.ts` gehaald.
- **19 aug 2026 (v4)** — Ochtendkaart gebouwd en gepusht: gedeelde tijdmodule met tijdzone-fix, `/api/today`, server-gerenderd Vandaag-scherm, werkende ochtend-push. Daarna contacten toegevoegd op verzoek: verjaardagen op de kaart en in de push, plus een opt-in "even laten weten"-herinnering.
- **19 aug 2026 (v3)** — Jannie Meppel = vrijwilligerswerk, dus blijft een categorie zonder extra functies. Weekmenu: aantal dagen wordt per week door Merel gekozen, geen instelling. Werk-to-do's blijven in de app (alleen de werkagenda valt af).
- **19 aug 2026 (v2)** — Jannie Meppel blijkt een bedrijfje (bijklus), niet een persoon om voor te zorgen. Weekmenu-eisen bijgesteld (flexibele dagen, mealprep). Bij het nakijken bleek de server het dagenraster te overschrijven en is de credits-hypothese vervangen door `max_tokens`.
- **19 aug 2026** — `CLAUDE.md` geschreven (architectuur, commands, Turso/Prisma-eigenaardigheden). Gesprek over richting, codereview, productvisie opgesteld en als artifact gepubliceerd. `HANDOVER.md` aangemaakt.
