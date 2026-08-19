import { signOut } from "@/auth";

/**
 * Uitloggen via een server action, net als inloggen op de loginpagina.
 *
 * Hier stond eerder een `<a href="/api/auth/signout">` in de zijbalk. Dat werkte,
 * maar leunde op de standaardpagina van NextAuth en gaf een lintfout. Dit is het
 * patroon dat de rest van de app al gebruikt.
 */
export default function SignOutForm() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
      >
        Uitloggen
      </button>
    </form>
  );
}
