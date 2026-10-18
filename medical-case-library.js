// Built-in fictional cases. No network request or database setup is needed to play.
export const MEDICAL_CASES = [
  {
    id: "cap-right-lower-lobe", specialty: "Respiratory", difficulty: "Intermediate", age: 46,
    complaint: "Four days of fever, productive cough, and sharp right-sided chest pain when breathing deeply.",
    symptoms: ["Cough became productive over two days", "Chills", "Shortness of breath on walking"],
    vitals: { temperature: "38.5 °C", heartRate: "108 beats/min", bloodPressure: "118/74 mmHg", oxygenSaturation: "93% on room air", respiratoryRate: "24 breaths/min" },
    historyQuestions: [
      { id: "timeline", question: "When did the cough begin and how has it changed?", answer: "It began dry and became productive over two days.", key: true },
      { id: "breathlessness", question: "Is there breathlessness or pleuritic pain?", answer: "Shortness of breath occurs on walking; deep breaths cause sharp right-sided chest pain.", key: true },
      { id: "risk", question: "Any chronic lung disease or recent hospital admission?", answer: "No known chronic lung disease or recent hospital admission.", key: false },
      { id: "medications", question: "What medicines and allergies should be recorded?", answer: "Medication and allergy details are not provided.", key: false },
    ],
    examination: { lungs: ["inspect", "palpate", "percuss", "auscultate"], heart: ["auscultate"] },
    keyExam: ["lungs|percuss", "lungs|auscultate"],
    findings: { "lungs|inspect": "Respiratory rate is mildly increased; the patient speaks in full sentences.", "lungs|palpate": "Tactile fremitus is increased over the right lower posterior chest compared with the left.", "lungs|percuss": "Percussion is dull over the right lower posterior chest; other examined areas are resonant.", "lungs|auscultate": "Fine inspiratory crackles and bronchial breath sounds are heard over the right lower posterior chest.", "heart|auscultate": "Regular rhythm; no additional heart sound or murmur is scripted." },
    investigations: [
      { id: "cxr", label: "Chest radiograph", result: "Focal right lower-zone air-space opacity; no pleural effusion is described.", key: true },
      { id: "cbc", label: "Complete blood count", result: "White blood cell count 14.2 × 10⁹/L with neutrophil predominance (simulated result).", key: true },
      { id: "crp", label: "C-reactive protein", result: "CRP 86 mg/L (simulated result).", key: false },
      { id: "ecg", label: "12-lead ECG", result: "Sinus tachycardia; no acute ischemic change is described (simulated result).", key: false },
    ],
    diagnosis: "Community-acquired pneumonia, right lower lobe", diagnosisOptions: ["Community-acquired pneumonia, right lower lobe", "Pulmonary embolism", "Acute bronchitis", "Acute heart failure"],
    differentials: ["Pulmonary embolism", "Viral lower respiratory infection", "Acute bronchitis", "Heart failure"], correctDifferentials: ["Pulmonary embolism", "Viral lower respiratory infection"],
    managementOptions: [
      { id: "safe", label: "Assess severity and oxygenation, follow local pneumonia guidance, and arrange appropriate clinician review or escalation.", correct: true, explanation: "Severity, oxygenation, comorbidities, and local guidance inform the appropriate level of care." },
      { id: "ignore", label: "Reassure and discharge without checking severity because the patient can speak in sentences.", correct: false, explanation: "Speech alone does not establish low risk; oxygen saturation and severity assessment matter." },
      { id: "photo", label: "Diagnose from the body image alone and begin treatment without clinical assessment.", correct: false, explanation: "The model is for examination practice and does not diagnose from images." },
    ],
    source: { title: "MSD Manual Professional: Community-Acquired Pneumonia", url: "https://www.msdmanuals.com/professional/pulmonary-disorders/pneumonia/community-acquired-pneumonia" },
    explanation: "The history, focal right-basilar crackles and bronchial breath sounds, dullness, and matching radiographic opacity support focal pneumonia. Consider alternatives and assess severity; the case is educational, not a treatment directive.",
  },
  {
    id: "acute-appendicitis", specialty: "Surgery", difficulty: "Intermediate", age: 21,
    complaint: "Sixteen hours of abdominal pain that began near the navel and moved to the lower right abdomen, with nausea and reduced appetite.",
    symptoms: ["Pain migrated from periumbilical region to right lower abdomen", "Nausea", "Reduced appetite"],
    vitals: { temperature: "37.8 °C", heartRate: "96 beats/min", bloodPressure: "120/76 mmHg", oxygenSaturation: "99% on room air", respiratoryRate: "18 breaths/min" },
    historyQuestions: [
      { id: "migration", question: "Where did the pain begin and where is it now?", answer: "It began near the navel and gradually localized to the lower right abdomen.", key: true },
      { id: "gi", question: "Any nausea, appetite change, diarrhea, or vomiting?", answer: "Nausea and reduced appetite; no diarrhea is reported.", key: true },
      { id: "urinary", question: "Any urinary symptoms or prior abdominal surgery?", answer: "No urinary symptoms or prior abdominal surgery are reported.", key: false },
      { id: "medications", question: "What medicines and allergies should be recorded?", answer: "Medication and allergy details are not provided.", key: false },
    ],
    examination: { abdomen: ["inspect", "auscultate", "percuss", "palpate"] }, keyExam: ["abdomen|palpate"],
    findings: { "abdomen|inspect": "The abdomen is not distended; no surgical scars are visible in this scripted examination.", "abdomen|auscultate": "Bowel sounds are present.", "abdomen|percuss": "No generalized percussion abnormality is scripted.", "abdomen|palpate": "Focal right-lower-quadrant tenderness with localized voluntary guarding. No generalized rigidity is scripted." },
    investigations: [
      { id: "cbc", label: "Complete blood count", result: "White blood cell count 12.8 × 10⁹/L with neutrophil predominance (simulated result).", key: true },
      { id: "us", label: "Abdominal ultrasound", result: "The appendix is not confidently visualized; no drainable collection is described (simulated result).", key: true },
      { id: "ct", label: "CT abdomen and pelvis", result: "An enlarged appendix with wall thickening and periappendiceal fat stranding; no abscess is described (simulated result).", key: true },
      { id: "urine", label: "Urinalysis", result: "Trace ketones; no blood or nitrites (simulated result).", key: false },
    ],
    diagnosis: "Acute appendicitis", diagnosisOptions: ["Acute appendicitis", "Gastroenteritis", "Renal colic", "Mesenteric adenitis"],
    differentials: ["Gastroenteritis", "Renal colic", "Mesenteric adenitis", "Urinary infection"], correctDifferentials: ["Gastroenteritis", "Renal colic", "Mesenteric adenitis"],
    managementOptions: [
      { id: "urgent", label: "Arrange urgent clinician and surgical assessment; monitor and investigate according to local acute-abdomen guidance.", correct: true, explanation: "A suspected acute abdomen needs timely clinical and surgical assessment." },
      { id: "delay", label: "Send home without review because the ultrasound did not visualize the appendix.", correct: false, explanation: "A nonvisualized appendix does not exclude appendicitis when clinical concern persists." },
      { id: "self", label: "Make a definitive diagnosis from the 3D body model alone.", correct: false, explanation: "The model supports region selection only; it does not display internal abnormalities." },
    ],
    source: { title: "Merck Manual Professional: Appendicitis", url: "https://www.merckmanuals.com/professional/gastrointestinal-disorders/acute-abdomen-and-surgical-gastroenterology/appendicitis" },
    explanation: "Migratory pain, focal right-lower-quadrant tenderness, neutrophilia, and the scripted CT findings support acute appendicitis. A nondiagnostic ultrasound does not settle the question; assess urgently with the clinical context.",
  },
  {
    id: "asthma-exacerbation", specialty: "Respiratory", difficulty: "Beginner", age: 19,
    complaint: "One day of worsening wheeze and chest tightness after a viral cold; the patient is using a reliever inhaler more often.",
    symptoms: ["Wheeze", "Chest tightness", "Increased reliever use"],
    vitals: { temperature: "37.2 °C", heartRate: "112 beats/min", bloodPressure: "124/78 mmHg", oxygenSaturation: "95% on room air", respiratoryRate: "26 breaths/min" },
    historyQuestions: [
      { id: "asthma", question: "Has this happened before, and is there a history of asthma?", answer: "The patient has asthma and has had similar episodes with respiratory infections.", key: true },
      { id: "trigger", question: "What preceded the symptoms?", answer: "A viral cold began several days before the wheeze worsened.", key: true },
      { id: "reliever", question: "How often is the reliever inhaler being used?", answer: "More often than usual today; exact dose is not provided.", key: true },
      { id: "allergies", question: "Any known drug allergies?", answer: "Allergy information is not provided.", key: false },
    ],
    examination: { lungs: ["inspect", "auscultate"], heart: ["auscultate"] }, keyExam: ["lungs|inspect", "lungs|auscultate"],
    findings: { "lungs|inspect": "Mild accessory muscle use; the patient speaks in full sentences.", "lungs|auscultate": "Bilateral expiratory wheeze with prolonged expiration; air entry is present bilaterally.", "heart|auscultate": "Regular rhythm; tachycardia is present." },
    investigations: [
      { id: "pef", label: "Peak expiratory flow", result: "Peak flow is 58% of the patient's documented personal best (simulated result).", key: true },
      { id: "oximetry", label: "Pulse oximetry", result: "Oxygen saturation is 95% on room air (provided initial measurement).", key: false },
      { id: "cxr", label: "Chest radiograph", result: "No focal air-space opacity is described (simulated result).", key: false },
    ],
    diagnosis: "Acute asthma exacerbation", diagnosisOptions: ["Acute asthma exacerbation", "Community-acquired pneumonia", "Pulmonary embolism", "Pneumothorax"],
    differentials: ["Community-acquired pneumonia", "Pneumothorax", "Vocal cord dysfunction"], correctDifferentials: ["Community-acquired pneumonia", "Pneumothorax"],
    managementOptions: [
      { id: "assess", label: "Assess exacerbation severity and response, provide guideline-based acute asthma care, and escalate if severe or deteriorating.", correct: true, explanation: "Acute asthma care is guided by severity, oxygenation, and response to treatment; worsening patients need escalation." },
      { id: "sedate", label: "Sedate the patient and defer respiratory reassessment.", correct: false, explanation: "Sedation can obscure deterioration; reassessment and appropriate escalation are important." },
      { id: "ignore", label: "Ignore the reduced peak flow because wheeze is audible.", correct: false, explanation: "A measured reduction in peak flow contributes to severity assessment." },
    ],
    source: { title: "MSD Manual Professional: Asthma", url: "https://www.msdmanuals.com/professional/pulmonary-disorders/asthma-and-related-disorders/asthma" },
    explanation: "Known asthma, a respiratory trigger, bilateral expiratory wheeze, and reduced peak flow support an acute exacerbation. Severity and response require clinical reassessment; do not infer a diagnosis from the body model.",
  },
  {
    id: "stemi", specialty: "Cardiology", difficulty: "Advanced", age: 58,
    complaint: "Forty-five minutes of central pressure-like chest discomfort with sweating and nausea, not relieved by rest.",
    symptoms: ["Persistent central chest pressure", "Sweating", "Nausea"],
    vitals: { temperature: "36.8 °C", heartRate: "104 beats/min", bloodPressure: "148/92 mmHg", oxygenSaturation: "97% on room air", respiratoryRate: "20 breaths/min" },
    historyQuestions: [
      { id: "onset", question: "When did the discomfort begin, and is it ongoing?", answer: "It began 45 minutes ago and is still present.", key: true },
      { id: "associated", question: "What associated symptoms are present?", answer: "Sweating and nausea; no syncope is reported.", key: true },
      { id: "risk", question: "Are there cardiovascular risk factors?", answer: "The patient has hypertension and smokes; further risk history is not provided.", key: true },
      { id: "allergies", question: "What medicines and allergies should be checked?", answer: "Medication and allergy details are not provided; verify them with the patient.", key: false },
    ],
    examination: { heart: ["inspect", "palpate", "auscultate"], lungs: ["auscultate"] }, keyExam: ["heart|auscultate"],
    findings: { "heart|inspect": "The patient is diaphoretic; no visible precordial heave is scripted.", "heart|palpate": "No displaced apex beat is scripted.", "heart|auscultate": "Regular rhythm; no new murmur is scripted.", "lungs|auscultate": "No crackles are heard; air entry is present bilaterally." },
    investigations: [
      { id: "ecg", label: "12-lead ECG", result: "ST-segment elevation in leads II, III, and aVF with reciprocal depression in I and aVL (simulated result).", key: true },
      { id: "troponin", label: "High-sensitivity troponin", result: "Initial value is above the assay's 99th percentile (simulated result); serial testing is still needed.", key: true },
      { id: "cxr", label: "Chest radiograph", result: "No acute pulmonary edema is described (simulated result).", key: false },
    ],
    diagnosis: "Acute inferior ST-elevation myocardial infarction", diagnosisOptions: ["Acute inferior ST-elevation myocardial infarction", "Acute pericarditis", "Pulmonary embolism", "Stable angina"],
    differentials: ["Acute pericarditis", "Pulmonary embolism", "Aortic dissection"], correctDifferentials: ["Acute pericarditis", "Pulmonary embolism", "Aortic dissection"],
    managementOptions: [
      { id: "emergency", label: "Activate the emergency ACS pathway, obtain urgent senior/cardiology support, and arrange timely reperfusion assessment.", correct: true, explanation: "The scripted ECG pattern indicates a time-critical emergency; urgent clinician-led ACS care is required." },
      { id: "wait", label: "Wait for serial troponins before escalating despite the ECG pattern.", correct: false, explanation: "A concerning STEMI ECG requires urgent action; do not delay escalation for a later troponin." },
      { id: "outpatient", label: "Arrange routine outpatient review for next week.", correct: false, explanation: "Persistent chest pain with this ECG pattern is an emergency." },
    ],
    source: { title: "MSD Manual Professional: Acute Myocardial Infarction", url: "https://www.msdmanuals.com/professional/cardiovascular-disorders/coronary-artery-disease/acute-myocardial-infarction-mi" },
    explanation: "Persistent ischemic chest discomfort with inferior ST elevation and reciprocal change supports an inferior STEMI. A high initial troponin supports myocardial injury, but urgent escalation is warranted from the ECG and clinical picture.",
  },
  {
    id: "lateral-ankle-sprain", specialty: "Musculoskeletal", difficulty: "Beginner", age: 24,
    complaint: "Left ankle pain and swelling after the foot rolled inward while playing basketball two hours ago.",
    symptoms: ["Lateral ankle pain", "Swelling around the outside of the ankle", "Able to walk, with discomfort"],
    vitals: { temperature: "36.9 °C", heartRate: "84 beats/min", bloodPressure: "122/76 mmHg", oxygenSaturation: "99% on room air", respiratoryRate: "16 breaths/min" },
    historyQuestions: [
      { id: "mechanism", question: "How did the injury happen?", answer: "The foot turned inward during a landing; there was no direct blow or audible crack.", key: true },
      { id: "weight-bearing", question: "Could the patient take four steps after the injury and now?", answer: "Yes, four steps were possible both immediately after the injury and at assessment, though painful.", key: true },
      { id: "red-flags", question: "Any numbness, open wound, or previous injury at this ankle?", answer: "No numbness or open wound is reported; no prior injury is provided.", key: false },
    ],
    examination: { musculoskeletal: ["inspect", "palpate", "movement", "neurovascular"] },
    keyExam: ["musculoskeletal|palpate", "musculoskeletal|neurovascular"],
    findings: {
      "musculoskeletal|inspect": "Mild lateral ankle swelling and bruising; no deformity or open wound is seen.",
      "musculoskeletal|palpate": "Tenderness is present over the lateral ligament region and the posterior edge of the lateral malleolus; no medial malleolar or base-of-fifth-metatarsal tenderness is scripted.",
      "musculoskeletal|movement": "Active ankle movement is reduced by pain; the patient can take four steps with discomfort.",
      "musculoskeletal|neurovascular": "Foot is warm with palpable distal pulse and intact light-touch sensation in this scripted examination.",
    },
    investigations: [
      { id: "ankle-xray", label: "Left ankle radiographs", result: "No acute fracture is identified in the scripted three-view radiograph.", key: true },
      { id: "foot-xray", label: "Foot radiographs", result: "No acute fracture is identified in the scripted foot radiograph.", key: false },
    ],
    diagnosis: "Lateral ankle ligament sprain", diagnosisOptions: ["Lateral ankle ligament sprain", "Lateral malleolar fracture", "Achilles tendon rupture", "Septic arthritis"],
    differentials: ["Lateral malleolar fracture", "Achilles tendon injury", "Midfoot fracture"], correctDifferentials: ["Lateral malleolar fracture", "Midfoot fracture"],
    managementOptions: [
      { id: "assessment", label: "Use the full injury assessment and imaging result, provide appropriate support and progressive rehabilitation advice, and give return precautions.", correct: true, explanation: "The scripted radiograph shows no fracture; functional support, progressive rehabilitation, and reassessment for worsening symptoms are appropriate educational next steps." },
      { id: "ignore", label: "Ignore the injury because the patient can walk.", correct: false, explanation: "Weight-bearing does not replace a structured assessment; focal bony tenderness still informed imaging in this case." },
      { id: "cast", label: "Apply a rigid cast without reassessment or an imaging review.", correct: false, explanation: "The next step should reflect the full clinical assessment, imaging, function, and local guidance." },
    ],
    source: { title: "NSW Health: Ottawa ankle rules (adult)", url: "https://aci.health.nsw.gov.au/ecat/appendices/ottawa-ankle-adult" },
    explanation: "The inversion mechanism and lateral swelling support a lateral ligament injury. Posterior-edge malleolar tenderness warranted the scripted radiograph; no fracture is identified. The rule guides imaging and does not itself establish a sprain diagnosis.",
  },
];

