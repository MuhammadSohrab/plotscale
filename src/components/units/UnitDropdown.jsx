import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getUnitCategory, UNIT_CATEGORY_ORDER } from '../../lib/unitConversion';

export default function UnitDropdown({
  units = [], value, onChange,
  open, onOpenChange,
  label, placeholder = 'Search unit...',
  buttonClassName, renderButton,
  width = 'w-64', maxHeight = 'max-h-56',
}) {
  const [search, setSearch] = useState('');
  const [internalOpen, setInternalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const buttonRef = useRef(null);
  const isOpen = open !== undefined ? open : internalOpen;
  const setOpen = (v) => { if (open !== undefined) onOpenChange?.(v); else setInternalOpen(v); };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return units;
    const q = search.toLowerCase();
    return units.filter(u =>
      u.unit_name?.toLowerCase().includes(q) ||
      u.label?.toLowerCase().includes(q) ||
      u.unit_symbol?.toLowerCase().includes(q) ||
      u.country_code?.toLowerCase().includes(q) ||
      u.admin1?.toLowerCase().includes(q) ||
      u.aliases?.toLowerCase().includes(q)
    );
  }, [units, search]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(u => {
      const cat = getUnitCategory(u);
      if (!g[cat]) g[cat] = [];
      g[cat].push(u);
    });
    return g;
  }, [filtered]);

  const selected = units.find(u => (u.unit_id || u.id) === value);

  const handleClose = () => { setOpen(false); setSearch(''); };

  const listContent = (
    <div className={`${maxHeight} overflow-y-auto`}>
      {UNIT_CATEGORY_ORDER.filter(cat => grouped[cat]).map(cat => (
        <div key={cat}>
          <div className="px-3 py-1.5 bg-slate-100 sticky top-0">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{cat}</p>
          </div>
          {grouped[cat].map(u => {
            const key = u.unit_id || u.id;
            const isSelected = key === value;
            return (
              <button
                key={key}
                onClick={() => { onChange(u); handleClose(); }}
                className={`w-full text-left px-4 py-2.5 hover:bg-slate-100 transition-colors ${isSelected ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-800'}`}
              >
                <p className="text-sm font-semibold">{u.unit_name || u.label}</p>
                <p className="text-xs text-slate-500">
                  {u.unit_symbol}
                  {u.country_code && u.country_code !== 'GLOBAL' ? ` · ${u.country_code}` : ''}
                  {u.admin1 ? ` · ${u.admin1}` : ''}
                </p>
              </button>
            );
          })}
        </div>
      ))}
      {filtered.length === 0 && (
        <p className="px-4 py-6 text-center text-xs text-slate-500">No units found</p>
      )}
    </div>
  );

  const searchBox = (
    <div className="p-2 border-b border-slate-200">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
        <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent text-sm outline-none w-full text-slate-800 placeholder:text-slate-400"
        />
      </div>
    </div>
  );

  return (
    <div className="relative">
      {label && <label className="text-xs font-bold text-slate-500 mb-1.5 block">{label}</label>}
      <button
        ref={buttonRef}
        onClick={() => setOpen(!isOpen)}
        className={buttonClassName || 'flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 hover:border-blue-500/40 transition-colors shadow-sm'}
      >
        {renderButton ? renderButton(selected) : (
          <span className="truncate">{selected?.unit_name || selected?.label || 'Select unit'}</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          isMobile ? (
            <motion.div
              key="mobile-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10001] flex items-end justify-center"
              onClick={handleClose}
            >
              <div className="absolute inset-0 bg-black/40" />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="relative w-full bg-white border border-slate-200 rounded-t-2xl shadow-2xl flex flex-col"
                style={{ maxHeight: '75vh' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                  <div className="w-8 h-1 bg-slate-300 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-1.5" />
                  <p className="text-sm font-bold text-slate-800 mt-1">Select Unit</p>
                  <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                {searchBox}
                {listContent}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="desktop-modal"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10001] flex items-center justify-center"
              onClick={handleClose}
            >
              <div className="absolute inset-0 bg-black/40" />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                className={`relative ${width} max-w-[90vw] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col`}
                style={{ maxHeight: '70vh' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                  <p className="text-sm font-bold text-slate-800">Select Unit</p>
                  <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                {searchBox}
                {listContent}
              </motion.div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
