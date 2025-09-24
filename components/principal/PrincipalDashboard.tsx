
import React, { useState, useMemo } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { User, ClassData, TeacherAssignment } from '../../types';
import { Plus, UserPlus, Copy, Check, Trash2, Edit, Save, X, Download, Loader2, Shield, PlayCircle } from 'lucide-react';
import TeacherCodesPDF from './TeacherCodesPDF';
import { db } from '../../lib/firebase';
import { GRADE_LEVELS } from '../../constants';

declare const jspdf: any;
declare const html2canvas: any;

interface PrincipalDashboardProps {
    principal: User;
    classes: ClassData[];
    users: User[];
    addUser: (user: Omit<User, 'id' | 'assignments'> & { assignments: TeacherAssignment[] }) => User;
    updateUser: (userId: string, updater: (user: User) => User) => void;
    deleteUser: (userId: string) => void;
}

const generateCode = (length: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export default function PrincipalDashboard({ principal, classes, users, addUser, updateUser, deleteUser }: PrincipalDashboardProps) {
    const [newTeacherName, setNewTeacherName] = useState('');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
    const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
    const [isCounselor, setIsCounselor] = useState(false);
    const [isExportingCodes, setIsExportingCodes] = useState(false);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

    const staff = users.filter(u => (u.role === 'teacher' || u.role === 'counselor') && u.principalId === principal.id);
    const counselor = staff.find(u => u.role === 'counselor');
    const teachers = staff.filter(u => u.role === 'teacher').sort((a, b) => a.name.localeCompare(b.name, 'ar-IQ'));

    const sortedClassesForModal = useMemo(() => {
        return [...classes].sort((a, b) => {
            const stageAIndex = GRADE_LEVELS.indexOf(a.stage);
            const stageBIndex = GRADE_LEVELS.indexOf(b.stage);
    
            if (stageAIndex === -1 && stageBIndex !== -1) return 1;
            if (stageAIndex !== -1 && stageBIndex === -1) return -1;
            
            if (stageAIndex !== stageBIndex) {
                return stageAIndex - stageBIndex;
            }
    
            return a.section.localeCompare(b.section, 'ar-IQ');
        });
    }, [classes]);

    const handleAddTeacher = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTeacherName.trim()) return;

        addUser({
            name: newTeacherName.trim(),
            role: 'teacher',
            code: generateCode(7),
            principalId: principal.id,
            assignments: [],
        });

        setNewTeacherName('');
    };

    const handleEditAssignments = (teacher: User) => {
        setEditingTeacher(teacher);
        setAssignments(teacher.assignments || []);
        setIsCounselor(teacher.role === 'counselor');
    };
    
    const handleAssignmentChange = (classId: string, subjectId: string, isChecked: boolean) => {
        setAssignments(prev => {
            if (isChecked) {
                return [...prev, { classId, subjectId }];
            } else {
                return prev.filter(a => !(a.classId === classId && a.subjectId === subjectId));
            }
        });
    };

    const handleSaveAssignments = () => {
        if (!editingTeacher) return;
        
        const wasCounselor = editingTeacher.role === 'counselor';
        
        if (isCounselor && !wasCounselor) { // Promoting to counselor
            if (counselor && counselor.id !== editingTeacher.id) {
                if (window.confirm(`يوجد مرشد تربوي بالفعل (${counselor.name}). هل تريد استبداله؟ سيتم تحويل المرشد الحالي إلى مدرس.`)) {
                    // Demote old counselor
                    updateUser(counselor.id, user => ({ ...user, role: 'teacher' }));
                    // Promote new one
                    updateUser(editingTeacher.id, user => ({ ...user, role: 'counselor', assignments }));
                }
            } else {
                // No conflict, just promote
                updateUser(editingTeacher.id, user => ({ ...user, role: 'counselor', assignments }));
            }
        } else if (!isCounselor && wasCounselor) { // Demoting from counselor
            updateUser(editingTeacher.id, user => ({ ...user, role: 'teacher', assignments }));
        } else { // Just saving assignments, role doesn't change
            updateUser(editingTeacher.id, user => ({ ...user, assignments }));
        }

        setEditingTeacher(null);
    };


    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(code).then(() => {
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2000);
        });
    };
    
    const handleExportCodes = async () => {
        if (teachers.length === 0) {
            alert("لا يوجد مدرسين لتصدير أرقامهم.");
            return;
        }
        setIsExportingCodes(true);

        const tempContainer = document.createElement('div');
        Object.assign(tempContainer.style, { position: 'absolute', left: '-9999px', top: '0' });
        document.body.appendChild(tempContainer);
        const root = ReactDOM.createRoot(tempContainer);

        const renderComponent = (component: React.ReactElement) => new Promise<void>(resolve => {
            root.render(component);
            setTimeout(resolve, 500);
        });

        try {
            await document.fonts.ready;
            await renderComponent(<TeacherCodesPDF teachers={teachers} />);

            const pdfElement = tempContainer.children[0] as HTMLElement;
            const canvas = await html2canvas(pdfElement, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');

            const { jsPDF } = jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            pdf.save(`teacher_codes_${principal.schoolName}.pdf`);
        } catch (error) {
            console.error("PDF Export Error:", error);
            alert("حدث خطأ أثناء تصدير الأرقام السرية.");
        } finally {
            root.unmount();
            if (document.body.contains(tempContainer)) {
                document.body.removeChild(tempContainer);
            }
            setIsExportingCodes(false);
        }
    };


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
                                src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2F61578356680977%2Fvideos%2F643783455430949%2F&show_text=false&autoplay=1&mute=0"
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
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">لوحة تحكم المدير</h2>
             <div className="mb-6">
                <button
                    onClick={() => setIsVideoModalOpen(true)}
                    className="w-full flex items-center gap-4 p-3 bg-red-100 rounded-lg hover:bg-red-200 transition-all duration-300 hover:shadow-md text-red-700"
                >
                    <PlayCircle className="w-12 h-12 text-red-600" />
                    <div>
                        <h4 className="font-bold text-red-800">طريقة اضافة المدرس والمرشد مع جولة سريعة</h4>
                        <p className="text-sm text-red-600">شاهد عرض الفيديو التوضيحي للخطوات بالتفصيل.</p>
                    </div>
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <h3 className="text-xl font-bold text-gray-700 mb-4">إضافة مدرس جديد</h3>
                    <form onSubmit={handleAddTeacher} className="space-y-4 bg-gray-50 p-4 rounded-lg">
                        <div>
                            <label className="block text-md font-medium text-gray-700 mb-2">اسم المدرس</label>
                            <input
                                type="text"
                                value={newTeacherName}
                                onChange={(e) => setNewTeacherName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                placeholder="الاسم الكامل للمدرس"
                                required
                            />
                        </div>
                        <button type="submit" className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700">
                            <UserPlus size={20} />
                            <span>إضافة مدرس</span>
                        </button>
                    </form>
                </div>

                <div className="lg:col-span-2">
                    {counselor && (
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-700 mb-2">المرشد التربوي</h3>
                             <div className="bg-green-50 p-4 rounded-lg border border-green-300">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-lg text-green-800 flex items-center gap-2"><Shield size={20}/> {counselor.name}</p>
                                    <div className="flex items-center gap-2">
                                        <code className="bg-gray-200 font-mono font-bold px-2 py-1 rounded">{counselor.code}</code>
                                        <button onClick={() => copyToClipboard(counselor.code)} className="p-2 text-gray-500 hover:text-cyan-600 rounded-full">
                                            {copiedCode === counselor.code ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                        </button>
                                        <button onClick={() => handleEditAssignments(counselor)} className="p-2 text-white bg-blue-500 rounded-md hover:bg-blue-600"><Edit size={18} /></button>
                                        <button onClick={() => deleteUser(counselor.id)} className="p-2 text-white bg-red-500 rounded-md hover:bg-red-600 transition" title="حذف المرشد"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-700">قائمة المدرسين ({teachers.length})</h3>
                         <button
                            onClick={handleExportCodes}
                            disabled={isExportingCodes}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
                        >
                            {isExportingCodes ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                            <span>{isExportingCodes ? 'جاري التصدير...' : 'تصدير الأرقام السرية'}</span>
                        </button>
                    </div>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {teachers.map(teacher => (
                            <div key={teacher.id} className="bg-gray-50 p-4 rounded-lg border">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-lg text-gray-700">{teacher.name}</p>
                                    <div className="flex items-center gap-2">
                                        <code className="bg-gray-200 font-mono font-bold px-2 py-1 rounded">{teacher.code}</code>
                                        <button onClick={() => copyToClipboard(teacher.code)} className="p-2 text-gray-500 hover:text-cyan-600 rounded-full">
                                            {copiedCode === teacher.code ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                        </button>
                                        <button onClick={() => handleEditAssignments(teacher)} className="p-2 text-white bg-blue-500 rounded-md hover:bg-blue-600"><Edit size={18} /></button>
                                        <button onClick={() => deleteUser(teacher.id)} className="p-2 text-white bg-red-500 rounded-md hover:bg-red-600 transition" title="حذف المدرس"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-600 mt-2">
                                    المواد المسندة: {(teacher.assignments || []).length}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {editingTeacher && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl">
                        <h3 className="text-xl font-bold mb-4">تعيين الصلاحيات والمواد لـ: {editingTeacher.name}</h3>
                        <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 mb-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-5 w-5 rounded text-cyan-600"
                                    checked={isCounselor}
                                    onChange={(e) => setIsCounselor(e.target.checked)}
                                />
                                <span className="font-bold text-lg text-yellow-800">تعيين كمرشد تربوي للمدرسة</span>
                            </label>
                        </div>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto p-2 border rounded-lg">
                            {sortedClassesForModal.map(cls => (
                                <div key={cls.id} className="p-3 bg-gray-50 rounded-md">
                                    <h4 className="font-bold text-lg text-cyan-700">{cls.stage} - {cls.section}</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                        {(cls.subjects || []).map(sub => (
                                            <label key={sub.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-200">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded text-cyan-600"
                                                    checked={assignments.some(a => a.classId === cls.id && a.subjectId === sub.id)}
                                                    onChange={(e) => handleAssignmentChange(cls.id, sub.id, e.target.checked)}
                                                />
                                                <span>{sub.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setEditingTeacher(null)} className="px-4 py-2 bg-gray-300 rounded-md"><X className="inline-block ml-1"/> إلغاء</button>
                            <button onClick={handleSaveAssignments} className="px-4 py-2 bg-green-600 text-white rounded-md"><Save className="inline-block ml-1" /> حفظ التعيينات</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
