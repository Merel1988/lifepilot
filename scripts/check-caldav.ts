/**
 * Regressiegevallen voor de CalDAV-client. Draaien met `npm run check:caldav`.
 *
 * Er gaat hier geen verkeer over de lijn: de antwoorden hieronder zijn de vormen
 * die iCloud teruggeeft, inclusief de dingen die makkelijk misgaan — wisselende
 * namespace-prefixen, een verhuizing naar een andere host, taken- en
 * notitielijsten die in dezelfde map staan als de agenda's, en iCalendar-data die
 * XML-escaped in het antwoord zit.
 */
import {
  extractCalendarData,
  fetchCalendarEvents,
  listCalendars,
  parseCalendarList,
  toCalDavTime,
  xmlBlocks,
  xmlHas,
  xmlResponses,
  xmlText,
} from "@/lib/caldav";
import { parseICS } from "@/lib/ics-parser";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const BASE = "https://p42-caldav.icloud.com/1234567890/calendars/";
const PRINCIPAL = "https://p42-caldav.icloud.com/1234567890/principal/";

/** Zoals iCloud het geeft: default namespace, prefixen door elkaar. */
const CALENDAR_LIST = `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:IC="http://apple.com/ns/ical/">
  <response>
    <href>/1234567890/calendars/</href>
    <propstat><prop><resourcetype><collection/></resourcetype></prop><status>HTTP/1.1 200 OK</status></propstat>
  </response>
  <response>
    <href>/1234567890/calendars/home/</href>
    <propstat>
      <prop>
        <displayname>Privé</displayname>
        <resourcetype><collection/><C:calendar/></resourcetype>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
        <IC:calendar-color>#1BADF8</IC:calendar-color>
        <owner><href>/1234567890/principal/</href></owner>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
  <response>
    <href>/1234567890/calendars/gedeeld-gezin/</href>
    <propstat>
      <prop>
        <displayname>Gezin</displayname>
        <resourcetype><collection/><C:calendar/></resourcetype>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
        <IC:calendar-color>#CC73E1</IC:calendar-color>
        <owner><href>/9876543210/principal/</href></owner>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
  <response>
    <href>/1234567890/calendars/taken/</href>
    <propstat>
      <prop>
        <displayname>Boodschappen</displayname>
        <resourcetype><collection/><C:calendar/></resourcetype>
        <C:supported-calendar-component-set><C:comp name="VTODO"/></C:supported-calendar-component-set>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
  <response>
    <href>/1234567890/calendars/notes/</href>
    <propstat>
      <prop>
        <displayname>Notities</displayname>
        <resourcetype><collection/></resourcetype>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>`;

/** Hetzelfde, maar met een prefix op álles — sommige antwoorden zien er zo uit. */
const CALENDAR_LIST_PREFIXED = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>https://p42-caldav.icloud.com/1234567890/calendars/werk/</d:href>
    <d:propstat><d:prop>
      <d:displayname>Werk</d:displayname>
      <d:resourcetype><d:collection/><cal:calendar/></d:resourcetype>
      <cal:supported-calendar-component-set><cal:comp name="VEVENT"/></cal:supported-calendar-component-set>
    </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
</d:multistatus>`;

const PRINCIPAL_ANTWOORD = `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:">
  <response>
    <href>/</href>
    <propstat><prop>
      <current-user-principal><href>/1234567890/principal/</href></current-user-principal>
    </prop><status>HTTP/1.1 200 OK</status></propstat>
  </response>
</multistatus>`;

const EVENT_ANTWOORD = `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <response>
    <href>/1234567890/calendars/home/afspraak-1.ics</href>
    <propstat><prop>
      <getetag>"abc123"</getetag>
      <C:calendar-data>BEGIN:VCALENDAR&#13;
