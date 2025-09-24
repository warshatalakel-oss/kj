import React, { useState, useMemo } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { ClassData, SchoolSettings, Student, StudentResult, CalculatedGrade, Subject, SubjectGrade } from '../types';
import { GRADE_LEVELS } from '../constants';
import { calculateStudentResult } from '../lib/gradeCalculator';
import TeacherLogPage from './TeacherLogPage';
import { Loader2, FileDown } from 'lucide-react';

declare const jspdf: any;
declare const html2canvas: any;

const paginateStudents = (students: Student[]) => {
    const MAX_ROWS_FIRST_PAGE = 25;
    const MAX_ROWS_SUBSEQUENT_PAGE = 28;
    const MIN_ROWS_LAST_PAGE = 8;

    if (students.length <= MAX_ROWS_FIRST_PAGE) {
        return [students];
    }
    
    const chunks: Student[][] = [];
    let remainingStudents = [...students];
    
    chunks.push(remainingStudents.splice(0, MAX_ROWS_FIRST_PAGE));
    
    while(remainingStudents.length > 0) {
        chunks.push(remainingStudents.splice(0, MAX_ROWS_SUBSEQUENT_PAGE));
    }

    // Re-balance if the last page is too small and there's more than one page
    if (chunks.length > 1) {
        const lastChunk = chunks[chunks.length - 1];
        if (lastChunk.length < MIN_ROWS_LAST_PAGE) {
            const secondLastChunk = chunks[chunks.length - 2];
            // Don't rebalance if it would make the second-to-last page too empty
            if (secondLastChunk.length > lastChunk.length) {
                const combined = [...secondLastChunk, ...lastChunk];
                const newSecondLastSize = Math.ceil(combined.length / 2);
                
                chunks[chunks.length - 2] = combined.slice(0, newSecondLastSize);
                chunks[chunks.length - 1] = combined.slice(newSecondLastSize);
            }
        }
    }

    return chunks;
};

// Interfaces for detailed stats
interface SubjectStats {
    total: number;
    passed: number;
    failed: number;
    passRate: string;
}

export interface DetailedStats {
    firstTerm: SubjectStats;
    midYear: SubjectStats;
    secondTerm: SubjectStats;
    annualPursuit: SubjectStats;
}


