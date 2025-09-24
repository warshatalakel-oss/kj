import React, { useState, useEffect, useRef } from 'react';
import type { User, Homework, HomeworkSubmission, HomeworkAttachment } from '../../types';
import { ArrowLeft, Paperclip, Send, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { v4 as uuidv4 } from 'uuid';

interface HomeworkSubmissionViewProps {
    currentUser: User;
    homework: Homework;
    submission: HomeworkSubmission | undefined;
    onBack: () => void;
}

const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/') || file.size < 300 * 1024) { // Only compress images > 300KB
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = event => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1280;
          let { width, height } = img;
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas context not available'));
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas to Blob conversion failed'));
          }, 'image/jpeg', 0.8);
        };
      };
    });
};

export default function HomeworkSubmissionView({ currentUser, homework, submission, onBack }: HomeworkSubmissionViewProps) {
    const [textAnswer, setTextAnswer] = useState('');
    const [fileAttachment, setFileAttachment] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const isSubmitted = !!submission;
    const isReadOnly = isSubmitted && submission.status !== 'pending';

    useEffect(() => {
        if (submission) {
            setTextAnswer(submission.texts?.[0] || '');
        }
    }, [submission]);

    const handleSubmit = async () => {
        if (!textAnswer.trim() && !fileAttachment) {
            alert('يرجى كتابة إجابة أو إرفاق ملف على الأقل.');
            return;
        }
        setIsSubmitting(true);
        try {
            let newAttachment: HomeworkAttachment | undefined = undefined;

            if (fileAttachment) {
                const fileToUpload = fileAttachment.type.startsWith('image/') ? await compressImage(fileAttachment) : fileAttachment;
                const attachmentId = uuidv4();
                const path = `homework_submissions/${currentUser.principalId}/${currentUser.id}/${homework.id}/${attachmentId}-${fileAttachment.name}`;
                const storageRef = storage.ref(path);
                await storageRef.put(fileToUpload);
                const url = await storageRef.getDownloadURL();
                newAttachment = {
                    name: fileAttachment.name,
                    url,
                    type: fileAttachment.type.startsWith('image') ? 'image' : 'pdf',
                    path
                };
            }
            
            // If a new file is uploaded, it replaces the old one(s).
            // If no new file is uploaded, the existing attachments are preserved.
            const finalAttachments = newAttachment ? [newAttachment] : (submission?.attachments || []);

            const submissionData: HomeworkSubmission = {
                id: submission?.id || uuidv4(),
                homeworkId: homework.id,
                studentId: currentUser.id,
                studentName: currentUser.name,
                classId: currentUser.classId!,
                submittedAt: new Date().toISOString(),
                texts: [textAnswer.trim()],
                attachments: finalAttachments,
                status: 'pending'
            };

            await db.ref(`homework_submissions/${currentUser.principalId}/${currentUser.id}/${homework.id}`).set(submissionData);
            alert('تم إرسال إجابتك بنجاح.');
            onBack();

        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء إرسال الواجب.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const renderStatusBadge = () => {
        if (!submission) return null;
        
        let statusInfo: { text: string; icon: React.ReactNode; color: string; };

        switch(submission.status) {
            case 'accepted':
                statusInfo = { text: 'تم قبول واجبك', icon: <CheckCircle/>, color: 'bg-green-100 text-green-800' };
                break;
            case 'rejected':
                statusInfo = { text: 'تم رفض واجبك', icon: <XCircle/>, color: 'bg-red-100 text-red-800' };
                break;
            default:
                 statusInfo = { text: 'تم إرسال واجبك وهو قيد المراجعة', icon: <Clock/>, color: 'bg-yellow-100 text-yellow-800' };
        }

        return (
            <div className={`p-4 rounded-lg flex items-center gap-3 ${statusInfo.color}`}>
                {statusInfo.icon}
                <div>
                    <p className="font-bold">{statusInfo.text}</p>
                    {submission.status === 'rejected' && submission.rejectionReason && (
                        <p className="text-sm mt-1">السبب: {submission.rejectionReason}</p>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-4xl mx-auto">
             <button onClick={onBack} className="flex items-center gap-2 mb-4 text-cyan-600 font-semibold hover:text-cyan-800">
                <ArrowLeft size={20} />
                <span>العودة للواجبات</span>
            </button>
            
            <div className="border-b pb-4 mb-4">
                <h2 className="text-3xl font-bold">{homework.title}</h2>
                <p className="text-gray-600">{homework.subjectName}</p>
            </div>
            
            {homework.notes && (
                <div className="p-4 bg-gray-50 rounded-lg mb-4">
                    <h4 className="font-bold mb-2">ملاحظات المدرس:</h4>
                    <p className="whitespace-pre-wrap">{homework.notes}</p>
                </div>
            )}
            
            {Array.isArray(homework.attachments) && homework.attachments.length > 0 && (
                 <div className="p-4 bg-gray-50 rounded-lg mb-4">
                    <h4 className="font-bold mb-2">المرفقات:</h4>
                    <div className="space-y-2">
                        {homework.attachments.map(att => (
                            <a key={att.url} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-white border rounded-md hover:bg-gray-100 text-blue-600">
                                <Paperclip size={16}/> {att.name}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-6">
                <h3 className="text-2xl font-bold mb-4">إجابتك</h3>
                {renderStatusBadge()}
                
                <div className="mt-4 space-y-4">
                     <textarea 
                        value={textAnswer}
                        onChange={e => setTextAnswer(e.target.value)}
                        placeholder="اكتب إجابتك هنا..."
                        rows={8}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        disabled={isReadOnly}
                    />

                    <div>
                        <label className="block font-semibold mb-2">إرفاق ملف (صورة أو PDF)</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={e => setFileAttachment(e.target.files?.[0] || null)}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                            accept="image/*,application/pdf"
                            disabled={isReadOnly}
                        />
                    </div>
                    
                    {!isReadOnly && (
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 disabled:bg-gray-400 transition"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin"/> : <Send/>}
                            {isSubmitting ? 'جاري الإرسال...' : (isSubmitted ? 'إعادة إرسال الواجب' : 'إرسال الواجب')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}