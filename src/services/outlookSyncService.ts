import { OutlookAccountConfig, OutlookMeeting, Task } from '../types';

export const OUTLOOK_ACCOUNTS_STORAGE_KEY = 'dayflow_outlook_accounts';
export const OUTLOOK_MEETINGS_STORAGE_KEY = 'dayflow_outlook_meetings';
export const OUTLOOK_LAST_AUTO_SYNC_KEY = 'dayflow_outlook_last_sync_time';

export const DEFAULT_OUTLOOK_ACCOUNTS: OutlookAccountConfig[] = [
  {
    id: 'work-outlook',
    name: 'Work Outlook',
    color: 'sky',
    feedUrl: '',
    enabled: true,
    lastSynced: null,
    lastError: null,
    meetingCount: 0,
  },
  {
    id: 'personal-outlook',
    name: 'Personal Outlook',
    color: 'indigo',
    feedUrl: '',
    enabled: true,
    lastSynced: null,
    lastError: null,
    meetingCount: 0,
  },
];

// Helper to extract virtual meeting link (Microsoft Teams, Zoom, Google Meet, Webex)
export function extractMeetingUrl(text: string): string | undefined {
  if (!text) return undefined;

  const patterns = [
    /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"']+/i,
    /https:\/\/[a-zA-Z0-9-]+\.zoom\.us\/[jw]\/[^\s<>"']+/i,
    /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i,
    /https:\/\/[a-zA-Z0-9-]+\.webex\.com\/[^\s<>"']+/i,
    /https:\/\/meet\.goto\.com\/[^\s<>"']+/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return undefined;
}

// Parse ICS date string into standard Date object
function parseIcsDate(raw: string): { date: Date; allDay: boolean } {
  if (!raw) return { date: new Date(), allDay: false };

  // Remove parameters if present (e.g. VALUE=DATE:20260821 or TZID="India Standard Time":20260821T140000)
  const dateStr = raw.includes(':') ? raw.substring(raw.lastIndexOf(':') + 1).trim() : raw.trim();

  // Case 1: All-day date (YYYYMMDD)
  if (/^\d{8}$/.test(dateStr)) {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);
    return { date: new Date(year, month, day, 0, 0, 0), allDay: true };
  }

  // Case 2: UTC date-time (YYYYMMDDTHHMMSSZ)
  if (/^\d{8}T\d{6}Z$/i.test(dateStr)) {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);
    const hour = parseInt(dateStr.slice(9, 11), 10);
    const min = parseInt(dateStr.slice(11, 13), 10);
    const sec = parseInt(dateStr.slice(13, 15), 10);
    return { date: new Date(Date.UTC(year, month, day, hour, min, sec)), allDay: false };
  }

  // Case 3: Local date-time without Z (YYYYMMDDTHHMMSS)
  if (/^\d{8}T\d{6}$/i.test(dateStr)) {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);
    const hour = parseInt(dateStr.slice(9, 11), 10);
    const min = parseInt(dateStr.slice(11, 13), 10);
    const sec = parseInt(dateStr.slice(13, 15), 10);
    return { date: new Date(year, month, day, hour, min, sec), allDay: false };
  }

  // Fallback ISO or standard date string
  const fallback = new Date(dateStr);
  return { date: isNaN(fallback.getTime()) ? new Date() : fallback, allDay: false };
}

// Clean and unescape ICS text values
function unescapeIcsText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Parses raw ICS (iCalendar) text into typed OutlookMeeting objects,
 * including expansion of recurring series for recent/upcoming days.
 */
export function parseICS(
  icsContent: string,
  accountId: string,
  accountName: string,
  accountColor: string
): OutlookMeeting[] {
  const meetings: OutlookMeeting[] = [];
  if (!icsContent || !icsContent.includes('BEGIN:')) return meetings;

  // Unfold folded lines (RFC 5545: lines starting with space or tab continue the previous line)
  const unfolded = icsContent
    .replace(/\r\n[ \t]/g, '')
    .replace(/\r[ \t]/g, '')
    .replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n|\r/);

  let inEvent = false;
  let currentEvent: Partial<OutlookMeeting> & { 
    dtstartRaw?: string; 
    dtendRaw?: string;
    rrule?: string;
  } = {};

  const today = new Date();
  const pastWindow = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const futureWindow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.toUpperCase() === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        accountId,
        accountName,
        accountColor,
        status: 'confirmed',
        attendees: []
      };
      continue;
    }

    if (line.toUpperCase() === 'END:VEVENT') {
      inEvent = false;
      if (currentEvent.dtstartRaw) {
        const { date: startDate, allDay } = parseIcsDate(currentEvent.dtstartRaw);
        let endDate = startDate;
        let durationMs = 30 * 60 * 1000;
        if (currentEvent.dtendRaw) {
          endDate = parseIcsDate(currentEvent.dtendRaw).date;
          durationMs = Math.max(0, endDate.getTime() - startDate.getTime());
        } else {
          endDate = new Date(startDate.getTime() + durationMs);
        }

        const rawNotes = currentEvent.description || '';
        const rawLoc = currentEvent.location || '';
        const detectedUrl = currentEvent.meetingUrl || extractMeetingUrl(rawNotes) || extractMeetingUrl(rawLoc);
        const baseTitle = currentEvent.title || 'Untitled Meeting';
        const baseUid = currentEvent.uid || Math.random().toString(36).slice(2);

        // Add base event
        meetings.push({
          id: `${accountId}-${baseUid}`,
          uid: baseUid,
          accountId,
          accountName,
          accountColor,
          title: baseTitle,
          description: rawNotes,
          location: rawLoc,
          meetingUrl: detectedUrl,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          allDay,
          organizer: currentEvent.organizer,
          attendees: currentEvent.attendees,
          status: currentEvent.status || 'confirmed'
        });

        // Expand recurring rules (RRULE) for weekly/daily events to cover current dates
        if (currentEvent.rrule) {
          const rruleUpper = currentEvent.rrule.toUpperCase();
          if (rruleUpper.includes('FREQ=DAILY')) {
            // Repeat daily for next 30 days
            for (let d = 1; d <= 30; d++) {
              const occStart = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
              const occEnd = new Date(occStart.getTime() + durationMs);
              if (occStart >= pastWindow && occStart <= futureWindow) {
                meetings.push({
                  id: `${accountId}-${baseUid}-daily-${d}`,
                  uid: `${baseUid}-daily-${d}`,
                  accountId,
                  accountName,
                  accountColor,
                  title: baseTitle,
                  description: rawNotes,
                  location: rawLoc,
                  meetingUrl: detectedUrl,
                  start: occStart.toISOString(),
                  end: occEnd.toISOString(),
                  allDay,
                  organizer: currentEvent.organizer,
                  attendees: currentEvent.attendees,
                  status: currentEvent.status || 'confirmed'
                });
              }
            }
          } else if (rruleUpper.includes('FREQ=WEEKLY')) {
            // Repeat weekly for next 8 weeks
            for (let w = 1; w <= 8; w++) {
              const occStart = new Date(startDate.getTime() + w * 7 * 24 * 60 * 60 * 1000);
              const occEnd = new Date(occStart.getTime() + durationMs);
              if (occStart >= pastWindow && occStart <= futureWindow) {
                meetings.push({
                  id: `${accountId}-${baseUid}-wk-${w}`,
                  uid: `${baseUid}-wk-${w}`,
                  accountId,
                  accountName,
                  accountColor,
                  title: baseTitle,
                  description: rawNotes,
                  location: rawLoc,
                  meetingUrl: detectedUrl,
                  start: occStart.toISOString(),
                  end: occEnd.toISOString(),
                  allDay,
                  organizer: currentEvent.organizer,
                  attendees: currentEvent.attendees,
                  status: currentEvent.status || 'confirmed'
                });
              }
            }
          }
        }
      }
      currentEvent = {};
      continue;
    }

    if (inEvent) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const keyPart = line.slice(0, colonIdx);
      const valPart = line.slice(colonIdx + 1);
      const keyName = keyPart.split(';')[0].toUpperCase().trim();

      switch (keyName) {
        case 'UID':
          currentEvent.uid = valPart.trim();
          break;
        case 'SUMMARY':
          currentEvent.title = unescapeIcsText(valPart);
          break;
        case 'DESCRIPTION':
          currentEvent.description = unescapeIcsText(valPart);
          break;
        case 'LOCATION':
          currentEvent.location = unescapeIcsText(valPart);
          break;
        case 'URL':
          currentEvent.meetingUrl = valPart.trim();
          break;
        case 'RRULE':
          currentEvent.rrule = valPart.trim();
          break;
        case 'DTSTART':
          currentEvent.dtstartRaw = line;
          break;
        case 'DTEND':
          currentEvent.dtendRaw = line;
          break;
        case 'ORGANIZER':
          const orgMatch = valPart.match(/CN=([^;:]+)/i) || valPart.match(/mailto:([^\s;]+)/i);
          currentEvent.organizer = orgMatch ? orgMatch[1].replace(/["']/g, '') : unescapeIcsText(valPart);
          break;
        case 'STATUS':
          const st = valPart.toLowerCase();
          if (st.includes('tentative')) currentEvent.status = 'tentative';
          else if (st.includes('cancel')) currentEvent.status = 'cancelled';
          else currentEvent.status = 'confirmed';
          break;
        case 'ATTENDEE':
          const attMatch = valPart.match(/CN=([^;:]+)/i) || valPart.match(/mailto:([^\s;]+)/i);
          if (attMatch && attMatch[1]) {
            currentEvent.attendees = [...(currentEvent.attendees || []), attMatch[1].replace(/["']/g, '')];
          }
          break;
      }
    }
  }

  // Deduplicate and Sort chronologically
  const uniqueMap = new Map<string, OutlookMeeting>();
  for (const m of meetings) {
    uniqueMap.set(m.id, m);
  }
  return Array.from(uniqueMap.values()).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}

/**
 * Storage helpers
 */
export function getStoredOutlookAccounts(): OutlookAccountConfig[] {
  try {
    const raw = localStorage.getItem(OUTLOOK_ACCOUNTS_STORAGE_KEY);
    if (!raw) return DEFAULT_OUTLOOK_ACCOUNTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to read outlook accounts from storage:', err);
  }
  return DEFAULT_OUTLOOK_ACCOUNTS;
}

export function saveStoredOutlookAccounts(accounts: OutlookAccountConfig[]): void {
  try {
    localStorage.setItem(OUTLOOK_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn('Failed to save outlook accounts to storage:', err);
  }
}

export function getStoredOutlookMeetings(): OutlookMeeting[] {
  try {
    const raw = localStorage.getItem(OUTLOOK_MEETINGS_STORAGE_KEY);
    if (!raw) {
      const demo = generateSampleDemoMeetings();
      saveStoredOutlookMeetings(demo);
      return demo;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to read outlook meetings from storage:', err);
  }
  const demo = generateSampleDemoMeetings();
  saveStoredOutlookMeetings(demo);
  return demo;
}

export function saveStoredOutlookMeetings(meetings: OutlookMeeting[]): void {
  try {
    localStorage.setItem(OUTLOOK_MEETINGS_STORAGE_KEY, JSON.stringify(meetings));
  } catch (err) {
    console.warn('Failed to save outlook meetings to storage:', err);
  }
}

/**
 * Sync a single Outlook Account via backend proxy
 */
export async function syncOutlookAccount(
  account: OutlookAccountConfig
): Promise<{ success: boolean; meetings: OutlookMeeting[]; error?: string }> {
  let cleanedUrl = account.feedUrl.trim().replace(/^["']|["']$/g, '');
  if (!cleanedUrl) {
    return { success: false, meetings: [], error: 'Calendar feed URL is empty' };
  }

  // Auto-normalize webcal:// and HTML links
  if (cleanedUrl.startsWith('webcal://')) {
    cleanedUrl = 'https://' + cleanedUrl.substring(9);
  }
  if (cleanedUrl.includes('reachcalendar.html')) {
    cleanedUrl = cleanedUrl.replace('reachcalendar.html', 'reachcalendar.ics');
  } else if (cleanedUrl.includes('calendar.html')) {
    cleanedUrl = cleanedUrl.replace('calendar.html', 'calendar.ics');
  }

  try {
    const response = await fetch('/api/outlook/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanedUrl }),
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // If the proxy or server returned raw HTML or text
      if (text.includes('BEGIN:VCALENDAR')) {
        const meetings = parseICS(text, account.id, account.name, account.color);
        return { success: true, meetings };
      }
      return { 
        success: false, 
        meetings: [], 
        error: 'The calendar link returned a web page instead of ICS calendar events. Please check the URL.' 
      };
    }

    if (!response.ok || !data?.success || !data?.ics) {
      return { 
        success: false, 
        meetings: [], 
        error: data?.error || `Server returned HTTP ${response.status}` 
      };
    }

    const meetings = parseICS(data.ics, account.id, account.name, account.color);
    return { success: true, meetings };
  } catch (err: any) {
    return { success: false, meetings: [], error: err.message || 'Sync failed' };
  }
}

/**
 * Sync all configured Outlook Accounts
 */
export async function syncAllOutlookAccounts(
  accounts: OutlookAccountConfig[]
): Promise<{ meetings: OutlookMeeting[]; updatedAccounts: OutlookAccountConfig[] }> {
  let allMeetings: OutlookMeeting[] = [];
  const updatedAccounts: OutlookAccountConfig[] = [];

  for (const acc of accounts) {
    if (!acc.enabled || !acc.feedUrl.trim()) {
      updatedAccounts.push(acc);
      continue;
    }

    const result = await syncOutlookAccount(acc);
    if (result.success) {
      allMeetings = [...allMeetings, ...result.meetings];
      updatedAccounts.push({
        ...acc,
        lastSynced: Date.now(),
        lastError: null,
        meetingCount: result.meetings.length,
      });
    } else {
      updatedAccounts.push({
        ...acc,
        lastError: result.error || 'Failed to sync',
      });
    }
  }

  // Deduplicate meetings
  const uniqueMap = new Map<string, OutlookMeeting>();
  allMeetings.forEach((m) => uniqueMap.set(`${m.accountId}-${m.uid}`, m));
  const mergedMeetings = Array.from(uniqueMap.values()).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  saveStoredOutlookAccounts(updatedAccounts);
  if (mergedMeetings.length > 0) {
    saveStoredOutlookMeetings(mergedMeetings);
  }

  return { meetings: mergedMeetings, updatedAccounts };
}

/**
 * Helper to convert an Outlook Meeting into a DayFlow Task with 1-click
 */
export function convertMeetingToTask(meeting: OutlookMeeting): Task {
  const startDate = new Date(meeting.start);
  const hours = startDate.getHours().toString().padStart(2, '0');
  const minutes = startDate.getMinutes().toString().padStart(2, '0');
  const dueTime = `${hours}:${minutes}`;

  const notesArr = [
    `📅 Outlook Meeting (${meeting.accountName})`,
    meeting.location ? `📍 ${meeting.location}` : '',
    meeting.meetingUrl ? `🔗 Join: ${meeting.meetingUrl}` : '',
    meeting.organizer ? `👤 Organizer: ${meeting.organizer}` : '',
    meeting.description ? `\nAgenda:\n${meeting.description.slice(0, 300)}` : '',
  ].filter(Boolean);

  return {
    id: `task-meeting-${meeting.id}`,
    title: meeting.title,
    notes: notesArr.join('\n'),
    type: 'one-time',
    priority: 'high',
    dueTime,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: 0,
    streak: 0,
    bestStreak: 0,
    completionHistory: [],
  };
}

/**
 * Filter meetings for a specific date (defaults to today)
 */
export function getMeetingsForDate(meetings: OutlookMeeting[], targetDate: Date = new Date()): OutlookMeeting[] {
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetDay = targetDate.getDate();

  return meetings.filter((m) => {
    const mDate = new Date(m.start);
    return (
      mDate.getFullYear() === targetYear &&
      mDate.getMonth() === targetMonth &&
      mDate.getDate() === targetDay
    );
  });
}

/**
 * Generates realistic sample demo meetings for immediate preview
 */
export function generateSampleDemoMeetings(): OutlookMeeting[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const createIso = (hours: number, mins: number) => {
    const d = new Date(today);
    d.setHours(hours, mins, 0, 0);
    return d.toISOString();
  };

  return [
    {
      id: 'work-1',
      uid: 'uid-work-standup',
      accountId: 'work-outlook',
      accountName: 'Work Outlook',
      accountColor: 'sky',
      title: 'Engineering & Product Daily Sync',
      description: 'Daily project check-in on sprint deliverables, release blocker review, and backend sync.',
      location: 'Microsoft Teams Meeting',
      meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_demo_engineering_standup',
      start: createIso(9, 30),
      end: createIso(10, 0),
      allDay: false,
      organizer: 'Sarah Chen (Lead Engineer)',
      attendees: ['Alex Morgan', 'Dev Sharma', 'Sarah Chen'],
      status: 'confirmed',
    },
    {
      id: 'work-2',
      uid: 'uid-work-q3-planning',
      accountId: 'work-outlook',
      accountName: 'Work Outlook',
      accountColor: 'sky',
      title: 'Quarterly Roadmap & Architecture Review',
      description: 'Review system design specifications, performance metrics, and cloud resource provisioning.',
      location: 'Room 402 / Teams Call',
      meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_demo_q3_roadmap_planning',
      start: createIso(11, 30),
      end: createIso(12, 30),
      allDay: false,
      organizer: 'David Miller (VP Engineering)',
      attendees: ['Architecture Team', 'Dev Sharma'],
      status: 'confirmed',
    },
    {
      id: 'personal-1',
      uid: 'uid-personal-physio',
      accountId: 'personal-outlook',
      accountName: 'Personal Outlook',
      accountColor: 'indigo',
      title: 'Wellness & Physical Therapy Session',
      description: 'Post-workout recovery and rehabilitation checkup.',
      location: 'Apex Health Center, Suite 100',
      meetingUrl: undefined,
      start: createIso(15, 0),
      end: createIso(15, 45),
      allDay: false,
      organizer: 'Dr. Emily Vance',
      attendees: ['Dev Sharma'],
      status: 'confirmed',
    },
    {
      id: 'personal-2',
      uid: 'uid-personal-investor',
      accountId: 'personal-outlook',
      accountName: 'Personal Outlook',
      accountColor: 'indigo',
      title: 'Portfolio Strategy & Investment Review',
      description: 'Annual personal asset allocation, tax efficiency, and retirement portfolio rebalancing.',
      location: 'Zoom Video Conference',
      meetingUrl: 'https://zoom.us/j/9876543210?pwd=demoMeetingPasscode',
      start: createIso(17, 30),
      end: createIso(18, 15),
      allDay: false,
      organizer: 'Marcus Reed (Financial Advisor)',
      attendees: ['Dev Sharma'],
      status: 'confirmed',
    },
  ];
}
