function normalizeClassPart(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function throwIfError({ error }) {
  if (!error) return;
  const wrapped = new Error(error.message || "Supabase class request failed.");
  wrapped.code = error.code;
  wrapped.constraint = error.constraint;
  throw wrapped;
}

function isNameSectionConflict(error) {
  return error?.code === "23505" && /classes_name_section_key|name_section/i.test(`${error.constraint || ""} ${error.message || ""}`);
}

async function findNormalizedClass(client, name, section) {
  const result = await client.from("classes").select("id, name, section").order("created_at");
  throwIfError(result);
  return (result.data || []).find((row) =>
    normalizeClassPart(row.name) === normalizeClassPart(name) &&
    normalizeClassPart(row.section) === normalizeClassPart(section)
  ) || null;
}

/** Insert a class, reusing normalized matches and recovering from a concurrent unique-key race. */
export async function insertOrReuseClass(client, classRecord) {
  const name = String(classRecord.name || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  const section = String(classRecord.section || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!name || !section) throw new Error("Class name and section are required.");

  const existing = await findNormalizedClass(client, name, section);
  if (existing) return existing;

  const result = await client.from("classes").insert({ name, section }).select("id, name, section").single();
  if (!result.error) return result.data;

  const error = result.error;
  if (isNameSectionConflict(error)) {
    const concurrent = await findNormalizedClass(client, name, section);
    if (concurrent) return concurrent;
  }
  throwIfError(result);
  throw new Error("Supabase did not return the created class.");
}
