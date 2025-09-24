
import React from 'react';
import { Brush } from 'lucide-react';

export default function CoverEditor() {
    return (
        <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-red-100 p-8 rounded-2xl shadow-2xl max-w-4xl mx-auto text-center border-t-4 border-pink-400">
            <h2 className="text-4xl font-extrabold text-gray-800 mb-6">
                محرر صور المستندات المدرسية
            </h2>
            <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto leading-relaxed">
                أداة تعليمية مبتكرة تسهّل على المعلمين والإداريين تصميم أغلفة احترافية لسجلاتهم التعليمية مثل سجل الدرجات، الخطط، الملازم والسجلات الإدارية. اختر من تصاميم جاهزة، وخصصها بسهولة عبر تعديل النصوص والمعلومات كاسم المعلم، الصف، المادة والتاريخ، ضع صورتك الشخصية في الغلاف او شعار مدرستك بثواني معدوده. دون الحاجة لأي خبرة في التصميم.
            </p>

            <div className="my-10 p-4 bg-white/50 rounded-lg shadow-inner">
                 <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                    🎓 ابدأ الآن واصنع مستنداتك بأسلوب يليق برسالتك التعليمية!
                </p>
            </div>

            <a 
                href="https://service-314929620446.us-west1.run.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-12 py-5 bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold text-2xl rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 ease-in-out"
            >
                <div className="flex items-center justify-center gap-3">
                    <Brush className="animate-pulse" />
                    <span>ابدأ تصميم الغلاف</span>
                </div>
            </a>
        </div>
    );
}
