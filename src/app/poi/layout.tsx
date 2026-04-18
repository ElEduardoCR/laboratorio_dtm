import { RequirePermission } from "@/components/RequirePermission";

export default function POILayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission perm="modules.poi">{children}</RequirePermission>;
}
