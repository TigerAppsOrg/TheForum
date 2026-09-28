import { Fragment } from "react";
import { type Inline, parseRichText } from "~/lib/rich-text";
import { cn } from "~/lib/utils";

function InlineContent({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.type === "text" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parsed text runs have no identity
          <Fragment key={i}>{part.text}</Fragment>
        ) : (
          <a
            // biome-ignore lint/suspicious/noArrayIndexKey: parsed links have no identity
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-words font-medium text-forum-cerulean underline-offset-2 hover:underline"
          >
            {part.label}
          </a>
        ),
      )}
    </>
  );
}

/**
 * Renders imported plain text (event descriptions, org About, listserv
 * emails) with paragraphs, line breaks, bullet lists and safe links — all as
 * React elements, never `dangerouslySetInnerHTML`. See `lib/rich-text.ts`.
 */
export function RichText({
  text,
  className,
}: { text: string | null | undefined; className?: string }) {
  const blocks = parseRichText(text);
  if (blocks.length === 0) return null;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 font-dm-sans text-[14px] leading-relaxed text-forum-dark-gray [overflow-wrap:anywhere]",
        className,
      )}
    >
      {blocks.map((block, i) =>
        block.type === "paragraph" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional
          <p key={i}>
            {block.lines.map((line, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
              <Fragment key={j}>
                {j > 0 && <br />}
                <InlineContent parts={line} />
              </Fragment>
            ))}
          </p>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5 marker:text-forum-light-gray">
            {block.items.map((item, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: items are positional
              <li key={j}>
                <InlineContent parts={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
