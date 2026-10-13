import { redirect } from "next/navigation";
import { initialsOf, ROLE_LABELS } from "@/domain/roles";
import { getCurrentUser } from "@/server/auth/current";
import { countByStatus } from "@/server/services/dossiers";
import { BottomNav, MainArea, MobileTopbar, Sidebar } from "@/ui/shell/AppNav";

/**
 * Coque de l'application. Elle n'est PAS la protection d'accès : chaque page et chaque
 * route API revérifie la session (les layouts ne sont pas réexécutés à chaque navigation).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const counts = user.role === "admin" ? null : await countByStatus(user);
  const attention = counts ? (user.role === "adv" ? counts.SUBMITTED : counts.NEEDS_INFO) : 0;
  const initials = initialsOf(user.fullName);

  return (
    <div className="mp-shell">
      <Sidebar
        role={user.role}
        fullName={user.fullName}
        initials={initials}
        roleLabel={ROLE_LABELS[user.role]}
        needsInfoCount={user.role === "commercial" ? attention : 0}
      />
      <div style={{ minWidth: 0 }}>
        <MobileTopbar initials={initials} needsInfoCount={attention} role={user.role} />
        <MainArea>{children}</MainArea>
        <BottomNav role={user.role} needsInfoCount={user.role === "commercial" ? attention : 0} />
      </div>
    </div>
  );
}