export default function TeacherLogExporter({ classes, settings }: { classes: ClassData[], settings: SchoolSettings }) {
    const [selectedStage, setSelectedStage] = useState('');
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [teacherName, setTeacherName] = useState('');
    const [logos, setLogos] = useState<{ school: string | null; ministry: string | null }>({ school: null, ministry: null });
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    const classesInSelectedStage = useMemo(() => {
        return selectedStage ? classes.filter(c => c.stage === selectedStage) : [];
    }, [selectedStage, classes]);
    
    const availableSubjects = useMemo(() => {
        if (selectedClassIds.length === 0) return [];
        const firstClassId = selectedClassIds[0];
        const firstClass = classes.find(c => c.id === firstClassId);
        return firstClass?.subjects || [];
    }, [selectedClassIds, classes]);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'school' | 'ministry') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setLogos(prev => ({ ...prev, [type]: event.target?.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleExportPdf = async () => {
        if (selectedClassIds.length === 0) {
            alert('يرجى اختيار شعبة واحدة على الأقل.');
            return;
        }
        if (!selectedSubject) {
            alert('يرجى اختيار المادة الدراسية.');
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
        Object.assign(tempContainer.style, { position: 'absolute', left: '-9999px', top: '0' });
        document.body.appendChild(tempContainer);
        const root = ReactDOM.createRoot(tempContainer);

        const renderComponent = (component: React.ReactElement) => new Promise<void>(resolve => {
            root.render(component);
            setTimeout(resolve, 500);
        });

        // Pre-calculate all results for all students in selected classes
        const resultsData = new Map<string, { finalCalculatedGrades: Record<string, CalculatedGrade>, result: StudentResult }>();
        classes.filter(c => selectedClassIds.includes(c.id)).forEach(c => {
            (c.students || []).forEach(student => {
                 if (!resultsData.has(student.id)) {
                    resultsData.set(student.id, calculateStudentResult(student, c.subjects || [], settings, c));
                }
            })
        });

        const allPagesProps = [];
        const MAX_ROWS_FIRST_PAGE = 25;
        const MAX_ROWS_SUBSEQUENT_PAGE = 28;
        
        // Loop through each selected class to generate its own set of pages
        for (const classId of selectedClassIds) {
            const classData = classes.find(c => c.id === classId);
            if (!classData || !classData.students || classData.students.length === 0) continue;

            const classStudents = [...(classData.students || [])].sort((a, b) => {
                const aId = a.examId || '';
                const bId = b.examId || '';
                const numA = parseInt(aId, 10);
                const numB = parseInt(bId, 10);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                }
                return aId.localeCompare(bId, undefined, { numeric: true });
            });

            // --- Detailed Stats Calculation based on student.grades ---
            const passingGrade = classData.stage.includes('ابتدائي') ? 50 : 50;

            const detailedStats = {
                firstTerm: { total: 0, passed: 0, failed: 0 },
                midYear: { total: 0, passed: 0, failed: 0 },
                secondTerm: { total: 0, passed: 0, failed: 0 },
                annualPursuit: { total: 0, passed: 0, failed: 0 },
            };

            classStudents.forEach(student => {
                const grade: SubjectGrade | undefined = student.grades?.[selectedSubject];
                const studentResultData = resultsData.get(student.id);
                const calculatedGradeForSubject = studentResultData?.finalCalculatedGrades[selectedSubject];

                const firstTerm = grade?.firstTerm ?? null;
                const midYear = grade?.midYear ?? null;
                const secondTerm = grade?.secondTerm ?? null;
                const annualPursuit = calculatedGradeForSubject?.annualPursuit ?? null;

                if (firstTerm !== null) {
                    detailedStats.firstTerm.total++;
                    if (firstTerm >= passingGrade) detailedStats.firstTerm.passed++; else detailedStats.firstTerm.failed++;
                }
                if (midYear !== null) {
                    detailedStats.midYear.total++;
                    if (midYear >= passingGrade) detailedStats.midYear.passed++; else detailedStats.midYear.failed++;
                }
                if (secondTerm !== null) {
                    detailedStats.secondTerm.total++;
                    if (secondTerm >= passingGrade) detailedStats.secondTerm.passed++; else detailedStats.secondTerm.failed++;
                }
                if (annualPursuit !== null) {
                    detailedStats.annualPursuit.total++;
                    if (annualPursuit >= passingGrade) detailedStats.annualPursuit.passed++; else detailedStats.annualPursuit.failed++;
                }
            });

            const calculateRate = (passed: number, total: number) => total > 0 ? `${Math.round((passed / total) * 100)}%` : '';

            const finalStats: DetailedStats = {
                firstTerm: { ...detailedStats.firstTerm, passRate: calculateRate(detailedStats.firstTerm.passed, detailedStats.firstTerm.total) },
                midYear: { ...detailedStats.midYear, passRate: calculateRate(detailedStats.midYear.passed, detailedStats.midYear.total) },
                secondTerm: { ...detailedStats.secondTerm, passRate: calculateRate(detailedStats.secondTerm.passed, detailedStats.secondTerm.total) },
                annualPursuit: { ...detailedStats.annualPursuit, passRate: calculateRate(detailedStats.annualPursuit.passed, detailedStats.annualPursuit.total) },
            };
            // --- End Stats Calculation ---

            const studentChunks = paginateStudents(classStudents);
            let classStudentStartIndex = 0;

            studentChunks.forEach((chunk, index) => {
                const isLastPageOfClass = index === studentChunks.length - 1;
                allPagesProps.push({
                    settings,
                    logos,
                    pageData: {
                        students: chunk,
                        classInfo: { stage: classData.stage, sections: classData.section },
                        subjectName: selectedSubject,
                        teacherName: teacherName,
                    },
                    resultsData,
                    stats: finalStats,
                    showSummary: isLastPageOfClass,
                    maxRows: index === 0 ? MAX_ROWS_FIRST_PAGE : MAX_ROWS_SUBSEQUENT_PAGE,
                    startingIndex: classStudentStartIndex,
                });
                classStudentStartIndex += chunk.length;
            });
        }

        if (allPagesProps.length === 0) {
            alert('لم يتم العثور على طلاب في الشعب المختارة.');
            setIsExporting(false);
            return;
        }

        const totalPages = allPagesProps.length;

        try {
            await document.fonts.ready;
            
            for (let i = 0; i < totalPages; i++) {
                const props = allPagesProps[i];
                
                await renderComponent(
                    <TeacherLogPage
                        {...props}
                        pageNumber={i + 1}
                        totalPages={totalPages}
                    />
                );

                const reportElement = tempContainer.children[0] as HTMLElement;
                const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
                setExportProgress(Math.round(((i + 1) / totalPages) * 100));
            }
            pdf.save(`سجل_مدرس-${selectedStage}-${selectedSubject}.pdf`);
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

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">تصدير سجل المدرس</h2>
            
            {isExporting && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex flex-col justify-center items-center z-50 text-white">
                    <Loader2 className="animate-spin h-16 w-16 mb-4" />
                    <p className="text-2xl font-bold mb-2">جاري التصدير...</p>
                    <div className="w-1/2 bg-gray-600 rounded-full h-4"><div className="bg-cyan-500 h-4 rounded-full" style={{ width: `${exportProgress}%` }}></div></div>
                    <p className="mt-2 text-lg">{exportProgress}%</p>
                </div>
            )}

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-md font-bold text-gray-700 mb-2">1. اختر المرحلة الدراسية</label>
                        <select onChange={e => { setSelectedStage(e.target.value); setSelectedClassIds([]); setSelectedSubject(''); }} value={selectedStage} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500">
                            <option value="">-- اختر مرحلة --</option>
                            {GRADE_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                        </select>
                    </div>

                     {selectedStage && (
                        <div>
                            <label className="block text-md font-bold text-gray-700 mb-2">2. اختر الشعبة (أو الشعب)</label>
                            <div className="space-y-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                                {classesInSelectedStage.length > 0 ? classesInSelectedStage.map(c => (
                                    <label key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                                        <input type="checkbox" checked={selectedClassIds.includes(c.id)} onChange={() => {setSelectedClassIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]); setSelectedSubject('')}} className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"/>
                                        <span className="font-semibold">{c.stage} - {c.section}</span>
                                        <span className="text-sm text-gray-500">({(c.students || []).length} طالب)</span>
                                    </label>
                                )) : <p className="text-gray-500">لا توجد شعب لهذه المرحلة.</p>}
                            </div>
                        </div>
                    )}

                    {selectedClassIds.length > 0 && (
                        <div>
                             <label className="block text-md font-bold text-gray-700 mb-2">3. اختر المادة الدراسية</label>
                             <select onChange={e => setSelectedSubject(e.target.value)} value={selectedSubject} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500">
                                <option value="">-- اختر مادة --</option>
                                {availableSubjects.map(subject => <option key={subject.id} value={subject.name}>{subject.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-md font-bold text-gray-700 mb-2">4. اسم مدرس المادة</label>
                         <input type="text" value={teacherName} onChange={e => setTeacherName(e.target.value)} placeholder="ادخل اسم المدرس هنا" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500" />
                    </div>

                    <div>
                        <label className="block text-md font-bold text-gray-700 mb-2">5. اختر الشعارات (اختياري)</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-600">شعار الوزارة</label>
                                <input type="file" onChange={e => handleLogoChange(e, 'ministry')} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"/>
                                {logos.ministry && <img src={logos.ministry} alt="Ministry Logo Preview" className="mt-2 h-16 w-16 object-contain rounded-full border p-1" />}
                            </div>
                             <div>
                                <label className="text-sm font-medium text-gray-600">شعار المدرسة</label>
                                <input type="file" onChange={e => handleLogoChange(e, 'school')} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"/>
                                {logos.school && <img src={logos.school} alt="School Logo Preview" className="mt-2 h-16 w-16 object-contain rounded-full border p-1" />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
             <div className="border-t pt-6 mt-8">
                <label className="block text-md font-bold text-gray-700 mb-3 text-center">6. تنفيذ التصدير</label>
                <div className="flex justify-center">
                    <button onClick={handleExportPdf} disabled={selectedClassIds.length === 0 || !selectedSubject || isExporting} className="flex items-center justify-center gap-2 px-8 py-3 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed">
                        <FileDown size={20} />
                        <span>تصدير سجل المدرس (PDF)</span>
                    </button>
                </div>
            </div>
        </div>
    );
}