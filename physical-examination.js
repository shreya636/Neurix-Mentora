const REGION_LABELS = {
  "head-neck": "Head and neck", "upper-limbs": "Arms and hands", "lower-limbs": "Legs and feet",
  "back-spine": "Back and spine", pelvis: "Pelvis", abdomen: "Abdomen", lungs: "Chest and lungs", heart: "Heart region",
};
const REGION_SYSTEMS = {
  "head-neck": ["eyes", "ears", "nose", "throat", "neck", "neurological"],
  "upper-limbs": ["musculoskeletal"], "lower-limbs": ["musculoskeletal"], "back-spine": ["musculoskeletal", "neurological"],
  pelvis: ["genitourinary", "abdomen"], abdomen: ["abdomen", "genitourinary"], lungs: ["lungs"], heart: ["heart"],
};
const TOOLS = [
  ["eye-light", "Eye response", "pupil-check", "eyes"], ["throat-light", "Mouth and throat", "oropharynx", "throat"],
  ["stethoscope", "Listen to chest", "auscultate", "chest"], ["abdominal-exam", "Examine abdomen", "", "abdomen"],
  ["neuro-exam", "Neurological screen", "orientation", "neurological"], ["movement-exam", "Movement and strength", "movement", "musculoskeletal"],
  ["skin-exam", "Skin and perfusion", "perfusion", "skin"],
];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const labelize = (value) => String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const systemLabel = (system) => ({ general: "General and vital signs", eyes: "Eyes", ears: "Ears", nose: "Nose", throat: "Mouth and throat", neck: "Neck", heart: "Cardiovascular", lungs: "Respiratory", abdomen: "Abdominal", neurological: "Neurological", musculoskeletal: "Musculoskeletal", genitourinary: "Genitourinary", skin: "Skin" }[system] || labelize(system));
function findingFor(item, key) {
  const [system, action] = key.split("|");
  if (system === "general") return item.vitals?.[{ temperature: "temperature", pulse: "heartRate", "blood-pressure": "bloodPressure", "respiratory-rate": "respiratoryRate", "oxygen-saturation": "oxygenSaturation" }[action]] || "Not provided";
  return item.findings?.[key] || "Not provided";
}

function atlasMarkup(progress) {
  return `<div class="case-atlas" id="case-atlas"><div class="anatomy-atlas-main"><div class="anatomy-atlas-toolbar" aria-label="Virtual patient controls"><button type="button" class="btn-secondary ${progress.bodyMode !== "internal" ? "selected" : ""}" data-case-action="body-mode" data-mode="external">External Examination</button><button type="button" class="btn-secondary ${progress.bodyMode === "internal" ? "selected" : ""}" data-case-action="body-mode" data-atlas-action="explore-anatomy" data-mode="internal" aria-pressed="${progress.bodyMode === "internal"}">Internal Anatomy</button><button type="button" class="btn-secondary" data-atlas-action="reset-view">Reset View</button></div><div class="anatomy-atlas-viewer"><canvas id="anatomy-atlas-canvas" aria-label="Interactive 3D virtual patient"></canvas><div id="anatomy-atlas-labels" aria-hidden="true"></div><div id="anatomy-atlas-loading" class="anatomy-atlas-status" role="status">Loading the 3D patient model…</div></div><p class="anatomy-atlas-hint">Drag to rotate · Scroll to zoom · Right-drag to pan · Tap the model to select an examination region</p><p class="anatomy-atlas-attribution">Aligned 3D body model adapted from <a href="https://github.com/SeemaBansal1/3d-human-body-anatomy" target="_blank" rel="noreferrer">3D Human Body Anatomy</a>. <a href="/anatomy-atlas/ATTRIBUTION.md" target="_blank" rel="noreferrer">Asset licenses and attribution</a></p></div><aside class="anatomy-atlas-panel" hidden><section class="anatomy-atlas-card"><span class="eyebrow">ANATOMICAL LAYERS</span><div id="anatomy-atlas-layers"></div></section><section class="anatomy-atlas-card anatomy-atlas-search-card"><label for="anatomy-atlas-search" class="eyebrow">SEARCH STRUCTURES</label><input id="anatomy-atlas-search" type="search" placeholder="Search anatomical structures" autocomplete="off"><div id="anatomy-atlas-search-results" role="listbox"></div></section><section class="anatomy-atlas-card anatomy-atlas-structure" aria-live="polite"><span class="eyebrow">SELECTED STRUCTURE</span><div id="anatomy-atlas-selection"><h2>No structure selected</h2><p>Explore a layer to select anatomical structures.</p></div><button id="anatomy-atlas-deselect" type="button" class="btn-secondary" hidden>Deselect</button></section></aside></div>`;
}

