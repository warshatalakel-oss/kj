import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { User, SchoolSettings, ClassData, StudentSubmission, Announcement, ParentContact, Student } from '../../types';
import { db, storage } from '../../lib/firebase';
import { Key, Send, ClipboardList, RefreshCw, Copy, Check, Eye, X, Edit, Trash2, FileDown, Loader2, MessageSquare, Plus, UserPlus, PlayCircle, Users as UsersIcon, Download, Sparkles } from 'lucide-react';
import { GRADE_LEVELS } from '../../constants';
import RegistrationFormPage1 from './RegistrationFormPage1';
import RegistrationFormPage2 from './RegistrationFormPage2';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from "@google/genai";

declare const jspdf: any;
declare const html2canvas: any;
declare const XLSX: any;

const generateCode = (length = 8) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};


// =================================================================================================
// TAB 1: Access Codes & Announcements
// =================================================================================================

const getRelevantGradeLevels = (schoolLevel?: SchoolSettings['schoolLevel']): string[] => {
    if (!schoolLevel) return GRADE_LEVELS;

    if (schoolLevel === 'ابتدائية') {
        return GRADE_LEVELS.filter(g => g.includes('ابتدائي'));
    }
    if (schoolLevel === 'متوسطة') {
        return GRADE_LEVELS.filter(g => g.includes('متوسط'));
    }
    if (schoolLevel.includes('اعدادي') || schoolLevel.includes('اعدادية')) {
        return GRADE_LEVELS.filter(g => g.includes('الرابع') || g.includes('الخامس') || g.includes('السادس'));
    }
    if (schoolLevel.includes('ثانوية')) {
        return GRADE_LEVELS.filter(g => g.includes('متوسط') || g.includes('الرابع') || g.includes('الخامس') || g.includes('السادس'));
    }
    return GRADE_LEVELS;
};

