import { RequirePermission } from "@/components/RequirePermission";

export default function TanquesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequirePermission perm="modules.tanques">{children}</RequirePermission>
  );
}
