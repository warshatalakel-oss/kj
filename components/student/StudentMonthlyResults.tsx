import React, { useState, useEffect } from 'react';
import type { User, SchoolSettings, PublishedMonthlyResult } from '../../types';
import { db } from '../../lib/firebase';
import { Loader2, FileDown } from 'lucide-react';
import StudentMonthlyResultCard from './StudentMonthlyResultCard';

declare const jspdf: any;
declare const html2canvas: any;

interface StudentMonthlyResultsProps {
    currentUser: User;
    resultsData: Record<string, PublishedMonthlyResult> | null;
}

export default function StudentMonthlyResults({ currentUser, resultsData }: StudentMonthlyResultsProps) {
    const [settings, setSettings] = useState<SchoolSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedResultKey, setSelectedResultKey] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (!currentUser.principalId) {
            setIsLoading(false);
            return;
        }
        const settingsRef = db.ref(`settings/${currentUser.principalId}`);
        settingsRef.get().then(snapshot => {
            if (snapshot.exists()) {
                setSettings(snapshot.val());
            }
        }).finally(() => setIsLoading(false));
    }, [currentUser.principalId]);

    const availableResults: PublishedMonthlyResult[] = resultsData ? Object.values(resultsData).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()) : [];

    useEffect(() => {
        // Automatically select the first result when data loads
        if (availableResults.length > 0 && !selectedResultKey) {
            setSelectedResultKey(availableResults[0].monthKey);
        }
    }, [availableResults, selectedResultKey]);

    const handleExportPdf = async () => {
        if (!selectedResultKey || !resultsData) return;
        
        const cardElement = document.getElementById('monthly-result-card-export');
        if (!cardElement) return;

        setIsExporting(true);
        try {
            await document.fonts.ready;
            const canvas = await html2canvas(cardElement, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            pdf.save(`نتيجة-${resultsData[selectedResultKey].monthLabel}-${currentUser.name}.pdf`);
        } catch (error) {
            console.error("PDF Export failed:", error);
            alert("فشل تصدير الملف.");
        } finally {
            setIsExporting(false);
        }
    };
    
    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-10 w-10 animate-spin" /></div>;
    }

    if (availableResults.length === 0) {
        return (
            <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                <h2 className="text-xl font-bold">لا توجد نتائج شهرية منشورة لك بعد</h2>
                <p className="mt-2 text-gray-600">يرجى مراجعة إدارة المدرسة.</p>
            </div>
        );
    }
    
    const selectedResult = selectedResultKey && resultsData ? resultsData[selectedResultKey] : null;

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-lg">
                <h3 className="text-lg font-bold mb-3">اختر النتيجة التي تود عرضها:</h3>
                <div className="flex flex-wrap gap-2">
                    {availableResults.map((res) => (
                        <button
                            key={res.monthKey}
                            onClick={() => setSelectedResultKey(res.monthKey)}
                            className={`px-4 py-2 font-semibold rounded-lg transition-colors ${selectedResultKey === res.monthKey ? 'bg-cyan-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                        >
                            {res.monthLabel}
                        </button>
                    ))}
                </div>
            </div>

            {selectedResult && settings && (
                <div className="bg-white p-4 rounded-xl shadow-lg space-y-4">
                    <div className="flex justify-end">
                        <button 
                            onClick={handleExportPdf}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:bg-gray-400"
                        >
                            {isExporting ? <Loader2 className="animate-spin"/> : <FileDown size={18} />}
                            {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
                        </button>
                    </div>
                    <div id="monthly-result-card-export">
                        <StudentMonthlyResultCard
                            student={currentUser}
                            settings={settings}
                            resultData={selectedResult}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}