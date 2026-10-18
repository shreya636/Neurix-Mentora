import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the app.");
  }
  return supabase;
}

function statusIsVisible(event) {
  const value = String(event?.status || "").trim().toUpperCase();
  return value === "" || value === "PUBLISHED" || value === "UPCOMING" || value === "ONGOING";
}

export async function fetchPublishedEvents() {
  const today = new Date().toISOString().slice(0, 10);
  const pageSize = 1000;
  const events = [];
  let offset = 0;
  while (true) {
    const result = await requireSupabase().from("events")
      .select("*")
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    throwIfError(result);
    const rawPage = result.data || [];
    const page = rawPage.filter((event) => {
      const endDate = event?.end_date || event?.start_date;
      if (endDate && endDate < today) return false;
      return statusIsVisible(event);
    });
    events.push(...page);
    if (rawPage.length < pageSize) return events;
    offset += pageSize;
  }
}

export async function fetchStudentEventDiscoveryStatus() {
  const response = await fetch("/.netlify/functions/student-event-status", {
    headers: { accept: "application/json" },
    cache: "no-store"
  });
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error("Event discovery status returned an invalid response."); }
  if (!response.ok) throw new Error(payload?.error || "Unable to load event discovery status.");
  return payload;
}

export async function refreshStudentEventDiscovery(sessionToken) {
  if (!sessionToken) throw new Error("Sign in again before refreshing event discovery.");
  const response = await fetch("/.netlify/functions/student-event-refresh", {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${sessionToken}`
    },
    cache: "no-store"
  });
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`Event discovery refresh returned an invalid response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const error = new Error(payload?.error || `Event discovery refresh failed (HTTP ${response.status}).`);
    error.status = response.status;
    error.retryAfterAt = payload?.retryAfterAt || null;
    throw error;
  }
  return payload;
}

function throwIfError({ error }) {
  if (error) {
    const wrapped = new Error(error.message);
    wrapped.code = error.code;
    wrapped.constraint = error.constraint;
    wrapped.details = error.details;
    wrapped.hint = error.hint;
    wrapped.status = error.status;
    wrapped.supabaseError = error;
    throw wrapped;
  }
}

async function teacherAuthRequest(action, fields, accessToken = null) {
  const headers = { "content-type": "application/json" };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  const response = await fetch("/.netlify/functions/teacher-auth", {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...fields })
  });
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`Teacher authentication service returned an invalid response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const error = new Error(payload?.error || `Teacher authentication failed (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function createTeacherAccount({ displayName, username, password }) {
  return teacherAuthRequest("create-account", { displayName, username, password });
}

export async function loginTeacher(username, password) {
  const result = await teacherAuthRequest("login", { username, password });
  const sessionResult = await requireSupabase().auth.setSession(result.session);
  throwIfError(sessionResult);
  return result.teacher;
}

export async function restoreTeacherSession() {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  throwIfError({ error: sessionError });
  if (!sessionData.session) return null;
  let result;
  try {
    result = await teacherAuthRequest("session", {}, sessionData.session.access_token);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      await client.auth.signOut();
      return null;
    }
    throw error;
  }
  if (!result.teacher) {
    await client.auth.signOut();
    return null;
  }
  return result.teacher;
}

export async function getTeacherAccessToken() {
  const { data, error } = await requireSupabase().auth.getSession();
  throwIfError({ error });
  return data.session?.access_token || null;
}

export async function logoutTeacher() {
  const { error } = await requireSupabase().auth.signOut();
  throwIfError({ error });
}

function mapSubjectMarkRow(row) {
  return {
    id: row.id,
    subject: row.subject,
    assessmentDate: row.assessment_date,
    assessmentLabel: row.assessment_label || row.assessment_name || "Assessment",
    obtainedMarks: row.obtained_marks == null ? null : Number(row.obtained_marks),
    maxMarks: (row.maximum_marks ?? row.max_marks) == null ? null : Number(row.maximum_marks ?? row.max_marks),
    grade: row.grade || null
  };
}

export function mapClassRow(row) {
  return { id: row.id, name: row.name, course: row.course || "", section: row.section, academicYear: row.academic_year || "" };
}

