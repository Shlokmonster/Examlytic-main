import { ServeHandler } from "https://deno.land/std@0.140.0/http/server.ts";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.0.0";

const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");

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

    // Create access token
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName,
      name: studentName || "Student",
    });

    // Set permissions
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: !!isPublisher,
      canSubscribe: true,
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