const VITAL_EXAM_ACTIONS = {
  temperature: ["temperature", "Temperature"],
  pulse: ["heartRate", "Pulse"],
  "blood-pressure": ["bloodPressure", "Blood pressure"],
  "respiratory-rate": ["respiratoryRate", "Respiratory rate"],
  "oxygen-saturation": ["oxygenSaturation", "Oxygen saturation"],
};

// Every additional finding below is explicitly scripted for its fictional case.
// The examination UI never supplies findings for systems absent from this data.
const additionalExaminations = {
  "cap-right-lower-lobe": {
    eyes: { "pupil-check": "Pupils are equal and reactive to light in this scripted examination." },
    ears: { inspect: "No external ear abnormality is recorded in this scripted examination." },
    nose: { inspect: "No nasal discharge is recorded in this scripted examination." },
    throat: { oropharynx: "Oropharynx is clear without exudate in this scripted examination." },
    neck: { "lymph-nodes": "No cervical lymphadenopathy is recorded in this scripted examination." },
    neurological: { orientation: "Alert and oriented to person, place, and time in this scripted examination." },
    skin: { perfusion: "Skin is warm; capillary refill is under 2 seconds in this scripted examination." },
  },
  "acute-appendicitis": {
    eyes: { "pupil-check": "Pupils are equal and reactive to light in this scripted examination." },
    ears: { inspect: "No external ear abnormality is recorded in this scripted examination." },
    nose: { inspect: "No nasal discharge is recorded in this scripted examination." },
    throat: { oropharynx: "Oropharynx is clear without exudate in this scripted examination." },
    neck: { "lymph-nodes": "No cervical lymphadenopathy is recorded in this scripted examination." },
    neurological: { orientation: "Alert and oriented to person, place, and time in this scripted examination." },
    skin: { perfusion: "Skin is warm; capillary refill is under 2 seconds in this scripted examination." },
    genitourinary: { "flank-assessment": "No costovertebral-angle tenderness is found in this scripted examination." },
  },
  "asthma-exacerbation": {
    eyes: { "pupil-check": "Pupils are equal and reactive to light in this scripted examination." },
    ears: { inspect: "No external ear abnormality is recorded in this scripted examination." },
    nose: { inspect: "Mild nasal congestion is visible, consistent with the recent viral symptoms in this case." },
    throat: { oropharynx: "Oropharynx is clear without exudate in this scripted examination." },
    neck: { "lymph-nodes": "No cervical lymphadenopathy is recorded in this scripted examination." },
    neurological: { orientation: "Alert and oriented to person, place, and time; speaking in full sentences." },
    skin: { perfusion: "Skin is warm; capillary refill is under 2 seconds in this scripted examination." },
  },
  stemi: {
    eyes: { "pupil-check": "Pupils are equal and reactive to light in this scripted examination." },
    ears: { inspect: "No external ear abnormality is recorded in this scripted examination." },
    nose: { inspect: "No nasal discharge is recorded in this scripted examination." },
    throat: { oropharynx: "Oropharynx is clear without exudate in this scripted examination." },
    neck: { "lymph-nodes": "No cervical lymphadenopathy is recorded in this scripted examination." },
    neurological: { orientation: "Alert and oriented to person, place, and time; no focal neurological finding is scripted." },
    skin: { perfusion: "The patient is diaphoretic, as recorded in the cardiovascular examination." },
  },
};

