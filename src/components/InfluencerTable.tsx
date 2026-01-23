import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "./StatusBadge";
import { CountdownChip } from "./CountdownChip";
import { BotaoRegistrarFechamento } from "./BotaoRegistrarFechamento";
import { InfluencerDetailDrawer } from "./InfluencerDetailDrawer";
import { InfluencerWithStatus } from "@/types";
import { formatDate, formatDateTime } from "@/lib/helpers";
import { cn } from "@/lib/utils";

interface InfluencerTableProps {
  influencers: InfluencerWithStatus[];
  columns: ("handle" | "owner" | "lastClosed" | "lockedUntil" | "countdown" | "status" | "action")[];
  showRowHover?: boolean;
  airportStyle?: boolean;
  emptyMessage?: string;
}

export function InfluencerTable({
  influencers,
  columns,
  showRowHover = true,
  airportStyle = false,
  emptyMessage = "Nenhum influenciador encontrado",
}: InfluencerTableProps) {
  const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerWithStatus | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleRowClick = (influencer: InfluencerWithStatus) => {
    setSelectedInfluencer(influencer);
    setDrawerOpen(true);
  };

  if (influencers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="text-4xl mb-4">📭</div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const columnHeaders: Record<string, string> = {
    handle: "Influenciador",
    owner: "Dono",
    lastClosed: "Último Fechamento",
    lockedUntil: "Libera em",
    countdown: "Tempo Restante",
    status: "Status",
    action: "Ação",
  };

  return (
    <>
      <div className={cn(airportStyle && "airport-board relative")}>
        {airportStyle && <div className="scanlines" />}
        <Table>
          <TableHeader>
            <TableRow className={cn(airportStyle && "border-b-2 border-primary/30")}>
              {columns.map((col) => (
                <TableHead
                  key={col}
                  className={cn(
                    airportStyle && "font-mono uppercase text-primary/80 tracking-wider text-xs"
                  )}
                >
                  {columnHeaders[col]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {influencers.map((influencer, index) => (
              <TableRow
                key={influencer.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  showRowHover && "hover:bg-muted/50",
                  airportStyle && (index % 2 === 0 ? "bg-board-row" : "bg-board-row-alt"),
                  influencer.daysRemaining !== null && influencer.daysRemaining <= 2 && influencer.status === "TRAVADO" && "bg-warning/5"
                )}
                onClick={() => handleRowClick(influencer)}
              >
                {columns.includes("handle") && (
                  <TableCell
                    className={cn(
                      "handle-text font-semibold",
                      airportStyle && "text-board-text"
                    )}
                  >
                    {influencer.handle}
                  </TableCell>
                )}
                {columns.includes("owner") && (
                  <TableCell className="text-muted-foreground">
                    {influencer.ownerNome || "—"}
                  </TableCell>
                )}
                {columns.includes("lastClosed") && (
                  <TableCell className={cn(airportStyle && "font-mono text-sm")}>
                    {formatDateTime(influencer.lastClosedAt)}
                  </TableCell>
                )}
                {columns.includes("lockedUntil") && (
                  <TableCell className={cn(airportStyle && "font-mono text-sm")}>
                    {influencer.lockedUntil
                      ? formatDate(influencer.lockedUntil.toISOString())
                      : "—"}
                  </TableCell>
                )}
                {columns.includes("countdown") && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <CountdownChip lockedUntil={influencer.lockedUntil} />
                  </TableCell>
                )}
                {columns.includes("status") && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <StatusBadge status={influencer.status} />
                  </TableCell>
                )}
                {columns.includes("action") && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <BotaoRegistrarFechamento
                      influencer={influencer}
                      variant="small"
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InfluencerDetailDrawer
        influencer={selectedInfluencer}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}
