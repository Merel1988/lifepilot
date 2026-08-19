# Handover — waar staan we

Bijwerken aan het eind van elke sessie. Lees dit samen met `CLAUDE.md` voordat je begint.

**Laatst bijgewerkt:** 19 augustus 2026 (v6 — navigatie naar vier ingangen)
**Fase:** bouwen. Ochtendkaart, contacten, dump-invoer en de vier ingangen staan er. Het flexibele weekmenu is het grote stuk dat nog open is.

## Aanleiding

Merel gebruikt de app weinig en wist niet of dat kwam door bugs, door de UX, of doordat de app de verkeerde dingen doet. Conclusie na een gesprek en een codereview: alle drie een beetje, maar de kern is dat **de app geen taak heeft in haar dag** — hij is passief en vraagt veel bij het invoeren.

De volledige visie staat in de artifact `Waarvoor is LifePilot er?` (privé gepubliceerd, link in de sessie van 19 aug). Hieronder de samenvatting die je nodig hebt om verder te werken.

## De visie in vijf regels

1. De app wordt gebouwd rond **drie momenten**: de ochtendkaart (07:00, 30 sec), de dump (onderweg, 2 tikken), het weekmenu (zondag, 15 min).
2. Belangrijkste UI-idee: **agenda-afspraken en taken door elkaar op één tijdlijn** op het Vandaag-scherm. Dat bestaat nu niet en is het enige dat geen andere app voor haar doet.
3. Menu gaat van tien ingangen (+ tien tijd-subitems) naar **vier**: Vandaag, Lijst, Eten, Zoeken. Op mobiel een tabbalk onderaan, op desktop een smalle zijbalk.
4. Invoeren wordt **één tekstveld met natuurlijke taal** ("morgen 9u tandarts"), geen modal met acht velden. Type, map en herhaling verdwijnen uit het invoerscherm.
5. Meetlat over vier weken: **tikt ze de ochtendmelding aan?** Zo nee, dan is de aanname fout en gaan we niet doorbouwen.

## Vastgesteld in het gesprek

