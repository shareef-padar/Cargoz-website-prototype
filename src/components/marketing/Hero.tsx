import { motion } from "framer-motion";
import { fadeUp, stagger } from "../../lib/motion";

export default function Hero() {
  return (
    <section className="bg-white pt-32 pb-20">
      <div className="max-w-[1280px] mx-auto px-20 grid grid-cols-2 gap-16 items-center">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-6"
        >
          <motion.span
            variants={fadeUp}
            className="text-xs font-bold uppercase tracking-widest text-secondary-500"
          >
            Marketplace · Month-to-month · UAE
          </motion.span>
          <motion.h1
            variants={fadeUp}
            className="text-7xl font-bold text-text-900 leading-[1.1] tracking-tight"
          >
            Warehouse space, unbundled.
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="text-lg text-text-700 max-w-[520px] leading-relaxed"
          >
            Browse live inventory from JAFZA to Ajman. Pay per month, switch on a month's notice,
            see the rate card before you enquire.
          </motion.p>
          <motion.div variants={fadeUp} className="flex gap-3 mt-2">
            <a
              href="/warehouses"
              className="h-12 px-6 inline-flex items-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-white rounded-xl font-semibold"
            >
              See All Warehouses
            </a>
            <a
              href="#get-matched"
              className="h-12 px-6 inline-flex items-center gap-2 bg-white border border-text-100 text-text-900 rounded-xl font-semibold hover:border-secondary-500"
            >
              Get matched
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-card-hover"
        >
          <img
            src="https://www.figma.com/api/mcp/asset/9b070da4-626c-4b11-abf0-f31d22a1f5e6"
            alt="Warehouse interior"
            className="w-full h-full object-cover"
          />
        </motion.div>
      </div>
    </section>
  );
}
