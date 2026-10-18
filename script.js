import {
  deleteObservation,
  deleteStudentRecord,
  fetchClasses,
  fetchClassStudents,
  fetchStudentProfile,
  fetchPublishedEvents,
  fetchStudentEventDiscoveryStatus,
  refreshStudentEventDiscovery,
  findStudentByCode,
  restoreStudentSession,
  changeStudentPassword,
  requestTeacherAssistant,
  requestStudentAssistant,
  insertStudentRecord,
  isStudentCodeAvailable,
  insertObservation,
  createTeacherClass,
  updateTeacherClass,
  deleteTeacherClass,
  createTeacherAccount,
  loginTeacher,
  restoreTeacherSession,
  logoutTeacher,
  getTeacherAccessToken,
  resetStudentPassword,
  saveStudentRecord,
  saveSubjectAssessment
} from "./supabase.js";
import { renderStudentEventsPage } from "./student-events.js";
import { formatAssistantResponse } from "./assistant-response-formatting.js";
import { renderPerformanceHistoryChart } from "./performance-history-chart.js";
import { pathForScreen, renderStudentSidebar, resolvePortalRoute } from "./portal-navigation.js";
import { LANGUAGES, QUESTIONS, renderCodingPractice, starter as codingStarter } from "./coding-practice.js";
import { renderAnatomyStudy } from "./anatomy-study.js";
import { renderMedicalCaseSimulator, wireMedicalCaseSimulator } from "./medical-case-simulator.js";
import { STUDENT_CATEGORIES, categoryForStudentScreen, isStudentCategory } from "./student-category.js";

const STORAGE_KEY = "teachinsight_state_v1";
const STANDARD_OPTIONS = Array.from({ length: 12 }, (_, index) => `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} Standard`);
const SECTION_OPTIONS = ["A", "B", "C", "D", "E"];
// Institutions can adjust this built-in selector list without changing how grades are stored.
const SUBJECT_GRADE_SCALE = ["O", "A+", "A", "B+", "B", "C", "D", "F"];
const ASSESSMENT_KEYS = [
  { key: "academic", label: "Academic Understanding" },
  { key: "communication", label: "Communication" },
  { key: "problemSolving", label: "Problem Solving" },
  { key: "participation", label: "Participation" },
  { key: "teamwork", label: "Teamwork" },
  { key: "consistency", label: "Consistency" }
];

const state = loadState();
let generatedStudentCredentials = null;

initCursorGlow();

document.addEventListener("DOMContentLoaded", initializeApp);
window.addEventListener("popstate", handleLocationChange);
document.body.addEventListener("click", handleClick);
document.body.addEventListener("input", handleInput);
document.body.addEventListener("change", handleChange);
document.body.addEventListener("submit", handleSubmit);
document.body.addEventListener("dragover", (event) => {
  if (event.target.closest(".study-upload-dropzone")) event.preventDefault();
});
document.body.addEventListener("drop", (event) => {
  const dropzone = event.target.closest(".study-upload-dropzone");
  if (!dropzone) return;
  event.preventDefault();
  const input = dropzone.querySelector("input[type=file]");
  const file = event.dataTransfer?.files?.[0];
  if (!input || !file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  const filename = dropzone.querySelector("[data-study-filename]");
  if (filename) filename.textContent = file.name;
});
window.setInterval(() => {
  if (state.ui.screen === "student-events" && !document.hidden && !state.ui.eventsLoading) {
    loadStudentEvents();
  }
}, 5 * 60 * 1000);

document.addEventListener("keydown", (event) => {
  if (state.ui.subjectMarksSaving) return;
  if (event.key === "Escape" && state.ui.studyPlanFormOpen && !state.ui.activeModal && !state.ui.studyPlanLoading) {
    state.ui.studyPlanFormOpen = false;
    state.ui.studyPlanError = "";
    renderStudyPlanAppPreservingScroll();
  }
  if (event.key === "Escape" && state.ui.activeModal) {
    state.ui.activeModal = null;
    saveState();
    renderApp();
  }
});

function initCursorGlow() {
  const mediaQuery = window.matchMedia && window.matchMedia("(pointer: coarse)");
  if (mediaQuery && mediaQuery.matches) return;

  const glow = document.getElementById("cursor-glow") || document.createElement("div");
  glow.id = "cursor-glow";
  if (!glow.parentNode) {
    const firstChild = document.body.firstChild;
    document.body.insertBefore(glow, firstChild || null);
  }

  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
    opacity: 0,
    targetOpacity: 0
  };

  const render = () => {
    pointer.x += (pointer.targetX - pointer.x) * 0.14;
    pointer.y += (pointer.targetY - pointer.y) * 0.14;
    pointer.opacity += (pointer.targetOpacity - pointer.opacity) * 0.14;

    glow.style.left = `${pointer.x}px`;
    glow.style.top = `${pointer.y}px`;
    glow.style.transform = "translate(-50%, -50%)";
    glow.style.opacity = String(pointer.opacity);
    requestAnimationFrame(render);
  };

  const setActive = (active) => {
    pointer.targetOpacity = active ? 1 : 0;
  };

  window.addEventListener("mousemove", (event) => {
    pointer.targetX = event.clientX;
    pointer.targetY = event.clientY;
    setActive(true);
  }, { passive: true });

  window.addEventListener("mouseenter", () => setActive(true), { passive: true });
  window.addEventListener("mouseleave", () => setActive(false), { passive: true });
  window.addEventListener("blur", () => setActive(false), { passive: true });

  render();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.ui && (!Array.isArray(saved.students) || !Array.isArray(saved.classes))) {
      const emptyState = buildEmptyState();
      emptyState.ui = { ...emptyState.ui, ...saved.ui };
      emptyState.activeClassId = saved.activeClassId || null;
      return emptyState;
    }
    if (saved && Array.isArray(saved.students) && Array.isArray(saved.classes)) {
      saved.students = saved.students.filter((student) => student.classId);
      saved.ui = saved.ui || {};
      saved.ui.activeModal = null;
      saved.ui.selectedStudentId = null;
      saved.ui.searchQuery = "";
      saved.ui.analysisLoading = false;
      saved.ui.analysisByStudent = saved.ui.analysisByStudent || {};
      saved.ui.notification = null;
      saved.ui.studentSessionId = saved.ui.studentSessionId || null;
      let legacyIdNumber = 1;
      saved.students = saved.students.map((student) => {
        let studentId = student.studentId;
        while (!studentId) {
          const candidate = `MEN-${new Date().getFullYear()}-${String(legacyIdNumber++).padStart(3, "0")}`;
          if (!saved.students.some((entry) => entry !== student && entry.studentId === candidate)) studentId = candidate;
        }
        return {
          ...student,
          studentId,
          observations: student.observations || [],
          progress: student.progress || [],
          assessments: student.assessments || {}
        };
      });
      saved.activeClassId = saved.activeClassId || saved.classes[0]?.id || null;
      return saved;
    }
  } catch (error) {
    console.warn("Unable to parse saved state.", error);
  }

  return buildEmptyState();
}

function buildEmptyState() {
  return {
    classes: [],
    activeClassId: null,
    students: [],
    ui: {
      screen: "landing",
      nav: "dashboard",
      activeModal: null,
      selectedStudentId: null,
      searchQuery: "",
      analysisLoading: false,
      analysisByStudent: {},
      studentSessionId: null,
      studentMustChangePassword: false
    }
  };
}

function ensureDefaultUiState() {
  if (!state.ui) {
    state.ui = {
      screen: "landing",
      nav: "dashboard",
      activeModal: null,
      selectedStudentId: null,
      searchQuery: "",
      analysisLoading: false,
      analysisByStudent: {}
    };
  }

  state.ui.screen = state.ui.screen || "landing";
  state.ui.nav = state.ui.nav || "dashboard";
  state.ui.activeModal = state.ui.activeModal || null;
  state.ui.selectedStudentId = state.ui.selectedStudentId || null;
  state.ui.searchQuery = state.ui.searchQuery || "";
  state.ui.analysisLoading = false;
  state.ui.analysisByStudent = state.ui.analysisByStudent || {};
  state.ui.studentSessionId = state.ui.studentSessionId || null;
  state.ui.studentMustChangePassword = Boolean(state.ui.studentMustChangePassword);
  state.ui.notification = state.ui.notification || null;
  state.classes = Array.isArray(state.classes) ? state.classes : [];
  state.students = Array.isArray(state.students) ? state.students : [];
  state.activeClassId = state.activeClassId || state.classes[0]?.id || null;
}

function saveState() {
  const { ui, activeClassId } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activeClassId,
    ui: {
      screen: ui.screen,
      nav: ui.nav,
      analysisByStudent: ui.analysisByStudent,
      studentSessionId: ui.studentSessionId,
    }
  }));
}

async function initializeApp() {
  const rememberedClassId = state.activeClassId;
  document.getElementById("app").innerHTML = '<div class="landing-screen"><div class="landing-card"><p>Connecting to Mentora data...</p></div></div>';

  try {
    const studentToken = sessionStorage.getItem("mentora_student_session");
    if (studentToken) {
      const restored = await restoreStudentSession(studentToken);
      const restoredCategory = sessionStorage.getItem("mentora_student_category");
      if (restored && isStudentCategory(restoredCategory)) {
        state.students = [restored.student];
        state.classes = [{ id: restored.student.classId, name: restored.student.className, section: restored.student.section }];
        state.activeClassId = restored.student.classId;
        state.ui.studentSessionId = restored.student.id;
        state.ui.studentSessionToken = restored.sessionToken;
        state.ui.studentCategory = restoredCategory;
        state.ui.studentMustChangePassword = restored.mustChangePassword;
        await handleLocationChange({ initial: true });
        return;
      }
      sessionStorage.removeItem("mentora_student_session");
      sessionStorage.removeItem("mentora_student_category");
      state.ui.studentSessionId = null;
      state.ui.studentSessionToken = null;
      state.ui.studentCategory = null;
      state.ui.studentMustChangePassword = false;
    }
    state.teacher = await restoreTeacherSession();
    state.classes = state.teacher ? await fetchClasses() : [];
    state.students = [];
    state.activeClassId = state.classes.some((classRecord) => classRecord.id === rememberedClassId) ? rememberedClassId : null;
    await handleLocationChange({ initial: true });
  } catch (error) {
    state.teacher = null;
    state.classes = [];
    state.students = [];
    state.activeClassId = null;
    state.ui.screen = "landing";
    showPersistenceError(error, "Unable to restore teacher session");
  }
}

