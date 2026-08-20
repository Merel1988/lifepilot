/**
 * Minimale CalDAV-client, gebouwd voor iCloud.
 *
 * Waarom dit bestaat: een gedeelde iCloud-agenda kan alleen de eigenaar
 * publiceren. Merel is deelnemer in de agenda die haar man heeft aangemaakt, dus
 * de `webcal://`-route valt weg. Via CalDAV praten we met iCloud zoals Agenda op
 * de Mac dat doet — met haar eigen Apple ID en een app-specifiek wachtwoord — en
 * dan zijn álle agenda's waar ze bij kan gewoon leesbaar, gedeelde agenda's
 * inbegrepen. Er hoeft niets gedeeld of gepubliceerd te worden.
 *
 * Er zit geen XML-bibliotheek in het project en daar is er ook geen nodig: we
 * lezen een handvol vaste elementen uit het antwoord. De helpers negeren
 * namespace-prefixen, want iCloud wisselt daarin (`<href>` en `<d:href>` komen
 * beide voor).
 *
 * Alles hier is alleen-lezen. Er wordt nooit iets naar de agenda geschreven.
 */

import { parseICS, type CalendarEvent } from "@/lib/ics-parser";

const ICLOUD_ROOTS = ["https://caldav.icloud.com/", "https://caldav.icloud.com/.well-known/caldav"];
const MAX_REDIRECTS = 3;

export interface Credentials {
  username: string;
  password: string;
}

export interface RemoteCalendar {
  /** Volledige URL van de agenda; dit is de sleutel die we bewaren. */
  url: string;
  name: string;
  color: string | null;
  /** Een agenda die iemand anders met je heeft gedeeld. */
  shared: boolean;
}

export class CalDavError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "CalDavError";
    this.status = status;
  }
}

/* ------------------------------------------------------------------ XML ---- */

/** Tagnaam met of zonder namespace-prefix. */
function tagPattern(name: string, flags: string): RegExp {
  return new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${name}(\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${name}>)`,
    flags
  );
}

/** Alle voorkomens van een element, met hun binnenkant (leeg bij self-closing). */
export function xmlBlocks(xml: string, name: string): string[] {
  const out: string[] = [];
  for (const match of xml.matchAll(tagPattern(name, "gi"))) {
    out.push(match[2] ?? "");
  }
  return out;
}

/** De tekst in het eerste voorkomen van een element, getrimd. */
export function xmlText(xml: string, name: string): string | null {
  const match = xml.match(tagPattern(name, "i"));
  if (!match) return null;
  const inner = match[2];
  if (inner === undefined) return "";
  return unescapeXml(inner.replace(/<[^>]*>/g, "")).trim();
}

/** Staat dit element erin, ook als het self-closing is? */
export function xmlHas(xml: string, name: string): boolean {
  return tagPattern(name, "i").test(xml);
}

export function unescapeXml(text: string): string {
  return (
    text
      // iCloud zet de regeleindes van de iCalendar-data als `&#13;` in het
      // antwoord. Zonder deze regel blijft dat letterlijk staan en herkent de
      // ICS-parser "BEGIN:VEVENT&#13;" niet meer als het begin van een afspraak.
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      // &amp; als laatste, anders wordt "&amp;#13;" alsnog een regeleinde
      .replace(/&amp;/g, "&")
  );
}

/** De `<response>`-blokken uit een multistatus-antwoord. */
export function xmlResponses(xml: string): string[] {
  return xmlBlocks(xml, "response");
}

/* --------------------------------------------------------------- verkeer ---- */

function basicAuth({ username, password }: Credentials): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

/**
 * Eén WebDAV-verzoek. Volgt redirects zelf, want `fetch` mag bij een 301/302 de
 * methode naar GET veranderen en dan komt er geen multistatus terug.
 */
