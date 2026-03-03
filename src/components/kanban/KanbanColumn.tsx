import type { DroppableProvided } from "@hello-pangea/dnd";
import type { ReactNode } from "react";

interface KanbanColumnProps {
  title: string;
  bg: string;
  accent: string;
  count: number;
  provided: DroppableProvided;
  isDraggingOver: boolean;
  children: ReactNode;
}

export function KanbanColumn({
  title,
  bg,
  accent,
  count,
  provided,
  isDraggingOver,
  children,
}: KanbanColumnProps) {
  return (
    <div
      className="flex w-[260px] sm:w-[280px] shrink-0 flex-col rounded-xl border"
      style={{ backgroundColor: bg, minHeight: 200 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2.5">
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: accent }}
        />
        <h3 className="text-sm font-medium truncate" style={{ color: accent }}>
          {title}
        </h3>
        <span
          className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          {count}
        </span>
      </div>

      {/* Cards area */}
      <div
        ref={provided.innerRef}
        {...provided.droppableProps}
        className={`flex-1 space-y-2 p-2 transition-colors ${
          isDraggingOver ? "opacity-80" : ""
        }`}
        style={{ minHeight: 100 }}
      >
        {children}
        {provided.placeholder}
      </div>
    </div>
  );
}
