import React, { useState, useEffect, useMemo } from 'react';
import type { User, StudentEvaluation, StudentNotification, Conversation, ScheduleData, PublishedMonthlyResult, BehaviorDeduction, XOChallenge, ClassData, Student, Homework, HomeworkSubmission, HomeworkProgress } from '../../types';
import { LogOut, Home, Bell, Shield, BookOpen, Calendar, ClipboardCheck, ShieldBan, Gamepad2, Swords, ChevronsLeft, ChevronsRight, Award, Trophy, ListChecks } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import StudentDashboard from './StudentDashboard';
import StudentNotificationsModal from './StudentNotificationsModal';
import AdministrativeMessages from './AdministrativeMessages';
import TeacherMessages from './TeacherMessages';
import StudentScheduleView from './StudentScheduleView';
import StudentMonthlyResults from './StudentMonthlyResults';
import StudentBehaviorView from './StudentBehaviorView';
import XoLeaderboard from './XoLeaderboard';
import XoChallenges from './XoChallenges';
import HonorBoardView from '../shared/HonorBoardView';
import MyHomework from './MyHomework';
import HallOfFame from '../shared/HallOfFame';
import MyProgress from './MyProgress';
import HomeworkSubmissionView from './HomeworkSubmissionView';


interface StudentAppProps {
    currentUser: User;
    onLogout: () => void;
}

type StudentView = 'dashboard' | 'admin_messages' | 'teacher_messages' | 'schedule' | 'monthly_results' | 'behavior_log' | 'xo_game' | 'challenges' | 'honor_board' | 'my_homework' | 'my_progress' | 'hall_of_fame' | 'homework_submission';

