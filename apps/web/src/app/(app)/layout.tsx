import { SessionProvider } from "next-auth/react";
import { AppChrome } from "~/components/layout/app-chrome";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppChrome>{children}</AppChrome>
    </SessionProvider>
  );
}
