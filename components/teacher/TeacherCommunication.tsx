import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Teacher, SchoolSettings, ClassData, Student, Conversation, ChatMessage, MessageAttachment, User, StudentNotification } from '../../types';
import { db, storage } from '../../lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { Send, Paperclip, X, Loader2, Image as ImageIcon, File as FileIcon, MessageCircle, Users, Download, UserPlus } from 'lucide-react';

// ===================================
// Lightbox Component
// ===================================
const ImageLightbox = ({ imageUrl, imageName, onClose }: { imageUrl: string; imageName: string; onClose: () => void; }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
                <img src={imageUrl} alt="Full size preview" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
                <button onClick={onClose} className="absolute -top-2 -right-2 bg-white text-black rounded-full p-2 shadow-lg hover:scale-110 transition-transform"><X size={24} /></button>
                <a href={imageUrl} download={imageName} target="_blank" rel="noopener noreferrer" className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-cyan-600 text-white rounded-lg flex items-center gap-2 hover:bg-cyan-700 transition-colors"><Download size={20} /> تحميل الصورة</a>
            </div>
        </div>
    );
};

// ===================================
// Image Compression Utility
// ===================================
const compressImage = (file: File, maxSizeKB: number = 300, maxWidth: number = 1280): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Could not get canvas context')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.9;
        const tryCompress = () => {
             canvas.toBlob((blob) => {
                if (!blob) { reject(new Error('Canvas to Blob conversion failed')); return; }
                if (blob.size / 1024 <= maxSizeKB || quality <= 0.3) { resolve(blob); } 
                else { quality -= 0.15; tryCompress(); }
            }, 'image/jpeg', quality);
        };
        tryCompress();
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// ===================================
// Chat Window Component
// ===================================
const ChatWindow = ({ conversation, currentUser, messages, subjectName, classes }: { conversation: Conversation, currentUser: User, messages: ChatMessage[], subjectName: string, classes: ClassData[] }) => {
    const [newMessage, setNewMessage] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [lightboxImage, setLightboxImage] = useState<{url: string, name: string} | null>(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }); }, [messages]);

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && !attachment) || isSending) return;
        setIsSending(true);

        const messageId = uuidv4();
        const timestamp = Date.now();
        let messageAttachment: MessageAttachment | undefined = undefined;

        try {
            if (attachment) {
                const isImage = attachment.type.startsWith('image/');
                let fileToUpload: Blob = attachment;
                if (isImage) { try { fileToUpload = await compressImage(attachment); } catch (e) { console.warn(e); } }
                
                const storageRef = storage.ref(`chat_attachments/${conversation.principalId}/${conversation.id}/${messageId}-${attachment.name}`);
                const snapshot = await storageRef.put(fileToUpload);
                const url = await snapshot.ref.getDownloadURL();
                messageAttachment = { type: isImage ? 'image' : 'pdf', url, name: attachment.name, size: fileToUpload.size };
            }
            const message: ChatMessage = { id: messageId, senderId: currentUser.id, senderName: currentUser.name, text: newMessage.trim(), timestamp, ...(messageAttachment && { attachment: messageAttachment }) };
            const lastMessageText = message.text || `مرفق: ${message.attachment?.name}`;
            
            const conversationUpdates: Partial<Conversation> = { 
                lastMessageText, 
                lastMessageTimestamp: timestamp, 
                unreadByStaff: false, 
                isArchived: false, 
                subjectName, 
                staffName: currentUser.name, 
            };

            if (!conversation.classId) {
                conversationUpdates.unreadByStudent = true;
            }
            
            const convRef = db.ref(`/conversations/${conversation.principalId}/${conversation.id}`);
            const existingConvSnap = await convRef.get();
            const existingConvData = existingConvSnap.val();

            let updates: Record<string, any> = {};
            updates[`/conversations/${conversation.principalId}/${conversation.id}`] = { ...(existingConvData || conversation), ...conversationUpdates };
            updates[`/messages/${conversation.id}/${messageId}`] = message;
            
            if (conversation.classId) {
                const classData = classes.find(c => c.id === conversation.classId);
                if (classData?.students) {
                    const notificationUpdates: Record<string, any> = {};
                    classData.students.forEach(student => {
                        if (student.studentAccessCode) {
                            const notifPath = `/student_notifications/${conversation.principalId}/${student.id}`;
                            const newNotifKey = db.ref(notifPath).push().key;
                            if (newNotifKey) {
                                const notification: Omit<StudentNotification, 'id'> = {
                                    studentId: student.id,
                                    message: `رسالة جديدة في مجموعة "${conversation.groupName || subjectName}" من المدرس ${currentUser.name}.`,
                                    timestamp: new Date().toISOString(),
                                    isRead: false
                                };
                                notificationUpdates[`${notifPath}/${newNotifKey}`] = notification;
                            }
                        }
                    });
                    updates = { ...updates, ...notificationUpdates };
                }
            }


            await db.ref().update(updates);
            setNewMessage(''); setAttachment(null); if(fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error("Error sending message:", error);
            alert("فشل إرسال الرسالة.");
        } finally { setIsSending(false); }
    };
    
    return (
        <div className="flex flex-col h-full bg-white border rounded-lg shadow-inner">
            {lightboxImage && <ImageLightbox imageUrl={lightboxImage.url} imageName={lightboxImage.name} onClose={() => setLightboxImage(null)} />}
            <div className="p-3 border-b bg-gray-50"><h3 className="font-bold text-lg">{conversation.groupName || conversation.studentName}</h3></div>
            <div className="flex-1 p-4 overflow-y-auto bg-gray-100 space-y-4">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md p-3 rounded-lg shadow ${msg.senderId === currentUser.id ? 'bg-cyan-500 text-white' : 'bg-white text-gray-800'}`}>
                            {msg.text && <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>}
                            {msg.attachment && (
                                <div className="mt-2">
                                     {msg.attachment.type === 'image' ? (
                                         <img src={msg.attachment.url} alt={msg.attachment.name} className="rounded-lg max-w-full h-auto cursor-pointer object-cover" style={{ maxHeight: '200px' }} onClick={() => setLightboxImage({url: msg.attachment.url, name: msg.attachment.name})} />
                                     ) : (
                                        <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-black/20 rounded-lg hover:bg-black/30"><FileIcon size={20}/> <span className="text-sm underline truncate">{msg.attachment.name}</span></a>
                                     )}
                                </div>
                            )}
                            <p className={`text-xs mt-1 text-right ${msg.senderId === currentUser.id ? 'text-cyan-100' : 'text-gray-500'}`}>{new Date(msg.timestamp).toLocaleTimeString('ar-EG')}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-2 border-t bg-white">
                {attachment && (<div className="p-2 flex items-center justify-between bg-gray-100 rounded-md mb-2"><span className="text-sm truncate">{attachment.name}</span><button onClick={() => { setAttachment(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><X size={16}/></button></div>)}
                <div className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={e => setAttachment(e.target.files?.[0] || null)} className="hidden" accept="image/jpeg,image/png,application/pdf"/>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-cyan-600"><Paperclip/></button>
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} placeholder="اكتب رسالتك..." className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                    <button onClick={handleSendMessage} disabled={isSending} className="p-3 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:bg-gray-400">{isSending ? <Loader2 className="animate-spin"/> : <Send/>}</button>
                </div>
            </div>
        </div>
    );
};

// ===================================
// Main Component
// ===================================
interface TeacherCommunicationProps {
    teacher: Teacher;
    settings: SchoolSettings;
    classes: ClassData[];
}

export default function TeacherCommunication({ teacher, settings, classes }: TeacherCommunicationProps) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'new_individual' | 'new_group'>('list');
    const [selectedAssignment, setSelectedAssignment] = useState(''); // "classId|subjectId"

    const teacherAssignments = useMemo(() => {
        return (teacher.assignments || []).map(a => {
            const classInfo = classes.find(c => c.id === a.classId);
            const subjectInfo = classInfo?.subjects.find(s => s.id === a.subjectId);
            if (!classInfo || !subjectInfo) return null;
            return { value: `${a.classId}|${a.subjectId}`, label: `${classInfo.stage} - ${classInfo.section} / ${subjectInfo.name}`, classInfo, subjectInfo };
        }).filter((a): a is NonNullable<typeof a> => a !== null);
    }, [teacher.assignments, classes]);

    const { selectedClass, selectedSubject } = useMemo(() => {
        if (!selectedAssignment) return { selectedClass: null, selectedSubject: null };
        const assignment = teacherAssignments.find(a => a.value === selectedAssignment);
        return { selectedClass: assignment?.classInfo || null, selectedSubject: assignment?.subjectInfo || null };
    }, [selectedAssignment, teacherAssignments]);

    const studentsInClass = useMemo(() => (selectedClass?.students || []).filter(s => s.studentAccessCode).sort((a,b) => a.name.localeCompare(b.name, 'ar')), [selectedClass]);

    useEffect(() => {
        const convRef = db.ref(`conversations/${teacher.principalId}`);
        const callback = (snapshot: any) => {
            const data = snapshot.val() || {};
            const convList: Conversation[] = Object.values(data);
            setConversations(
                convList
                    .filter(c => 
                        c.teacherId === teacher.id || // Individual chats started by this teacher
                        (c.classId && teacher.assignments?.some(a => a.classId === c.classId)) // Group chats for classes this teacher is in
                    )
                    .sort((a,b) => b.lastMessageTimestamp - a.lastMessageTimestamp)
            );
        };
        convRef.on('value', callback);
        return () => convRef.off('value', callback);
    }, [teacher.id, teacher.principalId, teacher.assignments]);

    useEffect(() => {
        if (activeConversation) {
            const messagesRef = db.ref(`messages/${activeConversation.id}`);
            const callback = (snapshot: any) => {
                const data = snapshot.val() || {};
                const sortedMessages = Object.values(data).sort((a: any, b: any) => a.timestamp - b.timestamp) as ChatMessage[];
                setMessages(sortedMessages);
                if (activeConversation.unreadByStaff) {
                     db.ref(`conversations/${teacher.principalId}/${activeConversation.id}/unreadByStaff`).set(false);
                }
            };
            messagesRef.on('value', callback);
            return () => messagesRef.off('value', callback);
        }
    }, [activeConversation, teacher.principalId]);
    
    const handleConversationClick = (conv: Conversation) => {
        setActiveConversation(conv);
        setViewMode('list');
    };

    const handleStudentClick = (student: Student) => {
        if(!selectedSubject) return;
        const convId = `t_${teacher.id}__s_${student.id}`;
        let conv = conversations.find(c => c.id === convId);
        if (!conv) {
            conv = {
                id: convId, principalId: teacher.principalId, teacherId: teacher.id, studentId: student.id, studentName: student.name,
                staffName: teacher.name, subjectName: selectedSubject.name, lastMessageText: '', lastMessageTimestamp: Date.now(),
                unreadByStudent: false, unreadByStaff: false, isArchived: false, chatDisabled: false,
            };
        }
        setActiveConversation(conv);
        setViewMode('list');
    };

    const handleStartGroupChat = (assignment: NonNullable<(typeof teacherAssignments)[0]>) => {
        const { classInfo, subjectInfo } = assignment;
        const convId = `group_t_${teacher.id}_c_${classInfo.id}_s_${subjectInfo.id}`;
        const existingConv = conversations.find(c => c.id === convId);
        
        if (existingConv) {
            setActiveConversation(existingConv);
        } else {
            const newConv: Conversation = {
                id: convId, principalId: teacher.principalId, teacherId: teacher.id,
                classId: classInfo.id, groupName: `مجموعة ${subjectInfo.name}`,
                staffName: teacher.name, subjectName: subjectInfo.name, lastMessageText: '', lastMessageTimestamp: Date.now(),
                unreadByStaff: false, isArchived: false, chatDisabled: false,
            };
            setActiveConversation(newConv);
        }
        setViewMode('list');
    };
    
    const renderRightPanel = () => {
        if (activeConversation) {
            const subjectForChat = selectedSubject || teacherAssignments.find(a => a.subjectInfo.name === activeConversation.subjectName)?.subjectInfo;
            if (subjectForChat) {
                return <ChatWindow conversation={activeConversation} currentUser={teacher} messages={messages} subjectName={subjectForChat.name} classes={classes} />;
            }
        }

        if (viewMode === 'new_group') {
             return (
                <div className="p-4 bg-white border rounded-lg h-full flex flex-col">
                    <h3 className="text-xl font-bold mb-4 border-b pb-2">بدء محادثة جماعية</h3>
                    <p className="mb-2">اختر الصف والمادة لبدء محادثة جماعية مع كل الطلاب.</p>
                     <div className="flex-1 overflow-y-auto space-y-1">
                        {teacherAssignments.map(a => 
                            <button key={a.value} onClick={() => handleStartGroupChat(a)} className="w-full text-right p-3 rounded-lg hover:bg-cyan-100 transition-colors">
                                {a.label}
                            </button>
                        )}
                    </div>
                </div>
            );
        }
        if (viewMode === 'new_individual') {
             return (
                <div className="p-4 bg-white border rounded-lg h-full flex flex-col">
                    <h3 className="text-xl font-bold mb-4 border-b pb-2">بدء محادثة فردية</h3>
                    <div className="space-y-4 mb-2">
                         <div>
                            <label className="font-semibold block mb-1">1. اختر الصف والمادة:</label>
                             <select value={selectedAssignment} onChange={e => setSelectedAssignment(e.target.value)} className="w-full p-2 border rounded-md bg-white">
                                <option value="">-- اختر لعرض الطلاب --</option>
                                {teacherAssignments.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                            </select>
                        </div>
                    </div>
                    {selectedAssignment && (
                         <div className="flex-1 overflow-y-auto border-t pt-2">
                             <label className="font-semibold block mb-1">2. اختر الطالب:</label>
                            {studentsInClass.length > 0 ? (
                                studentsInClass.map(student => (
                                    <button key={student.id} onClick={() => handleStudentClick(student)} className="w-full text-right p-2 rounded-md hover:bg-gray-100 font-semibold">{student.name}</button>
                                ))
                            ) : (<p className="text-center text-gray-500 mt-4">لا يوجد طلاب لديهم رموز دخول في هذه الشعبة.</p>)}
                        </div>
                    )}
                </div>
            );
        }
         return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 border rounded-lg text-gray-500 text-center p-4">
                <MessageCircle size={48} className="mb-4"/>
                <p className="font-semibold">اختر محادثة من القائمة لعرض الرسائل.</p>
                <p className="text-sm mt-2">أو ابدأ محادثة جديدة.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 12rem)' }}>
            <div className="md:col-span-1 bg-white border rounded-lg p-2 flex flex-col">
                 <div className="p-2 border-b space-y-2">
                    <h3 className="font-bold text-lg text-center">إنشاء محادثة</h3>
                     <div className="flex gap-2">
                        <button 
                            onClick={() => { setViewMode('new_group'); setActiveConversation(null); }} 
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-all"
                        >
                            <Users size={18}/> محادثة جماعية
                        </button>
                        <button 
                            onClick={() => { setViewMode('new_individual'); setActiveConversation(null); setSelectedAssignment(''); }} 
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-all"
                        >
                            <UserPlus size={18}/> محادثة فردية
                        </button>
                    </div>
                </div>
                <div className="p-2 border-b">
                    <h3 className="font-bold text-lg">المحادثات</h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {conversations.length > 0 ? conversations.map(conv => {
                        const isActive = activeConversation?.id === conv.id;
                        return (
                            <button key={conv.id} onClick={() => handleConversationClick(conv)} className={`w-full text-right p-3 rounded-md flex justify-between items-center ${isActive ? 'bg-cyan-500 text-white' : 'hover:bg-gray-100'}`}>
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {conv.classId && <Users size={20} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />}
                                    <div className="truncate">
                                        <p className="font-semibold truncate">{conv.groupName || conv.studentName}</p>
                                        <p className={`text-sm truncate ${isActive ? 'text-cyan-100' : 'text-gray-500'}`}>{conv.subjectName}</p>
                                    </div>
                                </div>
                                {(conv.unreadByStaff) && <span className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0 ml-2 animate-pulse"></span>}
                            </button>
                        )
                    }) : (<div className="p-4 text-center text-gray-500">لا توجد محادثات بعد.</div>)}
                </div>
            </div>
            <div className="md:col-span-2 h-full">
                {renderRightPanel()}
            </div>
        </div>
    );
}