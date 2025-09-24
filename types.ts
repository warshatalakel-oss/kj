export type Role = 'admin' | 'principal' | 'teacher' | 'student' | 'counselor';

export type SchoolLevel = 'ابتدائية' | 'متوسطة' | 'اعدادية' | 'ثانوية' | 'اعدادي علمي' | 'اعدادي ادبي' | 'ثانوية علمي' | 'ثانوية ادبي';

export interface User {
    id: string;
    role: Role;
    name: string;
    schoolName?: string; // For principals
    code: string; // Used for login by principals and teachers
    email?: string; // For principals and admin
    principalId?: string; // For teachers, to link to their principal
    assignments?: TeacherAssignment[]; // For teachers
    schoolLevel?: SchoolLevel; // For principals
    stage?: string; // For students
    studentCodeLimit?: number; // For principals, set by admin
    chatDisabled?: boolean;
    classId?: string; // For students
    section?: string; // For students
    disabled?: boolean; // For admin to disable principal access
}

export interface TeacherAssignment {
    classId: string;
    subjectId: string;
}

export interface Teacher extends User {
    role: 'teacher';
    principalId: string;
    assignments: TeacherAssignment[];
}

export interface SchoolSettings {
    schoolName: string;
    principalName: string;
    academicYear: string;
    directorate: string;
    supplementarySubjectsCount: number;
    decisionPoints: number;

    // New optional fields
    principalPhone?: string;
    schoolType?: string; // e.g., 'نهاري', 'مسائي', 'خارجي'
    schoolGender?: string; // e.g., 'بنين', 'بنات', 'مختلط'
    schoolLevel?: SchoolLevel;
    governorateCode?: string;
    schoolCode?: string;
    governorateName?: string; // e.g., 'بغداد'
    district?: string;
    subdistrict?: string;
}

export interface Student {
    id: string; // uuid
    name: string;
    registrationId: string;
    birthDate: string;
    examId: string;
    yearsOfFailure?: string;
    motherName?: string;
    motherFatherName?: string;
    grades: Record<string, SubjectGrade>; // key is subject name (Principal's view)
    teacherGrades?: Record<string, TeacherSubjectGrade>; // key is subject name (Teacher's view)
    studentAccessCode?: string; // New: Unique code for student login
    photoUrl?: string; // To be populated from submissions
}

// Grade structure for the main/principal grade sheet
export interface SubjectGrade {
    // 5th & 6th Primary monthly grades
    october?: number | null;
    november?: number | null;
    december?: number | null;
    january?: number | null;
    february?: number | null;
    march?: number | null;
    april?: number | null;

    firstTerm: number | null;
    midYear: number | null;
    secondTerm: number | null;
    finalExam1st: number | null;
    finalExam2nd: number | null;
}

// New grade structure for the teacher's grade sheet
export interface TeacherSubjectGrade {
    // Intermediate & Secondary
    firstSemMonth1: number | null;
    firstSemMonth2: number | null;
    midYear: number | null;
    secondSemMonth1: number | null;
    secondSemMonth2: number | null;
    finalExam?: number | null; // For primary 1-4

    // 5th & 6th Primary monthly grades
    october?: number | null;
    november?: number | null;
    december?: number | null;
    january?: number | null;
    february?: number | null;
    march?: number | null;
    april?: number | null;
}

// Calculated grades for teacher's view
export interface TeacherCalculatedGrade {
    // Intermediate & Secondary
    firstSemAvg: number | null;
    secondSemAvg: number | null;
    annualPursuit: number | null;
    
    // Primary 5th & 6th
    primaryFirstTerm?: number | null;
    primarySecondTerm?: number | null;
}

export interface TeacherSubmission {
    id: string; // submissionId
    teacherId: string;
    classId: string;
    subjectId: string;
    submittedAt: string; // ISO date string
    grades: Record<string, TeacherSubjectGrade>; // key is studentId
}

export interface CalculatedGrade {
    annualPursuit: number | null;
    finalGrade1st: number | null;
    finalGradeWithDecision: number | null;
    decisionApplied: number;
    finalGrade2nd: number | null;
    isExempt: boolean;
    // New fields for ministerial stages
    annualPursuitWithDecision?: number | null;
    decisionAppliedOnPursuit?: number;
}

export interface StudentResult {
    status: 'ناجح' | 'مكمل' | 'راسب' | 'قيد الانتظار' | 'مؤهل' | 'غير مؤهل' | 'مؤهل بقرار';
    message: string;
}

export interface Subject {
    id: string;
    name: string;
}

export interface ClassData {
    id: string; // uuid
    stage: string;
    section: string;
    subjects: Subject[];
    students: Student[];
    principalId: string; // Link class to a principal
    // New fields for ministerial stages
    ministerialDecisionPoints?: number;
    ministerialSupplementarySubjects?: number;
    subjects_migrated_v1?: boolean; // Migration flag
}

