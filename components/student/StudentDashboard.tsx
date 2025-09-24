import React, { useState, useMemo, useRef } from 'react';
import type { Student, StudentEvaluation, EvaluationRating } from '../../types';
import { Star, BarChart, X, Camera, Loader2, CheckCircle } from 'lucide-react';

interface StudentDashboardProps {
    evaluations: StudentEvaluation[];
    studentData: Student | null;
    onPhotoUpdate: (photoBlob: Blob) => Promise<void>;
}

const RATING_MAP: Record<EvaluationRating, { value: number; color: string; }> = {
    'ممتاز': { value: 5, color: 'text-green-500' },
    'جيد جدا': { value: 4, color: 'text-cyan-500' },
    'متوسط': { value: 3, color: 'text-blue-500' },
    'ضعيف': { value: 2, color: 'text-orange-500' },
    'ضعيف جدا': { value: 1, color: 'text-red-500' },
};

const INVERSE_RATING_MAP: Record<number, EvaluationRating> = {
    5: 'ممتاز',
    4: 'جيد جدا',
    3: 'متوسط',
    2: 'ضعيف',
    1: 'ضعيف جدا',
};

const compressImage = (file: File, maxSizeKB: number = 200, maxWidth: number = 512): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
          resolve(file);
          return;
      }
  
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
  
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
  
          canvas.width = width;
          canvas.height = height;
  
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          
          let quality = 0.8;
          const tryCompress = () => {
               canvas.toBlob(
                  (blob) => {
                      if (!blob) {
                          reject(new Error('Canvas to Blob conversion failed'));
                          return;
                      }
                      if (blob.size / 1024 <= maxSizeKB || quality <= 0.4) {
                          resolve(blob);
                      } else {
                          quality -= 0.1;
                          tryCompress();
                      }
                  },
                  'image/jpeg',
                  quality
              );
          };
          tryCompress();
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
};

export default function StudentDashboard({ evaluations, studentData, onPhotoUpdate }: StudentDashboardProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadSuccess(false);
        try {
            const compressedBlob = await compressImage(file);
            await onPhotoUpdate(compressedBlob);
            setUploadSuccess(true);
            setTimeout(() => setUploadSuccess(false), 3000); // Reset success message after 3s
        } catch (error) {
            console.error("Photo upload failed:", error);
            alert("فشل رفع الصورة.");
        } finally {
            setIsUploading(false);
        }
    };

    const overallEvaluation = useMemo(() => {
        if (evaluations.length === 0) {
            return { text: 'لا يوجد تقييم حتى الآن', color: 'text-gray-500' };
        }
        const totalValue = evaluations.reduce((sum, e) => sum + (RATING_MAP[e.rating]?.value || 0), 0);
        const averageValue = Math.round(totalValue / evaluations.length);
        const ratingText = INVERSE_RATING_MAP[averageValue] || 'متوسط';
        
        return { text: ratingText, color: RATING_MAP[ratingText]?.color || 'text-gray-500' };
    }, [evaluations]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                    <h2 className="text-xl font-semibold text-gray-600 mb-2">تقييمك العام</h2>
                    <div className={`flex items-center justify-center gap-2 text-5xl font-bold ${overallEvaluation.color}`}>
                        <Star className="w-12 h-12" />
                        <span>{overallEvaluation.text}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">هذا التقييم هو متوسط تقييماتك في جميع المواد.</p>

                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition-transform transform hover:scale-105"
                    >
                        <BarChart size={20} />
                        عرض تقييمات المواد
                    </button>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col justify-center">
                    <div className="relative">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 rounded-full text-center text-sm font-bold whitespace-nowrap border-2 border-white shadow">
                            صورة الطالب
                        </div>
                        <div
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            className="w-full h-48 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
                        >
                            {uploadSuccess ? (
                                <div className="text-center text-green-600">
                                    <CheckCircle size={48} />
                                    <p className="font-bold mt-2">تم الرفع بنجاح!</p>
                                </div>
                            ) : isUploading ? (
                                <Loader2 className="animate-spin h-10 w-10 text-gray-500" />
                            ) : studentData?.photoUrl ? (
                                <img src={studentData.photoUrl} alt="صورة الطالب" className="w-full h-full object-contain rounded-lg p-2" />
                            ) : (
                                <div className="text-center text-gray-500">
                                    <Camera size={48} />
                                    <p>انقر لتحميل الصورة</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <input id="photo-upload" type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
            </div>

            {isModalOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div 
                        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-2xl font-bold">تقييم المواد</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X/></button>
                        </div>
                        {evaluations.length > 0 ? (
                            <div className="max-h-[60vh] overflow-y-auto">
                                <table className="w-full text-right">
                                    <thead className="sticky top-0 bg-gray-100">
                                        <tr>
                                            <th className="p-3 font-semibold">المادة الدراسية</th>
                                            <th className="p-3 font-semibold">التقييم</th>
                                            <th className="p-3 font-semibold">الأستاذ المقيم</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {evaluations.map((evaluation, index) => (
                                            <tr key={evaluation.id} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                                <td className="p-3 font-medium">{evaluation.subjectName}</td>
                                                <td className={`p-3 font-bold ${RATING_MAP[evaluation.rating]?.color}`}>{evaluation.rating}</td>
                                                <td className="p-3 text-gray-600">{evaluation.teacherName}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-8">لم يقم المدرسون بتقييمك في أي مادة بعد.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
