import { supabase } from "@/lib/supabase";

export type Joke = {
  id: string;
  photo_url: string;
  funny_question: string;
  funny_answer: string;
  created_at: string;
};

export async function getJokes() {
  return supabase
    .from("jokes")
    .select("id, photo_url, funny_question, funny_answer, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .returns<Joke[]>();
}
