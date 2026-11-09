import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  QrCode,
  ShieldAlert,
  BookOpen,
  Utensils,
  CheckCircle,
  AlertTriangle,
  Download,
  Users
} from 'lucide-react';

export type ExportDocumentType = 'RECIPE_CARD' | 'EMERGENCY_CRISIS_PACKET' | 'FAMILY_CONSTITUTION';

export interface PrintableExportViewProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: ExportDocumentType;
  familyId: string;
  recipeId?: string;
  initialScale?: number;
}

export const PrintableExportView: React.FC<PrintableExportViewProps> = ({
  isOpen,
  onClose,
  documentType,
  familyId,
  recipeId,
  initialScale = 1,
}) => {
  const [scale, setScale] = useState<number>(initialScale);
  const [docData, setDocData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !familyId) return;

    const fetchDocument = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let url = '';
        if (documentType === 'RECIPE_CARD' && recipeId) {
          url = `/api/v1/export/${encodeURIComponent(familyId)}/recipe/${encodeURIComponent(recipeId)}?scale=${scale}`;
        } else if (documentType === 'EMERGENCY_CRISIS_PACKET') {
          url = `/api/v1/export/${encodeURIComponent(familyId)}/emergency-packet`;
        } else if (documentType === 'FAMILY_CONSTITUTION') {
          url = `/api/v1/export/${encodeURIComponent(familyId)}/constitution`;
        } else {
          throw new Error('Unsupported or incomplete export document request.');
        }

        const res = await fetch(url);
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || `Failed to fetch export document (${res.status})`);
        }

        const data = await res.json();
        setDocData(data);
      } catch (err: any) {
        setError(err.message || 'Error preparing printable document.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [isOpen, documentType, familyId, recipeId, scale]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="printable-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Action Bar (Hidden in @media print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 bg-[#173D35] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-[#C39A60]">
              {documentType === 'RECIPE_CARD' ? (
                <Utensils className="w-5 h-5" />
              ) : documentType === 'EMERGENCY_CRISIS_PACKET' ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <BookOpen className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 id="printable-export-title" className="text-base font-serif font-bold text-white tracking-wide">
                {documentType === 'RECIPE_CARD'
                  ? 'Printable Recipe Card'
                  : documentType === 'EMERGENCY_CRISIS_PACKET'
                  ? 'Offline Emergency Crisis Packet'
                  : 'Official Family Constitution'}
              </h2>
              <p className="text-xs text-stone-300">
                Optimized for clean physical printing, archiving, and refrigerator mounting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {documentType === 'RECIPE_CARD' && (
              <div className="flex items-center bg-black/20 rounded-lg p-0.5 mr-2 border border-white/10 text-xs">
                {[0.5, 1, 2, 4].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScale(s)}
                    className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                      scale === s ? 'bg-[#C39A60] text-stone-900 shadow-xs' : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !!error}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#C39A60] text-stone-950 hover:bg-[#d4ac73] shadow-md cursor-pointer transition-colors disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Content Area */}
        <div className="overflow-y-auto p-6 sm:p-10 bg-[#F7F4EC] text-stone-900 font-sans print:p-0 print:bg-white">
          {isLoading ? (
            <div className="py-24 text-center">
              <div className="inline-block w-8 h-8 border-3 border-[#173D35] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-semibold text-stone-700">Formatting document for print preview...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl max-w-md mx-auto">
              <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-rose-900">Unable to load print document</p>
              <p className="text-xs text-rose-700 mt-1">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-rose-300 text-rose-900 hover:bg-rose-100"
              >
                Close
              </button>
            </div>
          ) : docData ? (
            <div id="household-print-area" className="max-w-3xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-stone-200 print:border-none print:shadow-none print:p-0 print:max-w-none">
              {/* 1. RECIPE CARD VIEW */}
              {documentType === 'RECIPE_CARD' && docData.recipe && (
                <div className="space-y-6">
                  {/* Recipe Header */}
                  <div className="flex items-start justify-between border-b-2 border-[#173D35] pb-5">
                    <div>
                      <span className="text-[11px] font-bold tracking-widest uppercase text-[#C39A60]">
                        FamilyOS Kitchen Recipe Card
                      </span>
                      <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#173D35] mt-1">
                        {docData.recipe.title}
                      </h1>
                      <p className="text-xs text-stone-600 mt-1 max-w-xl">{docData.recipe.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs font-medium text-stone-700">
                        <span>Prep: {docData.recipe.prepTimeMinutes || 15}m</span>
                        <span>•</span>
                        <span>Cook: {docData.recipe.cookTimeMinutes || 25}m</span>
                        <span>•</span>
                        <span className="font-bold text-[#173D35]">
                          Servings: {docData.recipe.effectiveServings} ({docData.recipe.servingScale}x scale)
                        </span>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="text-center shrink-0 ml-4">
                      <img
                        src={docData.recipe.qrSvgUrl}
                        alt="Recipe QR Code"
                        className="w-24 h-24 border border-stone-200 p-1 rounded-lg shadow-xs"
                      />
                      <span className="text-[9px] font-mono block text-stone-500 mt-1">Scan to Open</span>
                    </div>
                  </div>

                  {/* Two Columns: Ingredients & Method */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-8 pt-2">
                    {/* Ingredients Column */}
                    <div className="md:col-span-2 border-r md:border-stone-200 md:pr-6">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#173D35] mb-3 flex items-center gap-2">
                        <Utensils className="w-3.5 h-3.5 text-[#C39A60]" /> Ingredients ({docData.recipe.servingScale}x)
                      </h3>
                      <ul className="space-y-2 text-xs">
                        {docData.recipe.scaledIngredients?.map((ing: any, i: number) => (
                          <li key={i} className="flex items-baseline justify-between py-1 border-b border-stone-100">
                            <span className="font-medium text-stone-800">{ing.name}</span>
                            <span className="text-stone-600 font-bold ml-2">
                              {ing.quantity} {ing.unit}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Instructions Column */}
                    <div className="md:col-span-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#173D35] mb-3 flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-[#C39A60]" /> Step-by-Step Instructions
                      </h3>
                      <ol className="space-y-3 text-xs text-stone-700">
                        {docData.recipe.instructions?.map((inst: string, i: number) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-[#173D35] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="leading-relaxed">{inst}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="border-t border-stone-200 pt-4 flex items-center justify-between text-[10px] text-stone-400">
                    <span>FamilyOS Household Pantry & Meal System</span>
                    <span>Deep link: {docData.recipe.deepLinkUri}</span>
                  </div>
                </div>
              )}

              {/* 2. EMERGENCY CRISIS PACKET VIEW */}
              {documentType === 'EMERGENCY_CRISIS_PACKET' && (
                <div className="space-y-6">
                  {/* Packet Header */}
                  <div className="border-b-2 border-rose-800 pb-5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 font-bold text-[10px] uppercase tracking-wider">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-700" /> Critical Safety Document
                      </span>
                      <span className="text-[10px] font-bold text-stone-500">
                        Generated: {new Date(docData.exportedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-2">
                      {docData.familyName} — Emergency Crisis Packet
                    </h1>
                    <p className="text-xs text-stone-600 mt-1">
                      Keep a physical copy of this document accessible in your kitchen, vehicle glove box, and emergency go-bag.
                    </p>
                  </div>

                  {/* Primary Emergency Contacts */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900 mb-3">
                      1. Emergency & Urgent Contacts
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {docData.contacts?.map((c: any, i: number) => (
                        <div key={i} className="p-3 rounded-xl border border-stone-200 bg-stone-50 flex flex-col justify-between">
                          <div>
                            <div className="font-bold text-stone-900 text-sm">{c.name}</div>
                            <div className="text-[11px] font-semibold text-rose-800">{c.role}</div>
                            {c.notes && <div className="text-[10px] text-stone-500 mt-1">{c.notes}</div>}
                          </div>
                          <div className="text-sm font-mono font-bold text-stone-900 mt-2 pt-2 border-t border-stone-200">
                            {c.phone}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Medical Alerts & Allergies */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900 mb-3">
                      2. Family Member Medical Alerts & Allergies
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {docData.memberMedicalAlerts?.map((m: any, i: number) => (
                        <div key={i} className="p-3 rounded-xl border border-stone-200">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900">{m.displayName}</span>
                            <span className="text-[10px] text-stone-500">{m.relationship}</span>
                          </div>
                          <div className="mt-2 text-stone-700">
                            <span className="font-semibold text-rose-700">Allergies: </span>
                            {m.allergies && m.allergies.length > 0 ? m.allergies.join(', ') : 'No known allergies'}
                          </div>
                          <div className="mt-1 text-stone-600 text-[11px]">
                            <span className="font-medium">Dietary Notes: </span>
                            {m.dietaryNotes || 'Standard'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Utility Shutoffs & Evacuation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-2">
                        3. Utility Emergency Shutoff
                      </h3>
                      <div className="space-y-2 text-xs">
                        {docData.utilityShutoffs?.map((u: any, i: number) => (
                          <div key={i} className="p-2.5 rounded-lg border border-stone-200 bg-stone-50">
                            <div className="font-bold text-stone-900">{u.name}</div>
                            <div className="text-stone-600 text-[11px] mt-0.5">Location: {u.location}</div>
                            <div className="text-stone-500 text-[10px] mt-1 italic">{u.procedure}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-2">
                        4. Evacuation Meeting Points
                      </h3>
                      <div className="p-3 rounded-lg border border-stone-200 bg-amber-50/60 space-y-2 text-xs">
                        <div>
                          <span className="font-bold text-stone-900">Primary (Immediate): </span>
                          <span className="text-stone-700">{docData.evacuationPlan?.primaryMeetingLocation}</span>
                        </div>
                        <div>
                          <span className="font-bold text-stone-900">Secondary (Neighborhood): </span>
                          <span className="text-stone-700">{docData.evacuationPlan?.neighborhoodMeetingLocation}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-stone-200 pt-3 text-[10px] text-stone-400 text-center">
                    FamilyOS SafeHome Assurance • Free Permanent Core Protection
                  </div>
                </div>
              )}

              {/* 3. FAMILY CONSTITUTION VIEW */}
              {documentType === 'FAMILY_CONSTITUTION' && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="text-center border-b-2 border-[#173D35] pb-6">
                    <span className="text-[11px] font-bold tracking-widest uppercase text-[#C39A60]">
                      The Household Covenant
                    </span>
                    <h1 className="text-3xl font-serif font-bold text-[#173D35] mt-1">
                      {docData.familyName} Constitution
                    </h1>
                    <p className="text-base font-serif italic text-stone-700 mt-2">
                      “{docData.motto}”
                    </p>
                  </div>

                  {/* Mission & Vision */}
                  <div className="p-4 rounded-2xl bg-[#F7F4EC] border border-stone-200 text-center space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#173D35]">Our Mission</h3>
                    <p className="text-xs text-stone-700 max-w-xl mx-auto leading-relaxed">
                      {docData.missionStatement}
                    </p>
                  </div>

                  {/* Core Values */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#173D35] mb-3 text-center">
                      Guiding Family Values
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {docData.coreValues?.map((val: any, i: number) => (
                        <div key={i} className="p-3 rounded-xl border border-stone-200 bg-white">
                          <span className="font-bold text-[#173D35] block text-sm">{val.name}</span>
                          <span className="text-stone-600 text-xs mt-1 block leading-relaxed">{val.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Agreed Rules */}
                  {docData.agreedRules && docData.agreedRules.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#173D35] mb-3 text-center">
                        Our Agreed Family Agreements
                      </h3>
                      <div className="space-y-2 text-xs">
                        {docData.agreedRules.map((rule: any, i: number) => (
                          <div key={i} className="p-2.5 rounded-xl border border-stone-100 bg-stone-50 flex items-start gap-3">
                            <span className="font-bold text-[#C39A60]">{i + 1}.</span>
                            <div>
                              <span className="font-bold text-stone-900">{rule.title}</span>
                              {rule.description && (
                                <p className="text-stone-600 text-xs mt-0.5">{rule.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Member Signatures */}
                  <div className="pt-6 border-t border-stone-200">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#173D35] mb-4 text-center">
                      Family Member Signatures & Endorsements
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                      {docData.signatureMembers?.map((m: any, i: number) => (
                        <div key={i} className="p-3 rounded-xl border border-stone-200 bg-white flex flex-col justify-end min-h-[100px]">
                          <div className="border-b border-stone-400 mb-2 pb-1 text-sm font-serif italic text-stone-800">
                            {m.displayName}
                          </div>
                          <div className="text-[11px] font-bold text-stone-900">{m.displayName}</div>
                          <div className="text-[9px] uppercase tracking-wider text-stone-500">{m.role}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
