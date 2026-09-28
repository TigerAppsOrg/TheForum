"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { completeOnboarding } from "~/actions/users";
import { PRINCETON_MAJORS } from "~/lib/princeton-departments";
import {
  CAMPUS_REGION_OPTIONS,
  INTEREST_OPTIONS,
  classYearLabel,
  getClassYearOptions,
} from "~/lib/profile-options";
import { cn } from "~/lib/utils";

const ORG_ROLES = [
  {
    value: "leader",
    label: "Yes, I lead or manage an organization/club",
    desc: "I can create events, manage an org page, and post announcements to members.",
  },
  {
    value: "member",
    label: "I'm a member but not a leader",
    desc: "I'll follow organizations and get notified when they post new events.",
  },
  {
    value: "explorer",
    label: "I'm just here to discover events",
    desc: "Browse the feed, RSVP, and coordinate with friends.",
  },
];

const CARD = "bg-white rounded-[10px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-6 sm:p-[40px]";
const STEP_LABEL =
  "mb-3 text-right text-[15px] font-dm-sans font-light text-black sm:absolute sm:top-[18px] sm:right-[30px] sm:mb-0";
const TEXT_INPUT =
  "w-full h-[49px] border border-black rounded-[14px] px-[20px] text-[15px] font-dm-sans placeholder:text-forum-placeholder placeholder:font-bold outline-none focus:border-forum-orange transition-colors";
const CONTINUE_BUTTON =
  "h-[41px] px-[21px] rounded-full shadow-[5px_5px_10px_10px_rgba(0,0,0,0.05)] font-inter font-bold text-[14px] text-forum-orange bg-white hover:bg-gray-50 disabled:opacity-40 transition-all";
const BACK_BUTTON =
  "h-[41px] px-[21px] rounded-full text-[14px] font-inter font-bold text-forum-light-gray hover:text-forum-dark-gray transition-colors";

export interface OnboardingClientProps {
  displayName: string;
  netId: string;
  email: string;
}

