import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/current";
import { listUsers } from "@/server/services/users";
import { PageHeader } from "@/ui/PageHeader";
import { UsersAdmin } from "@/ui/client/UsersAdmin";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function AdminPage() {
  const user = await requirePageUser(["admin"]);
  const users = await listUsers(user);
  return (
    <div className="mp-content">
      <PageHeader title="Utilisateurs et rôles" subtitle="Accès à l’application Mathieu Pharma" />
      <UsersAdmin users={users} currentUserId={user.id} />
    </div>
  );
}
