import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { User, SchoolSettings, StudentSubmission, ParentContact, Student } from '../../types';
import { db } from '../../lib/firebase';
import { Key, Send, ClipboardList, RefreshCw, Copy, Check, Eye, X, Edit, Trash2, FileDown, Loader2, MessageSquare, Plus, UserPlus, PlayCircle, Users as UsersIcon, Download, Sparkles } from 'lucide-react';
import { GRADE_LEVELS } from '../../constants';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from "@google/genai";

interface CounselorParentCommunicationProps {
    principalId: string;
    settings: SchoolSettings;
    submissions: StudentSubmission[];
    contacts: ParentContact[];
}

const getRelevantGradeLevels = (schoolLevel?: SchoolSettings['schoolLevel']): string[] => {
    if (!schoolLevel) return GRADE_LEVELS;
    if (schoolLevel === 'ابتدائية') return GRADE_LEVELS.filter(g => g.includes('ابتدائي'));
    if (schoolLevel === 'متوسطة') return GRADE_LEVELS.filter(g => g.includes('متوسط'));
    if (schoolLevel.includes('اعدادي') || schoolLevel.includes('اعدادية')) return GRADE_LEVELS.filter(g => g.includes('الرابع') || g.includes('الخامس') || g.includes('السادس'));
    if (schoolLevel.includes('ثانوية')) return GRADE_LEVELS.filter(g => g.includes('متوسط') || g.includes('الرابع') || g.includes('الخامس') || g.includes('السادس'));
    return GRADE_LEVELS;
};

export default function CounselorParentCommunication({ principalId, settings, submissions, contacts: initialContacts }: CounselorParentCommunicationProps) {
    const [allContacts, setAllContacts] = useState<ParentContact[]>([]);
    const [filterStage, setFilterStage] = useState('');
    const [selectedStudentNames, setSelectedStudentNames] = useState<string[]>([]);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [modalTargets, setModalTargets] = useState<ParentContact[]>([]);
    const [modalMessage, setModalMessage] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [modalView, setModalView] = useState<'compose' | 'send-list'>('compose');

    const relevantGrades = useMemo(() => getRelevantGradeLevels(settings.schoolLevel), [settings.schoolLevel]);

    useEffect(() => {
        const combinedContacts = new Map<string, ParentContact>();

        // Add manually added contacts first
        initialContacts.forEach(contact => {
            combinedContacts.set(contact.studentName.trim(), contact);
        });

        // Add contacts from submissions, avoiding duplicates
        submissions.forEach(sub => {
            const studentName = sub.studentName.trim();
            if (!combinedContacts.has(studentName)) {
                const phone = sub.formData.fatherPhone || sub.formData.motherPhone;
                if (phone && phone.trim()) {
                    combinedContacts.set(studentName, {
                        id: `sub_${sub.id}`,
                        principalId: sub.principalId,
                        studentName: studentName,
                        parentPhone: phone,
                        stage: sub.stage
                    });
                }
            }
        });

        setAllContacts(Array.from(combinedContacts.values()));
    }, [initialContacts, submissions]);


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
            const prompt = `You are an eloquent and professional Iraqi school counselor communicating with students' parents. Your task is to take the user's brief message and brilliantly expand it into a complete, polite, and formal announcement suitable for WhatsApp.
            - Add a professional Arabic opening (e.g., "تحية طيبة إلى أولياء الأمور الكرام") and a suitable closing (e.g., "مع خالص التقدير، الإرشاد التربوي").
            - Elaborate on the message's core point, adding context and emphasizing its importance. For instance, if it's about a meeting, highlight the value of parent-teacher cooperation for the student's success and suggest reasons for the meeting.
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
            }
        } catch (error) {
            console.error("AI rephrasing failed:", error);
            alert("حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.");
        } finally {
            setIsAiLoading(false);
        }
    };
    
    const handleToggleSelect = (studentName: string) => {
        setSelectedStudentNames(prev => prev.includes(studentName) ? prev.filter(name => name !== studentName) : [...prev, studentName]);
    };
    
    const filteredContacts = useMemo(() => {
        if (!filterStage) return allContacts;
        return allContacts.filter(c => c.stage === filterStage);
    }, [allContacts, filterStage]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
             <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">مخاطبة أولياء الأمور</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-3">
                    <h3 className="text-lg font-bold">قائمة الطلاب ({filteredContacts.length})</h3>
                    <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="w-full p-2 border rounded-md mb-2">
                        <option value="">-- كل المراحل --</option>
                        {relevantGrades.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                    <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2 border rounded-lg p-2 bg-gray-50">
                        <table className="w-full">
                             <thead className="sticky top-0 bg-gray-50">
                                <tr>
                                    <th className="p-2 w-10"><input type="checkbox" onChange={(e) => setSelectedStudentNames(e.target.checked ? filteredContacts.map(c => c.studentName) : [])}/></th>
                                    <th className="p-2 text-right">اسم الطالب</th>
                                    <th className="p-2 text-right">رقم هاتف ولي الأمر</th>
                                    <th className="p-2 text-center">مراسلة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredContacts.map(contact => (
                                    <tr key={contact.id || contact.studentName} className="hover:bg-gray-100">
                                        <td className="p-2 text-center"><input type="checkbox" checked={selectedStudentNames.includes(contact.studentName)} onChange={() => handleToggleSelect(contact.studentName)} className="h-5 w-5"/></td>
                                        <td className="p-2"><span className="font-semibold">{contact.studentName}</span> <span className="text-sm text-gray-500">({contact.stage})</span></td>
                                        <td className="p-2 text-right font-mono">{contact.parentPhone}</td>
                                        <td className="p-2 text-center">
                                            <button onClick={() => openMessageModal([contact])} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title="مراسلة فردية"><MessageSquare size={18}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="md:col-span-2">
                    <div className="p-4 bg-gray-50 rounded-lg border mt-6 space-y-3">
                        <h3 className="text-lg font-bold">رسالة جماعية</h3>
                        <p className="text-sm text-gray-600">حدد الطلاب من القائمة ثم انقر للإرسال.</p>
                        <button onClick={() => openMessageModal(allContacts.filter(c => selectedStudentNames.includes(c.studentName)))} className="w-full p-2 bg-green-600 text-white rounded-md flex items-center justify-center gap-2">
                            <Send/>إرسال إلى ({selectedStudentNames.length}) طلاب محددين
                        </button>
                    </div>
                </div>
            </div>

             {isMessageModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                        <header className="p-4 border-b">
                            <h3 className="text-lg font-bold">{modalView === 'compose' ? `إرسال رسالة` : 'إرسال الرسالة'}</h3>
                        </header>
                        <div className="p-4">
                            {modalView === 'compose' ? (
                                <textarea value={modalMessage} onChange={e => setModalMessage(e.target.value)} rows={8} className="w-full p-2 border rounded-md" placeholder="اكتب رسالتك هنا..."/>
                            ) : (
                                <>
                                    <h4 className="font-bold mb-2">الرسالة النهائية:</h4>
                                    <p className="p-3 bg-gray-100 rounded-md mb-4 whitespace-pre-wrap max-h-40 overflow-y-auto">{modalMessage}</p>
                                    <h4 className="font-bold mb-2">قائمة المستلمين (انقر للإرسال):</h4>
                                    <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
                                        {modalTargets.map(contact => (
                                            <div key={contact.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                                <span>{contact.studentName}</span>
                                                <button onClick={() => handleSendSingleMessage(contact)} className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600">إرسال</button>
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
        </div>
    );
}