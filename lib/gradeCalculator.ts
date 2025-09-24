import type { Student, Subject, SubjectGrade, CalculatedGrade, StudentResult, SchoolSettings, ClassData } from '../types';

const PASSING_GRADE = 50;

// New constants for primary school stages
const PRIMARY_1_4_STAGES = ['الاول ابتدائي', 'الثاني ابتدائي', 'الثالث ابتدائي', 'الرابع ابتدائي'];
const PRIMARY_5_STAGE = 'الخامس ابتدائي';
const PRIMARY_6_STAGE = 'السادس ابتدائي';

const MINISTERIAL_STAGES = ['الثالث متوسط', 'السادس العلمي', 'السادس الادبي', PRIMARY_6_STAGE];
const NON_EXEMPT_STAGES = ['الثالث متوسط', 'السادس العلمي', 'السادس الادبي', PRIMARY_5_STAGE, PRIMARY_6_STAGE, ...PRIMARY_1_4_STAGES];

const DEFAULT_SUBJECT_GRADE: SubjectGrade = {
    firstTerm: null,
    midYear: null,
    secondTerm: null,
    finalExam1st: null,
    finalExam2nd: null,
};

const calculatePrimaryTerms = (grade: SubjectGrade): { firstTerm: number | null; secondTerm: number | null } => {
    const { october, november, december, january, february, march, april } = grade;
    
    let firstTerm: number | null = null;
    const firstTermMonths = [october, november, december, january];
    if (firstTermMonths.every(m => m !== null && m !== undefined)) {
        firstTerm = Math.round((october! + november! + december! + january!) / 4);
    }

    let secondTerm: number | null = null;
    const secondTermMonths = [february, march, april];
     if (secondTermMonths.every(m => m !== null && m !== undefined)) {
        secondTerm = Math.round((february! + march! + april!) / 3);
    }
    
    return { firstTerm, secondTerm };
};

const calculateAnnualPursuit = (grade: SubjectGrade): number | null => {
    const { firstTerm, midYear, secondTerm } = grade;
    if (firstTerm === null || midYear === null || secondTerm === null) {
        return null;
    }
    return Math.round((firstTerm + midYear + secondTerm) / 3);
};

const calculateFinalGrade1st = (annualPursuit: number | null, finalExam1st: number | null): number | null => {
    if (annualPursuit === null || finalExam1st === null) {
        return null;
    }
    return Math.round((annualPursuit + finalExam1st) / 2);
};

// New specific function for Primary Stages 1-4
const calculatePrimary1_4Result = (student: Student, subjects: Subject[], settings: SchoolSettings): { finalCalculatedGrades: Record<string, CalculatedGrade>, result: StudentResult } => {
    const calculatedGrades: Record<string, CalculatedGrade> = {};
    const PASSING_GRADE_PRIMARY = 5;

    subjects.forEach(subject => {
        const grade = { ...DEFAULT_SUBJECT_GRADE, ...(student.grades?.[subject.name] || {}) };
        calculatedGrades[subject.name] = {
            annualPursuit: null,
            finalGrade1st: grade.finalExam1st ?? null,
            finalGradeWithDecision: grade.finalExam1st ?? null, // No decision points
            decisionApplied: 0,
            finalGrade2nd: grade.finalExam2nd ?? null,
            isExempt: false,
        };
    });

    const anyFinalGradeMissing = subjects.some(s => calculatedGrades[s.name].finalGrade1st === null);
    if (anyFinalGradeMissing) {
        return { finalCalculatedGrades: calculatedGrades, result: { status: 'قيد الانتظار', message: 'بعض درجات الامتحان النهائي لم تدخل بعد' } };
    }

    const failingSubjects = subjects.filter(subject => {
        const gradeInfo = calculatedGrades[subject.name];
        return gradeInfo.finalGrade1st !== null && gradeInfo.finalGrade1st < PASSING_GRADE_PRIMARY;
    });

    if (failingSubjects.length === 0) {
        return { finalCalculatedGrades: calculatedGrades, result: { status: 'ناجح', message: 'ناجح' } };
    } else if (failingSubjects.length <= settings.supplementarySubjectsCount) {
        const supplementarySubjectsList = failingSubjects.map(s => s.name);
        return { finalCalculatedGrades: calculatedGrades, result: { status: 'مكمل', message: `مكمل في: ${supplementarySubjectsList.join(', ')}` } };
    } else {
        return { finalCalculatedGrades: calculatedGrades, result: { status: 'راسب', message: 'راسب' } };
    }
};

