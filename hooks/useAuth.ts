import { useState, useCallback, useEffect } from 'react';
import type { User, Student, ClassData } from '../types.ts';
import { v4 as uuidv4 } from 'uuid';
import { db, auth } from '../lib/firebase.ts';

const PRINCIPAL_LOGIN_CODE = 'Th147aseen';
const PRINCIPAL_USER: User = {
    id: 'principal_user_01',
    role: 'principal',
    name: 'د. علي رحمن وحيد',
    schoolName: 'ثانوية المتفوقين الاولى للبنين',
    schoolLevel: 'ثانوية علمي',
    code: PRINCIPAL_LOGIN_CODE,
    studentCodeLimit: 999999,
};


export default function useAuth() {
    const [users, setUsers] = useState<User[]>([]);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [submissionInfo, setSubmissionInfo] = useState<{principalId: string, stage: string} | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const storedUser = window.localStorage.getItem('current_user');
        if (storedUser) {
            try {
                return JSON.parse(storedUser);
            } catch {
                window.localStorage.removeItem('current_user');
                return null;
            }
        }
        return null;
    });

    const logout = useCallback(() => {
        window.localStorage.removeItem('current_user');
        setCurrentUser(null);
        setSubmissionInfo(null);
    }, []);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user: any) => {
            if (user) {
                setAuthError(null);
                setIsAuthReady(true);
            } else {
                auth.signInAnonymously().catch((error: any) => {
                    console.error("Critical: Anonymous sign-in failed.", error);
                    setAuthError("فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى. قد تمنع بعض الشبكات (مثل شبكات المدارس) الوصول إلى خدماتنا.");
                    setIsAuthReady(true);
                });
            }
        });
    
        return () => unsubscribe(); 
    }, []);

    useEffect(() => {
        if (!isAuthReady || authError) return;

        const usersRef = db.ref('users');
        const callback = (snapshot: any) => {
            const usersData = snapshot.val();
            if (usersData) {
                const usersList = Object.values(usersData) as User[];
                setUsers(usersList);

                if (currentUser && (currentUser.role === 'teacher' || currentUser.role === 'counselor')) {
                    const latestUserData = usersList.find(u => u.id === currentUser.id);
                    if (latestUserData?.disabled) {
                        alert('تم تعطيل حسابك. سيتم تسجيل خروجك.');
                        logout();
                    }
                }
            } else {
                setUsers([]);
            }
        };
        usersRef.on('value', callback);

        return () => usersRef.off('value', callback);
    }, [isAuthReady, authError, currentUser, logout]);

    useEffect(() => {
        if (currentUser?.role === 'student' && currentUser.code) {
            const codeRef = db.ref(`student_access_codes_individual/${currentUser.code}`);
            const listener = codeRef.on('value', (snapshot) => {
                const codeData = snapshot.val();
                if (!snapshot.exists() || codeData.disabled) {
                    alert('تم تعطيل حسابك من قبل الإدارة. سيتم تسجيل خروجك.');
                    logout();
                }
            });
            return () => codeRef.off('value', listener);
        }
    }, [currentUser, logout]);


    const login = useCallback((identifier: string, secret: string): boolean => {
        const code = identifier.trim();

        // Principal login
        if (code === PRINCIPAL_LOGIN_CODE) {
            setCurrentUser(PRINCIPAL_USER);
            window.localStorage.setItem('current_user', JSON.stringify(PRINCIPAL_USER));
            return true;
        }
    
        // Teacher/Counselor login
        const user = users.find(u => u.code === code && (u.role === 'teacher' || u.role === 'counselor'));
    
        if (user) {
            if (user.disabled) {
                alert('تم تعطيل حسابك.');
                return false;
            }
            if (user.principalId !== PRINCIPAL_USER.id) {
                return false; // This teacher does not belong to this principal
            }
            setCurrentUser(user);
            window.localStorage.setItem('current_user', JSON.stringify(user));
            return true;
        }
    
        return false;
    }, [users]);
    
    // These functions are kept for student login via direct link/session, but not exposed on the main login page.
    const studentLogin = useCallback(async (code: string): Promise<boolean> => {
        const codeRef = db.ref(`student_access_codes_individual/${code}`);
        const codeSnapshot = await codeRef.get();
        const codeData = codeSnapshot.val();
        
        if (!codeSnapshot.exists() || codeData.disabled || codeData.principalId !== PRINCIPAL_USER.id) {
            return false;
        }

        const { studentId, classId } = codeData;
        const classRef = db.ref(`classes/${classId}`);
        const classSnapshot = await classRef.get();
        if (!classSnapshot.exists()) return false;

        const classData: ClassData = classSnapshot.val();
        const student = (classData.students || []).find(s => s.id === studentId);
        if (!student) return false;

        const studentUser: User = {
            id: student.id, role: 'student', name: student.name, code: code,
            principalId: PRINCIPAL_USER.id, stage: classData.stage,
            classId: classData.id, section: classData.section,
        };
        
        setCurrentUser(studentUser);
        window.localStorage.setItem('current_user', JSON.stringify(studentUser));
        return true;
    }, []);

    const checkSubmissionCode = useCallback(async (code: string): Promise<boolean> => {
        const codesRef = db.ref(`student_access_codes/${PRINCIPAL_USER.id}`);
        const snapshot = await codesRef.get();
        if (snapshot.exists()) {
            const principalCodes: Record<string, string> = snapshot.val();
            for (const stage in principalCodes) {
                if (principalCodes[stage] === code.trim().toUpperCase()) {
                    setSubmissionInfo({ principalId: PRINCIPAL_USER.id, stage });
                    return true;
                }
            }
        }
        setSubmissionInfo(null);
        return false;
    }, []);


    const addUser = useCallback((newUser: Omit<User, 'id'>): User => {
        const userWithId = { ...newUser, id: uuidv4(), principalId: PRINCIPAL_USER.id };
        db.ref(`users/${userWithId.id}`).set(userWithId);
        return userWithId;
    }, []);
    
    const updateUser = useCallback((userId: string, updater: (user: User) => User) => {
        const userToUpdate = users.find(u => u.id === userId);
        if (userToUpdate) {
            const updatedUser = updater(userToUpdate);
            db.ref(`users/${userId}`).set(updatedUser);
        }
    }, [users]);

    const deleteUser = useCallback((userId: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.')) {
            db.ref(`users/${userId}`).remove();
        }
    }, []);

    return {
        currentUser, users, login, studentLogin, logout, addUser, updateUser, deleteUser,
        isAuthReady, submissionInfo, checkSubmissionCode, authError,
    };
}