import { RequirePermission } from "@/components/RequirePermission";

export default function MantenimientoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequirePermission perm="modules.mantenimiento">{children}</RequirePermission>
  );
}
