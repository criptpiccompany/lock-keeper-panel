import type { DroppableProvided } from "@hello-pangea/dnd";
import type { ReactNode } from "react";

interface KanbanColumnProps {
  title: string;
  color: string;
  count: number;
  provided: DroppableProvided;
  isDraggingOver: boolean;
  children: ReactNode;
}

export function KanbanColumn({
  title,
  color,
  count,
  provided,
  isDraggingOver,
  children,
}: KanbanColumnProps) {
  return (
    <div
      className="flex w-[280px] shrink-0 flex-col rounded-xl border bg-card"
      style={{ minHeight: 200 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="text-sm font-medium text-foreground truncate">
          {title}
        </h3>
        <span className="ml-auto shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>

      {/* Cards area */}
      <div
        ref={provided.innerRef}
        {...provided.droppableProps}
        className={`flex-1 space-y-2 p-2 transition-colors ${
          isDraggingOver ? "bg-accent/40" : ""
        }`}
        style={{ minHeight: 100 }}
      >
        {children}
        {provided.placeholder}
      </div>
    </div>
  );
}
