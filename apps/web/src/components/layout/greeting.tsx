import { formatGreetingDate } from "~/lib/date-format";

/**
 * Home's greeting from the Figma: "Hello **Albert**," in large serif with the
 * name in bold italic, and today's date (Princeton time) under an orange dot.
 * With no real name yet (see ~/lib/greeting-name) it is just "Hello,".
 * Only Home gets this; every other page uses the compact PageHeading.
 */
export function Greeting({ name }: { name: string | null }) {
  return (
    <div className="mb-5">
      <h1 className="font-serif text-[34px] leading-[1.1] text-black sm:text-[44px] lg:text-[52px]">
        {name ? (
          <>
            Hello <span className="font-bold italic">{name}</span>,
          </>
        ) : (
          "Hello,"
        )}
      </h1>
      <p className="mt-2 flex items-center gap-2 font-serif text-[15px] italic text-forum-dark-gray sm:text-[17px]">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-forum-orange" />
        Today is {formatGreetingDate(new Date())}
      </p>
    </div>
  );
}
