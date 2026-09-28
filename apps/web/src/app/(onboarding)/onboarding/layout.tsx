import { SessionProvider } from "next-auth/react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="relative flex flex-col h-dvh w-full bg-forum-bg overflow-hidden">
        {/* Children centre themselves with `my-auto`; `items-center` on an
            overflowing flex container would clip the top of tall steps. */}
        <main className="relative z-10 flex flex-1 overflow-y-auto">{children}</main>
      </div>
    </SessionProvider>
  );
}
