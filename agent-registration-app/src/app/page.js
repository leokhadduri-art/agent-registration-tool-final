"use client";
import { useState, useEffect, useRef } from "react";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, rgb, StandardFonts } from "pdf-lib";

/* ═══════════════════ CONSTANTS ═══════════════════ */
const AGENT_FIELDS = [
  { key: "firstName", label: "First Name", group: "Personal" },
  { key: "middleName", label: "Middle Name", group: "Personal" },
  { key: "lastName", label: "Last Name", group: "Personal" },
  { key: "suffix", label: "Suffix (Jr/Sr/III)", group: "Personal" },
  { key: "dob", label: "Date of Birth", group: "Personal" },
  { key: "birthCity", label: "City of Birth", group: "Personal" },
  { key: "birthState", label: "State of Birth", group: "Personal" },
  { key: "birthCountry", label: "Country of Birth", group: "Personal" },
  { key: "homeStreet", label: "Street Address", group: "Home Address" },
  { key: "homeCity", label: "City", group: "Home Address" },
  { key: "homeState", label: "State", group: "Home Address" },
  { key: "homeZip", label: "Zip", group: "Home Address" },
  { key: "homeCounty", label: "County", group: "Home Address" },
  { key: "homePhone", label: "Home Phone", group: "Contact" },
  { key: "mobilePhone", label: "Mobile Phone", group: "Contact" },
  { key: "homeEmail", label: "Home Email", group: "Contact" },
  { key: "personalWebSocial", label: "Personal Websites / Social", group: "Contact" },
  { key: "businessName", label: "Business Name", group: "Business" },
  { key: "dba", label: "DBA", group: "Business" },
  { key: "natureOfBusiness", label: "Nature of Business", group: "Business" },
  { key: "businessStreet", label: "Business Street Address", group: "Business" },
  { key: "businessCity", label: "Business City", group: "Business" },
  { key: "businessState", label: "Business State", group: "Business" },
  { key: "businessZip", label: "Business Zip", group: "Business" },
  { key: "businessCounty", label: "Business County", group: "Business" },
  { key: "workPhone", label: "Work Phone", group: "Business" },
  { key: "fax", label: "FAX", group: "Business" },
  { key: "workEmail", label: "Work Email", group: "Business" },
  { key: "businessWebSocial", label: "Business Websites / Social", group: "Business" },
  { key: "registrationNo", label: "Registration No.", group: "Business" },
  { key: "currentRegistrations", label: "States Registered", group: "Registrations" },
  { key: "certDetails", label: "Certification Details", group: "Registrations" },
];

const COMPUTED_FIELDS = [
  { key: "_fullName", label: "Full Name (First Middle Last)" },
  { key: "_fullNameLF", label: "Full Name (Last, First Middle)" },
  { key: "_homeAddrFull", label: "Full Home Address (one line)" },
  { key: "_bizAddrFull", label: "Full Business Address (one line)" },
  { key: "_birthPlace", label: "Birth Place (City, State, Country)" },
  { key: "_dobFormatted", label: "DOB (MM/DD/YYYY)" },
];

/* Typed addendum mapping keys — each maps to a specific ADDENDUM_TYPE */
const SPECIAL_MAPPINGS = [
  { key: "_ADDENDUM", label: "See Attached Addendum (generic)" },
  { key: "_ADD_workHistory", label: "Addendum: Employment History" },
  { key: "_ADD_formalTraining", label: "Addendum: Formal Training" },
  { key: "_ADD_practicalExp", label: "Addendum: Practical Experience" },
  { key: "_ADD_education", label: "Addendum: Education" },
  { key: "_ADD_clientList", label: "Addendum: Client List / Athletes" },
  { key: "_ADD_references", label: "Addendum: References" },
  { key: "_ADD_financialParties", label: "Addendum: Financially Interested Parties" },
  { key: "_ADD_licenseHistory", label: "Addendum: License History" },
  { key: "_ADD_feeSchedule", label: "Addendum: Fee Schedule" },
  { key: "_ADD_other", label: "Addendum: Other" },
  { key: "_SKIP", label: "Skip (don't fill)" },
];

const ADDENDUM_TYPES = [
  { key: "workHistory", label: "Employment / Work History" },
  { key: "formalTraining", label: "Formal Training" },
  { key: "practicalExp", label: "Practical Experience" },
  { key: "education", label: "Educational Background" },
  { key: "clientList", label: "Client List (Athletes Represented)" },
  { key: "references", label: "References" },
  { key: "financialParties", label: "Financially Interested Parties" },
  { key: "licenseHistory", label: "License / Registration History" },
  { key: "feeSchedule", label: "Fee Schedule" },
  { key: "other", label: "Other" },
];

const EMPTY_AGENT = {
  id: null,
  firstName: "", middleName: "", lastName: "", suffix: "",
  dob: "", birthCity: "", birthState: "", birthCountry: "",
  homeStreet: "", homeCity: "", homeState: "", homeZip: "", homeCounty: "",
  homePhone: "", mobilePhone: "", homeEmail: "", personalWebSocial: "",
  businessName: "", dba: "", natureOfBusiness: "",
  businessStreet: "", businessCity: "", businessState: "", businessZip: "", businessCounty: "",
  workPhone: "", fax: "", workEmail: "", businessWebSocial: "", registrationNo: "",
  currentRegistrations: "", certDetails: "",
  addendums: {},
};

/* ═══════════════════ INDEXEDDB PDF STORAGE ═══════════════════ */
/* Stores both state-form PDF bytes and addendum PDF bytes so they    survive page reloads without re-uploading.
   Key convention:  form:<formId>          → Uint8Array  (state form PDF)
                    add:<agentId>:<type>   → { name, bytes }  (addendum PDF)  */
const IDB_NAME = "agent_reg_store";
const IDB_STORE = "pdfs";
const IDB_VERSION = 1;

function openIDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("No indexedDB"));
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ── State-form PDF bytes ── */
async function idbSaveFormBytes(formId, bytes) {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(bytes, `form:${formId}`);
    await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = j; });
  } catch (e) { console.warn("IDB form save failed:", e); }
}
async function idbLoadFormBytes(formId) {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(`form:${formId}`);
    return new Promise(r => { req.onsuccess = () => r(req.result || null); req.onerror = () => r(null); });
  } catch (e) { return null; }
}
async function idbDeleteFormBytes(formId) {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(`form:${formId}`);
    await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = j; });
  } catch (e) { console.warn("IDB form delete failed:", e); }
}

/* ── Addendum PDF bytes ── */
async function idbSaveAddendum(agentId, addType, name, bytes) {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({ name, bytes }, `add:${agentId}:${addType}`);
    await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = j; });
  } catch (e) { console.warn("IDB addendum save failed:", e); }
}
async function idbLoadAgent(agentId) {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const prefix = `add:${agentId}:`;
    return new Promise((resolve) => {
      const result = {};
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(result);
        const key = cursor.key;
        if (typeof key === "string" && key.startsWith(prefix)) {
          const addType = key.slice(prefix.length);
          const val = cursor.value;
          if (val && val.name !== undefined && val.bytes) {
            result[addType] = val;
          } else if (val instanceof Uint8Array || ArrayBuffer.isView(val)) {
            result[addType] = { name: "", bytes: val };
          }
        }
        cursor.continue();
      };
      req.onerror = () => resolve(result);
    });
  } catch (e) { console.warn("IDB load failed:", e); return {}; }
}
async function idbDeleteAgent(agentId) {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const prefix = `add:${agentId}:`;
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) cursor.delete();
      cursor.continue();
    };
    await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = j; });
  } catch (e) { console.warn("IDB delete failed:", e); }
}

/* ── Bulk hydration helpers ── */
async function hydrateFormsFromIDB(forms) {
  return Promise.all(forms.map(async (form) => {
    if (!form.id) return form;
    if (form.bytes && form.bytes.length > 0) return form;
    const raw = await idbLoadFormBytes(form.id);
    if (!raw) return form;
    return { ...form, bytes: Array.from(raw) };
  }));
}
async function hydrateAgentsFromIDB(agents) {
  return Promise.all(agents.map(async (agent) => {
    if (!agent.id) return agent;
    const idbData = await idbLoadAgent(agent.id);
    if (Object.keys(idbData).length === 0) return agent;
    const merged = { ...(agent.addendums || {}) };
    for (const [addType, entry] of Object.entries(idbData)) {
      merged[addType] = {
        name: merged[addType]?.name || entry.name || "",
        bytes: Array.from(entry.bytes),
      };
    }
    return { ...agent, addendums: merged };
  }));
}

