import React, { useState } from 'react';
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
  Sparkles,
  CalendarCheck,
  AlertCircle
} from 'lucide-react';
import { OutlookAccountConfig, OutlookMeeting, Task } from '../types';
import { getMeetingsForDate, convertMeetingToTask } from '../services/outlookSyncService';

interface MeetingsViewProps {
  meetings: OutlookMeeting[];
  accounts: OutlookAccountConfig[];
  onOpenAccountsModal: () => void;
  onRefreshMeetings: () => Promise<void>;
  isSyncing: boolean;
  onAddTask: (task: Task) => void;
}

export const MeetingsView: React.FC<MeetingsViewProps> = ({
  meetings,
  accounts,
  onOpenAccountsModal,
  onRefreshMeetings,
  isSyncing,
  onAddTask,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [addedTaskIds, setAddedTaskIds] = useState<Set<string>>(new Set());
  const [filterAccountId, setFilterAccountId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
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

  // Get meetings for the selected date
  const dayMeetings = getMeetingsForDate(meetings, selectedDate);

  // Filtered by account & search
  const filteredMeetings = dayMeetings.filter((m) => {
    if (filterAccountId !== 'all' && m.accountId !== filterAccountId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchDesc = (m.description || '').toLowerCase().includes(q);
      const matchOrg = (m.organizer || '').toLowerCase().includes(q);
      const matchLoc = (m.location || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchOrg && !matchLoc) return false;
    }
    return true;
  });

  // Calculate meeting stats for this day
  const totalCount = dayMeetings.length;
  
  // Counts per account
  const accountStats = accounts.map((acc) => {
    const count = dayMeetings.filter((m) => m.accountId === acc.id).length;
    return { ...acc, count };
  });

  // Total scheduled duration in minutes
  const totalDurationMinutes = dayMeetings.reduce((acc, m) => {
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
  const now = new Date();
  const currentOrNextMeeting = dayMeetings.find((m) => {
    const s = new Date(m.start);
    const e = new Date(m.end);
    return isToday(selectedDate) && e.getTime() >= now.getTime();
  });

  return (
    <div id="meetings-view-container" className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header & Daily Overview Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs space-y-4">
        {/* Date Selector Navigation & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {selectedDate.toLocaleDateString([], {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: selectedDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
                })}
              </h2>
              {isToday(selectedDate) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  Today
                </span>
              )}
            </div>

            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isToday(selectedDate) && (
              <button
                onClick={handleToday}
                className="ml-1 text-xs font-medium text-sky-500 hover:text-sky-600 underline"
              >
                Jump to Today
              </button>
            )}
          </div>

          {/* Sync & Account Setup Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshMeetings}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-500' : 'text-neutral-500'}`} />
              <span>{isSyncing ? 'Syncing Outlook...' : 'Sync Outlook'}</span>
            </button>

            <button
              onClick={onOpenAccountsModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white transition-all shadow-xs active:scale-95"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Manage 2 Accounts</span>
            </button>
          </div>
        </div>

        {/* Prominent Daily Meeting Count & Account Breakdown Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          {/* Total Meetings Count */}
          <div className="p-3.5 rounded-xl bg-linear-to-br from-sky-500/10 via-sky-500/5 to-indigo-500/10 border border-sky-500/20 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Meetings Today
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-neutral-900 dark:text-white font-mono">
                {totalCount}
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {totalCount === 1 ? 'meeting scheduled' : 'meetings scheduled'}
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
                {accountStats[0]?.count || 0}
              </span>
              <span className="text-xs text-neutral-500">meetings</span>
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
                {accountStats[1]?.count || 0}
              </span>
              <span className="text-xs text-neutral-500">meetings</span>
            </div>
          </div>

          {/* Total Duration Time */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Total Time Block
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-white font-mono">
                {totalDurationMinutes > 0 ? formattedDuration : '0m'}
              </span>
              <span className="text-xs text-neutral-500">in calls</span>
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
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white">
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

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
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
            All Accounts ({totalCount})
          </button>

          {accounts.map((acc) => {
            const count = dayMeetings.filter((m) => m.accountId === acc.id).length;
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

        {/* Quick Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter meetings by title, organizer..."
          className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500 shadow-2xs"
        />
      </div>

      {/* Meeting Timeline / List */}
      {filteredMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-xs">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center mb-3">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {searchQuery ? 'No matching meetings found' : 'No Meetings Scheduled for this Day'}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
            {accounts.every((a) => !a.feedUrl.trim())
              ? 'Connect your 2 Outlook accounts or load demo meetings to sync your calendar.'
              : 'Your calendar is completely open. Focus on deep work or tasks!'}
          </p>
          {accounts.every((a) => !a.feedUrl.trim()) && (
            <button
              onClick={onOpenAccountsModal}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Connect Outlook Calendars</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMeetings.map((meeting) => {
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
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
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

                {/* Agenda / Description Preview */}
                {meeting.description && (
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2 bg-neutral-50 dark:bg-neutral-800/40 p-2 rounded-lg font-sans leading-relaxed">
                    {meeting.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
