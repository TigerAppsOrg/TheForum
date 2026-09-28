/**
 * Helpers for presenting imported event content on cards.
 */

/**
 * MyPrincetonU fills events without a photo with its generic orange
 * "MyPrinceton" banner (hundreds of events share it). It isn't an event
 * photo, so cards treat it as no image. Better fixed upstream in InboxEngine;
 * this keeps the UI honest meanwhile.
 */
const PLACEHOLDER_FLYER_PATTERNS = [/MyPrinceton_200x1140/i];

export function eventPhotoUrl(flyerUrl: string | null | undefined): string | null {
  if (!flyerUrl) return null;
  return PLACEHOLDER_FLYER_PATTERNS.some((re) => re.test(flyerUrl)) ? null : flyerUrl;
}

/**
 * A readable one-paragraph preview of a description: listserv emails are full
 * of raw links ("[https://docs.google.com/forms/…]") that eat the three
 * visible lines. Links are dropped from the preview (the full text, links
 * included, is on the event page) and whitespace is collapsed.
 */
export function descriptionPreview(description: string | null | undefined): string {
  if (!description) return "";
  return description
    .replace(/\[(https?:\/\/[^\]\s]+)\]/g, " ")
    .replace(/<?https?:\/\/[^\s>)\]]+>?/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
