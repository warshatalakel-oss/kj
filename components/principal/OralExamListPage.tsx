import React from 'react';
import type { ClassData, SchoolSettings, Student } from '../../types';

interface OralExamListPageProps {
    settings: SchoolSettings;
    logos: { school: string | null; ministry: string | null };
    students: Student[];
    classData?: ClassData;
    subjectName: string;
    pageInfo: {
        pageNumber: number;
        totalPages: number;
    };
    isExporting: boolean;
    committeeMemberName?: string;
    committeeHeadName?: string;
    examRound: string;
    examType: string;
}

const LiftedCellContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ position: 'relative', bottom: '6px' }}>{children}</div>
);


export default function OralExamListPage({ settings, logos, students, classData, subjectName, pageInfo, isExporting, committeeMemberName = '', committeeHeadName = '', examRound, examType }: OralExamListPageProps) {
    if (!classData) return <div>لا توجد بيانات للصف</div>;

    const templateType = subjectName === 'اللغة العربية' ? 'arabic' : (subjectName === 'اللغة الانكليزية' ? 'english' : (subjectName === 'التربية الاسلامية' ? 'islamic' : (subjectName === 'الحاسوب' ? 'computer' : (subjectName === 'اللغة الفرنسية' ? 'french' : 'default'))));
    
    const PADDING_ROWS = 25;
    const displayRows = [...students];
    while (displayRows.length < PADDING_ROWS) {
        displayRows.push(null as any); // Use null for empty rows
    }

    const cellContentStyle: React.CSSProperties = { position: 'relative', bottom: '6px' };
    const liftedHeaderContentStyle: React.CSSProperties = { position: 'relative', bottom: '5px' };
    const islamicLiftedHeaderContentStyle: React.CSSProperties = { position: 'relative', bottom: '6px' };

    const renderFrenchTemplate = () => (
        <div className="w-[794px] h-[1123px] p-6 bg-white flex flex-col font-['Cairo'] border-2 border-black" dir="rtl">
            <header className="text-center mb-4">
                <div className="flex justify-between items-center text-base font-bold">
                    <div className="text-left w-1/3">
                        <p>المادة: {subjectName}</p>
                        <p>الصف: {classData.stage} ({classData.section})</p>
                    </div>
                    <div className="flex-grow text-center">
                        <h1 className="text-2xl font-bold text-red-600">قوائم الامتحان الشفوي</h1>
                        <p className="text-lg mt-1">للعام الدراسي {settings.academicYear} &nbsp;&nbsp; {examType} &nbsp;&nbsp; الدور {examRound}</p>
                    </div>
                    <div className="text-right w-1/3">
                        <p>{settings.schoolName}</p>
                    </div>
                </div>
            </header>
            <main className="flex-grow">
                <table className="w-full border-collapse border-2 border-black text-sm">
                    <thead className="font-bold text-center" style={{ backgroundColor: '#fbe9e7' }}>
                        <tr>
                            <th rowSpan={2} className="border-2 border-black p-1 w-[4%] align-middle"><LiftedCellContent>ت</LiftedCellContent></th>
                            <th rowSpan={2} className="border-2 border-black p-1 w-[25%] align-middle"><LiftedCellContent>اسم الطالب</LiftedCellContent></th>
                            <th className="border-2 border-black p-1 w-[7%]"><LiftedCellContent>G.q.</LiftedCellContent></th>
                            <th className="border-2 border-black p-1 w-[7%]"><LiftedCellContent>V.</LiftedCellContent></th>
                            <th className="border-2 border-black p-1 w-[7%]"><LiftedCellContent>P.</LiftedCellContent></th>
                            <th className="border-2 border-black p-1 w-[7%]"><LiftedCellContent>D.</LiftedCellContent></th>
                            <th colSpan={2} className="border-2 border-black p-1"><LiftedCellContent>الدرجة النهائية</LiftedCellContent></th>
                            <th rowSpan={2} className="border-2 border-black p-1 align-middle"><LiftedCellContent>الملاحظات</LiftedCellContent></th>
                        </tr>
                        <tr style={{ backgroundColor: '#fbe9e7' }}>
                            <th className="border-2 border-black p-1 font-normal">10</th>
                            <th className="border-2 border-black p-1 font-normal">10</th>
                            <th className="border-2 border-black p-1 font-normal">10</th>
                            <th className="border-2 border-black p-1 font-normal">10</th>
                            <th className="border-2 border-black p-1 font-normal w-[7%]">رقما</th>
                            <th className="border-2 border-black p-1 font-normal w-[15%]">كتابة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((student, index) => (
                             <tr key={student ? student.id : `empty-${index}`} className="h-9" style={{ backgroundColor: index % 2 !== 0 ? '#fff3e0' : 'white' }}>
                                <td className="border-2 border-black text-center"><LiftedCellContent>{student ? index + 1 : ''}</LiftedCellContent></td>
                                <td className="border-2 border-black px-2 text-right font-semibold"><LiftedCellContent>{student?.name}</LiftedCellContent></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>
             <footer className="mt-auto pt-8 flex justify-around font-bold text-base px-4" style={{ position: 'relative', bottom: '14px' }}>
                <div className="text-center">
                    <p>عضوا</p>
                </div>
                 <div className="text-center">
                    <p>رئيس اللجنة</p>
                </div>
                <div className="text-center">
                    <p>{settings.principalName}</p>
                    <p>مدير المدرسة</p>
                </div>
            </footer>
        </div>
    );

    const renderComputerTemplate = () => (
        <div className="w-[794px] h-[1123px] p-6 bg-white flex flex-col font-['Cairo']" dir="rtl">
            <header className="flex justify-between items-start mb-2">
                <div className="w-1/3 text-right space-y-1">
                    <div className="w-24 h-24 mx-auto border-2 border-black rounded-full flex items-center justify-center p-1">
                        {logos.ministry ? <img src={logos.ministry} alt="شعار الوزارة" className="h-full w-full object-contain rounded-full" /> : <span className="text-sm">شعار الوزارة</span>}
                    </div>
                    <p className="font-bold">ادارة</p>
                    <p className="font-bold">{settings.schoolName}</p>
                </div>
                <div className="w-1/3 text-center pt-8 space-y-1">
                    <h1 className="text-xl font-bold text-red-600">قوائم درجات العملي</h1>
                    <h2 className="text-base font-semibold">امتحان {examType}</h2>
                    <h3 className="text-sm font-semibold">للعام الدراسي ( {settings.academicYear} ) الدور {examRound}</h3>
                </div>
                <div className="w-1/3 text-left space-y-1">
                     <div className="w-24 h-24 mx-auto border-2 border-black rounded-full flex items-center justify-center p-1">
                        {logos.school ? <img src={logos.school} alt="شعار المدرسة" className="h-full w-full object-contain rounded-full" /> : <span className="text-sm">شعار المدرسة</span>}
                    </div>
                    <p className="font-bold">المادة / الحاسوب</p>
                    <p className="font-bold">الصف / {classData.stage}</p>
                    <p className="font-bold">الشعبة / {classData.section}</p>
                </div>
            </header>
            <main className="flex-grow mt-2">
                <table className="w-full border-collapse border-2 border-black text-sm">
                    <thead className="font-bold text-center">
                        <tr className="bg-pink-200">
                            <th rowSpan={2} className="border-2 border-black p-1 w-[4%] align-middle"><LiftedCellContent>ت</LiftedCellContent></th>
                            <th rowSpan={2} className="border-2 border-black p-1 w-[36%] align-middle"><LiftedCellContent>اسم الطالب</LiftedCellContent></th>
                            <th colSpan={2} className="border-2 border-black p-1"><LiftedCellContent>الدرجة</LiftedCellContent></th>
                            <th rowSpan={2} className="border-2 border-black p-1 align-middle"><LiftedCellContent>الملاحظات</LiftedCellContent></th>
                        </tr>
                        <tr className="bg-pink-100">
                            <th className="border-2 border-black p-1 w-[15%]"><LiftedCellContent>رقما</LiftedCellContent></th>
                            <th className="border-2 border-black p-1 w-[25%]"><LiftedCellContent>كتابة</LiftedCellContent></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((student, index) => (
                            <tr key={student ? student.id : `empty-${index}`} className="h-9">
                                <td className="border-2 border-black text-center"><LiftedCellContent>{index + 1}</LiftedCellContent></td>
                                <td className="border-2 border-black px-2 text-right font-semibold"><LiftedCellContent>{student?.name}</LiftedCellContent></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>
            <footer className="mt-auto pt-8 flex justify-between font-bold text-base px-8" style={{ position: 'relative', bottom: '14px' }}>
                <div className="text-center">
                    <div className="h-12 mb-1 min-w-[150px] flex items-end justify-center border-b-2 border-dotted" style={{ borderColor: isExporting ? 'transparent' : 'black' }}>
                        <span className="pb-1">{settings.principalName}</span>
                    </div>
                    <p>مدير المدرسة</p>
                </div>
                <div className="text-center">
                    <div className="h-12 mb-1 min-w-[150px] flex items-end justify-center border-b-2 border-dotted" style={{ borderColor: isExporting ? 'transparent' : 'black' }}>
                        <span className="pb-1">{committeeMemberName}</span>
                    </div>
                    <p>عضوا</p>
                </div>
                <div className="text-center">
                    <div className="h-12 mb-1 min-w-[150px] flex items-end justify-center border-b-2 border-dotted" style={{ borderColor: isExporting ? 'transparent' : 'black' }}>
                        <span className="pb-1">{committeeHeadName}</span>
                    </div>
                    <p>رئيس اللجنة</p>
                </div>
            </footer>
        </div>
    );

    const renderIslamicTemplate = () => (
        <table className="w-full border-collapse border-2 border-black text-sm">
            <thead className="font-bold text-center">
                <tr style={{ backgroundColor: '#fde047' }}>
                    <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[4%]" style={{ position: 'relative', zIndex: 10 }}>ت</th>
                    <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[24%]" style={{ position: 'relative', zIndex: 10 }}>اسم الطالب</th>
                    <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[8%]" style={{ position: 'relative', zIndex: 10 }}>الرقم<br/>الامتحاني</th>
                    
                    <th className="border-2 border-black p-1" style={{backgroundColor: '#bbf7d0'}}><div style={islamicLiftedHeaderContentStyle}>الحفظ</div></th>
                    <th className="border-2 border-black p-1" style={{backgroundColor: '#bbf7d0'}}><div style={islamicLiftedHeaderContentStyle}>التلاوة</div></th>
                    <th className="border-2 border-black p-1" style={{backgroundColor: '#bbf7d0'}}><div style={islamicLiftedHeaderContentStyle}>المعاني</div></th>
                    <th className="border-2 border-black p-1" style={{backgroundColor: '#bbf7d0'}}><div style={islamicLiftedHeaderContentStyle}>التفسير</div></th>

                    <th colSpan={2} className="border-2 border-black p-1" style={{backgroundColor: '#fed7aa'}}><div style={islamicLiftedHeaderContentStyle}>الدرجة</div></th>
                    
                    <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[20%]" style={{backgroundColor: '#fde68a', position: 'relative', zIndex: 10 }}>الملاحظات</th>
                </tr>
                <tr style={{ backgroundColor: '#fde047' }}>
                    <th className="border-2 border-black p-1 font-normal w-[6%]" style={{backgroundColor: '#bbf7d0'}}>3</th>
                    <th className="border-2 border-black p-1 font-normal w-[6%]" style={{backgroundColor: '#bbf7d0'}}>3</th>
                    <th className="border-2 border-black p-1 font-normal w-[6%]" style={{backgroundColor: '#bbf7d0'}}>2</th>
                    <th className="border-2 border-black p-1 font-normal w-[6%]" style={{backgroundColor: '#bbf7d0'}}>2</th>
                    
                    <th className="border-2 border-black p-1 font-normal w-[8%]" style={{backgroundColor: '#fed7aa'}}>رقما"</th>
                    <th className="border-2 border-black p-1 font-normal w-[12%]" style={{backgroundColor: '#fed7aa'}}>كتابة</th>
                </tr>
            </thead>
            <tbody>
                {displayRows.map((student, index) => (
                    <tr key={student ? student.id : `empty-${index}`} className="h-9" style={{backgroundColor: index % 2 === 0 ? '#fefce8' : '#eff6ff'}}>
                        <td className="border-2 border-black text-center w-[4%]"><div style={cellContentStyle}>{index + 1}</div></td>
                        <td className="border-2 border-black px-2 text-right font-semibold w-[24%]"><div style={cellContentStyle}>{student?.name}</div></td>
                        <td className="border-2 border-black px-2 text-center w-[8%]"><div style={cellContentStyle}>{student?.examId}</div></td>
                        <td className="border-2 border-black w-[6%]"></td> {/* الحفظ */}
                        <td className="border-2 border-black w-[6%]"></td> {/* التلاوة */}
                        <td className="border-2 border-black w-[6%]"></td> {/* المعاني */}
                        <td className="border-2 border-black w-[6%]"></td> {/* التفسير */}
                        <td className="border-2 border-black w-[8%]"></td> {/* الدرجة رقما */}
                        <td className="border-2 border-black w-[12%]"></td> {/* الدرجة كتابة */}
                        <td className="border-2 border-black w-[20%]"></td> {/* الملاحظات */}
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const renderArabicFirstTemplateHeaders = () => (
        <thead className="font-bold text-center">
            <tr className="bg-orange-300">
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[4%]" style={{ position: 'relative', zIndex: 10 }}>ت</th>
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[25%]" style={{ position: 'relative', zIndex: 10 }}>اسم الطالب</th>
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[6%]" style={{ position: 'relative', zIndex: 10 }}>الرقم<br/>الامتحاني</th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#dcfce7'}}><div style={liftedHeaderContentStyle}>القراءة</div></th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#dcfce7'}}><div style={liftedHeaderContentStyle}>القواعد</div></th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#dcfce7'}}><div style={liftedHeaderContentStyle}>المعاني</div></th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#dcfce7'}}><div style={liftedHeaderContentStyle}>المحفوظات</div></th>
                <th colSpan={2} className="border-2 border-black p-1" style={{backgroundColor: '#dcfce7'}}><div style={liftedHeaderContentStyle}>المجموع</div></th>
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[25%]" style={{ position: 'relative', zIndex: 10 }}>الملاحظات</th>
            </tr>
            <tr className="bg-orange-300">
                <th className="border-2 border-black p-1 font-normal w-[5%]"><div>5</div><div>درجات</div></th>
                <th className="border-2 border-black p-1 font-normal w-[5%]"><div>5</div><div>درجات</div></th>
                <th className="border-2 border-black p-1 font-normal w-[5%]"><div>5</div><div>درجات</div></th>
                <th className="border-2 border-black p-1 font-normal w-[5%]"><div>5</div><div>درجات</div></th>
                <th className="border-2 border-black p-1 font-normal w-[5%]">رقما"</th>
                <th className="border-2 border-black p-1 font-normal w-[15%]">كتابة</th>
            </tr>
        </thead>
    );

    const renderArabicSecondTemplateHeaders = () => (
         <thead className="font-bold text-center">
            <tr className="bg-orange-300">
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[4%]" style={{ position: 'relative', zIndex: 10 }}>ت</th>
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[25%]" style={{ position: 'relative', zIndex: 10 }}>اسم الطالب</th>
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[6%]" style={{ position: 'relative', zIndex: 10 }}>الرقم<br/>الامتحاني</th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#dcfce7'}}><div style={liftedHeaderContentStyle}>القراءة</div></th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#dcfce7'}}><div style={liftedHeaderContentStyle}>القواعد</div></th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#dcfce7'}}><div style={liftedHeaderContentStyle}>المعاني</div></th>
                <th colSpan={2} className="border-2 border-black p-1" style={{backgroundColor: '#dcfce7'}}><div style={liftedHeaderContentStyle}>المجموع</div></th>
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[20%]" style={{ position: 'relative', zIndex: 10 }}>الملاحظات</th>
            </tr>
            <tr className="bg-orange-300">
                <th className="border-2 border-black p-1 font-normal w-[6%]"><div>۱۰</div><div>درجات</div></th>
                <th className="border-2 border-black p-1 font-normal w-[6%]"><div>٥</div><div>درجات</div></th>
                <th className="border-2 border-black p-1 font-normal w-[6%]"><div>٥</div><div>درجات</div></th>
                <th className="border-2 border-black p-1 font-normal w-[6%]">رقما"</th>
                <th className="border-2 border-black p-1 font-normal w-[15%]">كتابة</th>
            </tr>
        </thead>
    );

    const renderEnglishTemplateHeaders = () => (
        <thead className="font-bold text-center">
            <tr style={{ backgroundColor: '#ccfbf1' }}>
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[4%]" style={{ position: 'relative', zIndex: 10 }}>ت</th>
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[25%]" style={{ position: 'relative', zIndex: 10 }}>اسم الطالب</th>
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[8%]" style={{ position: 'relative', zIndex: 10 }}>الرقم<br/>الامتحاني</th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#bbf7d0'}}>S</th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#bbf7d0'}}>R</th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#bbf7d0'}}>L</th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#bbf7d0'}}>Total</th>
                <th className="border-2 border-black p-1" style={{backgroundColor: '#fed7aa'}}>المجموع</th>
                <th rowSpan={2} className="border-2 border-black p-1 align-middle w-[20%]" style={{backgroundColor: '#fef08a', position: 'relative', zIndex: 10 }}>الملاحظات</th>
            </tr>
            <tr style={{ backgroundColor: '#ccfbf1' }}>
                <th className="border-2 border-black p-1 font-normal w-[6%]" style={{backgroundColor: '#bbf7d0'}}>10</th>
                <th className="border-2 border-black p-1 font-normal w-[6%]" style={{backgroundColor: '#bbf7d0'}}>10</th>
                <th className="border-2 border-black p-1 font-normal w-[6%]" style={{backgroundColor: '#bbf7d0'}}>10</th>
                <th className="border-2 border-black p-1 font-normal w-[6%]" style={{backgroundColor: '#bbf7d0'}}>30</th>
                <th className="border-2 border-black p-1 font-normal w-[15%]" style={{backgroundColor: '#fed7aa'}}>كتابة</th>
            </tr>
        </thead>
    );

    const renderTable = () => {
        switch (templateType) {
            case 'french':
                return renderFrenchTemplate();
            case 'computer':
                return renderComputerTemplate();
            case 'islamic':
                return renderIslamicTemplate();
            case 'english':
                return (
                    <table className="w-full border-collapse border-2 border-black text-sm">
                        {renderEnglishTemplateHeaders()}
                        <tbody>
                            {displayRows.map((student, index) => (
                                <tr key={student ? student.id : `empty-${index}`} className="h-9" style={{backgroundColor: index % 2 === 0 ? '#fefce8' : '#eff6ff'}}>
                                    <td className="border-2 border-black text-center w-[4%]"><div style={cellContentStyle}>{index + 1}</div></td>
                                    <td className="border-2 border-black px-2 text-right font-semibold w-[25%]"><div style={cellContentStyle}>{student?.name}</div></td>
                                    <td className="border-2 border-black px-2 text-center w-[8%]"><div style={cellContentStyle}>{student?.examId}</div></td>
                                    <td className="border-2 border-black w-[6%]"></td> {/* S */}
                                    <td className="border-2 border-black w-[6%]"></td> {/* R */}
                                    <td className="border-2 border-black w-[6%]"></td> {/* L */}
                                    <td className="border-2 border-black w-[6%]"></td> {/* Total */}
                                    <td className="border-2 border-black w-[15%]"></td> {/* Total in words */}
                                    <td className="border-2 border-black w-[20%]"></td> {/* Notes */}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );
            case 'arabic':
                const useFirstArabicTemplate = classData.stage === 'الاول متوسط' || classData.stage === 'الثاني متوسط';
                return (
                    <table className="w-full border-collapse border-2 border-black text-sm">
                        {useFirstArabicTemplate ? renderArabicFirstTemplateHeaders() : renderArabicSecondTemplateHeaders()}
                        <tbody>
                            {displayRows.map((student, index) => (
                                <tr key={student ? student.id : `empty-${index}`} className="h-9" style={{backgroundColor: index % 2 === 0 ? '#fefce8' : '#eff6ff'}}>
                                    <td className="border-2 border-black text-center w-[4%]"><div style={cellContentStyle}>{index + 1}</div></td>
                                    <td className="border-2 border-black px-2 text-right font-semibold w-[25%]"><div style={cellContentStyle}>{student?.name}</div></td>
                                    <td className="border-2 border-black px-2 text-center w-[6%]"><div style={cellContentStyle}>{student?.examId}</div></td>
                                    <td className={`border-2 border-black ${useFirstArabicTemplate ? 'w-[5%]' : 'w-[6%]'}`}></td>
                                    <td className={`border-2 border-black ${useFirstArabicTemplate ? 'w-[5%]' : 'w-[6%]'}`}></td>
                                    <td className={`border-2 border-black ${useFirstArabicTemplate ? 'w-[5%]' : 'w-[6%]'}`}></td>
                                    {useFirstArabicTemplate && <td className="border-2 border-black w-[5%]"></td>}
                                    <td className={`border-2 border-black ${useFirstArabicTemplate ? 'w-[5%]' : 'w-[6%]'}`}></td>
                                    <td className="border-2 border-black w-[15%]"></td>
                                    <td className={`border-2 border-black ${useFirstArabicTemplate ? 'w-[25%]' : 'w-[20%]'}`}></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );
            default:
                return <p>No specific template available for this subject.</p>;
        }
    };
    
    // The main container for the page content, which could be one of the templates
    const MainContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <div className="w-[794px] h-[1123px] p-6 bg-white flex flex-col font-['Cairo'] border-2 border-black" dir="rtl">
            {children}
        </div>
    );

    if (templateType === 'computer' || templateType === 'french') {
        return renderTable();
    }

    return (
        <MainContainer>
            <header className="flex justify-between items-center mb-4 text-sm font-bold">
                 <div className="flex-shrink-0">
                    <div className="w-16 h-16 mx-auto border-2 border-black rounded-full flex items-center justify-center">
                        {logos.ministry ? <img src={logos.ministry} alt="شعار الوزارة" className="h-full w-full object-contain p-1 rounded-full" /> : <span className="text-xs">شعار الوزارة</span>}
                    </div>
                </div>

                <div className="text-center space-y-1">
                    <p className="whitespace-nowrap">إدارة</p>
                    <p className="whitespace-nowrap">{settings.schoolName}</p>
                </div>

                <div className="text-center">
                    <h1 className="text-xl font-bold whitespace-nowrap text-red-600">قوائم الامتحان الشفهي</h1>
                    <h2 className="text-base font-semibold whitespace-nowrap">للعام الدراسي {settings.academicYear}</h2>
                    <h3 className="text-base font-semibold whitespace-nowrap">{examType} - الدور {examRound}</h3>
                </div>
                
                <div className="text-right space-y-1">
                    <p className="whitespace-nowrap">المادة: {subjectName}</p>
                    <p className="whitespace-nowrap">الصف: {classData.stage}</p>
                    <p className="whitespace-nowrap">الشعبة: {classData.section}</p>
                </div>

                <div className="flex-shrink-0">
                    <div className="w-16 h-16 mx-auto border-2 border-black rounded-full flex items-center justify-center">
                        {logos.school ? <img src={logos.school} alt="شعار المدرسة" className="h-full w-full object-contain p-1 rounded-full" /> : <span className="text-xs">شعار المدرسة</span>}
                    </div>
                </div>
            </header>

            <main className="flex-grow">
                {renderTable()}
            </main>

            <footer className="mt-auto pt-8 flex justify-between font-bold text-base">
                <span>مدرس المادة</span>
                <span>عضو</span>
                <span>عضو</span>
                <span>مدير المدرسة</span>
            </footer>
        </MainContainer>
    );
}