async function handleLocationChange({ initial = false } = {}) {
  const route = resolvePortalRoute(window.location.pathname);
  if (generatedStudentCredentials &&
      (route?.screen !== generatedStudentCredentials.screen ||
       (route.screen === "student-profile" && route.studentId !== generatedStudentCredentials.studentRecordId))) {
    generatedStudentCredentials = null;
  }
  if (state.ui.studentSessionToken && state.ui.studentMustChangePassword) {
    state.ui.screen = "student-password-change";
    renderApp();
    return;
  }
  if (route?.screen === "student-category-selection") {
    if (state.ui.studentSessionToken && isStudentCategory(state.ui.studentCategory)) {
      window.history.replaceState({}, "", pathForScreen("student-dashboard"));
      state.ui.screen = "student-dashboard";
      renderApp();
      return;
    }
    state.ui.screen = "student-category-selection";
    renderApp();
    return;
  }
  if (route?.screen === "student-login") {
    if (state.ui.studentSessionToken && isStudentCategory(state.ui.studentCategory)) {
      window.history.replaceState({}, "", pathForScreen("student-dashboard"));
      state.ui.screen = "student-dashboard";
    } else if (isStudentCategory(state.ui.studentCategory) && sessionStorage.getItem("mentora_student_category") === state.ui.studentCategory) {
      state.ui.screen = "student-login";
    } else {
      window.history.replaceState({}, "", pathForScreen("student-category-selection"));
      state.ui.screen = "student-category-selection";
    }
    renderApp();
    return;
  }
  if (!route) {
    const fallbackScreen = state.ui.studentSessionToken ? "student-dashboard" : state.teacher ? "class-selection" : "landing";
    window.history.replaceState({}, "", pathForScreen(fallbackScreen));
    state.ui.screen = fallbackScreen;
    renderApp();
    return;
  }

  const studentScreens = ["student-dashboard", "student-performance", "student-subjects", "student-assessments", "student-study-plan", "student-visualize", "student-coding-practice", "student-games", "student-anatomy-study", "student-medical-case-simulator", "student-ai", "student-events"];
  const teacherScreens = ["class-selection", "dashboard", "students", "insights", "teacher-ai", "student-profile"];
  if (studentScreens.includes(route.screen)) {
    if (!state.ui.studentSessionToken || !getStudentByAnyId(state.ui.studentSessionId)) {
      window.history.replaceState({}, "", pathForScreen("student-category-selection"));
      state.ui.screen = "student-category-selection";
      state.ui.selectedEventId = null;
      renderApp();
      return;
    }
    if (!isStudentCategory(state.ui.studentCategory)) {
      window.history.replaceState({}, "", pathForScreen("student-category-selection"));
      state.ui.screen = "student-category-selection";
      renderApp();
      return;
    }
    const requiredCategory = categoryForStudentScreen(route.screen);
    if (!isStudentCategory(state.ui.studentCategory) ||
        (requiredCategory && state.ui.studentCategory !== requiredCategory)) {
      window.history.replaceState({}, "", pathForScreen("student-dashboard"));
      state.ui.screen = "student-dashboard";
      renderApp();
      return;
    }
    state.ui.screen = route.screen;
    state.ui.selectedEventId = null;
    if (route.screen === "student-study-plan" && !state.ui.studyPlan && !state.ui.studyPlanFormOpen) {
      state.ui.studyPlanFormOpen = true;
      state.ui.studyWizard = createStudyWizard(getStudentByAnyId(state.ui.studentSessionId));
    }
    renderApp();
    window.scrollTo({ top: 0, behavior: "auto" });
    if (route.screen === "student-events") loadStudentEvents();
    return;
  }
  if (teacherScreens.includes(route.screen)) {
    if (state.ui.studentSessionToken) {
      window.history.replaceState({}, "", pathForScreen("student-dashboard"));
      state.ui.screen = "student-dashboard";
      renderApp();
      return;
    }
    if (!state.teacher) {
      state.ui.screen = "teacher-login";
      renderApp();
      return;
    }
    let screenToRender = route.screen;
    if (route.screen !== "class-selection") {
      if (!state.activeClassId || !state.classes.some((classRecord) => classRecord.id === state.activeClassId)) {
        state.activeClassId = state.classes[0]?.id || null;
      }
      if (!state.activeClassId) {
        state.ui.screen = "class-selection";
        if (!initial) window.history.replaceState({}, "", pathForScreen("class-selection"));
        renderApp();
        return;
      }
      try {
        state.students = await fetchClassStudents(state.activeClassId);
      } catch (error) {
        state.ui.notification = error.message || "Unable to load students for this class.";
        state.ui.screen = "class-selection";
        renderApp();
        return;
      }
      if (route.screen === "student-profile") {
        if (!state.students.some((student) => student.id === route.studentId)) {
          state.ui.notification = "That student is not in the selected class.";
          screenToRender = "students";
          window.history.replaceState({}, "", pathForScreen("students"));
        } else {
          try {
            const student = await fetchStudentProfile(route.studentId);
            const existingIndex = state.students.findIndex((entry) => entry.id === route.studentId);
            if (existingIndex >= 0) state.students[existingIndex] = student;
            state.ui.selectedStudentId = route.studentId;
          } catch (error) {
            state.ui.notification = error.message || "Unable to load student profile.";
            screenToRender = "students";
            window.history.replaceState({}, "", pathForScreen("students"));
          }
        }
      }
    }
    state.ui.screen = screenToRender;
    state.ui.nav = screenToRender === "student-profile" ? "students" : screenToRender === "class-selection" ? "classes" : screenToRender;
    state.ui.selectedEventId = null;
    renderApp();
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  if (route.screen === "landing" && state.ui.studentSessionToken) {
    window.history.replaceState({}, "", pathForScreen("student-dashboard"));
    state.ui.screen = "student-dashboard";
  } else if (route.screen === "landing" && state.teacher) {
    window.history.replaceState({}, "", pathForScreen("class-selection"));
    state.ui.screen = "class-selection";
  } else {
    state.ui.screen = route.screen;
  }
  renderApp();
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function navigateToScreen(screen, { replace = false, studentId = "" } = {}) {
  if (generatedStudentCredentials &&
      (screen !== generatedStudentCredentials.screen ||
       (screen === "student-profile" && studentId !== generatedStudentCredentials.studentRecordId))) {
    generatedStudentCredentials = null;
  }
  const path = pathForScreen(screen, studentId);
  if (replace) window.history.replaceState({}, "", path);
  else if (window.location.pathname !== path) window.history.pushState({}, "", path);
  const route = resolvePortalRoute(path);
  if (route) await handleLocationChange();
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function loadStudentEvents() {
  if (state.ui.eventsLoading) return;
  state.ui.eventsLoading = true;
  state.ui.eventsError = "";
  renderApp();
  try {
    const [eventsResult, discoveryResult] = await Promise.allSettled([
      fetchPublishedEvents(),
      fetchStudentEventDiscoveryStatus()
    ]);
    if (eventsResult.status === "rejected") throw eventsResult.reason;
    state.ui.events = eventsResult.value;
    state.ui.eventsDiscoveryStatus = discoveryResult.status === "fulfilled" ? discoveryResult.value : null;
    state.ui.eventsDiscoveryStatusError = discoveryResult.status === "rejected"
      ? discoveryResult.reason?.message || "Unable to load event discovery status."
      : "";
    state.ui.eventsLastVerified = state.ui.events.reduce((latest, event) =>
      event.last_verified_at && (!latest || event.last_verified_at > latest) ? event.last_verified_at : latest, null);
  } catch (error) {
    state.ui.eventsError = error.message || "Unable to load current events.";
  } finally {
    state.ui.eventsLoading = false;
    renderApp();
  }
}

function showPersistenceError(error, context = "Supabase request failed") {
  console.error(context, error);
  state.ui.notification = `${context}: ${error.message || "Please try again."}`;
  renderApp();
}

function renderAppPreservingScroll(selectors) {
  const positions = selectors.map((selector) => {
    const element = document.querySelector(selector);
    return element ? { selector, top: element.scrollTop, left: element.scrollLeft } : null;
  }).filter(Boolean);

  renderApp();

  positions.forEach(({ selector, top, left }) => {
    const element = document.querySelector(selector);
    if (!element) return;
    element.scrollTop = top;
    element.scrollLeft = left;
  });
}

function renderStudyPlanAppPreservingScroll() {
  renderAppPreservingScroll([".student-content.student-workspace-main"]);
}

function renderApp() {
  ensureDefaultUiState();
  if (!(["student-anatomy-study", "student-medical-case-simulator"].includes(state.ui.screen)) && window.__unmountAnatomyAtlas) {
    window.__unmountAnatomyAtlas();
    window.__unmountAnatomyAtlas = null;
  }

  const app = document.getElementById("app");

  const teacherOnlyScreens = ["class-selection", "dashboard", "students", "insights", "student-profile", "teacher-ai"];
  if (!state.teacher && teacherOnlyScreens.includes(state.ui.screen)) {
    state.ui.screen = "teacher-login";
    state.ui.activeModal = null;
    state.ui.selectedStudentId = null;
  }

  if (state.ui.screen === "teacher-login") {
    app.innerHTML = renderTeacherLogin();
    appendNotification(app);
    return;
  }
  if (state.ui.screen === "teacher-signup") {
    app.innerHTML = renderTeacherSignup();
    appendNotification(app);
    return;
  }
  if (state.ui.screen === "class-selection") {
    app.innerHTML = state.teacher ? renderShell(renderTeacherClassSelection()) : renderTeacherClassSelection();
    if (state.ui.activeModal) app.insertAdjacentHTML("beforeend", renderModal());
    appendNotification(app);
    return;
  }

    if (!state.classes.length && !["class-setup", "student-login", "student-category-selection", "student-dashboard", "student-performance", "student-subjects", "student-assessments", "student-study-plan", "student-ai", "student-visualize", "student-coding-practice", "student-games", "student-anatomy-study", "student-medical-case-simulator", "student-events", "role-selection", "teacher-login", "teacher-signup", "class-selection"].includes(state.ui.screen)) {
    state.ui.screen = "landing";
    state.ui.nav = "dashboard";
    state.ui.activeModal = null;
  }

  if (state.ui.screen === "landing") {
    app.innerHTML = renderLandingScreen();
    appendNotification(app);
    return;
  }

  if (state.ui.screen === "class-setup") {
    app.innerHTML = renderClassSetup();
    appendNotification(app);
    return;
  }

  if (state.ui.screen === "role-selection") {
    app.innerHTML = renderRoleSelection();
    appendNotification(app);
    return;
  }

  if (state.ui.screen === "student-category-selection") {
    app.innerHTML = renderStudentCategorySelection();
    appendNotification(app);
    return;
  }

  if (state.ui.screen === "student-login") {
    app.innerHTML = renderStudentLogin();
    appendNotification(app);
    return;
  }

  if (state.ui.screen === "student-password-change") {
    if (!state.ui.studentSessionToken || !state.ui.studentMustChangePassword) {
      state.ui.screen = "student-login";
      app.innerHTML = renderStudentLogin();
    } else {
      app.innerHTML = renderStudentPasswordChange();
    }
    appendNotification(app);
    return;
  }

  if (["student-dashboard", "student-performance", "student-subjects", "student-assessments", "student-study-plan"].includes(state.ui.screen)) {
    const student = getStudentByAnyId(state.ui.studentSessionId);
    if (!student || !state.ui.studentSessionToken) {
      state.ui.screen = "student-login";
      app.innerHTML = renderStudentLogin();
    } else {
      app.innerHTML = state.ui.screen === "student-dashboard"
        ? renderStudentDashboard()
        : state.ui.screen === "student-study-plan"
          ? renderStudentStudyPlanPage(student)
          : renderStudentPortalSection(student, state.ui.screen);
    }
    appendNotification(app);
    return;
  }
  if (state.ui.screen === "student-ai") {
    if (!getStudentByAnyId(state.ui.studentSessionId) || !state.ui.studentSessionToken) {
      state.ui.screen = "student-login";
      app.innerHTML = renderStudentLogin();
      appendNotification(app);
      return;
    }
    app.innerHTML = renderStudentAiAssistant();
    appendNotification(app);
    return;
  }

  if (state.ui.screen === "student-visualize") {
    const student = getStudentByAnyId(state.ui.studentSessionId);
    if (!student) {
      state.ui.screen = "student-login";
      app.innerHTML = renderStudentLogin();
      appendNotification(app);
      return;
    }
    app.innerHTML = renderStudentVisualize(student);
    appendNotification(app);
    return;
  }

  if (state.ui.screen === "student-coding-practice") {
    const student = getStudentByAnyId(state.ui.studentSessionId);
    if (!student || !state.ui.studentSessionToken) {
      state.ui.screen = "student-login";
      app.innerHTML = renderStudentLogin();
    } else {
      window.__codingQuestionId = Number(window.__codingQuestionId) || 1;
      window.__codingLanguage = window.__codingLanguage || "JavaScript";
      window.__codingCode = window.__codingCode ?? codingStarter(window.__codingLanguage, QUESTIONS[window.__codingQuestionId - 1]);
      app.innerHTML = renderCodingPractice(student);
    }
    appendNotification(app);
    return;
  }

  if (state.ui.screen === "student-anatomy-study") {
    const student = getStudentByAnyId(state.ui.studentSessionId);
    if (!student) {
      state.ui.screen = "student-login";
      app.innerHTML = renderStudentLogin();
    } else {
      app.innerHTML = renderAnatomyStudy();
      import("./anatomy-atlas/atlas.js").then((atlas) => {
        if (state.ui.screen !== "student-anatomy-study" || !app.querySelector("#anatomy-atlas-canvas")) return;
        window.__unmountAnatomyAtlas = atlas.unmountAnatomyAtlas;
        atlas.mountAnatomyAtlas(app);
      }).catch((error) => {
        const status = app.querySelector("#anatomy-atlas-loading");
        if (status) status.textContent = `The 3D atlas could not be initialized: ${error.message}`;
      });
    }
    appendNotification(app);
    return;
  }

  if (state.ui.screen === "student-medical-case-simulator") {
    const student = getStudentByAnyId(state.ui.studentSessionId);
    if (!student || !state.ui.studentSessionToken || state.ui.studentCategory !== "doctors") {
      state.ui.screen = student ? "student-dashboard" : "student-login";
      app.innerHTML = student ? renderStudentDashboard(student) : renderStudentLogin();
    } else {
      app.innerHTML = renderMedicalCaseSimulator();
      const token = state.ui.studentSessionToken;
      import("./anatomy-atlas/atlas.js").then((atlas) => {
        if (state.ui.screen !== "student-medical-case-simulator" || !app.querySelector("#case-landing")) return;
        window.__unmountAnatomyAtlas = atlas.unmountAnatomyAtlas;
        wireMedicalCaseSimulator({ token, onAtlasMount: (onExamRegion) => atlas.mountAnatomyAtlas(app, { patientExam: true, onExamRegion }) });
      }).catch((error) => {
        const status = app.querySelector("#anatomy-atlas-loading");
        if (status) status.textContent = `The 3D anatomy viewer could not be initialized: ${error.message}`;
        wireMedicalCaseSimulator({ token, onAtlasMount: () => null });
      });
    }
    appendNotification(app);
    return;
  }

  if (state.ui.screen === "student-games") {
    const student = getStudentByAnyId(state.ui.studentSessionId);
    if (!student) {
      state.ui.screen = "student-login";
      app.innerHTML = renderStudentLogin();
    } else {
      app.innerHTML = renderStudentGames(student);
    }
    appendNotification(app);
    return;
  }

  if (state.ui.screen === "student-events") {
    const student = getStudentByAnyId(state.ui.studentSessionId);
    if (!student) {
      state.ui.screen = "student-login";
      app.innerHTML = renderStudentLogin();
      appendNotification(app);
      return;
    }
    app.innerHTML = renderStudentEventsPage({
      events: state.ui.events || [],
      student,
      month: state.ui.eventsMonth ? new Date(`${state.ui.eventsMonth}-01T12:00:00`) : new Date(),
      category: state.ui.eventsCategory || "All",
      location: state.ui.eventsLocation || "Bengaluru + Online",
      sortBy: state.ui.eventsSort || "recommended",
      registrationStatus: state.ui.eventsRegistrationStatus || "all",
      loading: Boolean(state.ui.eventsLoading),
      error: state.ui.eventsError || "",
      discoveryStatus: state.ui.eventsDiscoveryStatus,
      discoveryStatusError: state.ui.eventsDiscoveryStatusError || "",
      refreshing: Boolean(state.ui.eventsRefreshing),
      refreshMessage: state.ui.eventsRefreshMessage || "",
      lastVerified: state.ui.eventsLastVerified,
      selectedEventId: state.ui.selectedEventId
    });
    appendNotification(app);
    return;
  }

  const content = (() => {
    switch (state.ui.screen) {
      case "dashboard":
        return renderDashboard();
      case "students":
        return renderStudentsPage();
      case "insights":
        return renderInsightsPage();
      case "student-profile":
        return renderStudentProfilePage();
      case "teacher-ai":
        return renderTeacherAiAssistant();
      default:
        return renderDashboard();
    }
  })();

  app.innerHTML = renderShell(content);
  if (state.ui.activeModal) {
    const modalHtml = renderModal();
    app.insertAdjacentHTML("beforeend", modalHtml);
  }
  appendNotification(app);
}

function appendNotification(app) {
  if (state.ui.notification) {
    app.insertAdjacentHTML("beforeend", `<div class="toast-notification" role="alert">${escapeHtml(state.ui.notification)}</div>`);
  }
}

function renderLandingScreen() {
  return `
    <div class="mentora-landing">
      <span class="landing-shape landing-shape-left" aria-hidden="true"></span>
      <span class="landing-shape landing-shape-top" aria-hidden="true"></span>
      <span class="landing-shape landing-shape-bottom" aria-hidden="true"></span>
      <main class="landing-intro">
        <h1>MENTORA</h1>
        <nav class="landing-logins" aria-label="Choose your login">
          <button type="button" data-action="open-teacher-portal">Teacher Login</button>
          <button type="button" data-action="open-student-portal">Student Login</button>
        </nav>
      </main>
    </div>
  `;
}

function renderRoleSelection() {
  return renderLandingScreen();
}

function renderTeacherLogin() {
  return `
    <div class="landing-screen auth-screen"><div class="landing-card login-card auth-card">
      <button class="back-link" data-action="go-home">← Home</button>
      <div class="logo-row"><h1>MENTORA</h1></div>
      <h2>Teacher Login</h2>
      <form id="teacher-login-form" class="student-login-form">
        <div class="field"><label>Username</label><input class="input" name="username" autocomplete="username" minlength="3" maxlength="32" required /></div>
        <div class="field"><label>Password</label><input class="input" name="password" type="password" autocomplete="current-password" minlength="12" maxlength="128" required /></div>
        ${state.ui.teacherAuthError ? `<p class="form-error" role="alert">${escapeHtml(state.ui.teacherAuthError)}</p>` : ""}
        <button class="btn-primary" type="submit">Login</button>
      </form>
      <p class="teacher-signup-link">New teacher? <button class="back-link" data-action="open-teacher-signup">Create Teacher Account</button></p>
    </div></div>
  `;
}

function renderTeacherSignup() {
  return `
    <div class="landing-screen auth-screen"><div class="landing-card login-card auth-card">
      <button class="back-link" data-action="teacher-login-back">← Teacher Login</button>
      <div class="logo-row"><h1>MENTORA</h1></div>
      <h2>Create Teacher Account</h2>
      <p>Create your account and log in right away. Classes are available when they are assigned to your account.</p>
      <form id="teacher-signup-form" class="student-login-form">
        <div class="field"><label>Name</label><input class="input" name="displayName" autocomplete="name" maxlength="100" required /></div>
        <div class="field"><label>Username</label><input class="input" name="username" autocomplete="username" minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]{3,32}" required /><small>3–32 letters, numbers, underscores, or hyphens.</small></div>
        <div class="field"><label>Password</label><input class="input" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /><small>Use at least 12 characters.</small></div>
        ${state.ui.teacherAuthError ? `<p class="form-error" role="alert">${escapeHtml(state.ui.teacherAuthError)}</p>` : ""}
        <button class="btn-primary" type="submit">Create Teacher Account</button>
      </form>
    </div></div>
  `;
}

function renderTeacherClassSelection() {
  return `
    <section class="page-section teacher-classes-screen"><div class="list-card teacher-classes-card">
      <h2>My Classes</h2>
      <p>Signed in as ${escapeHtml(state.teacher?.displayName || state.teacher?.username || "Teacher")}.</p>
      <div class="teacher-classes-toolbar"><button class="btn-primary" data-action="create-class">+ Create New Class</button></div>
      ${state.classes.length ? `<div class="teacher-class-list">${state.classes.map((classRecord) => `
        <article class="teacher-class-option"><div><strong>${escapeHtml(formatClassLabel(classRecord))}</strong><small>${escapeHtml(classRecord.course || "")}${classRecord.academicYear ? ` · Academic year: ${escapeHtml(classRecord.academicYear)}` : ""}</small></div><div class="teacher-class-actions"><button class="btn-ghost" data-action="edit-class" data-class-id="${escapeHtml(classRecord.id)}">Edit</button><button class="btn-ghost danger-text" data-action="delete-class" data-class-id="${escapeHtml(classRecord.id)}">Delete</button><button class="btn-primary" data-action="enter-assigned-class" data-class-id="${escapeHtml(classRecord.id)}">Open Class</button></div></article>
      `).join("")}</div>` : '<div class="empty-state">No classes yet. Create your first class to get started.</div>'}
    </div></section>
  `;
}

function renderStudentLogin() {
  const selectedCategory = STUDENT_CATEGORIES.find((category) => category.id === state.ui.studentCategory);
  return `
    <div class="landing-screen auth-screen">
      <div class="landing-card login-card auth-card">
        <button class="back-link" data-action="back-to-student-categories">← Categories</button>
        <div class="logo-row"><h1>MENTORA</h1></div>
        <h2>Student Login</h2>
        ${selectedCategory ? `<p class="student-login-category">${escapeHtml(selectedCategory.title)}</p>` : ""}
        <form id="student-login-form" class="student-login-form">
          <input type="hidden" name="studentCategory" value="${escapeHtml(state.ui.studentCategory || "")}" />
          <div class="field"><label for="student-login-id">Student ID</label><input id="student-login-id" class="input" name="studentId" autocomplete="username" placeholder="MEN-2026-001" required /></div>
          <div class="field"><label for="student-login-password">Password</label><input id="student-login-password" class="input" type="password" name="password" autocomplete="current-password" required /></div>
          <p class="form-error" id="student-login-error" role="alert" hidden>Student ID or password was not recognized. If you need a temporary password, contact your teacher.</p>
          <button class="btn-primary" type="submit">Login</button>
        </form>
        <p class="teacher-signup-link">Need a temporary password? Contact your teacher.</p>
      </div>
    </div>
  `;
}

function renderStudentCategorySelection() {
  const selected = isStudentCategory(state.ui.studentCategory) ? state.ui.studentCategory : "";
  return `<div class="landing-screen auth-screen"><div class="landing-card student-category-card"><button class="back-link" data-action="go-home">← Home</button><div class="logo-row"><h1>MENTORA</h1></div><span class="eyebrow">STUDENT LEARNING PATH</span><h2>Choose your category</h2><p>Select the learning section for your student account, then continue to your usual login.</p><div class="student-category-grid" role="group" aria-label="Choose student category">${STUDENT_CATEGORIES.map((category) => `<button type="button" class="student-category-option ${selected === category.id ? "selected" : ""}" data-action="select-student-category" data-category="${category.id}" aria-pressed="${selected === category.id}"><span class="student-category-icon" aria-hidden="true">${category.icon}</span><span class="student-category-copy"><strong>${escapeHtml(category.title)}</strong><small>${escapeHtml(category.description)}</small></span><span class="student-category-check" aria-hidden="true">${selected === category.id ? "✓" : ""}</span></button>`).join("")}</div><button type="button" class="btn-primary student-category-continue" data-action="continue-student-category" ${selected ? "" : "disabled"}>Continue <span aria-hidden="true">→</span></button></div></div>`;
}

function renderStudentPasswordChange() {
  const student = getStudentByAnyId(state.ui.studentSessionId);
  return `
    <div class="landing-screen auth-screen">
      <div class="landing-card login-card auth-card">
        <div class="logo-row"><h1>MENTORA</h1></div>
        <h2>Set a new password</h2>
        <p>Welcome, ${escapeHtml(student?.name || "Student")}. Choose a new password to continue to your portal.</p>
        <form id="student-password-change-form" class="student-login-form">
          <div class="field"><label for="student-current-password">Temporary password</label><input id="student-current-password" class="input" type="password" name="currentPassword" autocomplete="current-password" required /></div>
          <div class="field"><label for="student-new-password">New password</label><input id="student-new-password" class="input" type="password" name="newPassword" autocomplete="new-password" minlength="12" maxlength="256" required /><small>Use at least 12 characters.</small></div>
          <div class="field"><label for="student-confirm-password">Confirm new password</label><input id="student-confirm-password" class="input" type="password" name="confirmPassword" autocomplete="new-password" minlength="12" maxlength="256" required /></div>
          <p class="form-error" id="student-password-change-error" role="alert" hidden></p>
          <button class="btn-primary" type="submit">Save password</button>
          <button class="back-link" type="button" data-action="student-logout">Log out</button>
        </form>
      </div>
    </div>
  `;
}

function renderStudentSubjectShowcase(student) {
  const marks = getStudentNumericAssessmentSeries(student);
  if (!marks.length) return `<div class="student-subject-empty"><span>01</span><p>Subject performance will appear after marks-based assessment results are recorded.</p></div>`;
  const grouped = new Map();
  marks.forEach((mark) => { const list = grouped.get(mark.subject) || []; list.push(mark); grouped.set(mark.subject, list); });
  const palette = ["#6b5ca5", "#7189b7", "#9178bb", "#6386a7", "#a47596", "#777092"];
  return `<div class="student-subject-showcase">${[...grouped].map(([subject, entries], index) => {
    const latest = entries[entries.length - 1].percent;
    const average = entries.reduce((sum, entry) => sum + entry.percent, 0) / entries.length;
    const delta = latest - entries[0].percent;
    const trend = entries.length < 2 ? "First result" : Math.abs(delta) < 1 ? "Steady" : delta > 0 ? `Improving · +${delta.toFixed(1)} pp` : `Declining · −${Math.abs(delta).toFixed(1)} pp`;
    const trendClass = entries.length < 2 ? "first" : Math.abs(delta) < 1 ? "steady" : delta > 0 ? "up" : "down";
    const points = entries.map((entry, pointIndex) => {
      const x = entries.length === 1 ? 48 : pointIndex * 96 / (entries.length - 1) + 2;
      const y = 30 - entry.percent * 0.25;
      return { x, y, entry };
    });
    const line = points.length > 1 ? `<polyline points="${points.map((point) => `${point.x},${point.y}`).join(" ")}"/>` : "";
    const dots = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="2.6"><title>${escapeHtml(point.entry.assessmentLabel)} · ${point.entry.percent.toFixed(1)}%</title></circle>`).join("");
    return `<button type="button" class="student-subject-row ${index === 0 ? "student-subject-row-featured" : ""}" data-route-screen="student-performance"><span class="student-subject-index">${String(index + 1).padStart(2, "0")}</span><span class="student-subject-name"><strong>${escapeHtml(subject)}</strong><small>${entries.length} assessment${entries.length === 1 ? "" : "s"} · Avg ${average.toFixed(1)}%</small></span><svg class="subject-sparkline" style="--subject-color:${palette[index % palette.length]}" viewBox="0 0 100 36" aria-label="${escapeHtml(subject)} marks trend">${line}${dots}</svg><span class="student-subject-latest"><strong>${latest.toFixed(1)}%</strong><small>Latest</small></span><span class="student-subject-trend ${trendClass}">${trendClass === "up" ? "↑ " : trendClass === "down" ? "↓ " : ""}${escapeHtml(trend)}</span></button>`;
  }).join("")}</div>`;
}

function renderStudentPortalSection(student, screen) {
  const config = {
    "student-performance": { title: "My Performance", intro: "Review your recorded marks and performance history." },
    "student-subjects": { title: "Subjects", intro: "Explore recent results and trends across your subjects." },
    "student-assessments": { title: "Assessments", intro: "Review your saved assessment results." }
  }[screen];
  let content = "";
  if (screen === "student-performance") {
    const marks = getStudentNumericAssessmentSeries(student);
    const average = marks.length ? marks.reduce((sum, mark) => sum + mark.percent, 0) / marks.length : null;
    content = `<section class="performance-feature" aria-label="Overall student performance"><div class="performance-ring-wrap"><svg class="performance-ring" viewBox="0 0 124 124" role="img" aria-label="${average == null ? "No numerical performance recorded" : `Overall performance ${average.toFixed(1)} percent`}"><circle class="performance-ring-track" cx="62" cy="62" r="52"/><circle class="performance-ring-value" cx="62" cy="62" r="52" style="stroke-dasharray:327;stroke-dashoffset:${average == null ? 327 : 327 * (1 - average / 100)}"/></svg><div class="performance-ring-number"><strong>${average == null ? "—" : `${average.toFixed(0)}%`}</strong><span>overall</span></div></div><div class="performance-feature-copy"><span class="eyebrow">YOUR ACADEMIC SNAPSHOT</span><h2>Overall Performance</h2><p>${average == null ? "Your overall mark will appear here after results are recorded." : `Calculated from ${marks.length} saved numerical result${marks.length === 1 ? "" : "s"}.`}</p></div></section><section class="student-performance-page-chart">${renderPerformanceHistory(student)}</section>`;
  } else if (screen === "student-subjects") {
    content = renderStudentSubjectShowcase(student);
  } else {
    const allMarks = [...(student.subjectMarks || [])].sort((a, b) =>
      String(b.assessmentDate || "").localeCompare(String(a.assessmentDate || "")) ||
      String(a.assessmentLabel || "").localeCompare(String(b.assessmentLabel || "")));
    content = allMarks.length
      ? `<div class="student-assessment-list">${allMarks.map((mark) => {
        const numeric = isNumericSubjectMark(mark);
        const percentage = numeric ? Number(mark.obtainedMarks) / Number(mark.maxMarks) * 100 : null;
        const result = numeric
          ? `${mark.obtainedMarks} / ${mark.maxMarks} · ${percentage.toFixed(1)}%`
          : mark.grade ? `Grade ${escapeHtml(mark.grade)}` : "Numerical result unavailable";
        return `<article class="student-assessment-item"><div><strong>${escapeHtml(mark.assessmentLabel || "Assessment")}</strong><span>${escapeHtml(mark.subject || "Subject not specified")}</span></div><time>${mark.assessmentDate ? escapeHtml(formatDate(mark.assessmentDate)) : "Date unavailable"}</time><b>${result}</b></article>`;
      }).join("")}</div>`
      : `<div class="analytics-empty"><strong>No assessments recorded yet</strong><span>Your saved results will appear here.</span></div>`;
  }
  return `<div class="student-portal student-workspace">${renderStudentSidebar(screen)}<main class="student-content student-workspace-main student-editorial-main student-section-page"><header class="student-workspace-topbar"><span>Student portal <b>/</b> ${escapeHtml(config.title)}</span><button class="btn-secondary" data-action="download-student-report" data-student-id="${escapeHtml(student.id)}">Download report <span aria-hidden="true">↓</span></button></header><header class="student-section-page-heading"><span class="eyebrow">${escapeHtml(student.name)}</span><h1>${escapeHtml(config.title)}</h1><p>${escapeHtml(config.intro)}</p></header>${content}</main></div>`;
}

function renderStudentStudyPlanPage(student) {
  const content = state.ui.studyPlan
    ? renderStudyPlan(state.ui.studyPlan)
    : state.ui.studyPlanFormOpen
      ? renderStudyPlanForm(student)
      : `<section class="study-plan-form-card"><div class="study-plan-form-heading"><div><p class="kicker">PERSONALIZED STUDY SUPPORT</p><h2>Build your improvement plan</h2><p>Choose a verified syllabus or provide your own, then get a focused seven-day plan.</p></div></div><button class="btn-primary" data-action="open-study-plan">Create my improvement plan <span aria-hidden="true">→</span></button></section>`;
  return `<div class="student-portal student-workspace">${renderStudentSidebar("student-study-plan")}<main class="student-content student-workspace-main student-editorial-main student-section-page"><header class="student-workspace-topbar"><span>Student portal <b>/</b> My Improvement Plan</span></header><header class="student-section-page-heading"><span class="eyebrow">${escapeHtml(student.name)}</span><h1>My Improvement Plan</h1><p>A syllabus-aware plan to guide your next week of study.</p></header>${content}</main></div>`;
}

function renderStudentDashboard() {
  const student = getStudentByAnyId(state.ui.studentSessionId);
  if (!student || !state.ui.studentSessionToken || !isStudentCategory(state.ui.studentCategory)) return renderStudentLogin();
  const category = isStudentCategory(state.ui.studentCategory) ? state.ui.studentCategory : "";
  const analysis = state.ui.analysisByStudent?.[student.id] || null;
  const strengths = analysis?.strengths || getStrengthList(student);
  const areas = analysis?.developmentAreas || getDevelopmentList(student);
  const actions = analysis?.recommendedActions || [];
  const marks = getStudentNumericAssessmentSeries(student);
  const subjectsCount = new Set(marks.map((mark) => mark.subject)).size;
  const assessments = getClassAssessmentEvents([student]);
  const average = marks.length ? marks.reduce((sum, mark) => sum + mark.percent, 0) / marks.length : null;
  const circumference = 327;
  const ringOffset = average == null ? circumference : circumference * (1 - average / 100);
  const fallback = buildSubjectImprovementFallback(student);
  const developmentNote = areas[0] || fallback.find((section) => section.heading.toLowerCase().includes("improvement"))?.items?.[0] || "More assessment results are needed to identify a subject focus.";
  const nextStep = actions[0]?.action || fallback.find((section) => section.heading.toLowerCase().includes("action plan"))?.items?.[0] || "Review your latest teacher feedback and agree on one next step.";
  const practiceStep = fallback.find((section) => section.heading.toLowerCase() === "daily practice")?.items?.[0];
  return `
    <div class="student-portal student-workspace">
      ${renderStudentSidebar("student-dashboard")}
      <main class="student-content student-workspace-main student-editorial-main">
        <header class="student-workspace-topbar"><span>Student portal <b>/</b> Overview</span><button class="btn-secondary" data-action="download-student-report" data-student-id="${student.id}">Download report <span aria-hidden="true">↓</span></button></header>
        <section id="student-overview" class="student-editorial-hero"><div class="student-hero-copy"><span class="eyebrow">YOUR LEARNING, IN FOCUS</span><h1>Good morning,<br/><em>${escapeHtml(student.name)}.</em></h1><p>Here’s how your learning is progressing.</p><div class="student-hero-meta"><span>${escapeHtml(student.studentId)}</span><i></i><span>${escapeHtml(getStudentClassLabel(student))}</span><i></i><span>Section ${escapeHtml(getStudentSection(student))}</span></div></div><div class="student-hero-orb" aria-label="${escapeHtml(getInitials(student.name))}"><span>${escapeHtml(getInitials(student.name))}</span><i></i><b></b></div><div class="student-hero-decoration" aria-hidden="true"><i></i><i></i><i></i></div></section>
        <section class="performance-feature" aria-label="Overall student performance"><div class="performance-ring-wrap"><svg class="performance-ring" viewBox="0 0 124 124" role="img" aria-label="${average == null ? "No numerical performance recorded" : `Overall performance ${average.toFixed(1)} percent`}"><circle class="performance-ring-track" cx="62" cy="62" r="52"/><circle class="performance-ring-value" cx="62" cy="62" r="52" style="stroke-dasharray:${circumference};stroke-dashoffset:${ringOffset}"/></svg><div class="performance-ring-number"><strong>${average == null ? "—" : `${average.toFixed(0)}%`}</strong><span>overall</span></div></div><div class="performance-feature-copy"><span class="eyebrow">YOUR ACADEMIC SNAPSHOT</span><h2>Overall<br/>Performance</h2><p>${average == null ? "Your overall mark will appear here after results are recorded." : `Calculated from ${marks.length} saved numerical result${marks.length === 1 ? "" : "s"}.`}</p><a href="#student-subjects" class="performance-explore-link">Explore your subjects <span aria-hidden="true">→</span></a></div><div class="performance-support"><div><span>SUBJECTS</span><strong>${subjectsCount}</strong><small>with marks</small></div><div><span>ASSESSMENTS</span><strong>${assessments.length}</strong><small>recorded</small></div></div><div class="performance-feature-mark" aria-hidden="true">M</div></section>
        <section id="student-subjects" class="student-subjects-section"><div class="editorial-section-heading"><div><span class="eyebrow">THE DETAIL BEHIND THE TREND</span><h2>Your Subjects</h2><p>Recent results and movement across each subject.</p></div><a href="#student-performance" class="section-jump-link">Full history <span aria-hidden="true">↗</span></a></div>${renderStudentSubjectShowcase(student)}</section>
        <section id="student-assessments" class="student-focus-layout"><section id="student-mentor" class="student-mentor-feature"><div class="mentor-main-copy"><span class="mentor-overline"><i>✳</i> MENTORA GUIDE</span><p class="mentor-kicker">YOUR NEXT BEST STEP</p><h2>${escapeHtml(developmentNote)}</h2></div><div class="mentor-detail-copy"><div class="mentor-recommendation"><span>START HERE</span><p>${escapeHtml(nextStep)}</p></div></div></section></section>
        <section class="student-section-launcher" aria-label="Selected learning section">${category === "primary" ? `<article><span class="eyebrow">PRIMARY LEARNING</span><h2>1st–5th Grade</h2><p>Practise school topics with short learning games.</p><button class="btn-primary" data-action="open-primary-learning">Games <span aria-hidden="true">→</span></button></article>` : category === "secondary" ? `<article><span class="eyebrow">SCHOOL LEARNING</span><h2>6th–12th Grade</h2><p>Continue with your existing subjects, results, and study tools.</p><button class="btn-secondary" data-action="open-secondary-learning">Explore school learning <span aria-hidden="true">→</span></button></article>` : category === "doctors" ? `<article><span class="eyebrow">MEDICAL LEARNING</span><h2>Doctors</h2><p>Explore anatomy and practise fictional clinical cases.</p><button class="btn-secondary" data-action="open-anatomy-study">Human Anatomy Study <span aria-hidden="true">→</span></button> <button class="btn-primary" data-action="open-medical-case-simulator">Medical Case Simulator <span aria-hidden="true">→</span></button></article>` : category === "engineers" ? `<article><span class="eyebrow">ENGINEERING LEARNING</span><h2>Engineers</h2><p>Practise engineering programming challenges.</p><button class="btn-secondary" data-action="open-coding-practice">Coding Practice <span aria-hidden="true">→</span></button></article>` : ""}</section>
        <section id="student-ai-analysis" class="student-ai-analysis-section"><div class="student-ai-analysis-heading"><div><span class="eyebrow">AI ANALYSIS</span><h2>Your current focus</h2><p>Understand your performance and what to improve next.</p></div><a class="student-ai-analysis-link" href="#student-ai-analysis-content">View full analysis <span aria-hidden="true">→</span></a></div><div id="student-ai-analysis-content" class="student-ai-analysis-content">${analysis ? renderAnalysisReport(analysis) : '<div class="student-ai-analysis-empty"><strong>Your analysis will appear here.</strong><p>The existing teacher analysis will show when it has been generated for your profile.</p></div>'}</div></section>
        <section class="student-learning-signals"><div class="learning-signals-copy"><span class="eyebrow">YOUR LEARNING PROFILE</span><h2>Strengths grow<br/>with practice.</h2><p>Teacher-assessed skills and subject patterns from your record.</p><div class="student-strength-area"><div><strong>Strengths</strong><div class="chip-list">${strengths.length ? strengths.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("") : '<span class="muted">No subject patterns available yet.</span>'}</div></div><div><strong>Areas to develop</strong><div class="chip-list">${areas.length ? areas.map((item) => `<span class="chip warn">${escapeHtml(item)}</span>`).join("") : '<span class="muted">No subject patterns available yet.</span>'}</div></div></div></div><div class="learning-signals-chart">${renderSkillDevelopment(student)}</div></section>
        <details id="student-performance" class="student-history-disclosure"><summary><span><small>ASSESSMENT RECORDS</small><strong>Performance History</strong></span><span class="history-disclosure-action">View subject trend <b aria-hidden="true">⌄</b></span></summary><div class="student-history-content">${renderPerformanceHistory(student)}</div></details>
      </main>
    </div>
  `;
}

function renderStudentVisualize(student) {
  const subjects = [...new Set([
    ...getStudentNumericAssessmentSeries(student).map((mark) => mark.subject),
    ...(student.strongSubjects || []),
    ...(student.weakSubjects || []),
    "Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "History", "English"
  ].filter((subject) => typeof subject === "string" && subject.trim()))];
  const selectedSubject = state.ui.doubtSubject || "";
  const selectedLevel = state.ui.doubtLevel || "High school";
  const result = state.ui.doubtResult;
  const mode = state.ui.doubtMode || "visual";
  return `
    <div class="student-portal student-workspace">
      ${renderStudentSidebar("student-visualize")}
      <main class="student-content student-workspace-main doubt-workspace">
        <header class="student-workspace-topbar"><span>Student portal <b>/</b> Visualize My Doubt</span><button class="btn-secondary" data-action="return-student-dashboard">← Overview</button></header>
        <section class="doubt-hero">
          <div class="doubt-hero-orbit" aria-hidden="true"><span>✳</span><i></i><b></b></div>
          <div class="doubt-hero-copy"><span class="eyebrow">A NEW WAY TO UNDERSTAND</span><h1>Don't just explain it.<br/><em>Show me how it works.</em></h1><p>Turn a confusing topic into a visual, step-by-step explanation that makes sense to you.</p></div>
        </section>
        <section class="doubt-input-card" aria-labelledby="doubt-input-title">
          <div class="doubt-card-heading"><span class="doubt-number">01</span><div><span class="eyebrow">START WITH A QUESTION</span><h2 id="doubt-input-title">What are you struggling with?</h2></div></div>
          <form id="visualize-doubt-form">
            <label class="doubt-topic-label" for="doubt-topic">Your topic or question</label>
            <textarea id="doubt-topic" name="topic" rows="3" maxlength="500" required placeholder="Type a topic you're struggling with…">${escapeHtml(state.ui.doubtTopic || "")}</textarea>
            <div class="doubt-options">
              <div class="field"><label for="doubt-subject">Subject <span>(optional)</span></label><select class="select" id="doubt-subject" name="subject"><option value="">Choose a subject</option>${subjects.map((subject) => `<option value="${escapeHtml(subject)}" ${subject === selectedSubject ? "selected" : ""}>${escapeHtml(subject)}</option>`).join("")}</select></div>
              <div class="field"><label for="doubt-level">Explain it at</label><select class="select" id="doubt-level" name="level">${["Middle school", "High school", "College"].map((level) => `<option ${level === selectedLevel ? "selected" : ""}>${level}</option>`).join("")}</select></div>
              <div class="field"><label for="doubt-class">Class / semester <span>(optional)</span></label><input class="input" id="doubt-class" name="classLevel" maxlength="100" value="${escapeHtml(state.ui.doubtClassLevel ?? getStudentClassLabel(student))}" placeholder="e.g. Class 10 or Semester 2"/></div>
            </div>
            ${state.ui.doubtError ? `<p class="doubt-error" role="alert">${escapeHtml(state.ui.doubtError)}</p>` : ""}
            <div class="doubt-submit-row"><span><i aria-hidden="true">✦</i> Mentora will choose a visual that fits your topic.</span><button class="btn-primary doubt-submit" type="submit" ${state.ui.doubtLoading ? "disabled" : ""}>${state.ui.doubtLoading ? '<span class="loader"></span> Creating your visual…' : '<span aria-hidden="true">✧</span> Visualize'}</button></div>
          </form>
        </section>
        ${state.ui.doubtLoading ? '<div class="doubt-loading" role="status"><span class="loader"></span><p>Finding the clearest way to show this…</p></div>' : ""}
        ${result ? renderDoubtResult(result, mode) : ""}
        <p class="doubt-disclaimer">Learning aid generated for you—not an official textbook diagram. Always check important details with your course materials.</p>
      </main>
    </div>
  `;
}

function renderStudentGames(student) {
  const classLabel = getStudentClassLabel(student);
  const gradeLabel = String(classLabel || student.className || student.grade || "");
  const gradeMatch = gradeLabel.match(/\b(?:grade|class|standard)\s*(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)?\s*standard\b/i);
  const grade = gradeMatch ? Number(gradeMatch[1] || gradeMatch[2]) : null;
  const renderPage = (content) => `<div class="student-portal student-workspace">${renderStudentSidebar("student-games")}<main class="student-content student-workspace-main student-editorial-main student-section-page">${content}</main></div>`;
  if (grade === null || grade < 1 || grade > 5) {
    return renderPage(`<header class="student-workspace-topbar"><span>Student portal <b>/</b> Games</span></header><section class="student-section-page-heading"><span class="eyebrow">LEARNING THROUGH PLAY</span><h1>Games</h1><p>Games are available for Grades 1–5.</p></section>`);
  }
  const subjects = ["Maths", "English", "Science", "EVS"];
  const games = [
    { id: "sky-block-jump", title: "Sky-Block Jump", description: "Jump across platforms and reach the next checkpoint.", icon: "☁️" },
    { id: "barrel-gap-dash", title: "Barrel Gap Dash", description: "Dodge the barrels and answer questions at checkpoints.", icon: "🛢️" },
    { id: "snake-apple-quest", title: "Snake Apple Quest", description: "Collect apples and keep your snake moving.", icon: "🐍" }
  ];
  const subject = subjects.includes(state.ui.gamesSubject) ? state.ui.gamesSubject : "Maths";
  const selectedGame = games.find((game) => game.id === state.ui.selectedGame) || null;
  const gameContent = selectedGame
    ? `<section class="mentora-game-player"><div class="mentora-game-player-head"><div><span class="eyebrow">${escapeHtml(subject)} · GRADE ${grade || "1–5"}</span><h2>${escapeHtml(selectedGame.title)}</h2></div><button class="btn-secondary" data-action="games-back">← All games</button></div><p class="mentora-games-export-note">The Mentora Character Challenge loads below. Choose a game in its menu.</p><iframe title="${escapeHtml(selectedGame.title)}" src="/games/mentora-primary/Mentora%20Character%20Challenge.html?game=${encodeURIComponent(selectedGame.id)}&subject=${encodeURIComponent(subject)}&grade=${grade || 1}" class="mentora-game-frame" allow="fullscreen; autoplay" loading="lazy"></iframe></section>`
    : `<section class="mentora-games-section"><div class="mentora-games-section-heading"><div><span class="eyebrow">CHOOSE A SUBJECT</span><h2>What are we practising today?</h2></div><span class="mentora-grade-chip">Grade ${grade || "1–5"}</span></div><div class="mentora-subject-picker" role="group" aria-label="Choose subject">${subjects.map((item) => `<button type="button" class="mentora-subject-button ${subject === item ? "active" : ""}" data-action="games-subject" data-subject="${item}" aria-pressed="${subject === item}">${item}</button>`).join("")}</div><div class="mentora-games-grid">${games.map((game, index) => `<article class="mentora-game-card"><div class="mentora-game-card-art" aria-hidden="true">${game.icon}</div><span class="eyebrow">GAME 0${index + 1}</span><h3>${game.title}</h3><p>${game.description}</p><button class="btn-primary" data-action="games-play" data-game="${game.id}">Play game <span aria-hidden="true">→</span></button></article>`).join("")}</div><p class="mentora-games-footnote">Questions are intended to adapt to the student’s saved grade and selected subject.</p></section>`;
  return renderPage(`<header class="student-workspace-topbar"><span>Student portal <b>/</b> Games</span><button class="btn-secondary" data-action="return-student-dashboard">← Overview</button></header><header class="student-section-page-heading mentora-games-hero"><span class="eyebrow">LEARNING THROUGH PLAY</span><h1>Play. Practise. Progress.</h1><p>Short games that make learning feel like an adventure.</p></header>${gameContent}`);
}

function renderDoubtResult(result, mode) {
  if (result.ambiguous) return `<section class="doubt-result-card" aria-live="polite"><div class="doubt-result-heading"><span class="doubt-number">?</span><div><span class="eyebrow">ONE QUICK CLARIFICATION</span><h2>Help me understand what you mean</h2></div></div><p class="doubt-clarification">${escapeHtml(result.clarificationQuestion)}</p></section>`;
  if (mode === "flashcards") return `<section class="doubt-result-card" aria-live="polite"><div class="doubt-result-heading"><span class="doubt-number">✦</span><div><span class="eyebrow">QUICK RECALL</span><h2>Flashcards for ${escapeHtml(result.topic)}</h2></div></div><div class="doubt-flashcards">${result.cards.map((card, index) => `<details class="doubt-flashcard"><summary><span>0${index + 1}</span>${escapeHtml(card.front)}<b>Show answer</b></summary><p>${escapeHtml(card.back)}</p></details>`).join("")}</div><button class="btn-secondary doubt-return-result" data-action="doubt-back-to-visual">← Back to visual</button></section>`;
  if (mode === "quiz") return renderDoubtQuiz(state.ui.doubtQuiz);
  if (mode === "quiz-results") return renderDoubtQuizResults(state.ui.doubtQuiz);
  const selectedNode = result.visual.nodes.find((node) => node.id === state.ui.doubtSelectedNodeId) || result.visual.nodes.find((node) => node.id === result.visual.centralConcept) || result.visual.nodes[0];
  return `<section class="doubt-result-card" aria-live="polite">
    <div class="doubt-result-heading"><span class="doubt-number">02</span><div><span class="eyebrow">YOUR INTERACTIVE DIAGRAM</span><h2>${escapeHtml(result.concept)}</h2><p>Mentora chose a <strong>${escapeHtml(result.diagramTypeLabel)}</strong> to show how the ideas connect.</p></div><button class="btn-secondary doubt-regenerate" data-action="doubt-regenerate" ${state.ui.doubtLoading ? "disabled" : ""}>↻ Regenerate</button></div>
    ${renderDoubtVisual(result, selectedNode?.id)}
    <div id="doubt-info-panel" class="doubt-info-panel">
    ${selectedNode ? `<aside class="doubt-node-inspector" aria-live="polite"><div class="doubt-inspector-heading"><span class="eyebrow">EXPLORE THIS PART</span><h3>${escapeHtml(selectedNode.label)}</h3></div><div class="doubt-inspector-copy"><p>${escapeHtml(selectedNode.description || "Select another part of the diagram to explore its role.")}</p>${(state.ui.doubtNodeExample || selectedNode.example) ? `<p><strong>Example:</strong> ${escapeHtml(state.ui.doubtNodeExample || selectedNode.example)}</p>` : ""}${(state.ui.doubtNodeWhy || selectedNode.whyItMatters) ? `<p><strong>Why it matters:</strong> ${escapeHtml(state.ui.doubtNodeWhy || selectedNode.whyItMatters)}</p>` : ""}${state.ui.doubtNodeExplanation ? `<p class="doubt-ai-node-explanation">${escapeHtml(state.ui.doubtNodeExplanation)}</p>` : ""}</div><button class="btn-secondary" data-action="doubt-explain-node" ${state.ui.doubtLoading ? "disabled" : ""}>Explain this part</button></aside>` : ""}
    <div class="doubt-explanation-grid"><article class="doubt-explanation-block"><span class="eyebrow">SIMPLE EXPLANATION</span><p>${escapeHtml(result.explanation)}</p></article><article class="doubt-explanation-block doubt-key-points"><span class="eyebrow">KEY POINTS</span><ul>${result.keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul></article></div>
    <div class="doubt-example"><span class="doubt-example-icon" aria-hidden="true">✦</span><div><span class="eyebrow">TRY THIS EXAMPLE</span><p>${escapeHtml(result.example)}</p></div></div>
    </div>
    <div class="doubt-follow-up"><span class="doubt-number">?</span><div><span class="eyebrow">YOUR TURN</span><h3>Test Your Understanding</h3><p>Take a short quiz on the concepts shown in this diagram.</p></div><button class="btn-secondary" data-action="${state.ui.doubtQuiz ? "doubt-resume-quiz" : "doubt-quiz"}">${state.ui.doubtQuiz ? "Return to quiz" : "Start quiz"}</button></div>
    <div class="doubt-tools" aria-label="More ways to learn"><span class="eyebrow">KEEP EXPLORING</span><div class="doubt-action-row"><button class="btn-secondary" data-action="doubt-simplify" ${state.ui.doubtLoading ? "disabled" : ""}>Simplify</button><button class="btn-secondary" data-action="doubt-detail" ${state.ui.doubtLoading ? "disabled" : ""}>More detail</button><button class="btn-secondary" data-action="doubt-example" ${state.ui.doubtLoading ? "disabled" : ""}>Another example</button><button class="btn-secondary" data-action="doubt-beginner" ${state.ui.doubtLoading ? "disabled" : ""}>Beginner explanation</button><button class="btn-secondary" data-action="doubt-flashcards" ${state.ui.doubtLoading ? "disabled" : ""}>Turn into flashcards</button><button class="btn-secondary" data-action="doubt-quiz" ${state.ui.doubtLoading ? "disabled" : ""}>Quiz me</button></div></div>
  </section>`;
}

function renderDoubtQuiz(quiz) {
  const question = quiz?.questions?.[quiz.index];
  if (!question) return `<section class="doubt-result-card"><p class="doubt-error" role="alert">This quiz question is unavailable. Return to the diagram and start the quiz again.</p><button class="btn-secondary doubt-return-result" data-action="doubt-back-to-visual">← Back to visual</button></section>`;
  const answer = quiz.answers[quiz.index];
  const progressScore = quiz.answers.filter((entry) => entry?.correct).length;
  const questionType = { "multiple-choice": "MULTIPLE CHOICE", "true-false": "TRUE / FALSE", application: "APPLY YOUR UNDERSTANDING" }[question.type];
  const concept = state.ui.doubtVisualResult?.visual.nodes.find((node) => node.id === question.conceptId);
  return `<section class="doubt-result-card doubt-quiz-card" aria-live="polite">
    <div class="doubt-result-heading"><span class="doubt-number">?</span><div><span class="eyebrow">TEST YOUR UNDERSTANDING</span><h2>${quiz.retryOnly ? "Try the missed questions" : "Diagram knowledge check"}</h2><p>Question ${quiz.index + 1} of ${quiz.questions.length} <span aria-hidden="true">·</span> Score ${progressScore}/${quiz.answers.filter(Boolean).length}</p></div></div>
    <div class="doubt-quiz-progress" aria-label="Quiz progress"><span style="width:${Math.round((quiz.index + 1) / quiz.questions.length * 100)}%"></span></div>
    <div class="doubt-quiz-question-block"><span class="eyebrow">${questionType}</span><h3>${escapeHtml(question.prompt)}</h3><p>Concept: <strong>${escapeHtml(concept?.label || "Diagram concept")}</strong></p></div>
    <div class="doubt-quiz-options" role="group" aria-label="Answer choices">${question.options.map((option, index) => `<button type="button" class="doubt-quiz-option ${answer ? (index === question.correctIndex ? "is-correct" : index === answer.selectedIndex ? "is-incorrect" : "") : ""}" data-action="doubt-quiz-option" data-option-index="${index}" ${answer ? "disabled" : ""}><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}${answer && index === question.correctIndex ? '<b aria-label="Correct answer">✓</b>' : ""}</button>`).join("")}</div>
    ${answer ? `<div class="doubt-evaluation ${answer.correct ? "is-correct" : "needs-review"}"><strong>${answer.correct ? "Correct!" : "Not quite—let's learn from it."}</strong><p>${escapeHtml(question.explanation)}</p>${!answer.correct ? `<div class="doubt-quiz-feedback-actions"><button type="button" class="btn-secondary" data-action="doubt-review-concept" data-node-id="${escapeHtml(question.conceptId)}">Review this concept</button><button type="button" class="btn-secondary" data-action="doubt-quiz-retry-question">Try Again</button></div>` : ""}</div><div class="doubt-action-row doubt-quiz-footer"><button class="btn-secondary" data-action="doubt-back-to-visual">← Back to visual</button><button class="btn-primary" data-action="doubt-quiz-next">${quiz.index === quiz.questions.length - 1 ? "See results" : "Next question →"}</button></div>` : `<div class="doubt-action-row doubt-quiz-footer"><button class="btn-secondary" data-action="doubt-back-to-visual">← Back to visual</button></div>`}
  </section>`;
}

function getDoubtQuizConceptResults(quiz) {
  const nodes = state.ui.doubtVisualResult?.visual.nodes || [];
  const grouped = new Map();
  quiz.questions.forEach((question, index) => {
    const entries = grouped.get(question.conceptId) || [];
    entries.push(quiz.answers[index]);
    grouped.set(question.conceptId, entries);
  });
  return [...grouped].map(([nodeId, answers]) => ({
    node: nodes.find((item) => item.id === nodeId),
    correct: answers.filter((answer) => answer?.correct).length,
    total: answers.length
  })).filter((item) => item.node);
}

function renderDoubtQuizResults(quiz) {
  if (!quiz?.questions?.length) return "";
  const concepts = getDoubtQuizConceptResults(quiz);
  const score = quiz.answers.filter((answer) => answer?.correct).length;
  const incorrect = quiz.questions.filter((question, index) => !quiz.answers[index]?.correct);
  const understood = concepts.filter((item) => item.correct === item.total);
  const needsImprovement = concepts.filter((item) => item.correct < item.total);
  const poorConcepts = needsImprovement.filter((item) => item.correct === 0 || item.correct / item.total < 0.5);
  return `<section class="doubt-result-card doubt-quiz-results" aria-live="polite">
    <div class="doubt-result-heading"><span class="doubt-number">✓</span><div><span class="eyebrow">TEST YOUR UNDERSTANDING</span><h2>${quiz.retryOnly ? "Retry results" : "Quiz complete"}</h2></div></div>
    <div class="doubt-score-card"><span class="eyebrow">YOUR SCORE</span><strong>${score}<small> / ${quiz.questions.length}</small></strong><span>${score === quiz.questions.length ? "Excellent work—you have these concepts." : "Review the concepts below, then try missed questions again."}</span></div>
    <div class="doubt-concept-results"><article><h3>Concepts understood</h3>${understood.length ? `<ul>${understood.map((item) => `<li>${escapeHtml(item.node.label)} <span>${item.correct}/${item.total}</span><button class="btn-secondary" data-action="doubt-review-concept" data-node-id="${escapeHtml(item.node.id)}">Review</button></li>`).join("")}</ul>` : '<p class="doubt-no-concepts">Keep practicing—no concept was fully correct yet.</p>'}</article><article><h3>Concepts that need improvement</h3>${needsImprovement.length ? `<ul>${needsImprovement.map((item) => `<li class="doubt-needs-review"><div><strong>${escapeHtml(item.node.label)}</strong><small>${item.correct}/${item.total} correct</small>${quiz.simplifications?.[item.node.id] ? `<p class="doubt-simplified">${escapeHtml(quiz.simplifications[item.node.id])}</p>` : ""}</div><div class="doubt-concept-actions"><button class="btn-secondary" data-action="doubt-review-concept" data-node-id="${escapeHtml(item.node.id)}">Review this concept</button>${poorConcepts.includes(item) && !quiz.simplifications?.[item.node.id] ? `<button class="btn-secondary" data-action="doubt-simplify-concept" data-node-id="${escapeHtml(item.node.id)}" ${state.ui.doubtLoading ? "disabled" : ""}>Simplify first</button>` : ""}</div></li>`).join("")}</ul>` : '<p class="doubt-no-concepts">You answered all concepts correctly.</p>'}</article></div>
    <div class="doubt-action-row doubt-quiz-footer"><button class="btn-secondary" data-action="doubt-back-to-visual">← Back to visual</button>${incorrect.length ? `<button class="btn-primary" data-action="doubt-quiz-retry-wrong">Try Again · ${incorrect.length} missed</button>` : ""}</div>
  </section>`;
}

function renderDoubtVisual(result, selectedNodeId) {
  const visual = result.visual;
  const nodesById = new Map(visual.nodes.map((node) => [node.id, node]));
  const connections = visual.relationships.map((connection, index) => {
    const from = nodesById.get(connection.from);
    const to = nodesById.get(connection.to);
    if (!from || !to) return "";
    const x1 = from.x * 10;
    const y1 = from.y * 6.2;
    const x2 = to.x * 10;
    const y2 = to.y * 6.2;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    return `<g class="doubt-relationship ${connection.direction === "both" ? "is-bidirectional" : ""}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#doubt-arrow-head)" ${connection.direction === "both" ? 'marker-start="url(#doubt-arrow-head)"' : ""}/><rect x="${centerX - Math.max(30, connection.label.length * 3.3)}" y="${centerY - 12}" width="${Math.max(60, connection.label.length * 6.6)}" height="24" rx="3"/><text x="${centerX}" y="${centerY + 4}" text-anchor="middle">${escapeHtml(connection.label)}</text><title>${escapeHtml(from.label)} ${escapeHtml(connection.label)} ${escapeHtml(to.label)}</title></g>`;
  }).join("");
  const nodes = visual.nodes.map((node) => {
    const width = node.role === "central" ? 22 : node.role === "major" ? 19 : 17;
    return `<button class="doubt-diagram-node node-${node.role} ${node.id === selectedNodeId ? "is-selected" : ""}" style="--node-x:${node.x}%;--node-y:${node.y}%;--node-width:${width}%" type="button" data-action="doubt-select-node" data-node-id="${escapeHtml(node.id)}" aria-pressed="${node.id === selectedNodeId}"><span>${escapeHtml(node.label)}</span>${node.description ? `<small>${escapeHtml(node.description)}</small>` : ""}</button>`;
  }).join("");
  return `<div class="doubt-visual doubt-diagram-canvas-wrap" aria-label="${escapeHtml(result.diagramTypeLabel)}: ${escapeHtml(visual.title)}">
    <div class="doubt-canvas-caption"><span class="doubt-diagram-type">${escapeHtml(result.diagramTypeLabel)}</span><span>Tap a concept to explore it</span></div>
    <div class="doubt-diagram-canvas">
      <svg class="doubt-relationship-layer" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-label="Concept relationships" role="img"><defs><marker id="doubt-arrow-head" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>${connections}</svg>
      ${nodes}
    </div>
  </div>`;
}

function scrollToDoubtInfoPanel() {
  window.requestAnimationFrame(() => {
    if (state.ui.screen !== "student-visualize") return;
    document.getElementById("doubt-info-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function runDoubtRequest(action) {
  const student = getStudentByAnyId(state.ui.studentSessionId);
  if (!student) {
    state.ui.screen = "student-login";
    renderApp();
    return;
  }
  state.ui.doubtLoading = true;
  state.ui.doubtError = "";
  renderApp();
  try {
    const subject = state.ui.doubtSubject || "";
    const weakSubjects = Array.isArray(student.weakSubjects) ? student.weakSubjects : [];
    const supportContext = Boolean(subject && weakSubjects.some((item) => String(item).trim().toLowerCase() === subject.trim().toLowerCase()));
    const response = await fetch("/.netlify/functions/visualize-doubt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        topic: state.ui.doubtTopic,
        subject,
        level: state.ui.doubtLevel || "High school",
        classLevel: state.ui.doubtClassLevel || "",
        supportContext,
        currentVisual: state.ui.doubtVisualResult || state.ui.doubtResult,
        nodeId: state.ui.doubtSelectedNodeId || ""
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || "Unable to complete this learning request. Please try again.");
    if (action === "flashcards") {
      state.ui.doubtResult = { cards: result.cards, topic: state.ui.doubtTopic };
      state.ui.doubtMode = "flashcards";
    } else if (action === "quiz") {
      state.ui.doubtQuiz = { questions: result.questions, index: 0, answers: [], retryOnly: false, finished: false, simplifications: {} };
      state.ui.doubtResult = state.ui.doubtVisualResult;
      state.ui.doubtMode = "quiz";
    } else if (action === "explain-node") {
      state.ui.doubtNodeExplanation = result.explanation;
      state.ui.doubtNodeExample = result.example;
      state.ui.doubtNodeWhy = result.whyItMatters;
      state.ui.doubtMode = "visual";
    } else if (action === "simplify-node") {
      if (state.ui.doubtQuiz) state.ui.doubtQuiz.simplifications = { ...state.ui.doubtQuiz.simplifications, [state.ui.doubtSelectedNodeId]: result.explanation };
      state.ui.doubtMode = "quiz-results";
    } else if (result.ambiguous) {
      state.ui.doubtResult = { ...result, topic: state.ui.doubtTopic };
      state.ui.doubtMode = "visual";
    } else {
      const labels = { "concept-map": "concept map", "tree": "classification tree", "process": "process diagram", "cause-effect": "cause-and-effect diagram", "system": "system diagram", "cycle": "cycle diagram", "comparison": "comparison diagram", "structure": "labeled structure", "timeline": "timeline", "steps": "step-by-step diagram" };
      state.ui.doubtResult = { ...result.visual, topic: state.ui.doubtTopic, diagramTypeLabel: labels[result.diagramType] || result.diagramType };
      state.ui.doubtVisualResult = state.ui.doubtResult;
      state.ui.doubtSelectedNodeId = result.visual.centralConcept;
      state.ui.doubtNodeExplanation = "";
      state.ui.doubtNodeExample = "";
      state.ui.doubtNodeWhy = "";
      state.ui.doubtEvaluation = null;
      state.ui.doubtQuiz = null;
      state.ui.doubtMode = "visual";
    }
  } catch (error) {
    state.ui.doubtError = error.message || "Unable to complete this learning request. Please check your connection and retry.";
  } finally {
    state.ui.doubtLoading = false;
    renderApp();
  }
}

function clearDoubtState() {
  for (const key of Object.keys(state.ui)) {
    if (key.startsWith("doubt")) delete state.ui[key];
  }
}

function renderAssistantHistory(conversations, currentId, role) {
  const action = role === "teacher" ? "load-teacher-chat" : "load-student-chat";
  if (!conversations?.length) return '<p class="assistant-history-empty">Your saved chats will appear here.</p>';
  return conversations.map((conversation) => `
    <button type="button" class="assistant-history-item ${conversation.id === currentId ? "active" : ""}" data-action="${action}" data-conversation-id="${escapeHtml(conversation.id)}">
      <strong>${escapeHtml(conversation.title || "New conversation")}</strong>
      <small>${conversation.updated_at ? escapeHtml(new Date(conversation.updated_at).toLocaleDateString()) : ""}</small>
    </button>
  `).join("");
}

function renderAssistantMessages(messages, intro) {
  if (!messages?.length) return `<div class="assistant-empty-state"><span class="assistant-spark">✳</span><h2>${escapeHtml(intro)}</h2><p>Ask a question to begin. Your conversations are saved to your account.</p></div>`;
  return messages.map((message) => `
    <article class="assistant-message assistant-message-${message.role === "user" ? "user" : "ai"}">
      <span class="assistant-message-label">${message.role === "user" ? "You" : "Mentora AI"}</span>
      <div class="assistant-message-content">${message.role === "assistant" ? formatAssistantResponse(message.content || "") : escapeHtml(message.content || "")}</div>
    </article>
  `).join("");
}

function renderTeacherAiAssistant() {
  const conversations = state.ui.teacherAiConversations || [];
  const messages = state.ui.teacherAiMessages || [];
  const roster = state.students || [];
  const activeClass = state.classes.find((classRecord) => classRecord.id === state.activeClassId);
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant")?.content || "";
  const prompts = [
    "Analyse the whole class and identify who may need support using recorded marks.",
    "Compare Mathematics and Chemistry across the class, with evidence.",
    "Create a lesson plan for teaching quadratic equations.",
    "Generate a 10-question quiz on the current topic."
  ];
  return `
    <section class="assistant-workspace teacher-assistant-workspace">
      <header class="assistant-page-heading"><div><span class="eyebrow">TEACHING &amp; LEARNING PARTNER</span><h1>Teacher AI Assistant</h1><p>Ground student analysis in assigned-class records, or ask for teaching help.</p></div>
        <div class="assistant-heading-actions"><button class="btn-secondary" type="button" data-action="download-teacher-ai-report" ${lastAssistant ? "" : "disabled"}>Download response</button><button class="btn-primary" type="button" data-action="new-teacher-chat">＋ New Chat</button></div>
      </header>
      <div class="assistant-chat-layout">
        <aside class="assistant-history-panel"><div class="assistant-panel-heading"><span>YOUR CONVERSATIONS</span><button type="button" data-action="refresh-teacher-chats" aria-label="Refresh conversations">↻</button></div><div class="assistant-history-list">${state.ui.teacherAiHistoryLoading ? '<p class="assistant-history-empty">Loading conversations…</p>' : state.ui.teacherAiHistoryError ? `<p class="assistant-history-error" role="alert">${escapeHtml(state.ui.teacherAiHistoryError)}</p>` : renderAssistantHistory(conversations, state.ui.teacherAiConversationId, "teacher")}</div></aside>
        <div class="assistant-chat-panel">
          <div class="assistant-context-line"><span class="assistant-live-dot"></span><span>Authorized class context: <strong>${escapeHtml(activeClass ? formatClassLabel(activeClass) : "Choose an assigned class")}</strong></span><small>${roster.length} student records loaded</small></div>
          <div class="assistant-message-list" aria-live="polite">${renderAssistantMessages(messages, "What would you like to work on?")}${state.ui.teacherAiLoading ? '<article class="assistant-message assistant-message-ai assistant-thinking"><span class="assistant-message-label">Mentora AI</span><div class="assistant-message-content">Reviewing your request…</div></article>' : ""}</div>
          ${state.ui.teacherAiDataNotice ? `<p class="assistant-data-notice" role="status">${escapeHtml(state.ui.teacherAiDataNotice)}</p>` : ""}
          ${state.ui.teacherAiError ? `<div class="assistant-error" role="alert"><span>${escapeHtml(state.ui.teacherAiError)}</span><button type="button" class="btn-secondary" data-action="retry-teacher-chat" ${state.ui.teacherAiLoading ? "disabled" : ""}>Retry</button></div>` : ""}
          ${!messages.length ? `<div class="assistant-suggestions">${prompts.map((prompt) => `<button type="button" data-action="assistant-suggestion" data-suggestion="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join("")}</div>` : ""}
          <form id="teacher-ai-form" class="assistant-composer">
            <div class="assistant-analysis-options">
              <label>Students <small>Leave unselected to resolve names, IDs, or the whole class from your message.</small>
                <select name="studentIds" multiple size="4" aria-label="Select students for analysis">${roster.map((student) => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)} · ${escapeHtml(student.studentId || student.rollNumber || "")}</option>`).join("")}</select>
              </label>
            </div>
            <label class="assistant-prompt-label" for="teacher-ai-message">Your message</label>
            <textarea id="teacher-ai-message" name="message" rows="3" maxlength="4000" required placeholder="Ask a student question, or request a lesson plan, quiz, email, or idea…" ${state.ui.teacherAiLoading ? "disabled" : ""}>${escapeHtml(state.ui.teacherAiDraft || "")}</textarea>
            <div class="assistant-composer-footer"><span>Student answers use only records in your assigned class. General teaching requests do not need student data.</span><button class="btn-primary" type="submit" ${state.ui.teacherAiLoading ? "disabled" : ""}>${state.ui.teacherAiLoading ? "Thinking…" : "Send ↑"}</button></div>
          </form>
        </div>
      </div>
    </section>
  `;
}

function renderStudentAiAssistant() {
  const student = getStudentByAnyId(state.ui.studentSessionId);
  const conversations = state.ui.studentAiConversations || [];
  const messages = state.ui.studentAiMessages || [];
  return `
    <div class="student-portal student-workspace assistant-student-portal">
      ${renderStudentSidebar("student-ai")}
      <main class="student-content student-workspace-main assistant-student-main">
        <header class="student-workspace-topbar"><span>Student portal <b>/</b> AI Assistant</span><button class="btn-primary" type="button" data-action="new-student-chat">＋ New Chat</button></header>
        <section class="assistant-page-heading student-assistant-heading"><div><span class="eyebrow">YOUR LEARNING COMPANION</span><h1>Ask, explore,<br/><em>understand.</em></h1><p>Get help with concepts, coding, notes, revision, and more.</p></div></section>
        <div class="assistant-student-layout">
          <aside class="assistant-history-panel"><div class="assistant-panel-heading"><span>YOUR CHATS</span><button type="button" data-action="refresh-student-chats" aria-label="Refresh conversations">↻</button></div><div class="assistant-history-list">${state.ui.studentAiHistoryLoading ? '<p class="assistant-history-empty">Loading conversations…</p>' : renderAssistantHistory(conversations, state.ui.studentAiConversationId, "student")}</div></aside>
          <div class="assistant-chat-panel">
            <div class="assistant-context-line"><span class="assistant-live-dot"></span><span>Signed in as <strong>${escapeHtml(student?.name || "Student")}</strong></span><small>${escapeHtml(student?.className || "")}</small></div>
            <div class="assistant-message-list" aria-live="polite">${renderAssistantMessages(messages, "What are you curious about today?")}${state.ui.studentAiLoading ? '<article class="assistant-message assistant-message-ai assistant-thinking"><span class="assistant-message-label">Mentora AI</span><div class="assistant-message-content">Thinking through your question…</div></article>' : ""}</div>
            ${state.ui.studentAiError ? `<div class="assistant-error" role="alert"><span>${escapeHtml(state.ui.studentAiError)}</span><button type="button" class="btn-secondary" data-action="retry-student-chat" ${state.ui.studentAiLoading ? "disabled" : ""}>Retry</button></div>` : ""}
            ${!messages.length ? `<div class="assistant-suggestions">${["Explain a difficult idea in simple steps.", "Help me make a revision plan for this week.", "Create five practice questions for a topic I choose.", "Explain what this code does: "].map((prompt) => `<button type="button" data-action="assistant-suggestion" data-suggestion="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join("")}</div>` : ""}
            <form id="student-ai-form" class="assistant-composer">
              <label class="assistant-prompt-label" for="student-ai-message">Message Mentora AI</label>
              <textarea id="student-ai-message" name="message" rows="3" maxlength="4000" required placeholder="Ask anything, or paste your notes to summarize…" ${state.ui.studentAiLoading ? "disabled" : ""}>${escapeHtml(state.ui.studentAiDraft || "")}</textarea>
              <div class="assistant-composer-footer"><span>Personal academic context is used only when available for your account.</span><button class="btn-primary" type="submit" ${state.ui.studentAiLoading ? "disabled" : ""}>${state.ui.studentAiLoading ? "Thinking…" : "Send ↑"}</button></div>
            </form>
          </div>
        </div>
        ${state.ui.studentAiError?.includes("session") ? '<p class="assistant-session-note">Your session may have expired. Sign out and sign in again to continue.</p>' : ""}
      </main>
    </div>
  `;
}

function renderClassSetup() {
  return `
    <div class="landing-screen">
      <div class="landing-card class-setup-card">
        <div class="logo-row">
          <span class="brand-mark"></span>
          <h1>MENTORA</h1>
        </div>
        <h2>Select Your Class</h2>
        <form id="class-setup-form" class="class-setup-form">
          <div class="field">
            <label>Class</label>
            <select class="select" name="className" required>
              <option value="">Select Class</option>
              ${STANDARD_OPTIONS.map((option) => `<option value="${option}">${option}</option>`).join("")}
              <option value="custom">Custom Class</option>
            </select>
          </div>
          <div class="field custom-class-field" hidden>
            <label>Custom Class</label>
            <input class="input" name="customClassName" placeholder="1st Year B.Tech CSE" />
          </div>
          <div class="field">
            <label>Section</label>
            <select class="select" name="section" required>
              <option value="">Select Section</option>
              ${SECTION_OPTIONS.map((option) => `<option value="${option}">${option}</option>`).join("")}
              <option value="custom">Custom Section</option>
            </select>
          </div>
          <div class="field custom-section-field" hidden>
            <label>Custom Section</label>
            <input class="input" name="customSection" placeholder="Section B" />
          </div>
          <button class="btn-primary" type="submit">Continue</button>
        </form>
      </div>
    </div>
  `;
}

function renderShell(contentHtml) {
  const activeNav = state.ui.screen === "student-profile" ? "students" : state.ui.screen;
  return `
    <div class="app-shell${state.ui.screen === "dashboard" ? " teacher-dashboard-shell" : ""}">
      <aside class="sidebar">
        <a class="brand" href="${pathForScreen("dashboard")}" data-route-screen="dashboard" aria-label="Mentora dashboard"><img class="portal-sidebar-logo" src="/mentora-logo.png" alt="Mentora" /></a>
        <p class="sidebar-section-label">WORKSPACE</p>
        <nav class="sidebar-nav">
          <a class="nav-btn ${activeNav === "dashboard" ? "active" : ""}" href="${pathForScreen("dashboard")}" data-route-screen="dashboard"><span class="nav-glyph">⌂</span>Overview</a>
          <a class="nav-btn ${activeNav === "class-selection" ? "active" : ""}" href="${pathForScreen("class-selection")}" data-action="open-my-classes"><span class="nav-glyph">▦</span>My Classes</a>
          <a class="nav-btn ${activeNav === "students" ? "active" : ""}" href="${pathForScreen("students")}" data-route-screen="students"><span class="nav-glyph">◎</span>Students</a>
          <a class="nav-btn ${activeNav === "insights" ? "active" : ""}" href="${pathForScreen("insights")}" data-route-screen="insights"><span class="nav-glyph">◌</span>Insights</a>
          <a class="nav-btn ${activeNav === "teacher-ai" ? "active" : ""}" href="${pathForScreen("teacher-ai")}" data-action="open-teacher-ai"><span class="nav-glyph">✳</span>AI Assistant</a>
        </nav>
        <div class="sidebar-footer">
          <div class="teacher-pill">
            <div class="teacher-avatar">${getInitials(state.teacher?.displayName || state.teacher?.username || "T")}</div>
            <span><strong>${escapeHtml(state.teacher?.displayName || "Teacher")}</strong><small>Teacher account</small></span>
          </div>
          <button class="nav-btn" data-action="open-class-selector"><span class="nav-glyph">⇄</span>Switch Class</button>
          <button class="nav-btn sidebar-logout" data-action="teacher-logout"><span class="nav-glyph">↪</span>Log out</button>
        </div>
      </aside>
      <main class="main-panel">
        <header class="topbar">
          <div><div class="greeting">${state.ui.screen === "dashboard" ? `Good morning, ${escapeHtml(state.teacher?.displayName || state.teacher?.username || "Teacher")}` : state.ui.screen === "class-selection" ? "My Classes" : state.ui.screen === "students" ? "Students" : state.ui.screen === "insights" ? "Class Insights" : state.ui.screen === "teacher-ai" ? "Teacher AI Assistant" : "Student Profile"}</div><p class="topbar-caption">${state.ui.screen === "dashboard" ? "A thoughtful overview of your class." : `Your classroom workspace · ${escapeHtml(getCurrentClassLabel())}`}</p></div>
          <button class="class-badge class-selector-button" data-action="open-class-selector">${getCurrentClassLabel()} ▼</button>
        </header>
        ${contentHtml}
      </main>
    </div>
  `;
}

function getClassSubjectRows(students) {
  const grouped = new Map();
  for (const student of students) for (const mark of getStudentNumericAssessmentSeries(student)) {
    const rows = grouped.get(mark.subject) || [];
    rows.push({ ...mark, studentId: student.id, studentName: student.name });
    grouped.set(mark.subject, rows);
  }
  return [...grouped].map(([subject, rows]) => {
    rows.sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate) || a.assessmentLabel.localeCompare(b.assessmentLabel));
    const latestDate = rows[rows.length - 1]?.assessmentDate;
    const latestRows = rows.filter((row) => row.assessmentDate === latestDate);
    return { subject, rows, average: rows.reduce((sum, row) => sum + row.percent, 0) / rows.length, latest: latestRows.reduce((sum, row) => sum + row.percent, 0) / latestRows.length };
  }).sort((a, b) => b.average - a.average);
}

function getClassAssessmentEvents(students) {
  const events = new Map();
  for (const student of students) for (const mark of student.subjectMarks || []) {
    const key = `${mark.assessmentDate || ""}\u0000${mark.assessmentLabel || "Assessment"}`;
    const event = events.get(key) || { date: mark.assessmentDate || "", label: mark.assessmentLabel || "Assessment", marks: [], grades: [], subjects: new Set(), students: new Set() };
    event.subjects.add(String(mark.subject || "").trim());
    if (isNumericSubjectMark(mark)) event.marks.push(Number(mark.obtainedMarks) / Number(mark.maxMarks) * 100);
    else if (mark.grade) event.grades.push(String(mark.grade));
    event.students.add(student.id);
    events.set(key, event);
  }
  return [...events.values()].sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label));
}

function getStudentsNeedingAttention(students) {
  return students.map((student) => {
    const marksBySubject = new Map();
    getStudentNumericAssessmentSeries(student).forEach((mark) => { const rows = marksBySubject.get(mark.subject) || []; rows.push(mark); marksBySubject.set(mark.subject, rows); });
    const flags = [];
    for (const [subject, rows] of marksBySubject) {
      const latest = rows[rows.length - 1];
      const first = rows[0];
      if (latest.percent < 60) flags.push(`${subject} is ${latest.percent.toFixed(0)}%`);
      else if (rows.length > 1 && first.percent - latest.percent >= 8) flags.push(`${subject} down ${(first.percent - latest.percent).toFixed(0)} points`);
    }
    const skillValues = ASSESSMENT_KEYS.map((item) => Number(student.assessments?.[item.key] || 0)).filter((value) => value > 0);
    const skillAverage = skillValues.length ? skillValues.reduce((sum, value) => sum + value, 0) / skillValues.length : null;
    if (!flags.length && skillAverage != null && skillAverage < 62) flags.push(`Teacher assessment average ${skillAverage.toFixed(0)}%`);
    return flags.length ? { student, reason: flags.slice(0, 2).join(" · ") } : null;
  }).filter(Boolean).slice(0, 5);
}

function renderClassSubjectSummary(rows) {
  if (!rows.length) return `<div class="dashboard-empty">Subject summaries appear after marks-based assessments are recorded.</div>`;
  return `<div class="class-subject-list">${rows.slice(0, 6).map((row) => `<button class="class-subject-row" data-view="insights"><span><strong>${escapeHtml(row.subject)}</strong><small>Latest ${row.latest.toFixed(1)}% · Avg ${row.average.toFixed(1)}%</small></span><i style="--bar:${row.average}%"></i><b>${row.average.toFixed(0)}%</b></button>`).join("")}</div>`;
}

function renderClassRecentAssessments(events) {
  if (!events.length) return `<div class="dashboard-empty">Recent assessments will appear here when marks or grades are saved.</div>`;
  return `<div class="recent-assessment-list">${events.slice(0, 5).map((event) => {
    const subjects = [...event.subjects].filter(Boolean);
    const subjectLabel = subjects.length > 2 ? `${subjects.slice(0, 2).join(", ")} +${subjects.length - 2}` : subjects.join(", ") || "Subject not specified";
    const result = event.marks.length ? `${(event.marks.reduce((sum, value) => sum + value, 0) / event.marks.length).toFixed(1)}%` : event.grades.length ? [...new Set(event.grades)].join(", ") : "—";
    return `<button class="recent-assessment-row" data-view="insights"><span class="assessment-date-badge">${event.date ? escapeHtml(formatDate(event.date)) : "—"}</span><span><strong>${escapeHtml(event.label)}</strong><small>${escapeHtml(subjectLabel)} · ${event.students.size} student${event.students.size === 1 ? "" : "s"}</small></span><b>${escapeHtml(result)}</b></button>`;
  }).join("")}</div>`;
}

function renderDashboard() {
  const students = getCurrentStudents();
  const numericMarks = students.flatMap((student) => getStudentNumericAssessmentSeries(student));
  const subjectRows = getClassSubjectRows(students);
  const events = getClassAssessmentEvents(students);
  const attention = getStudentsNeedingAttention(students);
  const average = numericMarks.length ? numericMarks.reduce((sum, mark) => sum + mark.percent, 0) / numericMarks.length : null;
  const strongest = subjectRows[0] || null;
  const lowest = subjectRows.length ? subjectRows[subjectRows.length - 1] : null;
  return `
    <div class="page-section dashboard-page">
      <section class="dashboard-metrics"><button class="dashboard-metric" data-view="students"><span class="dashboard-metric-icon">◎</span><small>Total students</small><strong>${students.length}</strong><span class="metric-footnote">In this class</span></button><button class="dashboard-metric" data-action="open-my-classes"><span class="dashboard-metric-icon lavender">▦</span><small>Classes</small><strong>${state.classes.length}</strong><span class="metric-footnote">Assigned to you</span></button><button class="dashboard-metric" data-view="insights"><span class="dashboard-metric-icon blue">↗</span><small>Assessments</small><strong>${events.length}</strong><span class="metric-footnote">Recorded assessments</span></button><button class="dashboard-metric" data-view="insights"><span class="dashboard-metric-icon rose">◌</span><small>Average performance</small><strong>${average == null ? "—" : `${average.toFixed(1)}%`}</strong><span class="metric-footnote">Across recorded marks</span></button></section>
      <div class="dashboard-two-column dashboard-middle-grid"><section class="dashboard-panel"><div class="dashboard-panel-heading"><div><span class="eyebrow">CLASS SUPPORT</span><h2>Students Needing Attention</h2><p>Based on current marks and recorded teacher assessments.</p></div><button class="icon-text-link" data-view="students" aria-label="View students">→</button></div><div class="attention-list">${attention.length ? attention.map(({ student, reason }) => `<button class="attention-row" data-action="open-student" data-student-id="${student.id}"><span class="attention-avatar">${getInitials(student.name)}</span><span><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(reason)}</small></span><span class="attention-arrow">→</span></button>`).join("") : `<div class="dashboard-empty">No students currently meet the recorded support indicators.</div>`}</div></section><section class="dashboard-panel"><div class="dashboard-panel-heading"><div><span class="eyebrow">ASSESSMENT HISTORY</span><h2>Recent Assessments</h2></div><button class="icon-text-link" data-view="insights" aria-label="View assessments">→</button></div>${renderClassRecentAssessments(events)}</section></div>
      <div class="dashboard-two-column dashboard-bottom-grid"><section class="dashboard-panel"><div class="dashboard-panel-heading"><div><span class="eyebrow">SUBJECT SNAPSHOT</span><h2>Subject Performance</h2><p>Average of all saved marks by subject.</p></div><button class="icon-text-link" data-view="insights" aria-label="View insights">→</button></div>${renderClassSubjectSummary(subjectRows)}</section><section class="dashboard-panel attendance-panel"><div class="dashboard-panel-heading"><div><span class="eyebrow">CLASS WELLBEING</span><h2>Attendance Overview</h2></div></div><div class="attendance-empty"><span aria-hidden="true">◷</span><p>Attendance data is not recorded in Mentora yet.</p></div></section></div>
      <section class="dashboard-panel dashboard-insight-panel"><div class="dashboard-panel-heading"><div><span class="eyebrow">A CLEARER VIEW</span><h2>Mentora Insights</h2></div><span class="insight-spark" aria-hidden="true">✳</span></div>${attention.length ? `<p><strong>${attention.length} student${attention.length === 1 ? " may" : "s may"} need attention</strong> based on recorded marks and teacher assessments.</p>` : `<p>No students currently meet the recorded support indicators${students.length ? "." : "; add students and assessments to build class insights."}</p>`}<p>Review class patterns or open a student profile to generate individualized AI guidance.</p><button class="btn-secondary" data-view="insights">View Insights <span aria-hidden="true">→</span></button></section>
    </div>
  `;
}

function renderStudentsPage() {
  const filtered = getFilteredStudents();

  return `
    <div class="page-section">
      <div class="page-header">
        <h2>Students</h2>
        <div class="student-import-actions"><button class="btn-ghost" data-action="select-student-csv">Import CSV</button><button class="btn-primary" data-action="open-add-student">+ Add Student</button><input id="student-csv-file" type="file" accept=".csv,text/csv" hidden /></div>
      </div>
      ${renderTemporaryStudentCredentials("students")}
      <input
        class="searchbar"
        type="search"
        value="${escapeHtml(state.ui.searchQuery)}"
        placeholder="Search students..."
        data-input="student-search"
      />
      ${!getCurrentStudents().length ? `
        <div class="table-wrap">
          <div class="empty-state" style="padding: 32px 24px;">
            <h3 style="margin:0 0 8px; color: var(--text);">No students added yet.</h3>
            <p style="margin: 0 0 18px; color: var(--muted);">Add your first student to begin building their growth profile.</p>
            <button class="btn-primary" data-action="open-add-student">+ Add Student</button>
          </div>
        </div>
      ` : `
        <div class="table-wrap">
          <table class="students-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Roll Number</th>
                <th>Strongest area</th>
                <th>Development area</th>
                <th>Last updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length ? filtered.map((student) => {
                const strongest = getHighestAssessment(student.assessments);
                const weakest = getLowestAssessment(student.assessments);
                return `
                  <tr>
                    <td>${student.name}</td>
                    <td>${student.rollNumber}</td>
                    <td>${strongest.label}</td>
                    <td>${weakest.label}</td>
                    <td>${formatDate(student.lastUpdated || student.progress?.[student.progress.length - 1]?.date || new Date().toISOString())}</td>
                    <td><button class="small-btn" data-action="open-student" data-student-id="${student.id}">View Profile</button></td>
                  </tr>
                `;
              }).join("") : '<tr><td colspan="6"><div class="empty-state">No students match this search.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

function renderInsightsPage() {
  const insights = buildClassInsights();

  return `
    <div class="page-section">
      <div class="page-header">
        <h2>Class Insights</h2>
      </div>
      <div class="two-up">
        <div class="list-card">
          <h3 class="section-title">Class strengths</h3>
          <div class="tag-list">
            ${insights.strengths.map((item) => `<span class="chip">${item}</span>`).join("") || '<span class="chip">No strong patterns identified yet.</span>'}
          </div>
        </div>
        <div class="list-card">
          <h3 class="section-title">Class development areas</h3>
          <div class="tag-list">
            ${insights.developmentAreas.map((item) => `<span class="chip warn">${item}</span>`).join("") || '<span class="chip warn">No development patterns identified yet.</span>'}
          </div>
        </div>
      </div>

      <div class="two-up" style="margin-top: 18px;">
        <div class="list-card">
          <h3 class="section-title">Common patterns</h3>
          <div class="chip-list">
            ${insights.patterns.map((item) => `<span class="chip">${item}</span>`).join("") || '<span class="chip">No recurring patterns available.</span>'}
          </div>
        </div>
        <div class="list-card">
          <h3 class="section-title">Student groups</h3>
          <div class="chip-list">
            ${insights.groups.map((item) => `<span class="chip">${item}</span>`).join("") || '<span class="chip">No student groups available.</span>'}
          </div>
        </div>
      </div>

      <div class="profile-section">
        <div class="list-card">
          <h3 class="section-title">Teacher actions</h3>
          <div class="evidence-list">
            ${insights.actions.map((action) => `
              <div class="evidence-item">
                <strong>${action.title}</strong>
                <div>${action.text}</div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderStudentProfilePage() {
  const student = getSelectedStudent();
  if (!student) {
    return '<div class="page-section"><div class="empty-state">Student profile not found.</div></div>';
  }

  const strengthList = getStrengthList(student);
  const devList = getDevelopmentList(student);
  const analysis = state.ui.analysisByStudent?.[student.id] || null;

  return `
    <div class="page-section">
      <div class="student-profile-header">
        <div class="profile-identity">
          <div class="profile-avatar">${getInitials(student.name)}</div>
          <div>
            <h2>${student.name}</h2>
            <p>Student ID <strong>${escapeHtml(student.studentId || "Not assigned")}</strong> • Roll Number ${student.rollNumber} • ${escapeHtml(getStudentClassLabel(student))}</p>
          </div>
        </div>
        <div class="profile-actions">
          <button class="btn-ghost" data-action="copy-student-id" data-student-id="${student.id}">Copy Student ID</button>
          <button class="btn-secondary" data-action="download-teacher-report" data-student-id="${student.id}">Download Report</button>
          <button class="btn-ghost" data-action="edit-student" data-student-id="${student.id}">Edit Student</button>
          <button class="btn-ghost" data-action="add-observation" data-student-id="${student.id}">Add Observation</button>
          <button class="btn-secondary" data-action="reset-student-password" data-student-id="${escapeHtml(student.id)}"${state.ui.studentPasswordResetLoading ? " disabled" : ""}>${state.ui.studentPasswordResetLoading ? "Resetting…" : "Reset Student Password"}</button>
          <button class="btn-primary" data-action="analyze-student" data-student-id="${student.id}">Analyze Student</button>
        </div>
      </div>
      ${state.ui.studentPasswordResetError ? `<p class="form-error" role="alert">${escapeHtml(state.ui.studentPasswordResetError)}</p>` : ""}
      ${renderTemporaryStudentCredentials("student-profile", student.id)}

      <div class="profile-section">
        <div class="list-card analytics-card">
          <div class="marks-heading"><div><h3 class="section-title">Performance History</h3><p>Track how this student's marks have changed across assessments.</p></div><button class="btn-primary" data-action="add-subject-mark" data-student-id="${student.id}">Add Subject Marks</button></div>
          ${renderPerformanceHistory(student)}
        </div>
      </div>
      <div class="profile-section">
        <div class="list-card analytics-card">
          <div class="analytics-heading"><h3 class="section-title">Subject Performance</h3><p>Latest results and progress across recorded numerical assessments.</p></div>
          ${renderSubjectPerformance(student)}
          ${renderMarkHistory(student)}
        </div>
      </div>
      <div class="profile-section">
        <div class="list-card analytics-card">
          <div class="analytics-heading"><h3 class="section-title">Skill Development</h3><p>Teacher-assessed skills from this student's record.</p></div>
          ${renderSkillDevelopment(student)}
        </div>
      </div>

      <div class="analysis-card subject-analysis-card">
        <div class="analysis-header">
          <h3 class="section-title">AI Subject Improvement Analysis</h3>
          <button class="btn-primary" data-action="analyze-student" data-student-id="${student.id}">
            ${state.ui.analysisLoading ? '<span class="loading-box"><span class="loader"></span>Connecting the dots…</span>' : 'Analyze Student'}
          </button>
        </div>
        <p class="analysis-intro">Recommendations use saved assessment results and teacher-recorded information. They support, rather than replace, teacher judgment.</p>
        ${analysis ? renderAnalysisReport(analysis) : '<div class="empty-state">No subject analysis generated yet. Analyze this student to review recorded results and next steps.</div>'}
      </div>

      <div class="profile-section two-up">
        <div class="list-card">
          <h3 class="section-title">Strengths</h3>
          <div class="chip-list">
            ${strengthList.length ? strengthList.map((item) => `<span class="chip">${item}</span>`).join("") : '<span class="chip">Not enough data yet.</span>'}
          </div>
        </div>
        <div class="list-card">
          <h3 class="section-title">Development Areas</h3>
          <div class="chip-list">
            ${devList.length ? devList.map((item) => `<span class="chip warn">${item}</span>`).join("") : '<span class="chip warn">Not enough data yet.</span>'}
          </div>
        </div>
      </div>

      <div class="profile-section two-up">
        <div class="list-card">
          <h3 class="section-title">Learning Habits</h3>
          <div class="chip-list">
            ${(student.learningHabits || []).length ? (student.learningHabits || []).map((item) => `<span class="chip">${item}</span>`).join("") : '<span class="chip">No learning habits recorded.</span>'}
          </div>
        </div>
        <div class="list-card">
          <h3 class="section-title">Teacher observations</h3>
          <div class="chip-list">
            ${(student.observations || []).length ? (student.observations || []).slice(-3).map((obs) => `<span class="chip">${obs.category}</span>`).join("") : '<span class="chip">No observations yet.</span>'}
          </div>
        </div>
      </div>

      <div class="profile-section">
        <div class="list-card">
          <h3 class="section-title">Observations</h3>
          <div class="timeline">
            ${student.observations.length ? student.observations.slice().reverse().map((obs) => `
              <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                  <h5>${formatDate(obs.date)} • ${obs.category}</h5>
                  <p>${obs.note}</p>
                  <button class="small-btn" data-action="delete-observation" data-student-id="${student.id}" data-observation-id="${obs.id}">Delete</button>
                </div>
              </div>
            `).join("") : '<div class="empty-state">No observations recorded yet.</div>'}
          </div>
          <div style="margin-top: 16px;">
            <button class="btn-secondary" data-action="add-observation" data-student-id="${student.id}">+ Add Observation</button>
          </div>
        </div>

      </div>

    </div>
  `;
}

function renderModal() {
  if (!state.ui.activeModal) return "";
  const modal = state.ui.activeModal;

  if (modal.type === "class-selector") {
    return renderClassSelectorModal();
  }
  if (modal.type === "teacher-class-form") return renderTeacherClassModal(modal);

  if (modal.type === "add-student" || modal.type === "edit-student") {
    return renderStudentModal(modal);
  }

  if (modal.type === "add-observation") {
    return renderObservationModal(modal);
  }
  if (modal.type === "subject-mark") return renderSubjectMarkModal(modal);
  if (modal.type === "subject-mark-mode") return renderSubjectMarkModeModal(modal);

  if (modal.type === "followup") {
    return renderFollowUpModal(modal);
  }

  return "";
}

function renderTeacherClassModal(modal) {
  const existing = modal.classId ? state.classes.find((entry) => entry.id === modal.classId) : null;
  return `
    <div class="modal-overlay" data-close-modal="true"><div class="modal-card" data-stop-propagation="true">
      <div class="modal-header"><h3>${existing ? "Edit Class" : "Create New Class"}</h3><button class="close-btn" data-action="close-modal" aria-label="Close">&times;</button></div>
      <form id="teacher-class-form" data-mode="${existing ? "edit" : "create"}" data-class-id="${escapeHtml(existing?.id || "")}">
        <div class="field"><label for="teacher-class-name">Class name</label><input id="teacher-class-name" class="input" name="name" maxlength="150" value="${escapeHtml(existing?.name || "")}" placeholder="e.g., 1st Year BE CSE AI/ML" required /></div>
        <div class="field"><label for="teacher-class-course">Course / grade</label><input id="teacher-class-course" class="input" name="course" maxlength="120" value="${escapeHtml(existing?.course || "")}" placeholder="e.g., BE CSE AI/ML" required /></div>
        <div class="field"><label for="teacher-class-section">Section</label><input id="teacher-class-section" class="input" name="section" maxlength="40" value="${escapeHtml(existing?.section || "")}" placeholder="e.g., A" required /></div>
        <div class="field"><label for="teacher-class-year">Academic year (optional)</label><input id="teacher-class-year" class="input" name="academicYear" maxlength="32" value="${escapeHtml(existing?.academicYear || "")}" placeholder="e.g., 2026-27" /></div>
        ${state.ui.teacherClassError ? `<p class="form-error" role="alert">${escapeHtml(state.ui.teacherClassError)}</p>` : ""}
        <div class="modal-actions"><button type="button" class="btn-ghost" data-action="close-modal">Cancel</button><button type="submit" class="btn-primary">${existing ? "Save Changes" : "Create Class"}</button></div>
      </form>
    </div></div>`;
}

function renderClassSelectorModal() {
  return `
    <div class="modal-overlay" data-close-modal="true">
      <div class="modal-card" data-stop-propagation="true">
        <div class="modal-header">
          <h3>Select Class</h3>
          <button class="close-btn" data-action="close-modal" aria-label="Close">×</button>
        </div>
        <form id="class-switch-form">
          <div class="field">
            <label>Class</label>
            <select class="select" name="classId" required>
              ${state.classes.map((classRecord) => `<option value="${classRecord.id}" ${classRecord.id === state.activeClassId ? "selected" : ""}>${formatClassLabel(classRecord)}</option>`).join("")}
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-primary" data-action="switch-class">Switch Class</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderStudentModal(modal) {
  const isEdit = modal.type === "edit-student";
  const student = isEdit ? getStudentById(modal.studentId) : null;
  const defaultScore = isEdit ? (student?.assessments ? Math.round(getOverallScore(student.assessments)) : 0) : 0;

  return `
    <div class="modal-overlay" data-close-modal="true">
      <div class="modal-card student-modal-card" data-stop-propagation="true">
        <div class="modal-header">
          <h3>${isEdit ? "Edit Student" : "Add Student"}</h3>
          <button class="close-btn" data-action="close-modal" aria-label="Close">×</button>
        </div>
        <form id="student-form" class="student-modal-form" data-mode="${isEdit ? "edit" : "create"}" data-student-id="${student ? student.id : ""}" data-next-student-mark-row="${student?.subjectMarks?.length || 0}">
          <div class="form-grid">
            <div class="field">
              <label>Student Name</label>
              <input class="input" name="name" value="${escapeHtml(student?.name || "")}" required />
            </div>
            <div class="field">
              <label>Roll Number</label>
              <input class="input" name="rollNumber" value="${escapeHtml(student?.rollNumber || "")}" required />
            </div>
            ${renderStudentMarksSection(student)}
            ${ASSESSMENT_KEYS.map((item) => renderSliderField(item, isEdit ? (student?.assessments?.[item.key] ?? defaultScore) : 0)).join("")}
            <div class="field full">
              <label>Learning Habits</label>
              <div class="checkbox-grid">
                ${[
                  "Consistent",
                  "Needs reminders",
                  "Learns quickly",
                  "Needs examples",
                  "Works independently",
                  "Works well with others"
                ].map((habit) => `
                  <label class="check-item">
                    <input type="checkbox" name="learningHabits" value="${habit}" ${student && student.learningHabits?.includes(habit) ? "checked" : ""} />
                    <span>${habit}</span>
                  </label>
                `).join("")}
              </div>
            </div>
          </div>
          <div class="modal-actions student-modal-footer">
            ${isEdit ? '<button type="button" class="btn-danger" data-action="delete-student" data-student-id="'+student.id+'">Delete Student</button>' : ""}
            <button type="button" class="btn-ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn-primary">${isEdit ? "Save Changes" : "Save Student"}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderSliderField(item, value) {
  return `
    <div class="field full">
      <div class="slider-wrap">
        <div class="slider-head">
          <span>${item.label}</span>
          <span class="slider-pill" data-slider-value="${item.key}">${Math.round(value)}</span>
        </div>
        <input class="range" type="range" min="0" max="100" step="1" name="${item.key}" value="${Math.round(value)}" data-slider-input="${item.key}" />
      </div>
    </div>
  `;
}

function renderObservationModal(modal) {
  const student = getStudentById(modal.studentId);
  return `
    <div class="modal-overlay" data-close-modal="true">
      <div class="modal-card" data-stop-propagation="true">
        <div class="modal-header">
          <h3>Add Observation</h3>
          <button class="close-btn" data-action="close-modal" aria-label="Close">×</button>
        </div>
        <form id="observation-form" data-student-id="${student.id}">
          <div class="form-grid">
            <div class="field">
              <label>Category</label>
              <select class="select" name="category" required>
                <option value="Academic">Academic</option>
                <option value="Communication">Communication</option>
                <option value="Participation">Participation</option>
                <option value="Teamwork">Teamwork</option>
                <option value="Learning Habit">Learning Habit</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="field">
              <label>Date</label>
              <input class="input" type="date" name="date" value="${new Date().toISOString().split("T")[0]}" required />
            </div>
            <div class="field full">
              <label>Observation</label>
              <textarea class="textarea" name="note" placeholder="Understood the programming concept quickly but struggled to explain the solution verbally." required></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn-primary">Save Observation</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderFollowUpModal(modal) {
  const student = getStudentById(modal.studentId);
  return `
    <div class="modal-overlay" data-close-modal="true">
      <div class="modal-card" data-stop-propagation="true">
        <div class="modal-header">
          <h3>Information gap</h3>
          <button class="close-btn" data-action="close-modal" aria-label="Close">×</button>
        </div>
        <form id="followup-form" data-student-id="${student.id}">
          <div class="analysis-block">
            <h4>Follow-up question</h4>
            <p>${modal.message}</p>
            <p style="margin-top: 14px; font-weight: 700;">${modal.question}</p>
          </div>
          <div class="field full" style="margin-top: 18px;">
            <label>Teacher response</label>
            <textarea class="textarea" name="response" required></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn-primary">Save Answer</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderAnalysisReport(analysis) {
  if (analysis.fallbackSections) {
    return `<div class="analysis-body"><div class="analysis-fallback-banner"><strong>Guidance fallback · not AI-generated</strong><span>Gemini was unavailable: ${escapeHtml(analysis.fallbackReason || 'the analysis request failed')}. These suggestions use saved marks only and do not infer chapters or learning difficulties.</span></div>${renderAnalysisSections(analysis.fallbackSections)}</div>`;
  }
  if (analysis.aiContent) {
    return `<div class="analysis-body">${renderStructuredAiAnalysis(analysis.aiContent)}</div>`;
  }
  if (analysis.error) {
    return `<div class="empty-state" role="alert">${escapeHtml(analysis.error)}</div>`;
  }
  return `
    <div class="analysis-body">
      <div class="analysis-block">
        <h4>Student Snapshot</h4>
        <h5>${analysis.studentName}</h5>
        <p>${analysis.snapshot}</p>
      </div>

      <div class="analysis-block">
        <h4>Strengths</h4>
        <div class="chip-list">
          ${analysis.strengths.map((item) => `<span class="chip">${item}</span>`).join("")}
        </div>
      </div>

      <div class="analysis-block">
        <h4>Development areas</h4>
        <div class="chip-list">
          ${analysis.developmentAreas.map((item) => `<span class="chip warn">${item}</span>`).join("")}
        </div>
      </div>

      <div class="analysis-block">
        <h4>Patterns</h4>
        <p>${analysis.patterns}</p>
      </div>

      <div class="analysis-block">
        <h4>AI INTERPRETATION</h4>
        <p>${analysis.interpretation}</p>
      </div>

      <div class="analysis-block">
        <h4>OBSERVED</h4>
        <div class="evidence-list">
          ${analysis.evidence.map((item) => `<div class="evidence-item">${item}</div>`).join("")}
        </div>
      </div>

      <div class="analysis-block">
        <h4>Recommended action</h4>
        <div class="recommended-list">
          ${analysis.recommendedActions.map((action) => `
            <div class="recommended-item">
              <div>
                <strong>${action.week}</strong>
                <span>${action.action}</span>
                <small style="display:block; color: var(--muted); margin-top: 6px;">Purpose: ${action.purpose}</small>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn-secondary" data-action="start-intervention" data-student-id="${analysis.studentId}" data-action-id="${action.id}">${action.started ? "Started" : "Start"}</button>
                <button class="btn-ghost" data-action="complete-intervention" data-student-id="${analysis.studentId}" data-action-id="${action.id}">${action.completed ? "Completed" : "Complete"}</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="analysis-block">
        <h4>Follow-up question</h4>
        ${analysis.followUpQuestion
          ? `
            <div class="signal">Information gap</div>
            <p style="margin-top: 12px;">${analysis.followUpQuestion.message}</p>
            <p style="margin-top: 12px; font-weight: 700;">${analysis.followUpQuestion.question}</p>
            <div style="margin-top: 14px;">
              <button class="btn-secondary" data-action="answer-follow-up" data-student-id="${analysis.studentId}">Answer</button>
            </div>
          `
          : `<p>No follow-up question required at this stage.</p>`}
      </div>
    </div>
  `;
}

function getMetricCard(student, item) {
  const score = student.assessments[item.key];
  return `
    <div class="metric-card">
      <h4>${item.label}</h4>
      <div class="metric-score"><strong>${score}</strong><span>Teacher Assessment</span></div>
      <div class="progress-bar" style="--value: ${score}%"><i></i></div>
    </div>
  `;
}

function renderAttentionCard(student) {
  const strongest = getHighestAssessment(student.assessments);
  const weakest = getLowestAssessment(student.assessments);
  const status = getStudentStatus(student);

  return `
    <div class="student-card">
      <div class="student-name-row">
        <div class="student-name">${student.name}</div>
        <span class="status-tag ${status.cssClass}">${status.label}</span>
      </div>
      <div class="student-meta">
        <div class="meta-line"><span>Strongest area</span><strong>${strongest.label}</strong></div>
        <div class="meta-line"><span>Development area</span><strong>${weakest.label}</strong></div>
        <div class="meta-line"><span>Growth status</span><strong>${status.label}</strong></div>
      </div>
      <div style="margin-top: 16px;">
        <button class="small-btn" data-action="open-student" data-student-id="${student.id}">View Profile</button>
      </div>
    </div>
  `;
}

async function refreshAssistantHistory(role) {
  const isTeacher = role === "teacher";
  const loadingKey = isTeacher ? "teacherAiHistoryLoading" : "studentAiHistoryLoading";
  const errorKey = isTeacher ? "teacherAiHistoryError" : "studentAiHistoryError";
  const conversationsKey = isTeacher ? "teacherAiConversations" : "studentAiConversations";
  state.ui[loadingKey] = true;
  state.ui[errorKey] = "";
  renderApp();
  try {
    const result = isTeacher
      ? await requestTeacherAssistant({ action: "list" })
      : await requestStudentAssistant({ action: "list" }, state.ui.studentSessionToken);
    state.ui[conversationsKey] = result.conversations || [];
  } catch (error) {
    state.ui[errorKey] = error.message || "Unable to load conversation history.";
  } finally {
    state.ui[loadingKey] = false;
    renderApp();
  }
}

async function loadAssistantConversation(role, conversationId) {
  const isTeacher = role === "teacher";
  const prefix = isTeacher ? "teacherAi" : "studentAi";
  state.ui[`${prefix}Loading`] = true;
  state.ui[`${prefix}Error`] = "";
  renderApp();
  try {
    const result = isTeacher
      ? await requestTeacherAssistant({ action: "load", conversationId })
      : await requestStudentAssistant({ action: "load", conversationId }, state.ui.studentSessionToken);
    state.ui[`${prefix}ConversationId`] = result.conversation.id;
    state.ui[`${prefix}Messages`] = result.conversation.messages || [];
    state.ui[`${prefix}DataNotice`] = "";
    state.ui[`${prefix}RetryRequest`] = null;
  } catch (error) {
    state.ui[`${prefix}Error`] = error.message || "Unable to load this conversation.";
  } finally {
    state.ui[`${prefix}Loading`] = false;
    renderApp();
  }
}

async function sendTeacherAiMessage(request) {
  if (!request?.message || state.ui.teacherAiLoading) return;
  state.ui.teacherAiLoading = true;
  state.ui.teacherAiError = "";
  state.ui.teacherAiRetryRequest = request;
  state.ui.teacherAiDraft = request.message;
  renderApp();
  try {
    const result = await requestTeacherAssistant({
      action: "chat",
      conversationId: request.conversationId || null,
      classId: request.classId || null,
      studentIds: request.studentIds || [],
      message: request.message
    });
    state.ui.teacherAiConversationId = result.conversation.id;
    state.ui.teacherAiMessages = result.conversation.messages || [];
    state.ui.teacherAiDataNotice = result.dataNotice || "";
    state.ui.teacherAiSelectedStudents = result.selectedStudents || [];
    state.ui.teacherAiRetryRequest = null;
    state.ui.teacherAiDraft = "";
    const conversations = state.ui.teacherAiConversations || [];
    state.ui.teacherAiConversations = [
      result.conversation,
      ...conversations.filter((item) => item.id !== result.conversation.id)
    ].slice(0, 50);
  } catch (error) {
    state.ui.teacherAiError = error.message || "The teacher assistant could not answer. Please retry.";
  } finally {
    state.ui.teacherAiLoading = false;
    renderApp();
  }
}

async function sendStudentAiMessage(request) {
  if (!request?.message || state.ui.studentAiLoading) return;
  state.ui.studentAiLoading = true;
  state.ui.studentAiError = "";
  state.ui.studentAiRetryRequest = request;
  state.ui.studentAiDraft = request.message;
  renderAppPreservingScroll([
    ".student-content.student-workspace-main",
    ".assistant-message-list"
  ]);
  try {
    const result = await requestStudentAssistant({
      action: "chat",
      conversationId: request.conversationId || null,
      message: request.message
    }, state.ui.studentSessionToken);
    state.ui.studentAiConversationId = result.conversation.id;
    state.ui.studentAiMessages = result.conversation.messages || [];
    state.ui.studentAiRetryRequest = null;
    state.ui.studentAiDraft = "";
    const conversations = state.ui.studentAiConversations || [];
    state.ui.studentAiConversations = [
      result.conversation,
      ...conversations.filter((item) => item.id !== result.conversation.id)
    ].slice(0, 50);
  } catch (error) {
    state.ui.studentAiError = error.message || "The student assistant could not answer. Please retry.";
  } finally {
    state.ui.studentAiLoading = false;
    renderAppPreservingScroll([
      ".student-content.student-workspace-main",
      ".assistant-message-list"
    ]);
  }
}

function downloadAssistantReport(title, content) {
  if (!content) return;
  const safeTitle = String(title || "Mentora AI report").replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").slice(0, 80);
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  link.href = url;
  link.download = `${safeTitle || "mentora-ai-report"}.md`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function handleClick(event) {
  const target = event.target.closest("[data-action]");
  const viewTarget = event.target.closest("[data-view]");
  const routeTarget = event.target.closest("[data-route-screen]");
  if (event.target.closest('a[href="#student-performance"]')) {
    const historyDetails = document.getElementById("student-performance");
    if (historyDetails?.tagName === "DETAILS") historyDetails.open = true;
  }

  if (routeTarget) {
    event.preventDefault();
    const screen = routeTarget.dataset.routeScreen;
    if (screen === "class-selection") {
      state.activeClassId = null;
      state.students = [];
    }
    if (screen === "students") state.ui.searchQuery = "";
    await navigateToScreen(screen, {
      studentId: screen === "student-profile" ? state.ui.selectedStudentId : ""
    });
    if (screen === "teacher-ai" && state.teacher && state.activeClassId) await refreshAssistantHistory("teacher");
    if (screen === "student-ai" && state.ui.studentSessionToken) await refreshAssistantHistory("student");
    if (screen === "student-events") loadStudentEvents();
    return;
  }

  if (viewTarget) {
    const view = viewTarget.dataset.view;
    state.ui.nav = view;
    if (view === "students") {
      state.ui.searchQuery = "";
    }
    saveState();
    await navigateToScreen(view);
    return;
  }

  if (target) {
    const action = target.dataset.action;
    const studentId = target.dataset.studentId;
    if (action === "open-primary-learning") { await navigateToScreen("student-games"); return; }
    if (action === "open-secondary-learning") { await navigateToScreen("student-subjects"); return; }
    if (action === "open-anatomy-study") { await navigateToScreen("student-anatomy-study"); return; }
    if (action === "open-medical-case-simulator") { await navigateToScreen("student-medical-case-simulator"); return; }
    if (action === "open-coding-practice") {
      if (!state.ui.studentSessionToken || !getStudentByAnyId(state.ui.studentSessionId)) { state.ui.screen = "student-login"; renderApp(); return; }
      await navigateToScreen("student-coding-practice");
      return;
    }
    if (action === "coding-question") {
      const next = QUESTIONS.find(item => item.id === Number(target.dataset.id));
      if (!next) return;
      const oldQuestion = QUESTIONS[(Number(window.__codingQuestionId) || 1) - 1];
      if (window.__codingCode && window.__codingCode !== codingStarter(window.__codingLanguage || "JavaScript", oldQuestion) && !window.confirm("Replace your unsaved code with the starter template for this question?")) return;
      window.__codingQuestionId = next.id;
      window.__codingCode = codingStarter(window.__codingLanguage || "JavaScript", next);
      window.__codingResults = null;
      renderApp();
      return;
    }
    if (action === "coding-run") {
      if (window.__codingRunning) return;
      window.__codingCode = document.getElementById("coding-source")?.value || "";
      window.__codingRunning = true;
      window.__codingResults = null;
      renderApp();
      const q = QUESTIONS[(Number(window.__codingQuestionId) || 1) - 1];
      try {
        const response = await fetch("/.netlify/functions/coding-practice", { method:"POST", headers:{"content-type":"application/json", authorization:`Bearer ${state.ui.studentSessionToken}`}, body:JSON.stringify({ code:window.__codingCode, language:window.__codingLanguage, question:{title:q.title,statement:q.statement,input:q.input,output:q.output,requirement:q.requirement}, tests:q.tests }) });
        const responseText = await response.text();
        let data;
        try { data = JSON.parse(responseText); }
        catch {
          const routeHint = response.status === 404 || responseText.trimStart().startsWith("<!DOCTYPE") || responseText.trimStart().startsWith("<html")
            ? " The coding function route is missing; start the app with npm run dev:netlify instead of the Vite-only npm run dev command."
            : " The function returned an invalid response.";
          throw new Error(`Coding backend returned HTTP ${response.status}.${routeHint}`);
        }
        if (!response.ok) throw new Error(data.error || `Coding backend returned HTTP ${response.status}.`);
        window.__codingResults = data;
      } catch (error) {
        const isFetchFailure = error instanceof TypeError && /fetch|network/i.test(error.message || "");
        const message = isFetchFailure
          ? "Could not reach the Netlify coding function. Start Mentora with npm run dev:netlify; npm run dev starts Vite without the function backend."
          : error.message || "The coding backend could not complete the request.";
        window.__codingResults = { ok:false, status:isFetchFailure ? "Coding backend unreachable" : "Execution unavailable", tests:[{passed:false,error:message}], review:"AI review was not run because no genuine execution result was received." };
      } finally { window.__codingRunning = false; renderApp(); }
      return;
    }
    if (action === "games-subject") {
      state.ui.gamesSubject = target.dataset.subject || "Maths";
      state.ui.selectedGame = null;
      renderApp();
      return;
    }
    if (action === "games-play") {
      state.ui.selectedGame = target.dataset.game || "sky-block-jump";
      renderApp();
      return;
    }
    if (action === "games-back") {
      state.ui.selectedGame = null;
      renderApp();
      return;
    }
    if (action === "anatomy-select") {
      const organ = target.dataset.organ;
      if (!new Set(["heart", "brain", "lungs", "liver", "kidneys"]).has(organ)) return;
      window.__anatomyOrgan = organ;
      const name = document.getElementById("anatomy-organ-name");
      const functionText = document.getElementById("anatomy-organ-function");
      const detail = document.getElementById("anatomy-organ-detail");
      if (name) name.textContent = target.dataset.organName || "";
      if (functionText) functionText.textContent = target.dataset.organFunction || "";
      if (detail) detail.textContent = target.dataset.organDetail || "";
      document.querySelectorAll(".anatomy-organ-button").forEach((button) => {
        const active = button.dataset.organ === organ;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      return;
    }
    if (action === "anatomy-rotate") {
      window.__anatomyRotation = ((Number(window.__anatomyRotation) || 0) + 25) % 360;
      renderApp();
      return;
    }
    if (action === "anatomy-zoom") {
      window.__anatomyZoom = Math.max(0.8, Math.min(1.5, (Number(window.__anatomyZoom) || 1) + Number(target.dataset.delta || 0)));
      renderApp();
      return;
    }

    if (action === "open-teacher-ai") {
      if (!state.teacher) {
        state.ui.screen = "teacher-login";
        renderApp();
        return;
      }
      if (!state.activeClassId) {
        state.ui.screen = "class-selection";
        renderApp();
        return;
      }
      state.ui.teacherAiError = "";
      await navigateToScreen("teacher-ai");
      await refreshAssistantHistory("teacher");
      return;
    }
    if (action === "new-teacher-chat") {
      state.ui.teacherAiConversationId = null;
      state.ui.teacherAiMessages = [];
      state.ui.teacherAiDataNotice = "";
      state.ui.teacherAiError = "";
      state.ui.teacherAiRetryRequest = null;
      state.ui.teacherAiDraft = "";
      renderApp();
      return;
    }
    if (action === "load-teacher-chat") {
      await loadAssistantConversation("teacher", target.dataset.conversationId);
      return;
    }
    if (action === "refresh-teacher-chats") {
      await refreshAssistantHistory("teacher");
      return;
    }
    if (action === "retry-teacher-chat") {
      await sendTeacherAiMessage(state.ui.teacherAiRetryRequest);
      return;
    }
    if (action === "open-student-ai") {
      if (!state.ui.studentSessionToken || !getStudentByAnyId(state.ui.studentSessionId)) {
        state.ui.screen = "student-login";
        renderApp();
        return;
      }
      state.ui.studentAiError = "";
      await navigateToScreen("student-ai");
      await refreshAssistantHistory("student");
      return;
    }
    if (action === "new-student-chat") {
      state.ui.studentAiConversationId = null;
      state.ui.studentAiMessages = [];
      state.ui.studentAiError = "";
      state.ui.studentAiRetryRequest = null;
      state.ui.studentAiDraft = "";
      renderApp();
      return;
    }
    if (action === "load-student-chat") {
      await loadAssistantConversation("student", target.dataset.conversationId);
      return;
    }
    if (action === "refresh-student-chats") {
      await refreshAssistantHistory("student");
      return;
    }
    if (action === "retry-student-chat") {
      await sendStudentAiMessage(state.ui.studentAiRetryRequest);
      return;
    }
    if (action === "assistant-suggestion") {
      const form = document.getElementById(state.ui.screen === "teacher-ai" ? "teacher-ai-form" : "student-ai-form");
      const textarea = form?.elements.message;
      if (textarea) {
        textarea.value = target.dataset.suggestion || "";
        textarea.focus();
      }
      return;
    }
    if (action === "download-teacher-ai-report") {
      const messages = state.ui.teacherAiMessages || [];
      const content = [...messages].reverse().find((message) => message.role === "assistant")?.content;
      const title = (state.ui.teacherAiConversations || []).find((item) => item.id === state.ui.teacherAiConversationId)?.title;
      downloadAssistantReport(title || "Mentora teacher report", content);
      return;
    }
    if (action === "open-visualize-doubt") {
      if (!getStudentByAnyId(state.ui.studentSessionId)) {
        state.ui.screen = "student-login";
        renderApp();
        return;
      }
      state.ui.doubtError = "";
      await navigateToScreen("student-visualize");
      return;
    }
    if (action === "return-student-dashboard") {
      state.ui.selectedEventId = null;
      await navigateToScreen("student-dashboard");
      return;
    }
    if (action === "doubt-back-to-visual") {
      state.ui.doubtResult = state.ui.doubtVisualResult || state.ui.doubtResult;
      state.ui.doubtMode = "visual";
      renderApp();
      return;
    }
    if (action === "doubt-resume-quiz") {
      if (!state.ui.doubtQuiz) return;
      state.ui.doubtMode = state.ui.doubtQuiz.finished ? "quiz-results" : "quiz";
      renderApp();
      return;
    }
    if (action === "doubt-select-node") {
      state.ui.doubtSelectedNodeId = target.dataset.nodeId;
      state.ui.doubtNodeExplanation = "";
      state.ui.doubtNodeExample = "";
      state.ui.doubtNodeWhy = "";
      renderApp();
      scrollToDoubtInfoPanel();
      return;
    }
    if (action === "doubt-quiz-option") {
      const quiz = state.ui.doubtQuiz;
      const index = quiz?.index;
      const question = quiz?.questions?.[index];
      if (!question || quiz.answers[index]) return;
      const selectedIndex = Number(target.dataset.optionIndex);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= question.options.length) return;
      quiz.answers[index] = { selectedIndex, correct: selectedIndex === question.correctIndex };
      renderAppPreservingScroll([".student-content.student-workspace-main"]);
      return;
    }
    if (action === "doubt-quiz-next") {
      const quiz = state.ui.doubtQuiz;
      if (!quiz?.answers[quiz.index]) return;
      if (quiz.index === quiz.questions.length - 1) {
        quiz.finished = true;
        state.ui.doubtMode = "quiz-results";
      }
      else quiz.index += 1;
      renderAppPreservingScroll([".student-content.student-workspace-main"]);
      return;
    }
    if (action === "doubt-quiz-retry-question") {
      const quiz = state.ui.doubtQuiz;
      if (!quiz) return;
      delete quiz.answers[quiz.index];
      renderApp();
      return;
    }
    if (action === "doubt-quiz-retry-wrong") {
      const quiz = state.ui.doubtQuiz;
      if (!quiz) return;
      const missed = quiz.questions.filter((question, index) => !quiz.answers[index]?.correct);
      if (!missed.length) return;
      state.ui.doubtQuiz = { questions: missed, index: 0, answers: [], retryOnly: true, finished: false, simplifications: quiz.simplifications || {} };
      state.ui.doubtMode = "quiz";
      renderApp();
      return;
    }
    if (action === "doubt-review-concept") {
      const nodeId = target.dataset.nodeId;
      if (!state.ui.doubtVisualResult?.visual.nodes.some((node) => node.id === nodeId)) return;
      state.ui.doubtSelectedNodeId = nodeId;
      state.ui.doubtNodeExplanation = "";
      state.ui.doubtNodeExample = "";
      state.ui.doubtNodeWhy = "";
      state.ui.doubtMode = "visual";
      state.ui.doubtResult = state.ui.doubtVisualResult;
      renderApp();
      scrollToDoubtInfoPanel();
      return;
    }
    if (action === "doubt-simplify-concept") {
      state.ui.doubtSelectedNodeId = target.dataset.nodeId;
      await runDoubtRequest("simplify-node");
      return;
    }
    if (action === "doubt-explain-node") { await runDoubtRequest("explain-node"); return; }
    if (action === "doubt-regenerate") { await runDoubtRequest("regenerate"); return; }
    if (action === "doubt-simplify") { await runDoubtRequest("simplify"); return; }
    if (action === "doubt-detail") { await runDoubtRequest("detail"); return; }
    if (action === "doubt-example") { await runDoubtRequest("example"); return; }
    if (action === "doubt-beginner") { await runDoubtRequest("beginner"); return; }
    if (action === "doubt-flashcards") { await runDoubtRequest("flashcards"); return; }
    if (action === "doubt-quiz") { await runDoubtRequest("quiz"); return; }

    if (action === "open-student-events") {
      if (!getStudentByAnyId(state.ui.studentSessionId)) {
        state.ui.screen = "student-login";
        renderApp();
        return;
      }
      state.ui.selectedEventId = null;
      await navigateToScreen("student-events");
      loadStudentEvents();
      return;
    }
    if (action === "return-student-dashboard") {
      state.ui.selectedEventId = null;
      await navigateToScreen("student-dashboard");
      return;
    }
    if (action === "open-event") {
      state.ui.selectedEventId = target.dataset.eventId;
      renderApp();
      return;
    }
    if (action === "refresh-student-events") {
      if (!state.ui.studentSessionToken || !getStudentByAnyId(state.ui.studentSessionId)) {
        state.ui.screen = "student-login";
        renderApp();
        return;
      }
      if (state.ui.eventsRefreshing) return;
      state.ui.eventsRefreshing = true;
      state.ui.eventsRefreshMessage = "";
      renderApp();
      try {
        const result = await refreshStudentEventDiscovery(state.ui.studentSessionToken);
        state.ui.eventsRefreshMessage =
          `Refresh completed: ${result.discovered} saved events (${result.new} new, ${result.updated} updated, ${result.duplicatesRemoved} duplicates removed).`;
      } catch (error) {
        state.ui.eventsRefreshMessage = error.message || "Event discovery refresh failed.";
      } finally {
        state.ui.eventsRefreshing = false;
        if (state.ui.screen === "student-events") await loadStudentEvents();
        else renderApp();
      }
      return;
    }
    if (action === "close-event") {
      if (event.target === target || target.classList.contains("opportunity-detail-close")) {
        state.ui.selectedEventId = null;
        renderApp();
      }
      return;
    }
    if (action === "events-prev-month" || action === "events-next-month") {
      const month = state.ui.eventsMonth ? new Date(`${state.ui.eventsMonth}-01T12:00:00`) : new Date();
      month.setMonth(month.getMonth() + (action === "events-prev-month" ? -1 : 1));
      state.ui.eventsMonth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      renderApp();
      return;
    }
    if (action === "events-today") {
      const now = new Date();
      state.ui.eventsMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      renderApp();
      return;
    }
    if (action === "events-category") {
      state.ui.eventsCategory = target.dataset.category;
      renderApp();
      return;
    }

    if (action === "return-dashboard") {
      if (!state.teacher) { state.ui.screen = "teacher-login"; renderApp(); return; }
      await navigateToScreen("dashboard");
      return;
    }

    if (action === "create-class") {
      state.ui.teacherClassError = "";
      state.ui.activeModal = { type: "teacher-class-form" };
      renderApp();
      document.getElementById("teacher-class-name")?.focus();
      return;
    }

    if (action === "select-student-csv") {
      if (!state.teacher || !state.activeClassId) return;
      document.getElementById("student-csv-file")?.click();
      return;
    }

    if (action === "edit-class") {
      const classId = target.dataset.classId;
      if (!state.teacher || !state.classes.some((entry) => entry.id === classId)) return;
      state.ui.teacherClassError = "";
      state.ui.activeModal = { type: "teacher-class-form", classId };
      renderApp();
      document.getElementById("teacher-class-name")?.focus();
      return;
    }

    if (action === "delete-class") {
      const classId = target.dataset.classId;
      const record = state.classes.find((entry) => entry.id === classId);
      if (!state.teacher || !record) return;
      if (!window.confirm(`Remove ${formatClassLabel(record)} from My Classes? Student and assessment records will be preserved.`)) return;
      target.disabled = true;
      try {
        await deleteTeacherClass(classId);
        state.classes = await fetchClasses();
        state.ui.notification = `${formatClassLabel(record)} was removed from My Classes.`;
      } catch (error) {
        state.ui.notification = error.message || "Unable to remove this class.";
      }
      renderApp();
      return;
    }

    if (action === "open-study-plan") {
      state.ui.studyPlanFormOpen = true;
      state.ui.studyPlanError = "";
      state.ui.studyWizard = createStudyWizard(getStudentByAnyId(state.ui.studentSessionId));
      renderStudyPlanAppPreservingScroll();
      return;
    }
    if (action === "close-study-plan") {
      if (state.ui.studyPlanLoading) return;
      state.ui.studyPlanFormOpen = false;
      state.ui.studyPlanError = "";
      state.ui.studyWizard = null;
      renderStudyPlanAppPreservingScroll();
      return;
    }
    if (action === "another-study-plan") {
      state.ui.studyPlan = null;
      state.ui.studyPlanCompleted = [];
      state.ui.studyPlanError = "";
      state.ui.studyPlanFormOpen = true;
      state.ui.studyWizard = createStudyWizard(getStudentByAnyId(state.ui.studentSessionId));
      renderStudyPlanAppPreservingScroll();
      return;
    }
    if (action === "study-back") {
      if (state.ui.studyPlanLoading) return;
      state.ui.studyWizard.step = Math.max(2, state.ui.studyWizard.step - 1);
      state.ui.studyWizard.error = "";
      renderStudyPlanAppPreservingScroll();
      return;
    }
    if (action === "study-upload-fallback") {
      state.ui.studyWizard.useUploadFallback = true;
      state.ui.studyWizard.error = "";
      renderStudyPlanAppPreservingScroll();
      return;
    }
    if (action === "download-study-plan") {
      if (state.ui.studyPlan) downloadStudyPlan(state.ui.studyPlan);
      return;
    }

    if (action === "go-home") {
      clearDoubtState();
      state.ui.screen = "landing";
      state.ui.activeModal = null;
      state.ui.studentSessionId = null;
      state.ui.studentSessionToken = null;
      sessionStorage.removeItem("mentora_student_session");
      state.ui.studentCategory = null;
      sessionStorage.removeItem("mentora_student_category");
      window.history.replaceState({}, "", pathForScreen("landing"));
      saveState();
      renderApp();
      return;
    }

    if (action === "open-teacher-portal") {
      state.ui.screen = state.teacher ? "class-selection" : "teacher-login";
      window.history.pushState({}, "", pathForScreen(state.ui.screen));
      state.ui.teacherAuthError = "";
      renderApp();
      return;
    }

    if (action === "open-my-classes") {
      if (!state.teacher) { state.ui.screen = "teacher-login"; renderApp(); return; }
      try { state.classes = await fetchClasses(); }
      catch (error) { state.ui.notification = error.message || "Unable to load your classes."; renderApp(); return; }
      state.activeClassId = null;
      state.students = [];
      state.ui.activeModal = null;
      saveState();
      await navigateToScreen("class-selection");
      return;
    }

    if (action === "open-teacher-signup") {
      state.ui.teacherAuthError = "";
      state.ui.screen = "teacher-signup";
      window.history.pushState({}, "", pathForScreen("teacher-signup"));
      renderApp();
      return;
    }

    if (action === "teacher-login-back") {
      state.ui.teacherAuthError = "";
      state.ui.screen = "teacher-login";
      window.history.pushState({}, "", pathForScreen("teacher-login"));
      renderApp();
      return;
    }

    if (action === "enter-assigned-class") {
      const classId = target.dataset.classId;
      if (!state.teacher || !state.classes.some((classRecord) => classRecord.id === classId)) {
        state.ui.notification = "That class is not assigned to this teacher account.";
        state.ui.screen = "class-selection";
        renderApp();
        return;
      }
      try {
        state.students = await fetchClassStudents(classId);
      } catch (error) {
        showPersistenceError(error, "Unable to load this assigned class");
        return;
      }
      state.activeClassId = classId;
      state.ui.screen = "dashboard";
      state.ui.nav = "dashboard";
      state.ui.selectedStudentId = null;
      state.ui.notification = null;
      saveState();
      await navigateToScreen("dashboard");
      return;
    }

    if (action === "teacher-logout") {
      try { await logoutTeacher(); }
      catch (error) { console.error("Teacher logout error:", error); }
      state.teacher = null;
      state.classes = [];
      state.students = [];
      state.activeClassId = null;
      state.ui.screen = "teacher-login";
      state.ui.nav = "dashboard";
      state.ui.activeModal = null;
      state.ui.selectedStudentId = null;
      state.ui.notification = null;
      window.history.replaceState({}, "", pathForScreen("teacher-login"));
      renderApp();
      return;
    }

    if (action === "open-student-portal") {
      const hasStudentSession = state.ui.studentSessionId && state.ui.studentSessionToken && getStudentByAnyId(state.ui.studentSessionId);
      state.ui.screen = hasStudentSession && isStudentCategory(state.ui.studentCategory) ? "student-dashboard" : "student-category-selection";
      state.ui.activeModal = null;
      saveState();
      await navigateToScreen(state.ui.screen);
      return;
    }

    if (action === "select-student-category") {
      const category = target.dataset.category;
      if (!isStudentCategory(category)) return;
      state.ui.studentCategory = category;
      renderApp();
      return;
    }
    if (action === "continue-student-category") {
      if (!isStudentCategory(state.ui.studentCategory)) return;
      sessionStorage.setItem("mentora_student_category", state.ui.studentCategory);
      saveState();
      await navigateToScreen("student-login");
      return;
    }
    if (action === "back-to-student-categories") {
      await navigateToScreen("student-category-selection");
      return;
    }

    if (action === "student-logout") {
      state.ui.studentSessionId = null;
      state.ui.studentSessionToken = null;
      state.ui.studentMustChangePassword = false;
      state.ui.studentCategory = null;
      sessionStorage.removeItem("mentora_student_session");
      sessionStorage.removeItem("mentora_student_category");
      clearDoubtState();
      state.ui.screen = "student-category-selection";
      window.history.replaceState({}, "", pathForScreen("student-category-selection"));
      saveState();
      renderApp();
      return;
    }

    if (action === "copy-student-id") {
      const student = getStudentById(studentId);
      if (student) {
        navigator.clipboard?.writeText(student.studentId).then(() => {
          state.ui.notification = "Student ID copied.";
          renderApp();
          window.setTimeout(() => { state.ui.notification = null; renderApp(); }, 2200);
        });
      }
      return;
    }

    if (action === "reset-student-password") {
      const student = state.ui.screen === "student-profile" &&
        state.ui.selectedStudentId === studentId &&
        state.students.some((entry) => entry.id === studentId)
        ? getSelectedStudent()
        : null;
      if (!state.teacher || !student) return;
      if (!window.confirm(`Generate a temporary password for ${student.name}? Their current password will stop working, and they must choose a new password at next sign-in.`)) return;
      state.ui.studentPasswordResetLoading = true;
      state.ui.studentPasswordResetError = "";
      generatedStudentCredentials = null;
      renderApp();
      try {
        const credential = await provisionStudentPassword(student);
        generatedStudentCredentials = {
          screen: "student-profile",
          studentRecordId: student.id,
          entries: [credential]
        };
      } catch (error) {
        state.ui.studentPasswordResetError = error.message || "Unable to reset the student password.";
      } finally {
        state.ui.studentPasswordResetLoading = false;
        renderApp();
      }
      return;
    }
    if (action === "copy-student-temporary-password") {
      const credential = generatedStudentCredentials?.entries?.find((entry) => entry.studentRecordId === studentId);
      if (!credential?.password) return;
      try {
        await navigator.clipboard.writeText(credential.password);
        state.ui.notification = "Temporary password copied. Share it with the student securely.";
      } catch {
        state.ui.studentPasswordResetError = "Clipboard access is unavailable. Select and copy the displayed password manually.";
      }
      renderApp();
      return;
    }
    if (action === "dismiss-student-temporary-password") {
      generatedStudentCredentials = null;
      renderApp();
      return;
    }

    if (action === "download-teacher-report" || action === "download-student-report") {
      const student = action === "download-student-report" ? getStudentByAnyId(studentId) : getStudentById(studentId);
      if (student) downloadStudentReport(student, action === "download-student-report");
      return;
    }

    if (action === "enter-dashboard") {
      state.ui.screen = state.teacher ? "class-selection" : "teacher-login";
      window.history.pushState({}, "", pathForScreen(state.ui.screen));
      renderApp();
      return;
    }

    if (action === "create-first-class") {
      state.ui.screen = "class-selection";
      window.history.pushState({}, "", pathForScreen(state.ui.screen));
      renderApp();
      return;
    }

    if (action === "open-class-selector") {
      if (!state.teacher) { state.ui.screen = "teacher-login"; renderApp(); return; }
      state.ui.activeModal = { type: "class-selector" };
      renderApp();
      return;
    }

    if (action === "switch-class") {
      const form = document.getElementById("class-switch-form");
      const classId = form?.elements.classId.value;
      if (classId && state.classes.some((classRecord) => classRecord.id === classId)) {
        let students;
        try {
          students = await fetchClassStudents(classId);
        } catch (error) {
          showPersistenceError(error, "Unable to load students for this class");
          return;
        }
        state.activeClassId = classId;
        state.students = students;
        state.ui.activeModal = null;
        state.ui.selectedStudentId = null;
        state.ui.searchQuery = "";
        saveState();
        await navigateToScreen("dashboard");
      }
      return;
    }

    if (action === "open-student") {
      try {
        const student = await fetchStudentProfile(studentId);
        const existingIndex = state.students.findIndex((entry) => entry.id === studentId);
        if (existingIndex >= 0) state.students[existingIndex] = student;
        else state.students.push(student);
      } catch (error) {
        showPersistenceError(error, "Unable to load student profile");
        return;
      }
      state.ui.selectedStudentId = studentId;
      saveState();
      await navigateToScreen("student-profile", { studentId });
      return;
    }

    if (action === "add-subject-mark") {
      state.ui.markFormError = "";
      state.ui.activeModal = { type: "subject-mark-mode", studentId };
      renderApp();
      return;
    }
    if (action === "select-subject-entry-mode") {
      const entryMode = target.dataset.entryMode;
      if (!["marks", "grades"].includes(entryMode)) return;
      state.ui.markFormError = "";
      state.ui.activeModal = { type: "subject-mark", studentId: state.ui.activeModal?.studentId, entryMode };
      renderApp();
      return;
    }
    if (action === "edit-subject-mark") {
      state.ui.activeModal = { type: "subject-mark", studentId, markId: target.dataset.markId || null };
      renderApp();
      return;
    }
    if (action === "add-mark-row") {
      const form = target.closest("form");
      if (!form) return;
      const index = Number(form.dataset.nextRow || 1);
      form.insertAdjacentHTML("beforeend", renderMarkEntryRow(index, "", "", "", "", "", form.dataset.entryMode || "marks"));
      form.dataset.nextRow = String(index + 1);
      return;
    }
    if (action === "add-student-mark-row") {
      const form = target.closest("form");
      const list = form?.querySelector(".student-mark-entry-list");
      if (!form || !list) return;
      const index = Number(form.dataset.nextStudentMarkRow || 0);
      const subjects = [...new Set([...list.querySelectorAll('[name="markSubject[]"]')].map((input) => input.value.trim()).filter(Boolean))];
      list.insertAdjacentHTML("beforeend", renderStudentMarkRow(index, null, subjects));
      form.dataset.nextStudentMarkRow = String(index + 1);
      return;
    }

    if (action === "open-add-student") {
      state.ui.activeModal = {
        type: "add-student",
        studentId: null
      };
      saveState();
      renderApp();
      return;
    }

    if (action === "open-edit-student") {
      state.ui.activeModal = { type: "edit-student", studentId };
      saveState();
      renderApp();
      return;
    }

    if (action === "edit-student") {
      state.ui.activeModal = { type: "edit-student", studentId };
      saveState();
      renderApp();
      return;
    }

    if (action === "close-modal") {
      if (state.ui.subjectMarksSaving) return;
      state.ui.activeModal = null;
      saveState();
      await navigateToScreen("students");
      return;
    }

    if (action === "delete-student") {
      const student = getStudentById(studentId);
      if (student && confirm(`Delete ${student.name}?`)) {
        try {
          await deleteStudentRecord(studentId);
        } catch (error) {
          showPersistenceError(error, "Unable to delete student");
          return;
        }
        state.students = state.students.filter((entry) => entry.id !== studentId);
        state.ui.screen = "students";
        state.ui.nav = "students";
        state.ui.activeModal = null;
        saveState();
        renderApp();
      }
      return;
    }

    if (action === "delete-observation") {
      const student = getStudentById(studentId);
      const observationId = target.dataset.observationId;
      if (student && observationId && confirm("Delete this observation?")) {
        const updatedStudent = structuredClone(student);
        updatedStudent.observations = updatedStudent.observations.filter((observation) => observation.id !== observationId);
        updatedStudent.lastUpdated = new Date().toISOString();
        updatedStudent.updatedAt = updatedStudent.lastUpdated;
        try {
          await deleteObservation(observationId);
          await saveStudentRecord(updatedStudent);
        } catch (error) {
          showPersistenceError(error, "Unable to delete observation");
          return;
        }
        Object.assign(student, updatedStudent);
        saveState();
        renderApp();
      }
      return;
    }

    if (action === "add-observation") {
      state.ui.activeModal = { type: "add-observation", studentId };
      saveState();
      renderApp();
      return;
    }

    if (action === "answer-follow-up") {
      const student = getStudentById(studentId);
      const analysis = state.ui.analysisByStudent?.[studentId];
      state.ui.activeModal = {
        type: "followup",
        studentId,
        message: analysis?.followUpQuestion?.message || "We don't have enough information about how this student behaves during group work.",
        question: analysis?.followUpQuestion?.question || "How does this student usually contribute during group projects?"
      };
      saveState();
      renderApp();
      return;
    }

    if (action === "start-intervention") {
      const student = getStudentById(studentId);
      const analysis = state.ui.analysisByStudent?.[studentId];
      const actionId = target.dataset.actionId;
      const recommended = analysis?.recommendedActions?.find((entry) => entry.id === actionId);
      if (recommended) {
        const updatedStudent = structuredClone(student);
        const progressEvent = {
          id: generateId("prog"),
          type: "intervention_started",
          date: new Date().toISOString(),
          note: `Intervention started: ${recommended.action}`
        };
        updatedStudent.progress.push(progressEvent);
        updatedStudent.lastUpdated = new Date().toISOString();
        updatedStudent.updatedAt = updatedStudent.lastUpdated;
        try {
          await saveStudentRecord(updatedStudent);
        } catch (error) {
          showPersistenceError(error, "Unable to save intervention progress");
          return;
        }
        Object.assign(student, updatedStudent);
        recommended.started = true;
        recommended.completed = false;
        saveState();
        renderApp();
      }
      return;
    }

    if (action === "complete-intervention") {
      const student = getStudentById(studentId);
      const analysis = state.ui.analysisByStudent?.[studentId];
      const actionId = target.dataset.actionId;
      const recommended = analysis?.recommendedActions?.find((entry) => entry.id === actionId);
      if (recommended) {
        const updatedStudent = structuredClone(student);
        const progressEvent = {
          id: generateId("prog"),
          type: "intervention_completed",
          date: new Date().toISOString(),
          note: `Intervention completed: ${recommended.action}`
        };
        updatedStudent.progress.push(progressEvent);
        updatedStudent.lastUpdated = new Date().toISOString();
        updatedStudent.updatedAt = updatedStudent.lastUpdated;
        try {
          await saveStudentRecord(updatedStudent);
        } catch (error) {
          showPersistenceError(error, "Unable to save intervention progress");
          return;
        }
        Object.assign(student, updatedStudent);
        recommended.completed = true;
        recommended.started = true;
        saveState();
        renderApp();
      }
      return;
    }

    if (action === "analyze-student") {
      runStudentAnalysis(studentId);
      return;
    }

  }

  if (event.target.dataset.closeModal === "true") {
    if (state.ui.subjectMarksSaving) return;
    state.ui.activeModal = null;
    saveState();
    renderApp();
  }
}

function renderTemporaryStudentCredentials(screen, studentRecordId = "") {
  const credentialSet = generatedStudentCredentials;
  if (!credentialSet || credentialSet.screen !== screen ||
      (screen === "student-profile" && credentialSet.studentRecordId !== studentRecordId)) return "";
  const entries = credentialSet.entries || [];
  if (!entries.length) return "";
  return entries.map((entry) => `
    <div class="list-card student-password-reset-result" role="status">
      <div><strong>Temporary password for ${escapeHtml(entry.studentName)}</strong><p>Student ID: ${escapeHtml(entry.studentCode)}. Share these credentials through a secure channel. The password disappears when you leave this page or refresh, and must be changed at next sign-in.</p></div>
      <code>${escapeHtml(entry.password)}</code>
      <div class="student-password-reset-actions">
        <button class="btn-secondary" data-action="copy-student-temporary-password" data-student-id="${escapeHtml(entry.studentRecordId)}">Copy Password</button>
        ${entries.length === 1 ? `<button class="btn-ghost" data-action="dismiss-student-temporary-password">Dismiss</button>` : ""}
      </div>
    </div>
  `).join("");
}

async function provisionStudentPassword(student) {
  const result = await resetStudentPassword(student.id);
  if (result.studentId !== student.studentId || !result.temporaryPassword || !result.passwordChangeRequired) {
    throw new Error("The password service returned an invalid temporary-password result.");
  }
  return {
    studentRecordId: student.id,
    studentName: student.name,
    studentCode: student.studentId,
    password: result.temporaryPassword
  };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("The CSV has an unmatched quote. Please fix the file and retry.");
  row.push(cell.trim());
  if (row.some((value) => value)) rows.push(row);
  return rows;
}

async function importStudentsCsv(file) {
  if (!state.teacher || !state.activeClassId) return;
  if (file.size > 2 * 1024 * 1024) { state.ui.notification = "Choose a CSV file smaller than 2 MB."; renderApp(); return; }
  generatedStudentCredentials = null;
  let importClassId = state.activeClassId;
  let wroteStudents = false;
  let imported = 0;
  const temporaryCredentials = [];
  try {
    const rows = parseCsvRows(await file.text());
    if (rows.length < 2) throw new Error("The CSV needs a header row and at least one student row.");
    const header = rows[0].map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const nameIndex = header.findIndex((value) => ["name", "studentname"].includes(value));
    const rollIndex = header.findIndex((value) => ["roll", "rollnumber", "studentrollnumber"].includes(value));
    if (nameIndex < 0 || rollIndex < 0) throw new Error("Add CSV headers for Name and Roll Number (for example: name,roll_number).");
    const parsed = rows.slice(1).map((values, index) => ({ row: index + 2, name: values[nameIndex]?.trim(), rollNumber: values[rollIndex]?.trim() }));
    const invalidRow = parsed.find((entry) => !entry.name || !entry.rollNumber);
    if (invalidRow) throw new Error(`CSV row ${invalidRow.row} needs both a name and a roll number.`);
    const duplicateRolls = new Set();
    for (const student of parsed) {
      const normalizedRoll = student.rollNumber.toLowerCase();
      if (duplicateRolls.has(normalizedRoll)) throw new Error(`The CSV contains duplicate roll number ${student.rollNumber}.`);
      duplicateRolls.add(normalizedRoll);
    }

    const classRecord = state.classes.find((entry) => entry.id === state.activeClassId);
    if (!classRecord) throw new Error("Select a class and retry the import.");
    for (const entry of parsed) {
      const student = {
        id: generateStudentRecordId(), studentId: await createUniqueStudentCode(), name: entry.name,
        rollNumber: entry.rollNumber, classId: classRecord.id, className: formatClassLabel(classRecord),
        section: classRecord.section, strongSubjects: [], weakSubjects: [], learningHabits: [],
        assessments: {},
        observations: [], interventions: [], progress: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      try { await insertStudentRecord(student, { skipAssessment: true }); wroteStudents = true; }
      catch (error) { throw new Error(`Imported ${imported} of ${parsed.length} students. Row ${entry.row} (${entry.name}) failed: ${error.message}`); }
      imported += 1;
      try {
        temporaryCredentials.push(await provisionStudentPassword(student));
        generatedStudentCredentials = { screen: "students", entries: [...temporaryCredentials] };
      } catch (error) {
        throw new Error(`Imported ${imported} of ${parsed.length} students. Row ${entry.row} (${entry.name}) was saved, but password setup failed: ${error.message} Use Reset Student Password from the student's profile to retry.`);
      }
    }
    state.students = await fetchClassStudents(classRecord.id);
    state.ui.notification = `Imported ${imported} student${imported === 1 ? "" : "s"} into ${formatClassLabel(classRecord)}.`;
  } catch (error) {
    if (wroteStudents && importClassId) {
      try { state.students = await fetchClassStudents(importClassId); }
      catch (refreshError) { console.error("Unable to refresh students after a partial CSV import:", refreshError); }
    }
    state.ui.notification = error.message || "Unable to import this CSV.";
  }
  renderApp();
}

function handleInput(event) {
  if (event.target.id === "coding-source") {
    window.__codingCode = event.target.value;
    const lines = document.querySelector(".coding-lines");
    if (lines) lines.innerHTML = event.target.value.split("\n").map((_, i) => `<span>${i + 1}</span>`).join("");
  }
  if (event.target.matches('[name="grade[]"]')) {
    const display = event.target.closest(".mark-entry-row")?.querySelector(".selected-grade");
    if (display) display.textContent = event.target.value || "Choose a grade";
  }
  if (event.target.matches("[data-student-mark-value]")) {
    const row = event.target.closest(".student-mark-entry");
    const obtained = Number(row?.querySelector('[name="markObtained[]"]')?.value);
    const maximum = Number(row?.querySelector('[name="markMax[]"]')?.value);
    const output = row?.querySelector(".student-mark-percentage");
    if (output) output.textContent = Number.isFinite(obtained) && Number.isFinite(maximum) && maximum > 0 && obtained >= 0 ? `${(obtained / maximum * 100).toFixed(1)}%` : "—";
  }
  if (event.target.matches("[data-mark-value]")) {
    const row = event.target.closest(".mark-entry-row");
    const obtained = Number(row?.querySelector('[name="obtainedMarks[]"]')?.value);
    const maximum = Number(row?.querySelector('[name="maxMarks[]"]')?.value);
    const output = row?.querySelector("[data-mark-percent]");
    if (output) output.textContent = Number.isFinite(obtained) && Number.isFinite(maximum) && maximum > 0 && obtained >= 0 ? `${(obtained / maximum * 100).toFixed(1)}%` : "—";
  }
  if (event.target.matches("[data-mark-filter]")) {
    state.ui.markFilters = state.ui.markFilters || {};
    state.ui.markFilters[event.target.dataset.markFilter] = event.target.value;
    renderApp();
    return;
  }
  if (event.target.name === "difficulty" && event.target.form?.id === "study-plan-generate-form") {
    state.ui.studyWizard.difficulty = event.target.value;
    renderStudyPlanAppPreservingScroll();
    return;
  }
  if (event.target.id === "study-subject" && event.target.form?.id === "study-selection-form") {
    state.ui.studyWizard.subjectIndex = event.target.value;
    state.ui.studyWizard.sectionIndex = "";
    state.ui.studyWizard.error = "";
    renderStudyPlanAppPreservingScroll();
    return;
  }
  if (event.target.id === "study-section" && event.target.form?.id === "study-selection-form") {
    state.ui.studyWizard.sectionIndex = event.target.value;
    state.ui.studyWizard.error = "";
    renderStudyPlanAppPreservingScroll();
    return;
  }
  if (event.target.matches("[data-study-day]")) {
    const day = Number(event.target.dataset.studyDay);
    const completed = new Set(state.ui.studyPlanCompleted || []);
    if (event.target.checked) completed.add(day); else completed.delete(day);
    state.ui.studyPlanCompleted = [...completed].sort((a, b) => a - b);
    renderStudyPlanAppPreservingScroll();
    return;
  }
  if (event.target.form?.id === "class-setup-form" || event.target.form?.id === "new-class-form") {
    const form = event.target.form;
    const classField = form.querySelector(".custom-class-field");
    const sectionField = form.querySelector(".custom-section-field");
    if (classField) {
      classField.hidden = form.elements.className?.value !== "custom" && form.elements.className?.value !== "";
    }
    if (sectionField) {
      sectionField.hidden = form.elements.section?.value !== "custom" && form.elements.section?.value !== "";
    }
    return;
  }

  const studentSearch = event.target.dataset.input;
  if (studentSearch === "student-search") {
    state.ui.searchQuery = event.target.value;
    saveState();
    renderApp();
    return;
  }

  const sliderInput = event.target.dataset.sliderInput;
  if (sliderInput) {
    const valueDisplay = document.querySelector(`[data-slider-value="${sliderInput}"]`);
    if (valueDisplay) {
      valueDisplay.textContent = event.target.value;
    }
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  if (event.target.id === "teacher-ai-form") {
    if (!state.teacher) {
      state.ui.screen = "teacher-login";
      renderApp();
      return;
    }
    const values = new FormData(event.target);
    const message = String(values.get("message") || "").trim();
    if (!message) return;
    await sendTeacherAiMessage({
      message,
      classId: state.activeClassId,
      studentIds: values.getAll("studentIds").map(String),
      conversationId: state.ui.teacherAiConversationId || null
    });
    return;
  }

  if (event.target.id === "student-ai-form") {
    if (!state.ui.studentSessionToken || !getStudentByAnyId(state.ui.studentSessionId)) {
      state.ui.screen = "student-login";
      renderApp();
      return;
    }
    const values = new FormData(event.target);
    const message = String(values.get("message") || "").trim();
    if (!message) return;
    await sendStudentAiMessage({
      message,
      conversationId: state.ui.studentAiConversationId || null
    });
    return;
  }

  if (event.target.id === "visualize-doubt-form") {
    const values = new FormData(event.target);
    state.ui.doubtTopic = String(values.get("topic") || "").trim();
    state.ui.doubtSubject = String(values.get("subject") || "");
    state.ui.doubtLevel = String(values.get("level") || "High school");
    state.ui.doubtClassLevel = String(values.get("classLevel") || "").trim();
    state.ui.doubtEvaluation = null;
    state.ui.doubtAnswer = "";
    state.ui.doubtResult = null;
    state.ui.doubtVisualResult = null;
    await runDoubtRequest("visualize");
    return;
  }

  if (event.target.id === "teacher-class-form") {
    if (!state.teacher) { state.ui.activeModal = null; state.ui.screen = "teacher-login"; renderApp(); return; }
    const values = new FormData(event.target);
    const classRecord = {
      classId: event.target.dataset.classId || undefined,
      name: String(values.get("name") || "").trim(),
      course: String(values.get("course") || "").trim(),
      section: String(values.get("section") || "").trim(),
      academicYear: String(values.get("academicYear") || "").trim()
    };
    state.ui.teacherClassError = "";
    if (!classRecord.name || !classRecord.course || !classRecord.section) { event.target.reportValidity(); return; }
    const button = event.target.querySelector('[type="submit"]');
    if (button) { button.disabled = true; button.textContent = "Saving…"; }
    try {
      const updated = event.target.dataset.mode === "edit"
        ? await updateTeacherClass(classRecord)
        : await createTeacherClass(classRecord);
      state.classes = await fetchClasses();
      state.ui.activeModal = null;
      state.ui.notification = `Class ${updated.name} — Section ${updated.section} saved.`;
    } catch (error) {
      state.ui.teacherClassError = error.message || "Unable to save this class. Please retry.";
    }
    renderApp();
    return;
  }

  if (event.target.id === "teacher-login-form") {
    const values = new FormData(event.target);
    state.ui.teacherAuthError = "";
    const username = String(values.get("username") || "").trim();
    const password = String(values.get("password") || "");
    if (!username || !password) { state.ui.teacherAuthError = "Enter your username and password."; renderApp(); return; }
    const button = event.target.querySelector('[type="submit"]');
    if (button) { button.disabled = true; button.textContent = "Signing in…"; }
    try {
      state.teacher = await loginTeacher(username, password);
      state.classes = await fetchClasses();
      state.students = [];
      state.activeClassId = null;
      state.ui.notification = null;
      const route = resolvePortalRoute(window.location.pathname);
      if (route && ["class-selection", "dashboard", "students", "insights", "teacher-ai", "student-profile"].includes(route.screen)) {
        await handleLocationChange({ initial: true });
      } else {
        await navigateToScreen("class-selection", { replace: true });
      }
    } catch (error) {
      state.teacher = null;
      state.classes = [];
      state.ui.teacherAuthError = error.message || "Unable to sign in. Please try again.";
    }
    if (!state.teacher) renderApp();
    return;
  }

  if (event.target.id === "teacher-signup-form") {
    const values = new FormData(event.target);
    state.ui.teacherAuthError = "";
    const displayName = String(values.get("displayName") || "").trim();
    const username = String(values.get("username") || "").trim();
    const password = String(values.get("password") || "");
    if (displayName.length < 2 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/.test(username) || password.length < 12) {
      state.ui.teacherAuthError = "Enter your name, a valid 3–32 character username, and a password of at least 12 characters.";
      renderApp(); return;
    }
    const button = event.target.querySelector('[type="submit"]');
    if (button) { button.disabled = true; button.textContent = "Creating account…"; }
    try {
      const result = await createTeacherAccount({ displayName, username, password });
      state.ui.teacherAuthError = "";
      state.ui.notification = result.message || "Account created. You can log in now.";
      state.ui.screen = "teacher-login";
      window.history.replaceState({}, "", pathForScreen("teacher-login"));
    } catch (error) {
      state.ui.teacherAuthError = error.message || "Unable to create this account. Please retry.";
    }
    renderApp();
    return;
  }

  if (event.target.id === "study-source-form") {
    if (state.ui.studyPlanLoading) return;
    const form = event.target;
    const text = String(form.elements.syllabusText.value || "").trim();
    const file = form.elements.syllabusPdf.files?.[0];
    const wizard = state.ui.studyWizard;
    if (text && file) { wizard.error = "Choose either a PDF or pasted text, not both."; renderStudyPlanAppPreservingScroll(); return; }
    if (!text && !file) { wizard.error = "Upload the syllabus PDF or paste the subject and module/chapter outline."; renderStudyPlanAppPreservingScroll(); return; }
    if (file && (file.size > 3 * 1024 * 1024 || (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf"))) { wizard.error = "Choose a valid PDF file smaller than 3 MB."; renderStudyPlanAppPreservingScroll(); return; }
    state.ui.studyPlanLoading = true;
    wizard.error = "";
    renderStudyPlanAppPreservingScroll();
    try {
      let pdfBase64 = "";
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("The selected file is not a readable PDF.");
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        pdfBase64 = btoa(binary);
      }
      const response = await fetch("/.netlify/functions/extract-syllabus", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text || undefined, pdfBase64: pdfBase64 || undefined, course: wizard.education.course, semester: wizard.education.semester, university: wizard.education.universityBoard, scheme: wizard.education.scheme })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to read this syllabus. Try a clearer source.");
      wizard.subjects = result.syllabus.subjects;
      wizard.syllabusRecord = { sourceTitle: file?.name || result.syllabus.sourceTitle || "Student-provided syllabus", sourceUrl: "" };
      wizard.sourceTitle = wizard.syllabusRecord.sourceTitle;
      wizard.verified = false;
      wizard.subjectIndex = "";
      wizard.sectionIndex = "";
      wizard.lookupError = "";
      wizard.useUploadFallback = false;
    } catch (error) {
      wizard.error = error.message || "Unable to read this syllabus. Please retry.";
      wizard.useUploadFallback = true;
    } finally {
      state.ui.studyPlanLoading = false;
      renderStudyPlanAppPreservingScroll();
    }
    return;
  }

  if (event.target.id === "study-selection-form") {
    const values = new FormData(event.target);
    const subjectIndex = String(values.get("subjectIndex") || "");
    const sectionIndex = String(values.get("sectionIndex") || "");
    const wizard = state.ui.studyWizard;
    const subject = wizard.subjects?.[Number(subjectIndex)];
    if (!subject || (sectionIndex !== "all" && !subject.sections[Number(sectionIndex)])) {
      wizard.error = "Select a subject and one module or chapter from this syllabus.";
      renderStudyPlanAppPreservingScroll(); return;
    }
    const sections = sectionIndex === "all" ? subject.sections : [subject.sections[Number(sectionIndex)]];
    wizard.selectedSubject = subject;
    wizard.selectedSection = sectionIndex === "all"
      ? { name: "Entire subject", topics: sections.flatMap((part) => part.topics.map((topic) => `${part.name}: ${topic}`)) }
      : sections[0];
    wizard.selectedSection.source = `${wizard.sourceTitle}${subject.sourceUrl ? ` - ${subject.sourceUrl}` : wizard.syllabusRecord?.sourceUrl ? ` - ${wizard.syllabusRecord.sourceUrl}` : " (student-provided)"}`;
    wizard.selectedSection.verified = wizard.verified === true;
    wizard.step = 3;
    wizard.difficulty = "";
    wizard.error = "";
    renderStudyPlanAppPreservingScroll();
    return;
  }

  if (event.target.id === "study-plan-generate-form") {
    if (state.ui.studyPlanLoading) return;
    const wizard = state.ui.studyWizard;
    wizard.difficulty = String(new FormData(event.target).get("difficulty") || "");
    if (!wizard.difficulty) { wizard.error = "Choose a difficulty level."; renderStudyPlanAppPreservingScroll(); return; }
    const student = getStudentByAnyId(state.ui.studentSessionId) || {};
    state.ui.studyPlanLoading = true;
    wizard.error = "";
    renderStudyPlanAppPreservingScroll();
    try {
      const response = await fetch("/.netlify/functions/generate-study-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: wizard.selectedSubject.name, code: wizard.selectedSubject.code, section: wizard.selectedSection, difficulty: wizard.difficulty, education: wizard.education, student: { subjectMarkInsights: getSubjectMarkInsights(student), subjectMarks: student.subjectMarks || [], learningHabits: student.learningHabits || [], assessments: student.assessments || {} } })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to generate the plan. Please retry.");
      if (!result?.plan || result.plan.days?.length !== 7 || !Array.isArray(result.plan.topicCoverage) || !Array.isArray(result.plan.finalPracticeTest)) throw new Error("The service returned an incomplete syllabus-based plan. Please retry.");
      state.ui.studyPlan = result.plan;
      state.ui.studyPlanCompleted = [];
      state.ui.studyPlanFormOpen = false;
      state.ui.studyWizard = null;
    } catch (error) {
      wizard.error = error.message || "Unable to generate the plan. Check your connection and try again.";
    } finally {
      state.ui.studyPlanLoading = false;
      renderStudyPlanAppPreservingScroll();
    }
    return;
  }
  if (event.target.id === "student-login-form") {
    const formData = new FormData(event.target);
    const selectedCategory = String(formData.get("studentCategory") || "");
    if (!isStudentCategory(selectedCategory) || selectedCategory !== sessionStorage.getItem("mentora_student_category")) {
      const categoryError = document.getElementById("student-login-error");
      if (categoryError) {
        categoryError.textContent = "Choose a valid student category before signing in.";
        categoryError.hidden = false;
      }
      return;
    }
    const studentId = String(formData.get("studentId") || "").trim().toUpperCase();
    let loginResult;
    try {
      loginResult = await findStudentByCode(studentId, String(formData.get("password") || ""), selectedCategory);
    } catch (error) {
      const errorElement = document.getElementById("student-login-error");
      if (errorElement) {
        errorElement.textContent = error.message || "Unable to sign in. Please try again.";
        errorElement.hidden = false;
      }
      return;
    }
    if (!loginResult) {
      const error = document.getElementById("student-login-error");
      if (error) error.hidden = false;
      return;
    }
    const { student, sessionToken, mustChangePassword } = loginResult;
    if (!sessionToken) {
      showPersistenceError(new Error("The student login service did not establish a secure session."), "Unable to sign in");
      return;
    }
    sessionStorage.setItem("mentora_student_session", sessionToken);
    state.ui.studentSessionToken = sessionToken;
    state.ui.studentMustChangePassword = mustChangePassword;
    state.ui.studentCategory = selectedCategory;
    sessionStorage.setItem("mentora_student_category", selectedCategory);
    state.students = [student];
    state.classes = [{ id: student.classId, name: student.className, section: student.section }];
    state.activeClassId = student.classId;
    state.ui.studentSessionId = student.id;
    state.ui.activeModal = null;
    saveState();
    const route = resolvePortalRoute(window.location.pathname);
    if (route && ["student-dashboard", "student-performance", "student-subjects", "student-assessments", "student-study-plan", "student-visualize", "student-coding-practice", "student-games", "student-anatomy-study", "student-medical-case-simulator", "student-ai", "student-events"].includes(route.screen)) {
      await handleLocationChange({ initial: true });
    } else {
      await navigateToScreen("student-dashboard", { replace: true });
    }
    return;
  }

  if (event.target.id === "student-password-change-form") {
    const formData = new FormData(event.target);
    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const errorElement = document.getElementById("student-password-change-error");
    if (newPassword !== confirmPassword) {
      if (errorElement) {
        errorElement.textContent = "The new passwords do not match.";
        errorElement.hidden = false;
      }
      return;
    }
    try {
      const result = await changeStudentPassword(currentPassword, newPassword, state.ui.studentSessionToken);
      if (!result?.sessionToken || !result.student) {
        if (errorElement) {
          errorElement.textContent = "The temporary password was not recognized. Please try again.";
          errorElement.hidden = false;
        }
        return;
      }
      sessionStorage.setItem("mentora_student_session", result.sessionToken);
      state.ui.studentSessionToken = result.sessionToken;
      state.ui.studentMustChangePassword = false;
      state.ui.studentSessionId = result.student.id;
      state.students = [result.student];
      state.classes = [{ id: result.student.classId, name: result.student.className, section: result.student.section }];
      state.activeClassId = result.student.classId;
      await navigateToScreen("student-dashboard", { replace: true });
    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error.message || "Unable to change your password. Please try again.";
        errorElement.hidden = false;
      }
    }
    return;
  }

  if (event.target.id === "class-setup-form" || event.target.id === "new-class-form") {
    state.ui.screen = state.teacher ? "class-selection" : "teacher-login";
    state.ui.notification = "Classes must be created and assigned by an administrator.";
    renderApp();
    return;
  }

  if (event.target.id === "student-form") {
    const formData = new FormData(event.target);
    const studentId = event.target.dataset.studentId || null;
    const mode = event.target.dataset.mode || "create";
    const name = String(formData.get("name") || "").trim();
    const rollNumber = String(formData.get("rollNumber") || "").trim();

    if (!name || !rollNumber) {
      const missingField = !name ? event.target.elements.name : event.target.elements.rollNumber;
      missingField.setCustomValidity(!name ? "Student Name is required." : "Roll Number is required.");
      missingField.reportValidity();
      missingField.addEventListener("input", () => missingField.setCustomValidity(""), { once: true });
      return;
    }

    const current = mode === "edit" ? getStudentById(studentId) : null;
    if (mode === "edit" && !current) {
      state.ui.notification = "This student could not be found in the current list. Reload the student list before editing.";
      renderApp();
      return;
    }
    const markRows = [...event.target.querySelectorAll(".student-mark-entry")].map((row) => ({
      id: row.dataset.markId || null,
      subject: String(row.querySelector('[name="markSubject[]"]')?.value || "").trim(),
      assessmentDate: String(row.querySelector('[name="markDate[]"]')?.value || ""),
      assessmentLabel: String(row.querySelector('[name="markLabel[]"]')?.value || "").trim(),
      maxMarks: Number(row.querySelector('[name="markMax[]"]')?.value),
      obtainedMarks: Number(row.querySelector('[name="markObtained[]"]')?.value)
    }));
    const invalidMark = markRows.some((mark) => !mark.subject || !mark.assessmentDate || !mark.assessmentLabel || !Number.isFinite(mark.maxMarks) || mark.maxMarks <= 0 || !Number.isFinite(mark.obtainedMarks) || mark.obtainedMarks < 0 || mark.obtainedMarks > mark.maxMarks);
    const seenMarkIds = new Set();
    const duplicateMarkId = markRows.some((mark) => mark.id && (seenMarkIds.has(mark.id) || (seenMarkIds.add(mark.id), false)));
    const markError = document.getElementById("student-mark-error");
    if (invalidMark || duplicateMarkId) {
      if (markError) markError.textContent = duplicateMarkId ? "A mark row is duplicated. Please remove the duplicate and try again." : "Complete every subject result and make sure obtained marks do not exceed the maximum.";
      return;
    }

    const now = new Date().toISOString();
    const studentPayload = {
      id: mode === "edit" ? current.id : generateStudentRecordId(),
      studentId: mode === "edit" ? current.studentId : "",
      name,
      rollNumber,
      classId: state.activeClassId,
      className: getCurrentClassLabel(),
      strongSubjects: mode === "edit" ? (getStudentById(studentId)?.strongSubjects || []) : [],
      weakSubjects: mode === "edit" ? (getStudentById(studentId)?.weakSubjects || []) : [],
      assessments: {
        academic: Number(formData.get("academic") || 60),
        communication: Number(formData.get("communication") || 60),
        problemSolving: Number(formData.get("problemSolving") || 60),
        participation: Number(formData.get("participation") || 60),
        teamwork: Number(formData.get("teamwork") || 60),
        consistency: Number(formData.get("consistency") || 60)
      },
      academicUnderstanding: Number(formData.get("academic") || 60),
      communication: Number(formData.get("communication") || 60),
      problemSolving: Number(formData.get("problemSolving") || 60),
      participation: Number(formData.get("participation") || 60),
      teamwork: Number(formData.get("teamwork") || 60),
      consistency: Number(formData.get("consistency") || 60),
      learningHabits: Array.from(formData.getAll("learningHabits")),
      section: getCurrentClass()?.section || "",
      observations: [],
      interventions: [],
      progress: [],
      createdAt: mode === "edit" ? undefined : now,
      updatedAt: now,
      lastUpdated: now
    };

    let markSaveWarning = "";
    let credentialSetupWarning = "";
    let analysisNeedsRefresh = false;
    if (mode === "edit") {
      const updatedStudent = {
        ...current,
        ...studentPayload,
        id: current.id,
        createdAt: current.createdAt || now,
        observations: current.observations || [],
        interventions: current.interventions || [],
        progress: [...(current.progress || [])]
      };
      updatedStudent.progress.push({
        id: generateId("prog"),
        type: "assessment_updated",
        date: new Date().toISOString(),
        note: "Student profile revised by teacher after assessment update."
      });
      updatedStudent.lastUpdated = new Date().toISOString();
      updatedStudent.updatedAt = updatedStudent.lastUpdated;
      try { await saveStudentRecord(updatedStudent); }
      catch (error) {
        showPersistenceError(error, "Unable to update student");
        return;
      }
      const savedMarks = [];
      try {
        for (const mark of markRows) { const id = await saveSubjectAssessment({ ...mark, studentId: current.id, classId: current.classId }); savedMarks.push({ ...mark, id, studentId: current.id }); }
      } catch (error) { markSaveWarning = `Student updated, but subject marks could not all be saved: ${error.message}`; }
      updatedStudent.subjectMarks = [...new Map([...(current.subjectMarks || []).filter((old) => !savedMarks.some((mark) => mark.id === old.id)), ...savedMarks].map((mark) => [mark.id, mark])).values()].sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate));
      Object.assign(current, updatedStudent);
      analysisNeedsRefresh = Boolean(state.ui.analysisByStudent?.[current.id]?.aiContent);
      if (state.ui.analysisByStudent?.[current.id]) delete state.ui.analysisByStudent[current.id];
      state.ui.selectedStudentId = current.id;
      state.ui.screen = "student-profile";
    } else {
      studentPayload.progress = [{
        id: generateId("prog"),
        type: "assessment_updated",
        date: new Date().toISOString(),
        note: "New student profile created and saved."
      }];
      studentPayload.observations = [];
      studentPayload.interventions = [];
      let saved = false;
      let saveError;
      for (let attempt = 0; attempt < 8 && !saved; attempt += 1) {
        try {
          studentPayload.studentId = await createUniqueStudentCode();
          await insertStudentRecord(studentPayload);
          saved = true;
        } catch (error) {
          saveError = error;
          if (!isStudentCodeCollision(error)) break;
        }
      }
      if (!saved) {
        const duplicateMessage = isStudentCodeCollision(saveError)
          ? "Mentora couldn't reserve a unique student code after several attempts. Please try again."
          : saveError?.code === "23505" && /roll_number/i.test(`${saveError.constraint || ""} ${saveError.message || ""}`)
            ? "This roll number already exists in this class. Check the student record and try another roll number."
            : `Unable to save student: ${saveError?.message || "Please try again."}`;
        state.ui.notification = duplicateMessage;
        renderApp();
        return;
      }
      const savedMarks = [];
      try {
        for (const mark of markRows) { const id = await saveSubjectAssessment({ ...mark, studentId: studentPayload.id, classId: studentPayload.classId }); savedMarks.push({ ...mark, id, studentId: studentPayload.id }); }
      } catch (error) { markSaveWarning = `Student saved, but subject marks could not all be saved: ${error.message}`; }
      state.ui.studentPasswordResetError = "";
      try {
        const credential = await provisionStudentPassword(studentPayload);
        generatedStudentCredentials = {
          screen: "student-profile",
          studentRecordId: studentPayload.id,
          entries: [credential]
        };
      } catch (error) {
        generatedStudentCredentials = null;
        credentialSetupWarning = `Student was saved, but temporary password setup failed: ${error.message} Use Reset Student Password on this profile to retry.`;
        state.ui.studentPasswordResetError = credentialSetupWarning;
      }
      state.students.unshift({ ...studentPayload, subjectMarks: savedMarks });
      state.ui.selectedStudentId = studentPayload.id;
      state.ui.screen = "student-profile";
    }

    state.ui.activeModal = null;
    state.ui.nav = "students";
    state.ui.notification = markSaveWarning || credentialSetupWarning || null;
    saveState();
    if (!markSaveWarning && !credentialSetupWarning) state.ui.notification = mode !== "edit" ? "Student added successfully." : "Student updated successfully.";
    await navigateToScreen(state.ui.screen, {
      studentId: state.ui.screen === "student-profile" ? state.ui.selectedStudentId : ""
    });
    if (analysisNeedsRefresh && mode === "edit" && !markSaveWarning) void runStudentAnalysis(studentPayload.id);
    if (!markSaveWarning && !credentialSetupWarning) {
      window.setTimeout(() => {
        state.ui.notification = null;
        renderApp();
      }, 3200);
    }
    return;
  }

  if (event.target.id === "subject-mark-form") {
    if (state.ui.subjectMarksSaving) return;
    const form = event.target;
    const student = getStudentById(form.dataset.studentId);
    if (!student) return;
    const values = new FormData(form);
    const label = String(values.get("assessmentLabel") || "").trim();
    const assessmentDate = String(values.get("assessmentDate") || "");
    const mode = form.dataset.entryMode === "grades" ? "grades" : "marks";
    const rowElements = [...form.querySelectorAll(".mark-entry-row")];
    const rows = rowElements.map((row) => ({
      id: row.dataset.markId || null,
      subject: String(row.querySelector('[name="subject[]"]')?.value || "").trim(),
      grade: String(row.querySelector('[name="grade[]"]')?.value || ""),
      obtainedMarks: row.querySelector('[name="obtainedMarks[]"]') ? Number(row.querySelector('[name="obtainedMarks[]"]')?.value) : null,
      maxMarks: row.querySelector('[name="maxMarks[]"]') ? Number(row.querySelector('[name="maxMarks[]"]')?.value) : null
    }));
    const invalidResult = rows.some((row) => !row.subject || (mode === "grades"
      ? !SUBJECT_GRADE_SCALE.includes(row.grade)
      : !Number.isFinite(row.obtainedMarks) || !Number.isFinite(row.maxMarks) || row.maxMarks <= 0 || row.obtainedMarks < 0 || row.obtainedMarks > row.maxMarks));
    if (!label || !assessmentDate || !rows.length || invalidResult || new Set(rows.map((row) => row.subject.toLowerCase())).size !== rows.length) {
      state.ui.markFormError = mode === "grades"
        ? "Enter an assessment name and date, then choose a subject and grade for each unique row."
        : "Enter an assessment name and date. Each unique subject needs numeric marks, a maximum greater than zero, and obtained marks from zero up to that maximum.";
      form.querySelector('[data-mark-form-error]')?.replaceChildren(document.createTextNode(state.ui.markFormError));
      return;
    }
    const existing = student.subjectMarks || [];
    const oldIds = new Set(rows.map((row) => row.id).filter(Boolean));
    const marks = rows.map((row) => ({ ...row, grade: mode === "grades" ? row.grade : null, studentId: student.id, classId: student.classId, assessmentDate, assessmentLabel: label }));
    const next = [...existing.filter((entry) => !oldIds.has(entry.id)), ...marks].sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate));
    const updatedStudent = { ...student, subjectMarks: next };
    state.ui.subjectMarksSaving = true;
    state.ui.markFormError = "";
    const saveButton = form.querySelector('[type="submit"]');
    for (const control of form.querySelectorAll("input, select, button")) control.disabled = true;
    if (saveButton) saveButton.textContent = "Saving...";
    try {
      for (let index = 0; index < marks.length; index += 1) {
        marks[index].id = await saveSubjectAssessment(marks[index]);
        rowElements[index].dataset.markId = marks[index].id;
      }
      let refreshedStudent = null;
      try { refreshedStudent = await fetchStudentProfile(student.id); }
      catch (refreshError) { console.error("Subject results saved, but reloading the student profile failed:", refreshError); }
      const refreshedHistoryAvailable = refreshedStudent?.subjectMarksStatus === "ready";
      Object.assign(student, refreshedHistoryAvailable ? refreshedStudent : updatedStudent);
      if (refreshedStudent && !refreshedHistoryAvailable) {
        student.subjectMarksStatus = refreshedStudent.subjectMarksStatus;
        student.subjectMarksError = refreshedStudent.subjectMarksError;
      }
      const shouldRefreshAnalysis = Boolean(state.ui.analysisByStudent?.[student.id]?.aiContent);
      if (state.ui.analysisByStudent?.[student.id]) delete state.ui.analysisByStudent[student.id];
      state.ui.markFormError = "";
      state.ui.activeModal = null;
      state.ui.notification = refreshedHistoryAvailable ? "Subject results saved and refreshed from Supabase." : "Subject results saved, but subject history could not be reloaded. Check Supabase access and refresh the profile.";
      saveState();
      renderApp();
      if (shouldRefreshAnalysis && refreshedHistoryAvailable) void runStudentAnalysis(student.id);
    } catch (error) {
      state.ui.markFormError = error.message || "Unable to save subject results. Please retry.";
      form.querySelector('[data-mark-form-error]')?.replaceChildren(document.createTextNode(state.ui.markFormError));
      for (const control of form.querySelectorAll("input, select, button")) control.disabled = false;
      if (saveButton) saveButton.textContent = "Save Assessment";
    } finally {
      state.ui.subjectMarksSaving = false;
    }
    return;
  }

  if (event.target.id === "observation-form") {
    const formData = new FormData(event.target);
    const student = getStudentById(event.target.dataset.studentId);
    if (!student) return;

    const note = formData.get("note").toString().trim();
    const obs = {
      id: generateId("obs"),
      date: formData.get("date").toString() || new Date().toISOString().split("T")[0],
      category: formData.get("category").toString(),
      note
    };

    const updatedStudent = structuredClone(student);
    updatedStudent.observations.push(obs);
    updatedStudent.lastUpdated = new Date().toISOString();
    updatedStudent.updatedAt = updatedStudent.lastUpdated;
    updatedStudent.progress.push({
      id: generateId("prog"),
      type: "new_observation",
      date: new Date().toISOString(),
      note: `New ${obs.category.toLowerCase()} observation saved.`
    });
    try {
      await insertObservation(student.id, obs);
      await saveStudentRecord(updatedStudent);
    } catch (error) {
      showPersistenceError(error, "Unable to add observation");
      return;
    }
    Object.assign(student, updatedStudent);
    state.ui.activeModal = null;
    saveState();
    renderApp();
    return;
  }

  if (event.target.id === "followup-form") {
    const formData = new FormData(event.target);
    const student = getStudentById(event.target.dataset.studentId);
    if (!student) return;

    const response = formData.get("response").toString().trim();
    if (!response) return;

    const observation = {
      id: generateId("obs"),
      date: new Date().toISOString().split("T")[0],
      category: "Other",
      note: `Follow-up response: ${response}`
    };

    const updatedStudent = structuredClone(student);
    updatedStudent.observations.push(observation);
    updatedStudent.progress.push({
      id: generateId("prog"),
      type: "new_observation",
      date: new Date().toISOString(),
      note: "Teacher answered follow-up question and saved this note."
    });
    updatedStudent.lastUpdated = new Date().toISOString();
    updatedStudent.updatedAt = updatedStudent.lastUpdated;
    try {
      await insertObservation(student.id, observation);
      await saveStudentRecord(updatedStudent);
    } catch (error) {
      showPersistenceError(error, "Unable to save follow-up observation");
      return;
    }
    Object.assign(student, updatedStudent);
    state.ui.activeModal = null;
    saveState();
    renderApp();
  }
}

async function runStudentAnalysis(studentId) {
  const student = getStudentById(studentId);
  if (!student) return;
  state.ui.analysisLoading = true;
  renderApp();
  try {
    const accessToken = await getTeacherAccessToken();
    if (!accessToken) throw new Error("Your teacher session expired. Please sign in again.");
    const response = await fetch('/.netlify/functions/analyze-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        student: {
          id: student.id,
          name: student.name,
          learningHabits: student.learningHabits || [],
          assessments: student.assessments || {},
          subjectMarks: student.subjectMarks || [],
          subjectMarkInsights: getSubjectMarkInsights(student),
          subjectMarksStatus: student.subjectMarksStatus || "ready",
          assessmentHistory: (student.progress || []).filter((item) => item.type === 'assessment_updated'),
          observations: student.observations || []
        }
      })
    });
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      if (response.status === 404) {
        throw new Error('The analysis function was not found. Start the app with `npx netlify dev` locally, or check that the Netlify Function is deployed.');
      }
      throw new Error(`The analysis service returned a non-JSON response (HTTP ${response.status}). Check the Netlify Function and try again.`);
    }
    if (!response.ok) throw new Error(result?.error || 'Unable to generate analysis. Please try again.');
    if (!result || typeof result !== 'object' || typeof result.content !== 'string' || !result.content.trim()) {
      throw new Error('The analysis service returned no usable insights. Please try again.');
    }
    const responseHeadings = result.content.split(/\r?\n/).map((line) => line.replace(/^#{1,6}\s*/, '').replace(/^\*\*(.*?)\*\*:?$/, '$1').replace(/:$/, '').trim().toLowerCase());
    const requiredHeadings = ['what needs improvement', 'your action plan', 'daily practice', 'weekly target', 'progress tracking'];
    if (!requiredHeadings.every((heading) => responseHeadings.includes(heading))) {
      throw new Error('The analysis service returned an incomplete improvement plan. A clearly labeled fallback is shown below.');
    }
    const analysis = { aiContent: result.content, interpretation: result.content };
    state.ui.analysisByStudent = state.ui.analysisByStudent || {};
    state.ui.analysisByStudent[studentId] = analysis;
    saveState();
  } catch (error) {
    state.ui.analysisByStudent = state.ui.analysisByStudent || {};
    state.ui.analysisByStudent[studentId] = {
      fallback: true,
      fallbackReason: error.message || 'Unable to reach the AI service.',
      fallbackSections: buildSubjectImprovementFallback(student)
    };
    saveState();
  } finally {
    state.ui.analysisLoading = false;
    renderApp();
  }
}

function buildSubjectImprovementFallback(student) {
  const groups = new Map();
  for (const mark of student.subjectMarks || []) {
    if (!isNumericSubjectMark(mark)) continue;
    const subject = String(mark.subject || '').trim();
    if (!subject) continue;
    const entries = groups.get(subject) || [];
    entries.push({ ...mark, percent: Number(mark.obtainedMarks) / Number(mark.maxMarks) * 100 });
    groups.set(subject, entries);
  }
  const subjectRows = [...groups].map(([subject, entries]) => {
    entries.sort((a, b) => String(a.assessmentDate).localeCompare(String(b.assessmentDate)));
    return { subject, entries, average: entries.reduce((sum, entry) => sum + entry.percent, 0) / entries.length };
  });
  const comparisonRows = subjectRows.filter((entry) => entry.entries.length >= 2);
  const comparisonAverage = comparisonRows.length ? comparisonRows.reduce((sum, entry) => sum + entry.average, 0) / comparisonRows.length : null;
  const identified = subjectRows.map((entry) => {
    const latest = entry.entries[entry.entries.length - 1];
    const previous = entry.entries.length > 1 ? entry.entries[entry.entries.length - 2] : null;
    const relativeGap = comparisonAverage == null ? null : comparisonAverage - entry.average;
    const declining = previous && previous.percent - latest.percent >= 5;
    const repeatedRelativeNeed = entry.entries.length >= 2 && relativeGap >= 5;
    const possibleRelativeNeed = entry.entries.length === 1 && subjectRows.length >= 2 && comparisonAverage != null && relativeGap >= 5;
    if (!declining && !repeatedRelativeNeed && !possibleRelativeNeed) return null;
    const status = possibleRelativeNeed ? 'Possible area to improve' : 'Repeated evidence suggests support is needed';
    const trend = previous
      ? `${latest.percent.toFixed(1)}% on ${latest.assessmentLabel || 'the latest assessment'}; previous result ${previous.percent.toFixed(1)}%${declining ? `, down ${(previous.percent - latest.percent).toFixed(1)} percentage points` : `, ${latest.percent - previous.percent >= 1 ? `up ${(latest.percent - previous.percent).toFixed(1)} percentage points` : Math.abs(latest.percent - previous.percent) < 1 ? 'about the same' : `down ${(previous.percent - latest.percent).toFixed(1)} percentage points`}`}`
      : `${latest.percent.toFixed(1)}% on ${latest.assessmentLabel || 'the recorded assessment'}; there is only one result, so this is not a confirmed weakness`;
    return { subject: entry.subject, latest, status, trend };
  }).filter(Boolean);

  if (student.subjectMarksStatus && student.subjectMarksStatus !== 'ready') {
    return [
      { heading: 'What needs improvement', items: ['Subject assessment history could not be loaded, so no subject-specific conclusion is supported.'] },
      { heading: 'Your action plan', items: ['Ask the teacher to review the most recent marked assessment and select one concept for practice once the saved results are available.'] },
      { heading: 'Daily practice', items: ['Use a short study session: revisit one teacher-identified concept, solve a few related class exercises, and note questions to ask.'] },
      { heading: 'Weekly target', items: ['Complete one teacher-selected exercise set after the assessment history is available.'] },
      { heading: 'Progress tracking', items: ['Compare the next saved assessment with the previous result for the same subject.'] }
    ];
  }
  if (!subjectRows.length) {
    const hasGrades = (student.subjectMarks || []).some((mark) => mark.grade);
    return [
      { heading: 'What needs improvement', items: [hasGrades ? 'Only grade-based results are recorded. Grades are not converted to percentages, so numerical subject comparisons are unavailable.' : 'There are no saved numerical subject marks to identify an improvement area.'] },
      { heading: 'Your action plan', items: ['Review the latest teacher feedback with the student and choose one specific concept or question type from that feedback.'] },
      { heading: 'Daily practice', items: ['Spend 10 minutes recalling the selected concept, 20 minutes working through a class example, and 15 minutes solving a similar question independently.'] },
      { heading: 'Weekly target', items: ['Complete one short practice set selected from the student’s current class materials.'] },
      { heading: 'Progress tracking', items: ['Record a dated assessment result before making a subject comparison or trend claim.'] }
    ];
  }
  if (!identified.length) {
    const enoughForComparison = comparisonRows.length >= 2;
    return [
      { heading: 'What needs improvement', items: [enoughForComparison ? 'The recorded subject averages do not currently show a repeated area at least 5 percentage points below the student’s average, or a decline of 5 points between the latest two results.' : 'There is not enough repeated subject history to confirm a weakness or trend. A single result should be treated as an initial signal only.'] },
      { heading: 'Your action plan', items: ['Review questions marked incorrect on the latest assessment with the teacher and identify any concepts named in the feedback.'] },
      { heading: 'Daily practice', items: ['Use a 45-minute session: 10 minutes to recall the relevant class concepts, 25 minutes for worked examples and independent exercises, and 10 minutes to correct errors.'] },
      { heading: 'Weekly target', items: ['Redo all missed questions from the latest assessment and complete one timed practice set from the same class materials.'] },
      { heading: 'Progress tracking', items: ['Compare the next result with the latest result for the same subject using obtained marks divided by maximum marks.'] }
    ];
  }
  const summaries = identified.map((entry) => `${entry.status}: ${entry.subject} — ${entry.trend}. Results show performance only; chapter-level difficulties are not recorded.`);
  const actions = identified.map((entry) => `For ${entry.subject}, review the marked questions and teacher feedback from ${entry.latest.assessmentLabel || 'the latest assessment'}; list only concepts the feedback identifies, then redo those questions and solve related textbook or class exercises.`);
  const daily = identified.map((entry) => `For ${entry.subject}: 10 minutes recalling the concepts named in feedback, 20 minutes reviewing a worked class example, 20 minutes solving related questions independently, and 5 minutes recording and correcting mistakes.`);
  const weekly = identified.map((entry) => `For ${entry.subject}, correct every missed question from ${entry.latest.assessmentLabel || 'the latest assessment'} and complete one timed practice set using current class materials.`);
  const tracking = identified.map((entry) => `Compare the next ${entry.subject} assessment percentage with ${entry.latest.percent.toFixed(1)}% from ${entry.latest.assessmentLabel || 'the latest assessment'}; use the same percentage calculation and note which corrected question types are now answered accurately.`);
  return [
    { heading: 'What needs improvement', items: summaries },
    { heading: 'Your action plan', items: actions },
    { heading: 'Daily practice', items: daily },
    { heading: 'Weekly target', items: weekly },
    { heading: 'Progress tracking', items: tracking }
  ];
}

function handleChange(event) {
  if (event.target.id === "coding-language") {
    const current = document.getElementById("coding-source")?.value || "";
    const q = QUESTIONS[(Number(window.__codingQuestionId) || 1) - 1];
    const oldStarter = codingStarter(window.__codingLanguage || "JavaScript", q);
    if (current && current !== oldStarter && !window.confirm("Replace your unsaved code with the starter template for this language?")) {
      event.target.value = window.__codingLanguage || "JavaScript";
      return;
    }
    window.__codingLanguage = event.target.value;
    window.__codingCode = codingStarter(window.__codingLanguage, q);
    window.__codingResults = null;
    renderApp();
    return;
  }
  if (event.target.matches("[data-events-location]")) {
    state.ui.eventsLocation = event.target.value;
    state.ui.selectedEventId = null;
    renderApp();
    return;
  }
  if (event.target.matches("[data-events-sort]")) {
    state.ui.eventsSort = event.target.value;
    state.ui.selectedEventId = null;
    renderApp();
    return;
  }
  if (event.target.matches("[data-events-registration]")) {
    state.ui.eventsRegistrationStatus = event.target.value;
    state.ui.selectedEventId = null;
    renderApp();
    return;
  }
  if (event.target.id === "study-syllabus-pdf") {
    const file = event.target.files?.[0];
    const filename = document.querySelector("[data-study-filename]");
    if (filename && file) filename.textContent = file.name;
    return;
  }
  if (event.target.id === "student-csv-file") {
    const file = event.target.files?.[0];
    if (file) importStudentsCsv(file);
    event.target.value = "";
    return;
  }
  handleInput(event);
}

function renderStudentMarksSection(student) {
  const marks = (student?.subjectMarks || []).filter(isNumericSubjectMark);
  const knownSubjects = [...new Set(marks.map((mark) => mark.subject))];
  return `<section class="field full student-marks-editor"><div class="student-marks-title"><div><strong>Add Subject Marks</strong><p>Record dated results. These marks are saved to Supabase and used for subject insights and progress history.</p></div><button class="btn-secondary" type="button" data-action="add-student-mark-row">+ Add subject</button></div><div class="student-mark-entry-list">${marks.map((mark, index) => renderStudentMarkRow(index, mark, knownSubjects)).join("")}</div><p class="marks-evidence-note">Subject names from saved marks are suggested; enter another subject directly if it is not listed.</p><p class="form-error" id="student-mark-error" role="alert"></p></section>`;
}

function renderStudentMarkRow(index, mark = null, subjects = []) {
  const row = mark || {};
  const percent = Number(row.maxMarks) > 0 ? `${(Number(row.obtainedMarks) / Number(row.maxMarks) * 100).toFixed(1)}%` : "—";
  const options = [...new Set([...subjects, row.subject].filter(Boolean))];
  return `<div class="student-mark-entry mark-entry-row" data-mark-id="${escapeHtml(row.id || "")}"><label>Subject<input class="input" name="markSubject[]" list="student-subject-list-${index}" value="${escapeHtml(row.subject || "")}" maxlength="100" placeholder="Subject" required data-student-mark-value/><datalist id="student-subject-list-${index}">${options.map((subject) => `<option value="${escapeHtml(subject)}"></option>`).join("")}</datalist></label><label>Date<input class="input" type="date" name="markDate[]" value="${escapeHtml(row.assessmentDate || new Date().toISOString().slice(0, 10))}" required/></label><label>Assessment<input class="input" name="markLabel[]" value="${escapeHtml(row.assessmentLabel || "")}" maxlength="120" placeholder="Test / exam" required/></label><label>Maximum<input class="input" type="number" name="markMax[]" min="0.01" step="0.01" value="${row.maxMarks ?? ""}" required data-student-mark-value/></label><label>Obtained<input class="input" type="number" name="markObtained[]" min="0" step="0.01" value="${row.obtainedMarks ?? ""}" required data-student-mark-value/></label><span class="student-mark-percentage">${percent}</span></div>`;
}

function renderSubjectMarkModeModal(modal) {
  const student = getStudentById(modal.studentId);
  if (!student) return "";
  return `<div class="modal-overlay" data-close-modal="true"><div class="modal-card marks-modal-card" data-stop-propagation="true"><div class="modal-header"><h3>Add Subject Results</h3><button class="close-btn" data-action="close-modal" aria-label="Close">&times;</button></div><p class="marks-modal-help">Choose how this assessment is recorded for ${escapeHtml(student.name)}.</p><div class="subject-mark-mode-options"><button class="subject-mark-mode-card" type="button" data-action="select-subject-entry-mode" data-entry-mode="marks"><strong>Enter Marks</strong><span>Record maximum and obtained marks for each subject.</span></button><button class="subject-mark-mode-card" type="button" data-action="select-subject-entry-mode" data-entry-mode="grades"><strong>Enter Grades</strong><span>Select an institution grade for each subject. No percentage is inferred.</span></button></div></div></div>`;
}

function renderSubjectMarkModal(modal) {
  const student = getStudentById(modal.studentId);
  if (!student) return "";
  const mark = (student.subjectMarks || []).find((entry) => entry.id === modal.markId);
  const mode = modal.entryMode || (mark?.grade ? "grades" : "marks");
  const profileSubjects = [student.subjects, student.courseSubjects].flatMap((value) => Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : []).map((value) => String(value).trim()).filter(Boolean);
  const subjects = [...new Set([...profileSubjects, ...(student.subjectMarks || []).map((entry) => entry.subject)])];
  const rows = mark
    ? renderMarkEntryRow(0, mark.subject, mark.maxMarks ?? "", mark.obtainedMarks ?? "", mark.id, subjects, mode, mark.grade || "")
    : renderMarkEntryRow(0, "", "", "", "", subjects, mode, "");
  const nextRow = 1;
  const resultFields = mode === "grades"
    ? `<div class="marks-entry-head grade-mode-row"><span>Subject</span><span>Grade</span><span>Selected grade</span></div><div id="mark-entry-rows">${rows}</div>`
    : `<div class="marks-entry-head"><span>Subject</span><span>Maximum</span><span>Obtained</span><span>Percentage</span></div><div id="mark-entry-rows">${rows}</div>`;
  return `<div class="modal-overlay" data-close-modal="true"><div class="modal-card marks-modal-card" data-stop-propagation="true"><div class="modal-header"><h3>${mark ? "Edit subject result" : mode === "grades" ? "Enter Grades" : "Enter Marks"}</h3><button class="close-btn" data-action="close-modal" aria-label="Close">&times;</button></div><p class="marks-modal-help">${mode === "grades" ? "Choose a grade for each subject. Grades are stored separately and are not converted to numerical marks." : "Enter the assessment name and date, then record results for one or more subjects."}</p><form id="subject-mark-form" data-entry-mode="${mode}" data-student-id="${student.id}" data-next-row="${nextRow}"><div class="field"><label for="mark-label">Assessment name</label><input class="input" id="mark-label" name="assessmentLabel" value="${escapeHtml(mark?.assessmentLabel || "")}" maxlength="120" placeholder="e.g. CIE 1, Unit Test 1" required/></div><div class="field"><label for="mark-date">Assessment date</label><input class="input" id="mark-date" type="date" name="assessmentDate" value="${escapeHtml(mark?.assessmentDate || new Date().toISOString().slice(0, 10))}" required/></div>${resultFields}<button class="btn-secondary" type="button" data-action="add-mark-row">+ Add subject</button><p class="form-error" data-mark-form-error role="alert">${escapeHtml(state.ui.markFormError || "")}</p><div class="modal-actions"><button type="button" class="btn-ghost" data-action="close-modal" ${state.ui.subjectMarksSaving ? "disabled" : ""}>Cancel</button><button class="btn-primary" type="submit" ${state.ui.subjectMarksSaving ? "disabled" : ""}>${state.ui.subjectMarksSaving ? "Saving..." : mark ? "Save Changes" : "Save Assessment"}</button></div></form></div></div>`;
}

function renderClassSubjectProgress(students) {
  const buckets = new Map();
  for (const student of students) for (const mark of student.subjectMarks || []) {
    if (!isNumericSubjectMark(mark)) continue;
    const key = `${mark.subject}\u0000${mark.assessmentDate}`;
    const bucket = buckets.get(key) || { subject: mark.subject, assessmentDate: mark.assessmentDate, total: 0, count: 0 };
    bucket.total += mark.obtainedMarks / mark.maxMarks * 100;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  const subjectMarks = [...buckets.values()].map((entry, index) => ({ id: `class-${index}`, subject: entry.subject, assessmentDate: entry.assessmentDate, assessmentLabel: `Class average · ${entry.count} student${entry.count === 1 ? "" : "s"}`, obtainedMarks: entry.total / entry.count, maxMarks: 100 }));
  return renderSubjectProgress({ subjectMarks }, "class-overview");
}

function renderMarkEntryRow(index, subject, maximum, obtained, markId, subjects, mode = "marks", grade = "") {
  if (mode === "grades") {
    const listId = `subject-list-${index}`;
    const list = Array.isArray(subjects) ? subjects : [];
    return `<div class="mark-entry-row grade-mode-row" data-mark-id="${escapeHtml(markId || "")}"><input class="input" aria-label="Subject" name="subject[]" list="${listId}" maxlength="100" value="${escapeHtml(subject || "")}" placeholder="Subject name" required/><datalist id="${listId}">${list.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist><select class="select" aria-label="Grade" name="grade[]" required><option value="">Select grade</option>${SUBJECT_GRADE_SCALE.map((item) => `<option value="${item}" ${item === grade ? "selected" : ""}>${item}</option>`).join("")}</select><span class="selected-grade" aria-live="polite">${escapeHtml(grade || "Choose a grade")}</span></div>`;
  }
  const percent = Number(maximum) > 0 && Number.isFinite(Number(obtained)) && obtained !== "" ? `${(Number(obtained) / Number(maximum) * 100).toFixed(1)}%` : "—";
  const listId = `subject-list-${index}`;
  const list = Array.isArray(subjects) ? subjects : [];
  return `<div class="mark-entry-row" data-mark-id="${escapeHtml(markId || "")}"><input class="input" name="subject[]" list="${listId}" maxlength="100" value="${escapeHtml(subject || "")}" placeholder="Subject name" required/><datalist id="${listId}">${list.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist><input class="input" type="number" name="maxMarks[]" min="0.01" step="0.01" value="${maximum}" placeholder="Max" data-mark-value required/><input class="input" type="number" name="obtainedMarks[]" min="0" step="0.01" value="${obtained}" placeholder="Score" data-mark-value required/><output data-mark-percent>${percent}</output></div>`;
}

function isNumericSubjectMark(mark) {
  return !mark?.grade && mark?.obtainedMarks != null && mark?.maxMarks != null && Number.isFinite(Number(mark.obtainedMarks)) && Number.isFinite(Number(mark.maxMarks)) && Number(mark.maxMarks) > 0;
}

function getSubjectMarkInsights(student) {
  const bySubject = new Map();
  for (const mark of student.subjectMarks || []) {
    if (!isNumericSubjectMark(mark)) continue;
    const key = mark.subject.trim();
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key).push({ ...mark, percent: mark.maxMarks > 0 ? mark.obtainedMarks / mark.maxMarks * 100 : 0 });
  }
  const averages = [...bySubject.entries()].map(([subject, marks]) => ({ subject, marks, average: marks.reduce((sum, mark) => sum + mark.percent, 0) / marks.length }));
  const qualified = averages.filter((entry) => entry.marks.length >= 2);
  const overall = qualified.length ? qualified.reduce((sum, entry) => sum + entry.average, 0) / qualified.length : 0;
  return { averages, qualified, overall, strengths: qualified.filter((entry) => entry.average >= overall + 5), support: qualified.filter((entry) => entry.average <= overall - 5) };
}

function renderMarkInsights(student) {
  if (student.subjectMarksStatus && student.subjectMarksStatus !== "ready") return renderSubjectMarksUnavailable(student.subjectMarksStatus, student.subjectMarksError);
  const insights = getSubjectMarkInsights(student);
  if (!insights.qualified.length) return `<p class="marks-evidence-note">Add more subject marks to generate insights. Each subject needs at least two dated assessments before it can be classified.</p>`;
  const items = (list) => list.length ? list.map((entry) => `<span class="chip">${escapeHtml(entry.subject)} · ${entry.average.toFixed(1)}% (${entry.marks.length} assessments)</span>`).join("") : "<span class=\"muted\">No subjects currently meet this comparison.</span>";
  return `<p class="marks-evidence-note">Comparison uses each subject’s average percentage across ${insights.qualified.length} subject${insights.qualified.length === 1 ? "" : "s"} with at least two records, against the student's average (${insights.overall.toFixed(1)}%). A gap of 5 percentage points determines the labels below.</p><div class="subject-insight-grid"><div><strong>Strong Subjects</strong><div class="chip-list">${items(insights.strengths)}</div></div><div><strong>Weak Subjects</strong><div class="chip-list">${items(insights.support)}</div></div></div>`;
}

function renderSubjectProgress(student, filterId) {
  const allMarks = student.subjectMarks || [];
  if (student.subjectMarksStatus && student.subjectMarksStatus !== "ready") return renderSubjectMarksUnavailable(student.subjectMarksStatus, student.subjectMarksError);
  if (!allMarks.length) return `<p class="marks-evidence-note">No subject assessment history yet.</p>`;
  const marks = allMarks.filter(isNumericSubjectMark);
  if (!marks.length) return `<p class="marks-evidence-note">Grade results are recorded in the assessment history. Numerical progress charts are shown only for assessments entered as marks.</p>`;
  const subjects = [...new Set(marks.map((mark) => mark.subject.trim()).filter(Boolean))];
  const savedFilter = state.ui.markFilters?.[filterId] || "all";
  const selected = savedFilter === "all" || subjects.includes(savedFilter) ? savedFilter : "all";
  if (selected !== savedFilter) {
    state.ui.markFilters = state.ui.markFilters || {};
    state.ui.markFilters[filterId] = selected;
  }
  const groupedMarks = new Map();
  for (const mark of marks) {
    const subject = mark.subject.trim();
    const date = String(mark.assessmentDate || "");
    if (!subject || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const key = `${subject.toLocaleLowerCase()}\u0000${date}`;
    const entry = groupedMarks.get(key) || { subject, assessmentDate: date, obtainedMarks: 0, maxMarks: 0, labels: [], records: 0 };
    entry.obtainedMarks += Number(mark.obtainedMarks);
    entry.maxMarks += Number(mark.maxMarks);
    entry.records += 1;
    if (mark.assessmentLabel && !entry.labels.includes(mark.assessmentLabel)) entry.labels.push(mark.assessmentLabel);
    groupedMarks.set(key, entry);
  }
  const groupedPoints = [...groupedMarks.values()]
    .filter((mark) => mark.maxMarks > 0)
    .map((mark) => ({ ...mark, percent: Math.max(0, Math.min(100, mark.obtainedMarks / mark.maxMarks * 100)), assessmentLabel: mark.labels.join(", ") || "Assessment" }))
    .sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate) || a.subject.localeCompare(b.subject));
  const filtered = selected === "all" ? groupedPoints : groupedPoints.filter((mark) => mark.subject === selected);
  if (!filtered.length) return `<p class="marks-evidence-note">No numerical marks are available for this subject filter. Choose another subject or add a marks-based assessment.</p>`;
  const points = filtered;
  const width = 680, height = 210, padX = 46, padY = 24;
  const dates = [...new Set(points.map((point) => point.assessmentDate))].sort();
  const xByDate = new Map(dates.map((date, index) => [date, dates.length === 1 ? width / 2 : padX + index * (width - padX * 2) / (dates.length - 1)]));
  const coords = points.map((point) => ({ ...point, x: xByDate.get(point.assessmentDate), y: height - padY - point.percent * (height - padY * 2) / 100 }));
  const grouped = new Map();
  for (const point of coords) { const list = grouped.get(point.subject) || []; list.push(point); grouped.set(point.subject, list); }
  const palette = ["#65539c", "#7987b8", "#9479bd", "#5b80a8", "#b17a9a"];
  const lines = [...grouped.entries()].map(([subject, entries], index) => entries.length > 1 ? `<polyline style="stroke:${palette[index % palette.length]}" points="${entries.map((point) => `${point.x},${point.y}`).join(" ")}"/>` : "").join("");
  const selectedSubjects = [...new Set(filtered.map((point) => point.subject))];
  const tooltipPoints = coords.map((point) => `<circle style="fill:${palette[selectedSubjects.indexOf(point.subject) % palette.length]}" cx="${point.x}" cy="${point.y}" r="6"><title>${escapeHtml(point.subject)} · ${escapeHtml(point.assessmentLabel)} · ${escapeHtml(point.assessmentDate)} · ${point.obtainedMarks}/${point.maxMarks} (${point.percent.toFixed(1)}%)</title></circle>`).join("");
  const dateLabels = dates.map((date) => `<text class="chart-date" x="${xByDate.get(date)}" y="${height - 3}" text-anchor="middle">${escapeHtml(date.slice(5))}</text>`).join("");
  return `<div class="progress-chart-wrap"><label class="chart-filter">Subject <select class="select" data-mark-filter="${escapeHtml(filterId)}"><option value="all" ${selected === "all" ? "selected" : ""}>All subjects</option>${subjects.map((subject) => `<option value="${escapeHtml(subject)}" ${selected === subject ? "selected" : ""}>${escapeHtml(subject)}</option>`).join("")}</select></label><div class="progress-chart-scroll"><svg class="progress-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Subject assessment percentages over time"><line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}"/><line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}"/><text x="4" y="${padY + 4}">100%</text><text x="15" y="${height / 2}">50%</text><text x="25" y="${height - padY}">0%</>${lines}${tooltipPoints}${dateLabels}</svg></div>${selectedSubjects.length > 1 ? `<div class="chart-legend">${selectedSubjects.map((subject, index) => `<span><i style="background:${palette[index % palette.length]}"></i>${escapeHtml(subject)}</span>`).join("")}</div>` : ""}${renderTrendNote(filtered)}<p class="marks-evidence-note">${points.length} dated subject result${points.length === 1 ? "" : "s"} · same-day results for a subject are combined by total obtained marks divided by total maximum marks.</p></div>`;
}

function renderTrendNote(marks) {
  const bySubject = new Map();
  for (const mark of marks) { const list = bySubject.get(mark.subject) || []; list.push(mark); bySubject.set(mark.subject, list); }
  const trends = [...bySubject].filter(([, list]) => list.length > 1).map(([subject, list]) => {
    list.sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate));
    const delta = list[list.length - 1].obtainedMarks / list[list.length - 1].maxMarks * 100 - list[0].obtainedMarks / list[0].maxMarks * 100;
    return `${subject}: ${Math.abs(delta) < 1 ? "no clear change" : delta > 0 ? `improved ${delta.toFixed(1)} percentage points` : `declined ${Math.abs(delta).toFixed(1)} percentage points`} across ${list.length} assessments`;
  });
  return trends.length ? `<p class="marks-trend-note">${trends.map(escapeHtml).join(" · ")}</p>` : `<p class="marks-evidence-note">Insufficient historical data to establish a trend. Add another assessment for a subject.</p>`;
}

function getStudentNumericAssessmentSeries(student) {
  const marks = (student.subjectMarks || []).filter(isNumericSubjectMark).map((mark) => ({
    ...mark,
    subject: String(mark.subject || "").trim(),
    assessmentLabel: String(mark.assessmentLabel || "Assessment").trim(),
    assessmentDate: String(mark.assessmentDate || ""),
    percent: Number(mark.obtainedMarks) / Number(mark.maxMarks) * 100
  })).filter((mark) => mark.subject && Number.isFinite(mark.percent) && mark.percent >= 0 && mark.percent <= 100);
  marks.sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate) || a.assessmentLabel.localeCompare(b.assessmentLabel) || a.subject.localeCompare(b.subject));
  return marks;
}

