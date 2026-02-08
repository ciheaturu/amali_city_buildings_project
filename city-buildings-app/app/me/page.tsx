// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { supabase } from "@/lib/supabaseClient";

// type Profile = {
//   role: "city" | "admin";
//   city_id: string | null;
// };

// export default function MePage() {
//   const router = useRouter();

//   const [email, setEmail] = useState<string>("");
//   const [role, setRole] = useState<Profile["role"] | "">("");
//   const [cityId, setCityId] = useState<string | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     async function load() {
//       const { data: userData } = await supabase.auth.getUser();
//       const user = userData.user;

//       if (!user) {
//         router.push("/login");
//         return;
//       }

//       setEmail(user.email ?? "");

//       const { data: profile } = await supabase
//         .from("profiles")
//         .select("role, city_id")
//         .eq("user_id", user.id)
//         .single();

//       setRole(profile?.role ?? "");
//       setCityId(profile?.city_id ?? null);
//       setLoading(false);
//     }

//     load();
//   }, [router]);

//   async function onContinue() {
//     if (role === "admin") router.push("/admin");
//     else router.push("/app");
//   }

//   async function onSignOut() {
//     await supabase.auth.signOut();
//     router.push("/login");
//   }

//   if (loading) return <main style={{ padding: 16 }}>Loading...</main>;

//   return (
//     <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
//       <h1 style={{ fontSize: 24, fontWeight: 800 }}>Account</h1>

//       <div style={{ marginTop: 16 }}>
//         <div>Email: {email}</div>
//         <div>Role: {role}</div>
//         <div>City id: {cityId ?? "None"}</div>
//       </div>

//       <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
//         <button onClick={onContinue} style={{ padding: 10 }}>
//           Continue
//         </button>
//         <button onClick={onSignOut} style={{ padding: 10 }}>
//           Sign out
//         </button>
//       </div>
//     </main>
//   );
// }
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function MePage() {
  const router = useRouter();

  useEffect(() => {
    async function routeUser() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!profile?.role) {
        router.replace("/login");
        return;
      }

      if (profile.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/app");
      }
    }

    routeUser();
  }, [router]);

  return <main style={{ background: "#020617", minHeight: "100vh" }} />;
}