export function OnboardingClient({ displayName, netId, email }: OnboardingClientProps) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);

  // Step 1: Personal info — name is editable and saved; NetID/email come from login.
  const [firstName, setFirstName] = useState(() => displayName.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(() => displayName.split(" ").slice(1).join(" "));

  // Step 2: Academic profile
  const [classYear, setClassYear] = useState("");
  const [major, setMajor] = useState("");
  const [regions, setRegions] = useState<string[]>([]);

  // Step 3: Interests (event_tag enum values)
  const [interests, setInterests] = useState<string[]>([]);

  // Step 4: Org role
  const [orgRole, setOrgRole] = useState("");

  const totalSteps = 5;
  const classYearOptions = useMemo(() => getClassYearOptions(), []);
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const toggleInterest = (value: string) => {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value],
    );
  };

  const toggleRegion = (id: string) => {
    setRegions((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return fullName.length > 0;
      case 1:
        return classYear !== "";
      case 2:
        return interests.length >= 1;
      case 3:
        return orgRole !== "";
      default:
        return true;
    }
  };

  /*
   * Saves on "Finish Setup" and only shows the "You are all set" screen once
   * the server has confirmed. It used to show success first and save on the
   * next click, so a failed save still congratulated you.
   */
  const handleFinish = () => {
    startTransition(async () => {
      try {
        await completeOnboarding({
          displayName: fullName,
          interests,
          classYear,
          major,
          regions,
          isOrgLeader: orgRole === "leader",
        });
        setStep(4);
      } catch {
        toast.error("Couldn't save your profile. Please try again.");
      }
    });
  };

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="w-full max-w-[663px] mx-auto my-auto px-4 py-8 sm:px-6">
      {/* Step 1: Personal Info */}
      {step === 0 && (
        <div className={cn(CARD, "relative")}>
          <p className={STEP_LABEL}>
            Step <span className="font-bold">1</span> of {totalSteps - 1}
          </p>
          <h1 className="font-serif text-[32px] sm:text-[40px] text-black leading-tight">
            Let&apos;s get you <span className="text-forum-orange">set up</span>
          </h1>
          <p className="text-[17px] sm:text-[20px] font-dm-sans font-medium text-forum-dark-gray mt-[8px] mb-[30px]">
            Tell us a bit about yourself so we can personalize your experience from day one
          </p>

          <div className="space-y-[20px]">
            <div className="flex flex-col gap-[16px] sm:flex-row">
              <div className="flex-1">
                <label
                  htmlFor="first-name"
                  className="text-[15px] font-medium font-dm-sans text-black block mb-[6px]"
                >
                  First Name
                </label>
                <input
                  id="first-name"
                  type="text"
                  autoComplete="given-name"
                  placeholder="e.g. Albert"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={TEXT_INPUT}
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="last-name"
                  className="text-[15px] font-medium font-dm-sans text-black block mb-[6px]"
                >
                  Last Name
                </label>
                <input
                  id="last-name"
                  type="text"
                  autoComplete="family-name"
                  placeholder="e.g. Rho"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={TEXT_INPUT}
                />
              </div>
            </div>

            {/* From Princeton login — shown for confirmation, not editable. */}
            <dl className="grid gap-[16px] sm:grid-cols-2">
              <div>
                <dt className="text-[15px] font-medium font-dm-sans text-black mb-[6px]">NetID</dt>
                <dd className="h-[49px] flex items-center rounded-[14px] bg-forum-medium-gray/60 px-[20px] text-[15px] font-dm-sans text-forum-dark-gray">
                  {netId || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[15px] font-medium font-dm-sans text-black mb-[6px]">
                  Princeton Email
                </dt>
                <dd className="h-[49px] flex items-center rounded-[14px] bg-forum-medium-gray/60 px-[20px] text-[15px] font-dm-sans text-forum-dark-gray truncate">
                  {email || "—"}
                </dd>
              </div>
            </dl>
            <p className="text-[12px] font-dm-sans text-forum-light-gray">
              Your NetID and email come from your Princeton login.
            </p>
          </div>

          <div className="flex justify-end mt-[30px]">
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className={CONTINUE_BUTTON}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Academic Profile */}
      {step === 1 && (
        <div className={cn(CARD, "relative")}>
          <p className={STEP_LABEL}>
            Step <span className="font-bold">2</span> of {totalSteps - 1}
          </p>
          <h1 className="font-serif text-[32px] sm:text-[40px] text-black leading-tight">
            Your <span className="text-forum-orange">academic</span> profile
          </h1>
          <p className="text-[17px] sm:text-[20px] font-dm-sans font-medium text-forum-dark-gray mt-[8px] mb-[30px]">
            This helps us surface events that are right for where you are in your Princeton journey
          </p>

          <div className="space-y-[20px]">
            <div>
              <label
                htmlFor="class-year"
                className="text-[15px] font-bold font-dm-sans text-black block mb-[6px]"
              >
                Class Year
              </label>
              <select
                id="class-year"
                value={classYear}
                onChange={(e) => setClassYear(e.target.value)}
                className={cn(
                  "w-full h-[49px] border border-forum-medium-gray rounded-[14px] px-[20px] text-[15px] font-dm-sans font-bold appearance-none outline-none focus:border-forum-orange transition-colors bg-white",
                  classYear ? "text-black" : "text-forum-placeholder",
                )}
              >
                <option value="">Select Year</option>
                {classYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {classYearLabel(year)}
                  </option>
                ))}
              </select>
            </div>

            <MajorSelector major={major} setMajor={setMajor} />

            <div>
              <span className="text-[15px] font-bold font-dm-sans text-black block mb-[6px]">
                Campus Regions You Are Frequently At
              </span>
              <p className="text-[12px] font-dm-sans font-medium text-forum-dark-gray mb-[10px]">
                Select all that apply. We&apos;ll prioritize nearby events
              </p>
              <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
                {CAMPUS_REGION_OPTIONS.map(({ value, label, desc }) => {
                  const selected = regions.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleRegion(value)}
                      className={cn(
                        "h-[63px] rounded-[14px] border text-left px-[21px] flex items-center justify-between transition-colors",
                        selected
                          ? "border-forum-cerulean bg-forum-turquoise/10"
                          : "border-forum-medium-gray hover:border-forum-dark-gray",
                      )}
                    >
                      <div>
                        <p className="text-[15px] font-bold font-dm-sans text-forum-dark-gray">
                          {label}
                        </p>
                        <p className="text-[11px] font-bold font-dm-sans text-[#817d79]">{desc}</p>
                      </div>
                      <div
                        aria-hidden
                        className={cn(
                          "w-[13px] h-[13px] rounded-full border-2 transition-colors",
                          selected
                            ? "bg-forum-cerulean border-forum-cerulean"
                            : "border-forum-medium-gray",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-[30px]">
            <button type="button" onClick={handleBack} className={BACK_BUTTON}>
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className={CONTINUE_BUTTON}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Interests */}
      {step === 2 && (
        <div className={cn(CARD, "relative")}>
          <p className={STEP_LABEL}>
            Step <span className="font-bold">3</span> of {totalSteps - 1}
          </p>
          <h1 className="font-serif text-[32px] sm:text-[40px] text-black leading-tight">
            What do you <span className="text-forum-orange">like</span>?
          </h1>
          <p className="text-[17px] sm:text-[20px] font-dm-sans font-medium text-forum-dark-gray mt-[8px] mb-[24px]">
            Pick as many as you like. Your feed is built around these. The more you choose, the
            better it gets.
          </p>

          <div className="flex flex-wrap gap-[10px]">
            {INTEREST_OPTIONS.map(({ value, label }) => {
              const selected = interests.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleInterest(value)}
                  className={cn(
                    "h-[30px] px-[16px] rounded-[20px] border text-[12px] font-bold font-dm-sans transition-colors",
                    selected
                      ? "border-forum-orange bg-forum-orange/10 text-forum-orange"
                      : "border-forum-medium-gray text-[#817d79] hover:border-forum-dark-gray",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] font-inter font-bold text-forum-orange mt-[16px]">
            {interests.length} {interests.length === 1 ? "interest" : "interests"} selected
          </p>

          <div className="flex justify-between mt-[20px]">
            <button type="button" onClick={handleBack} className={BACK_BUTTON}>
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className={CONTINUE_BUTTON}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Org Leader */}
      {step === 3 && (
        <div className={cn(CARD, "relative")}>
          <p className={STEP_LABEL}>
            Step <span className="font-bold">4</span> of {totalSteps - 1}
          </p>
          <h1 className="font-serif text-[32px] sm:text-[40px] text-black leading-tight">
            Are you a <span className="text-forum-orange">club/org. leader</span>?
          </h1>
          <p className="text-[17px] sm:text-[20px] font-dm-sans font-medium text-forum-dark-gray mt-[8px] mb-[24px]">
            If you run or manage a student organization, we&apos;ll unlock tools to create and
            publish events on Forum.
          </p>

          <div className="flex flex-col gap-[10px]">
            {ORG_ROLES.map(({ value, label, desc }) => {
              const selected = orgRole === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setOrgRole(value)}
                  className={cn(
                    "min-h-[63px] py-2 rounded-[14px] border text-left px-[21px] flex items-center justify-between transition-colors",
                    selected
                      ? "border-forum-orange bg-forum-orange/5"
                      : "border-forum-medium-gray hover:border-forum-dark-gray",
                  )}
                >
                  <div>
                    <p className="text-[15px] font-bold font-dm-sans text-black">{label}</p>
                    <p className="text-[11px] font-bold font-dm-sans text-[#817d79]">{desc}</p>
                  </div>
                  <div
                    aria-hidden
                    className={cn(
                      "w-[13px] h-[13px] rounded-full border-2 transition-colors flex-shrink-0 ml-3",
                      selected ? "bg-forum-orange border-forum-orange" : "border-forum-medium-gray",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <div className="flex justify-between mt-[30px]">
            <button type="button" onClick={handleBack} disabled={isPending} className={BACK_BUTTON}>
              Back
            </button>
            <button
              type="button"
              onClick={handleFinish}
              disabled={!canProceed() || isPending}
              className={CONTINUE_BUTTON}
            >
              {isPending ? "Saving…" : "Finish Setup"}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Completion — only reached after the save succeeded */}
      {step === 4 && (
        <div className={cn(CARD, "text-center")}>
          <h1 className="font-serif text-[32px] sm:text-[40px] text-black leading-tight">
            You are all set
            <br />
            <span className="text-forum-orange">{firstName.trim() || "there"}</span>!
          </h1>
          <p className="text-[17px] sm:text-[20px] font-dm-sans font-medium text-forum-dark-gray mt-[12px] mb-[24px]">
            Your personalized Forum feed is ready.
          </p>
          <button
            type="button"
            onClick={() => {
              // Full navigation so the session picks up the onboarded flag.
              window.location.href = "/explore";
            }}
            className="h-[41px] px-[24px] rounded-[20px] bg-forum-orange text-white font-inter font-bold text-[14px] shadow-[5px_5px_10px_10px_rgba(0,0,0,0.05)] hover:opacity-90 transition-all"
          >
            Go to My Feed
          </button>
        </div>
      )}
    </div>
  );
}

/** Searchable major/department selector with A.B./B.S.E. distinction */
function MajorSelector({
  major,
  setMajor,
}: {
  major: string;
  setMajor: (v: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return PRINCETON_MAJORS;
    const q = search.toLowerCase();
    return PRINCETON_MAJORS.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.degree?.toLowerCase().includes(q) ?? false),
    );
  }, [search]);

  const selected = PRINCETON_MAJORS.find((d) => {
    const label = d.degree ? `${d.name} (${d.degree})` : d.name;
    return label === major || d.code === major || d.name === major;
  });

  const displayLabel = selected
    ? selected.degree
      ? `${selected.name} (${selected.degree})`
      : selected.name
    : major || null;

  return (
    <div className="relative">
      <span
        id="major-label"
        className="text-[15px] font-bold font-dm-sans text-black block mb-[6px]"
      >
        Major / Department
      </span>
      <button
        type="button"
        aria-labelledby="major-label"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="w-full h-[49px] border border-forum-border rounded-[14px] px-[20px] text-[15px] font-dm-sans text-left outline-none focus:border-forum-orange transition-colors bg-white flex items-center justify-between"
      >
        <span className={displayLabel ? "text-black" : "text-forum-placeholder font-bold"}>
          {displayLabel || "Select your major"}
        </span>
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="text-forum-placeholder"
        >
          <path
            d="M3 5L6 8L9 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-[4px] bg-white border border-forum-medium-gray rounded-[14px] shadow-lg overflow-hidden">
          <div className="p-[8px] border-b border-forum-medium-gray/50">
            <input
              type="text"
              aria-label="Search majors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search majors... (try 'COS', 'BSE', 'economics')"
              className="w-full h-[36px] px-[12px] text-[13px] font-dm-sans bg-gray-50 rounded-[8px] outline-none"
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((dept) => {
                const label = dept.degree ? `${dept.name} (${dept.degree})` : dept.name;
                return (
                  <button
                    key={dept.code}
                    type="button"
                    onClick={() => {
                      setMajor(label);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="w-full text-left px-[16px] py-[8px] text-[13px] font-dm-sans hover:bg-forum-turquoise/10 transition-colors flex items-center justify-between gap-[8px]"
                  >
                    <span className="text-black flex-1">{dept.name}</span>
                    {dept.degree && (
                      <span className="text-[10px] font-bold text-forum-orange bg-forum-orange/10 px-[6px] py-[1px] rounded-[4px] flex-shrink-0">
                        {dept.degree}
                      </span>
                    )}
                    <span className="text-[11px] text-forum-light-gray font-bold flex-shrink-0">
                      {dept.code}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-[16px] py-[12px] text-[13px] text-forum-light-gray">
                No majors found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
