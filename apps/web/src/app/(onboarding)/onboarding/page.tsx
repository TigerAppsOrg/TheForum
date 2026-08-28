"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { completeOnboarding } from "~/actions/users";
import { PRINCETON_MAJORS } from "~/lib/princeton-departments";
import { cn } from "~/lib/utils";

const INTEREST_TAGS = [
  "Career & Recruiting",
  "Research",
  "Academics",
  "Entrepreneurship",
  "Art & Design",
  "Theater & Performance",
  "Cultural & Identity",
  "Music",
  "Community Service",
  "Gaming & Esports",
  "Politics & Advocacy",
  "Sustainability",
  "Free Food",
  "Wellness & Mental Health",
  "Fitness & Sports",
  "Cooking & Food",
  "Tech & Coding",
  "Science & Engineering",
  "AI & Machine Learning",
  "Social Events",
  "Outdoor & Adventure",
  "Photography",
  "Film",
];

// Maps display labels to DB event_tag enum values
const INTEREST_TO_TAG: Record<string, string> = {
  "Career & Recruiting": "career",
  Research: "research",
  Academics: "academics",
  Entrepreneurship: "entrepreneurship",
  "Art & Design": "visual arts",
  "Theater & Performance": "performing arts",
  "Cultural & Identity": "culture",
  Music: "music",
  "Community Service": "community service",
  "Gaming & Esports": "gaming",
  "Politics & Advocacy": "politics",
  Sustainability: "sustainability",
  "Free Food": "free food",
  "Wellness & Mental Health": "wellness",
  "Fitness & Sports": "athletics",
  "Cooking & Food": "free food",
  "Tech & Coding": "tech",
  "Science & Engineering": "stem",
  "AI & Machine Learning": "tech",
  "Social Events": "social event",
  "Outdoor & Adventure": "outdoors",
  Photography: "visual arts",
  Film: "visual arts",
};

const CAMPUS_REGIONS = [
  { id: "central", label: "Central Campus", desc: "Nassau Hall, Frist, 1879" },
  { id: "east", label: "Science Area", desc: "Jadwin, Friend, EQuad" },
  { id: "south", label: "Prospect Ave", desc: "Eating clubs, Terrace" },
  { id: "west", label: "Residential Colleges", desc: "Butler, Whitman, Yeh ..." },
  { id: "north", label: "Arts Corridor", desc: "McCarter, Lewis Center" },
  { id: "off-campus", label: "Athletics Area", desc: "Lenz, Denunzio, Dillon" },
];

const CLASS_YEARS = ["2025", "2026", "2027", "2028", "2029", "Grad"];

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

