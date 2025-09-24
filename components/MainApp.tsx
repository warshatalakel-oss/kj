
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SettingsIcon, BookUser, Home, Printer, BarChart, ClipboardList, Archive, User, LogOut, Eye, ChevronsRight, ChevronsLeft, BookCopy, LayoutGrid, ClipboardCheck, Info, Presentation, Brush, CalendarCog, Mail, BookMarked, BookText, FileText, UserPlus, PlayCircle, X, Users, CalendarClock, Bell, Star, MessageSquare, KeyRound, ShieldBan, CalendarPlus, CalendarCheck, Gamepad2, BrainCircuit, Award, ClipboardPaste, Trophy } from 'lucide-react';
import type { SchoolSettings, ClassData, User as CurrentUser, Teacher, AppNotification, Conversation, LeaveRequest } from '../types';
import { DEFAULT_SCHOOL_SETTINGS } from '../constants';
import { db } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';

import Settings from './Settings';
import ClassManager from './ClassManager';
import GradeSheet from './GradeSheet';
import ExportManager from './ExportManager';
import StatisticsManager from './StatisticsManager';
import TeacherLogExporter from './TeacherLogExporter';
import AdminLogExporter from './AdminLogExporter';
import PrincipalDashboard from './principal/PrincipalDashboard';
import ReceiveTeacherLog from './principal/ReceiveTeacherLog';
import TeacherGradeSheet from './teacher/TeacherGradeSheet';
import ElectronicLogbookGenerator from './principal/ElectronicLogbookGenerator';
import GradeBoardExporter from './principal/GradeBoardExporter';
import OralExamListsExporter from './principal/OralExamListsExporter';
import PromotionLog from './principal/PromotionLog';
import AboutModal from './AboutModal';
import ExamHallsManager from './principal/ExamHallsManager';
import CoverEditor from './principal/CoverEditor';
import SmartScheduler from './scheduling/SmartScheduler';
import ParentInvitationExporter from './principal/ParentInvitationExporter';
import ExamCardsExporter from './principal/ExamCardsExporter';
import ExamControlLog from './principal/ExamControlLog';
import AdministrativeCorrespondence from './principal/AdministrativeCorrespondence';
import PrimaryLogExporter from './principal/PrimaryLogExporter';
import StudentRegistrationFormManager from './principal/StudentRegistrationFormManager';
import StudentManagement from './principal/StudentManagement';
import StudentSubscriptions from './principal/StudentSubscriptions';
import MonthlyResultsExporter from './principal/MonthlyResultsExporter';
import AbsenceManager from './principal/AbsenceManager';
import NotificationsModal from './NotificationsModal';
import TeacherEvaluation from './teacher/TeacherEvaluation';
import StudentCommunication from './principal/StudentCommunication';
import TeacherCommunication from './teacher/TeacherCommunication';
import BehaviorManager from './principal/BehaviorManager';
import LeaveRequestForm from './teacher/LeaveRequestForm';
import LeaveRequestManager from './principal/LeaveRequestManager';
import XoGameManager from './teacher/XoGameManager';
import XoGame from './student/XoGame';
import TeacherLinks from './teacher/TeacherLinks';
import HonorBoardView from './shared/HonorBoardView';
import SchoolArchive from './principal/SchoolArchive';
import HomeworkManager from './teacher/HomeworkManager';
import HallOfFame from './shared/HallOfFame';

type View = 'home' | 'settings' | 'class_manager' | 'grade_sheet' | 'export_results' | 'statistics' | 'teacher_log_exporter' | 'admin_log_exporter' | 'principal_dashboard' | 'receive_teacher_logs' | 'electronic_logbook' | 'grade_board' | 'oral_exam_lists' | 'promotion_log' | 'exam_halls' | 'cover_editor' | 'smart_scheduler' | 'parent_invitations' | 'exam_cards' | 'exam_control_log' | 'administrative_correspondence' | 'primary_school_log' | 'student_registration_form' | 'student_management' | 'student_subscriptions' | 'monthly_results' | 'absence_manager' | 'student_evaluation' | 'student_communication' | 'behavior_management' | 'leave_request_form' | 'leave_requests' | 'xo_game_manager' | 'xo_game' | 'teacher_links' | 'honor_board' | 'school_archive' | 'homework_manager' | 'hall_of_fame';

interface NavItem {
    view: View;
    icon: React.ElementType;
    label: string;
    classId?: string;
    badgeCount?: number;
}

interface NavButtonProps {
    item: NavItem;
    isCollapsed: boolean;
    onClick: () => void;
    isActive: boolean;
    disabled?: boolean;
}

interface MainAppProps {
    currentUser: CurrentUser;
    onLogout: () => void;
    users: CurrentUser[];
    addUser: (user: Omit<CurrentUser, 'id'>) => CurrentUser;
    updateUser: (userId: string, updater: (user: CurrentUser) => CurrentUser) => void;
    deleteUser: (userId: string) => void;
}

