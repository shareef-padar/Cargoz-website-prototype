import { motion } from "framer-motion";

export default function HelloIsland() {
  return (
    <motion.h1
      className="text-5xl text-secondary-500"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      React island works
    </motion.h1>
  );
}
