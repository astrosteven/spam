import { createClient } from "@supabase/supabase-js";

// Supabase project backing the spurious-source flag queue — the SAME project the
// UNICORN site uses, so SPAM flags land in the same triage queue. The anon key is
// PUBLIC by design — Row-Level Security on `public.flags` restricts anonymous users to
// INSERT only (they can file a flag but can't read or change the queue). Reading/
// triaging the queue requires an authenticated login (UNICORN's /data/review page;
// SPAM ships no review page).
const SUPABASE_URL = "https://nutjfdfklbetjzbtulbv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dGpmZGZrbGJldGp6YnR1bGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MDI0MDgsImV4cCI6MjEwNDQ3ODQwOH0.8y7qGdGnwdFhG559LoUCApykeLaf82FC2kQeWUUT-YQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type FlagStatus = "pending" | "confirmed" | "dismissed" | "applied";
export type Flag = {
  id: string;
  field: string;
  obj_id: number;
  ra: number | null;
  dec: number | null;
  reason: string | null;
  status: FlagStatus;
  created_at: string;
  reviewed_at: string | null;
};
