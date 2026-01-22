"use client";

import { motion } from "framer-motion";
import { Code, Cpu, Binary, Eye, Zap, Layers, Terminal, ChevronRight } from "lucide-react";

export default function WelcomeScreen() {
  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden relative">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Orbs */}
        <motion.div
          animate={{
            y: [0, -30, 0],
            x: [0, 20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-10 w-64 h-64 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, 40, 0],
            x: [0, -30, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-20 right-10 w-80 h-80 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, -20, 0],
            x: [0, 15, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/3 w-72 h-72 bg-gradient-to-br from-violet-500/15 to-indigo-500/15 rounded-full blur-3xl"
        />

        {/* Floating Icons */}
        <FloatingIcon
          icon={<Binary className="w-8 h-8" />}
          delay={0}
          duration={15}
          startX="10%"
          startY="20%"
        />
        <FloatingIcon
          icon={<Code className="w-10 h-10" />}
          delay={2}
          duration={18}
          startX="80%"
          startY="30%"
        />
        <FloatingIcon
          icon={<Cpu className="w-9 h-9" />}
          delay={4}
          duration={20}
          startX="15%"
          startY="70%"
        />
        <FloatingIcon
          icon={<Terminal className="w-7 h-7" />}
          delay={1}
          duration={16}
          startX="85%"
          startY="60%"
        />
        <FloatingIcon
          icon={<Layers className="w-8 h-8" />}
          delay={3}
          duration={17}
          startX="50%"
          startY="15%"
        />
      </div>

      {/* Main Content */}
      <div className="relative min-h-full flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl"
        >
          {/* Logo Badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mb-8 flex justify-center"
          >
            <div className="relative">
              {/* Glow Effect */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl blur-2xl"
              />
              
              {/* Glass Badge */}
              <div
                className="relative p-6 rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, rgba(15, 23, 42, 0.7) 0%, rgba(30, 41, 59, 0.7) 100%)",
                  backdropFilter: "blur(20px)",
                  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(6, 182, 212, 0.3)",
                }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <Cpu className="w-16 h-16 text-cyan-400" />
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              CAVL
            </h1>
            <p className="text-lg md:text-xl text-gray-300 font-medium">
              Computer Architecture Visual Lab
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-400 mb-10 leading-relaxed max-w-2xl mx-auto"
          >
            Master MIPS assembly through interactive visualization. Write, decode, and execute code
            while exploring how processors work at the instruction level.
          </motion.p>

          {/* Feature Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
          >
            <FeatureCard
              icon={<Code className="w-6 h-6" />}
              title="Code Editor"
              description="Monaco-powered"
              color="from-blue-500 to-cyan-500"
              delay={0.6}
            />
            <FeatureCard
              icon={<Binary className="w-6 h-6" />}
              title="Decoder"
              description="Binary analysis"
              color="from-purple-500 to-pink-500"
              delay={0.7}
            />
            <FeatureCard
              icon={<Cpu className="w-6 h-6" />}
              title="Registers"
              description="32 MIPS regs"
              color="from-violet-500 to-indigo-500"
              delay={0.8}
            />
            <FeatureCard
              icon={<Eye className="w-6 h-6" />}
              title="Visual Lab"
              description="Interactive UI"
              color="from-pink-500 to-rose-500"
              delay={0.9}
            />
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="flex items-center gap-2 text-cyan-400">
              <Zap className="w-5 h-5" />
              <span className="text-sm font-medium">Click the menu to get started</span>
              <ChevronRight className="w-4 h-4 animate-pulse" />
            </div>

            {/* Stats */}
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  4
                </div>
                <div className="text-gray-500 text-xs">Tools</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  32
                </div>
                <div className="text-gray-500 text-xs">Registers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  ∞
                </div>
                <div className="text-gray-500 text-xs">Possibilities</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// Floating Icon Component
interface FloatingIconProps {
  icon: React.ReactNode;
  delay: number;
  duration: number;
  startX: string;
  startY: string;
}

function FloatingIcon({ icon, delay, duration, startX, startY }: FloatingIconProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0.2, 0.5, 0.2],
        y: [0, -100, 0],
        x: [0, 50, 0],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
      className="absolute text-cyan-400/30"
      style={{ left: startX, top: startY }}
    >
      {icon}
    </motion.div>
  );
}

// Feature Card Component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  delay: number;
}

function FeatureCard({ icon, title, description, color, delay }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="relative group cursor-pointer"
    >
      {/* Glow on Hover */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-br ${color} rounded-xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300`}
      />
      
      {/* Glass Card */}
      <div
        className="relative p-5 rounded-xl transition-all duration-300"
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.6) 100%)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Icon */}
        <div className={`mb-3 flex justify-center text-transparent bg-gradient-to-br ${color} bg-clip-text`}>
          <div className="p-2 rounded-lg bg-white/5">
            {icon}
          </div>
        </div>
        
        {/* Text */}
        <div className="text-center">
          <div className="text-sm font-semibold text-white mb-1">{title}</div>
          <div className="text-xs text-gray-400">{description}</div>
        </div>
      </div>
    </motion.div>
  );
}
