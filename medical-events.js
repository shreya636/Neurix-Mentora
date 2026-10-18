import { renderStudentSidebar } from "./portal-navigation.js";
import { normalizeStudentEvent } from "./student-events.js";

// Medical events board for the MBBS student category.
//
// No live medical event source is connected yet, so this page renders clearly
// labelled sample listings instead of presenting invented events as real ones.
// It already understands real listings: pass rows from the `events` table via
// the `events` prop (with a medical `category`, a medical tag, or `medical: true`)
// and they replace the samples.

export const MEDICAL_EVENT_CATEGORIES = [
  "All",
  "Medical Conferences & Seminars",
  "Workshops & CME",
  "Medical Quizzes & Competitions",
  "Internships & Research",
  "Medical Camps & Volunteering",
  "Webinars & Guest Lectures",
  "Student Events"
];

const CATEGORY_ORDER = MEDICAL_EVENT_CATEGORIES.slice(1);

const CATEGORY_PATTERNS = [
  ["Medical Conferences & Seminars", /\b(conference|seminar|symposium|congress|grand rounds?|panel discussion|healthcare discussion)\b/i],
  ["Workshops & CME", /\b(cme|continuing medical education|workshop|clinical skills?|anatomy|hands[- ]on|training|masterclass|simulation)\b/i],
  ["Medical Quizzes & Competitions", /\b(quiz|competition|contest|case presentation|poster presentation|debate|olympiad|championship)\b/i],
  ["Internships & Research", /\b(internship|research|fellowship|observership|elective|summer (school|programme|program)|studentship)\b/i],
  ["Medical Camps & Volunteering", /\b(camp|volunteer|community health|outreach|screening|health mela|blood donation|ngo)\b/i],
  ["Webinars & Guest Lectures", /\b(webinar|guest lecture|lecture series|online session|live session|fireside|talk)\b/i],
  ["Student Events", /\b(fest|festival|student association|intercollegiate|annual day|cultural|sports meet)\b/i]
];

// A listing counts as medical only when it says so explicitly. Free text is used
// to pick the sub-category, never to decide that a tech listing is a medical one.
const MEDICAL_TAG = /^(medical|medicine|mbbs|clinical|cme|health|healthcare|nursing)$/i;
const MEDICAL_AUDIENCE = /\b(mbbs|medical student|medical college|nursing student|medical education|paramedic)\b/i;

export function isMedicalEvent(event) {
  if (!event) return false;
  if (event.medical === true || event.medicalEvent === true) return true;
  if (CATEGORY_ORDER.includes(String(event.category || "").trim())) return true;
  if (Array.isArray(event.tags) && event.tags.some((tag) => MEDICAL_TAG.test(String(tag).trim()))) return true;
  return MEDICAL_AUDIENCE.test(`${event.eligibility || ""} ${event.audience || ""}`);
}

export function medicalCategoryForEvent(event) {
  const text = `${event?.medical_category || ""} ${event?.category || ""} ${event?.type || ""} ${event?.title || ""} ${(event?.tags || []).join(" ")} ${event?.description || ""}`;
  const declared = CATEGORY_ORDER.includes(String(event?.medical_category || "").trim())
    ? String(event.medical_category).trim()
    : CATEGORY_ORDER.includes(String(event?.category || "").trim()) ? String(event.category).trim() : "";
  if (CATEGORY_ORDER.includes(declared)) return declared;
  for (const [category, pattern] of CATEGORY_PATTERNS) if (pattern.test(text)) return category;
  return "Medical Conferences & Seminars";
}

