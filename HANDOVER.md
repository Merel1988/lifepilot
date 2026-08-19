# Handover — waar staan we

Bijwerken aan het eind van elke sessie. Lees dit samen met `CLAUDE.md` voordat je begint.

**Laatst bijgewerkt:** 19 augustus 2026 (v3 — richting staat vast)
**Fase:** denkfase / productvisie. Er is nog **geen** functionele code gewijzigd.

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
| Meldingen gaan praktisch nooit af: cron draait 1×/dag om 07:00, maar de route zoekt herinneringen in een venster van 5 minuten. Het tweede pad (`ReminderChecker`) werkt alleen met de app open. | `vercel.json`, `src/app/api/push/send/route.ts`, `src/components/ReminderChecker.tsx` | Open |
| Microsoft-integratie is dode code: `MICROSOFT_CLIENT_ID` staat niet in `.env`, dus de provider wordt nooit geregistreerd. De statusroute zegt daarom altijd "niet verbonden". | `src/auth.ts:12`, `src/app/api/microsoft/status/route.ts` | Vervalt (zie boven) |
| Maaltijdplanner faalt, **niet** door credits: de route geeft API-fouten wél netjes terug en `MealPlanner` toont ze. Waarschijnlijker `max_tokens: 2000` — een weekmenu met notities, prep-stappen en boodschappenlijst past daar niet in, waarna `JSON.parse` faalt en je de generieke "Er ging iets mis" ziet. Met mealprep wordt het antwoord langer, dus moet dit omhoog. | `src/app/api/meal-plan/generate/route.ts:181` | Open — prio 1 |
| **De server overschrijft het dagenraster.** `mealGrid` bestaat al in de UI (7 dagen × 3 maaltijden), maar regels 114–115 pushen donderdag-restjes en vrijdag-frietjes ongeacht de vinkjes, en `getDefaultMealGrid()` zet die twee dagen standaard uit. Hardcoded op 7 plekken: systeemprompt (17, 18, 58, 59), dagenlijst (114, 115), userText (167). Alle zeven moeten zacht worden. | `src/app/api/meal-plan/generate/route.ts`, `src/components/MealPlanner.tsx:45` | Open — prio 1 |
| Tijdindeling (vandaag/deze week/…) is **vijf keer** geïmplementeerd. Belangrijkste bron van "menu zegt 3, lijst toont 2". | `src/lib/folders.ts`, `src/lib/types.ts`, `Dashboard.tsx`, `TypedItemView.tsx`, `api/item-counts/route.ts` | Open — prio 1 |
| Dashboard doet 7 parallelle fetches en filtert client-side. Eén `/api/today`-endpoint vervangt dit. | `src/components/Dashboard.tsx` | Open |
| Stille foutafhandeling (`catch {}`) op meerdere plekken: mislukkingen zijn onzichtbaar. | o.a. `api/calendar/[folder]`, `ReminderChecker`, `api/ah-bonus` | Open |
| Verversen via zelfverzonnen window-event `item-moved`; niets controleert of alle plekken meedoen. | `Sidebar`, `Dashboard`, `FolderView`, `TypedItemView` | Later |
| Geen tests, ook niet op de tijdindeling (wel randgevallen: achterstallig, herhalend, jaargrens). | — | Later |
| Bijlagen als `Bytes` in Turso (tot 10 MB per bestand). | `prisma/schema.prisma`, `api/attachments` | Later |
| Geen `userId` op inhoudelijke modellen; alle data gedeeld tussen inloggers. | `prisma/schema.prisma` | Later |
| Schemawijzigingen gaan handmatig via `schema.sql` naar Turso; geen migratiegeschiedenis. | `prisma.config.ts`, `add-missing-tables.sql` | Later |

## Openstaande vragen aan Merel

Alle grote vragen zijn beantwoord. Wat resteert is klein genoeg om onderweg te beslissen:

1. Mag de app zeuren over de dumplijst ("5 dingen zonder datum")?
2. Beginnen bij de ochtendkaart of bij de dump? (Advies: ochtendkaart — makkelijk invoeren helpt niet zolang je nog aan de app moet denken.)
3. Nog te testen: staat "agenda publiceren" aan in Outlook web? Zo ja, dan kan de werkagenda er alsnog in.

## Volgorde als er groen licht is

1. **Meldingen echt laten werken** — cron-venster en route op één lijn brengen, plus een ochtendsamenvatting om 07:00. Zonder dit blijft de app passief.
2. **`/api/today`** bouwen: één endpoint, één tijdindeling, server-side. Vervangt de 7 fetches en de 5 duplicaten.
3. **Vandaag-scherm** met gemengde tijdlijn, samenvattingsregel, achterstallig ingeklapt onderaan.
4. **Dump-invoer** met natuurlijke taal + zichtbare parse-preview, vast bovenaan de lijst.
5. **Navigatie terugbrengen** naar vier ingangen; oude pagina's blijven bestaan maar uit het menu.
6. **Weekmenu flexibel maken** — de 7 hardcoded plekken eruit, vaste dagen worden optionele vinkjes met een dagkeuze, `max_tokens` omhoog, raster onthoudt vorige week. Daarna **mealprep-modus**: invoer voor aantal gerechten + porties, en een uitgebreider antwoordformaat met kookmomenten, porties en bewaaradvies.
7. **iCloud-agenda** aansluiten en de Outlook-publicatielink testen.
8. Foutmeldingen en bevestigingen overal zichtbaar maken.

## Sessielog

- **19 aug 2026 (v3)** — Jannie Meppel = vrijwilligerswerk, dus blijft een categorie zonder extra functies. Weekmenu: aantal dagen wordt per week door Merel gekozen, geen instelling. Werk-to-do's blijven in de app (alleen de werkagenda valt af). Richting staat vast; klaar om te bouwen zodra er groen licht is.
- **19 aug 2026 (v2)** — Jannie Meppel blijkt een bedrijfje (bijklus), niet een persoon om voor te zorgen: wordt het belangrijkste label, Werk het minst belangrijke. Weekmenu-eisen bijgesteld (flexibele dagen, mealprep). Bij het nakijken bleek de server het dagenraster te overschrijven en is de credits-hypothese vervangen door `max_tokens`. Visie-artifact bijgewerkt naar v2.
- **19 aug 2026** — `CLAUDE.md` geschreven (architectuur, commands, Turso/Prisma-eigenaardigheden). Gesprek over richting, codereview, productvisie opgesteld en als artifact gepubliceerd. `HANDOVER.md` aangemaakt. Geen functionele wijzigingen.
