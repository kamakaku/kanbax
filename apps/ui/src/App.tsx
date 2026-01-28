import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TaskView, BoardView, TaskStatus } from '@kanbax/domain';
import { supabase } from './supabaseClient';

const API_BASE = 'http://localhost:4000';
const ARCHIVED_BOARD_ID = 'archived';

interface OkrKeyResult {
    id: string;
    objectiveId: string;
    title: string;
    description?: string | null;
    assignees?: string[];
    startValue: number;
    targetValue: number;
    currentValue: number;
    status: string;
    progress: number;
    createdAt: string;
    updatedAt: string;
}

interface OkrObjective {
    id: string;
    tenantId: string;
    title: string;
    description?: string | null;
    ownerId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status: string;
    confidence?: number | null;
    progress: number;
    keyResults: OkrKeyResult[];
    createdAt: string;
    updatedAt: string;
}

type KrStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK';

interface KeyResultView {
    id: string;
    objectiveId: string;
    title: string;
    description?: string | null;
    assignees?: string[];
    metricType: string;
    startValue: number;
    targetValue: number;
    currentValue: number;
    status: KrStatus;
    progress: number;
    lastUpdatedAt: string;
}

interface ObjectiveView {
    id: string;
    title: string;
    description?: string | null;
    ownerId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status: string;
    confidence: number;
    progress: number;
    keyResults: KeyResultView[];
    readOnly: boolean;
}

interface CalendarEvent {
    id: string;
    provider: 'microsoft' | 'ics';
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    location?: string | null;
    description?: string | null;
    url?: string | null;
}

interface CalendarImport {
    id: string;
    name: string;
    type: 'file' | 'url';
    createdAt: string;
}

interface ScopeWindow {
    id: string;
    name: string;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    taskIds: string[];
    createdAt: string;
}