function renderPerformanceHistory(student) {
  if (student.subjectMarksStatus && student.subjectMarksStatus !== "ready") return renderSubjectMarksUnavailable(student.subjectMarksStatus, student.subjectMarksError);
  const marks = getStudentNumericAssessmentSeries(student);
  if (!marks.length) return `<div class="analytics-empty"><strong>Not enough assessment history yet</strong><span>Add more assessments to see this student's performance trend.</span></div>`;
  const slots = [...new Map(marks.map((mark) => [`${mark.assessmentDate}\u0000${mark.assessmentLabel}`, { date: mark.assessmentDate, label: mark.assessmentLabel }])).values()];
  const sparse = slots.length < 2 ? `<div class="analytics-inline-note"><strong>Not enough assessment history yet</strong><span>Add more assessments to see this student's performance trend. The available result is shown below.</span></div>` : "";
  return `${sparse}${renderPerformanceHistoryChart(marks, formatDate)}`;
}

function renderSubjectPerformance(student) {
  if (student.subjectMarksStatus && student.subjectMarksStatus !== "ready") return "";
  const marks = getStudentNumericAssessmentSeries(student);
  if (!marks.length) return `<div class="analytics-empty"><strong>No numerical results recorded</strong><span>Subject percentages are available for marks-based assessments.</span></div>`;
  const bySubject = new Map();
  marks.forEach((mark) => { const list = bySubject.get(mark.subject) || []; list.push(mark); bySubject.set(mark.subject, list); });
  const rows = [...bySubject].map(([subject, entries]) => {
    const first = entries[0].percent, latest = entries[entries.length - 1].percent;
    const average = entries.reduce((sum, entry) => sum + entry.percent, 0) / entries.length;
    const delta = latest - first;
    const trend = Math.abs(delta) < 1 ? "Stable" : delta > 0 ? "Improving" : "Declining";
    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
    const trendClass = trend.toLowerCase();
    return `<div class="subject-performance-row"><strong>${escapeHtml(subject)}</strong><span class="subject-current">${latest.toFixed(1)}%<small>Latest</small></span><span class="subject-average">${average.toFixed(1)}%<small>Average</small></span><span class="subject-trend ${trendClass}">${sign}${delta.toFixed(1)} pp<small>${trend}</small></span></div>`;
  }).join("");
  return `<div class="subject-performance-table"><div class="subject-performance-head"><span>Subject</span><span>Current</span><span>Average</span><span>Change from first</span></div>${rows}</div>`;
}

