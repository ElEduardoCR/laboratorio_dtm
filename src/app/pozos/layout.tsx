import { RequirePermission } from "@/components/RequirePermission";

export default function PozosLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission perm="modules.pozos">{children}</RequirePermission>;
}
