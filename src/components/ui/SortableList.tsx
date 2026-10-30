import { useEffect, useRef, useState, type ReactNode } from "react";

/** つかむところ(≡)。押した瞬間からつかめるよう、ここだけスクロールさせない */
export type DragHandle = {
    onPointerDown: (e: React.PointerEvent) => void;
    style: React.CSSProperties;
};

type Drag = {
    id: string;
    from: number;
    over: number;
    dy: number;
    startY: number;
    startScroll: number;
    heights: number[];
    tops: number[];
};

const GAP = 8;
const EDGE = 72;

/** いちばん近い、スクロールする親(無ければページ) */
function scrollParent(el: HTMLElement | null): HTMLElement {
    for (let p = el?.parentElement; p; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
    }
    return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/**
 * 上下に動かして並べ替えられる一覧。canDrag が true のものだけ動かせ、動かせるものは先頭にまとまっている前提
 * (完了したものは下に回るため)。並べ終えたら、動かせるものの新しい順を onReorder に渡す
 */
export default function SortableList<T>({
    items, getId, canDrag, onReorder, renderItem,
}: {
    items: T[];
    getId: (item: T) => string;
    canDrag: (item: T) => boolean;
    onReorder: (ids: string[]) => void;
    renderItem: (item: T, handle: DragHandle | null, dragging: boolean) => ReactNode;
}) {
    const listRef = useRef<HTMLUListElement>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const dragRef = useRef<Drag | null>(null);
    const lastY = useRef(0);
    const raf = useRef(0);
    const scroller = useRef<HTMLElement | null>(null);

    const movable = items.filter(canDrag).length;

    const update = (next: Drag | null) => {
        dragRef.current = next;
        setDrag(next);
    };

    // つかんでいる間は、ページがスクロールしないようにする(iOS は touchmove を止めないと動いてしまう)
    useEffect(() => {
        if (!drag) return;
        const stop = (e: TouchEvent) => e.preventDefault();
        document.addEventListener("touchmove", stop, { passive: false });
        return () => document.removeEventListener("touchmove", stop);
    }, [!!drag]);

    const overIndexOf = (d: Drag, dy: number) => {
        // つかんだ行の真ん中より上に、真ん中がある行の数 = 入る位置
        const center = d.tops[d.from] + d.heights[d.from] / 2 + dy;
        let over = 0;
        for (let i = 0; i < movable; i++) {
            if (i !== d.from && d.tops[i] + d.heights[i] / 2 < center) over++;
        }
        return over;
    };

    const move = (clientY: number) => {
        const d = dragRef.current;
        if (!d) return;
        lastY.current = clientY;
        const scroll = scroller.current?.scrollTop ?? 0;
        const dy = clientY - d.startY + (scroll - d.startScroll);
        update({ ...d, dy, over: overIndexOf(d, dy) });
    };

    // 画面の上端・下端に近づいたら、自動でスクロールする
    const autoScroll = () => {
        const d = dragRef.current;
        const el = scroller.current;
        if (!d || !el) return;
        const y = lastY.current;
        const top = el === document.scrollingElement ? 0 : el.getBoundingClientRect().top;
        const bottom = el === document.scrollingElement ? window.innerHeight : el.getBoundingClientRect().bottom;
        const speed = y < top + EDGE ? -Math.ceil((top + EDGE - y) / 6) : y > bottom - EDGE ? Math.ceil((y - (bottom - EDGE)) / 6) : 0;
        if (speed !== 0) {
            el.scrollTop += speed;
            move(y);
        }
        raf.current = requestAnimationFrame(autoScroll);
    };

    const start = (id: string, index: number) => (e: React.PointerEvent) => {
        if (!listRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        const rows = Array.from(listRef.current.children) as HTMLElement[];
        const rects = rows.map((r) => r.getBoundingClientRect());
        scroller.current = scrollParent(listRef.current);
        lastY.current = e.clientY;
        update({
            id, from: index, over: index, dy: 0, startY: e.clientY, startScroll: scroller.current.scrollTop,
            heights: rects.map((r) => r.height), tops: rects.map((r) => r.top),
        });
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(autoScroll);
    };

    const finish = () => {
        cancelAnimationFrame(raf.current);
        const d = dragRef.current;
        update(null);
        if (!d || d.over === d.from) return;
        const ids = items.slice(0, movable).map(getId);
        const [moved] = ids.splice(d.from, 1);
        ids.splice(d.over, 0, moved);
        onReorder(ids);
    };

    useEffect(() => () => cancelAnimationFrame(raf.current), []);

    const shiftOf = (i: number): number => {
        if (!drag || i === drag.from) return 0;
        const h = drag.heights[drag.from] + GAP;
        if (drag.from < drag.over && i > drag.from && i <= drag.over) return -h;
        if (drag.over < drag.from && i >= drag.over && i < drag.from) return h;
        return 0;
    };

    return (
        <ul ref={listRef} style={{ listStyle: "none", paddingLeft: 0, margin: 0, display: "grid", gap: GAP }}>
            {items.map((item, i) => {
                const id = getId(item);
                const dragging = drag?.id === id;
                const handle: DragHandle | null = canDrag(item) && movable > 1 ? {
                    onPointerDown: start(id, i),
                    style: { touchAction: "none", cursor: dragging ? "grabbing" : "grab" },
                } : null;
                return (
                    <li
                        key={id}
                        onPointerMove={dragging ? (e) => move(e.clientY) : undefined}
                        onPointerUp={dragging ? finish : undefined}
                        onPointerCancel={dragging ? finish : undefined}
                        style={{
                            position: "relative",
                            zIndex: dragging ? 5 : 0,
                            transform: dragging ? `translateY(${drag!.dy}px) scale(1.02)` : `translateY(${shiftOf(i)}px)`,
                            transition: dragging ? "none" : drag ? "transform 0.2s ease" : "none",
                            filter: dragging ? "drop-shadow(0 10px 18px rgba(15,23,42,0.22))" : "none",
                        }}
                    >
                        {renderItem(item, handle, dragging)}
                    </li>
                );
            })}
        </ul>
    );
}
