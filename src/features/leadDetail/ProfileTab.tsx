import { useEffect, useRef, useState } from "react";
import {
  fetchLeadDetail,
  updateLeadDetail,
  updateProfileDetail,
  type CoApplicantDetail,
  type LeadApplicant,
  type LeadDetail,
  type LeadDetailPatch,
  type LeadPersonal,
  type LeadPhone,
  type ProfileDetailPatch,
} from "../../api/leadDetail";
import { changedKeys, mergeDraft, pick } from "./liveLead";
import { CheckboxLabel, FieldGrid, Section, StateSelect, TextInput, type FieldDef } from "./formFields";
import { SummarySection } from "./SummarySection";
import { Radio, Switch } from "../../components/controls";

const YES_NO = ["Yes", "No"] as const;
const EMPLOYMENT_STATUS_OPTIONS = ["Employed", "Self-Employed", "Unemployed", "Retired", "Disabled"] as const;
const PREFERRED_CONTACT_OPTIONS = ["Phone", "Email", "Text", "Mail"] as const;
const RESIDENCY_STATUS_OPTIONS = ["US Citizen", "Permanent Resident", "Visa Holder", "Other"] as const;
const PURPOSE_OF_LOAN_OPTIONS = ["Debt Consolidation", "Home Improvement", "Medical", "Other"] as const;

// These option lists (and any field marked type: "select" below) are best
// guesses - the reference screenshots showed the dropdown affordance but
// never an opened list, so the real option set should be confirmed and
// swapped in here.
const THIRD_PARTY_FIELDS: FieldDef[] = [
  { key: "speakerName", label: "3rd Party Speaker Name" },
  { key: "speakerEmail", label: "3rd Party Speaker Email", type: "email" },
  { key: "speakerPhone", label: "3rd Party Speaker Phone" },
];

const EMPLOYMENT_FIELDS: FieldDef[] = [
  { key: "occupation", label: "Occupation" },
  { key: "employerName", label: "Employer Name" },
  { key: "yearsAtEmployer", label: "Years at Employer" },
  { key: "monthsAtEmployer", label: "Months at Employer" },
  { key: "employmentStatus", label: "Employment Status", type: "select", options: EMPLOYMENT_STATUS_OPTIONS },
  { key: "employmentWaiver", label: "Employment Waiver", type: "select", options: YES_NO },
];

const ACCOUNT_USAGE_FIELDS: FieldDef[] = [
  { key: "ficoScore", label: "Fico Score" },
  { key: "worstFicoScore", label: "Worst Fico Score" },
  { key: "creditUtilization", label: "Credit Utilization" },
  { key: "creditCardDebtAmt", label: "Credit Card Debt Amt" },
  { key: "unsecuredDebtAmt", label: "Unsecured Debt Amt" },
  { key: "behindOnAnyBills", label: "Behind On Any Bills", type: "select", options: YES_NO },
  { key: "bankruptcy", label: "Bankruptcy", type: "select", options: YES_NO },
];

const OTHER_FIELDS: FieldDef[] = [
  { key: "purchaserDup", label: "Purchaser DUP", type: "readonly" },
  { key: "mothersMaidenName", label: "Mothers Maiden Name" },
  { key: "clickId", label: "Click Id" },
  { key: "referralName", label: "Referral Name" },
  { key: "utmSource", label: "UTM Source" },
  { key: "utmMedium", label: "UTM Medium" },
  { key: "utmKeyword", label: "UTM Keyword" },
  { key: "utmCampaign", label: "UTM Campaign" },
  { key: "leadSourceId", label: "Lead Source Id" },
  { key: "subId", label: "Sub Id" },
  { key: "purposeOfLoan", label: "Purpose of Loan", type: "select", options: PURPOSE_OF_LOAN_OPTIONS },
  { key: "requestedLoanAmount", label: "Requested Loan Amount" },
  { key: "partnerId", label: "Partner Id" },
  { key: "leadType", label: "Lead Type" },
  { key: "modelType", label: "Model Type" },
  { key: "webSource", label: "Web Source" },
  { key: "reasonForSubmission", label: "Reason For Submission", type: "textarea", span: 2 },
  { key: "mailerCode", label: "Mailer Code" },
];

