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
      className="flex w-[220px] sm:w-[230px] xl:w-auto shrink-0 flex-col rounded-[24px] border border-black/[0.03] bg-[linear-gradient(180deg,#ffffff_0%,#fafaf8_100%)] shadow-[0_18px_44px_-38px_rgba(15,23,42,0.12)]"
      style={{ minHeight: 220 }}
    >
      <div className="flex items-center gap-2 border-b border-black/[0.04] px-4 py-3.5">
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <h3 className="truncate text-[13px] font-medium text-[#1f1f1f]">
          {title}
        </h3>
        <span
          className="ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          {count}
        </span>
      </div>

      <div
        ref={provided.innerRef}
        {...provided.droppableProps}
        className={`flex-1 space-y-3 p-3 transition-colors ${
          isDraggingOver ? "bg-black/[0.015]" : ""
        }`}
        style={{ minHeight: 100 }}
      >
        {children}
        {provided.placeholder}
      </div>
    </div>
  );
}