VERSION:2.0&#13;
BEGIN:VEVENT&#13;
UID:afspraak-1&#13;
SUMMARY:Tandarts Jip &amp; Janneke&#13;
DTSTART:20260820T083000Z&#13;
DTEND:20260820T090000Z&#13;
LOCATION:Praktijk &lt;centrum&gt;&#13;
END:VEVENT&#13;
END:VCALENDAR&#13;
</C:calendar-data>
    </prop><status>HTTP/1.1 200 OK</status></propstat>
  </response>
  <response>
    <href>/1234567890/calendars/home/afspraak-2.ics</href>
    <propstat><prop>
      <C:calendar-data>BEGIN:VCALENDAR
BEGIN:VEVENT
UID:zwemles
SUMMARY:Zwemles
DTSTART:20260821T150000Z
DTEND:20260821T154500Z
RECURRENCE-ID:20260821T150000Z
END:VEVENT
END:VCALENDAR
</C:calendar-data>
    </prop><status>HTTP/1.1 200 OK</status></propstat>
  </response>
</multistatus>`;

let failed = 0;
function check(naam: string, klopt: boolean, uitleg?: string) {
  if (klopt) {
    console.log(`ok    ${naam}`);
  } else {
    failed++;
    console.log(`FAIL  ${naam}${uitleg ? `\n        ${uitleg}` : ""}`);
  }
}

// --- XML-helpers
check("responses tellen", xmlResponses(CALENDAR_LIST).length === 5,
  `kreeg ${xmlResponses(CALENDAR_LIST).length}`);
check("prefix maakt niet uit", xmlResponses(CALENDAR_LIST_PREFIXED).length === 1);
check(
  "principal uit het antwoord",
  xmlText(xmlBlocks(xmlResponses(PRINCIPAL_ANTWOORD)[0], "current-user-principal")[0], "href") ===
    "/1234567890/principal/"
);
check("self-closing element wordt gezien", xmlHas("<resourcetype><collection/><C:calendar/></resourcetype>", "calendar"));
check("een element dat er niet is", !xmlHas("<resourcetype><collection/></resourcetype>", "calendar"));
check("entiteiten worden teruggedraaid", xmlText("<displayname>Jip &amp; Janneke</displayname>", "displayname") === "Jip & Janneke");

// --- agendalijst
const eigen = parseCalendarList(CALENDAR_LIST, BASE, PRINCIPAL).calendars;
check("alleen agenda's met afspraken", eigen.length === 2,
  `kreeg ${eigen.length}: ${eigen.map((c) => c.name).join(", ")}`);
check("naam en kleur", eigen[0]?.name === "Privé" && eigen[0]?.color === "#1BADF8",
  JSON.stringify(eigen[0]));
check("relatieve href wordt absoluut",
  eigen[0]?.url === "https://p42-caldav.icloud.com/1234567890/calendars/home/", eigen[0]?.url);
check("eigen agenda is niet gedeeld", eigen[0]?.shared === false);
check("agenda van iemand anders is gedeeld", eigen[1]?.shared === true,
  JSON.stringify(eigen[1]));
check("taken- en notitielijst vallen weg",
  !eigen.some((c) => c.name === "Boodschappen" || c.name === "Notities"));

/**
 * De vorm die de eerste poging bij Merel liet mislukken: een server mag props
 * over twee propstat-blokken verdelen — een 404-blok met lege elementen en een
 * 200-blok met de echte waarden. Staat het lege blok voorop, dan zag de oude
 * code een agenda zonder resourcetype en gooide hem weg.
 */
const TWEE_PROPSTAT = `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:IC="http://apple.com/ns/ical/">
  <response>
    <href>/1234567890/calendars/gezin/</href>
    <propstat>
      <prop>
        <resourcetype/>
        <IC:calendar-color/>
        <owner/>
      </prop>
      <status>HTTP/1.1 404 Not Found</status>
    </propstat>
    <propstat>
      <prop>
        <displayname>Gezin</displayname>
        <resourcetype><collection/><C:calendar/></resourcetype>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/><C:comp name="VTODO"/></C:supported-calendar-component-set>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>`;

const tweeProp = parseCalendarList(TWEE_PROPSTAT, BASE, PRINCIPAL);
check("props verdeeld over twee propstat-blokken", tweeProp.calendars.length === 1,
  JSON.stringify(tweeProp.diagnose));
check("naam komt uit het gevulde blok", tweeProp.calendars[0]?.name === "Gezin",
  tweeProp.calendars[0]?.name);
check("VEVENT naast VTODO is nog steeds een agenda",
  tweeProp.diagnose[0]?.componenten.join(",") === "VEVENT,VTODO", JSON.stringify(tweeProp.diagnose[0]));

const diagnose = parseCalendarList(CALENDAR_LIST, BASE, PRINCIPAL).diagnose;
check("diagnose noemt elk gevonden pad", diagnose.length === 5, `kreeg ${diagnose.length}`);
check("diagnose zegt waarom de takenlijst afvalt",
  diagnose.find((d) => d.naam === "Boodschappen")?.reden === "geen afspraken, alleen VTODO",
  JSON.stringify(diagnose.find((d) => d.naam === "Boodschappen")));
check("diagnose zegt waarom een map afvalt",
  diagnose.find((d) => d.naam === "Notities")?.reden === "geen agenda (resourcetype zonder calendar)");

/**
 * Een agenda waarvan de server niets zegt over componenten: dan gokken we niet
 * en nemen we hem mee. Een gemiste agenda is erger dan een lijst te veel.
 */
const ZONDER_COMPONENTEN = `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <response>
    <href>/1234567890/calendars/onbekend/</href>
    <propstat><prop>
      <displayname>Vakanties</displayname>
      <resourcetype><collection/><C:calendar/></resourcetype>
    </prop><status>HTTP/1.1 200 OK</status></propstat>
  </response>
