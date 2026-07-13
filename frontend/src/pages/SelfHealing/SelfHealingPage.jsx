import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Check, X, ArrowRight, Loader } from 'lucide-react';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { useData } from '../../contexts/DataContext';

export default function SelfHealing() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { triggerToast } = useToast();
  const { activeProject } = useData();

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.request('/api/v1/healing?status=PENDING');
      // Filter by active project if available
      const filtered = activeProject
        ? res.filter(e => e.executionLog?.suite?.projectId === activeProject.id)
        : res;
      setEvents(filtered);
    } catch (err) {
      console.error(err);
      triggerToast('Failed to fetch healing events', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [activeProject]);

  const handleApprove = async (id) => {
    try {
      await api.request(`/api/v1/healing/${id}/approve`, { method: 'POST' });
      triggerToast('Healing event approved and test case updated', 'success');
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      console.error(err);
      triggerToast('Failed to approve healing event', 'error');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.request(`/api/v1/healing/${id}/reject`, { method: 'POST' });
      triggerToast('Healing event rejected', 'success');
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      console.error(err);
      triggerToast('Failed to reject healing event', 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-emerald-500">
              Autonomous Self-Healing
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Review AI-generated selector patches for broken tests and apply them permanently.
            </p>
          </div>
          <ShieldAlert className="w-12 h-12 text-emerald-500 opacity-20" />
        </header>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-teal-500" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-24 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <ShieldAlert className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No Pending Healing Events</h3>
            <p className="text-gray-500 dark:text-gray-500 mt-2">All tests are running smoothly without AI intervention.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {events.map(event => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Test Case: {event.testName || 'Unknown Test'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Step #{event.stepIndex || '?'} • Executed at {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(event.id)}
                      className="px-4 py-2 flex items-center gap-2 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-colors font-medium text-sm"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button
                      onClick={() => handleApprove(event.id)}
                      className="px-4 py-2 flex items-center gap-2 rounded-xl text-white bg-emerald-500 hover:bg-emerald-600 transition-colors font-medium text-sm shadow-sm shadow-emerald-500/20"
                    >
                      <Check className="w-4 h-4" /> Approve Fix
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr,auto,1fr] gap-6 items-center bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="space-y-2">
                    <span className="text-xs font-bold tracking-wider text-red-500 uppercase">Broken Selector</span>
                    <div className="font-mono text-sm bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 p-3 rounded-lg border border-red-100 dark:border-red-900/30 break-all">
                      {event.originalSelector || 'N/A'}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <span className="text-[10px] font-bold uppercase mb-1">AI Healed</span>
                    <ArrowRight className="w-5 h-5 text-emerald-500" />
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold tracking-wider text-emerald-500 uppercase">New Selector</span>
                    <div className="font-mono text-sm bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30 break-all">
                      {event.healedSelector}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
