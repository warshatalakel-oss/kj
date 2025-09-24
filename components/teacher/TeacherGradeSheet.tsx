import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ClassData, Teacher, TeacherSubjectGrade, TeacherCalculatedGrade, TeacherSubmission, SchoolSettings, Student } from '../../types';
import { Download, Send, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as ReactDOM from 'react-dom/client';
import TeacherGradeSheetPDF from './TeacherGradeSheetPDF';
import { db } from '../../lib/firebase';

declare const jspdf: any;
declare const html2canvas: any;

interface TeacherGradeSheetProps {
    classData: ClassData;
    teacher: Teacher;
    settings: SchoolSettings;
    isReadOnly?: boolean;
    subjectId?: string; // Passed in read-only mode
}

const DEFAULT_TEACHER_GRADE: TeacherSubjectGrade = {
    firstSemMonth1: null, firstSemMonth2: null, midYear: null, secondSemMonth1: null, secondSemMonth2: null, finalExam: null,
    october: null, november: null, december: null, january: null, february: null, march: null, april: null,
};

const GradeInput: React.FC<{
    value: number | null;
    onChange: (value: number | null) => void;
    onEnterPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    isReadOnly?: boolean;
    onAutoAdvance: (input: HTMLInputElement | null) => void;
    studentId: string;
    field: keyof TeacherSubjectGrade;
    schoolGender?: string;
    max: number;
}> = ({ value, onChange, onEnterPress, isReadOnly = false, onAutoAdvance, studentId, field, schoolGender, max }) => {
    
    const valueToString = useCallback((val: number | null): string => {
        if (val === null) return '';
        if (val === -1) return schoolGender === 'بنات' ? 'غائبة' : 'غائب';
        if (val === -2) return schoolGender === 'بنات' ? 'مجازة' : 'مجاز';
        return String(val);
    }, [schoolGender]);

    const [localValue, setLocalValue] = useState(valueToString(value));

    React.useEffect(() => {
        setLocalValue(valueToString(value));
    }, [value, valueToString]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const inputElement = e.currentTarget;
        setLocalValue(val);

        if (isReadOnly) return;
        
        const numericValue = parseInt(val, 10);
        if (isNaN(numericValue)) {
            return;
        }

        if (numericValue >= 0 && numericValue <= max) {
            const shouldAdvance = String(numericValue).length >= String(max).length && (max < 10 || val !== String(Math.floor(max/10)));

            if (shouldAdvance) {
                onChange(numericValue);
                setTimeout(() => onAutoAdvance(inputElement), 0);
            }
        }
    };
    
    const handleBlur = () => {
        if (isReadOnly) return;
        const trimmedVal = localValue.trim();
        if (trimmedVal === '') {
            onChange(null);
            return;
        }
        if (trimmedVal === 'غ' || trimmedVal === 'غائب' || trimmedVal === 'غائبة') {
            onChange(-1);
            return;
        }
        if (trimmedVal === 'م' || trimmedVal === 'مجاز' || trimmedVal === 'مجازة') {
            onChange(-2);
            return;
        }

        let numericValue = parseInt(trimmedVal, 10);
        if (!isNaN(numericValue)) {
            if (numericValue > max) numericValue = max;
            if (numericValue < 0) numericValue = 0;
            onChange(numericValue);
        } else {
            setLocalValue(valueToString(value));
        }
    };
    
    return (
        <input
            type="text" 
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={onEnterPress}
            data-student-id={studentId}
            data-field={field}
            className="w-full h-full text-center bg-transparent border-0 focus:ring-1 focus:ring-inset focus:ring-cyan-500 p-1 outline-none disabled:bg-gray-100"
            disabled={isReadOnly}
        />
    );
};

export default function TeacherGradeSheet({ classData, teacher, settings, isReadOnly = false, subjectId: readOnlySubjectId }: TeacherGradeSheetProps) {
    const [submissions, setSubmissions] = useState<TeacherSubmission[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    const isPrimary = settings.schoolLevel === 'ابتدائية';
    const isPrimary1_4 = isPrimary && ['الاول ابتدائي', 'الثاني ابتدائي', 'الثالث ابتدائي', 'الرابع ابتدائي'].includes(classData.stage);
    const isPrimary5_6 = isPrimary && ['الخامس ابتدائي', 'السادس ابتدائي'].includes(classData.stage);
    const maxGrade = isPrimary1_4 ? 10 : 100;
    const studentLabel = isPrimary ? 'التلميذ' : 'الطالب';
    const teacherLabel = isPrimary ? 'المعلم' : 'المدرس';

    useEffect(() => {
        if (isReadOnly) return; // Don't fetch submissions in read-only mode.
        const submissionsRef = db.ref('teacher_submissions');
        const callback = (snapshot: any) => {
            const data = snapshot.val();
            setSubmissions(data ? Object.values(data) : []);
        };
        submissionsRef.on('value', callback);
        return () => submissionsRef.off('value', callback);
    }, [isReadOnly]);


    // For teachers, find the first assigned subject for this class. For read-only, use passed prop.
    const activeSubject = useMemo(() => {
        if (isReadOnly) {
            return (classData.subjects || []).find(s => s.id === readOnlySubjectId);
        }
        const assignment = (teacher.assignments || []).find(a => a.classId === classData.id);
        return assignment ? (classData.subjects || []).find(s => s.id === assignment.subjectId) : undefined;
    }, [classData, teacher, isReadOnly, readOnlySubjectId]);
    
    const sortedStudents = useMemo(() => 
        [...(classData.students || [])].sort((a, b) => {
            const aId = a.examId || '';
            const bId = b.examId || '';
            const numA = parseInt(aId, 10);
            const numB = parseInt(bId, 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return aId.localeCompare(bId, undefined, { numeric: true });
        }), 
    [classData.students]);

    const isValidGrade = (g: number | null): g is number => g !== null && g >= 0;

    const calculateGrades = (grade: TeacherSubjectGrade): TeacherCalculatedGrade => {
        const firstSemAvg = (isValidGrade(grade.firstSemMonth1) && isValidGrade(grade.firstSemMonth2))
            ? Math.round((grade.firstSemMonth1 + grade.firstSemMonth2) / 2)
            : null;

        const secondSemAvg = (isValidGrade(grade.secondSemMonth1) && isValidGrade(grade.secondSemMonth2))
            ? Math.round((grade.secondSemMonth1 + grade.secondSemMonth2) / 2)
            : null;
            
        const annualPursuit = (firstSemAvg !== null && isValidGrade(grade.midYear) && secondSemAvg !== null)
            ? Math.round((firstSemAvg + grade.midYear + secondSemAvg) / 3)
            : null;
            
        return { firstSemAvg, secondSemAvg, annualPursuit };
    };

    const calculateGradesForPrimary = (grade: TeacherSubjectGrade): Omit<TeacherCalculatedGrade, 'firstSemAvg' | 'secondSemAvg'> => {
        const { october, november, december, january, february, march, april, midYear } = grade;

        let primaryFirstTerm: number | null = null;
        const firstTermMonths = [october, november, december, january];
        if (firstTermMonths.every(isValidGrade)) {
            primaryFirstTerm = Math.round((october! + november! + december! + january!) / 4);
        }

        let primarySecondTerm: number | null = null;
        const secondTermMonths = [february, march, april];
        if (secondTermMonths.every(isValidGrade)) {
            primarySecondTerm = Math.round((february! + march! + april!) / 3);
        }

        const annualPursuit = (primaryFirstTerm !== null && isValidGrade(midYear) && primarySecondTerm !== null)
            ? Math.round((primaryFirstTerm + midYear + primarySecondTerm) / 3)
            : null;

        return { primaryFirstTerm, primarySecondTerm, annualPursuit };
    };


    const handleGradeChange = useCallback((studentId: string, field: keyof TeacherSubjectGrade, value: number | null) => {
        if (!activeSubject || isReadOnly) return;
        
        const studentIndex = (classData.students || []).findIndex(s => s.id === studentId);
        if (studentIndex === -1) return;

        const gradePath = `classes/${classData.id}/students/${studentIndex}/teacherGrades/${activeSubject.name}/${field}`;
        db.ref(gradePath).set(value);

    }, [classData, activeSubject, isReadOnly]);
    
    const handleAutoAdvance = useCallback((currentInput: HTMLInputElement | null) => {
        if (!currentInput?.form) {
            return;
        }
        
        const { studentId, field } = currentInput.dataset;
        if (!studentId || !field) return;

        const currentStudentIndex = sortedStudents.findIndex(s => s.id === studentId);

        if (currentStudentIndex > -1 && currentStudentIndex < sortedStudents.length - 1) {
            const nextStudentId = sortedStudents[currentStudentIndex + 1].id;
            const nextInput = currentInput.form.querySelector(`input[data-student-id='${nextStudentId}'][data-field='${field}']`) as HTMLInputElement;
            if (nextInput) {
                nextInput.focus();
                nextInput.select();
            }
        }
    }, [sortedStudents]);

    const handleEnterPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = e.currentTarget;
            input.blur();
            handleAutoAdvance(input);
        }
    };
    
    const handleSubmit = () => {
        if (!activeSubject || isReadOnly || !window.confirm("هل أنت متأكد من إرسال هذا السجل إلى المدير؟ سيتم استبدال أي سجل سابق لهذه المادة.")) return;

        const gradesForSubmission: Record<string, TeacherSubjectGrade> = {};
        (classData.students || []).forEach(s => {
            gradesForSubmission[s.id] = { ...DEFAULT_TEACHER_GRADE, ...(s.teacherGrades?.[activeSubject.name] || {}) };
        });

        const newSubmission: TeacherSubmission = {
            id: uuidv4(),
            teacherId: teacher.id,
            classId: classData.id,
            subjectId: activeSubject.id,
            submittedAt: new Date().toISOString(),
            grades: gradesForSubmission,
        };

        db.ref(`teacher_submissions/${newSubmission.id}`).set(newSubmission);
        alert("تم إرسال السجل بنجاح!");
    };
    
    const handleExportPdf = async () => {
        if (!activeSubject) return;
        setIsExporting(true);

        const tempContainer = document.createElement('div');
        Object.assign(tempContainer.style, { position: 'absolute', left: '-9999px', top: '0' });
        document.body.appendChild(tempContainer);
        const root = ReactDOM.createRoot(tempContainer);

        const renderComponent = (component: React.ReactElement) => new Promise<void>(resolve => {
            root.render(component);
            setTimeout(resolve, 500);
        });

        const MAX_ROWS_PER_PAGE = 23;
        const studentChunks: Student[][] = [];
        for (let i = 0; i < sortedStudents.length; i += MAX_ROWS_PER_PAGE) {
            studentChunks.push(sortedStudents.slice(i, i + MAX_ROWS_PER_PAGE));
        }
        
        if (studentChunks.length === 0) {
            studentChunks.push([]);
        }

        const totalPages = studentChunks.length;

        try {
            await document.fonts.ready;
            
            const { jsPDF } = jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            let studentCounter = 0;
            for (let i = 0; i < totalPages; i++) {
                const chunk = studentChunks[i];
                const startingIndexForPage = studentCounter;
                
                await renderComponent(
                    <TeacherGradeSheetPDF 
                        students={chunk}
                        classData={classData} 
                        subject={activeSubject} 
                        teacherName={teacher.name}
                        settings={settings}
                        pageNumber={i + 1}
                        totalPages={totalPages}
                        startingIndex={startingIndexForPage}
                        isPrimary1_4={isPrimary1_4}
                        isPrimary5_6={isPrimary5_6}
                    />
                );
                
                studentCounter += chunk.length;

                const pdfElement = tempContainer.children[0] as HTMLElement;
                const canvas = await html2canvas(pdfElement, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                
                if (i > 0) {
                    pdf.addPage();
                }
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            }
            
            pdf.save(`سجل-${activeSubject.name}-${classData.stage}-${classData.section}.pdf`);

        } catch (error) {
            console.error("PDF Export failed:", error);
            alert("فشل تصدير الملف.");
        } finally {
            root.unmount();
            document.body.removeChild(tempContainer);
            setIsExporting(false);
        }
    };

    if (!activeSubject) {
        return <div className="text-center p-8 bg-white rounded-lg shadow">لم يتم تعيين مادة دراسية لك في هذه الشعبة.</div>
    }
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            {isReadOnly && (
                <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-800 p-4 mb-4 rounded-md" role="alert">
                    <p className="font-bold">وضع القراءة فقط</p>
                    <p>أنت تعرض سجلاً تم استلامه. لا يمكن تعديل الدرجات هنا.</p>
                </div>
            )}
             <div className="flex justify-between items-center mb-4">
                 <div>
                    <h2 className="text-2xl font-bold text-gray-800">سجل درجات: {classData.stage} - {classData.section}</h2>
                    <p className="text-lg text-gray-600">المادة: {activeSubject.name} | {teacherLabel}: {teacher.name}</p>
                 </div>
                 <div className="flex gap-2">
                    {!isReadOnly && 
                        <button onClick={handleSubmit} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition">
                            <Send size={18}/> إرسال للمدير
                        </button>
                    }
                     <button onClick={handleExportPdf} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition">
                        {isExporting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Download size={18}/>}
                        تصدير PDF
                     </button>
                 </div>
             </div>

            <form>
            <div className="overflow-x-auto">
                {isPrimary1_4 ? (
                     <table className="min-w-full border-collapse border border-gray-400">
                        <thead className="bg-yellow-300 text-black">
                            <tr>
                                <th className="border border-black p-2 w-10">ت</th>
                                <th className="border border-black p-2 min-w-48">اسم {studentLabel}</th>
                                <th className="border border-black p-2">درجة نصف السنة</th>
                                <th className="border border-black p-2">درجة نهاية السنة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStudents.map((student, index) => {
                                const grade = { ...DEFAULT_TEACHER_GRADE, ...(student.teacherGrades?.[activeSubject.name] || {}) };
                                const rowBg = ['#fdfbf4', '#f5fcfd', '#fff5f8', '#f5fdf7', '#f9f5fd'][index % 5];
                                return (
                                    <tr key={student.id} style={{backgroundColor: rowBg}}>
                                        <td className="border border-black text-center">{index + 1}</td>
                                        <td className="border border-black p-2 font-semibold">{student.name}</td>
                                        <td className="border border-black p-0 w-48"><GradeInput value={grade.midYear} onChange={v => handleGradeChange(student.id, 'midYear', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='midYear' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black p-0 w-48"><GradeInput value={grade.finalExam} onChange={v => handleGradeChange(student.id, 'finalExam', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='finalExam' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                ) : isPrimary5_6 ? (
                    <table className="min-w-full border-collapse border border-gray-400">
                        <thead className="bg-yellow-300 text-black">
                            <tr>
                                <th rowSpan={2} className="border border-black p-2 w-10">ت</th>
                                <th rowSpan={2} className="border border-black p-2 min-w-48">اسم {studentLabel}</th>
                                <th colSpan={4} className="border border-black p-2 bg-cyan-200">الفصل الأول</th>
                                <th rowSpan={2} className="border border-black p-1 align-middle bg-orange-200" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}>معدل الفصل الأول</th>
                                <th rowSpan={2} className="border border-black p-1 align-middle bg-pink-200" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}>نصف السنة</th>
                                <th colSpan={3} className="border border-black p-2 bg-green-200">الفصل الثاني</th>
                                <th rowSpan={2} className="border border-black p-1 align-middle bg-orange-200" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}>معدل الفصل الثاني</th>
                                <th rowSpan={2} className="border border-black p-1 align-middle bg-red-300" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}>السعي السنوي</th>
                            </tr>
                            <tr>
                                <th className="border border-black p-1 bg-cyan-200">تشرين الأول</th>
                                <th className="border border-black p-1 bg-cyan-200">تشرين الثاني</th>
                                <th className="border border-black p-1 bg-cyan-200">كانون الأول</th>
                                <th className="border border-black p-1 bg-cyan-200">كانون الثاني</th>
                                <th className="border border-black p-1 bg-green-200">شباط</th>
                                <th className="border border-black p-1 bg-green-200">آذار</th>
                                <th className="border border-black p-1 bg-green-200">نيسان</th>
                            </tr>
                        </thead>
                         <tbody>
                            {sortedStudents.map((student, index) => {
                                const grade = { ...DEFAULT_TEACHER_GRADE, ...(student.teacherGrades?.[activeSubject.name] || {}) };
                                const calculated = calculateGradesForPrimary(grade);
                                const rowBg = [ '#fdfbf4', '#f5fcfd', '#fff5f8', '#f5fdf7', '#f9f5fd'][index % 5];
                                return (
                                    <tr key={student.id} style={{backgroundColor: rowBg}}>
                                        <td className="border border-black text-center">{index + 1}</td>
                                        <td className="border border-black p-2 font-semibold">{student.name}</td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.october} onChange={v => handleGradeChange(student.id, 'october', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='october' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.november} onChange={v => handleGradeChange(student.id, 'november', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='november' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.december} onChange={v => handleGradeChange(student.id, 'december', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='december' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.january} onChange={v => handleGradeChange(student.id, 'january', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='january' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black text-center font-bold bg-yellow-100">{calculated.primaryFirstTerm}</td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.midYear} onChange={v => handleGradeChange(student.id, 'midYear', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='midYear' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.february} onChange={v => handleGradeChange(student.id, 'february', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='february' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.march} onChange={v => handleGradeChange(student.id, 'march', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='march' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.april} onChange={v => handleGradeChange(student.id, 'april', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='april' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black text-center font-bold bg-yellow-100">{calculated.primarySecondTerm}</td>
                                        <td className="border border-black text-center font-bold text-lg text-red-600 bg-orange-100">{calculated.annualPursuit}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                ) : (
                    <table className="min-w-full border-collapse border border-gray-400">
                        <thead className="bg-yellow-300 text-black">
                            <tr>
                                <th rowSpan={2} className="border border-black p-2 w-10">ت</th>
                                <th rowSpan={2} className="border border-black p-2 min-w-48">اسم {studentLabel}</th>
                                <th colSpan={2} className="border border-black p-2">الفصل الاول</th>
                                <th rowSpan={2} className="border border-black p-1 align-middle" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}>معدل الفصل الاول</th>
                                <th rowSpan={2} className="border border-black p-1 align-middle" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}>نصف السنة</th>
                                <th colSpan={2} className="border border-black p-2">الفصل الثاني</th>
                                <th rowSpan={2} className="border border-black p-1 align-middle" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}>معدل الفصل الثاني</th>
                                <th rowSpan={2} className="border border-black p-1 align-middle" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}>السعي السنوي</th>
                            </tr>
                            <tr>
                                <th className="border border-black p-1">الشهر الاول</th>
                                <th className="border border-black p-1">الشهر الثاني</th>
                                <th className="border border-black p-1">الشهر الاول</th>
                                <th className="border border-black p-1">الشهر الثاني</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStudents.map((student, index) => {
                                const grade = { ...DEFAULT_TEACHER_GRADE, ...(student.teacherGrades?.[activeSubject.name] || {}) };
                                const calculated = calculateGrades(grade);
                                const rowBg = [ '#fdfbf4', '#f5fcfd', '#fff5f8', '#f5fdf7', '#f9f5fd'][index % 5];
                                return (
                                    <tr key={student.id} style={{backgroundColor: rowBg}}>
                                        <td className="border border-black text-center">{index + 1}</td>
                                        <td className="border border-black p-2 font-semibold">{student.name}</td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.firstSemMonth1} onChange={v => handleGradeChange(student.id, 'firstSemMonth1', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='firstSemMonth1' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.firstSemMonth2} onChange={v => handleGradeChange(student.id, 'firstSemMonth2', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='firstSemMonth2' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black text-center font-bold bg-yellow-100">{calculated.firstSemAvg}</td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.midYear} onChange={v => handleGradeChange(student.id, 'midYear', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='midYear' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.secondSemMonth1} onChange={v => handleGradeChange(student.id, 'secondSemMonth1', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='secondSemMonth1' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black p-0 w-24"><GradeInput value={grade.secondSemMonth2} onChange={v => handleGradeChange(student.id, 'secondSemMonth2', v)} onEnterPress={handleEnterPress} onAutoAdvance={handleAutoAdvance} studentId={student.id} field='secondSemMonth2' isReadOnly={isReadOnly} schoolGender={settings.schoolGender} max={maxGrade} /></td>
                                        <td className="border border-black text-center font-bold bg-yellow-100">{calculated.secondSemAvg}</td>
                                        <td className="border border-black text-center font-bold text-lg text-red-600 bg-orange-100">{calculated.annualPursuit}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            </form>
        </div>
    );
}