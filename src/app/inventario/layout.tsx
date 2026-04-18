import { RequirePermission } from "@/components/RequirePermission";

export default function InventarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequirePermission perm="modules.inventario">{children}</RequirePermission>
  );
}
