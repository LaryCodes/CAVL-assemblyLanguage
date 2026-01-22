"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Cpu, Eye, Zap, ArrowRight } from "lucide-react";

interface WelcomePopupProps {
  onClose?: () => void;
}

export default function WelcomePopup({ onClose }: WelcomePopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(true);

  useEffect(() => {
    // Check if user has seen welcome popup before
    const seen = localStorage.getItem("cavl-welcome-seen");
    if (!seen) {
      setHasSeenWelcome(false);
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("cavl-welcome-seen", "true");
    setTimeout(() => {
      onClose?.();
    }, 500);
  };

  if (hasSeenWelcome) return null;

  const features = [
    {
      icon: <Cpu className="w-6 h-6" />,
      title: "MIPS Execution",
      description: "Step-by-step assembly execution",
      color: "from-cyan-500 to-blue-500",
    },
    {
      icon: <Eye className="w-6 h-6" />,
      title: "Visual Lab",
      description: "Stunning visual explanations",
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Pipeline View",
      description: "5-stage pipeline visualization",
      color: "from-orange-500 to-red-500",
    },
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop"
        >
          {/* Animated background particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: Math.random() * window.innerWidth,
                  y: window.innerHeight + 50,
                  scale: Math.random() * 0.5 + 0.5,
                }}
                animate={{ 
                  y: -50,
                  x: Math.random() * window.innerWidth,
                }}
                transition={{
                  duration: Math.random() * 10 + 10,
                  repeat: Infinity,
                  delay: Math.random() * 5,
                }}
                className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 opacity-30"
              />
            ))}
          </div>

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50, rotateX: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -30 }}
            transition={{ 
              type: "spring", 
              damping: 20, 
              stiffness: 300,
              delay: 0.1 
            }}
            className="relative max-w-lg w-full modal-content rounded-2xl overflow-hidden"
            style={{ perspective: "1000px" }}
          >
            {/* Gradient border glow */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-50 blur-xl" />
            
            {/* Content container */}
            <div className="relative bg-slate-900/95 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center mb-8"
              >
                {/* Animated Logo */}
                <motion.div
                  animate={{ 
                    rotateY: [0, 10, -10, 0],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity,
                    repeatType: "reverse" 
                  }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 mb-6 shadow-2xl shadow-cyan-500/30"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>

                <motion.h1 
                  className="text-4xl font-bold mb-2 gradient-text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  Welcome to CAVL
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-400 text-lg"
                >
                  Computer Architecture Visual Lab
                </motion.p>
              </motion.div>

              {/* Feature Cards */}
              <motion.div 
                className="grid grid-cols-3 gap-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    className="relative group"
                  >
                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-20 transition-opacity blur-xl`} />
                    <div className="relative bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center hover:border-slate-600 transition-all">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} mb-3`}>
                        {feature.icon}
                      </div>
                      <h3 className="text-white font-semibold text-sm mb-1">{feature.title}</h3>
                      <p className="text-gray-500 text-xs">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* CTA Button */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDismiss}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white font-bold text-lg shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all flex items-center justify-center gap-3 group"
              >
                <span>Get Started</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>

              {/* Dismiss hint */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-center text-gray-500 text-sm mt-4"
              >
                Press Enter or click the button to continue
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
