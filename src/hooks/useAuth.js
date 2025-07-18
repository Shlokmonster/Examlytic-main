 import supabase from "../SupabaseClient";
 import { useEffect } from "react";
 import { useState } from "react";

export function useAuth() {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    useEffect(()=>{
        const getUser = async () => {
            const { data } = await supabase.auth.getUser()
            setUser(data?.user)
            setLoading(false)
    }

    getUser()

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  return { user, loading }

}

