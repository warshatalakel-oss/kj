import { GoogleGenAI, Type } from "@google/genai";
import type { User, ClassData, StudyPlan, ScheduleData, SchedulePeriod, XOQuestion, Teacher, SchoolLevel } from "../types";
import { v4 as uuidv4 } from 'uuid';

const getSimpleClassName = (stage: string, section: string): string => {
    return `${stage.replace(/ /g, '-')}-${section}`;
};

const DAY_NAMES_AR: Record<string, string> = {
    Sunday: 'الأحد', Monday: 'الاثنين', Tuesday: 'الثلاثاء', Wednesday: 'الأربعاء', Thursday: 'الخميس'
};

const generateGradeSchedulePrompt = (
    dayToGenerate: string,
    gradeToSchedule: string,
    classesInGrade: ClassData[],
    periodsForThisDay: number,
    targetPeriodsForGrade: number,
    scheduleForDaySoFar: SchedulePeriod[],
    remainingWeeklyLessonsForGrade: Record<string, Record<string, number>>,
    teacherAssignmentsBySubject: Record<string, { teacher: string; classes: string[] }[]>,
    teacherUnavailabilityForPrompt: Record<string, string[]>,
    isPrimary: boolean,
    attemptNumber: number
) => {
    const classNamesInGrade = classesInGrade.map(c => getSimpleClassName(c.stage, c.section));

    const retryInstruction = attemptNumber > 0 ? `
**CRITICAL: ATTEMPT ${attemptNumber + 1} FAILED**. Your previous attempt was invalid.
**New Strategy**: Focus on the constraints. Do not create teacher conflicts. Do not schedule unavailable teachers. Ensure the output is a complete JSON array for all ${periodsForThisDay} periods.
` : '';

    return `
You are a master school scheduler. Your task is to schedule all classes for a SINGLE GRADE LEVEL for a SINGLE DAY.

**Mission:**
-   **Day**: ${dayToGenerate}
-   **Grade Level**: ${gradeToSchedule}
-   **Classes to Schedule**: ${classNamesInGrade.join(', ')}
-   **Periods to fill for this grade**: You MUST generate lessons for EXACTLY the first ${targetPeriodsForGrade} periods for this grade.
-   **Total Periods in Day**: The school day has ${periodsForThisDay} periods. For any period after period ${targetPeriodsForGrade}, you MUST return an empty 'assignments' object for all classes in this grade. Your final JSON array must contain exactly ${periodsForThisDay} period objects.

**Context & Data:**
1.  **Schedule for ${dayToGenerate} So Far (for other grades)**: This part of the schedule is already fixed. You MUST NOT create any teacher conflicts with it.
    \`\`\`json
    ${JSON.stringify(scheduleForDaySoFar, null, 2)}
    \`\`\`

2.  **Remaining Lessons for ${gradeToSchedule}**: Only schedule subjects with a count greater than zero.
    \`\`\`json
    ${JSON.stringify(remainingWeeklyLessonsForGrade, null, 2)}
    \`\`\`

3.  **Teacher Assignments**: Use this to find the correct teacher for a subject/class.
    \`\`\`json
    ${JSON.stringify(teacherAssignmentsBySubject, null, 2)}
    \`\`\`

4.  **Teacher Unavailability**: A list of teachers and the days they are unavailable for the entire week.
    \`\`\`json
    ${JSON.stringify(teacherUnavailabilityForPrompt, null, 2)}
    \`\`\`

**SCHEDULING GUIDELINES:**
- If a teacher is unavailable on some days, you may need to schedule more of their lessons on their available days to meet the weekly requirement. This might mean scheduling the same subject for the same class twice on ${dayToGenerate}. This is allowed and sometimes necessary.
- If you repeat a subject for the same class, try to avoid placing the lessons in consecutive periods.

**ABSOLUTE RULES:**
1.  **NO TEACHER CONFLICTS**: A teacher cannot be in two places at once. Check your assignments against the "Schedule for ${dayToGenerate} So Far". A teacher CANNOT teach two different classes in the same period.
2.  **RESPECT UNAVAILABILITY**: You MUST NOT schedule any lessons for teachers on their specified unavailable days. For today, ${dayToGenerate}, you cannot schedule any teacher who has "${dayToGenerate}" in their unavailability list.
3.  **ONE GRADE ONLY**: Your output must ONLY contain assignments for the specified classes: ${classNamesInGrade.join(', ')}.
4.  **VALID JSON ARRAY**: Your entire response must be ONLY a valid JSON array of ${periodsForThisDay} period objects, matching the required schema. No extra text, no markdown, just the raw JSON.
5.  **RESPECT PERIOD LIMIT**: Only fill the first ${targetPeriodsForGrade} periods. Later periods must have empty assignments for this grade.

${retryInstruction}

Now, create the schedule portion for the "${gradeToSchedule}" grade for ${dayToGenerate}.
`;
};

