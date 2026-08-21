import React, { useState, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Settings, 
  Video, 
  MapPin, 
  User, 
  Users, 
  CheckCircle2, 
  Plus, 
  ExternalLink, 
  ShieldCheck, 
  Laptop, 
  Smartphone,
  CalendarCheck,
  AlertCircle,
  Upload,
  Trash2
} from 'lucide-react';
import { OutlookAccountConfig, OutlookMeeting, Task } from '../types';
import { 
  getMeetingsForDate, 
  convertMeetingToTask, 
  parseICS, 
  saveStoredOutlookMeetings, 
  getStoredOutlookMeetings,
  clearStoredOutlookMeetings,
  isDummyDemoMeeting
} from '../services/outlookSyncService';

interface MeetingsViewProps {
  meetings: OutlookMeeting[];
  accounts: OutlookAccountConfig[];
  onOpenAccountsModal: () => void;
  onRefreshMeetings: () => Promise<void>;
  onImportMeetings: (meetings: OutlookMeeting[], message?: string) => void;
  isSyncing: boolean;
  onAddTask: (task: Task) => void;
}

export const MeetingsView: React.FC<MeetingsViewProps> = ({
  meetings,
  accounts,
  onOpenAccountsModal,
  onRefreshMeetings,
  onImportMeetings,
  isSyncing,
  onAddTask,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'all'>('day');
  const [addedTaskIds, setAddedTaskIds] = useState<Set<string>>(new Set());
  const [filterAccountId, setFilterAccountId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // New Filters based on user requirements:
  // 1. Hide all-day meetings (default: true)
  // 2. Hide past / already completed meetings for today (default: true)
  const [hideAllDay, setHideAllDay] = useState<boolean>(true);
  const [hidePastMeetings, setHidePastMeetings] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Generate 7-day strip around selected date
  const generateWeekDays = () => {
    const days: Date[] = [];
    const current = new Date(selectedDate);
    const dayOfWeek = current.getDay(); // 0 is Sunday
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - dayOfWeek);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = generateWeekDays();

  // Get raw meetings for the selected date
  const rawDayMeetings = getMeetingsForDate(meetings, selectedDate);

  const now = new Date();

  // Filter day meetings according to hideAllDay, hidePastMeetings, filterAccountId, and searchQuery
  const filteredDayMeetings = rawDayMeetings.filter((m) => {
    // Filter out all-day meetings if enabled
    if (hideAllDay && m.allDay) return false;

    // Filter out past/done meetings if on today
    if (hidePastMeetings && isToday(selectedDate)) {
      const end = new Date(m.end || m.start);
      if (end.getTime() < now.getTime()) {
        return false;
      }
    }

    if (filterAccountId !== 'all' && m.accountId !== filterAccountId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchOrg = (m.organizer || '').toLowerCase().includes(q);
      const matchLoc = (m.location || '').toLowerCase().includes(q);
      if (!matchTitle && !matchOrg && !matchLoc) return false;
    }
    return true;
  });

  // Filter all meetings for all view
  const allFilteredMeetings = meetings.filter((m) => {
    if (hideAllDay && m.allDay) return false;
    if (filterAccountId !== 'all' && m.accountId !== filterAccountId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchOrg = (m.organizer || '').toLowerCase().includes(q);
      const matchLoc = (m.location || '').toLowerCase().includes(q);
      if (!matchTitle && !matchOrg && !matchLoc) return false;
    }
    return true;
  });

  // Count past meetings on selected day (if today)
  const pastMeetingsCountToday = rawDayMeetings.filter((m) => {
    if (m.allDay) return false;
    const end = new Date(m.end || m.start);
    return isToday(selectedDate) && end.getTime() < now.getTime();
  }).length;

  const allDayMeetingsCountToday = rawDayMeetings.filter((m) => m.allDay).length;

  // Unique days with meetings
  const uniqueDatesWithMeetings = new Set(
    meetings.map((m) => {
      const d = new Date(m.start);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  // Group all meetings by date string for "All Schedule" view
  const groupedMeetingsByDate = React.useMemo(() => {
    const groups: { dateKey: string; date: Date; items: OutlookMeeting[] }[] = [];
    const map = new Map<string, { date: Date; items: OutlookMeeting[] }>();

    for (const m of allFilteredMeetings) {
      const d = new Date(m.start);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, {
          date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
          items: [],
        });
      }
      map.get(key)!.items.push(m);
    }

    // Sort dates chronologically
    const sortedKeys = Array.from(map.keys()).sort();
    for (const key of sortedKeys) {
      const val = map.get(key)!;
      groups.push({
        dateKey: key,
        date: val.date,
        items: val.items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
      });
    }

    return groups;
  }, [allFilteredMeetings]);

  // Calculate meeting stats for this day
  const totalTodayCount = rawDayMeetings.length;
  const totalVisibleDayCount = filteredDayMeetings.length;
  
  // Counts per account
  const accountStats = accounts.map((acc) => {
    const count = meetings.filter((m) => m.accountId === acc.id).length;
    const dayCount = filteredDayMeetings.filter((m) => m.accountId === acc.id).length;
    return { ...acc, count, dayCount };
  });

  // Total scheduled duration in minutes for day
  const totalDurationMinutes = filteredDayMeetings.reduce((acc, m) => {
    const start = new Date(m.start).getTime();
    const end = new Date(m.end).getTime();
    const diff = Math.max(0, Math.round((end - start) / (1000 * 60)));
    return acc + (m.allDay ? 0 : diff);
  }, 0);

  const durationHours = Math.floor(totalDurationMinutes / 60);
  const durationMins = totalDurationMinutes % 60;
  const formattedDuration = durationHours > 0 
    ? `${durationHours}h ${durationMins > 0 ? `${durationMins}m` : ''}`
    : `${durationMins}m`;

  const formatMeetingTime = (startStr: string, endStr: string, allDay: boolean) => {
    if (allDay) return 'All Day';
    const s = new Date(startStr);
    const e = new Date(endStr);
    const sTime = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const eTime = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${sTime} – ${eTime}`;
  };

  const getMeetingDuration = (startStr: string, endStr: string, allDay: boolean) => {
    if (allDay) return 'All day';
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();
    const diff = Math.max(0, Math.round((e - s) / (1000 * 60)));
    if (diff >= 60) {
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${diff} min`;
  };

  const handleConvertToTask = (meeting: OutlookMeeting) => {
    const task = convertMeetingToTask(meeting);
    onAddTask(task);
    setAddedTaskIds((prev) => new Set([...prev, meeting.id]));
  };

  // Check if a meeting is currently happening or coming up next
  const currentOrNextMeeting = filteredDayMeetings.find((m) => {
    const e = new Date(m.end);
    return isToday(selectedDate) && e.getTime() >= now.getTime();
  });

  const handleDirectFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const icsText = event.target?.result as string;
      if (icsText) {
        // Default to active account or work-outlook
        const targetAcc = accounts.find((a) => a.enabled) || accounts[0] || { id: 'work-outlook', name: 'Work Outlook', color: 'sky' };
        const parsed = parseICS(icsText, targetAcc.id, targetAcc.name, targetAcc.color);
        if (parsed.length === 0) {
          setUploadStatus(`No meetings found in "${file.name}". Please check the file.`);
          return;
        }

        // Get stored meetings, filter out any dummy meetings, and merge
        const currentStored = getStoredOutlookMeetings().filter((m) => !isDummyDemoMeeting(m));
        const otherAcc = currentStored.filter((m) => m.accountId !== targetAcc.id);
        
        // Merge without duplicating
        const uniqueMap = new Map<string, OutlookMeeting>();
        for (const m of [...otherAcc, ...parsed]) {
          const dedupKey = `${m.accountId}__${m.title.trim().toLowerCase()}__${m.start}`;
          if (!uniqueMap.has(dedupKey)) {
            uniqueMap.set(dedupKey, m);
          }
        }
        const combined = Array.from(uniqueMap.values()).sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
        );

        saveStoredOutlookMeetings(combined);
        const countToday = getMeetingsForDate(parsed, new Date()).length;
        const msg = `Successfully imported ${parsed.length} meetings from ${file.name}! (${countToday} scheduled for today, ${parsed.length - countToday} on other dates)`;
        onImportMeetings(combined, msg);
        setUploadStatus(msg);

        // If no meetings are scheduled for today, switch to all schedule view so all imported meetings are immediately visible
        if (countToday === 0 && parsed.length > 0) {
          setViewMode('all');
        }

        setTimeout(() => setUploadStatus(null), 8000);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleClearAll = () => {
    clearStoredOutlookMeetings();
    onImportMeetings([], 'Cleared all meetings from calendar.');
    setShowClearConfirm(false);
    setUploadStatus('All meetings cleared.');
    setTimeout(() => setUploadStatus(null), 4000);
  };

  const renderMeetingCard = (meeting: OutlookMeeting) => {
    const isAdded = addedTaskIds.has(meeting.id);
    const isTeams = meeting.meetingUrl?.includes('teams.microsoft.com');
    const isZoom = meeting.meetingUrl?.includes('zoom.us');
    const isMeet = meeting.meetingUrl?.includes('meet.google.com');

    return (
      <div
        key={meeting.id}
        className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs hover:shadow-xs transition-shadow space-y-3"
      >
        {/* Meeting Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Account Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                  meeting.accountColor === 'sky'
                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                    : meeting.accountColor === 'indigo'
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full bg-${meeting.accountColor}-500`} />
                <span>{meeting.accountName}</span>
              </span>

              {/* Time Tag */}
              <span className="text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                <Clock className="w-3 h-3 text-neutral-400" />
                <span>{formatMeetingTime(meeting.start, meeting.end, meeting.allDay)}</span>
              </span>

              {/* Duration Tag */}
              <span className="text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                {getMeetingDuration(meeting.start, meeting.end, meeting.allDay)}
              </span>
            </div>

            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 pt-0.5">
              {meeting.title}
            </h3>
          </div>

          {/* Quick Actions (Join Call & Add to DayFlow) */}
          <div className="flex items-center gap-1.5 shrink-0 self-start">
            {meeting.meetingUrl && (
              <a
                href={meeting.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 text-white transition-all shadow-2xs active:scale-95 ${
                  isTeams
                    ? 'bg-[#5059C9] hover:bg-[#434baf]'
                    : isZoom
                    ? 'bg-[#2D8CFF] hover:bg-[#2277db]'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>{isTeams ? 'Join Teams' : isZoom ? 'Join Zoom' : 'Join Call'}</span>
                <ExternalLink className="w-3 h-3 opacity-75" />
              </a>
            )}

            <button
              onClick={() => handleConvertToTask(meeting)}
              disabled={isAdded}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                isAdded
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
              }`}
              title="Convert this meeting into a time-blocked task in DayFlow"
            >
              {isAdded ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isAdded ? 'Added to Tasks' : 'Add to Tasks'}</span>
            </button>
          </div>
        </div>

        {/* Location, Organizer, Attendees */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-500 dark:text-neutral-400 pt-1 border-t border-neutral-100 dark:border-neutral-800/60">
          {meeting.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="truncate max-w-xs">{meeting.location}</span>
            </div>
          )}

          {meeting.organizer && (
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>Organizer: <strong className="font-medium text-neutral-700 dark:text-neutral-300">{meeting.organizer}</strong></span>
            </div>
          )}

          {meeting.attendees && meeting.attendees.length > 0 && (
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>{meeting.attendees.length} Attendees</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div id="meetings-view-container" className="space-y-5 animate-in fade-in duration-200">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".ics,text/calendar"
        onChange={handleDirectFileUpload}
        className="hidden"
      />

      {/* Top Header & Daily Overview Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs space-y-4">
        {/* Top Controls Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
          {/* Date Selector & Mode Tabs */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/70 border border-neutral-200/80 dark:border-neutral-700/60 text-xs font-medium">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'day'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                Day View
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'week'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                Week View
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'all'
                    ? 'bg-white dark:bg-neutral-900 text-sky-600 dark:text-sky-400 shadow-2xs font-semibold'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <span>All Schedule</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono">
                  {meetings.length}
                </span>
              </button>
            </div>

            {/* Date Navigation for Day / Week modes */}
            {viewMode !== 'all' && (
              <div className="flex items-center gap-1.5 bg-neutral-50 dark:bg-neutral-800/40 p-1 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
                <button
                  onClick={handlePrevDay}
                  className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1.5 px-1.5">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                    {selectedDate.toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  {isToday(selectedDate) && (
                    <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      Today
                    </span>
                  )}
                </div>

                <button
                  onClick={handleNextDay}
                  className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {!isToday(selectedDate) && (
                  <button
                    onClick={handleToday}
                    className="px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Today
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sync, Import & Account Setup Actions */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors shadow-2xs active:scale-95 cursor-pointer"
              title="Upload your downloaded .ics calendar file"
            >
              <Upload className="w-3.5 h-3.5 text-sky-500" />
              <span>Import .ics File</span>
            </button>

            <button
              onClick={onRefreshMeetings}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-500' : 'text-neutral-500'}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Feeds'}</span>
            </button>

            <button
              onClick={onOpenAccountsModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Manage Accounts</span>
            </button>

            {meetings.length > 0 && (
              showClearConfirm ? (
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 px-1 font-medium">Clear all?</span>
                  <button
                    onClick={handleClearAll}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 transition-colors cursor-pointer"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Clear all meetings"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )
            )}
          </div>
        </div>

        {uploadStatus && (
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-700 dark:text-sky-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-sky-500" />
              <span>{uploadStatus}</span>
            </div>
            {viewMode !== 'all' && (
              <button
                onClick={() => setViewMode('all')}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 underline hover:opacity-80 shrink-0 cursor-pointer"
              >
                View All {meetings.length} Meetings
              </button>
            )}
          </div>
        )}

        {/* 7-Day Interactive Date Ribbon */}
        {viewMode !== 'all' && (
          <div className="grid grid-cols-7 gap-1.5 pt-1">
            {weekDays.map((d) => {
              const isSel = isSameDay(d, selectedDate);
              const isTod = isToday(d);
              const dayCount = getMeetingsForDate(meetings, d).length;

              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelectedDate(d)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${
                    isSel
                      ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                      : isTod
                      ? 'bg-sky-500/10 dark:bg-sky-500/20 border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20'
                      : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200/60 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className={`text-[10px] font-medium uppercase ${isSel ? 'text-white/80' : 'text-neutral-400'}`}>
                    {d.toLocaleDateString([], { weekday: 'narrow' })}
                  </span>
                  <span className={`text-sm font-bold mt-0.5 ${isSel ? 'text-white' : ''}`}>
                    {d.getDate()}
                  </span>
                  <div className="mt-1 h-3 flex items-center justify-center">
                    {dayCount > 0 ? (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                          isSel
                            ? 'bg-white text-sky-600'
                            : 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                        }`}
                      >
                        {dayCount}
                      </span>
                    ) : (
                      <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 opacity-40" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Prominent Meeting Count & Calendar Breakdown Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          {/* Total Meetings Count */}
          <div className="p-3.5 rounded-xl bg-linear-to-br from-sky-500/10 via-sky-500/5 to-indigo-500/10 border border-sky-500/20 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              {viewMode === 'day' ? (isToday(selectedDate) && hidePastMeetings ? "Today's Remaining" : 'Meetings Visible') : 'Total In Calendar'}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-neutral-900 dark:text-white font-mono">
                {viewMode === 'day' ? totalVisibleDayCount : allFilteredMeetings.length}
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {viewMode === 'day' ? (totalTodayCount !== totalVisibleDayCount ? `(${totalTodayCount} total)` : 'events') : `across ${uniqueDatesWithMeetings.size} days`}
              </span>
            </div>
          </div>

          {/* Account 1 Count */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 truncate max-w-[120px]">
                {accountStats[0]?.name || 'Account 1'}
              </span>
              <span className="w-2 h-2 rounded-full bg-sky-500" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-white font-mono">
                {viewMode === 'day' ? accountStats[0]?.dayCount || 0 : accountStats[0]?.count || 0}
              </span>
              <span className="text-xs text-neutral-500">
                {viewMode === 'day' ? `today (${accountStats[0]?.count || 0} total)` : 'events'}
              </span>
            </div>
          </div>

          {/* Account 2 Count */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 truncate max-w-[120px]">
                {accountStats[1]?.name || 'Account 2'}
              </span>
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-white font-mono">
                {viewMode === 'day' ? accountStats[1]?.dayCount || 0 : accountStats[1]?.count || 0}
              </span>
              <span className="text-xs text-neutral-500">
                {viewMode === 'day' ? `today (${accountStats[1]?.count || 0} total)` : 'events'}
              </span>
            </div>
          </div>

          {/* Today's Total Duration Time */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              {viewMode === 'day' ? 'Day Time Block' : 'Today Schedule'}
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-white font-mono">
                {viewMode === 'day' ? (totalDurationMinutes > 0 ? formattedDuration : '0m') : `${totalTodayCount} today`}
              </span>
              <span className="text-xs text-neutral-500">
                {viewMode === 'day' ? 'in calls' : 'scheduled'}
              </span>
            </div>
          </div>
        </div>

        {/* Up Next Card (if today) */}
        {isToday(selectedDate) && currentOrNextMeeting && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-emerald-500 text-white rounded">
                    Next Up
                  </span>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {currentOrNextMeeting.title}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-0.5">
                  {formatMeetingTime(currentOrNextMeeting.start, currentOrNextMeeting.end, currentOrNextMeeting.allDay)} • {currentOrNextMeeting.accountName}
                </p>
              </div>
            </div>

            {currentOrNextMeeting.meetingUrl && (
              <a
                href={currentOrNextMeeting.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 shrink-0"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Join Meeting</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs, Toggles & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Account Filter Chips & Quick Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Account Filter Chips */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-200/70 dark:bg-neutral-900 border border-neutral-300/50 dark:border-neutral-800 text-xs overflow-x-auto select-none">
            <button
              onClick={() => setFilterAccountId('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                filterAccountId === 'all'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              All Accounts ({viewMode === 'day' ? totalVisibleDayCount : allFilteredMeetings.length})
            </button>

            {accounts.map((acc) => {
              const count = viewMode === 'day'
                ? filteredDayMeetings.filter((m) => m.accountId === acc.id).length
                : allFilteredMeetings.filter((m) => m.accountId === acc.id).length;
              return (
                <button
                  key={acc.id}
                  onClick={() => setFilterAccountId(acc.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                    filterAccountId === acc.id
                      ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full bg-${acc.color}-500`} />
                  <span>{acc.name}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Quick Filter Toggles (Hide All-Day & Hide Done Meetings) */}
          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-900/80 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => setHideAllDay(!hideAllDay)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] font-medium ${
                hideAllDay
                  ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 font-semibold border border-sky-500/30'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
              title="Toggle all-day meetings on or off"
            >
              <span>Hide All-Day</span>
              {allDayMeetingsCountToday > 0 && (
                <span className="text-[10px] opacity-75 font-mono">({allDayMeetingsCountToday})</span>
              )}
            </button>

            {isToday(selectedDate) && (
              <button
                type="button"
                onClick={() => setHidePastMeetings(!hidePastMeetings)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] font-medium ${
                  hidePastMeetings
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
                title="Filter out meetings that have already ended today"
              >
                <span>Hide Completed</span>
                {pastMeetingsCountToday > 0 && (
                  <span className="text-[10px] opacity-75 font-mono">({pastMeetingsCountToday} past)</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Quick Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter meetings by title or organizer..."
          className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500 shadow-2xs"
        />
      </div>

      {/* VIEW MODE: ALL SCHEDULE (FULL LIST GROUPED BY DATE) */}
      {viewMode === 'all' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 px-1">
            <span>Showing all <strong>{allFilteredMeetings.length}</strong> meetings across your calendar</span>
            <button
              onClick={() => setViewMode('day')}
              className="text-sky-500 hover:underline font-medium cursor-pointer"
            >
              Switch to Day View &rarr;
            </button>
          </div>

          {groupedMeetingsByDate.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-xs">
              <CalendarCheck className="w-8 h-8 text-sky-500 mb-2" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                No meetings found
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Try clearing your search query or uploading another .ics file.
              </p>
            </div>
          ) : (
            groupedMeetingsByDate.map((group) => {
              const isTod = isToday(group.date);

              return (
                <div key={group.dateKey} className="space-y-3">
                  {/* Date Header */}
                  <div className="flex items-center justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${isTod ? 'text-sky-600 dark:text-sky-400' : 'text-neutral-800 dark:text-neutral-200'}`}>
                        {group.date.toLocaleDateString([], {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          year: group.date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
                        })}
                      </span>
                      {isTod && (
                        <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          Today
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-400">
                      {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>

                  {/* Meetings in this date */}
                  <div className="space-y-3">
                    {group.items.map(renderMeetingCard)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW MODE: WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((d) => {
              const isTod = isToday(d);
              const isSel = isSameDay(d, selectedDate);
              const mList = getMeetingsForDate(allFilteredMeetings, d);

              return (
                <div
                  key={d.toISOString()}
                  className={`p-3 rounded-2xl border flex flex-col justify-between min-h-[160px] transition-all ${
                    isSel
                      ? 'border-sky-500 ring-1 ring-sky-500 bg-sky-500/5 dark:bg-sky-500/10'
                      : isTod
                      ? 'border-sky-500/30 bg-sky-500/5 dark:bg-sky-500/5'
                      : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-neutral-400">
                          {d.toLocaleDateString([], { weekday: 'short' })}
                        </span>
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                          {d.getDate()}
                        </h4>
                      </div>
                      {mList.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">
                          {mList.length}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {mList.length === 0 ? (
                        <span className="text-[11px] text-neutral-400 italic block py-2">Open</span>
                      ) : (
                        mList.slice(0, 3).map((m) => (
                          <div
                            key={m.id}
                            className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 text-[11px] truncate border-l-2 border-sky-500"
                            title={`${m.title} (${formatMeetingTime(m.start, m.end, m.allDay)})`}
                          >
                            <span className="font-semibold text-neutral-900 dark:text-white block truncate">{m.title}</span>
                            <span className="text-[10px] text-neutral-500 font-mono">{formatMeetingTime(m.start, m.end, m.allDay)}</span>
                          </div>
                        ))
                      )}
                      {mList.length > 3 && (
                        <span className="text-[10px] text-sky-500 font-medium block text-center">
                          +{mList.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDate(d);
                      setViewMode('day');
                    }}
                    className="mt-3 text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline text-center w-full cursor-pointer"
                  >
                    View Day &rarr;
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE: DAY VIEW (DEFAULT) */}
      {viewMode === 'day' && (
        <div className="space-y-4">
          {/* Subtle Tip if there are more meetings on other dates */}
          {meetings.length > rawDayMeetings.length && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/50 text-xs text-neutral-600 dark:text-neutral-300">
              <span>
                Showing <strong>{filteredDayMeetings.length}</strong> {filteredDayMeetings.length === 1 ? 'meeting' : 'meetings'} for {isToday(selectedDate) ? 'today' : selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} (<strong>{meetings.length}</strong> total meetings in calendar).
              </span>
              <button
                onClick={() => setViewMode('all')}
                className="text-sky-600 dark:text-sky-400 font-semibold underline hover:opacity-80 shrink-0 ml-2 cursor-pointer"
              >
                Show All Schedule
              </button>
            </div>
          )}

          {filteredDayMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-xs">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center mb-3">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {searchQuery ? 'No matching meetings found' : 'No Meetings Scheduled for this Day'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
                {meetings.length > 0
                  ? `You have ${meetings.length} meetings scheduled on other dates in your calendar.`
                  : 'Import your .ics calendar file or sync your Outlook feeds to see all your meetings.'}
              </p>
              <div className="flex items-center gap-2 mt-4">
                {meetings.length > 0 ? (
                  <button
                    onClick={() => setViewMode('all')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <span>View All {meetings.length} Meetings</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import .ics File</span>
                    </button>
                    <button
                      onClick={onOpenAccountsModal}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-all shadow-2xs active:scale-95 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Setup Accounts</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDayMeetings.map(renderMeetingCard)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
