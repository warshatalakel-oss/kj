import React, { useState } from 'react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { Download, Printer, Loader2, Trash2, UserPlus, ArrowUpCircle, Map as MapIcon } from 'lucide-react';
import type { User, SchoolSettings, ClassData } from '../../types';
import WrittenExamScheduleView from './WrittenExamScheduleView';
import QuestionsAnswersReceiptView from './QuestionsAnswersReceiptView';
import AbsenceDraftExporter from './AbsenceDraftExporter';
import ExamBookletsReceipt from './ExamBookletsReceipt';
import ExaminationRecord from './ExaminationRecord';


declare const jspdf: any;
declare const html2canvas: any;

interface ExamControlLogProps {
    principal: User;
    users: User[];
    settings: SchoolSettings;
    classes: ClassData[];
}

type ExamLogPageKey =
    | 'index'
    | 'cover'
    | 'minutes'
    | 'decision132'
    | 'signatures'
    | 'committee'
    | 'auditing_committee'
    | 'specialization_committees'
    | 'oral_exam_schedule'
    | 'written_exam_schedule'
    | 'questions_answers_receipt'
    | 'seating_charts'
    | 'absence_form'
    | 'exam_booklets_receipt'
    | 'examination_record';

const logTopics = [
    { key: 'cover' as ExamLogPageKey, title: 'غلاف سجل السيطرة' },
    { key: 'minutes' as ExamLogPageKey, title: 'محضر اجتماع الهيئات التعليمية' },
    { key: 'decision132' as ExamLogPageKey, title: 'القرار ۱۳۲' },
    { key: 'signatures' as ExamLogPageKey, title: 'توقيع الهيئات التعليمية على القرار ١٣٢' },
    { key: 'committee' as ExamLogPageKey, title: 'اللجنة الامتحانية واعمالها' },
    { key: 'auditing_committee' as ExamLogPageKey, title: 'لجنة التدقيق واعمالها' },
    { key: 'specialization_committees' as ExamLogPageKey, title: 'لجان الفحص حسب الاختصاص' },
    { key: 'oral_exam_schedule' as ExamLogPageKey, title: 'جدول الامتحانات الشفوية' },
    { key: 'written_exam_schedule' as ExamLogPageKey, title: 'جدول الامتحانات التحريرية' },
    { key: 'questions_answers_receipt' as ExamLogPageKey, title: 'استلام الأسئلة والاجوبة' },
    { key: 'seating_charts' as ExamLogPageKey, title: 'خرائط جلوس الطلبة' },
    { key: 'absence_form' as ExamLogPageKey, title: 'استمارة الغيابات اليومية للطلبة' },
    { key: 'exam_booklets_receipt' as ExamLogPageKey, title: 'استلام وتسليم رزم الدفاتر الامتحانية' },
    { key: 'examination_record' as ExamLogPageKey, title: 'محضر فحص وتدقيق' }
];

// --- Sub-Components for each page ---