/* ═══════════════════ AUTO-MAP ENGINE ═══════════════════ */
function normFieldName(raw) {
  return raw
    .replace(/\[\d+\]/g, "")            // strip [0], [1], etc. (XFA indices)
    .replace(/#\w+/g, "")               // strip #subform, #pageSet, etc.
    .replace(/^form\d+\./i, "")          // strip form1. prefix
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-\.\/\\:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Extract just the leaf (last segment) from a dotted field path */
function leafFieldName(raw) {
  const segments = raw.replace(/\[\d+\]/g, "").split(/[.\/]/);
  const leaf = segments.filter(s => s && !s.startsWith("#") && !/^form\d+$/i.test(s)).pop() || raw;
  return leaf.replace(/[_\-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().toLowerCase();
}

/* --- Typed addendum field patterns: route fields to specific addendum types --- */
const ADDENDUM_FIELD_PATTERNS = [
  // Officers / Shareholders / Directors / Financially Interested Parties
  // NOTE: removed /principal/i — too broad, matches "Principal Business Address"
  { patterns: [/officer/i, /shareholder/i, /director(?!.*mail)/i,
    /equity.*holder/i, /financially.*interest/i, /interest.*percent/i,
    /profit.*shar/i, /corporation.*officer/i, /not\s*a\s*corporation/i,
    /member.*manager/i, /associate.*sharer/i, /principal.*officer/i,
    /principal.*partner/i, /principal.*owner/i,
    /^name\s*of\s*person$/i, /^title$/i], addType: "financialParties" },

  // Employment / Work History
  // NOTE: removed /name\s*of\s*business.*employer/i — that's Q4 current employer, not history
  { patterns: [/employ(ment|er).*hist/i, /work.*hist/i, /occupation.*hist/i,
    /previous.*employ/i, /past.*employ/i, /job.*hist/i,
    /business.*engaged/i, /self.?employ/i,
    /employment.*record/i, /work.*record/i,
    /business\s*(or|&|and)\s*occupation/i], addType: "workHistory" },

  // Formal Training / Practical Experience / Education
  { patterns: [/formal\s*train/i, /practical\s*experience/i, /education.*background/i,
    /educational.*hist/i, /training.*program/i, /certification.*program/i,
    /degree.*obtained/i, /school.*attended/i, /college.*university/i,
    /institution.*name/i, /field.*study/i, /year.*graduat/i], addType: "formalTraining" },

  // Client List / Athletes Represented
  // NOTE: /list.*athlete/i changed to require "represent" to avoid false matches
  //       Added /acted.*a(s|gent)/i for TN Q19 "acted as athlete agent"
  { patterns: [/client\s*list/i, /athlete.*represent/i, /player.*represent/i,
    /current.*client/i, /student.*athlete.*(?:name|list|represent|contact|acted)/i,
    /list.*athlete.*represent/i, /name.*athlete.*represent/i,
    /acted.*a(s\s*)?a(thlete\s*)?(gent|agent)/i,
    /athlete.*agent.*(?:last|five|past|\d+\s*year)/i,
    /student.*athlete.*(?:last|five|past|\d+\s*year)/i,
    /\bsport\b(?!.*agent)/i, /\bteam\b/i], addType: "clientList" },

  // References
  { patterns: [/reference.*name/i, /reference.*address/i, /reference.*phone/i,
    /professional.*reference/i, /personal.*reference/i, /character.*reference/i,
    /reference.*\d/i, /^\d+\s*name\s*of\s*person/i], addType: "references" },

  // License / Registration History
  { patterns: [/license.*hist/i, /registration.*hist/i, /previous.*license/i,
    /other.*state.*license/i, /denied.*license/i, /revoked/i, /suspended.*license/i],
    addType: "licenseHistory" },

  // Fee Schedule
  { patterns: [/fee\s*schedule/i, /compensation.*schedule/i, /fee.*structure/i,
    /rate.*schedule/i], addType: "feeSchedule" },
];

const AUTO_MAP_RULES = [
  // Personal
  { patterns: [/first\s*name/i, /fname/i, /given\s*name/i, /^first$/i, /applicant\s*first/i, /name.*first/i], value: "firstName" },
  { patterns: [/middle\s*name/i, /mname/i, /^middle$/i, /\bmi\b/i, /m\.?i\.?$/i, /middle\s*initial/i, /name.*middle/i], value: "middleName" },
  { patterns: [/last\s*name/i, /lname/i, /surname/i, /family\s*name/i, /^last$/i, /applicant\s*last/i, /name.*last/i], value: "lastName" },
  { patterns: [/\bsuffix\b/i, /name\s*suffix/i], value: "suffix" },
  { patterns: [/full\s*name/i, /^name$/i, /applicant\s*name/i, /agent\s*name/i, /print\s*name/i, /^name\s*of\s*(applicant|agent)/i, /printed\s*name/i, /^your\s*name/i], value: "_fullName" },
  { patterns: [/date\s*of\s*birth/i, /\bdob\b/i, /birth\s*date/i, /birthdate/i, /\bborn\b.*date/i], value: "_dobFormatted" },
  { patterns: [/place\s*of\s*birth/i, /birth\s*place/i, /born\s*in/i, /city.*birth/i, /birth.*city.*state/i], value: "_birthPlace" },
  { patterns: [/birth\s*state/i, /state\s*of\s*birth/i], value: "birthState" },
  { patterns: [/birth\s*country/i, /country\s*of\s*birth/i], value: "birthCountry" },
  { patterns: [/birth\s*city/i, /city\s*of\s*birth/i], value: "birthCity" },

  // Home / Mailing address — specific patterns
  // NOTE: "mail address" (without "ing") for VA-style forms like MAIL_ADDRESS
  { patterns: [/home\s*address/i, /residential\s*address/i, /mailing\s*address/i, /mail\s*address/i, /personal\s*address/i, /residence\s*address/i, /current\s*address/i, /home\s*street/i], value: "homeStreet" },
  { patterns: [/home\s*city/i, /residential\s*city/i, /mailing\s*city/i, /mail.*city/i, /city\s*of\s*residence/i], value: "homeCity" },
  { patterns: [/home\s*state/i, /residential\s*state/i, /mailing\s*state/i, /mail.*state(?!.*ment)/i, /state\s*of\s*residence/i], value: "homeState" },
  { patterns: [/home\s*zip/i, /residential\s*zip/i, /mailing\s*zip/i, /mail.*zip/i], value: "homeZip" },
  { patterns: [/home\s*county/i, /county\s*of\s*residence/i, /residential\s*county/i], value: "homeCounty" },

  // Contact — phone patterns include "telephone" variations and VA-style "Primary"/"Alternate"
  { patterns: [/home\s*(phone|tele)/i, /personal\s*(phone|tele)/i, /daytime\s*(phone|tele)/i, /residential\s*(phone|tele)/i], value: "homePhone" },
  { patterns: [/mobile\s*(phone|tele)?/i, /cell\s*(phone|tele)/i, /\bcell\b/i, /cellular/i, /mobile\s*tele/i, /\balternate\b/i, /cellphone/i], value: "mobilePhone" },
  { patterns: [/e-?mail\s*address/i, /personal\s*e-?mail/i, /home\s*e-?mail/i, /^e-?mail$/i, /contact\s*e-?mail/i, /applicant\s*e-?mail/i, /e-?mail\s*of/i], value: "homeEmail" },

  // Business — workplace / office / employer all map to business fields (NOT home)
  { patterns: [/business\s*name/i, /employer\s*name/i, /firm\s*name/i, /company\s*name/i, /agency\s*name/i, /entity\s*name/i, /name\s*of\s*(business|employer|firm|company|agency|entity)/i, /employing\s*firm/i], value: "businessName" },
  { patterns: [/\bdba\b/i, /doing\s*business\s*as/i, /trade\s*name/i, /d\s*b\s*a/i], value: "dba" },
  { patterns: [/nature\s*of\s*business/i, /type\s*of\s*business/i, /business\s*type/i], value: "natureOfBusiness" },
  { patterns: [/business\s*address/i, /business\s*street/i, /employer\s*address/i, /office\s*address/i, /firm\s*address/i, /company\s*address/i, /workplace\s*address/i, /work\s*address/i, /place\s*of\s*business/i, /principal\s*business\s*address/i, /principal\s*address/i, /physical\s*address/i], value: "businessStreet" },
  { patterns: [/business\s*city/i, /employer\s*city/i, /office\s*city/i, /workplace\s*city/i, /city.*_2/i, /city.*2$/i, /physical.*city/i], value: "businessCity" },
  { patterns: [/business\s*state/i, /employer\s*state/i, /office\s*state/i, /workplace\s*state/i, /state.*_2/i, /state.*2$/i, /physical.*state/i], value: "businessState" },
  { patterns: [/business\s*zip/i, /employer\s*zip/i, /office\s*zip/i, /workplace\s*zip/i, /zip.*_2/i, /zip.*2$/i, /zip.*code.*_2/i, /zip.*code.*2$/i, /physical.*zip/i], value: "businessZip" },
  { patterns: [/business\s*county/i, /employer\s*county/i, /workplace\s*county/i], value: "businessCounty" },
  { patterns: [/work\s*(phone|tele)/i, /business\s*(phone|tele)/i, /office\s*(phone|tele)/i, /employer\s*(phone|tele)/i, /bus.*(phone|tele)/i, /work.*number/i, /contact.*primary/i, /primary.*contact/i, /\bprimary\b(?!.*address)/i], value: "workPhone" },
  { patterns: [/\bfax\b/i, /fax\s*number/i, /facsimile/i, /fax\s*#/i], value: "fax" },
  { patterns: [/work\s*e-?mail/i, /business\s*e-?mail/i, /office\s*e-?mail/i, /employer\s*e-?mail/i], value: "workEmail" },
  { patterns: [/business\s*web/i, /company\s*web/i, /website/i, /web\s*address/i, /url/i], value: "businessWebSocial" },
  { patterns: [/registration\s*no/i, /license\s*no/i, /reg\s*#/i, /license\s*#/i, /registration\s*number/i, /license\s*number/i, /cert.*number/i, /certificate\s*no/i], value: "registrationNo" },

  // Registrations — broad patterns for Section 5 type fields
  { patterns: [/states?\s*registered/i, /other\s*states?/i, /jurisdictions?/i, /states?\s*licensed/i,
    /registered\s*in/i, /states?\s*of\s*registration/i, /list.*states?/i,
    /currently\s*registered/i, /currently\s*licensed/i, /other.*jurisdict/i,
    /states?\s*where/i, /additional\s*states?/i, /states?\s*applied/i,
    /states?\s*hold/i, /registered.*states?/i, /licensed.*states?/i], value: "currentRegistrations" },

  // Generic catch-alls (matched last)
  { patterns: [/street\s*address/i, /address\s*line\s*1/i, /address\s*1/i, /^address$/i, /^street$/i, /address\s*line/i], value: "homeStreet" },
  { patterns: [/phone\s*number/i, /telephone\s*number/i, /telephone/i, /\bphone\b/i, /\btel\b/i, /contact\s*number/i, /tele.*number/i], value: "homePhone" },
  { patterns: [/e.?mail/i], value: "homeEmail" },
  { patterns: [/postal\s*code/i, /zip\s*code/i, /\bzip\b/i], value: "homeZip" },
  { patterns: [/^city$/i], value: "homeCity" },
  { patterns: [/^state$/i], value: "homeState" },
];

// Fields to auto-skip (sensitive / manual entry)
const SKIP_PATTERNS = [/\bssn\b/i, /social\s*security/i, /\bsignature\b/i, /^sign$/i, /date\s*signed/i, /\bnotary\b/i, /\bsworn\b/i, /\bwitness\b/i, /\bseal\b/i, /payment/i, /\bcheck\b.*no/i, /money\s*order/i, /\bamount/i];

function autoMapField(fieldName) {
  const name = normFieldName(fieldName);
  const leaf = leafFieldName(fieldName);

  // Skip sensitive / manual fields first
  for (const pat of SKIP_PATTERNS) {
    if (pat.test(name) || pat.test(leaf)) return "_SKIP";
  }

  // ── SPECIAL: DOB vs Place-of-Birth disambiguation ──
  // VA form has DOB_POB[0].DOB[0] (date) and DOB_POB[0].TX_DOB[1] (place)
  // Both normalize to contain "dob" — use leaf to decide
  if (/\bdob\b/i.test(name) && /\bpob\b/i.test(name)) {
    // Leaf is just "DOB" → date of birth; leaf is "TX_DOB" or has prefix → place of birth
    if (/^dob$/i.test(leaf)) return "_dobFormatted";
    return "_birthPlace";
  }

  // ── SPECIAL: "Current Business/Employer" tables → NOT addendum ──
  // VA Q14A: CurrentBusiness-Employer table has Row1 with BusinessEmployer, Address, Telephone, etc.
  // These are CURRENT employer info, not employment history.
  const isCurrentBizTable = /current.*business/i.test(name) || /current.*employ(?!.*hist)/i.test(name);
  if (isCurrentBizTable && /row\s*\d+/i.test(name)) {
    // Map based on leaf field name
    if (/business\s*employer/i.test(leaf) || /^name$/i.test(leaf)) return "businessName";
    if (/^address$/i.test(leaf)) return "_bizAddrFull";
    if (/tele/i.test(leaf) || /phone/i.test(leaf)) return "workPhone";
    if (/nature/i.test(leaf) || /^business$/i.test(leaf)) return "natureOfBusiness";
    if (/form.*organ/i.test(leaf) || /^org$/i.test(leaf)) return "_SKIP";
    // Owners/Partners sub-table within CurrentBusiness
    if (/full.*name/i.test(leaf) || /title/i.test(leaf) || /ss.*no/i.test(leaf)) return "_ADD_financialParties";
    // If within OwnerNme / OwnersPartners table
    if (/owner/i.test(name) || /partner/i.test(name)) return "_ADD_financialParties";
    return "_SKIP";
  }

  // ── SPECIAL: Detect table row fields that should be addendum ──
  // Fields like "Row1_FullName", "employer.0.name", "reference[2]" etc.
  if (/row\s*\d+/i.test(name)) {
    if (/full\s*name/i.test(name) || /complete.*address/i.test(name) || /street.*address/i.test(name) ||
        /title/i.test(leaf) || /percent/i.test(name) || /interest/i.test(name) ||
        /officer/i.test(name) || /shareholder/i.test(name) || /director/i.test(name) ||
        /owner/i.test(name) || /partner/i.test(name)) {
      return "_ADD_financialParties";
    }
    if (/employment\s*hist/i.test(name) || /emp\s*hist/i.test(name) ||
        /occupation/i.test(leaf) || /yrs\s*employ/i.test(leaf) ||
        /start\s*date/i.test(leaf) || /end\s*date/i.test(leaf) || /dates?\s*of/i.test(leaf)) {
      return "_ADD_workHistory";
    }
    if (/education/i.test(name) || /training/i.test(name) || /school/i.test(name) ||
        /degree/i.test(leaf) || /institution/i.test(leaf) || /program/i.test(leaf) ||
        /table\s*edu/i.test(name)) {
      return "_ADD_formalTraining";
    }
    if (/athlete/i.test(name) || /client/i.test(name) || /player/i.test(name) || /sport/i.test(leaf) ||
        /student/i.test(name)) {
      return "_ADD_clientList";
    }
    if (/reference/i.test(name)) {
      return "_ADD_references";
    }
    if (/reciprocity/i.test(name) || /lic\s*cert/i.test(leaf) || /exp\s*date/i.test(leaf) || /status/i.test(leaf)) {
      return "_ADD_licenseHistory";
    }
    // Generic table row field → likely addendum, skip individual cells
    return "_SKIP";
  }

  // Check typed addendum patterns (override standard field mappings)
  for (const rule of ADDENDUM_FIELD_PATTERNS) {
    for (const pat of rule.patterns) {
      if (pat.test(name)) return "_ADD_" + rule.addType;
    }
  }

  // Run standard mapping rules
  for (const rule of AUTO_MAP_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(name) || pat.test(leaf)) return rule.value;
    }
  }
  return "_SKIP";
}

function autoMapAllFields(detectedFields) {
  const mappings = {};
  const usedValues = new Set();
  const detectedAddendumTypes = new Set();

  // ── PASS 1: Standard per-field mapping (no duplicate tracking yet) ──
  const fieldList = detectedFields.map(df => ({
    name: df.name,
    mapped: autoMapField(df.name),
  }));

  // ── PASS 2: Neighborhood-aware addendum re-mapping ──
  // Fields with generic home/personal mappings or unmatched _SKIP near addendum
  // fields get re-mapped to the dominant addendum type in their neighborhood.
  // This handles flat-named forms (NY) where "Address", "City", "Phone" etc.
  // appear in addendum sections but have no section-specific field names.
  const WINDOW = 5;
  const REMAPPABLE_GENERIC = new Set([
    "_fullName", "_fullNameLF", "_homeAddrFull",
    "homeStreet", "homeCity", "homeState", "homeZip", "homeCounty",
    "homePhone", "homeEmail", "mobilePhone",
  ]);

  // Snapshot of original pass-1 mappings (prevents cascade across sections)
  const origMapped = fieldList.map(item => item.mapped);

  for (let i = 0; i < fieldList.length; i++) {
    const item = fieldList[i];
    const isSkip = item.mapped === "_SKIP";
    const isGeneric = REMAPPABLE_GENERIC.has(item.mapped);
    if (!isSkip && !isGeneric) continue; // specific mapping — keep it

    // Never remap intentionally-skipped sensitive fields (SSN, signature, etc.)
    if (isSkip) {
      const nm = normFieldName(item.name);
      const lf = leafFieldName(item.name);
      if (SKIP_PATTERNS.some(pat => pat.test(nm) || pat.test(lf))) continue;
    }

    // Count addendum types in neighborhood (using ORIGINAL pass-1 mappings)
    const addCounts = {};
    for (let j = Math.max(0, i - WINDOW); j <= Math.min(fieldList.length - 1, i + WINDOW); j++) {
      if (j === i) continue;
      const m = origMapped[j];
      if (m.startsWith("_ADD_")) {
        addCounts[m] = (addCounts[m] || 0) + 1;
      }
    }
    const best = Object.entries(addCounts).sort((a, b) => b[1] - a[1])[0];
    if (!best) continue;

    // _SKIP fields: threshold 1 (they have no mapping otherwise)
    // Generic mapped fields: threshold 2 (need stronger evidence to override)
    const threshold = isSkip ? 1 : 2;
    if (best[1] >= threshold) {
      item.mapped = best[0];
    }
  }

  // ── PASS 3: Apply mappings with duplicate tracking ──
  for (const item of fieldList) {
    const mapped = item.mapped;
    if (mapped !== "_SKIP") {
      if (mapped.startsWith("_ADD_")) {
        detectedAddendumTypes.add(mapped.replace("_ADD_", ""));
      }
      // Computed fields & addendums can map to multiple PDF fields; regular fields only once
      if (!mapped.startsWith("_") && usedValues.has(mapped)) {
        mappings[item.name] = "_SKIP";
      } else {
        mappings[item.name] = mapped;
        if (!mapped.startsWith("_")) usedValues.add(mapped);
      }
    } else {
      mappings[item.name] = "_SKIP";
    }
  }
  return { mappings, detectedAddendumTypes: Array.from(detectedAddendumTypes) };
}

/* ═══════════════════ HELPERS ═══════════════════ */
function getComputed(agent, key) {
  const a = agent;
  switch (key) {
    case "_fullName": return [a.firstName, a.middleName, a.lastName].filter(Boolean).join(" ");
    case "_fullNameLF": return a.lastName && a.firstName ? `${a.lastName}, ${a.firstName}${a.middleName ? " " + a.middleName : ""}` : "";
    case "_homeAddrFull": return [a.homeStreet, a.homeCity, a.homeState, a.homeZip].filter(Boolean).join(", ");
    case "_bizAddrFull": return [a.businessStreet, a.businessCity, a.businessState, a.businessZip].filter(Boolean).join(", ");
    case "_birthPlace": return [a.birthCity, a.birthState, a.birthCountry].filter(Boolean).join(", ");
    case "_dobFormatted": return a.dob ? new Date(a.dob + "T00:00:00").toLocaleDateString("en-US") : "";
    default: return "";
  }
}

function getAgentValue(agent, mappingKey, addendumNumberMap, opts = {}) {
  if (!mappingKey || mappingKey === "_SKIP") return null;
  if (mappingKey === "_ADDENDUM") return "See Attached Addendum";
  if (mappingKey.startsWith("_ADD_")) {
    const addType = mappingKey.replace("_ADD_", "");
    const num = addendumNumberMap?.[addType];
    const label = ADDENDUM_TYPES.find(t => t.key === addType)?.label || addType;
    // Short mode for table row cells (limited space)
    if (opts.short) return num ? `See Addendum ${num}` : "See Addendum";
    if (num) return `See Attached Addendum ${num} - ${label}`;
    return `See Attached Addendum - ${label}`;
  }
  if (mappingKey.startsWith("_")) return getComputed(agent, mappingKey);
  return agent[mappingKey] || "";
}

function downloadBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════ SMALL UI BITS ═══════════════════ */
const ic = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const lc = "block text-xs font-medium text-gray-500 mb-1";
const btnPrimary = "px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50";
const btnSecondary = "px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50";
const btnGreen = "px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50";

function Badge({ color, children }) {
  const c = { blue: "bg-blue-100 text-blue-800", green: "bg-green-100 text-green-800", amber: "bg-amber-100 text-amber-800", gray: "bg-gray-100 text-gray-700", red: "bg-red-100 text-red-800", purple: "bg-purple-100 text-purple-800" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c[color] || c.gray}`}>{children}</span>;
}

function EmptyState({ icon, title, sub, action, actionLabel }) {
  return (
    <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{sub}</p>
      {action && <button onClick={action} className={btnPrimary}>{actionLabel}</button>}
    </div>
  );
}

/* ═══════════════════ AGENT FORM ═══════════════════ */
function AgentForm({ agent, onSave, onCancel }) {
  const [f, setF] = useState(agent ? JSON.parse(JSON.stringify(agent)) : JSON.parse(JSON.stringify(EMPTY_AGENT)));
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  const fileRef = useRef(null);
  const [uploadingType, setUploadingType] = useState(null);

  // Hydrate addendum bytes: first from parent agent prop, then from IndexedDB
  useEffect(() => {
    if (agent && agent.addendums) {
      setF(prev => {
        const merged = { ...prev.addendums };
        for (const [k, v] of Object.entries(agent.addendums)) {
          if (v && v.bytes && v.bytes.length > 0 && (!merged[k]?.bytes?.length)) {
            merged[k] = v;
          }
        }
        return { ...prev, addendums: merged };
      });
    }
    if (agent && agent.id) {
      idbLoadAgent(agent.id).then(idbData => {
        if (Object.keys(idbData).length === 0) return;
        setF(prev => {
          const merged = { ...prev.addendums };
          for (const [addType, entry] of Object.entries(idbData)) {
            if (!merged[addType]?.bytes?.length) {
              merged[addType] = {
                name: merged[addType]?.name || entry.name || "",
                bytes: Array.from(entry.bytes),
              };
            }
          }
          return { ...prev, addendums: merged };
        });
      });
    }
  }, []);

  const handleAddendumUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingType) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const bytes = Array.from(new Uint8Array(ev.target.result));
      setF(p => ({ ...p, addendums: { ...p.addendums, [uploadingType]: { name: file.name, bytes } } }));
      setUploadingType(null);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const removeAddendum = (key) => {
    setF(p => { const a = { ...p.addendums }; delete a[key]; return { ...p, addendums: a }; });
  };

  const groups = [
    { title: "Personal Information", fields: ["firstName", "middleName", "lastName", "suffix", "dob", "birthCity", "birthState", "birthCountry"] },
    { title: "Home Address", fields: ["homeStreet", "homeCity", "homeState", "homeZip", "homeCounty"] },
    { title: "Contact", fields: ["homePhone", "mobilePhone", "homeEmail", "personalWebSocial"] },
    { title: "Business / Employer", fields: ["businessName", "dba", "natureOfBusiness", "businessStreet", "businessCity", "businessState", "businessZip", "businessCounty", "workPhone", "fax", "workEmail", "businessWebSocial", "registrationNo"] },
    { title: "Registrations & Certifications", fields: ["currentRegistrations", "certDetails"] },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">{agent ? "Edit Agent" : "Add New Agent"}</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className={btnSecondary}>Cancel</button>
          <button onClick={() => onSave({ ...f, id: f.id || Date.now() })} className={btnPrimary}>Save Agent</button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-6 text-sm text-amber-800">
        Only base info here. <strong>SSN, signatures, payment</strong> — your team enters those directly on each form.
      </div>

      {groups.map(g => (
        <div key={g.title} className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-800 mb-3 uppercase tracking-wide">{g.title}</p>
          <div className="grid grid-cols-2 gap-3">
            {g.fields.map(k => {
              const meta = AGENT_FIELDS.find(f => f.key === k);
              const isTextarea = ["personalWebSocial", "businessWebSocial", "currentRegistrations", "certDetails"].includes(k);
              return (
                <div key={k} className={["homeStreet", "businessStreet", "personalWebSocial", "businessWebSocial", "currentRegistrations", "certDetails"].includes(k) ? "col-span-2" : ""}>
                  <label className={lc}>{meta?.label || k}</label>
                  {isTextarea ? (
                    <textarea className={ic} rows={2} value={f[k]} onChange={e => u(k, e.target.value)} />
                  ) : k === "dob" ? (
                    <input className={ic} type="date" value={f[k]} onChange={e => u(k, e.target.value)} />
                  ) : (
                    <input className={ic} value={f[k]} onChange={e => u(k, e.target.value)}
                      placeholder={k === "homeStreet" ? "e.g. 123 Main Street, Apt 4B" : k === "businessStreet" ? "e.g. 456 Commerce Blvd, Suite 200" : ""} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Addendums */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-1 uppercase tracking-wide">Addendum PDFs</p>
        <p className="text-xs text-gray-500 mb-3">Upload PDF addendums for this agent. They will be merged into the final output automatically.</p>
        <input type="file" ref={fileRef} accept=".pdf" className="hidden" onChange={handleAddendumUpload} />
        <div className="space-y-2">
          {ADDENDUM_TYPES.map(t => {
            const has = f.addendums[t.key];
            const hasBytes = has && has.bytes && has.bytes.length > 0;
            return (
              <div key={t.key} className={`flex items-center justify-between p-2 rounded border ${hasBytes ? "bg-green-50 border-green-200" : has ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${hasBytes ? "bg-green-500" : has ? "bg-amber-500" : "bg-gray-300"}`} />
                  <span className="text-sm text-gray-700">{t.label}</span>
                  {has && <Badge color={hasBytes ? "green" : "amber"}>{has.name}{!hasBytes ? " (re-upload needed)" : ""}</Badge>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setUploadingType(t.key); setTimeout(() => fileRef.current?.click(), 0); }}
                    className="text-xs px-2 py-1 border border-blue-300 text-blue-700 rounded hover:bg-blue-50">
                    {has ? (hasBytes ? "Replace" : "Re-upload") : "Upload PDF"}
                  </button>
                  {has && <button onClick={() => removeAddendum(t.key)} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50">Remove</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 mb-8">
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button onClick={() => onSave({ ...f, id: f.id || Date.now() })} className={btnPrimary}>Save Agent</button>
      </div>
    </div>
  );
}

/* ═══════════════════ FORM MAPPING ═══════════════════ */
function FieldMapper({ form, onUpdate, onAutoMap }) {
  const allOptions = [
    { label: "-- Skip --", value: "_SKIP" },
    ...SPECIAL_MAPPINGS.filter(s => s.key !== "_SKIP").map(s => ({ label: s.label, value: s.key })),
    ...COMPUTED_FIELDS.map(f => ({ label: `* ${f.label}`, value: f.key })),
    ...AGENT_FIELDS.map(f => ({ label: `${f.group} > ${f.label}`, value: f.key })),
  ];

  const mappedCount = Object.values(form.mappings).filter(v => v && v !== "_SKIP").length;
  const totalFields = form.detectedFields.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge color="blue">{mappedCount}/{totalFields} mapped</Badge>
          <Badge color="gray">{totalFields - mappedCount} skipped</Badge>
        </div>
        <button onClick={onAutoMap} className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700">
          Re-run Auto-Map
        </button>
      </div>
      <div className="space-y-1.5">
        {[...form.detectedFields]
          .sort((a, b) => {
            const aSkipped = !form.mappings[a.name] || form.mappings[a.name] === "_SKIP";
            const bSkipped = !form.mappings[b.name] || form.mappings[b.name] === "_SKIP";
            if (aSkipped !== bSkipped) return aSkipped ? 1 : -1;
            return 0;
          })
          .map((df, i) => {
            const currentVal = form.mappings[df.name] || "_SKIP";
            const isMapped = currentVal !== "_SKIP";
            const isAddendum = currentVal.startsWith("_ADD");
            return (
              <div key={i} className={`flex items-center gap-3 p-2 border rounded text-sm ${isAddendum ? "bg-purple-50 border-purple-200" : isMapped ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="w-1/3 min-w-0">
                  <span className="font-mono text-xs text-gray-600 truncate block" title={df.name}>{df.name}</span>
                  <Badge color={df.type === "PDFTextField" ? "blue" : df.type === "PDFCheckBox" ? "amber" : "gray"}>{df.type.replace("PDF", "").replace("Field", "")}</Badge>
                </div>
                <span className={isAddendum ? "text-purple-500" : isMapped ? "text-green-500" : "text-gray-300"}>{">"}</span>
                <select className={`flex-1 px-2 py-1.5 border rounded text-sm ${isAddendum ? "border-purple-300 bg-white" : isMapped ? "border-green-300 bg-white" : "border-gray-300"}`}
                  value={currentVal}
                  onChange={e => onUpdate(df.name, e.target.value)}>
                  {allOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ═══════════════════ TEXT PLACEMENT EDITOR ═══════════════════ */
const PLACEABLE_FIELDS = [
  ...AGENT_FIELDS.map(f => ({ key: f.key, label: f.label })),
  ...COMPUTED_FIELDS.map(f => ({ key: f.key, label: f.label })),
  ...SPECIAL_MAPPINGS.filter(f => f.key !== "_SKIP").map(f => ({ key: f.key, label: f.label })),
  { key: "_CUSTOM", label: "Custom Text" },
];

function TextPlacementEditor({ formBytes, placements = [], onUpdate }) {
  const canvasRef = useRef(null);
  const [pdfjs, setPdfjs] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [selField, setSelField] = useState("");
  const [customText, setCustomText] = useState("");
  const [fontSize, setFontSize] = useState(10);
  const scaleRef = useRef(1);
  const pgRef = useRef({ w: 612, h: 792 });

  useEffect(() => {
    (async () => {
      try {
        const lib = await import("pdfjs-dist");
        lib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version}/pdf.worker.min.mjs`;
        setPdfjs(lib);
      } catch (e) { console.warn("pdf.js load:", e); }
    })();
  }, []);

  useEffect(() => {
    if (!pdfjs || !formBytes?.length) return;
    pdfjs.getDocument({ data: new Uint8Array(formBytes) }).promise
      .then(d => { setPdfDoc(d); setNumPages(d.numPages); })
      .catch(e => console.warn("PDF open:", e));
  }, [pdfjs, formBytes]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    pdfDoc.getPage(pageNum + 1).then(page => {
      if (cancelled) return;
      const vp = page.getViewport({ scale: 1 });
      const s = Math.min(580 / vp.width, 1.5);
      scaleRef.current = s;
      pgRef.current = { w: vp.width, h: vp.height };
      const svp = page.getViewport({ scale: s });
      const c = canvasRef.current;
      c.width = svp.width; c.height = svp.height;
      const ctx = c.getContext("2d");
      page.render({ canvasContext: ctx, viewport: svp }).promise.then(() => {
        if (cancelled) return;
        const marks = placements.filter(p => p.page === pageNum);
        for (const m of marks) {
          const cx = m.x * s, cy = (pgRef.current.h - m.y) * s;
          ctx.font = "10px sans-serif";
          const tw = Math.max(ctx.measureText(m.label).width + 10, 50);
          ctx.fillStyle = "rgba(37,99,235,0.15)";
          ctx.fillRect(cx, cy - 13, tw, 16);
          ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 1;
          ctx.strokeRect(cx, cy - 13, tw, 16);
          ctx.fillStyle = "#1e40af";
          ctx.fillText(m.label, cx + 3, cy - 1);
        }
      });
    });
    return () => { cancelled = true; };
  }, [pdfDoc, pageNum, placements]);

  const handleClick = (e) => {
    if (!selField) return;
    if (selField === "_CUSTOM" && !customText.trim()) return;
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const cx = (e.clientX - r.left) * (c.width / r.width);
    const cy = (e.clientY - r.top) * (c.height / r.height);
    const s = scaleRef.current;
    const pdfX = Math.round(cx / s * 10) / 10;
    const pdfY = Math.round((pgRef.current.h - cy / s) * 10) / 10;
    const fDef = PLACEABLE_FIELDS.find(f => f.key === selField);
    const label = selField === "_CUSTOM" ? customText.trim() : (fDef?.label || selField);
    onUpdate([...placements, {
      page: pageNum, x: pdfX, y: pdfY, fieldKey: selField,
      customText: selField === "_CUSTOM" ? customText.trim() : "",
      fontSize, label,
    }]);
  };

  if (!pdfjs) return <div className="text-sm text-gray-500 py-4">Loading PDF viewer...</div>;
  if (!formBytes?.length) return <div className="text-sm text-gray-500 py-4">Upload a form first.</div>;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-2 uppercase">Text Placement</p>
      <p className="text-xs text-gray-500 mb-3">Select a field, then click on the page where it should appear.</p>
      <div className="flex flex-wrap gap-2 mb-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className={lc}>Field</label>
          <select className={ic} value={selField} onChange={e => setSelField(e.target.value)}>
            <option value="">-- Select field --</option>
            {PLACEABLE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
        {selField === "_CUSTOM" && (
          <div className="flex-1 min-w-[120px]">
            <label className={lc}>Text</label>
            <input className={ic} value={customText} onChange={e => setCustomText(e.target.value)} placeholder="Type text..." />
          </div>
        )}
        <div className="w-20">
          <label className={lc}>Size</label>
          <input className={ic} type="number" min={6} max={24} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button disabled={pageNum <= 0} onClick={() => setPageNum(p => p - 1)} className="px-2 py-1 text-xs border rounded disabled:opacity-30">&lsaquo;</button>
        <span className="text-xs text-gray-600">Page {pageNum + 1} of {numPages}</span>
        <button disabled={pageNum >= numPages - 1} onClick={() => setPageNum(p => p + 1)} className="px-2 py-1 text-xs border rounded disabled:opacity-30">&rsaquo;</button>
      </div>
      <div className={`border rounded overflow-hidden mb-3 bg-gray-100 ${selField ? "cursor-crosshair" : "cursor-default"} ${!selField ? "border-gray-300" : "border-blue-400"}`}
        onClick={handleClick}>
        <canvas ref={canvasRef} className="block mx-auto" style={{ maxWidth: "100%" }} />
      </div>
      {placements.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-700 mb-1">{placements.length} placed field{placements.length !== 1 ? "s" : ""}:</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {placements.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-blue-50 rounded px-2 py-1">
                <span className="text-gray-700">{p.label} <span className="text-gray-400">— pg {p.page + 1}, {p.fontSize}pt</span></span>
                <button onClick={(e) => { e.stopPropagation(); onUpdate(placements.filter((_, j) => j !== i)); }} className="text-red-500 hover:text-red-700 ml-2">×</button>
              </div>
            ))}
          </div>
          <button onClick={() => onUpdate([])} className="text-xs text-red-500 hover:text-red-700 mt-1">Clear all</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ STATE FORMS TAB ═══════════════════ */
function StateFormsView({ forms, setForms, pdfLib }) {
  const fileRef = useRef(null);
  const [newState, setNewState] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pdfLib) return;
    setAnalyzing(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buf));
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      let detectedFields = [];
      try {
        const form = doc.getForm();
        detectedFields = form.getFields().map(f => ({
          name: f.getName(),
          type: f instanceof PDFTextField ? "PDFTextField" : f instanceof PDFCheckBox ? "PDFCheckBox" : f instanceof PDFDropdown ? "PDFDropdown" : "Other",
        }));
      } catch (_) {}
      // Auto-map fields and detect which addendum types are needed
      let autoMappings = {};
      let autoAddendumSlots = [];
      if (detectedFields.length > 0) {
        const result = autoMapAllFields(detectedFields);
        autoMappings = result.mappings;
        autoAddendumSlots = result.detectedAddendumTypes;
      }
      const newForm = {
        id: Date.now(), stateName: newState || "Unnamed", formLabel: newLabel || file.name,
        fileName: file.name, bytes, pageCount: doc.getPageCount(),
        detectedFields, mappings: autoMappings, isFieldable: detectedFields.length > 0,
        addendumSlots: autoAddendumSlots,
      };
      setForms(prev => [...prev, newForm]);
      idbSaveFormBytes(newForm.id, new Uint8Array(bytes));
      setNewState(""); setNewLabel("");
      setExpandedId(newForm.id);
    } catch (err) {
      console.error(err);
    }
    setAnalyzing(false);
    e.target.value = "";
  };

  const updateMapping = (formId, fieldName, value) => {
    setForms(prev => prev.map(f => {
      if (f.id !== formId) return f;
      const newMappings = { ...f.mappings, [fieldName]: value };
      // Auto-add addendum slot when a typed addendum mapping is selected
      let newSlots = [...(f.addendumSlots || [])];
      if (value.startsWith("_ADD_")) {
        const addType = value.replace("_ADD_", "");
        if (!newSlots.includes(addType)) newSlots.push(addType);
      }
      return { ...f, mappings: newMappings, addendumSlots: newSlots };
    }));
  };

  const toggleAddendumSlot = (formId, slot) => {
    setForms(prev => prev.map(f => {
      if (f.id !== formId) return f;
      const slots = (f.addendumSlots || []).includes(slot) ? f.addendumSlots.filter(s => s !== slot) : [...(f.addendumSlots || []), slot];
      return { ...f, addendumSlots: slots };
    }));
  };

  const removeForm = (id) => { idbDeleteFormBytes(id); setForms(prev => prev.filter(f => f.id !== id)); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">State Forms</h2>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <p className="text-xs font-semibold text-gray-800 mb-3 uppercase tracking-wide">Upload a State Form</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className={lc}>State Name</label>
            <input className={ic} placeholder="e.g. Pennsylvania" value={newState} onChange={e => setNewState(e.target.value)} />
          </div>
          <div>
            <label className={lc}>Form Label (optional)</label>
            <input className={ic} placeholder="e.g. Main Application" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
          </div>
          <div className="flex items-end">
            <input type="file" ref={fileRef} accept=".pdf" className="hidden" onChange={handleUpload} />
            <button onClick={() => fileRef.current?.click()} disabled={!pdfLib || analyzing} className={btnPrimary}>
              {analyzing ? "Analyzing..." : "Upload PDF"}
            </button>
          </div>
        </div>
        {!pdfLib && <p className="text-xs text-amber-600">Loading PDF library...</p>}
      </div>

      {forms.length === 0 ? (
        <EmptyState icon="📄" title="No forms uploaded" sub="Upload a state form PDF to get started. The app will detect fillable fields automatically." />
      ) : (
        <div className="space-y-3">
          {forms.map(form => {
            const expanded = expandedId === form.id;
            const mappedCount = Object.values(form.mappings).filter(v => v && v !== "_SKIP").length;
            const needsReupload = !form.bytes || form.bytes.length === 0;
            return (
              <div key={form.id} className={`bg-white rounded-lg border overflow-hidden ${needsReupload ? "border-red-300" : "border-gray-200"}`}>
                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expanded ? null : form.id)}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{form.stateName}</span>
                      <span className="text-sm text-gray-500">- {form.formLabel}</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      {needsReupload && <Badge color="red">Re-upload needed</Badge>}
                      <Badge color="gray">{form.pageCount} pages</Badge>
                      {form.isFieldable ? (
                        <Badge color="green">{form.detectedFields.length} fillable fields</Badge>
                      ) : (
                        <Badge color="amber">No fillable fields detected</Badge>
                      )}
                      {mappedCount > 0 && <Badge color="blue">{mappedCount} mapped</Badge>}
                      {(form.addendumSlots || []).length > 0 && <Badge color="purple">{form.addendumSlots.length} addendums</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); removeForm(form.id); }} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50">Delete</button>
                    <span className="text-gray-400 text-sm">{expanded ? "^" : "v"}</span>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-gray-200 p-4">
                    {form.isFieldable ? (
                      <>
                        <p className="text-xs font-semibold text-gray-700 mb-2 uppercase">Field Mapping</p>
                        <p className="text-xs text-gray-500 mb-3">Fields are auto-mapped on upload. Fix any that look wrong, or re-run auto-map.</p>
                        <FieldMapper form={form} onUpdate={(fn, val) => updateMapping(form.id, fn, val)}
                          onAutoMap={() => {
                            const result = autoMapAllFields(form.detectedFields);
                            setForms(prev => prev.map(f => f.id === form.id ? { ...f, mappings: result.mappings, addendumSlots: [...new Set([...(f.addendumSlots || []), ...result.detectedAddendumTypes])] } : f));
                          }} />
                      </>
                    ) : (
                      <TextPlacementEditor
                        formBytes={form.bytes}
                        placements={form.textPlacements || []}
                        onUpdate={(tp) => setForms(prev => prev.map(f => f.id === form.id ? { ...f, textPlacements: tp } : f))}
                      />
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 mb-2 uppercase">Addendums to Include</p>
                      <p className="text-xs text-gray-500 mb-2">Check which addendums to append. Auto-detected from field mapping are pre-checked.</p>
                      <div className="grid grid-cols-2 gap-1">
                        {ADDENDUM_TYPES.map(t => (
                          <label key={t.key} className="flex items-center gap-2 py-1 text-sm text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={(form.addendumSlots || []).includes(t.key)} onChange={() => toggleAddendumSlot(form.id, t.key)} />
                            {t.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ GENERATE TAB ═══════════════════ */
function GenerateView({ agents, forms, pdfLib }) {
  const [selFormId, setSelFormId] = useState(null);
  const [selAgentId, setSelAgentId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [lastResult, setLastResult] = useState(null);

  const selForm = forms.find(f => f.id === selFormId);
  const selAgent = agents.find(a => a.id === selAgentId);

  const handleGenerate = async () => {
    if (!selForm || !selAgent || !pdfLib) return;
    if (!selForm.bytes || selForm.bytes.length === 0) {
      setStatus("Error: Form PDF not loaded. Please re-upload this form in the State Forms tab.");
      return;
    }
    setGenerating(true); setStatus("Loading form..."); setLastResult(null);
    try {
      const formBytes = new Uint8Array(selForm.bytes);
      const doc = await PDFDocument.load(formBytes, { ignoreEncryption: true });

      // Build addendum numbering map
      const addendumNumberMap = {};
      let addNum = 1;
      for (const slot of (selForm.addendumSlots || [])) {
        addendumNumberMap[slot] = addNum++;
      }

      // Fill fields if form is fieldable
      if (selForm.isFieldable) {
        setStatus("Filling fields...");
        try {
          const form = doc.getForm();
          for (const [fieldName, mappingKey] of Object.entries(selForm.mappings)) {
            if (!mappingKey || mappingKey === "_SKIP") continue;
            // Use short text for table row fields to avoid overflow in small cells
            const isRowField = /row\s*\d+/i.test(normFieldName(fieldName));
            const value = getAgentValue(selAgent, mappingKey, addendumNumberMap, { short: isRowField });
            if (value === null || value === undefined || value === "") continue;
            try {
              const field = form.getField(fieldName);
              if (field instanceof PDFTextField) {
                field.setText(String(value));
              } else if (field instanceof PDFCheckBox) {
                if (["yes", "true", "1", "on", "x"].includes(String(value).toLowerCase())) field.check();
              } else if (field instanceof PDFDropdown) {
                try { field.select(String(value)); } catch (_) {}
              }
            } catch (_) {}
          }
          // Keep fields editable so user can correct errors / tweak addendum headers
          try { form.updateFieldAppearances(); } catch (_) {}
        } catch (formErr) {
          console.warn("Form fill warning:", formErr);
        }
      }

      // Apply text placements (for non-fillable forms or extra annotations)
      if (selForm.textPlacements && selForm.textPlacements.length > 0) {
        setStatus("Placing text...");
        const font = await doc.embedFont(StandardFonts.Helvetica);
        for (const tp of selForm.textPlacements) {
          try {
            let value;
            if (tp.fieldKey === "_CUSTOM") {
              value = tp.customText;
            } else {
              value = getAgentValue(selAgent, tp.fieldKey, addendumNumberMap);
            }
            if (!value) continue;
            const page = doc.getPage(tp.page);
            page.drawText(String(value), {
              x: tp.x, y: tp.y,
              size: tp.fontSize || 10,
              font, color: rgb(0, 0, 0),
            });
          } catch (e) { console.warn("Text placement:", e); }
        }
      }

      // Append addendum pages directly to the filled doc (preserves all form fields)
      setStatus("Assembling document...");
      let addendumCount = 0;
      let skippedAddendums = [];
      for (const slot of (selForm.addendumSlots || [])) {
        const addendum = selAgent.addendums?.[slot];
        if (!addendum) {
          skippedAddendums.push(ADDENDUM_TYPES.find(t => t.key === slot)?.label || slot);
          continue;
        }
        if (!addendum.bytes || addendum.bytes.length === 0) {
          skippedAddendums.push((ADDENDUM_TYPES.find(t => t.key === slot)?.label || slot) + " (needs re-upload)");
          continue;
        }
        try {
          const label = ADDENDUM_TYPES.find(t => t.key === slot)?.label || slot;
          setStatus(`Appending Addendum ${addendumNumberMap[slot]} - ${label}...`);
          const addBytes = new Uint8Array(addendum.bytes);
          const addDoc = await PDFDocument.load(addBytes, { ignoreEncryption: true });
          const addPages = await doc.copyPages(addDoc, addDoc.getPageIndices());
          addPages.forEach(p => doc.addPage(p));
          // Add editable header field at top of first addendum page
          try {
            const form = doc.getForm();
            const pg = addPages[0];
            const { width, height } = pg.getSize();
            const hdr = form.createTextField(`addendum_hdr_${slot}`);
            hdr.setText(`Addendum ${addendumNumberMap[slot]} — ${label}`);
            hdr.addToPage(pg, {
              x: 50, y: height - 50, width: width - 100, height: 28,
              backgroundColor: rgb(1, 1, 1), borderWidth: 0,
            });
            hdr.setFontSize(14);
          } catch (_) {}
          addendumCount++;
        } catch (e) {
          console.warn("Addendum merge skipped:", slot, e.message);
          skippedAddendums.push(ADDENDUM_TYPES.find(t => t.key === slot)?.label || slot);
        }
      }

      setStatus("Saving PDF...");
      const finalBytes = await doc.save();
      const agentName = [selAgent.firstName, selAgent.lastName].filter(Boolean).join("_") || "agent";
      const filename = `${selForm.stateName}_${agentName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(finalBytes, filename);
      setLastResult({ pages: doc.getPageCount(), addendums: addendumCount, filename, skippedAddendums });
      setStatus("");
    } catch (err) {
      console.error("Generate error:", err);
      setStatus("Error: " + (err.message || "Unknown error during generation"));
    }
    setGenerating(false);
  };

  // Build addendum numbering for preview
  const addendumNumberMap = {};
  let previewAddNum = 1;
  for (const slot of (selForm?.addendumSlots || [])) {
    addendumNumberMap[slot] = previewAddNum++;
  }

  const previewFields = selForm && selAgent && selForm.isFieldable ? Object.entries(selForm.mappings)
    .filter(([, v]) => v && v !== "_SKIP")
    .map(([fieldName, mappingKey]) => ({ fieldName, mappingKey, value: getAgentValue(selAgent, mappingKey, addendumNumberMap) })) : [];

  const missingAddendums = selForm && selAgent ? (selForm.addendumSlots || []).filter(s => !selAgent.addendums?.[s]) : [];
  const noByteAddendums = selForm && selAgent ? (selForm.addendumSlots || []).filter(s => {
    const add = selAgent.addendums?.[s];
    return add && (!add.bytes || add.bytes.length === 0);
  }) : [];
  const includedAddendums = selForm && selAgent ? (selForm.addendumSlots || []).filter(s => {
    const add = selAgent.addendums?.[s];
    return add && add.bytes && add.bytes.length > 0;
  }) : [];

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Generate Filled Form</h2>

      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-3 uppercase tracking-wide">1. Select State Form</p>
        {forms.length === 0 ? (
          <p className="text-sm text-gray-500">No forms uploaded yet. Go to State Forms tab first.</p>
        ) : (
          <div className="grid gap-2">
            {forms.map(f => (
              <button key={f.id} onClick={() => setSelFormId(f.id)}
                className={`text-left p-3 rounded border transition-colors ${selFormId === f.id ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}>
                <span className="font-semibold text-sm">{f.stateName}</span>
                <span className="text-sm text-gray-500 ml-2">- {f.formLabel}</span>
                <div className="flex gap-2 mt-1">
                  {f.isFieldable && <Badge color="green">{Object.values(f.mappings).filter(v => v && v !== "_SKIP").length} fields mapped</Badge>}
                  {!f.isFieldable && <Badge color="amber">Manual fill required</Badge>}
                  {(f.addendumSlots || []).length > 0 && <Badge color="purple">{f.addendumSlots.length} addendums</Badge>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-3 uppercase tracking-wide">2. Select Agent</p>
        {agents.length === 0 ? (
          <p className="text-sm text-gray-500">No agents yet. Go to Agents tab first.</p>
        ) : (
          <div className="grid gap-2">
            {agents.map(a => {
              const addCount = Object.keys(a.addendums || {}).length;
              const bytesCount = Object.values(a.addendums || {}).filter(v => v && v.bytes && v.bytes.length > 0).length;
              return (
                <button key={a.id} onClick={() => setSelAgentId(a.id)}
                  className={`text-left p-3 rounded border transition-colors ${selAgentId === a.id ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}>
                  <span className="font-semibold text-sm">{a.firstName} {a.lastName}</span>
                  {a.businessName && <span className="text-sm text-gray-500 ml-2">- {a.businessName}</span>}
                  <div className="flex gap-2 mt-1">
                    {bytesCount > 0 && <Badge color="green">{bytesCount} addendum{bytesCount > 1 ? "s" : ""} ready</Badge>}
                    {addCount > bytesCount && <Badge color="amber">{addCount - bytesCount} need re-upload</Badge>}
                    {addCount === 0 && <Badge color="gray">No addendums</Badge>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selForm && selAgent && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-800 mb-3 uppercase tracking-wide">3. Preview & Generate</p>

          {!selForm.isFieldable && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
              This form has no fillable fields. It will be included as blank pages for your team to fill manually.
            </div>
          )}

          {previewFields.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Fields that will be filled:</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {previewFields.map((pf, i) => (
                  <div key={i} className={`flex items-center justify-between py-1 px-2 rounded text-xs ${pf.mappingKey.startsWith("_ADD") ? "bg-purple-50" : "bg-green-50"}`}>
                    <span className="font-mono text-gray-600">{pf.fieldName}</span>
                    <span className={`font-medium truncate ml-2 max-w-xs ${pf.mappingKey.startsWith("_ADD") ? "text-purple-800" : "text-green-800"}`}>{pf.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {includedAddendums.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-green-700 font-medium mb-1">Addendums that will be attached:</p>
              {includedAddendums.map(s => (
                <div key={s} className="flex items-center gap-2 text-xs text-green-700 py-0.5">
                  <span>OK</span> Addendum {addendumNumberMap[s]} - {ADDENDUM_TYPES.find(t => t.key === s)?.label} ({selAgent.addendums[s]?.name})
                </div>
              ))}
            </div>
          )}

          {noByteAddendums.length > 0 && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
              <p className="text-xs text-red-800 font-medium mb-1">Addendums need re-upload (PDF data lost after page reload):</p>
              {noByteAddendums.map(s => (
                <div key={s} className="text-xs text-red-700 py-0.5">
                  Addendum {addendumNumberMap[s]} - {ADDENDUM_TYPES.find(t => t.key === s)?.label} -- go to Agents tab and re-upload
                </div>
              ))}
            </div>
          )}

          {missingAddendums.length > 0 && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded">
              <p className="text-xs text-amber-800 font-medium mb-1">Missing addendums (form expects these):</p>
              {missingAddendums.map(s => (
                <div key={s} className="text-xs text-amber-700 py-0.5">Addendum {addendumNumberMap[s]} - {ADDENDUM_TYPES.find(t => t.key === s)?.label}</div>
              ))}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-4 text-xs text-amber-800">
            Reminder: SSN, signatures, and payment info are <strong>not</strong> filled. Your team handles those manually.
          </div>

          <button onClick={handleGenerate} disabled={generating || !pdfLib} className={`${btnGreen} w-full text-center`}>
            {generating ? status || "Generating..." : `Generate ${selForm.stateName} Form for ${selAgent.firstName} ${selAgent.lastName}`}
          </button>

          {lastResult && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
              Downloaded <strong>{lastResult.filename}</strong> - {lastResult.pages} pages
              {lastResult.addendums > 0 ? ` (including ${lastResult.addendums} addendum${lastResult.addendums > 1 ? "s" : ""})` : ""}
              {lastResult.skippedAddendums && lastResult.skippedAddendums.length > 0 && (
                <div className="mt-1 text-xs text-amber-700">
                  Skipped: {lastResult.skippedAddendums.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ MAIN APP ═══════════════════ */
export default function AgentRegistrationTool() {
  const [pdfLib, setPdfLib] = useState(null);
  const pdfLoading = !pdfLib;
  const [agents, setAgents] = useState([]);
  const [forms, setForms] = useState([]);
  const [tab, setTab] = useState("agents");
  const [editAgent, setEditAgent] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const importRef = useRef(null);
  const didLoad = useRef(false);

  useEffect(() => { setPdfLib({ PDFDocument }); }, []);

  // ── Load from localStorage, then hydrate PDF bytes from IndexedDB ──
  useEffect(() => {
    (async () => {
      try {
        let loadedAgents = [];
        let loadedForms = [];
        const raw = localStorage.getItem("agent_reg_data");
        if (raw) {
          const d = JSON.parse(raw);
          if (d && d.agents) loadedAgents = d.agents;
          if (d && d.forms) loadedForms = d.forms;
        }
        // Set lightweight data immediately so UI renders
        if (loadedAgents.length) setAgents(loadedAgents);
        if (loadedForms.length) setForms(loadedForms);
        // Hydrate PDF bytes from IndexedDB (forms + addendums)
        const [hForms, hAgents] = await Promise.all([
          hydrateFormsFromIDB(loadedForms),
          hydrateAgentsFromIDB(loadedAgents),
        ]);
        if (hForms.length) setForms(hForms);
        if (hAgents.length) setAgents(hAgents);
      } catch (e) { console.error("Load failed:", e); }
      setTimeout(() => { didLoad.current = true; }, 300);
    })();
  }, []);

  // ── Persist metadata to localStorage (bytes live in IDB) ──
  useEffect(() => {
    if (!didLoad.current) return;
    try {
      const lightAgents = agents.map(a => {
        const lightAdd = {};
        if (a.addendums) {
          for (const [k, v] of Object.entries(a.addendums)) {
            lightAdd[k] = { name: v ? v.name : "" };
          }
        }
        return { ...a, addendums: lightAdd };
      });
      const lightForms = forms.map(f => ({ ...f, bytes: [] }));
      localStorage.setItem("agent_reg_data", JSON.stringify({ agents: lightAgents, forms: lightForms }));
    } catch (e) { console.error("Save failed:", e); }
  }, [agents, forms]);

  const saveAgent = async (a) => {
    // Persist addendum bytes to IndexedDB
    if (a.addendums) {
      for (const [addType, addData] of Object.entries(a.addendums)) {
        if (addData && addData.bytes && addData.bytes.length > 0) {
          await idbSaveAddendum(a.id, addType, addData.name || "", new Uint8Array(addData.bytes));
        }
      }
    }
    setAgents(prev => prev.find(x => x.id === a.id) ? prev.map(x => x.id === a.id ? a : x) : [...prev, a]);
    setEditAgent(null); setShowForm(false);
  };

  const exportData = () => {
    // Export strips bytes (too large for JSON) — IDB is the byte store
    const lightAgents = agents.map(a => {
      const lightAdd = {};
      if (a.addendums) { for (const [k, v] of Object.entries(a.addendums)) { lightAdd[k] = { name: v ? v.name : "" }; } }
      return { ...a, addendums: lightAdd };
    });
    const lightForms = forms.map(f => ({ ...f, bytes: [] }));
    const data = JSON.stringify({ agents: lightAgents, forms: lightForms }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "agent-reg-data.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        // Set data first, then hydrate bytes from IDB
        let importedAgents = data.agents || [];
        let importedForms = data.forms || [];
        if (importedAgents.length) setAgents(importedAgents);
        if (importedForms.length) setForms(importedForms);
        // Hydrate any IDB bytes that match these IDs
        const [hForms, hAgents] = await Promise.all([
          hydrateFormsFromIDB(importedForms),
          hydrateAgentsFromIDB(importedAgents),
        ]);
        if (hForms.some((f, i) => f !== importedForms[i])) setForms(hForms);
        if (hAgents.some((a, i) => a !== importedAgents[i])) setAgents(hAgents);
      } catch (_) {}
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-sm">VS</span></div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Agent Registration Tool</h1>
              <p className="text-xs text-gray-400">
                {pdfLoading ? "Loading..." : "Ready"}
                {agents.length > 0 && ` | ${agents.length} agent${agents.length > 1 ? "s" : ""}`}
                {forms.length > 0 && ` | ${forms.length} form${forms.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1 mr-3">
              {[["agents", "Agents"], ["forms", "State Forms"], ["generate", "Generate"]].map(([k, l]) => (
                <button key={k} onClick={() => { setTab(k); setShowForm(false); }}
                  className={`px-3 py-1.5 text-sm rounded-md ${tab === k ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}>{l}</button>
              ))}
            </nav>
            <input type="file" ref={importRef} accept=".json" className="hidden" onChange={importData} />
            <button onClick={() => importRef.current?.click()} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50" title="Import saved data">Import</button>
            <button onClick={exportData} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50" title="Export all data">Export</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === "agents" && !showForm && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Agents</h2>
              <button onClick={() => { setEditAgent(null); setShowForm(true); }} className={btnPrimary}>+ Add Agent</button>
            </div>
            {agents.length === 0 ? (
              <EmptyState icon="👤" title="No agents yet" sub="Add an agent with their base info and addendum PDFs."
                action={() => { setEditAgent(null); setShowForm(true); }} actionLabel="Add Your First Agent" />
            ) : (
              <div className="grid gap-3">
                {agents.map(a => {
                  const addCount = Object.keys(a.addendums || {}).length;
                  const bytesCount = Object.values(a.addendums || {}).filter(v => v && v.bytes && v.bytes.length > 0).length;
                  return (
                    <div key={a.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{a.firstName} {a.lastName}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
                            {a.businessName && <span>{a.businessName}</span>}
                            {a.homeEmail && <span>{a.homeEmail}</span>}
                            {a.homeCity && a.homeState && <span>{a.homeCity}, {a.homeState}</span>}
                          </div>
                          <div className="flex gap-2 mt-1.5">
                            {bytesCount > 0 && <Badge color="green">{bytesCount} addendum{bytesCount > 1 ? "s" : ""} ready</Badge>}
                            {addCount > bytesCount && bytesCount > 0 && <Badge color="amber">{addCount - bytesCount} need re-upload</Badge>}
                            {addCount > 0 && bytesCount === 0 && <Badge color="amber">{addCount} addendum{addCount > 1 ? "s" : ""} (re-upload needed)</Badge>}
                            {addCount === 0 && <Badge color="gray">No addendums</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => { setTab("generate"); }} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">Fill Form</button>
                          <button onClick={() => { setEditAgent(a); setShowForm(true); }} className={btnSecondary}>Edit</button>
                          <button onClick={() => { idbDeleteAgent(a.id); setAgents(p => p.filter(x => x.id !== a.id)); }} className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50">Delete</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "agents" && showForm && (
          <AgentForm agent={editAgent} onSave={saveAgent} onCancel={() => setShowForm(false)} />
        )}

        {tab === "forms" && (
          <StateFormsView forms={forms} setForms={setForms} pdfLib={pdfLib} />
        )}

        {tab === "generate" && (
          <GenerateView agents={agents} forms={forms} pdfLib={pdfLib} />
        )}
      </main>
    </div>
  );
}
