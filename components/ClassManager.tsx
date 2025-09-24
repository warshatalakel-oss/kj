
import React, { useState, useRef } from 'react';
import type { ClassData, Student, User, TeacherAssignment, Subject } from '../types.ts';
import { GRADE_LEVELS, DEFAULT_SUBJECTS } from '../constants.ts';
import { Plus, Upload, Trash2, Edit, Save, X, UserPlus, ListVideo } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/firebase.ts';


declare const XLSX: any;

const MINISTERIAL_STAGES = ['الثالث متوسط', 'السادس العلمي', 'السادس الادبي'];

interface ClassManagerProps {
    classes: ClassData[];
    onSelectClass: (classId: string) => void;
    currentUser: User;
    teacherAssignments?: TeacherAssignment[];
}

export default function ClassManager({ classes, onSelectClass, currentUser, teacherAssignments }: ClassManagerProps): React.ReactNode {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<Partial<ClassData> | null>(null);
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [selectedClassForStudentAdd, setSelectedClassForStudentAdd] = useState<ClassData | null>(null);
    const [pastedData, setPastedData] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for subject editing
    const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
    const [editingSubjectName, setEditingSubjectName] = useState('');
    const [newSubjectName, setNewSubjectName] = useState('');
    
    const isPrincipal = currentUser.role === 'principal';

    const displayedClasses = React.useMemo(() => {
        let filteredClasses;
        if (isPrincipal) {
            filteredClasses = classes.filter(c => c.principalId === currentUser.id);
        } else { // For teacher
            const assignedClassIds = teacherAssignments?.map(a => a.classId) || [];
            filteredClasses = classes.filter(c => assignedClassIds.includes(c.id));
        }

        // Sort the filtered classes based on stage and section
        return filteredClasses.sort((a, b) => {
            const stageAIndex = GRADE_LEVELS.indexOf(a.stage);
            const stageBIndex = GRADE_LEVELS.indexOf(b.stage);

            // Handle cases where a stage might not be in the predefined list
            // (e.g., custom stage) by placing them at the end.
            if (stageAIndex === -1 && stageBIndex !== -1) return 1;
            if (stageAIndex !== -1 && stageBIndex === -1) return -1;
            
            // Primary sort by stage index from GRADE_LEVELS
            if (stageAIndex !== stageBIndex) {
                return stageAIndex - stageBIndex;
            }

            // Secondary sort by section name, alphabetically for Arabic
            return a.section.localeCompare(b.section, 'ar-IQ');
        });
    }, [classes, currentUser, teacherAssignments, isPrincipal]);

    const openModalForNew = () => {
        if (!isPrincipal) return;
        setEditingClass({});
        setIsModalOpen(true);
    };

    const openModalForEdit = (classData: ClassData) => {
        if (!isPrincipal) return;
        setEditingClass(classData);
        setIsModalOpen(true);
    };

    const handleSaveClass = () => {
        if (!isPrincipal || !editingClass || !editingClass.stage) return;
        if (!editingClass?.section) {
            alert('يرجى ملء المرحلة والشعبة.');
            return;
        }

        const isMinisterial = MINISTERIAL_STAGES.includes(editingClass.stage);

        const dataToSave: Partial<ClassData> = {
            stage: editingClass.stage,
            section: editingClass.section,
            subjects: editingClass.subjects || [],
            ministerialDecisionPoints: isMinisterial ? (editingClass.ministerialDecisionPoints ?? 5) : null,
            ministerialSupplementarySubjects: isMinisterial ? (editingClass.ministerialSupplementarySubjects ?? 3) : null,
        };


        if (editingClass.id) { // Editing existing class
             const classRef = db.ref(`classes/${editingClass.id}`);
             classRef.update(dataToSave);
        } else { // Adding new class
            const newClass: ClassData = {
                id: uuidv4(),
                stage: editingClass.stage,
                section: editingClass.section,
                subjects: editingClass.subjects || [],
                students: [],
                principalId: currentUser.id,
                ministerialDecisionPoints: dataToSave.ministerialDecisionPoints,
                ministerialSupplementarySubjects: dataToSave.ministerialSupplementarySubjects,
            };
            db.ref(`classes/${newClass.id}`).set(newClass);
        }
        setIsModalOpen(false);
        setEditingClass(null);
    };

    const handleDeleteClass = (classId: string) => {
        if (!isPrincipal) return;
        if (window.confirm('هل أنت متأكد من حذف هذه الشعبة بكل طلابها ودرجاتها؟ لا يمكن التراجع عن هذا الإجراء.')) {
            db.ref(`classes/${classId}`).remove();
        }
    };
    
    const openStudentModal = (classData: ClassData) => {
        if (!isPrincipal) return;
        setSelectedClassForStudentAdd(classData);
        setPastedData('');
        setIsStudentModalOpen(true);
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedClassForStudentAdd) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = event.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            const newStudents = json.slice(1).map((row: any[]): Student => ({
                id: uuidv4(),
                name: row[0] || '',
                registrationId: row[1]?.toString() || '',
                birthDate: row[2]?.toString() || '',
                examId: row[3]?.toString() || '',
                yearsOfFailure: row[4]?.toString() || '',
                motherName: row[5]?.toString() || '',
                motherFatherName: row[6]?.toString() || '',
                grades: {}
            })).filter(s => s.name);

            addStudentsToClass(newStudents);
        };
        reader.readAsBinaryString(file);
        e.target.value = ''; // Reset file input
    };

    const handlePasteData = () => {
        if (!pastedData || !selectedClassForStudentAdd) return;
        const rows = pastedData.split('\n').filter(row => row.trim() !== '');
        const newStudents = rows.map(row => {
            const columns = row.split('\t'); // Assuming tab-separated
            return {
                id: uuidv4(),
                name: columns[0] || '',
                registrationId: columns[1] || '',
                birthDate: columns[2] || '',
                examId: columns[3] || '',
                yearsOfFailure: columns[4] || '',
                motherName: columns[5] || '',
                motherFatherName: columns[6] || '',
                grades: {}
            };
        }).filter(s => s.name);
        addStudentsToClass(newStudents);
    };

    const addStudentsToClass = (newStudents: Student[]) => {
        if (!selectedClassForStudentAdd) return;
        const targetClassId = selectedClassForStudentAdd.id;
        const currentClass = classes.find(c => c.id === targetClassId);
        if (!currentClass) return;
        
        const existingStudents = currentClass.students || [];
        const updatedStudents = [...existingStudents, ...newStudents].sort((a,b) => {
            const aId = a.examId || '';
            const bId = b.examId || '';
            const numA = parseInt(aId, 10);
            const numB = parseInt(bId, 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return aId.localeCompare(bId, undefined, { numeric: true });
        });
        db.ref(`classes/${targetClassId}`).update({ students: updatedStudents });

        alert(`تمت إضافة ${newStudents.length} طالب بنجاح.`);
        setIsStudentModalOpen(false);
    }

    // --- Subject Management Handlers ---
    const handleStageChange = (newStage: string) => {
        const isMinisterial = MINISTERIAL_STAGES.includes(newStage);
        setEditingClass(prev => ({
            ...prev,
            id: prev?.id, // Keep id if editing
            stage: newStage,
            subjects: DEFAULT_SUBJECTS[newStage] || [],
            section: prev?.section, // Keep section
            // Set defaults for ministerial stages
            ministerialDecisionPoints: isMinisterial ? (prev?.ministerialDecisionPoints ?? 5) : undefined,
            ministerialSupplementarySubjects: isMinisterial ? (prev?.ministerialSupplementarySubjects ?? 3) : undefined,
        }));
    };

    const handleAddSubject = () => {
        if (!newSubjectName.trim() || !editingClass) return;
        const newSubject: Subject = {
            id: uuidv4(),
            name: newSubjectName.trim(),
        };
        setEditingClass(prev => ({
            ...prev,
            subjects: [...(prev?.subjects || []), newSubject],
        }));
        setNewSubjectName('');
    };

    const handleStartEditSubject = (subject: Subject) => {
        setEditingSubjectId(subject.id);
        setEditingSubjectName(subject.name);
    };

    const handleCancelEditSubject = () => {
        setEditingSubjectId(null);
        setEditingSubjectName('');
    };

    const handleSaveSubject = (subjectId: string) => {
        if (!editingSubjectName.trim()) return;
        setEditingClass(prev => {
            if (!prev || !prev.subjects) return prev;
            return {
                ...prev,
                subjects: prev.subjects.map(s => 
                    s.id === subjectId ? { ...s, name: editingSubjectName.trim() } : s
                ),
            };
        });
        handleCancelEditSubject();
    };

    const handleDeleteSubject = (subjectId: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذه المادة؟')) {
            setEditingClass(prev => {
                 if (!prev || !prev.subjects) return prev;
                 return {
                    ...prev,
                    subjects: prev.subjects.filter(s => s.id !== subjectId)
                 }
            });
        }
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-3xl font-bold text-gray-800">إدارة الشعب الدراسية</h2>
                {isPrincipal && (
                    <button onClick={openModalForNew} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition">
                        <Plus size={20} />
                        <span>إضافة شعبة جديدة</span>
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {displayedClasses.length > 0 ? displayedClasses.map(cls => (
                    <div key={cls.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-gray-700">{cls.stage} - {cls.section}</h3>
                            <p className="text-sm text-gray-500">{(cls.students || []).length} طالب</p>
                        </div>
                        <div className="flex items-center gap-2">
                           <button onClick={() => onSelectClass(cls.id)} className="p-2 text-white bg-green-500 rounded-md hover:bg-green-600 transition" title="عرض سجل الدرجات"><ListVideo size={20}/></button>
                           {isPrincipal && (
                               <>
                                   <button onClick={() => openStudentModal(cls)} className="p-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 transition" title="إضافة طلاب"><UserPlus size={20}/></button>
                                   <button onClick={() => openModalForEdit(cls)} className="p-2 text-white bg-yellow-500 rounded-md hover:bg-yellow-600 transition" title="تعديل الشعبة"><Edit size={20}/></button>
                                   <button onClick={() => handleDeleteClass(cls.id)} className="p-2 text-white bg-red-500 rounded-md hover:bg-red-600 transition" title="حذف الشعبة"><Trash2 size={20}/></button>
                               </>
                           )}
                        </div>
                    </div>
                )) : <p className="text-center text-gray-500 py-8">لم يتم إضافة أي شعبة بعد. ابدأ بإضافة شعبة جديدة.</p>}
            </div>

            {isPrincipal && isModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl">
                        <h3 className="text-xl font-bold mb-4">{editingClass?.id ? 'تعديل شعبة' : 'إضافة شعبة جديدة'}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column: Class Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">المرحلة</label>
                                    <select 
                                        value={editingClass?.stage || ''} 
                                        onChange={(e) => handleStageChange(e.target.value)}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md"
                                    >
                                        <option value="" disabled>اختر المرحلة</option>
                                        {GRADE_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">اسم/رمز الشعبة</label>
                                    <input 
                                        type="text" 
                                        value={editingClass?.section || ''}
                                        onChange={(e) => setEditingClass({...editingClass, section: e.target.value})}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                                        placeholder="مثال: أ, ب, ج"
                                    />
                                </div>
                                {MINISTERIAL_STAGES.includes(editingClass?.stage || '') && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">درجة القرار لدخول الامتحان الوزاري</label>
                                            <input 
                                                type="number" 
                                                value={editingClass?.ministerialDecisionPoints ?? 5}
                                                onChange={(e) => setEditingClass({...editingClass, ministerialDecisionPoints: parseInt(e.target.value, 10) || 0})}
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">عدد دروس الاكمال الخاصة بالمرحلة</label>
                                            <input 
                                                type="number" 
                                                value={editingClass?.ministerialSupplementarySubjects ?? 3}
                                                onChange={(e) => setEditingClass({...editingClass, ministerialSupplementarySubjects: parseInt(e.target.value, 10) || 0})}
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            {/* Right Column: Subject Editor */}
                            <div>
                                {editingClass?.stage && (
                                    <div>
                                        <h4 className="text-md font-medium text-gray-700">المواد الدراسية للمرحلة</h4>
                                        <div className="mt-1 p-2 border border-gray-300 rounded-lg bg-gray-50 h-64 flex flex-col">
                                            <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                                                {(editingClass.subjects || []).map(subject => (
                                                    <div key={subject.id}>
                                                        {editingSubjectId === subject.id ? (
                                                            <div className="flex items-center gap-2">
                                                                <input value={editingSubjectName} onChange={e => setEditingSubjectName(e.target.value)} className="flex-grow px-2 py-1 border border-cyan-500 rounded-md" autoFocus/>
                                                                <button type="button" onClick={() => handleSaveSubject(subject.id)} className="p-1 text-green-600 hover:bg-green-100 rounded-full"><Save size={18}/></button>
                                                                <button type="button" onClick={handleCancelEditSubject} className="p-1 text-gray-500 hover:bg-gray-100 rounded-full"><X size={18}/></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between p-1 rounded-md hover:bg-gray-200">
                                                                <span className="text-gray-800">{subject.name}</span>
                                                                <div className="flex items-center gap-1">
                                                                    <button type="button" onClick={() => handleStartEditSubject(subject)} className="p-1 text-blue-600 hover:bg-blue-100 rounded-full"><Edit size={16}/></button>
                                                                    <button type="button" onClick={() => handleDeleteSubject(subject.id)} className="p-1 text-red-600 hover:bg-red-100 rounded-full"><Trash2 size={16}/></button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                                                <input value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} className="flex-grow px-2 py-1 border border-gray-300 rounded-md" placeholder="إضافة مادة جديدة..."/>
                                                <button type="button" onClick={handleAddSubject} className="p-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700"><Plus size={18}/></button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">إلغاء</button>
                            <button onClick={handleSaveClass} className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700">{editingClass?.id ? 'حفظ التعديلات' : 'إضافة الشعبة'}</button>
                        </div>
                    </div>
                </div>
            )}
            
            {isPrincipal && isStudentModalOpen && selectedClassForStudentAdd && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
                        <h3 className="text-xl font-bold mb-4">إضافة طلاب إلى: {selectedClassForStudentAdd.stage} - {selectedClassForStudentAdd.section}</h3>
                         <div>
                            <h4 className="font-semibold text-lg mb-2">1. استيراد من ملف Excel</h4>
                            <p className="text-sm text-gray-600 mb-2">يجب أن يكون الملف بالترتيب التالي: اسم الطالب، رقم القيد، التولد، الرقم الامتحاني، سنوات الرسوب، اسم الأم، اسم والد الأم. (بدون عناوين للأعمدة)</p>
                            <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".xlsx, .xls" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"/>
                        </div>
                        <div className="my-4 border-t border-gray-200"></div>
                        <div>
                             <h4 className="font-semibold text-lg mb-2">2. لصق البيانات</h4>
                             <p className="text-sm text-gray-600 mb-2">الصق البيانات من جدول (مثل Excel) مع فصل الأعمدة بـ (Tab). بالترتيب: اسم، قيد، تولد، رقم امتحاني، سنوات الرسوب، اسم الأم، اسم والد الأم.</p>
                             <textarea value={pastedData} onChange={(e) => setPastedData(e.target.value)} rows={8} className="w-full p-2 border border-gray-300 rounded-md" placeholder="اسم الطالب	رقم القيد	التولد	الرقم الامتحاني	سنوات الرسوب	اسم الأم	اسم والد الأم..."></textarea>
                             <button onClick={handlePasteData} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">معالجة البيانات الملصقة</button>
                        </div>
                         <div className="mt-6 flex justify-end">
                            <button onClick={() => setIsStudentModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}