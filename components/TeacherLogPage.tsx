import React from 'react';
import type { SchoolSettings, Student, StudentResult, CalculatedGrade, SubjectGrade } from '../types';
import { numberToArabicWords } from '../lib/numberToWords';
import type { DetailedStats } from './TeacherLogExporter';

const DEFAULT_SUBJECT_GRADE: SubjectGrade = { firstTerm: null, midYear: null, secondTerm: null, finalExam1st: null, finalExam2nd: null };
const DEFAULT_CALCULATED_GRADE: CalculatedGrade = { annualPursuit: null, finalGrade1st: null, finalGradeWithDecision: null, decisionApplied: 0, finalGrade2nd: null, isExempt: false };

interface TeacherLogPageProps {
    settings: SchoolSettings;
    logos: { school: string | null; ministry: string | null };
    pageData: {
        students: Student[];
        classInfo: { stage: string; sections: string };
        subjectName: string;
        teacherName: string;
    };
    resultsData: Map<string, { finalCalculatedGrades: Record<string, CalculatedGrade>; result: StudentResult }>;
    stats: DetailedStats;
    pageNumber: number;
    totalPages: number;
    showSummary: boolean;
    maxRows: number;
    startingIndex: number;
}

const GradeCell: React.FC<{ value: number | null, className?: string }> = ({ value, className = '' }) => (
    <td className={`border-l border-black text-center px-1 align-top ${className}`}>
        {value !== null && value !== undefined ? value : ''}
    </td>
);

const StatsRow: React.FC<{ title: string; stats: DetailedStats[keyof DetailedStats]; colorClass: string }> = ({ title, stats, colorClass }) => (
    <tr className={colorClass}>
        <td className="border border-black p-2 font-bold">{title}</td>
        <td className="border border-black p-2 text-center font-bold">{stats.total > 0 ? stats.total : ''}</td>
        <td className="border border-black p-2 text-center font-bold">{stats.total > 0 ? stats.passed : ''}</td>
        <td className="border border-black p-2 text-center font-bold">{stats.total > 0 ? stats.failed : ''}</td>
        <td className="border border-black p-2 text-center font-bold">{stats.total > 0 ? stats.passRate : ''}</td>
    </tr>
);


