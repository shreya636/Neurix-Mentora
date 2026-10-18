export const STUDENT_CATEGORIES = [
  { id: "primary", title: "1st–5th Grade", description: "Build early skills with friendly lessons and games.", icon: "✦" },
  { id: "secondary", title: "6th–12th Grade", description: "Continue school learning with your existing study tools.", icon: "▤" },
  { id: "doctors", title: "MBBS", description: "Explore medical learning, human anatomy, and clinical cases.", icon: "＋" },
  { id: "engineers", title: "Engineers", description: "Strengthen engineering skills with coding practice.", icon: "⌘" }
];

const FEATURE_CATEGORIES = {
  "student-games": "primary",
  "student-anatomy-study": "doctors",
  "student-medical-case-simulator": "doctors",
  "student-coding-practice": "engineers"
};

export function isStudentCategory(value) {
  return STUDENT_CATEGORIES.some((category) => category.id === value);
}

export function categoryForStudentScreen(screen) {
  return FEATURE_CATEGORIES[screen] || null;
}
