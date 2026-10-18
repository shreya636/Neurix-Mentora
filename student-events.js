import { renderStudentSidebar } from "./portal-navigation.js";

const CATEGORIES = ["All", "Hackathons", "Tech Events", "Workshops", "Conferences", "Competitions", "Online"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const INDIA_CITIES = new Set([
  "Bengaluru", "Bangalore", "Hyderabad", "Chennai", "Mumbai", "Pune", "Delhi", "Noida", "Gurugram",
  "Gurgaon", "Kolkata", "Ahmedabad", "Jaipur", "Kochi", "Mysuru", "Mysore", "Lucknow", "Indore",
  "Guwahati", "Chandigarh"
]);
const CITY_PRIORITY = new Map([
  ["bengaluru", "bangalore"], ["hyderabad"], ["chennai"], ["mumbai"], ["pune"],
  ["delhi"], ["noida"], ["gurugram", "gurgaon"], ["kolkata"], ["kochi"], ["mysuru", "mysore"]
].flatMap((cities, index) => cities.map((city) => [city, index])));
const CITY_ALIASES = new Map([
  ["bangalore", "bengaluru"], ["mysore", "mysuru"], ["gurgaon", "gurugram"]
]);
const INDIA_LOCATION_OPTIONS = [
  "Bengaluru + Online", "Bengaluru", "Hyderabad", "Chennai", "Mumbai", "Pune",
  "Delhi NCR", "Kolkata", "Kochi", "Mysuru", "All India", "Online", "Needs verification"
];
const FOREIGN_COUNTRIES = /\b(usa|u\.s\.a\.?|united states|canada|united kingdom|u\.k\.|england|scotland|wales|ireland|singapore|germany|france|spain|italy|netherlands|switzerland|sweden|norway|denmark|finland|australia|new zealand|japan|china|south korea|uae|united arab emirates|dubai|saudi arabia|brazil|mexico)\b/i;

function explicitlyIndiaEligible(text) {
  const value = String(text || "").toLowerCase();
  if (/\b(not|no|excluding|except|outside|unavailable|ineligible)\b[^.]{0,80}\b(india|indian)\b/.test(value)) return false;
  return /\b(india|indian|nationwide|pan[- ]india|across india|all over india)\b/.test(value);
}

function hasForeignLocation(event) {
  const location = `${event.location || ""} ${event.city || ""} ${event.country || ""}`.toLowerCase();
  const countryCode = String(event.country_code || event.countryCode || "").trim().toUpperCase();
  if (countryCode && !["IN", "IND", "INDIA"].includes(countryCode)) return true;
  return /\b(usa|u\.s\.a\.?|united states|canada|united kingdom|u\.k\.|england|scotland|wales|ireland|singapore|germany|france|spain|italy|netherlands|switzerland|sweden|norway|denmark|finland|australia|new zealand|japan|china|south korea|uae|united arab emirates|dubai|saudi arabia|brazil|mexico)\b/.test(location);
}

export function isIndiaEligibleEvent(event) {
  if (event?.location_verified === false || event?.locationVerified === false) return false;
  if (!event || hasForeignLocation(event)) return false;
  const format = String(event.format || event.mode || "").toLowerCase();
  const city = String(event.city || "").trim();
  const place = `${event.location || ""} ${city} ${event.country || ""}`.toLowerCase();
  const isOnline = format === "online" || /\b(online|virtual|remote)\b/.test(place);
  const verifiedIndia = ["IN", "IND", "INDIA"].includes(String(event.country_code || event.countryCode || "").toUpperCase()) ||
    /\b(india|bharat)\b/.test(String(event.country || "").toLowerCase()) ||
    INDIA_CITIES.has(city) ||
    /\b(india|bharat)\b/.test(place);
  if (isOnline) return explicitlyIndiaEligible(event.eligibility);
  if (!["in_person", "hybrid"].includes(format) && !verifiedIndia) return false;
  return verifiedIndia;
}

function cityMatchesLocation(city, location) {
  const normalizeCity = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return CITY_ALIASES.get(normalized) || normalized;
  };
  const normalizedCity = normalizeCity(city);
  if (location === "Delhi NCR") return ["delhi", "noida", "gurugram", "gurgaon"].includes(normalizedCity);
  const targetCity = normalizeCity(location.replace(/\s*\+\s*Online$/, ""));
  return normalizedCity === targetCity;
}

export function filterEventsByLocation(events, location = "Bengaluru + Online") {
  return events.filter((event) => {
    const mode = String(event.format || event.mode || "").toLowerCase();
    if (location === "Needs verification") {
      const countryCode = String(event.country_code || event.countryCode || "").toUpperCase();
      const place = `${event.location || ""} ${event.city || ""} ${event.country || ""}`;
      return ["", "IN", "IND", "INDIA"].includes(countryCode) && !FOREIGN_COUNTRIES.test(place) &&
        (event.location_verified === false || event.locationVerified === false ||
          event.date_verified === false || event.dateVerified === false ||
          (["online", "hybrid"].includes(String(event.format || event.mode || "").toLowerCase()) &&
            !explicitlyIndiaEligible(event.eligibility)));
    }
    if (!isIndiaEligibleEvent(event)) return false;
    if (location === "Online") return mode === "online";
    if (location === "All India") return true;
    if (location === "Bengaluru + Online") {
      return mode === "online" || cityMatchesLocation(event.city, location);
    }
    return mode !== "online" && cityMatchesLocation(event.city, location);
  });
}

function validCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeEventCategory(event, format) {
  const supplied = String(event.category || event.type || event.event_type || event.opportunity || "").toLowerCase();
  const clues = `${supplied} ${event.title || ""} ${event.description || ""} ${(event.tags || []).join(" ")}`.toLowerCase();
  if (/hackathon|\bhack\b|buildathon/.test(clues)) return "Hackathons";
  if (/workshop|\bfdp\b|bootcamp|training|masterclass/.test(clues)) return "Workshops";
  if (/conference|summit|congress|seminar|symposium/.test(clues)) return "Conferences";
  if (/competition|contest|challenge/.test(clues)) return "Competitions";
  if (/^online$/.test(supplied) || /webinar/.test(clues) || format === "online") return "Online";
  return "Tech Events";
}

export function normalizeStudentEvent(event) {
  const startDate = event?.start_date || event?.startDate || event?.start;
  const validStartDate = validCalendarDate(startDate);
  const sourceEndDate = event.end_date || event.endDate || event.end;
  const validEndDate = validCalendarDate(sourceEndDate);
  if (startDate && !validStartDate) {
    if (import.meta.env?.DEV) console.warn("Event date is unverified and will be shown in the review list.", { id: event?.id, title: event?.title, startDate });
  }
  if (sourceEndDate && !validEndDate) {
    if (import.meta.env?.DEV) console.warn("Event end date is unverified and will be shown in the review list.", { id: event.id, title: event.title, endDate: sourceEndDate });
  }
  const normalizedStart = validStartDate ? startDate : null;
  const normalizedEnd = validEndDate && (!normalizedStart || sourceEndDate >= normalizedStart)
    ? sourceEndDate
    : normalizedStart;
  const validRange = Boolean(normalizedStart && normalizedEnd && normalizedEnd >= normalizedStart &&
    (!sourceEndDate || validEndDate));
  const location = String(event.location || event.city || "").trim();
  const suppliedFormat = String(event.format || event.mode || event.event_mode || "").toLowerCase();
  const mode = /hybrid/.test(suppliedFormat) ? "hybrid"
    : /in.?person|offline|physical/.test(suppliedFormat) ? "in_person"
      : /online|virtual|remote/.test(suppliedFormat) || event.is_online === true ||
        /\b(online|virtual|remote)\b/i.test(location) ? "online" : suppliedFormat || "unknown";
  const countryCode = String(event.country_code || event.countryCode || "").trim().toUpperCase();
  const country = String(typeof event.country === "object"
    ? event.country.name || event.country.country_name || ""
    : event.country || (countryCode === "IN" ? "India" : "")).trim();
  const locationVerified = typeof event.location_verified === "boolean"
    ? event.location_verified
    : typeof event.locationVerified === "boolean"
      ? event.locationVerified
      : ["online", "hybrid"].includes(mode)
        ? explicitlyIndiaEligible(event.eligibility)
        : ["IN", "IND", "INDIA"].includes(countryCode) || INDIA_CITIES.has(String(event.city || "").trim());
  const rawRegistrationStatus = String(event.registration_status || event.registrationStatus || "unknown");
  const deadline = event.registration_deadline || event.registrationDeadline;
  const registrationStatus = rawRegistrationStatus === "unknown" && deadline &&
    new Date(deadline).getTime() < Date.now() ? "closed" : rawRegistrationStatus;
  return {
    id: String(event.id || event.source_event_id || `${event.title}-${startDate}`),
    sourceEventId: String(event.source_event_id || ""),
    sourceName: String(event.source_name || ""),
    title: String(event.title || "Untitled event"),
    category: normalizeEventCategory(event, mode),
    startDate: normalizedStart,
    endDate: normalizedEnd,
    city: String(event.city || "").trim(),
    location,
    country,
    countryCode,
    mode,
    locationVerified,
    dateVerified: typeof event.date_verified === "boolean"
      ? event.date_verified && Boolean(validRange || !normalizedStart)
      : typeof event.dateVerified === "boolean"
        ? event.dateVerified && Boolean(validRange || !normalizedStart)
        : Boolean(validRange),
    eventSize: String(event.event_size || event.eventSize || "unknown"),
    registrationStatus,
    aiSummary: String(event.ai_summary || event.aiSummary || ""),
    organizer: String(event.organizer || ""),
    registrationDeadline: event.registration_deadline || event.registrationDeadline || null,
    prize: String(event.prize_pool || event.prize || ""),
    participantCount: Number.isSafeInteger(Number(event.participant_count ?? event.participantCount)) &&
      String(event.participant_count ?? event.participantCount ?? "").trim() !== ""
      ? Number(event.participant_count ?? event.participantCount)
      : null,
    description: String(event.description || ""),
    url: String(event.registration_url || event.url || ""),
    sourceUrl: String(event.source_url || event.url || event.registration_url || ""),
    imageUrl: String(event.image_url || event.imageUrl || ""),
    eligibility: String(event.eligibility || ""),
    tags: Array.isArray(event.tags) ? event.tags.map(String) : [],
    startTime: String(event.start_time || event.startTime || ""),
    endTime: String(event.end_time || event.endTime || ""),
    lastVerifiedAt: event.last_verified_at || event.lastVerifiedAt || null
  };
}

