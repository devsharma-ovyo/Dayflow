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
function parseIcsDate(dateStr: string): { date: Date; allDay: boolean } {
  if (!dateStr) return { date: new Date(), allDay: false };

  // Remove parameters if present (e.g. VALUE=DATE:20260821 or TZID=America/New_York:20260821T140000)
  const cleanDateStr = dateStr.includes(':') ? dateStr.split(':').pop() || dateStr : dateStr;

  // Case 1: All-day date (YYYYMMDD)
  if (/^\d{8}$/.test(cleanDateStr)) {
    const year = parseInt(cleanDateStr.slice(0, 4), 10);
    const month = parseInt(cleanDateStr.slice(4, 6), 10) - 1;
    const day = parseInt(cleanDateStr.slice(6, 8), 10);
    return { date: new Date(year, month, day, 0, 0, 0), allDay: true };
  }

  // Case 2: UTC date-time (YYYYMMDDTHHMMSSZ)
  if (/^\d{8}T\d{6}Z$/.test(cleanDateStr)) {
    const year = parseInt(cleanDateStr.slice(0, 4), 10);
    const month = parseInt(cleanDateStr.slice(4, 6), 10) - 1;
    const day = parseInt(cleanDateStr.slice(6, 8), 10);
    const hour = parseInt(cleanDateStr.slice(9, 11), 10);
    const min = parseInt(cleanDateStr.slice(11, 13), 10);
    const sec = parseInt(cleanDateStr.slice(13, 15), 10);
    return { date: new Date(Date.UTC(year, month, day, hour, min, sec)), allDay: false };
  }

  // Case 3: Local date-time without Z (YYYYMMDDTHHMMSS)
  if (/^\d{8}T\d{6}$/.test(cleanDateStr)) {
    const year = parseInt(cleanDateStr.slice(0, 4), 10);
    const month = parseInt(cleanDateStr.slice(4, 6), 10) - 1;
    const day = parseInt(cleanDateStr.slice(6, 8), 10);
    const hour = parseInt(cleanDateStr.slice(9, 11), 10);
    const min = parseInt(cleanDateStr.slice(11, 13), 10);
    const sec = parseInt(cleanDateStr.slice(13, 15), 10);
    return { date: new Date(year, month, day, hour, min, sec), allDay: false };
  }

  // Fallback
  const fallback = new Date(cleanDateStr);
  return { date: isNaN(fallback.getTime()) ? new Date() : fallback, allDay: false };
}

// Clean and unescape ICS text values
function unescapeIcsText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Parses raw ICS (iCalendar) text into typed OutlookMeeting objects
 */
export function parseICS(
  icsContent: string,
  accountId: string,
  accountName: string,
  accountColor: string
): OutlookMeeting[] {
  const meetings: OutlookMeeting[] = [];
  if (!icsContent) return meetings;

  // Unfold folded lines (RFC 5545: lines starting with space or tab continue the previous line)
  const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n|\r/);

  let inEvent = false;
  let currentEvent: Partial<OutlookMeeting> & { dtstartRaw?: string; dtendRaw?: string } = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line === 'BEGIN:VEVENT') {
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

    if (line === 'END:VEVENT') {
      inEvent = false;
      if (currentEvent.dtstartRaw) {
        const { date: startDate, allDay } = parseIcsDate(currentEvent.dtstartRaw);
        let endDate = startDate;
        if (currentEvent.dtendRaw) {
          endDate = parseIcsDate(currentEvent.dtendRaw).date;
        } else {
          // Default 30 min duration
          endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
        }

        const rawNotes = currentEvent.description || '';
        const rawLoc = currentEvent.location || '';
        const detectedUrl = currentEvent.meetingUrl || extractMeetingUrl(rawNotes) || extractMeetingUrl(rawLoc);

        meetings.push({
          id: `${accountId}-${currentEvent.uid || Math.random().toString(36).slice(2)}`,
          uid: currentEvent.uid || Math.random().toString(36).slice(2),
          accountId,
          accountName,
          accountColor,
          title: currentEvent.title || 'Untitled Meeting',
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
      }
      currentEvent = {};
      continue;
    }

    if (inEvent) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const keyPart = line.slice(0, colonIdx);
      const valPart = line.slice(colonIdx + 1);
      const keyName = keyPart.split(';')[0].toUpperCase();

      switch (keyName) {
        case 'UID':
          currentEvent.uid = valPart;
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
          currentEvent.meetingUrl = valPart;
          break;
        case 'DTSTART':
          currentEvent.dtstartRaw = line;
          break;
        case 'DTEND':
          currentEvent.dtendRaw = line;
          break;
        case 'ORGANIZER':
          const orgMatch = valPart.match(/CN=([^;:]+)/i) || valPart.match(/mailto:([^\s;]+)/i);
          currentEvent.organizer = orgMatch ? orgMatch[1] : unescapeIcsText(valPart);
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
            currentEvent.attendees = [...(currentEvent.attendees || []), attMatch[1]];
          }
          break;
      }
    }
  }

  // Sort chronologically by start date
  return meetings.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
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
    if (!raw) return generateSampleDemoMeetings();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to read outlook meetings from storage:', err);
  }
  return generateSampleDemoMeetings();
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
  if (!account.feedUrl.trim()) {
    return { success: false, meetings: [], error: 'Calendar feed URL is empty' };
  }

  try {
    const response = await fetch('/api/outlook/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: account.feedUrl.trim() }),
    });

    const data = await response.json();
    if (!response.ok || !data.success || !data.ics) {
      throw new Error(data.error || `HTTP error ${response.status}`);
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