function renderSkillDevelopment(student) {
  const values = ASSESSMENT_KEYS.map((item) => ({ label: item.label, value: Number(student.assessments?.[item.key]) }));
  if (!values.length || values.some((item) => !Number.isFinite(item.value) || item.value < 0 || item.value > 100)) return `<div class="analytics-empty"><strong>Skill assessment data is incomplete</strong><span>A skill chart appears when all six teacher-assessed values are available.</span></div>`;
  const cx = 230, cy = 185, radius = 125, angles = values.map((_, index) => -Math.PI / 2 + index * Math.PI * 2 / values.length);
  const coordinate = (angle, distance) => `${(cx + Math.cos(angle) * distance).toFixed(1)},${(cy + Math.sin(angle) * distance).toFixed(1)}`;
  const rings = [25, 50, 75, 100].map((level) => `<polygon class="radar-ring" points="${angles.map((angle) => coordinate(angle, radius * level / 100)).join(" ")}"/>`).join("");
  const axes = angles.map((angle) => `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(angle) * radius).toFixed(1)}" y2="${(cy + Math.sin(angle) * radius).toFixed(1)}"/>`).join("");
  const polygon = values.map((item, index) => coordinate(angles[index], radius * item.value / 100)).join(" ");
  const points = values.map((item, index) => { const [x, y] = coordinate(angles[index], radius * item.value / 100).split(","); return `<circle class="radar-point" cx="${x}" cy="${y}" r="4"><title>${escapeHtml(item.label)}: ${item.value}%</title></circle>`; }).join("");
  const labels = values.map((item, index) => { const x = cx + Math.cos(angles[index]) * (radius + 28), y = cy + Math.sin(angles[index]) * (radius + 28); const anchor = x < cx - 18 ? "end" : x > cx + 18 ? "start" : "middle"; return `<text class="radar-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${escapeHtml(item.label)}</text>`; }).join("");
  const ranked = [...values].sort((a, b) => b.value - a.value);
  return `<div class="skill-development-layout"><div class="radar-chart-wrap"><svg class="radar-chart" viewBox="0 0 460 370" role="img" aria-label="Teacher assessed skill development radar chart">${rings}${axes}<polygon class="radar-area" points="${polygon}"/>${points}${labels}</svg></div><div class="skill-summary"><span class="skill-summary-label">Strength</span><strong>${escapeHtml(ranked[0].label)} · ${ranked[0].value}%</strong><span class="skill-summary-label">Development focus</span><strong>${escapeHtml(ranked[ranked.length - 1].label)} · ${ranked[ranked.length - 1].value}%</strong><p>Based on teacher-assessed values recorded for this student.</p></div></div>`;
}

