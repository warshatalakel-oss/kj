import React, { useState, useMemo, useRef } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { ClassData, SchoolSettings, Student, CalculatedGrade, StudentResult } from '../types';
import { GRADE_LEVELS } from '../constants';
import { calculateStudentResult } from '../lib/gradeCalculator';
import { Loader2, FileDown } from 'lucide-react';
import OverallPercentagesManager from './statistics/OverallPercentagesManager';

declare const jspdf: any;
declare const html2canvas: any;

type ReportType = 'successful' | 'failing' | 'supplementary' | 'decision_log' | 'overall_percentages';

const REPORT_TABS: { key: ReportType; label: string }[] = [
    { key: 'successful', label: 'الناجحون' },
    { key: 'failing', label: 'الراسبون' },
    { key: 'supplementary', label: 'تبليغات المكملين' },
    { key: 'decision_log', label: 'سجل إضافات القرار' },
    { key: 'overall_percentages', label: 'النسب الكلية' },
];

const ROWS_PER_PAGE = 25;

interface ReportPageProps {
    settings: SchoolSettings;
    title: string;
    children: React.ReactNode;
    pageNumber: number;
    totalPages: number;
}

// Common container for printable reports
const ReportPage = React.forwardRef<HTMLDivElement, ReportPageProps>(({ settings, title, children, pageNumber, totalPages }, ref) => (
    <div ref={ref} className="w-[794px] h-[1123px] p-10 bg-white flex flex-col font-['Cairo']" style={{ direction: 'rtl' }}>
        <header className="flex justify-between items-center text-center mb-4 pb-2 border-b-2 border-black">
            <div className="text-right">
                <p>إدارة: {settings.directorate}</p>
                <p>اسم المدرسة: {settings.schoolName}</p>
            </div>
            <div className="text-left">
                <p>العام الدراسي: {settings.academicYear}</p>
                <p>الدور الأول</p>
            </div>
        </header>
        <h2 className="text-2xl font-bold text-center my-4">{title}</h2>
        <main className="flex-grow">
            {children}
        </main>
        <footer className="flex justify-between items-center text-center mt-auto pt-2 border-t-2 border-black">
             <p>اسم مدير المدرسة: {settings.principalName}</p>
             <p>صفحة {pageNumber} من {totalPages}</p>
        </footer>
    </div>
));