export function renderPhysicalExamination(item, progress, selectedRegion) {
  const panel = progress.examPanel || "overview";
  const selectedLogical = selectedRegion || progress.selectedRegion || "";
  const selectedLabel = progress.patientRegionLabel || (REGION_LABELS[progress.patientRegion] || (progress.patientRegion ? labelize(progress.patientRegion) : "Select a region on the patient"));
  const availableTools = TOOLS.filter(([, , action, logical]) => logical === "chest" ? Boolean(item.examination.heart?.includes(action) || item.examination.lungs?.includes(action)) : action ? item.examination[logical]?.includes(action) : item.examination[logical]?.length);
  const actions = (item.examination[selectedLogical] || []).map((action) => {
    const key = `${selectedLogical}|${action}`;
    const found = progress.examActions.includes(key);
    return `<button type="button" class="btn-secondary" data-case-action="exam-action" data-id="${escapeHtml(action)}" ${found ? "disabled" : ""}>${found ? "Finding recorded" : `Perform ${escapeHtml(labelize(action))}`}</button>`;
  }).join("");
  const seenFindings = progress.examActions.slice(-2).map((key) => { const [system, action] = key.split("|"); return `<li><strong>${escapeHtml(systemLabel(system))} - ${escapeHtml(labelize(action))}:</strong> ${escapeHtml(findingFor(item, key))}</li>`; }).join("");
  const vitals = [["Temperature", "temperature"], ["Pulse", "heartRate"], ["Blood pressure", "bloodPressure"], ["Respiratory rate", "respiratoryRate"], ["Oxygen saturation", "oxygenSaturation"]].map(([label, key]) => `<div class="case-vital-tile"><span>${label}</span><strong>${escapeHtml(item.vitals?.[key] || "Not provided")}</strong></div>`).join("");
  const vitalsVisible = progress.examPanel === "vitals";
  const bodyControls = panel === "examination" ? `<div class="case-body-controls"><p>Select a highlighted region on the model, or choose an available focus:</p><div class="case-region-chips">${[...new Set(availableTools.map(([, , , system]) => system === "chest" ? "lungs" : system))].map((region) => `<button type="button" class="btn-secondary patient-region-choice ${selectedLogical === region ? "selected" : ""}" data-case-action="select-region" data-region="${region}">${escapeHtml(systemLabel(region))}</button>`).join("")}</div><h3>${escapeHtml(selectedLabel)}</h3><div class="case-focused-actions">${actions || "<p>Choose a body region that has scripted findings in this case.</p>"}</div>${availableTools.length ? `<details class="case-more-exams"><summary>More examination options</summary><div>${availableTools.map(([id, label, action, logical]) => `<button type="button" class="btn-secondary" data-tool="${id}" data-exam="${action}" data-logical="${logical}" data-case-action="select-tool">${escapeHtml(label)}</button>`).join("")}</div></details>` : ""}</div>` : "";
  return `<span class="eyebrow">STEP 3 - PHYSICAL EXAMINATION</span><h2>Examine your virtual patient</h2><p class="case-illustration-note">Interactive 3D patient surface. Internal layers are educational views and do not show case-specific abnormalities.</p><div class="case-exam-workspace redesigned-case-exam"><div class="case-patient-column">${atlasMarkup(progress)}</div><aside class="case-exam-controls medical-case-card redesigned-case-summary"><span class="eyebrow">PATIENT SUMMARY</span><h3>${escapeHtml(item.specialty)} case · age ${item.age}</h3><p>${escapeHtml(item.complaint)}</p><div class="case-summary-count"><strong>${progress.examActions.length}</strong> findings discovered</div><ul class="case-recent-findings">${seenFindings || "<li>No examination findings have been revealed yet.</li>"}</ul>${vitalsVisible ? `<div class="case-vitals-grid">${vitals}</div>` : ""}<div class="case-primary-actions"><button type="button" class="btn-primary" data-case-action="open-exam">Examine Patient</button><button type="button" class="btn-secondary" data-case-action="check-vitals">${vitalsVisible ? "Vital Signs Recorded" : "Check Vital Signs"}</button><button type="button" class="btn-primary" data-case-action="continue-diagnosis">Continue to Diagnosis <span aria-hidden="true">→</span></button></div>${bodyControls}</aside></div>`;
}