// Samples exist so the board is not an empty shell, and are labelled as samples
// on every card. They deliberately carry no real dates, organisers, fees, venues
// or registration links.
const SAMPLE_MEDICAL_EVENTS = [
  {
    id: "sample-medical-conference",
    title: "Medical conference & seminar (sample listing)",
    medical_category: "Medical Conferences & Seminars",
    description: "Sample layout for a medical conference, academic seminar or healthcare discussion.",
    organizer: "Organiser to be confirmed",
    eligibility: "Open to MBBS students — confirm with the organiser",
    format: "unknown"
  },
  {
    id: "sample-workshop-cme",
    title: "Clinical skills workshop (sample listing)",
    medical_category: "Workshops & CME",
    description: "Sample layout for an anatomy workshop, clinical skills workshop or CME event suited to your level.",
    organizer: "Organiser to be confirmed",
    eligibility: "Level-appropriate workshops — confirm with the organiser",
    format: "unknown"
  },
  {
    id: "sample-quiz-competition",
    title: "Intercollegiate medical quiz (sample listing)",
    medical_category: "Medical Quizzes & Competitions",
    description: "Sample layout for a medical quiz, case presentation, poster presentation or student competition.",
    organizer: "Organiser to be confirmed",
    eligibility: "Open to MBBS students — confirm with the organiser",
    format: "unknown"
  },
  {
    id: "sample-internship-research",
    title: "Student research programme (sample listing)",
    medical_category: "Internships & Research",
    description: "Sample layout for a research internship, student research programme or academic opportunity.",
    organizer: "Organiser to be confirmed",
    eligibility: "Confirm eligibility with the organiser before applying",
    format: "unknown"
  },
  {
    id: "sample-camp-volunteering",
    title: "Community health camp (sample listing)",
    medical_category: "Medical Camps & Volunteering",
    description: "Sample layout for a health camp, community health activity or volunteering opportunity.",
    organizer: "Organiser to be confirmed",
    eligibility: "Confirm eligibility with the organiser",
    format: "unknown"
  },
  {
    id: "sample-webinar-lecture",
    title: "Guest lecture series (sample listing)",
    medical_category: "Webinars & Guest Lectures",
    description: "Sample layout for a session led by a doctor, researcher or medical educator.",
    organizer: "Organiser to be confirmed",
    eligibility: "Open to MBBS students — confirm with the organiser",
    format: "online"
  },
  {
    id: "sample-student-event",
    title: "Medical college fest (sample listing)",
    medical_category: "Student Events",
    description: "Sample layout for a medical college fest, student association event or intercollegiate activity.",
    organizer: "Organiser to be confirmed",
    eligibility: "Open to MBBS students — confirm with the organiser",
    format: "unknown"
  }
];

export function normalizeMedicalEvents(events) {
  return (events || [])
    .filter(isMedicalEvent)
    .map((event) => {
      const normalized = normalizeStudentEvent(event);
      return {
        ...normalized,
        medicalCategory: medicalCategoryForEvent({ ...event, ...normalized }),
        sample: false
      };
    })
    .sort((a, b) => (a.startDate || "9999-99-99").localeCompare(b.startDate || "9999-99-99"));
}

