import React from 'react';
import type { ClassData, SchoolSettings, Student, StudentResult, CalculatedGrade, Subject, SubjectGrade } from '../types';

interface AdminReportCardProps {
    student: Student;
    classData: ClassData;
    settings: SchoolSettings;
    studentResultData: {
        finalCalculatedGrades: Record<string, CalculatedGrade>;
        result: StudentResult;
    };
    logos: {
        school: string | null;
        ministry: string | null;
    };
    studentIndex: number;
    exportWithGrades: boolean;
}

const DEFAULT_SUBJECT_GRADE: SubjectGrade = { firstTerm: null, midYear: null, secondTerm: null, finalExam1st: null, finalExam2nd: null };
const DEFAULT_CALCULATED_GRADE: CalculatedGrade = { annualPursuit: null, finalGrade1st: null, finalGradeWithDecision: null, decisionApplied: 0, finalGrade2nd: null, isExempt: false };

const VerticalHeader: React.FC<{ children: React.ReactNode; className?: string; textSize?: string }> = ({ children, className = '', textSize = 'text-lg' }) => {
    return (
        <th className={`p-0 border-2 border-black align-middle text-center h-48 ${className}`}>
            <div className="h-full w-full flex items-center justify-center relative">
                <span 
                    className={`absolute font-bold ${textSize}`}
                    style={{
                        transform: 'rotate(-90deg)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {children}
                </span>
            </div>
        </th>
    );
};


const GradeCell: React.FC<{ value: number | null | undefined, className?: string }> = ({ value, className = '' }) => {
    return (
        <td className={`border-2 border-black text-center font-bold text-lg p-1 ${className}`}>
            {value ?? ''}
        </td>
    );
};


export default function AdminReportCard({ student, classData, settings, studentResultData, logos, studentIndex, exportWithGrades }: AdminReportCardProps) {
    const { finalCalculatedGrades, result } = studentResultData;

    const renderLogo = (logo: string | null, defaultText: string) => {
        return (
            <div className="h-24 w-24 flex items-center justify-center text-center text-sm p-1">
                {logo ? 
                    <img src={logo} alt={defaultText} className="h-full w-full object-contain" /> :
                    <div className="h-20 w-20 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-500">
                        {defaultText}
                    </div>
                }
            </div>
        )
    };
    
    // To match the image, we need a fixed number of rows.
    const totalRows = 14; 
    const allTableRows: (Subject | undefined)[] = Array.from({ length: totalRows }).map((_, i) => (classData.subjects || [])[i]);

    return (
        <div className="w-[794px] h-[1123px] p-4 bg-white font-['Cairo'] flex flex-col" dir="rtl">
            
            <header className="flex justify-between items-center mb-2">
                {renderLogo(logos.ministry, 'شعار الوزارة')}
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-red-600">سجل</h1>
                    <h2 className="text-2xl font-bold text-red-600">الدرجات للمدارس المتوسطة والثانوية</h2>
                    <p className="text-xl font-bold text-blue-700 mt-1">السنة الدراسية: {settings.academicYear}</p>
                </div>
                {renderLogo(logos.school, 'شعار المدرسة')}
            </header>
            
            <div className="grid grid-cols-2 gap-x-4 mb-2 text-md font-bold">
                <div className="text-right">إدارة : {settings.schoolName}</div>
                <div className="text-left">رقمه في سجل القيد: {student.registrationId || ''}</div>
                <div className="col-span-2 text-center my-1">
                    <p className="text-2xl font-extrabold">{student.name}</p>
                </div>
                <div className="text-right"><span className="text-green-600">الصف والشعبة:</span> {classData.stage} / {classData.section}</div>
                 <div className="text-left"><span className="text-red-600">المواليد:</span> {student.birthDate || ''}</div>
            </div>

            <main className="flex-grow">
                <table className="w-full border-collapse border-2 border-black">
                    <thead className="bg-yellow-400 text-black font-bold">
                        <tr>
                            <VerticalHeader className="w-[18%]">الدروس</VerticalHeader>
                            <VerticalHeader className="w-[7%]">معدل الفصل الاول</VerticalHeader>
                            <VerticalHeader className="w-[7%]">نصف السنة</VerticalHeader>
                            <VerticalHeader className="w-[7%]">معدل الفصل الثاني</VerticalHeader>
                            <VerticalHeader className="w-[7%]">درجة السعي السنوي</VerticalHeader>
                            <VerticalHeader className="w-[7%]">درجة الامتحان النهائي</VerticalHeader>
                            <VerticalHeader className="w-[7%]">الدرجة النهائية</VerticalHeader>
                            <VerticalHeader className="w-[7%]">درجة الاكمال</VerticalHeader>
                            <VerticalHeader className="w-[7%]" textSize="text-sm">الدرجة النهائية بعد الاكمال</VerticalHeader>
                            <VerticalHeader className="w-[19%]">النتيجة</VerticalHeader>
                        </tr>
                    </thead>
                    <tbody>
                        {allTableRows.map((item, index) => {
                            const isSubjectRow = item != null;
                            const grades = isSubjectRow ? (student.grades?.[item.name] || DEFAULT_SUBJECT_GRADE) : DEFAULT_SUBJECT_GRADE;
                            const calculated = isSubjectRow ? (finalCalculatedGrades[item.name] || DEFAULT_CALCULATED_GRADE) : DEFAULT_CALCULATED_GRADE;

                            return (
                                <tr key={isSubjectRow ? item.id : `empty-${index}`} className="h-14">
                                    {isSubjectRow ? (
                                        <>
                                            <td className="border-2 border-black font-extrabold text-lg text-right align-top px-2 pt-1">{item.name}</td>
                                            {exportWithGrades ? (
                                                <>
                                                    <GradeCell value={grades.firstTerm} />
                                                    <GradeCell value={grades.midYear} />
                                                    <GradeCell value={grades.secondTerm} />
                                                    <GradeCell value={calculated.annualPursuit} className="bg-orange-100" />
                                                    <GradeCell value={grades.finalExam1st} className="bg-orange-100" />
                                                    <GradeCell value={calculated.finalGradeWithDecision} className="bg-orange-100" />
                                                    <GradeCell value={grades.finalExam2nd} className="bg-pink-100" />
                                                    <GradeCell value={calculated.finalGrade2nd} className="bg-pink-100" />
                                                </>
                                            ) : (
                                                <>
                                                    <td className="border-2 border-black"></td>
                                                    <td className="border-2 border-black"></td>
                                                    <td className="border-2 border-black"></td>
                                                    <td className="border-2 border-black bg-orange-100"></td>
                                                    <td className="border-2 border-black bg-orange-100"></td>
                                                    <td className="border-2 border-black bg-orange-100"></td>
                                                    <td className="border-2 border-black bg-pink-100"></td>
                                                    <td className="border-2 border-black bg-pink-100"></td>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <td className="border-2 border-black"></td>
                                            <td className="border-2 border-black"></td>
                                            <td className="border-2 border-black"></td>
                                            <td className="border-2 border-black"></td>
                                            <td className="border-2 border-black bg-orange-100"></td>
                                            <td className="border-2 border-black bg-orange-100"></td>
                                            <td className="border-2 border-black bg-orange-100"></td>
                                            <td className="border-2 border-black bg-pink-100"></td>
                                            <td className="border-2 border-black bg-pink-100"></td>
                                        </>
                                    )}

                                    {index === 0 && (
                                        <td rowSpan={totalRows > 0 ? totalRows : 1} className="border-2 border-black align-middle">
                                            {exportWithGrades && (
                                                <div className="h-full w-full flex items-center justify-center relative">
                                                    <span 
                                                        className="absolute font-bold text-xl"
                                                        style={{
                                                            transform: 'rotate(-90deg)',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {result.status === 'قيد الانتظار' ? '' : result.message}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </main>

            <footer className="mt-auto text-md font-bold pt-2">
                <div className="flex justify-between items-start">
                    <div className="text-right">
                        <p>درجة السلوك درجة</p>
                        <p className="mt-4">سنوات الرسوب : {student.yearsOfFailure || ''}</p>
                    </div>

                    <div className="text-center">
                        <p>درجة المواظبة النهائية</p>
                        <div className="w-24 h-12 bg-fuchsia-500 text-white flex items-center justify-center font-bold mx-auto border-2 border-black mt-1">
                            <span style={{ position: 'relative', bottom: '7px', fontWeight: 'bolder', fontSize: '1.75rem' }}>
                                {student.examId}
                            </span>
                        </div>
                    </div>

                    <div className="text-center">
                        <p className="mb-2">{settings.principalName}</p>
                        <p>اسم مدير المدرسة</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}