const NavButton: React.FC<NavButtonProps> = ({ item, isCollapsed, onClick, isActive, disabled }) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg transition-colors relative ${isActive ? 'bg-cyan-600 text-white shadow-inner' : 'hover:bg-gray-700'} ${isCollapsed ? 'justify-center' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isCollapsed ? item.label : ''}
    >
        <item.icon size={20} />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
        {item.badgeCount && item.badgeCount > 0 && !isCollapsed ? (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">{item.badgeCount}</span>
        ) : null}
    </button>
);


export default function MainApp({ currentUser, onLogout, users, addUser, updateUser, deleteUser }: MainAppProps): React.ReactNode {
    const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [activeView, setActiveView] = useState<View>('home');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

    // Notification State
    const [allNotifications, setAllNotifications] = useState<AppNotification[]>([]);
    const [readNotifications, setReadNotifications] = useState<Record<string, boolean>>({});
    const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    
    const isPrincipal = currentUser.role === 'principal';
    const isTeacher = currentUser.role === 'teacher';
    const migrationCheckRan = useRef(false);


    const createDefaultSettingsForPrincipal = (principal: CurrentUser): SchoolSettings => {
        return {
            schoolName: principal.schoolName || '',
            principalName: principal.name,
            academicYear: "2025-2026",
            directorate: '',
            supplementarySubjectsCount: 3,
            decisionPoints: 5,
            principalPhone: '',
            schoolType: 'نهاري',
            schoolGender: 'بنين',
            schoolLevel: currentUser.schoolLevel || 'متوسطة',
            governorateCode: '',
            schoolCode: '',
            governorateName: 'بغداد',
            district: '',
            subdistrict: '',
        };
    };

    useEffect(() => {
        let settingsPath: string | null = null;
        const principalId = isTeacher ? (currentUser as Teacher).principalId : currentUser.id;

        if (isPrincipal || (isTeacher && principalId)) {
            settingsPath = `settings/${principalId}`;
        }

        let settingsRef: any; // firebase.database.Reference
        let settingsCallback: any;

        if (settingsPath) {
            settingsRef = db.ref(settingsPath);
            settingsCallback = (snapshot: any) => { // firebase.database.DataSnapshot
                const data = snapshot.val();
                if (data) {
                    setSettings(data);
                } else if (isPrincipal) {
                    const defaultSettings = createDefaultSettingsForPrincipal(currentUser);
                    setSettings(defaultSettings);
                    settingsRef.set(defaultSettings);
                } else {
                    setSettings(DEFAULT_SCHOOL_SETTINGS);
                }
            };
            settingsRef.on('value', settingsCallback);
        } else {
            setSettings(DEFAULT_SCHOOL_SETTINGS);
        }

        const classesRef = db.ref('classes');
        const classesCallback = (snapshot: any) => { // firebase.database.DataSnapshot
            const data = snapshot.val();
            setClasses(data ? Object.values(data) : []);
        };
        classesRef.on('value', classesCallback);

        // Notification Listeners
        const notificationsRef = db.ref('notifications');
        const userReadRef = db.ref(`user_read_notifications/${currentUser.id}`);

        const notificationsCallback = (snapshot: any) => {
            const data = snapshot.val();
            setAllNotifications(data ? Object.values(data) : []);
        };
        const readCallback = (snapshot: any) => {
            setReadNotifications(snapshot.val() || {});
        };

        notificationsRef.on('value', notificationsCallback);
        userReadRef.on('value', readCallback);
        
        // Chat Unread Listener
        const conversationsRef = db.ref(`conversations/${principalId}`);
        const conversationsCallback = (snapshot: any) => {
            const data = snapshot.val();
            const conversations: Conversation[] = data ? Object.values(data) : [];
            const unread = conversations.filter(c => {
                if (isPrincipal && c.unreadByStaff) return true;
                if (isTeacher && c.teacherId === currentUser.id && c.unreadByStaff) return true;
                return false;
            }).length;
            setUnreadMessagesCount(unread);
        };
        conversationsRef.on('value', conversationsCallback);

        // Leave Request Listener
        const leaveRequestsRef = db.ref(`leave_requests/${principalId}`);
        const leaveRequestsCallback = (snapshot: any) => {
            const data = snapshot.val();
            const requests = data ? Object.values(data) : [];
            setLeaveRequests((requests as LeaveRequest[]).sort((a,b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
        };
        leaveRequestsRef.on('value', leaveRequestsCallback);

        return () => {
            if (settingsRef && settingsCallback) {
                settingsRef.off('value', settingsCallback);
            }
            classesRef.off('value', classesCallback);
            notificationsRef.off('value', notificationsCallback);
            userReadRef.off('value', readCallback);
            conversationsRef.off('value', conversationsCallback);
            leaveRequestsRef.off('value', leaveRequestsCallback);
        };
    }, [currentUser, isPrincipal, isTeacher]);

    useEffect(() => {
        const runMigration = async () => {
            if (!isPrincipal || classes.length === 0 || users.length === 0) return;
    
            const targetStages = ['الاول متوسط', 'الثاني متوسط', 'الثالث متوسط'];
            const classesToMigrate = classes.filter(c => 
                targetStages.includes(c.stage) && !c.subjects_migrated_v1
            );
    
            if (classesToMigrate.length === 0) return;
    
            console.log(`Migrating ${classesToMigrate.length} classes for subject consolidation.`);
            
            const principalTeachers = users.filter(u => u.role === 'teacher' && u.principalId === currentUser.id);
            const updates: Record<string, any> = {};
    
            for (const classData of classesToMigrate) {
                let subjects = [...(classData.subjects || [])];
                let classNeedsUpdate = false;
    
                const oldAr1 = subjects.find(s => s.name === 'اللغة العربية الجزء الاول');
                const oldAr2 = subjects.find(s => s.name === 'اللغة العربية الجزء الثاني');
                const oldEn1 = subjects.find(s => s.name === 'اللغة الإنكليزية كتاب الطالب');
                const oldEn2 = subjects.find(s => s.name === 'اللغة الإنكليزية كتاب النشاط');
                
                let newArabicSub = subjects.find(s => s.name === 'اللغة العربية');
                if (!newArabicSub && (oldAr1 || oldAr2)) {
                    newArabicSub = { id: uuidv4(), name: 'اللغة العربية' };
                    subjects.push(newArabicSub);
                    classNeedsUpdate = true;
                }
    
                let newEnglishSub = subjects.find(s => s.name === 'اللغة الإنكليزية');
                if (!newEnglishSub && (oldEn1 || oldEn2)) {
                    newEnglishSub = { id: uuidv4(), name: 'اللغة الإنكليزية' };
                    subjects.push(newEnglishSub);
                    classNeedsUpdate = true;
                }
    
                if (classNeedsUpdate) {
                    updates[`/classes/${classData.id}/subjects_migrated_v1`] = true;
                    updates[`/classes/${classData.id}/subjects`] = subjects.filter(s => ![
                        'اللغة العربية الجزء الاول', 'اللغة العربية الجزء الثاني',
                        'اللغة الإنكليزية كتاب الطالب', 'اللغة الإنكليزية كتاب النشاط'
                    ].includes(s.name));
    
                    for (const teacher of principalTeachers) {
                        let assignmentsChanged = false;
                        let newAssignments = [...(teacher.assignments || [])];
    
                        const hasOldArabic = newAssignments.some(a => a.classId === classData.id && (a.subjectId === oldAr1?.id || a.subjectId === oldAr2?.id));
                        if (newArabicSub && hasOldArabic) {
                            assignmentsChanged = true;
                            newAssignments = newAssignments.filter(a => !(a.classId === classData.id && (a.subjectId === oldAr1?.id || a.subjectId === oldAr2?.id)));
                            if (!newAssignments.some(a => a.classId === classData.id && a.subjectId === newArabicSub!.id)) {
                                 newAssignments.push({ classId: classData.id, subjectId: newArabicSub.id });
                            }
                        }
    
                        const hasOldEnglish = newAssignments.some(a => a.classId === classData.id && (a.subjectId === oldEn1?.id || a.subjectId === oldEn2?.id));
                        if (newEnglishSub && hasOldEnglish) {
                            assignmentsChanged = true;
                            newAssignments = newAssignments.filter(a => !(a.classId === classData.id && (a.subjectId === oldEn1?.id || a.subjectId === oldEn2?.id)));
                             if (!newAssignments.some(a => a.classId === classData.id && a.subjectId === newEnglishSub!.id)) {
                                 newAssignments.push({ classId: classData.id, subjectId: newEnglishSub.id });
                            }
                        }
    
                        if (assignmentsChanged) {
                            updates[`/users/${teacher.id}/assignments`] = newAssignments;
                        }
                    }
                }
            }
            
            if (Object.keys(updates).length > 0) {
                console.log("Applying migration updates to Firebase...", updates);
                try {
                    await db.ref().update(updates);
                    alert('تم تحديث هيكل المواد الدراسية وتعيينات المدرسين تلقائياً. سيتم تحديث الصفحة.');
                    window.location.reload();
                } catch (e) {
                    console.error("Migration failed:", e);
                    alert('فشل تحديث بيانات المواد الدراسية.');
                }
            }
        };
        
        if (!migrationCheckRan.current && classes.length > 0 && users.length > 0) {
            runMigration();
            migrationCheckRan.current = true;
        }
    }, [classes, users, isPrincipal, currentUser.id]);

    const { userNotifications, unreadCount: unreadAdminNotifications } = useMemo(() => {
        const filtered = allNotifications.filter(n =>
            (isPrincipal && n.recipientScope === 'all_principals') ||
            (isTeacher && n.recipientScope === 'all_teachers')
        );
    
        const notifications = filtered
            .map(n => ({ ...n, isRead: !!readNotifications[n.id] }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
        const count = notifications.filter(n => !n.isRead).length;
    
        return { userNotifications: notifications, unreadCount: count };
    }, [allNotifications, readNotifications, currentUser.role, isPrincipal, isTeacher]);

    const pendingLeaveRequestsCount = useMemo(() => {
        if (!isPrincipal) return 0;
        return leaveRequests.filter(req => req.status === 'pending').length;
    }, [leaveRequests, isPrincipal]);

    const totalUnread = unreadAdminNotifications + unreadMessagesCount;

    const handleOpenNotifications = () => {
        setIsNotificationsModalOpen(true);
        const unreadIds = userNotifications.filter(n => !n.isRead).map(n => n.id);
        if (unreadIds.length > 0) {
            const updates: Record<string, boolean> = {};
            unreadIds.forEach(id => {
                updates[id] = true;
            });
            db.ref(`user_read_notifications/${currentUser.id}`).update(updates);
        }
    };

    const effectiveSettings = useMemo(() => {
        if (isPrincipal) {
            return {
                ...settings,
                schoolName: currentUser.schoolName || settings.schoolName || 'لم يتم تحديد اسم المدرسة',
                principalName: currentUser.name,
                schoolLevel: currentUser.schoolLevel || settings.schoolLevel,
            };
        }
        if (isTeacher) {
            const principal = users.find(u => u.id === (currentUser as Teacher).principalId);
            return {
                ...settings,
                schoolName: principal?.schoolName || settings.schoolName || 'لم يتم تحديد اسم المدرسة',
                principalName: principal?.name || settings.principalName,
                schoolLevel: principal?.schoolLevel || settings.schoolLevel,
            };
        }
        return settings;
    }, [settings, currentUser, isPrincipal, isTeacher, users]);

    const handleSelectClass = (classId: string) => {
        setSelectedClassId(classId);
        setActiveView('grade_sheet');
    };

    const handleSaveSettings = (newSettings: SchoolSettings) => {
        if (isPrincipal) {
            db.ref(`settings/${currentUser.id}`).set(newSettings);
            alert('تم حفظ الإعدادات بنجاح!');
            setActiveView('home');
        }
    };

    const selectedClass = useMemo(() => {
        if (!selectedClassId) return null;
        return classes.find(c => c.id === selectedClassId) || null;
    }, [classes, selectedClassId]);

    const communicationLabel = useMemo(() => {
        const isPrimary = effectiveSettings.schoolLevel === 'ابتدائية';
        return isPrimary ? 'التواصل مع التلاميذ' : 'التواصل مع الطلبة';
    }, [effectiveSettings.schoolLevel]);

    const correspondenceNavItems: NavItem[] = [
        { view: 'parent_invitations', icon: Mail, label: 'دعوات أولياء الأمور' },
        { view: 'administrative_correspondence', icon: FileText, label: 'مخاطبات ادارية' },
    ];

    const reportNavItems: NavItem[] = [
        { view: 'export_results', icon: Printer, label: 'النتائج الامتحانية' },
        { view: 'monthly_results', icon: CalendarClock, label: 'النتائج الشهرية' },
        { view: 'statistics', icon: BarChart, label: 'التقارير والإحصاءات' },
        { view: 'teacher_log_exporter', icon: ClipboardList, label: 'سجل المدرس' },
        { view: 'admin_log_exporter', icon: Archive, label: 'السجل العام' },
        { view: 'primary_school_log', icon: BookText, label: 'درجات الابتدائية' },
    ];
    
    const examRecordsNavItems: NavItem[] = [
        { view: 'grade_board', icon: LayoutGrid, label: 'بورد الدرجات' },
        { view: 'oral_exam_lists', icon: ClipboardCheck, label: 'قوائم الشفوي' },
        { view: 'exam_cards', icon: BookMarked, label: 'بطاقات امتحانية' },
        { view: 'exam_halls', icon: Presentation, label: 'قاعات امتحانية' },
        { view: 'cover_editor', icon: Brush, label: 'محرر الأغلفة' },
    ];

    const studentAffairsNavItems: NavItem[] = [
        { view: 'student_registration_form', icon: UserPlus, label: 'استمارة تسجيل طالب' },
    ];

    const teacherNavItems: NavItem[] = useMemo(() => {
        if (!isTeacher) return [];
        const assignments = (currentUser as Teacher).assignments || [];
        return assignments.map((assignment): NavItem | null => {
            const assignedClass = classes.find(c => c.id === assignment.classId);
            if (!assignedClass) return null;

            const assignedSubject = assignedClass.subjects.find(s => s.id === assignment.subjectId);
            if (!assignedSubject) return null;

            return {
                view: 'grade_sheet',
                icon: Eye,
                label: `${assignedClass.stage} / ${assignedClass.section} - ${assignedSubject.name}`,
                classId: assignedClass.id,
            };
        }).filter((item): item is NavItem => item !== null);
    }, [classes, currentUser, isTeacher]);


    const renderView = () => {
        // Teacher Views
        if (isTeacher) {
            const principalId = (currentUser as Teacher).principalId;
            const principalClasses = classes.filter(c => c.principalId === principalId);

            switch(activeView) {
                case 'settings':
                    return <Settings currentSettings={effectiveSettings} onSave={handleSaveSettings} currentUser={currentUser} updateUser={updateUser} />;
                case 'smart_scheduler':
                    return <SmartScheduler currentUser={currentUser} users={users} classes={principalClasses} settings={effectiveSettings} />;
                case 'student_evaluation':
                    return <TeacherEvaluation teacher={currentUser as Teacher} classes={principalClasses} />;
                case 'student_communication':
                    return <TeacherCommunication teacher={currentUser as Teacher} classes={principalClasses} settings={effectiveSettings} />;
                case 'honor_board':
                    return <HonorBoardView currentUser={currentUser} classes={principalClasses} />;
                case 'leave_request_form':
                    return <LeaveRequestForm teacher={currentUser as Teacher} settings={effectiveSettings} classes={principalClasses} />;
                case 'xo_game_manager':
                    return <XoGameManager teacher={currentUser as Teacher} classes={principalClasses} users={users} />;
                case 'teacher_links':
                    return <TeacherLinks teacher={currentUser as Teacher} classes={principalClasses} />;
                case 'homework_manager':
                    return <HomeworkManager teacher={currentUser as Teacher} classes={principalClasses} />;
                case 'hall_of_fame':
                    return <HallOfFame currentUser={currentUser} classes={principalClasses} />;
                case 'home':
                case 'grade_sheet':
                    const classForSheet = selectedClassId 
                        ? classes.find(c => c.id === selectedClassId)
                        : classes.find(c => c.id === teacherNavItems[0]?.classId);
                    
                    if (classForSheet) {
                        return <TeacherGradeSheet classData={classForSheet} teacher={currentUser as Teacher} settings={effectiveSettings} />;
                    }
                    return (
                        <div className="text-center p-8 bg-white rounded-lg shadow">
                            <h2 className="text-2xl font-bold">أهلاً بك، {currentUser.name}</h2>
                            <p className="mt-2 text-gray-600">اختر أحد صفوفك من القائمة الجانبية للبدء في إدخال الدرجات. لم يتم تعيين أي صفوف لك بعد.</p>
                        </div>
                    );
                default:
                     return <div>Teacher view not found</div>
            }
        }

        // Principal Views
        if (isPrincipal) {
            const principalClasses = classes.filter(c => c.principalId === currentUser.id);
            switch (activeView) {
                case 'home':
                case 'class_manager':
                    return <ClassManager classes={principalClasses} onSelectClass={handleSelectClass} currentUser={currentUser} />;
                case 'settings':
                    return <Settings currentSettings={effectiveSettings} onSave={handleSaveSettings} currentUser={currentUser} updateUser={updateUser} />;
                case 'grade_sheet':
                    if (selectedClass) {
                        return <GradeSheet classData={selectedClass} settings={effectiveSettings} />;
                    }
                    return (
                        <div className="text-center p-8 bg-white rounded-lg shadow">
                            <h2 className="text-2xl font-bold">عرض سجل الدرجات</h2>
                            <p className="mt-2 text-gray-600">من فضلك، اختر شعبة من قائمة <span className="font-bold text-cyan-600">"إدارة الشعب"</span> لعرض أو تعديل سجل الدرجات الخاص بها.</p>
                        </div>
                    );
                case 'smart_scheduler':
                    return <SmartScheduler currentUser={currentUser} users={users} classes={principalClasses} settings={effectiveSettings} />;
                case 'parent_invitations':
                    return <ParentInvitationExporter classes={principalClasses} settings={effectiveSettings} />;
                case 'administrative_correspondence':
                    return <AdministrativeCorrespondence />;
                case 'export_results':
                    return <ExportManager classes={principalClasses} settings={effectiveSettings} />;
                case 'monthly_results':
                    return <MonthlyResultsExporter classes={principalClasses} settings={effectiveSettings} />;
                case 'statistics':
                    return <StatisticsManager classes={principalClasses} settings={effectiveSettings} />;
                case 'teacher_log_exporter':
                    return <TeacherLogExporter classes={principalClasses} settings={effectiveSettings} />;
                case 'admin_log_exporter':
                    return <AdminLogExporter classes={principalClasses} settings={effectiveSettings} />;
                case 'primary_school_log':
                    return <PrimaryLogExporter classes={principalClasses} settings={effectiveSettings} />;
                case 'principal_dashboard':
                    return <PrincipalDashboard principal={currentUser} classes={principalClasses} users={users} addUser={addUser} updateUser={updateUser} deleteUser={deleteUser} />;
                case 'student_management':
                    return <StudentManagement principal={currentUser} settings={effectiveSettings} classes={principalClasses} />;
                case 'student_subscriptions':
                    return <StudentSubscriptions principal={currentUser} classes={principalClasses} settings={effectiveSettings} />;
                case 'student_communication':
                    return <StudentCommunication principal={currentUser} settings={effectiveSettings} classes={principalClasses} />;
                case 'absence_manager':
                    return <AbsenceManager principal={currentUser} settings={effectiveSettings} classes={principalClasses} />;
                case 'behavior_management':
                    return <BehaviorManager principal={currentUser} settings={effectiveSettings} classes={principalClasses} />;
                case 'honor_board':
                    return <HonorBoardView currentUser={currentUser} classes={principalClasses} />;
                case 'leave_requests':
                    return <LeaveRequestManager principal={currentUser} settings={effectiveSettings} requests={leaveRequests} />;
                case 'receive_teacher_logs':
                    return <ReceiveTeacherLog principal={currentUser} classes={principalClasses} settings={effectiveSettings} />;
                case 'electronic_logbook':
                    return <ElectronicLogbookGenerator classes={principalClasses} settings={effectiveSettings} />;
                case 'promotion_log':
                    return <PromotionLog classes={principalClasses} settings={effectiveSettings} />;
                case 'grade_board':
                    return <GradeBoardExporter classes={principalClasses} settings={effectiveSettings} />;
                case 'oral_exam_lists':
                    return <OralExamListsExporter classes={principalClasses} settings={effectiveSettings} />;
                 case 'exam_cards':
                    return <ExamCardsExporter settings={effectiveSettings} />;
                case 'exam_halls':
                    return <ExamHallsManager />;
                case 'cover_editor':
                    return <CoverEditor />;
                case 'exam_control_log':
                    return <ExamControlLog principal={currentUser} users={users} classes={principalClasses} settings={effectiveSettings} />;
                case 'student_registration_form':
                    return <StudentRegistrationFormManager />;
                case 'school_archive':
                    return <SchoolArchive />;
                case 'hall_of_fame':
                    return <HallOfFame currentUser={currentUser} classes={principalClasses} />;
                default:
                    return <ClassManager classes={principalClasses} onSelectClass={handleSelectClass} currentUser={currentUser} />;
            }
        }
        
        return <div>Unexpected user role.</div>;
    };

    const navForPrincipal: NavItem[] = [
        { view: 'home', icon: Home, label: 'الرئيسية / الشعب' },
        { view: 'principal_dashboard', icon: User, label: 'إدارة المدرسين' },
        { view: 'student_management', icon: Users, label: 'إدارة الطلبة' },
        { view: 'student_subscriptions', icon: KeyRound, label: 'تفعيل الاشتراكات' },
        { view: 'student_communication', icon: MessageSquare, label: communicationLabel },
        { view: 'absence_manager', icon: CalendarClock, label: 'إدارة الغيابات' },
        { view: 'behavior_management', icon: ShieldBan, label: 'درجات السلوك' },
        { view: 'honor_board', icon: Award, label: 'لوحة الشرف السلوكية' },
        { view: 'hall_of_fame', icon: Trophy, label: 'لوحة الأبطال' },
        { view: 'leave_requests', icon: CalendarCheck, label: 'طلبات الاجازة', badgeCount: pendingLeaveRequestsCount },
        { view: 'smart_scheduler', icon: CalendarCog, label: 'جدولي الذكي' },
        { view: 'electronic_logbook', icon: BookCopy, label: 'الدفتر الالكتروني' },
        { view: 'school_archive', icon: Archive, label: 'ارشيف المدرسة' },
        { view: 'exam_control_log', icon: BookText, label: 'سجل السيطرة الامتحانية' },
        { view: 'promotion_log', icon: ClipboardList, label: 'سجل الترحيل' },
        { view: 'receive_teacher_logs', icon: ClipboardPaste, label: 'السجلات المستلمة' },
    ];
    
    const showAboutButton = (isPrincipal && (activeView === 'home' || activeView === 'class_manager')) || 
                           (isTeacher && (activeView === 'home' || activeView === 'grade_sheet'));

    const handleNavClick = (view: View, classId?: string) => {
        setActiveView(view);
        if (classId) {
            handleSelectClass(classId);
        } else {
             setSelectedClassId(null);
        }
    };

    const getRoleName = (role: string) => {
        if (role === 'principal') return 'مدير';
        if (role === 'teacher') return 'مدرس';
        return role;
    };


    return (
        <div className="flex h-screen bg-gray-200" dir="rtl">
            <NotificationsModal 
                isOpen={isNotificationsModalOpen} 
                onClose={() => setIsNotificationsModalOpen(false)} 
                notifications={userNotifications}
            />
            <div className={`bg-gray-800 text-white flex flex-col transition-all duration-300 relative ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
                <div className="flex items-center justify-center p-4 border-b border-gray-700 h-16 flex-shrink-0">
                    {!isSidebarCollapsed && <span className="font-bold text-xl whitespace-nowrap">لوحة التحكم</span>}
                </div>

                <div className="flex-1 flex flex-col overflow-y-auto">
                    <nav className="px-2 py-4 space-y-1">
                        {isPrincipal && (
                            <>
                                {navForPrincipal.map(item => <NavButton key={item.view} item={item} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick(item.view)} isActive={activeView === item.view}/>)}
                                
                                <div className="pt-2 mt-2 border-t border-gray-700 space-y-1">
                                    <h3 className={`px-4 text-xs font-semibold uppercase text-gray-400 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>شؤون الطلاب</h3>
                                    {studentAffairsNavItems.map(item => <NavButton key={item.view} item={item} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick(item.view)} isActive={activeView === item.view}/>)}
                                </div>

                                 <div className="pt-2 mt-2 border-t border-gray-700 space-y-1">
                                    <h3 className={`px-4 text-xs font-semibold uppercase text-gray-400 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>دعوات ومراسلات</h3>
                                    {correspondenceNavItems.map(item => <NavButton key={item.view} item={item} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick(item.view)} isActive={activeView === item.view}/>)}
                                </div>

                                <div className="pt-2 mt-2 border-t border-gray-700 space-y-1">
                                    <h3 className={`px-4 text-xs font-semibold uppercase text-gray-400 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>سجلات امتحانية</h3>
                                    {examRecordsNavItems.map(item => <NavButton key={item.view} item={item} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick(item.view)} isActive={activeView === item.view}/>)}
                                </div>

                                <div className="pt-2 mt-2 border-t border-gray-700 space-y-1">
                                    <h3 className={`px-4 text-xs font-semibold uppercase text-gray-400 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>التقارير</h3>
                                    {reportNavItems.map(item => {
                                        let isDisabled = false;
                                        if (item.view === 'admin_log_exporter') {
                                            isDisabled = effectiveSettings.schoolLevel === 'ابتدائية';
                                        }
                                        if (item.view === 'primary_school_log') {
                                            isDisabled = effectiveSettings.schoolLevel !== 'ابتدائية';
                                        }
                                        return <NavButton key={item.view} item={item} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick(item.view)} isActive={activeView === item.view} disabled={isDisabled} />
                                    })}
                                </div>
                            </>
                        )}
                        
                        {isTeacher && (
                             <div className="space-y-1">
                                <NavButton item={{view: 'home', icon: Home, label: 'الرئيسية'}} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick('home')} isActive={activeView === 'home' && !selectedClassId}/>
                                <NavButton item={{view: 'homework_manager', icon: ClipboardPaste, label: 'إدارة الواجبات'}} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick('homework_manager')} isActive={activeView === 'homework_manager'}/>
                                <NavButton item={{view: 'hall_of_fame', icon: Trophy, label: 'لوحة الأبطال'}} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick('hall_of_fame')} isActive={activeView === 'hall_of_fame'}/>
                                <NavButton item={{view: 'leave_request_form', icon: CalendarPlus, label: 'طلب اجازة'}} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick('leave_request_form')} isActive={activeView === 'leave_request_form'}/>
                                <NavButton item={{view: 'smart_scheduler', icon: CalendarCog, label: 'جدولي الذكي'}} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick('smart_scheduler')} isActive={activeView === 'smart_scheduler'}/>
                                  <NavButton 
                                    item={{ view: 'student_communication', icon: MessageSquare, label: communicationLabel }} 
                                    isCollapsed={isSidebarCollapsed} 
                                    onClick={() => handleNavClick('student_communication')} 
                                    isActive={activeView === 'student_communication'}
                                />
                                <NavButton item={{view: 'honor_board', icon: Award, label: 'لوحة الشرف السلوكية'}} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick('honor_board')} isActive={activeView === 'honor_board'}/>
                                 <NavButton 
                                    item={{ view: 'student_evaluation', icon: Star, label: 'تقييم الطلبة' }} 
                                    isCollapsed={isSidebarCollapsed} 
                                    onClick={() => handleNavClick('student_evaluation')} 
                                    isActive={activeView === 'student_evaluation'}
                                />
                                 <NavButton 
                                    item={{view: 'teacher_links', icon: BookMarked, label: 'روابط الكتب'}} 
                                    isCollapsed={isSidebarCollapsed} 
                                    onClick={() => handleNavClick('teacher_links')} 
                                    isActive={activeView === 'teacher_links'}
                                 />
                                 <div className="pt-2 mt-2 border-t border-gray-700 space-y-1">
                                     <h3 className={`px-4 text-xs font-semibold uppercase text-gray-400 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>إدارة المسابقات التعليمية</h3>
                                     <NavButton
                                         item={{view: 'xo_game_manager', icon: BrainCircuit, label: 'ادارة مسابقة XO'}}
                                         isCollapsed={isSidebarCollapsed}
                                         onClick={() => handleNavClick('xo_game_manager')}
                                         isActive={activeView === 'xo_game_manager'}
                                     />
                                 </div>
                                <div className="pt-2 mt-2 border-t border-gray-700 space-y-1">
                                    <h3 className={`px-4 text-xs font-semibold uppercase text-gray-400 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>صفوفي</h3>
                                    {teacherNavItems.map(item => <NavButton key={item.label} item={item} isCollapsed={isSidebarCollapsed} onClick={() => item.classId && handleNavClick(item.view, item.classId)} isActive={selectedClassId === item.classId} />)}
                                </div>
                             </div>
                        )}

                        <div className="pt-2 mt-2 border-t border-gray-700 space-y-1">
                             <NavButton item={{view: 'settings', icon: SettingsIcon, label: 'الإعدادات'}} isCollapsed={isSidebarCollapsed} onClick={() => handleNavClick('settings')} isActive={activeView === 'settings'}/>
                        </div>

                    </nav>

                    <div className="mt-auto"></div>

                    <div className="p-4 border-t border-gray-700">
                        <button onClick={onLogout} className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg hover:bg-red-700 bg-red-600/80 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? "تسجيل الخروج" : ''}>
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
                    {/* Left Side: User Info */}
                    <div className="flex items-center gap-6">
                        <div>
                            <h1 className="text-xl font-bold text-gray-800">{currentUser.name} ({getRoleName(currentUser.role)})</h1>
                            <p className="text-sm text-gray-500">{effectiveSettings.schoolName}</p>
                        </div>
                    </div>

                    {/* Right Side: Links & Actions */}
                    <div className="flex items-center gap-2">
                        <a href="https://www.instagram.com/trbawetk/?utm_source=qr&igsh=MXNoNTNmdDRncnNjag%3D%3D#" target="_blank" rel="noopener noreferrer" title="تابعنا على انستغرام" className="p-2 rounded-full hover:bg-gray-200 transition-colors">
                            <img src="https://i.imgur.com/J6SeeNQ.png" alt="Instagram logo" className="w-8 h-8" />
                        </a>
                        <a href="https://www.facebook.com/profile.php?id=61578356680977" target="_blank" rel="noopener noreferrer" title="تابعنا على فيسبوك" className="p-2 rounded-full hover:bg-gray-200 transition-colors">
                            <img src="https://i.imgur.com/zC26Bw6.png" alt="Facebook logo" className="w-8 h-8" />
                        </a>
                        {isPrincipal && (
                            <a href="https://t.me/trbwetk" target="_blank" rel="noopener noreferrer" title="انضم الى كروب المناقشات" className="p-2 rounded-full hover:bg-gray-200 transition-colors">
                                <img src="https://i.imgur.com/YsOAIfV.png" alt="Telegram logo" className="w-8 h-8" />
                            </a>
                        )}
                        
                        <div className="w-px h-8 bg-gray-300 mx-2"></div>
                        
                        <button onClick={handleOpenNotifications} className="relative text-gray-600 hover:text-cyan-600 p-2 rounded-full hover:bg-gray-200 transition-colors">
                            <Bell size={24} />
                            {totalUnread > 0 && (
                                <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                                    {totalUnread > 99 ? '99+' : totalUnread}
                                </span>
                            )}
                        </button>
                    </div>
                </header>
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-200 p-4 sm:p-6 lg:p-8">
                    {unreadAdminNotifications > 0 && (
                        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 mb-4 rounded-md flex justify-between items-center shadow-sm" role="alert">
                            <p className="font-semibold">لديك {unreadAdminNotifications} إشعارات إدارية جديدة غير مقروءة.</p>
                            <button onClick={handleOpenNotifications} className="font-bold text-yellow-900 hover:underline">عرض الإشعارات</button>
                        </div>
                    )}
                    {showAboutButton && (
                         <div className="mb-6 space-y-4">
                             <button 
                                onClick={() => setIsVideoModalOpen(true)}
                                className="w-full flex items-center gap-4 p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-all duration-300 hover:shadow-md text-red-700"
                            >
                                <PlayCircle className="w-12 h-12" />
                                <div>
                                    <h4 className="font-bold text-red-800">شاهد العرض التوضيحي</h4>
                                    <p className="text-sm text-red-600">تعرف على إمكانيات الحقيبة الرقمية في دقيقتين.</p>
                                </div>
                            </button>
                            <button 
                                onClick={() => setIsAboutModalOpen(true)}
                                className="w-full text-center p-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-xl rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-3"
                            >
                                <Info size={28} />
                                <span>تعرف من نحن</span>
                            </button>
                        </div>
                    )}
                    {renderView()}
                </main>
            </div>
             {isVideoModalOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[100] p-4"
                    onClick={() => setIsVideoModalOpen(false)}
                >
                    <div 
                        className="bg-black p-2 rounded-lg shadow-xl w-full max-w-4xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setIsVideoModalOpen(false)}
                            className="absolute -top-3 -right-3 bg-white text-black rounded-full p-2 z-10 shadow-lg hover:scale-110 transition-transform"
                            aria-label="Close video"
                        >
                            <X size={24} />
                        </button>
                        <div className="relative w-full" style={{ paddingTop: '56.25%' }}> {/* 16:9 Aspect Ratio */}
                            <iframe 
                                className="absolute top-0 left-0 w-full h-full"
                                src="https://www.youtube.com/embed/Pi35fNJIx08?autoplay=1"
                                title="YouTube video player" 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                                allowFullScreen
                            ></iframe>
                        </div>
                    </div>
                </div>
            )}
            <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />
        </div>
    );
}