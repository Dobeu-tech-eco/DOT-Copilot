import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createProvisionHandler } from "./handler.ts"

Deno.serve(createProvisionHandler())
