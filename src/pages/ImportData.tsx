import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function ImportData() {
  const [status, setStatus] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const importTable = async (table: string, file: File) => {
    const csv = await file.text();
    setStatus(prev => [...prev, `Importing ${table} (${csv.split('\n').length - 1} rows)...`]);
    
    const { data, error } = await supabase.functions.invoke('import-data', {
      body: { table, csv },
    });
    
    const result = error ? { error: error.message } : data;
    setStatus(prev => [...prev, `${table}: ${JSON.stringify(result)}`]);
    return result;
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.csv';
    
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;
      
      setLoading(true);
      setStatus([]);

      // Sort files: profiles first, then user_roles, influencers, close_events
      const order = ['profiles', 'user_roles', 'influencers', 'close_events'];
      const sortedFiles = files.sort((a, b) => {
        const aIdx = order.findIndex(t => a.name.includes(t));
        const bIdx = order.findIndex(t => b.name.includes(t));
        return aIdx - bIdx;
      });

      for (const file of sortedFiles) {
        const table = order.find(t => file.name.includes(t));
        if (table) {
          await importTable(table, file);
        } else {
          setStatus(prev => [...prev, `Skipping ${file.name} - unknown table`]);
        }
      }
      
      setLoading(false);
      setStatus(prev => [...prev, '✅ Import complete!']);
    };
    
    input.click();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-6">
        <h1 className="text-2xl font-bold">Importar Dados</h1>
        <p className="text-muted-foreground">
          Selecione os 4 arquivos CSV exportados (profiles, user_roles, influencers, close_events).
          <br />
          <strong>Requer login como ADMIN.</strong>
        </p>
        
        <Button onClick={handleImport} disabled={loading} size="lg">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Selecionar CSVs e Importar
        </Button>

        {status.length > 0 && (
          <div className="bg-muted rounded-lg p-4 space-y-1 text-sm font-mono max-h-96 overflow-auto">
            {status.map((s, i) => (
              <div key={i}>{s}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