export const generateScheduleForGradeOnDay = async (
    dayToGenerate: string,
    gradeToSchedule: string,
    classesInGrade: ClassData[],
    scheduleForDaySoFar: SchedulePeriod[],
    teachers: User[],
    studyPlans: Record<string, StudyPlan>,
    periodsForThisDay: number,
    targetPeriodsForGrade: number,
    schoolLevel: SchoolLevel,
    fullScheduleSoFar: ScheduleData,
    allClasses: ClassData[],
    teacherUnavailability: Record<string, string[]>
): Promise<SchedulePeriod[] | null> => {
    const isPrimary = schoolLevel === 'ابتدائية';
    
    // 1. Calculate remaining lessons for just this grade's classes
    const remainingWeeklyLessonsForGrade: Record<string, Record<string, number>> = {};
    classesInGrade.forEach(c => {
        const className = getSimpleClassName(c.stage, c.section);
        const planType = c.stage.includes('ابتدائي') ? 'primary' : c.stage.includes('متوسط') ? 'intermediate' : 'preparatory';
        const plan = studyPlans[planType];
        if (plan && plan.grades[c.stage]) {
            remainingWeeklyLessonsForGrade[className] = { ...plan.grades[c.stage].subjects };
        }
    });

    // Decrement based on what's been scheduled on previous days
    Object.values(fullScheduleSoFar).forEach(daySchedule => {
        daySchedule.forEach(period => {
            Object.entries(period.assignments).forEach(([className, assignment]) => {
                if (remainingWeeklyLessonsForGrade[className]?.[assignment.subject] !== undefined) {
                    remainingWeeklyLessonsForGrade[className][assignment.subject]--;
                }
            });
        });
    });

    // 2. Prepare teacher assignments
    const teacherAssignmentsBySubject: Record<string, { teacher: string; classes: string[] }[]> = {};
    teachers.forEach(teacher => {
        (teacher as Teacher).assignments?.forEach(assignment => {
            const subject = allClasses.flatMap(c => c.subjects).find(s => s.id === assignment.subjectId)?.name;
            const classInfo = allClasses.find(c => c.id === assignment.classId);
            if (subject && classInfo) {
                if (!teacherAssignmentsBySubject[subject]) {
                    teacherAssignmentsBySubject[subject] = [];
                }
                let teacherEntry = teacherAssignmentsBySubject[subject].find(t => t.teacher === teacher.name);
                if (!teacherEntry) {
                    teacherEntry = { teacher: teacher.name, classes: [] };
                    teacherAssignmentsBySubject[subject].push(teacherEntry);
                }
                teacherEntry.classes.push(getSimpleClassName(classInfo.stage, classInfo.section));
            }
        });
    });

    // 3. Prepare teacher unavailability map with names
    const teacherUnavailabilityForPrompt: Record<string, string[]> = {};
    Object.entries(teacherUnavailability).forEach(([teacherId, days]) => {
        const teacherName = teachers.find(t => t.id === teacherId)?.name;
        if (teacherName) {
            teacherUnavailabilityForPrompt[teacherName] = days;
        }
    });
    
    let attempt = 0;
    while(attempt < 2) {
        const prompt = generateGradeSchedulePrompt(
            dayToGenerate, gradeToSchedule, classesInGrade, periodsForThisDay, 
            targetPeriodsForGrade, scheduleForDaySoFar, remainingWeeklyLessonsForGrade, 
            teacherAssignmentsBySubject, teacherUnavailabilityForPrompt, isPrimary, attempt
        );

        try {
            if (!process.env.API_KEY) throw new Error("API_KEY is not set.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { 
                    responseMimeType: "application/json",
                    maxOutputTokens: 4096,
                    temperature: 0.5,
                    thinkingConfig: { thinkingBudget: 2048 },
                }
            });

            const jsonText = response.text;
            if (!jsonText || !jsonText.trim().startsWith('[')) {
                console.warn(`Attempt ${attempt + 1} for grade ${gradeToSchedule} failed: Invalid response.`, jsonText);
                attempt++; continue;
            }
            
            const generatedPeriods: SchedulePeriod[] = JSON.parse(jsonText.trim());
            
            if (Array.isArray(generatedPeriods) && generatedPeriods.length > 0) {
                return generatedPeriods;
            }
            
            console.warn(`Attempt ${attempt + 1} for grade ${gradeToSchedule} failed: Parsed JSON is not a valid array.`);
            attempt++;
        } catch (error) {
            console.error(`Attempt ${attempt+1} for grade ${gradeToSchedule} failed with error:`, error);
            attempt++;
        }
    }

    return null;
};


