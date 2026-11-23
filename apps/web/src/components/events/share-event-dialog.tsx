"use client";

import { Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export function ShareEventDialog({
  id,
  title,
  information,
  children,
}: { id: string; title: string; information?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [messagesPrefix, setMessagesPrefix] = useState("sms:?body=");
  const [nativeShare, setNativeShare] = useState(false);
  const text = [title, information, url].filter(Boolean).join("\n");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link. Please try again.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title, text: [title, information].filter(Boolean).join("\n"), url });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error("Couldn't share this event. Try Email or Copy link.");
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setUrl(`${window.location.origin}/events/${id}`);
          const ios =
            /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
          setMessagesPrefix(
            ios
              ? "sms:&body="
              : /Mac/i.test(navigator.userAgent)
                ? "sms:/open?&body="
                : "sms:?body=",
          );
          setNativeShare(typeof navigator.share === "function");
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share event</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button asChild variant="outline" className="justify-start">
            <a href={`${messagesPrefix}${encodeURIComponent(text)}`}>
              <MessageCircle /> Messages
            </a>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <a
              href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`}
            >
              <Mail /> Email
            </a>
          </Button>
          <Button variant="outline" className="justify-start" onClick={copyLink}>
            <Copy /> Copy link
          </Button>
          {nativeShare && (
            <Button variant="outline" className="justify-start" onClick={share}>
              <Share2 /> More sharing options
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Messages opens your messaging app on Apple devices. On Windows, it requires an app that
          supports SMS links.
        </p>
      </DialogContent>
    </Dialog>
  );
}
