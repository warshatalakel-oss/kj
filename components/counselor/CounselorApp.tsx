import React, { useState, useMemo, useEffect } from 'react';
import { Home, LogOut, ChevronsRight, ChevronsLeft, MessageSquare, Award } from 'lucide-react';
import type { SchoolSettings, ClassData, User as CurrentUser, StudentSubmission, ParentContact } from '../../types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../constants';
import { db } from '../../lib/firebase';
import CounselorParentCommunication from './CounselorParentCommunication';
import BehavioralHonorsManager from './BehavioralHonorsManager';
import HonorBoardView from '../shared/HonorBoardView';

interface NavItem {
    view: 'home' | 'parent_communication' | 'honors_manager' | 'honor_board_view';
    icon: React.ElementType;
    label: string;
}

interface NavButtonProps {
    item: NavItem;
    isCollapsed: boolean;
    onClick: () => void;
    isActive: boolean;
}

const NavButton: React.FC<NavButtonProps> = ({ item, isCollapsed, onClick, isActive }) => (
    <button 
        onClick={onClick}
        className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-cyan-600 text-white shadow-inner' : 'hover:bg-gray-700'} ${isCollapsed ? 'justify-center' : ''}`}
        title={isCollapsed ? item.label : ''}
    >
        <item.icon size={20} />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
    </button>
);

interface CounselorAppProps {
    currentUser: CurrentUser;
    onLogout: () => void;
    users: CurrentUser[];
}

export default function CounselorApp({ currentUser, onLogout, users }: CounselorAppProps) {
    const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [activeView, setActiveView] = useState<NavItem['view']>('home');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
    const [parentContacts, setParentContacts] = useState<ParentContact[]>([]);

    const principalId = currentUser.principalId;

    useEffect(() => {
        if (!principalId) return;

        const settingsRef = db.ref(`settings/${principalId}`);
        const classesRef = db.ref('classes');
        const submissionsRef = db.ref(`student_submissions/${principalId}`);
        const contactsRef = db.ref(`parent_contacts/${principalId}`);

        const settingsCallback = (snapshot: any) => setSettings(snapshot.val() || DEFAULT_SCHOOL_SETTINGS);
        const classesCallback = (snapshot: any) => {
            const data = snapshot.val();
            const allClassesList: ClassData[] = data ? Object.values(data) as ClassData[] : [];
            setClasses(allClassesList.filter((c: ClassData) => c.principalId === principalId));
        };
        const submissionsCallback = (snapshot: any) => {
            const data = snapshot.val();
            setSubmissions(data ? Object.values(data) : []);
        };
        const contactsCallback = (snapshot: any) => {
             const data = snapshot.val();
             setParentContacts(data ? Object.values(data) : []);
        };

        settingsRef.on('value', settingsCallback);
        classesRef.on('value', classesCallback);
        submissionsRef.on('value', submissionsCallback);
        contactsRef.on('value', contactsCallback);

        return () => {
            settingsRef.off('value', settingsCallback);
            classesRef.off('value', classesCallback);
            submissionsRef.off('value', submissionsCallback);
            contactsRef.off('value', contactsCallback);
        };
    }, [principalId]);

    const counselorNavItems: NavItem[] = [
        { view: 'home', icon: Home, label: 'الرئيسية' },
        { view: 'parent_communication', icon: MessageSquare, label: 'مخاطبة ولي الامر' },
        { view: 'honors_manager', icon: Award, label: 'ادارة لوحة الشرف' },
        { view: 'honor_board_view', icon: Award, label: 'عرض لوحة الشرف' },
    ];

    const renderView = () => {
        switch (activeView) {
            case 'parent_communication':
                return <CounselorParentCommunication principalId={principalId!} settings={settings} submissions={submissions} contacts={parentContacts} />;
            case 'honors_manager':
                return <BehavioralHonorsManager currentUser={currentUser} classes={classes} users={users} submissions={submissions} />;
            case 'honor_board_view':
                return <HonorBoardView currentUser={currentUser} classes={classes} />;
            case 'home':
            default:
                return (
                     <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                        <h2 className="text-3xl font-bold text-gray-800">مرحباً بك في صفحة الإرشاد التربوي</h2>
                        <p className="mt-4 text-lg text-gray-600">
                            هنا يمكنك إدارة التواصل مع أولياء الأمور وتكريم الطلاب المتميزين سلوكياً. اختر إحدى الأدوات من القائمة الجانبية للبدء.
                        </p>
                    </div>
                );
        }
    };
    
    return (
        <div className="flex h-screen bg-gray-200" dir="rtl">
            <div className={`bg-gray-800 text-white flex flex-col transition-all duration-300 relative ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
                <div className="flex items-center justify-center p-4 border-b border-gray-700 h-16">
                    {!isSidebarCollapsed && <span className="font-bold text-xl whitespace-nowrap">إدارة الإرشاد التربوي</span>}
                </div>

                <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                    {counselorNavItems.map(item => (
                        <NavButton
                            key={item.view}
                            item={item}
                            isCollapsed={isSidebarCollapsed}
                            onClick={() => setActiveView(item.view)}
                            isActive={activeView === item.view}
                        />
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-700">
                    <button onClick={onLogout} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg hover:bg-red-700 bg-red-600/80 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? "تسجيل الخروج" : ''}>
                        <LogOut size={20} />
                        {!isSidebarCollapsed && <span>تسجيل الخروج</span>}
                    </button>
                </div>

                <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="absolute top-16 -left-5 transform bg-green-600 text-white p-2 rounded-full z-10 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-white shadow-lg">
                    {isSidebarCollapsed ? <ChevronsLeft size={24} /> : <ChevronsRight size={24} />}
                </button>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white shadow-sm p-4 h-16 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">{currentUser.name} (مرشد تربوي)</h1>
                        <p className="text-sm text-gray-500">{settings.schoolName}</p>
                    </div>
                </header>
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-200 p-4 sm:p-6 lg:p-8">
                    {renderView()}
                </main>
            </div>
        </div>
    );
}