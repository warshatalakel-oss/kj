import React from 'react';
import type { User, SchoolSettings, PublishedMonthlyResult } from '../../types';

interface StudentMonthlyResultCardProps {
    student: User;
    settings: SchoolSettings;
    resultData: PublishedMonthlyResult;
}

const LiftedText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ position: 'relative', bottom: '8px' }}>
        {children}
    </div>
);

export default function StudentMonthlyResultCard({ student, settings, resultData }: StudentMonthlyResultCardProps) {
    const cardStyle: React.CSSProperties = {
        width: '794px',
        height: '1123px',
        padding: '48px',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Cairo', sans-serif",
        direction: 'rtl',
        border: '10px double #0891b2'
    };
    
    return (
        <div style={cardStyle}>
            <header className="flex-grow-0">
                <div className="flex justify-between items-center text-xl font-bold mb-8">
                    <div className="text-right">
                        <p><LiftedText>إدارة</LiftedText></p>
                        <p><LiftedText>{settings.schoolName}</LiftedText></p>
                    </div>
                    <div className="text-center">
                        <h1 className="text-3xl font-extrabold text-cyan-700">
                             <LiftedText>نتائج الامتحان الشهري</LiftedText>
                        </h1>
                        <h2 className="text-2xl font-bold mt-2">
                             <LiftedText>
                                <span className="text-gray-600">الشهر: </span>
                                <span>{resultData.monthLabel}</span>
                            </LiftedText>
                        </h2>
                    </div>
                    <div className="text-right">
                        <p><LiftedText>الاسم: {student.name}</LiftedText></p>
                        <p><LiftedText>الصف: {student.stage}</LiftedText></p>
                        <p><LiftedText>الشعبة: {student.section}</LiftedText></p>
                    </div>
                </div>
            </header>

            <main className="flex-grow my-8">
                <table className="w-full border-collapse border-2 border-black">
                    <thead>
                        <tr className="bg-cyan-600 text-white text-2xl font-bold">
                            <th className="border-2 border-black p-3 w-1/2"><LiftedText>المادة</LiftedText></th>
                            <th className="border-2 border-black p-3 w-1/2"><LiftedText>الدرجة</LiftedText></th>
                        </tr>
                    </thead>
                    <tbody>
                        {resultData.grades.map((item, index) => {
                            const grade = item.grade;
                            const gradeText = (grade !== null && grade !== undefined) ? grade : '-';
                             const isFailing = grade !== null && grade !== undefined && grade < 50;
                            const rowColor = index % 2 === 0 ? 'bg-cyan-50' : 'bg-white';

                            return (
                                <tr key={item.subjectName} className={`text-xl font-semibold ${rowColor}`}>
                                    <td className="border-2 border-black p-3 text-right"><LiftedText>{item.subjectName}</LiftedText></td>
                                    <td className={`border-2 border-black p-3 text-center ${isFailing ? 'text-red-600 font-extrabold' : ''}`}>
                                        <LiftedText>{gradeText}</LiftedText>
                                    </td>
                                </tr>
                            );
                        })}
                        {Array.from({ length: Math.max(0, 12 - resultData.grades.length) }).map((_, index) => (
                            <tr key={`empty-${index}`} className={`h-14 ${(resultData.grades.length + index) % 2 === 0 ? 'bg-cyan-50' : 'bg-white'}`}>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>

            <footer className="flex-grow-0 flex justify-end items-end text-lg font-bold">
                 <div className="text-center">
                    <p><LiftedText>{settings.principalName}</LiftedText></p>
                    <p><LiftedText>مدير المدرسة</LiftedText></p>
                </div>
            </footer>
        </div>
    );
}