const CodesAndAnnouncements = ({ principal, settings }: { principal: User, settings: SchoolSettings }) => {
    const [accessCodes, setAccessCodes] = useState<Record<string, string>>({});
    const [announcements, setAnnouncements] = useState<Record<string, Announcement>>({});
    const [newAnnouncements, setNewAnnouncements] = useState<Record<string, string>>({});
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const relevantGrades = useMemo(() => getRelevantGradeLevels(settings.schoolLevel), [settings.schoolLevel]);

     useEffect(() => {
        const codesRef = db.ref(`student_access_codes/${principal.id}`);
        const announcementsRef = db.ref(`announcements/${principal.id}`);

        const codesCallback = (snapshot: any) => setAccessCodes(snapshot.val() || {});
        const announcementsCallback = (snapshot: any) => setAnnouncements(snapshot.val() || {});

        codesRef.on('value', codesCallback);
        announcementsRef.on('value', announcementsCallback);
        return () => {
             codesRef.off('value', codesCallback);
             announcementsRef.off('value', announcementsCallback);
        }
    }, [principal.id]);

    const handleCodeChange = (stage: string, code: string) => {
        const newCode = code.toUpperCase().trim();
        db.ref(`student_access_codes/${principal.id}/${stage}`).set(newCode);
    };

    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(code).then(() => {
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2000);
        });
    };

    const handlePublishAnnouncement = (stage: string) => {
        const message = newAnnouncements[stage]?.trim();
        if (!message) return;
        const announcement: Omit<Announcement, 'id'> = {
            principalId: principal.id,
            stage: stage,
            message: message,
            timestamp: new Date().toISOString()
        };
        db.ref(`announcements/${principal.id}/${stage}`).set(announcement);
        setNewAnnouncements(prev => ({ ...prev, [stage]: '' }));
    };

    return (
        <div className="space-y-6">
            {relevantGrades.map(stage => (
                <div key={stage} className="p-4 bg-gray-50 rounded-lg border">
                    <h3 className="text-xl font-bold text-gray-700 mb-3">{stage}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="font-semibold flex items-center gap-2"><Key size={18} /> رمز دخول الطلاب (لتقديم الاستمارة)</label>
                            <div className="flex gap-2">
                                <input type="text" value={accessCodes[stage] || ''} onChange={e => handleCodeChange(stage, e.target.value)} className="flex-grow p-2 border rounded-md font-mono text-center" placeholder="لم يتم التعيين"/>
                                <button onClick={() => handleCodeChange(stage, generateCode())} className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600" title="توليد رمز جديد"><RefreshCw size={20}/></button>
                                <button onClick={() => copyToClipboard(accessCodes[stage] || '')} disabled={!accessCodes[stage]} className="p-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-300" title="نسخ الرمز">{copiedCode === accessCodes[stage] ? <Check size={20}/> : <Copy size={20}/>}</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="font-semibold flex items-center gap-2"><Send size={18} /> تبليغ للطلاب</label>
                            {announcements[stage] && (<div className="p-2 bg-blue-100 text-blue-800 rounded-md text-sm"><strong>التبليغ الحالي:</strong> {announcements[stage].message}</div>)}
                            <textarea value={newAnnouncements[stage] || ''} onChange={e => setNewAnnouncements(prev => ({...prev, [stage]: e.target.value}))} rows={2} className="w-full p-2 border rounded-md" placeholder="اكتب تبليغ جديد هنا..."/>
                            <button onClick={() => handlePublishAnnouncement(stage)} className="w-full p-2 bg-green-600 text-white rounded-md hover:bg-green-700">نشر التبليغ</button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};


// =================================================================================================
// TAB 2: Received Forms (Restored Version)
// =================================================================================================
const ReceivedForms = ({ submissions, principal }: { submissions: StudentSubmission[], principal: User }) => {
    const [modalState, setModalState] = useState<{ mode: 'view' | 'edit'; submission: StudentSubmission | null }>({ mode: 'view', submission: null });
    const [editedFormData, setEditedFormData] = useState<Record<string, string>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [exportStage, setExportStage] = useState<string>('');

    const submissionStages = useMemo(() => {
        const stages = new Set<string>();
        submissions.forEach(sub => stages.add(sub.stage));
        return Array.from(stages);
    }, [submissions]);

    const handleView = (submission: StudentSubmission) => {
        setModalState({ mode: 'view', submission });
        if (submission.status === 'pending') {
            db.ref(`student_submissions/${principal.id}/${submission.id}/status`).set('viewed');
        }
    };

    const handleEdit = (submission: StudentSubmission) => {
        setEditedFormData(submission.formData);
        setModalState({ mode: 'edit', submission });
    };

    const handleSaveEdit = async () => {
        if (!modalState.submission) return;
        setIsProcessing(true);
        try {
            await db.ref(`student_submissions/${principal.id}/${modalState.submission.id}/formData`).set(editedFormData);
            alert('تم حفظ التعديلات بنجاح.');
            setModalState({ ...modalState, mode: 'view' }); // Switch to view mode after save
        } catch (error) {
            console.error("Error saving edits:", error);
            alert('حدث خطأ أثناء حفظ التعديلات.');
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDelete = async (submissionId: string, studentPhotoUrl: string | null) => {
        if (!window.confirm('هل أنت متأكد من حذف هذه الاستمارة؟ لا يمكن التراجع عن هذا الإجراء.')) return;
        setIsProcessing(true);
        try {
            if (studentPhotoUrl) {
                await storage.refFromURL(studentPhotoUrl).delete().catch((err: any) => console.warn("Could not delete photo, it might already be gone:", err));
            }
            await db.ref(`student_submissions/${principal.id}/${submissionId}`).remove();
            alert('تم حذف الاستمارة بنجاح.');
            if (modalState.submission?.id === submissionId) {
                closeModal();
            }
        } catch (error) {
            console.error("Error deleting submission:", error);
            alert('حدث خطأ أثناء الحذف.');
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleExportPdf = async (submission: StudentSubmission) => {
        setIsProcessing(true);

        // CORS WORKAROUND: Pre-fetch image via proxy and convert to data URL
        let photoDataUrl = submission.studentPhoto;
        if (submission.studentPhoto && submission.studentPhoto.startsWith('http')) {
            try {
                // Using a CORS proxy to bypass browser restrictions on fetching cross-origin images for canvas.
                const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(submission.studentPhoto)}`);
                if (!response.ok) {
                    throw new Error(`Proxy fetch failed: ${response.statusText}`);
                }
                const blob = await response.blob();
                photoDataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error("Failed to pre-fetch student photo through proxy, will use direct URL and hope for the best:", error);
                // Fallback to the original URL if the proxy fails.
                photoDataUrl = submission.studentPhoto;
            }
        }
        
        const tempContainer = document.createElement('div');
        Object.assign(tempContainer.style, { position: 'absolute', left: '-9999px', top: '0' });
        document.body.appendChild(tempContainer);
        
        tempContainer.innerHTML = `<div id="pdf-export-p1-wrapper"></div><div id="pdf-export-p2-wrapper"></div>`;
        const p1Wrapper = tempContainer.querySelector('#pdf-export-p1-wrapper') as HTMLElement;
        const p2Wrapper = tempContainer.querySelector('#pdf-export-p2-wrapper') as HTMLElement;
        
        const root1 = ReactDOM.createRoot(p1Wrapper);
        const root2 = ReactDOM.createRoot(p2Wrapper);
    
        try {
            // Render components with the potentially new data URL for the photo
            await new Promise<void>(resolve => {
                root1.render(<RegistrationFormPage1 formData={submission.formData} onUpdate={()=>{}} studentPhoto={photoDataUrl} onPhotoUpload={()=>{}} isPdfMode />);
                root2.render(<RegistrationFormPage2 formData={submission.formData} onUpdate={()=>{}} isPdfMode />);
                setTimeout(resolve, 500); // Give React time to render to DOM
            });
    
            // Now capture pages
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            
            // Define margins (0.5cm = 5mm)
            const MARGIN_MM = 5;
            const a4Width = pdf.internal.pageSize.getWidth();
            const a4Height = pdf.internal.pageSize.getHeight();
            const availableWidth = a4Width - (MARGIN_MM * 2);
            const availableHeight = a4Height - (MARGIN_MM * 2);

            const addCanvasToPdf = async (canvas: HTMLCanvasElement) => {
                const canvasAspectRatio = canvas.width / canvas.height;
                let imgWidth, imgHeight;
                imgHeight = availableHeight;
                imgWidth = imgHeight * canvasAspectRatio;
                if (imgWidth > availableWidth) {
                    imgWidth = availableWidth;
                    imgHeight = imgWidth / canvasAspectRatio;
                }
                const xPos = MARGIN_MM + (availableWidth - imgWidth) / 2;
                const yPos = MARGIN_MM + (availableHeight - imgHeight) / 2;
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xPos, yPos, imgWidth, imgHeight, undefined, 'FAST');
            };
            
            const page1Element = p1Wrapper.children[0] as HTMLElement;
            const page2Element = p2Wrapper.children[0] as HTMLElement;
            if (!page1Element || !page2Element) throw new Error("Could not find rendered pages for export.");

            const canvas1 = await html2canvas(page1Element, { scale: 2, useCORS: true, logging: true });
            await addCanvasToPdf(canvas1);
    
            pdf.addPage();
            const canvas2 = await html2canvas(page2Element, { scale: 2, useCORS: true });
            await addCanvasToPdf(canvas2);
    
            pdf.save(`استمارة-${submission.studentName}.pdf`);
        } catch(e) {
            console.error("PDF export from principal view failed:", e);
            alert('فشل تصدير الملف.');
        } finally {
            root1.unmount();
            root2.unmount();
            document.body.removeChild(tempContainer);
            setIsProcessing(false);
        }
    };

    const handleExportExcel = (type: 'student' | 'counselor') => {
        if (!exportStage) {
            alert('يرجى اختيار مرحلة دراسية للتصدير.');
            return;
        }
        const stageSubmissions = submissions.filter(s => s.stage === exportStage);
        if (stageSubmissions.length === 0) {
            alert('لا توجد استمارات لهذه المرحلة لتصديرها.');
            return;
        }

        const studentInfoHeaders: Record<string, string> = { fullName: "اسم الطالب الرباعي واللقب", motherName: "اسم الام الثلاثي", birthPlace: "محل الولادة", birthDate: "تاريخ الولادة", registrationId: "رقم القيد", guardianName: "اسم ولي الامر", guardianRelation: "صلة القرابة", nationalId: "رقم البطاقة الوطنية", familyId: "الرقم العائلي", nationalIdIssuer: "جهة اصدار البطاقة الوطنية", civilId: "رقم الهوية", civilRegistryNumber: "رقم السجل", civilPageNumber: "رقم الصفحة", civilIdIssuer: "جهة اصدار الهوية", guardianProfession: "مهنة ولي الامر", fatherPhone: "رقم هاتف الاب", motherPhone: "رقم هاتف الام", address: "عنوان السكن", houseNumber: "رقم الدار", nearestLandmark: "اقرب نقطة دالة", mukhtarName: "اسم المختار الثلاثي", lastSchool: "اخر مدرسة كان فيها", docCount: "عدد الوثيقة", docNumber: "رقم الوثيقة", docDate: "تاريخ اصدارها", docIssuer: "جهة اصدارها", formSequence1: "تسلسل الاستمارة (ص1)" };
        const counselorInfoHeaders: Record<string, string> = { fullName2: "اسم الطالب الرباعي واللقب", isFatherAlive: "هل الاب على قيد الحياة", fatherEducation: "التحصيل الدراسي للاب", isMotherAlive: "هل الام على قيد الحياة", motherEducation: "التحصيل الدراسي للام", familyMembers: "عدد افراد الاسرة", brothersCount: "عدد الاخوة", sistersCount: "عدد الاخوات", studentOrder: "ترتيب الطالب", monthlyIncome: "الدخل الشهري", houseType: "نوع الدار", roomCount: "عدد الغرف", livesWith: "الطالب يعيش مع", height: "الطول", weight: "الوزن", hearing: "السمع", vision: "النظر", isStudentWorking: "هل الطالب يعمل", hasChronicIllness: "هل يعاني امراض مزمنة", physicalDisabilities: "العاهات الجسمية", studentSkills: "هل للطالب مهارة", skillsDetails: "مهارات (تفاصيل)", participatedInFestivals: "هل شارك بمهرجانات او مسابقات", festivalsDetails: "مهرجانات (تفاصيل)", formSequence2: "تسلسل الاستمارة (ص2)" };

        const headers = type === 'student' ? studentInfoHeaders : counselorInfoHeaders;
        const data = stageSubmissions.map(sub => {
            const row: Record<string, any> = {};
            for (const key in headers) {
                row[headers[key as keyof typeof headers]] = sub.formData[key] || '';
            }
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'البيانات');
        const fileName = `بيانات-${type === 'student' ? 'الطلاب' : 'المرشد'}-${exportStage}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const closeModal = () => setModalState({ mode: 'view', submission: null });

    return (
        <div>
            <div className="p-4 bg-gray-100 rounded-lg border mb-4">
                <h4 className="font-bold text-lg mb-2">تصدير بيانات الاستمارات (Excel)</h4>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-grow">
                        <label htmlFor="exportStage" className="block text-sm font-semibold text-gray-700 mb-1">اختر المرحلة الدراسية</label>
                        <select
                            id="exportStage"
                            value={exportStage}
                            onChange={e => setExportStage(e.target.value)}
                            className="w-full p-2 border rounded-md bg-white"
                        >
                            <option value="">-- اختر مرحلة --</option>
                            {submissionStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                        </select>
                    </div>
                    <button onClick={() => handleExportExcel('student')} disabled={!exportStage} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:bg-gray-400">
                        <Download size={18} /> تصدير معلومات الطالب
                    </button>
                    <button onClick={() => handleExportExcel('counselor')} disabled={!exportStage} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400">
                        <Download size={18} /> تصدير معلومات المرشد
                    </button>
                </div>
            </div>

            {submissions.length === 0 ? (
                <p className="text-center text-gray-500 p-8">لا توجد استمارات مستلمة حالياً.</p>
            ) : (
                <div className="space-y-3">
                    {submissions.map(sub => (
                        <div key={sub.id} className="p-3 bg-gray-50 rounded-lg border flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-lg">{sub.studentName}</p>
                                <p className="text-sm text-gray-500">{sub.stage} - تم الارسال في: {new Date(sub.submittedAt).toLocaleString('ar-EG')}</p>
                            </div>
                             <div className="flex items-center gap-2">
                                <button onClick={() => handleEdit(sub)} className="p-2 text-white bg-yellow-500 rounded-md hover:bg-yellow-600" title="تعديل"><Edit size={20}/></button>
                                <button onClick={() => handleView(sub)} className="p-2 text-white bg-blue-500 rounded-md hover:bg-blue-600" title="عرض"><Eye size={20}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalState.submission && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
                        <header className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-xl font-bold">استمارة الطالب: {modalState.submission.studentName}</h3>
                            <div className="flex items-center gap-2">
                               {modalState.mode === 'view' && <button onClick={() => handleEdit(modalState.submission!)} className="p-2 text-yellow-600 hover:bg-yellow-100 rounded-full"><Edit size={20} /></button>}
                                <button onClick={() => handleDelete(modalState.submission!.id, modalState.submission!.studentPhoto)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 size={20} /></button>
                                <button onClick={closeModal} className="p-2 text-gray-600 hover:bg-gray-200 rounded-full"><X /></button>
                            </div>
                        </header>
                        <main className="flex-1 overflow-y-auto p-4 bg-gray-100">
                            <div className="space-y-4">
                                <RegistrationFormPage1 
                                    formData={modalState.mode === 'edit' ? editedFormData : modalState.submission.formData} 
                                    onUpdate={(field, value) => modalState.mode === 'edit' && setEditedFormData(prev => ({ ...prev, [field]: value }))}
                                    studentPhoto={modalState.submission.studentPhoto} 
                                    onPhotoUpload={() => {}} 
                                    isPdfMode={modalState.mode === 'view'}
                                />
                                <RegistrationFormPage2 
                                    formData={modalState.mode === 'edit' ? editedFormData : modalState.submission.formData} 
                                    onUpdate={(field, value) => modalState.mode === 'edit' && setEditedFormData(prev => ({ ...prev, [field]: value }))} 
                                    isPdfMode={modalState.mode === 'view'}
                                />
                            </div>
                        </main>
                        <footer className="p-4 border-t flex items-center justify-end gap-3 bg-gray-50">
                             {modalState.mode === 'edit' ? (
                                <>
                                    <button onClick={() => setModalState({ ...modalState, mode: 'view'})} disabled={isProcessing} className="px-4 py-2 bg-gray-300 text-black rounded-md hover:bg-gray-400">إلغاء</button>
                                    <button onClick={handleSaveEdit} disabled={isProcessing} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400">
                                        {isProcessing ? <Loader2 className="animate-spin"/> : 'حفظ التعديلات'}
                                    </button>
                                </>
                            ) : (
                                 <button onClick={() => handleExportPdf(modalState.submission!)} disabled={isProcessing} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2">
                                     {isProcessing ? <Loader2 className="animate-spin"/> : <FileDown size={20}/>}
                                     تنزيل PDF
                                </button>
                            )}
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};


// =================================================================================================
// TAB 3: Communicate with Parents (New Version)
// =================================================================================================
const ParentCommunication = ({ principal, submissions, settings }: { principal: User, submissions: StudentSubmission[], settings: SchoolSettings }) => {
    const [contacts, setContacts] = useState<ParentContact[]>([]);
    const [newContact, setNewContact] = useState({ studentName: '', parentPhone: '964', stage: '' });
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [filterStage, setFilterStage] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    
    // Modal state
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [modalTargets, setModalTargets] = useState<ParentContact[]>([]);
    const [modalMessage, setModalMessage] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [modalView, setModalView] = useState<'compose' | 'send-list'>('compose');


    const relevantGrades = useMemo(() => getRelevantGradeLevels(settings.schoolLevel), [settings.schoolLevel]);
    
    const getNextDayDate = (dayName: 'السبت' | 'الأحد' | 'الاثنين' | 'الثلاثاء' | 'الأربعاء' | 'الخميس' | 'الجمعة'): string => {
        const dayMap: Record<string, number> = { 'الأحد': 0, 'الاثنين': 1, 'الثلاثاء': 2, 'الأربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'السبت': 6 };
        const targetDay = dayMap[dayName];
        if (targetDay === undefined) return '';

        const today = new Date();
        const currentDay = today.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) { daysToAdd += 7; }
        const nextDate = new Date();
        nextDate.setDate(today.getDate() + daysToAdd);
        
        return nextDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    useEffect(() => {
        const contactsRef = db.ref(`parent_contacts/${principal.id}`);
        const callback = (snapshot: any) => {
            const data = snapshot.val() || {};
            const contactList: ParentContact[] = Object.entries(data).map(([id, value]) => ({ id, ...value as Omit<ParentContact, 'id'> }));
            setContacts(contactList);
        };
        contactsRef.on('value', callback);
        return () => contactsRef.off('value', callback);
    }, [principal.id]);

    const normalizePhoneNumberForWhatsApp = (phone: string): string => {
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('0')) { cleaned = cleaned.substring(1); }
        if (!cleaned.startsWith('964')) { return '964' + cleaned; }
        return cleaned;
    };

    const openMessageModal = (targets: ParentContact[]) => {
        if (targets.length === 0) {
            alert('يرجى تحديد جهة اتصال واحدة على الأقل.');
            return;
        }
        setModalTargets(targets);
        setModalMessage('عزيزي ولي الأمر، تحية طيبة وبعد،');
        setModalView('compose');
        setIsMessageModalOpen(true);
    };

    const handleSendSingleMessage = (contact: ParentContact) => {
        if (!modalMessage.trim()) {
            alert('الرسالة فارغة.');
            return;
        }
        const encodedMessage = encodeURIComponent(modalMessage);
        const phone = normalizePhoneNumberForWhatsApp(contact.parentPhone);
        window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    };

    const handleAiRephrase = async () => {
        if (!modalMessage.trim()) {
            alert("يرجى كتابة رسالة أولاً لإعادة صياغتها.");
            return;
        }
        setIsAiLoading(true);

        let dateContext = '';
        const daysOfWeek = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
        const foundDay = daysOfWeek.find(day => modalMessage.includes(day));

        if (foundDay) {
            const nextDate = getNextDayDate(foundDay as any);
            if (nextDate) {
                dateContext = ` The user mentioned '${foundDay}'. The calculated date for the upcoming ${foundDay} is ${nextDate}. Please incorporate this specific date into your response naturally.`;
            }
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `You are an eloquent and professional Iraqi school principal communicating with students' parents. Your task is to take the user's brief message and brilliantly expand it into a complete, polite, and formal announcement suitable for WhatsApp.
            - Add a professional Arabic opening (e.g., "تحية طيبة إلى أولياء الأمور الكرام") and a suitable closing (e.g., "مع خالص التقدير، إدارة المدرسة").
            - Elaborate on the message's core point, adding context and emphasizing its importance. For instance, if it's about a meeting, highlight the value of parent-teacher cooperation for the student's success and suggest reasons for the meeting.
            - If the user's message is a simple statement, infer the purpose and build a full message around it. (e.g., "No school tomorrow" becomes a formal announcement about a holiday).
            - ${dateContext}
            - Maintain a formal but welcoming tone.
            - Your final output MUST be ONLY the enhanced Arabic message, without any extra text, explanations, or markdown.
            
            Original brief message: "${modalMessage}"`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            
            const rephrasedText = response.text;
            if (rephrasedText) {
                setModalMessage(rephrasedText.trim());
            } else {
                alert("لم يتمكن الذكاء الاصطناعي من إعادة صياغة النص. يرجى المحاولة مرة أخرى.");
            }
        } catch (error) {
            console.error("AI rephrasing failed:", error);
            alert("حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.");
        } finally {
            setIsAiLoading(false);
        }
    };
    
    const handleImportFromSubmissions = async () => {
        setIsImporting(true);
        const contactsRef = db.ref(`parent_contacts/${principal.id}`);
        const existingContactsSnapshot = await contactsRef.get();
        const existingContacts: ParentContact[] = existingContactsSnapshot.val() ? Object.values(existingContactsSnapshot.val()) : [];
        const existingStudentNames = new Set(existingContacts.map(c => c.studentName));
        
        let newContactsCount = 0;
        const updates: Record<string, any> = {};

        for (const sub of submissions) {
            if (!existingStudentNames.has(sub.studentName)) {
                const phone = sub.formData.fatherPhone || sub.formData.motherPhone;
                if (phone && phone.trim()) {
                    const normalizedPhone = normalizePhoneNumberForWhatsApp(phone.trim());
                    const newId = db.ref().child(`parent_contacts/${principal.id}`).push().key;
                    if (newId) {
                        updates[newId] = {
                            principalId: principal.id,
                            studentName: sub.studentName,
                            parentPhone: normalizedPhone,
                            stage: sub.stage
                        };
                        newContactsCount++;
                        existingStudentNames.add(sub.studentName);
                    }
                }
            }
        }
        
        if (newContactsCount > 0) {
            await contactsRef.update(updates);
            alert(`تم استيراد ${newContactsCount} جهة اتصال جديدة بنجاح.`);
        } else {
            alert('لا توجد جهات اتصال جديدة لاستيرادها. جميع الطلاب في الاستمارات موجودون بالفعل في القائمة.');
        }
        setIsImporting(false);
    };

    const handleAddContact = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newContact.studentName || !newContact.parentPhone || newContact.parentPhone.replace(/\D/g, '') === '964') {
            alert('يرجى ملء اسم الطالب ورقم هاتف صحيح.');
            return;
        }
        const normalizedPhone = normalizePhoneNumberForWhatsApp(newContact.parentPhone);
        const newId = db.ref().child(`parent_contacts/${principal.id}`).push().key;
        if (newId) {
             db.ref(`parent_contacts/${principal.id}/${newId}`).set({ 
                principalId: principal.id,
                studentName: newContact.studentName.trim(),
                parentPhone: normalizedPhone,
                stage: newContact.stage
            });
            setNewContact({ studentName: '', parentPhone: '964', stage: '' });
        }
    };

    const handleDeleteContact = (contactId: string) => {
        if (window.confirm('هل أنت متأكد من حذف جهة الاتصال هذه؟')) {
            db.ref(`parent_contacts/${principal.id}/${contactId}`).remove();
        }
    };
    
    const handleToggleSelect = (contactId: string) => {
        setSelectedContactIds(prev => prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]);
    };
    
    const filteredContacts = useMemo(() => {
        if (!filterStage) return contacts;
        return contacts.filter(c => c.stage === filterStage);
    }, [contacts, filterStage]);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-3">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-bold">قائمة الطلاب ({filteredContacts.length})</h3>
                        <button onClick={handleImportFromSubmissions} disabled={isImporting} className="flex items-center gap-2 px-3 py-1 bg-teal-500 text-white text-sm rounded-md hover:bg-teal-600 disabled:bg-gray-400">
                            {isImporting ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>}
                            استيراد من الاستمارات
                        </button>
                    </div>
                    <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="w-full p-2 border rounded-md mb-2">
                        <option value="">-- كل المراحل --</option>
                        {relevantGrades.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                    <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2 border rounded-lg p-2 bg-gray-50">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-gray-50">
                                <tr>
                                    <th className="p-2 w-10"><input type="checkbox" onChange={(e) => setSelectedContactIds(e.target.checked ? filteredContacts.map(c => c.id) : [])}/></th>
                                    <th className="p-2 text-right">اسم الطالب</th>
                                    <th className="p-2 text-right">رقم هاتف ولي الأمر</th>
                                    <th className="p-2 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredContacts.map(contact => (
                                    <tr key={contact.id} className="hover:bg-gray-100">
                                        <td className="p-2 text-center"><input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={() => handleToggleSelect(contact.id)} className="h-5 w-5"/></td>
                                        <td className="p-2"><span className="font-semibold">{contact.studentName}</span> <span className="text-sm text-gray-500">({contact.stage})</span></td>
                                        <td className="p-2 text-right font-mono">{contact.parentPhone}</td>
                                        <td className="p-2 text-center">
                                            <div className="flex justify-center items-center gap-2">
                                                <button onClick={() => openMessageModal([contact])} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title="مراسلة فردية"><MessageSquare size={18}/></button>
                                                <button onClick={() => handleDeleteContact(contact.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="حذف"><Trash2 size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="md:col-span-2 space-y-6">
                    <form onSubmit={handleAddContact} className="p-4 bg-gray-50 rounded-lg border space-y-3">
                        <h3 className="text-lg font-bold">إضافة طالب جديد يدوياً</h3>
                        <select value={newContact.stage} onChange={e => setNewContact(p => ({...p, stage: e.target.value}))} className="w-full p-2 border rounded-md" required>
                            <option value="">-- اختر المرحلة --</option>
                            {relevantGrades.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <input type="text" value={newContact.studentName} onChange={e => setNewContact(p => ({...p, studentName: e.target.value}))} placeholder="اسم الطالب" className="w-full p-2 border rounded-md" required />
                        <input type="tel" value={newContact.parentPhone} onChange={e => setNewContact(p => ({...p, parentPhone: e.target.value}))} placeholder="964xxxxxxxxx" className="w-full p-2 border rounded-md text-left" dir="ltr" required />
                        <button type="submit" className="w-full p-2 bg-blue-600 text-white rounded-md flex items-center justify-center gap-2"><Plus/>إضافة الطالب</button>
                    </form>

                    <div className="p-4 bg-gray-50 rounded-lg border mt-6 space-y-3">
                        <h3 className="text-lg font-bold">رسالة جماعية</h3>
                        <p className="text-sm text-gray-600">حدد الطلاب من القائمة ثم انقر للإرسال.</p>
                        <button onClick={() => openMessageModal(contacts.filter(c => selectedContactIds.includes(c.id)))} className="w-full p-2 bg-green-600 text-white rounded-md flex items-center justify-center gap-2">
                            <Send/>إرسال إلى ({selectedContactIds.length}) طلاب محددين
                        </button>
                    </div>
                </div>
            </div>

            {isMessageModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                        <header className="p-4 border-b">
                            <h3 className="text-lg font-bold">
                                {modalView === 'compose' ? (modalTargets.length === 1 ? `إرسال رسالة إلى ولي أمر: ${modalTargets[0].studentName}` : `إرسال رسالة جماعية إلى (${modalTargets.length}) من أولياء الأمور`) : 'إرسال الرسالة'}
                            </h3>
                        </header>
                        <div className="p-4">
                            {modalView === 'compose' ? (
                                <textarea
                                    value={modalMessage}
                                    onChange={e => setModalMessage(e.target.value)}
                                    rows={8}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="اكتب رسالتك هنا..."
                                />
                            ) : (
                                <>
                                    <h4 className="font-bold mb-2">الرسالة النهائية:</h4>
                                    <p className="p-3 bg-gray-100 rounded-md mb-4 whitespace-pre-wrap max-h-40 overflow-y-auto">{modalMessage}</p>
                                    <h4 className="font-bold mb-2">قائمة المستلمين (انقر للإرسال):</h4>
                                    <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
                                        {modalTargets.map(contact => (
                                            <div key={contact.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                                <span>{contact.studentName}</span>
                                                <button onClick={() => handleSendSingleMessage(contact)} className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600">
                                                    إرسال
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <footer className="p-4 border-t flex justify-between items-center gap-2">
                            {modalView === 'compose' ? (
                                <>
                                    <button onClick={handleAiRephrase} disabled={isAiLoading} className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white text-sm font-semibold rounded-lg hover:bg-purple-600 disabled:bg-gray-400">
                                        {isAiLoading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} />}
                                        <span>إبداع الذكاء الاصطناعي</span>
                                    </button>
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsMessageModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md">إلغاء</button>
                                        <button onClick={() => setModalView('send-list')} className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700">متابعة للإرسال</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setModalView('compose')} className="px-4 py-2 bg-gray-200 rounded-md">تعديل الرسالة</button>
                                    <button onClick={() => setIsMessageModalOpen(false)} className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700">إغلاق</button>
                                </>
                            )}
                        </footer>
                    </div>
                </div>
            )}
        </>
    );
};


// =================================================================================================
// Main Component
// =================================================================================================
interface StudentManagementProps {
    principal: User;
    settings: SchoolSettings;
    classes: ClassData[];
}
type StudentManagementTab = 'submissions' | 'codesAndAnnouncements' | 'parentCommunication';

export default function StudentManagement({ principal, settings, classes }: StudentManagementProps) {
    const [activeTab, setActiveTab] = useState<StudentManagementTab>('submissions');
    const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

    useEffect(() => {
        const submissionsRef = db.ref(`student_submissions/${principal.id}`);
        const handleNewData = (snapshot: any) => {
            const data = snapshot.val();
            const subs = data ? Object.entries(data).map(([id, value]) => ({ id, ...value as Omit<StudentSubmission, 'id'>})) : [];
            setSubmissions(subs.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
        };
        submissionsRef.on('value', handleNewData);
        return () => submissionsRef.off('value', handleNewData);
    }, [principal.id]);
    
    const unreadSubmissionsCount = useMemo(() => submissions.filter(s => s.status === 'pending').length, [submissions]);

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg">
            {isVideoModalOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[100] p-4"
                    onClick={() => setIsVideoModalOpen(false)}
                >
                    <div 
                        className="bg-black p-2 rounded-lg shadow-xl w-full max-w-4xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setIsVideoModalOpen(false)}
                            className="absolute -top-3 -right-3 bg-white text-black rounded-full p-2 z-10 shadow-lg hover:scale-110 transition-transform"
                            aria-label="Close video"
                        >
                            <X size={24} />
                        </button>
                        <div className="relative w-full" style={{ paddingTop: '56.25%' }}> {/* 16:9 Aspect Ratio */}
                            <iframe
                                src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2F61578356680977%2Fvideos%2F775228615157825%2F&show_text=false&autoplay=1&mute=0"
                                className="absolute top-0 left-0 w-full h-full"
                                style={{ border: 'none', overflow: 'hidden' }}
                                title="Facebook video player"
                                frameBorder="0"
                                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                                allowFullScreen={true}>
                            </iframe>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
                <p className="font-bold">هذه الصفحة مخصصة لإنشاء ما يأتي:</p>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>رمز خاص لكل مرحلة.</li>
                    <li>من خلال الرمز يستطيع الطالب الدخول الى التطبيق من اجل ملئ استمارة المعلومات الخاصة به.</li>
                    <li>ارقام الهواتف التي تحتاجها من اجل التواصل مع اولياء الامور من ضمن الاستمارة التي على الطالب ملئها تأكد عليها في التبليغات.</li>
                    <li>شاهد عرض الفيديو التوضيحي فيه المزيد من التفاصيل المهمة.</li>
                </ol>
            </div>
            
            <button onClick={() => setIsVideoModalOpen(true)} className="flex items-center justify-center gap-2 w-full p-4 bg-red-600 text-white font-bold text-lg rounded-lg hover:bg-red-700 transition shadow-md mb-6">
                <PlayCircle />
                شاهد العرض التوضيحي المهم لكيفية إدارة الطلبة بالتفصيل
            </button>

            <div className="flex border-b mb-4 flex-wrap">
                <button onClick={() => setActiveTab('codesAndAnnouncements')} className={`px-4 py-2 font-semibold ${activeTab === 'codesAndAnnouncements' ? 'border-b-2 border-cyan-500 text-cyan-600' : 'text-gray-500'}`}><Key className="inline-block ml-2" size={18}/>رموز الدخول والتبليغات</button>
                <button onClick={() => setActiveTab('submissions')} className={`px-4 py-2 font-semibold relative ${activeTab === 'submissions' ? 'border-b-2 border-cyan-500 text-cyan-600' : 'text-gray-500'}`}>
                    <ClipboardList className="inline-block ml-2" size={18}/>
                    الاستمارات المستلمة
                    {unreadSubmissionsCount > 0 && <span className="absolute top-1 right-0 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadSubmissionsCount}</span>}
                </button>
                <button onClick={() => setActiveTab('parentCommunication')} className={`px-4 py-2 font-semibold ${activeTab === 'parentCommunication' ? 'border-b-2 border-cyan-500 text-cyan-600' : 'text-gray-500'}`}><MessageSquare className="inline-block ml-2" size={18}/>التواصل مع أولياء الأمور</button>
            </div>
            
            {activeTab === 'codesAndAnnouncements' && <CodesAndAnnouncements principal={principal} settings={settings} />}
            {activeTab === 'submissions' && <ReceivedForms submissions={submissions} principal={principal} />}
            {activeTab === 'parentCommunication' && <ParentCommunication principal={principal} submissions={submissions} settings={settings} />}
        </div>
    );
}