export function sampleMedicalEvents() {
  return SAMPLE_MEDICAL_EVENTS.map((source) => {
    const normalized = normalizeStudentEvent(source);
    return {
      ...normalized,
      medicalCategory: medicalCategoryForEvent({ ...source, ...normalized }),
      sample: true
    };
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function categorySlug(category) {
  return String(category || "").toLowerCase().replace(/[^a-z]+/g, "-");
}

function formatDay(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function dateParts(event) {
  if (!event.startDate) {
    return { block: "TBC", label: "Date not verified", time: event.startTime ? `${event.startTime} (unverified)` : "" };
  }
  const label = event.endDate && event.endDate !== event.startDate
    ? `${formatDay(event.startDate)} – ${formatDay(event.endDate)}`
    : formatDay(event.startDate);
  return {
    block: formatDay(event.startDate),
    label: event.dateVerified ? label : `${label} (unverified)`,
    time: event.startTime ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""}` : ""
  };
}

function medicalEventCard(event, hidden = false) {
  const date = dateParts(event);
  const formatLabel = event.mode === "in_person" ? "In person"
    : event.mode === "hybrid" ? "Hybrid"
      : event.mode === "online" ? "Online"
        : "Format not stated";
  const place = event.mode === "online" ? "Online"
    : event.location ? `${event.location}${event.locationVerified ? "" : " (unverified)"}`
      : "Venue not verified";
  const deadline = event.registrationDeadline && !Number.isNaN(new Date(event.registrationDeadline).getTime())
    ? new Date(event.registrationDeadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const hasRegistrationPage = !event.sample && /^https:\/\//i.test(event.url);
  const searchText = `${event.title} ${event.organizer} ${event.medicalCategory}`.toLowerCase();
  return `<article class="opportunity-event medical-event-card" data-medical-event data-medical-category="${escapeHtml(event.medicalCategory)}" data-medical-search="${escapeHtml(searchText)}"${hidden ? " hidden" : ""}>
    <span class="opportunity-date">${escapeHtml(date.block)}</span>
    <span class="opportunity-event-copy">
      <span class="opportunity-category category-${categorySlug(event.medicalCategory)}">${escapeHtml(event.medicalCategory)}</span>
      <strong>${escapeHtml(event.title)}</strong>
      <small>${escapeHtml(date.label)}${date.time ? ` · ${escapeHtml(date.time)}` : ""}</small>
      <small>${escapeHtml(place)} · ${escapeHtml(formatLabel)}</small>
      <small>Organiser: ${escapeHtml(event.organizer || "Not listed")}</small>
      <small>${escapeHtml(event.description || "No description provided.")}</small>
      <small>Eligibility: ${escapeHtml(event.eligibility || "Not listed")}</small>
      <small>Registration deadline: ${escapeHtml(deadline || "Not verified")}</small>
    </span>
    <span class="opportunity-deadline">
      ${event.sample ? '<span class="medical-event-sample">SAMPLE</span>' : ""}
      ${hasRegistrationPage
        ? `<a class="medical-event-link" href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer">Register / View details →</a>`
        : '<span class="medical-event-link-note">Registration link not verified</span>'}
    </span>
  </article>`;
}

export function renderMedicalEventsPage({ events = [], category = "All", search = "" } = {}) {
  const normalized = normalizeMedicalEvents(events);
  // Samples stand in until a live medical source is connected.
  const usingSamples = normalized.length === 0;
  const listed = usingSamples ? sampleMedicalEvents() : normalized;
  const selectedCategory = MEDICAL_EVENT_CATEGORIES.includes(category) ? category : "All";
  const notice = usingSamples
    ? "No live medical event source is connected yet. The listings below are clearly labelled samples that show how each category and card will look — they are not real events, and no dates, organisers, venues, fees, or registration links have been invented."
    : `${listed.length} medical listing${listed.length === 1 ? "" : "s"} from connected sources. Details are shown only where the source publishes them.`;
  const term = String(search || "").trim().toLowerCase();
  const matchesFilters = (event) => (selectedCategory === "All" || event.medicalCategory === selectedCategory) &&
    (!term || `${event.title} ${event.organizer} ${event.medicalCategory}`.toLowerCase().includes(term));
  const shown = listed.filter(matchesFilters);
  return `<div class="student-portal student-workspace opportunity-workspace medical-events-workspace">${renderStudentSidebar("student-events")}
    <main class="student-content student-workspace-main opportunity-main">
      <header class="student-workspace-topbar"><span>Student portal <b>/</b> MBBS <b>/</b> Events &amp; Opportunities</span><span class="opportunity-verified">Medical events, filtered for MBBS students</span></header>
      <section class="opportunity-hero"><div><span class="eyebrow">MEDICAL EVENTS &amp; OPPORTUNITIES</span><h1>LEARN BEYOND<br/><em>THE LECTURE HALL</em></h1><p>Conferences, workshops and CME events, quizzes, research internships, medical camps, webinars and student events — all in one place.</p></div><span class="opportunity-hero-stamp">MENTORA<br/>MEDICAL BOARD</span></section>
      <p class="medical-events-notice${usingSamples ? " is-sample" : ""}" role="note">${escapeHtml(notice)}</p>
      <section class="opportunity-board">
        <div class="opportunity-board-toolbar">
          <div class="opportunity-month-nav"><h2>Medical events</h2></div>
          <label class="opportunity-location-label medical-events-search-label">Search by event name<input id="medical-events-search" type="search" value="${escapeHtml(search)}" placeholder="Search events" autocomplete="off" /></label>
        </div>
        <div class="opportunity-filter-row medical-events-filter-row" role="group" aria-label="Medical event category">${MEDICAL_EVENT_CATEGORIES.map((option) => `<button type="button" class="opportunity-filter medical-events-filter ${selectedCategory === option ? "active" : ""}" data-action="medical-events-category" data-category="${escapeHtml(option)}" aria-pressed="${selectedCategory === option}">${escapeHtml(option)}</button>`).join("")}</div>
        <div class="opportunity-list-heading"><span class="eyebrow">MEDICAL OPPORTUNITIES</span><h2 id="medical-events-count">${shown.length} listing${shown.length === 1 ? "" : "s"} shown</h2></div>
        <div class="opportunity-editorial-list medical-events-list">${listed.map((event) => medicalEventCard(event, !matchesFilters(event))).join("")}</div>
        <div class="opportunity-empty" id="medical-events-no-match"${shown.length ? " hidden" : ""}>No medical events match this category and search. Try another category or a shorter search term.</div>
      </section>
    </main>
  </div>`;
}

// Filters run against the rendered board so typing in the search box does not
// re-render the page (and therefore does not steal focus from the input).
export function applyMedicalEventFilters(root, search = "") {
  if (!root) return;
  const term = String(search || "").trim().toLowerCase();
  const activeCategory = root.querySelector(".medical-events-filter.active")?.dataset.category || "All";
  let visible = 0;
  for (const card of root.querySelectorAll("[data-medical-event]")) {
    const matchesCategory = activeCategory === "All" || card.dataset.medicalCategory === activeCategory;
    const matchesSearch = !term || String(card.dataset.medicalSearch || "").includes(term);
    const show = matchesCategory && matchesSearch;
    card.hidden = !show;
    if (show) visible += 1;
  }
  const count = root.querySelector("#medical-events-count");
  if (count) count.textContent = `${visible} listing${visible === 1 ? "" : "s"} shown`;
  const empty = root.querySelector("#medical-events-no-match");
  if (empty) empty.hidden = visible > 0;
}
