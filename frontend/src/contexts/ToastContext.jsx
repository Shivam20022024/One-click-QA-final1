import React, { createContext, useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle } from "lucide-react";

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};

export const ToastProvider = ({ children }) => {
  const [errorToast, setErrorToast] = useState("");
  const [successToast, setSuccessToast] = useState("");

  const triggerToast = (msg, isError = false) => {
    if (isError) {
      setErrorToast(msg);
      setTimeout(() => setErrorToast(""), 5000);
    } else {
      setSuccessToast(msg);
      setTimeout(() => setSuccessToast(""), 5000);
    }
  };

  return (
    <ToastContext.Provider value={{ triggerToast }}>
      {children}
      <AnimatePresence>
        {(errorToast || successToast) && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border text-sm font-medium ${
              errorToast
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            }`}
          >
            {errorToast ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{errorToast || successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};
