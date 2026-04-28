"use client";

import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";

export function CustomCursor() {
  const [active, setActive] = useState(false);
  
  const mouseX = useSpring(0, { damping: 30, stiffness: 300 });
  const mouseY = useSpring(0, { damping: 30, stiffness: 300 });

  useEffect(() => {
    document.body.classList.add("has-custom-cursor");
    
    const moveMouse = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const handleActive = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isClickable = target.closest("button, a, [role='button'], input, select, textarea");
      setActive(!!isClickable);
    };

    window.addEventListener("mousemove", moveMouse);
    window.addEventListener("mouseover", handleActive);

    return () => {
      document.body.classList.remove("has-custom-cursor");
      window.removeEventListener("mousemove", moveMouse);
      window.removeEventListener("mouseover", handleActive);
    };
  }, [mouseX, mouseY]);

  return (
    <>
      {/* Outer Ring */}
      <motion.div
        className="fixed top-0 left-0 w-10 h-10 rounded-full border border-primary/20 pointer-events-none z-[9999] hidden lg:block"
        style={{
          x: mouseX,
          y: mouseY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          scale: active ? 1.5 : 1,
          backgroundColor: active ? "rgba(192, 193, 255, 0.05)" : "transparent",
          borderColor: active ? "rgba(192, 193, 255, 0.4)" : "rgba(192, 193, 255, 0.2)",
        }}
      />
      {/* Inner Dot */}
      <motion.div
        className="fixed top-0 left-0 w-1.5 h-1.5 rounded-full bg-primary pointer-events-none z-[9999] hidden lg:block"
        style={{
          x: mouseX,
          y: mouseY,
          translateX: "-50%",
          translateY: "-50%",
        }}
      />
    </>
  );
}
