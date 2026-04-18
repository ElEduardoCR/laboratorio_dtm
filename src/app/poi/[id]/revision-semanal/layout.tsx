import { RequirePermission } from "@/components/RequirePermission";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission perm="reviews.weekly">{children}</RequirePermission>
  );
}
