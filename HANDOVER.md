# Handover — waar staan we

Bijwerken aan het eind van elke sessie. Lees dit samen met `CLAUDE.md` voordat je begint.

**Laatst bijgewerkt:** 19 augustus 2026
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
- **De indeling Privé / Werk / Jannie Meppel moet anders.** Voorstel: optionele labels achteraf, geen verplichte keuze bij invoeren en geen menu-items. Open vraag: wat *is* Jannie Meppel — een categorie of een persoon voor wie ze dingen bijhoudt? Dat verschil bepaalt het ontwerp.
- **Nu single-user**, later misschien haar partner erbij. Geen voorbereidend werk daarvoor, wel geen keuzes maken die het blokkeren.

## Bevindingen in de code (nagetrokken, niet gerepareerd)

| Wat | Waar | Status |
| --- | --- | --- |
| Meldingen gaan praktisch nooit af: cron draait 1×/dag om 07:00, maar de route zoekt herinneringen in een venster van 5 minuten. Het tweede pad (`ReminderChecker`) werkt alleen met de app open. | `vercel.json`, `src/app/api/push/send/route.ts`, `src/components/ReminderChecker.tsx` | Open |
| Microsoft-integratie is dode code: `MICROSOFT_CLIENT_ID` staat niet in `.env`, dus de provider wordt nooit geregistreerd. De statusroute zegt daarom altijd "niet verbonden". | `src/auth.ts:12`, `src/app/api/microsoft/status/route.ts` | Vervalt (zie boven) |
| Maaltijdplanner faalt, vermoedelijk door Anthropic-credits. De fout wordt niet naar de gebruiker vertaald. | `src/app/api/meal-plan/generate/route.ts` | Open — eerst verifiëren |
| Tijdindeling (vandaag/deze week/…) is **vijf keer** geïmplementeerd. Belangrijkste bron van "menu zegt 3, lijst toont 2". | `src/lib/folders.ts`, `src/lib/types.ts`, `Dashboard.tsx`, `TypedItemView.tsx`, `api/item-counts/route.ts` | Open — prio 1 |
| Dashboard doet 7 parallelle fetches en filtert client-side. Eén `/api/today`-endpoint vervangt dit. | `src/components/Dashboard.tsx` | Open |
| Stille foutafhandeling (`catch {}`) op meerdere plekken: mislukkingen zijn onzichtbaar. | o.a. `api/calendar/[folder]`, `ReminderChecker`, `api/ah-bonus` | Open |
| Verversen via zelfverzonnen window-event `item-moved`; niets controleert of alle plekken meedoen. | `Sidebar`, `Dashboard`, `FolderView`, `TypedItemView` | Later |
| Geen tests, ook niet op de tijdindeling (wel randgevallen: achterstallig, herhalend, jaargrens). | — | Later |
| Bijlagen als `Bytes` in Turso (tot 10 MB per bestand). | `prisma/schema.prisma`, `api/attachments` | Later |
| Geen `userId` op inhoudelijke modellen; alle data gedeeld tussen inloggers. | `prisma/schema.prisma` | Later |
| Schemawijzigingen gaan handmatig via `schema.sql` naar Turso; geen migratiegeschiedenis. | `prisma.config.ts`, `add-missing-tables.sql` | Later |

## Openstaande vragen aan Merel

1. Wat is Jannie Meppel — categorie of persoon?
2. Gaat er geld naar de Anthropic-credits voor het weekmenu?
3. Mag de app zeuren over de dumplijst ("5 dingen zonder datum")?
4. Klopt "naast je werk" als gebied van de app?
5. Beginnen bij de ochtendkaart of bij de dump? (Advies: ochtendkaart.)

## Volgorde als er groen licht is

1. **Meldingen echt laten werken** — cron-venster en route op één lijn brengen, plus een ochtendsamenvatting om 07:00. Zonder dit blijft de app passief.
2. **`/api/today`** bouwen: één endpoint, één tijdindeling, server-side. Vervangt de 7 fetches en de 5 duplicaten.
3. **Vandaag-scherm** met gemengde tijdlijn, samenvattingsregel, achterstallig ingeklapt onderaan.
4. **Dump-invoer** met natuurlijke taal + zichtbare parse-preview, vast bovenaan de lijst.
5. **Navigatie terugbrengen** naar vier ingangen; oude pagina's blijven bestaan maar uit het menu.
6. **iCloud-agenda** aansluiten en de Outlook-publicatielink testen.
7. Foutmeldingen en bevestigingen overal zichtbaar maken.

## Sessielog

- **19 aug 2026** — `CLAUDE.md` geschreven (architectuur, commands, Turso/Prisma-eigenaardigheden). Gesprek over richting, codereview, productvisie opgesteld en als artifact gepubliceerd. `HANDOVER.md` aangemaakt. Geen functionele wijzigingen.
