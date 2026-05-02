"use client";

import { useEffect, useRef } from "react";
import { useSpring, useMotionValue, motion } from "framer-motion";

/**
 * Tiny indigo dot that trails the actual cursor position.
 * - Uses width/height fixed at 12px — no size transitions, no gradient strings.
 * - pointer-events: none so it never blocks clicks.
 * - Only mounts on desktop (lg: hidden on mobile via the className).
 * - Does NOT use cursor:none — the CSS pen cursor in globals.css handles the shape.
 */
export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { damping: 30, stiffness: 300 });
  const springY = useSpring(y, { damping: 30, stiffness: 300 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      ref={cursorRef}
      className="fixed pointer-events-none z-[9999] hidden lg:block"
      style={{
        x: springX,
        y: springY,
        translateX: "-50%",
        translateY: "-50%",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "rgba(129, 140, 248, 0.5)",
        boxShadow: "0 0 8px 2px rgba(129, 140, 248, 0.3)",
      }}
    />
  );
}
