import { formatGreetingDate } from "~/lib/date-format";

/**
 * Home's greeting from the Figma: "Hello **Albert**," in large serif with the
 * name in bold italic, and today's date (Princeton time) under an orange dot.
 * Only Home gets this; every other page uses the compact PageHeading.
 */
export function Greeting({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] || "there";
  return (
    <div className="mb-5">
      <h1 className="font-serif text-[34px] leading-[1.1] text-black sm:text-[44px] lg:text-[52px]">
        Hello <span className="font-bold italic">{first}</span>,
      </h1>
      <p className="mt-2 flex items-center gap-2 font-serif text-[15px] italic text-forum-dark-gray sm:text-[17px]">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-forum-orange" />
        Today is {formatGreetingDate(new Date())}
      </p>
    </div>
  );
}