export default function OnboardingPage() {
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);

  // Step 1: Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [netId, setNetId] = useState("");
  const [email, setEmail] = useState("");

  // Step 2: Academic profile
  const [classYear, setClassYear] = useState("");
  const [residentialCollege, setResidentialCollege] = useState("");
  const [major, setMajor] = useState("");
  const [regions, setRegions] = useState<string[]>([]);

  // Step 3: Interests
  const [interests, setInterests] = useState<string[]>([]);

  // Step 4: Org role
  const [orgRole, setOrgRole] = useState("");

  const totalSteps = 5;

  // Pre-fill from session
  const displayName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run when session changes
  useEffect(() => {
    if (!session?.user) return;
    if (!firstName && displayName) {
      setFirstName(displayName.split(" ")[0] || "");
      setLastName(displayName.split(" ").slice(1).join(" ") || "");
    }
    if (!email && userEmail) setEmail(userEmail);
    const sessionNetId = (session.user as { netId?: string })?.netId;
    if (!netId && sessionNetId) setNetId(sessionNetId);
  }, [session?.user]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((i) => i !== tag) : [...prev, tag]));
  };

  const toggleRegion = (id: string) => {
    setRegions((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return (firstName || displayName) && netId;
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

  const handleSubmit = () => {
    startTransition(async () => {
      const uniqueTags = [
        ...new Set(interests.map((label) => INTEREST_TO_TAG[label]).filter(Boolean)),
      ];
      await completeOnboarding({
        interests: uniqueTags,
        classYear,
        major,
        regions,
        isOrgLeader: orgRole === "leader",
      });
      window.location.href = "/explore";
    });
  };

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="w-full max-w-[663px] mx-auto px-6">
      {/* Step 1: Personal Info */}
      {step === 0 && (
        <div className="bg-white rounded-[10px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[40px] relative">
          <p className="absolute top-[18px] right-[30px] text-[15px] font-dm-sans font-light text-black">
            Step <span className="font-bold">1</span> of {totalSteps - 1}
          </p>
          <h1 className="font-serif text-[40px] text-black leading-tight">
            Let&apos;s get you <span className="text-forum-orange">set up</span>
          </h1>
          <p className="text-[20px] font-dm-sans font-medium text-forum-dark-gray mt-[8px] mb-[30px]">
            Tell us a bit about yourself so we can personalize your experience from day one
          </p>

          <div className="space-y-[20px]">
            <div className="flex gap-[16px]">
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
                  placeholder="e.g. Albert"
                  value={firstName || displayName.split(" ")[0] || ""}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full h-[49px] border border-black rounded-[14px] px-[20px] text-[15px] font-dm-sans placeholder:text-forum-placeholder placeholder:font-bold outline-none focus:border-forum-orange transition-colors"
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
                  placeholder="e.g. Rho"
                  value={lastName || displayName.split(" ").slice(1).join(" ") || ""}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full h-[49px] border border-black rounded-[14px] px-[20px] text-[15px] font-dm-sans placeholder:text-forum-placeholder placeholder:font-bold outline-none focus:border-forum-orange transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="netid"
                className="text-[15px] font-medium font-dm-sans text-black block mb-[6px]"
              >
                NetID
              </label>
              <input
                id="netid"
                type="text"
                placeholder="e.g. ar1585"
                value={netId || (session?.user as { netId?: string })?.netId || ""}
                onChange={(e) => setNetId(e.target.value)}
                className="w-full h-[49px] border border-black rounded-[14px] px-[20px] text-[15px] font-dm-sans placeholder:text-forum-placeholder placeholder:font-bold outline-none focus:border-forum-orange transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="text-[15px] font-medium font-dm-sans text-black block mb-[6px]"
              >
                Princeton Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="netid@princeton.edu"
                value={email || userEmail || ""}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[49px] border border-black rounded-[14px] px-[20px] text-[15px] font-dm-sans placeholder:text-forum-placeholder placeholder:font-bold outline-none focus:border-forum-orange transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end mt-[30px]">
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="h-[41px] px-[21px] rounded-full shadow-[5px_5px_10px_10px_rgba(0,0,0,0.05)] font-inter font-bold text-[14px] text-forum-orange bg-white hover:bg-gray-50 disabled:opacity-40 transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Academic Profile */}
      {step === 1 && (
        <div className="bg-white rounded-[10px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[40px] relative">
          <p className="absolute top-[18px] right-[30px] text-[15px] font-dm-sans font-light text-black">
            Step <span className="font-bold">2</span> of {totalSteps - 1}
          </p>
          <h1 className="font-serif text-[40px] text-black leading-tight">
            Your <span className="text-forum-orange">academic</span> profile
          </h1>
          <p className="text-[20px] font-dm-sans font-medium text-forum-dark-gray mt-[8px] mb-[30px]">
            This helps us surface events that are right for where you are in your Princeton journey
          </p>

          <div className="space-y-[20px]">
            <div className="flex gap-[16px]">
              <div className="flex-1">
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
                  className="w-full h-[49px] border border-forum-medium-gray rounded-[14px] px-[20px] text-[15px] font-dm-sans font-bold text-forum-placeholder appearance-none outline-none focus:border-forum-orange transition-colors bg-white"
                >
                  <option value="">Select Year</option>
                  {CLASS_YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label
                  htmlFor="residential-college"
                  className="text-[15px] font-bold font-dm-sans text-black block mb-[6px]"
                >
                  Residential College
                </label>
                <select
                  id="residential-college"
                  value={residentialCollege}
                  onChange={(e) => setResidentialCollege(e.target.value)}
                  className="w-full h-[49px] border border-forum-medium-gray rounded-[14px] px-[20px] text-[15px] font-dm-sans font-bold text-forum-placeholder appearance-none outline-none focus:border-forum-orange transition-colors bg-white"
                >
                  <option value="">Select College</option>
                  <option value="butler">Butler</option>
                  <option value="whitman">Whitman</option>
                  <option value="mathey">Mathey</option>
                  <option value="rockefeller">Rockefeller</option>
                  <option value="forbes">Forbes</option>
                  <option value="yeh">Yeh</option>
                  <option value="nc">New College West</option>
                </select>
              </div>
            </div>

            <MajorSelector major={major} setMajor={setMajor} />

            <div>
              <span className="text-[15px] font-bold font-dm-sans text-black block mb-[6px]">
                Campus Regions You Are Frequently At
              </span>
              <p className="text-[10px] font-dm-sans font-medium text-forum-dark-gray mb-[10px]">
                Select all that apply. We&apos;ll prioritize nearby events
              </p>
              <div className="grid grid-cols-2 gap-[14px]">
                {CAMPUS_REGIONS.map(({ id, label, desc }) => {
                  const selected = regions.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleRegion(id)}
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
            <button
              type="button"
              onClick={handleBack}
              className="h-[41px] px-[21px] rounded-full text-[14px] font-inter font-bold text-forum-light-gray hover:text-forum-dark-gray transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="h-[41px] px-[21px] rounded-full shadow-[5px_5px_10px_10px_rgba(0,0,0,0.05)] font-inter font-bold text-[14px] text-forum-orange bg-white hover:bg-gray-50 disabled:opacity-40 transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Interests */}
      {step === 2 && (
        <div className="bg-white rounded-[10px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[40px] relative">
          <p className="absolute top-[18px] right-[30px] text-[15px] font-dm-sans font-light text-black">
            Step <span className="font-bold">3</span> of {totalSteps - 1}
          </p>
          <h1 className="font-serif text-[40px] text-black leading-tight">
            What do you <span className="text-forum-orange">like</span>?
          </h1>
          <p className="text-[20px] font-dm-sans font-medium text-forum-dark-gray mt-[8px] mb-[24px]">
            Pick as many as you like. Your feed is built around these. The more you choose, the
            better it gets.
          </p>

          <div className="flex flex-wrap gap-[10px]">
            {INTEREST_TAGS.map((tag) => {
              const selected = interests.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleInterest(tag)}
                  className={cn(
                    "h-[30px] px-[16px] rounded-[20px] border text-[12px] font-bold font-dm-sans transition-colors",
                    selected
                      ? "border-forum-orange bg-forum-orange/10 text-forum-orange"
                      : "border-forum-medium-gray text-[#817d79] hover:border-forum-dark-gray",
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] font-inter font-bold text-forum-orange mt-[16px]">
            {interests.length} interests selected
          </p>

          <div className="flex justify-between mt-[20px]">
            <button
              type="button"
              onClick={handleBack}
              className="h-[41px] px-[21px] rounded-full text-[14px] font-inter font-bold text-forum-light-gray hover:text-forum-dark-gray transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="h-[41px] px-[21px] rounded-full shadow-[5px_5px_10px_10px_rgba(0,0,0,0.05)] font-inter font-bold text-[14px] text-forum-orange bg-white hover:bg-gray-50 disabled:opacity-40 transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Org Leader */}
      {step === 3 && (
        <div className="bg-white rounded-[10px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[40px] relative">
          <p className="absolute top-[18px] right-[30px] text-[15px] font-dm-sans font-light text-black">
            Step <span className="font-bold">4</span> of {totalSteps - 1}
          </p>
          <h1 className="font-serif text-[40px] text-black leading-tight">
            Are you a <span className="text-forum-orange">club/org. leader</span>?
          </h1>
          <p className="text-[20px] font-dm-sans font-medium text-forum-dark-gray mt-[8px] mb-[24px]">
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
                  onClick={() => setOrgRole(value)}
                  className={cn(
                    "h-[63px] rounded-[14px] border text-left px-[21px] flex items-center justify-between transition-colors",
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
            <button
              type="button"
              onClick={handleBack}
              className="h-[41px] px-[21px] rounded-full text-[14px] font-inter font-bold text-forum-light-gray hover:text-forum-dark-gray transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="h-[41px] px-[21px] rounded-full shadow-[5px_5px_10px_10px_rgba(0,0,0,0.05)] font-inter font-bold text-[14px] text-forum-orange bg-white hover:bg-gray-50 disabled:opacity-40 transition-all"
            >
              Finish Setup
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Completion */}
      {step === 4 && (
        <div className="bg-white rounded-[10px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[40px] text-center">
          <h1 className="font-serif text-[40px] text-black leading-tight">
            You are all set
            <br />
            <span className="text-forum-orange">
              {firstName || displayName.split(" ")[0] || "there"}
            </span>
            !
          </h1>
          <p className="text-[20px] font-dm-sans font-medium text-forum-dark-gray mt-[12px] mb-[24px]">
            Your personalized Forum feed is ready.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="h-[41px] px-[24px] rounded-[20px] bg-forum-orange text-white font-inter font-bold text-[14px] shadow-[5px_5px_10px_10px_rgba(0,0,0,0.05)] hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isPending ? "Setting up..." : "Go to My Feed"}
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
      <span className="text-[15px] font-bold font-dm-sans text-black block mb-[6px]">
        Major / Department
      </span>
      <button
        type="button"
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