const CO_IDENTITY_FIELDS: FieldDef[] = [
  { key: "firstName", label: "First Name", required: true },
  { key: "middleInitial", label: "Middle Initial" },
  { key: "lastName", label: "Last Name", required: true },
  { key: "address", label: "Address", span: 2 },
  { key: "address2", label: "Address 2", span: 2 },
  { key: "country", label: "Country", required: true },
  { key: "state", label: "State", required: true },
  { key: "city", label: "City" },
  { key: "zip", label: "Zip Code" },
];

const CO_PREVIOUS_ADDRESS_FIELDS: FieldDef[] = [
  { key: "previousAddress", label: "Previous Address", span: 2 },
  { key: "previousAddress2", label: "Previous Address 2", span: 2 },
  { key: "previousCountry", label: "Previous Country" },
  { key: "previousState", label: "Previous State" },
  { key: "previousCity", label: "Previous City" },
  { key: "previousZip", label: "Previous Zip Code" },
];

const CO_PHONE_FIELDS: FieldDef[] = [
  { key: "homePhone", label: "Home Phone" },
  { key: "cellPhone", label: "Cell Phone", required: true },
  { key: "workPhone", label: "Work Phone" },
  { key: "extension", label: "Extension" },
];

const CO_PERSONAL_FIELDS: FieldDef[] = [
  { key: "email", label: "Email Address", type: "email" },
  { key: "secondaryEmail", label: "Secondary Email Address", type: "email" },
  { key: "ssn", label: "Social Security Number" },
  { key: "dob", label: "Date of Birth", type: "date" },
];

const CO_EMPLOYMENT_FIELDS: FieldDef[] = [
  { key: "currentlyEmployed", label: "Currently Employed", type: "select", options: YES_NO },
  { key: "businessType", label: "Business Type" },
  { key: "selfEmployed", label: "Self Employed", type: "select", options: YES_NO },
  { key: "occupation", label: "Occupation" },
  { key: "employer", label: "Employer" },
  { key: "lengthOfEmployment", label: "Length of employment" },
  { key: "employmentWaiver", label: "Employment Waiver", type: "select", options: YES_NO },
  { key: "previousEmployer", label: "Previous Employer" },
];

const CO_OTHER_FIELDS: FieldDef[] = [
  { key: "mothersMaidenName", label: "Mothers Maiden Name" },
  { key: "monthlyRentPayment", label: "Monthly Rent Payment" },
  { key: "grossAnnualIncome", label: "Gross Annual Income" },
  { key: "ficoScore", label: "Fico Score" },
];

interface JsonBucket {
  [key: string]: string | number | boolean | null | undefined;
}

const NO_CO_APPLICANT: CoApplicantDetail = { hasCoApplicant: false };
const bucket = (value: object | null): JsonBucket => (value ?? {}) as JsonBucket;

// The Lead-row fields this form edits, as the PATCH takes them. (Not the
// applicant's SSN: that's write-only, sent when typed.)
function leadFields(applicant: LeadApplicant, phone: LeadPhone, personal: LeadPersonal): LeadDetailPatch {
  return {
    firstName: applicant.firstName,
    middleInitial: applicant.middleInitial,
    lastName: applicant.lastName,
    streetAddress: applicant.streetAddress,
    address2: applicant.address2,
    country: applicant.country,
    addressState: applicant.addressState,
    city: applicant.city,
    zip: applicant.zip,
    yearsAtAddress: applicant.yearsAtAddress,
    monthsAtAddress: applicant.monthsAtAddress,
    homePhone: phone.homePhone,
    homePhoneOptOut: phone.homePhoneOptOut,
    cellPhone: phone.cellPhone,
    cellPhoneOptOut: phone.cellPhoneOptOut,
    workPhone: phone.workPhone,
    workPhoneExt: phone.workPhoneExt,
    workPhoneOptOut: phone.workPhoneOptOut,
    bestTimeToCall: phone.bestTimeToCall,
    preferredContact: phone.preferredContact,
    email: personal.email,
    dob: personal.dob,
    dependents: personal.dependents,
    speaksSpanish: personal.speaksSpanish,
    residencyStatus: personal.residencyStatus,
  };
}

