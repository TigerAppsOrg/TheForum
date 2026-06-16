import { signIn } from "~/auth";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-forum-yellow-10 font-dm-sans">
      {/* ═══ NAV BAR (static) ═══ */}
      <header className="fixed top-0 z-20 flex items-center justify-between px-5 py-1 bg-white/75 backdrop-blur-sm min-w-full h-16">
        <div className="flex flex-col">
          <a href="#hero" className="flex flex-col">
            <span className="font-serif italic text-[28px] text-black tracking-tight leading-tight whitespace-nowrap">
              The Forum
            </span>
            <span className="text-[9px] text-forum-light-gray ml-1 self-end mb-1.25">
              by TigerApps
            </span>
          </a>
        </div>
        <div className="px-4" />
        <nav className="flex items-center gap-4">
          <div className="hidden md:flex flex-row gap-10 font-semibold text-forum-dark-gray text-sm tracking-wider">
            <a href="#attendees" className="px-2 hover:text-black transition-colors">
              EVENT ATTENDEES
            </a>
            <a href="#organizers" className="px-2 hover:text-black transition-colors">
              EVENT ORGANIZERS
            </a>
          </div>
          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo: "/explore" });
            }}
          >
            <button type="submit" className="button-coral">
              LOG IN
            </button>
          </form>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white to-transparent" />
      </header>

      {/* ═══ HERO SECTION ═══ */}
      <section
        id="hero"
        className="relative px-15 pt-2.5 pb-25 min-h-screen bg-forum-yellow-10 overflow-hidden flex flex-col justify-end"
      >
        {/* Geometric background shapes — large, soft, overlapping */}
        <div className=" inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {/* Large turquoise blob — left side, extends from top */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            {/* Coral/pink blob — left center */}
            <div className="absolute -left-25 -bottom-25 w-175 h-175 rounded-full bg-[#F4A08E] opacity-40 blur-lg" />

            {/* Yellow blob — center */}
            <div className="absolute left-100 bottom-50 w-87.5 h-87.5 rounded-full bg-[#FEE882] opacity-40 blur-lg" />

            {/* Pink blob — top right */}
            <div className="absolute right-0 -top-25 w-125 h-125 rounded-full bg-[#FFD3EA] opacity-50 blur-lg" />

            {/* Mint/teal blob — bottom right */}
            <div className="absolute right-25 -bottom-25 w-100 h-100 rounded-full bg-[#A2EFF0] opacity-40 blur-lg" />
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-175 h-full">
          <div className="py-10" />
          <p className="text-[11px] font-bold tracking-[0.22em] text-black uppercase mb-6 flex items-center gap-10 py-3">
            <span className="w-20 h-0.5 bg-black inline-block" />
            Campus Events Platform — Princeton
          </p>

          <h1 className="font-serif text-[72px] font-semibold leading-tight text-black mb-7">
            Campus events,
            <br />
            <span className="text-forum-coral italic font-bold">curated.</span>
          </h1>

          <div className="w-25 h-0.5 bg-black mb-7" />
          <div className="flex flex-col gap-10">
            <p className="text-lg font-semibold text-black leading-normal">
              Forum brings every campus event worth attending into{" "}
              <span className="text-forum-coral font-bold">one beautifully curated feed, </span>
              personalized around you, your friends, and the things you actually love.
            </p>
            <form
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id", { redirectTo: "/explore" });
              }}
            >
              <button type="submit" className="button-white">
                Get Started
              </button>
            </form>
          </div>
        </div>
        <div className="py-10" />
      </section>

      {/* ═══ FOR EVENT ATTENDEES ═══ */}
      <section
        id="attendees"
        className="flex flex-col md:flex-row bg-forum-turquoise px-8 md:px-30 md:py-20 gap-10 md:gap-20 min-h-[200vh] md:min-h-screen"
      >
        {" "}
        {/* Left column */}
        <div className="flex flex-1 flex-col gap-25 justify-between py-20 md:py-20">
          {/* Mockup */}
          <div className="relative flex items-center justify-center min-h-64">
            <div className="absolute w-80 h-80 rounded-full bg-forum-cerulean opacity-75 blur-lg" />
            <div className="relative z-10 bg-white/20 rounded-2xl w-full max-w-sm h-64 flex items-center justify-center text-white/50 text-sm">
              UI mockup goes here
            </div>
          </div>

          {/* Quote */}
          <div className="flex flex-col gap-4">
            <blockquote className="flex flex-row font-dm-sans text-[20px] md:text-[24px] text-forum-black leading-tight">
              <p className="font-serif italic text-[80px] md:text-[100px] leading-6 mr-2">
                &ldquo;
              </p>
              <p>
                Students shouldn&apos;t have to dig through listservs and group chats to find out
                what&apos;s happening on their own campus.{" "}
                <span className="text-forum-cerulean font-bold">
                  The best moments deserve to be discovered.&rdquo;
                </span>
              </p>
            </blockquote>
            <div className="flex flex-row gap-4 items-center">
              <span className="w-32 h-0.5 bg-black inline-block shrink-0" />
              <p className="text-xs font-bold tracking-[0.18em] text-forum-black uppercase">
                The Forum Team — Princeton TigerApps
              </p>
            </div>
          </div>
        </div>
        {/* Right column */}
        <div className="flex flex-1 flex-col gap-28 justify-start py-24 md:justify-between md:py-20">
          {/* Label + heading */}
          <div className="flex flex-col gap-4 items-end">
            <div className="flex flex-row gap-4 items-center">
              <span className="w-24 md:w-40 h-0.5 bg-black inline-block" />
              <p className="text-xs font-bold tracking-[0.18em] text-forum-black uppercase whitespace-nowrap">
                For Event Attendees
              </p>
            </div>
            <h2 className="font-serif text-[36px] md:text-[48px] font-medium leading-tight text-black text-right">
              Everything you need to never miss{" "}
              <span className="text-forum-cerulean italic font-bold">a thing.</span>
            </h2>
          </div>

          {/* Second mockup */}
          <div className="relative flex justify-end items-center">
            <div className="absolute w-90 h-90 rounded-10 bg-forum-cerulean opacity-75 blur-lg" />
            <div className="relative z-10 bg-white/20 rounded-2xl w-full max-w-sm h-48 flex items-center justify-center text-white/50 text-sm">
              Second mockup goes here
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BOTTOM SECTION ═══ */}
      <section className="flex flex-col md:flex-row min-h-screen">
        {/* Left — event organizers */}
        <div
          id="organizers"
          className="flex-1 bg-forum-coral/25 px-20 py-40 pt-50 flex flex-col justify-between items-end"
        >
          <div className="max-w-5/6 items-end">
            <div className="flex flex-row items-center gap-4 mb-6">
              <span className="flex-1 h-0.5 bg-forum-black inline-block" />
              <p className="text-xs font-bold tracking-[0.22em] text-forum-black uppercase whitespace-nowrap">
                For Event Organizers
              </p>
            </div>
            <h2 className="font-serif text-[44px] leading-tight text-forum-black text-right">
              Put your events in front of{" "}
              <span className="text-forum-coral italic font-bold">people who care.</span>
            </h2>
          </div>

          {/* Bottom — description + button */}
          <div className="flex flex-col gap-6 pt-30 items-end">
            <p className="text-small font-medium text-forum-black leading-relaxed text-right max-w-7/8">
              Create your organization&apos;s page, publish events in minutes, and{" "}
              <span className="text-forum-coral font-bold">
                reach students whose interests actually align with what you&apos;re building.
              </span>
            </p>
            <form
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id", { redirectTo: "/events/create" });
              }}
            >
              <button
                type="submit"
                className="px-8 py-4 border-2 border-forum-coral text-forum-black text-small font-bold tracking-[0.22em] uppercase hover:bg-forum-coral hover:text-white transition-colors duration-500 rounded-md"
              >
                Create an Event
              </button>
            </form>
          </div>
        </div>

        {/* Right — deep coral, join CTA + FORUM wordmark */}
        <div className="flex-1 bg-forum-pink px-14 py-16 flex flex-col justify-between overflow-hidden relative min-h-screen">
          {/* Warm yellow glow blob */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/4 w-72 h-72 rounded-full bg-forum-yellow opacity-50 blur-xl pointer-events-none" />

          {/* Centered text + button */}
          <div className="relative z-10 flex flex-col items-center text-center gap-6 mt-16 self-center">
            <h2 className="font-serif text-[36px] md:text-[42px] leading-tight text-black">
              Whether you&apos;re an attendee or an organizer,{" "}
              <span className="italic font-bold text-forum-coral">The Forum</span> is the best place
              for <span className="italic font-bold">you.</span>
            </h2>
            <div className="w-0.5 h-30 bg-black" />
            <form
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id", { redirectTo: "/explore" });
              }}
            >
              <button type="submit" className="button-white">
                Join Today
              </button>
            </form>
          </div>

          {/* FORUM wordmark at bottom */}
          <div className="absolute bottom-0 z-10 mt-auto overflow-hidden">
            <h2 className="font-kalnia text-[130px] md:text-[160px] font-bold tracking-[0.06em] text-forum-coral leading-none select-none -mb-6">
              FORUM
            </h2>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-white px-15 py-5 border-t border-gray-100">
        <p className="text-[11px] text-forum-light-gray">
          Built for Princeton students — The Forum by TigerApps
        </p>
      </footer>
    </main>
  );
}