export default function TeacherLogPage({ settings, logos, pageData, resultsData, stats, pageNumber, totalPages, showSummary, maxRows, startingIndex }: TeacherLogPageProps) {

    const { students, classInfo, subjectName, teacherName } = pageData;

    const renderLogo = (logo: string | null, defaultText: string) => (
        <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center p-1">
            {logo ? 
                <img src={logo} alt={defaultText} className="h-full w-full object-contain rounded-full bg-white" /> :
                <span className="text-white text-center text-sm font-bold">{defaultText}</span>
            }
        </div>
    );

    // If it's the summary (last) page, add exactly 1 empty row.
    // Otherwise, pad with empty rows to fill the page for consistent layout.
    const emptyRowsCount = showSummary ? 1 : Math.max(0, maxRows - students.length);
    const emptyRows = Array.from({ length: emptyRowsCount });

    return (
        <div className="w-[794px] h-[1123px] p-8 bg-white flex flex-col font-['Cairo']" style={{ direction: 'rtl' }}>
            {/* Header */}
            <header className="flex justify-between items-center mb-2">
                {renderLogo(logos.ministry, 'شعار الوزارة')}
                <div className="text-center">
                    <h1 className="text-xl font-bold">{settings.schoolName}</h1>
                    <h2 className="text-2xl font-bold">سجل درجات المدرسين في المدارس المتوسطة</h2>
                    <p className="text-lg font-semibold">الصف: {classInfo.stage} - الشعبة: {classInfo.sections}</p>
                    <p className="text-lg font-semibold">السنة الدراسية {settings.academicYear}</p>
                </div>
                {renderLogo(logos.school, 'شعار المدرسة')}
            </header>
            <div className="text-lg font-semibold mb-2">الموضوع: {subjectName}</div>

            {/* Main Table */}
            <main className="flex-grow">
                <table className="w-full border-collapse border-2 border-black text-sm">
                    <thead className="bg-yellow-300 font-bold">
                        <tr>
                            <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[4%]">تسلسل</th>
                            <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[20%] whitespace-nowrap">اسم الطالب</th>
                            <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[8%]">معدل الفصل الأول</th>
                            <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[8%]">نصف السنة</th>
                            <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[8%]">معدل الفصل الثاني</th>
                            <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[9%]">درجة السعي السنوي</th>
                            <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[9%]">درجة امتحان اخر السنة</th>
                            <th colSpan={2} className="border-2 border-black p-1 w-[18%]">الدرجة النهائية</th>
                            <th rowSpan={2} className="border-2 border-black p-1 align-middle">الملاحظات</th>
                        </tr>
                        <tr>
                            <th className="border-2 border-black p-1">رقما</th>
                            <th className="border-2 border-black p-1">كتابة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student, index) => {
                            const result = resultsData.get(student.id)?.finalCalculatedGrades[subjectName] || DEFAULT_CALCULATED_GRADE;
                            const grade = student.grades?.[subjectName] || DEFAULT_SUBJECT_GRADE;
                            const finalGrade = result.finalGradeWithDecision;
                            const status = finalGrade !== null ? (finalGrade >= 50 ? 'ناجح' : 'راسب') : '';

                            return (
                                <tr key={student.id} className="h-[32px] border-b border-black odd:bg-white even:bg-yellow-50">
                                    <td className="border-l border-black text-center align-top">{startingIndex + index + 1}</td>
                                    <td className="border-l border-black text-center px-1 font-bold align-top whitespace-nowrap">{student.name}</td>
                                    <GradeCell value={grade.firstTerm} />
                                    <GradeCell value={grade.midYear} />
                                    <GradeCell value={grade.secondTerm} />
                                    <GradeCell value={result.annualPursuit} />
                                    <GradeCell value={grade.finalExam1st} />
                                    <td className="border-l border-black text-center align-top">{finalGrade}</td>
                                    <td className="border-l border-black text-center text-xs px-1 align-top">{numberToArabicWords(finalGrade ?? -1)}</td>
                                    <td className="border-l border-black text-center align-top">{status}</td>
                                </tr>
                            );
                        })}
                        {emptyRows.map((_, index) => (
                             <tr key={`empty-${index}`} className="h-[32px] border-b border-black odd:bg-white even:bg-yellow-50">
                                <td className="border-l border-black text-center align-top">{startingIndex + students.length + index + 1}</td>
                                <td className="border-l border-black"></td>
                                <td className="border-l border-black"></td>
                                <td className="border-l border-black"></td>
                                <td className="border-l border-black"></td>
                                <td className="border-l border-black"></td>
                                <td className="border-l border-black"></td>
                                <td className="border-l border-black"></td>
                                <td className="border-l border-black"></td>
                                <td className="border-l border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {showSummary && (
                    <div className="w-full mt-4">
                        <table className="w-full border-collapse border-2 border-black">
                            <thead className="bg-green-200">
                                <tr>
                                    <th className="border border-black p-2 font-bold w-[20%]">الاحصائية</th>
                                    <th className="border border-black p-2 font-bold w-[20%]">العدد الكلي</th>
                                    <th className="border border-black p-2 font-bold w-[20%]">عدد الناجحون</th>
                                    <th className="border border-black p-2 font-bold w-[20%]">عدد الراسبون</th>
                                    <th className="border border-black p-2 font-bold w-[20%]">النسبة الكلية</th>
                                </tr>
                            </thead>
                            <tbody>
                                <StatsRow title="الفصل الاول" stats={stats.firstTerm} colorClass="bg-pink-100" />
                                <StatsRow title="نصف السنة" stats={stats.midYear} colorClass="bg-blue-100" />
                                <StatsRow title="الفصل الثاني" stats={stats.secondTerm} colorClass="bg-yellow-100" />
                                <StatsRow title="السعي السنوي" stats={stats.annualPursuit} colorClass="bg-orange-100" />
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="mt-auto flex justify-between font-bold text-lg">
                <span>اسم مدرس المادة / {teacherName || '..............................'}</span>
                 <span>مدير المدرسة / {settings.principalName}</span>
            </footer>
             <div className="text-center text-xs mt-1">
                صفحة {pageNumber} من {totalPages}
            </div>
        </div>
    );
}