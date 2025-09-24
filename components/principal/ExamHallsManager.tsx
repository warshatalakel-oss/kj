
import React from 'react';
import { Sparkles } from 'lucide-react';

export default function ExamHallsManager() {
    return (
        <div className="bg-gradient-to-br from-gray-50 to-blue-100 p-8 rounded-2xl shadow-2xl max-w-4xl mx-auto text-center border-t-4 border-cyan-400">
            <h2 className="text-4xl font-extrabold text-gray-800 mb-6">
                إعداد القاعات الامتحانية
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                اصبح الان بأمكانك عمل قاعات امتحانية بسرعة ودقة عالية . مع امكانية تلوينها واضافة خلفيات ملونة بما يناسب ذوقك.
            </p>

            <div className="flex justify-center items-center gap-6 mb-12 flex-wrap">
                <span className="font-bold text-2xl text-blue-500 bg-blue-100 px-4 py-2 rounded-lg shadow-md">سهل</span>
                <span className="font-bold text-2xl text-green-500 bg-green-100 px-4 py-2 rounded-lg shadow-md">دقيق</span>
                <span className="font-bold text-2xl text-red-500 bg-red-100 px-4 py-2 rounded-lg shadow-md">سريع</span>
                <span className="font-bold text-2xl text-purple-500 bg-purple-100 px-4 py-2 rounded-lg shadow-md">انيق</span>
            </div>

            <a 
                href="https://hussien1977.github.io/qait/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-12 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-2xl rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 ease-in-out"
            >
                <div className="flex items-center justify-center gap-3">
                    <Sparkles className="animate-pulse" />
                    <span>انقر لتكوين قاعاتك الأمتحانية</span>
                </div>
            </a>
        </div>
    );
}