// For Scheduling Feature
export interface ScheduleAssignment {
    subject: string;
    teacher: string;
}

export interface SchedulePeriod {
    period: number;
    assignments: Record<string, ScheduleAssignment>; // Key is simple class name e.g., "الاول-متوسط-أ"
}

export type ScheduleData = Record<string, SchedulePeriod[]>; // Key is day name e.g., "Sunday"

export interface StudyPlan {
    grades: Record<string, { // Key is grade name e.g., "الاول متوسط"
        subjects: Record<string, number>; // Key is subject name, value is weekly count
        total: number;
    }>;
}

export interface ScheduleSlot {
    classId: string; // Simple class name, e.g. "الاول-متوسط-أ"
    day: string; // e.g. "Sunday"
    period: number;
}

export interface SwapRequest {
    id: string;
    requesterId: string;
    responderId: string;
    originalSlot: ScheduleSlot;
    requestedSlot: ScheduleSlot;
    status: 'pending_teacher' | 'pending_principal' | 'approved' | 'rejected';
}

// For Yard Duty Scheduling
export interface YardDutyLocation {
    id: string;
    name: string;
}

export interface YardDutyAssignment {
    day: string; // e.g., "Saturday"
    locationId: string;
    teacherId: string;
}

export interface YardDutySchedule {
    principalId: string;
    locations: YardDutyLocation[];
    assignments: YardDutyAssignment[];
}

export interface YardDutySwapRequest {
    id: string;
    requesterId: string;
    responderId: string;
    originalSlot: { day: string; locationId: string };
    requestedSlot: { day: string; locationId: string };
    status: 'pending_teacher' | 'pending_principal' | 'approved' | 'rejected';
}


// New types for Student Management feature
export interface StudentSubmission {
    id: string;
    principalId: string;
    studentName: string; // From form
    stage: string;
    formData: Record<string, string>;
    studentPhoto: string | null;
    submittedAt: string; // ISO String
    status: 'pending' | 'viewed';
}

export interface Announcement {
    id: string;
    principalId: string;
    stage: string;
    message: string;
    timestamp: string; // ISO String
}

export interface ParentContact {
    id: string; // firebase push key
    principalId: string;
    studentName: string;
    parentPhone: string;
    stage: string;
}

// New type for Absence Management feature
export type AbsenceStatus = 'present' | 'absent' | 'excused' | 'runaway';

// New type for Notifications
export interface AppNotification {
    id: string;
    senderId: string; // 'admin_user'
    senderName: string; // 'المسؤول'
    recipientScope: 'all_principals' | 'all_teachers';
    message: string;
    timestamp: string; // ISO String
}

// For student evaluations
export type EvaluationRating = 'ممتاز' | 'جيد جدا' | 'متوسط' | 'ضعيف' | 'ضعيف جدا';

export const EVALUATION_RATINGS: EvaluationRating[] = ['ممتاز', 'جيد جدا', 'متوسط', 'ضعيف', 'ضعيف جدا'];

export interface StudentEvaluation {
    id: string; // studentId-subjectId
    studentId: string;
    principalId: string;
    classId: string;
    subjectId: string;
    subjectName: string; // Added for easier display in student portal
    teacherId: string;
    teacherName: string;
    rating: EvaluationRating;
    timestamp: string; // ISO date string
}

export interface StudentNotification {
    id: string;
    studentId: string;
    message: string;
    timestamp: string; // ISO String
    isRead: boolean;
}

export interface PublishedMonthlyResult {
    publishedAt: string;
    monthKey: string;
    monthLabel: string;
    grades: { subjectName: string; grade: number | null }[];
}

// For Communication Feature
export interface MessageAttachment {
  type: 'image' | 'pdf';
  url: string;
  name: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  senderId: string; // userId of sender
  senderName: string; // name of sender
  text: string;
  attachment?: MessageAttachment;
  timestamp: number; // unix timestamp
}

export interface Conversation {
  id: string;
  principalId: string;
  teacherId?: string;

  studentId?: string; // For 1-on-1 chats
  classId?: string; // For group chats

  subjectName?: string;
  lastMessageText: string;
  lastMessageTimestamp: number;

  unreadByStudent?: boolean; // For 1-on-1 student view
  unreadByStaff: boolean; // For principal/teacher view

  studentName?: string; // For 1-on-1 chats
  groupName?: string; // For group chats
  staffName: string; // principal name or teacher name
  isArchived: boolean;
  chatDisabled: boolean; // controlled by staff
}

export interface BehaviorDeduction {
  id: string;
  principalId: string;
  studentId: string;
  classId: string;
  pointsDeducted: 5 | 10 | 15 | 0;
  reason: string;
  timestamp: string; // ISO String
}

export interface LeaveRequest {
  id: string;
  teacherId: string;
  principalId: string;
  
