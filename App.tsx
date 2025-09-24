
import React from 'react';
import useAuth from './hooks/useAuth';
import Login from './components/auth/Login';
import MainApp from './components/MainApp';
import StudentApp from './components/student/StudentApp';
import CounselorApp from './components/counselor/CounselorApp';
import StudentSubmissionForm from './components/student/StudentSubmissionForm';
import { LogIn, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

export default function App(): React.ReactNode {
    const { currentUser, users, login, logout, addUser, updateUser, deleteUser, isAuthReady, authError } = useAuth();

    if (!isAuthReady) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-gray-700">
                <Loader2 className="h-12 w-12 animate-spin mb-4" />
                <p className="text-lg font-semibold">جاري تهيئة الاتصال الآمن...</p>
            </div>
        );
    }
    
    if (authError) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-gray-700 p-4 text-center">
                <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-red-600 mb-2">خطأ حرج في الاتصال</h1>
                <p className="text-lg max-w-md">{authError}</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-8 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-cyan-700 transition-transform transform hover:scale-105"
                >
                    <RefreshCw size={18} />
                    إعادة المحاولة
                </button>
            </div>
        );
    }

    if (!currentUser) {
        return <Login onLogin={login} />;
    }

    switch (currentUser.role) {
        case 'principal':
        case 'teacher':
            return <MainApp currentUser={currentUser} users={users} addUser={addUser} updateUser={updateUser} deleteUser={deleteUser} onLogout={logout} />;
        case 'student':
            return <StudentApp currentUser={currentUser} onLogout={logout} />;
        case 'counselor':
            return <CounselorApp currentUser={currentUser} onLogout={logout} users={users} />;
        default:
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
                    <p className="text-red-500 mb-4">دور المستخدم غير معروف.</p>
                    <button onClick={logout} className="px-4 py-2 bg-red-600 text-white rounded-md flex items-center gap-2">
                        <LogIn size={18} />
                        تسجيل الخروج
                    </button>
                </div>
            )
    }
}
