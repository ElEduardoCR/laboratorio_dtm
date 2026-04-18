import { RequirePermission } from "@/components/RequirePermission";

export default function RecaudacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequirePermission perm="modules.recaudacion">{children}</RequirePermission>
  );
}