function renderMarkSummary(student) {
  const allMarks = student.subjectMarks || [];
  if (student.subjectMarksStatus && student.subjectMarksStatus !== "ready") return "";
  const marks = allMarks.filter(isNumericSubjectMark);
  if (!marks.length) return allMarks.length
    ? `<p class="marks-evidence-note">Grade results are recorded in the assessment history. No numerical marks were inferred from those grades.</p>`
    : `<p class="marks-evidence-note">No marks have been recorded. Add a subject assessment to see current results and recommendations.</p>`;
  const latest = [...marks].sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate))[0];
  const bySubject = new Map();
  for (const mark of marks) { const list = bySubject.get(mark.subject) || []; list.push(mark); bySubject.set(mark.subject, list); }
  const improvements = [...bySubject].flatMap(([subject, list]) => {
    if (list.length < 2) return [];
    list.sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate));
    return [{ subject, delta: list[list.length - 1].obtainedMarks / list[list.length - 1].maxMarks * 100 - list[0].obtainedMarks / list[0].maxMarks * 100 }];
  }).filter((entry) => entry.delta > 0).sort((a, b) => b.delta - a.delta);
  const insights = getSubjectMarkInsights(student);
  const support = insights.support.slice().sort((a, b) => a.average - b.average)[0];
  const nextStep = support ? (() => {
    const last = [...support.marks].sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate))[0];
    return `For ${support.subject}, review the marked questions from ${last.assessmentLabel}, write down the missed concepts from the teacher's feedback, and redo those questions before the next assessment.`;
  })() : insights.qualified.length ? "No subject is currently 5 or more percentage points below the student's cross-subject average. Continue collecting comparable assessments to identify a specific support need." : "Add a second assessment in the same subject before drawing a comparison or tailored support conclusion.";
  return `<div class="marks-summary-grid"><div><small>Latest assessment</small><strong>${escapeHtml(latest.subject)} · ${latest.obtainedMarks}/${latest.maxMarks} (${(latest.obtainedMarks / latest.maxMarks * 100).toFixed(1)}%)</strong><span>${escapeHtml(latest.assessmentLabel)} · ${formatDate(latest.assessmentDate)}</span></div><div><small>Biggest improvement</small><strong>${improvements[0] ? `${escapeHtml(improvements[0].subject)} +${improvements[0].delta.toFixed(1)} pp` : "Not enough repeated data"}</strong><span>${improvements[0] ? "First to latest comparable assessment" : "Requires at least two assessments for a subject"}</span></div><div><small>Currently needs most support</small><strong>${support ? `${escapeHtml(support.subject)} · ${support.average.toFixed(1)}% average` : "No supported classification yet"}</strong><span>${support ? `${support.marks.length} assessments · at least 5 pp below subject average` : "At least two assessments per subject required"}</span></div><div><small>Recommended next steps</small><strong>${escapeHtml(nextStep)}</strong></div></div>`;
}

