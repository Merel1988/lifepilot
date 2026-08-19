import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import ContactManager from "@/components/ContactManager";

export default async function ContactenPage() {
  const session = await auth();

  return (
    <AppShell userName={session?.user?.name} userImage={session?.user?.image}>
      <ContactManager />
    </AppShell>
  );
}