export const extractTextFromURL = async (
    url: string,
    startPage: number,
    endPage: number,
    chapter?: string
): Promise<string> => {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
        
        const data = await response.json();
        const htmlContent = data.contents;
        if (!htmlContent) {
            throw new Error("Could not fetch content from the URL. It might be invalid or blocked.");
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        let fullText = '';
        let pagesFound = false;

        // Attempt to extract page by page using various selectors
        for (let i = startPage; i <= endPage; i++) {
            const pageSelectors = [ `[aria-label="Page ${i}"]`, `#page${i}-div`, `#page-${i}`, `#pg-${i}`, `#page_${i}`, `#page${i}`, `[id="page ${i}"]` ];
            for (const selector of pageSelectors) {
                const pageElement = doc.querySelector(selector);
                if (pageElement) {
                    fullText += pageElement.textContent || '';
                    pagesFound = true;
                    break;
                }
            }
        }
        
        if (!pagesFound && doc.body) {
            console.log("No structured pages found, falling back to extracting full body text.");
            doc.body.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());
            fullText = doc.body.textContent || '';
        }

        if (!fullText.trim()) {
            throw new Error(`Could not extract any text content from the URL for pages ${startPage}-${endPage}.`);
        }
        
        // New chapter extraction logic
        if (!chapter || chapter === "الكل") {
            return fullText;
        }

        const numberMap: { [key: number]: string[] } = {
            1: ["الاول", "الأول"], 2: ["الثاني"], 3: ["الثالث"], 4: ["الرابع"], 5: ["الخامس"],
            6: ["السادس"], 7: ["السابع"], 8: ["الثامن"], 9: ["التاسع"], 10: ["العاشر"],
            11: ["الحادي عشر"], 12: ["الثاني عشر"], 13: ["الثالث عشر"], 14: ["الرابع عشر"]
        };

        const match = chapter.match(/\d+/);
        if (!match) return fullText; // Fallback if chapter format is unexpected
        const chapterNumber = parseInt(match[0], 10);
        
        const createMarkers = (num: number): string[] => {
            if (!numberMap[num]) return [];
            const words = numberMap[num];
            const markers: string[] = [];
            words.forEach(word => {
                markers.push(`الفصل ${word}`);
                markers.push(`الوحدة ${word}`);
            });
            return markers;
        };

        const startMarkers = createMarkers(chapterNumber);
        const endMarkers = createMarkers(chapterNumber + 1);

        let startIndex = -1;
        for (const marker of startMarkers) {
            const index = fullText.indexOf(marker);
            if (index !== -1) {
                startIndex = index;
                break;
            }
        }
        
        if (startIndex === -1) {
            throw new Error(`لم يتم العثور على بداية "${chapter}" في النص المستخلص.`);
        }
        
        let textAfterStart = fullText.substring(startIndex);
        let endIndex = -1;
        
        if (endMarkers.length > 0) {
            for (const marker of endMarkers) {
                const index = textAfterStart.indexOf(marker, 1);
                if (index !== -1 && (endIndex === -1 || index < endIndex)) {
                    endIndex = index;
                }
            }
        }

        return endIndex !== -1 ? textAfterStart.substring(0, endIndex) : textAfterStart;

    } catch (error) {
        console.error("Error in extractTextFromURL:", error);
        if (error instanceof TypeError && error.message.includes('fetch')) {
             throw new Error("فشل الاتصال بالرابط. قد يكون الرابط غير صحيح، أو أن الموقع يمنع الوصول، أو توجد مشكلة في اتصالك بالإنترنت.");
        }
        throw error;
    }
};

export const generateXOQuestionsFromText = async (
    text: string,
    count: number,
    grade: string,
    subject: string,
    principalId: string,
    chapter?: string,
): Promise<XOQuestion[] | null> => {
    try {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY is not set in environment variables.");
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        if (!text.trim()) {
            throw new Error("Input text is empty.");
        }
        
        const prompt = `Based on the following content for the subject "${subject}" in the grade "${grade}", generate exactly ${count} multiple-choice questions. Each question must have 4 options, and one must be correct. Ensure a mix of difficulties: 20% easy, 50% medium, 30% difficult. The questions should be in Arabic, unless the content is in English.

        Content:
        ---
        ${text.substring(0, 30000)}
        ---
        `;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            questionText: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctOptionIndex: { type: Type.INTEGER }
                        },
                        required: ["questionText", "options", "correctOptionIndex"]
                    }
                }
            }
        });

        const jsonString = result.text.trim();
        const generatedQs = JSON.parse(jsonString);

        if (!Array.isArray(generatedQs)) throw new Error("AI did not return a valid JSON array.");

        return generatedQs.map((q: any) => ({
            ...q,
            id: uuidv4(),
            principalId,
            grade,
            subject,
            chapter: chapter === 'الكل' ? undefined : chapter,
            createdBy: 'ai',
        }));

    } catch (error) {
        console.error("Error in generateXOQuestionsFromText:", error);
        throw error;
    }
};