- **Werkagenda (Microsoft 365) valt af.** Merel verwacht geen toestemming van IT. De ochtendkaart gaat dus over "wat staat er vandaag *naast* je werk". Nog wel te proberen: de "agenda publiceren"-functie in Outlook web (Instellingen → Agenda → Gedeelde agenda's), die een ICS-link geeft zonder IT.
- **iCloud-agenda is de agenda die het moet worden**, via een openbare `webcal://`-deellink. De bestaande ICS-parser kan dit al aan.
- **De indeling Privé / Werk / Jannie Meppel moet anders.** Mappen worden optionele labels: geen verplichte keuze bij invoeren, geen menu-items, blijven bestaan als filter in zoeken.
- **Jannie Meppel is een bedrijfje** waar Merel naast haar werk af en toe klussen voor doet. Jannie Meppel heeft nergens anders een systeem, dus daar is de app de enige plek; loondienst-werk heeft dat wel (Outlook, mail) en wordt aangevuld, niet vervangen. **Beslist:** het is vrijwilligerswerk, geen uren of facturen. Dus gewoon een categorie, geen eigen module.
- **Alle drie de categorieën blijven** — Merel wil ook werk-to-do's in de app. Let op het onderscheid: de werk*agenda* valt af (Microsoft), werk*taken* niet. Wat verandert: geen drie menupagina's meer (wordt een filter bovenaan de lijst: Alles · Privé · Werk · Jannie), geen dropdown in een formulier (wordt drie chips onder het invoerveld, optioneel, plus een voorstel op basis van de tekst), en **de tijdgok verdwijnt** — `getDefaultFolder()` zet nu ma–do 08:00–16:00 stil alles op WERK, wat privé-items onzichtbaar verkeerd labelt. Op de ochtendkaart een klein categoriemerkje per regel.
- **Het weekmenu moet losser.** Frietjes op vrijdag en restjes op donderdag zijn gewoontes, geen wetten: niet elke week, en restjes niet altijd op donderdag. **Beslist:** Merel bepaalt per week zelf hoeveel/welke avonden ze een menu wil — geen vaste instelling en geen aanname. Het gekozen aantal is meteen de noemer voor mealprep ("3 gerechten voor 5 avonden"). Ze wil (leren) mealpreppen: minder verschillende gerechten voor meer dagen, met porties, kookmomenten, bewaaradvies en variatie binnen hetzelfde gerecht.
- **Nu single-user**, later misschien haar partner erbij. Geen voorbereidend werk daarvoor, wel geen keuzes maken die het blokkeren.

## Bevindingen in de code (nagetrokken, niet gerepareerd)

| Wat | Waar | Status |
| --- | --- | --- |
| Meldingen gaan praktisch nooit af: cron draait 1×/dag om 07:00, maar de route zoekt herinneringen in een venster van 5 minuten. Het tweede pad (`ReminderChecker`) werkt alleen met de app open. | `vercel.json`, `src/app/api/push/send/route.ts`, `src/components/ReminderChecker.tsx` | Opgelost (v4) — de cron stuurt nu de ochtendkaart |
| Microsoft-integratie is dode code: `MICROSOFT_CLIENT_ID` staat niet in `.env`, dus de provider wordt nooit geregistreerd. De statusroute zegt daarom altijd "niet verbonden". | `src/auth.ts:12`, `src/app/api/microsoft/status/route.ts` | Vervalt (zie boven) |
| Maaltijdplanner faalt, **niet** door credits: de route geeft API-fouten wél netjes terug en `MealPlanner` toont ze. Waarschijnlijker `max_tokens: 2000` — een weekmenu met notities, prep-stappen en boodschappenlijst past daar niet in, waarna `JSON.parse` faalt en je de generieke "Er ging iets mis" ziet. Met mealprep wordt het antwoord langer, dus moet dit omhoog. | `src/app/api/meal-plan/generate/route.ts:181` | Open — prio 1 |
| **De server overschrijft het dagenraster.** `mealGrid` bestaat al in de UI (7 dagen × 3 maaltijden), maar regels 114–115 pushen donderdag-restjes en vrijdag-frietjes ongeacht de vinkjes, en `getDefaultMealGrid()` zet die twee dagen standaard uit. Hardcoded op 7 plekken: systeemprompt (17, 18, 58, 59), dagenlijst (114, 115), userText (167). Alle zeven moeten zacht worden. | `src/app/api/meal-plan/generate/route.ts`, `src/components/MealPlanner.tsx:45` | Open — prio 1 |
| Tijdindeling (vandaag/deze week/…) was **vijf keer** geïmplementeerd. Belangrijkste bron van "menu zegt 3, lijst toont 2". | nu `src/lib/day.ts` | Opgelost (v4) — alleen `TypedItemView` rekent nog zelf, maar wel met dezelfde grenzen |
| Dashboard deed 7 parallelle fetches en filterde client-side. | `Dashboard.tsx` (verwijderd), `src/app/api/today` | Opgelost (v4) |
| Stille foutafhandeling (`catch {}`) op meerdere plekken: mislukkingen zijn onzichtbaar. | o.a. `api/calendar/[folder]`, `ReminderChecker`, `api/ah-bonus` | Open |
| Verversen via zelfverzonnen window-event `item-moved`; niets controleert of alle plekken meedoen. | `MainNav`, `FolderView`, `ItemListView`, `QuickAdd` | Later |
| Geen tests, ook niet op de tijdindeling (wel randgevallen: achterstallig, herhalend, jaargrens). | `scripts/check-parse.ts` | Deels (v5) — de dump-parser heeft 29 gevallen via `npm run check:parse`; hetzelfde patroon past op `day.ts` |
| Bijlagen als `Bytes` in Turso (tot 10 MB per bestand). | `prisma/schema.prisma`, `api/attachments` | Later |
| Geen `userId` op inhoudelijke modellen; alle data gedeeld tussen inloggers. | `prisma/schema.prisma` | Later |
| Schemawijzigingen gaan handmatig via `schema.sql` naar Turso; geen migratiegeschiedenis. | `prisma.config.ts`, `add-missing-tables.sql` | Later |

## Openstaande vragen aan Merel

Alle grote vragen zijn beantwoord. Wat resteert is klein genoeg om onderweg te beslissen:

1. Mag de app zeuren over de dumplijst ("5 dingen zonder datum")? — nog open. Items zonder datum komen nu onder "Ooit" te staan en niemand wijst er ooit naar.
2. ~~Beginnen bij de ochtendkaart of bij de dump?~~ Ochtendkaart eerst, dump daarna; beide gebouwd.
3. Nog te testen: staat "agenda publiceren" aan in Outlook web? Zo ja, dan kan de werkagenda er alsnog in.
4. Nieuw, klein: een uur van 1 t/m 7 zonder dagdeel leest de parser als 's middags ("6u" → 18:00). Als dat in de praktijk vaker misgaat dan goed gaat, draaien we die regel om.

## ⚠️ Nog te doen door Merel

De contacttabel staat in Turso (19 aug gedraaid en nagekeken: tabel, index en alle dertien kolommen kloppen met het model). Wat resteert:

- **iCloud-agenda koppelen** via `/agenda` (Agenda op de Mac → rechtsklik agenda → Delen → Openbare agenda → `webcal://`-link kopiëren). Zonder feed blijft de tijdlijn op de ochtendkaart leeg, en dat is juist het idee van dat scherm.
- **Contacten invoeren** op `/contacten`; zonder rijen blijven de secties "Verjaardagen" en "Even laten weten" weg.

## Gebouwd op 19 augustus 2026

**De ochtendkaart** (`/`, was het dashboard)
- `src/lib/day.ts` is nu de enige implementatie van "welke dag is het" en "in welk tijdvak hoort dit". Leidt de dag af in `Europe/Amsterdam` in plaats van de UTC-klok van de server (dat was rond middernacht stil verkeerd) en vergelijkt datums als `YYYY-MM-DD`-strings. `types.ts`, `folders.ts` en `/api/item-counts` delegeren er nu naartoe, dus de menu-aantallen en de lijsten kunnen niet meer van elkaar afwijken.
- `src/lib/today.ts` stelt de kaart server-side samen; `page.tsx` rendert met de data al in handen, dus geen spinner en geen zeven parallelle fetches meer.
- `src/components/TodayView.tsx`: afspraken en taken door elkaar op één tijdlijn met een nu-streep, samenvattingsregel bovenaan, maaltijd van vandaag uit het weekmenu, achterstallig ingeklapt onderaan met "Naar morgen"-knop, hele regel aantikbaar, optimistisch afvinken met terugdraaien bij fouten, zichtbare foutmeldingen.
- `src/lib/calendar.ts`: agenda-ophalen uit de route gehaald en meldt nu wélke feed faalde in plaats van stil overslaan.
- `Dashboard.tsx` is verwijderd (alleen `page.tsx` gebruikte het; `/taken` en `/herinneringen` dekken de lijsten).
- `getDefaultFolder()` gokt niet meer WERK op kantooruren.

**Meldingen** — `/api/push/send` stuurt nu de ochtendkaart, passend bij de cron van één keer per dag. Daarvoor vuurde de cron om 07:00 terwijl de route zocht naar herinneringen in de komende vijf minuten, dus er kwam nooit iets aan. `?mode=due` houdt het pad per herinnering beschikbaar voor een externe pinger. Cron staat op `0 6 * * *` = 08:00 CEST / 07:00 CET.

**Contacten** (nieuw, `/contacten`)
- `Contact`-model: naam, telefoon, e-mail, adres, verjaardag als losse dag/maand/jaar (jaar optioneel, want een verjaardag zonder geboortejaar moet kunnen), notities, `keepInTouchWeeks`, `lastContactAt`.
- `src/lib/contacts.ts`: eerstvolgende verjaardag (29 februari schuift naar 1 maart), zeven dagen vooruitkijken, en wie aan de beurt is voor een berichtje.
- Op de ochtendkaart: sectie "Verjaardagen" (vandaag + komende week) en "Even laten weten" met één knop "Gesproken" die de teller terugzet.
- In de push: een verjaardag van vandaag krijgt een **eigen** melding, want die verdrinkt in een samenvattingsregel.
- Interval is opt-in per persoon: leeg betekent geen herinnering. De app zeurt niet ongevraagd over iedereen.

## Gebouwd op 19 augustus 2026 (tweede sessie)

**De dump-invoer** — één tekstveld in plaats van een modal met acht velden
- `src/lib/parse-input.ts`: `parseQuickInput()` leest Nederlandse taal en geeft titel, type, datum, tijd, categorie en herhaling terug. Begrijpt onder andere `morgen 9u tandarts`, `vrijdag boodschappen`, `volgende week maandag`, `over 3 dagen`, `15 september`, `15-9`, `31/12/2026`, `elke maandag`, `iedere werkdag`, `elke di en do`, `half 10`, `kwart voor 8`, `19u30`, `vanavond`, `morgenochtend`, `notitie: ...` en `#werk`. De functie is puur: `parseQuickInput(text, { today })`, dus zonder tijdzone-verrassingen te controleren.
- `src/components/QuickAdd.tsx`: het veld staat vast bovenaan elke lijst, met daaronder een preview die toont wát er gemaakt wordt. De parser gokt wel, maar nooit stil — dat is het hele punt. Datum en tijd zijn in de preview aan te tikken en te overschrijven, de drie categorieën staan als chips (voorgesteld op basis van woorden in de tekst, nooit op basis van de klok). Enter voegt toe, de focus blijft staan voor het volgende dingetje, en na toevoegen staat er een regel met "Ongedaan maken".
- "Meer velden" opent het oude `CreateItemModal` met de getypte tekst al als titel, voor de gevallen met een omschrijving of bijlage. De grote "Nieuw item"-knop is weg.
- Type komt uit de tekst: een tijd maakt het een herinnering (alleen die kan een melding sturen), `notitie:` een notitie, anders het type van de lijst waar je staat.

**Eerste geautomatiseerde check in dit project** — `npm run check:parse` draait 29 regressiegevallen uit `scripts/check-parse.ts` op Node's eigen TypeScript-stripping, met `scripts/alias.mjs` voor de `@/`-alias. Geen testframework toegevoegd. De check ving meteen een echte bug: de titel-opschoning haalde losse verbindingswoordjes zonder woordgrens weg, dus "afval buiten zetten" werd "afval buiten zett" en "kopen" werd "k".

**Opruimwerk** — de Nederlandse dag- en maandnamen plus `formatDayLong`, `formatDayShort` en `relativeDayLabel` staan nu in `src/lib/day.ts`; `TodayView` had zijn eigen kopie en zijn eigen `tomorrow()` en gebruikt nu de gedeelde versie.

## Gebouwd op 19 augustus 2026 (derde sessie)

**Navigatie: van tien ingangen naar vier**
- `src/components/MainNav.tsx`: Vandaag (`/`), Lijst (`/lijst`), Eten (`/maaltijdplanner`), Zoeken (`/zoeken`). Op mobiel een tabbalk onderaan bij je duim, op desktop een smalle rail links. Op Vandaag staat één badge: het aantal open dingen van vandaag — de enige plek in de app waar een aantal iets betekent.
- De oude pagina's zijn niet verwijderd maar verhuisd naar een "Meer"-la: contacten, agenda, gewoontes, recepten, en de losse lijsten per type. Zonder die la waren ze alleen nog via de URL te vinden. De tien tijd-subitems in het menu zijn weg; `?tijd=` werkt nog wel als filter.
- `src/app/lijst/page.tsx` is de nieuwe hoofdlijst: één pagina met álles (taken, herinneringen én notities) gegroepeerd op tijdvak, met de categoriechips erboven. Notities krijgen een eigen sectie onderaan, want die hebben geen datum en zouden anders bij "Ooit" verdwijnen.
- `TypedItemView` heet nu `ItemListView` en bedient zowel `/lijst` (`type="ALLE"`) als de drie typelijsten. Bij die verhuizing is de laatste eigen tijdberekening eruit gegaan: hij gebruikt nu `bucketFor()` uit `lib/day.ts`, zoals de badges en de ochtendkaart. Daarmee is de "vijf keer geïmplementeerd"-bevinding helemaal afgesloten.
- `AppShell` is een server component geworden, zodat uitloggen via een server action kan (`SignOutForm`, hetzelfde patroon als inloggen). De oude `Sidebar.tsx` is verwijderd; daarmee is ook die lintfout weg.

## Bekend en bewust laten liggen

- Nog één lintfout, in een bestand dat niet bij dit werk hoort: `ServiceWorkerRegistration.tsx` (functie gebruikt vóór declaratie). De uitlog-lintfout in `Sidebar.tsx` is weg met de zijbalk zelf.
- `FolderView` (`/folder/[folder]`) heeft nog de oude knop met de modal en geen dumpveld. Die route staat niet meer in het menu; hij kan waarschijnlijk vervallen zodra de categoriefilter in `/lijst` genoeg blijkt.
- De navigatie is **niet visueel nagekeken**: alles achter de login zit, dus een browsercheck kan hier niet. Typecheck en build zijn groen, maar kijk zelf of de tabbalk en de vaste kop op je telefoon goed staan.
- Op de ochtendkaart staat nog geen dumpveld. Nu de tabbalk er is, is de logische volgende stap één "+" in de tabbalk die overal het dumpveld opent, in plaats van drie losse velden op de lijstpagina's.
- `TypedItemView` en `FolderView` groeperen nog client-side; ze gebruiken wel de gedeelde helpers, dus ze kunnen niet meer afwijken van het menu.

## Volgorde voor het vervolg

1. ~~Meldingen echt laten werken~~ ✅
2. ~~`/api/today`~~ ✅
3. ~~Vandaag-scherm~~ ✅ — en contacten met verjaardagen erbij
4. ~~Dump-invoer~~ ✅
5. ~~Navigatie terugbrengen naar vier ingangen~~ ✅
6. **Weekmenu flexibel maken** — de 7 hardcoded plekken eruit, vaste dagen worden optionele vinkjes met een dagkeuze, `max_tokens` omhoog, raster onthoudt vorige week. Daarna **mealprep-modus**: invoer voor aantal gerechten + porties, en een uitgebreider antwoordformaat met kookmomenten, porties en bewaaradvies.
7. **iCloud-agenda** aansluiten en de Outlook-publicatielink testen.
8. Foutmeldingen en bevestigingen overal zichtbaar maken.

## Sessielog

- **19 aug 2026 (v6)** — Navigatie naar vier ingangen: `MainNav` met tabbalk en rail, "Meer"-la voor de pagina's die uit het menu gingen, nieuwe `/lijst` met alle types op één tijdlijn, `TypedItemView` → `ItemListView` op de gedeelde tijdindeling, `AppShell` als server component met uitloggen via een server action, `Sidebar.tsx` verwijderd. Contacttabel in Turso nagekeken.
- **19 aug 2026 (v5)** — Dump-invoer gebouwd: Nederlandse parser met 29 regressiegevallen (`npm run check:parse`), `QuickAdd` met zichtbare preview bovenaan de lijsten, categorie-chips, ongedaan maken, en `CreateItemModal` als escape met voorgevulde titel. Dag- en maandnamen naar `day.ts` gehaald.
- **19 aug 2026 (v4)** — Ochtendkaart gebouwd en gepusht: gedeelde tijdmodule met tijdzone-fix, `/api/today`, server-gerenderd Vandaag-scherm, werkende ochtend-push. Daarna contacten toegevoegd op verzoek: verjaardagen op de kaart en in de push, plus een opt-in "even laten weten"-herinnering. Turso-migratie (`add-contacts.sql`) moet Merel nog draaien.
- **19 aug 2026 (v3)** — Jannie Meppel = vrijwilligerswerk, dus blijft een categorie zonder extra functies. Weekmenu: aantal dagen wordt per week door Merel gekozen, geen instelling. Werk-to-do's blijven in de app (alleen de werkagenda valt af). Richting staat vast; klaar om te bouwen zodra er groen licht is.
- **19 aug 2026 (v2)** — Jannie Meppel blijkt een bedrijfje (bijklus), niet een persoon om voor te zorgen: wordt het belangrijkste label, Werk het minst belangrijke. Weekmenu-eisen bijgesteld (flexibele dagen, mealprep). Bij het nakijken bleek de server het dagenraster te overschrijven en is de credits-hypothese vervangen door `max_tokens`. Visie-artifact bijgewerkt naar v2.
- **19 aug 2026** — `CLAUDE.md` geschreven (architectuur, commands, Turso/Prisma-eigenaardigheden). Gesprek over richting, codereview, productvisie opgesteld en als artifact gepubliceerd. `HANDOVER.md` aangemaakt. Geen functionele wijzigingen.
