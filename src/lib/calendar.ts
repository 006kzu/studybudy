import { ScheduleItem, ClassItem } from '@/context/AppContext';

// Helper to format date for ICS: YYYYMMDDTHHmmSS
const formatICSDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

// Map day name to ICS day (MO, TU, WE, etc.)
const DAY_MAP: Record<string, string> = {
    'Mon': 'MO',
    'Tue': 'TU',
    'Wed': 'WE',
    'Thu': 'TH',
    'Fri': 'FR',
    'Sat': 'SA',
    'Sun': 'SU'
};

// Helper: Get the next occurrence of a specific day of the week
const getNextDayOccurrence = (dayName: string, timeStr: string): Date => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const targetDayIndex = days.indexOf(dayName);
    const now = new Date();
    const currentDayIndex = now.getDay();

    let daysUntil = targetDayIndex - currentDayIndex;
    if (daysUntil < 0) daysUntil += 7; // If today is Tues (2) and target is Mon (1), result is -1 + 7 = 6 days

    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysUntil);

    const [hours, minutes] = timeStr.split(':').map(Number);
    targetDate.setHours(hours, minutes, 0, 0);

    return targetDate;
};

export const generateICS = (schedule: ScheduleItem[], classes: ClassItem[]): string => {
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//StudyBudy//Learn Loop//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Study Budy Schedule',
        'X-WR-TIMEZONE:UTC',
    ];

    schedule.forEach(item => {
        // Skip blocks if user doesn't want them? Ideally include everything visible.
        // Skip "sleep" maybe?
        if (item.type === 'sleep') return;

        const uid = `${item.id}@learnloop.app`;
        const now = formatICSDate(new Date());

        // Determine Start/End Date
        let startDate: Date;

        if (item.specificDate) {
            // Non-recurring event
            startDate = new Date(item.specificDate);
            const [h, m] = item.startTime.split(':').map(Number);
            startDate.setHours(h, m, 0, 0);
        } else {
            // Recurring event - find next occurrence
            startDate = getNextDayOccurrence(item.day, item.startTime);
        }

        // Calculate End Date based on duration
        const [sH, sM] = item.startTime.split(':').map(Number);
        const [eH, eM] = item.endTime.split(':').map(Number);

        // Handle midnight crossing if any (simple assumption: same day or next day)
        let durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);
        if (durationMinutes < 0) durationMinutes += 1440; // wrap around

        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

        // Title / specific class name
        let summary = item.label || 'Study Session';
        if ((item.type === 'study' || item.type === 'study_manual') && item.classId) {
            const cls = classes.find(c => c.id === item.classId);
            if (cls) summary = `Study: ${cls.name}`;
            else summary = item.label || 'Study';
        } else if (item.type === 'class' && item.classId) {
            const cls = classes.find(c => c.id === item.classId);
            if (cls) summary = `Class: ${cls.name}`;
        }

        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`UID:${uid}`);
        icsContent.push(`DTSTAMP:${now}`);
        icsContent.push(`DTSTART:${formatICSDate(startDate)}`);
        icsContent.push(`DTEND:${formatICSDate(endDate)}`);
        icsContent.push(`SUMMARY:${summary}`);

        if (item.isRecurring !== false && !item.specificDate) {
            // Weekly recurrence
            const dayCode = DAY_MAP[item.day];
            if (dayCode) {
                icsContent.push(`RRULE:FREQ=WEEKLY;BYDAY=${dayCode}`);
            }
        }

        icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');
    return icsContent.join('\r\n');
};

export const downloadICS = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
};