for (const item of MEDICAL_CASES) {
  item.examination.general = Object.keys(VITAL_EXAM_ACTIONS);
  for (const action of item.examination.general) {
    const vital = VITAL_EXAM_ACTIONS[action][0];
    item.findings[`general|${action}`] = item.vitals[vital] || "Not available";
  }
  for (const [system, actions] of Object.entries(additionalExaminations[item.id] || {})) {
    item.examination[system] = Object.keys(actions);
    for (const [action, finding] of Object.entries(actions)) item.findings[`${system}|${action}`] = finding;
  }
  item.keyExam = [
    ...item.examination.general.filter((action) => item.vitals[VITAL_EXAM_ACTIONS[action][0]] !== undefined).map((action) => `general|${action}`),
    ...item.keyExam,
  ];
}

export function chooseRandomCase({ previousId = "", specialty = "all", difficulty = "all", random = Math.random } = {}) {
  const matches = MEDICAL_CASES.filter((item) => (specialty === "all" || item.specialty === specialty) && (difficulty === "all" || item.difficulty === difficulty));
  if (!matches.length) return null;
  const fresh = matches.filter((item) => item.id !== previousId);
  const pool = fresh.length ? fresh : matches;
  return pool[Math.floor(random() * pool.length)];
}

export const CASE_STAGES = ["presentation", "history", "examination", "investigations", "diagnosis", "management", "results"];

