import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, FileJson } from 'lucide-react';
import { shareFile } from '../../lib/geoExport';

export default function MapShareDialog({ open, onClose, blob, filename, title, icon }) {
  const [status, setStatus] = useState('idle');
  const Icon = icon || FileJson;

  const handleShare = async () => {
    setStatus('sharing');
    const result = await shareFile(blob, filename, title, `PlotScale plot data — ${filename}`);
    setStatus('idle');
    if (result !== 'cancelled') onClose();
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && blob && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-900">{title}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{filename}</p>
                <p className="text-xs text-slate-500">{(blob.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleShare}
                disabled={status === 'sharing'}
                className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-60 transition-all shadow-lg shadow-blue-600/20"
              >
                {status === 'sharing'
                  ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <><Share2 className="w-4 h-4" /> Share via WhatsApp / Telegram / Email</>
                }
              </button>
              <button
                onClick={handleDownload}
                className="w-full py-3.5 bg-slate-100 text-slate-800 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
              >
                <Download className="w-4 h-4" /> Download File
              </button>
            </div>
            <p className="text-xs text-center text-slate-500 mt-3">
              Share opens your phone's share sheet to pick WhatsApp, Telegram, Facebook, Email, etc.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