export function ProfileTab({ lead, onSaved, onSaveStart }: { lead: LeadDetail; onSaved: (lead: LeadDetail) => void; onSaveStart?: () => void }) {
  const [applicant, setApplicant] = useState<LeadApplicant>(lead.applicant);
  const [phone, setPhone] = useState<LeadPhone>(lead.phone);
  const [personal, setPersonal] = useState<LeadPersonal>(lead.personal);
  const [ssnInput, setSsnInput] = useState("");
  const [thirdPartyAuth, setThirdPartyAuth] = useState<JsonBucket>(bucket(lead.thirdPartyAuth));
  const [employment, setEmployment] = useState<JsonBucket>(bucket(lead.employment));
  const [accountUsage, setAccountUsage] = useState<JsonBucket>(bucket(lead.accountUsage));
  const [otherDetails, setOtherDetails] = useState<JsonBucket>(bucket(lead.otherDetails));
  const [coApplicant, setCoApplicant] = useState<CoApplicantDetail>(lead.coApplicant ?? NO_CO_APPLICANT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The lead the drafts above were last brought up to date with.
  const loaded = useRef(lead);

  function resetDrafts(to: LeadDetail = lead) {
    loaded.current = to;
    setApplicant(to.applicant);
    setPhone(to.phone);
    setPersonal(to.personal);
    setSsnInput("");
    setThirdPartyAuth(bucket(to.thirdPartyAuth));
    setEmployment(bucket(to.employment));
    setAccountUsage(bucket(to.accountUsage));
    setOtherDetails(bucket(to.otherDetails));
    setCoApplicant(to.coApplicant ?? NO_CO_APPLICANT);
    setError(null);
  }

  // A fresh lead came in from the parent - a header dropdown saved, or the
  // customer changed something in their app (see liveLead.ts). Fields the
  // agent hasn't touched take the new values; anything they're in the middle
  // of editing stays as typed.
  useEffect(() => {
    const before = loaded.current;
    if (lead === before) return;
    loaded.current = lead;
    setApplicant((d) => mergeDraft(d, before.applicant, lead.applicant));
    setPhone((d) => mergeDraft(d, before.phone, lead.phone));
    setPersonal((d) => mergeDraft(d, before.personal, lead.personal));
    setThirdPartyAuth((d) => mergeDraft(d, bucket(before.thirdPartyAuth), bucket(lead.thirdPartyAuth)));
    setEmployment((d) => mergeDraft(d, bucket(before.employment), bucket(lead.employment)));
    setAccountUsage((d) => mergeDraft(d, bucket(before.accountUsage), bucket(lead.accountUsage)));
    setOtherDetails((d) => mergeDraft(d, bucket(before.otherDetails), bucket(lead.otherDetails)));
    setCoApplicant((d) => mergeDraft(d, before.coApplicant ?? NO_CO_APPLICANT, lead.coApplicant ?? NO_CO_APPLICANT));
  }, [lead]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Only what was changed here is sent, so this can't write back the old
      // value of a field the customer changed in their app meanwhile.
      const draftFields = leadFields(applicant, phone, personal);
      const leadPatch: LeadDetailPatch = {
        ...pick(draftFields, changedKeys(draftFields, leadFields(lead.applicant, lead.phone, lead.personal))),
        ...(ssnInput ? { ssn: ssnInput } : {}),
      };
      const changed = (draft: object, before: object | null) => changedKeys(draft, before ?? {}).length > 0;
      const detailPatch: ProfileDetailPatch = {
        ...(changed(thirdPartyAuth, lead.thirdPartyAuth) ? { thirdPartyAuth } : {}),
        ...(changed(employment, lead.employment) ? { employment } : {}),
        ...(changed(accountUsage, lead.accountUsage) ? { accountUsage } : {}),
        ...(changed(otherDetails, lead.otherDetails) ? { otherDetails } : {}),
        ...(changed(coApplicant, lead.coApplicant ?? NO_CO_APPLICANT) ? { coApplicant } : {}),
      };

      const saveLead = Object.keys(leadPatch).length > 0;
      const saveDetail = Object.keys(detailPatch).length > 0;
      if (!saveLead && !saveDetail) return;

      onSaveStart?.();
      const [patched] = await Promise.all([saveLead ? updateLeadDetail(lead.id, leadPatch) : null, saveDetail ? updateProfileDetail(lead.id, detailPatch) : null]);
      // The lead as it now stands - both saves in, and anything the customer
      // changed meanwhile. Failing that, the lead save's own answer; failing
      // that too, the form stays as typed (it is saved) and the next live
      // refresh brings the rest.
      const saved = await fetchLeadDetail(lead.id)
        .then((res) => res.lead)
        .catch(() => patched?.lead ?? null);
      if (!saved) return;
      resetDrafts(saved);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-20">
      <SummarySection summary={lead.summary} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Applicant Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput label="First Name" required value={applicant.firstName ?? ""} onChange={(v) => setApplicant((p) => ({ ...p, firstName: v }))} />
            <TextInput label="Middle Initial" value={applicant.middleInitial ?? ""} onChange={(v) => setApplicant((p) => ({ ...p, middleInitial: v }))} />
            <TextInput label="Last Name" required value={applicant.lastName ?? ""} onChange={(v) => setApplicant((p) => ({ ...p, lastName: v }))} />
            <div className="sm:col-span-2">
              <TextInput label="Address" value={applicant.streetAddress ?? ""} onChange={(v) => setApplicant((p) => ({ ...p, streetAddress: v }))} />
            </div>
            <div className="sm:col-span-2">
              <TextInput label="Address 2" value={applicant.address2 ?? ""} onChange={(v) => setApplicant((p) => ({ ...p, address2: v }))} />
            </div>
            <TextInput label="Country" required value={applicant.country ?? "United States"} onChange={(v) => setApplicant((p) => ({ ...p, country: v }))} />
            <StateSelect label="State" required value={applicant.addressState ?? ""} onChange={(v) => setApplicant((p) => ({ ...p, addressState: v }))} />
            <TextInput label="City" value={applicant.city ?? ""} onChange={(v) => setApplicant((p) => ({ ...p, city: v }))} />
            <TextInput label="Zip Code" value={applicant.zip ?? ""} onChange={(v) => setApplicant((p) => ({ ...p, zip: v }))} />
            <TextInput
              label="No. of Years at this address"
              type="number"
              value={applicant.yearsAtAddress?.toString() ?? ""}
              onChange={(v) => setApplicant((p) => ({ ...p, yearsAtAddress: v === "" ? null : Number(v) }))}
            />
            <TextInput
              label="No. of Months"
              type="number"
              value={applicant.monthsAtAddress?.toString() ?? ""}
              onChange={(v) => setApplicant((p) => ({ ...p, monthsAtAddress: v === "" ? null : Number(v) }))}
            />
          </div>
        </Section>

        <Section title="Third Party Authorization Details">
          <FieldGrid fields={THIRD_PARTY_FIELDS} values={thirdPartyAuth} onChange={(k, v) => setThirdPartyAuth((p) => ({ ...p, [k]: v }))} />
        </Section>
      </div>

      <Section title="Phone Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            label="Home Phone"
            value={phone.homePhone ?? ""}
            onChange={(v) => setPhone((p) => ({ ...p, homePhone: v }))}
            suffix={<CheckboxLabel label="Opt Out" checked={phone.homePhoneOptOut} onChange={(v) => setPhone((p) => ({ ...p, homePhoneOptOut: v }))} />}
          />
          <TextInput
            label="Cell Phone"
            required
            value={phone.cellPhone ?? ""}
            onChange={(v) => setPhone((p) => ({ ...p, cellPhone: v }))}
            suffix={<CheckboxLabel label="Opt Out" checked={phone.cellPhoneOptOut} onChange={(v) => setPhone((p) => ({ ...p, cellPhoneOptOut: v }))} />}
          />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextInput
                label="Work Phone"
                value={phone.workPhone ?? ""}
                onChange={(v) => setPhone((p) => ({ ...p, workPhone: v }))}
                suffix={<CheckboxLabel label="Opt Out" checked={phone.workPhoneOptOut} onChange={(v) => setPhone((p) => ({ ...p, workPhoneOptOut: v }))} />}
              />
            </div>
          </div>
          <TextInput label="Extension" value={phone.workPhoneExt ?? ""} onChange={(v) => setPhone((p) => ({ ...p, workPhoneExt: v }))} />
          <FieldGrid
            fields={[{ key: "bestTimeToCall", label: "Best time to call" }]}
            values={{ bestTimeToCall: phone.bestTimeToCall }}
            onChange={(_, v) => setPhone((p) => ({ ...p, bestTimeToCall: v }))}
          />
          <FieldGrid
            fields={[{ key: "preferredContact", label: "Preferred Contact", type: "select", options: PREFERRED_CONTACT_OPTIONS }]}
            values={{ preferredContact: phone.preferredContact }}
            onChange={(_, v) => setPhone((p) => ({ ...p, preferredContact: v }))}
          />
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Personal Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput label="Email Address" required type="email" value={personal.email ?? ""} onChange={(v) => setPersonal((p) => ({ ...p, email: v }))} />
            <TextInput
              label="Social Security Number"
              value={ssnInput}
              onChange={setSsnInput}
              suffix={personal.ssnLast4 && <span className="whitespace-nowrap text-xs text-muted">on file: •••-••-{personal.ssnLast4}</span>}
            />
            <TextInput label="Date of Birth" type="date" value={personal.dob ?? ""} onChange={(v) => setPersonal((p) => ({ ...p, dob: v }))} />
            <TextInput
              label="No. of dependents"
              type="number"
              value={personal.dependents?.toString() ?? ""}
              onChange={(v) => setPersonal((p) => ({ ...p, dependents: v === "" ? null : Number(v) }))}
            />
            <FieldGrid
              fields={[{ key: "speaksSpanish", label: "Speaks Spanish", type: "select", options: YES_NO }]}
              values={{ speaksSpanish: personal.speaksSpanish === null ? "" : personal.speaksSpanish ? "Yes" : "No" }}
              onChange={(_, v) => setPersonal((p) => ({ ...p, speaksSpanish: v === "" ? null : v === "Yes" }))}
            />
            <FieldGrid
              fields={[{ key: "residencyStatus", label: "Residency Status", type: "select", options: RESIDENCY_STATUS_OPTIONS }]}
              values={{ residencyStatus: personal.residencyStatus }}
              onChange={(_, v) => setPersonal((p) => ({ ...p, residencyStatus: v }))}
            />
          </div>
        </Section>

        <div className="space-y-5">
          <Section title="Employment Details">
            <FieldGrid fields={EMPLOYMENT_FIELDS} values={employment} onChange={(k, v) => setEmployment((p) => ({ ...p, [k]: v }))} />
          </Section>
          <Section title="Account Usage">
            <FieldGrid fields={ACCOUNT_USAGE_FIELDS} values={accountUsage} onChange={(k, v) => setAccountUsage((p) => ({ ...p, [k]: v }))} />
          </Section>
        </div>
      </div>

      <Section title="Other Details">
        <FieldGrid fields={OTHER_FIELDS} values={otherDetails} onChange={(k, v) => setOtherDetails((p) => ({ ...p, [k]: v }))} />
      </Section>

      <div className="rounded-card border border-border bg-white px-5 py-4">
        <Switch
          label="Do you have a Co-Applicant"
          checked={coApplicant.hasCoApplicant ?? false}
          onChange={(v) => setCoApplicant((p) => ({ ...p, hasCoApplicant: v }))}
        />
      </div>

      {coApplicant.hasCoApplicant && (
        <Section title="Co-Applicant">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-md border border-border p-4">
                <h4 className="mb-3 text-sm font-semibold text-ink">Co-Applicant Details</h4>
                <FieldGrid
                  fields={CO_IDENTITY_FIELDS}
                  values={coApplicant as JsonBucket}
                  onChange={(k, v) => setCoApplicant((p) => ({ ...p, [k]: v }))}
                />
              </div>
              <div className="rounded-md border border-border p-4">
                <h4 className="mb-3 text-sm font-semibold text-ink">Personal Details</h4>
                <FieldGrid
                  fields={CO_PERSONAL_FIELDS}
                  values={coApplicant as JsonBucket}
                  onChange={(k, v) => setCoApplicant((p) => ({ ...p, [k]: v }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-md border border-border p-4">
                <h4 className="mb-3 text-sm font-semibold text-ink">Previous Address</h4>
                <FieldGrid
                  fields={CO_PREVIOUS_ADDRESS_FIELDS}
                  values={coApplicant as JsonBucket}
                  onChange={(k, v) => setCoApplicant((p) => ({ ...p, [k]: v }))}
                />
              </div>
              <div className="rounded-md border border-border p-4">
                <h4 className="mb-3 text-sm font-semibold text-ink">Employment Details</h4>
                <FieldGrid
                  fields={CO_EMPLOYMENT_FIELDS}
                  values={coApplicant as JsonBucket}
                  onChange={(k, v) => setCoApplicant((p) => ({ ...p, [k]: v }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-md border border-border p-4">
                <h4 className="mb-3 text-sm font-semibold text-ink">Phone Details</h4>
                <FieldGrid fields={CO_PHONE_FIELDS} values={coApplicant as JsonBucket} onChange={(k, v) => setCoApplicant((p) => ({ ...p, [k]: v }))} />
              </div>
              <div className="rounded-md border border-border p-4">
                <h4 className="mb-3 flex items-center justify-between text-sm font-semibold text-ink">
                  Other Details
                  <span className="flex items-center gap-3 text-xs font-normal text-muted">
                    Rent or Own
                    <Radio
                      name="co-applicant-rent-or-own"
                      label="Own"
                      checked={coApplicant.rentOrOwn === "OWN"}
                      onChange={() => setCoApplicant((p) => ({ ...p, rentOrOwn: "OWN" }))}
                    />
                    <Radio
                      name="co-applicant-rent-or-own"
                      label="Rent"
                      checked={coApplicant.rentOrOwn === "RENT"}
                      onChange={() => setCoApplicant((p) => ({ ...p, rentOrOwn: "RENT" }))}
                    />
                  </span>
                </h4>
                <FieldGrid fields={CO_OTHER_FIELDS} values={coApplicant as JsonBucket} onChange={(k, v) => setCoApplicant((p) => ({ ...p, [k]: v }))} />
              </div>
            </div>
          </div>
        </Section>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="sticky bottom-0 -mx-1 flex justify-end gap-3 border-t border-border bg-bg/95 px-1 py-3 backdrop-blur">
        <button type="button" onClick={() => resetDrafts()} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-white">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-teal px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-hover disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
