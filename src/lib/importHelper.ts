// Temporary script to send CSV data to the import edge function
// This file will be deleted after import

import { supabase } from "@/integrations/supabase/client";

export async function importCSVData(table: string, csvContent: string) {
  const { data, error } = await supabase.functions.invoke('import-data', {
    body: { table, csv: csvContent }
  });
  
  console.log(`Import ${table}:`, data, error);
  return { data, error };
}
