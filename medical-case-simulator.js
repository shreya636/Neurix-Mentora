import { renderAnatomyStudy } from "./anatomy-study.js";
import { renderStudentSidebar } from "./portal-navigation.js";
import { MEDICAL_CASES, advanceCaseProgress, applyCaseAction, chooseRandomCase, createCaseProgress, scoreCase } from "./medical-case-library.js";
import { renderPhysicalExamination } from "./physical-examination.js";

const STAGES = [
  ["presentation", "Presentation"], ["history", "History"], ["examination", "Examination"],
  ["investigations", "Investigations"], ["diagnosis", "Diagnosis"], ["management", "Management"], ["results", "Results"],
];
const validStages = new Set(STAGES.map(([id]) => id));
const titleCase = (text) => String(text || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const repairEncoding = (value) => {
  const text = String(value ?? "");
  if (!/[ÃÂâð]/.test(text)) return text;
  const codes = Array.from(text, (char) => char.charCodeAt(0));
  if (codes.some((code) => code > 255)) return text;
  try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(codes)); }
  catch { return text; }
};
const esc = (value) => repairEncoding(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function renderMedicalCaseSimulator() {
  let source = renderAnatomyStudy();
  source = source.replace(renderStudentSidebar("student-anatomy-study"), renderStudentSidebar("student-medical-case-simulator"));
  source = source.replace("MBBS <b>/</b> Human Anatomy Study", "MBBS <b>/</b> Clinical Case Simulator");
  source = source.replace("<h1>Human Anatomy Study</h1>", "<h1>Clinical Case Simulator</h1>");
  source = source.replace("<p>Explore an aligned 3D anatomy atlas. Select a named structure to study its source description and location.</p>", "<p>Work through fictional clinical cases, one decision at a time.</p>");
  const atlasStart = source.indexOf('<section class="anatomy-atlas-layout">');
  const atlasEnd = source.lastIndexOf("</main></div>");
  if (atlasStart < 0 || atlasEnd < atlasStart) return source;
  const caseFlow = `<section class="clinical-case-app" aria-label="Clinical case simulator">
    <section id="case-landing" class="medical-case-card case-landing">
      <div><span class="eyebrow">CLINICAL SKILLS LAB</span><h2>Your patient is waiting. Can you find the diagnosis?</h2><p>Practice with fictional cases and predefined findings. Nothing here represents a real patient encounter.</p></div>
      <div class="case-setup-controls">
        <label>Specialty <select id="case-specialty"><option value="all">Any specialty</option>${[...new Set(MEDICAL_CASES.map((item) => item.specialty))].map((value) => `<option>${esc(value)}</option>`).join("")}</select></label>
        <label>Difficulty <select id="case-difficulty"><option value="all">Any difficulty</option>${[...new Set(MEDICAL_CASES.map((item) => item.difficulty))].map((value) => `<option>${esc(value)}</option>`).join("")}</select></label>
        <button type="button" class="btn-primary" data-case-action="start">Start Random Case <span aria-hidden="true">&rarr;</span></button>
      </div>
      <button id="case-resume" type="button" class="btn-secondary case-resume" data-case-action="resume" hidden>Resume your saved case</button>
    </section>
    <section id="case-player" hidden>
      <div id="case-stepper" class="guided-case-stepper" aria-label="Case progress"></div>
      <section id="case-stage" class="medical-case-card case-stage" aria-live="polite"></section>
    </section>
    <div id="case-atlas-cache" hidden></div>
    <p id="case-message" class="medical-case-note" role="status" aria-live="polite"></p>
    <p class="case-educational-notice">Fictional educational simulation only. Do not use this simulator to diagnose or treat a real person.</p>
  </section>`;
  return `${source.slice(0, atlasStart)}${caseFlow}${source.slice(atlasEnd)}`;
}

function stateKey(token) {
  let hash = 2166136261;
  for (const char of String(token || "mentora")) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `mentora.clinical-case.v1.${(hash >>> 0).toString(36)}`;
}

export function wireMedicalCaseSimulator({ token, onAtlasMount }) {
  const root = document.getElementById("app");
  const storage = stateKey(token);
  let progress = null;
  let previousCaseId = "";
  let selectedRegion = "";
  let renderVersion = 0;
  let syncingAtlas = false;

  try {
    const saved = JSON.parse(localStorage.getItem(storage) || "null");
    if (saved && saved.progress && MEDICAL_CASES.some((item) => item.id === saved.progress.caseId) && validStages.has(saved.progress.stage)) {
      progress = saved.progress;
      progress.selectedRegion ||= "";
      selectedRegion = progress.selectedRegion;
      previousCaseId = saved.previousCaseId || progress.caseId;
    }
  } catch { /* Storage can be unavailable in private browsing; play still works in memory. */ }

  const caseData = () => MEDICAL_CASES.find((item) => item.id === progress?.caseId) || null;
  const save = () => {
    try { localStorage.setItem(storage, JSON.stringify({ progress, previousCaseId: progress?.caseId || previousCaseId })); }
    catch { message("Progress will remain available until this page is closed because browser storage is unavailable."); }
  };
  function message(value) {
    const node = root.querySelector("#case-message");
    if (node) node.textContent = value || "";
  }
  function beginCase() {
    const specialty = root.querySelector("#case-specialty").value;
    const difficulty = root.querySelector("#case-difficulty").value;
    const selected = chooseRandomCase({ previousId: previousCaseId, specialty, difficulty });
    if (!selected) { message("No built-in case matches those filters. Choose Any specialty or difficulty."); return; }
    previousCaseId = selected.id;
    progress = createCaseProgress(selected);
    selectedRegion = "";
    save();
    render();
  }
  function stepper() {
    return STAGES.map(([id, label], index) => {
      const at = STAGES.findIndex(([stage]) => stage === progress.stage);
      return `<span class="guided-case-step ${id === progress.stage ? "current" : index < at ? "done" : ""}"><i>${index + 1}</i>${label}</span>`;
    }).join("");
  }
  function continueButton(label) { return `<button type="button" class="btn-primary" data-case-action="continue" data-stage="${esc(progress.stage)}">${label} <span aria-hidden="true">&rarr;</span></button>`; }
  function presentation(item) {
    return `<span class="eyebrow">STEP 1 - PATIENT PRESENTATION - ${esc(item.specialty.toUpperCase())} - ${esc(item.difficulty.toUpperCase())}</span><h2>Fictional patient - age ${item.age}</h2><h3>Chief complaint</h3><p>${esc(item.complaint)}</p><h3>Initial symptoms</h3><ul>${item.symptoms.map((symptom) => `<li>${esc(symptom)}</li>`).join("")}</ul><p class="medical-case-note">Vital signs and examination findings are revealed during the physical examination.</p>${continueButton("Continue to history")}`;
  }
  function history(item) {
    return `<span class="eyebrow">STEP 2  -  HISTORY TAKING</span><h2>Ask the patient</h2><p>Select questions to reveal the corresponding history. You can ask each question once.</p><div class="case-question-list">${item.historyQuestions.map((question) => {
      const asked = progress.askedHistory.includes(question.id);
      return `<article class="case-question"><button type="button" class="btn-secondary" data-case-action="ask-history" data-id="${esc(question.id)}" ${asked ? "disabled" : ""}>${asked ? "Asked" : "Ask"}: ${esc(question.question)}</button>${asked ? `<p>${esc(question.answer)}</p>` : ""}</article>`;
    }).join("")}</div>${continueButton("Continue to physical examination")}`;
  }
  function examination(item) { return renderPhysicalExamination(item, progress, selectedRegion); }
  function investigations(item) {
    return `<span class="eyebrow">STEP 4  -  INVESTIGATIONS</span><h2>Choose investigations</h2><p>Order a test to reveal its predefined result for this fictional case.</p><div class="guided-case-test-options">${item.investigations.map((test) => `<button type="button" class="btn-secondary" data-case-action="order-test" data-id="${esc(test.id)}" ${progress.orderedTests.includes(test.id) ? "disabled" : ""}>${progress.orderedTests.includes(test.id) ? "Ordered  -  " : "Order  -  "}${esc(test.label)}</button>`).join("")}</div><div class="guided-case-test-results">${progress.orderedTests.map((id) => { const test = item.investigations.find((entry) => entry.id === id); return `<article><strong>${esc(test.label)}</strong><p>${esc(test.result)}</p></article>`; }).join("") || "<p>No investigations ordered yet.</p>"}</div>${continueButton("Continue to diagnosis")}`;
  }
  function diagnosis(item) {
    return `<span class="eyebrow">STEP 5  -  DIAGNOSIS</span><h2>What is the most likely diagnosis?</h2><div class="case-choice-list">${item.diagnosisOptions.map((option) => `<label class="case-choice ${progress.diagnosis === option ? "selected" : ""}"><input type="radio" name="case-diagnosis" value="${esc(option)}" ${progress.diagnosis === option ? "checked" : ""}><span>${esc(option)}</span></label>`).join("")}</div><h3>Which alternatives should remain in your differential?</h3><div class="case-choice-list">${item.differentials.map((option) => `<label class="case-choice ${progress.differentials.includes(option) ? "selected" : ""}"><input type="checkbox" name="case-differential" value="${esc(option)}" ${progress.differentials.includes(option) ? "checked" : ""}><span>${esc(option)}</span></label>`).join("")}</div>${continueButton("Submit Diagnosis  -  Continue to management")}`;
  }
  function management(item) {
    return `<span class="eyebrow">STEP 6  -  MANAGEMENT</span><h2>What should the clinician do next?</h2><p>Choose the safest appropriate next step for this simulation.</p><div class="case-management-choices">${item.managementOptions.map((option) => `<label class="case-choice ${progress.management === option.id ? "selected" : ""}"><input type="radio" name="case-management" value="${esc(option.id)}" ${progress.management === option.id ? "checked" : ""}><span>${esc(option.label)}</span></label>`).join("")}</div>${continueButton("Submit Management Plan")}`;
  }
  function results(item) {
    const result = scoreCase(item, progress);
    return `<span class="eyebrow">STEP 7  -  RESULTS</span><h2>Your score: ${result.score}/100</h2><div class="case-score-grid">${Object.entries({ "History taking": result.parts.history, "Physical examination": result.parts.examination, Investigations: result.parts.investigations, Diagnosis: result.parts.diagnosis, Differentials: result.parts.differentials, Management: result.parts.management }).map(([label, score]) => `<div><span>${esc(label)}</span><strong>${score}</strong></div>`).join("")}</div><section class="case-result-section"><h3>Expected diagnosis</h3><p>${esc(item.diagnosis)}</p><p>${esc(item.explanation)}</p></section><section class="case-result-section"><h3>Management feedback</h3><p><strong>${result.chosenManagement?.correct ? "Appropriate choice" : "Expected next step"}:</strong> ${esc(item.managementOptions.find((option) => option.correct)?.label)}</p><p>${esc(result.chosenManagement?.explanation || item.managementOptions.find((option) => option.correct)?.explanation)}</p></section><section class="case-result-section"><h3>Missed clues to review</h3>${result.missed.length ? `<ul>${result.missed.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>` : "<p>You covered the key history, examination, tests, diagnosis, and management points.</p>"}</section><p class="case-source-links">Educational reference: <a href="${esc(item.source.url)}" target="_blank" rel="noreferrer">${esc(item.source.title)}</a></p><p class="medical-case-note">This is an educational scoring rubric, not AI-generated feedback or clinical advice.</p><button type="button" class="btn-primary" data-case-action="another">Practice Another Case <span aria-hidden="true">&rarr;</span></button>`;
  }
  function render() {
    const landing = root.querySelector("#case-landing");
    const player = root.querySelector("#case-player");
    if (!progress) {
      landing.hidden = false; player.hidden = true;
      root.querySelector("#case-resume").hidden = true;
      return;
    }
    const item = caseData();
    if (!item) { progress = null; render(); return; }
    landing.hidden = true; player.hidden = false;
    root.querySelector("#case-stepper").innerHTML = stepper();
    const stageNode = root.querySelector("#case-stage");
    const atlasCacheNode = root.querySelector("#case-atlas-cache");
    const atlasCache = typeof atlasCacheNode?.append === "function" ? atlasCacheNode : null;
    const cachedAtlas = atlasCache?.querySelector("#case-atlas") || null;
    const retainedAtlas = (typeof stageNode.querySelector === "function" ? stageNode.querySelector("#case-atlas") : null) || cachedAtlas;
    const stageMarkup = ({ presentation, history, examination, investigations, diagnosis, management, results })[progress.stage](item);
    const stageIndex = STAGES.findIndex(([id]) => id === progress.stage);
    stageNode.innerHTML = `${stageIndex > 0 && progress.stage !== "results" ? `<button type="button" class="btn-secondary case-back-button" data-case-action="back" data-stage="${esc(progress.stage)}">Back</button>` : ""}${stageMarkup}`;
    stageNode.querySelectorAll?.('[data-case-action="continue"]').forEach((button) => { button.dataset.stage = progress.stage; });
    if (progress.stage === "examination" && typeof stageNode.querySelector === "function") {
      const freshAtlas = stageNode.querySelector("#case-atlas");
      if (retainedAtlas && freshAtlas && retainedAtlas !== freshAtlas) freshAtlas.replaceWith(retainedAtlas);
      if (!retainedAtlas && onAtlasMount) {
        onAtlasMount((region) => {
          const systems = REGION_SYSTEMS[region?.region] || [];
          const available = systems.find((system) => item.examination[system]?.length);
          progress.patientRegion = region?.region || "";
          progress.patientRegionLabel = region?.label || REGION_LABELS[region?.region] || "Selected patient region";
          selectedRegion = available || "";
          progress.selectedRegion = selectedRegion;
          progress.examPanel = "examination";
          message(available ? "" : "No scripted examination finding is available for this region in this case.");
          save(); render();
        });
        if (progress.bodyMode === "internal") setAtlasMode("internal");
      }
      atlasCache?.replaceChildren();
    } else if (retainedAtlas && atlasCache) atlasCache.append(retainedAtlas);
    renderVersion += 1;
    save();
  }
  function setAtlasMode(mode) {
    const atlas = root.querySelector("#case-atlas");
    if (!atlas) return;
    const explore = atlas.querySelector('[data-atlas-action="explore-anatomy"]');
    const isInternal = explore?.getAttribute("aria-pressed") === "true";
    if ((mode === "internal") !== isInternal && explore) {
      syncingAtlas = true;
      explore.click();
      syncingAtlas = false;
    }
    if (mode === "internal") {
      for (const [id, checked] of [["skin", false], ["organs", true]]) {
        const input = atlas.querySelector(`[data-atlas-system="${id}"]`);
        if (input && input.checked !== checked) { input.checked = checked; input.dispatchEvent(new Event("change", { bubbles: true })); }
      }
    }
  }
  function next() {
    const result = advanceCaseProgress(progress);
    if (result.error) { message(result.error); return; }
    progress = result.progress; selectedRegion = progress.selectedRegion || ""; message(""); render();
  }
  root.addEventListener("change", (event) => {
    const item = caseData();
    if (event.target.matches('input[name="case-diagnosis"]')) progress = applyCaseAction(progress, item, "diagnosis", event.target.value);
    if (event.target.matches('input[name="case-management"]')) progress = applyCaseAction(progress, item, "management", event.target.value);
    if (event.target.matches('input[name="case-differential"]')) progress = applyCaseAction(progress, item, "differential", event.target.value);
    if (event.target.matches('input[name^="case-"]')) { save(); render(); }
  });
  root.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches?.('[data-case-action="patient-region"]')) {
      event.preventDefault();
      event.target.click();
    }
  });
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-case-action]");
    if (!button) return;
    const action = button.dataset.caseAction;
    if (syncingAtlas && action === "body-mode") return;
    if (action === "start") { if (!progress) beginCase(); return; }
    if (action === "another") { if (progress?.stage === "results") beginCase(); return; }
    if (action === "resume") { render(); return; }
    if (!progress) return;
    if (button.dataset.stage && button.dataset.stage !== progress.stage) return;
    if (action === "continue") { next(); return; }
    if (action === "open-exam") { progress.examPanel = "examination"; save(); render(); return; }
    if (action === "body-mode") { progress.bodyMode = button.dataset.mode === "internal" ? "internal" : "external"; setAtlasMode(progress.bodyMode); save(); render(); return; }
    if (action === "check-vitals") {
      const item = caseData();
      progress = applyCaseAction(progress, item, "select-region", "general");
      for (const vitalAction of item.examination.general || []) progress = applyCaseAction(progress, item, "exam-action", vitalAction);
      progress.examPanel = "vitals";
      message(""); save(); render(); return;
    }
    if (action === "continue-diagnosis") {
      // Investigations remain available via Back from diagnosis; students may continue directly when ready.
      progress.stage = "diagnosis"; progress.examPanel = "overview"; message(""); save(); render(); return;
    }
    if (action === "back") {
      const index = STAGES.findIndex(([id]) => id === progress.stage);
      if (index > 0) { progress.stage = STAGES[index - 1][0]; selectedRegion = progress.selectedRegion || ""; save(); render(); }
      return;
    }
    const item = caseData();
    if (action === "ask-history") progress = applyCaseAction(progress, item, action, button.dataset.id);
    if (action === "select-region") {
      progress = applyCaseAction(progress, item, action, button.dataset.region);
      selectedRegion = progress.selectedRegion;
      progress.patientRegion = button.dataset.region;
      progress.patientRegionLabel = titleCase(button.dataset.region);
      save(); render(); return;
    }
    if (action === "select-tool") { progress.examTool = button.dataset.tool; progress.examAction = button.dataset.exam; progress.examLogical = button.dataset.logical; save(); render(); return; }
    if (action === "patient-region") {
      progress.patientRegion = button.dataset.region;
      selectedRegion = "";
      progress.selectedRegion = "";
      const logical = button.dataset.logical || button.dataset.region;
      const requested = progress.examLogical === "chest" ? logical : progress.examLogical || logical;
      if (item.examination[requested]) { progress = applyCaseAction(progress, item, "select-region", requested); selectedRegion = requested; }
      const examAction = progress.examAction || "";
      if (selectedRegion && examAction && (item.examination[selectedRegion] || []).includes(examAction)) {
        progress = applyCaseAction(progress, item, "exam-action", examAction);
        message("");
      } else if (!selectedRegion) message("This case has no scripted examination finding for that body area. Choose a highlighted case region.");
      else if (examAction) message("That tool does not have a scripted action for this region. Choose an available examination action.");
      save(); render(); return;
    }
    if (action === "exam-action") progress = applyCaseAction(progress, item, action, button.dataset.id);
    if (action === "order-test") progress = applyCaseAction(progress, item, action, button.dataset.id);
    message("");
    if (action === "exam-action") { save(); render(); return; }
    render();
  });

  const savedAvailable = Boolean(progress);
  if (savedAvailable) {
    root.querySelector("#case-resume").hidden = false;
    root.querySelector("#case-resume").textContent = `Resume saved case  -  ${caseData()?.specialty || "Case"}  -  ${progress.stage}`;
    render();
  } else render();
}