async function dav(
  url: string,
  method: "PROPFIND" | "REPORT",
  body: string,
  credentials: Credentials,
  depth: "0" | "1",
  hop = 0
): Promise<{ xml: string; url: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: basicAuth(credentials),
        "Content-Type": "application/xml; charset=utf-8",
        Depth: depth,
        // iCloud is kieskeurig: zonder herkenbare user agent volgt soms een 403
        "User-Agent": "LifePilot/1.0 (CalDAV)",
      },
      body,
      cache: "no-store",
    });
  } catch (error) {
    throw new CalDavError(
      `Kon ${new URL(url).host} niet bereiken: ${
        error instanceof Error ? error.message : "onbekende fout"
      }`
    );
  }

  if ([301, 302, 307, 308].includes(res.status)) {
    const location = res.headers.get("location");
    if (!location || hop >= MAX_REDIRECTS) {
      throw new CalDavError("De agendaserver bleef doorverwijzen.", res.status);
    }
    return dav(new URL(location, url).toString(), method, body, credentials, depth, hop + 1);
  }

  if (res.status === 401 || res.status === 403) {
    throw new CalDavError(
      "Apple ID of app-specifiek wachtwoord wordt niet geaccepteerd. Let op: je gewone wachtwoord werkt hier niet, je hebt een app-specifiek wachtwoord nodig.",
      res.status
    );
  }

  // 207 Multi-Status is het normale antwoord; 200 komt ook voor
  if (res.status !== 207 && res.status !== 200) {
    throw new CalDavError(`De agendaserver antwoordde met ${res.status}.`, res.status);
  }

  return { xml: await res.text(), url: res.url || url };
}

/* ------------------------------------------------------------- discovery ---- */

const PROP_PRINCIPAL = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`;

const PROP_HOME = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`;

const PROP_CALENDARS = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:ic="http://apple.com/ns/ical/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <c:supported-calendar-component-set/>
    <ic:calendar-color/>
    <d:owner/>
  </d:prop>
