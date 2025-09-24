
import React, { useState, useMemo, useEffect } from 'react';
import type { User, ClassData, TeacherSubmission, TeacherSubjectGrade, SchoolSettings } from '../../types';
import useAuth from '../../hooks/useAuth';
import TeacherGradeSheet from '../teacher/TeacherGradeSheet'; // Re-using for display
import { db } from '../../lib/firebase';

interface ReceiveTeacherLogProps {
    principal: User;
    classes: ClassData[];
    settings: SchoolSettings;
}

const DEFAULT_TEACHER_GRADE: TeacherSubjectGrade = {
    firstSemMonth1: null,
    firstSemMonth2: null,
    midYear: null,
    secondSemMonth1: null,
    secondSemMonth2: null,
};


export default function ReceiveTeacherLog({ principal, classes, settings }: ReceiveTeacherLogProps) {
    const { users } = useAuth();
    const [submissions, setSubmissions] = useState<TeacherSubmission[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
    const [selectedSubmission, setSelectedSubmission] = useState<TeacherSubmission | null>(null);

    useEffect(() => {
        const submissionsRef = db.ref('teacher_submissions');
        const callback = (snapshot: any) => {
            const data = snapshot.val();
            setSubmissions(data ? Object.values(data) : []);
        };
        submissionsRef.on('value', callback);
        return () => submissionsRef.off('value', callback);
    }, []);

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher' && u.principalId === principal.id), [users, principal.id]);
    
    const teacherSubmissions = useMemo(() => {
        const latestSubmissions = new Map<string, TeacherSubmission>();
        (submissions || []).forEach(sub => {
            if (teachers.some(t => t.id === sub.teacherId)) {
                const key = `${sub.teacherId}-${sub.classId}-${sub.subjectId}`;
                const existing = latestSubmissions.get(key);
                if (!existing || new Date(sub.submittedAt) > new Date(existing.submittedAt)) {
                    latestSubmissions.set(key, sub);
                }
            }
        });
        return Array.from(latestSubmissions.values());
    }, [submissions, teachers]);
    
    const submissionsByTeacher = useMemo(() => {
        const grouped = new Map<string, TeacherSubmission[]>();
        teacherSubmissions.forEach(sub => {
            const list = grouped.get(sub.teacherId) || [];
            list.push(sub);
            grouped.set(sub.teacherId, list);
        });
        return grouped;
    }, [teacherSubmissions]);

    const handleViewSubmission = (submission: TeacherSubmission) => {
        setSelectedSubmission(submission);
    };
    
    const getClassName = (classId: string) => {
        const cls = classes.find(c => c.id === classId);
        return cls ? `${cls.stage} - ${cls.section}` : 'شعبة محذوفة';
    }

    const getSubjectName = (classId: string, subjectId: string) => {
        const cls = classes.find(c => c.id === classId);
        const sub = (cls?.subjects || []).find(s => s.id === subjectId);
        return sub ? sub.name : 'مادة محذوفة';
    }

    if (selectedSubmission) {
        const classData = classes.find(c => c.id === selectedSubmission.classId);
        const teacher = users.find(u => u.id === selectedSubmission.teacherId);

        if (!classData || !teacher) {
            return (
                <div>
                    <p>خطأ: لم يتم العثور على بيانات الصف أو المدرس.</p>
                    <button onClick={() => setSelectedSubmission(null)} className="mt-4 px-4 py-2 bg-gray-300 rounded">رجوع</button>
                </div>
            );
        }
        
        // Inject submitted grades into classData for display
        const classDataWithGrades: ClassData = {
            ...classData,
            students: (classData.students || []).map(s => ({
                ...s,
                teacherGrades: {
                    ...s.teacherGrades,
                    [getSubjectName(classData.id, selectedSubmission.subjectId)]: (selectedSubmission.grades || {})[s.id] || DEFAULT_TEACHER_GRADE,
                }
            }))
        };
        
        return (
            <div>
                 <button onClick={() => setSelectedSubmission(null)} className="mb-4 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">
                    &larr; العودة إلى قائمة السجلات
                </button>
                <TeacherGradeSheet
                    classData={classDataWithGrades}
                    teacher={teacher as any}
                    settings={settings}
                    isReadOnly={true}
                    subjectId={selectedSubmission.subjectId}
                />
            </div>
        )
    }

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">استلام سجلات المدرسين</h2>
            
            <div className="mb-4">
                <label className="block text-md font-bold text-gray-700 mb-2">اختر مدرس لعرض سجلاته المستلمة:</label>
                <select 
                    onChange={e => setSelectedTeacherId(e.target.value)} 
                    value={selectedTeacherId || ''}
                    className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg"
                >
                    <option value="">-- كل المدرسين --</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            <div className="space-y-4">
                {(selectedTeacherId ? [teachers.find(t=>t.id === selectedTeacherId)] : teachers).map(teacher => {
                    if (!teacher) return null;
                    const teacherSubs = submissionsByTeacher.get(teacher.id) || [];
                    if (teacherSubs.length === 0) return null;

                    return (
                        <div key={teacher.id} className="p-4 bg-gray-50 rounded-lg border">
                            <h3 className="text-xl font-bold text-gray-700">{teacher.name}</h3>
                            <div className="mt-2 space-y-2">
                                {teacherSubs.map(sub => (
                                    <div key={sub.id} className="flex justify-between items-center p-2 bg-white rounded border">
                                        <div>
                                            <span className="font-semibold">{getClassName(sub.classId)}</span>
                                            <span className="mx-2 text-gray-400">|</span>
                                            <span>{getSubjectName(sub.classId, sub.subjectId)}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                             <span className="text-sm text-gray-500">
                                                آخر تحديث: {new Date(sub.submittedAt).toLocaleString('ar-EG')}
                                            </span>
                                            <button onClick={() => handleViewSubmission(sub)} className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">
                                                عرض السجل
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
                 {teacherSubmissions.length === 0 && (
                    <p className="text-center text-gray-500 py-8">لم يتم استلام أي سجلات من المدرسين بعد.</p>
                )}
            </div>
        </div>
    );
}