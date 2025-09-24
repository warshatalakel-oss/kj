import React, { useState, useMemo } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { ClassData, SchoolSettings, Student, TeacherSubjectGrade } from '../../types';
import { GRADE_LEVELS } from '../../constants';
import { Download, Loader2, Upload, Send } from 'lucide-react';
import MonthlyResultCardPDF from './MonthlyResultCardPDF';
import { db } from '../../lib/firebase';

declare const jspdf: any;
declare const html2canvas: any;

interface MonthlyResultsExporterProps {
    classes: ClassData[];
    settings: SchoolSettings;
}

const MONTH_OPTIONS = [
    { label: 'الأول للفصل الأول', key: 'firstSemMonth1' },
    { label: 'الثاني للفصل الأول', key: 'firstSemMonth2' },
    { label: 'الأول للفصل الثاني', key: 'secondSemMonth1' },
    { label: 'الثاني للفصل الثاني', key: 'secondSemMonth2' },
];

export default function MonthlyResultsExporter({ classes, settings }: MonthlyResultsExporterProps) {
    const [selectedStage, setSelectedStage] = useState<string>('');
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0]);
    const [schoolStamp, setSchoolStamp] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [isPublishing, setIsPublishing] = useState(false);

    const classesInSelectedStage = useMemo(() => {
        return selectedStage ? classes.filter(c => c.stage === selectedStage) : [];
    }, [selectedStage, classes]);

    const handleStampChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setSchoolStamp(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const getStudentsToExport = (): { student: Student, classData: ClassData }[] => {
        return classes
            .filter(c => selectedClassIds.includes(c.id))
            .flatMap(c => (c.students || []).map(s => ({ student: s, classData: c })));
    };
    
    const handlePublishResults = async () => {
        const studentsToPublish = getStudentsToExport();
        if (studentsToPublish.length === 0) {
            alert('يرجى اختيار طالب واحد على الأقل للنشر.');
            return;
        }

        if (!window.confirm(`هل أنت متأكد من نشر نتائج الشهر "${selectedMonth.label}" لـ ${studentsToPublish.length} طالب؟ سيتم استبدال أي نتائج منشورة سابقاً لهذا الشهر.`)) {
            return;
        }

        setIsPublishing(true);

        const updates: Record<string, any> = {};
        const principalId = studentsToPublish[0].classData.principalId;

        for (const { student, classData } of studentsToPublish) {
            const path = `published_monthly_results/${principalId}/${student.id}/${selectedMonth.key}`;
            
            const grades = (classData.subjects || []).map(subject => {
                const grade = student.teacherGrades?.[subject.name]?.[selectedMonth.key as keyof TeacherSubjectGrade];
                return {
                    subjectName: subject.name,
                    grade: grade === undefined ? null : grade,
                };
            });

            updates[path] = {
                publishedAt: new Date().toISOString(),
                monthKey: selectedMonth.key,
                monthLabel: selectedMonth.label,
                grades: grades,
            };
        }

        try {
            await db.ref().update(updates);
            alert('تم نشر النتائج للطلاب بنجاح!');
        } catch (error) {
            console.error("Error publishing results:", error);
            alert('حدث خطأ أثناء نشر النتائج.');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleExportPdf = async () => {
        const studentsToExport = getStudentsToExport();
        if (studentsToExport.length === 0) {
            alert('يرجى اختيار طالب واحد على الأقل للتصدير.');
            return;
        }

        setIsExporting(true);
        setExportProgress(0);

        if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
            alert("خطأ: مكتبة تصدير PDF غير محملة.");
            setIsExporting(false);
            return;
        }

        const { jsPDF } = jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

        const tempContainer = document.createElement('div');
        Object.assign(tempContainer.style, {
            position: 'absolute',
            left: '-9999px',
            top: '0',
            width: '794px',
            height: '1123px',
        });
        document.body.appendChild(tempContainer);
        const root = ReactDOM.createRoot(tempContainer);

        const renderComponent = (component: React.ReactElement): Promise<void> => {
            return new Promise((resolve) => {
                root.render(component);
                setTimeout(resolve, 500);
            });
        };

        try {
            await document.fonts.ready;

            for (let i = 0; i < studentsToExport.length; i++) {
                const { student, classData } = studentsToExport[i];

                await renderComponent(
                    <MonthlyResultCardPDF
                        student={student}
                        classData={classData}
                        settings={settings}
                        selectedMonthKey={selectedMonth.key}
                        selectedMonthLabel={selectedMonth.label}
                        schoolStamp={schoolStamp}
                    />
                );

                const reportElement = tempContainer.children[0] as HTMLElement;
                const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');

                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
                setExportProgress(Math.round(((i + 1) / studentsToExport.length) * 100));
            }
            pdf.save(`نتائج-شهرية-${selectedStage}.pdf`);

        } catch (error) {
            console.error("PDF Export Error:", error);
            const message = error instanceof Error ? error.message : String(error);
            alert(`حدث خطأ أثناء التصدير: ${message}`);
        } finally {
            root.unmount();
            document.body.removeChild(tempContainer);
            setIsExporting(false);
            setExportProgress(0);
        }
    };
    
    const publishLabel = settings.schoolLevel === 'ابتدائية' ? 'نشر نتائج التلاميذ' : 'نشر نتائج الطلبة';


    return (
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">تصدير نتائج الامتحانات الشهرية</h2>
            
            <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-800 p-4 mb-6 rounded-md" role="alert">
                <p className="font-bold">تنبيه مهم:</p>
                <p>نتائج الامتحانات الشهرية يعتمد على السجلات المرسلة من قبل المدرسين والمستلمة من قبل الادارة.</p>
            </div>
            
            {isExporting && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col justify-center items-center z-50 text-white">
                    <Loader2 className="animate-spin h-16 w-16 mb-4" />
                    <p className="text-2xl font-bold mb-2">جاري التصدير...</p>
                    <div className="w-1/2 bg-gray-600 rounded-full h-4">
                        <div className="bg-cyan-500 h-4 rounded-full" style={{ width: `${exportProgress}%` }}></div>
                    </div>
                    <p className="mt-2 text-lg">{exportProgress}%</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-md font-bold text-gray-700 mb-2">1. اختر المرحلة الدراسية</label>
                        <select onChange={e => { setSelectedStage(e.target.value); setSelectedClassIds([]); }} value={selectedStage} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500">
                            <option value="">-- اختر مرحلة --</option>
                            {GRADE_LEVELS.filter(l => !l.includes('ابتدائي')).map(level => <option key={level} value={level}>{level}</option>)}
                        </select>
                    </div>

                    {selectedStage && (
                        <div>
                            <label className="block text-md font-bold text-gray-700 mb-2">2. اختر الشعبة (أو الشعب)</label>
                            <div className="space-y-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                                {classesInSelectedStage.length > 0 ? classesInSelectedStage.map(c => (
                                    <label key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                                        <input type="checkbox" checked={selectedClassIds.includes(c.id)} onChange={() => setSelectedClassIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])} className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"/>
                                        <span className="font-semibold">{c.stage} - {c.section}</span>
                                        <span className="text-sm text-gray-500">({(c.students || []).length} طالب)</span>
                                    </label>
                                )) : <p className="text-gray-500">لا توجد شعب لهذه المرحلة.</p>}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-md font-bold text-gray-700 mb-2">3. اختر الشهر</label>
                        <select onChange={e => setSelectedMonth(MONTH_OPTIONS.find(m => m.key === e.target.value) || MONTH_OPTIONS[0])} value={selectedMonth.key} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500">
                            {MONTH_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-md font-bold text-gray-700 mb-2">4. تحميل ختم المدرسة (اختياري)</label>
                        <div className="flex items-center gap-4">
                            <input type="file" onChange={handleStampChange} accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"/>
                            {schoolStamp && <img src={schoolStamp} alt="School Stamp Preview" className="mt-2 h-16 w-16 object-contain rounded-full border p-1" />}
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t pt-6 mt-8">
                <div className="flex justify-center flex-wrap gap-4">
                    <button onClick={handleExportPdf} disabled={selectedClassIds.length === 0 || isExporting || isPublishing} className="flex items-center justify-center gap-2 px-8 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed">
                        <Download size={20} />
                        <span>تصدير النتائج (PDF)</span>
                    </button>
                    <button onClick={handlePublishResults} disabled={selectedClassIds.length === 0 || isPublishing || isExporting} className="flex items-center justify-center gap-2 px-8 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed">
                        {isPublishing ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                        <span>{publishLabel}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}