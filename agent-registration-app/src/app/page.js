"use client";
import { useState, useEffect, useRef } from "react";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown } from "pdf-lib";

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

const SPECIAL_MAPPINGS = [
  { key: "_ADDENDUM", label: "→ \"See Attached Addendum\"" },
  { key: "_SKIP", label: "— Skip (don't fill) —" },
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

/* ═══════════════════ AUTO-MAP ENGINE ═══════════════════ */
// Normalize PDF field name: "First_Name" → "first name", "firstName" → "first name"
function normFieldName(raw) {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")   // camelCase → spaces
    .replace(/[_\-\.\/\\:]/g, " ")          // separators → spaces
    .replace(/\s+/g, " ")                   // collapse whitespace
    .trim()
    .toLowerCase();
}

const AUTO_MAP_RULES = [
  // Personal — specific before generic
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

  // Home address — more specific patterns first
  { patterns: [/home\s*address/i, /residential\s*address/i, /mailing\s*address/i, /street\s*address/i, /address\s*line\s*1/i, /address\s*1/i, /^address$/i, /^street$/i, /home\s*street/i, /residence\s*address/i, /personal\s*address/i, /current\s*address/i, /address\s*line/i], value: "homeStreet" },
  { patterns: [/home\s*city/i, /residential\s*city/i, /mailing\s*city/i, /city\s*of\s*residence/i], value: "homeCity" },
  { patterns: [/home\s*state/i, /residential\s*state/i, /mailing\s*state/i, /state\s*of\s*residence/i], value: "homeState" },
  { patterns: [/home\s*zip/i, /residential\s*zip/i, /mailing\s*zip/i, /postal\s*code/i, /zip\s*code/i, /\bzip\b/i], value: "homeZip" },
  { patterns: [/home\s*county/i, /county\s*of\s*residence/i, /residential\s*county/i], value: "homeCounty" },

  // Contact
  { patterns: [/home\s*phone/i, /personal\s*phone/i, /daytime\s*phone/i, /phone\s*number/i, /telephone\s*number/i, /telephone/i, /\bphone\b/i, /\btel\b/i, /contact\s*number/i, /primary\s*phone/i], value: "homePhone" },
  { patterns: [/mobile/i, /cell\s*phone/i, /\bcell\b/i, /cellular/i], value: "mobilePhone" },
  { patterns: [/e-?mail\s*address/i, /personal\s*e-?mail/i, /home\s*e-?mail/i, /^e-?mail$/i, /contact\s*e-?mail/i, /applicant\s*e-?mail/i], value: "homeEmail" },

  // Business — more specific patterns
  { patterns: [/business\s*name/i, /employer\s*name/i, /firm\s*name/i, /company\s*name/i, /agency\s*name/i, /entity\s*name/i, /name\s*of\s*(business|employer|firm|company|agency|entity)/i, /employing\s*firm/i], value: "businessName" },
  { patterns: [/\bdba\b/i, /doing\s*business\s*as/i, /trade\s*name/i, /d\s*b\s*a/i], value: "dba" },
  { patterns: [/nature\s*of\s*business/i, /type\s*of\s*business/i, /business\s*type/i], value: "natureOfBusiness" },
  { patterns: [/business\s*address/i, /business\s*street/i, /employer\s*address/i, /office\s*address/i, /firm\s*address/i, /company\s*address/i], value: "businessStreet" },
  { patterns: [/business\s*city/i, /employer\s*city/i, /office\s*city/i], value: "businessCity" },
  { patterns: [/business\s*state/i, /employer\s*state/i, /office\s*state/i], value: "businessState" },
  { patterns: [/business\s*zip/i, /employer\s*zip/i, /office\s*zip/i], value: "businessZip" },
  { patterns: [/business\s*county/i, /employer\s*county/i], value: "businessCounty" },
  { patterns: [/work\s*phone/i, /business\s*phone/i, /office\s*phone/i, /employer\s*phone/i, /bus.*phone/i], value: "workPhone" },
  { patterns: [/\bfax\b/i, /fax\s*number/i, /facsimile/i, /fax\s*#/i], value: "fax" },
  { patterns: [/work\s*e-?mail/i, /business\s*e-?mail/i, /office\s*e-?mail/i, /employer\s*e-?mail/i], value: "workEmail" },
  { patterns: [/business\s*web/i, /company\s*web/i, /website/i, /web\s*address/i, /url/i], value: "businessWebSocial" },
  { patterns: [/registration\s*no/i, /license\s*no/i, /reg\s*#/i, /license\s*#/i, /registration\s*number/i, /license\s*number/i, /cert.*number/i, /certificate\s*no/i], value: "registrationNo" },

  // Registrations
  { patterns: [/states?\s*registered/i, /other\s*states?/i, /jurisdictions?/i, /states?\s*licensed/i, /registered\s*in/i], value: "currentRegistrations" },

  // Catch-all: generic "city" / "state" → home (matched last so business-specific ones win)
  { patterns: [/^city$/i], value: "homeCity" },
  { patterns: [/^state$/i], value: "homeState" },
];

// Fields to auto-skip (sensitive / manual entry)
const SKIP_PATTERNS = [/\bssn\b/i, /social\s*security/i, /\bsignature\b/i, /^sign$/i, /date\s*signed/i, /\bnotary\b/i, /\bsworn\b/i, /\bwitness\b/i, /\bseal\b/i, /payment/i, /\bfee\b/i, /\bcheck\b.*no/i, /money\s*order/i, /\bamount/i];

function autoMapField(fieldName) {
  const name = normFieldName(fieldName);
  // Skip sensitive / manual fields
  for (const pat of SKIP_PATTERNS) {
    if (pat.test(name)) return "_SKIP";
  }
  for (const rule of AUTO_MAP_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(name)) return rule.value;
    }
  }
  return "_SKIP";
}

function autoMapAllFields(detectedFields) {
  const mappings = {};
  const usedValues = new Set();
  for (const df of detectedFields) {
    const mapped = autoMapField(df.name);
    if (mapped !== "_SKIP" && !usedValues.has(mapped)) {
      mappings[df.name] = mapped;
      // Computed fields + addendum can map to multiple PDF fields; regular fields only once
      if (!mapped.startsWith("_")) usedValues.add(mapped);
    } else {
      mappings[df.name] = mapped === "_SKIP" ? "_SKIP" : mapped;
    }
  }
  return mappings;
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

function getAgentValue(agent, mappingKey) {
  if (!mappingKey || mappingKey === "_SKIP") return null;
  if (mappingKey === "_ADDENDUM") return "See Attached Addendum";
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
        <p className="text-xs text-gray-500 mb-3">Upload PDF addendums for this agent. They'll be merged into the final output automatically.</p>
        <input type="file" ref={fileRef} accept=".pdf" className="hidden" onChange={handleAddendumUpload} />
        <div className="space-y-2">
          {ADDENDUM_TYPES.map(t => {
            const has = f.addendums[t.key];
            return (
              <div key={t.key} className={`flex items-center justify-between p-2 rounded border ${has ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${has ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className="text-sm text-gray-700">{t.label}</span>
                  {has && <Badge color="green">{has.name}</Badge>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setUploadingType(t.key); setTimeout(() => fileRef.current?.click(), 0); }}
                    className="text-xs px-2 py-1 border border-blue-300 text-blue-700 rounded hover:bg-blue-50">
                    {has ? "Replace" : "Upload PDF"}
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
    { label: "— Skip —", value: "_SKIP" },
    { label: "→ \"See Attached Addendum\"", value: "_ADDENDUM" },
    ...COMPUTED_FIELDS.map(f => ({ label: `★ ${f.label}`, value: f.key })),
    ...AGENT_FIELDS.map(f => ({ label: `${f.group} › ${f.label}`, value: f.key })),
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
        {/* Show mapped fields first, then skipped */}
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
            return (
              <div key={i} className={`flex items-center gap-3 p-2 border rounded text-sm ${isMapped ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="w-1/3 min-w-0">
                  <span className="font-mono text-xs text-gray-600 truncate block" title={df.name}>{df.name}</span>
                  <Badge color={df.type === "PDFTextField" ? "blue" : df.type === "PDFCheckBox" ? "amber" : "gray"}>{df.type.replace("PDF", "").replace("Field", "")}</Badge>
                </div>
                <span className={isMapped ? "text-green-500" : "text-gray-300"}>→</span>
                <select className={`flex-1 px-2 py-1.5 border rounded text-sm ${isMapped ? "border-green-300 bg-white" : "border-gray-300"}`}
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
      // Auto-map fields on upload
      const autoMappings = detectedFields.length > 0 ? autoMapAllFields(detectedFields) : {};
      const newForm = {
        id: Date.now(), stateName: newState || "Unnamed", formLabel: newLabel || file.name,
        fileName: file.name, bytes, pageCount: doc.getPageCount(),
        detectedFields, mappings: autoMappings, isFieldable: detectedFields.length > 0,
        addendumSlots: [],
      };
      setForms(prev => [...prev, newForm]);
      setNewState(""); setNewLabel("");
      setExpandedId(newForm.id);
    } catch (err) {
      console.error(err);
    }
    setAnalyzing(false);
    e.target.value = "";
  };

  const updateMapping = (formId, fieldName, value) => {
    setForms(prev => prev.map(f => f.id === formId ? { ...f, mappings: { ...f.mappings, [fieldName]: value } } : f));
  };

  const toggleAddendumSlot = (formId, slot) => {
    setForms(prev => prev.map(f => {
      if (f.id !== formId) return f;
      const slots = f.addendumSlots.includes(slot) ? f.addendumSlots.filter(s => s !== slot) : [...f.addendumSlots, slot];
      return { ...f, addendumSlots: slots };
    }));
  };

  const removeForm = (id) => setForms(prev => prev.filter(f => f.id !== id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">State Forms</h2>
      </div>

      {/* Upload new form */}
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

      {/* Form list */}
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
                      <span className="text-sm text-gray-500">— {form.formLabel}</span>
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
                      {form.addendumSlots.length > 0 && <Badge color="purple">{form.addendumSlots.length} addendums</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); removeForm(form.id); }} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50">Delete</button>
                    <span className="text-gray-400 text-sm">{expanded ? "▲" : "▼"}</span>
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
                            const newMappings = autoMapAllFields(form.detectedFields);
                            setForms(prev => prev.map(f => f.id === form.id ? { ...f, mappings: newMappings } : f));
                          }} />
                      </>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                        This PDF doesn't have fillable form fields. It will still be included in the output — your team fills it manually. Addendums will be appended after this form.
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 mb-2 uppercase">Addendums to Include</p>
                      <p className="text-xs text-gray-500 mb-2">Check which addendums should be appended after this form when generating.</p>
                      <div className="grid grid-cols-2 gap-1">
                        {ADDENDUM_TYPES.map(t => (
                          <label key={t.key} className="flex items-center gap-2 py-1 text-sm text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={form.addendumSlots.includes(t.key)} onChange={() => toggleAddendumSlot(form.id, t.key)} />
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

      if (selForm.isFieldable) {
        setStatus("Filling fields...");
        try {
          const form = doc.getForm();
          for (const [fieldName, mappingKey] of Object.entries(selForm.mappings)) {
            if (!mappingKey || mappingKey === "_SKIP") continue;
            const value = getAgentValue(selAgent, mappingKey);
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
            } catch (_) { /* individual field error — skip it */ }
          }
          try { form.flatten(); } catch (_) {}
        } catch (formErr) {
          console.warn("Form fill warning:", formErr);
          // Continue — we'll still output the base PDF even if filling fails
        }
      }

      // Merge addendums
      const mergedDoc = await PDFDocument.create();
      setStatus("Assembling document...");
      const filledPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
      filledPages.forEach(p => mergedDoc.addPage(p));

      let addendumCount = 0;
      for (const slot of (selForm.addendumSlots || [])) {
        const addendum = selAgent.addendums?.[slot];
        if (!addendum || !addendum.bytes || addendum.bytes.length === 0) continue;
        try {
          setStatus(`Appending ${ADDENDUM_TYPES.find(t => t.key === slot)?.label || slot}...`);
          const addBytes = new Uint8Array(addendum.bytes);
          const addDoc = await PDFDocument.load(addBytes, { ignoreEncryption: true });
          const addPages = await mergedDoc.copyPages(addDoc, addDoc.getPageIndices());
          addPages.forEach(p => mergedDoc.addPage(p));
          addendumCount++;
        } catch (e) { console.warn("Addendum merge skipped:", e.message); }
      }

      setStatus("Saving PDF...");
      const finalBytes = await mergedDoc.save();
      const agentName = [selAgent.firstName, selAgent.lastName].filter(Boolean).join("_") || "agent";
      const filename = `${selForm.stateName}_${agentName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(finalBytes, filename);
      setLastResult({ pages: mergedDoc.getPageCount(), addendums: addendumCount, filename });
      setStatus("");
    } catch (err) {
      console.error("Generate error:", err);
      setStatus("Error: " + (err.message || "Unknown error during generation"));
    }
    setGenerating(false);
  };

  // Preview what will be filled
  const previewFields = selForm && selAgent ? Object.entries(selForm.mappings)
    .filter(([, v]) => v && v !== "_SKIP")
    .map(([fieldName, mappingKey]) => ({ fieldName, mappingKey, value: getAgentValue(selAgent, mappingKey) })) : [];

  const missingAddendums = selForm && selAgent ? (selForm.addendumSlots || []).filter(s => !selAgent.addendums[s]) : [];
  const includedAddendums = selForm && selAgent ? (selForm.addendumSlots || []).filter(s => selAgent.addendums[s]) : [];

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Generate Filled Form</h2>

      {/* Step 1: Select form */}
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
                <span className="text-sm text-gray-500 ml-2">— {f.formLabel}</span>
                <div className="flex gap-2 mt-1">
                  {f.isFieldable && <Badge color="green">{Object.values(f.mappings).filter(v => v && v !== "_SKIP").length} fields mapped</Badge>}
                  {f.addendumSlots.length > 0 && <Badge color="purple">{f.addendumSlots.length} addendums</Badge>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Select agent */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <p className="text-xs font-semibold text-gray-800 mb-3 uppercase tracking-wide">2. Select Agent</p>
        {agents.length === 0 ? (
          <p className="text-sm text-gray-500">No agents yet. Go to Agents tab first.</p>
        ) : (
          <div className="grid gap-2">
            {agents.map(a => {
              const addCount = Object.keys(a.addendums).length;
              return (
                <button key={a.id} onClick={() => setSelAgentId(a.id)}
                  className={`text-left p-3 rounded border transition-colors ${selAgentId === a.id ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}>
                  <span className="font-semibold text-sm">{a.firstName} {a.lastName}</span>
                  {a.businessName && <span className="text-sm text-gray-500 ml-2">— {a.businessName}</span>}
                  {addCount > 0 && <Badge color="green">{addCount} addendum{addCount > 1 ? "s" : ""}</Badge>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 3: Preview + Generate */}
      {selForm && selAgent && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-800 mb-3 uppercase tracking-wide">3. Preview & Generate</p>

          {previewFields.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Fields that will be filled:</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {previewFields.map((pf, i) => (
                  <div key={i} className="flex items-center justify-between py-1 px-2 bg-green-50 rounded text-xs">
                    <span className="font-mono text-gray-600">{pf.fieldName}</span>
                    <span className="text-green-800 font-medium truncate ml-2 max-w-xs">{pf.value}</span>
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
                  <span>✓</span> {ADDENDUM_TYPES.find(t => t.key === s)?.label} — {selAgent.addendums[s]?.name}
                </div>
              ))}
            </div>
          )}

          {missingAddendums.length > 0 && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded">
              <p className="text-xs text-amber-800 font-medium mb-1">Missing addendums (form expects these):</p>
              {missingAddendums.map(s => (
                <div key={s} className="text-xs text-amber-700 py-0.5">⚠ {ADDENDUM_TYPES.find(t => t.key === s)?.label}</div>
              ))}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-4 text-xs text-amber-800">
            Reminder: SSN, signatures, and payment info are <strong>not</strong> filled — your team handles those manually.
          </div>

          <button onClick={handleGenerate} disabled={generating || !pdfLib} className={`${btnGreen} w-full text-center`}>
            {generating ? status || "Generating..." : `Generate ${selForm.stateName} Form for ${selAgent.firstName} ${selAgent.lastName}`}
          </button>

          {lastResult && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
              ✓ Downloaded <strong>{lastResult.filename}</strong> — {lastResult.pages} pages{lastResult.addendums > 0 ? ` (including ${lastResult.addendums} addendum${lastResult.addendums > 1 ? "s" : ""})` : ""}
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
  const [hydrated, setHydrated] = useState(false);
  const importRef = useRef(null);

  useEffect(() => { setPdfLib({ PDFDocument }); }, []);

  // Load saved data from localStorage on first client render
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem("agent_reg_data"));
      if (d?.agents?.length) setAgents(d.agents);
      if (d?.forms?.length) setForms(d.forms);
    } catch {}
    setHydrated(true);
  }, []);

  // Auto-save whenever agents or forms change (only after initial load)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const lightAgents = agents.map(a => ({ ...a, addendums: Object.fromEntries(Object.entries(a.addendums || {}).map(([k, v]) => [k, { name: v.name }])) }));
      const lightForms = forms.map(f => ({ ...f, bytes: [] }));
      localStorage.setItem("agent_reg_data", JSON.stringify({ agents: lightAgents, forms: lightForms }));
    } catch {}
  }, [agents, forms, hydrated]);

  const saveAgent = (a) => {
    setAgents(prev => prev.find(x => x.id === a.id) ? prev.map(x => x.id === a.id ? a : x) : [...prev, a]);
    setEditAgent(null); setShowForm(false);
  };

  const exportData = () => {
    const data = JSON.stringify({ agents, forms }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "agent-reg-data.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.agents) setAgents(data.agents);
        if (data.forms) setForms(data.forms);
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
                {agents.length > 0 && ` · ${agents.length} agent${agents.length > 1 ? "s" : ""}`}
                {forms.length > 0 && ` · ${forms.length} form${forms.length > 1 ? "s" : ""}`}
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
        {/* AGENTS TAB */}
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
                  const addCount = Object.keys(a.addendums).length;
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
                            {addCount > 0 && <Badge color="green">{addCount} addendum{addCount > 1 ? "s" : ""}</Badge>}
                            {addCount === 0 && <Badge color="gray">No addendums</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => { setTab("generate"); }} className={`px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700`}>Fill Form</button>
                          <button onClick={() => { setEditAgent(a); setShowForm(true); }} className={btnSecondary}>Edit</button>
                          <button onClick={() => setAgents(p => p.filter(x => x.id !== a.id))} className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50">Delete</button>
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

        {/* STATE FORMS TAB */}
        {tab === "forms" && (
          <StateFormsView forms={forms} setForms={setForms} pdfLib={pdfLib} />
        )}

        {/* GENERATE TAB */}
        {tab === "generate" && (
          <GenerateView agents={agents} forms={forms} pdfLib={pdfLib} />
        )}
      </main>
    </div>
  );
}