// New specific function for Primary Stage 6
const calculatePrimary6Result = (student: Student, subjects: Subject[]): { finalCalculatedGrades: Record<string, CalculatedGrade>, result: StudentResult } => {
    const calculatedGrades: Record<string, CalculatedGrade> = {};

    subjects.forEach(subject => {
        const grade = { ...DEFAULT_SUBJECT_GRADE, ...(student.grades?.[subject.name] || {}) };
        const { firstTerm: calculatedFirstTerm, secondTerm: calculatedSecondTerm } = calculatePrimaryTerms(grade);
        const annualPursuit = calculateAnnualPursuit({ ...grade, firstTerm: calculatedFirstTerm, secondTerm: calculatedSecondTerm });
        
        calculatedGrades[subject.name] = {
            annualPursuit,
            finalGrade1st: null, finalGradeWithDecision: null, decisionApplied: 0, finalGrade2nd: null, isExempt: false,
            // Add ministerial fields for consistency, though they won't be used for decisions here
            annualPursuitWithDecision: annualPursuit,
            decisionAppliedOnPursuit: 0,
        };
    });

    const anyPursuitMissing = subjects.some(s => calculatedGrades[s.name].annualPursuit === null);
    if (anyPursuitMissing) {
        return { finalCalculatedGrades: calculatedGrades, result: { status: 'قيد الانتظار', message: 'بعض درجات السعي لم تحسب بعد' } };
    }

    return { finalCalculatedGrades: calculatedGrades, result: { status: 'مؤهل', message: 'مؤهل للامتحان الوزاري' } };
};


const calculateMinisterialResult = (student: Student, subjects: Subject[], decisionPoints: number, supplementarySubjects: number): { finalCalculatedGrades: Record<string, CalculatedGrade>, result: StudentResult } => {
    const calculatedGrades: Record<string, CalculatedGrade> = {};
    const academicSubjects = subjects; 

    // Phase 1: Calculate all annual pursuits and initialize grades object.
    subjects.forEach(subject => {
        const grade = { ...DEFAULT_SUBJECT_GRADE, ...(student.grades?.[subject.name] || {}) };
        const annualPursuit = calculateAnnualPursuit(grade);
        calculatedGrades[subject.name] = {
            annualPursuit,
            finalGrade1st: null,
            finalGradeWithDecision: null,
            decisionApplied: 0,
            finalGrade2nd: null,
            isExempt: false,
            annualPursuitWithDecision: annualPursuit,
            decisionAppliedOnPursuit: 0,
        };
    });

    // Phase 2: Check for any missing pursuit grades.
    const anyPursuitMissing = academicSubjects.some(s => calculatedGrades[s.name].annualPursuit === null);
    if (anyPursuitMissing) {
        return { finalCalculatedGrades: calculatedGrades, result: { status: 'قيد الانتظار', message: 'بعض درجات السعي لم تحسب بعد' } };
    }

    // Phase 3: Identify originally failing subjects and sort them to help the easiest ones first.
    const originalFailingSubjects = academicSubjects
        .map(subject => ({ name: subject.name, grade: calculatedGrades[subject.name].annualPursuit }))
        .filter(s => s.grade !== null && s.grade < PASSING_GRADE)
        .sort((a, b) => b.grade! - a.grade!);

    // If student is already passing everything, they are qualified.
    if (originalFailingSubjects.length === 0) {
        return {
            finalCalculatedGrades: calculatedGrades,
            result: { status: 'مؤهل', message: 'مؤهل للأمتحان الوزاري' }
        };
    }

    // Phase 4: Simulate applying decision points to see how many subjects can be saved.
    let remainingDecisionPoints = decisionPoints;
    const potentialDecisionApplications: { name: string; amount: number }[] = [];
    
    originalFailingSubjects.forEach(subject => {
        const pointsNeeded = PASSING_GRADE - subject.grade!;
        if (remainingDecisionPoints >= pointsNeeded) {
            remainingDecisionPoints -= pointsNeeded;
            potentialDecisionApplications.push({ name: subject.name, amount: pointsNeeded });
        }
    });

    // Phase 5: Determine eligibility based on the number of subjects STILL failing after the simulated help.
    const finalFailingCount = originalFailingSubjects.length - potentialDecisionApplications.length;

    if (finalFailingCount > supplementarySubjects) {
        // The student is not qualified. Return original grades without applying any decision.
        return {
            finalCalculatedGrades: calculatedGrades, 
            result: { status: 'غير مؤهل', message: 'غير مؤهل للأمتحان الوزاري' }
        };
    }

    // Phase 6: The student IS qualified. Now, apply the simulated decisions for real.
    potentialDecisionApplications.forEach(app => {
        const gradeInfo = calculatedGrades[app.name];
        gradeInfo.annualPursuitWithDecision = PASSING_GRADE;
        gradeInfo.decisionAppliedOnPursuit = app.amount;
    });

    // Phase 7: Determine the final status message.
    if (potentialDecisionApplications.length === 0) {
        // Qualified, but no decision points were used. This happens if they fail in 1-3 subjects but need more points than available.
        return {
            finalCalculatedGrades: calculatedGrades,
            result: { status: 'مؤهل', message: 'مؤهل للأمتحان الوزاري' }
        };
    } else {
        // Qualified, and decision points were used.
        const subjectNames = potentialDecisionApplications.map(s => `${s.name} (+${s.amount})`).join(', ');
        
        const message = finalFailingCount === 0 
            ? `مؤهل بقرار. المواد: ${subjectNames}`
            : `مؤهل. تم المساعدة في: ${subjectNames}`;
        
        return {
            finalCalculatedGrades: calculatedGrades,
            result: { status: 'مؤهل بقرار', message }
        };
    }
};