const App: React.FC = () => {
    const [view, setView] = useState<'dashboard' | 'kanban' | 'list' | 'table' | 'calendar' | 'settings' | 'okr' | 'scope'>('dashboard');
    const [expandedTableTaskId, setExpandedTableTaskId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<'comments' | 'attachments' | 'activity'>('comments');
    useEffect(() => {
        if (view === 'list') {
            setView('table');
        }
    }, [view]);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');
        if (viewParam === 'calendar') {
            setView('calendar');
            params.delete('view');
            const next = params.toString();
            window.history.replaceState({}, '', `${window.location.pathname}${next ? `?${next}` : ''}`);
        }
    }, []);
    useEffect(() => {
        const syncScopeFromUrl = () => {
            const params = new URLSearchParams(window.location.search);
            const scopeParam = params.get('scope');
            if (scopeParam) {
                setScopeRouteId(scopeParam);
                setView('scope');
                setScopeScreen('detail');
            } else {
                setScopeRouteId(null);
                setScopeScreen('list');
            }
        };
        syncScopeFromUrl();
        window.addEventListener('popstate', syncScopeFromUrl);
        return () => window.removeEventListener('popstate', syncScopeFromUrl);
    }, []);
    const [session, setSession] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [memberships, setMemberships] = useState<any[]>([]);
    const [invites, setInvites] = useState<any[]>([]);
    const [activeTenantId, setActiveTenantId] = useState<string | null>(() => {
        try {
            return localStorage.getItem('kanbax-active-tenant');
        } catch {
            return null;
        }
    });
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [teamNameInput, setTeamNameInput] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('MEMBER');
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [teamError, setTeamError] = useState<string | null>(null);
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [skipTeamSetup, setSkipTeamSetup] = useState(false);
    const [dismissHuddleCta, setDismissHuddleCta] = useState(false);
    const [isInvitesModalOpen, setIsInvitesModalOpen] = useState(false);
    const [huddleMembersByTenant, setHuddleMembersByTenant] = useState<Record<string, any[]>>({});
    const [authMode, setAuthMode] = useState<'login' | 'signup' | 'magic'>('login');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authMessage, setAuthMessage] = useState<string | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(false);
    const [settingsDraft, setSettingsDraft] = useState<any>(null);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
    const [templateDraft, setTemplateDraft] = useState({ name: '', title: '', priority: 'MEDIUM', status: 'BACKLOG' });
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<Array<{ id: string; message: string; huddleName: string; timestamp: string; read: boolean; taskId?: string; tenantId?: string }>>([]);
    const [pendingTaskOpen, setPendingTaskOpen] = useState<{ taskId: string; tenantId: string } | null>(null);
    const [taskOrderByColumn, setTaskOrderByColumn] = useState<Record<string, string[]>>({});
    const [tasksByTenant, setTasksByTenant] = useState<Record<string, TaskView[]>>({});
    const [scopeTasksByTenant, setScopeTasksByTenant] = useState<Record<string, TaskView[]>>({});
    const [searchLoading, setSearchLoading] = useState(false);
    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const pollInFlightRef = useRef(false);
    const searchDebounceRef = useRef<number | null>(null);
    const lastDragTargetRef = useRef<string | null>(null);
    const pollIntervalRef = useRef<number | null>(null);
    const dragStartTimeRef = useRef<number>(0);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isHuddleMenuOpen, setIsHuddleMenuOpen] = useState(false);
    const [lineHoverIndex, setLineHoverIndex] = useState<number | null>(null);
    const [lineRangeDays, setLineRangeDays] = useState(30);

    useEffect(() => {
        setLineHoverIndex(null);
    }, [lineRangeDays]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem('kanbax-sidebar-collapsed') === 'true';
        } catch {
            return false;
        }
    });
    const [tasks, setTasks] = useState<TaskView[]>([]);
    const [board, setBoard] = useState<BoardView | null>(null);
    const [boards, setBoards] = useState<BoardView[]>([]);
    const [boardsByTenant, setBoardsByTenant] = useState<Record<string, BoardView[]>>({});
    const [boardMenuOpen, setBoardMenuOpen] = useState(false);
    const [okrMenuOpen, setOkrMenuOpen] = useState(false);
    const [scopeWindowsByBoard, setScopeWindowsByBoard] = useState<Record<string, ScopeWindow[]>>(() => {
        try {
            const raw = localStorage.getItem('kanbax-scope-windows');
            if (!raw) return {};
            const parsed = JSON.parse(raw) as Record<string, ScopeWindow[]>;
            const migrated: Record<string, ScopeWindow[]> = {};
            Object.entries(parsed).forEach(([key, value]) => {
                if (!Array.isArray(value)) return;
                if (key.includes(':')) {
                    const tenantId = key.split(':')[0];
                    if (!tenantId) return;
                    const existing = migrated[tenantId] || [];
                    value.forEach((window) => {
                        if (!existing.some((entry) => entry.id === window.id)) {
                            existing.push(window);
                        }
                    });
                    migrated[tenantId] = existing;
                } else {
                    migrated[key] = value;
                }
            });
            return migrated;
        } catch {
            return {};
        }
    });
    const [scopeDraft, setScopeDraft] = useState({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
    });
    const [scopePickerOpenId, setScopePickerOpenId] = useState<string | null>(null);
    const [scopePickerQuery, setScopePickerQuery] = useState('');
    const [scopeDropTargetId, setScopeDropTargetId] = useState<string | null>(null);
    const [activeScopeId, setActiveScopeId] = useState<string | null>(null);
    const [scopeScreen, setScopeScreen] = useState<'list' | 'detail'>('list');
    const [scopeRouteId, setScopeRouteId] = useState<string | null>(null);
    const [scopeFilterPriority, setScopeFilterPriority] = useState<'ALL' | string>('ALL');
    const [scopeFilterStatus, setScopeFilterStatus] = useState<'ALL' | TaskStatus>('ALL');
    const [scopePriorityFilterOpen, setScopePriorityFilterOpen] = useState(false);
    const [scopeStatusFilterOpen, setScopeStatusFilterOpen] = useState(false);
    const [scopeDetailView, setScopeDetailView] = useState<'board' | 'list'>('board');
    const [isScopeSettingsOpen, setIsScopeSettingsOpen] = useState(false);
    const [scopeSettingsDraft, setScopeSettingsDraft] = useState({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
    });
    const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
    const [okrObjectives, setOkrObjectives] = useState<OkrObjective[]>([]);
    const [okrLoading, setOkrLoading] = useState(false);
    const [okrError, setOkrError] = useState<string | null>(null);
    const [okrNotice, setOkrNotice] = useState<{ code: 'permission' | 'policy' | 'unknown'; safeReason: string; correlationId?: string } | null>(null);
    const [okrPinned, setOkrPinned] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('kanbax-okr-pinned') || '[]');
        } catch {
            return [];
        }
    });
    const [expandedObjectives, setExpandedObjectives] = useState<string[]>([]);
    const [okrRecent, setOkrRecent] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('kanbax-okr-recent') || '[]');
        } catch {
            return [];
        }
    });
    const [okrRoute, setOkrRoute] = useState<{ screen: 'library' | 'objective' | 'review'; objectiveId?: string } | null>(null);
    const [okrObjectiveViewMode, setOkrObjectiveViewMode] = useState<'list' | 'cards'>('list');
    const [okrKrViewMode, setOkrKrViewMode] = useState<'list' | 'cards' | 'table'>('list');
    const [reviewStep, setReviewStep] = useState(0);
    const [isBoardSettingsOpen, setIsBoardSettingsOpen] = useState(false);
    const [isObjectiveSettingsOpen, setIsObjectiveSettingsOpen] = useState(false);
    const [objectiveComposerOpen, setObjectiveComposerOpen] = useState(false);
    const [objectiveEditId, setObjectiveEditId] = useState<string | null>(null);
    const [krComposerOpen, setKrComposerOpen] = useState(false);
    const [krComposerObjectiveId, setKrComposerObjectiveId] = useState<string | null>(null);
    const [krEditingId, setKrEditingId] = useState<string | null>(null);
    const [krComposerDraft, setKrComposerDraft] = useState({
        title: '',
        description: '',
        assignees: [] as string[],
        startValue: '0',
        targetValue: '100',
        status: 'ON_TRACK',
    });
    const [objectiveDraft, setObjectiveDraft] = useState({
        title: '',
        description: '',
        ownerId: '',
        startDate: '',
        endDate: '',
        status: 'ACTIVE',
    });
    const [newObjective, setNewObjective] = useState({
        title: '',
        description: '',
        ownerId: '',
        startDate: '',
        endDate: '',
        status: 'ACTIVE',
    });
    const [krDrafts, setKrDrafts] = useState<Record<string, {
        title: string;
        description: string;
        assignees: string[];
        startValue: string;
        targetValue: string;
        status: string;
    }>>({});
    const [filterText, setFilterText] = useState('');
    const [filterPriority, setFilterPriority] = useState('ALL');
    const [filterFavorites, setFilterFavorites] = useState(false);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [priorityFilterOpen, setPriorityFilterOpen] = useState(false);
    const [statusFilterOpen, setStatusFilterOpen] = useState(false);
    const [calendarDate, setCalendarDate] = useState(() => new Date());
    const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => new Date());
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [calendarImports, setCalendarImports] = useState<CalendarImport[]>([]);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [calendarError, setCalendarError] = useState<string | null>(null);
    const [calendarImportFileName, setCalendarImportFileName] = useState('');
    const [calendarImportFile, setCalendarImportFile] = useState<File | null>(null);
    const [calendarImporting, setCalendarImporting] = useState(false);
    const [calendarImportInputKey, setCalendarImportInputKey] = useState(0);
    const [calendarImportUrlName, setCalendarImportUrlName] = useState('');
    const [calendarImportUrl, setCalendarImportUrl] = useState('');
    const [isBoardNavOpen, setIsBoardNavOpen] = useState(() => !isSidebarCollapsed);
    const [isOkrNavOpen, setIsOkrNavOpen] = useState(() => !isSidebarCollapsed && view === 'okr');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
    const [newTaskAttachments, setNewTaskAttachments] = useState<TaskView['attachments']>([]);
    const [newTaskKinds, setNewTaskKinds] = useState<string[]>([]);
    const [newKindInput, setNewKindInput] = useState('');
    const [newTaskHuddleId, setNewTaskHuddleId] = useState<string | null>(null);
    const [newTaskBoardId, setNewTaskBoardId] = useState<string | null>(null);
    const [newTaskOwnerId, setNewTaskOwnerId] = useState<string | null>(null);
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
    const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>(TaskStatus.BACKLOG);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTask, setEditTask] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
    const [editTaskHuddleId, setEditTaskHuddleId] = useState<string | null>(null);
    const [editTaskBoardId, setEditTaskBoardId] = useState<string | null>(null);
    const [editTaskBoardOriginal, setEditTaskBoardOriginal] = useState<string | null>(null);
    const [editTaskTenantOriginal, setEditTaskTenantOriginal] = useState<string | null>(null);
    const [editTaskOwnerId, setEditTaskOwnerId] = useState<string | null>(null);
    const [editTaskAssignees, setEditTaskAssignees] = useState<string[]>([]);
    const [existingAttachments, setExistingAttachments] = useState<TaskView['attachments']>([]);
    const [newAttachments, setNewAttachments] = useState<TaskView['attachments']>([]);
    const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
    const [knownKinds, setKnownKinds] = useState<string[]>([]);
    const [editTaskKinds, setEditTaskKinds] = useState<string[]>([]);
    const [editKindInput, setEditKindInput] = useState('');
    const [commentInput, setCommentInput] = useState('');
    const [checklistDraft, setChecklistDraft] = useState<TaskView['checklist']>([]);
    const [checklistInput, setChecklistInput] = useState('');
    const [imagePreview, setImagePreview] = useState<{ src: string; name: string } | null>(null);
    const [linkedDraft, setLinkedDraft] = useState<string[]>([]);
    const [linkSelectId, setLinkSelectId] = useState('');
    const newDescriptionRef = useRef<HTMLDivElement | null>(null);
    const editDescriptionRef = useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getApiHeaders = (includeTenant = true, tenantOverride?: string | null) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
        }
        const tenant = includeTenant ? (tenantOverride ?? activeTenantId ?? '') : '';
        if (includeTenant && tenant) {
            headers['x-tenant-id'] = tenant;
        }
        if (userProfile?.id) {
            headers['x-user-id'] = userProfile.id;
        }
        return headers;
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const syncRoute = () => {
            const parsed = parseOkrPath(window.location.pathname);
            setOkrRoute(parsed);
            if (parsed) {
                setView('okr');
            }
        };
        syncRoute();
        const handlePop = () => syncRoute();
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, []);

    useEffect(() => {
        if (view !== 'okr' && window.location.pathname.startsWith('/okr')) {
            window.history.replaceState({}, '', '/');
        }
    }, [view]);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (!session || !activeTenantId) {
                setTasks([]);
                setBoard(null);
                setError(null);
                setLoading(false);
                return;
            }
            const boardsRes = await fetch(`${API_BASE}/boards`, { headers: getApiHeaders() });
            if (!boardsRes.ok) throw new Error('Failed to fetch boards');
            const boardsData = await boardsRes.json();
            setBoards(boardsData);
            if (activeTenantId) {
                setBoardsByTenant((prev) => ({ ...prev, [activeTenantId]: boardsData }));
            }

            const storedBoardId = (() => {
                try {
                    return localStorage.getItem(`kanbax-active-board:${activeTenantId}`);
                } catch {
                    return null;
                }
            })();
            const fallbackBoardId = boardsData[0]?.id || null;
            const nextBoardId = storedBoardId === ARCHIVED_BOARD_ID
                ? ARCHIVED_BOARD_ID
                : (storedBoardId && boardsData.some((b: BoardView) => b.id === storedBoardId))
                    ? storedBoardId
                    : fallbackBoardId;
            setActiveBoardId(nextBoardId);
            if (nextBoardId) {
                try {
                    localStorage.setItem(`kanbax-active-board:${activeTenantId}`, nextBoardId);
                } catch {
                    // ignore
                }
            }

            const tasksBoardId = nextBoardId === ARCHIVED_BOARD_ID ? 'all' : (nextBoardId || '');
            const tasksRes = await fetch(`${API_BASE}/tasks?boardId=${encodeURIComponent(tasksBoardId)}`, { headers: getApiHeaders() });
            if (!tasksRes.ok) throw new Error('Failed to fetch tasks');
            const tasksData = await tasksRes.json();

            setTasks(tasksData);
            if (activeTenantId) {
                setTasksByTenant((prev) => ({ ...prev, [activeTenantId]: tasksData }));
            }
            setBoard(boardsData.find((b: BoardView) => b.id === nextBoardId) || boardsData[0] || null);
            const taskKinds = tasksData
                .flatMap((task: TaskView) => (task.kinds || []).map((kind) => kind.trim()))
                .filter((kind: string) => kind.length > 0);
            const storedKinds = (() => {
                try {
                    const raw = localStorage.getItem('kanbax-kind-history');
                    return raw ? (JSON.parse(raw) as string[]) : [];
                } catch {
                    return [];
                }
            })();
            const mergedKinds = Array.from(new Set([...storedKinds, ...taskKinds])).sort((a, b) => a.localeCompare(b));
            setKnownKinds(mergedKinds);
            try {
                localStorage.setItem('kanbax-kind-history', JSON.stringify(mergedKinds));
            } catch {
                // Ignore storage errors
            }
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const parsePolicyNotice = (err: any) => {
        const message = typeof err === 'string' ? err : (err?.error || err?.message || 'Unknown error');
        const lowered = message.toLowerCase();
        if (lowered.includes('permission')) {
            return { code: 'permission' as const, safeReason: 'Blocked by permission.' };
        }
        if (lowered.includes('policy') || lowered.includes('denied')) {
            return { code: 'policy' as const, safeReason: 'Blocked by policy.' };
        }
        return { code: 'unknown' as const, safeReason: message };
    };

    const loadOkrs = async () => {
        if (!session || !activeTenantId) {
            setOkrObjectives([]);
            setOkrError(null);
            setOkrNotice(null);
            return;
        }
        try {
            setOkrLoading(true);
            const boardId = activeBoardId === 'all' || activeBoardId === ARCHIVED_BOARD_ID
                ? resolveWritableBoardId(activeTenantId)
                : (activeBoardId || 'default-board');
            const res = await fetch(`${API_BASE}/okrs?boardId=${encodeURIComponent(boardId)}`, { headers: getApiHeaders() });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to load OKRs');
            }
            const data = await res.json();
            setOkrObjectives(data || []);
            setOkrError(null);
            setOkrNotice(null);
        } catch (e: any) {
            setOkrError(e.message);
            setOkrNotice(parsePolicyNotice(e));
        } finally {
            setOkrLoading(false);
        }
    };

    const fetchCalendarImports = async () => {
        if (!activeTenantId) return;
        try {
            const res = await fetch(`${API_BASE}/calendar/imports`, { headers: getApiHeaders(true) });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to load calendar imports');
            }
            const data = await res.json();
            setCalendarImports(data || []);
        } catch (err: any) {
            setCalendarError(err.message);
        }
    };

    const fetchCalendarEvents = async (start: Date, end: Date) => {
        if (!activeTenantId) return;
        setCalendarLoading(true);
        setCalendarError(null);
        try {
            const params = new URLSearchParams({
                start: start.toISOString(),
                end: end.toISOString(),
            });
            const res = await fetch(`${API_BASE}/calendar/events?${params.toString()}`, { headers: getApiHeaders(true) });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to load calendar events');
            }
            const data = await res.json();
            setCalendarEvents(data || []);
        } catch (err: any) {
            setCalendarEvents([]);
            setCalendarError(err.message);
        } finally {
            setCalendarLoading(false);
        }
    };

    const handleCalendarImportFile = async () => {
        if (!calendarImportFile) {
            setCalendarError('Please select an .ics file to import.');
            return;
        }
        setCalendarImporting(true);
        setCalendarError(null);
        try {
            const fileText = await calendarImportFile.text();
            const name = calendarImportFileName.trim() || calendarImportFile.name.replace(/\.ics$/i, '') || 'Imported calendar';
            const res = await fetch(`${API_BASE}/calendar/imports`, {
                method: 'POST',
                headers: { ...getApiHeaders(true), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, ics: fileText }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to import calendar');
            }
            setCalendarImportFileName('');
            setCalendarImportFile(null);
            setCalendarImportInputKey((prev) => prev + 1);
            await fetchCalendarImports();
            fetchCalendarEvents(calendarRange.start, calendarRange.end);
        } catch (err: any) {
            setCalendarError(err.message);
        } finally {
            setCalendarImporting(false);
        }
    };

    const handleCalendarImportUrl = async () => {
        if (!calendarImportUrl.trim()) {
            setCalendarError('Please paste an ICS subscription URL.');
            return;
        }
        setCalendarImporting(true);
        setCalendarError(null);
        try {
            const name = calendarImportUrlName.trim() || 'Subscribed calendar';
            const res = await fetch(`${API_BASE}/calendar/imports`, {
                method: 'POST',
                headers: { ...getApiHeaders(true), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, url: calendarImportUrl.trim() }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to subscribe calendar');
            }
            setCalendarImportUrlName('');
            setCalendarImportUrl('');
            await fetchCalendarImports();
            fetchCalendarEvents(calendarRange.start, calendarRange.end);
        } catch (err: any) {
            setCalendarError(err.message);
        } finally {
            setCalendarImporting(false);
        }
    };

    const handleCalendarImportRemove = async (importId: string) => {
        try {
            const res = await fetch(`${API_BASE}/calendar/imports/${importId}`, {
                method: 'DELETE',
                headers: getApiHeaders(true),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to remove calendar import');
            }
            await fetchCalendarImports();
            fetchCalendarEvents(calendarRange.start, calendarRange.end);
        } catch (err: any) {
            setCalendarError(err.message);
        }
    };

    const handleCalendarMonthChange = (delta: number) => {
        const next = new Date(calendarDate);
        next.setMonth(next.getMonth() + delta);
        setCalendarDate(next);
        setCalendarSelectedDate(next);
    };

    const handleCalendarToday = () => {
        const today = new Date();
        setCalendarDate(today);
        setCalendarSelectedDate(today);
    };

    const submitObjective = async (draft: { title: string; description?: string; ownerId: string; startDate: string; endDate: string; status: string }, onSuccess?: () => void) => {
        if (!activeTenantId) return;
        try {
            const payload = {
                title: draft.title.trim(),
                description: draft.description?.trim() || null,
                ownerId: draft.ownerId || null,
                startDate: draft.startDate || null,
                endDate: draft.endDate || null,
                status: draft.status || 'ACTIVE',
                boardId: activeBoardId === 'all' || activeBoardId === ARCHIVED_BOARD_ID
                    ? resolveWritableBoardId(activeTenantId)
                    : (activeBoardId || 'default-board'),
            };
            if (!payload.title) {
                alert('Objective title is required');
                return;
            }
            const isEdit = Boolean(objectiveEditId);
            const res = await fetch(
                isEdit ? `${API_BASE}/okrs/objectives/${objectiveEditId}` : `${API_BASE}/okrs/objectives`,
                {
                    method: isEdit ? 'PATCH' : 'POST',
                    headers: getApiHeaders(),
                    body: JSON.stringify(payload),
                }
            );
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || `Failed to ${isEdit ? 'update' : 'create'} objective`);
            }
            const created = await res.json();
            setOkrObjectives((prev) => (isEdit ? prev.map((item) => (item.id === created.id ? created : item)) : [created, ...prev]));
            setOkrNotice(null);
            if (onSuccess) onSuccess();
        } catch (e: any) {
            alert(e.message);
            setOkrNotice(parsePolicyNotice(e));
        }
    };

    const handleCreateObjective = async () => {
        await submitObjective(newObjective, () => {
            setNewObjective({
                title: '',
                description: '',
                ownerId: '',
                startDate: '',
                endDate: '',
                status: 'ACTIVE',
            });
        });
    };

    const handleCreateBoard = async () => {
        if (!activeTenantId) return;
        const name = prompt('Board name');
        if (!name) return;
        try {
            const res = await fetch(`${API_BASE}/boards`, {
                method: 'POST',
                headers: getApiHeaders(),
                body: JSON.stringify({ name: name.trim() }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create board');
            }
            const created = await res.json();
            setBoards((prev) => prev.concat(created));
            setActiveBoardId(created.id);
            setBoard(created);
            try {
                localStorage.setItem(`kanbax-active-board:${activeTenantId}`, created.id);
            } catch {
                // ignore
            }
            fetchData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleBoardChange = (boardId: string) => {
        if (!boardId) return;
        setActiveBoardId(boardId);
        try {
            localStorage.setItem(`kanbax-active-board:${activeTenantId}`, boardId);
        } catch {
            // ignore
        }
        fetchData();
    };

    const handleBoardNavClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (isSidebarCollapsed) {
            setIsBoardNavOpen(true);
            setView('kanban');
            return;
        }
        const target = event.target as HTMLElement;
        if (target.closest('.sidebar-nav-chevron')) {
            setIsBoardNavOpen((prev) => !prev);
            return;
        }
        setIsBoardNavOpen(true);
        setView('kanban');
    };

    const handleScopeNavClick = () => {
        setView('scope');
        setScopeScreen('list');
        setScopeRouteId(null);
        updateScopeUrl(null, 'replace');
    };

    const handleSidebarBoardSelect = (boardId: string) => {
        handleBoardChange(boardId);
        setIsBoardNavOpen(true);
        setView('kanban');
    };

    const handleScopeCreate = () => {
        if (!scopeKey || !scopeDraft.name.trim()) return;
        const nextId = createScopeId();
        const nextWindow: ScopeWindow = {
            id: nextId,
            name: scopeDraft.name.trim(),
            description: scopeDraft.description?.trim() || null,
            startDate: scopeDraft.startDate || null,
            endDate: scopeDraft.endDate || null,
            taskIds: [],
            createdAt: new Date().toISOString(),
        };
        updateScopeWindows((prev) => prev.concat(nextWindow));
        setScopeDraft({ name: '', description: '', startDate: '', endDate: '' });
        setActiveScopeId(nextId);
    };

    const openScopeDetail = (scopeId: string) => {
        setActiveScopeId(scopeId);
        setScopeScreen('detail');
        setScopeRouteId(scopeId);
        updateScopeUrl(scopeId, 'push');
    };

    const handleScopeAddTask = (windowId: string, taskId: string) => {
        updateScopeWindows((prev) =>
            prev.map((window) =>
                window.id === windowId && !window.taskIds.includes(taskId)
                    ? { ...window, taskIds: window.taskIds.concat(taskId) }
                    : window
            )
        );
    };

    const handleScopeRemoveTask = (windowId: string, taskId: string) => {
        updateScopeWindows((prev) =>
            prev.map((window) =>
                window.id === windowId
                    ? { ...window, taskIds: window.taskIds.filter((id) => id !== taskId) }
                    : window
            )
        );
    };

    const handleScopeDelete = (windowId: string) => {
        updateScopeWindows((prev) => prev.filter((window) => window.id !== windowId));
        setScopePickerOpenId((prev) => (prev === windowId ? null : prev));
        if (windowId === activeScopeId) {
            setActiveScopeId(null);
            setScopeScreen('list');
            setScopeRouteId(null);
            updateScopeUrl(null, 'replace');
        }
    };

    const handleScopeDragOver = (event: React.DragEvent, windowId: string) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setScopeDropTargetId(windowId);
    };

    const handleScopeDragLeave = (event: React.DragEvent, windowId: string) => {
        const target = event.currentTarget as HTMLElement;
        const related = event.relatedTarget as HTMLElement | null;
        if (!related || !target.contains(related)) {
            setScopeDropTargetId((prev) => (prev === windowId ? null : prev));
        }
    };

    const handleScopeDrop = (event: React.DragEvent, windowId: string) => {
        event.preventDefault();
        const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId || '';
        if (!taskId) return;
        handleScopeAddTask(windowId, taskId);
        setScopeDropTargetId(null);
        setToastMessage('Added to scope window');
    };

    const handleScopeColumnDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('drag-over');
    };

    const handleScopeColumnDragLeave = (event: React.DragEvent) => {
        const target = event.currentTarget as HTMLElement;
        const related = event.relatedTarget as HTMLElement | null;
        if (!related || !target.contains(related)) {
            event.currentTarget.classList.remove('drag-over');
        }
    };

    const handleScopeColumnDrop = (event: React.DragEvent, status: TaskStatus) => {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId || '';
        if (!taskId || !activeScopeWindow) return;
        if (!activeScopeWindow.taskIds.includes(taskId)) return;
        const sourceTask = scopeTaskById.get(taskId);
        if (sourceTask && sourceTask.status === status) return;
        handleUpdateStatus(taskId, status);
        setToastMessage(`Moved to ${status}`);
    };

    const loadBoardsForHuddle = async (tenantId: string) => {
        if (!tenantId) return;
        if (boardsByTenant[tenantId]) return;
        try {
            const res = await fetch(`${API_BASE}/boards`, { headers: getApiHeaders(true, tenantId) });
            if (!res.ok) return;
            const data = await res.json();
            setBoardsByTenant((prev) => ({ ...prev, [tenantId]: data }));
        } catch {
            // ignore
        }
    };

    const handleObjectiveComposerSubmit = async () => {
        await submitObjective(objectiveDraft, () => {
            setObjectiveComposerOpen(false);
            setObjectiveEditId(null);
            setObjectiveDraft({
                title: '',
                description: '',
                ownerId: '',
                startDate: '',
                endDate: '',
                status: 'ACTIVE',
            });
        });
    };

    const handleEditObjective = (objective: ObjectiveView) => {
        setObjectiveEditId(objective.id);
        setObjectiveDraft({
            title: objective.title,
            description: objective.description || '',
            ownerId: objective.ownerId || '',
            startDate: toDateInput(objective.startDate),
            endDate: toDateInput(objective.endDate),
            status: objective.status || 'ACTIVE',
        });
        setIsObjectiveSettingsOpen(true);
    };

    const handleDeleteObjective = async (objectiveId: string) => {
        if (!confirm('Delete this objective and its key results?')) return;
        try {
            const res = await fetch(`${API_BASE}/okrs/objectives/${objectiveId}`, {
                method: 'DELETE',
                headers: getApiHeaders(),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete objective');
            }
            setOkrObjectives((prev) => prev.filter((objective) => objective.id !== objectiveId));
            navigateOkr('/okr');
        } catch (e: any) {
            alert(e.message);
            setOkrNotice(parsePolicyNotice(e));
        }
    };

    const handleDeleteKeyResult = async (keyResultId: string, objectiveId: string) => {
        if (!confirm('Delete this key result?')) return;
        try {
            const res = await fetch(`${API_BASE}/okrs/key-results/${keyResultId}`, {
                method: 'DELETE',
                headers: getApiHeaders(),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete key result');
            }
            setOkrObjectives((prev) =>
                prev.map((objective) =>
                    objective.id === objectiveId
                        ? { ...objective, keyResults: objective.keyResults.filter((kr) => kr.id !== keyResultId) }
                        : objective
                )
            );
        } catch (e: any) {
            alert(e.message);
            setOkrNotice(parsePolicyNotice(e));
        }
    };

    const handleDeleteBoard = async () => {
        if (!activeTenantId || !activeBoardId) return;
        if (!confirm('Delete this board and all its data? This cannot be undone.')) return;
        try {
            const res = await fetch(`${API_BASE}/boards/${activeBoardId}`, {
                method: 'DELETE',
                headers: getApiHeaders(),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete board');
            }
            const nextBoards = boards.filter((item) => item.id !== activeBoardId);
            setBoards(nextBoards);
            const nextBoard = nextBoards[0] || null;
            setActiveBoardId(nextBoard?.id || null);
            setBoard(nextBoard);
            setIsBoardSettingsOpen(false);
            try {
                if (nextBoard?.id) {
                    localStorage.setItem(`kanbax-active-board:${activeTenantId}`, nextBoard.id);
                } else {
                    localStorage.removeItem(`kanbax-active-board:${activeTenantId}`);
                }
            } catch {
                // ignore
            }
            fetchData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const getKrDraft = (objectiveId: string) =>
        krDrafts[objectiveId] || {
            title: '',
            description: '',
            assignees: [],
            startValue: '0',
            targetValue: '100',
            status: 'ON_TRACK',
        };

    const updateKrDraft = (objectiveId: string, next: Partial<{ title: string; description: string; assignees: string[]; startValue: string; targetValue: string; status: string; }>) => {
        setKrDrafts((prev) => ({
            ...prev,
            [objectiveId]: { ...getKrDraft(objectiveId), ...next },
        }));
    };

    const handleCreateKeyResult = async (objectiveId: string) => {
        const draft = getKrDraft(objectiveId);
        if (!draft.title.trim()) {
            alert('Key result title is required');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/okrs/objectives/${objectiveId}/key-results`, {
                method: 'POST',
                headers: getApiHeaders(),
                body: JSON.stringify({
                    title: draft.title.trim(),
                    description: draft.description?.trim() || null,
                    assignees: draft.assignees || [],
                    startValue: Number(draft.startValue),
                    targetValue: Number(draft.targetValue),
                    currentValue: Number(draft.startValue),
                    status: draft.status || 'ON_TRACK',
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create key result');
            }
            const created = await res.json();
            setOkrObjectives((prev) =>
                prev.map((objective) =>
                    objective.id === objectiveId
                        ? {
                            ...objective,
                            keyResults: [...objective.keyResults, created],
                            progress: objective.keyResults.length
                                ? (objective.keyResults.reduce((sum, kr) => sum + kr.progress, 0) + created.progress) / (objective.keyResults.length + 1)
                                : created.progress,
                        }
                        : objective
                )
            );
            setKrDrafts((prev) => ({
                ...prev,
                [objectiveId]: {
                    title: '',
                    description: '',
                    assignees: [],
                    startValue: draft.startValue,
                    targetValue: draft.targetValue,
                    status: 'ON_TRACK',
                },
            }));
            setOkrNotice(null);
        } catch (e: any) {
            alert(e.message);
            setOkrNotice(parsePolicyNotice(e));
        }
    };

    const openKrComposer = (objectiveId: string) => {
        setKrComposerObjectiveId(objectiveId);
        setKrComposerDraft({
            title: '',
            description: '',
            assignees: [],
            startValue: '0',
            targetValue: '100',
            status: 'ON_TRACK',
        });
        setKrEditingId(null);
        setKrComposerOpen(true);
    };

    const openKrEditor = (kr: KeyResultView, objectiveId: string) => {
        setKrComposerObjectiveId(objectiveId);
        setKrComposerDraft({
            title: kr.title,
            description: kr.description || '',
            assignees: kr.assignees || [],
            startValue: String(kr.startValue),
            targetValue: String(kr.targetValue),
            status: kr.status || 'ON_TRACK',
        });
        setKrEditingId(kr.id);
        setKrComposerOpen(true);
    };

    const [krProgressEditingId, setKrProgressEditingId] = useState<string | null>(null);
    const [krProgressDraft, setKrProgressDraft] = useState('');
    const [krStatusEditingId, setKrStatusEditingId] = useState<string | null>(null);

    const startEditKrProgress = (kr: KeyResultView) => {
        setKrProgressEditingId(kr.id);
        setKrProgressDraft(String(Math.round(kr.progress ?? 0)));
    };

    const commitKrProgress = (kr: KeyResultView, objectiveId: string) => {
        const parsed = Number(krProgressDraft);
        if (Number.isNaN(parsed)) {
            setKrProgressEditingId(null);
            return;
        }
        const clamped = Math.max(0, Math.min(100, parsed));
        const range = kr.targetValue - kr.startValue;
        const nextCurrent = kr.startValue + (range * clamped) / 100;
        handleUpdateKeyResult(kr.id, objectiveId, { currentValue: Number.isFinite(nextCurrent) ? nextCurrent : kr.currentValue });
        setKrProgressEditingId(null);
    };

    const krStatusLabel = (status: string) => {
        if (status === 'ON_TRACK') return 'On track';
        if (status === 'AT_RISK') return 'At risk';
        if (status === 'OFF_TRACK') return 'Off track';
        if (status === 'PAUSED') return 'Paused';
        if (status === 'DONE') return 'Done';
        return status;
    };

    const handleKrComposerSubmit = async () => {
        if (!krComposerObjectiveId) return;
        if (!krComposerDraft.title.trim()) {
            alert('Key result title is required');
            return;
        }
        if (krEditingId) {
            await handleUpdateKeyResult(krEditingId, krComposerObjectiveId, {
                title: krComposerDraft.title.trim(),
                description: krComposerDraft.description?.trim() || null,
                assignees: krComposerDraft.assignees || [],
                startValue: Number(krComposerDraft.startValue),
                targetValue: Number(krComposerDraft.targetValue),
                status: krComposerDraft.status || 'ON_TRACK',
            });
            setKrComposerOpen(false);
            setKrComposerObjectiveId(null);
            setKrEditingId(null);
            setKrComposerDraft({
                title: '',
                description: '',
                assignees: [],
                startValue: '0',
                targetValue: '100',
                status: 'ON_TRACK',
            });
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/okrs/objectives/${krComposerObjectiveId}/key-results`, {
                method: 'POST',
                headers: getApiHeaders(),
                body: JSON.stringify({
                    title: krComposerDraft.title.trim(),
                    description: krComposerDraft.description?.trim() || null,
                    assignees: krComposerDraft.assignees || [],
                    startValue: Number(krComposerDraft.startValue),
                    targetValue: Number(krComposerDraft.targetValue),
                    currentValue: Number(krComposerDraft.startValue),
                    status: krComposerDraft.status || 'ON_TRACK',
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create key result');
            }
            const created = await res.json();
            setOkrObjectives((prev) =>
                prev.map((objective) =>
                    objective.id === krComposerObjectiveId
                        ? {
                            ...objective,
                            keyResults: [...objective.keyResults, created],
                            progress: objective.keyResults.length
                                ? (objective.keyResults.reduce((sum, kr) => sum + kr.progress, 0) + created.progress) / (objective.keyResults.length + 1)
                                : created.progress,
                        }
                        : objective
                )
            );
            setKrComposerOpen(false);
            setKrComposerObjectiveId(null);
            setKrComposerDraft({
                title: '',
                description: '',
                assignees: [],
                startValue: '0',
                targetValue: '100',
                status: 'ON_TRACK',
            });
            setOkrNotice(null);
        } catch (e: any) {
            alert(e.message);
            setOkrNotice(parsePolicyNotice(e));
        }
    };

    const handleUpdateKeyResult = async (keyResultId: string, objectiveId: string, next: Partial<OkrKeyResult>) => {
        try {
            const res = await fetch(`${API_BASE}/okrs/key-results/${keyResultId}`, {
                method: 'PATCH',
                headers: getApiHeaders(),
                body: JSON.stringify(next),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update key result');
            }
            const updated = await res.json();
            setOkrObjectives((prev) =>
                prev.map((objective) => {
                    if (objective.id !== objectiveId) return objective;
                    const nextKeyResults = objective.keyResults.map((kr) => (kr.id === keyResultId ? { ...kr, ...updated } : kr));
                    const progress = nextKeyResults.length
                        ? nextKeyResults.reduce((sum, kr) => sum + kr.progress, 0) / nextKeyResults.length
                        : 0;
                    return { ...objective, keyResults: nextKeyResults, progress };
                })
            );
            setOkrNotice(null);
        } catch (e: any) {
            alert(e.message);
            setOkrNotice(parsePolicyNotice(e));
        }
    };

    const normalizeKrStatus = (status: string): KrStatus => {
        const normalized = status?.toUpperCase?.() || 'ON_TRACK';
        if (normalized === 'AT_RISK') return 'AT_RISK';
        if (normalized === 'OFF_TRACK') return 'OFF_TRACK';
        return 'ON_TRACK';
    };

    const computeProgressFromKrs = (krs: KeyResultView[]) => {
        if (krs.length === 0) return 0;
        const total = krs.reduce((sum, kr) => sum + kr.progress, 0);
        return Math.round(total / krs.length);
    };
    const isOpenTask = (task: TaskView) => task.status !== 'DONE';
    const getDueStatus = (task: TaskView): 'overdue' | 'due-soon' | 'none' => {
        if (!task?.dueDate) return 'none';
        if (task.status === TaskStatus.DONE || task.status === TaskStatus.ARCHIVED) return 'none';
        const due = new Date(task.dueDate);
        if (Number.isNaN(due.getTime())) return 'none';
        const now = new Date();
        const soonHours = settingsDraft?.reminders?.dueSoonHours ?? 24;
        const soonWindow = new Date(now.getTime() + soonHours * 60 * 60 * 1000);
        if (due < now) return 'overdue' as const;
        if (due <= soonWindow) return 'due-soon' as const;
        return 'none';
    };
    const toDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const buildSeriesForDays = (
        items: Array<{ updatedAt?: string; createdAt?: string }>,
        dayStart: Date,
        daysBack: number,
        predicate?: (item: any) => boolean
    ) => {
        const series: number[] = [];
        for (let i = daysBack - 1; i >= 0; i -= 1) {
            const start = new Date(dayStart);
            start.setDate(dayStart.getDate() - i);
            const end = new Date(start);
            end.setDate(start.getDate() + 1);
            const count = items.filter((item) => {
                const timestamp = new Date(item.updatedAt || item.createdAt || 0).getTime();
                if (!timestamp) return false;
                if (timestamp < start.getTime() || timestamp >= end.getTime()) return false;
                return predicate ? predicate(item) : true;
            }).length;
            series.push(count);
        }
        return series;
    };
    const renderMiniBars = (series: number[]) => {
        if (!series || series.length === 0) return null;
        const max = Math.max(...series, 1);
        return (
            <div className="dashboard-mini-bars">
                {series.map((value, index) => (
                    <span
                        key={`bar-${index}`}
                        className="dashboard-mini-bar"
                        style={{ height: `${Math.round((value / max) * 100)}%` }}
                    />
                ))}
            </div>
        );
    };
    const renderInverseBars = (series: number[], variant: 'ink' | 'lime' | 'ice', invert = false) => {
        if (!series || series.length === 0) return null;
        const max = Math.max(...series, 1);
        return (
            <div className={`dashboard-inverse-bars ${variant}${invert ? ' inverted' : ''}`}>
                {series.map((value, index) => (
                    <span
                        key={`inverse-bar-${variant}-${index}`}
                        className="dashboard-inverse-bar"
                        style={{
                            height: `${Math.round((value / max) * 100)}%`,
                            ['--bar-index' as any]: index,
                        }}
                    />
                ))}
            </div>
        );
    };
    const renderLineChart = (
        seriesList: Array<{ key: string; label: string; series: number[]; className: string }>,
        options?: {
            width?: number;
            height?: number;
            padding?: number;
            labels?: string[];
            hoverIndex?: number | null;
            onHover?: (index: number | null) => void;
        }
    ) => {
        if (!seriesList.length) return null;
        const width = options?.width ?? 220;
        const height = options?.height ?? 76;
        const padding = options?.padding ?? 10;
        const hoverIndex = options?.hoverIndex ?? null;
        const allValues = seriesList.flatMap((item) => item.series);
        const maxValue = Math.max(...allValues, 1);
        const minValue = Math.min(...allValues, 0);
        const valueRange = maxValue - minValue || 1;
        const labels = options?.labels ?? seriesList[0]?.series.map((_, idx) => `Day ${idx + 1}`) ?? [];
        const span = Math.max(seriesList[0]?.series.length - 1, 1);
        const getPoint = (series: number[], index: number) => {
            const x = padding + (index / span) * (width - padding * 2);
            const value = series[Math.min(index, series.length - 1)] ?? 0;
            const y = height - padding - ((value - minValue) / valueRange) * (height - padding * 2);
            return { x, y, value };
        };
        const buildPath = (series: number[]) => {
            if (!series.length) return '';
            const points = series.map((value, index) => {
                const x = padding + (index / span) * (width - padding * 2);
                const y = height - padding - ((value - minValue) / valueRange) * (height - padding * 2);
                return { x, y };
            });
            if (points.length < 3) {
                return points
                    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
                    .join(' ');
            }
            let path = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
            for (let i = 1; i < points.length - 1; i += 1) {
                const midX = (points[i].x + points[i + 1].x) / 2;
                const midY = (points[i].y + points[i + 1].y) / 2;
                path += ` Q${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
            }
            const last = points[points.length - 1];
            path += ` T${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
            return path;
        };
        const handleHover = (event: React.MouseEvent<HTMLDivElement>) => {
            if (!options?.onHover || !labels.length) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const padPx = (padding / width) * rect.width;
            const relativeX = event.clientX - rect.left;
            const clamped = Math.min(Math.max(relativeX, padPx), rect.width - padPx);
            const ratio = (clamped - padPx) / Math.max(rect.width - padPx * 2, 1);
            const index = Math.round(ratio * span);
            options.onHover(index);
        };
        const handleLeave = () => {
            if (options?.onHover) options.onHover(null);
        };
        const hoverX = hoverIndex === null ? null : getPoint(seriesList[0].series, hoverIndex).x;
        const hoverXPercent = hoverX === null ? null : (hoverX / width) * 100;
        const seriesLabels = seriesList.map((item) => {
            const lastIndex = Math.max(item.series.length - 1, 0);
            const point = getPoint(item.series, lastIndex);
            return {
                key: item.key,
                label: item.label,
                value: point.value,
                className: item.className,
                left: (point.x / width) * 100,
                top: (point.y / height) * 100,
            };
        });
        return (
            <div className="dashboard-line-chart" onMouseMove={handleHover} onMouseLeave={handleLeave}>
                <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
                    <g className="dashboard-line-grid">
                        <line x1="0" y1={height - padding} x2={width} y2={height - padding} />
                        <line x1="0" y1={height * 0.66} x2={width} y2={height * 0.66} />
                        <line x1="0" y1={height * 0.33} x2={width} y2={height * 0.33} />
                    </g>
                    {hoverX !== null && (
                        <line className="dashboard-line-marker" x1={hoverX} y1={padding} x2={hoverX} y2={height - padding} />
                    )}
                    {seriesList.map((item) => (
                        <path key={item.key} className={`dashboard-line-path ${item.className}`} d={buildPath(item.series)} />
                    ))}
                    {hoverIndex !== null &&
                        seriesList.map((item) => {
                            const point = getPoint(item.series, hoverIndex);
                            return (
                                <circle
                                    key={`${item.key}-point`}
                                    className={`dashboard-line-point ${item.className}`}
                                    cx={point.x}
                                    cy={point.y}
                                    r={3}
                                />
                            );
                        })}
                </svg>
                {seriesLabels.map((label) => (
                    <span
                        key={`${label.key}-label`}
                        className={`dashboard-line-label ${label.className}`}
                        style={{ left: `calc(${label.left}% + 6px)`, top: `${label.top}%` }}
                    >
                        {label.label} {label.value}
                    </span>
                ))}
                {hoverIndex !== null && hoverXPercent !== null && (
                    <div className="dashboard-line-tooltip" style={{ left: `${hoverXPercent}%` }}>
                        <div className="tooltip-title">{labels[hoverIndex] ?? ''}</div>
                        {seriesList.map((item) => (
                            <div key={`${item.key}-tip`} className={`tooltip-row ${item.className}`}>
                                <span>{item.label}</span>
                                <strong>{item.series[hoverIndex] ?? 0}</strong>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };
    const renderChangeBadge = (delta: number) => {
        const direction = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
        const value = Math.abs(delta);
        return (
            <span className={`stat-change ${direction}`}>
                {direction === 'up' && (
                    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.8">
                        <path d="M10 4l5 6h-3v6H8v-6H5l5-6z" />
                    </svg>
                )}
                {direction === 'down' && (
                    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.8">
                        <path d="M10 16l-5-6h3V4h4v6h3l-5 6z" />
                    </svg>
                )}
                {direction === 'flat' && (
                    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.8">
                        <path d="M4 10h12" />
                    </svg>
                )}
                {value}%
            </span>
        );
    };

    const objectiveViews = useMemo<ObjectiveView[]>(() => {
        return okrObjectives.map((objective) => {
            const keyResults: KeyResultView[] = (objective.keyResults || []).map((kr) => ({
                id: kr.id,
                objectiveId: kr.objectiveId,
                title: kr.title,
                description: kr.description ?? null,
                assignees: kr.assignees ?? [],
                metricType: 'NUMERIC',
                startValue: kr.startValue,
                targetValue: kr.targetValue,
                currentValue: kr.currentValue,
                status: normalizeKrStatus(kr.status),
                progress: Math.round(kr.progress ?? 0),
                lastUpdatedAt: kr.updatedAt || kr.createdAt,
            }));
            const progress = computeProgressFromKrs(keyResults);
            const sourceType = (objective as any).sourceType;
            const base: ObjectiveView = {
                id: objective.id,
                title: objective.title,
                description: objective.description ?? null,
                ownerId: objective.ownerId ?? null,
                startDate: objective.startDate ?? null,
                endDate: objective.endDate ?? null,
                status: objective.status,
                confidence: typeof objective.confidence === 'number' ? objective.confidence : 0,
                progress,
                keyResults,
                readOnly: Boolean(sourceType && sourceType !== 'MANUAL'),
            };
            return base;
        });
    }, [okrObjectives]);

    const dashboardTasks = useMemo(() => {
        if (!activeTenantId) return [];
        return tasksByTenant[activeTenantId] || tasks || [];
    }, [activeTenantId, tasksByTenant, tasks]);

    const scopeTaskPool = useMemo(() => {
        if (!activeTenantId) return tasks || [];
        return scopeTasksByTenant[activeTenantId] || tasksByTenant[activeTenantId] || tasks || [];
    }, [activeTenantId, scopeTasksByTenant, tasksByTenant, tasks]);

    const scopeTaskById = useMemo(() => {
        return new Map(scopeTaskPool.map((task) => [task.id, task]));
    }, [scopeTaskPool]);

    const dashboardSummary = useMemo(() => {
        const now = new Date();
        const soon = new Date();
        soon.setDate(now.getDate() + 7);
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const validTasks = dashboardTasks.filter((task) => task && task.id);
        const parseDate = (value?: string | null) => (value ? new Date(value) : null);
        const statusCounts = validTasks.reduce<Record<string, number>>((acc, task) => {
            const status = task.status || 'UNKNOWN';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        const doneCount = statusCounts.DONE || 0;
        const activitySeries14 = buildSeriesForDays(validTasks, dayStart, 14);
        const completionSeries14 = buildSeriesForDays(validTasks, dayStart, 14, (task) => task.status === 'DONE');
        const openSeries14 = buildSeriesForDays(validTasks, dayStart, 14, (task) => isOpenTask(task));
        const keyResults = objectiveViews.flatMap((objective) => objective.keyResults);
        const krSeries14 = buildSeriesForDays(keyResults as Array<{ updatedAt?: string; createdAt?: string }>, dayStart, 14);
        const activitySeries = activitySeries14.slice(7);
        const completionSeries = completionSeries14.slice(7);
        const openSeries = openSeries14.slice(7);
        const krSeries = krSeries14.slice(7);
        const sumSeries = (series: number[]) => series.reduce((sum, value) => sum + value, 0);
        const calcDelta = (current: number[], previous: number[]) => {
            const currentSum = sumSeries(current);
            const prevSum = sumSeries(previous);
            if (prevSum === 0) return currentSum === 0 ? 0 : 100;
            return Math.round(((currentSum - prevSum) / prevSum) * 100);
        };
        const activityTotal14 = sumSeries(activitySeries14);
        const completionTotal14 = sumSeries(completionSeries14);
        const openTotal14 = sumSeries(openSeries14);
        const krTotal14 = sumSeries(krSeries14);
        const activityChange = calcDelta(activitySeries, activitySeries14.slice(0, 7));
        const dueSoonTasks = validTasks
            .filter((task) => {
                const due = parseDate(task.dueDate);
                return due && due >= now && due <= soon && isOpenTask(task);
            })
            .sort((a, b) => new Date(a.dueDate || '').getTime() - new Date(b.dueDate || '').getTime())
            .slice(0, 5);
        const overdueTasks = validTasks
            .filter((task) => {
                const due = parseDate(task.dueDate);
                return due && due < now && isOpenTask(task);
            })
            .sort((a, b) => new Date(a.dueDate || '').getTime() - new Date(b.dueDate || '').getTime())
            .slice(0, 5);
        const recentTasks = [...validTasks]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5);
        const favoriteTasks = validTasks.filter((task) => task.isFavorite).slice(0, 5);
        const activeTasks = validTasks.filter(isOpenTask).slice(0, 5);
        const boardCount = activeTenantId ? (boardsByTenant[activeTenantId]?.length ?? boards.length) : boards.length;
        const averageKrProgress = keyResults.length
            ? Math.round(keyResults.reduce((sum, kr) => sum + kr.progress, 0) / keyResults.length)
            : 0;
        const atRiskKrs = keyResults.filter((kr) => kr.status !== 'ON_TRACK').length;
        return {
            totalTasks: validTasks.length,
            openTasks: validTasks.filter(isOpenTask).length,
            dueSoonCount: validTasks.filter((task) => {
                const due = parseDate(task.dueDate);
                return due && due >= now && due <= soon && isOpenTask(task);
            }).length,
            overdueCount: validTasks.filter((task) => {
                const due = parseDate(task.dueDate);
                return due && due < now && isOpenTask(task);
            }).length,
            favoriteCount: validTasks.filter((task) => task.isFavorite).length,
            completionRate: validTasks.length ? Math.round((doneCount / validTasks.length) * 100) : 0,
            doneCount,
            statusCounts,
            boardCount,
            objectiveCount: objectiveViews.length,
            keyResultCount: keyResults.length,
            atRiskKrs,
            averageKrProgress,
            activitySeries,
            completionSeries,
            openSeries,
            krSeries,
            activitySeries14,
            completionSeries14,
            openSeries14,
            krSeries14,
            activityTotal14,
            completionTotal14,
            openTotal14,
            krTotal14,
            activityChange,
            openChange: calcDelta(openSeries, openSeries14.slice(0, 7)),
            completionChange: calcDelta(completionSeries, completionSeries14.slice(0, 7)),
            okrChange: calcDelta(krSeries, krSeries14.slice(0, 7)),
            activeTasks,
            dueSoonTasks,
            overdueTasks,
            recentTasks,
            favoriteTasks,
        };
    }, [dashboardTasks, activeTenantId, boardsByTenant, boards.length, objectiveViews]);

    const lineChartSeries = useMemo(() => {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const validTasks = dashboardTasks.filter((task) => task && task.id);
        const keyResults = objectiveViews.flatMap((objective) => objective.keyResults);
        return {
            activity: buildSeriesForDays(validTasks, dayStart, lineRangeDays),
            done: buildSeriesForDays(validTasks, dayStart, lineRangeDays, (task) => task.status === 'DONE'),
            open: buildSeriesForDays(validTasks, dayStart, lineRangeDays, (task) => isOpenTask(task)),
            kr: buildSeriesForDays(keyResults as Array<{ updatedAt?: string; createdAt?: string }>, dayStart, lineRangeDays),
        };
    }, [dashboardTasks, objectiveViews, lineRangeDays]);

    const lineChartTotals = useMemo(() => {
        const sumSeries = (series: number[]) => series.reduce((sum, value) => sum + value, 0);
        return {
            activity: sumSeries(lineChartSeries.activity),
            done: sumSeries(lineChartSeries.done),
            open: sumSeries(lineChartSeries.open),
            kr: sumSeries(lineChartSeries.kr),
        };
    }, [lineChartSeries]);

    const lineChartLabels = useMemo(() => {
        const count = lineChartSeries.activity.length;
        if (!count) return [];
        const today = new Date();
        return Array.from({ length: count }, (_, index) => {
            const date = new Date(today);
            date.setDate(today.getDate() - (count - 1 - index));
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        });
    }, [lineChartSeries.activity.length]);

    const attentionTasks = useMemo(() => {
        const items: TaskView[] = [];
        const seen = new Set<string>();
        const pushTask = (task?: TaskView | null) => {
            if (!task || seen.has(task.id)) return;
            seen.add(task.id);
            items.push(task);
        };
        dashboardSummary.overdueTasks.forEach(pushTask);
        dashboardSummary.dueSoonTasks.forEach(pushTask);
        if (items.length < 5) {
            dashboardSummary.activeTasks.forEach(pushTask);
        }
        return items.slice(0, 5);
    }, [dashboardSummary.overdueTasks, dashboardSummary.dueSoonTasks, dashboardSummary.activeTasks]);

    const calendarRange = useMemo(() => {
        const base = new Date(calendarDate);
        base.setHours(0, 0, 0, 0);
        const firstOfMonth = new Date(base.getFullYear(), base.getMonth(), 1);
        const startOffset = (firstOfMonth.getDay() + 6) % 7;
        const start = new Date(firstOfMonth);
        start.setDate(firstOfMonth.getDate() - startOffset);
        const days = Array.from({ length: 42 }, (_, index) => {
            const day = new Date(start);
            day.setDate(start.getDate() + index);
            return day;
        });
        const end = new Date(days[days.length - 1]);
        end.setHours(23, 59, 59, 999);
        return { start, end, days };
    }, [calendarDate]);

    const calendarEventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        calendarEvents.forEach((event) => {
            const start = new Date(event.start);
            const end = new Date(event.end);
            const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
            if (event.allDay && endDay.getTime() === end.getTime()) {
                endDay.setDate(endDay.getDate() - 1);
            }
            let guard = 0;
            while (current <= endDay && guard < 40) {
                const key = toDateKey(current);
                const list = map.get(key) || [];
                list.push(event);
                map.set(key, list);
                current.setDate(current.getDate() + 1);
                guard += 1;
            }
        });
        map.forEach((value) => {
            value.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        });
        return map;
    }, [calendarEvents]);

    const selectedCalendarKey = useMemo(() => toDateKey(calendarSelectedDate), [calendarSelectedDate]);
    const selectedDayEvents = calendarEventsByDay.get(selectedCalendarKey) || [];
    const calendarMonthLabel = useMemo(
        () => calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        [calendarDate]
    );
    const calendarWeekdays = useMemo(() => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], []);

    const showLegacyOkr = useMemo(() => {
        try {
            return localStorage.getItem('kanbax-okr-legacy') === '1';
        } catch {
            return false;
        }
    }, []);

    const openObjectiveFocus = (objectiveId: string) => {
        navigateOkr(`/okr/objective/${objectiveId}`);
        setOkrRecent((prev) => {
            const next = [objectiveId, ...prev.filter((id) => id !== objectiveId)].slice(0, 8);
            return next;
        });
    };

    const togglePinObjective = (objectiveId: string) => {
        setOkrPinned((prev) => {
            if (prev.includes(objectiveId)) {
                return prev.filter((id) => id !== objectiveId);
            }
            return [objectiveId, ...prev].slice(0, 6);
        });
    };

    const okrActiveObjective = useMemo(
        () => objectiveViews.find((objective) => objective.id === okrRoute?.objectiveId),
        [objectiveViews, okrRoute]
    );
    const okrScreen = okrRoute?.screen || 'library';
    useEffect(() => {
        if (okrScreen === 'review') {
            setReviewStep(0);
        }
    }, [okrScreen, okrRoute?.objectiveId]);

    useEffect(() => {
        if (view !== 'calendar' || !session || !activeTenantId) return;
        fetchCalendarImports();
    }, [view, session, activeTenantId]);

    useEffect(() => {
        if (view !== 'calendar' || !session || !activeTenantId) return;
        fetchCalendarEvents(calendarRange.start, calendarRange.end);
    }, [view, session, activeTenantId, calendarRange.start.getTime(), calendarRange.end.getTime()]);

    useEffect(() => {
        if (view !== 'calendar' || !session || !activeTenantId) return;
        const refresh = () => fetchCalendarEvents(calendarRange.start, calendarRange.end);
        const interval = window.setInterval(refresh, 180000);
        const onVisibility = () => {
            if (!document.hidden) refresh();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [view, session, activeTenantId, calendarRange.start.getTime(), calendarRange.end.getTime()]);

    const okrPeriphery = useMemo(() => {
        const pinned = okrPinned.map((id) => objectiveViews.find((obj) => obj.id === id)).filter(Boolean) as ObjectiveView[];
        const recent = okrRecent.map((id) => objectiveViews.find((obj) => obj.id === id)).filter(Boolean) as ObjectiveView[];
        const suggested = objectiveViews
            .filter((obj) => !okrPinned.includes(obj.id) && !okrRecent.includes(obj.id))
            .sort((a, b) => b.progress - a.progress)
            .slice(0, 5);
        return { pinned, recent, suggested };
    }, [okrPinned, okrRecent, objectiveViews]);

    const reviewSteps = useMemo(() => {
        if (!okrActiveObjective) return [];
        return [
            {
                title: 'Relevance check',
                content: 'Is this objective still aligned with the current quarter?',
            },
            {
                title: 'KR validity check',
                content: 'Do the metrics still represent success?',
            },
            {
                title: 'Update KR values',
                content: okrActiveObjective.readOnly ? (
                    <div className="okr-empty">This objective is read-only due to its source.</div>
                ) : (
                    <div className="okr-review-kr">
                        {okrActiveObjective.keyResults.map((kr) => (
                            <label key={kr.id}>
                                {kr.title}
                                <input
                                    type="number"
                                    defaultValue={kr.currentValue}
                                    onBlur={(e) => handleUpdateKeyResult(kr.id, okrActiveObjective.id, { currentValue: Number(e.target.value) })}
                                />
                            </label>
                        ))}
                    </div>
                ),
            },
            {
                title: 'Review summary',
                content: `Progress ${okrActiveObjective.progress}% · ${okrActiveObjective.keyResults.length} key results`,
            },
        ];
    }, [okrActiveObjective]);

    useEffect(() => {
        if (session && activeTenantId) {
            fetchData();
        }
    }, [session, activeTenantId]);

    useEffect(() => {
        try {
            localStorage.setItem('kanbax-okr-pinned', JSON.stringify(okrPinned));
        } catch {
            // ignore
        }
    }, [okrPinned]);

    useEffect(() => {
        try {
            localStorage.setItem('kanbax-okr-recent', JSON.stringify(okrRecent));
        } catch {
            // ignore
        }
    }, [okrRecent]);

    useEffect(() => {
        try {
            localStorage.setItem('kanbax-scope-windows', JSON.stringify(scopeWindowsByBoard));
        } catch {
            // ignore
        }
    }, [scopeWindowsByBoard]);

    useEffect(() => {
        if (view === 'okr') {
            loadOkrs();
        }
    }, [view, session, activeTenantId, activeBoardId]);

    useEffect(() => {
        if (view !== 'scope' || !activeTenantId || !session?.access_token) return;
        let cancelled = false;
        const loadScopeTasks = async () => {
            try {
                const res = await fetch(`${API_BASE}/tasks?boardId=all`, { headers: getApiHeaders(true, activeTenantId) });
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) {
                    setScopeTasksByTenant((prev) => ({ ...prev, [activeTenantId]: data }));
                }
            } catch {
                // ignore scope task load errors
            }
        };
        loadScopeTasks();
        return () => {
            cancelled = true;
        };
    }, [view, activeTenantId, session?.access_token]);

    useEffect(() => {
        try {
            localStorage.setItem('kanbax-sidebar-collapsed', String(isSidebarCollapsed));
        } catch {
            // ignore
        }
    }, [isSidebarCollapsed]);

    useEffect(() => {
        if (isSidebarCollapsed) {
            setIsBoardNavOpen(false);
        }
    }, [isSidebarCollapsed]);

    useEffect(() => {
        if (isSidebarCollapsed && view !== 'kanban' && view !== 'table') {
            setIsBoardNavOpen(false);
        }
    }, [isSidebarCollapsed, view]);

    useEffect(() => {
        setScopePickerOpenId(null);
        setScopePickerQuery('');
    }, [activeTenantId]);

    useEffect(() => {
        if (isSidebarCollapsed) {
            setIsOkrNavOpen(false);
        }
    }, [isSidebarCollapsed]);

    useEffect(() => {
        if (isSidebarCollapsed && view !== 'okr') {
            setIsOkrNavOpen(false);
        }
    }, [isSidebarCollapsed, view]);

    useEffect(() => {
        const tooltip = document.createElement('div');
        tooltip.className = 'app-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
        document.body.appendChild(tooltip);

        let activeTarget: HTMLElement | null = null;
        let rafId: number | null = null;

        const getTooltipText = (el: HTMLElement) => {
            const raw =
                el.getAttribute('data-tooltip') ||
                el.getAttribute('data-label') ||
                el.getAttribute('title') ||
                '';
            const text = raw.trim();
            return text || null;
        };

        const restoreTitle = (el: HTMLElement) => {
            if (el.dataset.tooltipTitle !== undefined) {
                el.setAttribute('title', el.dataset.tooltipTitle);
                delete el.dataset.tooltipTitle;
            }
        };

        const positionTooltip = () => {
            if (!activeTarget) return;
            const text = getTooltipText(activeTarget);
            if (!text) return;
            const rect = activeTarget.getBoundingClientRect();
            const tipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const spacing = 8;
            const isCollapsed = document.querySelector('.dashboard')?.classList.contains('sidebar-collapsed');
            const isSidebarTarget = Boolean(activeTarget.closest('.sidebar')) && Boolean(isCollapsed);

            let top: number;
            let left: number;

            if (isSidebarTarget) {
                left = rect.right + spacing;
                top = rect.top + rect.height / 2 - tipRect.height / 2;
                if (left + tipRect.width > viewportWidth - spacing) {
                    left = rect.left - spacing - tipRect.width;
                }
            } else {
                top = rect.top - spacing - tipRect.height;
                left = rect.left + rect.width / 2 - tipRect.width / 2;
                if (top < spacing) {
                    top = rect.bottom + spacing;
                }
            }

            left = Math.max(spacing, Math.min(left, viewportWidth - spacing - tipRect.width));
            top = Math.max(spacing, Math.min(top, viewportHeight - spacing - tipRect.height));

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        };

        const schedulePosition = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = window.requestAnimationFrame(positionTooltip);
        };

        const showTooltip = (target: HTMLElement) => {
            const text = getTooltipText(target);
            if (!text) return;
            if (activeTarget && activeTarget !== target) {
                restoreTitle(activeTarget);
            }
            activeTarget = target;
            if (target.hasAttribute('title')) {
                target.dataset.tooltipTitle = target.getAttribute('title') || '';
                target.removeAttribute('title');
            }
            tooltip.textContent = text;
            tooltip.style.opacity = '1';
            tooltip.style.visibility = 'visible';
            schedulePosition();
        };

        const hideTooltip = () => {
            if (activeTarget) {
                restoreTitle(activeTarget);
            }
            activeTarget = null;
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
        };

        const resolveTarget = (eventTarget: EventTarget | null) => {
            if (!(eventTarget instanceof HTMLElement)) return null;
            return eventTarget.closest('[data-tooltip], [data-label], [title]') as HTMLElement | null;
        };

        const handlePointerOver = (event: PointerEvent) => {
            const target = resolveTarget(event.target);
            if (!target) return;
            if (activeTarget && (target === activeTarget || activeTarget.contains(target))) return;
            showTooltip(target);
        };

        const handlePointerOut = (event: PointerEvent) => {
            if (!activeTarget) return;
            const relatedNode = event.relatedTarget as Node | null;
            if (relatedNode && activeTarget.contains(relatedNode)) return;
            const target = resolveTarget(event.target);
            if (target && target !== activeTarget) return;
            hideTooltip();
        };

        const handleFocusIn = (event: FocusEvent) => {
            const target = resolveTarget(event.target);
            if (!target) return;
            showTooltip(target);
        };

        const handleFocusOut = () => {
            hideTooltip();
        };

        const handleViewportChange = () => {
            if (activeTarget) schedulePosition();
        };

        document.addEventListener('pointerover', handlePointerOver);
        document.addEventListener('pointerout', handlePointerOut);
        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);
        window.addEventListener('scroll', handleViewportChange, true);
        window.addEventListener('resize', handleViewportChange);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            document.removeEventListener('pointerover', handlePointerOver);
            document.removeEventListener('pointerout', handlePointerOut);
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
            window.removeEventListener('scroll', handleViewportChange, true);
            window.removeEventListener('resize', handleViewportChange);
            tooltip.remove();
        };
    }, []);

    const loadProfile = async () => {
        if (!session?.access_token) return;
        setProfileLoaded(false);
        try {
            const res = await fetch(`${API_BASE}/me`, { headers: getApiHeaders(false) });
            if (!res.ok) throw new Error('Failed to load profile');
            const data = await res.json();
            setUserProfile(data.user);
            setMemberships(data.memberships || []);
            setInvites(data.invites || []);
            const nextInviteIds = new Set<string>((data.invites || []).map((invite: any) => String(invite.id)));
            const newInvites = (data.invites || []).filter((invite: any) => !inviteSnapshotRef.current.has(invite.id));
            if (inviteSnapshotRef.current.size > 0 && newInvites.length > 0) {
                newInvites.forEach((invite: any) => {
                    const huddleName = getHuddleName(invite.tenant?.name) || invite.tenantId;
                    const inviter = invite.invitedBy?.name || invite.invitedBy?.email || invite.invitedByUserId || 'Someone';
                    setNotifications((prev) => [
                        {
                            id: `invite-${invite.id}`,
                            message: `${inviter} invited you to ${huddleName}`,
                            huddleName,
                            timestamp: new Date(invite.createdAt || Date.now()).toISOString(),
                            read: false,
                            tenantId: invite.tenantId,
                        },
                        ...prev,
                    ]);
                });
            }
            inviteSnapshotRef.current = nextInviteIds;
            const preferredHuddle = data.user?.preferences?.defaultHuddleId;
            const hasActive = activeTenantId && data.memberships?.some((m: any) => m.tenantId === activeTenantId);
            const preferredMembership = data.memberships?.find((m: any) => m.tenantId === preferredHuddle);
            const fallbackMembership = data.memberships?.[0];
            if (!hasActive && (preferredMembership?.tenantId || fallbackMembership?.tenantId)) {
                updateActiveTenant(preferredMembership?.tenantId || fallbackMembership?.tenantId);
            }
        } catch (e: any) {
            setAuthError(e.message);
        } finally {
            setProfileLoaded(true);
        }
    };

    useEffect(() => {
        loadProfile();
    }, [session]);

    useEffect(() => {
        if (userProfile && settingsDraft === null) {
            setSettingsDraft(buildSettingsDraft(userProfile));
        }
    }, [userProfile, settingsDraft]);

    useEffect(() => {
        if (isTeamModalOpen && activeTenantId) {
            loadTeamMembers(activeTenantId);
        }
    }, [isTeamModalOpen, activeTenantId]);

    useEffect(() => {
        if (activeTenantId) {
            loadMembersForHuddle(activeTenantId);
        }
    }, [activeTenantId]);

    useEffect(() => {
        if (newTaskHuddleId) {
            loadMembersForHuddle(newTaskHuddleId);
        }
    }, [newTaskHuddleId]);

    useEffect(() => {
        if (editTaskHuddleId) {
            loadMembersForHuddle(editTaskHuddleId);
        }
    }, [editTaskHuddleId]);

    useEffect(() => {
        if (!newTaskHuddleId) return;
        loadBoardsForHuddle(newTaskHuddleId);
        const members = getMembersForTenant(newTaskHuddleId);
        if (members.length === 0) return;
        const allowedIds = new Set(members.map((member) => member.userId));
        if (newTaskOwnerId && !allowedIds.has(newTaskOwnerId)) {
            setNewTaskOwnerId(null);
        }
        if (newTaskAssignees.length > 0) {
            setNewTaskAssignees(newTaskAssignees.filter((id) => allowedIds.has(id)));
        }
    }, [newTaskHuddleId, huddleMembersByTenant]);

    useEffect(() => {
        if (!newTaskHuddleId) return;
        const availableBoards = getWritableBoards(newTaskHuddleId);
        if (availableBoards.length === 0) return;
        if (!newTaskBoardId || !availableBoards.some((item) => item.id === newTaskBoardId)) {
            setNewTaskBoardId(availableBoards[0].id);
        }
    }, [newTaskHuddleId, newTaskBoardId, boardsByTenant, boards]);

    useEffect(() => {
        if (!editTaskHuddleId) return;
        loadBoardsForHuddle(editTaskHuddleId);
        const members = getMembersForTenant(editTaskHuddleId);
        if (members.length === 0) return;
        const allowedIds = new Set(members.map((member) => member.userId));
        if (editTaskOwnerId && !allowedIds.has(editTaskOwnerId)) {
            setEditTaskOwnerId(null);
        }
        if (editTaskAssignees.length > 0) {
            setEditTaskAssignees(editTaskAssignees.filter((id) => allowedIds.has(id)));
        }
    }, [editTaskHuddleId, huddleMembersByTenant]);

    useEffect(() => {
        if (!editTaskHuddleId) return;
        const availableBoards = getWritableBoards(editTaskHuddleId);
        if (!availableBoards || availableBoards.length === 0) return;
        if (!editTaskBoardId || !availableBoards.some((item) => item.id === editTaskBoardId)) {
            setEditTaskBoardId(availableBoards[0].id);
        }
    }, [editTaskHuddleId, boardsByTenant, editTaskBoardId]);

    useEffect(() => {
        if (isModalOpen && newDescriptionRef.current) {
            newDescriptionRef.current.innerHTML = newTask.description || '';
        }
    }, [isModalOpen]);

    useEffect(() => {
        if (isEditModalOpen && editDescriptionRef.current) {
            editDescriptionRef.current.innerHTML = editTask.description || '';
        }
    }, [isEditModalOpen]);

    const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) ?? null : null;
    const incomingLinkedTasks = selectedTask
        ? tasks.filter((task) => (task.linkedTaskIds || []).includes(selectedTask.id))
        : [];
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const currentUserLabel = String(userProfile?.email || session?.user?.email || 'U');
    const currentUserInitial = currentUserLabel.charAt(0).toUpperCase() || 'U';
    const currentUserAvatar = settingsDraft?.avatarUrl || userProfile?.avatarUrl || '';
    const toDateInput = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '');
    const isArchivedBoard = activeBoardId === ARCHIVED_BOARD_ID;
    const activeBoard = isArchivedBoard
        ? { id: ARCHIVED_BOARD_ID, name: 'Archived', columns: [] }
        : (boards.find((item) => item.id === activeBoardId) || board);
    const getBoardInitials = (name?: string | null) => {
        const clean = (name || '').trim();
        if (!clean) return 'B';
        const parts = clean.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    };
    const updateScopeUrl = (scopeId: string | null, mode: 'push' | 'replace' = 'push') => {
        const params = new URLSearchParams(window.location.search);
        if (scopeId) {
            params.set('scope', scopeId);
        } else {
            params.delete('scope');
        }
        const next = params.toString();
        const url = `${window.location.pathname}${next ? `?${next}` : ''}`;
        if (mode === 'replace') {
            window.history.replaceState({}, '', url);
        } else {
            window.history.pushState({}, '', url);
        }
    };
    const boardLabelById = useMemo(() => {
        const list = activeTenantId ? (boardsByTenant[activeTenantId] || boards) : boards;
        const map = new Map<string, string>();
        (list || []).forEach((boardItem) => {
            if (boardItem?.id) {
                map.set(boardItem.id, boardItem.name || 'Board');
            }
        });
        map.set(ARCHIVED_BOARD_ID, 'Archived');
        if (!map.has('default-board')) {
            map.set('default-board', 'Main Board');
        }
        return map;
    }, [activeTenantId, boardsByTenant, boards]);
    const getBoardLabel = (boardId?: string | null) => {
        if (!boardId) return 'Board';
        return boardLabelById.get(boardId) || (boardId === 'all' ? 'All' : boardId);
    };
    const scopeKey = activeTenantId || null;
    const scopeWindows = useMemo(() => {
        if (!scopeKey) return [];
        return scopeWindowsByBoard[scopeKey] || [];
    }, [scopeKey, scopeWindowsByBoard]);
    const activeScopeWindow = useMemo(() => {
        if (!activeScopeId) return null;
        return scopeWindows.find((window) => window.id === activeScopeId) || null;
    }, [scopeWindows, activeScopeId]);
    const scopeStatuses = useMemo(() => [
        TaskStatus.BACKLOG,
        TaskStatus.TODO,
        TaskStatus.IN_PROGRESS,
        TaskStatus.DONE,
    ], []);
    const scopeColumns = useMemo(() => {
        if (!activeScopeWindow) return [];
        const scopedTasks = activeScopeWindow.taskIds
            .map((taskId) => scopeTaskById.get(taskId))
            .filter(Boolean) as TaskView[];
        const filteredTasks = scopedTasks.filter((task) => {
            if (scopeFilterPriority !== 'ALL' && task.priority !== scopeFilterPriority) return false;
            if (scopeFilterStatus !== 'ALL' && task.status !== scopeFilterStatus) return false;
            return true;
        });
        return scopeStatuses.map((status) => ({
            status,
            tasks: filteredTasks.filter((task) => task.status === status),
        }));
    }, [activeScopeWindow, scopeTaskById, scopeStatuses, scopeFilterPriority, scopeFilterStatus]);
    const scopeListTasks = useMemo(() => {
        return scopeColumns.flatMap((column) => column.tasks);
    }, [scopeColumns]);
    const scopeAvailableTasks = useMemo(() => {
        if (!activeScopeWindow) return [];
        const scopedTaskSet = new Set(activeScopeWindow.taskIds);
        return scopeTaskPool.filter((task) => task.status !== TaskStatus.ARCHIVED && !scopedTaskSet.has(task.id));
    }, [activeScopeWindow, scopeTaskPool]);
    const filteredScopeAvailableTasks = useMemo(() => {
        const query = scopePickerQuery.trim().toLowerCase();
        if (!query) return scopeAvailableTasks;
        return scopeAvailableTasks.filter((task) => task.title.toLowerCase().includes(query));
    }, [scopeAvailableTasks, scopePickerQuery]);
    useEffect(() => {
        if (!activeTenantId) {
            setActiveScopeId(null);
            return;
        }
        if (scopeWindows.length === 0) {
            setActiveScopeId(null);
            return;
        }
        if (!activeScopeId || !scopeWindows.some((window) => window.id === activeScopeId)) {
            setActiveScopeId(scopeWindows[0].id);
        }
    }, [activeTenantId, scopeWindows, activeScopeId]);
    useEffect(() => {
        setScopePickerOpenId(null);
        setScopePickerQuery('');
    }, [activeScopeId]);
    useEffect(() => {
        if (!activeTenantId || scopeWindows.length === 0) {
            setScopeScreen('list');
            return;
        }
        if (scopeScreen === 'detail' && !activeScopeWindow) {
            setScopeScreen('list');
        }
    }, [activeTenantId, scopeWindows.length, activeScopeWindow, scopeScreen]);
    useEffect(() => {
        if (!scopeRouteId) return;
        if (scopeWindows.length === 0) return;
        const match = scopeWindows.find((window) => window.id === scopeRouteId);
        if (match) {
            setActiveScopeId(match.id);
            setScopeScreen('detail');
            return;
        }
        setScopeRouteId(null);
        updateScopeUrl(null, 'replace');
        setScopeScreen('list');
    }, [scopeRouteId, scopeWindows]);
    useEffect(() => {
        if (view !== 'scope' && scopeRouteId) {
            setScopeRouteId(null);
            updateScopeUrl(null, 'replace');
        }
    }, [view, scopeRouteId]);
    useEffect(() => {
        if (scopeScreen !== 'detail') {
            setScopePriorityFilterOpen(false);
            setScopeStatusFilterOpen(false);
        }
    }, [scopeScreen]);
    useEffect(() => {
        if (!isScopeSettingsOpen || !activeScopeWindow) return;
        setScopeSettingsDraft({
            name: activeScopeWindow.name,
            description: activeScopeWindow.description || '',
            startDate: activeScopeWindow.startDate || '',
            endDate: activeScopeWindow.endDate || '',
        });
    }, [isScopeSettingsOpen, activeScopeWindow]);
    const updateScopeWindows = (updater: (prev: ScopeWindow[]) => ScopeWindow[]) => {
        if (!scopeKey) return;
        setScopeWindowsByBoard((prev) => {
            const current = prev[scopeKey] || [];
            const next = updater(current);
            return { ...prev, [scopeKey]: next };
        });
    };
    const createScopeId = () => {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
            return crypto.randomUUID();
        }
        return `scope-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };
    const formatScopeDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '—');
    const isScopeDateRangeInvalid = (startDate: string, endDate: string) => {
        if (!startDate || !endDate) return false;
        return new Date(endDate) < new Date(startDate);
    };
    const getScopeDateLabel = (window: ScopeWindow) => {
        if (!window.startDate && !window.endDate) return 'No dates set';
        return `${formatScopeDate(window.startDate)} → ${formatScopeDate(window.endDate)}`;
    };
    const scopeSettingsDateInvalid = useMemo(
        () => isScopeDateRangeInvalid(scopeSettingsDraft.startDate, scopeSettingsDraft.endDate),
        [scopeSettingsDraft.startDate, scopeSettingsDraft.endDate]
    );
    const handleScopeSettingsSave = () => {
        if (!activeScopeWindow) return;
        const trimmedName = scopeSettingsDraft.name.trim();
        if (!trimmedName) return;
        if (scopeSettingsDateInvalid) return;
        updateScopeWindows((prev) =>
            prev.map((window) =>
                window.id === activeScopeWindow.id
                    ? {
                        ...window,
                        name: trimmedName,
                        description: scopeSettingsDraft.description.trim() || null,
                        startDate: scopeSettingsDraft.startDate || null,
                        endDate: scopeSettingsDraft.endDate || null,
                    }
                    : window
            )
        );
        setIsScopeSettingsOpen(false);
    };
    const sidebarBoardItems = useMemo(() => {
        const list = activeTenantId ? (boardsByTenant[activeTenantId] || boards) : boards;
        const items = Array.isArray(list) ? [...list] : [];
        if (!items.some((item) => item.id === ARCHIVED_BOARD_ID)) {
            items.push({ id: ARCHIVED_BOARD_ID, name: 'Archived', columns: [] } as BoardView);
        }
        return items;
    }, [activeTenantId, boardsByTenant, boards]);
    const getWritableBoards = (tenantId?: string | null) => {
        const list = tenantId
            ? (boardsByTenant[tenantId] || (tenantId === activeTenantId ? boards : []))
            : boards;
        return (list || []).filter((item) => item.id !== 'all');
    };
    const resolveWritableBoardId = (tenantId?: string | null) => {
        const list = getWritableBoards(tenantId);
        if (tenantId === activeTenantId && activeBoardId && activeBoardId !== 'all') {
            if (list.some((item) => item.id === activeBoardId)) return activeBoardId;
        }
        return list[0]?.id || 'default-board';
    };
    const openCreateTask = () => {
        setNewTask({
            title: '',
            description: '',
            priority: settingsDraft?.defaultPriority || 'MEDIUM',
            dueDate: ''
        });
        setNewTaskStatus((settingsDraft?.defaultStatus as TaskStatus) || TaskStatus.BACKLOG);
        setNewTaskAttachments([]);
        setNewTaskKinds([]);
        setNewKindInput('');
        const nextHuddleId = activeTenantId || displayMemberships[0]?.tenantId || null;
        setNewTaskHuddleId(nextHuddleId);
        setNewTaskBoardId(resolveWritableBoardId(nextHuddleId));
        setNewTaskOwnerId(userProfile?.id || null);
        setNewTaskAssignees([]);
        setSelectedTemplateId('');
        setIsModalOpen(true);
    };
    const getHuddleName = (name?: string | null) => {
        if (!name) return 'Huddle';
        return name.toLowerCase() === 'personal' ? 'Private Huddle' : name;
    };
    const hashString = (value: string) => {
        let hash = 0;
        for (let i = 0; i < value.length; i += 1) {
            hash = (hash << 5) - hash + value.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    };
    const getHuddleAccent = (tenantId: string | null | undefined, name?: string | null) => {
        const source = `${tenantId || ''}:${name || ''}`;
        const hue = hashString(source) % 360;
        return {
            solid: `hsl(${hue} 70% 60%)`,
            soft: `hsla(${hue}, 70%, 60%, 0.16)`,
            border: `hsla(${hue}, 70%, 60%, 0.35)`,
            text: `hsl(${hue} 70% 75%)`,
        };
    };
    const getMemberLabel = (tenantId: string | null | undefined, userId: string | null | undefined) => {
        if (!tenantId || !userId) return 'Unassigned';
        const member = (huddleMembersByTenant[tenantId] || []).find((entry) => entry.userId === userId);
        return member?.user?.name || member?.user?.email || userId;
    };
    const getMemberInfo = (tenantId: string | null | undefined, userId: string | null | undefined) => {
        if (!tenantId || !userId) return { label: 'Unassigned', avatarUrl: '' };
        const member = (huddleMembersByTenant[tenantId] || []).find((entry) => entry.userId === userId);
        return {
            label: member?.user?.name || member?.user?.email || userId,
            avatarUrl: member?.user?.avatarUrl || ''
        };
    };
    const isPersonalTenant = (tenantId: string | null | undefined) => {
        if (!tenantId) return false;
        const membership = memberships.find((entry) => entry.tenantId === tenantId);
        return membership?.tenant?.name?.toLowerCase() === 'personal';
    };
    const getMembersForTenant = (tenantId: string | null | undefined) => {
        if (!tenantId) return [];
        const members = huddleMembersByTenant[tenantId] || [];
        if (!isPersonalTenant(tenantId)) return members;
        const selfMember = members.find((member) => member.userId === currentUserId);
        if (selfMember) return [selfMember];
        if (!currentUserId) return [];
        return [
            {
                userId: currentUserId,
                role: 'owner',
                user: {
                    name: userProfile?.name || userProfile?.email || session?.user?.email || 'You',
                    email: userProfile?.email || session?.user?.email || '',
                    avatarUrl: userProfile?.avatarUrl || ''
                }
            }
        ];
    };
    const parseOkrPath = (path: string) => {
        if (!path.startsWith('/okr')) return null;
        const parts = path.split('/').filter(Boolean);
        if (parts.length === 1 || parts[1] === 'objectives') {
            return { screen: 'library' as const };
        }
        if (parts[1] === 'objective' && parts[2]) {
            return { screen: 'objective' as const, objectiveId: parts[2] };
        }
        if (parts[1] === 'review' && parts[2]) {
            return { screen: 'review' as const, objectiveId: parts[2] };
        }
        return { screen: 'library' as const };
    };
    const navigateOkr = (path: string) => {
        window.history.pushState({}, '', path);
        setView('okr');
        setOkrRoute(parseOkrPath(path));
    };
    const handleOkrNavClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (isSidebarCollapsed) {
            setIsOkrNavOpen(true);
            navigateOkr('/okr');
            return;
        }
        const target = event.target as HTMLElement;
        if (target.closest('.sidebar-nav-chevron')) {
            setIsOkrNavOpen((prev) => !prev);
            return;
        }
        setIsOkrNavOpen(true);
        navigateOkr('/okr');
    };
    const handleSidebarObjectiveSelect = (objectiveId: string) => {
        setIsOkrNavOpen(true);
        openObjectiveFocus(objectiveId);
    };
    const buildSettingsDraft = (user: any) => {
        const prefs = user?.preferences || {};
        return {
            name: user?.name || '',
            avatarUrl: user?.avatarUrl || '',
            timezone: prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            locale: prefs.locale || navigator.language || 'en',
            profileVisibility: prefs.profileVisibility || 'huddle',
            defaultHuddleId: prefs.defaultHuddleId || activeTenantId || '',
            defaultPriority: prefs.defaultPriority || 'MEDIUM',
            defaultStatus: prefs.defaultStatus || 'BACKLOG',
            notifications: {
                email: {
                    assigned: prefs.notifications?.email?.assigned ?? true,
                    mentions: prefs.notifications?.email?.mentions ?? true,
                    due: prefs.notifications?.email?.due ?? true,
                    invites: prefs.notifications?.email?.invites ?? true,
                },
                inApp: {
                    assigned: prefs.notifications?.inApp?.assigned ?? true,
                    mentions: prefs.notifications?.inApp?.mentions ?? true,
                    due: prefs.notifications?.inApp?.due ?? true,
                    invites: prefs.notifications?.inApp?.invites ?? true,
                },
            },
            workingHours: {
                start: prefs.workingHours?.start || '09:00',
                end: prefs.workingHours?.end || '17:00',
                days: prefs.workingHours?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            },
            reminders: {
                dueSoonHours: prefs.reminders?.dueSoonHours ?? 24,
                dailySummaryTime: prefs.reminders?.dailySummaryTime || '09:00',
            },
            taskTemplates: prefs.taskTemplates || [],
        };
    };
    const getInitials = (label: string) => {
        const parts = label.trim().split(/\s+/);
        const first = parts[0]?.[0] || '';
        const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
        return (first + last).toUpperCase() || 'U';
    };
    const renderAvatarStack = (tenantId: string, userIds: string[], sizeClass = '') => (
        <div className={`avatar-stack ${sizeClass}`.trim()}>
            {userIds.map((userId) => {
                const { label, avatarUrl } = getMemberInfo(tenantId, userId);
                return (
                    <span
                        key={userId}
                        className="avatar avatar-tooltip"
                        data-label={label}
                        aria-label={label}
                        title={label}
                    >
                        {avatarUrl ? <img src={avatarUrl} alt={label} /> : getInitials(label)}
                    </span>
                );
            })}
        </div>
    );
    const isPersonalMembership = (membership: any) => membership?.tenant?.name?.toLowerCase() === 'personal';
    const {
        displayMemberships,
        activeMembership,
        activeHuddleName,
        isPersonalActive,
        hasSharedHuddles,
        activeHuddleAccent,
    } = useMemo(() => {
        const personalMemberships = memberships.filter(isPersonalMembership);
        const sharedMemberships = memberships.filter((membership) => !isPersonalMembership(membership));
        const primaryPersonal = personalMemberships.find((m) => m.tenantId === activeTenantId) || personalMemberships[0];
        const display = primaryPersonal ? [primaryPersonal, ...sharedMemberships] : sharedMemberships;
        const active = memberships.find((m) => m.tenantId === activeTenantId) || primaryPersonal;
        return {
            displayMemberships: display,
            activeMembership: active,
            activeHuddleName: getHuddleName(active?.tenant?.name),
            isPersonalActive: active?.tenant?.name?.toLowerCase() === 'personal',
            hasSharedHuddles: sharedMemberships.length > 0,
            activeHuddleAccent: getHuddleAccent(activeTenantId, active?.tenant?.name),
        };
    }, [memberships, activeTenantId]);
    const isActiveHuddleOwner = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';
    const breadcrumbItems = useMemo(() => {
        if (view === 'settings') {
            return [{ label: 'Settings' }];
        }
        const huddleLabel = activeHuddleName || 'Huddle';
        const items: Array<{ label: string; onClick?: () => void }> = [
            { label: huddleLabel, onClick: () => setView('dashboard') },
        ];
        if (view === 'okr') {
            items.push({ label: 'OKRs', onClick: () => navigateOkr('/okr') });
            if (okrScreen === 'objective' && okrActiveObjective) {
                items.push({ label: okrActiveObjective.title, onClick: () => openObjectiveFocus(okrActiveObjective.id) });
            }
            if (okrScreen === 'review' && okrActiveObjective) {
                items.push({ label: 'Review' });
            }
            return items;
        }
        if (view === 'dashboard') items.push({ label: 'Dashboard', onClick: () => setView('dashboard') });
        if (view === 'calendar') items.push({ label: 'Calendar', onClick: () => setView('calendar') });
        if (view === 'scope') {
            items.push({
                label: 'Scope Window',
                onClick: () => {
                    setView('scope');
                    setScopeScreen('list');
                    setScopeRouteId(null);
                    updateScopeUrl(null, 'replace');
                }
            });
            if (scopeScreen === 'detail' && activeScopeWindow) {
                items.push({ label: activeScopeWindow.name });
            }
            return items;
        }
        if (view === 'table') items.push({ label: activeBoard?.name ? `Table · ${activeBoard.name}` : 'Table', onClick: () => setView('table') });
        if (view === 'list') items.push({ label: activeBoard?.name ? `Table · ${activeBoard.name}` : 'Table', onClick: () => setView('table') });
        if (view === 'kanban') items.push({ label: activeBoard?.name || 'Board', onClick: () => setView('kanban') });
        return items;
    }, [view, activeHuddleName, okrScreen, okrActiveObjective, activeBoard?.name, scopeScreen, activeScopeWindow]);
    const notificationSnapshotRef = useRef<Record<string, any>>({});
    const initializedHuddlesRef = useRef<Set<string>>(new Set());
    const inviteSnapshotRef = useRef<Set<string>>(new Set());
    const currentUserId = userProfile?.id || '';
    const currentUserToken = (userProfile?.email || '').toLowerCase();
    const unreadCount = notifications.filter((item) => !item.read).length;
    const handleNotificationClick = (item: { id: string; taskId?: string; tenantId?: string }) => {
        setNotifications((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
        if (!item.taskId || !item.tenantId) return;
        if (item.tenantId !== activeTenantId) {
            updateActiveTenant(item.tenantId);
        }
        setSelectedTaskId(item.taskId);
        setIsDetailsModalOpen(true);
        setIsNotificationsOpen(false);
    };

    useEffect(() => {
        if (selectedTask?.tenantId) {
            loadMembersForHuddle(selectedTask.tenantId);
        }
    }, [selectedTask?.tenantId]);

    useEffect(() => {
        if (isDetailsModalOpen) {
            setDetailTab('comments');
        }
    }, [isDetailsModalOpen, selectedTaskId]);

    useEffect(() => {
        const tenantIds = Array.from(new Set(tasks.map((task) => task.tenantId).filter(Boolean)));
        tenantIds.forEach((tenantId) => loadMembersForHuddle(tenantId));
    }, [tasks]);

    const applyFormat = (command: string) => {
        if (command === 'createLink') {
            const url = prompt('Link URL');
            if (url) document.execCommand(command, false, url);
            return;
        }
        document.execCommand(command, false);
    };

    const stripHtml = (value: string) => value.replace(/<[^>]+>/g, '');
    const renderPriorityIcon = (priority: string) => {
        switch (priority.toUpperCase()) {
            case 'LOW':
                return (
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                        <path d="M12 5v14" />
                        <path d="M8 15l4 4 4-4" />
                    </svg>
                );
            case 'HIGH':
                return (
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                        <path d="M12 19V5" />
                        <path d="M8 9l4-4 4 4" />
                    </svg>
                );
            case 'CRITICAL':
                return (
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                        <path d="M12 2s4 4.5 4 8a4 4 0 1 1-8 0c0-3.5 4-8 4-8z" />
                        <path d="M10.5 12.5c0 1.5 1.2 2.7 2.7 2.7 1.2 0 2.2-.7 2.6-1.8" />
                    </svg>
                );
            default:
                return (
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                        <path d="M12 7v10" />
                        <path d="M8 12h8" />
                    </svg>
                );
        }
    };

    const handlePastePlain = (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        if (document.queryCommandSupported('insertText')) {
            document.execCommand('insertText', false, text);
            return;
        }
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        selection.deleteFromDocument();
        selection.getRangeAt(0).insertNode(document.createTextNode(text));
        selection.collapseToEnd();
    };

    const updateActiveTenant = (tenantId: string) => {
        setActiveTenantId(tenantId);
        try {
            localStorage.setItem('kanbax-active-tenant', tenantId);
        } catch {
            // ignore storage
        }
    };

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError(null);
        setAuthMessage(null);
        try {
            if (authMode === 'magic') {
                const { error: magicError } = await supabase.auth.signInWithOtp({
                    email: authEmail,
                    options: { emailRedirectTo: window.location.origin }
                });
                if (magicError) throw magicError;
                setAuthMessage('Check your email for the magic link.');
                return;
            }

            if (authMode === 'signup') {
                const { error: signUpError } = await supabase.auth.signUp({
                    email: authEmail,
                    password: authPassword,
                    options: { emailRedirectTo: window.location.origin }
                });
                if (signUpError) throw signUpError;
                setAuthMessage('Account created. Check your email to confirm.');
                return;
            }

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: authEmail,
                password: authPassword
            });
            if (signInError) throw signInError;
        } catch (err: any) {
            setAuthError(err.message || 'Authentication failed');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleOAuth = async (provider: 'google' | 'github') => {
        setAuthError(null);
        setAuthMessage(null);
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: window.location.origin }
        });
        if (oauthError) setAuthError(oauthError.message);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setUserProfile(null);
        setMemberships([]);
        setInvites([]);
        setActiveTenantId(null);
        try {
            localStorage.removeItem('kanbax-active-tenant');
        } catch {
            // ignore storage
        }
    };

    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        setTeamError(null);
        try {
            const res = await fetch(`${API_BASE}/teams`, {
                method: 'POST',
                headers: getApiHeaders(false),
                body: JSON.stringify({ name: teamNameInput })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create huddle');
            }
            const data = await res.json();
            setTeamNameInput('');
            setMemberships((prev) => prev.concat({ ...data.membership, tenant: data.tenant }));
            updateActiveTenant(data.tenant.id);
        } catch (err: any) {
            setTeamError(err.message);
        }
    };

    const loadTeamMembers = async (tenantId: string) => {
        try {
            const res = await fetch(`${API_BASE}/teams/${tenantId}/members`, { headers: getApiHeaders(true) });
            if (!res.ok) throw new Error('Failed to load members');
            const data = await res.json();
            setTeamMembers(data);
        } catch (err: any) {
            setTeamError(err.message);
        }
    };

    const handleInviteMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeTenantId) return;
        setTeamError(null);
        try {
            const res = await fetch(`${API_BASE}/teams/${activeTenantId}/invites`, {
                method: 'POST',
                headers: getApiHeaders(true),
                body: JSON.stringify({ email: inviteEmail, role: inviteRole })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to invite member');
            }
            setInviteEmail('');
            await loadTeamMembers(activeTenantId);
        } catch (err: any) {
            setTeamError(err.message);
        }
    };

    const loadMembersForHuddle = async (tenantId: string | null | undefined) => {
        if (!tenantId || huddleMembersByTenant[tenantId] || !session?.access_token) return;
        try {
            const res = await fetch(`${API_BASE}/teams/${tenantId}/members`, { headers: getApiHeaders(false) });
            if (!res.ok) throw new Error('Failed to load members');
            const data = await res.json();
            setHuddleMembersByTenant((prev) => ({ ...prev, [tenantId]: data }));
        } catch (err: any) {
            setTeamError(err.message);
        }
    };

    const handleInviteDecision = async (invite: any, decision: 'accept' | 'decline') => {
        setTeamError(null);
        try {
            const res = await fetch(`${API_BASE}/invites/${invite.id}/${decision}`, {
                method: 'POST',
                headers: getApiHeaders(false),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update invite');
            }
            if (decision === 'accept' && invite.tenantId) {
                updateActiveTenant(invite.tenantId);
            }
            await loadProfile();
            if (decision === 'accept') {
                setIsInvitesModalOpen(false);
            }
        } catch (err: any) {
            setTeamError(err.message);
        }
    };

    const handleSaveSettings = async () => {
        if (!settingsDraft) return;
        setSettingsSaving(true);
        setSettingsMessage(null);
        try {
            const res = await fetch(`${API_BASE}/me`, {
                method: 'PATCH',
                headers: getApiHeaders(false),
                body: JSON.stringify({
                    name: settingsDraft.name,
                    avatarUrl: settingsDraft.avatarUrl,
                    preferences: {
                        timezone: settingsDraft.timezone,
                        locale: settingsDraft.locale,
                        profileVisibility: settingsDraft.profileVisibility,
                        defaultHuddleId: settingsDraft.defaultHuddleId || null,
                        defaultPriority: settingsDraft.defaultPriority,
                        defaultStatus: settingsDraft.defaultStatus,
                        notifications: settingsDraft.notifications,
                        workingHours: settingsDraft.workingHours,
                        reminders: settingsDraft.reminders,
                        taskTemplates: settingsDraft.taskTemplates,
                    },
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to save settings');
            }
            const data = await res.json();
            setUserProfile(data.user);
            setSettingsDraft(buildSettingsDraft(data.user));
            setToastMessage('Settings saved');
        } catch (err: any) {
            setToastMessage(err.message);
        } finally {
            setSettingsSaving(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!userProfile?.email) return;
        setSettingsMessage(null);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(userProfile.email, {
            redirectTo: window.location.origin,
        });
        if (resetError) {
            setToastMessage(resetError.message);
            return;
        }
        setToastMessage('Password reset email sent.');
    };

    const handleAvatarUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || !settingsDraft) return;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = () => {
            setSettingsDraft({ ...settingsDraft, avatarUrl: String(reader.result || '') });
        };
        reader.readAsDataURL(file);
    };

    const downloadFile = (filename: string, content: string, type = 'text/plain') => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportTasksJson = () => {
        const payload = JSON.stringify(tasks, null, 2);
        downloadFile('kanbax-tasks.json', payload, 'application/json');
    };

    const exportTasksCsv = () => {
        const rows = [
            ['id', 'title', 'status', 'priority', 'dueDate', 'ownerId', 'assignees', 'huddleId'],
            ...tasks.map((task) => [
                task.id,
                task.title.replace(/"/g, '""'),
                task.status,
                task.priority,
                task.dueDate ? new Date(task.dueDate).toISOString() : '',
                task.ownerId || '',
                (task.assignees || []).join('|'),
                task.tenantId,
            ]),
        ];
        const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
        downloadFile('kanbax-tasks.csv', csv, 'text/csv');
    };

    const handleLeaveHuddle = async (tenantId: string) => {
        setSettingsMessage(null);
        try {
            const res = await fetch(`${API_BASE}/teams/${tenantId}/leave`, {
                method: 'POST',
                headers: getApiHeaders(false),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to leave huddle');
            }
            await loadProfile();
            if (activeTenantId === tenantId) {
                updateActiveTenant('');
            }
            setToastMessage('Left huddle');
        } catch (err: any) {
            setToastMessage(err.message);
        }
    };

    useEffect(() => {
        if (!toastMessage) return;
        const timer = setTimeout(() => setToastMessage(null), 3000);
        return () => clearTimeout(timer);
    }, [toastMessage]);

    const normalizeCommentText = (text: string) => text.toLowerCase();

    const handleTaskNotifications = (tenantId: string, huddleName: string, tasksList: TaskView[]) => {
        const snapshot = notificationSnapshotRef.current;
        const nextSnapshot: Record<string, any> = { ...snapshot };

        if (!initializedHuddlesRef.current.has(tenantId)) {
            tasksList.forEach((task) => {
                nextSnapshot[`${tenantId}:${task.id}`] = {
                    status: task.status,
                    ownerId: task.ownerId || null,
                    assignees: task.assignees || [],
                    updatedAt: task.updatedAt,
                    commentIds: task.comments.map((comment) => comment.id),
                };
            });
            initializedHuddlesRef.current.add(tenantId);
            notificationSnapshotRef.current = nextSnapshot;
            return;
        }

        tasksList.forEach((task) => {
            const key = `${tenantId}:${task.id}`;
            const prev = snapshot[key];
            const lastActivity = task.activityLog && task.activityLog.length > 0
                ? [...task.activityLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
                : null;
            const isSelfAction = lastActivity?.actorId === currentUserId;
            if (!prev) {
                if (!isSelfAction) {
                    setNotifications((prevList) => [
                        {
                            id: `task-new-${key}`,
                            message: `New task created: ${task.title}`,
                            huddleName,
                            timestamp: new Date(task.createdAt).toISOString(),
                            read: false,
                            taskId: task.id,
                            tenantId,
                        },
                        ...prevList,
                    ]);
                }
                nextSnapshot[key] = {
                    status: task.status,
                    ownerId: task.ownerId || null,
                    assignees: task.assignees || [],
                    updatedAt: task.updatedAt,
                    commentIds: task.comments.map((comment) => comment.id),
                };
                return;
            }

            if (prev.status !== task.status && !isSelfAction) {
                setNotifications((prevList) => [
                    {
                        id: `task-status-${key}-${task.updatedAt}`,
                        message: `Status changed: ${task.title} → ${task.status}`,
                        huddleName,
                        timestamp: new Date(task.updatedAt).toISOString(),
                        read: false,
                        taskId: task.id,
                        tenantId,
                    },
                    ...prevList,
                ]);
            }

            if (prev.ownerId !== task.ownerId && task.ownerId) {
                const isMe = task.ownerId === currentUserId;
                if (!isMe && !isSelfAction) {
                    setNotifications((prevList) => [
                        {
                            id: `task-owner-${key}-${task.updatedAt}`,
                            message: `Owner changed: ${task.title}`,
                            huddleName,
                            timestamp: new Date(task.updatedAt).toISOString(),
                            read: false,
                            taskId: task.id,
                            tenantId,
                        },
                        ...prevList,
                    ]);
                }
            }

            const prevAssignees = new Set(prev.assignees || []);
            const currentAssignees = new Set(task.assignees || []);
            const newAssignees = task.assignees.filter((id) => !prevAssignees.has(id));
            if (newAssignees.length > 0) {
                const isMe = currentUserId && newAssignees.includes(currentUserId);
                if (!isSelfAction) {
                    setNotifications((prevList) => [
                        {
                            id: `task-assignees-${key}-${task.updatedAt}`,
                            message: isMe
                                ? `You were added to ${task.title}`
                                : `Assignees updated: ${task.title}`,
                            huddleName,
                            timestamp: new Date(task.updatedAt).toISOString(),
                            read: false,
                            taskId: task.id,
                            tenantId,
                        },
                        ...prevList,
                    ]);
                }
            }

            const prevCommentIds = new Set(prev.commentIds || []);
            const newComments = task.comments.filter((comment) => !prevCommentIds.has(comment.id));
            const hasCommentByOther = newComments.some((comment) => comment.createdBy !== currentUserId);
            if (newComments.length > 0 && hasCommentByOther) {
                const mentioned = newComments.some((comment) =>
                    currentUserToken && normalizeCommentText(comment.text).includes(`@${currentUserToken}`));
                if (!isSelfAction) {
                    setNotifications((prevList) => [
                        {
                            id: `task-comment-${key}-${task.updatedAt}`,
                            message: mentioned
                                ? `You were mentioned in ${task.title}`
                                : `New comment on ${task.title}`,
                            huddleName,
                            timestamp: new Date(task.updatedAt).toISOString(),
                            read: false,
                            taskId: task.id,
                            tenantId,
                        },
                        ...prevList,
                    ]);
                }
            }

            nextSnapshot[key] = {
                status: task.status,
                ownerId: task.ownerId || null,
                assignees: task.assignees || [],
                updatedAt: task.updatedAt,
                commentIds: task.comments.map((comment) => comment.id),
            };
        });

        notificationSnapshotRef.current = nextSnapshot;
    };

    useEffect(() => {
        if (!session?.access_token || displayMemberships.length === 0) return;
        let cancelled = false;
        const poll = async () => {
            if (pollInFlightRef.current) return;
            pollInFlightRef.current = true;
            for (const membership of displayMemberships) {
                const tenantId = membership.tenantId;
                const huddleName = getHuddleName(membership.tenant?.name);
                try {
                    const res = await fetch(`${API_BASE}/tasks`, { headers: getApiHeaders(true, tenantId) });
                    if (!res.ok) continue;
                    const data = await res.json();
                    if (!cancelled) {
                        setTasksByTenant((prev) => ({ ...prev, [tenantId]: data }));
                        handleTaskNotifications(tenantId, huddleName, data);
                    }
                } catch {
                    // Ignore polling errors
                }
            }
            pollInFlightRef.current = false;
        };
        poll();
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }
        pollIntervalRef.current = window.setInterval(poll, 30000);
        return () => {
            cancelled = true;
            pollInFlightRef.current = false;
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [session?.access_token, displayMemberships]);

    const handleMemberRoleChange = async (memberId: string, role: string) => {
        if (!activeTenantId) return;
        setTeamError(null);
        try {
            const res = await fetch(`${API_BASE}/teams/${activeTenantId}/members/${memberId}`, {
                method: 'PATCH',
                headers: getApiHeaders(true),
                body: JSON.stringify({ role })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update role');
            }
            await loadTeamMembers(activeTenantId);
        } catch (err: any) {
            setTeamError(err.message);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!activeTenantId) return;
        setTeamError(null);
        try {
            const res = await fetch(`${API_BASE}/teams/${activeTenantId}/members/${memberId}`, {
                method: 'DELETE',
                headers: getApiHeaders(true)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to remove member');
            }
            await loadTeamMembers(activeTenantId);
        } catch (err: any) {
            setTeamError(err.message);
        }
    };

    const statusFilterOptions = useMemo(() => {
        if (isArchivedBoard) {
            return ['ALL', TaskStatus.ARCHIVED];
        }
        const options = new Set<string>();
        (board?.columns || []).forEach((column: any) => {
            if (column?.status) options.add(String(column.status));
        });
        if (options.size === 0) {
            tasks.forEach((task) => {
                if (task.status && task.status !== TaskStatus.ARCHIVED) {
                    options.add(task.status);
                }
            });
        }
        return ['ALL', ...Array.from(options)];
    }, [board?.columns, tasks, isArchivedBoard]);

    useEffect(() => {
        if (filterStatus !== 'ALL' && !statusFilterOptions.includes(filterStatus)) {
            setFilterStatus('ALL');
        }
    }, [filterStatus, statusFilterOptions]);

    useEffect(() => {
        if (view !== 'table' && statusFilterOpen) {
            setStatusFilterOpen(false);
        }
    }, [view, statusFilterOpen]);

    const normalizedFilter = filterText.trim().toLowerCase();
    const matchesFilter = (task: TaskView) => {
        if (filterFavorites && !task.isFavorite) return false;
        if (filterPriority !== 'ALL' && task.priority !== filterPriority) return false;
        if (view === 'table' && filterStatus !== 'ALL' && task.status !== filterStatus) return false;
        if (!normalizedFilter) return true;
        const haystack = [
            task.title,
            stripHtml(task.description || ''),
            task.kinds.join(' ')
        ]
            .join(' ')
            .toLowerCase();
        return haystack.includes(normalizedFilter);
    };
    const filteredTasks = tasks.filter(matchesFilter);
    const visibleTasksForView = isArchivedBoard
        ? filteredTasks.filter((task) => task.status === TaskStatus.ARCHIVED)
        : filteredTasks.filter((task) => task.status !== TaskStatus.ARCHIVED);
    const kanbanColumns = isArchivedBoard
        ? [{ status: TaskStatus.ARCHIVED, tasks: visibleTasksForView }]
        : (board?.columns || []);
    const linkedToSet = new Set(tasks.flatMap((task) => task.linkedTaskIds));
    const normalizedSearch = filterText.trim().toLowerCase();
    const searchPool = normalizedSearch
        ? Object.entries(tasksByTenant).flatMap(([tenantId, list]) =>
            (list || []).map((task) => ({ ...task, tenantId: task.tenantId || tenantId })))
        : [];
    const searchTasks = normalizedSearch
        ? searchPool.filter((task) => {
            const haystack = [
                task.title,
                stripHtml(task.description || ''),
                task.kinds.join(' ')
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(normalizedSearch);
        })
        : [];
    const searchHuddles = normalizedSearch
        ? displayMemberships.filter((membership) => {
            const label = getHuddleName(membership.tenant?.name) || membership.tenantId;
            return label.toLowerCase().includes(normalizedSearch);
        })
        : [];
    const searchColumns = normalizedSearch
        ? kanbanColumns.filter((column: any) => String(column.status).toLowerCase().includes(normalizedSearch))
        : [];
    const searchCacheComplete = displayMemberships.length > 0
        && displayMemberships.every((membership) => Boolean(tasksByTenant[membership.tenantId]));
    const getOrderKey = (tenantId: string | null | undefined, boardId: string | null | undefined, status: TaskStatus) =>
        `${tenantId || 'unknown'}:${boardId || 'unknown'}:${status}`;
    const persistOrder = (tenantId: string | null | undefined, boardId: string | null | undefined, orders: Record<string, string[]>) => {
        if (!tenantId || !boardId) return;
        try {
            localStorage.setItem(`kanbax-task-order:${tenantId}:${boardId}`, JSON.stringify(orders));
        } catch {
            // Ignore storage errors
        }
    };
    const handleSearchSelect = (kind: 'task' | 'huddle' | 'column', payload: any) => {
        if (kind === 'task') {
            if (payload.tenantId && payload.tenantId !== activeTenantId) {
                setPendingTaskOpen({ taskId: payload.id, tenantId: payload.tenantId });
                updateActiveTenant(payload.tenantId);
            } else {
                setSelectedTaskId(payload.id);
                setIsDetailsModalOpen(true);
            }
        }
        if (kind === 'huddle') {
            updateActiveTenant(payload.tenantId);
            setView('kanban');
        }
        if (kind === 'column') {
            setView('kanban');
        }
        setFilterText('');
    };

    useEffect(() => {
        if (!pendingTaskOpen || pendingTaskOpen.tenantId !== activeTenantId) return;
        const exists = tasks.some((task) => task.id === pendingTaskOpen.taskId);
        if (!exists) return;
        setSelectedTaskId(pendingTaskOpen.taskId);
        setIsDetailsModalOpen(true);
        setPendingTaskOpen(null);
    }, [pendingTaskOpen, activeTenantId, tasks]);

    useEffect(() => {
        if (!normalizedSearch) {
            setSearchLoading(false);
            return;
        }
        setSearchLoading(false);
    }, [normalizedSearch, session, displayMemberships]);

    useEffect(() => {
        if (!activeTenantId || !activeBoardId) return;
        try {
            const stored = localStorage.getItem(`kanbax-task-order:${activeTenantId}:${activeBoardId}`);
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, string[]>;
                setTaskOrderByColumn(parsed);
            } else {
                setTaskOrderByColumn({});
            }
        } catch {
            setTaskOrderByColumn({});
        }
    }, [activeTenantId, activeBoardId]);

    useEffect(() => {
        if (!activeTenantId || tasks.length === 0) return;
        const nextOrders: Record<string, string[]> = { ...taskOrderByColumn };
        const statuses = Array.from(new Set(tasks.map((task) => task.status)));
        statuses.forEach((status) => {
            const key = getOrderKey(activeTenantId, activeBoardId, status);
            const existing = nextOrders[key] || [];
            const idsInStatus = tasks.filter((task) => task.status === status).map((task) => task.id);
            const ordered = existing.filter((id) => idsInStatus.includes(id));
            const missing = idsInStatus.filter((id) => !ordered.includes(id));
            nextOrders[key] = ordered.concat(missing);
        });
        setTaskOrderByColumn(nextOrders);
        persistOrder(activeTenantId, activeBoardId, nextOrders);
    }, [activeTenantId, activeBoardId, tasks]);
    const activeTasks = tasks.filter((task) => task.status !== TaskStatus.ARCHIVED);

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const resolvedBoardId = newTaskBoardId || resolveWritableBoardId(newTaskHuddleId);
            const res = await fetch(`${API_BASE}/commands/task/create`, {
                method: 'POST',
                headers: getApiHeaders(true, newTaskHuddleId),
                body: JSON.stringify({
                    title: newTask.title,
                    description: newTask.description,
                    kinds: newTaskKinds,
                    status: newTaskStatus,
                    priority: newTask.priority,
                    dueDate: newTask.dueDate || undefined,
                    attachments: newTaskAttachments,
                    ownerId: newTaskOwnerId ?? userProfile?.id ?? undefined,
                    assignees: newTaskAssignees,
                    boardId: resolvedBoardId,
                    source: { type: 'MANUAL', createdBy: 'admin-user-1' }
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create task');
            }

            setIsModalOpen(false);
            setNewTask({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
            setNewTaskAttachments([]);
            setNewTaskKinds([]);
            setNewKindInput('');
            setNewTaskBoardId(null);
            if (newTaskKinds.length > 0) {
                setKnownKinds((prev) => {
                    const merged = new Set(prev);
                    newTaskKinds.forEach((kind) => merged.add(kind));
                    const next = Array.from(merged).sort((a, b) => a.localeCompare(b));
                    try {
                        localStorage.setItem('kanbax-kind-history', JSON.stringify(next));
                    } catch {
                        // Ignore storage errors
                    }
                    return next;
                });
            }
            fetchData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
        try {
            const res = await fetch(`${API_BASE}/commands/task/update-status`, {
                method: 'POST',
                headers: getApiHeaders(),
                body: JSON.stringify({ taskId, newStatus })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update status');
            }

            fetchData();
            if (view === 'scope' && activeTenantId) {
                try {
                    const scopeRes = await fetch(`${API_BASE}/tasks?boardId=all`, { headers: getApiHeaders(true, activeTenantId) });
                    if (scopeRes.ok) {
                        const data = await scopeRes.json();
                        setScopeTasksByTenant((prev) => ({ ...prev, [activeTenantId]: data }));
                    }
                } catch {
                    // ignore scope refresh errors
                }
            }
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleArchiveToggle = async (task: TaskView) => {
        const nextStatus = task.status === TaskStatus.ARCHIVED ? TaskStatus.BACKLOG : TaskStatus.ARCHIVED;
        await handleUpdateStatus(task.id, nextStatus);
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            const res = await fetch(`${API_BASE}/commands/task/delete`, {
                method: 'POST',
                headers: getApiHeaders(),
                body: JSON.stringify({ taskId })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete task');
            }

            setIsDetailsModalOpen(false);
            setSelectedTaskId(null);
            fetchData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const openDetailsModal = (task: TaskView) => {
        setSelectedTaskId(task.id);
        setChecklistDraft(task.checklist || []);
        setCommentInput('');
        setChecklistInput('');
        setLinkedDraft(task.linkedTaskIds || []);
        setLinkSelectId('');
        setIsDetailsModalOpen(true);
    };

    const handleCardClick = (task: TaskView) => {
        // Prevent opening modal if we just finished dragging
        if (isDragging || Date.now() - dragStartTimeRef.current < 200) {
            return;
        }
        openDetailsModal(task);
    };

    const openEditModal = (task: TaskView) => {
        if (task.sourceType !== 'MANUAL') return;
        setEditingTaskId(task.id);
        setEditTaskTenantOriginal(task.tenantId);
        setEditTaskHuddleId(task.tenantId);
        setEditTaskBoardId(task.boardId || resolveWritableBoardId(task.tenantId));
        setEditTaskBoardOriginal(task.boardId || resolveWritableBoardId(task.tenantId));
        setEditTaskOwnerId(task.ownerId ?? null);
        setEditTaskAssignees(task.assignees ?? []);
        const dueDateValue = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
        setEditTask({
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            dueDate: dueDateValue
        });
        setEditTaskKinds(task.kinds || []);
        setEditKindInput('');
        setChecklistDraft(task.checklist || []);
        setChecklistInput('');
        setLinkedDraft(task.linkedTaskIds || []);
        setLinkSelectId('');
        if (task.kinds && task.kinds.length > 0) {
            setKnownKinds((prev) => {
                const merged = new Set(prev);
                task.kinds.forEach((kind) => {
                    if (kind.trim().length > 0) merged.add(kind);
                });
                const next = Array.from(merged).sort((a, b) => a.localeCompare(b));
                try {
                    localStorage.setItem('kanbax-kind-history', JSON.stringify(next));
                } catch {
                    // Ignore storage errors
                }
                return next;
            });
        }
        setExistingAttachments(task.attachments || []);
        setNewAttachments([]);
        setRemovedAttachmentIds([]);
        setIsEditModalOpen(true);
    };

    const handleCreateAttachmentSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const reads = Array.from(files).map((file) => new Promise<TaskView['attachments'][number]>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
                id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2),
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream',
                dataUrl: String(reader.result || ''),
                uploadedAt: new Date()
            });
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        }));

        try {
            const attachments = await Promise.all(reads);
            setNewTaskAttachments((prev) => prev.concat(attachments));
        } catch (e: any) {
            alert(e.message || 'Failed to attach file');
        }
    };

    const handleRemoveCreateAttachment = (attachmentId: string) => {
        setNewTaskAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
    };

    const addKindValue = (value: string, setKinds: React.Dispatch<React.SetStateAction<string[]>>) => {
        const trimmed = value.trim();
        if (!trimmed) return false;
        setKinds((prev) => {
            const exists = prev.some((kind) => kind.toLowerCase() === trimmed.toLowerCase());
            if (exists) return prev;
            return [...prev, trimmed];
        });
        return true;
    };

    const handleNewKindAdd = () => {
        if (addKindValue(newKindInput, setNewTaskKinds)) {
            setNewKindInput('');
        }
    };

    const handleEditKindAdd = () => {
        if (addKindValue(editKindInput, setEditTaskKinds)) {
            setEditKindInput('');
        }
    };

    const handleKindKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, mode: 'new' | 'edit') => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            if (mode === 'new') {
                handleNewKindAdd();
            } else {
                handleEditKindAdd();
            }
        }
    };

    const removeKindValue = (value: string, setKinds: React.Dispatch<React.SetStateAction<string[]>>) => {
        setKinds((prev) => prev.filter((kind) => kind !== value));
    };

    const submitTaskUpdate = async (payload: any) => {
        if (!selectedTask) return;
            const res = await fetch(`${API_BASE}/commands/task/update-details`, {
                method: 'POST',
                headers: getApiHeaders(true, selectedTask.tenantId),
                body: JSON.stringify({
                    taskId: selectedTask.id,
                    title: selectedTask.title,
                    description: selectedTask.description,
                    ...payload
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to update task');
        }

        await fetchData();
    };

    const handleAddComment = async () => {
        const text = commentInput.trim();
        if (!text || !selectedTask) return;
        try {
            await submitTaskUpdate({ commentText: text });
            setCommentInput('');
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleChecklistAdd = async () => {
        const text = checklistInput.trim();
        if (!text || !selectedTask) return;
        const nextChecklist = [
            ...checklistDraft,
            {
                id: Math.random().toString(36).substring(2, 15),
                text,
                done: false
            }
        ];
        setChecklistDraft(nextChecklist);
        setChecklistInput('');
        try {
            await submitTaskUpdate({ checklist: nextChecklist });
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleChecklistToggle = async (itemId: string) => {
        const nextChecklist = checklistDraft.map((item) => (
            item.id === itemId ? { ...item, done: !item.done } : item
        ));
        setChecklistDraft(nextChecklist);
        try {
            await submitTaskUpdate({ checklist: nextChecklist });
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleChecklistRemove = async (itemId: string) => {
        const nextChecklist = checklistDraft.filter((item) => item.id !== itemId);
        setChecklistDraft(nextChecklist);
        try {
            await submitTaskUpdate({ checklist: nextChecklist });
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleAddLink = async () => {
        if (!linkSelectId || !selectedTask) return;
        const nextLinks = linkedDraft.includes(linkSelectId)
            ? linkedDraft
            : [...linkedDraft, linkSelectId];
        setLinkedDraft(nextLinks);
        setLinkSelectId('');
        try {
            await submitTaskUpdate({ linkedTaskIds: nextLinks });
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleRemoveLink = async (taskId: string) => {
        const nextLinks = linkedDraft.filter((id) => id !== taskId);
        setLinkedDraft(nextLinks);
        try {
            await submitTaskUpdate({ linkedTaskIds: nextLinks });
        } catch (e: any) {
            alert(e.message);
        }
    };

    const toggleFavorite = async (task: TaskView) => {
        try {
            await fetch(`${API_BASE}/commands/task/update-details`, {
                method: 'POST',
                headers: getApiHeaders(true, task.tenantId),
                body: JSON.stringify({
                    taskId: task.id,
                    title: task.title,
                    description: task.description,
                    isFavorite: !task.isFavorite
                })
            });
            fetchData();
        } catch (e: any) {
            alert(e.message);
        }
    };


    const handleAttachmentSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const reads = Array.from(files).map((file) => new Promise<TaskView['attachments'][number]>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
                id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2),
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream',
                dataUrl: String(reader.result || ''),
                uploadedAt: new Date()
            });
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        }));

        try {
            const attachments = await Promise.all(reads);
            setNewAttachments((prev) => prev.concat(attachments));
        } catch (e: any) {
            alert(e.message || 'Failed to attach file');
        }
    };

    const handleRemoveAttachment = (attachmentId: string) => {
        setNewAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
        setExistingAttachments((prev) => {
            const isExisting = prev.some((attachment) => attachment.id === attachmentId);
            if (isExisting) {
                setRemovedAttachmentIds((ids) => ids.concat(attachmentId));
            }
            return prev.filter((attachment) => attachment.id !== attachmentId);
        });
    };

    const handleUpdateTaskDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTaskId) return;
        try {
            const res = await fetch(`${API_BASE}/commands/task/update-details`, {
                method: 'POST',
                headers: getApiHeaders(true, editTaskTenantOriginal),
                body: JSON.stringify({
                    taskId: editingTaskId,
                    title: editTask.title,
                    description: editTask.description,
                    kinds: editTaskKinds,
                    priority: editTask.priority,
                    dueDate: editTask.dueDate ? editTask.dueDate : null,
                    ownerId: editTaskOwnerId || null,
                    assignees: editTaskAssignees,
                    attachmentsToAdd: newAttachments,
                    attachmentsToRemove: removedAttachmentIds
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update task');
            }

            if (editTaskHuddleId && editTaskTenantOriginal && editTaskHuddleId !== editTaskTenantOriginal) {
                const moveRes = await fetch(`${API_BASE}/commands/task/assign-huddle`, {
                    method: 'POST',
                    headers: getApiHeaders(true, editTaskTenantOriginal),
                    body: JSON.stringify({
                        taskId: editingTaskId,
                        targetTenantId: editTaskHuddleId
                    })
                });
                if (!moveRes.ok) {
                    const moveErr = await moveRes.json();
                    throw new Error(moveErr.error || 'Failed to move task to huddle');
                }
            }

            const targetTenantId = editTaskHuddleId || editTaskTenantOriginal;
            if (editTaskBoardId && targetTenantId && editTaskBoardId !== editTaskBoardOriginal) {
                const boardRes = await fetch(`${API_BASE}/commands/task/assign-board`, {
                    method: 'POST',
                    headers: getApiHeaders(true, targetTenantId),
                    body: JSON.stringify({
                        taskId: editingTaskId,
                        boardId: editTaskBoardId,
                    }),
                });
                if (!boardRes.ok) {
                    const boardErr = await boardRes.json();
                    throw new Error(boardErr.error || 'Failed to move task to board');
                }
            }

            setIsEditModalOpen(false);
            setEditingTaskId(null);
            setEditTaskBoardId(null);
            setEditTaskBoardOriginal(null);
            setIsDetailsModalOpen(false);
            setSelectedTaskId(null);
            setNewAttachments([]);
            setRemovedAttachmentIds([]);
            setChecklistDraft([]);
            setChecklistInput('');
            setLinkedDraft([]);
            setLinkSelectId('');
            if (editTaskKinds.length > 0) {
                setKnownKinds((prev) => {
                    const merged = new Set(prev);
                    editTaskKinds.forEach((kind) => merged.add(kind));
                    const next = Array.from(merged).sort((a, b) => a.localeCompare(b));
                    try {
                        localStorage.setItem('kanbax-kind-history', JSON.stringify(next));
                    } catch {
                        // Ignore storage errors
                    }
                    return next;
                });
            }
            fetchData();
        } catch (e: any) {
            alert(e.message);
        }
    };


    // --- Drag & Drop Handlers ---
    const onDragStart = (e: React.DragEvent, taskId: string) => {
        dragStartTimeRef.current = Date.now();
        e.dataTransfer.setData('text/plain', taskId);
        e.dataTransfer.effectAllowed = 'move';
        setDraggingTaskId(taskId);
        setIsDragging(true);
    };

    const onDragEnd = (e: React.DragEvent) => {
        document.querySelectorAll('.task-card.drag-over-card').forEach((el) => {
            el.classList.remove('drag-over-card');
        });
        document.querySelectorAll('.kanban-column.drag-over').forEach((el) => {
            el.classList.remove('drag-over');
        });
        setDraggingTaskId(null);
        lastDragTargetRef.current = null;
        setScopeDropTargetId(null);
        setTimeout(() => setIsDragging(false), 200);
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
        if (e.target === e.currentTarget) {
            lastDragTargetRef.current = null;
        }
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('drag-over');
    };

    const onDrop = (e: React.DragEvent, status: TaskStatus) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain') || draggingTaskId || '';

        if (!taskId || !activeTenantId) return;

        const sourceTask = tasks.find(t => t.id === taskId);
        const sourceStatus = sourceTask?.status;

        const key = getOrderKey(activeTenantId, activeBoardId, status);
        const targetRef = lastDragTargetRef.current;
        lastDragTargetRef.current = null;
        if (sourceStatus && sourceStatus !== status) {
            handleUpdateStatus(taskId, status);
        }
        if (targetRef?.startsWith(`${status}:`)) {
            const targetId = targetRef.split(':')[1] || null;
            if (targetId) {
                moveTaskOrder(activeTenantId, activeBoardId, status, taskId, targetId);
            }
            return;
        }

        setTaskOrderByColumn((prev) => {
            const next = { ...prev };
            const list = (next[key] || []).filter((id) => id !== taskId);
            next[key] = list.concat(taskId);
            persistOrder(activeTenantId, activeBoardId, next);
            return next;
        });
    };

    const moveTaskOrder = (tenantId: string, boardId: string | null, status: TaskStatus, taskId: string, targetId: string | null) => {
        const key = getOrderKey(tenantId, boardId, status);
        setTaskOrderByColumn((prev) => {
            const next = { ...prev };
            const list = (next[key] || []).filter((id) => id !== taskId);
            if (targetId) {
                const targetIndex = list.indexOf(targetId);
                if (targetIndex === -1) {
                    list.push(taskId);
                } else {
                    list.splice(targetIndex, 0, taskId);
                }
            } else {
                list.push(taskId);
            }
            next[key] = list;
            persistOrder(tenantId, boardId, next);
            return next;
        });
    };

    const onCardDragOver = (e: React.DragEvent, status: TaskStatus, targetId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!draggingTaskId || draggingTaskId === targetId || !activeTenantId) return;
        const sourceTask = tasks.find((task) => task.id === draggingTaskId);
        if (!sourceTask || sourceTask.status !== status) return;
        const dragKey = `${status}:${targetId}`;
        if (lastDragTargetRef.current === dragKey) return;
        lastDragTargetRef.current = dragKey;
        moveTaskOrder(activeTenantId, activeBoardId, status, draggingTaskId, targetId);
        e.currentTarget.classList.add('drag-over-card');
    };

    const onCardDragLeave = (e: React.DragEvent) => {
        // Only remove class if we're actually leaving the card (not entering a child)
        const target = e.currentTarget as HTMLElement;
        const related = e.relatedTarget as HTMLElement;
        if (!target.contains(related)) {
            e.currentTarget.classList.remove('drag-over-card');
        }
    };

    const onCardDrop = (e: React.DragEvent, status: TaskStatus, targetId: string) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over-card');
    };

    if (!session) {
        return (
            <div className="auth-screen">
                <div className="auth-card">
                    <div className="auth-header">
                        <h1>Kanbax</h1>
                        <p>Sign in to manage your boards, huddles, and tasks.</p>
                    </div>
                    <div className="auth-tabs">
                        <button
                            className={authMode === 'login' ? 'auth-tab active' : 'auth-tab'}
                            onClick={() => setAuthMode('login')}
                        >
                            Login
                        </button>
                        <button
                            className={authMode === 'signup' ? 'auth-tab active' : 'auth-tab'}
                            onClick={() => setAuthMode('signup')}
                        >
                            Sign up
                        </button>
                        <button
                            className={authMode === 'magic' ? 'auth-tab active' : 'auth-tab'}
                            onClick={() => setAuthMode('magic')}
                        >
                            Magic link
                        </button>
                    </div>
                    <form className="auth-form" onSubmit={handleAuthSubmit}>
                        <label>
                            Email
                            <input
                                type="email"
                                value={authEmail}
                                onChange={(e) => setAuthEmail(e.target.value)}
                                placeholder="you@company.com"
                                required
                            />
                        </label>
                        {authMode !== 'magic' && (
                            <label>
                                Password
                                <input
                                    type="password"
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                            </label>
                        )}
                        <button className="btn btn-primary" type="submit" disabled={authLoading}>
                            {authMode === 'signup' ? 'Create account' : authMode === 'magic' ? 'Send magic link' : 'Sign in'}
                        </button>
                        {authMessage && <div className="auth-message">{authMessage}</div>}
                        {authError && <div className="auth-error">{authError}</div>}
                    </form>
                    <div className="auth-divider"><span>or</span></div>
                    <div className="auth-oauth">
                        <button className="btn btn-secondary" onClick={() => handleOAuth('google')}>Continue with Google</button>
                        <button className="btn btn-secondary" onClick={() => handleOAuth('github')}>Continue with GitHub</button>
                    </div>
                </div>
            </div>
        );
    }

    if (!profileLoaded) {
        return <div style={{ padding: '2rem' }}>Loading your workspace...</div>;
    }

    if (memberships.length === 0 && !skipTeamSetup) {
        return (
            <div className="auth-screen">
                <div className="auth-card">
                    <div className="auth-header">
                        <h1>Create your first huddle</h1>
                        <p>Set up a shared space and invite teammates.</p>
                    </div>
                    <form className="auth-form" onSubmit={handleCreateTeam}>
                        <label>
                            Huddle name
                            <input
                                type="text"
                                value={teamNameInput}
                                onChange={(e) => setTeamNameInput(e.target.value)}
                                placeholder="Design Squad"
                                required
                            />
                        </label>
                        <button className="btn btn-primary" type="submit">Create huddle</button>
                        {teamError && <div className="auth-error">{teamError}</div>}
                    </form>
                    <button className="btn btn-secondary" onClick={() => setSkipTeamSetup(true)}>
                        Continue with private huddle
                    </button>
                    <button className="btn btn-ghost" onClick={handleSignOut}>Sign out</button>
                </div>
            </div>
        );
    }

    if (!activeTenantId && memberships.length > 0 && !skipTeamSetup) {
        return (
            <div className="auth-screen">
                <div className="auth-card">
                    <div className="auth-header">
                        <h1>Select a huddle</h1>
                        <p>Choose a space to continue.</p>
                    </div>
                    <div className="auth-form">
                        <label>
                            Huddle
                            <select
                                value={activeTenantId || ''}
                                onChange={(e) => updateActiveTenant(e.target.value)}
                            >
                                <option value="" disabled>Select huddle</option>
                                {displayMemberships.map((membership) => (
                                    <option key={membership.id} value={membership.tenantId}>
                                        {getHuddleName(membership.tenant?.name) || membership.tenantId}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <button className="btn btn-ghost" onClick={handleSignOut}>Sign out</button>
                </div>
            </div>
        );
    }

    return (
        <div className={`dashboard${isSidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
            <datalist id="kind-suggestions">
                {knownKinds.map((kind) => (
                    <option key={kind} value={kind} />
                ))}
            </datalist>
            <header className="topbar">
                <div className="topbar-inner">
                    <div className="topbar-search" tabIndex={-1}>
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                            <circle cx="11" cy="11" r="7" />
                            <path d="M20 20l-3.5-3.5" />
                        </svg>
                        <input
                            type="search"
                            placeholder="Search tasks, boards, huddles..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>
                    {normalizedSearch && (
                        <div className="topbar-search-panel">
                            {!searchCacheComplete && (
                                <div className="empty-state">Indexing huddles...</div>
                            )}
                            {searchCacheComplete && searchHuddles.length === 0 && searchTasks.length === 0 && searchColumns.length === 0 && (
                                <div className="empty-state">No results.</div>
                            )}
                            {searchHuddles.length > 0 && (
                                <div className="search-section">
                                    <div className="search-title">Huddles</div>
                                    {searchHuddles.map((membership) => (
                                        <button
                                            key={membership.id}
                                            className="search-item"
                                            onClick={() => handleSearchSelect('huddle', membership)}
                                        >
                                            <span className="huddle-item-dot" style={{ background: getHuddleAccent(membership.tenantId, membership.tenant?.name).solid }} />
                                            {getHuddleName(membership.tenant?.name) || membership.tenantId}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {searchTasks.length > 0 && (
                                <div className="search-section">
                                    <div className="search-title">Tasks</div>
                                    {searchTasks.slice(0, 6).map((task) => (
                                        <button
                                            key={task.id}
                                            className="search-item"
                                            onClick={() => handleSearchSelect('task', task)}
                                        >
                                            {task.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {searchColumns.length > 0 && (
                                <div className="search-section">
                                    <div className="search-title">Board columns</div>
                                    {searchColumns.map((column: any) => (
                                        <button
                                            key={column.status}
                                            className="search-item"
                                            onClick={() => handleSearchSelect('column', column)}
                                        >
                                            {column.status}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="topbar-actions">
                        <button
                            className="notif-button"
                            onClick={() => setIsNotificationsOpen((prev) => !prev)}
                            aria-label="Notifications"
                        >
                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
                                <path d="M10 21a2 2 0 0 0 4 0" />
                            </svg>
                            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                        </button>
                        <div className="user-menu">
                            <button
                                className="user-menu-button"
                                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                                aria-label="User menu"
                            >
                                {currentUserAvatar ? (
                                    <img src={currentUserAvatar} alt="User avatar" />
                                ) : (
                                    <span>{getInitials(currentUserLabel)}</span>
                                )}
                            </button>
                            {isUserMenuOpen && (
                                <div className="user-menu-dropdown">
                                    <div className="user-menu-header">
                                        <div className="user-menu-name">{settingsDraft?.name || currentUserLabel}</div>
                                        <div className="user-menu-email">{currentUserLabel}</div>
                                    </div>
                                    <button
                                        className="user-menu-item"
                                        onClick={() => {
                                            setView('dashboard');
                                            setIsUserMenuOpen(false);
                                        }}
                                    >
                                        Dashboard
                                    </button>
                                    <button
                                        className="user-menu-item"
                                        onClick={() => {
                                            setView('kanban');
                                            setIsUserMenuOpen(false);
                                        }}
                                    >
                                        Board
                                    </button>
                                    <button
                                        className="user-menu-item"
                                        onClick={() => {
                                            setView('scope');
                                            setScopeScreen('list');
                                            setScopeRouteId(null);
                                            updateScopeUrl(null, 'replace');
                                            setIsUserMenuOpen(false);
                                        }}
                                    >
                                        Scope Window
                                    </button>
                                    <button
                                        className="user-menu-item"
                                        onClick={() => {
                                            navigateOkr('/okr');
                                            setIsUserMenuOpen(false);
                                        }}
                                    >
                                        OKRs
                                    </button>
                                    <button
                                        className="user-menu-item"
                                        onClick={() => {
                                            setIsNotificationsOpen(true);
                                            setIsUserMenuOpen(false);
                                        }}
                                    >
                                        Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
                                    </button>
                                    <button
                                        className="user-menu-item"
                                        onClick={() => {
                                            setView('settings');
                                            setIsUserMenuOpen(false);
                                        }}
                                    >
                                        Settings
                                    </button>
                                    <button
                                        className="user-menu-item danger"
                                        onClick={() => {
                                            setIsUserMenuOpen(false);
                                            handleSignOut();
                                        }}
                                    >
                                        Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <img className="sidebar-logo" src="/sqirch_logo.svg" alt="sqirch" />
                        <img className="sidebar-logo-mark" src="/sqirch_mark.svg" alt="" aria-hidden="true" />
                    </div>
                </div>
                <div className="sidebar-content">
                    <div className="sidebar-huddle">
                        <button
                            className="sidebar-nav-item sidebar-huddle-toggle"
                            onClick={() => setIsHuddleMenuOpen((prev) => !prev)}
                            data-tooltip="Huddles"
                            aria-label="Select huddle"
                        >
                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
                                <circle cx="8" cy="8" r="3.2" />
                                <circle cx="16" cy="8" r="3.2" />
                                <path d="M3.5 19c0-2.8 2.7-5 4.5-5h0c1.9 0 4.5 2.2 4.5 5" />
                                <path d="M11.5 19c0-2.8 2.7-5 4.5-5h0c1.9 0 4.5 2.2 4.5 5" />
                            </svg>
                            <span className="sidebar-huddle-initial">
                                {getHuddleName(displayMemberships.find((membership) => membership.tenantId === activeTenantId)?.tenant?.name || 'H').charAt(0)}
                            </span>
                            <span className="sidebar-huddle-label">
                                {getHuddleName(displayMemberships.find((membership) => membership.tenantId === activeTenantId)?.tenant?.name) || 'Huddle'}
                            </span>
                        </button>
                        {isHuddleMenuOpen && (
                            <div className="sidebar-huddle-menu">
                                {displayMemberships.map((membership) => {
                                    const isActive = membership.tenantId === activeTenantId;
                                    return (
                                        <button
                                            key={membership.id}
                                            className={`sidebar-huddle-item ${isActive ? 'active' : ''}`}
                                            onClick={() => {
                                                updateActiveTenant(membership.tenantId);
                                                setIsHuddleMenuOpen(false);
                                            }}
                                        >
                                            <span
                                                className="huddle-item-dot"
                                                style={{ background: getHuddleAccent(membership.tenantId, membership.tenant?.name).solid }}
                                            />
                                            <span className="sidebar-huddle-name">
                                                {getHuddleName(membership.tenant?.name) || membership.tenantId}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="sidebar-team">
                        <div className="sidebar-nav">
                            <button
                                className={`sidebar-nav-item ${view === 'dashboard' ? 'active' : ''}`}
                                onClick={() => setView('dashboard')}
                                data-tooltip="Dashboard"
                            >
                                <span className="sidebar-nav-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                        <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
                                        <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
                                        <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
                                        <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
                                    </svg>
                                </span>
                                <span className="sidebar-nav-label">Dashboard</span>
                            </button>
                            <button
                                className={`sidebar-nav-item ${view === 'kanban' ? 'active' : ''}`}
                                onClick={handleBoardNavClick}
                                data-tooltip="Board"
                            >
                                <span className="sidebar-nav-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                        <rect x="3.5" y="4" width="7" height="16" rx="2" />
                                        <rect x="13.5" y="4" width="7" height="9" rx="2" />
                                        <path d="M13.5 16h7" />
                                    </svg>
                                </span>
                                <span className="sidebar-nav-label">Board</span>
                                <span
                                    className={`sidebar-nav-chevron ${isBoardNavOpen ? 'open' : ''}`}
                                    aria-hidden="true"
                                >
                                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="4 8 10 14 16 8" />
                                    </svg>
                                </span>
                            </button>
                            {!isSidebarCollapsed && isBoardNavOpen && (
                                <div className="sidebar-board-list">
                                    {sidebarBoardItems.length === 0 ? (
                                        <div className="sidebar-board-empty">No boards yet.</div>
                                    ) : (
                                        sidebarBoardItems.map((boardItem) => (
                                            <button
                                                key={boardItem.id}
                                                className={`sidebar-board-item ${boardItem.id === activeBoardId ? 'active' : ''}`}
                                                onClick={() => handleSidebarBoardSelect(boardItem.id)}
                                            >
                                                <span className="sidebar-board-dot" aria-hidden="true" />
                                                <span className="sidebar-board-label">{boardItem.name}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                            {isSidebarCollapsed && isBoardNavOpen && (view === 'kanban' || view === 'table') && (
                                <div className="sidebar-board-compact">
                                    {sidebarBoardItems.map((boardItem) => (
                                        <button
                                            key={boardItem.id}
                                            className={`sidebar-board-compact-item ${boardItem.id === activeBoardId ? 'active' : ''}`}
                                            onClick={() => handleSidebarBoardSelect(boardItem.id)}
                                            title={boardItem.name}
                                            aria-label={`Open board ${boardItem.name}`}
                                        >
                                            {getBoardInitials(boardItem.name)}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                className={`sidebar-nav-item ${view === 'scope' ? 'active' : ''}`}
                                onClick={handleScopeNavClick}
                                data-tooltip="Scope Window"
                            >
                                <span className="sidebar-nav-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                        <rect x="4" y="4" width="16" height="16" rx="3" />
                                        <path d="M8 9h8" />
                                        <path d="M8 13h6" />
                                        <path d="M8 17h4" />
                                    </svg>
                                </span>
                                <span className="sidebar-nav-label">Scope Window</span>
                            </button>
                            <button
                                className={`sidebar-nav-item ${view === 'okr' ? 'active' : ''}`}
                                onClick={handleOkrNavClick}
                                data-tooltip="OKRs"
                            >
                                <span className="sidebar-nav-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                        <path d="M4 19V5" />
                                        <path d="M9 19V9" />
                                        <path d="M14 19V7" />
                                        <path d="M19 19V12" />
                                    </svg>
                                </span>
                                <span className="sidebar-nav-label">OKRs</span>
                                <span
                                    className={`sidebar-nav-chevron ${isOkrNavOpen ? 'open' : ''}`}
                                    aria-hidden="true"
                                >
                                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="4 8 10 14 16 8" />
                                    </svg>
                                </span>
                            </button>
                            {!isSidebarCollapsed && isOkrNavOpen && (
                                <div className="sidebar-board-list">
                                    {okrLoading ? (
                                        <div className="sidebar-board-empty">Loading OKRs…</div>
                                    ) : objectiveViews.length === 0 ? (
                                        <div className="sidebar-board-empty">No objectives yet.</div>
                                    ) : (
                                        objectiveViews.map((objective) => (
                                            <button
                                                key={objective.id}
                                                className={`sidebar-board-item ${objective.id === okrActiveObjective?.id ? 'active' : ''}`}
                                                onClick={() => handleSidebarObjectiveSelect(objective.id)}
                                            >
                                                <span className="sidebar-board-dot" aria-hidden="true" />
                                                <span className="sidebar-board-label">{objective.title}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                            {isSidebarCollapsed && isOkrNavOpen && view === 'okr' && (
                                <div className="sidebar-board-compact">
                                    {objectiveViews.map((objective) => (
                                        <button
                                            key={objective.id}
                                            className={`sidebar-board-compact-item ${objective.id === okrActiveObjective?.id ? 'active' : ''}`}
                                            onClick={() => handleSidebarObjectiveSelect(objective.id)}
                                            title={objective.title}
                                            aria-label={`Open objective ${objective.title}`}
                                        >
                                            {getBoardInitials(objective.title)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="sidebar-footer">
                        <button
                            className="sidebar-toggle"
                            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                <path d="M6 12h12" />
                                <path d="M12 6l6 6-6 6" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            <main className="main-content">
                {loading && (
                    <div className="loading-strip">Syncing huddle…</div>
                )}
                {isPersonalActive && !hasSharedHuddles && !dismissHuddleCta && (
                    <div className="huddle-cta">
                        <div>
                            <div className="huddle-cta-title">Share work with a huddle</div>
                            <div className="huddle-cta-text">Create a shared huddle for your team while keeping your private tasks separate.</div>
                        </div>
                        <div className="huddle-cta-actions">
                            <button className="btn btn-primary btn-compact" onClick={() => setIsTeamModalOpen(true)}>
                                Create shared huddle
                            </button>
                            <button className="btn btn-ghost btn-compact" onClick={() => setDismissHuddleCta(true)}>
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}
                {invites.length > 0 && (
                    <div className="invite-banner">
                        <div>
                            <div className="invite-title">Huddle invitations</div>
                            <div className="invite-text">You have {invites.length} pending invitation{invites.length > 1 ? 's' : ''}.</div>
                        </div>
                        <button className="btn btn-ghost btn-compact" onClick={() => setIsInvitesModalOpen(true)}>
                            View invites
                        </button>
                    </div>
                )}
                {!activeTenantId && (
                    <div className="team-warning">
                        <div>
                            <strong>No huddle selected.</strong> Create or join a huddle to start managing tasks.
                        </div>
                        <button className="btn btn-ghost btn-compact" onClick={() => setIsTeamModalOpen(true)}>
                            Create huddle
                        </button>
                    </div>
                )}
                <div className="page-heading">
                    <div className="page-breadcrumbs">
                        {breadcrumbItems.map((item, index) => (
                            <span key={`${item.label}-${index}`} className="page-breadcrumb-item">
                                {item.onClick ? (
                                    <button type="button" className="page-breadcrumb-link" onClick={item.onClick}>
                                        {item.label}
                                    </button>
                                ) : (
                                    <span>{item.label}</span>
                                )}
                                {index < breadcrumbItems.length - 1 && <span className="page-breadcrumb-sep">/</span>}
                                {index === breadcrumbItems.length - 1 && view === 'okr' && (
                                    <span className="board-switch-inline">
                                        <button
                                            type="button"
                                            className="board-switch-trigger-icon"
                                            onClick={() => setOkrMenuOpen((prev) => !prev)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                                <path d="M6 9l6 6 6-6" />
                                            </svg>
                                        </button>
                                        {okrMenuOpen && (
                                            <div className="board-switch-menu">
                                                <button
                                                    type="button"
                                                    className="board-switch-item create"
                                                    onClick={() => {
                                                        setOkrMenuOpen(false);
                                                        setObjectiveComposerOpen(true);
                                                    }}
                                                >
                                                    + Objective erstellen
                                                </button>
                                                {objectiveViews.map((objective) => (
                                                    <button
                                                        key={objective.id}
                                                        type="button"
                                                        className={`board-switch-item ${objective.id === okrActiveObjective?.id ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setOkrMenuOpen(false);
                                                            openObjectiveFocus(objective.id);
                                                        }}
                                                    >
                                                        {objective.title}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </span>
                                )}
                                {index === breadcrumbItems.length - 1 && (view === 'kanban' || view === 'table') && (
                                    <span className="board-switch-inline">
                                        <button
                                            type="button"
                                            className="board-switch-trigger-icon"
                                            onClick={() => setBoardMenuOpen((prev) => !prev)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                                <path d="M6 9l6 6 6-6" />
                                            </svg>
                                        </button>
                                        {boardMenuOpen && (
                                            <div className="board-switch-menu">
                                                <button
                                                    type="button"
                                                    className="board-switch-item create"
                                                    onClick={() => {
                                                        setBoardMenuOpen(false);
                                                        handleCreateBoard();
                                                    }}
                                                >
                                                    + Board erstellen
                                                </button>
                                                {boards.map((boardItem) => (
                                                    <button
                                                        key={boardItem.id}
                                                        type="button"
                                                        className={`board-switch-item ${boardItem.id === activeBoardId ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setBoardMenuOpen(false);
                                                            handleBoardChange(boardItem.id);
                                                        }}
                                                    >
                                                        {boardItem.name}
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    className={`board-switch-item ${activeBoardId === ARCHIVED_BOARD_ID ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setBoardMenuOpen(false);
                                                        handleBoardChange(ARCHIVED_BOARD_ID);
                                                    }}
                                                >
                                                    Archived
                                                </button>
                                            </div>
                                        )}
                                    </span>
                                )}
                            </span>
                        ))}
                    </div>
                    <div className="page-heading-row">
                        <h1>
                            {view === 'settings'
                                ? 'Settings'
                                : view === 'okr'
                                    ? 'OKRs'
                                : view === 'dashboard'
                                    ? 'Dashboard'
                                    : view === 'calendar'
                                        ? 'Calendar'
                                        : view === 'scope'
                                            ? (scopeScreen === 'detail' && activeScopeWindow ? activeScopeWindow.name : 'Scope Window')
                                            : (activeBoard?.name || activeHuddleName || 'Board')}
                        </h1>
                        {(view === 'kanban' || view === 'table') && (
                            <button
                                className="icon-action create"
                                disabled={!activeTenantId}
                                onClick={openCreateTask}
                                data-tooltip="Task erstellen"
                                aria-label="Task erstellen"
                            >
                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                    <path d="M12 5v14" />
                                    <path d="M5 12h14" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
                {loading ? (
                    <div className="content-loader">
                        <div className="content-loader-title">Loading huddle…</div>
                        <div className="content-loader-text">Fetching tasks and status.</div>
                    </div>
                ) : view === 'calendar' ? (
                    <div className="calendar-view">
                        <div className="calendar-header">
                            <div className="calendar-header-left">
                                <div className="calendar-title">{calendarMonthLabel}</div>
                                <div className="calendar-nav">
                                    <button className="btn btn-ghost btn-compact" onClick={handleCalendarToday}>
                                        Today
                                    </button>
                                    <button
                                        className="icon-action"
                                        onClick={() => handleCalendarMonthChange(-1)}
                                        aria-label="Previous month"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                            <path d="M15 6l-6 6 6 6" />
                                        </svg>
                                    </button>
                                    <button
                                        className="icon-action"
                                        onClick={() => handleCalendarMonthChange(1)}
                                        aria-label="Next month"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                            <path d="M9 6l6 6-6 6" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="calendar-imports">
                                <div className="calendar-import-card">
                                    <div className="calendar-import-title">Manual import (.ics)</div>
                                    <div className="calendar-import-meta">
                                        Upload a calendar export. Re-upload to refresh.
                                    </div>
                                    <div className="calendar-import-form">
                                        <input
                                            key={calendarImportInputKey}
                                            type="file"
                                            accept=".ics,text/calendar"
                                            onChange={(event) => {
                                                const file = event.target.files?.[0] || null;
                                                setCalendarImportFile(file);
                                            }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Optional label"
                                            value={calendarImportFileName}
                                            onChange={(event) => setCalendarImportFileName(event.target.value)}
                                        />
                                        <button
                                            className="btn btn-primary btn-compact"
                                            onClick={handleCalendarImportFile}
                                            disabled={calendarImporting || !calendarImportFile}
                                        >
                                            {calendarImporting ? 'Importing…' : 'Import'}
                                        </button>
                                    </div>
                                </div>
                                <div className="calendar-import-card">
                                    <div className="calendar-import-title">Subscribe via URL</div>
                                    <div className="calendar-import-meta">
                                        Add a published ICS link. Auto-refreshes while open.
                                    </div>
                                    <div className="calendar-import-form">
                                        <input
                                            type="url"
                                            placeholder="https://outlook.office.com/calendar/..."
                                            value={calendarImportUrl}
                                            onChange={(event) => setCalendarImportUrl(event.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Optional label"
                                            value={calendarImportUrlName}
                                            onChange={(event) => setCalendarImportUrlName(event.target.value)}
                                        />
                                        <button
                                            className="btn btn-primary btn-compact"
                                            onClick={handleCalendarImportUrl}
                                            disabled={calendarImporting || !calendarImportUrl.trim()}
                                        >
                                            {calendarImporting ? 'Subscribing…' : 'Subscribe'}
                                        </button>
                                    </div>
                                </div>
                                {calendarImports.map((item) => (
                                    <div key={item.id} className="calendar-import-card">
                                        <div className="calendar-import-title">{item.name}</div>
                                        <div className="calendar-import-meta">
                                            {item.type === 'url' ? 'URL subscription' : 'File import'} ·{' '}
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </div>
                                        <button
                                            className="btn btn-ghost btn-compact"
                                            onClick={() => handleCalendarImportRemove(item.id)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {calendarError && <div className="calendar-error">{calendarError}</div>}
                        <div className="calendar-layout">
                            <div className="calendar-grid">
                                <div className="calendar-weekdays">
                                    {calendarWeekdays.map((day) => (
                                        <span key={day}>{day}</span>
                                    ))}
                                </div>
                                <div className="calendar-days">
                                    {calendarRange.days.map((day) => {
                                        const key = toDateKey(day);
                                        const events = calendarEventsByDay.get(key) || [];
                                        const isCurrentMonth = day.getMonth() === calendarDate.getMonth();
                                        const isToday = key === toDateKey(new Date());
                                        const isSelected = key === selectedCalendarKey;
                                        return (
                                            <button
                                                key={key}
                                                className={`calendar-day${isCurrentMonth ? '' : ' muted'}${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                                                onClick={() => setCalendarSelectedDate(day)}
                                            >
                                                <span className="calendar-day-number">{day.getDate()}</span>
                                                <span className="calendar-day-events">
                                                    {events.slice(0, 3).map((event, index) => (
                                                        <span
                                                            key={`${event.id}-${index}`}
                                                            className={`calendar-event-dot ${event.provider}`}
                                                        />
                                                    ))}
                                                    {events.length > 3 && (
                                                        <span className="calendar-event-more">+{events.length - 3}</span>
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="calendar-agenda">
                                <div className="calendar-agenda-header">
                                    <div className="calendar-agenda-date">
                                        {calendarSelectedDate.toLocaleDateString(undefined, {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </div>
                                    <div className="calendar-agenda-meta">{selectedDayEvents.length} events</div>
                                </div>
                                {calendarLoading ? (
                                    <div className="calendar-loading">Loading events…</div>
                                ) : selectedDayEvents.length === 0 ? (
                                    <div className="calendar-empty">No events scheduled.</div>
                                ) : (
                                    <div className="calendar-agenda-list">
                                        {selectedDayEvents.map((event) => {
                                            const start = new Date(event.start);
                                            const end = new Date(event.end);
                                            const timeLabel = event.allDay
                                                ? 'All day'
                                                : `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                                            return (
                                                <div key={`${event.provider}-${event.id}`} className="calendar-agenda-item">
                                                    <span className={`calendar-event-dot ${event.provider}`} />
                                                    <div className="calendar-agenda-info">
                                                        <div className="calendar-agenda-time">{timeLabel}</div>
                                                        <div className="calendar-agenda-title">{event.title || '(No title)'}</div>
                                                        {event.location && (
                                                            <div className="calendar-agenda-meta">{event.location}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : view === 'settings' ? (
                    <div className="settings-panel">
                        {settingsDraft ? (
                            <>
                                <div className="settings-actions">
                                    <button
                                        className="btn btn-primary btn-compact"
                                        onClick={handleSaveSettings}
                                        disabled={settingsSaving}
                                    >
                                        {settingsSaving ? 'Saving...' : 'Save settings'}
                                    </button>
                                    {settingsMessage && <div className="settings-message">{settingsMessage}</div>}
                                </div>
                                <div className="settings-grid">
                                    <section className="settings-card">
                                        <div className="settings-title">Profile</div>
                                        <div className="settings-avatar">
                                            {settingsDraft.avatarUrl ? (
                                                <img src={settingsDraft.avatarUrl} alt="Avatar preview" />
                                            ) : (
                                                <div className="settings-avatar-placeholder">
                                                    {getInitials(settingsDraft.name || userProfile?.email || 'U')}
                                                </div>
                                            )}
                                            <label className="settings-upload">
                                                Upload avatar
                                                <input type="file" accept="image/*" onChange={(e) => handleAvatarUpload(e.target.files)} />
                                            </label>
                                        </div>
                                        <label>
                                            Name
                                            <input
                                                type="text"
                                                value={settingsDraft.name}
                                                onChange={(e) => setSettingsDraft({ ...settingsDraft, name: e.target.value })}
                                            />
                                        </label>
                                        <label>
                                            Avatar URL
                                            <input
                                                type="text"
                                                value={settingsDraft.avatarUrl}
                                                onChange={(e) => setSettingsDraft({ ...settingsDraft, avatarUrl: e.target.value })}
                                            />
                                        </label>
                                        <label>
                                            Email
                                            <input type="text" value={userProfile?.email || ''} readOnly />
                                        </label>
                                        <label>
                                            Profile visibility
                                            <select
                                                value={settingsDraft.profileVisibility}
                                                onChange={(e) => setSettingsDraft({ ...settingsDraft, profileVisibility: e.target.value })}
                                            >
                                                <option value="huddle">Visible to huddles</option>
                                                <option value="private">Private</option>
                                            </select>
                                        </label>
                                    </section>

                                    <section className="settings-card">
                                        <div className="settings-title">Localization</div>
                                        <label>
                                            Timezone
                                            <input
                                                type="text"
                                                value={settingsDraft.timezone}
                                                onChange={(e) => setSettingsDraft({ ...settingsDraft, timezone: e.target.value })}
                                            />
                                        </label>
                                        <label>
                                            Locale
                                            <input
                                                type="text"
                                                value={settingsDraft.locale}
                                                onChange={(e) => setSettingsDraft({ ...settingsDraft, locale: e.target.value })}
                                            />
                                        </label>
                                    </section>

                                    <section className="settings-card">
                                        <div className="settings-title">Defaults</div>
                                        <label>
                                            Default huddle
                                            <select
                                                value={settingsDraft.defaultHuddleId || ''}
                                                onChange={(e) => setSettingsDraft({ ...settingsDraft, defaultHuddleId: e.target.value })}
                                            >
                                                {displayMemberships.map((membership) => (
                                                    <option key={membership.id} value={membership.tenantId}>
                                                        {getHuddleName(membership.tenant?.name) || membership.tenantId}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            Default priority
                                            <select
                                                value={settingsDraft.defaultPriority}
                                                onChange={(e) => setSettingsDraft({ ...settingsDraft, defaultPriority: e.target.value })}
                                            >
                                                <option value="LOW">Low</option>
                                                <option value="MEDIUM">Medium</option>
                                                <option value="HIGH">High</option>
                                                <option value="CRITICAL">Critical</option>
                                            </select>
                                        </label>
                                        <label>
                                            Default status
                                            <select
                                                value={settingsDraft.defaultStatus}
                                                onChange={(e) => setSettingsDraft({ ...settingsDraft, defaultStatus: e.target.value })}
                                            >
                                                <option value="BACKLOG">Backlog</option>
                                                <option value="TODO">Todo</option>
                                                <option value="IN_PROGRESS">In progress</option>
                                                <option value="DONE">Done</option>
                                            </select>
                                        </label>
                                    </section>

                                    <section className="settings-card">
                                        <div className="settings-title">Notifications</div>
                                        <div className="settings-subtitle">Email</div>
                                        <label className="settings-toggle">
                                            <input
                                                type="checkbox"
                                                checked={settingsDraft.notifications.email.assigned}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    notifications: {
                                                        ...settingsDraft.notifications,
                                                        email: { ...settingsDraft.notifications.email, assigned: e.target.checked }
                                                    }
                                                })}
                                            />
                                            Task assigned
                                        </label>
                                        <label className="settings-toggle">
                                            <input
                                                type="checkbox"
                                                checked={settingsDraft.notifications.email.mentions}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    notifications: {
                                                        ...settingsDraft.notifications,
                                                        email: { ...settingsDraft.notifications.email, mentions: e.target.checked }
                                                    }
                                                })}
                                            />
                                            Mentions
                                        </label>
                                        <label className="settings-toggle">
                                            <input
                                                type="checkbox"
                                                checked={settingsDraft.notifications.email.due}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    notifications: {
                                                        ...settingsDraft.notifications,
                                                        email: { ...settingsDraft.notifications.email, due: e.target.checked }
                                                    }
                                                })}
                                            />
                                            Due date reminders
                                        </label>
                                        <label className="settings-toggle">
                                            <input
                                                type="checkbox"
                                                checked={settingsDraft.notifications.email.invites}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    notifications: {
                                                        ...settingsDraft.notifications,
                                                        email: { ...settingsDraft.notifications.email, invites: e.target.checked }
                                                    }
                                                })}
                                            />
                                            Huddle invites
                                        </label>
                                        <div className="settings-subtitle">In-app</div>
                                        <label className="settings-toggle">
                                            <input
                                                type="checkbox"
                                                checked={settingsDraft.notifications.inApp.assigned}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    notifications: {
                                                        ...settingsDraft.notifications,
                                                        inApp: { ...settingsDraft.notifications.inApp, assigned: e.target.checked }
                                                    }
                                                })}
                                            />
                                            Task assigned
                                        </label>
                                        <label className="settings-toggle">
                                            <input
                                                type="checkbox"
                                                checked={settingsDraft.notifications.inApp.mentions}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    notifications: {
                                                        ...settingsDraft.notifications,
                                                        inApp: { ...settingsDraft.notifications.inApp, mentions: e.target.checked }
                                                    }
                                                })}
                                            />
                                            Mentions
                                        </label>
                                        <label className="settings-toggle">
                                            <input
                                                type="checkbox"
                                                checked={settingsDraft.notifications.inApp.due}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    notifications: {
                                                        ...settingsDraft.notifications,
                                                        inApp: { ...settingsDraft.notifications.inApp, due: e.target.checked }
                                                    }
                                                })}
                                            />
                                            Due date reminders
                                        </label>
                                        <label className="settings-toggle">
                                            <input
                                                type="checkbox"
                                                checked={settingsDraft.notifications.inApp.invites}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    notifications: {
                                                        ...settingsDraft.notifications,
                                                        inApp: { ...settingsDraft.notifications.inApp, invites: e.target.checked }
                                                    }
                                                })}
                                            />
                                            Huddle invites
                                        </label>
                                    </section>

                                    <section className="settings-card">
                                        <div className="settings-title">Working hours</div>
                                        <label>
                                            Start
                                            <input
                                                type="time"
                                                value={settingsDraft.workingHours.start}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    workingHours: { ...settingsDraft.workingHours, start: e.target.value }
                                                })}
                                            />
                                        </label>
                                        <label>
                                            End
                                            <input
                                                type="time"
                                                value={settingsDraft.workingHours.end}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    workingHours: { ...settingsDraft.workingHours, end: e.target.value }
                                                })}
                                            />
                                        </label>
                                        <div className="settings-subtitle">Days</div>
                                        <div className="settings-days">
                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                                <label key={day} className="settings-day">
                                                    <input
                                                        type="checkbox"
                                                        checked={settingsDraft.workingHours.days.includes(day)}
                                                        onChange={(e) => {
                                                            const next = e.target.checked
                                                                ? settingsDraft.workingHours.days.concat(day)
                                                                : settingsDraft.workingHours.days.filter((value: string) => value !== day);
                                                            setSettingsDraft({
                                                                ...settingsDraft,
                                                                workingHours: { ...settingsDraft.workingHours, days: next }
                                                            });
                                                        }}
                                                    />
                                                    {day}
                                                </label>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="settings-card">
                                        <div className="settings-title">Reminders</div>
                                        <label>
                                            Due soon (hours)
                                            <input
                                                type="number"
                                                min={1}
                                                value={settingsDraft.reminders.dueSoonHours}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    reminders: { ...settingsDraft.reminders, dueSoonHours: Number(e.target.value) }
                                                })}
                                            />
                                        </label>
                                        <label>
                                            Daily summary
                                            <input
                                                type="time"
                                                value={settingsDraft.reminders.dailySummaryTime}
                                                onChange={(e) => setSettingsDraft({
                                                    ...settingsDraft,
                                                    reminders: { ...settingsDraft.reminders, dailySummaryTime: e.target.value }
                                                })}
                                            />
                                        </label>
                                    </section>

                                    <section className="settings-card">
                                        <div className="settings-title">Task templates</div>
                                        <div className="template-form">
                                            <input
                                                type="text"
                                                placeholder="Template name"
                                                value={templateDraft.name}
                                                onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Title"
                                                value={templateDraft.title}
                                                onChange={(e) => setTemplateDraft({ ...templateDraft, title: e.target.value })}
                                            />
                                            <select
                                                value={templateDraft.priority}
                                                onChange={(e) => setTemplateDraft({ ...templateDraft, priority: e.target.value })}
                                            >
                                                <option value="LOW">Low</option>
                                                <option value="MEDIUM">Medium</option>
                                                <option value="HIGH">High</option>
                                                <option value="CRITICAL">Critical</option>
                                            </select>
                                            <select
                                                value={templateDraft.status}
                                                onChange={(e) => setTemplateDraft({ ...templateDraft, status: e.target.value })}
                                            >
                                                <option value="BACKLOG">Backlog</option>
                                                <option value="TODO">Todo</option>
                                                <option value="IN_PROGRESS">In progress</option>
                                                <option value="DONE">Done</option>
                                            </select>
                                            <button
                                                className="btn btn-secondary btn-compact"
                                                onClick={() => {
                                                    if (!templateDraft.name.trim() || !templateDraft.title.trim()) return;
                                                    const nextTemplate = {
                                                        id: Math.random().toString(36).slice(2),
                                                        name: templateDraft.name.trim(),
                                                        title: templateDraft.title.trim(),
                                                        priority: templateDraft.priority,
                                                        status: templateDraft.status,
                                                    };
                                                    setSettingsDraft({
                                                        ...settingsDraft,
                                                        taskTemplates: settingsDraft.taskTemplates.concat(nextTemplate),
                                                    });
                                                    setTemplateDraft({ name: '', title: '', priority: 'MEDIUM', status: 'BACKLOG' });
                                                }}
                                            >
                                                Add template
                                            </button>
                                        </div>
                                        <div className="template-list">
                                            {settingsDraft.taskTemplates.map((template: any) => (
                                                <div key={template.id} className="template-row">
                                                    <div>
                                                        <div className="member-name">{template.name}</div>
                                                        <div className="member-meta">{template.title}</div>
                                                    </div>
                                                    <button
                                                        className="btn btn-ghost btn-compact"
                                                        onClick={() => {
                                                            setSettingsDraft({
                                                                ...settingsDraft,
                                                                taskTemplates: settingsDraft.taskTemplates.filter((t: any) => t.id !== template.id),
                                                            });
                                                        }}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                            {settingsDraft.taskTemplates.length === 0 && (
                                                <div className="empty-state">No templates yet.</div>
                                            )}
                                        </div>
                                    </section>

                                    <section className="settings-card">
                                        <div className="settings-title">Huddles</div>
                                        <div className="template-list">
                                            {displayMemberships.map((membership) => (
                                                <div key={membership.id} className="template-row">
                                                    <div>
                                                        <div className="member-name">{getHuddleName(membership.tenant?.name) || membership.tenantId}</div>
                                                        <div className="member-meta">Role: {membership.role}</div>
                                                    </div>
                                                    {membership.tenant?.name !== 'Personal' && (
                                                        <button
                                                            className="btn btn-ghost btn-compact"
                                                            onClick={() => handleLeaveHuddle(membership.tenantId)}
                                                        >
                                                            Leave
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="settings-card">
                                        <div className="settings-title">Security & Sessions</div>
                                        <button className="btn btn-secondary btn-compact" onClick={handlePasswordReset}>
                                            Send password reset email
                                        </button>
                                        <button className="btn btn-ghost btn-compact" onClick={handleSignOut}>
                                            Sign out
                                        </button>
                                    </section>

                                    <section className="settings-card">
                                        <div className="settings-title">Export</div>
                                        <div className="settings-actions">
                                            <button className="btn btn-secondary btn-compact" onClick={exportTasksJson}>
                                                Export JSON
                                            </button>
                                            <button className="btn btn-secondary btn-compact" onClick={exportTasksCsv}>
                                                Export CSV
                                            </button>
                                        </div>
                                    </section>
                                </div>
                            </>
                        ) : (
                            <div className="empty-state">Loading settings...</div>
                        )}
                    </div>
                ) : view === 'okr' ? (
                    showLegacyOkr ? (
                    <div className="okr-panel">
                        <div className="okr-create">
                            <div className="okr-card-title">Create objective</div>
                            <div className="okr-grid">
                                <label>
                                    Title
                                    <input
                                        type="text"
                                        value={newObjective.title}
                                        onChange={(e) => setNewObjective((prev) => ({ ...prev, title: e.target.value }))}
                                        placeholder="Ship a new onboarding"
                                    />
                                </label>
                                <label>
                                    Owner
                                    <select
                                        value={newObjective.ownerId}
                                        onChange={(e) => setNewObjective((prev) => ({ ...prev, ownerId: e.target.value }))}
                                    >
                                        <option value="">Unassigned</option>
                                        {getMembersForTenant(activeTenantId).map((member) => (
                                            <option key={member.userId} value={member.userId}>
                                                {member.user?.name || member.user?.email || member.userId}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Start date
                                    <input
                                        type="date"
                                        value={newObjective.startDate}
                                        onChange={(e) => setNewObjective((prev) => ({ ...prev, startDate: e.target.value }))}
                                    />
                                </label>
                                <label>
                                    End date
                                    <input
                                        type="date"
                                        value={newObjective.endDate}
                                        onChange={(e) => setNewObjective((prev) => ({ ...prev, endDate: e.target.value }))}
                                    />
                                </label>
                                <label>
                                    Status
                                    <select
                                        value={newObjective.status}
                                        onChange={(e) => setNewObjective((prev) => ({ ...prev, status: e.target.value }))}
                                    >
                                        <option value="ACTIVE">Active</option>
                                        <option value="AT_RISK">At risk</option>
                                        <option value="PAUSED">Paused</option>
                                        <option value="DONE">Done</option>
                                    </select>
                                </label>
                                <label className="okr-grid-full">
                                    Description
                                    <textarea
                                        value={newObjective.description}
                                        onChange={(e) => setNewObjective((prev) => ({ ...prev, description: e.target.value }))}
                                        placeholder="Short context for the objective"
                                        rows={3}
                                    />
                                </label>
                            </div>
                            <div className="okr-actions">
                                <button
                                    className="icon-action create"
                                    onClick={handleCreateObjective}
                                    data-tooltip="Objective erstellen"
                                    aria-label="Objective erstellen"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                        <path d="M12 5v14" />
                                        <path d="M5 12h14" />
                                    </svg>
                                </button>
                                <button className="btn btn-ghost btn-compact" onClick={loadOkrs}>
                                    Refresh
                                </button>
                            </div>
                        </div>
                        {okrError && <div className="okr-error">Error: {okrError}</div>}
                        {okrLoading ? (
                            <div className="empty-state">Loading OKRs...</div>
                        ) : (
                            <div className="okr-list">
                                {okrObjectives.length === 0 && (
                                    <div className="empty-state">No objectives yet.</div>
                                )}
                                {okrObjectives.map((objective) => {
                                    const ownerLabel = objective.ownerId
                                        ? getMemberLabel(activeTenantId, objective.ownerId)
                                        : 'Unassigned';
                                    const isExpanded = expandedObjectives.includes(objective.id);
                                    return (
                                        <div
                                            key={objective.id}
                                            className="okr-card"
                                            onClick={() => navigateOkr(`/okr/objective/${objective.id}`)}
                                        >
                                            <div className="okr-header">
                                                <div>
                                                    <div className="okr-title">{objective.title}</div>
                                                    {objective.description && (
                                                        <div className="okr-description">{objective.description}</div>
                                                    )}
                                                    <div className="okr-meta">
                                                        <span>{objective.status}</span>
                                                        {objective.ownerId ? (
                                                            <div className="okr-owner-stack">
                                                                {renderAvatarStack(activeTenantId || '', [objective.ownerId])}
                                                            </div>
                                                        ) : (
                                                            <span className="okr-owner-badge">Owner: {ownerLabel}</span>
                                                        )}
                                                        {objective.startDate && <span>{new Date(objective.startDate).toLocaleDateString()}</span>}
                                                        {objective.endDate && <span>{new Date(objective.endDate).toLocaleDateString()}</span>}
                                                    </div>
                                                </div>
                                                <div className="okr-progress">
                                                    <div className="okr-progress-bar">
                                                        <div className="okr-progress-fill" style={{ width: `${Math.round(objective.progress)}%` }} />
                                                    </div>
                                                    <div className="okr-progress-label">{Math.round(objective.progress)}%</div>
                                                </div>
                                                <button
                                                    className={`okr-chevron ${isExpanded ? 'expanded' : ''}`}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedObjectives((prev) =>
                                                            prev.includes(objective.id)
                                                                ? prev.filter((id) => id !== objective.id)
                                                                : [...prev, objective.id]
                                                        );
                                                    }}
                                                    aria-expanded={isExpanded}
                                                    aria-label={isExpanded ? 'Hide key results' : 'Show key results'}
                                                >
                                                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="4 8 10 14 16 8" />
                                                    </svg>
                                                </button>
                                            </div>
                                            {isExpanded && (
                                                <div className="okr-keyresults-expanded">
                                                    {objective.keyResults.length === 0 ? (
                                                        <div className="okr-empty">No key results yet.</div>
                                                    ) : (
                                                        objective.keyResults.map((kr) => (
                                                            <div key={kr.id} className="okr-kr-expanded">
                                                                <div className="okr-kr-expanded-header">
                                                                    <div className="okr-kr-expanded-main">
                                                                        <div className="okr-kr-title">{kr.title}</div>
                                                                        {kr.description && (
                                                                            <div className="okr-kr-description">{kr.description}</div>
                                                                        )}
                                                                        <div className="okr-kr-progress okr-progress-inline">
                                                                            <div className="okr-progress-bar">
                                                                                <div className="okr-progress-fill" style={{ width: `${Math.round(kr.progress)}%` }} />
                                                                            </div>
                                                                            <div className="okr-progress-foot">{Math.round(kr.progress)}%</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="okr-kr-date">
                                                                        Updated {new Date(kr.updatedAt || kr.createdAt).toLocaleDateString()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    ) : (
                    <div className="okr-shell">
                        {okrNotice && (
                            <div className="okr-notice">
                                <div className="okr-notice-title">
                                    {okrNotice.code === 'permission' ? 'Blocked by permission' : okrNotice.code === 'policy' ? 'Blocked by policy' : 'Request blocked'}
                                </div>
                                <div className="okr-notice-text">{okrNotice.safeReason}</div>
                                {okrNotice.correlationId && <div className="okr-notice-meta">Ref: {okrNotice.correlationId}</div>}
                            </div>
                        )}
                        {okrLoading && (
                            <div className="okr-loading">Syncing OKRs…</div>
                        )}

                        {okrScreen === 'objective' && okrActiveObjective && (
                            <div className="okr-focus">
                                <div className="okr-focus-main">
                                    <div className="okr-focus-header">
                                        <div>
                                            <div className="okr-focus-title">{okrActiveObjective.title}</div>
                                            <div className="okr-focus-meta">
                                                <span>{okrActiveObjective.status}</span>
                                                <span className="okr-owner-inline">
                                                    <span className="okr-owner-label">Owner</span>
                                                    {okrActiveObjective.ownerId ? (
                                                        renderAvatarStack(activeTenantId || '', [okrActiveObjective.ownerId])
                                                    ) : (
                                                        <span className="okr-owner-empty">—</span>
                                                    )}
                                                </span>
                                                {okrActiveObjective.startDate && <span>{new Date(okrActiveObjective.startDate).toLocaleDateString()}</span>} –
                                                {okrActiveObjective.endDate && <span>{new Date(okrActiveObjective.endDate).toLocaleDateString()}</span>}
                                            </div>
                                            {okrActiveObjective.description && (
                                                <div className="okr-focus-description">{okrActiveObjective.description}</div>
                                            )}
                                        </div>
                                        <div className="okr-focus-actions">
                                            {(okrActiveObjective.ownerId === userProfile?.id || isActiveHuddleOwner) && (
                                                <button
                                                    className="icon-action settings"
                                                    onClick={() => handleEditObjective(okrActiveObjective)}
                                                    data-tooltip="Einstellungen zum Objective"
                                                    aria-label="Einstellungen zum Objective"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                        <circle cx="12" cy="12" r="3.5" />
                                                        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3.7a7 7 0 0 0-1.6-1l-.3-2.4H9.3l-.3 2.4a7 7 0 0 0-1.6 1l-2.3-.7-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-.7a7 7 0 0 0 1.6 1l.3 2.4h5.4l.3-2.4a7 7 0 0 0 1.6-1l2.3.7 2-3.5-2-1.5a7 7 0 0 0 .1-1z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="okr-focus-progress">
                                        <div className="okr-progress-label">Progress</div>
                                        <div className="okr-progress-bar">
                                            <div className="okr-progress-fill" style={{ width: `${okrActiveObjective.progress}%` }} />
                                        </div>
                                        <div className="okr-progress-foot">{okrActiveObjective.progress}% of {okrActiveObjective.keyResults.length} key results</div>
                                    </div>
                                </div>
                                <div className="okr-focus-keyresults">
                                    <div className="okr-focus-section">
                                        <div className="okr-section-title">Key results</div>
                                        <div className="okr-section-toolbar">
                                            <div
                                                className="view-switch okr-view-switch okr-view-switch-three"
                                                role="tablist"
                                                aria-label="Key results view switcher"
                                                style={{
                                                    ['--active-index' as any]:
                                                        okrKrViewMode === 'list' ? 0 : okrKrViewMode === 'cards' ? 1 : 2,
                                                    ['--segment-count' as any]: 3,
                                                }}
                                            >
                                                <button
                                                    className={`view-pill ${okrKrViewMode === 'list' ? 'active' : ''}`}
                                                    onClick={() => setOkrKrViewMode('list')}
                                                    role="tab"
                                                    aria-selected={okrKrViewMode === 'list'}
                                                >
                                                    Liste
                                                </button>
                                                <button
                                                    className={`view-pill ${okrKrViewMode === 'cards' ? 'active' : ''}`}
                                                    onClick={() => setOkrKrViewMode('cards')}
                                                    role="tab"
                                                    aria-selected={okrKrViewMode === 'cards'}
                                                >
                                                    Cards
                                                </button>
                                                <button
                                                    className={`view-pill ${okrKrViewMode === 'table' ? 'active' : ''}`}
                                                    onClick={() => setOkrKrViewMode('table')}
                                                    role="tab"
                                                    aria-selected={okrKrViewMode === 'table'}
                                                >
                                                    Table
                                                </button>
                                            </div>
                                            {!okrActiveObjective.readOnly && (
                                                <button
                                                    className="btn btn-primary btn-compact"
                                                    onClick={() => openKrComposer(okrActiveObjective.id)}
                                                >
                                                    + KR
                                                </button>
                                            )}
                                        </div>
                                        {okrKrViewMode === 'table' ? (
                                            <div className="task-table-wrap okr-kr-table-wrap">
                                                <table className="task-table okr-kr-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Key result</th>
                                                            <th>Status</th>
                                                            <th>Progress</th>
                                                            <th>Members</th>
                                                            <th>Updated</th>
                                                            <th>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {okrActiveObjective.keyResults.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={6} className="okr-empty">No key results yet.</td>
                                                            </tr>
                                                        ) : (
                                                            okrActiveObjective.keyResults.map((kr) => (
                                                                <tr key={kr.id}>
                                                                    <td>
                                                                        <div className="okr-kr-table-title">{kr.title}</div>
                                                                        {kr.description && (
                                                                            <div className="okr-kr-table-desc">{kr.description}</div>
                                                                        )}
                                                                    </td>
                                                                    <td>
                                                                        {krStatusEditingId === kr.id ? (
                                                                            <div className="filter-dropdown okr-status-dropdown">
                                                                                <button
                                                                                    type="button"
                                                                                    className="filter-select okr-status-select"
                                                                                    onClick={() => setKrStatusEditingId(null)}
                                                                                    aria-haspopup="listbox"
                                                                                    aria-expanded="true"
                                                                                >
                                                                                    {krStatusLabel(kr.status)}
                                                                                </button>
                                                                                <div className="filter-options" role="listbox">
                                                                                    {['ON_TRACK', 'AT_RISK', 'OFF_TRACK'].map((value) => (
                                                                                        <button
                                                                                            key={value}
                                                                                            type="button"
                                                                                            className={`filter-option ${kr.status === value ? 'active' : ''} filter-option-${value.toLowerCase()}`}
                                                                                            onClick={() => {
                                                                                                handleUpdateKeyResult(kr.id, okrActiveObjective.id, { status: value });
                                                                                                setKrStatusEditingId(null);
                                                                                            }}
                                                                                            role="option"
                                                                                            aria-selected={kr.status === value}
                                                                                        >
                                                                                            {krStatusLabel(value)}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                className={`okr-status-badge status-${kr.status.toLowerCase()} tooltip-target`}
                                                                                onClick={() => setKrStatusEditingId(kr.id)}
                                                                                data-tooltip={`Klicken zum Ändern des Status (derzeit: ${krStatusLabel(kr.status)})`}
                                                                                aria-label={`Klicken zum Ändern des Status (derzeit: ${krStatusLabel(kr.status)})`}
                                                                            >
                                                                                {krStatusLabel(kr.status)}
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                    <td>
                                                                        <div className="okr-kr-table-progress okr-progress-inline">
                                                                            <div className="okr-progress-bar">
                                                                                <div className="okr-progress-fill" style={{ width: `${kr.progress}%` }} />
                                                                            </div>
                                                                            {krProgressEditingId === kr.id ? (
                                                                                <input
                                                                                    type="number"
                                                                                    className="okr-progress-input"
                                                                                    value={krProgressDraft}
                                                                                    min={0}
                                                                                    max={100}
                                                                                    onChange={(e) => setKrProgressDraft(e.target.value)}
                                                                                    onBlur={() => commitKrProgress(kr, okrActiveObjective.id)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') {
                                                                                            commitKrProgress(kr, okrActiveObjective.id);
                                                                                        }
                                                                                        if (e.key === 'Escape') {
                                                                                            setKrProgressEditingId(null);
                                                                                        }
                                                                                    }}
                                                                                    autoFocus
                                                                                />
                                                                            ) : (
                                                                                <button
                                                                                    type="button"
                                                                                    className="okr-progress-value tooltip-target"
                                                                                    onClick={() => startEditKrProgress(kr)}
                                                                                    data-tooltip={`Klicken zum Bearbeiten des Fortschritts (derzeit: ${Math.round(kr.progress)}%)`}
                                                                                    aria-label={`Klicken zum Bearbeiten des Fortschritts (derzeit: ${Math.round(kr.progress)}%)`}
                                                                                >
                                                                                    {Math.round(kr.progress)}%
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        {kr.assignees && kr.assignees.length > 0 ? (
                                                                            <div className="okr-kr-assignees">
                                                                                {renderAvatarStack(activeTenantId || '', kr.assignees)}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="okr-empty">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="okr-kr-date">
                                                                        {new Date(kr.lastUpdatedAt).toLocaleDateString()}
                                                                    </td>
                                                                    <td>
                                                                        <button
                                                                            className="icon-action settings"
                                                                            onClick={() => openKrEditor(kr, okrActiveObjective.id)}
                                                                            data-tooltip="KR bearbeiten"
                                                                            aria-label="KR bearbeiten"
                                                                        >
                                                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                                <path d="M12 20h9" />
                                                                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                                                            </svg>
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className={`okr-kr-list ${okrKrViewMode === 'cards' ? 'okr-kr-cards' : ''}`}>
                                                {okrActiveObjective.keyResults.length === 0 && <div className="okr-empty">No key results yet.</div>}
                                                {okrActiveObjective.keyResults.map((kr) => (
                                                    <div key={kr.id} className="okr-kr-card">
                                                        <div className="okr-kr-expanded-header okr-kr-detail-header">
                                                            <div className="okr-kr-toprow">
                                                                <div className="okr-kr-toprow-left">
                                                                    {krStatusEditingId === kr.id ? (
                                                                        <div className="filter-dropdown okr-status-dropdown">
                                                                            <button
                                                                                type="button"
                                                                                className="filter-select okr-status-select"
                                                                                onClick={() => setKrStatusEditingId(null)}
                                                                                aria-haspopup="listbox"
                                                                                aria-expanded="true"
                                                                            >
                                                                                {krStatusLabel(kr.status)}
                                                                            </button>
                                                                            <div className="filter-options" role="listbox">
                                                                                {['ON_TRACK', 'AT_RISK', 'OFF_TRACK'].map((value) => (
                                                                                    <button
                                                                                        key={value}
                                                                                        type="button"
                                                                                        className={`filter-option ${kr.status === value ? 'active' : ''} filter-option-${value.toLowerCase()}`}
                                                                                        onClick={() => {
                                                                                            handleUpdateKeyResult(kr.id, okrActiveObjective.id, { status: value });
                                                                                            setKrStatusEditingId(null);
                                                                                        }}
                                                                                        role="option"
                                                                                        aria-selected={kr.status === value}
                                                                                    >
                                                                                        {krStatusLabel(value)}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            className={`okr-status-badge status-${kr.status.toLowerCase()} tooltip-target`}
                                                                            onClick={() => setKrStatusEditingId(kr.id)}
                                                                            data-tooltip={`Klicken zum Ändern des Status (derzeit: ${krStatusLabel(kr.status)})`}
                                                                            aria-label={`Klicken zum Ändern des Status (derzeit: ${krStatusLabel(kr.status)})`}
                                                                        >
                                                                            {krStatusLabel(kr.status)}
                                                                        </button>
                                                                    )}
                                                                    {kr.assignees && kr.assignees.length > 0 && (
                                                                        <div className="okr-kr-assignees">
                                                                            {renderAvatarStack(activeTenantId || '', kr.assignees)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="okr-kr-toprow-right">
                                                                    <div className="okr-kr-date">
                                                                        Updated {new Date(kr.lastUpdatedAt).toLocaleDateString()}
                                                                    </div>
                                                                    <button
                                                                        className="icon-action settings"
                                                                        onClick={() => openKrEditor(kr, okrActiveObjective.id)}
                                                                        data-tooltip="KR bearbeiten"
                                                                        aria-label="KR bearbeiten"
                                                                    >
                                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                            <path d="M12 20h9" />
                                                                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="okr-kr-expanded-main">
                                                                <div className="okr-kr-title">{kr.title}</div>
                                                                {kr.description && (
                                                                    <div className="okr-kr-description">{kr.description}</div>
                                                                )}
                                                                <div className="okr-kr-progress okr-progress-inline">
                                                                    <div className="okr-progress-bar">
                                                                        <div className="okr-progress-fill" style={{ width: `${kr.progress}%` }} />
                                                                    </div>
                                                                    {krProgressEditingId === kr.id ? (
                                                                        <input
                                                                            type="number"
                                                                            className="okr-progress-input"
                                                                            value={krProgressDraft}
                                                                            min={0}
                                                                            max={100}
                                                                            onChange={(e) => setKrProgressDraft(e.target.value)}
                                                                            onBlur={() => commitKrProgress(kr, okrActiveObjective.id)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    commitKrProgress(kr, okrActiveObjective.id);
                                                                                }
                                                                                if (e.key === 'Escape') {
                                                                                    setKrProgressEditingId(null);
                                                                                }
                                                                            }}
                                                                            autoFocus
                                                                        />
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            className="okr-progress-value tooltip-target"
                                                                            onClick={() => startEditKrProgress(kr)}
                                                                            data-tooltip={`Klicken zum Bearbeiten des Fortschritts (derzeit: ${Math.round(kr.progress)}%)`}
                                                                            aria-label={`Klicken zum Bearbeiten des Fortschritts (derzeit: ${Math.round(kr.progress)}%)`}
                                                                        >
                                                                            {Math.round(kr.progress)}%
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <button className="btn btn-ghost btn-compact" onClick={() => navigateOkr(`/okr/review/${okrActiveObjective.id}`)}>
                                            Start strategic review
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {okrScreen === 'objective' && !okrActiveObjective && (
                            <div className="okr-empty">Select an objective from Pulse to focus.</div>
                        )}

                        {okrScreen === 'review' && okrActiveObjective && (
                            <div className="okr-review">
                                <div className="okr-review-header">
                                    <div>
                                        <div className="okr-review-title">Strategic review</div>
                                        <div className="okr-review-subtitle">6-minute guided check-in</div>
                                    </div>
                                    <button className="btn btn-ghost btn-compact" onClick={() => openObjectiveFocus(okrActiveObjective.id)}>
                                        Back to focus
                                    </button>
                                </div>
                                {reviewSteps.length > 0 && (
                                    <div className="okr-review-steps">
                                        <div className="okr-review-step">
                                            <div className="okr-step-title">{reviewSteps[reviewStep]?.title}</div>
                                            <div className="okr-step-text">{reviewSteps[reviewStep]?.content}</div>
                                        </div>
                                        <div className="okr-review-nav">
                                            <button
                                                className="btn btn-ghost btn-compact"
                                                onClick={() => setReviewStep((prev) => Math.max(prev - 1, 0))}
                                                disabled={reviewStep === 0}
                                            >
                                                Back
                                            </button>
                                            <div className="okr-review-progress">
                                                Step {reviewStep + 1} / {reviewSteps.length}
                                            </div>
                                            <button
                                                className="btn btn-secondary btn-compact"
                                                onClick={() => setReviewStep((prev) => Math.min(prev + 1, reviewSteps.length - 1))}
                                                disabled={reviewStep === reviewSteps.length - 1}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {okrScreen === 'review' && !okrActiveObjective && (
                            <div className="okr-empty">Select an objective to start a review.</div>
                        )}

                        {okrScreen === 'library' && (
                            <div className="okr-pulse">
                                <div className="okr-pulse-header">
                                    <div>
                                        <div className="okr-pulse-title">Objectives</div>
                                        <div className="okr-pulse-subtitle">Create objectives and track key results.</div>
                                    </div>
                                </div>
                                <div className="okr-pulse-toolbar">
                                    <div
                                        className="view-switch okr-view-switch"
                                        role="tablist"
                                        aria-label="Objectives view switcher"
                                        style={{ ['--active-index' as any]: okrObjectiveViewMode === 'list' ? 0 : 1 }}
                                    >
                                        <button
                                            className={`view-pill ${okrObjectiveViewMode === 'list' ? 'active' : ''}`}
                                            onClick={() => setOkrObjectiveViewMode('list')}
                                            role="tab"
                                            aria-selected={okrObjectiveViewMode === 'list'}
                                        >
                                            Liste
                                        </button>
                                        <button
                                            className={`view-pill ${okrObjectiveViewMode === 'cards' ? 'active' : ''}`}
                                            onClick={() => setOkrObjectiveViewMode('cards')}
                                            role="tab"
                                            aria-selected={okrObjectiveViewMode === 'cards'}
                                        >
                                            Cards
                                        </button>
                                    </div>
                                    <div className="okr-pulse-actions">
                                        <button className="btn btn-primary btn-compact" onClick={() => setObjectiveComposerOpen(true)}>
                                            + Objective
                                        </button>
                                    </div>
                                </div>
                                <div className="okr-pulse-section okr-pulse-objectives">
                                    {objectiveViews.length === 0 ? (
                                        <div className="okr-empty">No objectives yet.</div>
                                    ) : (
                                        <div className={okrObjectiveViewMode === 'cards' ? 'okr-objective-grid' : 'task-list'}>
                                            {objectiveViews.map((objective) => {
                                                const isExpanded =
                                                    okrObjectiveViewMode === 'list' && expandedObjectives.includes(objective.id);
                                                const ownerLabel = objective.ownerId
                                                    ? getMemberLabel(activeTenantId, objective.ownerId)
                                                    : 'Unassigned';
                                                return (
                                                    <div key={objective.id} className={`okr-objective-item ${isExpanded ? 'expanded' : ''}`}>
                                                        <div
                                                            className="task-row okr-objective-row"
                                                            onClick={() => openObjectiveFocus(objective.id)}
                                                        >
                                                            <div className="task-row-main">
                                                            <div className="task-row-title">
                                                                <span className="okr-objective-title-text">{objective.title}</span>
                                                            </div>
                                                            {objective.description && (
                                                                <div className="okr-objective-description">{objective.description}</div>
                                                            )}
                                                            <div className="okr-kr-progress okr-progress-inline">
                                                                <div className="okr-progress-bar">
                                                                    <div className="okr-progress-fill" style={{ width: `${Math.round(objective.progress)}%` }} />
                                                                </div>
                                                                <div className="okr-progress-foot">{Math.round(objective.progress)}%</div>
                                                            </div>
                                                            <div className="task-row-meta">
                                                                <span className="badge task-kind-badge">{objective.status}</span>
                                                                <span className="badge task-kind-badge">{objective.keyResults.length} KRs</span>
                                                                {objective.ownerId ? (
                                                                    <div className="okr-owner-stack">
                                                                        {renderAvatarStack(activeTenantId || '', [objective.ownerId])}
                                                                    </div>
                                                                ) : (
                                                                    <span className="badge task-kind-badge">Owner: {ownerLabel}</span>
                                                                )}
                                                            </div>
                                                            </div>
                                                            {okrObjectiveViewMode === 'list' && (
                                                                <div className="task-row-side">
                                                                    <button
                                                                        className={`okr-chevron ${isExpanded ? 'expanded' : ''}`}
                                                                        type="button"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            setExpandedObjectives((prev) =>
                                                                                prev.includes(objective.id)
                                                                                    ? prev.filter((id) => id !== objective.id)
                                                                                    : [...prev, objective.id]
                                                                            );
                                                                        }}
                                                                        aria-expanded={isExpanded}
                                                                        aria-label={isExpanded ? 'Hide key results' : 'Show key results'}
                                                                    >
                                                                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <polyline points="4 8 10 14 16 8" />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="okr-kr-inline">
                                                                {objective.keyResults.length === 0 ? (
                                                                    <div className="okr-empty">No key results yet.</div>
                                                                ) : (
                                                                    objective.keyResults.map((kr) => (
                                                                        <div key={kr.id} className="okr-kr-inline-row">
                                                                            <div className="okr-kr-expanded-header okr-kr-detail-header">
                                                                                <div className="okr-kr-toprow">
                                                                                    <div className="okr-kr-toprow-left">
                                                                                        {krStatusEditingId === kr.id ? (
                                                                                            <div className="filter-dropdown okr-status-dropdown">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="filter-select okr-status-select"
                                                                                                    onClick={() => setKrStatusEditingId(null)}
                                                                                                    aria-haspopup="listbox"
                                                                                                    aria-expanded="true"
                                                                                                >
                                                                                                    {krStatusLabel(kr.status)}
                                                                                                </button>
                                                                                                <div className="filter-options" role="listbox">
                                                                                                    {['ON_TRACK', 'AT_RISK', 'OFF_TRACK'].map((value) => (
                                                                                                        <button
                                                                                                            key={value}
                                                                                                            type="button"
                                                                                                            className={`filter-option ${kr.status === value ? 'active' : ''} filter-option-${value.toLowerCase()}`}
                                                                                                            onClick={() => {
                                                                                                                handleUpdateKeyResult(kr.id, objective.id, { status: value });
                                                                                                                setKrStatusEditingId(null);
                                                                                                            }}
                                                                                                            role="option"
                                                                                                            aria-selected={kr.status === value}
                                                                                                        >
                                                                                                            {krStatusLabel(value)}
                                                                                                        </button>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <button
                                                                                                type="button"
                                                                                                className={`okr-status-badge status-${kr.status.toLowerCase()} tooltip-target`}
                                                                                                onClick={() => setKrStatusEditingId(kr.id)}
                                                                                                data-tooltip={`Klicken zum Ändern des Status (derzeit: ${krStatusLabel(kr.status)})`}
                                                                                                aria-label={`Klicken zum Ändern des Status (derzeit: ${krStatusLabel(kr.status)})`}
                                                                                            >
                                                                                                {krStatusLabel(kr.status)}
                                                                                            </button>
                                                                                        )}
                                                                                        {kr.assignees && kr.assignees.length > 0 && (
                                                                                            <div className="okr-kr-assignees">
                                                                                                {renderAvatarStack(activeTenantId || '', kr.assignees)}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="okr-kr-toprow-right">
                                                                                        <div className="okr-kr-date">
                                                                                            Updated {new Date(kr.lastUpdatedAt).toLocaleDateString()}
                                                                                        </div>
                                                                                        <button
                                                                                            className="icon-action settings"
                                                                                            onClick={() => openKrEditor(kr, objective.id)}
                                                                                            data-tooltip="KR bearbeiten"
                                                                                            aria-label="KR bearbeiten"
                                                                                        >
                                                                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                                                <path d="M12 20h9" />
                                                                                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                                                                            </svg>
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="okr-kr-expanded-main">
                                                                                    <div className="okr-kr-title">{kr.title}</div>
                                                                                    {kr.description && (
                                                                                        <div className="okr-kr-description">{kr.description}</div>
                                                                                    )}
                                                                                    <div className="okr-kr-progress okr-progress-inline">
                                                                                        <div className="okr-progress-bar">
                                                                                            <div className="okr-progress-fill" style={{ width: `${kr.progress}%` }} />
                                                                                        </div>
                                                                                        <div className="okr-progress-foot">{Math.round(kr.progress)}%</div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

            {objectiveComposerOpen && (
                <div className="modal-overlay">
                    <div className="modal-content settings-modal">
                        <div className="panel-header">
                            <div>
                                <div className="panel-title">{objectiveEditId ? 'Objective bearbeiten' : 'Objective erstellen'}</div>
                                <div className="panel-subtitle">Create the objective details.</div>
                            </div>
                            <button className="panel-close" onClick={() => setObjectiveComposerOpen(false)} aria-label="Close">
                                ×
                            </button>
                        </div>
                        <div className="panel-body">
                            <div className="panel-section">
                                <div className="section-title">Details</div>
                                <label>
                                    Objective title
                                    <input
                                        type="text"
                                        value={objectiveDraft.title}
                                        onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, title: e.target.value }))}
                                        placeholder="Deliver a calmer onboarding experience"
                                    />
                                </label>
                                <label>
                                    Description
                                    <textarea
                                        value={objectiveDraft.description}
                                        onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, description: e.target.value }))}
                                        placeholder="Short context for this objective"
                                        rows={3}
                                    />
                                </label>
                                <label>
                                    Owner
                                    <select
                                        value={objectiveDraft.ownerId}
                                        onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, ownerId: e.target.value }))}
                                    >
                                        <option value="">Unassigned</option>
                                        {getMembersForTenant(activeTenantId).map((member) => (
                                            <option key={member.userId} value={member.userId}>
                                                {member.user?.name || member.user?.email || member.userId}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div className="panel-section">
                                <div className="section-title">Timeline</div>
                                <div className="objective-row">
                                    <label>
                                        Start date
                                        <input
                                            type="date"
                                            value={objectiveDraft.startDate}
                                            onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                                        />
                                    </label>
                                    <label>
                                        End date
                                        <input
                                            type="date"
                                            value={objectiveDraft.endDate}
                                            onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                                        />
                                    </label>
                                </div>
                                <label>
                                    Status
                                    <select
                                        value={objectiveDraft.status}
                                        onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, status: e.target.value }))}
                                    >
                                        <option value="ACTIVE">Active</option>
                                        <option value="AT_RISK">At risk</option>
                                        <option value="PAUSED">Paused</option>
                                        <option value="DONE">Done</option>
                                    </select>
                                </label>
                            </div>
                            <div className="panel-actions">
                                <div className="panel-actions-left">
                                    <button className="btn btn-ghost btn-compact" onClick={() => setObjectiveComposerOpen(false)}>
                                        Cancel
                                    </button>
                                </div>
                                <div className="panel-actions-right">
                                    <button className="btn btn-secondary btn-compact" onClick={handleObjectiveComposerSubmit}>
                                        {objectiveEditId ? 'Save changes' : 'Create objective'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
                    </div>
                    )
                ) : view === 'scope' ? (
                    <div className="scope-view">
                        {!activeTenantId ? (
                            <div className="empty-state">Select a huddle to build a scope window.</div>
                        ) : scopeScreen === 'list' ? (
                            <>
                                <div className="scope-create-card">
                                    <div className="scope-card-header">
                                        <div>
                                            <div className="scope-card-title">Create scope window</div>
                                            <div className="scope-card-subtitle">
                                                Bundle tasks from {activeHuddleName || 'this huddle'} into a focused sprint scope.
                                            </div>
                                        </div>
                                        {activeHuddleName && (
                                            <span className="scope-board-badge">{activeHuddleName}</span>
                                        )}
                                    </div>
                                    <div className="scope-create-grid">
                                        <label>
                                            Title
                                            <input
                                                type="text"
                                                placeholder="e.g. Sprint 12"
                                                value={scopeDraft.name}
                                                onChange={(event) => setScopeDraft((prev) => ({ ...prev, name: event.target.value }))}
                                            />
                                        </label>
                                        <label>
                                            Start date
                                            <input
                                                type="date"
                                                value={scopeDraft.startDate}
                                                onChange={(event) => setScopeDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                                            />
                                        </label>
                                        <label>
                                            End date
                                            <input
                                                type="date"
                                                value={scopeDraft.endDate}
                                                onChange={(event) => setScopeDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                                            />
                                        </label>
                                        <label className="scope-create-span">
                                            Notes
                                            <textarea
                                                rows={2}
                                                placeholder="Optional note for this scope window."
                                                value={scopeDraft.description}
                                                onChange={(event) => setScopeDraft((prev) => ({ ...prev, description: event.target.value }))}
                                            />
                                        </label>
                                    </div>
                                    <div className="scope-create-actions">
                                        <button
                                            className="btn btn-primary btn-compact"
                                            onClick={handleScopeCreate}
                                            disabled={!scopeDraft.name.trim() || !scopeKey}
                                        >
                                            Create scope window
                                        </button>
                                    </div>
                                </div>
                                {scopeWindows.length === 0 ? (
                                    <div className="scope-empty">No scope windows yet. Create one to start grouping tasks.</div>
                                ) : (
                                    <div className="scope-window-grid">
                                        {scopeWindows.map((scopeWindow) => (
                                            <div
                                                key={scopeWindow.id}
                                                className={`scope-window-card${activeScopeId === scopeWindow.id ? ' active' : ''}`}
                                                onClick={() => openScopeDetail(scopeWindow.id)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        openScopeDetail(scopeWindow.id);
                                                    }
                                                }}
                                            >
                                                <div className="scope-window-header">
                                                    <div>
                                                        <div className="scope-window-title">{scopeWindow.name}</div>
                                                        <div className="scope-window-meta">
                                                            {getScopeDateLabel(scopeWindow)} · {scopeWindow.taskIds.length} tasks
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="icon-action delete"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleScopeDelete(scopeWindow.id);
                                                        }}
                                                        data-tooltip="Scope Window löschen"
                                                        aria-label="Scope Window löschen"
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                                            <path d="M6 6l12 12" />
                                                            <path d="M18 6L6 18" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                {scopeWindow.description && (
                                                    <div className="scope-window-description">{scopeWindow.description}</div>
                                                )}
                                                <div className="scope-window-actions">
                                                    <button
                                                        className="btn btn-ghost btn-compact"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openScopeDetail(scopeWindow.id);
                                                        }}
                                                    >
                                                        Open board
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : activeScopeWindow ? (
                            <div className="scope-detail-panel">
                                <div className="scope-board-panel">
                                    <div className="scope-board-header">
                                        <div className="scope-board-header-main">
                                            <div className="scope-board-meta">
                                                {getScopeDateLabel(activeScopeWindow)} · {activeScopeWindow.taskIds.length} tasks
                                            </div>
                                            {activeScopeWindow.description && (
                                                <div className="scope-board-description">{activeScopeWindow.description}</div>
                                            )}
                                        </div>
                                        <div className="scope-board-actions">
                                            <button
                                                className="btn btn-primary btn-compact"
                                                onClick={() => {
                                                    setScopePickerQuery('');
                                                    setScopePickerOpenId((prev) => (prev === activeScopeWindow.id ? null : activeScopeWindow.id));
                                                }}
                                            >
                                                + task
                                            </button>
                                            <button
                                                className="icon-action settings"
                                                onClick={() => setIsScopeSettingsOpen(true)}
                                                data-tooltip="Scope Window settings"
                                                aria-label="Scope Window settings"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                    <circle cx="12" cy="12" r="3.5" />
                                                    <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3.7a7 7 0 0 0-1.6-1l-.3-2.4H9.3l-.3 2.4a7 7 0 0 0-1.6 1l-2.3-.7-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-.7a7 7 0 0 0 1.6 1l.3 2.4h5.4l.3-2.4a7 7 0 0 0 1.6-1l2.3.7 2-3.5-2-1.5a7 7 0 0 0 .1-1z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="scope-board-toolbar">
                                        <div className="scope-board-toolbar-left">
                                            <div
                                                className="view-switch scope-view-switch"
                                                role="tablist"
                                                aria-label="Scope view switcher"
                                                style={{ ['--active-index' as any]: scopeDetailView === 'board' ? 0 : 1 }}
                                            >
                                                <button
                                                    className={`view-pill ${scopeDetailView === 'board' ? 'active' : ''}`}
                                                    onClick={() => setScopeDetailView('board')}
                                                    role="tab"
                                                    aria-selected={scopeDetailView === 'board'}
                                                >
                                                    Board
                                                </button>
                                                <button
                                                    className={`view-pill ${scopeDetailView === 'list' ? 'active' : ''}`}
                                                    onClick={() => setScopeDetailView('list')}
                                                    role="tab"
                                                    aria-selected={scopeDetailView === 'list'}
                                                >
                                                    Table
                                                </button>
                                            </div>
                                        </div>
                                        <div className="scope-board-toolbar-right">
                                            <div className="scope-filter-row">
                                                <div className="filter-dropdown">
                                                    <button
                                                        type="button"
                                                        className="filter-select"
                                                        onClick={() => setScopePriorityFilterOpen((prev) => !prev)}
                                                        aria-haspopup="listbox"
                                                        aria-expanded={scopePriorityFilterOpen}
                                                    >
                                                        {scopeFilterPriority === 'ALL' ? 'All priorities' : scopeFilterPriority}
                                                    </button>
                                                    {scopePriorityFilterOpen && (
                                                        <div className="filter-options" role="listbox">
                                                            {['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => (
                                                                <button
                                                                    key={value}
                                                                    type="button"
                                                                    className={`filter-option ${scopeFilterPriority === value ? 'active' : ''} filter-option-${value.toLowerCase()}`}
                                                                    onClick={() => {
                                                                        setScopeFilterPriority(value);
                                                                        setScopePriorityFilterOpen(false);
                                                                    }}
                                                                    role="option"
                                                                    aria-selected={scopeFilterPriority === value}
                                                                >
                                                                    {value === 'ALL' ? 'All priorities' : value}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="filter-dropdown">
                                                    <button
                                                        type="button"
                                                        className="filter-select"
                                                        onClick={() => setScopeStatusFilterOpen((prev) => !prev)}
                                                        aria-haspopup="listbox"
                                                        aria-expanded={scopeStatusFilterOpen}
                                                    >
                                                        {scopeFilterStatus === 'ALL' ? 'All statuses' : scopeFilterStatus}
                                                    </button>
                                                    {scopeStatusFilterOpen && (
                                                        <div className="filter-options" role="listbox">
                                                            {['ALL', ...scopeStatuses].map((value) => (
                                                                <button
                                                                    key={value}
                                                                    type="button"
                                                                    className={`filter-option ${scopeFilterStatus === value ? 'active' : ''}`}
                                                                    onClick={() => {
                                                                        setScopeFilterStatus(value as TaskStatus | 'ALL');
                                                                        setScopeStatusFilterOpen(false);
                                                                    }}
                                                                    role="option"
                                                                    aria-selected={scopeFilterStatus === value}
                                                                >
                                                                    {value === 'ALL' ? 'All statuses' : value}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {(scopeFilterPriority !== 'ALL' || scopeFilterStatus !== 'ALL') && (
                                                    <button
                                                        className="btn btn-ghost btn-compact scope-filter-reset"
                                                        onClick={() => {
                                                            setScopeFilterPriority('ALL');
                                                            setScopeFilterStatus('ALL');
                                                        }}
                                                    >
                                                        Reset filters
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {scopePickerOpenId === activeScopeWindow.id && (
                                        <div className="scope-task-picker">
                                            <div className="scope-task-picker-header">
                                                <input
                                                    type="text"
                                                    placeholder="Search tasks"
                                                    value={scopePickerQuery}
                                                    onChange={(event) => setScopePickerQuery(event.target.value)}
                                                />
                                                <button
                                                    className="btn btn-ghost btn-compact"
                                                    onClick={() => {
                                                        setScopePickerOpenId(null);
                                                        setScopePickerQuery('');
                                                    }}
                                                >
                                                    Done
                                                </button>
                                            </div>
                                            <div className="scope-task-picker-list">
                                                {filteredScopeAvailableTasks.length === 0 ? (
                                                    <div className="scope-task-empty">No tasks left to add.</div>
                                                ) : (
                                                    filteredScopeAvailableTasks.map((task) => (
                                                        <button
                                                            key={task.id}
                                                            type="button"
                                                            className="scope-task-option"
                                                            onClick={() => handleScopeAddTask(activeScopeWindow.id, task.id)}
                                                        >
                                                            <div className="scope-task-option-main">
                                                                <div className="scope-task-option-title">{task.title}</div>
                                                                <div className="scope-task-option-meta">
                                                                    {task.status} · {getBoardLabel(task.boardId)} · {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                                                                </div>
                                                            </div>
                                                            <span className="scope-task-option-add">Add</span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {scopeDetailView === 'list' ? (
                                        scopeListTasks.length === 0 ? (
                                            <div className="scope-task-empty">No tasks in this scope window.</div>
                                        ) : (
                                            <div className="task-table-wrap">
                                                <table className="task-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Title</th>
                                                            <th>Status</th>
                                                            <th>Due</th>
                                                            <th>Board</th>
                                                            <th>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {scopeListTasks.map((task) => {
                                                            const dueStatus = getDueStatus(task);
                                                            const dueLabel = dueStatus === 'overdue' ? 'Overdue' : dueStatus === 'due-soon' ? 'Due soon' : null;
                                                            const dueDateLabel = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—';
                                                            const dueStatusClass = dueStatus === 'overdue' ? ' overdue' : dueStatus === 'due-soon' ? ' due-soon' : '';
                                                            const boardLabel = task.boardId ? getBoardLabel(task.boardId) : '—';
                                                            return (
                                                                <tr
                                                                    key={task.id}
                                                                    className={`task-table-row${dueStatusClass}`}
                                                                    onClick={() => handleCardClick(task)}
                                                                >
                                                                    <td>{task.title}</td>
                                                                    <td>{task.status}</td>
                                                                    <td>
                                                                        <div className={`task-table-due${dueStatusClass}`}>
                                                                            <span className="task-table-due-date">{dueDateLabel}</span>
                                                                            {dueLabel && <span className="task-table-due-badge">{dueLabel}</span>}
                                                                        </div>
                                                                    </td>
                                                                    <td>{boardLabel}</td>
                                                                    <td>
                                                                        <div className="table-actions">
                                                                            <button
                                                                                type="button"
                                                                                className="scope-task-remove"
                                                                                onClick={(event) => {
                                                                                    event.stopPropagation();
                                                                                    handleScopeRemoveTask(activeScopeWindow.id, task.id);
                                                                                }}
                                                                            >
                                                                                Remove
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )
                                    ) : (
                                        <div className="kanban-board scope-kanban-board">
                                            {scopeColumns.map((column) => (
                                                <div
                                                    key={column.status}
                                                    className="kanban-column"
                                                    onDragOver={handleScopeColumnDragOver}
                                                    onDragLeave={handleScopeColumnDragLeave}
                                                    onDrop={(event) => handleScopeColumnDrop(event, column.status)}
                                                >
                                                    <div className="column-header">
                                                        <span>{column.status}</span>
                                                        <span>{column.tasks.length}</span>
                                                    </div>
                                                    <div className="column-content">
                                                        {column.tasks.length === 0 ? (
                                                            <div className="scope-column-empty">No tasks</div>
                                                        ) : (
                                                            column.tasks.map((task) => {
                                                                const dueStatus = getDueStatus(task);
                                                                const dueLabel = dueStatus === 'overdue' ? 'Overdue' : dueStatus === 'due-soon' ? 'Due soon' : null;
                                                                const dueDateLabel = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—';
                                                                const dueStatusClass = dueStatus === 'overdue' ? ' overdue' : dueStatus === 'due-soon' ? ' due-soon' : '';
                                                                const isScopeDraggable = task.sourceType ? task.sourceType === 'MANUAL' : true;
                                                                const boardLabel = getBoardLabel(task.boardId);
                                                                return (
                                                                    <div
                                                                        key={task.id}
                                                                        className={`task-card scope-task-card${isScopeDraggable ? ' task-card-draggable' : ''}`}
                                                                        onClick={() => handleCardClick(task)}
                                                                        draggable={isScopeDraggable}
                                                                        onDragStart={(event) => (isScopeDraggable ? onDragStart(event, task.id) : event.preventDefault())}
                                                                        onDragEnd={onDragEnd}
                                                                    >
                                                                        <div className="task-card-content">
                                                                            <div className="task-card-topbar">
                                                                                <div className={`task-card-due${dueStatusClass}`}>
                                                                                    <span className="task-card-due-icon" aria-hidden="true">
                                                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                                            <path d="M5 4v16" />
                                                                                            <path d="M5 4h11l-2 4 2 4H5" />
                                                                                        </svg>
                                                                                    </span>
                                                                                    <span className="task-card-due-date">{dueDateLabel}</span>
                                                                                    {dueLabel && <span className="task-card-due-badge">{dueLabel}</span>}
                                                                                </div>
                                                                                <div className={`priority-bubble priority-${task.priority.toLowerCase()}`}>
                                                                                    <span
                                                                                        className={`priority-line tooltip-target ${task.priority === 'CRITICAL' ? 'priority-line-critical' : ''}`}
                                                                                        aria-hidden="true"
                                                                                        data-tooltip={`Priority: ${task.priority}`}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div className="task-card-header">
                                                                                <div className="task-title-row">{task.title}</div>
                                                                                {task.isFavorite && (
                                                                                    <span className="favorite-badge" title="Favorite">
                                                                                        ★
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {task.description && (
                                                                                <div className="task-card-description">{stripHtml(task.description)}</div>
                                                                            )}
                                                                            <div className="scope-card-footer">
                                                                                <div className="task-card-kinds">
                                                                                    {task.kinds.map((kind) => (
                                                                                        <span key={kind} className="badge task-kind-badge">
                                                                                            {kind}
                                                                                        </span>
                                                                                    ))}
                                                                                    {boardLabel && (
                                                                                        <span className="scope-task-origin">Board: {boardLabel}</span>
                                                                                    )}
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    className="scope-task-remove"
                                                                                    onClick={(event) => {
                                                                                        event.stopPropagation();
                                                                                        handleScopeRemoveTask(activeScopeWindow.id, task.id);
                                                                                    }}
                                                                                >
                                                                                    Remove
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="scope-empty">Select a scope window.</div>
                        )}
                    </div>
                ) : view === 'dashboard' ? (
                    <div className="dashboard-panel">
                        {!activeTenantId ? (
                            <div className="empty-state">Select a huddle to see the dashboard.</div>
                        ) : (
                            <>
                                <div className="dashboard-stats">
                                    <div className="dashboard-card dashboard-stat">
                                        <div className="dashboard-stat-top">
                                            <span className="dashboard-stat-label">Tasks completed</span>
                                            <span className="dashboard-stat-icon">✓</span>
                                        </div>
                                        <div className="dashboard-stat-body">
                                            <div className="dashboard-stat-value-row">
                                                <div className="dashboard-stat-value">{dashboardSummary.doneCount}</div>
                                                {renderChangeBadge(dashboardSummary.completionChange)}
                                            </div>
                                            <div className="dashboard-stat-meta">
                                                {dashboardSummary.completionRate}% completion
                                            </div>
                                        </div>
                                    </div>
                                    <div className="dashboard-card dashboard-stat">
                                        <div className="dashboard-stat-top">
                                            <span className="dashboard-stat-label">Tasks in progress</span>
                                            <span className="dashboard-stat-icon">⏳</span>
                                        </div>
                                        <div className="dashboard-stat-body">
                                            <div className="dashboard-stat-value-row">
                                                <div className="dashboard-stat-value">{dashboardSummary.openTasks}</div>
                                                {renderChangeBadge(dashboardSummary.openChange)}
                                            </div>
                                            <div className="dashboard-stat-meta">
                                                {dashboardSummary.dueSoonCount} due soon · {dashboardSummary.totalTasks} total
                                            </div>
                                        </div>
                                    </div>
                                    <div className="dashboard-card dashboard-stat">
                                        <div className="dashboard-stat-top">
                                            <span className="dashboard-stat-label">Overdue tasks</span>
                                            <span className="dashboard-stat-icon">⚠️</span>
                                        </div>
                                        <div className="dashboard-stat-body">
                                            <div className="dashboard-stat-value-row">
                                                <div className="dashboard-stat-value">{dashboardSummary.overdueCount}</div>
                                                {renderChangeBadge(dashboardSummary.openChange)}
                                            </div>
                                            <div className="dashboard-stat-meta">
                                                {dashboardSummary.dueSoonCount} due soon
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="dashboard-visuals">
                                    <div className="dashboard-card dashboard-line-card">
                                        <div className="dashboard-line-header">
                                            <div>
                                                <div className="dashboard-line-title">Signal lines</div>
                                                <div className="dashboard-line-value">
                                                    {lineChartTotals.activity}
                                                    <span>events / {lineRangeDays}d</span>
                                                </div>
                                            </div>
                                            <div className="dashboard-line-actions">
                                                <div className="dashboard-line-chip">Trends</div>
                                                <div className="dashboard-line-controls" role="tablist" aria-label="Time range">
                                                    {[30, 60, 90].map((range) => (
                                                        <button
                                                            key={`range-${range}`}
                                                            className={`dashboard-line-range${lineRangeDays === range ? ' active' : ''}`}
                                                            onClick={() => setLineRangeDays(range)}
                                                            type="button"
                                                            role="tab"
                                                            aria-selected={lineRangeDays === range}
                                                        >
                                                            {range}d
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        {renderLineChart([
                                            {
                                                key: 'activity',
                                                label: 'Activity',
                                                series: lineChartSeries.activity,
                                                className: 'line-activity',
                                            },
                                            {
                                                key: 'done',
                                                label: 'Done',
                                                series: lineChartSeries.done,
                                                className: 'line-done',
                                            },
                                            {
                                                key: 'open',
                                                label: 'Open',
                                                series: lineChartSeries.open,
                                                className: 'line-open',
                                            },
                                            {
                                                key: 'kr',
                                                label: 'KRs',
                                                series: lineChartSeries.kr,
                                                className: 'line-kr',
                                            },
                                        ], {
                                            labels: lineChartLabels,
                                            hoverIndex: lineHoverIndex,
                                            onHover: setLineHoverIndex,
                                        })}
                                        {lineChartLabels.length > 0 && (
                                            <div className="dashboard-line-axis">
                                                <span>{lineChartLabels[0]}</span>
                                                <span>{lineChartLabels[Math.floor((lineChartLabels.length - 1) / 2)]}</span>
                                                <span>{lineChartLabels[lineChartLabels.length - 1]}</span>
                                            </div>
                                        )}
                                        <div className="dashboard-line-legend">
                                            <span className="line-key line-activity">Activity</span>
                                            <span className="line-key line-done">Done</span>
                                            <span className="line-key line-open">Open</span>
                                            <span className="line-key line-kr">KRs</span>
                                        </div>
                                    </div>
                                    <div className="dashboard-card dashboard-list dashboard-attention-card">
                                        <div className="dashboard-card-title">Needs attention</div>
                                        {attentionTasks.length === 0 && (
                                            <div className="dashboard-empty">No urgent todos.</div>
                                        )}
                                        <div className="dashboard-card-content">
                                            {attentionTasks.map((task) => {
                                                const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                                                const now = new Date();
                                                const soon = new Date();
                                                soon.setDate(now.getDate() + 7);
                                                const isOverdue = dueDate ? dueDate < now : false;
                                                const isDueSoon = dueDate ? dueDate >= now && dueDate <= soon : false;
                                                const badgeLabel = isOverdue ? 'Overdue' : isDueSoon ? 'Due soon' : task.status;
                                                const badgeClass = isOverdue ? 'danger' : isDueSoon ? 'warning' : '';
                                                return (
                                                    <button key={task.id} className="dashboard-item" onClick={() => handleCardClick(task)}>
                                                        <div className="dashboard-item-title">{task.title}</div>
                                                        <div className="dashboard-item-meta">
                                                            {dueDate ? dueDate.toLocaleDateString() : 'No due date'}
                                                            <span className={`dashboard-badge ${badgeClass}`}>{badgeLabel}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="filter-bar">
                            <div
                                className="view-switch"
                                role="tablist"
                                aria-label="View switcher"
                                style={{ ['--active-index' as any]: view === 'kanban' ? 0 : 1 }}
                            >
                                <button
                                    className={`view-pill ${view === 'kanban' ? 'active' : ''}`}
                                    onClick={() => setView('kanban')}
                                    role="tab"
                                    aria-selected={view === 'kanban'}
                                >
                                    Board
                                </button>
                                <button
                                    className={`view-pill ${view === 'table' ? 'active' : ''}`}
                                    onClick={() => setView('table')}
                                    role="tab"
                                    aria-selected={view === 'table'}
                                >
                                    Table
                                </button>
                            </div>
                            <div className="filter-actions">
                                {isActiveHuddleOwner && (
                                    <>
                                        <button
                                            className="icon-action settings"
                                            onClick={() => setIsBoardSettingsOpen(true)}
                                            data-tooltip="Einstellungen zum Board"
                                            aria-label="Einstellungen zum Board"
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                <circle cx="12" cy="12" r="3.5" />
                                                <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3.7a7 7 0 0 0-1.6-1l-.3-2.4H9.3l-.3 2.4a7 7 0 0 0-1.6 1l-2.3-.7-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-.7a7 7 0 0 0 1.6 1l.3 2.4h5.4l.3-2.4a7 7 0 0 0 1.6-1l2.3.7 2-3.5-2-1.5a7 7 0 0 0 .1-1z" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                                <div className="filter-dropdown">
                                    <button
                                        type="button"
                                        className="filter-select"
                                        onClick={() => setPriorityFilterOpen((prev) => !prev)}
                                        aria-haspopup="listbox"
                                        aria-expanded={priorityFilterOpen}
                                    >
                                        {filterPriority === 'ALL' ? 'All priorities' : filterPriority}
                                    </button>
                                    {priorityFilterOpen && (
                                        <div className="filter-options" role="listbox">
                                            {['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    className={`filter-option ${filterPriority === value ? 'active' : ''} filter-option-${value.toLowerCase()}`}
                                                    onClick={() => {
                                                        setFilterPriority(value);
                                                        setPriorityFilterOpen(false);
                                                    }}
                                                    role="option"
                                                    aria-selected={filterPriority === value}
                                                >
                                                    {value === 'ALL' ? 'All priorities' : value}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {view === 'table' && (
                                    <div className="filter-dropdown">
                                        <button
                                            type="button"
                                            className="filter-select"
                                            onClick={() => setStatusFilterOpen((prev) => !prev)}
                                            aria-haspopup="listbox"
                                            aria-expanded={statusFilterOpen}
                                        >
                                            {filterStatus === 'ALL' ? 'All statuses' : filterStatus}
                                        </button>
                                        {statusFilterOpen && (
                                            <div className="filter-options" role="listbox">
                                                {statusFilterOptions.map((value) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        className={`filter-option ${filterStatus === value ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setFilterStatus(value);
                                                            setStatusFilterOpen(false);
                                                        }}
                                                        role="option"
                                                        aria-selected={filterStatus === value}
                                                    >
                                                        {value === 'ALL' ? 'All statuses' : value}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <label className={`filter-checkbox filter-favorites ${filterFavorites ? 'active' : ''}`} data-tooltip="Nur Favoriten"
                                            aria-label="Nur Favoriten">
                                    <input
                                        type="checkbox"
                                        checked={filterFavorites}
                                        onChange={(e) => setFilterFavorites(e.target.checked)}

                                    />
                                    <span className="filter-favorites-icon" aria-hidden="true">★</span>
                                </label>
                            </div>
                        </div>

                        {error && <div style={{ color: '#f87171', marginBottom: '1rem' }}>Error: {error}</div>}

                        {view === 'kanban' ? (
                            <div className="kanban-board-wrap">
                                {activeTenantId && (
                                    <div className={`scope-drop-row${isDragging ? ' dragging' : ''}`}>
                                        <div className="scope-drop-header">
                                            <div>
                                                <div className="scope-drop-title">Scope Window</div>
                                                <div className="scope-drop-subtitle">Drag tasks here to add them to a scope window.</div>
                                            </div>
                                            <button
                                                className="btn btn-ghost btn-compact"
                                                onClick={() => {
                                                    setView('scope');
                                                    setScopeScreen('list');
                                                    setScopeRouteId(null);
                                                    updateScopeUrl(null, 'replace');
                                                }}
                                            >
                                                Open
                                            </button>
                                        </div>
                                        {scopeWindows.length === 0 ? (
                                            <div className="scope-drop-empty">No scope windows yet.</div>
                                        ) : (
                                            <div className="scope-drop-list">
                                                {scopeWindows.map((scopeWindow) => (
                                                    <div
                                                        key={scopeWindow.id}
                                                        className={`scope-drop-item${scopeDropTargetId === scopeWindow.id ? ' over' : ''}`}
                                                        onDragOver={(event) => handleScopeDragOver(event, scopeWindow.id)}
                                                        onDragLeave={(event) => handleScopeDragLeave(event, scopeWindow.id)}
                                                        onDrop={(event) => handleScopeDrop(event, scopeWindow.id)}
                                                    >
                                                        <div className="scope-drop-name">{scopeWindow.name}</div>
                                                        <div className="scope-drop-meta">{scopeWindow.taskIds.length} tasks</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="kanban-board">
                                {kanbanColumns.map((column: any) => {
                                    const visibleTasks = column.tasks.filter(matchesFilter);
                                    const orderKey = getOrderKey(activeTenantId, activeBoardId, column.status);
                                    const orderedIds = taskOrderByColumn[orderKey] || [];
                                    const tasksById = new Map(visibleTasks.map((task: TaskView) => [task.id, task]));
                                    const orderedTasks = orderedIds.map((id) => tasksById.get(id)).filter(Boolean) as TaskView[];
                                    const remainingTasks = visibleTasks.filter((task: TaskView) => !orderedIds.includes(task.id));
                                    const displayTasks = orderedTasks.concat(remainingTasks);
                                    return (
                                    <div
                                        key={column.status}
                                        className="kanban-column"
                                        onDragOver={onDragOver}
                                        onDragLeave={onDragLeave}
                                        onDrop={(e) => onDrop(e, column.status)}
                                    >
                                        <div className="column-header">
                                            <span>{column.status}</span>
                                            <span>{displayTasks.length}</span>
                                        </div>
                                        <div className="column-content">
                                        {displayTasks.map((task: TaskView) => {
                                            const checklistDone = task.checklist.filter((item) => item.done).length;
                                            const checklistTotal = task.checklist.length;
                                            const linkedCount = task.linkedTaskIds.length;
                                            const isChecklistComplete = checklistTotal > 0 && checklistDone === checklistTotal;
                                            const isLinkedFromOther = linkedToSet.has(task.id);
                                            const isDraggable = task.sourceType ? task.sourceType === 'MANUAL' : true;
                                            const dueStatus = getDueStatus(task);
                                            const dueLabel = dueStatus === 'overdue' ? 'Overdue' : dueStatus === 'due-soon' ? 'Due soon' : null;
                                            const dueDateLabel = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—';
                                            const dueStatusClass = dueStatus === 'overdue' ? ' overdue' : dueStatus === 'due-soon' ? ' due-soon' : '';
                                            const cardStatusClass = dueStatus === 'overdue' ? ' task-card-overdue' : dueStatus === 'due-soon' ? ' task-card-due-soon' : '';
                                            const taskCardStyle: React.CSSProperties = {
                                                cursor: isDraggable ? 'grab' : 'default',
                                                userSelect: 'none',
                                                ['WebkitUserDrag' as any]: isDraggable ? 'element' : 'auto',
                                                pointerEvents: 'auto',
                                            };
                                            return (
                                                <React.Fragment key={task.id}>
                                                    <div
                                                        className={`task-card${isDraggable ? ' task-card-draggable' : ''}${draggingTaskId === task.id ? ' dragging' : ''}${cardStatusClass}`}
                                                        style={taskCardStyle}
                                                        draggable={isDraggable}
                                                        onDragStart={(e) => (isDraggable ? onDragStart(e, task.id) : e.preventDefault())}
                                                        onDragEnd={onDragEnd}
                                                        onDragOver={(e) => onCardDragOver(e, column.status, task.id)}
                                                        onDragLeave={onCardDragLeave}
                                                        onClick={() => handleCardClick(task)}
                                                    >
                                                        <div className="task-card-content">
                                                            <div className="task-card-topbar">
                                                            <div className={`task-card-due${dueStatusClass}`}>
                                                                <span className="task-card-due-icon" aria-hidden="true">
                                                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                        <path d="M5 4v16" />
                                                                        <path d="M5 4h11l-2 4 2 4H5" />
                                                                    </svg>
                                                                </span>
                                                                <span className="task-card-due-date">{dueDateLabel}</span>
                                                                {dueLabel && <span className="task-card-due-badge">{dueLabel}</span>}
                                                            </div>
                                                                <div className={`priority-bubble priority-${task.priority.toLowerCase()}`}>
                                                            <span
                                                                className={`priority-line tooltip-target ${task.priority === 'CRITICAL' ? 'priority-line-critical' : ''}`}
                                                                aria-hidden="true"
                                                                data-tooltip={`Priority: ${task.priority}`}
                                                            />
                                                                </div>
                                                            </div>
                                                            <div className="task-card-header">
                                                                <div className="task-title-row">
                                                                    {isLinkedFromOther && (
                                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="linked-icon">
                                                                            <path d="M10 14a5 5 0 0 1 0-7l2-2a5 5 0 1 1 7 7l-1 1" />
                                                                            <path d="M14 10a5 5 0 0 1 0 7l-2 2a5 5 0 1 1-7-7l1-1" />
                                                                        </svg>
                                                                    )}
                                                                    {task.title}
                                                                </div>
                                                                {task.isFavorite && (
                                                                    <span className="favorite-badge" title="Favorite">
                                                                        ★
                                                                    </span>
                                                                )}
                                                            </div>
                                                        {task.description && (
                                                            <div className="task-card-description">{stripHtml(task.description)}</div>
                                                        )}
                                                        <hr className="card-divider" />
                                                        <div className="task-card-footer">
                                                            <div className="task-card-kinds">
                                                                {task.kinds.map((kind) => (
                                                                    <span key={kind} className="badge task-kind-badge">
                                                                        {kind}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <div className="task-card-people">
                                                                {task.ownerId && renderAvatarStack(task.tenantId, [task.ownerId])}
                                                                {task.assignees.length > 0 &&
                                                                    renderAvatarStack(
                                                                        task.tenantId,
                                                                        task.assignees.filter((id) => id !== task.ownerId)
                                                                    )}
                                                            </div>
                                                            <div className="task-card-icons">
                                                                {checklistTotal > 0 && (
                                                                    <span className={isChecklistComplete ? 'icon-badge checklist-complete' : 'icon-badge'}>
                                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                            <path d="M4 6h16M4 12h16M4 18h10" />
                                                                            <path d="M18 17l2 2 4-4" />
                                                                        </svg>
                                                                        {checklistDone}/{checklistTotal}
                                                                    </span>
                                                                )}
                                                                {task.comments.length > 0 && (
                                                                    <span className="icon-badge">
                                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                                                                        </svg>
                                                                        {task.comments.length}
                                                                    </span>
                                                                )}
                                                                {linkedCount > 0 && (
                                                                    <span className="icon-badge">
                                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                            <path d="M10 14a5 5 0 0 1 0-7l2-2a5 5 0 1 1 7 7l-1 1" />
                                                                            <path d="M14 10a5 5 0 0 1 0 7l-2 2a5 5 0 1 1-7-7l1-1" />
                                                                        </svg>
                                                                        {linkedCount}
                                                                    </span>
                                                                )}
                                                                {task.attachments.length > 0 && (
                                                                    <span className="icon-badge">
                                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                            <path d="M21.5 12.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.5 3.5 0 1 1 5 5l-8.6 8.6a2 2 0 0 1-2.8-2.8l7.9-7.9" />
                                                                        </svg>
                                                                        {task.attachments.length}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}
                                        </div>
                                    </div>
                                );
                                })}
                                </div>
                            </div>
                        ) : view === 'table' ? (
                            <div className="task-table-wrap">
                                <table className="task-table">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>People</th>
                                            <th>Status</th>
                                            <th>Art</th>
                                            <th>Priority</th>
                                            <th>Due</th>
                                            <th>Source</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleTasksForView.map((task: TaskView) => {
                                            const dueStatus = getDueStatus(task);
                                            const dueLabel = dueStatus === 'overdue' ? 'Overdue' : dueStatus === 'due-soon' ? 'Due soon' : null;
                                            const dueDateLabel = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—';
                                            const dueStatusClass = dueStatus === 'overdue' ? ' overdue' : dueStatus === 'due-soon' ? ' due-soon' : '';
                                            return (
                                            <React.Fragment key={task.id}>
                                                <tr className={`task-table-row${dueStatusClass}`} onClick={() => openDetailsModal(task)}>
                                                    <td>{task.title}</td>
                                                    <td>
                                                        <div className="task-card-people">
                                                            {task.ownerId && renderAvatarStack(task.tenantId, [task.ownerId])}
                                                            {task.assignees.length > 0 &&
                                                                renderAvatarStack(
                                                                    task.tenantId,
                                                                    task.assignees.filter((id) => id !== task.ownerId)
                                                                )}
                                                        </div>
                                                    </td>
                                                    <td>{task.status}</td>
                                                    <td>{task.kinds.length > 0 ? task.kinds.join(', ') : '—'}</td>
                                                    <td>
                                                        <span className={`badge badge-priority-${task.priority.toLowerCase()}`}>
                                                            {task.priority}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className={`task-table-due${dueStatusClass}`}>
                                                            <span className="task-table-due-date">{dueDateLabel}</span>
                                                            {dueLabel && <span className="task-table-due-badge">{dueLabel}</span>}
                                                        </div>
                                                    </td>
                                                    <td>{task.sourceIndicator}</td>
                                                    <td>
                                                        <div className="table-actions">
                                                            {task.sourceType === 'MANUAL' && (
                                                                <button
                                                                    className="icon-action settings"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openEditModal(task);
                                                                    }}
                                                                    data-tooltip="Task bearbeiten"
                                                                    aria-label="Task bearbeiten"
                                                                >
                                                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                        <path d="M12 20h9" />
                                                                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            <button
                                                                className="icon-action"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setExpandedTableTaskId((prev) => (prev === task.id ? null : task.id));
                                                                }}
                                                                data-tooltip="Details ausklappen"
                                                                aria-label="Details ausklappen"
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                                                    <path d="M6 9l6 6 6-6" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedTableTaskId === task.id && (
                                                    <tr className="task-table-details">
                                                        <td colSpan={8}>
                                                        <div className="table-details-grid">
                                                            <div className="table-details-span">
                                                                <div className="table-details-label">Description</div>
                                                                <div className="table-details-text">
                                                                    {task.description ? stripHtml(task.description) : '—'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="table-details-label">Members</div>
                                                                <div className="table-details-text">
                                                                    {task.assignees.length > 0
                                                                        ? task.assignees.map((id) => getMemberLabel(task.tenantId, id)).join(', ')
                                                                        : '—'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="table-details-label">Checklist</div>
                                                                <div className="table-details-text">
                                                                    {task.checklist.length > 0
                                                                        ? `${task.checklist.filter((item) => item.done).length}/${task.checklist.length} done`
                                                                        : '—'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="table-details-label">Linked tasks</div>
                                                                <div className="table-details-text">
                                                                    {task.linkedTaskIds.length > 0 ? task.linkedTaskIds.length : '—'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="table-details-label">Attachments</div>
                                                                <div className="table-details-text">
                                                                    {task.attachments.length > 0 ? task.attachments.length : '—'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                        ) : (
                            <div className="empty-state">No tasks to display.</div>
                        )}
                    </>
                )}
                {toastMessage && (
                    <div className="toast">
                        {toastMessage}
                    </div>
                )}
                {isNotificationsOpen && (
                    <div className="notif-panel">
                        <div className="notif-header">
                            <div>Notifications</div>
                            <button
                                className="btn btn-ghost btn-compact"
                                onClick={() => setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))}
                            >
                                Mark all read
                            </button>
                        </div>
                        <div className="notif-list">
                            {notifications.length === 0 && <div className="empty-state">No notifications yet.</div>}
                            {notifications.map((item) => (
                                <div
                                    key={item.id}
                                    className={`notif-item ${item.read ? 'read' : ''} ${item.taskId ? 'clickable' : ''}`}
                                    onClick={() => item.taskId && handleNotificationClick(item)}
                                >
                                    <div className="notif-title">{item.message}</div>
                                    <div className="notif-meta">
                                        {item.huddleName} · {new Date(item.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {isBoardSettingsOpen && (
                <div className="modal-overlay">
                    <div className="modal-content settings-modal">
                        <div className="panel-header">
                            <div>
                                <div className="panel-title">Board settings</div>
                                <div className="panel-subtitle">Manage this huddle board</div>
                            </div>
                            <button className="panel-close" onClick={() => setIsBoardSettingsOpen(false)} aria-label="Close">×</button>
                        </div>
                        <div className="panel-body">
                            <div className="panel-section">
                                <div className="section-title">Board</div>
                                <div className="member-name">{activeBoard?.name || activeBoardId || 'Board'}</div>
                                <div className="member-meta">Role: {activeMembership?.role || 'Member'}</div>
                            </div>
                            <div className="panel-section panel-danger">
                                <div className="panel-danger-row">
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
                                        <path d="M12 3l9 16H3l9-16z" />
                                        <path d="M12 9v4" />
                                        <path d="M12 17h.01" />
                                    </svg>
                                    Warning
                                </div>
                                <div className="section-title">Danger zone</div>
                                <div className="panel-text">Delete this board and all tasks, objectives, and key results.</div>
                                <button className="btn btn-delete btn-compact" onClick={handleDeleteBoard}>
                                    Delete board
                                </button>
                            </div>
                            <div className="panel-actions">
                                <div className="panel-actions-right">
                                    <button className="btn btn-ghost btn-compact" onClick={() => setIsBoardSettingsOpen(false)}>
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isScopeSettingsOpen && activeScopeWindow && (
                <div className="modal-overlay">
                    <div className="modal-content settings-modal">
                        <div className="panel-header">
                            <div>
                                <div className="panel-title">Scope window settings</div>
                                <div className="panel-subtitle">Manage this scope window</div>
                            </div>
                            <button className="panel-close" onClick={() => setIsScopeSettingsOpen(false)} aria-label="Close">×</button>
                        </div>
                        <div className="panel-body">
                            <div className="panel-section">
                                <div className="section-title">Scope window</div>
                                <div className="scope-create-grid">
                                    <label>
                                        Title
                                        <input
                                            type="text"
                                            value={scopeSettingsDraft.name}
                                            onChange={(event) => setScopeSettingsDraft((prev) => ({ ...prev, name: event.target.value }))}
                                        />
                                    </label>
                                    <label>
                                        Start date
                                        <input
                                            type="date"
                                            value={scopeSettingsDraft.startDate}
                                            onChange={(event) => setScopeSettingsDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                                        />
                                    </label>
                                    <label>
                                        End date
                                        <input
                                            type="date"
                                            value={scopeSettingsDraft.endDate}
                                            onChange={(event) => setScopeSettingsDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                                        />
                                    </label>
                                    <label className="scope-create-span">
                                        Notes
                                        <textarea
                                            rows={3}
                                            value={scopeSettingsDraft.description}
                                            onChange={(event) => setScopeSettingsDraft((prev) => ({ ...prev, description: event.target.value }))}
                                        />
                                    </label>
                                </div>
                                {scopeSettingsDateInvalid && (
                                    <div className="form-error">End date must be after start date.</div>
                                )}
                                <div className="member-meta">Huddle: {activeHuddleName || '—'}</div>
                            </div>
                            <div className="panel-section panel-danger">
                                <div className="panel-danger-row">
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
                                        <path d="M12 3l9 16H3l9-16z" />
                                        <path d="M12 9v4" />
                                        <path d="M12 17h.01" />
                                    </svg>
                                    Warning
                                </div>
                                <div className="section-title">Danger zone</div>
                                <div className="panel-text">Delete this scope window and remove its task links.</div>
                                <button
                                    className="btn btn-delete btn-compact"
                                    onClick={() => {
                                        handleScopeDelete(activeScopeWindow.id);
                                        setIsScopeSettingsOpen(false);
                                    }}
                                >
                                    Delete scope window
                                </button>
                            </div>
                            <div className="panel-actions">
                                <div className="panel-actions-left">
                                    <button className="btn btn-ghost btn-compact" onClick={() => setIsScopeSettingsOpen(false)}>
                                        Cancel
                                    </button>
                                </div>
                                <div className="panel-actions-right">
                                    <button
                                        className="btn btn-primary btn-compact"
                                        onClick={handleScopeSettingsSave}
                                        disabled={!scopeSettingsDraft.name.trim() || scopeSettingsDateInvalid}
                                    >
                                        Save changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {krComposerOpen && (
                <div className="modal-overlay">
                    <div className="modal-content settings-modal">
                        <div className="panel-header">
                            <div>
                                <div className="panel-title">{krEditingId ? 'KR bearbeiten' : 'KR erstellen'}</div>
                                <div className="panel-subtitle">
                                    {krEditingId ? 'Update the metric and target.' : 'Define the metric and target.'}
                                </div>
                            </div>
                            <button
                                className="panel-close"
                                onClick={() => {
                                    setKrComposerOpen(false);
                                    setKrComposerObjectiveId(null);
                                    setKrEditingId(null);
                                }}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                        <div className="panel-body">
                            <div className="panel-section">
                                <div className="section-title">Details</div>
                                <div className="okr-grid">
                                    <label>
                                        Title
                                        <input
                                            type="text"
                                            placeholder="e.g. Improve activation rate"
                                            value={krComposerDraft.title}
                                            onChange={(e) => setKrComposerDraft((prev) => ({ ...prev, title: e.target.value }))}
                                        />
                                    </label>
                                    <label className="okr-grid-full">
                                        Description
                                        <textarea
                                            placeholder="What does this key result capture?"
                                            value={krComposerDraft.description}
                                            onChange={(e) => setKrComposerDraft((prev) => ({ ...prev, description: e.target.value }))}
                                            rows={3}
                                        />
                                    </label>
                                    <label>
                                        Start
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={krComposerDraft.startValue}
                                            onChange={(e) => setKrComposerDraft((prev) => ({ ...prev, startValue: e.target.value }))}
                                        />
                                    </label>
                                    <label>
                                        Target
                                        <input
                                            type="number"
                                            placeholder="100"
                                            value={krComposerDraft.targetValue}
                                            onChange={(e) => setKrComposerDraft((prev) => ({ ...prev, targetValue: e.target.value }))}
                                        />
                                    </label>
                                    <label>
                                        Status
                                        <select
                                            value={krComposerDraft.status}
                                            onChange={(e) => setKrComposerDraft((prev) => ({ ...prev, status: e.target.value }))}
                                        >
                                            <option value="ON_TRACK">On track</option>
                                            <option value="AT_RISK">At risk</option>
                                            <option value="OFF_TRACK">Off track</option>
                                        </select>
                                    </label>
                                </div>
                            </div>
                            <div className="panel-section">
                                <div className="section-title">Members</div>
                                <div className="assignee-grid">
                                    {getMembersForTenant(activeTenantId).map((member) => {
                                        const checked = krComposerDraft.assignees.includes(member.userId);
                                        return (
                                            <label key={member.userId} className="assignee-chip">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const next = e.target.checked
                                                            ? krComposerDraft.assignees.concat(member.userId)
                                                            : krComposerDraft.assignees.filter((id) => id !== member.userId);
                                                        setKrComposerDraft((prev) => ({ ...prev, assignees: next }));
                                                    }}
                                                />
                                                <span>{member.user?.name || member.user?.email || member.userId}</span>
                                            </label>
                                        );
                                    })}
                                    {getMembersForTenant(activeTenantId).length === 0 && (
                                        <div className="empty-state">No members in this huddle yet.</div>
                                    )}
                                </div>
                            </div>
                            <div className="panel-actions">
                                <div className="panel-actions-left">
                                    <button
                                        className="btn btn-ghost btn-compact"
                                        onClick={() => {
                                            setKrComposerOpen(false);
                                            setKrComposerObjectiveId(null);
                                            setKrEditingId(null);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="panel-actions-right">
                                    <button className="btn btn-primary btn-compact" onClick={handleKrComposerSubmit}>
                                        {krEditingId ? 'Save changes' : 'Create key result'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isObjectiveSettingsOpen && (
                <div className="modal-overlay">
                    <div className="modal-content settings-modal">
                        <div className="panel-header">
                            <div>
                                <div className="panel-title">Objective settings</div>
                                <div className="panel-subtitle">Edit or delete this objective</div>
                            </div>
                            <button className="panel-close" onClick={() => {
                                setIsObjectiveSettingsOpen(false);
                                setObjectiveEditId(null);
                            }} aria-label="Close">×</button>
                        </div>
                        <div className="panel-body">
                            <div className="panel-section">
                                <div className="section-title">Details</div>
                                <div className="okr-grid">
                                    <label>
                                        Title
                                        <input
                                            type="text"
                                            value={objectiveDraft.title}
                                            onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, title: e.target.value }))}
                                        />
                                    </label>
                                    <label className="okr-grid-full">
                                        Description
                                        <textarea
                                            value={objectiveDraft.description}
                                            onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, description: e.target.value }))}
                                            rows={3}
                                        />
                                    </label>
                                    <label>
                                        Owner
                                        <select
                                            value={objectiveDraft.ownerId}
                                            onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, ownerId: e.target.value }))}
                                        >
                                            <option value="">Unassigned</option>
                                            {getMembersForTenant(activeTenantId).map((member) => (
                                                <option key={member.userId} value={member.userId}>
                                                    {member.user?.name || member.user?.email || member.userId}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Start date
                                        <input
                                            type="date"
                                            value={objectiveDraft.startDate}
                                            onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                                        />
                                    </label>
                                    <label>
                                        End date
                                        <input
                                            type="date"
                                            value={objectiveDraft.endDate}
                                            onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                                        />
                                    </label>
                                    <label>
                                        Status
                                        <select
                                            value={objectiveDraft.status}
                                            onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, status: e.target.value }))}
                                        >
                                            <option value="ACTIVE">Active</option>
                                            <option value="AT_RISK">At risk</option>
                                            <option value="PAUSED">Paused</option>
                                            <option value="DONE">Done</option>
                                        </select>
                                    </label>
                                </div>
                            </div>
                            <div className="panel-section">
                                <div className="section-title">Key results</div>
                                {okrActiveObjective?.keyResults?.length ? (
                                    <div className="template-list">
                                        {okrActiveObjective.keyResults.map((kr) => (
                                            <div key={kr.id} className="template-row">
                                                <div>
                                                    <div className="member-name">{kr.title}</div>
                                                    <div className="member-meta">{kr.currentValue} / {kr.targetValue}</div>
                                                </div>
                                                <button
                                                    className="icon-action delete"
                                                    onClick={() => handleDeleteKeyResult(kr.id, okrActiveObjective.id)}
                                                    data-tooltip="KR löschen"
                                                    aria-label="KR löschen"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                                        <path d="M6 6l12 12" />
                                                        <path d="M18 6L6 18" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state">No key results yet.</div>
                                )}
                            </div>
                            <div className="panel-section panel-danger">
                                <div className="panel-danger-row">
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
                                        <path d="M12 3l9 16H3l9-16z" />
                                        <path d="M12 9v4" />
                                        <path d="M12 17h.01" />
                                    </svg>
                                    Warning
                                </div>
                                <div className="section-title">Danger zone</div>
                                <div className="panel-text">Delete this objective and its key results.</div>
                                {objectiveEditId && (
                                    <button
                                        className="btn btn-delete btn-compact"
                                        onClick={() => {
                                            handleDeleteObjective(objectiveEditId);
                                            setIsObjectiveSettingsOpen(false);
                                            setObjectiveEditId(null);
                                        }}
                                    >
                                        Delete objective
                                    </button>
                                )}
                            </div>
                            <div className="panel-actions">
                                <div className="panel-actions-left">
                                    <button
                                        className="btn btn-ghost btn-compact"
                                        onClick={() => {
                                            setIsObjectiveSettingsOpen(false);
                                            setObjectiveEditId(null);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="panel-actions-right">
                                    <button
                                        className="btn btn-secondary btn-compact"
                                        onClick={() => {
                                            handleObjectiveComposerSubmit();
                                            setIsObjectiveSettingsOpen(false);
                                            setObjectiveEditId(null);
                                        }}
                                    >
                                        Save changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isTeamModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content team-modal">
                        <div className="panel-header">
                            <div>
                                <div className="panel-title">Huddle settings</div>
                                <div className="panel-subtitle">Manage huddles and members</div>
                            </div>
                            <button className="panel-close" onClick={() => setIsTeamModalOpen(false)} aria-label="Close">×</button>
                        </div>
                        <div className="panel-body">
                            <div className="panel-section">
                                <div className="section-title">Active huddle</div>
                                <div className="team-active-row">
                                    <div className="team-name">
                                        {activeHuddleName || activeTenantId}
                                    </div>
                                    <button className="btn btn-ghost btn-compact" onClick={() => activeTenantId && loadTeamMembers(activeTenantId)}>
                                        Refresh members
                                    </button>
                                </div>
                            </div>

                            <div className="panel-section">
                                <div className="section-title">Create a new huddle</div>
                                <form className="inline-form" onSubmit={handleCreateTeam}>
                                    <input
                                        type="text"
                                        placeholder="Huddle name"
                                        value={teamNameInput}
                                        onChange={(e) => setTeamNameInput(e.target.value)}
                                        required
                                    />
                                    <button className="btn btn-primary" type="submit">Create</button>
                                </form>
                            </div>

                            <div className="panel-section">
                                <div className="section-title">Invite to huddle</div>
                                {isPersonalActive ? (
                                    <div className="empty-state">Private huddles are personal and cannot have members.</div>
                                ) : (
                                    <form className="inline-form" onSubmit={handleInviteMember}>
                                        <input
                                            type="email"
                                            placeholder="email@company.com"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            required
                                        />
                                        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                                            <option value="MEMBER">Member</option>
                                            <option value="ADMIN">Admin</option>
                                        </select>
                                        <button className="btn btn-primary" type="submit">Invite</button>
                                    </form>
                                )}
                            </div>

                            <div className="panel-section">
                                <div className="section-title">Huddle members</div>
                                <div className="member-list">
                                    {teamMembers.map((member) => {
                                        const isSelf = member.userId === userProfile?.id;
                                        return (
                                            <div key={member.id} className="member-row">
                                                <div>
                                                    <div className="member-name">{member.user?.name || member.user?.email}</div>
                                                    <div className="member-meta">{member.user?.email}</div>
                                                </div>
                                                <div className="member-actions">
                                                    <select
                                                        value={member.role}
                                                        onChange={(e) => handleMemberRoleChange(member.id, e.target.value)}
                                                        disabled={isSelf}
                                                    >
                                                        <option value="MEMBER">Member</option>
                                                        <option value="ADMIN">Admin</option>
                                                    </select>
                                                    <button
                                                        className="btn btn-ghost btn-compact"
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        disabled={isSelf}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {teamMembers.length === 0 && (
                                        <div className="empty-state">No members yet.</div>
                                    )}
                                </div>
                            </div>

                            {teamError && <div className="auth-error">{teamError}</div>}
                        </div>
                    </div>
                </div>
            )}

            {isInvitesModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content team-modal">
                        <div className="panel-header">
                            <div>
                                <div className="panel-title">Huddle invites</div>
                                <div className="panel-subtitle">Accept or decline invitations</div>
                            </div>
                            <button className="panel-close" onClick={() => setIsInvitesModalOpen(false)} aria-label="Close">×</button>
                        </div>
                        <div className="panel-body">
                            {invites.length > 0 ? (
                                <div className="invite-list">
                                    {invites.map((invite) => (
                                        <div key={invite.id} className="invite-row">
                                            <div>
                                                <div className="member-name">{getHuddleName(invite.tenant?.name) || invite.tenantId}</div>
                                                <div className="member-meta">
                                                    Invited by {invite.invitedBy?.name || invite.invitedBy?.email || invite.invitedByUserId} · {new Date(invite.createdAt).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="invite-actions">
                                                <button
                                                    className="btn btn-primary btn-compact"
                                                    onClick={() => handleInviteDecision(invite, 'accept')}
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-compact"
                                                    onClick={() => handleInviteDecision(invite, 'decline')}
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">No pending invites.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '720px', height: '100vh', overflowY: 'auto', padding: 0 }}>
                        <div style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', padding: '1.25rem 1.5rem 0.75rem', zIndex: 1, borderBottom: '1px solid var(--border-color)' }}>
                            <div className="modal-header-row">
                                <h2 style={{ marginBottom: 0 }}>Create New Task</h2>
                                <button
                                    className="panel-close"
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        setNewTaskAttachments([]);
                                        setNewTaskKinds([]);
                                        setNewKindInput('');
                                        setNewTaskBoardId(null);
                                    }}
                                    aria-label="Close"
                                >
                                    ×
                                </button>
                            </div>
                            {newTaskHuddleId && (
                                <div className="huddle-inline">
                                    <span>Creating in</span>
                                    <span
                                        className="huddle-chip"
                                        style={{
                                            background: getHuddleAccent(newTaskHuddleId, displayMemberships.find((m) => m.tenantId === newTaskHuddleId)?.tenant?.name).soft,
                                            borderColor: getHuddleAccent(newTaskHuddleId, displayMemberships.find((m) => m.tenantId === newTaskHuddleId)?.tenant?.name).border,
                                            color: getHuddleAccent(newTaskHuddleId, displayMemberships.find((m) => m.tenantId === newTaskHuddleId)?.tenant?.name).text
                                        }}
                                    >
                                        <span
                                            className="huddle-dot"
                                            style={{
                                                background: getHuddleAccent(newTaskHuddleId, displayMemberships.find((m) => m.tenantId === newTaskHuddleId)?.tenant?.name).solid
                                            }}
                                        />
                                        {getHuddleName(displayMemberships.find((m) => m.tenantId === newTaskHuddleId)?.tenant?.name)}
                                    </span>
                                </div>
                            )}
                        </div>
                        <form onSubmit={handleCreateTask}>
                            <div style={{ padding: '1rem 1.5rem 0.5rem' }}>
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Basics</div>
                                <div className="form-group">
                                    <label>Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={newTask.title}
                                        onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                                        placeholder="What needs to be done?"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Huddle</label>
                                    <select
                                        value={newTaskHuddleId || ''}
                                        onChange={(e) => setNewTaskHuddleId(e.target.value)}
                                    >
                                        {displayMemberships.map((membership) => (
                                            <option key={membership.id} value={membership.tenantId}>
                                                {getHuddleName(membership.tenant?.name) || membership.tenantId}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Board</label>
                                    <select
                                        value={newTaskBoardId || ''}
                                        onChange={(e) => setNewTaskBoardId(e.target.value)}
                                    >
                                        {getWritableBoards(newTaskHuddleId).map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {!isPersonalTenant(newTaskHuddleId) && (
                                    <div className="form-group">
                                        <label>Owner</label>
                                        <select
                                            value={newTaskOwnerId || ''}
                                            onChange={(e) => setNewTaskOwnerId(e.target.value || null)}
                                        >
                                            <option value="">Unassigned</option>
                                            {getMembersForTenant(newTaskHuddleId).map((member) => (
                                                <option key={member.userId} value={member.userId}>
                                                    {member.user?.name || member.user?.email || member.userId}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Template</label>
                                    <div className="template-picker">
                                        <select
                                            value={selectedTemplateId}
                                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                                        >
                                            <option value="">Choose template</option>
                                            {settingsDraft?.taskTemplates?.map((template: any) => (
                                                <option key={template.id} value={template.id}>
                                                    {template.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-compact"
                                            onClick={() => {
                                                const template = settingsDraft?.taskTemplates?.find((t: any) => t.id === selectedTemplateId);
                                                if (!template) return;
                                                setNewTask({
                                                    ...newTask,
                                                    title: template.title,
                                                    priority: template.priority,
                                                });
                                                setNewTaskStatus(template.status as TaskStatus);
                                            }}
                                            disabled={!selectedTemplateId}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </div>
                                {!isPersonalTenant(newTaskHuddleId) && (
                                    <div className="form-group">
                                        <label>Members</label>
                                        <div className="assignee-grid">
                                            {getMembersForTenant(newTaskHuddleId).map((member) => {
                                                const checked = newTaskAssignees.includes(member.userId);
                                                return (
                                                    <label key={member.userId} className="assignee-chip">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={(e) => {
                                                                const next = e.target.checked
                                                                    ? newTaskAssignees.concat(member.userId)
                                                                    : newTaskAssignees.filter((id) => id !== member.userId);
                                                                setNewTaskAssignees(next);
                                                            }}
                                                        />
                                                        <span>{member.user?.name || member.user?.email || member.userId}</span>
                                                    </label>
                                                );
                                            })}
                                            {getMembersForTenant(newTaskHuddleId).length === 0 && (
                                                <div className="empty-state">No members in this huddle yet.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Description</label>
                                    <div className="rich-editor">
                                        <div className="rich-toolbar">
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('bold')}>B</button>
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('italic')}>I</button>
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('underline')}>U</button>
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('insertUnorderedList')}>• List</button>
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('insertOrderedList')}>1. List</button>
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('createLink')}>Link</button>
                                        </div>
                                        <div
                                            className="rich-content"
                                            contentEditable
                                            dir="ltr"
                                            ref={newDescriptionRef}
                                            onInput={(e) => setNewTask({ ...newTask, description: e.currentTarget.innerHTML })}
                                            onPaste={handlePastePlain}
                                            data-placeholder="Optional details..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Classification</div>
                                <div className="form-group">
                                    <label>Art</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="text"
                                            value={newKindInput}
                                            onChange={e => setNewKindInput(e.target.value)}
                                            onKeyDown={(e) => handleKindKeyDown(e, 'new')}
                                            placeholder="z.B. Bug, Feature, Idee"
                                            list="kind-suggestions"
                                        />
                                        <button type="button" className="btn btn-secondary" onClick={handleNewKindAdd}>
                                            Add
                                        </button>
                                    </div>
                                    {newTaskKinds.length > 0 && (
                                        <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {newTaskKinds.map((kind) => (
                                                <span
                                                    key={kind}
                                                    style={{
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '9999px',
                                                        padding: '0.2rem 0.6rem',
                                                        fontSize: '0.75rem'
                                                    }}
                                                >
                                                    {kind}
                                                    <button
                                                        type="button"
                                                        className="delete-btn"
                                                        style={{ opacity: 1, marginLeft: '0.4rem' }}
                                                        onClick={() => removeKindValue(kind, setNewTaskKinds)}
                                                    >
                                                        ✕
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Priority</label>
                                    <select
                                        value={newTask.priority}
                                        onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Deadline</label>
                                    <input
                                        type="date"
                                        value={newTask.dueDate}
                                        onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Attachments</div>
                                <div className="form-group">
                                    <label>Files</label>
                                    <input
                                        type="file"
                                        multiple
                                        onChange={(e) => handleCreateAttachmentSelect(e.target.files)}
                                    />
                                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {newTaskAttachments.map((attachment) => (
                                            <div key={attachment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.9rem' }}>{attachment.name}</span>
                                                <button
                                                    type="button"
                                                    className="delete-btn"
                                                    style={{ opacity: 1 }}
                                                    onClick={() => handleRemoveCreateAttachment(attachment.id)}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="detail-section">
                                <div className="detail-section-title">Checklist</div>
                                <div className="checklist-input-row">
                                    <input
                                        className="checklist-input"
                                        type="text"
                                        value={checklistInput}
                                        onChange={(e) => setChecklistInput(e.target.value)}
                                        placeholder="Add checklist item"
                                    />
                                    <button
                                        type="button"
                                        className="icon-action create"
                                        onClick={handleChecklistAdd}
                                        data-tooltip="Checklist erstellen"
                                        aria-label="Checklist erstellen"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                            <path d="M12 5v14" />
                                            <path d="M5 12h14" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="checklist-list">
                                    {checklistDraft.length > 0 ? (
                                        checklistDraft.map((item) => (
                                            <label key={item.id} className="checklist-item">
                                                <input
                                                    type="checkbox"
                                                    checked={item.done}
                                                    onChange={() => handleChecklistToggle(item.id)}
                                                />
                                                <span className={item.done ? 'checklist-text checklist-done' : 'checklist-text'}>
                                                    {item.text}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="delete-btn"
                                                    onClick={() => handleChecklistRemove(item.id)}
                                                >
                                                    Remove
                                                </button>
                                            </label>
                                        ))
                                    ) : (
                                        <div className="checklist-empty">No checklist items.</div>
                                    )}
                                </div>
                            </div>
                            <div className="detail-section">
                                <div className="detail-section-title">Linked tasks</div>
                                <div className="link-row">
                                    <select
                                        className="link-select"
                                        value={linkSelectId}
                                        onChange={(e) => setLinkSelectId(e.target.value)}
                                    >
                                        <option value="">Select task to link</option>
                                        {tasks
                                            .filter((task) => task.id !== editingTaskId && !linkedDraft.includes(task.id))
                                            .map((task) => (
                                                <option key={task.id} value={task.id}>
                                                    {task.title}
                                                </option>
                                            ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="icon-action create"
                                        onClick={handleAddLink}
                                        data-tooltip="Link erstellen"
                                        aria-label="Link erstellen"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                            <path d="M12 5v14" />
                                            <path d="M5 12h14" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="link-list">
                                    {linkedDraft.length > 0 ? (
                                        linkedDraft.map((taskId) => (
                                            <div key={taskId} className="link-chip">
                                                <span className="link-title">{taskById.get(taskId)?.title ?? taskId}</span>
                                                <button
                                                    type="button"
                                                    className="link-remove"
                                                    onClick={() => handleRemoveLink(taskId)}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="link-empty">No linked tasks.</div>
                                    )}
                                </div>
                            </div>
                            </div>
                            <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-secondary)', padding: '0.75rem 1.5rem 1.25rem', borderTop: '1px solid var(--border-color)', marginTop: '2rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setIsModalOpen(false);
                                            setNewTaskAttachments([]);
                                            setNewTaskKinds([]);
                                            setNewKindInput('');
                                            setNewTaskBoardId(null);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        Speichern
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isDetailsModalOpen && selectedTask && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '720px', height: '100vh', overflowY: 'auto', padding: 0 }}>
                        <div style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', padding: '1.25rem 1.5rem 0.75rem', zIndex: 1, borderBottom: '1px solid var(--border-color)' }}>
                            <div className="detail-header-top">
                                <div className="detail-meta">
                                    Created {new Date(selectedTask.createdAt).toLocaleDateString()}
                                </div>
                            <div className="detail-actions">
                                <button
                                    className="panel-close"
                                    onClick={() => {
                                        setIsDetailsModalOpen(false);
                                        setSelectedTaskId(null);
                                    }}
                                    aria-label="Close"
                                >
                                    ×
                                </button>
                                <button
                                    className={selectedTask.isFavorite ? 'icon-btn favorite-icon active' : 'icon-btn favorite-icon'}
                                    onClick={() => toggleFavorite(selectedTask)}
                                    title={selectedTask.isFavorite ? 'Unfavorite' : 'Favorite'}
                                    aria-label={selectedTask.isFavorite ? 'Unfavorite task' : 'Favorite task'}
                                >
                                    {selectedTask.isFavorite ? '★' : '☆'}
                                </button>
                                {selectedTask.sourceType === 'MANUAL' && (
                                    <>
                                        <button
                                            className="icon-btn"
                                            onClick={() => handleArchiveToggle(selectedTask)}
                                            title={selectedTask.status === TaskStatus.ARCHIVED ? 'Restore' : 'Archive'}
                                            aria-label={selectedTask.status === TaskStatus.ARCHIVED ? 'Restore task' : 'Archive task'}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                <path d="M3 7h18" />
                                                <path d="M5 7l1 13h12l1-13" />
                                                <path d="M9 11h6" />
                                            </svg>
                                        </button>
                                        <button
                                            className="icon-btn"
                                            onClick={() => {
                                                setIsDetailsModalOpen(false);
                                                openEditModal(selectedTask);
                                                }}
                                                title="Edit"
                                                aria-label="Edit task"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                    <path d="M12 20h9" />
                                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                                </svg>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="detail-title">{selectedTask.title}</div>
                            <div className="detail-chips">
                                {selectedTask.kinds.map((kind) => (
                                    <span key={kind} className="chip chip-muted">{kind}</span>
                                ))}
                                <span className={`chip chip-priority priority-${selectedTask.priority.toLowerCase()}`}>
                                    {selectedTask.priority}
                                </span>
                            </div>
                        </div>
                        <div style={{ padding: '1rem 1.5rem 0.5rem' }}>
                        <div className="detail-section">
                            <div className="detail-section-title">Overview</div>
                            <div className="detail-rows">
                                <div className="detail-row">
                                    <span className="detail-label">
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="detail-icon">
                                            <path d="M5 12h14" />
                                            <path d="M12 5l7 7-7 7" />
                                        </svg>
                                        Status
                                    </span>
                                    <span className="detail-value">{selectedTask.status}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="detail-icon">
                                            <rect x="3" y="5" width="18" height="16" rx="2" />
                                            <path d="M8 3v4M16 3v4M3 11h18" />
                                        </svg>
                                        Due date
                                    </span>
                                    <span className="detail-value">
                                        {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : '—'}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="detail-icon">
                                            <path d="M20 21a8 8 0 0 0-16 0" />
                                            <circle cx="12" cy="8" r="4" />
                                        </svg>
                                        Owner
                                    </span>
                                    <span className="detail-value">
                                        {selectedTask.ownerId
                                            ? renderAvatarStack(selectedTask.tenantId, [selectedTask.ownerId], 'avatar-stack-lg')
                                            : '—'}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="detail-icon">
                                            <circle cx="9" cy="8" r="3" />
                                            <circle cx="17" cy="9" r="2.5" />
                                            <path d="M3 21a6 6 0 0 1 12 0" />
                                            <path d="M14.5 21a4.5 4.5 0 0 1 7.5 0" />
                                        </svg>
                                        Assignees
                                    </span>
                                    <span className="detail-value">
                                        {selectedTask.assignees.length > 0
                                            ? renderAvatarStack(selectedTask.tenantId, selectedTask.assignees, 'avatar-stack-lg')
                                            : '—'}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="detail-icon">
                                            <path d="M20 12l-8 8-8-8 8-8 8 8z" />
                                        </svg>
                                        Labels
                                    </span>
                                    <span className="detail-value detail-value-wrap">
                                        {selectedTask.kinds.length > 0 ? (
                                            selectedTask.kinds.map((kind) => (
                                                <span key={kind} className="chip chip-muted">
                                                    {kind}
                                                </span>
                                            ))
                                        ) : (
                                            '—'
                                        )}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="detail-icon">
                                            <path d="M10 14a5 5 0 0 1 0-7l2-2a5 5 0 1 1 7 7l-1 1" />
                                            <path d="M14 10a5 5 0 0 1 0 7l-2 2a5 5 0 1 1-7-7l1-1" />
                                        </svg>
                                        Linked in
                                    </span>
                                    <span className="detail-value">
                                        {incomingLinkedTasks.length > 0
                                            ? incomingLinkedTasks.map((task) => task.title).join(', ')
                                            : '—'}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="detail-icon">
                                            <path d="M4 7h16" />
                                            <path d="M4 12h10" />
                                            <path d="M4 17h13" />
                                        </svg>
                                        All board
                                    </span>
                                    <span className="detail-value">
                                        <span className="detail-toggle-row">
                                            <button
                                                type="button"
                                                className={`detail-toggle ${selectedTask.excludeFromAll ? '' : 'active'}`}
                                                onClick={() => submitTaskUpdate({ excludeFromAll: !selectedTask.excludeFromAll })}
                                                disabled={selectedTask.sourceType !== 'MANUAL'}
                                                aria-label="Show in All board"
                                            >
                                                <span className="detail-toggle-knob" />
                                            </button>
                                            <span className="detail-toggle-text">
                                                {selectedTask.excludeFromAll ? 'Hidden' : 'Shown'}
                                            </span>
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="detail-section">
                            <div className="detail-section-title">Description</div>
                            <div className="detail-description-box">
                                <div
                                    className="detail-description rich-display"
                                    dir="ltr"
                                    dangerouslySetInnerHTML={{
                                        __html: selectedTask.description || 'No description provided.'
                                    }}
                                />
                            </div>
                        </div>

                        <div className="detail-section">
                            <div className="detail-section-title">Linked tasks</div>
                            <div className="link-row">
                                <select
                                    className="link-select"
                                    value={linkSelectId}
                                    onChange={(e) => setLinkSelectId(e.target.value)}
                                >
                                    <option value="">Select task to link</option>
                                    {tasks
                                        .filter((task) => task.id !== selectedTask.id && !linkedDraft.includes(task.id))
                                        .map((task) => (
                                            <option key={task.id} value={task.id}>
                                                {task.title}
                                            </option>
                                        ))}
                                </select>
                                <button
                                    type="button"
                                    className="icon-action create"
                                    onClick={handleAddLink}
                                    data-tooltip="Link erstellen"
                                    aria-label="Link erstellen"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                        <path d="M12 5v14" />
                                        <path d="M5 12h14" />
                                    </svg>
                                </button>
                            </div>
                            <div className="link-list">
                                {linkedDraft.length > 0 ? (
                                    linkedDraft.map((taskId) => (
                                        <div key={taskId} className="link-chip">
                                            <span className="link-title">{taskById.get(taskId)?.title ?? taskId}</span>
                                            <button
                                                type="button"
                                                className="link-remove"
                                                onClick={() => handleRemoveLink(taskId)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="link-empty">No linked tasks.</div>
                                )}
                            </div>
                        </div>

                        <div className="checklist-panel">
                            <div className="section-title">Checklist</div>
                            <div className="checklist-input-row">
                                <input
                                    className="checklist-input"
                                    type="text"
                                    value={checklistInput}
                                    onChange={(e) => setChecklistInput(e.target.value)}
                                    placeholder="Add checklist item"
                                />
                                <button
                                    type="button"
                                    className="icon-action create"
                                    onClick={handleChecklistAdd}
                                    data-tooltip="Checklist erstellen"
                                    aria-label="Checklist erstellen"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                        <path d="M12 5v14" />
                                        <path d="M5 12h14" />
                                    </svg>
                                </button>
                            </div>
                            <div className="checklist-list">
                                {checklistDraft.length > 0 ? (
                                    checklistDraft.map((item) => (
                                        <label key={item.id} className="checklist-item">
                                            <input
                                                type="checkbox"
                                                checked={item.done}
                                                onChange={() => handleChecklistToggle(item.id)}
                                            />
                                            <span className={item.done ? 'checklist-text checklist-done' : 'checklist-text'}>
                                                {item.text}
                                            </span>
                                            <button
                                                type="button"
                                                className="delete-btn"
                                                onClick={() => handleChecklistRemove(item.id)}
                                            >
                                                Remove
                                            </button>
                                        </label>
                                    ))
                                ) : (
                                    <div className="checklist-empty">No checklist items.</div>
                                )}
                            </div>
                        </div>

                        <div className="detail-tabs" style={{ ['--active-index' as any]: detailTab === 'comments' ? 0 : detailTab === 'attachments' ? 1 : 2 }}>
                            <button
                                className={`detail-tab ${detailTab === 'comments' ? 'active' : ''}`}
                                onClick={() => setDetailTab('comments')}
                            >
                                Comments
                            </button>
                            <button
                                className={`detail-tab ${detailTab === 'attachments' ? 'active' : ''}`}
                                onClick={() => setDetailTab('attachments')}
                            >
                                Attachments
                            </button>
                            <button
                                className={`detail-tab ${detailTab === 'activity' ? 'active' : ''}`}
                                onClick={() => setDetailTab('activity')}
                            >
                                Activity
                            </button>
                        </div>

                        {detailTab === 'comments' && (
                            <div className="comments-panel">
                                <div className="section-title">Comments</div>
                                <div className="comment-input-row">
                                    <div className="comment-avatar">{currentUserInitial}</div>
                                    <input
                                        className="comment-input"
                                        type="text"
                                        value={commentInput}
                                        onChange={(e) => setCommentInput(e.target.value)}
                                        placeholder="Write a comment"
                                    />
                                    <button
                                        type="button"
                                        className="icon-action create"
                                        onClick={handleAddComment}
                                        data-tooltip="Kommentar erstellen"
                                        aria-label="Kommentar erstellen"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                            <path d="M12 5v14" />
                                            <path d="M5 12h14" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="comment-list">
                                    {selectedTask.comments && selectedTask.comments.length > 0 ? (
                                        selectedTask.comments.map((comment) => {
                                            const authorInfo = getMemberInfo(selectedTask.tenantId, comment.createdBy);
                                            return (
                                                <div key={comment.id} className="comment-card">
                                                    {authorInfo.avatarUrl ? (
                                                        <img
                                                            className="comment-avatar comment-avatar-small"
                                                            src={authorInfo.avatarUrl}
                                                            alt={authorInfo.label}
                                                        />
                                                    ) : (
                                                        <div className="comment-avatar comment-avatar-small">
                                                            {authorInfo.label.charAt(0).toUpperCase() || 'U'}
                                                        </div>
                                                    )}
                                                    <div className="comment-body">
                                                        <div className="comment-meta">
                                                            <span className="comment-author">{authorInfo.label}</span>
                                                            <span className="comment-time">{new Date(comment.createdAt).toLocaleString()}</span>
                                                        </div>
                                                        <div className="comment-text">{comment.text}</div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="comment-empty">No comments yet.</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {detailTab === 'attachments' && (
                            <div className="detail-section">
                                <div className="detail-section-title">Attachments</div>
                                <div className="link-row">
                                    <input
                                        className="link-select"
                                        type="file"
                                        multiple
                                        onChange={(e) => handleAttachmentSelect(e.target.files)}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-compact"
                                        onClick={async () => {
                                            if (!selectedTask || newAttachments.length === 0) return;
                                            try {
                                                await submitTaskUpdate({ attachmentsToAdd: newAttachments });
                                                setNewAttachments([]);
                                            } catch (e: any) {
                                                alert(e.message);
                                            }
                                        }}
                                    >
                                        Upload
                                    </button>
                                </div>
                                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {selectedTask.attachments && selectedTask.attachments.length > 0 ? (
                                        selectedTask.attachments.map((attachment) => (
                                            <div key={attachment.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.9rem' }}>{attachment.name}</span>
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                        <a
                                                            href={attachment.dataUrl}
                                                            download={attachment.name}
                                                            style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}
                                                        >
                                                            Download
                                                        </a>
                                                        <button
                                                            type="button"
                                                            className="delete-btn"
                                                            onClick={() => submitTaskUpdate({ attachmentsToRemove: [attachment.id] })}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                                {attachment.type.startsWith('image/') && (
                                                    <img
                                                        src={attachment.dataUrl}
                                                        alt={attachment.name}
                                                        style={{
                                                            width: '160px',
                                                            height: '110px',
                                                            objectFit: 'cover',
                                                            borderRadius: '0.5rem',
                                                            border: '1px solid var(--border-color)'
                                                        }}
                                                        className="attachment-thumb"
                                                        onClick={() => setImagePreview({ src: attachment.dataUrl, name: attachment.name })}
                                                    />
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ color: 'var(--text-secondary)' }}>No attachments.</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {detailTab === 'activity' && (
                            <div className="detail-section">
                                <div className="detail-section-title">Activity</div>
                                <div className="activity-list">
                                    {selectedTask.activityLog && selectedTask.activityLog.length > 0 ? (
                                        [...selectedTask.activityLog]
                                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                            .map((entry) => {
                                                const actorInfo = getMemberInfo(selectedTask.tenantId, entry.actorId);
                                                return (
                                                    <div key={entry.id} className="activity-item">
                                                        {actorInfo.avatarUrl ? (
                                                            <img
                                                                className="comment-avatar comment-avatar-small"
                                                                src={actorInfo.avatarUrl}
                                                                alt={actorInfo.label}
                                                            />
                                                        ) : (
                                                            <div className="comment-avatar comment-avatar-small">
                                                                {actorInfo.label.charAt(0).toUpperCase() || 'U'}
                                                            </div>
                                                        )}
                                                        <div className="activity-body">
                                                            <div className="activity-text">{entry.message}</div>
                                                            <div className="activity-meta">
                                                                {actorInfo.label} · {new Date(entry.timestamp).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    ) : (
                                        <div className="activity-empty">No activity yet.</div>
                                    )}
                                </div>
                            </div>
                        )}
                        </div>
                        <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-secondary)', padding: '0.75rem 1.5rem 1.25rem', borderTop: '1px solid var(--border-color)', marginTop: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {selectedTask.sourceType === 'MANUAL' && (
                                    <button
                                        className="btn btn-secondary btn-delete"
                                        onClick={() => handleDeleteTask(selectedTask.id)}
                                    >
                                        Löschen
                                    </button>
                                )}
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setIsDetailsModalOpen(false);
                                        setSelectedTaskId(null);
                                    }}
                                >
                                    Speichern
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {imagePreview && (
                <div className="image-overlay" onClick={() => setImagePreview(null)}>
                    <div className="image-overlay-content" onClick={(e) => e.stopPropagation()}>
                        <button className="image-overlay-close" onClick={() => setImagePreview(null)}>
                            ✕
                        </button>
                        <img src={imagePreview.src} alt={imagePreview.name} />
                        <div className="image-overlay-caption">{imagePreview.name}</div>
                    </div>
                </div>
            )}

            {isEditModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '720px', height: '100vh', overflowY: 'auto', padding: 0 }}>
                        <div style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', padding: '1.25rem 1.5rem 0.75rem', zIndex: 1, borderBottom: '1px solid var(--border-color)' }}>
                            <div className="modal-header-row">
                                <h2 style={{ marginBottom: 0 }}>Edit Task</h2>
                                <button
                                    className="panel-close"
                                    onClick={() => {
                                        setIsEditModalOpen(false);
                                        setEditingTaskId(null);
                                        setNewAttachments([]);
                                        setRemovedAttachmentIds([]);
                                        setEditTaskKinds([]);
                                        setEditKindInput('');
                                        setChecklistDraft([]);
                                        setChecklistInput('');
                                        setLinkedDraft([]);
                                        setLinkSelectId('');
                                    }}
                                    aria-label="Close"
                                >
                                    ×
                                </button>
                            </div>
                            {editTaskHuddleId && (
                                <div className="huddle-inline">
                                    <span>Editing in</span>
                                    <span
                                        className="huddle-chip"
                                        style={{
                                            background: getHuddleAccent(editTaskHuddleId, displayMemberships.find((m) => m.tenantId === editTaskHuddleId)?.tenant?.name).soft,
                                            borderColor: getHuddleAccent(editTaskHuddleId, displayMemberships.find((m) => m.tenantId === editTaskHuddleId)?.tenant?.name).border,
                                            color: getHuddleAccent(editTaskHuddleId, displayMemberships.find((m) => m.tenantId === editTaskHuddleId)?.tenant?.name).text
                                        }}
                                    >
                                        <span
                                            className="huddle-dot"
                                            style={{
                                                background: getHuddleAccent(editTaskHuddleId, displayMemberships.find((m) => m.tenantId === editTaskHuddleId)?.tenant?.name).solid
                                            }}
                                        />
                                        {getHuddleName(displayMemberships.find((m) => m.tenantId === editTaskHuddleId)?.tenant?.name)}
                                    </span>
                                </div>
                            )}
                        </div>
                        <form onSubmit={handleUpdateTaskDetails}>
                            <div style={{ padding: '1rem 1.5rem 0.5rem' }}>
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Basics</div>
                                <div className="form-group">
                                    <label>Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={editTask.title}
                                        onChange={e => setEditTask({ ...editTask, title: e.target.value })}
                                        placeholder="What needs to be done?"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Huddle</label>
                                    <select
                                        value={editTaskHuddleId || ''}
                                        onChange={(e) => setEditTaskHuddleId(e.target.value)}
                                    >
                                        {displayMemberships.map((membership) => (
                                            <option key={membership.id} value={membership.tenantId}>
                                                {getHuddleName(membership.tenant?.name) || membership.tenantId}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Board</label>
                                    <select
                                        value={editTaskBoardId || ''}
                                        onChange={(e) => setEditTaskBoardId(e.target.value)}
                                    >
                                        {getWritableBoards(editTaskHuddleId || activeTenantId).map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {!isPersonalTenant(editTaskHuddleId) && (
                                    <div className="form-group">
                                        <label>Owner</label>
                                        <select
                                            value={editTaskOwnerId || ''}
                                            onChange={(e) => setEditTaskOwnerId(e.target.value || null)}
                                        >
                                            <option value="">Unassigned</option>
                                            {getMembersForTenant(editTaskHuddleId).map((member) => (
                                                <option key={member.userId} value={member.userId}>
                                                    {member.user?.name || member.user?.email || member.userId}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {!isPersonalTenant(editTaskHuddleId) && (
                                    <div className="form-group">
                                        <label>Members</label>
                                        <div className="assignee-grid">
                                            {getMembersForTenant(editTaskHuddleId).map((member) => {
                                                const checked = editTaskAssignees.includes(member.userId);
                                                return (
                                                    <label key={member.userId} className="assignee-chip">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={(e) => {
                                                                const next = e.target.checked
                                                                    ? editTaskAssignees.concat(member.userId)
                                                                    : editTaskAssignees.filter((id) => id !== member.userId);
                                                                setEditTaskAssignees(next);
                                                            }}
                                                        />
                                                        <span>{member.user?.name || member.user?.email || member.userId}</span>
                                                    </label>
                                                );
                                            })}
                                            {getMembersForTenant(editTaskHuddleId).length === 0 && (
                                                <div className="empty-state">No members in this huddle yet.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Description</label>
                                    <div className="rich-editor">
                                        <div className="rich-toolbar">
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('bold')}>B</button>
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('italic')}>I</button>
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('underline')}>U</button>
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('insertUnorderedList')}>• List</button>
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('insertOrderedList')}>1. List</button>
                                            <button type="button" className="rich-button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('createLink')}>Link</button>
                                        </div>
                                        <div
                                            className="rich-content"
                                            contentEditable
                                            dir="ltr"
                                            ref={editDescriptionRef}
                                            onInput={(e) => setEditTask({ ...editTask, description: e.currentTarget.innerHTML })}
                                            onPaste={handlePastePlain}
                                            data-placeholder="Optional details..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Classification</div>
                                <div className="form-group">
                                    <label>Art</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="text"
                                            value={editKindInput}
                                            onChange={e => setEditKindInput(e.target.value)}
                                            onKeyDown={(e) => handleKindKeyDown(e, 'edit')}
                                            placeholder="z.B. Bug, Feature, Idee"
                                            list="kind-suggestions"
                                        />
                                        <button type="button" className="btn btn-secondary" onClick={handleEditKindAdd}>
                                            Add
                                        </button>
                                    </div>
                                    {editTaskKinds.length > 0 && (
                                        <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {editTaskKinds.map((kind) => (
                                                <span
                                                    key={kind}
                                                    style={{
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '9999px',
                                                        padding: '0.2rem 0.6rem',
                                                        fontSize: '0.75rem'
                                                    }}
                                                >
                                                    {kind}
                                                    <button
                                                        type="button"
                                                        className="delete-btn"
                                                        style={{ opacity: 1, marginLeft: '0.4rem' }}
                                                        onClick={() => removeKindValue(kind, setEditTaskKinds)}
                                                    >
                                                        ✕
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Priority</label>
                                    <select
                                        value={editTask.priority}
                                        onChange={e => setEditTask({ ...editTask, priority: e.target.value })}
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Deadline</label>
                                    <input
                                        type="date"
                                        value={editTask.dueDate}
                                        onChange={e => setEditTask({ ...editTask, dueDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Attachments</div>
                                <div className="form-group">
                                    <label>Files</label>
                                    <input
                                        type="file"
                                        multiple
                                        onChange={(e) => handleAttachmentSelect(e.target.files)}
                                    />
                                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {[...existingAttachments, ...newAttachments].map((attachment) => (
                                            <div key={attachment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.9rem' }}>{attachment.name}</span>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <a
                                                        href={attachment.dataUrl}
                                                        download={attachment.name}
                                                        style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}
                                                    >
                                                        Download
                                                    </a>
                                                    <button
                                                        type="button"
                                                        className="delete-btn"
                                                        style={{ opacity: 1 }}
                                                        onClick={() => handleRemoveAttachment(attachment.id)}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            </div>
                            <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-secondary)', padding: '0.75rem 1.5rem 1.25rem', borderTop: '1px solid var(--border-color)', marginTop: '2rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setIsEditModalOpen(false);
                                            setEditingTaskId(null);
                                            setNewAttachments([]);
                                            setRemovedAttachmentIds([]);
                                            setEditTaskKinds([]);
                                            setEditKindInput('');
                                            setChecklistDraft([]);
                                            setChecklistInput('');
                                            setLinkedDraft([]);
                                            setLinkSelectId('');
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