</multistatus>`;
check("zonder componentinformatie nemen we de agenda mee",
  parseCalendarList(ZONDER_COMPONENTEN, BASE, PRINCIPAL).calendars.length === 1);

const metPrefix = parseCalendarList(CALENDAR_LIST_PREFIXED, BASE, PRINCIPAL).calendars;
check("absolute href blijft heel",
  metPrefix[0]?.url === "https://p42-caldav.icloud.com/1234567890/calendars/werk/", metPrefix[0]?.url);
check("zonder eigenaar gokken we niet op gedeeld", metPrefix[0]?.shared === false);

// --- afspraken
const blokken = extractCalendarData(EVENT_ANTWOORD);
check("twee iCalendar-blokken", blokken.length === 2, `kreeg ${blokken.length}`);
const events = blokken.flatMap((b) => parseICS(b));
check("twee afspraken geparsed", events.length === 2, `kreeg ${events.length}`);
check("ampersand in de titel", events[0]?.summary === "Tandarts Jip & Janneke", events[0]?.summary);
check("escaped tekens in de locatie", events[0]?.location === "Praktijk <centrum>", String(events[0]?.location));
check("tijd blijft UTC", events[0]?.start.toISOString() === "2026-08-20T08:30:00.000Z",
  events[0]?.start.toISOString());
check("geen etag in de agenda-data", !blokken.join("").includes("abc123"));

// --- tijdformaat
check("CalDAV-tijdformaat", toCalDavTime(new Date("2026-08-20T00:00:00.000Z")) === "20260820T000000Z",
  toCalDavTime(new Date("2026-08-20T00:00:00.000Z")));

// --- de hele keten tegen een nep-server: discovery, redirect, agendalijst, REPORT
interface Verzoek {
  method: string;
  url: string;
  depth: string | undefined;
  auth: string | undefined;
  body: string;
}

const gezien: Verzoek[] = [];

function antwoord(res: ServerResponse, xml: string) {
  res.writeHead(207, { "Content-Type": "application/xml; charset=utf-8" });
  res.end(xml);
}

async function lees(req: IncomingMessage): Promise<string> {
  const delen: Buffer[] = [];
  for await (const deel of req) delen.push(deel as Buffer);
  return Buffer.concat(delen).toString("utf8");
}

const server = createServer(async (req, res) => {
  const body = await lees(req);
  gezien.push({
    method: req.method ?? "",
    url: req.url ?? "",
    depth: req.headers.depth as string | undefined,
    auth: req.headers.authorization,
    body,
  });

  // Wachtwoord fout? Dan 401, zoals iCloud doet
  if (req.headers.authorization !== `Basic ${Buffer.from("merel@example.com:appwachtwoord").toString("base64")}`) {
    res.writeHead(401);
    res.end();
    return;
  }

  // iCloud verwijst je eerst door naar het echte pad
  if (req.url === "/") {
    res.writeHead(301, { Location: "/dav/" });
    res.end();
    return;
  }

  if (req.url === "/dav/") return antwoord(res, PRINCIPAL_ANTWOORD);
  if (req.url === "/1234567890/principal/") {
    return antwoord(
      res,
      `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <response><href>/1234567890/principal/</href><propstat><prop>
    <C:calendar-home-set><href>/1234567890/calendars/</href></C:calendar-home-set>
  </prop><status>HTTP/1.1 200 OK</status></propstat></response>
