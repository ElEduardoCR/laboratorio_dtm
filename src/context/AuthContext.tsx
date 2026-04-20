"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase/client";

export type Permissions = {
  modules: {
    poi?: boolean;
    pozos?: boolean;
    mantenimiento?: boolean;
    tanques?: boolean;
    inventario?: boolean;
    recaudacion?: boolean;
  };
  reviews: { daily?: boolean; weekly?: boolean };
  create: {
    poi?: boolean;
    pozos?: boolean;
    tanques?: boolean;
    inventario?: boolean;
  };
  inventory: { in?: boolean; out?: boolean };
  tanks: { in?: boolean; out?: boolean };
  maintenance: { assign?: boolean };
  costs: { view?: boolean };
};

export type Profile = {
  id: string;
  full_name: string;
  is_active: boolean;
  permissions: Permissions;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function emptyPerms(): Permissions {
  return {
    modules: {},
    reviews: {},
    create: {},
    inventory: {},
    tanks: {},
    maintenance: {},
    costs: {},
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, is_active, permissions")
      .eq("id", userId)
      .single();
    if (data) {
      setProfile({
        id: data.id,
        full_name: data.full_name || "",
        is_active: data.is_active,
        permissions: { ...emptyPerms(), ...(data.permissions || {}) },
      });
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        if (event === "SIGNED_OUT" || !newSession?.user) {
          setProfile(null);
          return;
        }
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          loadProfile(newSession.user.id);
        }
      }
    );
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, profile, loading, signIn, signOut }),
    [session, profile, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export type PermissionKey =
  | `modules.${keyof Permissions["modules"]}`
  | `reviews.${keyof Permissions["reviews"]}`
  | `create.${keyof Permissions["create"]}`
  | `inventory.${keyof Permissions["inventory"]}`
  | `tanks.${keyof Permissions["tanks"]}`
  | `maintenance.${keyof Permissions["maintenance"]}`
  | `costs.${keyof Permissions["costs"]}`;

export function hasPermission(
  perms: Permissions | null | undefined,
  key: PermissionKey
): boolean {
  if (!perms) return false;
  const [group, name] = key.split(".") as [keyof Permissions, string];
  const bucket = perms[group] as Record<string, boolean> | undefined;
  return !!bucket?.[name];
}

export function usePermission(key: PermissionKey) {
  const { profile } = useAuth();
  return hasPermission(profile?.permissions, key);
}
