"use client";

import type { SlideRow, ViewerSettings } from "@nagori/core";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { moveSlideAction } from "@/app/actions";
import { SlideCard } from "./slide-card";

/**
 * The library is the running order, so it is reorderable in place. dnd-kit
 * rather than native HTML5 drag-and-drop, which does not work on touch at all —
 * and this dashboard is used from a phone.
 */
export function SortableLibrary({
  slides,
  settings,
  canReorder,
}: {
  slides: SlideRow[];
  settings: ViewerSettings;
  canReorder: boolean;
}) {
  const [order, setOrder] = useState(slides);

  // The server is the source of truth once it has revalidated; this also picks
  // up slides added or archived elsewhere.
  useEffect(() => setOrder(slides), [slides]);

  const sensors = useSensors(
    // A small distance so a tap on the card still opens the editor.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = order.findIndex((slide) => slide.id === active.id);
    const to = order.findIndex((slide) => slide.id === over.id);
    if (from === -1 || to === -1) return;
    // Move first, then persist: the drag already showed the result, and undoing
    // it for the round trip would be the surprising part.
    setOrder(arrayMove(order, from, to));
    void moveSlideAction(String(active.id), to);
  }

  if (!canReorder) {
    return (
      <div className="memory-grid">
        {order.map((slide, index) => (
          <SlideCard
            key={slide.id}
            index={index + 1}
            settings={settings}
            slide={slide}
            total={order.length}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      sensors={sensors}
    >
      <SortableContext
        items={order.map((slide) => slide.id)}
        strategy={rectSortingStrategy}
      >
        <div className="memory-grid">
          {order.map((slide, index) => (
            <SortableCard
              key={slide.id}
              index={index + 1}
              settings={settings}
              slide={slide}
              total={order.length}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCard({
  slide,
  settings,
  index,
  total,
}: {
  slide: SlideRow;
  settings: ViewerSettings;
  index: number;
  total: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });
  return (
    <SlideCard
      dragHandle={{ ...attributes, ...listeners }}
      dragging={isDragging}
      index={index}
      ref={setNodeRef}
      settings={settings}
      slide={slide}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      total={total}
    />
  );
}
