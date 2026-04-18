import { RequirePermission } from "@/components/RequirePermission";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission perm="create.inventario">{children}</RequirePermission>
  );
}