function renderMarkHistory(student) {
  if (student.subjectMarksStatus && student.subjectMarksStatus !== "ready") return "";
  const marks = [...(student.subjectMarks || [])].sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate));
  if (!marks.length) return "";
  return `<details class="mark-history"><summary>Assessment history (${marks.length})</summary><div class="mark-history-list">${marks.map((mark) => {
    const result = mark.grade ? `Grade ${escapeHtml(mark.grade)}` : isNumericSubjectMark(mark) ? `${mark.obtainedMarks}/${mark.maxMarks} (${(mark.obtainedMarks / mark.maxMarks * 100).toFixed(1)}%)` : "No result value";
    return `<div class="mark-history-row"><span><strong>${escapeHtml(mark.subject)}</strong><small>${escapeHtml(mark.assessmentLabel)} - ${formatDate(mark.assessmentDate)}</small></span><span>${result}</span><button class="small-btn" data-action="edit-subject-mark" data-student-id="${student.id}" data-mark-id="${mark.id}">Edit</button></div>`;
  }).join("")}</div></details>`;
}

function renderSubjectMarksUnavailable(status, detail = "") {
  const messages = {
    "missing-table": "Subject marks are not available because the subject_assessments table is missing. Other student report data is still available.",
    "schema-mismatch": "Subject marks are temporarily unavailable because the subject_assessments database columns do not match the app. Ask the administrator to apply the supplied schema update. Other student report data is still available.",
    "access-denied": "Subject marks are currently blocked by Supabase access policies. Other student report data is still available.",
    "auth-required": "Sign in with a teacher account assigned to this class to view subject marks.",
    error: "Subject marks could not be loaded from Supabase. Other student report data is still available. Please retry later."
  };
  const message = `${messages[status] || messages.error}${detail ? ` Supabase: ${detail}` : ""}`;
  return `<p class="marks-evidence-note" role="status">${escapeHtml(message)}</p>`;
}