</multistatus>`
    );
  }
  if (req.url === "/1234567890/calendars/") return antwoord(res, CALENDAR_LIST);
  if (req.url === "/1234567890/calendars/home/") return antwoord(res, EVENT_ANTWOORD);

  res.writeHead(404);
  res.end();
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const adres = server.address();
const poort = typeof adres === "object" && adres ? adres.port : 0;
const ROOT = [`http://127.0.0.1:${poort}/`];
const CREDS = { username: "merel@example.com", password: "appwachtwoord" };

try {
  const { calendars: gevonden } = await listCalendars(CREDS, ROOT);
  check("keten: agenda's gevonden via discovery", gevonden.length === 2,
    `kreeg ${gevonden.length}`);
  check("keten: de gedeelde agenda zit erbij",
    gevonden.some((c) => c.name === "Gezin" && c.shared));
  check("keten: redirect hield de methode PROPFIND",
    gezien.some((v) => v.url === "/dav/" && v.method === "PROPFIND"));
  check("keten: agendalijst gaat met Depth 1",
    gezien.some((v) => v.url === "/1234567890/calendars/" && v.depth === "1"));

  const afspraken = await fetchCalendarEvents(
    `http://127.0.0.1:${poort}/1234567890/calendars/home/`,
    CREDS,
    new Date("2026-08-20T00:00:00Z"),
    new Date("2026-08-27T00:00:00Z")
  );
  check("keten: afspraken uit het REPORT", afspraken.length === 2, `kreeg ${afspraken.length}`);

  const report = gezien.find((v) => v.method === "REPORT");
  check("keten: REPORT is een calendar-query", Boolean(report?.body.includes("calendar-query")));
  check("keten: herhalingen worden door de server uitgeschreven",
    Boolean(report?.body.includes('<c:expand start="20260820T000000Z" end="20260827T000000Z"/>')),
    report?.body);
  check("keten: alleen VEVENT in het bereik",
    Boolean(report?.body.includes('<c:time-range start="20260820T000000Z" end="20260827T000000Z"/>')));

  let foutMelding = "";
  try {
    await listCalendars({ username: "merel@example.com", password: "fout" }, ROOT);
  } catch (error) {
    foutMelding = error instanceof Error ? error.message : String(error);
  }
  check("keten: verkeerd wachtwoord geeft een begrijpelijke fout",
    foutMelding.includes("app-specifiek wachtwoord"), foutMelding);
} finally {
  server.close();
}

if (failed === 0) {
  console.log("\nalle gevallen goed");
} else {
  console.log(`\n${failed} fout`);
  process.exitCode = 1;
}
