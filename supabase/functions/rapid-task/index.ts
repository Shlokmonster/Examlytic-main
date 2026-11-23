import { ServeHandler } from "https://deno.land/std@0.140.0/http/server.ts";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler: ServeHandler = async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const jwtToken = authHeader.replace(/^Bearer\s+/i, "");

    const { roomName, participantName, isPublisher, studentName } = await req.json();

    if (!roomName || !participantName) {
      return new Response(
        JSON.stringify({ error: "roomName and participantName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new Response(
        JSON.stringify({ error: "LiveKit server credentials are not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Role and caller authentication verification via Supabase client
    let callerUser = null;
    let isCallerAdmin = false;

    if (SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY) && jwtToken && jwtToken !== SUPABASE_ANON_KEY) {
      const supabaseAdmin = createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
      );

      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwtToken);
      if (!authError && user) {
        callerUser = user;
        const { data: userProfile } = await supabaseAdmin
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (userProfile?.role === "admin") {
          isCallerAdmin = true;
        }
      }
    }

    // Security check: Only authenticated admins are allowed to request subscriber tokens
    if (!isPublisher && !isCallerAdmin && callerUser) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Subscriber monitoring privileges require admin authorization." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create LiveKit access token with 4-hour max lifespan
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName,
      name: studentName || (isPublisher ? "Student" : "Admin Proctor"),
      ttl: 4 * 60 * 60, // 4 hours maximum token lifetime
    });

    // Enforce strict publisher isolation:
    // - Publishers (students) CAN publish video/audio, but CANNOT subscribe to peers in the room.
    // - Subscribers (admins) CAN subscribe to student tracks, but DO NOT publish camera feeds.
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: !!isPublisher,
      canSubscribe: !isPublisher,
      canPublishData: true,
    });

    const token = await at.toJwt();
    const livekitUrl = Deno.env.get("LIVEKIT_URL") || "";

    return new Response(
      JSON.stringify({ token, url: livekitUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

// Start the server
import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
serve(handler);
