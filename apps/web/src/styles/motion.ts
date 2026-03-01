/**
 * [P10] Framer Motion Presets
 * Standards for fluid motion across the platform.
 */

export const motionPresets = {
  // Page entry: Subtle fade + lift
  pageEnter: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.25, 1, 0.5, 1] },
  },

  // List Stagger: Cascade entry for grid/list items
  listStagger: {
    container: {
      animate: { transition: { staggerChildren: 0.05 } },
    },
    item: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4, ease: 'easeOut' },
    },
  },

  // Dialog/Modal: Pop + Spring
  dialog: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { type: 'spring', damping: 25, stiffness: 300 },
  },

  // Toast: Slide in from side
  toast: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3 },
  },

  // MicroHover: Subtle scale for buttons/cards
  microHover: {
    whileHover: { scale: 1.02, y: -2 },
    whileTap: { scale: 0.98 },
  },
};