function renderStructuredAiAnalysis(content) {
  const allowedHeadings = ['what needs improvement', 'your action plan', 'daily practice', 'weekly target', 'progress tracking'];
  const legacyHeadingAliases = { 'what to improve next': 'your action plan', 'how to improve next': 'your action plan' };
  const sections = new Map();
  let activeSection = null;
  for (const rawLine of String(content || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.replace(/^#{1,6}\s*/, '').replace(/^\*\*(.*?)\*\*:?$/, '$1').replace(/:$/, '').replace(/^\d+[.)]\s*/, '').trim().toLowerCase();
    const sectionHeading = legacyHeadingAliases[heading] || heading;
    if (allowedHeadings.includes(sectionHeading)) {
      activeSection = sectionHeading;
      if (!sections.has(activeSection)) sections.set(activeSection, []);
      continue;
    }
    if (!activeSection || /^#{1,6}\s/.test(line)) continue;
    const item = line.replace(/^[-*•]\s*/, '').replace(/^\*\*(.*?)\*\*$/, '$1').trim();
    if (item) sections.get(activeSection).push(item);
  }
  const normalizedSections = [...sections].map(([heading, items]) => ({ heading, items }));
  return normalizedSections.length
    ? renderAnalysisSections(normalizedSections)
    : '<p class="analysis-empty">The AI response did not contain a usable subject improvement plan. Try again.</p>';
}

function renderAnalysisSections(sections) {
  return `<div class="subject-analysis-sections">${sections.map(({ heading, items }) => `<section class="subject-analysis-section"><h4>${escapeHtml(heading.replace(/\b\w/g, (letter) => letter.toUpperCase()))}</h4>${items?.length ? `<ul class="analysis-actions-list">${items.map((item) => `<li>${escapeHtml(item.replace(/\*\*/g, ''))}</li>`).join('')}</ul>` : '<p class="analysis-empty">No subject-specific guidance is available for this section.</p>'}</section>`).join('')}</div>`;
}

function renderAiAnalysis(content) {
  return renderStructuredAiAnalysis(content);
}

function renderAiAnalysisLegacy(content) {
  const sections = { improve: [] };
  let activeSection = null;
  const lines = String(content || '').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.replace(/^#{1,6}\s*/, '').replace(/^\*\*(.*?)\*\*:?$/, '$1').replace(/:$/, '').replace(/^\d+[.)]\s*/, '').trim().toLowerCase();
    if (heading === 'how to improve next' || heading === 'what to improve next') {
      activeSection = 'improve';
      continue;
    }
    if (heading === 'current condition') {
      activeSection = 'current';
      continue;
    }
    if (activeSection !== 'improve' || /^#{1,6}\s/.test(line)) continue;
    const item = line.replace(/^[-*•]\s*/, '').replace(/^\*\*(.*?)\*\*$/, '$1').trim();
    if (item) sections[activeSection].push(item);
  }

  // Show the useful improvement recommendations without separate analysis cards.
  let remainingWords = 250;
  const renderItems = (items, limit = Infinity) => items.slice(0, limit).map((item) => {
    if (remainingWords <= 0) return '';
    const words = item.split(/\s+/);
    const visible = words.slice(0, remainingWords).join(' ');
    remainingWords -= Math.min(words.length, remainingWords);
    const formatted = visible.split(/\*\*(.+?)\*\*/g).map((part, index) =>
      index % 2 ? `<strong>${escapeHtml(part)}</strong>` : escapeHtml(part.replace(/\*+/g, ''))
    ).join('');
    return `<li>${formatted}</li>`;
  }).filter(Boolean).join('');
  return sections.improve.length
    ? `<ul class="analysis-actions-list">${renderItems(sections.improve, 4)}</ul>`
    : '<p class="analysis-empty">No improvement actions were returned in this analysis.</p>';
}

function getProfileEducationLevel(student) {
  const value = String(student?.educationLevel || student?.course || student?.program || getStudentClassLabel(student || {}) || '').toLowerCase();
  if (/10|tenth/.test(value)) return '10th standard';
  if (/11|eleventh/.test(value)) return '11th standard';
  if (/12|twelfth|puc/.test(value)) return '12th standard';
  if (/engineer|b\.?tech|b\.?e\.?|degree/i.test(value)) return 'Engineering/Degree';
  if (/standard|class|grade/.test(value)) return 'Other';
  return 'Other';
}

function createStudyWizard(student) {
  const known = student || {};
  const level = getProfileEducationLevel(known);
  const courseOptions = studyCourseOptions(level);
  const profileCourse = known.course || known.program || getStudentClassLabel(known);
  const course = courseOptions.find((option) => option.toLowerCase() === String(profileCourse || '').toLowerCase()) || (level === '10th standard' ? level : '');
  const profileYear = String(known.year || known.yearOrSemester || profileCourse || '');
  const year = ['1st year', '2nd year', '3rd year', '4th year'].find((option) => new RegExp(option.replace(/\s/g, '\\s*'), 'i').test(profileYear)) || '';
  const profileSemester = String(known.semester || known.yearOrSemester || '');
  const semester = ['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8'].find((option) => new RegExp(option.replace(/\s/g, '\\s*'), 'i').test(profileSemester)) || '';
  return {
    step: 2,
    education: {
      educationLevel: level,
      course,
      year,
      semester,
      universityBoard: known.universityBoard || known.university || known.board || '',
      scheme: known.syllabusScheme || known.scheme || ''
    },
    syllabusRecord: null, sourceTitle: '', sourceLabel: '', subjects: [],
    subjectIndex: '', sectionIndex: '', difficulty: '', error: '', lookupError: '', useUploadFallback: true
  };
}

function studyCourseOptions(level) {
  if (level === '10th standard') return ['10th standard'];
  if (level === '11th standard') return ['11th standard Science', '11th standard Commerce', '11th standard Arts/Humanities'];
  if (level === '12th standard') return ['12th standard Science', '12th standard Commerce', '12th standard Arts/Humanities'];
  if (level === 'Engineering/Degree') return ['B.E./B.Tech CSE Stream', 'B.E./B.Tech CSE (AI/ML)', 'B.E./B.Tech other branch', 'Other degree course'];
  return ['Other'];
}

function studyCourseOptionsMarkup(level, selected) {
  return studyCourseOptions(level).map((item) => `<option ${item === selected ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('');
}

function renderStudyPlanForm(student) {
  const wizard = state.ui.studyWizard || createStudyWizard(student);
  state.ui.studyWizard = wizard;
  const step = wizard.step;
  const displayStep = step - 1;
  const titles = ['Choose subject and module', 'Choose difficulty'];
  const progress = titles.map((title, index) => `<span class="study-wizard-step ${index + 1 === displayStep ? 'active' : index + 1 < displayStep ? 'done' : ''}"><b>${index + 1}</b>${escapeHtml(title)}</span>`).join('');
  let body = '';
  if (step === 2) {
    if (wizard.lookupError && !wizard.useUploadFallback) {
      body = `<div class="study-plan-unavailable"><h3>We couldn't verify this syllabus yet.</h3><p>${escapeHtml(wizard.lookupError)}</p>${wizard.sourceUrl ? `<p><a href="${escapeHtml(wizard.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open the official syllabus source</a> to confirm your details.</p>` : ''}<p>Choose a different course or source, or upload a syllabus PDF only when the exact syllabus is not in the catalogue.</p><div class="study-wizard-actions"><button type="button" class="btn-secondary" data-action="study-back">Back</button><button type="button" class="btn-primary" data-action="study-upload-fallback">Upload syllabus PDF</button></div></div>`;
    } else if (wizard.useUploadFallback) {
      body = `<form id="study-source-form"><p class="study-plan-helper">Upload the syllabus used for your class. Mentora will read its subjects and modules so you can choose what to study.</p><label class="study-upload-dropzone" for="study-syllabus-pdf"><strong>Upload syllabus PDF</strong><span>Drag &amp; drop / Browse file</span><small data-study-filename>No file selected · PDF up to 3 MB</small><input id="study-syllabus-pdf" name="syllabusPdf" type="file" accept="application/pdf,.pdf" /></label><div class="field"><label for="study-syllabus-text">Or paste an outline</label><textarea class="input" id="study-syllabus-text" name="syllabusText" rows="3" maxlength="40000" placeholder="Paste subject, module/chapter titles, and syllabus topics"></textarea></div>${wizard.error ? `<p class="study-plan-error" role="alert">${escapeHtml(wizard.error)}</p>` : ''}<div class="study-wizard-actions"><button type="button" class="btn-secondary" data-action="close-study-plan">Cancel</button><button class="btn-primary" type="submit" ${state.ui.studyPlanLoading ? 'disabled' : ''}>${state.ui.studyPlanLoading ? '<span class="loader"></span> Reading syllabus...' : 'Continue'}</button></div></form>`;
    } else {
      const subject = wizard.subjectIndex === '' ? null : wizard.subjects[Number(wizard.subjectIndex)] || null;
      const sections = subject?.sections || [];
      const section = wizard.sectionIndex === '' || wizard.sectionIndex === 'all' ? null : sections[Number(wizard.sectionIndex)];
      const sectionOptions = subject ? `<option value="all" ${wizard.sectionIndex === 'all' ? 'selected' : ''}>Entire subject (${sections.length} modules/chapters)</option>${sections.map((entry, index) => `<option value="${index}" ${String(index) === wizard.sectionIndex ? 'selected' : ''}>${escapeHtml(entry.name)} (${entry.topics.length} topics)</option>`).join('')}` : '';
      const topicPreview = wizard.sectionIndex === 'all' && subject ? sections.flatMap((entry) => entry.topics.map((topic) => `${entry.name}: ${topic}`)) : section?.topics || [];
      const sourceText = wizard.verified ? `Verified syllabus source: <a href="${escapeHtml(subject?.sourceUrl || wizard.syllabusRecord.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(subject?.name ? `${subject.name} - ${wizard.syllabusRecord.sourceTitle}` : wizard.syllabusRecord.sourceTitle)}</a>` : `Student-provided syllabus: ${escapeHtml(wizard.syllabusRecord?.sourceTitle || 'uploaded/pasted outline')} (not independently verified)`;
      body = `<p class="study-plan-source-badge">${sourceText}</p><form id="study-selection-form"><div class="study-plan-fields"><div class="field"><label for="study-subject">Subject</label><select class="select" id="study-subject" name="subjectIndex" required><option value="">Select subject</option>${wizard.subjects.map((entry, index) => `<option value="${index}" ${String(index) === wizard.subjectIndex ? 'selected' : ''}>${escapeHtml(entry.name)} (${escapeHtml(entry.code || 'code not listed')})</option>`).join('')}</select></div><div class="field"><label for="study-section">Module / chapter</label><select class="select" id="study-section" name="sectionIndex" required ${subject ? '' : 'disabled'}><option value="">Select module / chapter</option>${sectionOptions}</select></div></div>${topicPreview.length ? `<div class="study-topic-preview"><h3>Topics in this selection</h3><ul>${topicPreview.map((topic) => `<li>${escapeHtml(topic)}</li>`).join('')}</ul></div>` : '<p class="study-plan-helper">Select a subject, then choose a module/chapter to preview the syllabus topics.</p>'}${wizard.error ? `<p class="study-plan-error" role="alert">${escapeHtml(wizard.error)}</p>` : ''}<div class="study-wizard-actions"><button type="button" class="btn-secondary" data-action="study-back">Back</button><button class="btn-primary" type="submit">Continue</button></div></form>`;
    }
  } else {
    body = `<form id="study-plan-generate-form"><p class="study-plan-source-badge"><strong>${escapeHtml(wizard.selectedSubject?.name || '')}</strong> · ${escapeHtml(wizard.selectedSection?.name || '')}<br>${wizard.verified ? 'Verified syllabus catalogue' : 'Student-provided syllabus (not independently verified)'}</p><div class="study-difficulty-cards">${['Easy', 'Medium', 'Hard', 'Very difficult'].map((level) => `<label class="study-difficulty-option ${wizard.difficulty === level ? 'selected' : ''}"><input type="radio" name="difficulty" value="${level}" ${wizard.difficulty === level ? 'checked' : ''} required><span><strong>${level}</strong><small>${level === 'Easy' ? 'Guided foundations and smaller chunks' : level === 'Medium' ? 'Balanced learning and practice' : level === 'Hard' ? 'Deeper application and challenging problems' : 'Advanced multi-step practice'}</small></span></label>`).join('')}</div>${wizard.error ? `<p class="study-plan-error" role="alert">${escapeHtml(wizard.error)}</p>` : ''}<div class="study-wizard-actions"><button type="button" class="btn-secondary" data-action="study-back">Back</button><button class="btn-primary study-generate" type="submit" ${state.ui.studyPlanLoading ? 'disabled' : ''}>${state.ui.studyPlanLoading ? '<span class="loader"></span> Generating plan...' : 'Generate My 7-Day Plan'}</button></div></form>`;
  }
  const title = titles[displayStep - 1] || titles[0];
  const subtitle = step === 2 ? 'Upload or select the syllabus material you want to study.' : 'Choose how challenging you want your study plan to be.';
  return `<section class="study-plan-form-card" aria-labelledby="study-plan-form-title"><div class="study-plan-form-heading"><div><p class="kicker">Syllabus-aware study planner · Step ${displayStep} of 2</p><h2 id="study-plan-form-title">${title}</h2><p>${subtitle}</p></div><button class="close-btn" data-action="close-study-plan" aria-label="Close" ${state.ui.studyPlanLoading ? 'disabled' : ''}>×</button></div><div class="study-wizard-progress">${progress}</div>${body}</section>`;
}
function renderStudyPlan(plan) {
  const completed = state.ui.studyPlanCompleted || [];
  const count = completed.length;
  return `<section class="study-plan-result" aria-labelledby="study-plan-title"><div class="study-plan-result-head"><div><p class="kicker">Your syllabus-based learning week</p><h2 id="study-plan-title">${escapeHtml(plan.subject)} - ${escapeHtml(plan.section)} (${escapeHtml(plan.difficulty)})</h2><p>Seven focused days, one step at a time.</p></div><div class="study-plan-result-actions"><button class="btn-secondary" data-action="download-study-plan">Download Study Plan as PDF</button><button class="btn-primary" data-action="another-study-plan">Generate Another Plan</button></div></div>
    <p class="study-plan-source-badge">Course: ${escapeHtml(plan.education?.course || '')} - ${escapeHtml(plan.education?.year || '')} - ${escapeHtml(plan.education?.semester || '')}<br>University / board: ${escapeHtml(plan.education?.universityBoard || '')} - Scheme: ${escapeHtml(plan.education?.scheme || '')}<br>Subject code: ${escapeHtml(plan.code || 'Not provided')} - Source: ${escapeHtml(plan.syllabusSource)} (${plan.syllabusVerified ? 'verified catalogue content' : 'student-provided; not independently verified'})</p>
    <div class="study-progress"><div><strong>Your progress</strong><span>${count} of 7 days complete</span></div><progress max="7" value="${count}" aria-label="${count} of 7 study days complete"></progress></div>
    <div class="study-days">${plan.days.map((day) => `<article class="study-day-card"><div class="study-day-title"><span class="study-day-number">DAY ${day.day}</span><label class="study-day-check"><input type="checkbox" data-study-day="${day.day}" ${completed.includes(day.day) ? 'checked' : ''} aria-label="Mark day ${day.day} complete"><span>Complete</span></label></div><h3>${escapeHtml(day.topic)}</h3><h4>Concepts to learn</h4><ul>${day.concepts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h4>Steps to complete</h4><ol>${day.tasks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol><h4>Practice</h4><ul>${day.practice.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><div class="study-day-note"><strong>Quick revision</strong><p>${escapeHtml(day.revision)}</p></div><div class="study-day-goal"><strong>Daily goal</strong><p>${escapeHtml(day.goal)}</p></div></article>`).join('')}</div>
    <div class="study-plan-wrapup"><article><h3>Syllabus topic coverage</h3><ul>${plan.topicCoverage.map((item) => `<li><strong>${escapeHtml(item.topic)}</strong> - ${escapeHtml(item.day)} - ${escapeHtml(item.status)}</li>`).join('')}</ul></article><article><h3>Revision checklist</h3><ul class="study-checklist">${plan.revisionChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article class="study-self-assessment"><h3>Final practice test and answer key</h3><ol>${plan.finalPracticeTest.map((item) => `<li>${escapeHtml(item.question)}<p><strong>Answer:</strong> ${escapeHtml(item.answer)}</p></li>`).join('')}</ol><h3>Self-assessment checklist</h3><ul>${plan.selfAssessment.map((item) => `<li><strong>${escapeHtml(item.topic)}:</strong> ${escapeHtml(item.check)}</li>`).join('')}</ul></article></div>
    </section>`;
}
function buildAnalysis(student) {
  const scores = student.assessments;
  const strongest = getHighestAssessment(scores);
  const weakest = getLowestAssessment(scores);
  const evidence = [
    `${strongest.label}: ${scores[strongest.key]} / 100`,
    `${weakest.label}: ${scores[weakest.key]} / 100`,
    student.strongSubjects.length ? `Strong subjects: ${student.strongSubjects.join(", ")}` : "No strong subjects recorded.",
    student.weakSubjects.length ? `Weak subjects: ${student.weakSubjects.join(", ")}` : "No weak subjects recorded.",
    student.learningHabits.length ? `Learning habits: ${student.learningHabits.join(", ")}` : "No learning habits recorded.",
    student.observations.length
      ? `Latest observation: ${student.observations[student.observations.length - 1].note}`
      : "Teacher has not yet added a recent observation.",
    student.interventions.length ? `Previous intervention: ${student.interventions[student.interventions.length - 1]?.title || "Recorded"}` : "No previous intervention recorded."
  ];

  const patternText = createPatternText(student, strongest, weakest);
  const interpretation = createInterpretation(student, strongest, weakest, patternText);
  const recommendedActions = createRecommendedActions(student, strongest, weakest);
  const followUp = student.observations.length < 2 || !student.observations.some((obs) => obs.category === "Participation" || obs.category === "Teamwork")
    ? {
        message: "We don't have enough information about how this student behaves during group work.",
        question: "How does this student usually contribute during group projects?"
      }
    : null;

  return {
    studentId: student.id,
    studentName: student.name,
    snapshot: `${student.name} demonstrates ${strongest.label.toLowerCase()} and areas of ${weakest.label.toLowerCase()} in the current profile.`,
    strengths: getStrengthList(student),
    developmentAreas: getDevelopmentList(student),
    patterns: patternText,
    interpretation,
    evidence,
    recommendedActions,
    followUpQuestion: followUp,
  };
}

function createPatternText(student, strongest, weakest) {
  if (strongest.key === "problemSolving" && weakest.key === "communication") {
    return "Strong independent problem solving is visible, while communication and participation remain developing areas.";
  }
  if (student.assessments.academic < 60 && student.assessments.consistency > 70) {
    return "Academic foundations need reinforcement, but the student shows consistent effort and willingness to work through examples.";
  }
  if (student.assessments.participation > 80 && student.assessments.academic < 60) {
    return "Participation is strong, but conceptual understanding needs more guided practice before the student can contribute with confidence.";
  }
  if (student.assessments.teamwork > 80 && student.assessments.participation < 60) {
    return "Collaboration is strong, but the student is less visible during whole-class contributions and group discussion.";
  }
  if (strongest.key === "communication" && weakest.key === "academic") {
    return "The student communicates with confidence but is still building the deeper conceptual understanding needed for independent problem solving.";
  }
  return "The student's pattern suggests a combination of strengths and emerging needs that should be monitored with targeted classroom checks.";
}

function createInterpretation(student, strongest, weakest, patternText) {
  const latestObservation = student.observations[student.observations.length - 1];
  const observationSummary = latestObservation ? latestObservation.note : "The current observations and scores suggest a clear learning pattern.";

  if (strongest.key === "problemSolving" && weakest.key === "communication") {
    return `Strong independent problem solving is visible, while communication and participation are developing areas. The observation notes suggest the student may benefit from structured opportunities to explain reasoning aloud. ${observationSummary}`;
  }

  if (student.assessments.academic < 60 && student.assessments.consistency > 70) {
    return `The student shows consistent effort and is willing to work through examples, but the current profile suggests foundational gaps in core understanding. Targeted concept checks and scaffolded practice can help turn effort into stronger academic confidence. ${observationSummary}`;
  }

  if (student.assessments.participation > 80 && student.assessments.academic < 60) {
    return `The student participates confidently, but the learning profile indicates that strong classroom engagement is not yet matched by conceptual fluency. Guided concept reinforcement and worked examples may help connect participation to stronger understanding. ${observationSummary}`;
  }

  if (student.assessments.teamwork > 80 && student.assessments.participation < 60) {
    return `The student is highly collaborative and supports peers well, but whole-group participation is still limited. This may be an opportunity to build confidence in sharing ideas publicly while keeping the strengths in teamwork visible. ${observationSummary}`;
  }

  return `${patternText} The evidence suggests the teacher should connect observational strengths to specific, repeatable classroom routines so the student can practise those skills in context. ${observationSummary}`;
}

function createRecommendedActions(student, strongest, weakest) {
  const actions = [];

  if (strongest.key === "problemSolving" && weakest.key === "communication") {
    actions.push({
      id: generateId("act"),
      week: "WEEK 1",
      action: "Ask the student to explain one solved problem to a partner.",
      purpose: "Build confidence in verbal reasoning and concept explanation.",
      started: false,
      completed: false,
    });
    actions.push({
      id: generateId("act"),
      week: "WEEK 2",
      action: "Ask for a two-minute explanation to the class or teacher.",
      purpose: "Make the explanation more concise and structured.",
      started: false,
      completed: false,
    });
    actions.push({
      id: generateId("act"),
      week: "WEEK 3",
      action: "Ask the student to explain the solution to a small group.",
      purpose: "Turn isolated success into confident public communication.",
      started: false,
      completed: false,
    });
  } else if (student.assessments.academic < 60 && student.assessments.consistency > 70) {
    actions.push({
      id: generateId("act"),
      week: "WEEK 1",
      action: "Use one worked example and one guided practice task every lesson.",
      purpose: "Strengthen foundational understanding with clear modelling.",
      started: false,
      completed: false,
    });
    actions.push({
      id: generateId("act"),
      week: "WEEK 2",
      action: "Check for concept retention using a quick exit ticket.",
      purpose: "Confirm whether the skill is transferring beyond the modelled example.",
      started: false,
      completed: false,
    });
    actions.push({
      id: generateId("act"),
      week: "WEEK 3",
      action: "Assign a short independent task with teacher feedback on one concept.",
      purpose: "Move from supported practice to independent application.",
      started: false,
      completed: false,
    });
  } else if (student.assessments.participation > 80 && student.assessments.academic < 60) {
    actions.push({
      id: generateId("act"),
      week: "WEEK 1",
      action: "Pair the student with a peer for guided concept rehearsal.",
      purpose: "Connect participation to stronger concept understanding.",
      started: false,
      completed: false,
    });
    actions.push({
      id: generateId("act"),
      week: "WEEK 2",
      action: "Ask the student to explain one concept before a small group discussion.",
      purpose: "Build confidence using classroom participation to reinforce learning.",
      started: false,
      completed: false,
    });
    actions.push({
      id: generateId("act"),
      week: "WEEK 3",
      action: "Provide a short reflection after concept practice.",
      purpose: "Monitor whether active talking leads to deeper understanding.",
      started: false,
      completed: false,
    });
  } else {
    actions.push({
      id: generateId("act"),
      week: "WEEK 1",
      action: "Invite the student to lead a short cooperative problem-solving task.",
      purpose: "Use existing strengths to create structured opportunities for growth.",
      started: false,
      completed: false,
    });
    actions.push({
      id: generateId("act"),
      week: "WEEK 2",
      action: "Add a reflection prompt after collaborative work.",
      purpose: "Capture how the student contributed and what they learned.",
      started: false,
      completed: false,
    });
    actions.push({
      id: generateId("act"),
      week: "WEEK 3",
      action: "Review student progress with a short follow-up check-in.",
      purpose: "Monitor whether the strategy supports the student's next step.",
      started: false,
      completed: false,
    });
  }

  return actions;
}

function getClassAverages(students) {
  const totals = {
    academic: 0,
    communication: 0,
    problemSolving: 0,
    participation: 0,
    teamwork: 0,
    consistency: 0
  };

  if (!students.length) {
    return totals;
  }

  for (const student of students) {
    for (const key of Object.keys(totals)) {
      totals[key] += Number(student.assessments[key] || 0);
    }
  }

  for (const key of Object.keys(totals)) {
    totals[key] = totals[key] / students.length;
  }

  return totals;
}

function getCurrentClass() {
  return state.classes.find((classRecord) => classRecord.id === state.activeClassId) || null;
}

function getCurrentClassLabel() {
  const classRecord = getCurrentClass();
  return classRecord ? formatClassLabel(classRecord) : "Select Class";
}

function formatClassLabel(classRecord) {
  const standardMatch = String(classRecord.name || "").match(/^(\d+)(?:st|nd|rd|th) Standard$/);
  const className = standardMatch ? `Class ${standardMatch[1]}` : classRecord.name;
  return `${className} — Section ${classRecord.section}`;
}

function getCurrentStudents() {
  return state.students.filter((student) => student.classId === state.activeClassId);
}

function getStudentByAnyId(identifier) {
  return state.students.find((student) => student.id === identifier || student.studentId === identifier) || null;
}

function getStudentClassLabel(student) {
  const classRecord = state.classes.find((entry) => entry.id === student.classId);
  return classRecord ? formatClassLabel(classRecord) : String(student.className || "");
}

function getStudentSection(student) {
  const classRecord = state.classes.find((entry) => entry.id === student.classId);
  return classRecord?.section || student.section || "—";
}

function normalizeClassValue(value) {
  return String(value || "").toLowerCase().replace(/class|section/g, "").replace(/[^a-z0-9]/g, "");
}

function createStudentCodeCandidate() {
  const bytes = new Uint8Array(8);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return `MEN-${new Date().getFullYear()}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

async function createUniqueStudentCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = createStudentCodeCandidate();
    if (await isStudentCodeAvailable(candidate)) return candidate;
  }
  throw new Error("Mentora could not reserve a unique student code after several attempts. Please try again.");
}

function isStudentCodeCollision(error) {
  return error?.code === "23505" && /student_code|students_student_code_key/i.test(`${error.constraint || ""} ${error.message || ""}`);
}

function generateStudentRecordId() {
  return globalThis.crypto?.randomUUID ? `std-${globalThis.crypto.randomUUID()}` : generateId("std");
}

function createClassFromForm(form) {
  const formData = new FormData(form);
  const selectedClass = String(formData.get("className") || "").trim();
  const selectedSection = String(formData.get("section") || "").trim();
  const className = selectedClass === "custom"
    ? String(formData.get("customClassName") || "").trim()
    : selectedClass;
  const section = selectedSection === "custom"
    ? String(formData.get("customSection") || "").trim()
    : selectedSection;

  if (!className || !section) {
    form.reportValidity();
    return null;
  }

  return {
    id: generateId("class"),
    name: className,
    section
  };
}

function getOverallScore(assessments) {
  const values = Object.values(assessments || {});
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function getHighestAssessment(assessments) {
  return ASSESSMENT_KEYS.reduce((best, item) => {
    const value = Number(assessments[item.key] || 0);
    if (!best || value > best.value) {
      return { key: item.key, label: item.label, value };
    }
    return best;
  }, null);
}

function getLowestAssessment(assessments) {
  return ASSESSMENT_KEYS.reduce((best, item) => {
    const value = Number(assessments[item.key] || 0);
    if (!best || value < best.value) {
      return { key: item.key, label: item.label, value };
    }
    return best;
  }, null);
}

function getWeakestAssessment(assessments) {
  return getLowestAssessment(assessments)?.value ?? 0;
}

function getFilteredStudents() {
  const query = state.ui.searchQuery.trim().toLowerCase();
  return [...getCurrentStudents()].filter((student) => {
    if (!query) return true;
    return (
      student.name.toLowerCase().includes(query) ||
      String(student.rollNumber).toLowerCase().includes(query) ||
      student.strongSubjects.some((subject) => subject.toLowerCase().includes(query)) ||
      student.weakSubjects.some((subject) => subject.toLowerCase().includes(query))
    );
  });
}

function getAttentionStudents() {
  return [...getCurrentStudents()].filter((student) => {
    const overall = getOverallScore(student.assessments);
    const lowest = getWeakestAssessment(student.assessments);
    return overall < 70 || lowest < 58;
  }).sort((a, b) => getOverallScore(a.assessments) - getOverallScore(b.assessments));
}

function getStrengthList(student) {
  return getSubjectMarkInsights(student).strengths.map((entry) => `${entry.subject} (${entry.average.toFixed(1)}%)`);
}

function getDevelopmentList(student) {
  return getSubjectMarkInsights(student).support.map((entry) => `${entry.subject} (${entry.average.toFixed(1)}%)`);
}

function getAssessmentNarrative(key, value) {
  const type = {
    academic: "Concept understanding is consistent with current classroom evidence.",
    communication: "The student is using language in a way that is visible across discussions and explanations.",
    problemSolving: "Independent reasoning is evident when the student approaches a task with structure.",
    participation: "Classroom contribution is visible and can be supported with clear opportunities to share.",
    teamwork: "Collaboration strengths are evident in peer-based work and group tasks.",
    consistency: "A steady pattern of effort and follow-through is helping the student maintain growth."
  };

  const summary = type[key] || "Current assessment shows a useful starting point for teacher support.";

  if (value >= 80) return summary + " This is a strong area for continued challenge.";
  if (value >= 60) return summary + " This area is developing and may benefit from targeted practice.";
  return summary + " This area needs structured support and monitoring.";
}

function getSelectedStudent() {
  const students = getCurrentStudents();
  const id = state.ui.selectedStudentId || students[0]?.id;
  return students.find((student) => student.id === id) || students[0] || null;
}

function getStudentById(studentId) {
  return getCurrentStudents().find((student) => student.id === studentId) || null;
}

function buildClassInsights() {
  const students = getCurrentStudents();
  const strengths = [];
  const developmentAreas = [];
  const patterns = [];
  const groups = [];
  const actions = [];

  for (const item of ASSESSMENT_KEYS) {
    const average = students.reduce((sum, student) => sum + Number(student.assessments[item.key] || 0), 0) / Math.max(students.length, 1);
    if (average >= 72) strengths.push(item.label);
    if (average <= 62) developmentAreas.push(item.label);
  }

  if (students.filter((student) => student.assessments.problemSolving >= 75 && student.assessments.communication <= 60).length > 0) {
    patterns.push("Several students show strong problem-solving ability but low participation.");
  }
  if (students.filter((student) => student.assessments.academic <= 62 && student.assessments.consistency >= 70).length > 0) {
    patterns.push("Multiple students have difficulty with foundational concepts despite consistent effort.");
  }
  if (students.filter((student) => student.assessments.teamwork >= 75 && student.assessments.participation <= 60).length > 0) {
    patterns.push("Some students collaborate well but still need structured opportunities to contribute more visibly.");
  }
  if (!patterns.length) {
    patterns.push("The class profile is balanced and continues to improve with targeted classroom routines.");
  }

  if (students.filter((student) => student.assessments.problemSolving >= 75 && student.assessments.communication <= 60).length > 0) {
    groups.push("Strong academics + low participation");
  }
  if (students.filter((student) => student.assessments.academic <= 62 && student.assessments.consistency >= 70).length > 0) {
    groups.push("Developing fundamentals + consistent effort");
  }
  if (students.filter((student) => student.assessments.communication >= 75 && student.assessments.academic <= 70).length > 0) {
    groups.push("Strong communication + developing academics");
  }
  if (!groups.length) {
    groups.push("Balanced profile + steady classroom growth");
  }

  actions.push({ title: "Strengthen retrieval routines", text: "Use short concept checks at the start of lessons to reinforce core understanding before independent work." });
  actions.push({ title: "Structure speaking opportunities", text: "Create regular partner explanations and quick oral summaries to support communication and participation." });
  actions.push({ title: "Use peer support strategically", text: "Pair students with strong collaboration habits with those who need confidence in sharing ideas." });

  return { strengths, developmentAreas, patterns, groups, actions };
}

function hasRecentProgress(student, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return (student.progress || []).some((entry) => new Date(entry.date).getTime() > cutoff);
}

function getStudentStatus(student) {
  const overall = getOverallScore(student.assessments);
  if (overall < 60) {
    return { label: "Needs attention", cssClass: "needs-attention" };
  }
  if (overall >= 70 && overall <= 84) {
    return { label: "Improving", cssClass: "improving" };
  }
  return { label: "Stable", cssClass: "stable" };
}

function parseCommaList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function downloadStudentReport(student, studentView = false) {
  const analysis = state.ui.analysisByStudent?.[student.id] || null;
  const strengths = analysis?.strengths || getStrengthList(student);
  const developmentAreas = analysis?.developmentAreas || getDevelopmentList(student);
  const actions = analysis?.recommendedActions || [];
  const observations = (student.observations || []).map((observation) => `${formatDate(observation.date)} - ${observation.category}: ${observation.note}`);
  const evidence = analysis?.evidence || [
    `Assessment profile: ${Math.round(getOverallScore(student.assessments))} / 100 overall`,
    ...observations.slice(-3)
  ];
  const lines = [
    "MENTORA",
    "Student Development Report",
    "",
    `Student: ${student.name}`,
    `Student ID: ${student.studentId || "Not assigned"}`,
    `Class: ${getStudentClassLabel(student)}`,
    `Section: ${getStudentSection(student)}`,
    `Date: ${formatDate(new Date().toISOString())}`,
    "",
    "1. Academic Profile",
    `Overall teacher assessment: ${Math.round(getOverallScore(student.assessments))} / 100`,
    ...ASSESSMENT_KEYS.map((item) => `${item.label}: ${student.assessments[item.key] || 0} / 100`),
    "",
    "2. Strengths",
    ...strengths.map((item) => `- ${item}`),
    "",
    "3. Development Areas",
    ...developmentAreas.map((item) => `- ${item}`),
    "",
    "4. Teacher Observations",
    ...(studentView ? ["Teacher-only notes are not included in the student report."] : (observations.length ? observations : ["No teacher observations recorded."])),
    "",
    "5. AI Analysis",
    analysis?.interpretation || "No AI analysis has been generated yet.",
    "AI interpretation is guidance based on teacher-provided information, not a confirmed fact.",
    "",
    "6. Evidence Used",
    ...(studentView ? evidence.filter((item) => !String(item).toLowerCase().includes("observation")) : evidence),
    "",
    "7. Recommended Intervention",
    ...(actions.length ? actions.map((item) => `${item.week}: ${item.action} Purpose: ${item.purpose}`) : ["No recommended actions recorded."]),
    "",
    "8. Progress / Previous Assessments",
    ...((student.progress || []).slice(-6).map((item) => `${formatDate(item.date)} - ${item.note}`) || ["No progress history recorded."]),
    "Subject assessment history",
    ...(student.subjectMarksStatus && student.subjectMarksStatus !== "ready"
      ? [`Subject marks unavailable: ${student.subjectMarksStatus === "missing-table" ? "the database table is missing" : student.subjectMarksStatus === "schema-mismatch" ? "the database columns do not match the app" : student.subjectMarksStatus === "access-denied" ? "database access policies blocked this query" : "the database query failed"}.`]
      : (student.subjectMarks || []).length
      ? student.subjectMarks.map((mark) => mark.grade
        ? `${formatDate(mark.assessmentDate)} - ${mark.subject}, ${mark.assessmentLabel}: Grade ${mark.grade}`
        : isNumericSubjectMark(mark) ? `${formatDate(mark.assessmentDate)} - ${mark.subject}, ${mark.assessmentLabel}: ${mark.obtainedMarks}/${mark.maxMarks} (${(mark.obtainedMarks / mark.maxMarks * 100).toFixed(1)}%)`
          : `${formatDate(mark.assessmentDate)} - ${mark.subject}, ${mark.assessmentLabel}: no numeric result`)
      : ["No subject marks recorded yet."]),
    "",
    "9. Next Steps",
    "Review this report with the teacher and agree on one focused next step.",
    ""
  ];
  const pdf = createTextPdf(lines);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `mentora-${student.studentId || "student"}-report.pdf`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 1000);
}

function downloadStudyPlan(plan) {
  const lines = [
    "MENTORA | SYLLABUS-BASED 7-DAY STUDY PLAN",
    `Education: ${plan.education?.educationLevel || ""} | Course: ${plan.education?.course || ""}`,
    `Year: ${plan.education?.year || ""} | Semester: ${plan.education?.semester || ""}`,
    `University/Board: ${plan.education?.universityBoard || ""} | Scheme: ${plan.education?.scheme || ""}`,
    `Subject: ${plan.subject} ${plan.code ? `(${plan.code})` : ""}`,
    `Selected module/chapter: ${plan.section}`,
    `Difficulty: ${plan.difficulty}`,
    `Syllabus source: ${plan.syllabusSource} (${plan.syllabusVerified ? "verified catalogue content" : "student-provided; not independently verified"})`,
    "",
    "SELECTED SYLLABUS TOPICS",
    ...plan.syllabusTopics.map((topic) => `- ${topic}`),
    "",
    "SEVEN-DAY STUDY PLAN"
  ];
  for (const day of plan.days) {
    lines.push("", `DAY ${day.day}: ${day.topic}`, "Concepts to understand:");
    day.concepts.forEach((item) => lines.push(`- ${item}`));
    lines.push("Step-by-step tasks:");
    day.tasks.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
    lines.push("Practice questions/exercises:");
    day.practice.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
    lines.push(`Revision: ${day.revision}`, `Daily goal: ${day.goal}`);
  }
  lines.push("", "SYLLABUS TOPIC COVERAGE");
  plan.topicCoverage.forEach((item) => lines.push(`- ${item.topic} | ${item.day} | ${item.status}`));
  lines.push("", "REVISION CHECKLIST");
  plan.revisionChecklist.forEach((item) => lines.push(`[ ] ${item}`));
  lines.push("", "FINAL PRACTICE TEST AND ANSWER KEY");
  plan.finalPracticeTest.forEach((item, index) => lines.push(`${index + 1}. ${item.question}`, `Answer: ${item.answer}`));
  lines.push("", "SELF-ASSESSMENT CHECKLIST");
  plan.selfAssessment.forEach((item) => lines.push(`[ ] ${item.topic}: ${item.check}`));
  const wrapped = lines.flatMap((line) => wrapPdfLine(line, 88));
  const blob = new Blob([createTextPdf(wrapped)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const slug = String(plan.subject).normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Subject";
  anchor.download = `Mentora_${slug}_7_Day_Study_Plan.pdf`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => { URL.revokeObjectURL(url); anchor.remove(); }, 1000);
}
function wrapPdfLine(value, width) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (!word) { if (!current && !lines.length) lines.push(""); continue; }
    if (word.length > width) {
      if (current) lines.push(current);
      for (let index = 0; index < word.length; index += width) lines.push(word.slice(index, index + width));
      current = "";
    } else if (!current) current = word;
    else if (`${current} ${word}`.length <= width) current += ` ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function createTextPdf(lines) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 48;
  const lineHeight = 14;
  const maxLines = 51;
  const pages = [];
  for (let index = 0; index < lines.length; index += maxLines) pages.push(lines.slice(index, index + maxLines));
  const objects = [];
  const addObject = (value) => { objects.push(value); return objects.length; };
  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];
  pages.forEach((pageLines, pageIndex) => {
    let stream = "BT\n/F1 10 Tf\n";
    pageLines.forEach((line, index) => {
      const safe = String(line).replace(/[^\x20-\x7E]/g, "?").replace(/[()\\]/g, "\\$&").slice(0, 105);
      const y = pageHeight - margin - index * lineHeight;
      stream += `1 0 0 1 ${margin} ${y} Tm (${safe}) Tj\n`;
    });
    stream += `1 0 0 1 ${pageWidth - 105} 24 Tm (Page ${pageIndex + 1} of ${pages.length}) Tj\n`;
    stream += "ET";
    const streamId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`));
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  // Keep every byte ASCII so xref offsets based on string length match Blob byte offsets.
  let pdf = "%PDF-1.4\n% Mentora document\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getInitials(name) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

window.addEventListener("beforeunload", saveState);
