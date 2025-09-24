import React from 'react';
import type { Student } from '../../types';

interface StudentCodesPDFProps {
    students: Student[];
    schoolName: string;
    className: string;
}

export default function StudentCodesPDF({ students, schoolName, className }: StudentCodesPDFProps) {
    
    return (
        <div className="w-[794px] h-[1123px] p-8 bg-white font-['Cairo']" dir="rtl">
            <header className="text-center mb-8">
                <h1 className="text-3xl font-bold">{schoolName}</h1>
                <h2 className="text-xl font-semibold mt-2">رموز الدخول لمنصة الطالب</h2>
                <h3 className="text-lg text-gray-700 mt-1">{className}</h3>
            </header>

            <main>
                <table className="w-full border-collapse border border-black text-lg">
                    <thead className="bg-gray-200">
                        <tr>
                            <th className="border border-black p-2 font-bold w-16">ت</th>
                            <th className="border border-black p-2 font-bold text-right">اسم الطالب</th>
                            <th className="border border-black p-2 font-bold text-center">الرمز السري</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student, index) => (
                             <tr key={student.id} className="h-[44px] odd:bg-white even:bg-gray-100">
                                <td className="border border-black p-2 text-center">{index + 1}</td>
                                <td className="border border-black p-2">{student.name}</td>
                                <td className="border border-black p-2 text-center font-mono text-cyan-700 font-bold">{student.studentAccessCode}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>
        </div>
    );
}