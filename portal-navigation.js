const SCREEN_PATHS = {
  "teacher-login": "/teacher/login",
  "teacher-signup": "/teacher/signup",
  "class-selection": "/teacher/classes",
  dashboard: "/teacher/overview",
  students: "/teacher/students",
  insights: "/teacher/insights",
  "teacher-ai": "/teacher/ai",
  "student-login": "/student/login",
  "student-category-selection": "/student/category",
  "student-dashboard": "/student",
  "student-performance": "/student/performance",
  "student-subjects": "/student/subjects",
  "student-assessments": "/student/assessments",
  "student-study-plan": "/student/improvement-plan",
  "student-visualize": "/student/visualize",
  "student-video-visualize": "/student/video-visualize",
  "student-coding-practice": "/student/coding-practice",
  "student-anatomy-study": "/student/anatomy-study",
  "student-medical-case-simulator": "/student/medical-case-simulator",
  "student-games": "/student/games",
  "student-ai": "/student/ai",
  "student-events": "/student-events",
  landing: "/"
};

const STUDENT_NAV_ITEMS = [
  { screen: "student-dashboard", label: "Overview" },
  { screen: "student-visualize", label: "Visualize My Doubt" },
  { screen: "student-performance", label: "My Performance" },
  { screen: "student-subjects", label: "Subjects" },
  { screen: "student-assessments", label: "Assessments" },
  { screen: "student-study-plan", label: "My Improvement Plan" },
  { screen: "student-ai", label: "AI Assistant" },
  { screen: "student-events", label: "Events &amp; Opportunities" }
];

export function pathForScreen(screen, studentId = "") {
  if (screen === "student-profile" && studentId) {
    return `/teacher/students/${encodeURIComponent(studentId)}`;
  }
  return SCREEN_PATHS[screen] || "/";
}

export function resolvePortalRoute(pathname) {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/") return { screen: "landing" };
  if (normalizedPath === "/student-events" || normalizedPath === "/student/events") return { screen: "student-events" };
  const staticRoute = Object.entries(SCREEN_PATHS).find(([, path]) => path === normalizedPath);
  if (staticRoute) return { screen: staticRoute[0] };
  const profile = normalizedPath.match(/^\/teacher\/students\/([^/]+)$/);
  if (profile) {
    try {
      return { screen: "student-profile", studentId: decodeURIComponent(profile[1]) };
    } catch {
      return null;
    }
  }
  return null;
}

export function renderStudentSidebar(activeScreen) {
  const items = STUDENT_NAV_ITEMS.map(({ screen, label }) =>
    `<a class="student-side-link ${activeScreen === screen ? "active" : ""}" href="${pathForScreen(screen)}" data-route-screen="${screen}"${activeScreen === screen ? ' aria-current="page"' : ""}>${label}</a>`
  ).join("");
  return `<aside class="student-sidebar"><a class="landing-brand" href="${pathForScreen("student-dashboard")}" data-route-screen="student-dashboard" aria-label="Mentora student dashboard"><img class="portal-sidebar-logo" src="/mentora-logo.png" alt="Mentora" /></a><p class="student-side-label">LEARNING SPACE</p><nav aria-label="Student portal">${items}</nav><div class="student-side-footer"><a class="student-side-link" href="${pathForScreen("student-dashboard")}" data-route-screen="student-dashboard">Home</a><button class="student-side-link" data-action="student-logout">Log out</button></div></aside>`;
}