</d:propfind>`;

/** De eerste href in een propstat-blok, absoluut gemaakt. */
function firstHref(xml: string, base: string): string | null {
  const href = xmlText(xml, "href");
  if (!href) return null;
  return new URL(href, base).toString();
}

export interface CalendarHome {
  /** URL van de map waarin de agenda's staan. */
  home: string;
  /** URL van het account zelf; agenda's met een andere eigenaar zijn gedeeld. */
  principal: string;
}

/**
 * Zoekt op welke URL de agenda's van dit account staan. iCloud verhuist je
 * onderweg naar een andere host (`p123-caldav.icloud.com`), dus elke href wordt
 * tegen de URL van het antwoord opgelost in plaats van tegen de begin-URL.
 */
export async function findCalendarHome(
  credentials: Credentials,
  // Alleen overschreven door `npm run check:caldav`, dat de keten tegen een
  // lokale nep-server naloopt. In de app is dit altijd iCloud.
  roots: string[] = ICLOUD_ROOTS
): Promise<CalendarHome> {
  let laatste: CalDavError | null = null;

  for (const root of roots) {
    try {
      const principalRes = await dav(root, "PROPFIND", PROP_PRINCIPAL, credentials, "0");
      const principalBlock = xmlResponses(principalRes.xml)[0] ?? principalRes.xml;
      const principalHref = firstHref(
        xmlBlocks(principalBlock, "current-user-principal")[0] ?? "",
        principalRes.url
      );
      if (!principalHref) {
        laatste = new CalDavError("De agendaserver gaf geen account terug.");
        continue;
      }

      const homeRes = await dav(principalHref, "PROPFIND", PROP_HOME, credentials, "0");
      const homeBlock = xmlResponses(homeRes.xml)[0] ?? homeRes.xml;
      const homeHref = firstHref(xmlBlocks(homeBlock, "calendar-home-set")[0] ?? "", homeRes.url);
      if (!homeHref) {
        laatste = new CalDavError("De agendaserver gaf geen agendamap terug.");
        continue;
      }

      return { home: homeHref, principal: principalHref };
    } catch (error) {
      if (error instanceof CalDavError && (error.status === 401 || error.status === 403)) throw error;
      laatste = error instanceof CalDavError ? error : new CalDavError(String(error));
    }
  }

  throw laatste ?? new CalDavError("Kon de agenda's niet vinden.");
}

/** Alle agenda's met afspraken die dit account kan lezen, gedeelde inbegrepen. */
export async function listCalendars(
  credentials: Credentials,
  roots?: string[]
): Promise<RemoteCalendar[]> {
  const { home, principal } = await findCalendarHome(credentials, roots);
  const { xml, url } = await dav(home, "PROPFIND", PROP_CALENDARS, credentials, "1");
  return parseCalendarList(xml, url, principal);
}

/** Los van het netwerk gehouden zodat er een check op kan (`npm run check:caldav`). */
export function parseCalendarList(
  xml: string,
  base: string,
  principal: string
): RemoteCalendar[] {

  const calendars: RemoteCalendar[] = [];
  for (const block of xmlResponses(xml)) {
    const resourcetype = xmlBlocks(block, "resourcetype")[0] ?? "";
    if (!xmlHas(resourcetype, "calendar")) continue;

    // Taken- en notitielijsten staan in dezelfde map; alleen VEVENT is een agenda
    const components = xmlBlocks(block, "supported-calendar-component-set")[0] ?? "";
    if (components && !/name\s*=\s*"VEVENT"/i.test(components)) continue;

    const href = xmlText(block, "href");
    if (!href) continue;

    const naam = xmlText(block, "displayname");
    const owner = xmlBlocks(block, "owner")[0] ?? "";
    const ownerHref = xmlText(owner, "href");

    calendars.push({
      url: new URL(href, base).toString(),
      name: naam && naam.length > 0 ? naam : "Agenda zonder naam",
      color: xmlText(block, "calendar-color"),
      // Een agenda van iemand anders staat op naam van een ander account
      shared: isShared(ownerHref, base, principal),
    });
  }

  return calendars;
}

/**
 * Een gedeelde agenda staat op naam van een ander account. iCloud zet het
 * accountnummer in het pad (`/1234567890/principal/`), dus dat nummer vergelijken
 * is genoeg — en als er geen eigenaar in het antwoord staat gokken we niet.
 */
function isShared(ownerHref: string | null, base: string, principal: string): boolean {
  if (!ownerHref) return false;
  try {
    const owner = new URL(ownerHref, base).pathname;
    const eigen = new URL(principal, base).pathname;
    const nummer = (pad: string) => pad.split("/").filter(Boolean)[0] ?? "";
    return nummer(owner) !== "" && nummer(owner) !== nummer(eigen);
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- events ---- */

/** CalDAV wil UTC-tijden in de vorm 20260820T000000Z. */
export function toCalDavTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function calendarQuery(from: Date, to: Date, expand: boolean): string {
  const start = toCalDavTime(from);
  const end = toCalDavTime(to);
  // `expand` laat de server herhalende afspraken uitschrijven naar losse
  // instanties, in UTC. Dat scheelt ons een RRULE-implementatie én het lost de
  // tijdzone-onduidelijkheid op die een ICS-feed met TZID wél heeft.
  const data = expand
    ? `<c:calendar-data><c:expand start="${start}" end="${end}"/></c:calendar-data>`
    : `<c:calendar-data/>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    ${data}
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${start}" end="${end}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
}

/** De iCalendar-blokken uit een calendar-query-antwoord. */
export function extractCalendarData(xml: string): string[] {
  return xmlBlocks(xml, "calendar-data")
    .map((block) => unescapeXml(block).trim())
    .filter((block) => block.includes("BEGIN:VEVENT"));
}

/** Afspraken uit één agenda binnen een bereik. */
export async function fetchCalendarEvents(
  calendarUrl: string,
  credentials: Credentials,
  from: Date,
  to: Date
): Promise<CalendarEvent[]> {
  let xml: string;
  try {
    xml = (await dav(calendarUrl, "REPORT", calendarQuery(from, to, true), credentials, "1")).xml;
  } catch (error) {
    // Niet elke server kan `expand`. Dan liever de herhalingen ongeëxpandeerd
    // dan een lege agenda.
    if (error instanceof CalDavError && error.status && error.status >= 400) {
      xml = (await dav(calendarUrl, "REPORT", calendarQuery(from, to, false), credentials, "1")).xml;
    } else {
      throw error;
    }
  }

  const events: CalendarEvent[] = [];
  for (const ics of extractCalendarData(xml)) {
    events.push(...parseICS(ics));
  }
  return events;
}