export default function StudentApp({ currentUser, onLogout }: StudentAppProps) {
    const [view, setView] = useState<StudentView>('my_homework');
    const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([]);
    const [notifications, setNotifications] = useState<StudentNotification[]>([]);
    const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [studentSchedule, setStudentSchedule] = useState<ScheduleData | null>(null);
    const [monthlyResults, setMonthlyResults] = useState<Record<string, PublishedMonthlyResult> | null>(null);
    const [behaviorDeductions, setBehaviorDeductions] = useState<BehaviorDeduction[]>([]);
    const [challenges, setChallenges] = useState<XOChallenge[]>([]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [allClasses, setAllClasses] = useState<ClassData[]>([]);
    const [gameToJoin, setGameToJoin] = useState<{ gameId: string; grade: string; subject: string } | null>(null);
    const [studentData, setStudentData] = useState<Student | null>(null);
    const [activeHomeworks, setActiveHomeworks] = useState<Homework[]>([]);
    const [homeworkSubmissions, setHomeworkSubmissions] = useState<Record<string, HomeworkSubmission>>({});
    const [homeworkProgress, setHomeworkProgress] = useState<HomeworkProgress | null>(null);
    const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);


    useEffect(() => {
        if (!currentUser.principalId || !currentUser.id) return;

        const principalId = currentUser.principalId;

        // ... (existing useEffect fetches)

        const evalRef = db.ref(`evaluations/${principalId}/${currentUser.id}`);
        const evalCallback = (s: any) => setEvaluations(s.val() ? Object.values(s.val()) : []);
        evalRef.on('value', evalCallback);

        const notifRef = db.ref(`student_notifications/${principalId}/${currentUser.id}`);
        const notifCallback = (s: any) => {
            const data = s.val();
            const notifs = data ? Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value })) : [];
            setNotifications(notifs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        };
        notifRef.on('value', notifCallback);

        const conversationsRef = db.ref(`conversations/${principalId}`);
        const conversationsCallback = (snapshot: any) => {
            const data = snapshot.val();
            const conversations: Conversation[] = data ? Object.values(data) : [];
            const unread = conversations.filter(c => c.studentId === currentUser.id && c.unreadByStudent).length;
            setUnreadMessagesCount(unread);
        };
        conversationsRef.on('value', conversationsCallback);

        const scheduleRef = db.ref(`student_schedules/${principalId}`);
        const scheduleCallback = (snapshot: any) => setStudentSchedule(snapshot.val());
        scheduleRef.on('value', scheduleCallback);

        const monthlyResultsRef = db.ref(`published_monthly_results/${principalId}/${currentUser.id}`);
        const monthlyResultsCallback = (snapshot: any) => setMonthlyResults(snapshot.val());
        monthlyResultsRef.on('value', monthlyResultsCallback);

        const behaviorRef = db.ref(`behavior_deductions/${principalId}/${currentUser.id}`);
        const behaviorCallback = (snapshot: any) => {
            const data = snapshot.val();
            const deductions: BehaviorDeduction[] = data ? Object.values(data) as BehaviorDeduction[] : [];
            setBehaviorDeductions(deductions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        };
        behaviorRef.on('value', behaviorCallback);
        
        const classesRef = db.ref('classes');
        const classesCallback = (s: any) => {
            const data = s.val();
            const allClassesList: ClassData[] = data ? Object.values(data) as ClassData[] : [];
            const principalClasses = allClassesList.filter((c: ClassData) => c.principalId === principalId);
            setAllClasses(principalClasses);

            if (currentUser.classId) {
                const studentClass = principalClasses.find(c => c.id === currentUser.classId);
                if (studentClass && studentClass.students) {
                    const student = studentClass.students.find(s => s.id === currentUser.id);
                    if (student) setStudentData(student);
                }
            }
        };
        classesRef.on('value', classesCallback);

        const challengesRef = db.ref(`xo_challenges/${currentUser.id}`);
        const challengesCallback = (snapshot: any) => {
            const data = snapshot.val() || {};
            const challengeList = Object.values(data).filter((c: any) => c.status === 'pending') as XOChallenge[];
            setChallenges(challengeList);
        };
        challengesRef.on('value', challengesCallback);

        // Homework Listeners
        if (currentUser.classId) {
            const homeworkRef = db.ref(`homework_data/${principalId}`);
            const submissionsRef = db.ref(`homework_submissions/${principalId}/${currentUser.id}`);
            const progressRef = db.ref(`homework_progress/${principalId}/${currentUser.id}`);
        
            // This logic is complex because we only want *active* homeworks
            const activeHomeworkRef = db.ref(`active_homework/${principalId}/${currentUser.classId}`);
        
            const activeHomeworkCallback = (snapshot: any) => {
                const activeHomeworksMap = snapshot.val() || {}; // { subjectId: { homeworkId: "..." } }
                const activeIds = Object.values(activeHomeworksMap).map((item: any) => item.homeworkId);
                
                if (activeIds.length > 0) {
                    homeworkRef.get().then(allHomeworksSnap => {
                        const allHomeworks = allHomeworksSnap.val() || {};
                        const studentHomeworks = activeIds
                            .map(hwId => allHomeworks[hwId as string])
                            .filter(hw => hw) as Homework[];
                        setActiveHomeworks(studentHomeworks);
                    });
                } else {
                    setActiveHomeworks([]);
                }
            };
        
            const submissionsCallback = (snapshot: any) => {
                setHomeworkSubmissions(snapshot.val() || {});
            };
            
            const progressCallback = (snapshot: any) => {
                setHomeworkProgress(snapshot.val());
            };
        
            activeHomeworkRef.on('value', activeHomeworkCallback);
            submissionsRef.on('value', submissionsCallback);
            progressRef.on('value', progressCallback);
        
            return () => {
                evalRef.off('value', evalCallback);
                notifRef.off('value', notifCallback);
                conversationsRef.off('value', conversationsCallback);
                scheduleRef.off('value', scheduleCallback);
                monthlyResultsRef.off('value', monthlyResultsCallback);
                behaviorRef.off('value', behaviorCallback);
                classesRef.off('value', classesCallback);
                challengesRef.off('value', challengesCallback);
                activeHomeworkRef.off('value', activeHomeworkCallback);
                submissionsRef.off('value', submissionsCallback);
                progressRef.off('value', progressCallback);
            };
        }

        return () => {
            evalRef.off('value', evalCallback);
            notifRef.off('value', notifCallback);
            conversationsRef.off('value', conversationsCallback);
            scheduleRef.off('value', scheduleCallback);
            monthlyResultsRef.off('value', monthlyResultsCallback);
            behaviorRef.off('value', behaviorCallback);
            challengesRef.off('value', challengesCallback);
            classesRef.off('value', classesCallback);
        };
    }, [currentUser.principalId, currentUser.id, currentUser.classId]);
    
    const handlePhotoUpdate = async (photoBlob: Blob) => {
        if (!studentData || !currentUser.principalId || !currentUser.classId) {
             throw new Error("Student data not available for photo update.");
        }

        const photoId = studentData.id;
        const photoRef = storage.ref(`student_photos/${currentUser.principalId}/${photoId}.jpg`);
        await photoRef.put(photoBlob);
        const photoURL = await photoRef.getDownloadURL();

        const studentClass = allClasses.find(c => c.id === currentUser.classId);
        if (!studentClass || !studentClass.students) {
            throw new Error("Class data not found for photo update.");
        }

        const studentIndex = studentClass.students.findIndex(s => s.id === currentUser.id);
        if (studentIndex === -1) {
            throw new Error("Student index not found for photo update.");
        }

        const path = `classes/${currentUser.classId}/students/${studentIndex}/photoUrl`;
        await db.ref(path).set(photoURL);

        // Also update the local state for immediate feedback
        setStudentData(prev => prev ? { ...prev, photoUrl: photoURL } : null);
    };


    const unreadAdminNotifications = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);
    const unreadChallengesCount = useMemo(() => challenges.filter(c => c.status === 'pending').length, [challenges]);
    const totalUnread = unreadAdminNotifications + unreadMessagesCount + unreadChallengesCount;
    
    const handleOpenNotifications = () => {
        setIsNotificationsModalOpen(true);
        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        if (unreadIds.length > 0) {
            const updates: Record<string, any> = {};
            unreadIds.forEach(id => {
                updates[`/${id}/isRead`] = true;
            });
            db.ref(`student_notifications/${currentUser.principalId}/${currentUser.id}`).update(updates);
        }
    };

    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <StudentDashboard evaluations={evaluations} studentData={studentData} onPhotoUpdate={handlePhotoUpdate} />;
            case 'admin_messages':
                return <AdministrativeMessages currentUser={currentUser} />;
            case 'teacher_messages':
                return <TeacherMessages currentUser={currentUser} />;
            case 'schedule':
                return <StudentScheduleView currentUser={currentUser} scheduleData={studentSchedule} />;
            case 'monthly_results':
                return <StudentMonthlyResults currentUser={currentUser} resultsData={monthlyResults} />;
            case 'behavior_log':
                return <StudentBehaviorView currentUser={currentUser} deductions={behaviorDeductions} />;
            case 'my_homework':
                return <MyHomework 
                            currentUser={currentUser} 
                            activeHomeworks={activeHomeworks}
                            submissions={homeworkSubmissions}
                            onViewHomework={(homework) => { setSelectedHomework(homework); setView('homework_submission'); }}
                            onViewProgress={() => setView('my_progress')}
                       />;
            case 'my_progress':
                return <MyProgress 
                            currentUser={currentUser}
                            progress={homeworkProgress}
                            allClasses={allClasses}
                            onBack={() => setView('my_homework')}
                        />;
            case 'homework_submission':
                if (selectedHomework) {
                    return <HomeworkSubmissionView
                        currentUser={currentUser}
                        homework={selectedHomework}
                        submission={homeworkSubmissions[selectedHomework.id]}
                        onBack={() => { setView('my_homework'); setSelectedHomework(null); }}
                    />
                }
                return null;
            case 'hall_of_fame':
                return <HallOfFame currentUser={currentUser} classes={allClasses} />;
            case 'xo_game':
                return <XoLeaderboard 
                            currentUser={currentUser} 
                            gameToJoin={gameToJoin}
                            onGameJoined={() => setGameToJoin(null)}
                       />;
            case 'challenges':
                return <XoChallenges 
                            currentUser={currentUser} 
                            challenges={challenges} 
                            onGameStart={(gameId, grade, subject) => {
                                setGameToJoin({ gameId, grade, subject });
                                setView('xo_game');
                            }}
                        />;
            case 'honor_board':
                return <HonorBoardView currentUser={currentUser} classes={allClasses} />;
            default:
                return <StudentDashboard evaluations={evaluations} studentData={studentData} onPhotoUpdate={handlePhotoUpdate} />;
        }
    }

    return (
        <div className="flex h-full bg-gray-200" dir="rtl">
            <StudentNotificationsModal
                isOpen={isNotificationsModalOpen}
                onClose={() => setIsNotificationsModalOpen(false)}
                notifications={notifications}
            />

            <div className={`bg-gray-800 text-white flex flex-col transition-all duration-300 relative ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
                <div className="flex items-center justify-center p-4 border-b border-gray-700 h-16 flex-shrink-0">
                    {!isSidebarCollapsed && <span className="font-bold text-xl">بوابة الطالب</span>}
                </div>
                <div className="flex-1 flex flex-col overflow-y-auto">
                    <nav className="px-2 py-4 space-y-2">
                        <button onClick={() => setView('dashboard')} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors ${view === 'dashboard' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'الرئيسية' : ''}>
                            <Home size={20} />{!isSidebarCollapsed && <span>الرئيسية</span>}
                        </button>
                        <button onClick={() => setView('my_homework')} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors ${['my_homework', 'my_progress', 'homework_submission'].includes(view) ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'واجباتي' : ''}>
                            <ListChecks size={20} />{!isSidebarCollapsed && <span>واجباتي</span>}
                        </button>
                        <button onClick={() => setView('hall_of_fame')} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors ${view === 'hall_of_fame' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'لوحة الأبطال' : ''}>
                            <Trophy size={20} />{!isSidebarCollapsed && <span>لوحة الأبطال</span>}
                        </button>
                         <button onClick={() => setView('schedule')} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors ${view === 'schedule' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'جدولي الدراسي' : ''}>
                            <Calendar size={20} />{!isSidebarCollapsed && <span>جدولي الدراسي</span>}
                        </button>
                        <button onClick={() => setView('monthly_results')} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors ${view === 'monthly_results' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'نتائجي الشهرية' : ''}>
                            <ClipboardCheck size={20} />{!isSidebarCollapsed && <span>نتائجي الشهرية</span>}
                        </button>
                         <button onClick={() => setView('behavior_log')} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors ${view === 'behavior_log' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'سلوكي' : ''}>
                            <ShieldBan size={20} />{!isSidebarCollapsed && <span>سلوكي</span>}
                        </button>
                        <button onClick={() => setView('honor_board')} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors ${view === 'honor_board' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'لوحة الشرف' : ''}>
                            <Award size={20} />{!isSidebarCollapsed && <span>لوحة الشرف</span>}
                        </button>
                        <button onClick={() => setView('admin_messages')} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors ${view === 'admin_messages' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'الرسائل الإدارية' : ''}>
                            <Shield size={20} />{!isSidebarCollapsed && <span>الرسائل الإدارية</span>}
                        </button>
                        <button onClick={() => setView('teacher_messages')} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors ${view === 'teacher_messages' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'الواجبات والتبليغات' : ''}>
                            <BookOpen size={20} />{!isSidebarCollapsed && <span>الواجبات والتبليغات</span>}
                        </button>
                         <div className="pt-2 mt-2 border-t border-gray-700">
                             <h3 className={`px-4 text-xs font-semibold uppercase text-gray-400 mb-1 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>المسابقات والالعاب التعليمية</h3>
                             <button onClick={() => setView('xo_game')} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors ${view === 'xo_game' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'لعبة XO التعليمية' : ''}>
                                 <Gamepad2 size={20} />{!isSidebarCollapsed && <span>لعبة XO التعليمية</span>}
                             </button>
                             <button onClick={() => setView('challenges')} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors relative ${view === 'challenges' ? 'bg-cyan-600 text-white' : 'hover:bg-gray-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? "التحديات" : ""}>
                                <Swords size={20} />
                                {!isSidebarCollapsed && <span>التحديات</span>}
                                {!isSidebarCollapsed && unreadChallengesCount > 0 && (
                                    <span className="ml-auto bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                                        {unreadChallengesCount}
                                    </span>
                                )}
                            </button>
                         </div>
                    </nav>
                    <div className="mt-auto"></div>
                    <div className="p-4 border-t border-gray-700">
                        <button onClick={onLogout} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg hover:bg-red-700 bg-red-600/80 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? "تسجيل الخروج" : ""}>
                            <LogOut size={20} />
                            {!isSidebarCollapsed && <span>تسجيل الخروج</span>}
                        </button>
                    </div>
                </div>
                <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="absolute top-16 -left-5 transform bg-green-600 text-white p-2 rounded-full z-10 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-white shadow-lg">
                    {isSidebarCollapsed ? <ChevronsLeft size={24} /> : <ChevronsRight size={24} />}
                </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white shadow-sm p-4 h-16 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">مرحباً، {currentUser.name}</h1>
                        <p className="text-sm text-gray-500">مرحلة: {currentUser.stage}</p>
                    </div>
                    <button onClick={handleOpenNotifications} className="relative text-gray-600 hover:text-cyan-600">
                        <Bell size={24} />
                        {totalUnread > 0 && (
                            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                                {totalUnread > 99 ? '99+' : totalUnread}
                            </span>
                        )}
                    </button>
                </header>
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-200 p-4 sm:p-6 lg:p-8">
                    {renderView()}
                </main>
            </div>
        </div>
    );
}