import React, { useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { SchoolSettings, User } from '../types';
import { SCHOOL_TYPES, SCHOOL_GENDERS, SCHOOL_LEVELS, GOVERNORATES } from '../constants';
import { FileDown, Loader2, Key, Mail, RefreshCw, Save } from 'lucide-react';

declare const jspdf: any;
declare const html2canvas: any;

const generateCode = (length: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// A small component to render the content for the PDF export.
// This allows html2canvas to capture the correct styling and fonts.
const QrPdfContent: React.FC = () => (
    <div style={{ width: '794px', padding: '40px', fontFamily: "'Cairo', sans-serif", direction: 'rtl', backgroundColor: 'white' }}>
        <h2 style={{ fontSize: '24px', textAlign: 'center', color: 'black', marginBottom: '20px' }}>
            رموز QR الخاصة بروابط تطبيق تربوي تك المدراء
        </h2>
        <img 
            src="https://i.imgur.com/k7zAP9a.png" 
            alt="QR Codes for Tarbawe Tek App" 
            style={{ width: '100%', height: 'auto' }} 
        />
    </div>
);


interface SettingsProps {
    currentSettings: SchoolSettings;
    onSave: (settings: SchoolSettings) => void;
    currentUser: User;
    updateUser: (userId: string, updater: (user: User) => User) => void;
}

export default function Settings({ currentSettings, onSave, currentUser, updateUser }: SettingsProps): React.ReactNode {
    const [settings, setSettings] = useState<SchoolSettings>(currentSettings);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportMessage, setExportMessage] = useState("");
    
    const isPrincipal = currentUser.role === 'principal';
    const [securitySettings, setSecuritySettings] = useState({
        email: currentUser.email || '',
        code: currentUser.code || '',
        agreedToTerms: false,
    });


    // Teachers cannot edit anything.
    const isFormDisabled = currentUser.role === 'teacher';
    
    // Principals and teachers cannot edit the school/principal name or school level, as these are set by the admin.
    const areNameFieldsDisabled = currentUser.role === 'principal' || currentUser.role === 'teacher';


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumberInput = e.target instanceof HTMLInputElement && e.target.type === 'number';
        setSettings(prev => ({
            ...prev,
            [name]: isNumberInput ? (parseInt(value, 10) || 0) : value,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(settings);
    };

    const handleSecurityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSecuritySettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSaveSecurity = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!securitySettings.email.trim() || !emailRegex.test(securitySettings.email.trim())) {
            alert('يرجى إدخال بريد إلكتروني صالح للمتابعة.');
            return;
        }
        if (!securitySettings.code.trim()) {
            alert('رمز المرور لا يمكن أن يكون فارغًا.');
            return;
        }

        updateUser(currentUser.id, (user) => ({
            ...user,
            email: securitySettings.email.trim(),
            code: securitySettings.code.trim(),
        }));
        alert('تم تحديث إعدادات الأمان بنجاح.');
    };
    
    const handleExportQrPdf = async () => {
        setIsExportingPdf(true);
        setExportProgress(0);
        setExportMessage("...جاري التحضير");

        if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
            alert("مكتبة تصدير PDF غير محملة. يرجى تحديث الصفحة والمحاولة مرة أخرى.");
            setIsExportingPdf(false);
            return;
        }
    
        // Small timeout to allow React to render the modal before the heavy work starts
        await new Promise(resolve => setTimeout(resolve, 50));

        const tempContainer = document.createElement('div');
        Object.assign(tempContainer.style, {
            position: 'absolute',
            left: '-9999px',
            top: '0',
        });
        document.body.appendChild(tempContainer);
        const root = ReactDOM.createRoot(tempContainer);
    
        try {
            setExportProgress(20);
            setExportMessage("...جاري تحميل الخطوط والصور");
            await new Promise<void>(resolve => {
                root.render(<QrPdfContent />);
                // A timeout to ensure the image inside the component has loaded
                setTimeout(resolve, 1000); 
            });
    
            const elementToPrint = tempContainer.children[0] as HTMLElement;
            if (!elementToPrint) {
                throw new Error("Could not find element to print.");
            }
    
            setExportProgress(50);
            setExportMessage("...جاري تحويل المحتوى الى صورة");
            const canvas = await html2canvas(elementToPrint, { scale: 2, useCORS: true });
            
            setExportProgress(80);
            setExportMessage("...جاري انشاء ملف PDF");
            const { jsPDF } = jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save("tarbawe-tek-qr-codes.pdf");
    
            setExportProgress(100);
            setExportMessage("!اكتمل التصدير");

            setTimeout(() => {
                setIsExportingPdf(false);
            }, 1500);

        } catch (error) {
            console.error("PDF export failed:", error);
            alert("فشل تصدير ملف PDF.");
            setIsExportingPdf(false);
        } finally {
            root.unmount();
            document.body.removeChild(tempContainer);
        }
    };


    return (
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-5xl mx-auto">
            {isExportingPdf && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex flex-col justify-center items-center z-50 text-white p-4">
                    <Loader2 className="animate-spin h-16 w-16 mb-4" />
                    <p className="text-2xl font-bold mb-2">{exportMessage}</p>
                    <div className="w-full max-w-md bg-gray-600 rounded-full h-4">
                        <div 
                            className="bg-cyan-500 h-4 rounded-full transition-all duration-300" 
                            style={{ width: `${exportProgress}%` }}
                        ></div>
                    </div>
                    <p className="mt-2 text-lg font-mono">{exportProgress}%</p>
                </div>
            )}
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">الإعدادات العامة</h2>
            {isFormDisabled && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6" role="alert">
                    <p className="font-bold">وضع القراءة فقط</p>
                    <p>ليس لديك صلاحية لتغيير هذه الإعدادات.</p>
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Basic Info */}
                    <InputField label="اسم المدرسة" name="schoolName" value={settings.schoolName} onChange={handleChange} disabled={areNameFieldsDisabled} />
                    <InputField label="اسم مدير المدرسة" name="principalName" value={settings.principalName} onChange={handleChange} disabled={areNameFieldsDisabled} />
                    <InputField label="العام الدراسي" name="academicYear" value={settings.academicYear} onChange={handleChange} placeholder="مثال: 2023-2024" disabled={isFormDisabled}/>

                    {/* Location Info */}
                    <SelectField label="المحافظة" name="governorateName" value={settings.governorateName || ''} onChange={handleChange} options={GOVERNORATES} disabled={isFormDisabled} />
                    <InputField label="المديرية" name="directorate" value={settings.directorate} onChange={handleChange} disabled={isFormDisabled} />
                    <InputField label="القضاء" name="district" value={settings.district || ''} onChange={handleChange} disabled={isFormDisabled} />
                    <InputField label="الناحية" name="subdistrict" value={settings.subdistrict || ''} onChange={handleChange} disabled={isFormDisabled} />
                    <InputField label="رمز المحافظة" name="governorateCode" value={settings.governorateCode || ''} onChange={handleChange} disabled={isFormDisabled} />
                    <InputField label="رمز المدرسة" name="schoolCode" value={settings.schoolCode || ''} onChange={handleChange} disabled={isFormDisabled} />
                    
                    {/* School Type Info */}
                    <SelectField label="نوع المدرسة" name="schoolType" value={settings.schoolType || ''} onChange={handleChange} options={SCHOOL_TYPES} disabled={isFormDisabled} />
                    <SelectField label="جنس المدرسة" name="schoolGender" value={settings.schoolGender || ''} onChange={handleChange} options={SCHOOL_GENDERS} disabled={isFormDisabled} />
                    <SelectField label="درجة المدرسة" name="schoolLevel" value={settings.schoolLevel || ''} onChange={handleChange} options={SCHOOL_LEVELS} disabled={areNameFieldsDisabled} />
                    
                    {/* Contact & Rules */}
                    <InputField label="رقم موبايل المدير" name="principalPhone" value={settings.principalPhone || ''} onChange={handleChange} disabled={isFormDisabled} type="tel" />
                    <InputField label="عدد مواد الإكمال" name="supplementarySubjectsCount" type="number" value={settings.supplementarySubjectsCount} onChange={handleChange} disabled={isFormDisabled} />
                    <InputField label="درجة القرار" name="decisionPoints" type="number" value={settings.decisionPoints} onChange={handleChange} disabled={isFormDisabled} />
                </div>
                <div className="flex justify-end pt-6">
                    <button 
                        type="submit" 
                        className="px-8 py-3 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                        disabled={isFormDisabled}
                    >
                        حفظ الإعدادات
                    </button>
                </div>
            </form>

            {isPrincipal && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">إعدادات الأمان وتسجيل الدخول</h2>
                    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                        <div className="relative">
                            <InputField label="البريد الإلكتروني" name="email" value={securitySettings.email} onChange={handleSecurityChange} type="email" placeholder="example@email.com" />
                            <Mail className="absolute top-11 right-3 text-gray-400" size={20} />
                        </div>
                        <div className="relative">
                            <label htmlFor="code" className="block text-md font-medium text-gray-700 mb-2">رمز المرور</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    id="code"
                                    name="code"
                                    value={securitySettings.code}
                                    onChange={handleSecurityChange}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition disabled:bg-gray-200"
                                    required
                                    disabled={!securitySettings.email}
                                />
                                <button type="button" onClick={() => setSecuritySettings(prev => ({ ...prev, code: generateCode(10) }))} disabled={!securitySettings.email} className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"><RefreshCw size={20} /></button>
                            </div>
                            <Key className="absolute top-11 right-3 text-gray-400" size={20} />
                            {!securitySettings.email && <p className="text-xs text-red-600 mt-1">يجب إضافة البريد الإلكتروني أولاً لتمكين تغيير رمز المرور.</p>}
                        </div>
                        <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-md">
                            <p className="font-bold">إخلاء مسؤولية هام!</p>
                            <p className="text-sm mt-1">
                                تستطيع تغيير رمز المرور الخاص بك بعد اضافة ايميلك الشخصي ونحن نخلي مسؤوليتنا من نسيان او فقدان رمز المرور ولن نستطيع استعادته لك مجددا. بموافقتك على هذه الشروط فانك تقر بانك المسؤول الوحيد عن حماية رمز المرور والايميل الخاص بك من التسرب او الضياع.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="agreedToTerms"
                                name="agreedToTerms"
                                checked={securitySettings.agreedToTerms}
                                onChange={handleSecurityChange}
                                className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                            />
                            <label htmlFor="agreedToTerms" className="font-medium text-gray-700">أوافق على الشروط وأتحمل المسؤولية الكاملة.</label>
                        </div>
                        <button
                            onClick={handleSaveSecurity}
                            disabled={!securitySettings.agreedToTerms}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                        >
                            <Save size={20} />
                            حفظ إعدادات الأمان
                        </button>
                    </div>
                </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-gray-600 mb-4">
                    بإمكانك تصدير رموز QR الخاصة بروابط تطبيق تربوي تك المدراء كملف PDF عالي الدقة، لإرسالها الى الطلبة أو طباعتها.
                </p>
                <button
                    onClick={handleExportQrPdf}
                    disabled={isExportingPdf}
                    className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-wait"
                >
                    <FileDown size={20} />
                    <span>تصدير رموز QR كملف PDF</span>
                </button>
            </div>
        </div>
    );
}

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    name: string;
    value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

const InputField: React.FC<InputFieldProps> = ({ label, name, value, onChange, type = 'text', placeholder, disabled }) => (
    <div>
        <label htmlFor={name} className="block text-md font-medium text-gray-700 mb-2">{label}</label>
        <input
            type={type}
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition disabled:bg-gray-200"
            required
            disabled={disabled}
        />
    </div>
);

interface SelectFieldProps {
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[];
    disabled?: boolean;
}

const SelectField: React.FC<SelectFieldProps> = ({ label, name, value, onChange, options, disabled }) => (
    <div>
        <label htmlFor={name} className="block text-md font-medium text-gray-700 mb-2">{label}</label>
        <select
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition disabled:bg-gray-200 bg-white"
            required
            disabled={disabled}
        >
            {options.map(option => (
                <option key={option} value={option}>{option}</option>
            ))}
        </select>
    </div>
);