import React, { useState, useEffect, useMemo } from 'react';
import type { Teacher, ClassData, Homework, HomeworkAttachment, HomeworkSubmission, HomeworkProgress, Student } from '../../types';
import { db, storage, firebase } from '../../lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Send, ClipboardList, Loader2, Upload, Paperclip, Check, X, Eye } from 'lucide-react';

// New component for reviewing a single submission
const SubmissionReviewModal = ({
    submission,
    homework,
    student,
    studentClass,
    onClose,
    onResolve,
    isProcessing
}: {
    submission: HomeworkSubmission;
    homework: Homework;
    student: Student | undefined;
    studentClass: ClassData | undefined;
    onClose: () => void;
    onResolve: (submission: HomeworkSubmission, status: 'accepted' | 'rejected') => void;
    isProcessing: boolean;
}) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div 
                className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-shrink-0 flex justify-between items-start border-b pb-4 mb-4">
                    <div className="p-2 border bg-gray-50 rounded-md text-right">
                        <p className="font-bold text-lg">{submission.studentName}</p>
                        <p className="text-sm text-gray-600">{studentClass?.stage} - {studentClass?.section}</p>
                    </div>
                    <div className="w-28 h-28 rounded-full border-4 border-cyan-500 overflow-hidden bg-gray-100 flex-shrink-0 shadow-md">
                        <img src={student?.photoUrl || 'https://i.imgur.com/s6ymP2b.png'} alt="صورة الطالب" className="w-full h-full object-cover" />
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"><X/></button>
                </div>

                {/* Body */}
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div className="text-center p-3 bg-cyan-600 text-white rounded-md shadow-sm">
                        <h3 className="text-xl font-bold">{homework.title}</h3>
                    </div>
                    
                    {submission.attachments && submission.attachments.length > 0 && (
                        <div>
                            <h4 className="font-semibold mb-2 text-gray-700">الصور المرفقة من الطالب:</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-gray-100 p-2 rounded-lg">
                                {submission.attachments.map(att => (
                                    <a key={att.url} href={att.url} target="_blank" rel="noopener noreferrer" className="block border-2 border-gray-300 rounded-lg overflow-hidden hover:border-cyan-500 transition-all">
                                        <img src={att.url} alt={att.name} className="w-full h-48 object-cover" />
                                        <p className="text-xs p-1 bg-white truncate">{att.name}</p>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {submission.texts && submission.texts.length > 0 && submission.texts[0].trim() && (
                        <div>
                             <h4 className="font-semibold mb-2 text-gray-700">النص المرسل من الطالب:</h4>
                             <div className="p-4 bg-gray-50 border rounded-md whitespace-pre-wrap font-sans">
                                {submission.texts[0]}
                             </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 pt-4 border-t flex justify-end gap-4">
                    {submission.status === 'pending' ? (
                        <>
                            <button onClick={() => onResolve(submission, 'rejected')} disabled={isProcessing} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-red-700 disabled:bg-gray-400">
                                {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <X size={18}/>} رفض
                            </button>
                            <button onClick={() => onResolve(submission, 'accepted')} disabled={isProcessing} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:bg-gray-400">
                                {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>} قبول
                            </button>
                        </>
                    ) : (
                         <button onClick={onClose} className="px-6 py-2 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600">
                            إغلاق
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

interface HomeworkManagerProps {
    teacher: Teacher;
    classes: ClassData[];
}

export default function HomeworkManager({ teacher, classes }: HomeworkManagerProps) {
    const [activeTab, setActiveTab] = useState<'send' | 'review'>('send');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [deadline, setDeadline] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
    const [isSending, setIsSending] = useState(false);
    
    const [sentHomework, setSentHomework] = useState<Homework[]>([]);
    const [submissions, setSubmissions] = useState<Record<string, HomeworkSubmission[]>>({});
    const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
    const [selectedHomeworkId, setSelectedHomeworkId] = useState<string | null>(null);
    const [reviewingSubmission, setReviewingSubmission] = useState<HomeworkSubmission | null>(null);
    const [isResolving, setIsResolving] = useState(false);

    const teacherAssignments = useMemo(() => {
        const assignmentsMap = new Map<string, { subjectId: string, subjectName: string, classIds: string[] }>();
        (teacher.assignments || []).forEach(a => {
            const classInfo = classes.find(c => c.id === a.classId);
            const subjectInfo = classInfo?.subjects.find(s => s.id === a.subjectId);
            if(subjectInfo) {
                if(assignmentsMap.has(subjectInfo.id)) {
                    assignmentsMap.get(subjectInfo.id)!.classIds.push(a.classId);
                } else {
                    assignmentsMap.set(subjectInfo.id, { subjectId: subjectInfo.id, subjectName: subjectInfo.name, classIds: [a.classId] });
                }
            }
        });
        return Array.from(assignmentsMap.values());
    }, [teacher.assignments, classes]);

    useEffect(() => {
        const homeworkRef = db.ref(`homework_data/${teacher.principalId}`);
        const callback = (snapshot: any) => {
            const data = snapshot.val() || {};
            const allHomework: Homework[] = Object.values(data);
            const teacherHomework = allHomework.filter(hw => hw.teacherId === teacher.id)
                .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setSentHomework(teacherHomework);
        };
        homeworkRef.on('value', callback);
        return () => homeworkRef.off('value', callback);
    }, [teacher.id, teacher.principalId]);

    const handleSendHomework = async () => {
        if (!title.trim() || !deadline || selectedClassIds.length === 0) {
            alert('يرجى ملء العنوان، الموعد النهائي، واختيار شعبة واحدة على الأقل.');
            return;
        }
        setIsSending(true);

        const assignment = teacherAssignments[0];
        if (!assignment) {
            alert('لا يمكنك إرسال واجب بدون تعيين مادة لك.');
            setIsSending(false);
            return;
        }

        try {
            const uploadedAttachments: HomeworkAttachment[] = [];
            for (const file of attachments) {
                const attachmentId = uuidv4();
                const path = `homework_attachments/${teacher.principalId}/${attachmentId}-${file.name}`;
                const storageRef = storage.ref(path);
                await storageRef.put(file);
                const url = await storageRef.getDownloadURL();
                uploadedAttachments.push({ name: file.name, url, type: file.type.startsWith('image') ? 'image' : 'pdf', path });
            }

            const homeworkId = uuidv4();
            const newHomework: Homework = {
                id: homeworkId, principalId: teacher.principalId, teacherId: teacher.id, classIds: selectedClassIds,
                subjectId: assignment.subjectId, subjectName: assignment.subjectName, title, notes, deadline,
                texts: [], attachments: uploadedAttachments, createdAt: new Date().toISOString(),
            };
            
            const updates: Record<string, any> = {};
            updates[`/homework_data/${teacher.principalId}/${homeworkId}`] = newHomework;
            selectedClassIds.forEach(classId => {
                updates[`/active_homework/${teacher.principalId}/${classId}/${assignment.subjectId}`] = { homeworkId };
            });

            await db.ref().update(updates);
            alert('تم إرسال الواجب بنجاح.');
            setTitle(''); setNotes(''); setDeadline(''); setAttachments([]); setSelectedClassIds([]);

        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء إرسال الواجب.');
        } finally {
            setIsSending(false);
        }
    };

    const handleReviewHomework = (homeworkId: string) => {
        setSelectedHomeworkId(homeworkId);
        setIsLoadingSubmissions(true);
        const submissionsRef = db.ref(`homework_submissions/${teacher.principalId}`);
        
        submissionsRef.get().then(snapshot => {
            const allSubmissionsByStudent = snapshot.val() || {};
            const relevantSubmissions: HomeworkSubmission[] = [];
    
            Object.values(allSubmissionsByStudent).forEach((studentSubmissions: any) => {
                if (studentSubmissions && studentSubmissions[homeworkId]) {
                    relevantSubmissions.push(studentSubmissions[homeworkId]);
                }
            });
            
            setSubmissions({ [homeworkId]: relevantSubmissions.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()) });
        }).finally(() => setIsLoadingSubmissions(false));
    };

    const handleSubmissionStatus = async (submission: HomeworkSubmission, status: 'accepted' | 'rejected') => {
        setIsResolving(true);
        const reason = status === 'rejected' ? prompt('سبب الرفض:') : '';
        if (status === 'rejected' && reason === null) {
            setIsResolving(false);
            return;
        }

        const updates: Record<string, any> = {};
        const submissionPath = `homework_submissions/${teacher.principalId}/${submission.studentId}/${submission.homeworkId}`;
        updates[`${submissionPath}/status`] = status;
        updates[`${submissionPath}/reviewedAt`] = new Date().toISOString();
        if (reason) updates[`${submissionPath}/rejectionReason`] = reason;

        if (status === 'accepted') {
            const progressPath = `homework_progress/${teacher.principalId}/${submission.studentId}`;
            updates[`${progressPath}/totalCompleted`] = firebase.database.ServerValue.increment(1);
            
            const monthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
            const monthPath = `${progressPath}/monthlyCompleted/${monthKey}`;
            updates[`${monthPath}/count`] = firebase.database.ServerValue.increment(1);
            updates[`${monthPath}/lastTimestamp`] = new Date().getTime();
        }

        await db.ref().update(updates);
        handleReviewHomework(submission.homeworkId);
        setIsResolving(false);
    };

    const renderSendTab = () => (
        <div className="space-y-4">
            <input type="text" placeholder="عنوان الواجب" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded"/>
            <textarea placeholder="ملاحظات أو نص الواجب" value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="w-full p-2 border rounded"/>
            <div>
                <label className="block text-sm font-medium">الموعد النهائي للتسليم</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full p-2 border rounded"/>
            </div>
            <div>
                <label className="block text-sm font-medium">إرفاق ملفات (صور, PDF)</label>
                <input type="file" multiple onChange={e => setAttachments(Array.from(e.target.files || []))} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"/>
            </div>
             <div>
                <label className="block text-sm font-medium">إرسال إلى الشعب</label>
                 <div className="space-y-2 mt-2">
                    {teacherAssignments[0]?.classIds.map(classId => {
                        const classInfo = classes.find(c => c.id === classId);
                        if (!classInfo) return null;
                        return (
                             <label key={classId} className="flex items-center gap-2">
                                <input type="checkbox" checked={selectedClassIds.includes(classId)} onChange={e => {
                                    if(e.target.checked) setSelectedClassIds(p => [...p, classId]);
                                    else setSelectedClassIds(p => p.filter(id => id !== classId));
                                }}/>
                                {classInfo.stage} - {classInfo.section}
                            </label>
                        )
                    })}
                </div>
            </div>
            <button onClick={handleSendHomework} disabled={isSending} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 disabled:bg-gray-400">
                {isSending ? <Loader2 className="animate-spin"/> : <Send/>} {isSending ? 'جاري الإرسال...' : 'إرسال الواجب'}
            </button>
        </div>
    );

    const renderReviewTab = () => {
        const homeworkToReview = selectedHomeworkId ? sentHomework.find(hw => hw.id === selectedHomeworkId) : null;
        const studentForReview = reviewingSubmission ? classes.flatMap(c => c.students || []).find(s => s.id === reviewingSubmission.studentId) : undefined;
        const classForReview = reviewingSubmission ? classes.find(c => c.id === reviewingSubmission.classId) : undefined;

        return (
            <>
                {reviewingSubmission && homeworkToReview && (
                    <SubmissionReviewModal
                        submission={reviewingSubmission}
                        homework={homeworkToReview}
                        student={studentForReview}
                        studentClass={classForReview}
                        onClose={() => setReviewingSubmission(null)}
                        onResolve={(sub, status) => {
                            handleSubmissionStatus(sub, status);
                            setReviewingSubmission(null);
                        }}
                        isProcessing={isResolving}
                    />
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1 space-y-2">
                        <h4 className="font-bold">الواجبات المرسلة</h4>
                        <div className="max-h-[60vh] overflow-y-auto">
                            {sentHomework.map(hw => (
                                <button key={hw.id} onClick={() => handleReviewHomework(hw.id)} className={`w-full text-right p-2 rounded ${selectedHomeworkId === hw.id ? 'bg-cyan-500 text-white' : 'hover:bg-gray-100'}`}>
                                    <p className="font-semibold">{hw.title}</p>
                                    <p className="text-xs">{hw.subjectName}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <h4 className="font-bold">تسليمات الطلاب</h4>
                        {isLoadingSubmissions ? <Loader2 className="animate-spin"/> : (
                            <div className="max-h-[60vh] overflow-y-auto space-y-2">
                                {(submissions[selectedHomeworkId!] || []).map(sub => (
                                    <div key={sub.id} className="p-3 border rounded-lg bg-white">
                                        <div className="flex justify-between items-center">
                                            <p className="font-bold">{sub.studentName}</p>
                                            <span className={`px-2 py-1 text-xs rounded-full ${sub.status === 'accepted' ? 'bg-green-100 text-green-800' : sub.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {sub.status === 'pending' ? 'بانتظار المراجعة' : sub.status === 'accepted' ? 'تم القبول' : 'مرفوض'}
                                            </span>
                                        </div>
                                        {Array.isArray(sub.attachments) && sub.attachments.map(att => (
                                            <a key={att.url} href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-sm"><Paperclip size={14}/> {att.name}</a>
                                        ))}
                                        <button onClick={() => setReviewingSubmission(sub)} className={`mt-2 px-3 py-1 text-sm rounded flex items-center gap-1 ${sub.status === 'pending' ? 'bg-blue-500 text-white' : 'bg-gray-400 text-white'}`}>
                                            <Eye size={16}/> {sub.status === 'pending' ? 'مراجعة' : 'عرض'} التسليم
                                        </button>
                                    </div>
                                ))}
                                {selectedHomeworkId && (submissions[selectedHomeworkId!] || []).length === 0 && <p className="text-gray-500">لا توجد تسليمات لهذا الواجب بعد.</p>}
                            </div>
                        )}
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex border-b mb-4">
                <button onClick={() => setActiveTab('send')} className={`px-4 py-2 font-semibold flex items-center gap-2 ${activeTab === 'send' ? 'border-b-2 border-cyan-500 text-cyan-600' : 'text-gray-500'}`}><Send/> إرسال واجب</button>
                <button onClick={() => setActiveTab('review')} className={`px-4 py-2 font-semibold flex items-center gap-2 ${activeTab === 'review' ? 'border-b-2 border-cyan-500 text-cyan-600' : 'text-gray-500'}`}><ClipboardList/> متابعة التسليمات</button>
            </div>
            {activeTab === 'send' ? renderSendTab() : renderReviewTab()}
        </div>
    );
}