export function createCaseProgress(caseData) {
  return { caseId: caseData.id, stage: "presentation", askedHistory: [], examActions: [], orderedTests: [], selectedRegion: "", diagnosis: "", differentials: [], management: "" };
}

export function applyCaseAction(progress, caseData, action, value) {
  const next = { ...progress, askedHistory: [...progress.askedHistory], examActions: [...progress.examActions], orderedTests: [...progress.orderedTests], differentials: [...progress.differentials] };
  if (action === "ask-history" && caseData.historyQuestions.some((item) => item.id === value) && !next.askedHistory.includes(value)) next.askedHistory.push(value);
  if (action === "select-region" && Object.hasOwn(caseData.examination, value)) next.selectedRegion = value;
  if (action === "exam-action" && (caseData.examination[next.selectedRegion] || []).includes(value)) {
    const key = `${next.selectedRegion}|${value}`;
    if (!next.examActions.includes(key)) next.examActions.push(key);
  }
  if (action === "order-test" && caseData.investigations.some((item) => item.id === value) && !next.orderedTests.includes(value)) next.orderedTests.push(value);
  if (action === "diagnosis" && caseData.diagnosisOptions.includes(value)) next.diagnosis = value;
  if (action === "differential" && caseData.differentials.includes(value)) next.differentials = next.differentials.includes(value) ? next.differentials.filter((item) => item !== value) : [...next.differentials, value];
  if (action === "management" && caseData.managementOptions.some((item) => item.id === value)) next.management = value;
  return next;
}