async function teacherClassRequest(action, fields = {}) {
  const token = await getTeacherAccessToken();
  if (!token) throw new Error("Sign in again to manage your classes.");
  const response = await fetch("/.netlify/functions/teacher-classes", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...fields })
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error(`Class management returned an invalid response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const error = new Error(result?.error || `Class management failed (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function resetStudentPassword(studentId) {
  const token = await getTeacherAccessToken();
  if (!token) throw new Error("Sign in again to reset a student password.");
  const requestHeaders = new Headers({ "content-type": "application/json" });
  requestHeaders.set("authorization", ["Bearer", token].join(" "));
  const response = await fetch("/.netlify/functions/teacher-student-password-reset", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ studentId })
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error(`Password reset returned an invalid response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const error = new Error(result?.error || `Password reset failed (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

export function mapStudentRows(studentRows, assessmentRows, observationRows, subjectMarkRows = [], subjectMarksStatus = "ready", subjectMarksError = "") {
  const assessmentsByStudent = new Map(assessmentRows.map((row) => [row.student_id, row.scores || {}]));
  const observationsByStudent = new Map();
  const marksByStudent = new Map();
  for (const row of subjectMarkRows || []) {
    const marks = marksByStudent.get(row.student_id) || [];
    marks.push(mapSubjectMarkRow(row));
    marksByStudent.set(row.student_id, marks);
  }
  for (const row of observationRows) {
    const observations = observationsByStudent.get(row.student_id) || [];
    observations.push({ id: row.id, date: row.observed_on, category: row.category, note: row.note });
    observationsByStudent.set(row.student_id, observations);
  }

  return studentRows.map((row) => {
    const profile = row.profile_data || {};
    const assessments = assessmentsByStudent.get(row.id) || {};
    return {
      ...profile,
      id: row.id,
      studentId: row.student_code,
      name: row.name,
      rollNumber: row.roll_number,
      classId: row.class_id,
      className: profile.className || row.className || "",
      section: profile.section || row.section || "",
      strongSubjects: row.strong_subjects || [],
      weakSubjects: row.weak_subjects || [],
      learningHabits: row.learning_habits || [],
      assessments,
      subjectMarks: (marksByStudent.get(row.id) || []).sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate)),
      subjectMarksStatus,
      subjectMarksError,
      academicUnderstanding: Number(assessments.academic || 0),
      communication: Number(assessments.communication || 0),
      problemSolving: Number(assessments.problemSolving || 0),
      participation: Number(assessments.participation || 0),
      teamwork: Number(assessments.teamwork || 0),
      consistency: Number(assessments.consistency || 0),
      observations: (observationsByStudent.get(row.id) || []).sort((a, b) => a.date.localeCompare(b.date)),
      progress: profile.progress || [],
      interventions: profile.interventions || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastUpdated: profile.lastUpdated || row.updated_at
    };
  });
}

async function fetchOptionalSubjectMarks(classId, studentIds) {
  if (!studentIds.length) return { rows: [], status: "ready" };
  const client = requireSupabase();
  let result;
  try {
    result = await client.from("subject_assessments")
      .select("id, student_id, subject, assessment_date, assessment_label, obtained_marks, maximum_marks, grade")
      .in("student_id", studentIds).order("assessment_date");
    if (result.error && /maximum_marks/i.test(result.error.message || "") && /column|schema cache/i.test(result.error.message || "")) {
      result = await client.from("subject_assessments")
        .select("id, student_id, subject, assessment_date, assessment_label, obtained_marks, max_marks, grade")
        .in("student_id", studentIds).order("assessment_date");
    }
  } catch (error) {
    console.error("Unable to load optional subject assessment history from Supabase:", error);
    return { rows: [], status: "error", errorMessage: error?.message || "Unknown Supabase error" };
  }
  if (!result.error) return { rows: result.data || [], status: "ready" };
  console.error("Unable to load optional subject assessment history from Supabase:", result.error);
  return { rows: [], status: "unavailable", errorMessage: result.error.message };
}

export async function fetchClasses() {
  const result = await teacherClassRequest("list");
  return (result.classes || []).map(mapClassRow);
}

export async function createTeacherClass(classRecord) {
  const result = await teacherClassRequest("create", classRecord);
  return mapClassRow(result.class);
}

export async function updateTeacherClass(classRecord) {
  const result = await teacherClassRequest("update", classRecord);
  return mapClassRow(result.class);
}

export async function deleteTeacherClass(classId) {
  return teacherClassRequest("delete", { classId });
}

export async function fetchClassStudents(classId) {
  const client = requireSupabase();
  const studentsResult = await client.from("students")
    .select("id,class_id,student_code,name,roll_number,strong_subjects,weak_subjects,learning_habits,profile_data,created_at,updated_at")
    .eq("class_id", classId).order("name");
  throwIfError(studentsResult);
  const ids = studentsResult.data.map((student) => student.id);
  if (!ids.length) return [];

  const [assessmentsResult, observationsResult, marksResult] = await Promise.all([
    client.from("assessments").select("student_id, scores").in("student_id", ids),
    client.from("observations").select("id, student_id, observed_on, category, note").in("student_id", ids),
    fetchOptionalSubjectMarks(classId, ids)
  ]);
  throwIfError(assessmentsResult);
  throwIfError(observationsResult);
  return mapStudentRows(studentsResult.data, assessmentsResult.data, observationsResult.data, marksResult.rows, marksResult.status, marksResult.errorMessage);
}

export async function fetchStudentProfile(studentId) {
  const client = requireSupabase();
  const studentResult = await client.from("students")
    .select("id,class_id,student_code,name,roll_number,strong_subjects,weak_subjects,learning_habits,profile_data,created_at,updated_at")
    .eq("id", studentId).single();
  throwIfError(studentResult);
  const [assessmentResult, observationsResult, marksResult] = await Promise.all([
    client.from("assessments").select("student_id, scores").eq("student_id", studentId),
    client.from("observations").select("id, student_id, observed_on, category, note").eq("student_id", studentId).order("observed_on"),
    fetchOptionalSubjectMarks(studentResult.data.class_id, [studentId])
  ]);
  throwIfError(assessmentResult);
  throwIfError(observationsResult);
  return mapStudentRows([studentResult.data], assessmentResult.data, observationsResult.data, marksResult.rows, marksResult.status, marksResult.errorMessage)[0];
}

export async function saveSubjectAssessment(mark) {
  const basePayload = {
    student_id: mark.studentId,
    subject: mark.subject,
    assessment_date: mark.assessmentDate,
    assessment_label: mark.assessmentLabel,
    obtained_marks: mark.grade ? null : Number(mark.obtainedMarks),
    grade: mark.grade || null
  };
  const client = requireSupabase();
  const isDatabaseUuid = typeof mark.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mark.id);
  const columns = ["maximum_marks", "max_marks"];
  let result, columnIndex = 0, includeAssessmentName = true;
  while (columnIndex < columns.length) {
    const maxColumn = columns[columnIndex];
    const payload = {
      ...basePayload,
      ...(includeAssessmentName ? { assessment_name: mark.assessmentLabel } : {}),
      [maxColumn]: mark.grade ? null : Number(mark.maxMarks)
    };
    result = isDatabaseUuid
      ? await client.from("subject_assessments").update(payload).eq("id", mark.id).select("id").maybeSingle()
      : await client.from("subject_assessments").insert(payload).select("id").single();
    const missingAssessmentName = result.error && /assessment_name/i.test(result.error.message || "") && /column|schema cache/i.test(result.error.message || "");
    if (missingAssessmentName && includeAssessmentName) { includeAssessmentName = false; continue; }
    const missingSelectedColumn = result.error && new RegExp(maxColumn, "i").test(result.error.message || "") && /column|schema cache/i.test(result.error.message || "");
    if (!missingSelectedColumn) break;
    columnIndex += 1;
  }
  if (columnIndex === columns.length && result?.error) throwIfError(result);
  throwIfError(result);
  if (!result.data?.id) throw new Error(isDatabaseUuid ? "The subject mark to update was not found or is not accessible." : "The database did not return the saved subject mark.");
  return result.data.id;
}

async function studentAuthRequest(payload, sessionToken = null) {
  const headers = { "content-type": "application/json" };
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  const response = await fetch("/.netlify/functions/student-login", {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error(`Student account service returned an invalid response (HTTP ${response.status}).`); }
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(result?.error || `Student account request failed (HTTP ${response.status}).`);
  return result;
}

function mapStudentLoginResult(result) {
  return {
    student: mapStudentRows(
    [result.student], result.assessments || [], result.observations || [], result.subjectMarks || [],
    result.subjectMarksStatus === "ready" ? "ready" : "unavailable"
    )[0],
    sessionToken: result.sessionToken,
    mustChangePassword: Boolean(result.mustChangePassword)
  };
}

export async function findStudentByCode(studentCode, password, category = null) {
  const result = await studentAuthRequest({ studentCode, password, category });
  return result ? mapStudentLoginResult(result) : null;
}

export async function restoreStudentSession(sessionToken) {
  const result = await studentAuthRequest({ action: "session" }, sessionToken);
  return result ? mapStudentLoginResult(result) : null;
}

export async function changeStudentPassword(currentPassword, newPassword, sessionToken) {
  const result = await studentAuthRequest({ action: "change-password", currentPassword, newPassword }, sessionToken);
  return result ? mapStudentLoginResult(result) : null;
}

async function assistantRequest(path, payload, accessToken) {
  if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload)
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error(`The assistant returned an invalid response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const error = new Error(result?.error || `The assistant request failed (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function requestTeacherAssistant(payload) {
  const accessToken = await getTeacherAccessToken();
  return assistantRequest("/.netlify/functions/teacher-ai-chat", payload, accessToken);
}

export async function requestStudentAssistant(payload, sessionToken) {
  return assistantRequest("/.netlify/functions/student-ai-chat", payload, sessionToken);
}

export async function isStudentCodeAvailable(studentCode) {
  const result = await requireSupabase().from("students").select("id").eq("student_code", studentCode).maybeSingle();
  throwIfError(result);
  return !result.data;
}

function studentRow(student) {
  const profileData = { ...student };
  for (const key of ["id", "studentId", "name", "rollNumber", "classId", "strongSubjects", "weakSubjects", "learningHabits", "assessments", "observations", "subjectMarks", "createdAt", "updatedAt", "lastUpdated"]) delete profileData[key];
  return {
    id: student.id, class_id: student.classId, student_code: student.studentId, name: student.name,
    roll_number: student.rollNumber, strong_subjects: student.strongSubjects || [], weak_subjects: student.weakSubjects || [],
    learning_habits: student.learningHabits || [], profile_data: profileData,
    updated_at: student.updatedAt || new Date().toISOString()
  };
}

async function saveCurrentAssessment(student) {
  const result = await requireSupabase().from("assessments").upsert({
    student_id: student.id, scores: student.assessments || {}, updated_at: student.updatedAt || new Date().toISOString()
  }, { onConflict: "student_id" });
  throwIfError(result);
}

export async function insertStudentRecord(student, { skipAssessment = false } = {}) {
  const result = await requireSupabase().from("students").insert(studentRow(student)).select("id").single();
  throwIfError(result);
  if (!skipAssessment) await saveCurrentAssessment(student);
}

export async function saveStudentRecord(student) {
  const updateRow = studentRow(student);
  delete updateRow.id;
  const studentResult = await requireSupabase().from("students").update(updateRow).eq("id", student.id).select("id").maybeSingle();
  throwIfError(studentResult);
  if (!studentResult.data) throw new Error("This student record no longer exists in Supabase. Reload the student list before editing.");
  await saveCurrentAssessment(student);
}

export async function deleteStudentRecord(studentId) {
  const result = await requireSupabase().from("students").delete().eq("id", studentId);
  throwIfError(result);
}

export async function insertObservation(studentId, observation) {
  const result = await requireSupabase().from("observations").insert({
    id: observation.id,
    student_id: studentId,
    observed_on: observation.date,
    category: observation.category,
    note: observation.note
  });
  throwIfError(result);
}

export async function deleteObservation(observationId) {
  const result = await requireSupabase().from("observations").delete().eq("id", observationId);
  throwIfError(result);
}

export async function importLegacyData(classes, students) {
  const client = requireSupabase();
  if (classes.length) {
    const classesResult = await client.from("classes").insert(classes.map(({ id, name, section }) => ({ id, name, section })));
    throwIfError(classesResult);
  }
  for (const student of students) await insertStudentRecord(student);
  for (const student of students) {
    for (const observation of student.observations || []) await insertObservation(student.id, observation);
  }
}
