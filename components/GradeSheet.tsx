import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { ClassData, Student, SubjectGrade, SchoolSettings, CalculatedGrade, StudentResult } from '../types';
import { calculateStudentResult } from '../lib/gradeCalculator';
import { UserPlus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/firebase';


interface GradeSheetProps {
    classData: ClassData;
    settings: SchoolSettings;
}

const DEFAULT_SUBJECT_GRADE: SubjectGrade = {
    firstTerm: null, midYear: null, secondTerm: null, finalExam1st: null, finalExam2nd: null,
    october: null, november: null, december: null, january: null, february: null, march: null, april: null,
};

const DEFAULT_CALCULATED_GRADE: CalculatedGrade = {
    annualPursuit: null, finalGrade1st: null, finalGradeWithDecision: null, decisionApplied: 0,
    finalGrade2nd: null, isExempt: false, annualPursuitWithDecision: null, decisionAppliedOnPursuit: 0,
};

// Stage Type Constants
const PRIMARY_1_4_STAGES = ['الاول ابتدائي', 'الثاني ابتدائي', 'الثالث ابتدائي', 'الرابع ابتدائي'];
const PRIMARY_5_STAGE = 'الخامس ابتدائي';
const PRIMARY_6_STAGE = 'السادس ابتدائي';
const MINISTERIAL_STAGES = ['الثالث متوسط', 'السادس العلمي', 'السادس الادبي', PRIMARY_6_STAGE];


const GradeInput: React.FC<{
    studentId: string;
    subjectName: string;
    field: keyof SubjectGrade;
    value: number | null;
    onGradeChange: (studentId: string, subjectName: string, field: keyof SubjectGrade, value: number | null) => void;
    onEnterPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onAutoAdvance: (input: HTMLInputElement | null) => void;
    max: number;
}> = ({ studentId, subjectName, field, value, onGradeChange, onEnterPress, onAutoAdvance, max }) => {
    
    const [localValue, setLocalValue] = useState(value === null ? '' : String(value));

    useEffect(() => {
        setLocalValue(value === null ? '' : String(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const inputElement = e.currentTarget;
        setLocalValue(val);

        if (val === '') return;
        
        const numericValue = parseInt(val, 10);
        if (isNaN(numericValue) || numericValue > max || numericValue < 0) {
            return;
        }

        let shouldAdvance = false;
        if (max === 100) {
            if (numericValue >= 11) {
                shouldAdvance = true;
            }
        } else if (max === 10) {
            if (numericValue === 10) {
                shouldAdvance = true;
            }
        }

        if (shouldAdvance) {
            onGradeChange(studentId, subjectName, field, numericValue);
            setTimeout(() => onAutoAdvance(inputElement), 0);
        }
    };

    const handleBlur = () => {
        if (localValue === '') {
             onGradeChange(studentId, subjectName, field, null);
             return;
        }
        
        let numericValue = parseInt(localValue, 10);
        if (isNaN(numericValue) || numericValue < 0) {
            numericValue = 0;
        } else if (numericValue > max) {
            numericValue = max;
        }
        
        onGradeChange(studentId, subjectName, field, numericValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.repeat && e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            return;
        }
        onEnterPress(e);
    };
    
    return (
        <input
            type="number"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            data-student-id={studentId}
            data-subject-name={subjectName}
            data-field={field}
            className="w-full h-full text-center bg-white text-black border-0 focus:ring-1 focus:ring-inset focus:ring-cyan-500 p-1 outline-none"
            min="0"
            max={max}
        />
    );
};


export default function GradeSheet({ classData, settings }: GradeSheetProps): React.ReactNode {
    const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
    const [newStudentData, setNewStudentData] = useState({ name: '', registrationId: '', birthDate: '', examId: '' });
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollButtons, setShowScrollButtons] = useState(false);
    
    const students = useMemo(() => classData.students || [], [classData.students]);
    const subjects = useMemo(() => classData.subjects || [], [classData.subjects]);
    
    const stageType = useMemo(() => {
        if (PRIMARY_1_4_STAGES.includes(classData.stage)) return 'primary1_4';
        if (classData.stage === PRIMARY_5_STAGE) return 'primary5';
        if (classData.stage === PRIMARY_6_STAGE) return 'primary6';
        if (MINISTERIAL_STAGES.includes(classData.stage)) return 'ministerial';
        return 'standard';
    }, [classData.stage]);

    const maxGrade = stageType === 'primary1_4' ? 10 : 100;
    
    const columnConfig = useMemo(() => {
        switch(stageType) {
            case 'primary1_4': return [
                { key: 'midYear', header: 'نصف السنة', type: 'input' },
                { key: 'finalExam1st', header: 'الامتحان النهائي', type: 'input' },
                { key: 'finalExam2nd', header: 'الاكمال', type: 'input' },
            ];
            case 'primary5': return [
                { key: 'october', header: 'تشرين الاول', type: 'input' },
                { key: 'november', header: 'تشرين الثاني', type: 'input' },
                { key: 'december', header: 'كانون الاول', type: 'input' },
                { key: 'january', header: 'كانون الثاني', type: 'input' },
                { key: 'firstTerm', header: 'الفصل الاول', type: 'calculated-term1' },
                { key: 'midYear', header: 'نصف السنة', type: 'input' },
                { key: 'february', header: 'شباط', type: 'input' },
                { key: 'march', header: 'اذار', type: 'input' },
                { key: 'april', header: 'نيسان', type: 'input' },
                { key: 'secondTerm', header: 'الفصل الثاني', type: 'calculated-term2' },
                { key: 'annualPursuit', header: 'السعي السنوي', type: 'calculated-result' },
                { key: 'finalExam1st', header: 'الامتحان النهائي', type: 'input' },
                { key: 'finalGradeWithDecision', header: 'الدرجة النهائية', type: 'calculated-final' },
                { key: 'finalExam2nd', header: 'الاكمال', type: 'input' },
                { key: 'finalGrade2nd', header: 'الدرجة بعد الاكمال', type: 'calculated-result' },
            ];
            case 'primary6': return [
                 { key: 'october', header: 'تشرين الاول', type: 'input' },
                 { key: 'november', header: 'تشرين الثاني', type: 'input' },
                 { key: 'december', header: 'كانون الاول', type: 'input' },
                 { key: 'january', header: 'كانون الثاني', type: 'input' },
                 { key: 'firstTerm', header: 'الفصل الاول', type: 'calculated-term1' },
                 { key: 'midYear', header: 'نصف السنة', type: 'input' },
                 { key: 'february', header: 'شباط', type: 'input' },
                 { key: 'march', header: 'اذار', type: 'input' },
                 { key: 'april', header: 'نيسان', type: 'input' },
                 { key: 'secondTerm', header: 'الفصل الثاني', type: 'calculated-term2' },
                 { key: 'annualPursuit', header: 'السعي السنوي', type: 'calculated-result' },
            ];
            case 'ministerial': return [
                 { key: 'firstTerm', header: 'الفصل الأول', type: 'input' },
                 { key: 'midYear', header: 'نصف السنة', type: 'input' },
                 { key: 'secondTerm', header: 'الفصل الثاني', type: 'input' },
                 { key: 'annualPursuitWithDecision', header: 'السعي السنوي', type: 'calculated-pursuit' }
            ];
            case 'standard':
            default: return [
                 { key: 'firstTerm', header: 'الفصل الأول', type: 'input' },
                 { key: 'midYear', header: 'نصف السنة', type: 'input' },
                 { key: 'secondTerm', header: 'الفصل الثاني', type: 'input' },
                 { key: 'annualPursuit', header: 'السعي السنوي', type: 'calculated-result' },
                 { key: 'finalExam1st', header: 'الامتحان النهائي', type: 'input-exempt' },
                 { key: 'finalGradeWithDecision', header: 'الدرجة النهائية', type: 'calculated-final' },
                 { key: 'finalExam2nd', header: 'الاكمال', type: 'input' },
                 { key: 'finalGrade2nd', header: 'الدرجة بعد الاكمال', type: 'calculated-result' },
            ];
        }
    }, [stageType]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const checkScroll = () => container && setShowScrollButtons(container.scrollWidth > container.clientWidth);
        const resizeObserver = new ResizeObserver(checkScroll);
        resizeObserver.observe(container);
        checkScroll();
        return () => resizeObserver.disconnect();
    }, [students, subjects, columnConfig]);


    const handleGradeChange = useCallback((studentId: string, subjectName: string, field: keyof SubjectGrade, value: number | null) => {
        const studentIndex = (classData.students || []).findIndex(s => s.id === studentId);
        if (studentIndex === -1) return;
        const gradePath = `classes/${classData.id}/students/${studentIndex}/grades/${subjectName}/${field}`;
        db.ref(gradePath).set(value);
    }, [classData]);

    const handleAutoAdvance = useCallback((currentInput: HTMLInputElement | null) => {
        if (!currentInput?.form) return;
        const { studentId, subjectName, field } = currentInput.dataset;
        if (!studentId || !subjectName || !field) return;
        
        const currentStudentIndex = students.findIndex(s => s.id === studentId);
        if (currentStudentIndex !== -1 && currentStudentIndex < students.length - 1) {
            const nextStudentId = students[currentStudentIndex + 1].id;
            const nextInput = currentInput.form.querySelector(`input[data-student-id="${nextStudentId}"][data-subject-name="${subjectName}"][data-field="${field}"]`) as HTMLInputElement;
            if (nextInput) { nextInput.focus(); nextInput.select(); }
        }
    }, [students]);

    const handleEnterPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); handleAutoAdvance(e.currentTarget); }
    };
    
    const handleAddStudent = useCallback(() => {
        if (!newStudentData.name.trim()) { alert('يرجى إدخال اسم الطالب على الأقل.'); return; }
        const studentToAdd: Student = {
            id: uuidv4(), name: newStudentData.name.trim(), registrationId: newStudentData.registrationId.trim(),
            birthDate: newStudentData.birthDate.trim(), examId: newStudentData.examId.trim(), grades: {},
        };
        const updatedStudents = [...students, studentToAdd].sort((a,b) => (a.examId || '').localeCompare(b.examId || '', undefined, { numeric: true }));
        db.ref(`classes/${classData.id}`).update({ students: updatedStudents });
        setIsAddStudentModalOpen(false);
        setNewStudentData({ name: '', registrationId: '', birthDate: '', examId: '' });
    }, [newStudentData, classData, students]);

    const handleDeleteStudent = useCallback((studentIdToDelete: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الطالب وجميع درجاته؟ لا يمكن التراجع عن هذا الإجراء.')) {
            const updatedStudents = students.filter(s => s.id !== studentIdToDelete);
            db.ref(`classes/${classData.id}`).update({ students: updatedStudents });
        }
    }, [classData, students]);
    
    const results = useMemo(() => {
        const studentResults: Record<string, { finalCalculatedGrades: Record<string, CalculatedGrade>, result: StudentResult }> = {};
        students.forEach(student => {
            studentResults[student.id] = calculateStudentResult(student, subjects, settings, classData);
        });
        return studentResults;
    }, [students, subjects, settings, classData]);
    
    const renderFinalGradeCell = (originalGrade: number | null, decisionGrade: number | null, decisionApplied: number) => {
        if (decisionGrade === null) return <span className="text-gray-400">-</span>;
        if (decisionApplied > 0 && decisionGrade === 50) {
            return (
                <div className="text-black font-bold flex items-center justify-center gap-2">
                    <span className="line-through text-gray-500">{originalGrade}</span>
                    <span>{decisionGrade}</span>
                </div>
            );
        }
        return <span className="text-black font-bold">{decisionGrade}</span>;
    }

    const renderAnnualPursuitCell = (originalGrade: number | null, decisionGrade: number | null, decisionApplied: number) => {
        if (decisionGrade === null) return <span className="text-gray-400">-</span>;
        if (decisionApplied > 0 && decisionGrade === 50) {
            return (
                <div className="text-black font-bold flex items-center justify-center gap-2">
                    <span className="line-through text-gray-500">{originalGrade}</span>
                    <span>{decisionGrade}</span>
                </div>
            );
        }
        return <span className="text-black font-bold">{decisionGrade}</span>;
    }

    const getResultCellStyle = (status: StudentResult['status']) => {
        switch (status) {
            case 'ناجح': case 'مؤهل': return 'bg-green-100 text-green-800';
            case 'مكمل': case 'مؤهل بقرار': return 'bg-yellow-100 text-yellow-800';
            case 'راسب': case 'غير مؤهل': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    
    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
            {isAddStudentModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-4">إضافة طالب جديد يدوياً</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">اسم الطالب (مطلوب)</label>
                                <input type="text" name="name" value={newStudentData.name} onChange={e => setNewStudentData(p=>({...p, name: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" required autoFocus/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">الرقم الامتحاني</label>
                                <input type="text" name="examId" value={newStudentData.examId} onChange={e => setNewStudentData(p=>({...p, examId: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">رقم القيد</label>
                                <input type="text" name="registrationId" value={newStudentData.registrationId} onChange={e => setNewStudentData(p=>({...p, registrationId: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">التولد</label>
                                <input type="text" name="birthDate" value={newStudentData.birthDate} onChange={e => setNewStudentData(p=>({...p, birthDate: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setIsAddStudentModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">إلغاء</button>
                            <button onClick={handleAddStudent} className="px-4 py-2 bg-cyan-600 text-white rounded-md">إضافة الطالب</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-start mb-2">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">سجل درجات: {classData.stage} - {classData.section}</h2>
                    <p className="text-sm text-gray-500 mt-1">العام الدراسي: {settings.academicYear} | مدير المدرسة: {settings.principalName}</p>
                </div>
                <button onClick={() => setIsAddStudentModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                    <UserPlus size={20} /><span>إضافة طالب</span>
                </button>
            </div>
             <p className="text-sm text-gray-500 mb-6">مجموع الطلاب: {students.length}</p>
            <div className="relative">
                 <div ref={scrollContainerRef} className="overflow-x-auto">
                    <form>
                    <table className="min-w-full border-collapse border border-gray-400 text-sm">
                        <thead className="bg-gray-200 text-gray-700 font-bold sticky top-0 z-30">
                            <tr>
                                <th rowSpan={2} className="border border-gray-300 p-2 sticky right-0 left-auto bg-gray-200 z-40 w-[50px] min-w-[50px]">ت</th>
                                <th rowSpan={2} className="border border-gray-300 p-2 sticky right-[50px] left-auto bg-gray-200 z-40 w-[200px] min-w-[200px]">اسم الطالب</th>
                                <th rowSpan={2} className="border border-gray-300 p-1 sticky right-[250px] left-auto bg-gray-200 z-40 w-[50px] min-w-[50px] font-medium" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}>الرقم الامتحاني</th>
                                {subjects.map((subject, i) => (
                                    <th key={subject.id} colSpan={columnConfig.length} className="border border-gray-300 p-2 whitespace-nowrap" style={{backgroundColor: ['#fde68a', '#a5f3fc', '#f9a8d4', '#a7f3d0', '#d8b4fe'][i % 5]}}>
                                        {subject.name}
                                    </th>
                                ))}
                                <th rowSpan={2} className="border border-gray-300 p-2 min-w-[250px] bg-yellow-300">
                                    {MINISTERIAL_STAGES.includes(classData.stage) ? "نتيجة التأهيل الوزاري" : "النتيجة النهائية"}
                                </th>
                                <th rowSpan={2} className="border border-gray-300 p-2 bg-gray-200 w-[60px] min-w-[60px]">إجراءات</th>
                            </tr>
                            <tr>
                                {subjects.map(subject => columnConfig.map(col => (
                                    <th key={`${subject.id}-${col.key}`} className="border border-gray-300 p-1 font-medium whitespace-nowrap text-[10px] w-[55px] min-w-[55px] h-[100px]" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}>{col.header}</th>
                                )))}
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((student, studentIndex) => {
                                 const studentResultData = results[student.id] || { finalCalculatedGrades: {}, result: { status: 'قيد الانتظار', message: ''} };
                                 const rowBgStyle = { backgroundColor: studentIndex % 2 === 0 ? 'white' : '#F9FAFB' };
                                return (
                                    <tr key={student.id} className="hover:bg-cyan-50">
                                        <td className="border border-gray-300 p-2 text-center sticky right-0 left-auto z-10" style={rowBgStyle}>{studentIndex + 1}</td>
                                        <td className="border border-gray-300 p-2 font-semibold sticky right-[50px] left-auto z-10" style={rowBgStyle}>{student.name}</td>
                                        <td className="border border-gray-300 p-2 text-center sticky right-[250px] left-auto z-10" style={rowBgStyle}>{student.examId}</td>
                                        {subjects.map(subject => {
                                            const grade = { ...DEFAULT_SUBJECT_GRADE, ...(student.grades?.[subject.name] || {}) };
                                            const calculated = studentResultData.finalCalculatedGrades[subject.name] || DEFAULT_CALCULATED_GRADE;
                                            return (
                                                <React.Fragment key={subject.id}>
                                                    {columnConfig.map(col => {
                                                        const cellKey = `${student.id}-${subject.id}-${col.key}`;
                                                        if (col.type.startsWith('input')) {
                                                            if (col.type === 'input-exempt' && calculated.isExempt) {
                                                                return <td key={cellKey} className="border border-gray-300"><div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-800 font-semibold">معفو</div></td>;
                                                            }
                                                            return <td key={cellKey} className="border border-gray-300 p-0"><GradeInput studentId={student.id} subjectName={subject.name} field={col.key as keyof SubjectGrade} value={grade[col.key as keyof SubjectGrade] as number | null} onGradeChange={handleGradeChange} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} max={maxGrade} /></td>;
                                                        }
                                                        if (col.type === 'calculated-term1') {
                                                            const term = Math.round(((grade.october ?? 0) + (grade.november ?? 0) + (grade.december ?? 0) + (grade.january ?? 0)) / 4);
                                                            return <td key={cellKey} className="border border-gray-300 text-center font-semibold bg-gray-100">{!isNaN(term) ? term : '-'}</td>;
                                                        }
                                                        if (col.type === 'calculated-term2') {
                                                            const term = Math.round(((grade.february ?? 0) + (grade.march ?? 0) + (grade.april ?? 0)) / 3);
                                                            return <td key={cellKey} className="border border-gray-300 text-center font-semibold bg-gray-100">{!isNaN(term) ? term : '-'}</td>;
                                                        }
                                                        if (col.type === 'calculated-result') {
                                                            return <td key={cellKey} className="border border-gray-300 text-center font-semibold bg-gray-100">{calculated[col.key as keyof CalculatedGrade] ?? '-'}</td>;
                                                        }
                                                        if (col.type === 'calculated-final') return <td key={cellKey} className="border border-gray-300 text-center">{renderFinalGradeCell(calculated.finalGrade1st, calculated.finalGradeWithDecision, calculated.decisionApplied)}</td>;
                                                        if (col.type === 'calculated-pursuit') return <td key={cellKey} className="border border-gray-300 text-center">{renderAnnualPursuitCell(calculated.annualPursuit, calculated.annualPursuitWithDecision, calculated.decisionAppliedOnPursuit || 0)}</td>;
                                                        return <td key={cellKey} className="border border-gray-300"></td>;
                                                    })}
                                                </React.Fragment>
                                            )
                                        })}
                                        <td className={`border border-gray-300 p-2 text-center font-bold text-sm ${getResultCellStyle(studentResultData.result.status)}`}>{studentResultData.result.message}</td>
                                        <td className="border border-gray-300 p-1 text-center">
                                            <button type="button" onClick={() => handleDeleteStudent(student.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full" title="حذف الطالب"><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    </form>
                </div>

                {showScrollButtons && (
                    <>
                        <button onClick={() => scrollContainerRef.current?.scrollBy({ left: -300, behavior: 'smooth' })} className="absolute right-0 top-1/2 -translate-y-1/2 z-40 bg-black/40 text-white p-2 rounded-full" aria-label="Scroll left"><ChevronRight size={24} /></button>
                        <button onClick={() => scrollContainerRef.current?.scrollBy({ left: 300, behavior: 'smooth' })} className="absolute left-0 top-1/2 -translate-y-1/2 z-40 bg-black/40 text-white p-2 rounded-full" aria-label="Scroll right"><ChevronLeft size={24} /></button>
                    </>
                )}
            </div>
        </div>
    );
}