export function advanceCaseProgress(progress) {
  const index = CASE_STAGES.indexOf(progress.stage);
  if (progress.stage === "diagnosis" && !progress.diagnosis) return { progress, error: "Choose the most likely diagnosis before continuing." };
  if (progress.stage === "management" && !progress.management) return { progress, error: "Choose a next step before submitting the case." };
  if (index < 0 || index >= CASE_STAGES.length - 1) return { progress, error: "This case is already complete." };
  return { progress: { ...progress, stage: CASE_STAGES[index + 1] }, error: "" };
}

export function scoreCase(caseData, progress) {
  const requiredHistory = caseData.historyQuestions.filter((item) => item.key).map((item) => item.id);
  const requiredTests = caseData.investigations.filter((item) => item.key).map((item) => item.id);
  const parts = {
    history: requiredHistory.length ? Math.round(15 * requiredHistory.filter((id) => progress.askedHistory.includes(id)).length / requiredHistory.length) : 15,
    examination: caseData.keyExam.length ? Math.round(20 * caseData.keyExam.filter((id) => progress.examActions.includes(id)).length / caseData.keyExam.length) : 20,
    investigations: requiredTests.length ? Math.round(15 * requiredTests.filter((id) => progress.orderedTests.includes(id)).length / requiredTests.length) : 15,
    diagnosis: progress.diagnosis === caseData.diagnosis ? 20 : 0,
    differentials: caseData.correctDifferentials.length ? Math.max(0, Math.round(10 * (caseData.correctDifferentials.filter((id) => progress.differentials.includes(id)).length - progress.differentials.filter((id) => !caseData.correctDifferentials.includes(id)).length) / caseData.correctDifferentials.length)) : 10,
    management: caseData.managementOptions.some((item) => item.correct && item.id === progress.management) ? 20 : 0,
  };
  const score = Object.values(parts).reduce((sum, part) => sum + part, 0);
  const missed = [];
  if (parts.history < 15) missed.push("Ask about the symptom timeline, associated features, and relevant risk factors.");
  if (parts.examination < 20) missed.push("Complete the focused examination steps for the affected region.");
  if (parts.investigations < 15) missed.push("Order the key investigations that support or challenge the leading diagnosis.");
  if (parts.diagnosis < 20) missed.push(`The expected diagnosis is ${caseData.diagnosis}.`);
  if (parts.differentials < 10) missed.push(`Consider these alternatives: ${caseData.correctDifferentials.join(", ")}.`);
  const chosenManagement = caseData.managementOptions.find((item) => item.id === progress.management);
  if (parts.management < 20) missed.push(chosenManagement?.explanation || caseData.managementOptions.find((item) => item.correct)?.explanation || "Choose an appropriate clinician-led next step.");
  return { score, parts, missed, chosenManagement, total: 100 };
}
