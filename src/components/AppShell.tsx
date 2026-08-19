import MainNav from "./MainNav";
import SignOutForm from "./SignOutForm";

interface AppShellProps {
  children: React.ReactNode;
  userName?: string | null;
  userImage?: string | null;
}

/**
 * De romp om elke pagina: navigatie plus het scrollende inhoudsvlak.
 *
 * Dit is een server component, zodat het uitlog-formulier (een server action)
 * hier gemaakt kan worden en als slot in de client-side navigatie past. De
 * `pt-16` en `pb-24` maken op mobiel ruimte voor de vaste kop en de tabbalk.
 */
export default function AppShell({ children, userName, userImage }: AppShellProps) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <MainNav
        userName={userName}
        userImage={userImage}
        signOutSlot={<SignOutForm />}
      />

      <main className="flex-1 overflow-y-auto px-4 pt-20 pb-24 sm:px-6 lg:p-6">
        {children}
      </main>
    </div>
  );
}