const IndexView = ({ setCurrentPageKey }: { setCurrentPageKey: (key: ExamLogPageKey) => void }) => (
    <div className="bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-4xl font-bold text-center text-gray-800">سجل السيطرة الامتحانية</h1>
        <p className="text-center text-gray-600 mt-2">
            نظم امتحاناتك بدقة وسيطر بثقة !..الإدارة الامتحانية تبدأ بالذكاء... وتستمر بالنظام
        </p>
        <div className="mt-6 bg-green-100 border-r-4 border-green-500 p-4 rounded-md">
            <p className="font-bold text-green-800">
                تنقل بين صفحات سجل السيطرة من خلال النقر على عناوين الصفحات داخل الفهرس وعدل ما تحتاج تعديله وفرنا لك امكانية تعديل النماذج وتصديرها.
            </p>
        </div>
        <div className="mt-8">
            <div className="grid grid-cols-[1fr_auto] gap-x-4 border-2 border-orange-400 rounded-lg p-4 bg-gray-50">
                <div className="font-bold text-xl text-center border-b-2 border-orange-300 pb-2">الموضوع</div>
                <div className="font-bold text-xl text-center border-b-2 border-orange-300 pb-2">الصفحة</div>
                {logTopics.map((topic, index) => (
                    <React.Fragment key={index}>
                        <button
                            onClick={() => topic.key && setCurrentPageKey(topic.key)}
                            disabled={!topic.key}
                            className={`text-right p-3 rounded-md my-1 text-lg font-semibold ${topic.key ? 'bg-blue-50 hover:bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                        >
                            {topic.title}
                        </button>
                        <div className="flex items-center justify-center p-3 my-1">
                            <span className="bg-orange-100 text-orange-700 font-bold px-4 py-2 rounded-md">{index + 1}</span>
                        </div>
                    </React.Fragment>
                ))}
            </div>
        </div>
    </div>
);

const PageWrapper = ({ title, children, setCurrentPageKey, currentPageKey }: { title: string, children?: React.ReactNode, setCurrentPageKey: (key: ExamLogPageKey) => void, currentPageKey: ExamLogPageKey }) => {
    const handleNext = () => {
        const currentIndex = logTopics.findIndex(p => p.key === currentPageKey);
        if (currentIndex !== -1) {
            // Find the next implemented page
            for (let i = currentIndex + 1; i < logTopics.length; i++) {
                if (logTopics[i].key) {
                    setCurrentPageKey(logTopics[i].key as ExamLogPageKey);
                    return;
                }
            }
        }
        alert('هذه آخر صفحة معرفة حالياً.');
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <button onClick={() => setCurrentPageKey('index')} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">&larr; العودة للفهرس</button>
                <h2 className="text-3xl font-bold text-gray-800">{title}</h2>
                <button onClick={handleNext} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">الصفحة التالية &rarr;</button>
            </div>
            {children}
        </div>
    );
};

const CoverView = ({ setCurrentPageKey }: { setCurrentPageKey: (key: ExamLogPageKey) => void }) => (
    <PageWrapper title="غلاف سجل السيطرة" setCurrentPageKey={setCurrentPageKey} currentPageKey="cover">
        <div className="text-center bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
            <p className="text-lg font-semibold text-blue-800 mb-4">
                انشئ غلاف سجل السيطرة الخاص بك بكل احترافية وسهولة. وفرنا لك العديد من النماذج للتعديل السهل المباشر في تطبيق محرر صور المستندات المدرسية.
            </p>
            <a
                href="https://service-314929620446.us-west1.run.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-transform transform hover:-translate-y-1"
            >
                ابدأ انشاء غلاف سجل السيطرة الامتحانية
            </a>
        </div>
        <div className="mt-6 flex justify-center">
            <img src="https://i.imgur.com/FvdZ291.png" alt="غلاف سجل السيطرة" className="max-w-full h-auto rounded-lg shadow-md" />
        </div>
    </PageWrapper>
);

const Decision132View = ({ setCurrentPageKey }: { setCurrentPageKey: (key: ExamLogPageKey) => void }) => {
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = "https://i.imgur.com/zBykpGv.png";
        link.download = 'decision-132.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    return (
        <PageWrapper title="القرار - ۱۳۲" setCurrentPageKey={setCurrentPageKey} currentPageKey="decision132">
            <div className="flex justify-center my-4">
                <button onClick={handleDownload} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                    <Download size={18} /> تحميل الصورة
                </button>
            </div>
            <div className="mt-6 flex justify-center">
                <img src="https://i.imgur.com/zBykpGv.png" alt="القرار 132" className="max-w-full h-auto rounded-lg shadow-md border" />
            </div>
        </PageWrapper>
    );
};

// --- Meeting Minutes Components ---

const Editable = ({ initialValue, onSave, className = '' }: { initialValue: string, onSave: (value: string) => void, className?: string }) => {
    return (
        <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => onSave(e.target.innerText)}
            className={`px-2 py-0.5 rounded-sm focus:outline-none focus:bg-yellow-200 min-w-[50px] inline-block border-b border-dashed border-gray-400 focus:border-solid focus:border-yellow-400 ${className}`}
            style={{ whiteSpace: 'pre-wrap' }}
        >
            {initialValue}
        </span>
    );
};

const PageHeader = ({ title, data, updateField }: { title: string | null, data: any, updateField: (field: string, value: string) => void }) => (
    <header className="grid grid-cols-3 items-start mb-8 text-sm">
        <div className="flex justify-center"><img src="https://i.imgur.com/JNUggOC.png" alt="الشعار الاول" className="h-20 w-20 object-contain" /></div>
        <div className="text-center font-bold flex items-center justify-center h-20">
            {title ? <h2 className="text-xl">{title}</h2> : <img src="https://i.imgur.com/RXWEisZ.png" alt="العنوان" className="mx-auto h-12 object-contain" />}
        </div>
        <div className="flex justify-center"><img src="https://i.imgur.com/nkaYlwI.png" alt="الشعار الثاني" className="h-20 w-20 object-contain" /></div>
    </header>
);


const MinutesPageWrapper = ({ children, pageId }: { children?: React.ReactNode, pageId: string }) => (
    <div id={pageId} className="w-[794px] min-h-[1123px] bg-white shadow-xl my-8 p-4 printable-page">
        <div className="w-full h-full p-6 flex flex-col font-['Cairo'] text-lg" dir="rtl">
            {children}
        </div>
    </div>
);


const getInitialMinutesData = () => ({
    schoolName: "................",
    city: "كربلاء",
    date: ".... / .... / ....",
    time: ".../...",
    academicYear: "........ / ......",
    round: "نصف السنة ونهاية السنة",
    oralStartDay: "....",
    oralStartDate: ".... / ..../ ٢٠٢٥ م",
    oralEndDay: "الخميس",
    oralEndDate: "۱۹ / ۱ / ۲۰۲۳ م",
    writtenStartDay: "السبت",
    writtenStartDate: "۲۱ / ۱ / ۲۰۲۳ م",
    writtenEndDay: "الثلاثاء",
    writtenEndDate: "۳۱ / ۱ / ٢٠٢٣م",
    questionsDeadlineDay: "الأحد",
    questionsDeadlineDate: "١٥ / ١ / ٢٠٢٣م",
});

const MeetingMinutesView = ({ setCurrentPageKey }: { setCurrentPageKey: (key: ExamLogPageKey) => void }) => {
    const [data, setData] = useLocalStorage('examMeetingMinutes', getInitialMinutesData());
    const [customParagraphs, setCustomParagraphs] = useLocalStorage<string[]>('examMeetingCustomParagraphs', []);
    const [newParagraph, setNewParagraph] = React.useState('');
    const [isExporting, setIsExporting] = React.useState(false);

    const updateField = (field: keyof ReturnType<typeof getInitialMinutesData>, value: string) => {
        setData(prev => ({ ...prev, [field]: value }));
    };
    
    const handleAddParagraph = () => {
        if (newParagraph.trim()) {
            setCustomParagraphs(prev => [...prev, newParagraph.trim()]);
            setNewParagraph('');
        }
    };

    const handleUpdateParagraph = (index: number, value: string) => {
        setCustomParagraphs(prev => {
            const newArr = [...prev];
            newArr[index] = value;
            return newArr;
        });
    };

    const handleDeleteParagraph = (indexToDelete: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذه الفقرة؟')) {
            setCustomParagraphs(prev => prev.filter((_, index) => index !== indexToDelete));
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        await new Promise(resolve => setTimeout(resolve, 100));

        const { jsPDF } = jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pages = document.querySelectorAll('.printable-page');
        
        try {
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i] as HTMLElement;
                const canvas = await html2canvas(page, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            }
            pdf.save(`محضر_اجتماع_الهيئة_التعليمية.pdf`);
        } catch (error) {
            console.error("PDF Export Error:", error);
            alert("حدث خطأ أثناء التصدير.");
        } finally {
            setIsExporting(false);
        }
    };
    
    const footer = <footer className="mt-auto h-10"></footer>;

    const noExportClass = isExporting ? 'hidden' : '';

    return (
        <PageWrapper title="محضر اجتماع الهيئة التعليمية" setCurrentPageKey={setCurrentPageKey} currentPageKey="minutes">
             <style>{`
                .custom-ol { list-style: none; counter-reset: item; padding-right: 0; margin-right: 1.5rem; }
                .custom-ol.start-5 { counter-reset: item 4; }
                .custom-ol.start-6 { counter-reset: item 5; }
                .custom-ol.start-9 { counter-reset: item 8; }
                .custom-ol > li { counter-increment: item; display: flex; flex-direction: row; align-items: flex-start; }
                .custom-ol > li::before { content: counter(item) "."; font-weight: bold; min-width: 1.5rem; flex-shrink: 0; margin-left: 0.75rem; text-align: left; }
             `}</style>
            <div className="text-center my-4">
                <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:bg-gray-400">
                    {isExporting ? <Loader2 className="animate-spin" /> : <Printer size={18} />}
                    {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
                </button>
            </div>

            <div className="bg-gray-100 p-4 rounded-lg overflow-y-auto max-h-[70vh]">
                <MinutesPageWrapper pageId="minutes-page-1">
                    <PageHeader title={null} data={data} updateField={updateField} />
                    <main className="space-y-4 flex-grow">
                        <h1 className="text-3xl font-bold text-center bg-gray-200 p-2 rounded-lg">محضر الاجتماع الخاص بالامتحانات</h1>
                        <h2 className="text-3xl font-bold text-center"><Editable initialValue={data.round} onSave={val => updateField('round', val)} /></h2>
                        <div className="text-center my-4">*****************</div>
                        <p>اجتمعت الهيئة الادارية والتدريسية في مقر <Editable initialValue={data.schoolName} onSave={val => updateField('schoolName', val)} /> في يوم <Editable initialValue={data.date.split('/')[2]} onSave={val => {}} /> الموافق ( <Editable initialValue={data.date} onSave={val => updateField('date', val)} /> ) الساعة ( <Editable initialValue={data.time} onSave={val => updateField('time', val)} /> ) لمناقشة امر امتحانات ( <Editable initialValue={data.round} onSave={val => updateField('round', val)} /> ) للعام الدراسي ( <Editable initialValue={data.academicYear} onSave={val => updateField('academicYear', val)} /> ) ، وتم طرح مفردات الاجتماع على شكل محاور وكالتالي :</p>
                        
                        <div className="mt-8">
                            <h3 className="text-2xl font-bold text-red-600 border-b-2 border-red-500 pb-2 mb-4">أ - المحور التربوي والتقويمي :-</h3>
                             <ol className="custom-ol space-y-3 font-semibold">
                                <li><span>تكملة المنهج حسب الخطة السنوية والتقيد بتكييف المناهج المقررة لهذا العام الدراسي .</span></li>
                                <li><span>اكمال سجلات الدرجات الخاصة بالمدرس .</span></li>
                                <li><span>تسليم الدرجات الى الادارة لغرض تدقيقها وتنزيلها في السجل الوسطي .</span></li>
                                <li><span>الالتزام بالدوام اليومي .</span></li>
                                <li><span>تمنع الاجازات في ايام الامتحانات .</span></li>
                                <li><span>الالتزام بتوجيهات ادارة المدرسة والمعممة من المديرية العامة للتربية في <Editable initialValue={data.city} onSave={val => updateField('city', val)} />.</span></li>
                                {customParagraphs.map((p, i) => (
                                    <li key={i} className="group flex items-center">
                                        <Editable initialValue={p} onSave={val => handleUpdateParagraph(i, val)} className="flex-grow" />
                                        <button onClick={() => handleDeleteParagraph(i)} className={`mr-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ${noExportClass}`}>
                                            <Trash2 size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ol>
                            <div className={`flex items-center gap-2 mt-4 ${noExportClass}`}>
                                <input
                                    type="text"
                                    value={newParagraph}
                                    onChange={(e) => setNewParagraph(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddParagraph()}
                                    placeholder="إضافة فقرة جديدة..."
                                    className="flex-grow px-2 py-1 border border-gray-300 rounded-md"
                                />
                                <button onClick={handleAddParagraph} className="p-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700">إضافة</button>
                            </div>
                        </div>
                    </main>
                    {footer}
                </MinutesPageWrapper>
                <MinutesPageWrapper pageId="minutes-page-2">
                    <PageHeader title={null} data={data} updateField={updateField} />
                    <main className="space-y-4 flex-grow">
                        <div>
                            <h3 className="text-2xl font-bold text-red-600 border-b-2 border-red-500 pb-2 mb-4">ب - محور الامتحانات الشفوية :-</h3>
                            <ol className="custom-ol space-y-3 font-semibold">
                                <li><span>تبدأ الامتحانات الشفوية يوم ( <Editable initialValue={data.oralStartDay} onSave={val => updateField('oralStartDay', val)} /> ) الموافق ( <Editable initialValue={data.oralStartDate} onSave={val => updateField('oralStartDate', val)} /> ) وتنتهي يوم ( <Editable initialValue={data.oralEndDay} onSave={val => updateField('oralEndDay', val)} /> ) الموافق ( <Editable initialValue={data.oralEndDate} onSave={val => updateField('oralEndDate', val)} /> ) .</span></li>
                                <li><span>يكون الدوام في أيام الامتحانات طيله ايامها صباحا .</span></li>
                                <li><span>الالتزام بمواعيد الامتحانات الشفوية وحسب الجدول المعد والمعلن للطالب في لوحة اعلانات المدرسة وموقع المدرسة الرسمي .</span></li>
                                <li><span>تنظيم قوائم الشفوي للدروس التي تحتوي على الشفوي وتنظيم قوائم العملي بالنسبة لدرس الحاسوب .</span></li>
                                <li><span>يمنع منعا باتا تنزيل اي درجة بالقلم الرصاص .</span></li>
                                <li><span>تكون الامتحانات الشفوية من ضمن الدوام الرسمي وتكون على شكل لجان منظمة اثناء الامتحان ولايسمح لاي مدرس الامتحان بمفردة .</span></li>
                                <li><span>بعد اكمال الامتحان توقع قوائم الشفوي من قبل رئيس اللجنة والاعضاء وتسلم الى ادرة المدرسة لغرض تدقيقها .</span></li>
                            </ol>
                        </div>
                         <div className="mt-8">
                            <h3 className="text-2xl font-bold text-red-600 border-b-2 border-red-500 pb-2 mb-4">ج- محور الامتحانات التحريرية والمراقبات :-</h3>
                             <ol className="custom-ol space-y-3 font-semibold">
                                 <li><span>تبدأ الامتحانات التحريرية يوم ( <Editable initialValue={data.writtenStartDay} onSave={val => updateField('writtenStartDay', val)} /> ) الموافق ( <Editable initialValue={data.writtenStartDate} onSave={val => updateField('writtenStartDate', val)} /> ) وتنتهي يوم ( <Editable initialValue={data.writtenEndDay} onSave={val => updateField('writtenEndDay', val)} /> ) الموافق ( <Editable initialValue={data.writtenEndDate} onSave={val => updateField('writtenEndDate', val)} /> ) .</span></li>
                                 <li><span>يكون تسليم الاسئلة الامتحانية للدورين الى ادارة المدرسة لغاية يوم ( <Editable initialValue={data.questionsDeadlineDay} onSave={val => updateField('questionsDeadlineDay', val)} /> ) الموافق ( <Editable initialValue={data.questionsDeadlineDate} onSave={val => updateField('questionsDeadlineDate', val)} /> ) .</span></li>
                                 <li><span>تمنع الاجازات منعا باتا اثناء فترة الامتحانات الشفوية والتحريرية .</span></li>
                                 <li><span>الالتزام بالدوام وعدم التماهل لاي سبب كان لما تمثلها الامتحانات من اهمية قصوى فهي خلاصة الجهد السنوي وتعتبر عصارة السنة الدراسية وخواتيمها .</span></li>
                                 <li><span>الالتزام بالمراقبات المعدة من قبل ادارة المدرسة ( اللجنة الامتحانية ) .</span></li>
                                 <li><span>اخذ الغيابات داخل القاعة الامتحانية بشكل دقيق .</span></li>
                                 <li><span>عدم التدخين داخل القاعة وعدم استخدام الموبايل وعدم التكلم مع المراقب الآخر لكي تكون اجواء القاعة هادئة ومناسبة للطالب .</span></li>
                                 <li><span>عدم التراخي في المراقبة ويجب ان يأخذ المراقب دوره كاملا في ضبط القاعة الامتحانية .</span></li>
                             </ol>
                        </div>
                    </main>
                    {footer}
                </MinutesPageWrapper>
                <MinutesPageWrapper pageId="minutes-page-3">
                    <PageHeader title={null} data={data} updateField={updateField} />
                     <main className="space-y-4 flex-grow">
                         <ol className="custom-ol start-9 space-y-3 font-semibold">
                            <li><span>عدم السماح للطلبة بالدخول الى القاعة الامتحانية بعد توزيع مغلف الاسئلة .</span></li>
                            <li><span>عدم السماح للطلبة بأدخال القبعات والهندسات ومتعلقات المادة كالقصاصات والملازم وغيرها والا سوف يعتبر غش ويحاسب عليه وفق الانظمة والتعليمات النافذة .</span></li>
                            <li><span>متابعة الطالب في كتابه اسمه بشكل واضح وتدقيق الرقم الامتحاني الموجود في مكان جلوسه .</span></li>
                            <li><span>عدم اخراج اي طالب الا بعد انتهاء اخذ الغيابات من قبل عضو اللجنة الامتحانية المختص .</span></li>
                            <li><span>بعد انتهاء الوقت المقرر يتم استلام الدفتر من قبل المراقب وبشكل منظم وبدون اي فوضوية لضمان عدم خروج الطالب مع دفتره الامتحاني .</span></li>
                            <li><span>تدقق الدفاتر وتسلم عدا الى اللجنة الامتحانية .</span></li>
                            <li><span>غلق الموبايل اثناء الامتحانات وعدم السماح لاي مدرس دخول الموبايل الى القاعه الامتحانية .</span></li>
                         </ol>
                         <div className="mt-8">
                            <h3 className="text-2xl font-bold text-red-600 border-b-2 border-red-500 pb-2 mb-4">د- محور الاسئلة والاجوبة النموذجية :-</h3>
                             <ol className="custom-ol space-y-3 font-semibold">
                                <li><span>توضع مجموعتان من الاسئلة وبمستوى واحد للدورين الاول والثاني .</span></li>
                                <li><span>ان تكون الاسئلة على ورقة A4 .</span></li>
                                <li><span>ان تكون واضحة ومطبوعة على الآلة الحاسبة .</span></li>
                                <li><span>ان تكون مكتملة الجوانب الفنية من اسم المدرسة والمادة والسنة الدراسية والدور والوقت والتاريخ .</span></li>
                                <li><span>يجب ان تكون الاسئلة من المنهج المقرر وشاملة مراعية تكييف المناهج .</span></li>
                             </ol>
                        </div>
                    </main>
                    {footer}
                </MinutesPageWrapper>
                <MinutesPageWrapper pageId="minutes-page-4">
                     <PageHeader title={null} data={data} updateField={updateField} />
                     <main className="space-y-4 flex-grow">
                        <ol className="custom-ol start-6 space-y-3 font-semibold">
                            <li><span>يجب ان تكون واضحة لاغموض فيها وبعيدة عن الاسئلة الشبحية والمعقدة .</span></li>
                            <li><span>ان لا تكون الاسئلة مكررة ونمطية .</span></li>
                            <li><span>ان تراعي الترك والترك الضمني لاعطاء فرصة للطالب .</span></li>
                            <li><span>ان يكون عدد الاسئلة متوافق مع الوقت المحدد وهو ساعتان في الدراسة الاعدادية .</span></li>
                            <li><span>يجب ان تكون الاسئلة موضوعية وغير قابلة للتأويل .</span></li>
                            <li><span>يجب ان توزع الدرجات على الاسئلة والفروع بشكل دقيق .</span></li>
                            <li><span>يجب توزيع الدرجات على خطوات الحل في حالة وجود عدة خطوات وخصوصا في الدروس العلمية كالرياضيات والفيزياء والكيمياء ... الخ .</span></li>
                            <li><span>يجب مراعاة الفروق الفردية في وضع الاسئلة بحيث تكون الاسئلة كاشفة لنقاط القوة والضعف لدى الطالب .</span></li>
                         </ol>
                         <div className="mt-8">
                            <h3 className="text-2xl font-bold text-red-600 border-b-2 border-red-500 pb-2 mb-4">هـ - محور الفحص والتدقيق :-</h3>
                            <ol className="custom-ol space-y-3 font-semibold">
                                <li><span>يكون الفحص والتدقيق داخل المدرسة حصرا .</span></li>
                                <li><span>يكون الفحص والتدقيق على شكل لجان .</span></li>
                                <li><span>لا يجوز التصحيح الانفرادي .</span></li>
                                <li><span>يتم استلام وتسليم الرزمة من اللجنة الامتحانية عن طريق رئيس اللجنة الفاحصة فقط .</span></li>
                            </ol>
                         </div>
                     </main>
                     {footer}
                </MinutesPageWrapper>
                <MinutesPageWrapper pageId="minutes-page-5">
                    <PageHeader title={null} data={data} updateField={updateField} />
                     <main className="space-y-4 flex-grow">
                         <ol className="custom-ol start-5 space-y-3 font-semibold">
                            <li><span>قبل البدء بالتصحيح يتوجب على اللجنة الفاحصة ملأ محضر الفحص والتدقيق وبنسختين الاولى تبقى في الرزمة والاخرى تسلم الى اللجنة الامتحانية قبل الشروع بعملية فحص وتدقيق الدفاتر .</span></li>
                            <li><span>اجراء تصحيح الدفاتر المشتركة وبنسبة 10 % .</span></li>
                            <li><span>يكون التصحيح بالقلم الجاف الازرق والتدقيق بالقلم الجاف الاسود وفي حالة رصد اي خطأ بنقل الدرجة فتشطب وتصوب بالقلم الاحمر .</span></li>
                            <li><span>لا يجوز التصحيح بعد التصحيح .</span></li>
                            <li><span>يجب ان يأخذ المدقق دوره كاملا داخل اللجنة الفاحصة .</span></li>
                            <li><span>يكون الفحص الدفاتر (تصحيح) بلون الأزرق والتدقيق بلون الأسود .</span></li>
                            <li><span>يكتب اسم المدقق داخل الدفتر الامتحاني بقلم الأسود (داخل غلاف) .</span></li>
                            <li><span>يكتب أسماء جميع المدرسين الذين يقومون بالفحص والتدقيق أثناء المشترك وكذلك توقيعهم .</span></li>
                            <li><span>يكون توقيع المدرس أثناء الفحص والتدقيق بنفس توقيعه في سجل الدخول والخروج .</span></li>
                            <li><span>يكون الشطب اذا حصل الخطأ بقلم الأحمر وتكتب الدرجة بقلم الأحمر سواء كان السؤال داخل الدفتر أو خارجه وكذلك الجمع .</span></li>
                            <li><span>يكون تصحيح سؤال الإنشاء للمدرس الماده الأصلي شرطا لكل مادة اللغة الإنكليزية والعربية .</span></li>
                            <li><span>اذا حصل سهوا في السؤال أو في الجمع أو في نقل الدرجة أو في الجمع هنا يشطب بقلم الأحمر وتكتب الدرجة بقلم الأحمر ويوقع عليها المدرس المختص بسؤال وكذلك رئيس اللجنة ومن ثم يكتب فيها محضر توقع جميع أعضاء اللجنة .</span></li>
                            <li><span>على جميع المدرسين والمدرسات أثناء التدقيق ولاحظت في دفتر الامتحاني هناك شطب بقلم الأحمر سواء داخل الدفتر أو خارجه عليك إبلاغ رئيس اللجنة التدقيقية وإبلاغ للجنة المادة بذلك .</span></li>
                            <li><span>يتحمل المدقق المسؤولية الكاملة في حالة عدم كتابة المحضر وإبلاغ اللجنة ورئيس اللجنة بذلك .</span></li>
                            <li><span>اللجنة الامتحانية لا تستلم اي دفتر امتحاني فيه شطب احمر الا بعد كتابة محضر تصويب الدرجة .</span></li>
                            <li><span>تحمل اللجان التدقيقية جميعا ماورد اعلاه من النقاط التي ذكرت الان واللجنه المكلفة بتصحيح الدفاتر الإمتحانية وتكون المسؤولية تضامنية بالنسبة للجنة التي تقوم بفحص الدفتر الامتحاني .</span></li>
                            <li><span>كتابة الرقم الامتحاني من قبل المدرس نفسه في الدفتر الامتحاني في أعلاه الاسم .</span></li>
                            <li><span>عدم ترك القاعة من قبل المراقبين للمراقب واحد مهما كانت الأسباب ويتم التسليم الدفاتر قاعة متكاملة أي قطاعين في ان واحد .</span></li>
                         </ol>
                     </main>
                     {footer}
                </MinutesPageWrapper>
            </div>
        </PageWrapper>
    );
};

// --- Signatures View ---

const SignaturesPageLayout = ({ pageNames, preambleText, settings, isExporting }: { pageNames: string[], preambleText: React.ReactNode, settings: SchoolSettings, isExporting: boolean }) => {
    const liftStyle: React.CSSProperties = isExporting ? { position: 'relative', bottom: '8px' } : {};
    
    return (
        <div className="w-[794px] min-h-[1123px] bg-white shadow-xl my-8 p-4 printable-signature-page">
            <div className="w-full h-full p-6 flex flex-col font-['Cairo']" dir="rtl">
                <header className="text-center mb-6">
                    <p>إدارة: {settings.schoolName}</p>
                    <h2 className="text-2xl font-bold mt-2 text-green-700">م / توقيع محضر الاجتماع</h2>
                    <div className="w-full h-1 bg-green-700 my-2"></div>
                    <h3 className="text-xl font-bold text-blue-600">توقيع الهيئة التعليمية على محضر الاجتماع وعلى قرار ١٣٢ :-</h3>
                </header>
                <main className="text-lg flex-grow">
                    <p className="mb-8">{preambleText}</p>
                    <div className="grid grid-cols-2 gap-x-8">
                        {/* Column 1 */}
                        <table className="w-full border-collapse">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border border-gray-400 p-2 w-12">ت</th>
                                    <th className="border border-gray-400 p-2">الاسم</th>
                                    <th className="border border-gray-400 p-2">التوقيع</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 22 }).map((_, i) => (
                                    <tr key={i} className="h-10">
                                        <td className="border border-gray-400 text-center">{i + 1}</td>
                                        <td className="border border-gray-400 px-2 font-semibold">
                                            <div style={liftStyle}>{pageNames[i] || ''}</div>
                                        </td>
                                        <td className="border border-gray-400"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {/* Column 2 */}
                        <table className="w-full border-collapse">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border border-gray-400 p-2 w-12">ت</th>
                                    <th className="border border-gray-400 p-2">الاسم</th>
                                    <th className="border border-gray-400 p-2">التوقيع</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 22 }).map((_, i) => (
                                    <tr key={i} className="h-10">
                                        <td className="border border-gray-400 text-center">{i + 23}</td>
                                        <td className="border border-gray-400 px-2 font-semibold">
                                            <div style={liftStyle}>{pageNames[i + 22] || ''}</div>
                                        </td>
                                        <td className="border border-gray-400"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </main>
                <footer className="h-10" />
            </div>
        </div>
    );
};

const SignaturesView = ({ setCurrentPageKey, principal, users, settings }: { setCurrentPageKey: (key: ExamLogPageKey) => void } & Omit<ExamControlLogProps, 'classes'>) => {
    const initialTeachers = users.filter(u => u.role === 'teacher' && u.principalId === principal.id).map(t => t.name);
    
    const [names, setNames] = useLocalStorage<string[]>('examSignaturesNames', initialTeachers);
    const [preambleData, setPreambleData] = useLocalStorage('examSignaturesPreamble', {
        staff: '.................',
        date: new Date().toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' })
    });
    const [newName, setNewName] = React.useState('');
    const [isExporting, setIsExporting] = React.useState(false);

    const updatePreamble = (field: keyof typeof preambleData, value: string) => {
        setPreambleData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddName = () => {
        if (newName.trim()) {
            setNames(prev => [...prev, newName.trim()]);
            setNewName('');
        }
    };
    
    const handleDeleteName = (index: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الاسم؟')) {
            setNames(prev => prev.filter((_, i) => i !== index));
        }
    }
    
    const handleExport = async () => {
        setIsExporting(true);
        await new Promise(resolve => setTimeout(resolve, 100));

        const { jsPDF } = jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pages = document.querySelectorAll('.printable-signature-page');
        
        try {
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i] as HTMLElement;
                const canvas = await html2canvas(page, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            }
            pdf.save(`توقيع_الهيئة_التعليمية.pdf`);
        } catch (error) {
            console.error("PDF Export Error:", error);
            alert("حدث خطأ أثناء التصدير.");
        } finally {
            setIsExporting(false);
        }
    };
    
    const preambleText = (
        <>
            نحن الموقعون ادناه مدير ومعاوني و
            <Editable initialValue={preambleData.staff} onSave={val => updatePreamble('staff', val)} />
             مدرسة ( {settings.schoolName} ) قد اطلعنا على التعليمات الامتحانية للدراسة الابتدائية وكذلك اطلعنا على قرار (١٣٢ لسنة ١٩٩٦) بموجب محضر الاجتماع في يوم (
            <Editable initialValue={preambleData.date} onSave={val => updatePreamble('date', val)} />
            ) لذا اوجب علينا الالتزام بالتعليمات والانظمة الامتحانية المبلغة الينا في المحضر ولأجله وقعنا :-
        </>
    );

    const pages = [];
    for (let i = 0; i < names.length; i += 44) {
        pages.push(names.slice(i, i + 44));
    }
    if (pages.length === 0) pages.push([]); // Ensure at least one page shows up

    return (
        <PageWrapper title="توقيع الهيئات التعليمية" setCurrentPageKey={setCurrentPageKey} currentPageKey="signatures">
            <div className="flex justify-between items-center my-4">
                <div className={`flex items-center gap-2 ${isExporting ? 'hidden' : ''}`}>
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="إضافة اسم جديد..."
                        className="px-2 py-1 border border-gray-300 rounded-md"
                    />
                    <button onClick={handleAddName} className="flex items-center gap-1 p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"><UserPlus size={16}/> إضافة</button>
                </div>
                 <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:bg-gray-400">
                    {isExporting ? <Loader2 className="animate-spin" /> : <Printer size={18} />}
                    {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
                </button>
            </div>
            
             <div className="bg-gray-100 p-4 rounded-lg overflow-y-auto max-h-[70vh]">
                {pages.map((pageNames, i) => (
                    <React.Fragment key={i}>
                        <SignaturesPageLayout pageNames={pageNames} preambleText={preambleText} settings={settings} isExporting={isExporting} />
                    </React.Fragment>
                ))}
            </div>
        </PageWrapper>
    );
};


// --- Committee View ---

const CommitteePageWrapper = ({ children, pageId }: { children?: React.ReactNode, pageId: string }) => (
    <div id={pageId} className="w-[794px] min-h-[1123px] bg-white shadow-xl my-8 p-4 printable-committee-page">
        <div className="w-full h-full p-6 flex flex-col font-['Cairo']" dir="rtl">
            {children}
        </div>
    </div>
);

const getInitialCommitteeData = () => ({
    committeeDate: new Date().toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    directorate: '........',
    headName: '................',
    member1Name: '................',
    member2Name: '................',
    member3Name: '................',
    member4Name: '................',
    member5Name: '................',
});

const getInitialCommitteeMembers = (principal: User) => ([
    { id: '1', name: principal.name, role: 'مدير المدرسة رئيسا' },
    { id: '2', name: '', role: 'معاون عضوا' },
    { id: '3', name: '', role: 'معاون عضوا' },
    { id: '4', name: '', role: 'مدرس عضوا' },
    { id: '5', name: '', role: 'مدرس عضوا' },
    { id: '6', name: '', role: 'مدرس عضوا' },
    { id: '7', name: '', role: 'مدرس عضوا' },
    { id: '8', name: '', role: 'مدرس عضوا' },
    { id: '9', name: '', role: 'مدرس عضوا' },
    { id: '10', name: '', role: 'مدرس عضوا' },
]);

const CommitteeView = ({ setCurrentPageKey, principal, settings }: { setCurrentPageKey: (key: ExamLogPageKey) => void; principal: User; settings: SchoolSettings; }) => {
    const [data, setData] = useLocalStorage('examCommitteeData_v2', getInitialCommitteeData());
    const [members, setMembers] = useLocalStorage('examCommitteeMembers_v2', getInitialCommitteeMembers(principal));
    const [isExporting, setIsExporting] = React.useState(false);

    const genderTitle = settings.schoolGender === 'بنات' ? 'السيدة' : settings.schoolGender === 'مختلط' ? 'السيد/ة' : 'السيد';
    const directorTitle = settings.schoolGender === 'بنات' ? 'مديرة المدرسة' : 'مدير المدرسة';

    const updateDataField = (field: keyof ReturnType<typeof getInitialCommitteeData>, value: string) => {
        setData(prev => ({ ...prev, [field]: value }));
    };

    const updateMemberName = (id: string, newName: string) => {
        setMembers(prev => prev.map(m => m.id === id ? { ...m, name: newName } : m));
    };
    
    const deleteMember = (id: string) => {
        if (['8', '9', '10'].includes(id) && window.confirm("هل أنت متأكد من حذف هذا العضو؟")) {
             setMembers(prev => prev.map(m => m.id === id ? { ...m, name: '', role: ''} : m ));
        }
    };
    
    const handleExport = async () => {
        setIsExporting(true);
        await new Promise(resolve => setTimeout(resolve, 100));

        const { jsPDF } = jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pages = document.querySelectorAll('.printable-committee-page');
        
        try {
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i] as HTMLElement;
                const canvas = await html2canvas(page, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            }
            pdf.save(`اللجنة_الامتحانية.pdf`);
        } catch (error) {
            console.error("PDF Export Error:", error);
            alert("حدث خطأ أثناء التصدير.");
        } finally {
            setIsExporting(false);
        }
    };
    
    const noExportClass = isExporting ? 'hidden' : '';

    return (
        <PageWrapper title="اللجنة الامتحانية واعمالها" setCurrentPageKey={setCurrentPageKey} currentPageKey="committee">
            <div className="text-center my-4">
                <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:bg-gray-400">
                    {isExporting ? <Loader2 className="animate-spin" /> : <Printer size={18} />}
                    {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
                </button>
            </div>
            
            <div className="bg-gray-100 p-4 rounded-lg overflow-y-auto max-h-[70vh]">
                 <CommitteePageWrapper pageId="committee-page-1">
                     <header className="flex justify-between items-center text-center text-xl font-bold mb-8">
                         <div className="w-1/3">
                            <p>ادارة</p>
                            <p>{settings.schoolName}</p>
                         </div>
                         <div className="w-1/3">
                            <div className="border-2 border-black p-2">اللجنة الامتحانية</div>
                         </div>
                         <div className="w-1/3"></div>
                     </header>
                     <p className="text-center text-lg font-semibold mb-4">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
                     <div className="flex justify-between font-bold mb-6">
                        <span>المديرية العامة لتربية <Editable initialValue={data.directorate} onSave={val => updateDataField('directorate', val)}/></span>
                        <span>العدد /</span>
                        <span>التاريخ / {new Date().toLocaleDateString('ar-EG-u-nu-latn')}</span>
                     </div>
                     <div className="text-center font-bold text-xl my-4">( امر مدرسي )</div>
                     <div className="text-center font-bold text-xl my-4">م / اللجنة الامتحانية</div>
                     <p className="text-lg leading-relaxed text-right">
                        وفق المادة الرابعة والخمسون الفقرة ثالثا من نظام المدارس الثانوية رقم ( ۲ ) لسنة ۱۹۷۷ تقرر تشكيل
                        اللجنة الامتحانية برئاسة المدير وعضوية المعاونين و عدد من اعضاء الهيأة
                        التدريسية وتكون مسؤولة بالتضامن للإشراف على سير الامتحانات وضبطها واعلان نتائجها
                        وادخال الدرجات الامتحانية في السجلات ،
                        من السادة المدرجة اسمائهم ادناه :-
                     </p>
                     <div className="my-8 px-16 space-y-2">
                        {members.map((member, index) => {
                             if (!member.role) return null; // Hide deleted members
                             const canDelete = ['8', '9', '10'].includes(member.id);
                             return (
                                 <div key={member.id} className="flex justify-between items-center text-lg group">
                                     <div className="flex items-center">
                                        <span className="font-bold">{index + 1}- {genderTitle}</span>
                                        <Editable initialValue={member.name} onSave={(val) => updateMemberName(member.id, val)} className="mx-2"/>
                                     </div>
                                     <div className="flex items-center gap-4">
                                        <span className="font-semibold">{member.role}</span>
                                         {canDelete && (
                                            <button onClick={() => deleteMember(member.id)} className={`text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ${noExportClass}`}><Trash2 size={16}/></button>
                                         )}
                                     </div>
                                 </div>
                             )
                        })}
                     </div>
                      <footer className="mt-auto flex justify-end px-16">
                        <div className="text-center font-bold">
                            <p>التوقيع</p>
                            <p>اسم {directorTitle}</p>
                        </div>
                    </footer>
                 </CommitteePageWrapper>
                 <CommitteePageWrapper pageId="committee-page-2">
                      <h2 className="text-center font-bold text-2xl mb-8">واجبات أعضاء اللجنة الامتحانية</h2>
                      <div className="space-y-6 text-md font-semibold">
                        <div>
                             <p className="mb-2">يقوم {genderTitle} <Editable initialValue={data.headName} onSave={val => updateDataField('headName', val)} /> رئيس اللجنة الامتحانية بالأعمال التالية :-</p>
                            <ol className="custom-ol space-y-2 pr-4">
                                <li>الإشراف العام على سير الامتحانات والبت النهائي في حالات الغش.</li>
                                <li>استلام الأسئلة الامتحانية للدورين مع الأجوبة مغلفة وموقعة من مدرس المادة والمحافظة عليها بخزانة محكمة.</li>
                                <li>تنزيل وجمع الدرجات الشفوية مع الامتحان التحريري.</li>
                                <li>تنزيل الدرجات في سجل الادارة بعد أجراء عملية الفحص والتدقيق.</li>
                                <li>وضع المراقبات الامتحانية.</li>
                                <li>تهيئة خريطة جلوس الطلاب في القاعات الامتحانية مع {genderTitle} <Editable initialValue={'................'} onSave={_=>{}} />.</li>
                                <li>فحص عشرة دفاتر امتحانية مع {genderTitle} <Editable initialValue={'................'} onSave={_=>{}} /> والتأكد من قيام اللجنة الفاحصة والتدقيقية بعملهما بصورة صحيحة.</li>
                                <li>فتح الدفاتر الامتحانية مع الأعضاء الآخرين.</li>
                            </ol>
                            <p className="text-left mt-2">التوقيع</p>
                        </div>
                         <div>
                             <p className="mb-2">يقوم {genderTitle} <Editable initialValue={data.member1Name} onSave={val => updateDataField('member1Name', val)} /> عضو اللجنة بالأعمال التالية :-</p>
                            <ol className="custom-ol space-y-2 pr-4">
                                <li>تسليم واستلام الدفاتر الامتحانية من المراقبين.</li>
                                <li>تدقيق المجموع للدرجة النهائية للمواد التي تحتوي على شفوي.</li>
                                <li>تدقيق درجات الشفوي لمادة اللغة العربية والإسلامية وخلوها من الدرجات المبهمة والتأكد من المجموع.</li>
                                <li>تسليم الدفاتر الامتحانية الى رئيس اللجنة الفاحصة.</li>
                                <li>تسليم الدفاتر الامتحانية الى لجنة التدقيق بعد انتهاء الفحص و قبل فتح الأسماء المغلقة.</li>
                                <li>فحص عشرة دفاتر مع {genderTitle} <Editable initialValue={'................'} onSave={_=>{}} /> للتأكد من قيام اللجنة الفاحصة والتدقيقية بعملهم بصورة صحيحة.</li>
                                <li>تنزيل درجات <Editable initialValue={'................'} onSave={_=>{}} /> في سجلات <Editable initialValue={'................'} onSave={_=>{}} /> بعد استلامها من لجان الفحص مباشرة بمساعدة {genderTitle} <Editable initialValue={'................'} onSave={_=>{}} /> ( <Editable initialValue={'................'} onSave={_=>{}} /> ).</li>
                            </ol>
                            <p className="text-left mt-2">التوقيع</p>
                        </div>
                      </div>
                 </CommitteePageWrapper>
                 <CommitteePageWrapper pageId="committee-page-3">
                    <div className="space-y-6 text-md font-semibold mt-8">
                         <div>
                             <p className="mb-2">يقوم {genderTitle} <Editable initialValue={data.member2Name} onSave={val => updateDataField('member2Name', val)} /> عضو اللجنة بالأعمال التالية:-</p>
                            <ol className="custom-ol space-y-2 pr-4">
                                <li>تسجيل غيابات التلاميذ وحسب القاعات الامتحانية.</li>
                                <li>اعداد الخلاصة لاستلام الدفاتر وحسب القاعات الامتحانية.</li>
                                <li>طي وختم الدفاتر الامتحانية والتأكد من خلوها من الإشارات مع {genderTitle} <Editable initialValue={'................'} onSave={_=>{}} />.</li>
                                <li>استلام الدفاتر الامتحانية من لجان الفحص والتأكد من عدها قبل الاستلام والتوقيع بذلك وأمام رئيس اللجنة.</li>
                                <li>استلام الدفاتر الامتحانية من لجنة التدقيق وعدها.</li>
                                <li>فتح الدفاتر الامتحانية مع {genderTitle} <Editable initialValue={'................'} onSave={_=>{}} /> وترتيبها.</li>
                            </ol>
                            <p className="text-left mt-2">التوقيع</p>
                        </div>
                        <div>
                             <p className="mb-2">يقوم {genderTitle} ( <Editable initialValue={data.member3Name} onSave={val => updateDataField('member3Name', val)} /> ) عضو اللجنة بالأعمال التالية :-</p>
                            <ol className="custom-ol space-y-2 pr-4">
                                <li>تدقيق درجات الشفوي للغة الانكليزية والتأكد من خلوها من الدرجات المبهمة.</li>
                                <li>طي و ختم الدفاتر الامتحانية مع {genderTitle} ( <Editable initialValue={'................'} onSave={_=>{}} /> ) والتأكد من ختم الدفاتر وخلوها من الإشارات غير مادة الامتحان.</li>
                                <li>مساعدة {genderTitle} ( <Editable initialValue={'................'} onSave={_=>{}} /> ) بإنزال الدرجات في سجلات المعلمين والتأكد بأن اللجنة التدقيقية قد قامت بعملها بشكل صحيح.</li>
                                <li>التأكد من إن <Editable initialValue={'................'} onSave={_=>{}} /> المادة قد وقع الدفاتر الامتحانية وتم ختمها قبل تسليمها إلى الطلاب.</li>
                                <li>ترتيب أسماء التلاميذ حسب الأحرف الهجائية بعد فتح أسماء التلاميذ.</li>
                            </ol>
                            <p className="text-left mt-2">التوقيع</p>
                        </div>
                        <div>
                             <p className="mb-2">يقوم {genderTitle} ( <Editable initialValue={data.member4Name} onSave={val => updateDataField('member4Name', val)} /> ) عضو اللجنة بالاعمال التالية :-</p>
                            <ol className="custom-ol space-y-2 pr-4">
                                <li>تهيئة الخرائط الامتحانية بالتعاون مع {genderTitle} ( <Editable initialValue={'................'} onSave={_=>{}} /> ).</li>
                                <li>استلام الدفاتر الامتحانية مع {genderTitle} ( <Editable initialValue={'................'} onSave={_=>{}} /> ) بعد انتهاء الامتحان.</li>
                                <li>سد النقص بعمل اي عضو و عمل محضر بالاعمال التي قام بها في حالة غيابه.</li>
                                <li>متابعة عمل لجان فحص الدفاتر الامتحانية.</li>
                                <li>فتح الدفاتر الامتحانية مع رئيس اللجنة الامتحانية وترتيبها.</li>
                            </ol>
                            <p className="text-left mt-2">التوقيع</p>
                        </div>
                    </div>
                 </CommitteePageWrapper>
             </div>
        </PageWrapper>
    );
};

// --- Auditing Committee View ---

const getInitialAuditingData = (principal: User) => ({
    orderRef: '..............',
    orderDate: '.../.../...',
    meetingDate: '..............',
    meetingApprovalDate: '.../.../...',
    academicYearStart: '....',
    academicYearEnd: '....',
    principalSignatureName: principal.name,
});

const getInitialAuditingMembers = (principal: User) => {
    const members = [
        { id: '1', name: principal.name, jobTitle: 'مدير المدرسة', position: 'رئيس اللجنة' },
    ];
    for (let i = 2; i <= 8; i++) {
        members.push({ id: String(i), name: '', jobTitle: '', position: 'عضوا' });
    }
    return members;
};


const AuditingCommitteeView = ({ setCurrentPageKey, settings, principal }: { setCurrentPageKey: (key: ExamLogPageKey) => void, settings: SchoolSettings, principal: User }) => {
    const [data, setData] = useLocalStorage('examAuditingData_v3', getInitialAuditingData(principal));
    const [members, setMembers] = useLocalStorage('examAuditingMembers_v3', getInitialAuditingMembers(principal));
    const [isExporting, setIsExporting] = React.useState(false);

    const updateDataField = (field: keyof ReturnType<typeof getInitialAuditingData>, value: string) => {
        setData(prev => ({ ...prev, [field]: value }));
    };

    const updateMemberField = (id: string, field: 'name' | 'jobTitle', value: string) => {
        setMembers(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    const handleExport = async () => {
        setIsExporting(true);
        await new Promise(resolve => setTimeout(resolve, 100));

        const { jsPDF } = jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const page = document.querySelector('.printable-auditing-page');

        if (!page) {
             setIsExporting(false);
             return;
        }

        try {
            const canvas = await html2canvas(page as HTMLElement, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            pdf.save(`لجنة_التدقيق_واعمالها.pdf`);
        } catch (error) {
            console.error("PDF Export Error:", error);
            alert("حدث خطأ أثناء التصدير.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <PageWrapper title="لجنة التدقيق واعمالها" setCurrentPageKey={setCurrentPageKey} currentPageKey="auditing_committee">
             <div className="text-center my-4">
                <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:bg-gray-400">
                    {isExporting ? <Loader2 className="animate-spin" /> : <Printer size={18} />}
                    {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
                </button>
            </div>

            <div className="bg-gray-100 p-4 rounded-lg overflow-y-auto max-h-[70vh]">
                 <div id="auditing-committee-page-1" className="w-[794px] min-h-[1123px] bg-white shadow-xl my-8 p-4 border-8 border-double border-blue-500 printable-auditing-page">
                    <div className="w-full h-full p-6 flex flex-col font-['Cairo']" dir="rtl">
                        <header className="flex justify-between items-start text-xl font-bold mb-8">
                            <div>ادارة: <span className="border-b border-dashed border-gray-500">{settings.schoolName}</span></div>
                            <h2 className="text-2xl text-green-700">م/ اللجنة التدقيقية</h2>
                        </header>
                        <main className="text-lg space-y-6 flex-grow">
                             <p>
                                شارة الى الامر المدرسي (<Editable initialValue={data.orderRef} onSave={v => updateDataField('orderRef', v)}/>) بتاريخ <Editable initialValue={data.orderDate} onSave={v => updateDataField('orderDate', v)} /> ٢٠٢ وبحضور جميع الملاك في الاجتماع الاول لمجلس المعلمين المنعقد يوم <Editable initialValue={data.meetingDate} onSave={v => updateDataField('meetingDate', v)} /> الموافق <Editable initialValue={data.meetingApprovalDate} onSave={v => updateDataField('meetingApprovalDate', v)} /> ٢٠٢ تم تشكيل اللجنة التدقيقية للسنة للعام الدراسي <Editable initialValue={data.academicYearStart} onSave={v => updateDataField('academicYearStart', v)} /> / <Editable initialValue={data.academicYearEnd} onSave={v => updateDataField('academicYearEnd', v)} /> تكون ومهامها كما يلي:
                            </p>
                            <ol className="list-decimal list-inside space-y-3 font-semibold pr-4">
                                <li>تدقيق نتائج المدرسة فور اعلانها بكل دقة واخلاص.</li>
                                <li>التأكد من نقل درجة السؤال من داخل الدفتر الى خارجه بشكل دقيق وعدم وجود اجابة من دون تصحيح ونقل الدرجة النهائية من الدفتر الى السجل وسطي وسجل المعلمين بشكل سليم وبدقه.</li>
                                <li>مراجعة العمليات الحسابية في السجل الوسطي وسجل المعلمين والتأكد من مطابقة الدرجات بين السجلين.</li>
                                <li>التأكد من وضع درجة القرار بشكل صحيح وادراجها في سجل القرارات.</li>
                                <li>تدون جميع الاخطاء المكتشفة بمحضر يرفع الى اللجنة الامتحانية ويوقع عليه جميع اعضاء اللجنة التدقيقية.</li>
                            </ol>
                            <p className="mt-8 font-bold">وتتكون اللجنة من السادة المدرجة اسمائهم ادناه:</p>
                             <table className="w-full border-collapse border border-black mt-4">
                                <thead className="bg-gray-200 font-bold">
                                    <tr>
                                        <th className="border border-black p-2 w-[8%]">ت</th>
                                        <th className="border border-black p-2 w-[30%]">اسم الثلاثي</th>
                                        <th className="border border-black p-2 w-[25%]">العنوان الوظيفي</th>
                                        <th className="border border-black p-2 w-[17%]">المنصب</th>
                                        <th className="border border-black p-2 w-[20%]">التوقيع</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {members.map((member, index) => (
                                        <tr key={member.id} className="h-10">
                                            <td className="border border-black text-center">{index + 1}</td>
                                            <td className="border border-black p-1 text-center"><Editable initialValue={member.name} onSave={v => updateMemberField(member.id, 'name', v)} /></td>
                                            <td className="border border-black p-1 text-center"><Editable initialValue={member.jobTitle} onSave={v => updateMemberField(member.id, 'jobTitle', v)} /></td>
                                            <td className="border border-black text-center font-bold">{member.position}</td>
                                            <td className="border border-black"></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </main>
                        <footer className="mt-auto flex justify-center pt-16">
                            <div className="text-center">
                                <div className="px-6 py-2 border-2 border-cyan-500 rounded-lg bg-cyan-50">رئيس اللجنة الامتحانية</div>
                                <div className="mt-2 border-b-2 border-dotted border-gray-600 py-2 min-w-[200px] text-center font-bold">
                                     <Editable initialValue={data.principalSignatureName} onSave={v => updateDataField('principalSignatureName', v)} />
                                </div>
                            </div>
                        </footer>
                    </div>
                </div>
            </div>
        </PageWrapper>
    );
};

// --- Specialization Committees View ---

type Committee = { name: string, teachers: User[] };

const TeacherRow = ({ teacher, role, onPromote, isExporting }: { teacher: User, role: string, onPromote: () => void, isExporting: boolean }) => {
    const liftStyle: React.CSSProperties = { position: 'relative', bottom: '7px' };

    return (
        <tr className="h-12 bg-white hover:bg-gray-50">
            <td className="border border-gray-400 text-right px-2 font-semibold">
                <div className="flex items-center justify-between">
                    <span style={liftStyle}>{teacher.name}</span>
                    {role === 'عضو' && !isExporting && (
                        <button onClick={onPromote} className="p-1 text-blue-500 hover:bg-blue-100 rounded-full" title="تعيين كرئيس">
                           <ArrowUpCircle size={20} />
                        </button>
                    )}
                </div>
            </td>
            <td className="border border-gray-400 text-center font-bold">
                <div style={liftStyle}>{role}</div>
            </td>
            <td className="border border-gray-400"></td>
        </tr>
    );
};

const CommitteeTable = ({ committee, isExporting, onSetHead }: { committee: Committee; isExporting: boolean; onSetHead: (teacherId: string) => void; }) => (
    <div className={`mb-8 committee-table`} style={{ pageBreakInside: 'avoid' }}>
        <h3 className="text-xl font-bold text-green-700 mb-2">{committee.name}</h3>
        <table className="w-full border-collapse border border-gray-400">
            <thead className="bg-orange-100">
                <tr>
                    <th className="border border-gray-400 p-2 w-[40%]">الاسم الثلاثي</th>
                    <th className="border border-gray-400 p-2 w-[30%]">المنصب</th>
                    <th className="border border-gray-400 p-2 w-[30%]">التوقيع</th>
                </tr>
            </thead>
            <tbody>
                {committee.teachers.map((teacher, index) => (
                     <React.Fragment key={teacher.id}>
                        <TeacherRow
                            teacher={teacher}
                            role={index === 0 ? 'رئيساً' : 'عضو'}
                            onPromote={() => onSetHead(teacher.id)}
                            isExporting={isExporting}
                        />
                     </React.Fragment>
                ))}
            </tbody>
        </table>
    </div>
);


const SpecializationCommitteesView = ({ setCurrentPageKey, principal, users, classes, settings }: ExamControlLogProps & { setCurrentPageKey: (key: ExamLogPageKey) => void }) => {
    const [committees, setCommittees] = React.useState<Committee[]>(() => {
        const subjectMap = new Map<string, { name: string; teachers: User[] }>();
        const principalTeachers = users.filter(u => u.role === 'teacher' && u.principalId === principal.id);

        for (const teacher of principalTeachers) {
            for (const assignment of (teacher.assignments || [])) {
                const assignedClass = classes.find(c => c.id === assignment.classId);
                if (assignedClass) {
                    const subject = assignedClass.subjects.find(s => s.id === assignment.subjectId);
                    if (subject) {
                        if (!subjectMap.has(subject.name)) {
                            subjectMap.set(subject.name, { name: `لجنة ${subject.name}`, teachers: [] });
                        }
                        const subjectEntry = subjectMap.get(subject.name)!;
                        if (!subjectEntry.teachers.some(t => t.id === teacher.id)) {
                            subjectEntry.teachers.push(teacher);
                        }
                    }
                }
            }
        }
        return Array.from(subjectMap.values());
    });
    const [isExporting, setIsExporting] = React.useState(false);
    
    const handleSetCommitteeHead = (committeeNameToUpdate: string, teacherIdToPromote: string) => {
        setCommittees(prevCommittees => 
            prevCommittees.map(committee => {
                if (committee.name === committeeNameToUpdate) {
                    const teacherToPromote = committee.teachers.find(t => t.id === teacherIdToPromote);
                    if (!teacherToPromote) return committee;

                    const otherTeachers = committee.teachers.filter(t => t.id !== teacherIdToPromote);
                    const newTeachers = [teacherToPromote, ...otherTeachers];
                    
                    return { ...committee, teachers: newTeachers };
                }
                return committee;
            })
        );
    };
    
    const handleExport = async () => {
        setIsExporting(true);
        await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI to update
        
        const exportContainer = document.getElementById('spec-committees-export-container');
        if (!exportContainer) {
            setIsExporting(false);
            return;
        }

        try {
            const canvas = await html2canvas(exportContainer, { 
                scale: 2, 
                useCORS: true,
                height: exportContainer.scrollHeight,
                width: exportContainer.scrollWidth,
            });

            const { jsPDF } = jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            const ratio = imgWidth / pdfWidth;
            const canvasPageHeight = pdfHeight * ratio;
            
            let position = 0;
            while (position < imgHeight) {
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = imgWidth;
                pageCanvas.height = canvasPageHeight;
                const pageCtx = pageCanvas.getContext('2d');

                if (pageCtx) {
                    pageCtx.drawImage(canvas, 0, position, imgWidth, canvasPageHeight, 0, 0, imgWidth, canvasPageHeight);
                    const imgData = pageCanvas.toDataURL('image/png');

                    if (position > 0) {
                        pdf.addPage();
                    }
                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                    position += canvasPageHeight;
                } else {
                    throw new Error("Could not get canvas context for PDF page.");
                }
            }
            
            pdf.save('لجان-الفحص-حسب-الاختصاص.pdf');

        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء تصدير الملف.");
        } finally {
             setIsExporting(false);
        }
    };

    return (
        <PageWrapper title="لجان الفحص حسب الاختصاص" setCurrentPageKey={setCurrentPageKey} currentPageKey="specialization_committees">
            <div className="text-center my-4">
                 <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:bg-gray-400">
                    {isExporting ? <Loader2 className="animate-spin" /> : <Printer size={18} />}
                    {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
                </button>
            </div>
             <div className={`bg-gray-100 rounded-lg ${!isExporting ? 'p-4 overflow-y-auto max-h-[70vh]' : ''}`}>
                <div id="spec-committees-export-container" className="p-4 bg-white">
                    <header className="text-center mb-6">
                        <p className="font-bold">إدارة: {settings.schoolName}</p>
                        <h2 className="text-2xl font-bold mt-2 text-red-600">م/ لجان الفحص</h2>
                    </header>
                    {committees.map((committee) => (
                       <React.Fragment key={committee.name}>
                        <CommitteeTable
                            committee={committee}
                            isExporting={isExporting}
                            onSetHead={(teacherId) => handleSetCommitteeHead(committee.name, teacherId)}
                        />
                       </React.Fragment>
                    ))}
                 </div>
            </div>
        </PageWrapper>
    );
};


// --- Oral Exam Schedule View ---

const getInitialScheduleData = (classStages: string[]) => {
    const initialData: Record<string, any> = {};
    classStages.forEach(stage => {
        initialData[stage] = {
            note: '',
            schedule: Array(5).fill({ day: '', column2: '', column3: '' }),
            instructions: [
                'تبدا الامتحانات الشفوية اثناء سير العملية التربوية',
                'الامتحانات تكون على شكل لجان منتظمة',
                'يكون امتحان مادة الحاسوب والتربية الرياضية يوميا منذ بداية الامتحانات الشفوية وحتى نهاية الامتحانات الشفهية مراعاة للطالب',
                'لا يحق لاي طالب اعادة الامتحان الشفهي ومن يتغيب عن الامتحان يحتسب له صفر في الامتحان الشفهي الا بعذر مشروع (اجازة مرضية – او حالة وفاة)',
            ],
        };
    });
    return initialData;
};

const OralExamScheduleView = ({ setCurrentPageKey, settings, classes }: { setCurrentPageKey: (key: ExamLogPageKey) => void, settings: SchoolSettings, classes: ClassData[] }) => {
    const classStages = React.useMemo(() => Array.from(new Set(classes.map(c => c.stage))).sort((a,b) => a.localeCompare(b,'ar-IQ')), [classes]);
    
    const [schedulesData, setSchedulesData] = useLocalStorage('oralExamSchedules_v1', getInitialScheduleData(classStages));
    const [activeStage, setActiveStage] = React.useState(classStages[0] || '');
    const [isExporting, setIsExporting] = React.useState(false);
    
     React.useEffect(() => {
        // This ensures if classes change, the schedule data is initialized for new stages
        const existingStages = Object.keys(schedulesData);
        const newStages = classStages.filter(s => !existingStages.includes(s));
        if (newStages.length > 0) {
            setSchedulesData(prev => ({ ...prev, ...getInitialScheduleData(newStages) }));
        }
    }, [classStages, schedulesData, setSchedulesData]);

    const activeSchedule = schedulesData[activeStage];

    const handleUpdate = (field: string, value: any, index?: number) => {
        setSchedulesData(prev => {
            const newStageData = { ...prev[activeStage] };
            if (field === 'schedule' && index !== undefined) {
                newStageData.schedule = newStageData.schedule.map((row: any, i: number) => i === index ? value : row);
            } else if (field === 'instructions' && index !== undefined) {
                 newStageData.instructions = newStageData.instructions.filter((_: any, i: number) => i !== index);
            } else {
                (newStageData as any)[field] = value;
            }
            return { ...prev, [activeStage]: newStageData };
        });
    };
    
     const handleExport = async () => {
        setIsExporting(true);
        await new Promise(resolve => setTimeout(resolve, 100)); // allow UI to update

        const { jsPDF } = jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pages = document.querySelectorAll('.printable-oral-exam-page');
        
        try {
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i] as HTMLElement;
                const canvas = await html2canvas(page, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            }
            pdf.save(`جدول_الامتحانات_الشفوية.pdf`);
        } catch (error) {
            console.error("PDF Export Error:", error);
            alert("حدث خطأ أثناء التصدير.");
        } finally {
            setIsExporting(false);
        }
    };
    
    const liftStyle: React.CSSProperties = { position: 'relative', bottom: '7px' };

    return (
        <PageWrapper title="جدول الامتحانات الشفوية" setCurrentPageKey={setCurrentPageKey} currentPageKey="oral_exam_schedule">
            <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2 p-1 bg-gray-200 rounded-lg">
                    {classStages.map(stage => (
                        <button key={stage} onClick={() => setActiveStage(stage)} className={`px-4 py-1 font-semibold rounded-md transition-colors ${activeStage === stage ? 'bg-cyan-600 text-white' : 'hover:bg-gray-300'}`}>
                            {stage}
                        </button>
                    ))}
                </div>
                <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:bg-gray-400">
                    {isExporting ? <Loader2 className="animate-spin" /> : <Printer size={18} />}
                    {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
                </button>
            </div>
            
             <div className="bg-gray-100 p-4 rounded-lg overflow-y-auto max-h-[70vh]">
                {classStages.map(stage => (
                     <div key={stage} id={`oral-exam-page-${stage}`} className={`w-[794px] min-h-[1123px] bg-white shadow-xl my-8 p-4 printable-oral-exam-page ${isExporting || stage === activeStage ? 'block' : 'hidden'}`}>
                        <div className="w-full h-full p-6 flex flex-col font-['Cairo']" dir="rtl">
                            <header className="text-center font-bold space-y-2 mb-8">
                                <h2 className="text-4xl text-red-600">جدول الامتحانات الشفوية لامتحانات</h2>
                                <Editable initialValue={schedulesData[stage]?.note || '...............'} onSave={(val) => handleUpdate('note', val)} className="text-2xl" />
                                <h3 className="text-3xl text-purple-700">للعام الدراسي {settings.academicYear}</h3>
                                <h4 className="text-3xl text-purple-700">للصف {stage}</h4>
                            </header>
                            
                            <main className="flex-grow">
                                <table className="w-full border-collapse border-2 border-black">
                                    <thead className="text-2xl font-bold">
                                        <tr>
                                            <th className="border-2 border-black p-2 bg-yellow-300 w-[40%]">اليوم والتاريخ</th>
                                            <th className="border-2 border-black p-2 bg-yellow-300 w-[40%]">{stage}</th>
                                            <th className="border-2 border-black p-2 bg-yellow-300 w-[20%]"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xl">
                                        {(schedulesData[stage]?.schedule || []).map((row: any, index: number) => (
                                            <tr key={index}>
                                                <td className="border-2 border-black p-0"><Editable initialValue={row.day} onSave={val => handleUpdate('schedule', {...row, day: val}, index)} className="w-full h-full block p-2" /></td>
                                                <td className="border-2 border-black p-0"><Editable initialValue={row.column2} onSave={val => handleUpdate('schedule', {...row, column2: val}, index)} className="w-full h-full block p-2" /></td>
                                                <td className="border-2 border-black p-0"><Editable initialValue={row.column3} onSave={val => handleUpdate('schedule', {...row, column3: val}, index)} className="w-full h-full block p-2" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                
                                <div className="mt-12">
                                    <h4 className="text-2xl font-bold text-blue-700 mb-4">تعليمات الامتحانات الشفوية</h4>
                                    <ol className="list-decimal list-inside space-y-2 text-lg font-semibold">
                                        {(schedulesData[stage]?.instructions || []).map((inst: string, index: number) => (
                                            <li key={index} className="flex items-center group">
                                                <span className="flex-grow">{inst}</span>
                                                <button onClick={() => handleUpdate('instructions', '', index)} className="mr-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </main>
                        </div>
                    </div>
                ))}
            </div>
        </PageWrapper>
    );
};

// --- Seating Charts View ---
const SeatingChartsView = ({ setCurrentPageKey }: { setCurrentPageKey: (key: ExamLogPageKey) => void }) => (
    <PageWrapper title="خرائط جلوس الطلبة" setCurrentPageKey={setCurrentPageKey} currentPageKey="seating_charts">
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-100 p-8 rounded-2xl shadow-2xl max-w-4xl mx-auto text-center border-t-4 border-purple-400">
             <h2 className="text-4xl font-extrabold text-gray-800 mb-6">
                نظام إدارة مخططات الجلوس الامتحانية
            </h2>
            <p className="font-bold text-xl text-gray-800 mb-4">
                تستطيع تكوين خرائط جلوس الطلبة الان من خلال ( نظام إدارة مخططات الجلوس الامتحانية ) 
            </p>
            <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto leading-relaxed">
                سوف تمكنك اداتنا المتطورة ان تنشئ قاعات امتحانية بكفائة عالية مع رمز QR لكل طالب تستطيع مسحه باستخدام كامرة الموبايل او الكامرة المرتبطة بالحاسوب لتسجيل غيابات الطلاب والتلاميذ. قم بتصدير اوراق القاعات وارفاقها مع سجل السيطرة الامتحانية. اتحنا لك اضافة لمساتك الخاصة على القاعات المصدرة ليكون سجل السيطرة الامتحانية لديك مميزا.
            </p>

            <a 
                href="https://hussien1977.github.io/qait/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-12 py-5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold text-2xl rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 ease-in-out"
            >
                <div className="flex items-center justify-center gap-3">
                    <MapIcon size={32} className="animate-pulse" />
                    <span>انشئ قاعاتك الامتحانية الان</span>
                </div>
            </a>
        </div>
    </PageWrapper>
);


// --- Main Component ---

export default function ExamControlLog({ principal, users, settings, classes }: ExamControlLogProps) {
    const [currentPageKey, setCurrentPageKey] = React.useState<ExamLogPageKey>('index');

    const renderContent = () => {
        switch (currentPageKey) {
            case 'index':
                return <IndexView setCurrentPageKey={setCurrentPageKey} />;
            case 'cover':
                return <CoverView setCurrentPageKey={setCurrentPageKey} />;
            case 'minutes':
                return <MeetingMinutesView setCurrentPageKey={setCurrentPageKey} />;
            case 'decision132':
                return <Decision132View setCurrentPageKey={setCurrentPageKey} />;
            case 'signatures':
                return <SignaturesView setCurrentPageKey={setCurrentPageKey} principal={principal} users={users} settings={settings} />;
            case 'committee':
                return <CommitteeView setCurrentPageKey={setCurrentPageKey} principal={principal} settings={settings} />;
            case 'auditing_committee':
                return <AuditingCommitteeView setCurrentPageKey={setCurrentPageKey} principal={principal} settings={settings} />;
            case 'specialization_committees':
                return <SpecializationCommitteesView setCurrentPageKey={setCurrentPageKey} principal={principal} users={users} settings={settings} classes={classes}/>;
            case 'oral_exam_schedule':
                return <OralExamScheduleView setCurrentPageKey={setCurrentPageKey} settings={settings} classes={classes} />;
            case 'written_exam_schedule':
                return <WrittenExamScheduleView setCurrentPageKey={setCurrentPageKey} settings={settings} classes={classes} />;
            case 'questions_answers_receipt':
                return <QuestionsAnswersReceiptView setCurrentPageKey={setCurrentPageKey} settings={settings} classes={classes} />;
            case 'seating_charts':
                return <SeatingChartsView setCurrentPageKey={setCurrentPageKey} />;
            case 'absence_form':
                 return (
                    <PageWrapper title="استمارة الغيابات اليومية للطلبة" setCurrentPageKey={setCurrentPageKey} currentPageKey="absence_form">
                        <AbsenceDraftExporter settings={settings} />
                    </PageWrapper>
                );
            case 'exam_booklets_receipt':
                return (
                    <PageWrapper title="استلام وتسليم رزم الدفاتر الامتحانية" setCurrentPageKey={setCurrentPageKey} currentPageKey="exam_booklets_receipt">
                        <ExamBookletsReceipt settings={settings} />
                    </PageWrapper>
                );
            case 'examination_record':
                return (
                    <PageWrapper title="محضر فحص وتدقيق" setCurrentPageKey={setCurrentPageKey} currentPageKey="examination_record">
                        <ExaminationRecord settings={settings} />
                    </PageWrapper>
                );
            default:
                return <IndexView setCurrentPageKey={setCurrentPageKey} />;
        }
    };

    return (
        <div>
            {renderContent()}
        </div>
    );
}