const calculateStandardResult = (student: Student, subjects: Subject[], settings: SchoolSettings, stage: string): { finalCalculatedGrades: Record<string, CalculatedGrade>, result: StudentResult } => {
    const calculatedGrades: Record<string, CalculatedGrade> = {};
    const studentGradesMap: Record<string, SubjectGrade> = {};
    const allowExemption = !NON_EXEMPT_STAGES.includes(stage);

    subjects.forEach(subject => {
        const grade = { ...DEFAULT_SUBJECT_GRADE, ...(student.grades?.[subject.name] || {}) };
        
        // Special handling for 5th primary grade
        if (stage === PRIMARY_5_STAGE) {
            const { firstTerm: calculatedFirstTerm, secondTerm: calculatedSecondTerm } = calculatePrimaryTerms(grade);
            grade.firstTerm = calculatedFirstTerm;
            grade.secondTerm = calculatedSecondTerm;
        }

        studentGradesMap[subject.name] = grade;

        const annualPursuit = calculateAnnualPursuit(grade);
        calculatedGrades[subject.name] = {
            annualPursuit,
            finalGrade1st: null,
            finalGradeWithDecision: null,
            decisionApplied: 0,
            finalGrade2nd: null,
            isExempt: false,
        };
    });

    if (allowExemption) {
        const annualPursuits = subjects.map(s => calculatedGrades[s.name].annualPursuit).filter(g => g !== null) as number[];
        if (subjects.length > 0 && annualPursuits.length === subjects.length) {
            const total = annualPursuits.reduce((sum, grade) => sum + grade, 0);
            const average = total / annualPursuits.length;
            const minGrade = Math.min(...annualPursuits);
            if (average >= 85 && minGrade >= 75) {
                subjects.forEach(subject => {
                    const gradeInfo = calculatedGrades[subject.name];
                    gradeInfo.isExempt = true;
                    gradeInfo.finalGrade1st = gradeInfo.annualPursuit;
                    gradeInfo.finalGradeWithDecision = gradeInfo.annualPursuit;
                });
                return { finalCalculatedGrades: calculatedGrades, result: { status: 'ناجح', message: 'معفو اعفاء عام' } };
            }
        }
    }

    const individualExemptSubjects: string[] = [];
    if (allowExemption) {
        subjects.forEach(subject => {
            const gradeInfo = calculatedGrades[subject.name];
            if (gradeInfo.annualPursuit !== null && gradeInfo.annualPursuit >= 90) {
                gradeInfo.isExempt = true;
                gradeInfo.finalGrade1st = gradeInfo.annualPursuit;
                gradeInfo.finalGradeWithDecision = gradeInfo.annualPursuit;
                individualExemptSubjects.push(subject.name);
            }
        });
    }

    subjects.forEach(subject => {
        const gradeInfo = calculatedGrades[subject.name];
        if (!gradeInfo.isExempt) {
            const grade = studentGradesMap[subject.name];
            gradeInfo.finalGrade1st = calculateFinalGrade1st(gradeInfo.annualPursuit, grade.finalExam1st);
            gradeInfo.finalGradeWithDecision = gradeInfo.finalGrade1st;
        }
    });

    const nonExemptSubjects = subjects.filter(s => !calculatedGrades[s.name].isExempt);
    const anyNonExemptFinalGradeMissing = nonExemptSubjects.some(subject => calculatedGrades[subject.name]?.finalGrade1st === null);

    if (anyNonExemptFinalGradeMissing) {
        const anyGradeEntered = Object.values(student.grades || {}).length > 0 && Object.values(student.grades || {}).some(g => g.firstTerm !== null || g.midYear !== null || g.secondTerm !== null || g.finalExam1st !== null);
        if (!anyGradeEntered && individualExemptSubjects.length === 0) {
            return { finalCalculatedGrades: calculatedGrades, result: { status: 'قيد الانتظار', message: 'لم تدخل أي درجات' } };
        }
        return { finalCalculatedGrades: calculatedGrades, result: { status: 'قيد الانتظار', message: 'بعض الدرجات لم تدخل بعد' } };
    }

    const preliminaryFailingCount = nonExemptSubjects.filter(subject => {
        const gradeInfo = calculatedGrades[subject.name];
        return gradeInfo?.finalGrade1st !== null && gradeInfo.finalGrade1st < PASSING_GRADE;
    }).length;

    if (preliminaryFailingCount > settings.supplementarySubjectsCount) {
        return { finalCalculatedGrades: calculatedGrades, result: { status: 'راسب', message: 'راسب' } };
    }

    let remainingDecisionPoints = settings.decisionPoints;
    let decisionAppliedSubjects: { name: string, amount: number }[] = [];

    const failingSubjectsForDecision = nonExemptSubjects
        .map(subject => ({ name: subject.name, grade: calculatedGrades[subject.name]?.finalGrade1st }))
        .filter(s => s.grade !== null && s.grade < PASSING_GRADE)
        .sort((a, b) => b.grade! - a.grade!);

    failingSubjectsForDecision.forEach(subject => {
        const gradeInfo = calculatedGrades[subject.name];
        if (gradeInfo.finalGrade1st! < PASSING_GRADE && remainingDecisionPoints > 0) {
            const pointsNeeded = PASSING_GRADE - gradeInfo.finalGrade1st!;
            if (remainingDecisionPoints >= pointsNeeded) {
                remainingDecisionPoints -= pointsNeeded;
                gradeInfo.finalGradeWithDecision = PASSING_GRADE;
                gradeInfo.decisionApplied = pointsNeeded;
                decisionAppliedSubjects.push({ name: subject.name, amount: pointsNeeded });
            }
        }
    });

    const finalFailingCount = nonExemptSubjects.filter(subject => {
        const gradeInfo = calculatedGrades[subject.name];
        return gradeInfo.finalGradeWithDecision !== null && gradeInfo.finalGradeWithDecision < PASSING_GRADE;
    }).length;

    let status: StudentResult['status'];
    let baseMessage = '';

    if (finalFailingCount === 0) {
        status = 'ناجح';
        baseMessage = decisionAppliedSubjects.length > 0
            ? `ناجح بقرار. المواد: ${decisionAppliedSubjects.map(s => `${s.name} (+${s.amount})`).join(', ')}`
            : 'ناجح';
    } else {
        status = 'مكمل';
        const supplementarySubjectsList = nonExemptSubjects
            .filter(subject => {
                const gradeInfo = calculatedGrades[subject.name];
                return gradeInfo.finalGradeWithDecision !== null && gradeInfo.finalGradeWithDecision < PASSING_GRADE;
            })
            .map(s => s.name);
        baseMessage = `مكمل في: ${supplementarySubjectsList.join(', ')}`;
        if (decisionAppliedSubjects.length > 0) {
            const decisionMessage = decisionAppliedSubjects.map(s => `${s.name} (+${s.amount})`).join(', ');
            baseMessage += ` (استخدم قرار في: ${decisionMessage})`;
        }
    }

    let finalMessage = baseMessage;
    if (individualExemptSubjects.length > 0) {
        finalMessage += `. معفو في: ${individualExemptSubjects.join(', ')}`;
    }

    subjects.forEach(subject => {
        const gradeInfo = calculatedGrades[subject.name];
        const grade = studentGradesMap[subject.name];
        if (!gradeInfo.isExempt && grade.finalExam2nd !== null) {
            if (gradeInfo.annualPursuit !== null) {
                gradeInfo.finalGrade2nd = Math.round((gradeInfo.annualPursuit + grade.finalExam2nd) / 2);
            } else {
                gradeInfo.finalGrade2nd = grade.finalExam2nd;
            }
        }
    });

    return { finalCalculatedGrades: calculatedGrades, result: { status, message: finalMessage.trim() } };
};

export const calculateStudentResult = (student: Student, subjects: Subject[], settings: SchoolSettings, classData: ClassData): { finalCalculatedGrades: Record<string, CalculatedGrade>, result: StudentResult } => {
    const { stage, ministerialDecisionPoints = 5, ministerialSupplementarySubjects = 3 } = classData;
    
    // Route to special primary school calculators first
    if (PRIMARY_1_4_STAGES.includes(stage)) {
        return calculatePrimary1_4Result(student, subjects || [], settings);
    }

    const isMinisterialStage = MINISTERIAL_STAGES.includes(stage);

    if (isMinisterialStage) {
        if (stage === PRIMARY_6_STAGE) {
            return calculatePrimary6Result(student, subjects || []);
        }
        return calculateMinisterialResult(student, subjects || [], ministerialDecisionPoints, ministerialSupplementarySubjects);
    }
    
    return calculateStandardResult(student, subjects || [], settings, stage);
};