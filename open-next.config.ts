import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// The web app is stateless (all room state lives in the realtime worker's
// Durable Objects), so the default in-memory incremental cache is sufficient.
export default defineCloudflareConfig();