interface SuccessFailReportProps {
    students: (Student & { classId: string })[];
    classMap: Map<string, ClassData>;
    reportType: 'successful' | 'failing';
}
// Specific report table components
const SuccessFailReport: React.FC<SuccessFailReportProps> = ({ students, classMap, reportType }) => {
    const headers = ['تسلسل', 'اسم الطالب', 'الرقم الامتحاني', 'رقم القيد', 'الشعبة'];
    if (reportType === 'failing') {
        headers.push('سنوات الرسوب');
    }

    return (
        <table className="w-full border-collapse border border-black text-lg">
            <thead className="bg-gray-200">
                <tr>
                    {headers.map(h => 
                        <th key={h} className="border border-black p-2 font-bold">{h}</th>
                    )}
                </tr>
            </thead>
            <tbody>
                {students.map((s, i) => (
                    <tr key={s.id} className="odd:bg-white even:bg-gray-100">
                        <td className="border border-black p-2 text-center">{i + 1}</td>
                        <td className="border border-black p-2 text-right">{s.name}</td>
                        <td className="border border-black p-2 text-center">{s.examId}</td>
                        <td className="border border-black p-2 text-center">{s.registrationId}</td>
                        <td className="border border-black p-2 text-center">{classMap.get(s.classId)?.section}</td>
                        {reportType === 'failing' && (
                            <td className="border border-black p-2 text-center">
                                {s.yearsOfFailure?.trim() === 'راسب' ? 1 : 0}
                            </td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

type StudentResultData = {
    finalCalculatedGrades: Record<string, CalculatedGrade>;
    result: StudentResult;
};

interface SupplementaryReportProps {
    students: (Student & { classId: string })[];
    classMap: Map<string, ClassData>;
    resultsData: Map<string, StudentResultData>;
}
const SupplementaryReport: React.FC<SupplementaryReportProps> = ({ students, classMap, resultsData }) => {
    const getSupplementarySubjects = (studentId: string) => {
        const studentResult = resultsData.get(studentId);
        if (!studentResult) return '';
        return Object.entries(studentResult.finalCalculatedGrades)
            .filter(([, grade]) => !(grade as CalculatedGrade).isExempt && (grade as CalculatedGrade).finalGradeWithDecision !== null && (grade as CalculatedGrade).finalGradeWithDecision < 50)
            .map(([subjectName]) => subjectName)
            .join('، ');
    };

    return (
        <table className="w-full border-collapse border border-black text-lg">
            <thead className="bg-gray-200">
                <tr>
                    {['تسلسل', 'اسم الطالب', 'الرقم الامتحاني', 'الصف', 'الدروس التي اكمل بها', 'التوقيع'].map(h =>
                         <th key={h} className="border border-black p-2 font-bold">{h}</th>
                    )}
                </tr>
            </thead>
            <tbody>
                {students.map((s, i) => (
                    <tr key={s.id} className="odd:bg-white even:bg-gray-100">
                        <td className="border border-black p-2 text-center">{i + 1}</td>
                        <td className="border border-black p-2 text-right">{s.name}</td>
                        <td className="border border-black p-2 text-center">{s.examId}</td>
                        <td className="border border-black p-2 text-center">{classMap.get(s.classId)?.stage}</td>
                        <td className="border border-black p-2 text-right">{getSupplementarySubjects(s.id)}</td>
                        <td className="border border-black p-2" style={{minHeight: '50px'}}></td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

interface DecisionLogReportProps {
    students: (Student & { classId: string })[];
    classMap: Map<string, ClassData>;
    resultsData: Map<string, StudentResultData>;
    settings: SchoolSettings;
}

const MINISTERIAL_STAGES_FOR_REPORTS = ['الثالث متوسط', 'السادس العلمي', 'السادس الادبي'];

const DecisionLogReport: React.FC<DecisionLogReportProps> = ({ students, classMap, resultsData, settings }) => {
    const getDecisionInfo = (student: Student & { classId: string }) => {
        const studentResult = resultsData.get(student.id);
        const classData = classMap.get(student.classId);

        if (!studentResult || !classData) {
            return { granted: 0, subjects: '', remaining: 0, status: '' };
        }

        const isMinisterial = MINISTERIAL_STAGES_FOR_REPORTS.includes(classData.stage);
        
        let granted = 0;
        const decisionSubjects: string[] = [];
        
        Object.entries(studentResult.finalCalculatedGrades).forEach(([subjectName, grade]) => {
            if (isMinisterial) {
                // For ministerial stages, check decision on annual pursuit
                const decisionAmount = (grade as CalculatedGrade).decisionAppliedOnPursuit || 0;
                if (decisionAmount > 0) {
                    granted += decisionAmount;
                    decisionSubjects.push(`${subjectName} (+${decisionAmount})`);
                }
            } else {
                // For standard stages, check decision on final grade
                if ((grade as CalculatedGrade).decisionApplied > 0) {
                    granted += (grade as CalculatedGrade).decisionApplied;
                    decisionSubjects.push(`${subjectName} (+${(grade as CalculatedGrade).decisionApplied})`);
                }
            }
        });
        
        const totalDecisionPoints = isMinisterial 
            ? (classData.ministerialDecisionPoints ?? 5) 
            : settings.decisionPoints;

        return {
            granted,
            subjects: decisionSubjects.join('، '),
            remaining: totalDecisionPoints - granted,
            status: studentResult.result.status
        };
    };

    return (
        <table className="w-full border-collapse border border-black text-md">
            <thead className="bg-gray-200">
                <tr>
                    {['ت', 'اسم الطالب', 'الصف والشعبة', 'مقدار المنح', 'المواد التي حصل عليها القرار', 'المتبقي', 'النتيجة'].map(h => 
                        <th key={h} className="border border-black p-2 font-bold">{h}</th>
                    )}
                </tr>
            </thead>
            <tbody>
                {students.map((s, i) => {
                    const info = getDecisionInfo(s);
                    const classInfo = classMap.get(s.classId);
                    return (
                        <tr key={s.id} className="odd:bg-white even:bg-gray-100">
                            <td className="border border-black p-2 text-center">{i + 1}</td>
                            <td className="border border-black p-2 text-right">{s.name}</td>
                            <td className="border border-black p-2 text-center">{`${classInfo?.stage} - ${classInfo?.section}`}</td>
                            <td className="border border-black p-2 text-center">{info.granted}</td>
                            <td className="border border-black p-2 text-right">{info.subjects}</td>
                            <td className="border border-black p-2 text-center">{info.remaining}</td>
                            <td className="border border-black p-2 text-center">{info.status}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};


export default function StatisticsManager({ classes, settings }: { classes: ClassData[], settings: SchoolSettings }) {
    const [selectedStage, setSelectedStage] = useState('');
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<ReportType>('successful');
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    const classesInSelectedStage = useMemo(() => {
        return selectedStage ? classes.filter(c => c.stage === selectedStage) : [];
    }, [selectedStage, classes]);

    const studentResults = useMemo(() => {
        const results = new Map<string, StudentResultData>();
        const students: (Student & { classId: string })[] = [];
        const classMap = new Map<string, ClassData>();

        classes
            .filter(c => selectedClassIds.includes(c.id))
            .forEach(c => {
                if (!c) return;
                classMap.set(c.id, c);
                (c.students || []).forEach(s => {
                    const studentWithClassId = { ...s, classId: c.id };
                    students.push(studentWithClassId);
                    results.set(s.id, calculateStudentResult(s, c.subjects || [], settings, c));
                });
            });
        
        students.sort((a, b) => {
            const aId = a.examId || '';
            const bId = b.examId || '';
            const numA = parseInt(aId, 10);
            const numB = parseInt(bId, 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return aId.localeCompare(bId, undefined, { numeric: true });
        });
        return { students, results, classMap };
    }, [selectedClassIds, classes, settings]);

    const filteredData = useMemo(() => {
        if (activeTab === 'overall_percentages') return [];
        const { students, results } = studentResults;
        const dataMap = {
            successful: students.filter(s => ['ناجح', 'مؤهل', 'مؤهل بقرار'].includes(results.get(s.id)?.result.status || '')),
            failing: students.filter(s => ['راسب', 'غير مؤهل'].includes(results.get(s.id)?.result.status || '')),
            supplementary: students.filter(s => results.get(s.id)?.result.status === 'مكمل'),
            decision_log: students.filter(s => {
                const res = results.get(s.id);
                if (!res) return false;
                return Object.values(res.finalCalculatedGrades).some(g => ((g as CalculatedGrade).decisionApplied > 0) || ((g as CalculatedGrade).decisionAppliedOnPursuit || 0) > 0);
            }),
        };
        return dataMap[activeTab as Exclude<ReportType, 'overall_percentages'>] || [];
    }, [activeTab, studentResults]);
    
    const handleExportPdf = async () => {
        if (activeTab === 'overall_percentages') return;
        const data = filteredData;
        if (data.length === 0) {
            alert('لا يوجد طلاب لعرضهم في هذا التقرير.');
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
        Object.assign(tempContainer.style, { position: 'absolute', left: '-9999px', top: '-9999px' });
        document.body.appendChild(tempContainer);
        const root = ReactDOM.createRoot(tempContainer);

        const renderComponent = (component: React.ReactElement) => new Promise<void>(resolve => {
            root.render(component);
            setTimeout(resolve, 500);
        });
        
        const totalPages = Math.ceil(data.length / ROWS_PER_PAGE);

        try {
            await document.fonts.ready;
            
            for (let i = 0; i < totalPages; i++) {
                const pageData = data.slice(i * ROWS_PER_PAGE, (i + 1) * ROWS_PER_PAGE);
                const title = REPORT_TABS.find(t => t.key === activeTab)?.label || '';
                
                let ReportComponent;
                switch (activeTab) {
                    case 'successful':
                    case 'failing':
                        ReportComponent = <SuccessFailReport students={pageData} classMap={studentResults.classMap} reportType={activeTab as 'successful' | 'failing'} />;
                        break;
                    case 'supplementary':
                        ReportComponent = <SupplementaryReport students={pageData} classMap={studentResults.classMap} resultsData={studentResults.results} />;
                        break;
                    case 'decision_log':
                        ReportComponent = <DecisionLogReport students={pageData} classMap={studentResults.classMap} resultsData={studentResults.results} settings={settings} />;
                        break;
                    default:
                        ReportComponent = <div>Invalid Report Type</div>
                }

                await renderComponent(
                    <ReportPage settings={settings} title={title} pageNumber={i + 1} totalPages={totalPages}>
                        {ReportComponent}
                    </ReportPage>
                );

                const reportElement = tempContainer.children[0] as HTMLElement;
                const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
                setExportProgress(Math.round(((i + 1) / totalPages) * 100));
            }
            pdf.save(`${activeTab}_report_${selectedStage}.pdf`);
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

    const renderActiveReportForDisplay = () => {
        if (activeTab === 'overall_percentages') {
            return <OverallPercentagesManager classes={classes} settings={settings} />;
        }

        const data = filteredData.slice(0, ROWS_PER_PAGE); // show first page as preview
        if (data.length === 0) {
            return <p className="text-center text-gray-500 py-10">لا يوجد طلاب لعرضهم. يرجى اختيار شعبة أو أكثر.</p>;
        }
        
        const title = REPORT_TABS.find(t => t.key === activeTab)?.label || '';
        let ReportComponent;
         switch (activeTab) {
            case 'successful':
            case 'failing':
                ReportComponent = <SuccessFailReport students={data} classMap={studentResults.classMap} reportType={activeTab as 'successful' | 'failing'} />;
                break;
            case 'supplementary':
                ReportComponent = <SupplementaryReport students={data} classMap={studentResults.classMap} resultsData={studentResults.results} />;
                break;
            case 'decision_log':
                 ReportComponent = <DecisionLogReport students={data} classMap={studentResults.classMap} resultsData={studentResults.results} settings={settings} />;
                 break;
            default:
                ReportComponent = <div></div>;
        }

        return (
            <div className="transform scale-[0.8] origin-top mx-auto">
              <ReportPage settings={settings} title={title} pageNumber={1} totalPages={Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1}>
                {ReportComponent}
              </ReportPage>
            </div>
        );
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg">
            {isExporting && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex flex-col justify-center items-center z-50 text-white">
                    <Loader2 className="animate-spin h-16 w-16 mb-4" />
                    <p className="text-2xl font-bold mb-2">جاري التصدير...</p>
                    <div className="w-1/2 bg-gray-600 rounded-full h-4"><div className="bg-cyan-500 h-4 rounded-full" style={{ width: `${exportProgress}%` }}></div></div>
                    <p className="mt-2 text-lg">{exportProgress}%</p>
                </div>
            )}
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">الأحصائيات والتقارير</h2>
            
            {activeTab !== 'overall_percentages' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <label className="block text-md font-bold text-gray-700 mb-2">1. اختر المرحلة</label>
                        <select onChange={e => {setSelectedStage(e.target.value); setSelectedClassIds([]);}} value={selectedStage} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500">
                            <option value="">-- اختر مرحلة --</option>
                            {GRADE_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-md font-bold text-gray-700 mb-2">2. اختر الشعب</label>
                        <div className="space-y-2 p-2 border rounded-lg max-h-32 overflow-y-auto">
                            {selectedStage && classesInSelectedStage.length > 0 ? classesInSelectedStage.map(c => (
                                <label key={c.id} className="flex items-center gap-3 p-1 rounded-md hover:bg-gray-100 cursor-pointer">
                                    <input type="checkbox" checked={selectedClassIds.includes(c.id)} onChange={() => setSelectedClassIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])} className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"/>
                                    <span className="font-semibold">{c.stage} - {c.section}</span>
                                    <span className="text-sm text-gray-500">({(c.students || []).length} طالب)</span>
                                </label>
                            )) : <p className="text-gray-500 text-center">اختر مرحلة لعرض الشعب.</p>}
                        </div>
                    </div>
                </div>
            )}


            <div className="flex items-center justify-between border-b-2 mb-4">
                <div className="flex flex-wrap gap-1">
                    {REPORT_TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 font-semibold rounded-t-lg transition-colors ${activeTab === tab.key ? 'bg-cyan-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>
                {activeTab !== 'overall_percentages' && (
                    <button onClick={handleExportPdf} disabled={isExporting || filteredData.length === 0} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:bg-gray-400">
                        <FileDown size={20} />
                        <span>تصدير PDF</span>
                    </button>
                )}
            </div>
            
            <div className="bg-gray-100 p-4 rounded-lg overflow-x-auto min-h-[400px]">
                {renderActiveReportForDisplay()}
            </div>
        </div>
    );
}