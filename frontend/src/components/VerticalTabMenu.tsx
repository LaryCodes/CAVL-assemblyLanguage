"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code, Cpu, Binary, Eye, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { useRouter } from "next/navigation";

export type TabId = "welcome" | "editor" | "registers" | "decoder" | "pipeline" | "visual";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  action?: "navigate" | "switch";
}

const TABS: Tab[] = [
  {
    id: "editor",
    label: "Code Editor",
    icon: <Code className="w-5 h-5" />,
    action: "switch",
  },
  {
    id: "registers",
    label: "Registers",
    icon: <Cpu className="w-5 h-5" />,
    action: "switch",
  },
  {
    id: "decoder",
    label: "Decoder",
    icon: <Binary className="w-5 h-5" />,
    action: "switch",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    icon: <Activity className="w-5 h-5" />,
    action: "switch",
  },
  {
    id: "visual",
    label: "Visual Lab",
    icon: <Eye className="w-5 h-5" />,
    action: "navigate",
  },
];

interface VerticalTabMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: TabId;
  onTabSelect: (tabId: TabId) => void;
}

export default function VerticalTabMenu({
  isOpen,
  onToggle,
  activeTab,
  onTabSelect,
}: VerticalTabMenuProps) {
  const router = useRouter();

  // Handle ESC key to close menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onToggle();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onToggle]);

  const handleTabClick = (tab: Tab) => {
    if (tab.action === "navigate" && tab.id === "visual") {
      router.push("/visual");
    } else {
      onTabSelect(tab.id);
    }
  };

  return (
    <>
      {/* Toggle Button - Always Visible */}
      <motion.button
        onClick={onToggle}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-50 glass-strong rounded-2xl p-3 border border-cyan-500/30 hover:border-cyan-500/60 transition-all shadow-xl hover:shadow-cyan-500/20"
        whileHover={{ scale: 1.05, x: -5 }}
        whileTap={{ scale: 0.95 }}
        title={isOpen ? "Close menu" : "Open menu"}
      >
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {isOpen ? (
            <ChevronRight className="w-6 h-6 text-cyan-400" />
          ) : (
            <ChevronLeft className="w-6 h-6 text-cyan-400" />
          )}
        </motion.div>
      </motion.button>

      {/* Menu Panel - Slides In/Out */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-80 z-50 flex items-center justify-center p-4"
            >
              <div className="relative w-full h-full max-h-[600px]">
                {/* Glassmorphism Container with 3D Effect */}
                <motion.div
                  initial={{ rotateY: -15, scale: 0.9 }}
                  animate={{ rotateY: 0, scale: 1 }}
                  exit={{ rotateY: -15, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                  className="relative h-full"
                  style={{ perspective: "1000px" }}
                >
                  <div
                    className="h-full rounded-3xl overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)",
                      backdropFilter: "blur(20px)",
                      boxShadow:
                        "0 8px 32px 0 rgba(6, 182, 212, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(6, 182, 212, 0.3)",
                    }}
                  >
                    {/* Header */}
                    <div className="p-6 border-b border-cyan-500/20">
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                        Navigation
                      </h2>
                      <p className="text-sm text-gray-400 mt-1">
                        Select a view
                      </p>
                    </div>

                    {/* Tab Buttons */}
                    <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100%-120px)]">
                      {TABS.map((tab, index) => (
                        <motion.button
                          key={tab.id}
                          onClick={() => handleTabClick(tab)}
                          initial={{ opacity: 0, x: 50 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.02, x: -5 }}
                          whileTap={{ scale: 0.98 }}
                          className={`
                            w-full p-4 rounded-xl flex items-center gap-4 transition-all
                            ${
                              activeTab === tab.id
                                ? "bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border-2 border-cyan-400/50 shadow-lg shadow-cyan-500/20"
                                : "bg-white/5 border-2 border-white/10 hover:border-cyan-400/30 hover:bg-white/10"
                            }
                          `}
                        >
                          <div
                            className={`
                            p-2 rounded-lg
                            ${
                              activeTab === tab.id
                                ? "bg-cyan-500/20 text-cyan-300"
                                : "bg-white/10 text-gray-400"
                            }
                          `}
                          >
                            {tab.icon}
                          </div>
                          <div className="flex-1 text-left">
                            <div
                              className={`
                              font-semibold
                              ${
                                activeTab === tab.id
                                  ? "text-white"
                                  : "text-gray-300"
                              }
                            `}
                            >
                              {tab.label}
                            </div>
                          </div>
                          {activeTab === tab.id && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="w-2 h-2 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50"
                            />
                          )}
                        </motion.button>
                      ))}
                    </div>

                    {/* Footer Hint */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-cyan-500/20 bg-black/20">
                      <p className="text-xs text-center text-gray-400">
                        Click outside or press ESC to close
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