  teacherName: string;
  requestedAt: string; // ISO string
  status: 'pending' | 'approved' | 'rejected';

  // The actual content submitted by teacher/principal. This allows full editability.
  requestBody: string; 
  
  // Data added upon resolution
  resolvedAt?: string; // ISO string
  rejectionReason?: string;
  approvalBody?: string;
  daysDeducted?: number;
}

export interface XOQuestion {
  id: string; // uuid
  principalId: string;
  grade: string; // e.g., "الاول متوسط"
  subject: string; // e.g., "الفيزياء"
  
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  
  createdBy: 'ai' | string; // 'ai' or teacherId
  creatorName?: string; // teacher's name if created by teacher
  creatorSchool?: string; // teacher's school if created by teacher

  chapter?: string; // e.g., "الفصل 1"
  // For AI-generated questions to enable caching
  pageRange?: {
    start: number;
    end: number;
  };
}


// New Types for XO Game Realtime
export interface XOGameSettings {
  pointsPolicy: 'grant_all' | 'winner_takes_all';
  startTime: string; // ISO format
  endTime: string; // ISO format
  questionTimeLimit: number; // in seconds
  allowSinglePlayer: boolean;
}

export type PlayerSymbol = 'X' | 'O' | '⭐' | '🌙' | '❤️' | '🔷';

export interface XOGamePlayer {
  id: string;
  name: string;
  symbol: PlayerSymbol;
  classId?: string;
  section?: string;
}

export type XOGameStatus = 'waiting_for_players' | 'in_progress' | 'finished';

export interface XOGameState {
  id: string; // gameId
  principalId: string;
  grade: string;
  subject: string;
  status: XOGameStatus;
  players: [XOGamePlayer, XOGamePlayer | null];
  board: Array<PlayerSymbol | null>;
  xIsNext: boolean; // Technically, it's player 1's turn
  winner: PlayerSymbol | 'draw' | null;
  scores: { [key in PlayerSymbol]?: number };
  
  currentQuestion: XOQuestion | null;
  questionForSquare: number | null; // index of the board square
  questionTimerStart: number | null; // Timestamp
  
  chat: ChatMessage[];
  
  createdAt: number;
  updatedAt: number;
}

export interface XOChallenge {
  id: string; // challengeId
  challengerId: string;
  challengerName: string;
  challengerClass: string;
  challengerClassId?: string;
  challengerSection?: string;
  targetId: string;
  grade: string;
  subject: string;
  status: 'pending' | 'accepted' | 'declined' | 'in_game';
  createdAt: number;
  gameId?: string;
}

export interface XOGameScore {
    studentId: string;
    studentName: string;
    classId: string;
    section: string;
    points: number;
}

export interface XOSubjectLeaderboard {
    scores: XOGameScore[];
}

export interface XOOverallLeaderboardEntry {
    studentId: string;
    studentName: string;
    totalPoints: number;
}

// New Types for Behavioral Honor Board
export interface BehavioralVote {
    voterId: string; // teacher, principal, or counselor ID
    voterName: string;
    criteriaKeys: string[]; // e.g., ['respect', 'discipline']
}

export interface HonoredStudent {
    studentId: string;
    studentName: string;
    studentPhotoUrl?: string; // from student submission
    classId: string;
    section: string;
    nominationTimestamp: string; // ISO String
    votes: Record<string, BehavioralVote>; // key is voterId
}

export interface BehavioralHonorBoard {
    id: string; // e.g., 'week-24-2024'
    principalId: string;
    stage: string;
    weekStartDate: string; // ISO String of the Monday of that week
    honoredStudents: Record<string, HonoredStudent>; // key is studentId
}

// New types for Homework feature
export interface HomeworkAttachment {
  name: string;
  url: string;
  type: 'image' | 'pdf';
  path: string; // Full storage path for deletion
}

export interface Homework {
  id: string; // uuid
  principalId: string;
  teacherId: string;
  classIds: string[];
  subjectId: string;
  subjectName: string;
  title: string;
  notes: string;
  deadline: string; // ISO String
  texts: string[];
  attachments: HomeworkAttachment[];
  createdAt: string; // ISO String
}

export interface HomeworkSubmission {
  id: string; // uuid
  homeworkId: string;
  studentId: string;
  studentName: string;
  classId: string; // for easier querying
  submittedAt: string; // ISO String
  texts: string[];
  attachments: HomeworkAttachment[];
  status: 'pending' | 'accepted' | 'rejected';
  rejectionReason?: string;
  reviewedAt?: string; // ISO String
}

export interface HomeworkProgress {
  totalCompleted: number;
  monthlyCompleted: Record<string, { count: number, lastTimestamp: number }>; // "YYYY-MM": { count, lastTimestamp }
}

export interface Award {
    id: string;
    name: string;
    description: string;
    icon: string; // emoji or component name
    minCompletions: number;
}