export function normalizeAndDeduplicateStudentEvents(events) {
  const normalized = events.map(normalizeStudentEvent).filter(Boolean);
  return {
    normalized,
    deduplicated: deduplicateStudentEvents(normalized)
  };
}

export function deduplicateStudentEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const identities = [];
    if (event.sourceEventId && event.sourceName) {
      identities.push(`source:${event.sourceName.toLowerCase()}:${event.sourceEventId}`);
    }
    const sourceUrl = event.sourceUrl || event.url;
    if (sourceUrl) {
      try {
        const url = new URL(sourceUrl);
        if (["http:", "https:"].includes(url.protocol)) {
          url.hash = "";
          url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
          url.pathname = url.pathname.replace(/\/+$/, "").toLowerCase();
          for (const key of [...url.searchParams.keys()]) {
            if (/^(utm_.+|ref|source|campaign|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
          }
          url.searchParams.sort();
          identities.push(`url:${url.toString().replace(/\/$/, "")}`);
        }
      } catch {
        if (import.meta.env?.DEV) console.warn("Skipping malformed event URL for deduplication.", { eventId: event.id });
      }
    }
    if (!identities.length) identities.push(`event:${event.id}`);
    if (identities.some((identity) => seen.has(identity))) return false;
    for (const identity of identities) seen.add(identity);
    return true;
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function toDate(value) {
  return new Date(`${value}T12:00:00`);
}

function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  return value ? toDate(value).toLocaleDateString("en-IN", options) : "Date to be announced";
}

function formatRange(event) {
  if (!event.startDate) return event.endDate
    ? `Start date unverified · ends ${formatDate(event.endDate)}`
    : "Date pending verification";
  if (!event.endDate || event.endDate === event.startDate) return formatDate(event.startDate);
  const start = toDate(event.startDate);
  const end = toDate(event.endDate);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-IN", { day: "numeric", ...(sameMonth ? {} : { month: "short" }), ...(sameYear ? {} : { year: "numeric" }) });
  return `${startLabel}–${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
}

function eventRelevance(event, student) {
  const course = `${student?.course || ""} ${student?.profile?.course || ""} ${student?.strongSubjects || []} ${student?.subjects || ""}`.toLowerCase();
  const tags = (event.tags || []).join(" ").toLowerCase();
  const description = `${event.title} ${event.category} ${tags} ${event.description}`.toLowerCase();
  const keywords = ["ai", "machine learning", "programming", "cybersecurity", "cloud", "web", "data science", "open source", "hackathon"];
  let score = 0;
  for (const keyword of keywords) if (description.includes(keyword) && (!course || course.includes("computer") || course.includes("cse") || course.includes("engineering") || course.includes("ai") || course.includes("technology"))) score += 1;
  for (const subject of Array.isArray(student?.strongSubjects) ? student.strongSubjects : []) {
    if (description.includes(String(subject).toLowerCase())) score += 2;
  }
  return score;
}

function prizeAmountInr(value) {
  const match = String(value || "").match(/(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|cr|k)?/i);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(",", ""));
  const unit = String(match[2] || "").toLowerCase();
  const multiplier = ["lakh", "lac"].includes(unit) ? 100000
    : ["crore", "cr"].includes(unit) ? 10000000
      : unit === "k" ? 1000 : 1;
  return Number.isFinite(amount) && amount > 0 ? amount * multiplier : null;
}

export function scoreHackathon(event) {
  const text = `${event.title} ${event.description} ${(event.tags || []).join(" ")}`.toLowerCase();
  const city = String(event.city || "").trim().toLowerCase();
  const location = String(event.location || "").toLowerCase();
  const mode = String(event.mode || "").toLowerCase();
  const amountInr = prizeAmountInr(event.prize);
  const prizeScore = amountInr == null
    ? event.prize ? 5 : 0
    : amountInr >= 500000 ? 25 : amountInr >= 100000 ? 20 : amountInr >= 25000 ? 14 : 8;
  const locationScore = city === "bengaluru" || city === "bangalore" ? 25
    : /\bkarnataka\b/.test(location) ? 18
      : ["hyderabad", "chennai", "mumbai", "pune", "delhi", "noida", "gurugram", "gurgaon"].includes(city) ? 15
        : mode === "online" ? 8 : 10;
  const sourceScore = ["unstop", "devpost"].includes(String(event.sourceName || "").toLowerCase()) ? 7 : 0;
  const organizerScore = event.organizer ? 8 : 0;
  const technologyKeywords = ["software", "ai", "machine learning", "generative ai", "cybersecurity", "robotics", "data science", "programming", "cloud", "web development"];
  const relevanceScore = Math.min(15, (String(event.category).toLowerCase() === "hackathons" ? 6 : 0) +
    Math.min(9, technologyKeywords.filter((keyword) => text.includes(keyword)).length * 3));
  const opportunityScore = Math.min(10, ["mentor", "network", "hiring", "internship", "career"].filter((keyword) => text.includes(keyword)).length * 2);
  const count = event.participantCount == null ? null : Number(event.participantCount);
  const popularityScore = Number.isSafeInteger(count) && count > 0
    ? count >= 5000 ? 10 : count >= 1000 ? 8 : count >= 250 ? 6 : count >= 50 ? 4 : 2
    : 0;
  const components = {
    prize: Math.min(25, prizeScore),
    location: Math.min(25, locationScore),
    organizerAndSource: Math.min(15, sourceScore + organizerScore),
    technologyRelevance: relevanceScore,
    mentorshipAndCareerEvidence: opportunityScore,
    verifiedParticipation: popularityScore
  };
  const reasons = [];
  if (amountInr != null) reasons.push(`documented INR prize pool (${event.prize})`);
  else if (event.prize) reasons.push("a prize or reward is listed, but no INR value was parsed");
  if (locationScore === 25) reasons.push("Bengaluru location");
  else if (/\bkarnataka\b/.test(location)) reasons.push("Karnataka location");
  else if (mode === "online") reasons.push("India-eligible online format");
  else reasons.push("verified Indian location");
  if (event.organizer) reasons.push(`named organizer: ${event.organizer}`);
  if (sourceScore) reasons.push(`listed on ${event.sourceName}`);
  if (relevanceScore) reasons.push("technology hackathon track");
  if (opportunityScore) reasons.push("mentorship or career opportunity details are mentioned");
  if (popularityScore) reasons.push(`${count.toLocaleString("en-IN")} participants recorded by source`);
  return {
    score: Math.round(Object.values(components).reduce((sum, value) => sum + value, 0)),
    components,
    reasons,
    prizeAmountInr: amountInr,
    participantCount: Number.isSafeInteger(count) && count >= 0 ? count : null
  };
}

function compareRecommended(a, b, student) {
  const scoreDifference = scoreHackathon(b).score - scoreHackathon(a).score;
  const relevanceDifference = eventRelevance(b, student) - eventRelevance(a, student);
  const cityPriority = (CITY_PRIORITY.get(String(a.city || "").toLowerCase()) ?? 99) -
    (CITY_PRIORITY.get(String(b.city || "").toLowerCase()) ?? 99);
  return scoreDifference || relevanceDifference || cityPriority ||
    (a.startDate || "9999-99-99").localeCompare(b.startDate || "9999-99-99");
}

export function sortHackathonEvents(events, sortBy = "recommended", student) {
  const compare = (a, b) => {
    if (sortBy === "prize") {
      const value = (scoreHackathon(b).prizeAmountInr ?? -1) - (scoreHackathon(a).prizeAmountInr ?? -1);
      if (value) return value;
    } else if (sortBy === "deadline") {
      const now = Date.now();
      const deadlineA = a.registrationDeadline ? new Date(a.registrationDeadline).getTime() : Infinity;
      const deadlineB = b.registrationDeadline ? new Date(b.registrationDeadline).getTime() : Infinity;
      const validA = deadlineA >= now;
      const validB = deadlineB >= now;
      if (validA !== validB) return validA ? -1 : 1;
      if (deadlineA !== deadlineB) return deadlineA - deadlineB;
    } else if (sortBy === "popularity") {
      const countA = scoreHackathon(a).participantCount;
      const countB = scoreHackathon(b).participantCount;
      if (countA !== countB) {
        if (countA == null) return 1;
        if (countB == null) return -1;
        return countB - countA;
      }
    }
    return compareRecommended(a, b, student);
  };
  return [...events].sort(compare);
}

function categorySlug(category) {
  return String(category || "Tech Events").toLowerCase().replace(/[^a-z]+/g, "-");
}

function eventMarkup(event, compact = false) {
  const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;
  const registrationStatus = ["open", "coming_soon", "closed", "unknown"].includes(event.registrationStatus)
    ? event.registrationStatus
    : deadline && deadline.getTime() < Date.now() ? "closed" : "unknown";
  const statusLabel = registrationStatus === "open" ? "Registration open"
    : registrationStatus === "coming_soon" ? "Coming soon"
      : registrationStatus === "closed" ? "Registration closed"
        : deadline ? `Deadline: ${formatDate(deadline.toISOString().slice(0, 10), { day: "numeric", month: "short" })}`
          : "Registration details pending";
  const recommendation = scoreHackathon(event);
  const format = event.mode === "in_person" ? "In-person"
    : event.mode === "hybrid" ? "Hybrid" : event.mode === "online" ? "Online" : "Format unverified";
  const place = event.locationVerified
    ? event.mode === "online" ? "Online" : event.city || event.location || "Location to be announced"
    : event.location || "Location unverified";
  const date = formatRange(event);
  const deadlineText = deadline
    ? `Registration deadline: ${formatDate(deadline.toISOString().slice(0, 10), { day: "numeric", month: "short" })}`
    : "Registration deadline not listed";
  const verificationText = event.locationVerified && event.dateVerified
    ? `Source: ${event.sourceName || "Organizer"}${event.lastVerifiedAt ? ` · verified ${formatDate(String(event.lastVerifiedAt).slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}` : ""}`
    : "Details pending verification";
  return `<button type="button" class="opportunity-event ${compact ? "opportunity-event-compact" : ""} ${event.mode === "online" ? "is-online" : ""}" data-action="open-event" data-event-id="${escapeHtml(event.id)}">
    <span class="opportunity-date">${escapeHtml(date)}</span>
    <span class="opportunity-event-copy"><span class="opportunity-category category-${categorySlug(event.category)}">${escapeHtml(event.category || "Tech Events")}</span><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(place)} · ${format}${event.eventSize && event.eventSize !== "unknown" ? ` · ${escapeHtml(event.eventSize)}` : ""}</small><small>${escapeHtml(event.organizer || "Organizer not listed")}${event.prize ? ` · Prize: ${escapeHtml(event.prize)}` : " · Benefits not listed"}</small><small>${escapeHtml(statusLabel)}</small>${event.aiSummary ? `<small>${escapeHtml(event.aiSummary)}</small>` : ""}<small>${escapeHtml(verificationText)}</small>${recommendation.participantCount != null ? `<small>${recommendation.participantCount.toLocaleString("en-IN")} source-reported participants</small>` : ""}<small class="opportunity-score">Recommended ${recommendation.score}/100 · ${escapeHtml(recommendation.reasons.slice(0, 2).join("; ") || "limited verified details")}</small>${compact ? `<small>${escapeHtml(deadlineText)}</small>` : ""}</span>
    ${!compact ? `<span class="opportunity-deadline">${escapeHtml(statusLabel)}<br/>${escapeHtml(deadlineText)}<br/>View details →</span>` : ""}
  </button>`;
}

function renderCalendar(events, month) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIndex, 1 - offset);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const dayEvents = events.filter((event) => event.startDate <= key && event.endDate >= key);
    return `<div class="opportunity-calendar-day ${date.getMonth() === monthIndex ? "" : "is-outside"} ${key === new Date().toISOString().slice(0, 10) ? "is-today" : ""}" data-calendar-date="${key}">
      <span class="opportunity-calendar-number">${date.getDate()}</span>
      <div class="opportunity-day-events">${dayEvents.map((event) => `<button type="button" class="opportunity-calendar-event category-${categorySlug(event.category)}" data-action="open-event" data-event-id="${escapeHtml(event.id)}"><i></i><span>${escapeHtml(event.title)}</span></button>`).join("")}</div>
    </div>`;
  });
  return `<div class="opportunity-calendar" role="grid" aria-label="${escapeHtml(month.toLocaleDateString("en-IN", { month: "long", year: "numeric" }))}">
    ${WEEKDAYS.map((day) => `<div class="opportunity-calendar-weekday" role="columnheader">${day}</div>`).join("")}
    ${cells.join("")}
  </div>`;
}

export function renderStudentEventsPage({ events = [], student, month, category, location, sortBy = "recommended", registrationStatus, loading, error, discoveryStatus, discoveryStatusError, refreshing, refreshMessage, lastVerified, selectedEventId }) {
  const monthDate = month instanceof Date ? month : new Date();
  const selectedLocation = INDIA_LOCATION_OPTIONS.includes(location) ? location : "Bengaluru + Online";
  const selectedCategory = CATEGORIES.includes(category) ? category : "All";
  const selectedRegistrationStatus = ["all", "open", "coming_soon", "closed", "unknown"].includes(registrationStatus)
    ? registrationStatus : "all";
  const { normalized: validEvents, deduplicated: normalizedEvents } = normalizeAndDeduplicateStudentEvents(events);
  const indiaEvents = normalizedEvents.filter(isIndiaEligibleEvent);
  const locatedEvents = filterEventsByLocation(normalizedEvents, selectedLocation);
  const categorizedEvents = locatedEvents.filter((event) => {
    if (selectedCategory === "All") return true;
    if (selectedCategory === "Online") return event.mode === "online" || event.category === "Online";
    return event.category === selectedCategory;
  });
  const registrationFilteredEvents = categorizedEvents.filter((event) =>
    selectedRegistrationStatus === "all" || event.registrationStatus === selectedRegistrationStatus);
  const monthStart = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const monthEnd = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, "0")}-${String(monthEndDate.getDate()).padStart(2, "0")}`;
  const inMonth = registrationFilteredEvents.filter((event) =>
    event.startDate && event.startDate <= monthEnd && (event.endDate || event.startDate) >= monthStart);
  const reviewEvents = selectedLocation === "Needs verification"
    ? registrationFilteredEvents.filter((event) =>
      !event.startDate || (event.startDate <= monthEnd && (event.endDate || event.startDate) >= monthStart))
    : [];
  if (import.meta.env?.DEV) {
    console.debug("Student events calendar counts", {
      totalFetched: events.length,
      afterNormalization: validEvents.length,
      afterDeduplication: normalizedEvents.length,
      afterIndiaFilter: indiaEvents.length,
      afterLocationFilter: locatedEvents.length,
      afterCategoryFilter: categorizedEvents.length,
      afterRegistrationFilter: registrationFilteredEvents.length,
      afterMonthFilter: inMonth.length,
      categoriesAfterMonthFilter: Object.fromEntries(
        [...CATEGORIES.slice(1, -1), "Online"].map((name) => [
          name,
          inMonth.filter((event) => name === "Online"
            ? event.mode === "online" || event.category === "Online"
            : event.category === name).length
        ])
      ),
      month: monthStart.slice(0, 7)
    });
  }
  const located = registrationFilteredEvents;
  const sortedInMonth = sortHackathonEvents(inMonth, sortBy, student);
  const featuredInMonth = (selectedLocation === "Needs verification"
    ? sortHackathonEvents(reviewEvents, sortBy, student)
    : sortedInMonth).slice(0, 20);
  const today = new Date().toISOString().slice(0, 10);
  const soon = sortHackathonEvents(registrationFilteredEvents.filter((event) =>
    event.registrationStatus !== "closed" && event.startDate &&
    (event.endDate || event.startDate) >= today), "recommended", student).slice(0, 5);
  const selected = featuredInMonth.find((event) => event.id === selectedEventId);
  const hasPopularityData = located.some((event) => scoreHackathon(event).participantCount != null);
  const selectedSort = ["recommended", "prize", "deadline", "popularity"].includes(sortBy) ? sortBy : "recommended";
  const sourceHealth = discoveryStatusError
    ? "Event discovery status could not be checked; showing saved listings where available."
    : discoveryStatus?.lastSuccessfulSyncAt
      ? `Discovery last succeeded ${escapeHtml(new Date(discoveryStatus.lastSuccessfulSyncAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }))}`
      : discoveryStatus?.lastAttemptedAt
        ? "Event discovery has not completed a successful source sync yet."
        : "Waiting for the first event source sync.";
  const sourceSummary = Array.isArray(discoveryStatus?.sources)
    ? discoveryStatus.sources.map((source) => {
      if (source.name === "Pipeline") {
        return source.ok
          ? `${source.saved ?? 0} saved (${source.inserted ?? 0} new, ${source.updated ?? 0} updated); ${source.deduplicated ?? 0} duplicates removed`
          : "Pipeline refresh failed; previous saved events were retained.";
      }
      if (source.name === "Gemini classification") {
        if (source.skipped) return "Gemini classification skipped";
        if (source.error) return `Gemini classification: ${source.error}`;
        return "Gemini classification: complete";
      }
      const partial = source.errorCount ? `; ${source.errorCount} partial failure${source.errorCount === 1 ? "" : "s"}` : "";
      const truncated = source.queries?.some((query) => query.truncated) ? "; some query results capped" : "";
      return `${source.name}: ${source.normalized}/${source.fetched} validated${partial}${truncated}`;
    }).join(" · ")
    : "";
  const emptyMessage = loading ? "Loading event listings…"
    : discoveryStatusError
      ? "Discovery status is unavailable, so event-source results could not be confirmed. Retry later or check the Needs verification list."
      : discoveryStatus?.lastAttemptFailed
        ? "The latest event discovery attempt failed. Previously saved listings remain available while the sources are retried."
        : discoveryStatus?.sourcesReturnedNoEvents && !normalizedEvents.length
          ? "Event sources completed successfully but returned no listings. Try again after the next scheduled refresh."
          : selectedLocation === "Needs verification"
      ? "No India-related events currently need location or date review."
      : !indiaEvents.length
        ? "No verified India-eligible listings are available in the current source data. Check Needs verification for listings with uncertain details."
        : "No events match this location, category, registration status, and month. Try All India or another month.";
  const studentWorkspace = renderStudentSidebar("student-events");
  const monthName = monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return `<div class="student-portal student-workspace opportunity-workspace">${studentWorkspace}
    <main class="student-content student-workspace-main opportunity-main">
      <header class="student-workspace-topbar"><span>Student portal <b>/</b> Events &amp; Opportunities</span><div><span class="opportunity-verified">${lastVerified ? `Events last verified ${escapeHtml(new Date(lastVerified).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }))}` : "Waiting for the first event verification"}</span> <button class="opportunity-today" type="button" data-action="refresh-student-events"${refreshing ? " disabled" : ""}>${refreshing ? "Refreshing…" : "Refresh events"}</button></div></header>
      <section class="opportunity-hero"><div><span class="eyebrow">A BETTER WAY TO FIND YOUR NEXT STEP</span><h1>EVENTS &amp;<br/><em>OPPORTUNITIES</em></h1><p>Discover hackathons, tech events and opportunities worth attending.</p></div><span class="opportunity-hero-stamp">MENTORA<br/>OPPORTUNITY BOARD</span></section>
      ${error ? `<p class="opportunity-alert" role="alert">${escapeHtml(error)}${events.length ? " Previously verified events are still shown." : ""}</p>` : ""}
      <p class="opportunity-discovery-status" role="status">${sourceHealth}${sourceSummary ? ` · ${escapeHtml(sourceSummary)}` : ""}</p>
      ${refreshMessage ? `<p class="opportunity-discovery-status" role="status">${escapeHtml(refreshMessage)}</p>` : ""}
      <section class="opportunity-soon"><div class="opportunity-section-heading"><div><span class="eyebrow">YOUR NEXT OPEN DOOR</span><h2>Happening soon</h2></div><span>Sorted for ${escapeHtml(student?.course || "your interests")}</span></div>
        ${loading && !events.length ? `<div class="opportunity-empty">Finding current opportunities from verified event sources…</div>` : soon.length ? `<div class="opportunity-soon-list">${soon.map((event) => eventMarkup(event, true)).join("")}</div>` : `<div class="opportunity-empty">${escapeHtml(emptyMessage)}</div>`}
      </section>
      <section class="opportunity-board">
        <div class="opportunity-board-toolbar"><div class="opportunity-month-nav"><button type="button" aria-label="Previous month" data-action="events-prev-month">‹</button><h2>${escapeHtml(monthName)}</h2><button type="button" aria-label="Next month" data-action="events-next-month">›</button><button class="opportunity-today" type="button" data-action="events-today">Today</button></div>
          <div class="opportunity-event-controls"><label class="opportunity-location-label">Location<select data-events-location aria-label="Filter events by location">${INDIA_LOCATION_OPTIONS.map((option) => `<option${selectedLocation === option ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label><label class="opportunity-location-label">Registration<select data-events-registration aria-label="Filter by registration status"><option value="all"${selectedRegistrationStatus === "all" ? " selected" : ""}>All statuses</option><option value="open"${selectedRegistrationStatus === "open" ? " selected" : ""}>Open</option><option value="coming_soon"${selectedRegistrationStatus === "coming_soon" ? " selected" : ""}>Coming soon</option><option value="closed"${selectedRegistrationStatus === "closed" ? " selected" : ""}>Closed</option><option value="unknown"${selectedRegistrationStatus === "unknown" ? " selected" : ""}>Unverified</option></select></label><label class="opportunity-location-label">Sort by<select data-events-sort aria-label="Sort events"><option value="recommended"${selectedSort === "recommended" ? " selected" : ""}>Recommended</option><option value="prize"${selectedSort === "prize" ? " selected" : ""}>Prize pool</option><option value="deadline"${selectedSort === "deadline" ? " selected" : ""}>Upcoming deadline</option><option value="popularity"${selectedSort === "popularity" ? " selected" : ""}${hasPopularityData ? "" : " disabled"}>Popularity${hasPopularityData ? "" : " (no source counts)"}</option></select></label></div>
        </div>
        <div class="opportunity-filter-row" role="group" aria-label="Event category">${CATEGORIES.map((option) => `<button type="button" class="opportunity-filter ${selectedCategory === option ? "active" : ""}" data-action="events-category" data-category="${escapeHtml(option)}">${option}</button>`).join("")}</div>
        ${selectedLocation === "Needs verification" ? `<div class="opportunity-empty">These listings are excluded from India-only results until their source details confirm location or dates.</div>` : renderCalendar(featuredInMonth, monthDate)}
        <div class="opportunity-list-heading"><span class="eyebrow">${selectedLocation === "Needs verification" ? "DETAILS REVIEW" : "THE OPPORTUNITY BOARD · TOP 20"}</span><h2>${featuredInMonth.length} event${featuredInMonth.length === 1 ? "" : "s"}${selectedLocation === "Needs verification" ? " need review" : ` in ${escapeHtml(monthName)}`}</h2></div>
        <div class="opportunity-editorial-list">${featuredInMonth.map((event) => eventMarkup(event)).join("") || `<div class="opportunity-empty">${escapeHtml(emptyMessage)}</div>`}</div>
      </section>
    </main>
    ${selected ? renderEventDetails(selected) : ""}
  </div>`;
}

function renderEventDetails(event) {
  const deadline = event.registrationDeadline && new Date(event.registrationDeadline);
  const closed = event.registrationStatus === "closed" || (deadline && deadline.getTime() < Date.now());
  const place = !event.locationVerified ? event.location || "Location unverified"
    : event.mode === "online" ? "Online" : event.city ? `${event.location} · ${event.city}` : event.location;
  const tags = Array.isArray(event.tags) ? event.tags : [];
  const recommendation = scoreHackathon(event);
  return `<div class="opportunity-modal-backdrop" data-action="close-event"><article class="opportunity-detail-panel" role="dialog" aria-modal="true" aria-labelledby="opportunity-detail-title" data-stop-propagation="true">
    <button class="opportunity-detail-close" type="button" aria-label="Close details" data-action="close-event">×</button>
    ${event.imageUrl ? `<img class="opportunity-detail-image" src="${escapeHtml(event.imageUrl)}" alt="" loading="lazy"/>` : `<div class="opportunity-detail-art"><span>MENTORA<br/>OPPORTUNITY BOARD</span></div>`}
    <div class="opportunity-detail-copy"><span class="opportunity-category category-${categorySlug(event.category)}">${escapeHtml(event.category)}</span><h2 id="opportunity-detail-title">${escapeHtml(event.title)}</h2>
      <div class="opportunity-detail-facts"><div><span>DATE</span><strong>${escapeHtml(formatRange(event))}</strong></div><div><span>TIME</span><strong>${escapeHtml(event.startTime ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""}` : "See event page")}</strong></div><div><span>LOCATION</span><strong>${escapeHtml(place || "Location to be announced")}${event.locationVerified ? "" : " · Unverified"}</strong></div><div><span>FORMAT</span><strong>${escapeHtml(event.mode === "in_person" ? "In-person" : event.mode === "hybrid" ? "Hybrid" : event.mode === "online" ? "Online" : "Unverified")}</strong></div><div><span>EVENT SIZE</span><strong>${escapeHtml(event.eventSize === "unknown" ? "Not verified" : event.eventSize)}</strong></div><div><span>REGISTRATION</span><strong>${escapeHtml(event.registrationStatus.replace("_", " ") || "Unverified")}</strong></div><div><span>ORGANIZER</span><strong>${escapeHtml(event.organizer || "See source page")}</strong></div><div><span>ELIGIBILITY</span><strong>${escapeHtml(event.eligibility || "See event page")}</strong></div></div>
      <p class="opportunity-detail-description">${escapeHtml(event.description || "Visit the source page for the official event description and participation details.")}</p>
      ${event.aiSummary ? `<p class="opportunity-detail-description"><strong>AI summary (source wording):</strong> ${escapeHtml(event.aiSummary)}</p>` : ""}
      ${deadline ? `<p class="opportunity-detail-deadline"><strong>Registration deadline:</strong> ${escapeHtml(new Date(deadline).toLocaleString("en-IN", { dateStyle: "medium" }))}</p>` : `<p class="opportunity-detail-deadline"><strong>Registration deadline:</strong> Not listed</p>`}
      ${event.prize ? `<p class="opportunity-detail-deadline"><strong>Prize pool:</strong> ${escapeHtml(event.prize)}</p>` : `<p class="opportunity-detail-deadline"><strong>Prize pool:</strong> Not disclosed by the source</p>`}
      ${recommendation.participantCount != null ? `<p class="opportunity-detail-deadline"><strong>Source-reported participants:</strong> ${recommendation.participantCount.toLocaleString("en-IN")}</p>` : `<p class="opportunity-detail-deadline"><strong>Popularity:</strong> No verified participation count available</p>`}
      <div class="opportunity-score-detail"><strong>Mentora recommendation score: ${recommendation.score}/100</strong><span>Prize ${recommendation.components.prize}/25 · Location ${recommendation.components.location}/25 · Organizer/source ${recommendation.components.organizerAndSource}/15 · Technology relevance ${recommendation.components.technologyRelevance}/15 · Mentorship/career evidence ${recommendation.components.mentorshipAndCareerEvidence}/10 · Participation ${recommendation.components.verifiedParticipation}/10</span><small>${escapeHtml(recommendation.reasons.join("; ") || "Limited verified details available.")}</small></div>
      ${tags.length ? `<div class="opportunity-topics"><span>TECHNOLOGIES &amp; TOPICS</span><div>${tags.map((tag) => `<i>${escapeHtml(tag)}</i>`).join("")}</div></div>` : ""}
      ${closed ? `<span class="opportunity-registration-closed">Registration closed</span>` : /^https:\/\//i.test(event.url) ? `<a class="btn-primary opportunity-register" href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer">${event.registrationStatus === "open" ? "Register" : event.registrationStatus === "coming_soon" ? "Coming soon · View details" : "View official details"} <span aria-hidden="true">→</span></a>` : `<span class="opportunity-registration-closed">Registration link not verified</span>`}
      <p class="opportunity-source">${/^https:\/\//i.test(event.sourceUrl) ? `Source: <a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(event.sourceName || "Event source")} ↗` : "Source link unavailable"}${event.lastVerifiedAt ? ` · Verified ${escapeHtml(new Date(event.lastVerifiedAt).toLocaleDateString("en-IN"))}` : " · Verification date unavailable"}</p>
    </div>
  </article></div>`;
}
