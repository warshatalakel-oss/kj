import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { User, Conversation, ChatMessage, MessageAttachment } from '../../types';
import { db, storage } from '../../lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { Send, Paperclip, X, Loader2, Image as ImageIcon, File as FileIcon, Download, Users, MessageCircle } from 'lucide-react';

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

const ChatWindow = ({ conversation, currentUser, messages }: { conversation: Conversation, currentUser: User, messages: ChatMessage[] }) => {
    const [newMessage, setNewMessage] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [lightboxImage, setLightboxImage] = useState<{url: string, name: string} | null>(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }); }, [messages]);

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && !attachment) || isSending || !currentUser.principalId) return;
        setIsSending(true);

        const principalUserSnap = await db.ref(`users/${currentUser.principalId}`).get();
        const principalName = principalUserSnap.val()?.name || 'المدير';
        
        const convExists = conversation && conversation.lastMessageTimestamp > 0;
        let currentConv = conversation;
        if (!convExists) {
             currentConv = {
                id: `p_${currentUser.principalId}__s_${currentUser.id}`, principalId: currentUser.principalId!, studentId: currentUser.id, studentName: currentUser.name,
                staffName: principalName, lastMessageText: '', lastMessageTimestamp: 0,
                unreadByStudent: false, unreadByStaff: false, isArchived: false, chatDisabled: false,
            };
        }
        
        const messageId = uuidv4();
        const timestamp = Date.now();
        let messageAttachment: MessageAttachment | undefined = undefined;

        try {
            if (attachment) {
                const isImage = attachment.type.startsWith('image/');
                let fileToUpload: Blob = attachment;
                if (isImage) { try { fileToUpload = await compressImage(attachment); } catch (e) { console.warn(e); } }
                
                const storageRef = storage.ref(`chat_attachments/${currentUser.principalId}/${currentConv.id}/${messageId}-${attachment.name}`);
                const snapshot = await storageRef.put(fileToUpload);
                const url = await snapshot.ref.getDownloadURL();
                messageAttachment = { type: isImage ? 'image' : 'pdf', url, name: attachment.name, size: fileToUpload.size };
            }
            
            const message: ChatMessage = { id: messageId, senderId: currentUser.id, senderName: currentUser.name, text: newMessage.trim(), timestamp, ...(messageAttachment && { attachment: messageAttachment }) };
            const lastMessageText = message.text || `مرفق: ${message.attachment?.name}`;
            const conversationUpdates: Partial<Conversation> = { lastMessageText, lastMessageTimestamp: timestamp, unreadByStudent: false, unreadByStaff: true, isArchived: false };
            
            const updates: Record<string, any> = {};
            updates[`/conversations/${currentUser.principalId}/${currentConv.id}`] = { ...currentConv, ...conversationUpdates };
            updates[`/messages/${currentConv.id}/${messageId}`] = message;

            await db.ref().update(updates);
            setNewMessage(''); setAttachment(null); if(fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) { console.error(error); alert("فشل إرسال الرسالة."); } finally { setIsSending(false); }
    };

    return (
        <div className="flex flex-col h-full bg-white border rounded-lg shadow-lg">
            {lightboxImage && <ImageLightbox imageUrl={lightboxImage.url} imageName={lightboxImage.name} onClose={() => setLightboxImage(null)} />}
            <div className="p-3 border-b bg-gray-50"><h3 className="font-bold text-lg">{conversation.groupName || conversation.staffName || 'الإدارة'}</h3></div>
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
             {conversation?.chatDisabled ? (
                <div className="p-4 border-t bg-gray-100 text-center text-gray-500 font-semibold">الدردشة معطلة من قبل الإدارة.</div>
            ) : (
                <div className="p-2 border-t bg-white">
                    {attachment && (<div className="p-2 flex items-center justify-between bg-gray-100 rounded-md mb-2"><span className="text-sm truncate">{attachment.name}</span><button onClick={() => { setAttachment(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><X size={16}/></button></div>)}
                    <div className="flex items-center gap-2">
                        <input type="file" ref={fileInputRef} onChange={e => setAttachment(e.target.files?.[0] || null)} className="hidden" accept="image/jpeg,image/png,application/pdf"/>
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-cyan-600"><Paperclip/></button>
                        <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} placeholder="اكتب رسالتك..." className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                        <button onClick={handleSendMessage} disabled={isSending} className="p-3 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:bg-gray-400">{isSending ? <Loader2 className="animate-spin"/> : <Send/>}</button>
                    </div>
                </div>
            )}
        </div>
    );
};


interface AdministrativeMessagesProps {
    currentUser: User;
}

export default function AdministrativeMessages({ currentUser }: AdministrativeMessagesProps) {
    const [allConversations, setAllConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [principalName, setPrincipalName] = useState('الإدارة');

    useEffect(() => {
        if (!currentUser.principalId) {
            setIsLoading(false);
            return;
        }
        
        db.ref(`users/${currentUser.principalId}`).get().then(snap => {
            if (snap.exists()) {
                setPrincipalName(snap.val().name);
            }
        });

        const convRef = db.ref(`conversations/${currentUser.principalId}`);
        const callback = (snapshot: any) => {
            const data = snapshot.val() || {};
            const convList: Conversation[] = Object.values(data);
            setAllConversations(convList);
            setIsLoading(false);
        };
        convRef.on('value', callback);

        return () => convRef.off('value', callback);
    }, [currentUser.principalId]);

    useEffect(() => {
        if (activeConversation) {
            const messagesRef = db.ref(`messages/${activeConversation.id}`);
            const callback = (snapshot: any) => {
                const data = snapshot.val() || {};
                setMessages((Object.values(data) as ChatMessage[]).sort((a, b) => a.timestamp - b.timestamp));
                
                if (activeConversation.unreadByStudent) {
                    db.ref(`conversations/${currentUser.principalId}/${activeConversation.id}/unreadByStudent`).set(false);
                }
            };
            messagesRef.on('value', callback);
            return () => messagesRef.off('value', callback);
        } else {
            setMessages([]);
        }
    }, [activeConversation, currentUser.principalId]);

    const handleSelectPrincipalChat = () => {
        const principalConvId = `p_${currentUser.principalId}__s_${currentUser.id}`;
        const existingConv = allConversations.find(c => c.id === principalConvId);

        if (existingConv) {
            setActiveConversation(existingConv);
        } else {
            const newConv: Conversation = {
                id: principalConvId,
                principalId: currentUser.principalId!,
                studentId: currentUser.id,
                studentName: currentUser.name,
                staffName: principalName,
                lastMessageText: '',
                lastMessageTimestamp: 0,
                unreadByStudent: false,
                unreadByStaff: false,
                isArchived: false,
                chatDisabled: false,
            };
            setActiveConversation(newConv);
        }
    };

    const groupConvs = useMemo(() => {
        return allConversations
            .filter(c => !c.teacherId && c.classId === currentUser.classId)
            .sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
    }, [allConversations, currentUser.classId]);

    const principalConvForUnread = allConversations.find(c => c.id === `p_${currentUser.principalId}__s_${currentUser.id}`);
    const hasUnreadPrincipalMessage = principalConvForUnread?.unreadByStudent;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 11rem)' }}>
            <div className="md:col-span-1 bg-white border rounded-lg p-2 overflow-y-auto">
                <h3 className="font-bold p-2 text-center text-lg">محادثات الإدارة</h3>
                
                <button onClick={handleSelectPrincipalChat} className={`w-full text-right p-3 rounded-md flex justify-between items-center ${activeConversation?.id === `p_${currentUser.principalId}__s_${currentUser.id}` ? 'bg-cyan-500 text-white' : 'hover:bg-gray-100'}`}>
                    <div className="flex items-center gap-2">
                        <div>
                            <p className="font-semibold">{principalName}</p>
                        </div>
                    </div>
                    {hasUnreadPrincipalMessage && <span className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0 ml-2 animate-pulse"></span>}
                </button>
                
                {groupConvs.map(conv => {
                    const isActive = activeConversation?.id === conv.id;
                    return (
                        <button key={conv.id} onClick={() => setActiveConversation(conv)} className={`w-full text-right p-3 rounded-md flex justify-between items-center ${isActive ? 'bg-cyan-500 text-white' : 'hover:bg-gray-100'}`}>
                            <div className="flex items-center gap-2 overflow-hidden">
                                {conv.classId && <Users size={16} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />}
                                <div className="truncate">
                                    <p className="font-semibold truncate">{conv.groupName || conv.staffName}</p>
                                </div>
                            </div>
                            {conv.unreadByStudent && <span className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0 ml-2 animate-pulse"></span>}
                        </button>
                    )
                })}
            </div>
            <div className="md:col-span-2 h-full">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin h-10 w-10"/></div>
                ) : activeConversation ? (
                    <ChatWindow conversation={activeConversation} currentUser={currentUser} messages={messages} />
                ) : (
                     <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 bg-gray-50 rounded-lg">
                        <MessageCircle size={48} className="mb-4"/>
                        <p className="font-semibold">اختر محادثة لعرض الرسائل.</p>
                        <p className="text-sm mt-2">يمكنك بدء محادثة جديدة مع الإدارة بالضغط على اسم المدير.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
