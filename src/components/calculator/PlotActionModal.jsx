/**
 * PlotActionModal — Unified popup for Save Plot & Generate PDF flows.
 *
 * mode='save': Data input form → "Save Plot" button → saves to DB
 * mode='pdf':  Data input form (Step 1) → "Next" → PDF Config (Step 2) → "Generate PDF"
 *
 * Collects: Plot Name, Address, Owner, Notes/Remark, Boundaries (Chauhaddi)
 * PDF Config: diagonal visibility, coordinates, diagonals table, area conversions
 *             (settings persist via initialPdfConfig / onGeneratePDF callback)
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, CheckCircle2, ChevronRight, FileText, MapPin, Ruler, Square, Settings2, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { computeDiagonalsFromVertices } from '@/lib/geometry';

export default function PlotActionModal({
  open,
  mode, // 'save' | 'pdf'
  onClose,
  plotData,
  onSaved,
  onGeneratePDF,
  points,
  sideLabels,
  diagGroups = [],
  initialPlotInfo = {},
  initialPdfConfig = {},
  elevation = null,
}) {
  const [step, setStep] = useState(1);
  const [plotName, setPlotName] = useState('');
  const [address, setAddress] = useState('');
  const [owner, setOwner] = useState('');
  const [notes, setNotes] = useState('');
  const [boundaryNames, setBoundaryNames] = useState({});

  const [showDiagonalsInDrawing, setShowDiagonalsInDrawing] = useState(true);
  const [diagVisible, setDiagVisible] = useState({});
  const [showAdvancedDiag, setShowAdvancedDiag] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [showDiagonalsTable, setShowDiagonalsTable] = useState(true);
  const [showAreaConversions, setShowAreaConversions] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const wasOpenRef = useRef(false);

  const diagonals = useMemo(() => {
    if (!points || points.length < 4) return [];
    const dummy = points.map((_, i) => ({ x: i, y: 0 }));
    return computeDiagonalsFromVertices(dummy);
  }, [points]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setStep(1);
    setSavedSuccess(false);
    setSaveError('');
    setPlotName(initialPlotInfo.plotName || '');
    setAddress(initialPlotInfo.address || '');
    setOwner(initialPlotInfo.owner || '');
    setNotes(initialPlotInfo.notes || '');
    const bn = {};
    if (initialPlotInfo.boundaryNames && Array.isArray(initialPlotInfo.boundaryNames)) {
      initialPlotInfo.boundaryNames.forEach((v, i) => { bn[i] = v || ''; });
    }
    setBoundaryNames(bn);

    setShowDiagonalsInDrawing(initialPdfConfig.showDiagonalsInDrawing !== false);
    setShowCoordinates(initialPdfConfig.showCoordinates !== false);
    setShowDiagonalsTable(initialPdfConfig.showDiagonalsTable !== false);
    setShowAreaConversions(initialPdfConfig.showAreaConversions !== false);
    setShowAdvancedDiag(false);

    if (diagGroups.length > 0 && diagonals.length > 0) {
      const groupDiagSet = new Set();
      diagGroups.forEach(g => {
        g.connected.forEach(c => {
          diagonals.forEach((d, i) => {
            if ((d.from === g.base && d.to === c) || (d.from === c && d.to === g.base)) {
              groupDiagSet.add(i);
            }
          });
        });
      });
      const dv = {};
      diagonals.forEach((_, i) => { dv[i] = groupDiagSet.has(i); });
      setDiagVisible(dv);
      if (groupDiagSet.size > 0) setShowAdvancedDiag(true);
    } else if (initialPdfConfig.visibleDiagonals && Array.isArray(initialPdfConfig.visibleDiagonals)) {
      const dv = {};
      diagonals.forEach((_, i) => { dv[i] = initialPdfConfig.visibleDiagonals.includes(i); });
      setDiagVisible(dv);
      if (initialPdfConfig.visibleDiagonals.length > 0) setShowAdvancedDiag(true);
    } else {
      setDiagVisible({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const plotInfo = {
    plotName: plotName.trim(),
    address: address.trim(),
    owner: owner.trim(),
    elevation: elevation,
    notes: notes.trim(),
    boundaryNames: (points || []).map((_, i) => boundaryNames[i] || ''),
  };

  const pdfConfig = {
    showDiagonalsInDrawing,
    visibleDiagonals: diagonals.map((_, i) => i).filter(i => diagVisible[i] !== false),
    showCoordinates,
    showDiagonalsTable,
    showAreaConversions,
    plotName: plotName.trim(),
    address: address.trim(),
    owner: owner.trim(),
    elevation: elevation,
    notes: notes.trim(),
    boundaryNames: (points || []).map((_, i) => boundaryNames[i] || ''),
    diagGroups,
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      base44.auth.redirectToLogin(window.location.href);
      setSaving(false);
      return;
    }
    try {
      const pdfConfigData = {
        diagGroups,
        showDiagonalsInDrawing,
        showCoordinates,
        showDiagonalsTable,
        showAreaConversions,
        visibleDiagonals: diagonals.map((_, i) => i).filter(i => diagVisible[i] !== false),
      };
      const payload = {
        ...plotData,
        plot_name: plotName.trim() || 'My Plot',
        address: address.trim(),
        owner: owner.trim(),
        elevation: elevation,
        notes: notes.trim(),
        chauhaddi: plotInfo.boundaryNames,
        pdf_config: JSON.stringify(pdfConfigData),
      };
      const existingId = plotData?.id || initialPlotInfo?.id;
      const savedRecord = existingId
        ? await base44.entities.SavedPlot.update(existingId, payload)
        : await base44.entities.SavedPlot.create(payload);
      setSavedSuccess(true);
      if (onSaved) onSaved(savedRecord);
    } catch (err) {
      setSaveError(err?.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = () => {
    onClose();
    if (onGeneratePDF) onGeneratePDF(plotInfo, pdfConfig);
  };

  const handleClose = () => {
    setStep(1);
    setSavedSuccess(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {savedSuccess ? (
              <div className="text-center py-8 p-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-black text-foreground mb-1">Plot Saved!</h3>
                <p className="text-muted-foreground text-sm mb-5">Your plot has been saved to My Plots.</p>
                <button onClick={handleClose} className="px-8 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5 p-6 pb-0">
                  <div>
                    <h3 className="text-xl font-black text-foreground">
                      {mode === 'save' ? 'Save Plot' : 'Generate PDF'}
                    </h3>
                    {mode === 'pdf' && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Step {step} of 2 — {step === 1 ? 'Plot Information' : 'PDF Configuration'}
                      </p>
                    )}
                  </div>
                  <button onClick={handleClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 pb-6 space-y-4">
                  {step === 1 ? (
                    <>
                      <div>
                        <label className="text-sm font-semibold text-muted-foreground block mb-1">Plot Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Home Land, Field 1..."
                          value={plotName}
                          onChange={e => setPlotName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground text-base font-medium focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-muted-foreground block mb-1">Address</label>
                        <input
                          type="text"
                          placeholder="e.g. Village Rampur, Tehsil..."
                          value={address}
                          onChange={e => setAddress(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground text-base font-medium focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-muted-foreground block mb-1">Owner</label>
                        <input
                          type="text"
                          placeholder="e.g. Owner name..."
                          value={owner}
                          onChange={e => setOwner(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground text-base font-medium focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-muted-foreground block mb-1">Notes / Remark</label>
                        <textarea
                          placeholder="Add any notes about this plot..."
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          rows={2}
                          className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground text-base font-medium focus:outline-none focus:border-primary transition-colors resize-none"
                        />
                      </div>

                      {points && points.length >= 3 && (
                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-2.5 bg-muted rounded-lg text-sm font-bold hover:bg-muted/80">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-primary" />
                              Boundary (Chauhaddi) — {points.length} sides
                            </span>
                            <ChevronDown className="w-4 h-4" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-1.5 mt-1.5 max-h-44 overflow-y-auto">
                            {points.map((_, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-xs font-bold w-7 text-primary flex-shrink-0">S{i+1}</span>
                                <span className="text-xs text-muted-foreground truncate flex-1">{sideLabels?.[i] || ''}</span>
                                <input
                                  value={boundaryNames[i] || ''}
                                  onChange={e => setBoundaryNames(p => ({ ...p, [i]: e.target.value }))}
                                  placeholder="Boundary..."
                                  className="h-7 text-xs w-28 px-2 rounded-md border border-border bg-background focus:outline-none focus:border-primary"
                                />
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      <div className="bg-muted rounded-2xl p-3 text-sm">
                        <p className="text-muted-foreground">
                          Area: <span className="text-foreground font-bold">{plotData?.area_sqft?.toFixed(2)} ft²</span>
                          &nbsp;·&nbsp;
                          Mode: <span className="text-foreground font-bold capitalize">{plotData?.calc_mode || plotData?.shape_type || '—'}</span>
                        </p>
                      </div>

                      {mode === 'save' ? (
                        <>
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-all shadow-lg shadow-primary/20"
                          >
                            {saving
                              ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              : <><Save className="w-5 h-5" /> Save Plot</>
                            }
                          </button>
                          {saveError && (
                            <p className="text-xs text-center text-destructive font-semibold bg-destructive/10 rounded-lg px-3 py-2">{saveError}</p>
                          )}
                          <p className="text-xs text-center text-muted-foreground">Login is required to save plots.</p>
                        </>
                      ) : (
                        <button
                          onClick={() => setStep(2)}
                          className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                          Next <ChevronRight className="w-5 h-5" />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <button onClick={() => setStep(1)} className="text-sm text-primary font-semibold hover:underline">
                          ← Back to Plot Info
                        </button>

                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase text-muted-foreground">Display Options</p>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
                              <span className="text-sm font-semibold flex items-center gap-1.5">
                                <Ruler className="w-3.5 h-3.5 text-primary" />
                                Show Diagonals in Drawing
                              </span>
                              <Switch checked={showDiagonalsInDrawing} onCheckedChange={setShowDiagonalsInDrawing} />
                            </div>
                            {showDiagonalsInDrawing && diagonals.length > 0 && (
                              <>
                                {diagGroups.length > 0 && (
                                  <p className="text-[11px] text-blue-600 font-semibold px-2 py-1 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 rounded">
                                    {diagGroups.length} diagonal group{diagGroups.length>1?'s':''} from map — {diagGroups.reduce((s,g)=>s+g.connected.length,0)} diagonals selected
                                  </p>
                                )}
                                <Collapsible open={showAdvancedDiag} onOpenChange={setShowAdvancedDiag}>
                                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary font-semibold px-2 py-1 hover:underline">
                                    <Settings2 className="w-3 h-3" />
                                    Advanced: Select individual diagonals ({diagonals.length} total)
                                    <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedDiag ? 'rotate-180' : ''}`} />
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="grid grid-cols-2 gap-1 mt-1 max-h-32 overflow-y-auto p-1 bg-muted/30 rounded-lg">
                                    {diagonals.map((d, i) => (
                                      <label key={i} className="flex items-center gap-1.5 text-xs p-1 rounded hover:bg-muted cursor-pointer">
                                        <Checkbox
                                          checked={diagVisible[i] !== false}
                                          onCheckedChange={(v) => setDiagVisible(p => ({ ...p, [i]: v }))}
                                        />
                                        <span>D{i+1} (P{d.from+1}→P{d.to+1})</span>
                                      </label>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              </>
                            )}
                          </div>

                          <div className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
                            <span className="text-sm font-semibold flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-primary" />
                              Show Coordinates
                            </span>
                            <Switch checked={showCoordinates} onCheckedChange={setShowCoordinates} />
                          </div>

                          <div className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
                            <span className="text-sm font-semibold flex items-center gap-1.5">
                              <Ruler className="w-3.5 h-3.5 text-primary" />
                              Show Diagonals Table
                            </span>
                            <Switch checked={showDiagonalsTable} onCheckedChange={setShowDiagonalsTable} />
                          </div>

                          <div className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
                            <span className="text-sm font-semibold flex items-center gap-1.5">
                              <Square className="w-3.5 h-3.5 text-primary" />
                              Show Area Conversions
                            </span>
                            <Switch checked={showAreaConversions} onCheckedChange={setShowAreaConversions} />
                          </div>
                        </div>

                        <button
                          onClick={handleGeneratePDF}
                          className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                          <FileText className="w-5 h-5" /> Generate PDF
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
